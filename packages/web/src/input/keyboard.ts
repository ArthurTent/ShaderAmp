import { KEYBOARD_TEXTURE_WIDTH } from '../constants';
import {
    createKeyboardState,
    releaseAllKeys,
    resetKeyboardState,
    setKeyDown,
    updateKeyboardState,
} from './keyboardTexture';

// Map a KeyboardEvent to a Shadertoy-compatible key code (0-255).
// Copied from AnalyzerMesh.tsx.
export function getKeyboardKeyCode(event: KeyboardEvent): number | null {
    if (event.keyCode != null && event.keyCode > 0 && event.keyCode < KEYBOARD_TEXTURE_WIDTH) {
        return event.keyCode;
    }

    if (event.key && event.key.length === 1) {
        const code = event.key.toUpperCase().charCodeAt(0);
        if (code >= 0 && code < KEYBOARD_TEXTURE_WIDTH) return code;
    }

    if (event.code) {
        switch (event.code) {
            case 'Space': return 32;
            case 'Enter': return 13;
            case 'Escape': return 27;
            case 'Backspace': return 8;
            case 'Tab': return 9;
            case 'ShiftLeft':
            case 'ShiftRight': return 16;
            case 'ControlLeft':
            case 'ControlRight': return 17;
            case 'AltLeft':
            case 'AltRight': return 18;
            case 'CapsLock': return 20;
            case 'ArrowLeft': return 37;
            case 'ArrowUp': return 38;
            case 'ArrowRight': return 39;
            case 'ArrowDown': return 40;
            case 'Digit0': return 48;
            case 'Digit1': return 49;
            case 'Digit2': return 50;
            case 'Digit3': return 51;
            case 'Digit4': return 52;
            case 'Digit5': return 53;
            case 'Digit6': return 54;
            case 'Digit7': return 55;
            case 'Digit8': return 56;
            case 'Digit9': return 57;
            case 'KeyA': return 65;
            case 'KeyB': return 66;
            case 'KeyC': return 67;
            case 'KeyD': return 68;
            case 'KeyE': return 69;
            case 'KeyF': return 70;
            case 'KeyG': return 71;
            case 'KeyH': return 72;
            case 'KeyI': return 73;
            case 'KeyJ': return 74;
            case 'KeyK': return 75;
            case 'KeyL': return 76;
            case 'KeyM': return 77;
            case 'KeyN': return 78;
            case 'KeyO': return 79;
            case 'KeyP': return 80;
            case 'KeyQ': return 81;
            case 'KeyR': return 82;
            case 'KeyS': return 83;
            case 'KeyT': return 84;
            case 'KeyU': return 85;
            case 'KeyV': return 86;
            case 'KeyW': return 87;
            case 'KeyX': return 88;
            case 'KeyY': return 89;
            case 'KeyZ': return 90;
        }
    }

    return null;
}

type KeyTarget = HTMLElement | (Window & typeof globalThis);

/**
 * Track key events on `target` and write the Shadertoy keyboard layout
 * (see ./keyboardTexture.ts) into `texData`, the iKeyboard texture's array.
 * Call `update(iTime)` once per frame before rendering.
 */
export function attachKeyboard(target: KeyTarget, texData: Float32Array<ArrayBuffer>): {
    update(iTime: number): void;
    reset(): void;
    dispose(): void;
} {
    const state = createKeyboardState(texData);

    const setHeld = (event: KeyboardEvent, held: boolean) => {
        const keyCode = getKeyboardKeyCode(event);
        if (keyCode === null) return;
        setKeyDown(state, keyCode, held);
    };
    const onKeyDown = (e: Event) => setHeld(e as KeyboardEvent, true);
    const onKeyUp = (e: Event) => setHeld(e as KeyboardEvent, false);
    const onBlur = () => releaseAllKeys(state);

    const t = target as unknown as EventTarget;
    t.addEventListener('keydown', onKeyDown);
    t.addEventListener('keyup', onKeyUp);
    t.addEventListener('blur', onBlur);

    return {
        update(iTime: number) {
            updateKeyboardState(state, iTime);
        },
        reset() {
            resetKeyboardState(state);
        },
        dispose() {
            t.removeEventListener('keydown', onKeyDown);
            t.removeEventListener('keyup', onKeyUp);
            t.removeEventListener('blur', onBlur);
        },
    };
}
