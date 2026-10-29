/**
 * Copied from src/content/keyboardTexture.ts (the web package must not import ../../src).
 *
 * Shadertoy-compatible keyboard texture (iKeyboard / keyboard iChannel).
 *
 * 256x5 float RGBA texture, one column per key code. Shaders read `.x`:
 *   row 0: key down              (1.0 while held)
 *   row 1: key pressed           (1.0 for the frame the key went down)
 *   row 2: toggle                (flips on every press)
 *   row 3: time of last press    (iTime in seconds, NEVER_PRESSED if never)
 *   row 4: time of last release  (iTime in seconds, NEVER_PRESSED if never)
 *
 * ShaderAmp extras kept in row 0's G/B/A for older ShaderAmp shaders:
 *   row 0 = vec4(down, pressed, released, toggle)
 */

import { KEYBOARD_TEXTURE_HEIGHT, KEYBOARD_TEXTURE_WIDTH } from '../constants';
const RGBA = 4;

// Press/release time of keys that were never pressed. Far in the past so shaders
// computing `iTime - pressTime` see an old event rather than a press at t=0.
export const KEYBOARD_NEVER_PRESSED = -1e20;

const ROW_DOWN = 0;
const ROW_PRESSED = 1;
const ROW_TOGGLE = 2;
const ROW_PRESS_TIME = 3;
const ROW_RELEASE_TIME = 4;

export type KeyboardState = {
    /** Texture data (KEYBOARD_TEXTURE_WIDTH * KEYBOARD_TEXTURE_HEIGHT * RGBA floats). */
    data: Float32Array<ArrayBuffer>;
    /** Raw held state from DOM events (written immediately, applied on update). */
    held: Uint8Array;
    prevHeld: Uint8Array;
    toggle: Uint8Array;
};

const idx = (row: number, key: number) => (row * KEYBOARD_TEXTURE_WIDTH + key) * RGBA;

/** Size of the texture data array (floats). */
export const KEYBOARD_TEXTURE_LENGTH = KEYBOARD_TEXTURE_WIDTH * KEYBOARD_TEXTURE_HEIGHT * RGBA;

/** Create keyboard state; `data` lets callers reuse an existing texture's array. */
export function createKeyboardState(data?: Float32Array<ArrayBuffer>): KeyboardState {
    if (data && data.length < KEYBOARD_TEXTURE_LENGTH) {
        throw new Error(`keyboard texture data too small: ${data.length} < ${KEYBOARD_TEXTURE_LENGTH}`);
    }
    const state: KeyboardState = {
        data: data ?? new Float32Array(KEYBOARD_TEXTURE_LENGTH),
        held: new Uint8Array(KEYBOARD_TEXTURE_WIDTH),
        prevHeld: new Uint8Array(KEYBOARD_TEXTURE_WIDTH),
        toggle: new Uint8Array(KEYBOARD_TEXTURE_WIDTH),
    };
    resetKeyboardState(state);
    return state;
}

export function resetKeyboardState(state: KeyboardState): void {
    state.data.fill(0);
    state.held.fill(0);
    state.prevHeld.fill(0);
    state.toggle.fill(0);
    for (let k = 0; k < KEYBOARD_TEXTURE_WIDTH; k++) {
        state.data[idx(ROW_PRESS_TIME, k)] = KEYBOARD_NEVER_PRESSED;
        state.data[idx(ROW_RELEASE_TIME, k)] = KEYBOARD_NEVER_PRESSED;
    }
}

/** Record a key going down/up (from a DOM event). Takes effect on the next update. */
export function setKeyDown(state: KeyboardState, keyCode: number, down: boolean): void {
    if (keyCode < 0 || keyCode >= KEYBOARD_TEXTURE_WIDTH) return;
    state.held[keyCode] = down ? 1 : 0;
}

/** Release every key (e.g. on window blur, so keys don't get stuck). */
export function releaseAllKeys(state: KeyboardState): void {
    state.held.fill(0);
}

/** Per-frame update: apply held state, detect transitions and stamp event times. */
export function updateKeyboardState(state: KeyboardState, iTime: number): void {
    const d = state.data;
    for (let k = 0; k < KEYBOARD_TEXTURE_WIDTH; k++) {
        const down = state.held[k] > 0;
        const wasDown = state.prevHeld[k] > 0;
        const pressed = down && !wasDown;
        const released = !down && wasDown;

        if (pressed) {
            state.toggle[k] = state.toggle[k] ? 0 : 1;
            d[idx(ROW_PRESS_TIME, k)] = iTime;
        }
        if (released) {
            d[idx(ROW_RELEASE_TIME, k)] = iTime;
        }

        const r0 = idx(ROW_DOWN, k);
        d[r0 + 0] = down ? 1 : 0;
        d[r0 + 1] = pressed ? 1 : 0;
        d[r0 + 2] = released ? 1 : 0;
        d[r0 + 3] = state.toggle[k];
        d[idx(ROW_PRESSED, k)] = pressed ? 1 : 0;
        d[idx(ROW_TOGGLE, k)] = state.toggle[k];

        state.prevHeld[k] = down ? 1 : 0;
    }
}
