import {
    AdditiveBlending,
    ClampToEdgeWrapping,
    FloatType,
    HalfFloatType,
    LinearFilter,
    LinearMipmapLinearFilter,
    Mesh,
    NormalBlending,
    PlaneGeometry,
    RepeatWrapping,
    Scene,
    RGBAFormat,
    ShaderMaterial,
    Vector3,
    WebGL3DRenderTarget,
    WebGLCubeRenderTarget,
    WebGLRenderTarget,
} from 'three';
import type { OrthographicCamera, Texture, WebGLRenderer } from 'three';
import { VERTEX_SHADER } from '../constants';
import { parseChannelRef } from './channels';
import type { ChannelRef } from './channels';
import { prepareBufferShader, prepareMainShader } from './preprocess';
import { createPassUniforms, createCustomUniformMap, toUniformValue } from './uniforms';
import type { PassUniforms, SharedUniforms } from './uniforms';
import { TextureCache } from '../textures/TextureCache';
import { resolveAssetUrl } from '../assets/assetUrl';
import type { Catalog } from '../assets/catalog';
import type { MediaRegistry } from '../media/MediaRegistry';
import type { IUniform } from 'three';
import type { PassConfig, ShaderObject, TextureSampler } from '../types';

/** Per-face size of Shadertoy cubemap passes (extension: CUBEMAP_PASS_SIZE). */
export const CUBEMAP_PASS_SIZE = 1024;
/** Default edge length of volume passes. */
export const VOLUME_PASS_DEFAULT_RES = 128;

/** Clamp a volume pass resolution like the extension (4..256, default 128). */
export function volumeResolution(res?: number): number {
    return Math.max(4, Math.min(256, Math.floor(res || VOLUME_PASS_DEFAULT_RES)));
}

/** A volume pass that never reads time/frame/mouse/audio/channels bakes once. */
export function isStaticVolumeCode(code: string): boolean {
    return !/\b(iTime|iFrame|iMouse|iAudioData|iAmplifiedTime|iChannelTime|iChannel0|iChannel1|iChannel2|iChannel3)\b/.test(code);
}

/** True when any consumer samples `ref` (e.g. "cubemapA") with filter:'mipmap'. */
export function passNeedsMipmaps(ref: string, consumers: Record<string, any>[]): boolean {
    for (const c of consumers) {
        for (let ch = 0; ch < 4; ch++) {
            if (c?.[`iChannel${ch}`] === ref && c?.[`iChannel${ch}Sampler`]?.filter === 'mipmap') return true;
        }
    }
    return false;
}

/** Textures the passes of a program currently expose (buffers by index, cube/volume by letter). */
export interface PassReads {
    buffers: (Texture | undefined)[];
    cube: Record<string, Texture>;
    vol: Record<string, Texture>;
}

export type ChannelBinding =
    | { kind: 'none' }
    | { kind: 'texture'; tex: Texture; sampler?: TextureSampler }
    | { kind: 'buffer'; index: number; sampler?: TextureSampler }
    | { kind: 'cube'; letter: string }
    | { kind: 'volume'; letter: string; sampler?: TextureSampler }
    | { kind: 'shared'; key: 'iAudioData' | 'iVideo' | 'iKeyboard' | 'iMidi' };

export interface PassChannelMeta {
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    iChannel0Type?: string;
    iChannel1Type?: string;
    iChannel2Type?: string;
    iChannel3Type?: string;
    iChannel0Sampler?: TextureSampler;
    iChannel1Sampler?: TextureSampler;
    iChannel2Sampler?: TextureSampler;
    iChannel3Sampler?: TextureSampler;
    cubemaps?: string[];
}

// Pure resolution of the four iChannel slots to ChannelRefs (unit-testable).
export function resolveChannelRefs(
    meta: PassChannelMeta,
    pass: 'main' | 'buffer',
): { ref: ChannelRef; sampler?: TextureSampler }[] {
    const out: { ref: ChannelRef; sampler?: TextureSampler }[] = [];
    for (let i = 0; i < 4; i++) {
        const key = `iChannel${i}` as const;
        const m = meta as Record<string, any>;
        out.push({
            ref: parseChannelRef({
                ref: m[key],
                type: m[`${key}Type`],
                isCubemapListed: (meta.cubemaps ?? []).includes(key),
                pass,
                channelIndex: i as 0 | 1 | 2 | 3,
            }),
            sampler: m[`${key}Sampler`],
        });
    }
    return out;
}

interface BufferRuntime {
    scene: Scene;
    material: ShaderMaterial;
    uniforms: PassUniforms;
    targets: [WebGLRenderTarget, WebGLRenderTarget];
    readIndex: 0 | 1;
    writeIndex: 0 | 1;
    bindings: ChannelBinding[];
}

interface CubeRuntime {
    letter: string;
    scene: Scene;
    material: ShaderMaterial;
    uniforms: PassUniforms;
    targets: [WebGLCubeRenderTarget, WebGLCubeRenderTarget];
    readIndex: 0 | 1;
    writeIndex: 0 | 1;
    bindings: ChannelBinding[];
}

interface VolumeRuntime {
    letter: string;
    resolution: number;
    scene: Scene;
    material: ShaderMaterial;
    uniforms: PassUniforms;
    /** Both entries are the same target unless the pass reads itself. */
    targets: [WebGL3DRenderTarget, WebGL3DRenderTarget];
    readIndex: 0 | 1;
    writeIndex: 0 | 1;
    isStatic: boolean;
    baked: boolean;
    bindings: ChannelBinding[];
}

const channelSlot = (i: number) => `iChannel${i}` as const;

function channelResolution(u: PassUniforms, i: number, tex: any): void {
    const arr = u.iChannelResolution?.value;
    if (!arr?.[i] || !tex) return;
    if (tex.isData3DTexture) {
        const img = tex.image;
        if (img) arr[i].set(img.width || 1, img.height || 1, img.depth || 1);
        return;
    }
    let img = tex.image;
    if (Array.isArray(img)) img = img[0];
    const w = img?.width ?? img?.videoWidth;
    const h = img?.height ?? img?.videoHeight;
    if (w && h) arr[i].set(w, h, 1);
}

export class ShaderProgram {
    private constructor(
        readonly shader: ShaderObject,
        readonly mesh: Mesh,
        private mainMaterial: ShaderMaterial,
        private mainUniforms: PassUniforms,
        private mainBindings: ChannelBinding[],
        private runtimes: (BufferRuntime | undefined)[],
        private geometry: PlaneGeometry,
        private textures: TextureCache,
        private shared: SharedUniforms,
        private customMap: Record<string, IUniform>,
        private metaWrap: 'repeat' | 'clamp' | string | undefined,
        private warmup: number,
        private cubes: CubeRuntime[] = [],
        private volumes: VolumeRuntime[] = [],
    ) {}

    /** Reads published after the last renderPasses() (used by the sound pass). */
    private lastReads: PassReads = { buffers: [], cube: {}, vol: {} };

    static async build(args: {
        shader: ShaderObject;
        renderer: WebGLRenderer;
        catalog: Catalog;
        assetBaseUrl: string;
        mediaBaseUrl?: string;
        media?: MediaRegistry;
        shared: SharedUniforms;
        size: { width: number; height: number };
        floatType: number;
        camera: OrthographicCamera;
    }): Promise<ShaderProgram> {
        const { shader, renderer, catalog, assetBaseUrl, mediaBaseUrl, media, shared, size, floatType, camera } = args;
        const meta = shader.metaData ?? ({} as ShaderObject['metaData']);

        // 1. Fetch all shader code before creating GPU objects.
        const mainCode = shader.inlineCode ?? (await catalog.fetchCode(shader.shaderName));
        const buffersMeta = [...(meta.buffers ?? [])].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
        const fetchPass = (name: string) => shader.inlineBuffers?.[name] ?? catalog.fetchCode(name);
        const bufferCodes = await Promise.all(buffersMeta.map((b) => fetchPass(b.shaderName)));
        const cubeMetas: PassConfig[] = meta.cubemapPasses ?? [];
        const volumeMetas: (PassConfig & { resolution?: number })[] = meta.volumePasses ?? [];
        const cubeCodes = await Promise.all(cubeMetas.map((c) => fetchPass(c.shaderName)));
        const volumeCodes = await Promise.all(volumeMetas.map((v) => fetchPass(v.shaderName)));
        // Every pass that may sample a cube/volume pass (mipmap requirement check).
        const consumers: Record<string, any>[] = [...buffersMeta, ...cubeMetas, ...volumeMetas, meta as any];

        const textures = new TextureCache(assetBaseUrl);
        const geometry = new PlaneGeometry(2, 2);
        const customMap = createCustomUniformMap(meta.customUniforms);

        const toBindings = (m: PassChannelMeta, pass: 'main' | 'buffer', uniforms: PassUniforms): ChannelBinding[] =>
            resolveChannelRefs(m, pass).map(({ ref, sampler }, i): ChannelBinding => {
                switch (ref.kind) {
                    case 'none':
                        return { kind: 'none' };
                    case 'buffer':
                        return { kind: 'buffer', index: ref.index, sampler };
                    case 'cubePass':
                        if (!cubeMetas.some((c) => c.letter === ref.letter)) {
                            console.warn(`[shaderamp] cubemap${ref.letter} has no matching cubemap pass`);
                            return { kind: 'texture', tex: textures.black(), sampler };
                        }
                        return { kind: 'cube', letter: ref.letter };
                    case 'volumePass':
                        if (!volumeMetas.some((v) => v.letter === ref.letter)) {
                            console.warn(`[shaderamp] volume${ref.letter} has no matching volume pass`);
                            return { kind: 'texture', tex: textures.black(), sampler };
                        }
                        return { kind: 'volume', letter: ref.letter, sampler };
                    case 'audio':
                        return { kind: 'shared', key: 'iAudioData' };
                    case 'video':
                        return { kind: 'shared', key: 'iVideo' };
                    case 'keyboard':
                        return { kind: 'shared', key: 'iKeyboard' };
                    case 'midi':
                        return { kind: 'shared', key: 'iMidi' };
                    case 'customMedia': {
                        const entry = media?.get(ref.ref);
                        if (!entry) {
                            console.warn(`[shaderamp] unresolved media ref ${ref.ref}`);
                            return { kind: 'texture', tex: textures.black(), sampler };
                        }
                        switch (entry.kind) {
                            case 'image': {
                                const tex = textures.loadImage(entry.url, sampler, meta, (t) => {
                                    const img = (t as any).image;
                                    if (img?.width) uniforms.iChannelResolution.value[i].set(img.width, img.height, 1);
                                });
                                return { kind: 'texture', tex, sampler };
                            }
                            case 'video': {
                                const tex = textures.loadVideo(entry.url, sampler, meta);
                                return { kind: 'texture', tex, sampler };
                            }
                            case 'cubemap': {
                                const tex = textures.loadCubemapFaces(entry.faceUrls, (t) => {
                                    const img = (t.image as any)?.[0];
                                    if (img?.width) uniforms.iChannelResolution.value[i].set(img.width, img.height, 1);
                                });
                                return { kind: 'texture', tex, sampler };
                            }
                            case 'volume':
                                return { kind: 'texture', tex: entry.texture, sampler };
                        }
                    }
                    case 'black':
                        return { kind: 'texture', tex: textures.black(), sampler };
                    case 'volume': {
                        const tex = textures.volume(ref.variant);
                        uniforms.iChannelResolution.value[i].set(32, 32, 32);
                        return { kind: 'texture', tex, sampler };
                    }
                    case 'cubemap': {
                        const tex = textures.loadCubemap(ref.path, (t) => {
                            const img = (t.image as any)?.[0];
                            if (img?.width) uniforms.iChannelResolution.value[i].set(img.width, img.height, 1);
                        });
                        return { kind: 'texture', tex, sampler };
                    }
                    case 'mediaVideo': {
                        if (!mediaBaseUrl) return { kind: 'shared', key: 'iVideo' };
                        const tex = textures.loadVideo(resolveAssetUrl(ref.path, mediaBaseUrl), sampler, meta);
                        return { kind: 'texture', tex, sampler };
                    }
                    case 'image': {
                        const tex = textures.loadImage(ref.path, sampler, meta, (t) => {
                            const img = (t as any).image;
                            if (img?.width) uniforms.iChannelResolution.value[i].set(img.width, img.height, 1);
                        });
                        return { kind: 'texture', tex, sampler };
                    }
                }
            });

        const program = (() => {
            // 2. Main material + mesh.
            const mainUniforms = createPassUniforms(shared, customMap, { main: true });
            const mainMaterial = new ShaderMaterial({
                vertexShader: VERTEX_SHADER,
                fragmentShader: prepareMainShader(mainCode),
                uniforms: mainUniforms,
                depthTest: false,
                depthWrite: false,
                transparent: false,
            });
            const mesh = new Mesh(geometry, mainMaterial);
            mesh.frustumCulled = false;
            const mainBindings = toBindings(meta, 'main', mainUniforms);

            // 3. Buffer passes (double-buffered, sorted by output).
            const runtimes: (BufferRuntime | undefined)[] = [];
            buffersMeta.forEach((b, bi) => {
                const make = () =>
                    new WebGLRenderTarget(Math.max(1, size.width), Math.max(1, size.height), {
                        type: floatType as any,
                        depthBuffer: false,
                        stencilBuffer: false,
                        minFilter: LinearFilter,
                        magFilter: LinearFilter,
                        generateMipmaps: false,
                    });
                const targets: [WebGLRenderTarget, WebGLRenderTarget] = [make(), make()];
                const uniforms = createPassUniforms(shared, customMap);
                const material = new ShaderMaterial({
                    vertexShader: VERTEX_SHADER,
                    fragmentShader: prepareBufferShader(bufferCodes[bi]),
                    uniforms,
                    depthTest: false,
                    depthWrite: false,
                });
                const scene = new Scene();
                const quad = new Mesh(geometry, material);
                quad.frustumCulled = false;
                scene.add(quad);
                runtimes[b.output] = {
                    scene,
                    material,
                    uniforms,
                    targets,
                    readIndex: 0,
                    writeIndex: 1,
                    bindings: toBindings(b, 'buffer', uniforms),
                };
            });

            // 4. Cubemap passes (double-buffered 1024² cube targets, one render per face).
            const cubes: CubeRuntime[] = cubeMetas.map((cp, ci) => {
                const useMipmaps = passNeedsMipmaps(`cubemap${cp.letter}`, consumers);
                const make = () => {
                    // RGBA32F can't be mipmapped in WebGL2 — use half float when textureLod is needed.
                    const t = new WebGLCubeRenderTarget(CUBEMAP_PASS_SIZE, {
                        depthBuffer: false,
                        stencilBuffer: false,
                        type: (useMipmaps ? HalfFloatType : floatType) as any,
                    });
                    t.texture.generateMipmaps = useMipmaps;
                    t.texture.minFilter = useMipmaps ? LinearMipmapLinearFilter : LinearFilter;
                    t.texture.magFilter = LinearFilter;
                    return t;
                };
                const uniforms = createPassUniforms(shared, customMap);
                uniforms.iCubeFace = { value: 0 };
                uniforms.iResolution = { value: new Vector3(CUBEMAP_PASS_SIZE, CUBEMAP_PASS_SIZE, 1) };
                const material = new ShaderMaterial({
                    vertexShader: VERTEX_SHADER,
                    fragmentShader: prepareBufferShader(cubeCodes[ci]),
                    uniforms,
                    depthTest: false,
                    depthWrite: false,
                });
                const scene = new Scene();
                const quad = new Mesh(geometry, material);
                quad.frustumCulled = false;
                scene.add(quad);
                return {
                    letter: cp.letter,
                    scene,
                    material,
                    uniforms,
                    targets: [make(), make()],
                    readIndex: 0,
                    writeIndex: 1,
                    bindings: toBindings(cp, 'buffer', uniforms),
                };
            });

            // 5. Volume passes (res³ 3D targets, one render per z-slice).
            const volumes: VolumeRuntime[] = volumeMetas.map((vp, vi) => {
                const res = volumeResolution(vp.resolution);
                const useMipmaps = passNeedsMipmaps(`volume${vp.letter}`, consumers);
                // Shaders pack integers into float mantissas: keep 32F unless mipmapped.
                const volType = useMipmaps ? HalfFloatType : floatType === FloatType ? FloatType : HalfFloatType;
                const make = () => {
                    const t = new WebGL3DRenderTarget(res, res, res, { depthBuffer: false, stencilBuffer: false });
                    // WebGL3DRenderTarget replaces .texture after applying options: set them on the texture.
                    t.texture.type = volType as any;
                    t.texture.format = RGBAFormat;
                    t.texture.generateMipmaps = useMipmaps;
                    t.texture.minFilter = useMipmaps ? LinearMipmapLinearFilter : LinearFilter;
                    t.texture.magFilter = LinearFilter;
                    t.texture.needsUpdate = true;
                    return t;
                };
                const self = `volume${vp.letter}`;
                const readsSelf = [vp.iChannel0, vp.iChannel1, vp.iChannel2, vp.iChannel3].includes(self);
                const a = make();
                const b = readsSelf ? make() : a;
                const uniforms = createPassUniforms(shared, customMap);
                uniforms.iVolumeSlice = { value: 0 };
                uniforms.iResolution = { value: new Vector3(res, res, res) };
                const material = new ShaderMaterial({
                    vertexShader: VERTEX_SHADER,
                    fragmentShader: prepareBufferShader(volumeCodes[vi]),
                    uniforms,
                    depthTest: false,
                    depthWrite: false,
                });
                const scene = new Scene();
                const quad = new Mesh(geometry, material);
                quad.frustumCulled = false;
                scene.add(quad);
                return {
                    letter: vp.letter,
                    resolution: res,
                    scene,
                    material,
                    uniforms,
                    targets: [a, b],
                    readIndex: 0,
                    writeIndex: readsSelf ? 1 : 0,
                    isStatic: isStaticVolumeCode(volumeCodes[vi]),
                    baked: false,
                    bindings: toBindings(vp, 'buffer', uniforms),
                };
            });

            return new ShaderProgram(
                shader,
                mesh,
                mainMaterial,
                mainUniforms,
                mainBindings,
                runtimes,
                geometry,
                textures,
                shared,
                customMap,
                (meta as any).textureWrap,
                buffersMeta.length + cubes.length + volumes.length,
                cubes,
                volumes,
            );
        })();

        // 4. Compile check; dispose everything on failure.
        try {
            program.compileCheck(renderer, camera);
        } catch (err) {
            program.dispose();
            throw err;
        }
        return program;
    }

    private compileCheck(renderer: WebGLRenderer, camera: OrthographicCamera): void {
        const debug = renderer.debug as any;
        if (!debug || !('onShaderError' in debug)) return;
        let failed = false;
        const prevCheck = debug.checkShaderErrors;
        const prevHandler = debug.onShaderError;
        debug.checkShaderErrors = true;
        debug.onShaderError = (...a: any[]) => {
            failed = true;
            prevHandler?.(...a);
        };
        const tmpScene = new Scene();
        tmpScene.add(this.mesh);
        try {
            renderer.compile(tmpScene, camera);
            for (const r of this.runtimes) {
                if (r) renderer.compile(r.scene, camera);
            }
            for (const r of [...this.cubes, ...this.volumes]) renderer.compile(r.scene, camera);
        } finally {
            tmpScene.remove(this.mesh);
            debug.checkShaderErrors = prevCheck;
            debug.onShaderError = prevHandler;
        }
        if (failed) {
            throw new Error(`Shader compile failed: ${this.shader.shaderName}`);
        }
    }

    private bindChannels(uniforms: PassUniforms, bindings: ChannelBinding[], reads: PassReads): void {
        for (let i = 0; i < 4; i++) {
            const b = bindings[i];
            const slot = uniforms[channelSlot(i)] as IUniform;
            let tex: Texture | undefined;
            switch (b.kind) {
                case 'none':
                    continue;
                case 'shared':
                    tex = this.shared[b.key]?.value as Texture | undefined;
                    break;
                case 'buffer':
                    tex = reads.buffers[b.index];
                    break;
                case 'cube':
                    tex = reads.cube[b.letter];
                    break;
                case 'volume':
                    tex = reads.vol[b.letter];
                    break;
                case 'texture':
                    tex = b.tex;
                    break;
            }
            if (!tex) continue;
            slot.value = tex;
            channelResolution(uniforms, i, tex);
            // Wrap per sampler, else the shader's textureWrap (buffers always — the
            // extension applies the fallback to pass outputs; files got it at load).
            if (!(tex as any).isCubeTexture && (b.kind === 'buffer' || b.kind === 'volume' || (b.kind === 'texture' && b.sampler))) {
                const wrap =
                    b.sampler?.wrap === 'repeat'
                        ? RepeatWrapping
                        : b.sampler?.wrap === 'clamp'
                          ? ClampToEdgeWrapping
                          : this.metaWrap === 'repeat'
                            ? RepeatWrapping
                            : ClampToEdgeWrapping;
                tex.wrapS = tex.wrapT = wrap;
            }
        }
    }

    private snapshotBuffers(): (Texture | undefined)[] {
        return this.runtimes.map((r) => r?.targets[r.readIndex].texture);
    }

    private snapshotCubes(): Record<string, Texture> {
        const out: Record<string, Texture> = {};
        for (const c of this.cubes) out[c.letter] = c.targets[c.readIndex].texture;
        return out;
    }

    /** Current pass outputs (buffers, cube and volume passes) after the last frame. */
    get reads(): PassReads {
        return this.lastReads;
    }

    /** Texture for a pass ref such as "buffer0", "cubemapA" or "volumeA" (sound-pass inputs). */
    resolvePassRef(ref: string | undefined): Texture | undefined {
        if (!ref) return undefined;
        const r = this.lastReads;
        const mb = ref.match(/^buffer(\d+)$/);
        if (mb) return r.buffers[Number(mb[1])];
        const mc = ref.match(/^cubemap([A-Z])$/);
        if (mc) return r.cube[mc[1]];
        const mv = ref.match(/^volume([A-Z])$/);
        if (mv) return r.vol[mv[1]];
        return undefined;
    }

    setOpacity(v: number): void {
        this.mainUniforms.iTransitionOpacity.value = v;
        this.mainMaterial.transparent = v < 1;
    }

    /** Overlay layers: keep the pass translucent and pick the blend equation. */
    setBlendMode(mode: 'additive' | 'normal'): void {
        this.mainMaterial.blending = mode === 'additive' ? AdditiveBlending : NormalBlending;
        this.mainMaterial.transparent = true;
    }

    setUniform(name: string, value: number | number[] | boolean): void {
        const target = this.customMap[name];
        if (!target) return;
        const def = this.shader.metaData?.customUniforms?.find((d) => d.name === name);
        target.value = def ? toUniformValue(def, value) : value;
    }

    resize(width: number, height: number): void {
        for (const r of this.runtimes) {
            r?.targets.forEach((t) => t.setSize(Math.max(1, width), Math.max(1, height)));
        }
    }

    updateChannelTimes(iTime: number): void {
        const apply = (uniforms: PassUniforms) => {
            const times = uniforms.iChannelTime?.value as number[] | undefined;
            if (!times) return;
            for (let i = 0; i < 4; i++) {
                times[i] = uniforms[channelSlot(i)].value ? iTime : 0;
            }
        };
        apply(this.mainUniforms);
        for (const r of this.runtimes) if (r) apply(r.uniforms);
        for (const r of [...this.cubes, ...this.volumes]) apply(r.uniforms);
    }

    renderPasses(renderer: WebGLRenderer, camera: OrthographicCamera): void {
        const runtimes = this.runtimes;
        const vol: Record<string, Texture> = {};
        for (const v of this.volumes) vol[v.letter] = v.targets[v.readIndex].texture;
        if (runtimes.every((r) => !r) && !this.cubes.length && !this.volumes.length) {
            this.lastReads = { buffers: [], cube: {}, vol };
            this.bindChannels(this.mainUniforms, this.mainBindings, this.lastReads);
            return;
        }

        const prevTarget = renderer.getRenderTarget();
        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false; // buffers must not be cleared (shaders rely on old contents)

        // Same order as the extension: volume -> cubemap -> buffers. Buffers and
        // cube passes read the snapshot taken before this iteration (previous
        // frame); volume reads update in place so later passes see new data.
        const iterations = 1 + this.warmup;
        this.warmup = 0;
        for (let iter = 0; iter < iterations; iter++) {
            const buffers = this.snapshotBuffers();
            const preCube = this.snapshotCubes();
            for (const v of this.volumes) {
                if (v.isStatic && v.baked) continue;
                this.bindChannels(v.uniforms, v.bindings, { buffers, cube: preCube, vol });
                const target = v.targets[v.writeIndex];
                for (let z = 0; z < v.resolution; z++) {
                    v.uniforms.iVolumeSlice.value = z + 0.5;
                    renderer.setRenderTarget(target, z);
                    renderer.render(v.scene, camera);
                }
                v.baked = true;
                const t = v.readIndex;
                v.readIndex = v.writeIndex;
                v.writeIndex = t;
                vol[v.letter] = v.targets[v.readIndex].texture;
            }
            for (const c of this.cubes) {
                this.bindChannels(c.uniforms, c.bindings, { buffers, cube: preCube, vol });
                const target = c.targets[c.writeIndex];
                for (let face = 0; face < 6; face++) {
                    c.uniforms.iCubeFace.value = face;
                    renderer.setRenderTarget(target, face);
                    renderer.clear(true, true, false);
                    renderer.render(c.scene, camera);
                }
                const t = c.readIndex;
                c.readIndex = c.writeIndex;
                c.writeIndex = t;
            }
            const reads: PassReads = { buffers, cube: this.snapshotCubes(), vol };
            for (const r of runtimes) {
                if (!r) continue;
                this.bindChannels(r.uniforms, r.bindings, reads);
                renderer.setRenderTarget(r.targets[r.writeIndex]);
                renderer.render(r.scene, camera);
                const tmp = r.readIndex;
                r.readIndex = r.writeIndex;
                r.writeIndex = tmp;
            }
        }
        // Main pass (and the sound pass) bind this frame's outputs (post-swap read textures).
        this.lastReads = { buffers: this.snapshotBuffers(), cube: this.snapshotCubes(), vol: { ...vol } };
        this.bindChannels(this.mainUniforms, this.mainBindings, this.lastReads);

        renderer.setRenderTarget(prevTarget);
        renderer.autoClear = prevAutoClear;
    }

    dispose(): void {
        for (const r of this.runtimes) {
            if (!r) continue;
            r.targets.forEach((t) => t.dispose());
            r.material.dispose();
        }
        for (const c of this.cubes) {
            c.targets.forEach((t) => t.dispose());
            c.material.dispose();
        }
        for (const v of this.volumes) {
            new Set(v.targets).forEach((t) => t.dispose());
            v.material.dispose();
        }
        this.mainMaterial.dispose();
        this.geometry.dispose();
        this.textures.dispose();
    }
}
