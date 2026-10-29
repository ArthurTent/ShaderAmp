import { describe, expect, it } from 'vitest';
import { KEYBOARD_TEXTURE_HEIGHT, KEYBOARD_TEXTURE_WIDTH } from '../src/constants';
import {
    KEYBOARD_NEVER_PRESSED,
    createKeyboardState,
    setKeyDown,
    updateKeyboardState,
} from '../src/input/keyboardTexture';

const px = (data: Float32Array, key: number, row: number) => data[(row * KEYBOARD_TEXTURE_WIDTH + key) * 4];

describe('keyboard texture (Shadertoy layout)', () => {
    it('is 256x5', () => {
        expect(KEYBOARD_TEXTURE_HEIGHT).toBe(5);
        expect(createKeyboardState().data.length).toBe(KEYBOARD_TEXTURE_WIDTH * 5 * 4);
    });

    it('marks never-pressed keys far in the past', () => {
        const s = createKeyboardState();
        expect(px(s.data, 32, 3)).toBe(Math.fround(KEYBOARD_NEVER_PRESSED));
        expect(px(s.data, 32, 4)).toBe(Math.fround(KEYBOARD_NEVER_PRESSED));
    });

    it('writes down, pressed, toggle and press/release times', () => {
        const s = createKeyboardState();
        setKeyDown(s, 32, true);
        updateKeyboardState(s, 1.5);
        expect(px(s.data, 32, 0)).toBe(1);
        expect(px(s.data, 32, 1)).toBe(1);
        expect(px(s.data, 32, 2)).toBe(1);
        expect(px(s.data, 32, 3)).toBe(1.5);

        updateKeyboardState(s, 1.6);
        expect(px(s.data, 32, 1)).toBe(0); // pressed lasts one frame
        expect(px(s.data, 32, 3)).toBe(1.5);

        setKeyDown(s, 32, false);
        updateKeyboardState(s, 2.25);
        expect(px(s.data, 32, 0)).toBe(0);
        expect(px(s.data, 32, 4)).toBe(2.25);
        expect(px(s.data, 32, 2)).toBe(1); // toggle stays until next press

        setKeyDown(s, 32, true);
        updateKeyboardState(s, 3);
        expect(px(s.data, 32, 2)).toBe(0);
    });
});
