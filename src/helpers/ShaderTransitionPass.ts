import {
    WebGLRenderer,
    WebGLRenderTarget,
    ShaderMaterial,
    Scene,
    Camera,
    PlaneGeometry,
    Mesh,
    LinearFilter,
    RGBAFormat,
    HalfFloatType,
    Vector3,
    Texture,
    VideoTexture,
    IUniform,
    DoubleSide,
} from "three";

export enum TransitionEffect {
    FadeSmooth = 0,
    SlowShutter = 1,
    Datamosh = 2,
    WhipPan = 3,
    GlitchCut = 4,
    FilmFlash = 5,
    CustomShader = 6,
}

export interface TransitionEffectConfig {
    effect: TransitionEffect;
    name: string;
    freezeOutgoing: boolean;
}

export const TRANSITION_EFFECT_CONFIGS: Record<TransitionEffect, TransitionEffectConfig> = {
    [TransitionEffect.FadeSmooth]:   { effect: TransitionEffect.FadeSmooth,   name: "FadeSmooth",   freezeOutgoing: false },
    [TransitionEffect.SlowShutter]:  { effect: TransitionEffect.SlowShutter,  name: "SlowShutter",  freezeOutgoing: false },
    [TransitionEffect.Datamosh]:     { effect: TransitionEffect.Datamosh,     name: "Datamosh",     freezeOutgoing: true  },
    [TransitionEffect.WhipPan]:      { effect: TransitionEffect.WhipPan,      name: "WhipPan",      freezeOutgoing: false },
    [TransitionEffect.GlitchCut]:    { effect: TransitionEffect.GlitchCut,    name: "GlitchCut",    freezeOutgoing: true  },
    [TransitionEffect.FilmFlash]:    { effect: TransitionEffect.FilmFlash,    name: "FilmFlash",    freezeOutgoing: true  },
    [TransitionEffect.CustomShader]: { effect: TransitionEffect.CustomShader, name: "CustomShader", freezeOutgoing: false },
};

export const BUILTIN_TRANSITION_EFFECTS: TransitionEffect[] = [
    TransitionEffect.FadeSmooth,
    TransitionEffect.SlowShutter,
    TransitionEffect.Datamosh,
    TransitionEffect.WhipPan,
    TransitionEffect.GlitchCut,
    TransitionEffect.FilmFlash,
];

const TRANSITION_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const BUILTIN_TRANSITION_FRAGMENT_SHADER = `
varying vec2 vUv;
uniform sampler2D iChannelFrom;
uniform sampler2D iChannelTo;
uniform float uProgress;      // 0.0 -> 1.0
uniform float iTime;
uniform vec3 iResolution;
uniform sampler2D iAudioData;
uniform int uTransitionType;

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// 0. Classic Smooth Fade
vec4 transFadeSmooth(vec2 uv, float p) {
    vec4 fromCol = texture(iChannelFrom, uv);
    vec4 toCol   = texture(iChannelTo, uv);
    return mix(fromCol, toCol, smoothstep(0.0, 1.0, p));
}

// 1. Slow Shutter / Temporal Ghosting
vec4 transSlowShutter(vec2 uv, float p) {
    vec4 fromCol = texture(iChannelFrom, uv);
    vec4 toCol   = texture(iChannelTo, uv);
    float feedback = 1.0 - smoothstep(0.0, 1.0, p);
    return vec4(mix(toCol.rgb, fromCol.rgb, feedback), 1.0);
}

// 2. Datamosh / Macroblock Motion-Vector Melt
vec4 transDatamosh(vec2 uv, float p) {
    vec2 grid = vec2(32.0, 18.0);
    vec2 blockId = floor(uv * grid);
    vec2 blockUv = (blockId + 0.5) / grid;

    vec4 blockFrom = texture(iChannelFrom, blockUv);
    float blockNoise = rand(blockId + floor(p * 12.0) * 0.13);

    float moshEnv = sin(p * 3.14159265);
    vec2 motionVec = (blockFrom.rg - 0.5) * 0.35 + (vec2(rand(blockId), rand(blockId + 7.1)) - 0.5) * 0.25;
    vec2 displacedUv = clamp(uv + motionVec * moshEnv, 0.0, 1.0);

    float threshold = smoothstep(0.1, 0.9, p + (blockNoise - 0.5) * 0.35);
    vec4 fromSmeared = texture(iChannelFrom, displacedUv);
    vec4 toSmeared   = texture(iChannelTo, clamp(uv - motionVec * (1.0 - p) * 0.5, 0.0, 1.0));

    float chromaShift = 0.015 * moshEnv;
    toSmeared.r = texture(iChannelTo, clamp(uv - motionVec * (1.0 - p) * 0.5 + vec2(chromaShift, 0.0), 0.0, 1.0)).r;
    toSmeared.b = texture(iChannelTo, clamp(uv - motionVec * (1.0 - p) * 0.5 - vec2(chromaShift, 0.0), 0.0, 1.0)).b;

    return mix(fromSmeared, toSmeared, threshold);
}

// 3. Whip Pan (Horizontal Directional Blur - 8 taps with explicit LOD 0 to avoid HLSL X3595 warnings)
vec4 transWhipPan(vec2 uv, float p) {
    float whipInt = sin(p * 3.14159265);
    float blurAmt = whipInt * 0.08;

    vec4 accFrom = vec4(0.0);
    vec4 accTo   = vec4(0.0);
    const int TAPS = 8;

    for (int i = 0; i < TAPS; i++) {
        float t = (float(i) / float(TAPS) - 0.5) * blurAmt;
        vec2 sampleUv = clamp(uv + vec2(t, 0.0), 0.0, 1.0);
        accFrom += textureLod(iChannelFrom, sampleUv, 0.0);
        accTo   += textureLod(iChannelTo, sampleUv, 0.0);
    }

    vec4 blended = mix(accFrom / float(TAPS), accTo / float(TAPS), smoothstep(0.35, 0.65, p));
    blended.rgb *= (1.0 - whipInt * 0.45);
    return blended;
}

// 4. Digital Glitch Cut
vec4 transGlitchCut(vec2 uv, float p) {
    float intensity = sin(p * 3.14159265);
    vec2 sampleUV = uv;
    float brightness = 1.0;

    if (intensity > 0.01) {
        float blockY = floor(sampleUV.y * 20.0);
        float noise = rand(vec2(blockY, floor(iTime * 24.0)));
        sampleUV.x = clamp(sampleUV.x + (noise - 0.5) * 0.2 * intensity, 0.0, 1.0);

        if (rand(vec2(floor(iTime * 30.0), sampleUV.y)) > 0.8) {
            brightness = 0.25;
        }
    }

    vec4 fromCol = texture(iChannelFrom, sampleUV);
    vec4 toCol   = texture(iChannelTo, sampleUV);
    float cut = step(0.5, p + (rand(vec2(uv.y, iTime)) - 0.5) * 0.2 * intensity);
    vec4 col = mix(fromCol, toCol, cut);
    return vec4(col.rgb * brightness, 1.0);
}

// 5. Film Flash / Light Leak
vec4 transFilmFlash(vec2 uv, float p) {
    float flash = sin(p * 3.14159265);
    vec4 fromCol = texture(iChannelFrom, uv);
    vec4 toCol   = texture(iChannelTo, uv);
    vec4 base = mix(fromCol, toCol, smoothstep(0.4, 0.6, p));
    vec3 burnCol = vec3(1.0, 0.5, 0.1) * pow(flash, 1.5) * 2.5;
    return vec4(base.rgb + burnCol, 1.0);
}

void main() {
    vec2 uv = vUv;
    vec4 result;

    if (uTransitionType == 1)      result = transSlowShutter(uv, uProgress);
    else if (uTransitionType == 2) result = transDatamosh(uv, uProgress);
    else if (uTransitionType == 3) result = transWhipPan(uv, uProgress);
    else if (uTransitionType == 4) result = transGlitchCut(uv, uProgress);
    else if (uTransitionType == 5) result = transFilmFlash(uv, uProgress);
    else                           result = transFadeSmooth(uv, uProgress);

    gl_FragColor = result;
}
`;

function wrapCustomTransitionShader(glslSource: string): string {
    const header = `
#define HW_PERFORMANCE 1
varying vec2 vUv;
uniform sampler2D iChannelFrom;
uniform sampler2D iChannelTo;
uniform float uProgress;
uniform float iTime;
uniform vec3 iResolution;
uniform sampler2D iAudioData;
`;
    let code = glslSource;
    if (!/uniform\s+sampler2D\s+iChannelFrom\b/.test(code)) {
        code = header + "\n" + code;
    }
    if (/\bvoid\s+mainImage\s*\(/.test(code) && !/\bvoid\s+main\s*\(/.test(code)) {
        code += `
void main() {
    vec4 fragColor = vec4(0.0);
    mainImage(fragColor, vUv * iResolution.xy);
    gl_FragColor = fragColor;
}
`;
    }
    return code;
}

export class ShaderTransitionPass {
    public rtFrom: WebGLRenderTarget;
    public rtTo: WebGLRenderTarget;

    private builtinMaterial: ShaderMaterial;
    private customMaterial: ShaderMaterial | null = null;
    private sharedUniforms: { [uniform: string]: IUniform };

    private fromScene: Scene;
    private toScene: Scene;
    private fromMesh: Mesh;
    private toMesh: Mesh;
    private lastRandomEffect: TransitionEffect | null = null;
    private fromCapturedThisTransition = false;

    private static warmupTarget: WebGLRenderTarget | null = null;

    constructor(width: number, height: number, audioTexture?: Texture) {
        const w = Math.max(1, Math.round(width));
        const h = Math.max(1, Math.round(height));

        const opts = {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            type: HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false,
        };

        this.rtFrom = new WebGLRenderTarget(w, h, opts);
        this.rtTo = new WebGLRenderTarget(w, h, opts);

        this.sharedUniforms = {
            iChannelFrom: { value: this.rtFrom.texture },
            iChannelTo: { value: this.rtTo.texture },
            uProgress: { value: 0.0 },
            iTime: { value: 0.0 },
            iResolution: { value: new Vector3(w, h, 1.0) },
            iAudioData: { value: audioTexture ?? null },
            uTransitionType: { value: TransitionEffect.FadeSmooth },
        };

        this.builtinMaterial = this.createCheckedMaterial(
            BUILTIN_TRANSITION_FRAGMENT_SHADER,
            "BuiltinTransitionShader"
        );

        const geo = new PlaneGeometry(1, 1);
        this.fromScene = new Scene();
        this.toScene = new Scene();
        this.fromMesh = new Mesh(geo);
        this.toMesh = new Mesh(geo);
        this.fromMesh.frustumCulled = false;
        this.toMesh.frustumCulled = false;
        this.fromScene.add(this.fromMesh);
        this.toScene.add(this.toMesh);
    }

    private createCheckedMaterial(fragmentShader: string, label: string): ShaderMaterial {
        const mat = new ShaderMaterial({
            vertexShader: TRANSITION_VERTEX_SHADER,
            fragmentShader,
            side: DoubleSide,
            depthTest: false,
            depthWrite: false,
            uniforms: this.sharedUniforms,
        });
        mat.name = label;
        return mat;
    }

    public get activeMaterial(): ShaderMaterial {
        if (this.sharedUniforms.uTransitionType.value === TransitionEffect.CustomShader && this.customMaterial) {
            return this.customMaterial;
        }
        return this.builtinMaterial;
    }

    public get shouldFreezeOutgoing(): boolean {
        const currentType = this.sharedUniforms.uTransitionType.value as TransitionEffect;
        return TRANSITION_EFFECT_CONFIGS[currentType]?.freezeOutgoing ?? false;
    }

    public get hasCapturedOutgoingFrame(): boolean {
        return this.fromCapturedThisTransition;
    }

    public resetTransitionCapture(): void {
        this.fromCapturedThisTransition = false;
    }

    public setTransitionType(type: TransitionEffect): void {
        this.sharedUniforms.uTransitionType.value = type;
        this.fromCapturedThisTransition = false;
    }

   
    public pickRandomTransition(): TransitionEffect {
        const pool = BUILTIN_TRANSITION_EFFECTS.filter((e) => e !== this.lastRandomEffect);
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        this.lastRandomEffect = chosen;
        this.setTransitionType(chosen);
        return chosen;
    }

  
    public static createSnapshotMaterial(source: ShaderMaterial, vertexShader: string): ShaderMaterial {
        const snapshotUniforms: { [uniform: string]: IUniform } = {};
        for (const key of Object.keys(source.uniforms)) {
            const u = source.uniforms[key];
            if (!u) continue;
            const val = u.value;
            if (typeof val === "number" || typeof val === "boolean") {
                snapshotUniforms[key] = { value: val };
            } else if (val && typeof val.clone === "function" && !val.isTexture && !val.isWebGLRenderTarget) {
                snapshotUniforms[key] = { value: val.clone() };
            } else {
                snapshotUniforms[key] = { value: val };
            }
        }
        if (snapshotUniforms.iTransitionOpacity) {
            snapshotUniforms.iTransitionOpacity.value = 1.0;
        }

        return new ShaderMaterial({
            vertexShader,
            fragmentShader: source.fragmentShader,
            uniforms: snapshotUniforms,
            side: DoubleSide,
            depthTest: false,
            depthWrite: false,
        });
    }

    public static syncVideoTexture(videoTex?: VideoTexture | null, videoEl?: HTMLVideoElement | null): void {
        if (videoTex && videoEl && videoEl.readyState >= 2) {
            videoTex.needsUpdate = true;
        }
    }

    private static scheduleBackgroundTask(fn: () => void): Promise<void> {
        return new Promise((resolve) => {
            const run = () => {
                try {
                    fn();
                } finally {
                    resolve();
                }
            };
            if (typeof window !== "undefined" && typeof (window as any).requestIdleCallback === "function") {
                (window as any).requestIdleCallback(run, { timeout: 60 });
            } else {
                setTimeout(run, 0);
            }
        });
    }

 
    public static async precompileShaders(
        gl: WebGLRenderer,
        camera: Camera,
        materials: (ShaderMaterial | null | undefined)[],
        extraPasses?: { scene: Scene; camera: Camera }[]
    ): Promise<number> {
        const startTime = performance.now();
        const tempGeo = new PlaneGeometry(1, 1);
        const tempScene = new Scene();

        for (const mat of materials) {
            if (!mat) continue;
            const tempMesh = new Mesh(tempGeo, mat);
            tempMesh.frustumCulled = false;
            tempScene.add(tempMesh);
        }

        try {
            if (typeof (gl as any).compileAsync === "function") {
                await (gl as any).compileAsync(tempScene, camera);
                if (extraPasses) {
                    for (const pass of extraPasses) {
                        await (gl as any).compileAsync(pass.scene, pass.camera);
                    }
                }
            } else {
                gl.compile(tempScene, camera);
                if (extraPasses) {
                    for (const pass of extraPasses) {
                        gl.compile(pass.scene, pass.camera);
                    }
                }
            }

            await this.scheduleBackgroundTask(() => {
                if (!this.warmupTarget) {
                    this.warmupTarget = new WebGLRenderTarget(1, 1, {
                        minFilter: LinearFilter,
                        magFilter: LinearFilter,
                        format: RGBAFormat,
                        depthBuffer: false,
                        stencilBuffer: false,
                    });
                }
                const prevTarget = gl.getRenderTarget();
                gl.setRenderTarget(this.warmupTarget);
                gl.render(tempScene, camera);
                if (extraPasses) {
                    for (const pass of extraPasses) {
                        gl.render(pass.scene, pass.camera);
                    }
                }
                gl.setRenderTarget(prevTarget);
            });
        } finally {
            tempGeo.dispose();
        }

        return performance.now() - startTime;
    }

    public setCustomTransitionShader(glslSource: string): void {
        if (this.customMaterial) {
            this.customMaterial.dispose();
        }
        this.customMaterial = this.createCheckedMaterial(
            wrapCustomTransitionShader(glslSource),
            "CustomTransitionShader"
        );
        this.sharedUniforms.uTransitionType.value = TransitionEffect.CustomShader;
        this.fromCapturedThisTransition = false;
    }

    public resize(width: number, height: number): void {
        const w = Math.max(1, Math.round(width));
        const h = Math.max(1, Math.round(height));
        this.rtFrom.setSize(w, h);
        this.rtTo.setSize(w, h);
        this.sharedUniforms.iResolution.value.set(w, h, 1.0);
    }

    public updateOffscreenTargets(
        gl: WebGLRenderer,
        camera: Camera,
        viewportWidth: number,
        viewportHeight: number,
        fromMaterial: ShaderMaterial | null,
        toMaterial: ShaderMaterial,
        progress: number,
        time: number,
        audioTexture?: Texture
    ): void {
        const prevTarget = gl.getRenderTarget();
        const fboW = this.rtFrom.width;
        const fboH = this.rtFrom.height;

        if (fromMaterial && (!this.shouldFreezeOutgoing || !this.fromCapturedThisTransition)) {
            if (fromMaterial.uniforms.iTransitionOpacity) {
                fromMaterial.uniforms.iTransitionOpacity.value = 1.0;
            }
            this.fromMesh.scale.set(viewportWidth, viewportHeight, 1);
            fromMaterial.side = DoubleSide;
            this.fromMesh.material = fromMaterial;

            const prevFromRes = fromMaterial.uniforms.iResolution?.value?.clone();
            if (fromMaterial.uniforms.iResolution?.value) {
                fromMaterial.uniforms.iResolution.value.set(fboW, fboH, 1.0);
            }
            gl.setRenderTarget(this.rtFrom);
            gl.clear(true, true, false);
            gl.render(this.fromScene, camera);
            if (prevFromRes && fromMaterial.uniforms.iResolution?.value) {
                fromMaterial.uniforms.iResolution.value.copy(prevFromRes);
            }
            this.fromCapturedThisTransition = true;
        }

        if (toMaterial.uniforms.iTransitionOpacity) {
            toMaterial.uniforms.iTransitionOpacity.value = 1.0;
        }
        this.toMesh.scale.set(viewportWidth, viewportHeight, 1);
        toMaterial.side = DoubleSide;
        this.toMesh.material = toMaterial;

        const prevToRes = toMaterial.uniforms.iResolution?.value?.clone();
        if (toMaterial.uniforms.iResolution?.value) {
            toMaterial.uniforms.iResolution.value.set(fboW, fboH, 1.0);
        }
        gl.setRenderTarget(this.rtTo);
        gl.clear(true, true, false);
        gl.render(this.toScene, camera);
        if (prevToRes && toMaterial.uniforms.iResolution?.value) {
            toMaterial.uniforms.iResolution.value.copy(prevToRes);
        }

        gl.setRenderTarget(prevTarget);

        this.sharedUniforms.iChannelFrom.value = this.rtFrom.texture;
        this.sharedUniforms.iChannelTo.value = this.rtTo.texture;
        this.sharedUniforms.uProgress.value = progress;
        this.sharedUniforms.iTime.value = time;
        if (audioTexture) {
            this.sharedUniforms.iAudioData.value = audioTexture;
        }
    }

    public dispose(): void {
        this.rtFrom.dispose();
        this.rtTo.dispose();
        this.builtinMaterial.dispose();
        this.customMaterial?.dispose();
    }
}