// Port of the MIDI-mapping dispatch in ShaderAmp/src/content/AnalyzerMesh.tsx,
// adapted to the standalone API surface. Pure logic — the host supplies hooks.
import type { MidiEvent, MidiMapping, MidiMappings, OverlayBlendMode } from '../types';
import { MIDI_TEXTURE_WIDTH } from '../constants';

export const OVERLAY_TARGET_PREFIX = 'overlay:';
export const OVERLAY_HIDE_TARGET = 'overlayHide';

export const isOverlayTarget = (t: string): boolean =>
    t === OVERLAY_HIDE_TARGET || (t.startsWith(OVERLAY_TARGET_PREFIX) && t.length > OVERLAY_TARGET_PREFIX.length);

export const overlayTargetRef = (t: string): string | null =>
    t.startsWith(OVERLAY_TARGET_PREFIX) && t.length > OVERLAY_TARGET_PREFIX.length ? t.slice(OVERLAY_TARGET_PREFIX.length) : null;

export const isSceneTarget = (t: string): boolean =>
    t === 'sceneStop' || t === 'sceneTogglePause' || t.startsWith('playScene:');

export type OverlayManualAction = 'show' | 'release' | 'toggle' | 'opacity' | 'hide';
export type OverlayManualMessage = {
    action: OverlayManualAction;
    shaderRef?: string | null;
    opacity?: number;
    blendMode?: OverlayBlendMode;
};

const overlayButtonAction = (buttonMode: 'toggle' | 'momentary' | undefined, pressed: boolean): OverlayManualAction | null =>
    buttonMode === 'toggle' ? (pressed ? 'toggle' : null) : (pressed ? 'show' : 'release');

/** Latest-value throttle for fader opacity messages (port of createOverlayOpacityThrottle). */
export function createOverlayOpacityThrottle(send: (msg: OverlayManualMessage) => void, intervalMs = 50) {
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

/** Actions the mapper can trigger on the host ShaderAmp instance. */
export interface MidiMapperHooks {
    prevShader(): void;
    nextShader(): void;
    resetTime(): void;
    /** renderScale / speedDivider / volumeAmplifier / fade. */
    setOption(key: 'renderScale' | 'speedDivider' | 'volumeAmplifier' | 'fade', value: number | boolean): void;
    getOption(key: 'renderScale' | 'speedDivider' | 'volumeAmplifier' | 'fade'): number | boolean | undefined;
    /** Set a custom uniform on the current shader (persisted per shader name). */
    setUniform(name: string, value: number): void;
    getUniform(name: string): number | number[] | boolean | undefined;
    /** Load a shader by catalog name or packaged-scene ref. */
    selectShader(ref: string): void;
    playScene(id: string): void;
    stopScene(): void;
    toggleScenePause(): void;
    overlay(msg: OverlayManualMessage): void;
    /** Blend note energy into an FFT bin (fftInject target). */
    injectFft(bin: number, value: number): void;
    /** Number of analyser frequency bins (for fftInject bin mapping). */
    frequencyBins(): number;
    /** iMidi texture data (128x4, one byte per cell). */
    readonly midiState: Uint8Array;
}

export class MidiMapper {
    private relativeAcc = new Map<string, number>();
    private overlayThrottle = createOverlayOpacityThrottle((msg) => this.hooks.overlay(msg));

    constructor(private hooks: MidiMapperHooks) {}

    handleEvent(evt: MidiEvent, mappings: MidiMappings): void {
        const frequencyBins = this.hooks.frequencyBins();
        for (const mapping of mappings) {
            const src = mapping.source;
            const matchType = evt.type === src.type
                || (evt.type === 'noteon' && src.type === 'noteon')
                || (evt.type === 'noteoff' && src.type === 'noteon'); // allow release to reset momentary mappings
            if (!matchType) continue;
            if (src.channel !== evt.channel) continue;
            if (src.number !== evt.number) continue;
            if (src.inputId && src.inputId !== evt.inputId) continue;

            let mapped: number;
            if (mapping.encoderMode === 'relative') {
                // Relative (endless encoder): value 1–63 = CW increment, 65–127 = CCW decrement
                const range = mapping.max - mapping.min;
                const step = range / 64; // one full sweep ≈ 64 ticks
                const delta = evt.value <= 63 ? evt.value * step : (evt.value - 128) * step;
                const prev = this.relativeAcc.get(mapping.id) ?? ((mapping.min + mapping.max) / 2);
                mapped = Math.min(mapping.max, Math.max(mapping.min, prev + delta));
                this.relativeAcc.set(mapping.id, mapped);
            } else {
                const normalized = evt.value / 127; // 0..1
                mapped = mapping.min + normalized * (mapping.max - mapping.min);
                if (mapping.step) mapped = Math.round(mapped / mapping.step) * mapping.step;
            }
            const target = mapping.target;

            if (target === 'prevShader') {
                if (evt.type === 'noteon') this.hooks.prevShader();
            } else if (target === 'nextShader') {
                if (evt.type === 'noteon') this.hooks.nextShader();
            } else if (target === 'resetTime') {
                if (evt.type === 'noteon') this.hooks.resetTime();
            } else if (target === 'toggleShaderFade') {
                if (evt.type === 'noteon') this.hooks.setOption('fade', this.hooks.getOption('fade') === false);
            } else if (target === 'renderScale') {
                const RENDER_PRESETS = [1.0, 0.75, 2 / 3, 0.5, 1 / 3, 0.25];
                const idx = Math.min(RENDER_PRESETS.length - 1, Math.round((evt.value / 127) * (RENDER_PRESETS.length - 1)));
                this.hooks.setOption('renderScale', RENDER_PRESETS[idx]);
            } else if (target === 'speedDivider') {
                this.hooks.setOption('speedDivider', Math.round(mapped));
            } else if (target === 'volumeAmplifier') {
                this.hooks.setOption('volumeAmplifier', mapped);
            } else if (target === 'fftInject') {
                const bin = Math.floor((evt.number / 128) * frequencyBins);
                if (bin < 512) this.hooks.injectFft(bin, Math.min(evt.value * 2, 254));
            } else if (target.startsWith('uniform:')) {
                this.dispatchUniformTarget(mapping, evt, target.slice(8), mapped);
            } else if (isOverlayTarget(target)) {
                this.dispatchOverlayTarget(target, evt, mapping, mapped);
            } else if (isSceneTarget(target)) {
                if (evt.type === 'noteon') this.dispatchSceneTarget(target);
            } else if (target.startsWith('selectShader:')) {
                if (evt.type === 'noteon') this.hooks.selectShader(target.slice(13));
            }
            // Targets tied to extension storage/settings (randomize*, toggleWebcam,
            // eqBand, ...) have no standalone equivalent and are ignored.
        }

        // Always update iMidi texture state for note events
        const note = evt.number;
        const state = this.hooks.midiState;
        if (note < MIDI_TEXTURE_WIDTH) {
            if (evt.type === 'noteon') {
                state[note] = 255;                                    // row 0: held
                state[MIDI_TEXTURE_WIDTH + note] = 255;               // row 1: just-pressed
                state[MIDI_TEXTURE_WIDTH * 2 + note] = 0;             // row 2: just-released
                state[MIDI_TEXTURE_WIDTH * 3 + note] = evt.value * 2; // row 3: velocity
            } else if (evt.type === 'noteoff') {
                state[note] = 0;
                state[MIDI_TEXTURE_WIDTH + note] = 0;
                state[MIDI_TEXTURE_WIDTH * 2 + note] = 255;
            }
        }
    }

    private dispatchUniformTarget(mapping: MidiMapping, evt: MidiEvent, uniformName: string, mapped: number): void {
        if (mapping.buttonMode === 'toggle' && evt.type === 'noteon' && evt.value > 0) {
            const current = this.hooks.getUniform(uniformName);
            this.hooks.setUniform(uniformName, current ? 0 : 1);
        } else if (mapping.buttonMode === 'momentary' && (evt.type === 'noteon' || evt.type === 'noteoff')) {
            this.hooks.setUniform(uniformName, evt.type === 'noteoff' ? mapping.min : mapping.max);
        } else if (mapping.buttonMode !== 'toggle' && mapping.buttonMode !== 'momentary' && evt.type !== 'noteoff') {
            this.hooks.setUniform(uniformName, mapped);
        }
    }

    private dispatchOverlayTarget(target: string, evt: MidiEvent, mapping: MidiMapping, mapped: number): void {
        if (target === OVERLAY_HIDE_TARGET) {
            const pressed = mapping.source.type === 'noteon' ? evt.type === 'noteon' : evt.value / 127 > 0.5;
            if (pressed) this.hooks.overlay({ action: 'hide' });
            return;
        }
        const shaderRef = overlayTargetRef(target);
        if (!shaderRef) return;
        const maxOpacity = Math.min(1, Math.max(0, mapping.overlayOpacity ?? 1));
        const blendMode: OverlayBlendMode = mapping.overlayBlendMode === 'normal' ? 'normal' : 'additive';
        if (mapping.source.type === 'noteon') {
            if (evt.type === 'noteon' || evt.type === 'noteoff') {
                const action = overlayButtonAction(mapping.buttonMode, evt.type === 'noteon');
                if (action) this.hooks.overlay({ action, shaderRef, opacity: maxOpacity, blendMode });
            }
        } else if (evt.type === 'cc') {
            const value01 = mapping.max !== mapping.min
                ? Math.min(1, Math.max(0, (mapped - mapping.min) / (mapping.max - mapping.min)))
                : evt.value / 127;
            this.overlayThrottle(shaderRef, value01 * maxOpacity, blendMode);
        }
    }

    private dispatchSceneTarget(target: string): void {
        if (target.startsWith('playScene:')) {
            const sceneId = target.slice('playScene:'.length);
            if (sceneId) this.hooks.playScene(sceneId);
            return;
        }
        if (target === 'sceneStop') this.hooks.stopScene();
        else if (target === 'sceneTogglePause') this.hooks.toggleScenePause();
    }
}
