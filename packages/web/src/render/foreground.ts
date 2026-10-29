import {
    ClampToEdgeWrapping,
    DataTexture,
    LinearFilter,
    Mesh,
    NormalBlending,
    PlaneGeometry,
    RedFormat,
    Scene,
    ShaderMaterial,
    UnsignedByteType,
    Vector2,
    VideoTexture,
} from 'three';
import type { Camera, WebGLRenderer } from 'three';
import type { ForegroundOptions } from '../types';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tVideo;
uniform sampler2D tMask;
uniform vec2 uvScale;
uniform vec2 edge;
uniform float hasMask;
uniform float mirror;
varying vec2 vUv;
void main() {
    vec2 uv = (vUv - 0.5) * uvScale + 0.5;
    if (mirror > 0.5) uv.x = 1.0 - uv.x;
    vec3 fg = texture2D(tVideo, uv).rgb;
    // The mask is uploaded top row first (image order), the video is flipped.
    float m = texture2D(tMask, vec2(uv.x, 1.0 - uv.y)).r;
    float a = hasMask * smoothstep(edge.x, edge.y, m);
    gl_FragColor = vec4(fg, a);
}`;

/** Draws a video over the shader output, keyed by a per-pixel alpha mask. */
export class ForegroundCompositor {
    readonly video: HTMLVideoElement;
    private scene = new Scene();
    private geometry = new PlaneGeometry(2, 2);
    private material: ShaderMaterial;
    private videoTexture: VideoTexture;
    private maskTexture: DataTexture | null = null;
    private maskData: Uint8Array<ArrayBuffer> | null = null;

    constructor(opts: ForegroundOptions) {
        this.video = opts.video;
        this.videoTexture = new VideoTexture(opts.video);
        this.videoTexture.generateMipmaps = false;
        this.videoTexture.minFilter = LinearFilter;
        this.videoTexture.magFilter = LinearFilter;
        this.videoTexture.wrapS = ClampToEdgeWrapping;
        this.videoTexture.wrapT = ClampToEdgeWrapping;
        const [lo, hi] = opts.edge ?? [0.35, 0.65];
        this.material = new ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            uniforms: {
                tVideo: { value: this.videoTexture },
                tMask: { value: null },
                uvScale: { value: new Vector2(1, 1) },
                edge: { value: new Vector2(lo, hi) },
                hasMask: { value: 0 },
                mirror: { value: opts.mirror ? 1 : 0 },
            },
            transparent: true,
            blending: NormalBlending,
            depthTest: false,
            depthWrite: false,
        });
        const mesh = new Mesh(this.geometry, this.material);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
    }

    /** Replace the mask. `data` is one byte per pixel (0 = background, 255 = foreground), top row first. */
    setMask(data: Uint8Array, width: number, height: number): void {
        let tex = this.maskTexture;
        if (!tex || tex.image.width !== width || tex.image.height !== height) {
            tex?.dispose();
            this.maskData = new Uint8Array(width * height);
            tex = new DataTexture(this.maskData, width, height, RedFormat, UnsignedByteType);
            tex.minFilter = LinearFilter;
            tex.magFilter = LinearFilter;
            tex.wrapS = ClampToEdgeWrapping;
            tex.wrapT = ClampToEdgeWrapping;
            tex.unpackAlignment = 1;
            this.maskTexture = tex;
            this.material.uniforms.tMask.value = tex;
        }
        this.maskData!.set(data.subarray(0, width * height));
        tex.needsUpdate = true;
        this.material.uniforms.hasMask.value = 1;
    }

    /** Drop the mask: nothing of the video is shown until a new one arrives. */
    clearMask(): void {
        this.material.uniforms.hasMask.value = 0;
    }

    render(renderer: WebGLRenderer, camera: Camera, target: { width: number; height: number }): void {
        const v = this.video;
        if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
        // "cover" fit: crop the video to the output aspect instead of stretching.
        const va = v.videoWidth / v.videoHeight;
        const ta = target.width / target.height;
        const s = this.material.uniforms.uvScale.value as Vector2;
        if (va > ta) s.set(ta / va, 1);
        else s.set(1, va / ta);
        // requestVideoFrameCallback doesn't fire for off-DOM / hidden videos; upload every frame.
        this.videoTexture.needsUpdate = true;
        renderer.render(this.scene, camera);
    }

    dispose(): void {
        this.videoTexture.dispose();
        this.maskTexture?.dispose();
        this.material.dispose();
        this.geometry.dispose();
    }
}
