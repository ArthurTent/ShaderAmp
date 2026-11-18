import type { SceneTransitionEffect, ShaderTransitionSpec } from './types';

export const DEFAULT_SCENE_TRANSITION_DURATION = 2;

/** Choices offered by the scene editor's Transition node (value = stored name). */
export const SCENE_TRANSITION_OPTIONS: { value: SceneTransitionEffect; label: string }[] = [
    { value: 'random', label: 'Random' },
    { value: 'FadeSmooth', label: 'Smooth fade' },
    { value: 'SlowShutter', label: 'Slow shutter' },
    { value: 'Datamosh', label: 'Datamosh' },
    { value: 'WhipPan', label: 'Whip pan' },
    { value: 'GlitchCut', label: 'Glitch cut' },
    { value: 'FilmFlash', label: 'Film flash' },
    { value: 'cut', label: 'Cut (no transition)' },
];

const KNOWN = new Set<string>(SCENE_TRANSITION_OPTIONS.map(o => o.value));

export function sceneTransitionLabel(effect: string | undefined): string {
    return SCENE_TRANSITION_OPTIONS.find(o => o.value === effect)?.label ?? 'Random';
}

/** Normalize Transition-node data into the spec attached to the next shader switch. */
export function buildTransitionSpec(effect: unknown, durationSeconds: unknown): ShaderTransitionSpec {
    const e = typeof effect === 'string' && KNOWN.has(effect) ? (effect as SceneTransitionEffect) : 'random';
    const d = typeof durationSeconds === 'number' && isFinite(durationSeconds) && durationSeconds > 0
        ? Math.min(30, durationSeconds)
        : DEFAULT_SCENE_TRANSITION_DURATION;
    return e === 'cut' ? { effect: 'cut' } : { effect: e, durationSeconds: d };
}
