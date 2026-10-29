import { CanvasTexture, LinearFilter, Mesh, NormalBlending, PlaneGeometry, Scene, ShaderMaterial } from 'three';
import type { Camera, WebGLRenderer } from 'three';
import type { ShaderObject } from '../types';

/** "name by author", like the extension's credits box (`state.showshadercredits`). */
export function formatCredits(shader: ShaderObject | null | undefined): string | null {
    if (!shader) return null;
    const m = shader.metaData;
    const name = m?.shaderName || shader.shaderName;
    if (!name) return null;
    return m?.author ? `${name} by ${m.author}` : name;
}

/** FPS label text (rounded, never negative). */
export function formatFps(fps: number): string {
    return `${Math.max(0, Math.round(fps))} FPS`;
}

/** Exponential moving average of the frame rate, refreshed for display twice a second. */
export class FpsMeter {
    private avg = 0;
    private lastShown = -Infinity;
    shown = 0;

    /** Feed a raw frame delta (seconds); returns true when the displayed value changed. */
    sample(rawDelta: number, nowMs: number): boolean {
        if (!(rawDelta > 0)) return false;
        const fps = 1 / rawDelta;
        this.avg = this.avg ? this.avg * 0.9 + fps * 0.1 : fps;
        if (nowMs - this.lastShown < 500) return false;
        this.lastShown = nowMs;
        const next = Math.round(this.avg);
        if (next === this.shown) return false;
        this.shown = next;
        return true;
    }
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tHud;
varying vec2 vUv;
void main() {
    gl_FragColor = texture2D(tHud, vUv);
}`;

/**
 * Canvas-drawn overlay (credits bottom-left, FPS top-left) composited into the
 * WebGL output, so it also shows up in `canvas.captureStream()` (virtual camera)
 * and in canvas-only mode, where the DOM `controls` overlay isn't available.
 */
export class Hud {
    private canvas: HTMLCanvasElement | OffscreenCanvas;
    private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    private texture: CanvasTexture;
    private scene = new Scene();
    private geometry = new PlaneGeometry(2, 2);
    private material: ShaderMaterial;
    private key = '';

    constructor() {
        this.canvas =
            typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1);
        this.ctx = this.canvas.getContext('2d') as any;
        this.texture = new CanvasTexture(this.canvas as any);
        this.texture.minFilter = LinearFilter;
        this.texture.magFilter = LinearFilter;
        this.texture.generateMipmaps = false;
        this.material = new ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            uniforms: { tHud: { value: this.texture } },
            transparent: true,
            blending: NormalBlending,
            depthTest: false,
            depthWrite: false,
        });
        const mesh = new Mesh(this.geometry, this.material);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
    }

    /** Redraw when the text or size changed. Returns false when there is nothing to show. */
    update(args: { credits: string | null; fps: string | null; width: number; height: number }): boolean {
        const { credits, fps } = args;
        if (!credits && !fps) return false;
        // Draw at output size, capped so huge outputs don't cost a huge upload.
        const scale = Math.min(1, 1920 / Math.max(1, args.width));
        const w = Math.max(1, Math.round(args.width * scale));
        const h = Math.max(1, Math.round(args.height * scale));
        const key = `${credits}|${fps}|${w}x${h}`;
        if (key === this.key) return true;
        this.key = key;
        const ctx = this.ctx;
        if (!ctx) return false;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            // three can't resize an uploaded texture in place.
            this.texture.dispose();
        }
        ctx.clearRect(0, 0, w, h);
        const fontPx = Math.max(10, Math.round(h * 0.032));
        const pad = Math.round(fontPx * 0.6);
        const margin = Math.round(fontPx * 0.8);
        ctx.font = `500 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textBaseline = 'middle';
        const box = (text: string, x: number, y: number) => {
            const maxW = w * 0.6;
            let t = text;
            while (t.length > 4 && ctx.measureText(t).width > maxW - pad * 2) t = t.slice(0, -2);
            if (t !== text) t = t.slice(0, -1) + '…';
            const tw = ctx.measureText(t).width;
            const bh = fontPx + pad * 2;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(x, y, tw + pad * 2, bh);
            ctx.fillStyle = '#fff';
            ctx.fillText(t, x + pad, y + bh / 2);
        };
        if (fps) box(fps, margin, margin);
        if (credits) box(credits, margin, h - margin - (fontPx + pad * 2));
        this.texture.needsUpdate = true;
        return true;
    }

    render(renderer: WebGLRenderer, camera: Camera): void {
        renderer.render(this.scene, camera);
    }

    dispose(): void {
        this.texture.dispose();
        this.material.dispose();
        this.geometry.dispose();
    }
}
