import browser from 'webextension-polyfill';
import type { OverlayBlendMode } from './types';

// Runtime message understood by the background SceneController
export const OVERLAY_MANUAL = 'OVERLAY_MANUAL';
export const OVERLAY_TARGET_PREFIX = 'overlay:';
export const OVERLAY_HIDE_TARGET = 'overlayHide';

export type OverlayManualAction = 'show' | 'release' | 'toggle' | 'opacity' | 'hide';
export type OverlayManualMessage = {
    action: OverlayManualAction;
    shaderRef?: string;
    opacity?: number;
    blendMode?: OverlayBlendMode;
};

/** True for 'overlayHide' and 'overlay:<shaderRef>' (non-empty ref). */
export const isOverlayTarget = (t: string): boolean =>
    t === OVERLAY_HIDE_TARGET || (t.startsWith(OVERLAY_TARGET_PREFIX) && t.length > OVERLAY_TARGET_PREFIX.length);

/** 'overlay:<ref>' -> '<ref>', anything else -> null. */
export const overlayTargetRef = (t: string): string | null =>
    t.startsWith(OVERLAY_TARGET_PREFIX) && t.length > OVERLAY_TARGET_PREFIX.length ? t.slice(OVERLAY_TARGET_PREFIX.length) : null;

export const sendOverlayManual = (msg: OverlayManualMessage): void => {
    browser.runtime.sendMessage({ command: OVERLAY_MANUAL, ...msg }).catch(() => {});
};

/** Momentary (default): press -> show, release -> release. Toggle: press -> toggle, release -> nothing. */
export const overlayButtonAction = (buttonMode: 'toggle' | 'momentary' | undefined, pressed: boolean): OverlayManualAction | null =>
    buttonMode === 'toggle' ? (pressed ? 'toggle' : null) : (pressed ? 'show' : 'release');

/**
 * Latest-value throttle for fader opacity messages (MIDI CC / joystick axes fire
 * at up to ~100 Hz). Sends immediately when idle, then at most once per
 * `intervalMs` per shaderRef, and always delivers the final value (so a fader
 * pulled to 0 reliably hides the overlay).
 */
export function createOverlayOpacityThrottle(send: (msg: OverlayManualMessage) => void = sendOverlayManual, intervalMs = 50) {
    const pending = new Map<string, OverlayManualMessage>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const flush = (ref: string) => {
        const msg = pending.get(ref);
        pending.delete(ref);
        if (!msg) { timers.delete(ref); return; }
        send(msg);
        timers.set(ref, setTimeout(() => flush(ref), intervalMs));
    };
    return (shaderRef: string, opacity: number, blendMode: OverlayBlendMode) => {
        pending.set(shaderRef, { action: 'opacity', shaderRef, opacity: Math.min(1, Math.max(0, opacity)), blendMode });
        if (!timers.has(shaderRef)) flush(shaderRef);
    };
}

export type OverlayInputEvent = { kind: 'button'; pressed: boolean } | { kind: 'fader'; value01: number };

/** Single dispatch entry point used by all MIDI/joystick handlers. */
export function dispatchOverlayTarget(
    target: string,
    event: OverlayInputEvent,
    mapping: { buttonMode?: 'toggle' | 'momentary'; overlayOpacity?: number; overlayBlendMode?: OverlayBlendMode },
    throttle: ReturnType<typeof createOverlayOpacityThrottle>,
    send: (msg: OverlayManualMessage) => void = sendOverlayManual,
): void {
    if (target === OVERLAY_HIDE_TARGET) {
        if (event.kind === 'button' ? event.pressed : event.value01 > 0.5) send({ action: 'hide' });
        return;
    }
    const shaderRef = overlayTargetRef(target);
    if (!shaderRef) return;
    const maxOpacity = Math.min(1, Math.max(0, mapping.overlayOpacity ?? 1));
    const blendMode: OverlayBlendMode = mapping.overlayBlendMode === 'normal' ? 'normal' : 'additive';
    if (event.kind === 'fader') {
        throttle(shaderRef, event.value01 * maxOpacity, blendMode);
        return;
    }
    const action = overlayButtonAction(mapping.buttonMode, event.pressed);
    if (action) send({ action, shaderRef, opacity: maxOpacity, blendMode });
}
