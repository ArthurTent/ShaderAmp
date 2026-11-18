import { buildTransitionSpec, sceneTransitionLabel } from './sceneTransition';
import { TRANSITION_EFFECT_CONFIGS, BUILTIN_TRANSITION_EFFECTS } from './ShaderTransitionPass';
import { SCENE_TRANSITION_OPTIONS } from './sceneTransition';

describe('sceneTransition', () => {
    it('normalizes node data', () => {
        expect(buildTransitionSpec('WhipPan', 1.5)).toEqual({ effect: 'WhipPan', durationSeconds: 1.5 });
        expect(buildTransitionSpec(undefined, undefined)).toEqual({ effect: 'random', durationSeconds: 2 });
        expect(buildTransitionSpec('bogus', -1)).toEqual({ effect: 'random', durationSeconds: 2 });
        expect(buildTransitionSpec('FadeSmooth', 99)).toEqual({ effect: 'FadeSmooth', durationSeconds: 30 });
        expect(buildTransitionSpec('cut', 4)).toEqual({ effect: 'cut' });
    });

    it('offers every built-in renderer effect by its config name', () => {
        const names = SCENE_TRANSITION_OPTIONS.map(o => o.value);
        for (const e of BUILTIN_TRANSITION_EFFECTS) expect(names).toContain(TRANSITION_EFFECT_CONFIGS[e].name);
        expect(sceneTransitionLabel('cut')).toBe('Cut (no transition)');
    });
});
