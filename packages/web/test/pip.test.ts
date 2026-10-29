import { describe, expect, it } from 'vitest';
import { getPipMode } from '../src/pip/pip';

const winWith = (over: any) => ({
    document: { pictureInPictureEnabled: true },
    HTMLCanvasElement: { prototype: { captureStream: () => null } },
    ...over,
});

describe('getPipMode', () => {
    it('prefers document PiP when available', () => {
        const win = winWith({ documentPictureInPicture: {} });
        expect(getPipMode(win, 'auto')).toBe('document');
    });

    it('honours requested=video', () => {
        const win = winWith({ documentPictureInPicture: {} });
        expect(getPipMode(win, 'video')).toBe('video');
    });

    it('falls back to video PiP', () => {
        expect(getPipMode(winWith({}), 'auto')).toBe('video');
    });

    it('returns null when nothing is supported (Firefox)', () => {
        const win = {
            document: { pictureInPictureEnabled: false },
            HTMLCanvasElement: { prototype: {} },
        };
        expect(getPipMode(win, 'auto')).toBe(null);
    });
});
