/**
 * Integration harness for scene switching: a real in-memory chrome.storage.local
 * that fires onChanged listeners synchronously on every write, so the
 * controller's storage-listener path (playSceneById -> setStorage -> onChanged
 * -> setActive) actually executes instead of being simulated by hand.
 */

// ── Shared storage state (hoisted for the jest.mock factory) ────────────────
const shared = {
    store: {} as Record<string, any>,
    listeners: [] as Array<(changes: any, area: string) => void>,
    writes: [] as Array<Record<string, any>>,
    removeListener(l: any) {
        const i = shared.listeners.indexOf(l);
        if (i >= 0) shared.listeners.splice(i, 1);
    },
    fire(changes: Record<string, { oldValue: any; newValue: any }>) {
        for (const l of shared.listeners.slice()) l(changes, 'local');
    },
};

const chromeLocal = {
    get: jest.fn((keys: any, cb?: (result: any) => void) => {
        let result: Record<string, any> = {};
        if (keys === null || keys === undefined) {
            result = { ...shared.store };
        } else {
            const ks = Array.isArray(keys) ? keys : [keys];
            for (const k of ks) {
                if (k in shared.store) result[k] = shared.store[k];
            }
        }
        if (cb) {
            cb(result);
            return undefined;
        }
        return Promise.resolve(result);
    }),
    set: jest.fn((items: Record<string, any>, cb?: () => void) => {
        // Chrome-faithful: identical values don't appear in the change event.
        const changes: Record<string, { oldValue: any; newValue: any }> = {};
        for (const k of Object.keys(items)) {
            if (JSON.stringify(shared.store[k]) !== JSON.stringify(items[k])) {
                changes[k] = { oldValue: shared.store[k], newValue: items[k] };
            }
            shared.store[k] = items[k];
        }
        shared.writes.push(items);
        if (cb) cb();
        if (Object.keys(changes).length > 0) shared.fire(changes);
        return Promise.resolve();
    }),
    remove: jest.fn((keys: string | string[], cb?: () => void) => {
        const ks = Array.isArray(keys) ? keys : [keys];
        const changes: Record<string, { oldValue: any; newValue: any }> = {};
        for (const k of ks) {
            if (k in shared.store) {
                changes[k] = { oldValue: shared.store[k], newValue: undefined };
                delete shared.store[k];
            }
        }
        if (cb) cb();
        if (Object.keys(changes).length) shared.fire(changes);
        return Promise.resolve();
    }),
};

(global as any).chrome = {
    runtime: { getManifest: jest.fn(() => ({ update_url: 'https://example.com' })) },
    storage: {
        local: chromeLocal,
        onChanged: {
            addListener: jest.fn((l: any) => shared.listeners.push(l)),
            removeListener: jest.fn((l: any) => shared.removeListener(l)),
        },
    },
};

import { SceneController } from './sceneController';
import { STATE_SCENES, STATE_ACTIVE_SCENE_ID, STATE_SCENE_PLAYING, STATE_CURRENT_SHADER, STATE_SHADERINDEX } from '@src/storage/storageConstants';
import { RESET_TIME } from '@src/helpers/constants';
import browser from 'webextension-polyfill';
import type { SceneGraph, SceneNode, SceneEdge, ShaderObject } from '@src/helpers/types';
import type WorkerStateType from './workerState';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: {
            onChanged: {
                addListener: jest.fn((l: any) => shared.listeners.push(l)),
                removeListener: jest.fn((l: any) => shared.removeListener(l)),
            },
            local: chromeLocal,
        },
        runtime: { sendMessage: jest.fn(() => Promise.resolve()), getURL: (path: string) => path },
        tabs: { sendMessage: jest.fn(() => Promise.resolve()) },
    },
}));

jest.mock('@src/storage/shaderDB', () => ({
    getImportedShadersDB: jest.fn(() => Promise.resolve({ shaders: [] })),
}));

jest.mock('@src/helpers/mediaControlRelay', () => ({
    relayMediaControl: jest.fn(() => Promise.resolve()),
}));

// ── Helpers (mirrors sceneController.test.ts) ────────────────────────────────

function makeShader(name: string): ShaderObject {
    return {
        shaderName: name,
        metaData: { shaderName: name, author: 'test', modifiedBy: '', url: '', license: '', shaderSpeed: 1 } as any,
        inlineCode: 'void main(){}',
    };
}

async function makeWorkerState(): Promise<WorkerStateType> {
    const { default: WorkerState } = await import('./workerState');
    const state = new WorkerState();
    state.shaderCatalog = { shaders: [
        makeShader('A.frag'),
        makeShader('B.frag'),
        makeShader('ThePopularShader.frag'),
        makeShader('ThePopularShader_forward.frag'),
        makeShader('AGiftForYou.frag'),
        makeShader('HabitablePlanet.frag'),
        makeShader('Informer.frag'),
    ], lastModified: new Date() } as any;
    state.importedShaders = [];
    state.customShaders = [];
    state.shaderOptions = {};
    return state;
}

// Scene A: start -> a (A.frag) -> b (B.frag), 0.1 s time edges
function sceneA(id = 'scene-a'): SceneGraph {
    return {
        id,
        name: 'Scene A',
        isLooping: false,
        nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
            { id: 'a', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag' } },
            { id: 'b', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'B.frag' } },
        ],
        edges: [
            { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0.1 } },
            { id: 'ab', source: 'a', target: 'b', trigger: { type: 'time', durationSeconds: 0.1 } },
        ],
    };
}

// Scene B: start -> p (firstShader) -> g (AGiftForYou.frag), 0.1 s time edges
function sceneB(firstShader = 'ThePopularShader.frag', id = 'scene-b'): SceneGraph {
    return {
        id,
        name: 'Scene B',
        isLooping: false,
        nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
            { id: 'p', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: firstShader } },
            { id: 'g', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'AGiftForYou.frag' } },
        ],
        edges: [
            { id: 'sp', source: 'start', target: 'p', trigger: { type: 'time', durationSeconds: 0.1 } },
            { id: 'pg', source: 'p', target: 'g', trigger: { type: 'time', durationSeconds: 0.1 } },
        ],
    };
}

/** Drain the controller queue and the microtask-driven storage listener chain. */
async function drain(controller?: SceneController) {
    for (let i = 0; i < 8; i++) {
        await Promise.resolve();
        if (controller) await (controller as any)['queue'];
    }
}

function shaderWrites(): string[] {
    return shared.writes
        .filter(items => items && items[STATE_CURRENT_SHADER])
        .map(items => (items[STATE_CURRENT_SHADER] as ShaderObject).shaderName);
}

function resetTimeCalls(): any[] {
    return (browser.runtime.sendMessage as jest.Mock).mock.calls
        .filter(([msg]) => msg?.command === RESET_TIME);
}

async function setup(scenes: SceneGraph[], active: string | null, playing: boolean) {
    Object.assign(shared.store, {
        [STATE_SCENES]: scenes,
        [STATE_ACTIVE_SCENE_ID]: active,
        [STATE_SCENE_PLAYING]: playing,
        [STATE_SHADERINDEX]: 0,
        [STATE_CURRENT_SHADER]: makeShader('A.frag'),
    });
    const workerState = await makeWorkerState();
    const controller = new SceneController(workerState);
    await controller.initialize();
    await drain(controller);
    (controller as any)['stopTick']();
    shared.writes.length = 0;
    (browser.runtime.sendMessage as jest.Mock).mockClear();
    return controller;
}

describe('SceneController storage-wired switching', () => {
    beforeEach(() => {
        for (const k of Object.keys(shared.store)) delete shared.store[k];
        shared.listeners.length = 0;
        shared.writes.length = 0;
        jest.clearAllMocks();
        (global as any).fetch = jest.fn((url: string) => {
            if (typeof url === 'string' && url.includes('list.json')) {
                return Promise.resolve({ ok: true, json: () => ({
                    shaders: [
                        makeShader('A.frag'),
                        makeShader('B.frag'),
                        makeShader('ThePopularShader.frag'),
                        makeShader('ThePopularShader_forward.frag'),
                        makeShader('AGiftForYou.frag'),
                        makeShader('HabitablePlanet.frag'),
                        makeShader('Informer.frag'),
                    ],
                    lastModified: new Date(0)
                }) });
            }
            return Promise.resolve({ ok: false });
        });
    });

    afterEach(() => {
        (global as any).fetch = undefined;
    });

    (['keep', 'reset'] as const).forEach(mode => {
        describe(`play mode '${mode}'`, () => {
            it('switches A -> B -> A through the real storage listener', async () => {
                const a = sceneA();
                const b = sceneB();
                const controller = await setup([a, b], 'scene-a', true);

                await controller.tick({ time: 300 });
                await drain(controller);
                (controller as any)['stopTick']();

                await controller.playSceneById(b.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();
                expect((controller as any)['activeSceneId']).toBe('scene-b');
                expect(shaderWrites()).toContain('ThePopularShader.frag');
                if (mode === 'reset') {
                    expect(resetTimeCalls().length).toBeGreaterThanOrEqual(1);
                }

                shared.writes.length = 0;
                await controller.playSceneById(a.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();
                expect((controller as any)['activeSceneId']).toBe('scene-a');
                // Time edges measure elapsed SINCE NODE ENTRY, so the graph
                // re-enters at 'a' regardless of the clock, then advances.
                expect(shaderWrites()).toContain('A.frag');

                shared.writes.length = 0;
                await controller.tick({ time: mode === 'keep' ? 300.3 : 0.25 });
                await drain(controller);
                (controller as any)['stopTick']();
                expect(shaderWrites()).toContain('B.frag');
            });

            it('switch between scenes sharing the first shader writes no shader but still switches', async () => {
                const a = sceneA();
                const b = sceneB('A.frag'); // first node is also A.frag
                const controller = await setup([a, b], 'scene-a', true);

                await controller.tick({ time: 0.05 });
                await drain(controller);
                (controller as any)['stopTick']();
                shared.writes.length = 0;

                // A -> B: B's first node is A.frag, already displayed -> dedupe skip
                await controller.playSceneById(b.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();
                expect((controller as any)['activeSceneId']).toBe('scene-b');
                expect((controller as any)['currentNodeId']).toBe('p');
                expect(shaderWrites()).toHaveLength(0);

                // B -> A: same invisible switch back
                await controller.playSceneById(a.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();
                expect((controller as any)['activeSceneId']).toBe('scene-a');
                expect(shared.store[STATE_ACTIVE_SCENE_ID]).toBe('scene-a');
                expect(shaderWrites()).toHaveLength(0);

                // Next time edge on A still writes the correct node
                await controller.tick({ time: 0.25 });
                await drain(controller);
                (controller as any)['stopTick']();
                expect(shaderWrites()).toContain('B.frag');
            });

            it('re-pressing the active scene restarts without rewriting ACTIVE/PLAYING', async () => {
                const a = sceneA();
                const controller = await setup([a], 'scene-a', true);
                shared.writes.length = 0;
                (browser.runtime.sendMessage as jest.Mock).mockClear();

                await controller.playSceneById(a.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();

                const activeWrites = shared.writes.filter(i => STATE_ACTIVE_SCENE_ID in i);
                expect(activeWrites).toHaveLength(0);
                expect((controller as any)['activeSceneId']).toBe('scene-a');
                expect((controller as any)['currentNodeId']).toBe('a');
                if (mode === 'reset') {
                    expect(resetTimeCalls()).toHaveLength(1);
                } else {
                    expect(resetTimeCalls()).toHaveLength(0);
                }
            });

            it('playSceneById starts the pressed scene while stopped', async () => {
                const a = sceneA();
                const b = sceneB();
                const controller = await setup([a, b], 'scene-a', false);
                shared.writes.length = 0;

                await controller.playSceneById(b.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();

                expect((controller as any)['activeSceneId']).toBe('scene-b');
                expect((controller as any)['isPlaying']).toBe(true);
                expect(shared.store[STATE_SCENE_PLAYING]).toBe(true);
                expect(shaderWrites()).toContain('ThePopularShader.frag');
            });

            it('editor-style separate writes while stopped still start the pressed scene', async () => {
                const a = sceneA();
                const b = sceneB();
                const controller = await setup([a, b], 'scene-a', false);
                shared.writes.length = 0;

                await chromeLocal.set({ [STATE_ACTIVE_SCENE_ID]: 'scene-b' });
                await chromeLocal.set({ [STATE_SCENE_PLAYING]: true });
                await drain(controller);
                (controller as any)['stopTick']();

                expect((controller as any)['activeSceneId']).toBe('scene-b');
                expect((controller as any)['isPlaying']).toBe(true);
            });

            it('switching back after a stop starts the correct scene', async () => {
                const a = sceneA();
                const b = sceneB();
                const controller = await setup([a, b], 'scene-a', true);

                await controller.tick({ time: 0.05 });
                await drain(controller);
                (controller as any)['stopTick']();

                await controller.playSceneById(b.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();
                expect((controller as any)['activeSceneId']).toBe('scene-b');

                await controller.stopScene();
                await drain(controller);
                (controller as any)['stopTick']();
                expect((controller as any)['isPlaying']).toBe(false);

                await controller.playSceneById(a.id, mode);
                await drain(controller);
                (controller as any)['stopTick']();

                expect((controller as any)['activeSceneId']).toBe('scene-a');
                expect((controller as any)['isPlaying']).toBe(true);
                expect((controller as any)['currentNodeId']).not.toBeNull();
            });

            it('interleaved playSceneById + tick + repeat press converges on the target scene', async () => {
                const a = sceneA();
                const b = sceneB();
                const controller = await setup([a, b], 'scene-a', true);

                await controller.tick({ time: 300 });
                await drain(controller);
                (controller as any)['stopTick']();

                // No awaits between the calls — everything funnels through the queue.
                const p1 = controller.playSceneById(b.id, mode);
                const t = controller.tick({ time: 300.1 });
                const p2 = controller.playSceneById(b.id, mode);
                await p1;
                await t;
                await p2;
                await drain(controller);
                (controller as any)['stopTick']();

                expect((controller as any)['activeSceneId']).toBe('scene-b');
                expect((controller as any)['currentNodeId']).toBe('p');
            });
        });
    });
});
