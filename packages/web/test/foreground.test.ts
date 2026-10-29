import { describe, expect, it } from 'vitest';
import { ForegroundCompositor } from '../src/render/foreground';

const uniforms = (fg: ForegroundCompositor) => (fg as any).material.uniforms;

describe('ForegroundCompositor', () => {
    it('shows nothing of the video until a mask arrives', () => {
        const fg = new ForegroundCompositor({ video: document.createElement('video') });
        expect(uniforms(fg).hasMask.value).toBe(0);
        fg.dispose();
    });

    it('uploads the mask and enables it', () => {
        const fg = new ForegroundCompositor({ video: document.createElement('video') });
        const data = new Uint8Array([0, 64, 128, 255]);
        fg.setMask(data, 2, 2);
        const tex = uniforms(fg).tMask.value;
        expect(tex.image.width).toBe(2);
        expect(Array.from(tex.image.data)).toEqual([0, 64, 128, 255]);
        expect(uniforms(fg).hasMask.value).toBe(1);
        // the caller's buffer may be reused/transferred afterwards
        data.fill(9);
        expect(Array.from(tex.image.data)).toEqual([0, 64, 128, 255]);
        fg.clearMask();
        expect(uniforms(fg).hasMask.value).toBe(0);
        fg.dispose();
    });

    it('reallocates when the mask size changes', () => {
        const fg = new ForegroundCompositor({ video: document.createElement('video') });
        fg.setMask(new Uint8Array(4), 2, 2);
        const first = uniforms(fg).tMask.value;
        fg.setMask(new Uint8Array(9), 3, 3);
        expect(uniforms(fg).tMask.value).not.toBe(first);
        expect(uniforms(fg).tMask.value.image.width).toBe(3);
        fg.dispose();
    });

    it('applies edge and mirror options', () => {
        const fg = new ForegroundCompositor({ video: document.createElement('video'), edge: [0.2, 0.8], mirror: true });
        expect(uniforms(fg).edge.value.toArray()).toEqual([0.2, 0.8]);
        expect(uniforms(fg).mirror.value).toBe(1);
        fg.dispose();
    });
});
