import { describe, expect, it } from 'vitest';
import { mapPointer } from '../src/input/mouse';

const rect = { left: 100, bottom: 400, width: 400, height: 200 };

describe('mapPointer', () => {
    it('maps client coords to Shadertoy Y-up buffer pixels', () => {
        // left edge, bottom edge -> (0, 0)
        expect(mapPointer(100, 400, rect, 800, 400)).toEqual({ x: 0, y: 0 });
        // right edge, top edge -> (bufW, bufH)
        expect(mapPointer(500, 200, rect, 800, 400)).toEqual({ x: 800, y: 400 });
        // center
        expect(mapPointer(300, 300, rect, 800, 400)).toEqual({ x: 400, y: 200 });
    });

    it('respects the render-scale buffer size', () => {
        // half-size buffer: same click maps to half the pixels
        expect(mapPointer(300, 300, rect, 400, 200)).toEqual({ x: 200, y: 100 });
    });
});
