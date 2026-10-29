import { describe, expect, it } from 'vitest';
import { getKeyboardKeyCode } from '../src/input/keyboard';

const ev = (init: Partial<KeyboardEvent>) => {
    const e = new KeyboardEvent('keydown');
    for (const [k, v] of Object.entries(init)) {
        Object.defineProperty(e, k, { value: v });
    }
    return e;
};

describe('getKeyboardKeyCode', () => {
    it('prefers keyCode when valid', () => {
        expect(getKeyboardKeyCode(ev({ keyCode: 65 }))).toBe(65);
        expect(getKeyboardKeyCode(ev({ keyCode: 37 }))).toBe(37);
    });

    it('falls back to event.key for printable chars', () => {
        expect(getKeyboardKeyCode(ev({ keyCode: 0, key: 'a' }))).toBe(65);
        expect(getKeyboardKeyCode(ev({ keyCode: 0, key: 'A' }))).toBe(65);
        expect(getKeyboardKeyCode(ev({ keyCode: 0, key: '5' }))).toBe(53);
    });

    it('falls back to event.code for special keys', () => {
        expect(getKeyboardKeyCode(ev({ keyCode: 0, code: 'Space' }))).toBe(32);
        expect(getKeyboardKeyCode(ev({ keyCode: 0, code: 'ArrowLeft' }))).toBe(37);
        expect(getKeyboardKeyCode(ev({ keyCode: 0, code: 'KeyZ' }))).toBe(90);
        expect(getKeyboardKeyCode(ev({ keyCode: 0, code: 'ShiftRight' }))).toBe(16);
    });

    it('returns null when nothing maps', () => {
        expect(getKeyboardKeyCode(ev({ keyCode: 0, key: 'F1', code: 'F1' }))).toBe(null);
        expect(getKeyboardKeyCode(ev({ keyCode: 0 }))).toBe(null);
    });
});
