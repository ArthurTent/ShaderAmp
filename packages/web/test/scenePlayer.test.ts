import { describe, expect, it } from 'vitest';
import { ScenePlayer } from '../src/scene/ScenePlayer';
import type { ScenePlayerHooks } from '../src/scene/ScenePlayer';
import type { OverlayState, SceneGraph, ShaderObject } from '../src/types';

const shader = (name: string): ShaderObject => ({
    shaderName: name,
    metaData: { author: '', modifiedBy: '', shaderName: name, url: '', license: '', shaderSpeed: 1 } as any,
    inlineCode: 'void main() {}',
});

function makeHooks(refs: Record<string, ShaderObject> = {}) {
    const activated: ShaderObject[] = [];
    const overlays: (OverlayState | null)[] = [];
    const entered: string[] = [];
    const uniforms: Record<string, Record<string, any>> = {};
    const resets: number[] = [];
    let currentName = 'initial.frag';
    const hooks: ScenePlayerHooks = {
        resolveShader: (ref) => refs[ref],
        activateShader: (s) => { activated.push(s); currentName = s.shaderName; },
        applyUniforms: (name, values) => { uniforms[name] = { ...uniforms[name], ...values }; },
        getUniform: (name, key) => uniforms[name]?.[key],
        currentShaderName: () => currentName,
        setOverlay: (s) => { overlays.push(s); },
        resetShaderClock: () => { resets.push(1); },
        onEnterNode: (_scene, node) => { entered.push(node.id); },
    };
    return { hooks, activated, overlays, entered, uniforms, resets };
}

const node = (id: string, type: any, data: any = {}) => ({ id, type, position: { x: 0, y: 0 }, data });
const edge = (source: string, target: string, trigger: any, sourceHandle?: string) =>
    ({ id: `${source}->${target}`, source, target, trigger, sourceHandle });

function scene(partial: Partial<SceneGraph>): SceneGraph {
    return { id: 's1', name: 'Scene', isLooping: false, nodes: [], edges: [], ...partial };
}

describe('ScenePlayer', () => {
    it('activates the first node on play and follows a time edge', async () => {
        const { hooks, activated, entered } = makeHooks({ a: shader('a.frag'), b: shader('b.frag') });
        const p = new ScenePlayer(hooks);
        const g = scene({
            nodes: [node('start', 'start'), node('a', 'scene', { shaderRef: 'a' }), node('b', 'scene', { shaderRef: 'b' })],
            edges: [edge('start', 'a', { type: 'manual' }), edge('a', 'b', { type: 'time', durationSeconds: 2 })],
        });
        await p.play(g);
        expect(activated.map((s) => s.shaderName)).toEqual(['a.frag']);
        expect(p.playing).toBe(true);

        await p.tick({ time: 1 });
        expect(activated).toHaveLength(1);
        await p.tick({ time: 2.5 });
        expect(activated.map((s) => s.shaderName)).toEqual(['a.frag', 'b.frag']);
        expect(entered).toEqual(['a', 'b']);
    });

    it('advances on beat triggers', async () => {
        const { hooks, activated } = makeHooks({ a: shader('a.frag'), b: shader('b.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [node('start', 'start'), node('a', 'scene', { shaderRef: 'a' }), node('b', 'scene', { shaderRef: 'b' })],
            edges: [edge('start', 'a', { type: 'manual' }), edge('a', 'b', { type: 'beat', beatCount: 2 })],
        }));
        await p.onBeat();
        expect(activated).toHaveLength(1);
        await p.onBeat();
        expect(activated).toHaveLength(2);
        expect(activated[1].shaderName).toBe('b.frag');
    });

    it('holds audio edges for holdSeconds before firing', async () => {
        const { hooks, activated } = makeHooks({ a: shader('a.frag'), b: shader('b.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [node('start', 'start'), node('a', 'scene', { shaderRef: 'a' }), node('b', 'scene', { shaderRef: 'b' })],
            edges: [edge('start', 'a', { type: 'manual' }), edge('a', 'b', { type: 'audio', threshold: 10, holdSeconds: 0.5 })],
        }));
        p.onAudioLevel(20);
        await p.tick({ time: 1 });   // audioAboveSince = 1
        await p.tick({ time: 1.3 }); // held only 0.3 < 0.5
        expect(activated).toHaveLength(1);
        await p.tick({ time: 1.6 });
        expect(activated).toHaveLength(2);
    });

    it('manualAdvance follows the manual edge', async () => {
        const { hooks, activated } = makeHooks({ a: shader('a.frag'), b: shader('b.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [node('start', 'start'), node('a', 'scene', { shaderRef: 'a' }), node('b', 'scene', { shaderRef: 'b' })],
            edges: [edge('start', 'a', { type: 'manual' }), edge('a', 'b', { type: 'manual' })],
        }));
        await p.manualAdvance();
        expect(activated.map((s) => s.shaderName)).toEqual(['a.frag', 'b.frag']);
    });

    it('evaluates condition nodes down true/false handles', async () => {
        const { hooks, activated } = makeHooks({ a: shader('a.frag'), hi: shader('hi.frag'), lo: shader('lo.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [
                node('start', 'start'),
                node('a', 'scene', { shaderRef: 'a' }),
                node('cond', 'condition', { condition: { kind: 'audio', operator: '>', value: 10 } }),
                node('hi', 'scene', { shaderRef: 'hi' }),
                node('lo', 'scene', { shaderRef: 'lo' }),
            ],
            edges: [
                edge('start', 'a', { type: 'manual' }),
                edge('a', 'cond', { type: 'manual' }),
                edge('cond', 'hi', { type: 'manual' }, 'true'),
                edge('cond', 'lo', { type: 'manual' }, 'false'),
            ],
        }));
        p.onAudioLevel(0);
        await p.manualAdvance(); // a -> cond -> false -> lo
        expect(activated.map((s) => s.shaderName)).toEqual(['a.frag', 'lo.frag']);
    });

    it('applies uniform-node overrides and answers uniform conditions', async () => {
        const { hooks, uniforms } = makeHooks({ a: shader('a.frag'), b: shader('b.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [
                node('start', 'start'),
                node('u', 'uniform', { shaderRef: 'a', uniformOverrides: { intensity: 0.5 } }),
                node('cond', 'condition', { condition: { kind: 'uniform', shaderRef: 'a', name: 'intensity', operator: '>=', value: 0.5 } }),
                node('b', 'scene', { shaderRef: 'b' }),
            ],
            edges: [
                edge('start', 'u', { type: 'manual' }),
                edge('u', 'cond', { type: 'manual' }),
                edge('cond', 'b', { type: 'manual' }, 'true'),
            ],
        }));
        // play enters 'u' (applies override) then evaluateChain hops to 'cond'
        // which resolves true immediately and lands on 'b'.
        expect(uniforms['a.frag'].intensity).toBe(0.5);
    });

    it('drives overlay nodes through setOverlay', async () => {
        const { hooks, overlays } = makeHooks({ ov: shader('ov.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [node('start', 'start'), node('o', 'overlay', { shaderRef: 'ov', overlayOpacity: 0.6, overlayBlendMode: 'normal' })],
            edges: [edge('start', 'o', { type: 'manual' })],
        }));
        const last = overlays[overlays.length - 1];
        expect(last?.shader.shaderName).toBe('ov.frag');
        expect(last?.opacity).toBeCloseTo(0.6);
        expect(last?.blendMode).toBe('normal');
    });

    it('manual overlay layer takes priority and restores the scene layer', async () => {
        const { hooks, overlays } = makeHooks({ ov: shader('ov.frag'), man: shader('man.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [node('start', 'start'), node('o', 'overlay', { shaderRef: 'ov' })],
            edges: [edge('start', 'o', { type: 'manual' })],
        }));
        await p.manualOverlayAction({ action: 'show', shaderRef: 'man', opacity: 1 });
        expect(overlays[overlays.length - 1]?.shader.shaderName).toBe('man.frag');
        await p.manualOverlayAction({ action: 'release', shaderRef: 'man' });
        expect(overlays[overlays.length - 1]?.shader.shaderName).toBe('ov.frag');
    });

    it('restarts a looping scene when the terminal node idles', async () => {
        const { hooks, activated } = makeHooks({ a: shader('a.frag'), b: shader('b.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            isLooping: true,
            nodes: [node('start', 'start'), node('a', 'scene', { shaderRef: 'a' }), node('b', 'scene', { shaderRef: 'b' })],
            edges: [edge('start', 'a', { type: 'manual' }), edge('a', 'b', { type: 'time', durationSeconds: 1 })],
        }));
        // At t=2 the chain hops a→b; 'b' is terminal, so the loop check
        // re-enters the graph and lands back on 'a' in the same tick.
        await p.tick({ time: 2 });
        expect(activated.map((s) => s.shaderName)).toEqual(['a.frag', 'b.frag', 'a.frag']);
    });

    it('stop clears playback state and the overlay', async () => {
        const { hooks, overlays } = makeHooks({ ov: shader('ov.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [node('start', 'start'), node('o', 'overlay', { shaderRef: 'ov' })],
            edges: [edge('start', 'o', { type: 'manual' })],
        }));
        await p.stop();
        expect(p.playing).toBe(false);
        expect(p.activeScene).toBeNull();
        expect(overlays[overlays.length - 1]).toBeNull();
    });

    it('honours explicit timeSource for the scene clock', async () => {
        const { hooks, activated } = makeHooks({ a: shader('a.frag'), b: shader('b.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            timeSource: 'iTime',
            nodes: [node('start', 'start'), node('a', 'scene', { shaderRef: 'a' }), node('b', 'scene', { shaderRef: 'b' })],
            edges: [edge('start', 'a', { type: 'manual' }), edge('a', 'b', { type: 'time', durationSeconds: 2 })],
        }));
        // iAmplifiedTime is far ahead but the scene follows iTime.
        await p.tick({ time: 100, iTime: 1, iAmplifiedTime: 100 });
        expect(activated).toHaveLength(1);
        await p.tick({ time: 100, iTime: 3, iAmplifiedTime: 100 });
        expect(activated).toHaveLength(2);
    });

    it('play mode reset rewinds the shader clock', async () => {
        const { hooks, resets } = makeHooks({ a: shader('a.frag') });
        const p = new ScenePlayer(hooks);
        await p.play(scene({
            nodes: [node('start', 'start'), node('a', 'scene', { shaderRef: 'a' })],
            edges: [edge('start', 'a', { type: 'manual' })],
        }), 'reset');
        expect(resets).toHaveLength(1);
    });
});
