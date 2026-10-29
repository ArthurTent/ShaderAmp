import { describe, expect, it } from 'vitest';
import { MidiMapper } from '../src/midi/MidiMapper';
import type { MidiMapperHooks, OverlayManualMessage } from '../src/midi/MidiMapper';
import { MIDI_TEXTURE_WIDTH } from '../src/constants';
import type { MidiEvent, MidiMapping } from '../src/types';

const evt = (partial: Partial<MidiEvent>): MidiEvent => ({
    type: 'noteon', channel: 0, number: 60, value: 100, inputId: 'in', inputName: 'in', ...partial,
});

const mapping = (partial: Partial<MidiMapping>): MidiMapping => ({
    id: 'm1', source: { type: 'noteon', channel: 0, number: 60 }, target: 'nextShader',
    min: 0, max: 1, ...partial,
});

function makeHooks() {
    const calls: { name: string; args: any[] }[] = [];
    const rec = (name: string) => (...args: any[]) => { calls.push({ name, args }); };
    const uniforms = new Map<string, number>();
    const hooks: MidiMapperHooks = {
        prevShader: rec('prevShader'),
        nextShader: rec('nextShader'),
        resetTime: rec('resetTime'),
        setOption: rec('setOption'),
        getOption: () => true,
        setUniform: (name, value) => { uniforms.set(name, value); },
        getUniform: (name) => uniforms.get(name),
        selectShader: rec('selectShader'),
        playScene: rec('playScene'),
        stopScene: rec('stopScene'),
        toggleScenePause: rec('toggleScenePause'),
        overlay: rec('overlay'),
        injectFft: rec('injectFft'),
        frequencyBins: () => 512,
        midiState: new Uint8Array(MIDI_TEXTURE_WIDTH * 4),
    };
    return { hooks, calls, uniforms };
}

describe('MidiMapper', () => {
    it('dispatches noteon targets only on matching source/channel/number', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        const mappings = [mapping({ target: 'nextShader' })];
        m.handleEvent(evt({ number: 61 }), mappings);   // wrong note
        m.handleEvent(evt({ channel: 2 }), mappings);   // wrong channel
        m.handleEvent(evt({ type: 'cc' }), mappings);   // wrong type
        expect(calls).toHaveLength(0);
        m.handleEvent(evt({}), mappings);
        expect(calls).toEqual([{ name: 'nextShader', args: [] }]);
    });

    it('scopes mappings to a specific inputId when set', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        const mappings = [mapping({ target: 'nextShader', source: { type: 'noteon', channel: 0, number: 60, inputId: 'dev-A' } })];
        m.handleEvent(evt({ inputId: 'dev-B' }), mappings);
        expect(calls).toHaveLength(0);
        m.handleEvent(evt({ inputId: 'dev-A' }), mappings);
        expect(calls).toHaveLength(1);
    });

    it('maps CC absolute values into [min,max] with optional step', () => {
        const { hooks, uniforms } = makeHooks();
        const m = new MidiMapper(hooks);
        const mappings = [mapping({
            source: { type: 'cc', channel: 0, number: 20 },
            target: 'uniform:gain', min: 0, max: 10, step: 1,
        })];
        m.handleEvent(evt({ type: 'cc', number: 20, value: 127 }), mappings);
        expect(uniforms.get('gain')).toBe(10);
        m.handleEvent(evt({ type: 'cc', number: 20, value: 32 }), mappings);
        expect(uniforms.get('gain')).toBe(3); // 32/127*10 ≈ 2.5 → step 1 → 3
    });

    it('accumulates relative encoder deltas', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        const mappings = [mapping({
            id: 'enc', source: { type: 'cc', channel: 0, number: 20 },
            target: 'speedDivider', min: 1, max: 129, encoderMode: 'relative',
        })];
        m.handleEvent(evt({ type: 'cc', number: 20, value: 1 }), mappings);  // +1 tick → 65 + (128/64)*1
        expect(calls[0].args[1]).toBeCloseTo(67);
        m.handleEvent(evt({ type: 'cc', number: 20, value: 127 }), mappings); // -1 tick → 65
        expect(calls[1].args[1]).toBeCloseTo(65);
    });

    it('handles toggle and momentary button modes for uniforms', () => {
        const { hooks, uniforms } = makeHooks();
        const m = new MidiMapper(hooks);
        const toggle = [mapping({ target: 'uniform:flag', buttonMode: 'toggle' })];
        m.handleEvent(evt({}), toggle);
        expect(uniforms.get('flag')).toBe(1);
        m.handleEvent(evt({}), toggle);
        expect(uniforms.get('flag')).toBe(0);

        const momentary = [mapping({ target: 'uniform:flag', buttonMode: 'momentary', min: 0.2, max: 0.9 })];
        m.handleEvent(evt({}), momentary);
        expect(uniforms.get('flag')).toBe(0.9);
        m.handleEvent(evt({ type: 'noteoff', value: 0 }), momentary);
        expect(uniforms.get('flag')).toBe(0.2);
    });

    it('dispatches scene targets on noteon', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        const mappings = [
            mapping({ id: 'a', target: 'playScene:scene-42' }),
            mapping({ id: 'b', target: 'sceneStop', source: { type: 'noteon', channel: 0, number: 61 } }),
        ];
        m.handleEvent(evt({}), mappings);
        m.handleEvent(evt({ number: 61 }), mappings);
        expect(calls).toEqual([
            { name: 'playScene', args: ['scene-42'] },
            { name: 'stopScene', args: [] },
        ]);
    });

    it('shows/releases overlays for momentary note mappings', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        const mappings = [mapping({
            target: 'overlay:ov.frag', overlayOpacity: 0.5, overlayBlendMode: 'normal',
        })];
        m.handleEvent(evt({}), mappings);
        m.handleEvent(evt({ type: 'noteoff', value: 0 }), mappings);
        expect(calls).toEqual([
            { name: 'overlay', args: [{ action: 'show', shaderRef: 'ov.frag', opacity: 0.5, blendMode: 'normal' }] },
            { name: 'overlay', args: [{ action: 'release', shaderRef: 'ov.frag', opacity: 0.5, blendMode: 'normal' }] },
        ]);
    });

    it('hides overlays via overlayHide', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        m.handleEvent(evt({}), [mapping({ target: 'overlayHide' })]);
        expect(calls).toEqual([{ name: 'overlay', args: [{ action: 'hide' }] }]);
    });

    it('maps fftInject notes to bins scaled by velocity', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        m.handleEvent(evt({ number: 64, value: 100 }), [
            mapping({ target: 'fftInject', source: { type: 'noteon', channel: 0, number: 64 } }),
        ]);
        expect(calls).toEqual([{ name: 'injectFft', args: [Math.floor((64 / 128) * 512), 200] }]);
    });

    it('selects shaders and steps render-scale presets', () => {
        const { hooks, calls } = makeHooks();
        const m = new MidiMapper(hooks);
        m.handleEvent(evt({}), [mapping({ target: 'selectShader:foo.frag' })]);
        expect(calls[0]).toEqual({ name: 'selectShader', args: ['foo.frag'] });

        m.handleEvent(evt({ type: 'cc', number: 7, value: 0 }), [
            mapping({ source: { type: 'cc', channel: 0, number: 7 }, target: 'renderScale', min: 0, max: 1 }),
        ]);
        expect(calls[1]).toEqual({ name: 'setOption', args: ['renderScale', 1.0] });
        m.handleEvent(evt({ type: 'cc', number: 7, value: 127 }), [
            mapping({ source: { type: 'cc', channel: 0, number: 7 }, target: 'renderScale', min: 0, max: 1 }),
        ]);
        expect(calls[2]).toEqual({ name: 'setOption', args: ['renderScale', 0.25] });
    });

    it('updates iMidi texture rows for noteon/noteoff', () => {
        const { hooks } = makeHooks();
        const m = new MidiMapper(hooks);
        const state = hooks.midiState;
        m.handleEvent(evt({ number: 40, value: 120 }), []);
        expect(state[40]).toBe(255);                        // held
        expect(state[MIDI_TEXTURE_WIDTH + 40]).toBe(255);   // just-pressed
        expect(state[MIDI_TEXTURE_WIDTH * 3 + 40]).toBe(240); // velocity*2
        m.handleEvent(evt({ type: 'noteoff', number: 40, value: 0 }), []);
        expect(state[40]).toBe(0);
        expect(state[MIDI_TEXTURE_WIDTH * 2 + 40]).toBe(255); // just-released
    });
});
