(global as any).chrome = {
    runtime: { getManifest: jest.fn(() => ({ update_url: 'https://example.com' })) },
    storage: {
        onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
        local: {
            get: jest.fn((keys: string | string[], cb?: (result: any) => void) => {
                if (typeof cb === 'function') {
                    cb({});
                    return undefined;
                }
                return Promise.resolve({});
            }),
            set: jest.fn((items: any, cb?: () => void) => {
                if (typeof cb === 'function') cb();
                return Promise.resolve();
            }),
            remove: jest.fn(() => Promise.resolve()),
        }
    },
};

import { SceneController } from './sceneController';
import { getStorage, setStorage, setStorageMany } from '@src/storage/storage';
import { STATE_SCENES, STATE_ACTIVE_SCENE_ID, STATE_SCENE_PLAYING, STATE_SCENE_PLAY_MODE, STATE_CURRENT_SHADER, STATE_SHADERINDEX, STATE_SCENE_CURRENT_NODE_ID, STATE_SCENE_GRAPH_BEAT_COUNT, STATE_SCENE_NODE_START_TIME, STATE_SCENE_NODE_BEAT_COUNT, STATE_SCENE_CLOCK_PAUSED, STATE_SCENE_HOLD, STATE_OVERLAY } from '@src/storage/storageConstants';
import { RESET_TIME } from '@src/helpers/constants';
import browser from 'webextension-polyfill';
import * as fs from 'fs';
import * as path from 'path';
import type { SceneGraph, SceneNode, SceneEdge, ShaderObject } from '@src/helpers/types';
import type WorkerStateType from './workerState';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: {
            onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
            local: { set: jest.fn(() => Promise.resolve()), get: jest.fn(() => Promise.resolve({})) },
        },
        runtime: { sendMessage: jest.fn(() => Promise.resolve()), getURL: (path: string) => path },
    },
}));

jest.mock('@src/storage/storage', () => ({
    getStorage: jest.fn(),
    setStorage: jest.fn(() => Promise.resolve()),
    setStorageMany: jest.fn(() => Promise.resolve()),
}));

jest.mock('@src/storage/shaderDB', () => ({
    getImportedShadersDB: jest.fn(() => Promise.resolve({ shaders: [] })),
}));

jest.mock('@src/helpers/mediaControlRelay', () => ({
    relayMediaControl: jest.fn(() => Promise.resolve()),
}));

const mockedGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;
const mockedSetStorage = setStorage as jest.MockedFunction<typeof setStorage>;
const mockedSetStorageMany = setStorageMany as jest.MockedFunction<typeof setStorageMany>;

function currentShaderCalls() {
    return mockedSetStorage.mock.calls
        .filter(([key]) => key === STATE_CURRENT_SHADER)
        .map(([, value]) => (value as ShaderObject).shaderName);
}

const overlayWrites = () => mockedSetStorage.mock.calls.filter(([k]) => k === STATE_OVERLAY).map(([, v]) => v as any);

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

function makeScene(overrides?: Partial<SceneGraph>): SceneGraph {
    const start: SceneNode = { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} };
    const a: SceneNode = { id: 'a', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag' } };
    const b: SceneNode = { id: 'b', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'B.frag', uniformOverrides: { uColor: [1, 0, 0] } } };
    const startA: SceneEdge = { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0.1 } };
    const ab: SceneEdge = { id: 'ab', source: 'a', target: 'b', trigger: { type: 'time', durationSeconds: 0.1 } };
    return {
        id: 'scene-1',
        name: 'Test Scene',
        isLooping: false,
        nodes: [start, a, b],
        edges: [startA, ab],
        ...overrides,
    };
}

async function initWithDefaults(defaults: Record<string, any>) {
    mockedGetStorage.mockImplementation((key) => {
        if (key === STATE_CURRENT_SHADER && !(key in defaults)) {
            return Promise.resolve({ inlineCode: 'x' } as any);
        }
        return Promise.resolve(defaults[key as string]);
    });
    // Prevent WorkerState's async setup from writing A.frag during tests: return a
    // defined shader index and an existing inline shader so setShaderIndex preserves it.
    (global as any).chrome.storage.local.get.mockImplementation((keys: string | string[], cb?: (result: any) => void) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        const result: any = {};
        if (key === STATE_SHADERINDEX) result[STATE_SHADERINDEX] = 0;
        if (typeof cb === 'function') {
            cb(result);
            return undefined;
        }
        return Promise.resolve(result);
    });
    const workerState = await makeWorkerState();
    const controller = new SceneController(workerState);
    await controller.initialize();
    return { controller, workerState };
}

async function settle() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

function timeConditionScene(seconds: number): SceneGraph {
    return makeScene({
        isLooping: true,
        nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
            { id: 'c', type: 'condition', position: { x: 100, y: 0 }, data: { condition: { kind: 'time', seconds } } },
            { id: 'early', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'A.frag' } },
            { id: 'late', type: 'scene', position: { x: 200, y: 100 }, data: { shaderRef: 'B.frag' } },
        ],
        edges: [
            { id: 'sc', source: 'start', target: 'c', trigger: { type: 'time', durationSeconds: 0 } },
            { id: 'cf', source: 'c', target: 'early', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
            { id: 'ct', source: 'c', target: 'late', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
        ],
    });
}

describe('SceneController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        (global as any).chrome = (global as any).chrome || {};
        (global as any).chrome.storage = (global as any).chrome.storage || {};
        (global as any).chrome.storage.local = (global as any).chrome.storage.local || {};
        (global as any).chrome.storage.local.remove = jest.fn(() => Promise.resolve());
        (global as any).chrome.storage.local.set = jest.fn(() => Promise.resolve());
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

    it('does not switch shaders when no scene is playing', async () => {
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [],
            [STATE_ACTIVE_SCENE_ID]: null,
            [STATE_SCENE_PLAYING]: false,
        });
        expect(mockedSetStorage).not.toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.anything());
        controller['stopTick']();
    });

    it('activates the first scene node immediately and then transitions on time', async () => {
        const scene = makeScene();
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });

        // Allow the start->a activation to settle.
        await Promise.resolve();
        await Promise.resolve();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'A.frag' }));

        controller['stopTick']();
        await controller.tick(0.2);

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'B.frag' }));
        controller['stopTick']();
    });

    it('writes uniform overrides before switching shader', async () => {
        const scene = makeScene();
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await Promise.resolve();
        controller['stopTick']();

        await controller.tick(0.2);

        const uniformCall = mockedSetStorage.mock.calls.find(([key]) => key === 'customUniforms_B.frag');
        expect(uniformCall).toBeDefined();
        expect(uniformCall![1]).toEqual({ uColor: [1, 0, 0] });

        const shaderCall = mockedSetStorage.mock.calls.find(([key]) => key === STATE_CURRENT_SHADER);
        expect(shaderCall).toBeDefined();
        controller['stopTick']();
    });

    it('loops back to the start target when looping is enabled and the graph ends', async () => {
        const scene = makeScene({ isLooping: true });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await Promise.resolve();
        controller['stopTick']();

        // Transition A -> B
        await controller.tick(0.2);
        await settle();

        // At B, no outgoing edges and looping is enabled -> re-enter A
        // Wait for the paced restart (500 ms)
        await new Promise(r => setTimeout(r, 600));
        await settle();

        // Should have reached B and looped back to A at the end.
        expect(currentShaderCalls()).toContain('B.frag');
        expect(controller['currentNodeId']).toBe('a');
        controller['stopTick']();
    });

    it('advances on manual trigger', async () => {
        const scene = makeScene({
            edges: [
                { id: 'sa', source: 'start', target: 'a', trigger: { type: 'manual' } },
                { id: 'ab', source: 'a', target: 'b', trigger: { type: 'manual' } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await Promise.resolve();
        jest.clearAllMocks();

        await controller.manualAdvance();
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'B.frag' }));
        controller['stopTick']();
    });

    it('advances after enough beat triggers', async () => {
        const scene = makeScene({
            edges: [
                { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ab', source: 'a', target: 'b', trigger: { type: 'beat', beatCount: 3 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await Promise.resolve();
        jest.clearAllMocks();

        await controller.onBeat();
        await controller.onBeat();
        expect(currentShaderCalls()).toHaveLength(0);
        await controller.onBeat();
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'B.frag' }));
        controller['stopTick']();
    });

    it('advances when audio level exceeds threshold for hold time', async () => {
        const scene = makeScene({
            edges: [
                { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ab', source: 'a', target: 'b', trigger: { type: 'audio', threshold: 40, holdSeconds: 0.1 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await Promise.resolve();
        jest.clearAllMocks();
        controller['stopTick']();

        controller.onAudioLevel(50);
        await controller.tick(0);
        expect(mockedSetStorage).not.toHaveBeenCalled();

        // Hold time is measured in shader seconds — advance shader clock past 0.1.
        await controller.tick(0.2);

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'B.frag' }));
        controller['stopTick']();
    });

    it('pauses randomizer when a scene is playing', async () => {
        const scene = makeScene();
        const { controller, workerState } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        expect(workerState.scenePlaying).toBe(true);
        controller['stopTick']();
    });

    it('applies uniform overrides on the current shader without switching', async () => {
        const scene = makeScene({
            nodes: [
                { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                { id: 'u', type: 'uniform', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag', uniformOverrides: { uLevel: 0.5 } } },
            ],
            edges: [
                { id: 'su', source: 'start', target: 'u', trigger: { type: 'time', durationSeconds: 0 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
            [STATE_CURRENT_SHADER]: makeShader('A.frag'),
        });
        await settle();
        controller['stopTick']();

        const uniformCall = mockedSetStorage.mock.calls.find(([key]) => key === 'customUniforms_A.frag');
        expect(uniformCall).toBeDefined();
        expect(uniformCall![1]).toEqual({ uLevel: 0.5 });
        const shaderCalls = mockedSetStorage.mock.calls.filter(([key]) => key === STATE_CURRENT_SHADER);
        expect(shaderCalls).toHaveLength(0);
    });

    describe('uniform actions', () => {
        let controller: SceneController;
        let stored: Record<string, any>;

        const uniformNode = (shaderRef?: string, uniformOverrides: Record<string, any> = { uLevel: 0.5 }): SceneNode => ({
            id: 'uniform',
            type: 'uniform',
            position: { x: 0, y: 0 },
            data: { shaderRef, uniformOverrides },
        });

        beforeEach(async () => {
            stored = { [STATE_CURRENT_SHADER]: makeShader('A.frag') };
            const initialized = await initWithDefaults(stored);
            controller = initialized.controller;
            await settle();
            initialized.workerState.importedShaders = [{
                id: 'imported-id',
                mainShader: { filename: 'Imported.frag', meta: {}, code: 'void main(){}' },
                bufferShaders: [],
            }] as any;
            initialized.workerState.customShaders = [{
                ...makeShader('Custom.frag'), id: 'custom-id', createdAt: 0, updatedAt: 0,
            }];
            mockedSetStorage.mockImplementation(async (key, value) => {
                stored[key] = value;
                return value;
            });
            jest.clearAllMocks();
        });

        afterEach(() => {
            controller['stopTick']();
            mockedSetStorage.mockImplementation(() => Promise.resolve());
        });

        it.each([
            ['A.frag', 'A.frag'],
            ['imported-id', 'Imported.frag'],
            ['custom-id', 'Custom.frag'],
            [undefined, 'A.frag'],
        ])('resolves %s to %s without activating a shader', async (ref, filename) => {
            await controller['applyUniformNode'](uniformNode(ref));

            expect(mockedSetStorage.mock.calls).toEqual([[`customUniforms_${filename}`, { uLevel: 0.5 }]]);
            expect(browser.storage.local.set).not.toHaveBeenCalled();
            expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
        });

        it('does not fall back to the current shader for an unresolved explicit reference', async () => {
            await controller['applyUniformNode'](uniformNode('missing-id'));

            expect(mockedSetStorage).not.toHaveBeenCalled();
            expect(stored['customUniforms_A.frag']).toBeUndefined();
        });

        it('does nothing when neither a target nor a current shader exists', async () => {
            delete stored[STATE_CURRENT_SHADER];
            await controller['applyUniformNode'](uniformNode());

            expect(mockedSetStorage).not.toHaveBeenCalled();
        });

        it.each(['uniform', 'scene'] as const)('preserves successive partial overrides for %s nodes', async (type) => {
            stored['customUniforms_A.frag'] = { uColor: [1, 0, 0], uLevel: 1, uEnabled: true, uZero: 0, uFalse: false };
            const apply = async (overrides: Record<string, any>) => {
                const node = { ...uniformNode('A.frag', overrides), type };
                if (type === 'uniform') await controller['applyUniformNode'](node);
                else await controller['activateShaderNode'](node);
            };

            await apply({ uLevel: 0, uColor: undefined });
            await apply({ uEnabled: false });

            expect(stored['customUniforms_A.frag']).toEqual({
                uColor: [1, 0, 0], uLevel: 0, uEnabled: false, uZero: 0, uFalse: false,
            });
            expect(currentShaderCalls()).toEqual(type === 'scene' ? ['A.frag'] : []);
        });

        it.each([{}, { uLevel: undefined }])('does not write empty overrides: %j', async (overrides) => {
            await controller['applyUniformNode'](uniformNode('A.frag', overrides));
            await controller['activateShaderNode']({ ...uniformNode('A.frag', overrides), type: 'scene' });

            expect(mockedSetStorage.mock.calls.filter(([key]) => key.startsWith('customUniforms_'))).toEqual([]);
        });

        it('writes merged overrides before activating a shader', async () => {
            stored['customUniforms_A.frag'] = { uEnabled: false };
            await controller['activateShaderNode']({ ...uniformNode('A.frag'), type: 'scene' });

            expect(mockedSetStorage.mock.calls).toEqual([
                ['customUniforms_A.frag', { uEnabled: false, uLevel: 0.5 }],
                [STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'A.frag' })],
            ]);
        });
    });

    it('routes a condition node to the true edge when the condition is met', async () => {
        const scene = makeScene({
            nodes: [
                { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                { id: 'c', type: 'condition', position: { x: 100, y: 0 }, data: { condition: { kind: 'audio', operator: '>=', value: 40 } } },
                { id: 'a', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'A.frag' } },
                { id: 'b', type: 'scene', position: { x: 200, y: 100 }, data: { shaderRef: 'B.frag' } },
            ],
            edges: [
                { id: 'sc', source: 'start', target: 'c', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ct', source: 'c', target: 'a', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'cf', source: 'c', target: 'b', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await settle();
        controller['stopTick']();
        jest.clearAllMocks();

        // Conditions resolve eagerly at graph entry now — re-run the chain with
        // the new audio level via a seek back to the same time.
        controller.onAudioLevel(50);
        await controller.seek(0);
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'A.frag' }));
    });

    it('routes a condition node to the false edge when the condition is not met', async () => {
        const scene = makeScene({
            nodes: [
                { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                { id: 'c', type: 'condition', position: { x: 100, y: 0 }, data: { condition: { kind: 'audio', operator: '>=', value: 40 } } },
                { id: 'a', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'A.frag' } },
                { id: 'b', type: 'scene', position: { x: 200, y: 100 }, data: { shaderRef: 'B.frag' } },
            ],
            edges: [
                { id: 'sc', source: 'start', target: 'c', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ct', source: 'c', target: 'a', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'cf', source: 'c', target: 'b', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await Promise.resolve();
        controller['stopTick']();
        jest.clearAllMocks();

        controller.onAudioLevel(10);
        await controller.seek(0);
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'B.frag' }));
    });

    it('routes a time-based condition node to the false edge before the threshold and true edge after', async () => {
        const scene = makeScene({
            nodes: [
                { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                { id: 'c', type: 'condition', position: { x: 100, y: 0 }, data: { condition: { kind: 'time', seconds: 0.1 } } },
                { id: 'a', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'A.frag' } },
            ],
            edges: [
                { id: 'sc', source: 'start', target: 'c', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ct', source: 'c', target: 'a', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'cf', source: 'c', target: 'c', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await settle();
        controller['stopTick']();
        jest.clearAllMocks();

        // Before the threshold the false branch loops back to the condition node.
        await controller.tick(0);
        await settle();
        expect(currentShaderCalls()).toHaveLength(0);

        // Advance shader time past the threshold; true branch routes to A.frag.
        await controller.tick(0.2);
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'A.frag' }));
    });

    it('supports a uniform-based condition node', async () => {
        const scene = makeScene({
            nodes: [
                { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                { id: 'c', type: 'condition', position: { x: 100, y: 0 }, data: { condition: { kind: 'uniform', shaderRef: 'A.frag', name: 'uLevel', operator: '>', value: 0.4 } } },
                { id: 'a', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'A.frag' } },
                { id: 'b', type: 'scene', position: { x: 200, y: 100 }, data: { shaderRef: 'B.frag' } },
            ],
            edges: [
                { id: 'sc', source: 'start', target: 'c', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ct', source: 'c', target: 'a', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'cf', source: 'c', target: 'b', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
            'customUniforms_A.frag': { uLevel: 0.5 },
        });
        await Promise.resolve();
        controller['stopTick']();
        jest.clearAllMocks();

        // Conditions resolve eagerly at graph entry — re-run via seek to
        // observe the routing.
        await controller.seek(0);
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'A.frag' }));
    });

    it('auto-advances a scene node after its configured durationSeconds', async () => {
        const scene = makeScene({
            nodes: [
                { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                { id: 'a', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag', durationSeconds: 0.3 } },
                { id: 'b', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'B.frag' } },
            ],
            edges: [
                { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ab', source: 'a', target: 'b', trigger: { type: 'manual' } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await settle();
        controller['stopTick']();
        jest.clearAllMocks();

        await controller.tick(0);
        await settle();
        expect(currentShaderCalls()).toHaveLength(0);

        await controller.tick(0.4);
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'B.frag' }));
    });

    it('paces looping dead-end restarts and skips redundant same-shader writes', async () => {
        const scene = makeScene({
            edges: [
                { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
            ],
            isLooping: true,
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await Promise.resolve();
        controller['stopTick']();
        jest.clearAllMocks();

        // Wait past the paced restart delay (500 ms).
        await new Promise(r => setTimeout(r, 700));
        await Promise.resolve();

        // A is already active from init; the dead-end loop should not re-enter
        // the same node or hammer storage with redundant shader writes.
        expect(currentShaderCalls()).toHaveLength(0);
        expect(controller['currentNodeId']).toBe('a');
    });

    it('routes the exported user scene time condition: AGiftForYou first, then ThePopularShader_forward after the configured seconds', async () => {
        const exported = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'scene_p4ferj8be8amuvbnw2m.fixture.json'), 'utf-8'));
        const scene: SceneGraph = exported.scene;
        const conditionNode = scene.nodes.find(n => n.type === 'condition');
        const thresholdSeconds = (conditionNode?.data.condition as any)?.seconds || 1;
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
        });
        await settle();
        controller['stopTick']();

        // Below the threshold the chain resolves to the false branch at init.
        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'AGiftForYou.frag' }));
        jest.clearAllMocks();

        // Advance shader time past the configured condition threshold: the
        // clock jump re-enters the graph and resolves the chain in one tick.
        await controller.tick(thresholdSeconds + 0.2);
        await settle();

        expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'ThePopularShader_forward.frag' }));
        controller['stopTick']();
    });

    it('resumes from persisted node on service-worker restart without rewriting the active shader', async () => {
        const scene = makeScene({
            edges: [
                { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ab', source: 'a', target: 'b', trigger: { type: 'time', durationSeconds: 10 } },
            ],
        });
        const aShader = makeShader('A.frag');
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
            [STATE_CURRENT_SHADER]: aShader,
            [STATE_SCENE_CURRENT_NODE_ID]: 'a',
        });
        await settle();
        controller['stopTick']();
        jest.clearAllMocks();

        // Simulate a tick after restart: the scene should still be on node 'a'
        // and must not rewrite state.currentshader because A.frag is already active.
        await controller.tick();
        await settle();

        expect(controller['currentNodeId']).toBe('a');
        expect(currentShaderCalls()).toHaveLength(0);
    });

    it('falls back to the start node when the persisted node no longer exists', async () => {
        const scene = makeScene({
            edges: [
                { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                { id: 'ab', source: 'a', target: 'b', trigger: { type: 'time', durationSeconds: 10 } },
            ],
        });
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
            [STATE_SCENE_CURRENT_NODE_ID]: 'deleted-node',
        });
        await settle();
        controller['stopTick']();

        expect(controller['currentNodeId']).toBe('a');
    });

    it('clears persisted scene state when playback stops', async () => {
        const scene = makeScene();
        const { controller } = await initWithDefaults({
            [STATE_SCENES]: [scene],
            [STATE_ACTIVE_SCENE_ID]: scene.id,
            [STATE_SCENE_PLAYING]: true,
            [STATE_SCENE_CURRENT_NODE_ID]: 'a',
            [STATE_SCENE_NODE_START_TIME]: 1.5,
        });
        await settle();

        // Stop playback directly and verify cleanup.
        await controller['setActive'](scene.id, false);
        await settle();

        const removeCalls = ((global as any).chrome.storage.local.remove as jest.Mock).mock.calls;
        const removedKeys = removeCalls.length > 0 ? removeCalls[0][0] as string[] : [];
        expect(removedKeys).toContain(STATE_SCENE_CURRENT_NODE_ID);
        expect(removedKeys).toContain(STATE_SCENE_GRAPH_BEAT_COUNT);
        expect(removedKeys).toContain(STATE_SCENE_NODE_START_TIME);
        expect(removedKeys).toContain(STATE_SCENE_NODE_BEAT_COUNT);
        controller['stopTick']();
    });

    describe('shader-clock sync', () => {
        const resetTimeCalls = () =>
            (browser.runtime.sendMessage as jest.Mock).mock.calls.filter(([msg]) => msg?.command === RESET_TIME);



        it('If/Else time conditions compare against the absolute shader clock', async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            // Shader clock held at 0 (e.g. wait-for-audio) -> false branch
            // (already entered during init).
            await controller.tick(0);
            await settle();
            expect(controller['currentNodeId']).toBe('early');
            expect(currentShaderCalls()).toHaveLength(0);
            jest.clearAllMocks();

            // Still below the threshold: the >2s clock jump re-enters the
            // graph but lands on the same false branch.
            await controller.tick(4.9);
            await settle();
            expect(currentShaderCalls()).toEqual(['A.frag']);
            expect(controller['currentNodeId']).toBe('early');
            jest.clearAllMocks();

            // Crossing the threshold: the looping re-check re-enters the graph
            // and lands on the true branch in the same tick.
            await controller.tick(5.0);
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
            expect(controller['currentNodeId']).toBe('late');
        });

        it("timeSource 'iTime' conditions use iTime even when the renderer displays iAmplifiedTime", async () => {
            const scene = { ...timeConditionScene(5), timeSource: 'iTime' as const };
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            // Amplified clock is way past the threshold, but iTime is not.
            await controller.tick({ time: 50, iTime: 1, iAmplifiedTime: 50 });
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
            expect(controller['currentNodeId']).toBe('early');
            jest.clearAllMocks();

            // iTime crosses the threshold: the loop re-check re-enters the
            // graph and lands on the true branch in the same tick.
            await controller.tick({ time: 90, iTime: 5.1, iAmplifiedTime: 90 });
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
            expect(controller['currentNodeId']).toBe('late');
        });

        it("timeSource 'iAmplifiedTime' conditions use the amplified clock even when the renderer displays iTime", async () => {
            const scene = { ...timeConditionScene(5), timeSource: 'iAmplifiedTime' as const };
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.tick({ time: 1, iTime: 1, iAmplifiedTime: 6 });
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it("timeSource unset (auto) uses the displayed 'time' field", async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.tick({ time: 5, iTime: 1, iAmplifiedTime: 9 });
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it("explicit timeSource 'iTime' does not fall back to time when iTime is missing", async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                const scene = { ...timeConditionScene(5), timeSource: 'iTime' as const };
                const { controller } = await initWithDefaults({
                    [STATE_SCENES]: [scene],
                    [STATE_ACTIVE_SCENE_ID]: scene.id,
                    [STATE_SCENE_PLAYING]: true,
                    [STATE_SCENE_PLAY_MODE]: 'keep',
                });
                await settle();
                controller['stopTick']();
                jest.clearAllMocks();

                // iTime absent: clock is not updated, condition stays false even though `time` is past the threshold.
                await controller.tick({ time: 50 });
                await settle();
                expect(currentShaderCalls()).toHaveLength(0);
                expect(controller['currentNodeId']).toBe('early');
            } finally {
                warnSpy.mockRestore();
            }
        });

        it("timeSource delivered via storage listener takes effect", async () => {
            const scene = timeConditionScene(5); // auto
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            const listener = (browser.storage.onChanged.addListener as jest.Mock).mock.calls.pop()![0];
            jest.clearAllMocks();

            listener({ [STATE_SCENES]: { newValue: [{ ...scene, timeSource: 'iTime' }] } }, 'local');

            await controller.tick({ time: 50, iTime: 1, iAmplifiedTime: 50 });
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
            expect(controller['currentNodeId']).toBe('early');
        });

        it("gateOpened on SCENE_TICK resets shader clock and restarts the graph", async () => {
            const scene = { ...timeConditionScene(5), timeSource: 'iTime' as const };
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            // Clock past the threshold -> true branch (node 'late').
            await controller.tick({ time: 30, iTime: 30, iAmplifiedTime: 30 });
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
            jest.clearAllMocks();

            // Gate opens: clock restarts at ~0, graph re-enters the condition and takes the false branch.
            await controller.tick({ time: 0.1, iTime: 0.1, iAmplifiedTime: 0.1, gateOpened: true });
            await settle();
            expect(controller['lastShaderTime']).toBe(0.1);
            expect(currentShaderCalls()).toEqual(['A.frag']);
        });

        it("gateOpened while not playing is ignored without throwing", async () => {
            const scene = { ...timeConditionScene(5), timeSource: 'iTime' as const };
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: false,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await expect(controller.tick({ time: 0.1, iTime: 0.1, iAmplifiedTime: 0.1, gateOpened: true })).resolves.toBeUndefined();
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
        });

        it("STATE_SCENE_CLOCK_PAUSED freezes scene evaluation but keeps recording the clock", async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
                [STATE_SCENE_CLOCK_PAUSED]: true,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            // Past the threshold but paused: the condition never evaluates.
            await controller.tick({ time: 20, iTime: 20, iAmplifiedTime: 20 });
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
            expect(controller['lastShaderTime']).toBe(20);
        });

        it("STATE_SCENE_HOLD freezes scene evaluation while the clock runs", async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
                [STATE_SCENE_HOLD]: true,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.tick({ time: 20, iTime: 20, iAmplifiedTime: 20 });
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
            expect(controller['lastShaderTime']).toBe(20);
        });

        it("seek() jumps the shader clock and restarts the graph", async () => {
            const scene = timeConditionScene(10);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.seek(12);
            await settle();
            // After the seek the graph re-entered the condition; the next tick at 12 satisfies it.
            expect(controller['lastShaderTime']).toBe(12);
            await controller.tick({ time: 12, iTime: 12, iAmplifiedTime: 12 });
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it("seek() anchors node durations at the seeked time", async () => {
            const scene = makeScene({
                nodes: [
                    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                    { id: 'a', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag', durationSeconds: 3 } },
                    { id: 'b', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'B.frag' } },
                ],
                edges: [
                    { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'ab', source: 'a', target: 'b', trigger: { type: 'time', durationSeconds: 999 } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.seek(12);
            await settle();
            // 'a' was already activated during init — the dedup skips the rewrite.
            jest.clearAllMocks();

            // 1s elapsed since the seek: the 3s duration must not fire yet.
            await controller.tick({ time: 13, iTime: 13, iAmplifiedTime: 13 });
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);

            // 3s elapsed since the seek: auto-advance to 'b'.
            await controller.tick({ time: 15, iTime: 15, iAmplifiedTime: 15 });
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it("stopping the scene clears the clock-paused and hold keys", async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
                [STATE_SCENE_CLOCK_PAUSED]: true,
                [STATE_SCENE_HOLD]: true,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller['setActive'](scene.id, false);
            await settle();
            const removedKeys = ((global as any).chrome.storage.local.remove as jest.Mock).mock.calls.flatMap(c => c[0]);
            expect(removedKeys).toContain(STATE_SCENE_CLOCK_PAUSED);
            expect(removedKeys).toContain(STATE_SCENE_HOLD);
        });

        it("clock jumps re-enter the scene graph at the new position", async () => {
            const scene = timeConditionScene(10);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            // Init already resolved the chain at t=0 → 'early' / A.frag.

            await controller.tick({ time: 5, iTime: 5, iAmplifiedTime: 5 });
            await settle();
            expect(currentShaderCalls()).toEqual(['A.frag']);

            // Forward jump past the threshold: graph re-enters and the
            // condition resolves immediately on the same tick.
            await controller.tick({ time: 30, iTime: 30, iAmplifiedTime: 30 });
            await settle();
            expect(currentShaderCalls()).toEqual(['A.frag', 'B.frag']);
            expect(controller['lastShaderTime']).toBe(30);

            // Backward jump returns to the false-branch shader.
            await controller.tick({ time: 3, iTime: 3, iAmplifiedTime: 3 });
            await settle();
            expect(currentShaderCalls()).toEqual(['A.frag', 'B.frag', 'A.frag']);
        });

        it("small clock steps do not re-enter the graph", async () => {
            const scene = timeConditionScene(10);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();

            // Init wrote A.frag ('early'); small steps must not add more writes.
            for (const t of [5, 5.1, 5.6]) {
                await controller.tick({ time: t, iTime: t, iAmplifiedTime: t });
                await settle();
            }
            expect(currentShaderCalls()).toEqual(['A.frag']);
        });

        it("the first tick after a persisted resume never triggers a jump reset", async () => {
            const scene = makeScene({
                nodes: [
                    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                    { id: 'a', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag' } },
                    { id: 'b', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'B.frag' } },
                ],
                edges: [
                    { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'ab', source: 'a', target: 'b', trigger: { type: 'time', durationSeconds: 999 } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            // Simulate the SW having restored a mid-scene position, then a
            // huge first tick (clock ran while the worker slept).
            controller['nodeStartShaderTime'] = 1.5;
            await controller.tick({ time: 50, iTime: 50, iAmplifiedTime: 50 });
            await settle();
            // No resetGraph: the node start anchor is untouched.
            expect(controller['nodeStartShaderTime']).toBe(1.5);
            expect(controller['lastShaderTime']).toBe(50);
        });

        it("play mode 'keep' does not reset shader time, so a high shader clock satisfies the condition immediately", async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: false,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            jest.clearAllMocks();

            // Shader has been running for a while before the user presses "Keep time".
            await controller.tick(100);
            await controller['setActive'](scene.id, true);
            await settle();
            controller['stopTick']();

            expect(resetTimeCalls()).toHaveLength(0);
            await controller.tick(100.1);
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it("play mode 'reset' sends RESET_TIME and starts the scene at shader time 0", async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: false,
                [STATE_SCENE_PLAY_MODE]: 'reset',
            });
            await settle();
            jest.clearAllMocks();

            await controller.tick(100);
            await controller['setActive'](scene.id, true);
            await settle();
            controller['stopTick']();

            expect(resetTimeCalls()).toHaveLength(1);
            expect(controller['lastShaderTime']).toBe(0);

            // Content page acknowledges the reset by reporting a rewound clock.
            await controller.tick(0.05);
            await settle();
            expect(currentShaderCalls()).toEqual(['A.frag']);
        });

        it('does not send RESET_TIME when resuming after a service-worker restart', async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'reset',
                [STATE_SCENE_CURRENT_NODE_ID]: 'early',
                [STATE_CURRENT_SHADER]: makeShader('A.frag'),
            });
            await settle();
            controller['stopTick']();

            expect(resetTimeCalls()).toHaveLength(0);
            expect(controller['currentNodeId']).toBe('early');
        });

        it('switching to a different scene while playing restarts at the new scene start', async () => {
            const sceneA = makeScene({
                id: 'scene-a',
                edges: [
                    { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                ],
            });
            const sceneB = makeScene({
                id: 'scene-b',
                nodes: [
                    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                    { id: 'b', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'B.frag' } },
                ],
                edges: [
                    { id: 'sb', source: 'start', target: 'b', trigger: { type: 'time', durationSeconds: 0 } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [sceneA, sceneB],
                [STATE_ACTIVE_SCENE_ID]: sceneA.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'reset',
            });
            await settle();
            controller['stopTick']();
            expect(controller['currentNodeId']).toBe('a');
            jest.clearAllMocks();

            await controller['setActive'](sceneB.id, true);
            await settle();
            controller['stopTick']();

            expect(controller['currentNodeId']).toBe('b');
            expect(currentShaderCalls()).toEqual(['B.frag']);
            expect(resetTimeCalls()).toHaveLength(1);
        });

        it('restart() re-enters the start node and optionally rewinds shader time', async () => {
            const scene = makeScene({
                edges: [
                    { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'ab', source: 'a', target: 'b', trigger: { type: 'time', durationSeconds: 1 } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            await controller.tick(2);
            await settle();
            expect(controller['currentNodeId']).toBe('b');
            jest.clearAllMocks();

            await controller.restart('keep');
            await settle();
            expect(controller['currentNodeId']).toBe('a');
            expect(resetTimeCalls()).toHaveLength(0);

            await controller.restart('reset');
            await settle();
            expect(resetTimeCalls()).toHaveLength(1);
            expect(controller['lastShaderTime']).toBe(0);
        });

        it('per-node timing stays relative to node entry and restarts when the clock is rewound', async () => {
            const scene = makeScene({
                nodes: [
                    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                    { id: 'a', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag', durationSeconds: 2 } },
                    { id: 'b', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'B.frag' } },
                ],
                edges: [
                    { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'ab', source: 'a', target: 'b', trigger: { type: 'manual' } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: false,
            });
            await settle();
            // Node 'a' is entered at shader time 10 -> should advance at 12, not at 2.
            await controller.tick(10);
            await controller['setActive'](scene.id, true);
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.tick(11.5);
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);

            // User hits Reset Time: node hold restarts from the rewound clock.
            // (The >2s jump re-enters the graph and rewrites the active shader.)
            await controller.tick(0.5);
            await settle();
            expect(currentShaderCalls()).toEqual(['A.frag']);
            jest.clearAllMocks();
            await controller.tick(2.4);
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
            await controller.tick(2.6);
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });
    });

    describe('serialized chain evaluation', () => {
        it('a chain of 3 condition nodes resolves in a single tick', async () => {
            const scene = makeScene({
                isLooping: true,
                nodes: [
                    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                    { id: 'c1', type: 'condition', position: { x: 100, y: 0 }, data: { condition: { kind: 'time', seconds: 10 } } },
                    { id: 'c2', type: 'condition', position: { x: 200, y: 0 }, data: { condition: { kind: 'time', seconds: 20 } } },
                    { id: 'c3', type: 'condition', position: { x: 300, y: 0 }, data: { condition: { kind: 'time', seconds: 30 } } },
                    { id: 'a', type: 'scene', position: { x: 400, y: 0 }, data: { shaderRef: 'A.frag' } },
                    { id: 'b', type: 'scene', position: { x: 400, y: 100 }, data: { shaderRef: 'B.frag' } },
                ],
                edges: [
                    { id: 's1', source: 'start', target: 'c1', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'c1t', source: 'c1', target: 'c2', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'c1f', source: 'c1', target: 'a', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'c2t', source: 'c2', target: 'c3', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'c2f', source: 'c2', target: 'a', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'c3t', source: 'c3', target: 'b', sourceHandle: 'true', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'c3f', source: 'c3', target: 'a', sourceHandle: 'false', trigger: { type: 'time', durationSeconds: 0 } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.tick(35);
            await settle();
            expect(controller['currentNodeId']).toBe('b');
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it('5 concurrent ticks produce exactly one shader write', async () => {
            const scene = timeConditionScene(10);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await Promise.all(Array.from({ length: 5 }, () =>
                controller.tick({ time: 15, iTime: 15, iAmplifiedTime: 15 })));
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it('a looping terminal node is re-checked each tick but only written once when it flips', async () => {
            const scene = timeConditionScene(10);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            // Terminal 'early' node + looping: virtual re-check each tick, no writes.
            for (const t of [1, 2, 3]) {
                await controller.tick(t);
                await settle();
            }
            expect(currentShaderCalls()).toHaveLength(0);
            expect(controller['currentNodeId']).toBe('early');

            // Condition flips: exactly one write, lands on 'late'.
            await controller.tick(11);
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
            expect(controller['currentNodeId']).toBe('late');
        });

        it('seek forward then back lands on the right node in one call each', async () => {
            const scene = timeConditionScene(10);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();

            await controller.seek(15);
            await settle();
            expect(controller['currentNodeId']).toBe('late');

            await controller.seek(2);
            await settle();
            expect(controller['currentNodeId']).toBe('early');
        });

        it('after Stop, pending/late work performs no further state writes', async () => {
            const scene = timeConditionScene(5);
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller['setActive'](scene.id, false);
            await controller.tick(10); // stale tick racing the stop
            await settle();
            await Promise.resolve();

            expect(currentShaderCalls()).toHaveLength(0);
            const removed = ((global as any).chrome.storage.local.remove as jest.Mock).mock.calls.flatMap(c => c[0]);
            expect(removed).toContain(STATE_SCENE_CURRENT_NODE_ID);
        });

        it('audio-edge hold is measured from the threshold crossing', async () => {
            const scene = makeScene({
                nodes: [
                    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
                    { id: 'a', type: 'scene', position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag' } },
                    { id: 'b', type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef: 'B.frag' } },
                ],
                edges: [
                    { id: 'sa', source: 'start', target: 'a', trigger: { type: 'time', durationSeconds: 0 } },
                    { id: 'ab', source: 'a', target: 'b', trigger: { type: 'audio', threshold: 0.5, holdSeconds: 0.5 } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.tick(0.5);
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);

            // Level crosses at t=1: hold completes at 1.5, not 0.5.
            controller.onAudioLevel(0.8);
            await controller.tick(1.0);
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
            await controller.tick(1.4);
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);
            await controller.tick(1.5);
            await settle();
            expect(currentShaderCalls()).toEqual(['B.frag']);
        });

        it('the exported fixture scene resolves scrubs 3 → 70 → 20 → 65 correctly', async () => {
            const exported = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'scene_054tyii1tn0bmuwli9zx.fixture.json'), 'utf-8'));
            const scene: SceneGraph = exported.scene;
            const { controller, workerState } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_PLAY_MODE]: 'keep',
            });
            workerState.importedShaders = [{
                id: 'fXV3zy_1791286265795',
                mainShader: { filename: 'fXV3zy_1791286265795.frag', meta: {}, code: 'void main(){}' },
                bufferShaders: [],
            }] as any;
            await settle();
            controller['stopTick']();

            // Last shader write across both channels (builtin: setStorage, imported: storage.local.set).
            const lastWrite = () => {
                const builtin = currentShaderCalls();
                const imported = ((browser.storage.local.set as jest.Mock).mock.calls)
                    .filter(([o]: any[]) => o && o['state.currentshader'])
                    .map(([o]: any[]) => o['state.currentshader'].shaderName);
                return [...builtin, ...imported].pop();
            };

            await controller.tick(3);
            await settle();
            expect(lastWrite()).toBe('AGiftForYou.frag');
            jest.clearAllMocks();

            await controller.tick(70);
            await settle();
            expect(lastWrite()).toBe('HabitablePlanet.frag');
            jest.clearAllMocks();

            await controller.tick(20);
            await settle();
            expect(lastWrite()).toBe('fXV3zy_1791286265795.frag');
            jest.clearAllMocks();

            await controller.tick(65);
            await settle();
            expect(lastWrite()).toBe('HabitablePlanet.frag');
        });
    });

    describe('MIDI/joystick scene triggers', () => {
        it('playSceneById writes the storage keys that start the scene', async () => {
            const scene = makeScene();
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: null,
                [STATE_SCENE_PLAYING]: false,
            });
            await settle();
            jest.clearAllMocks();
            controller['stopTick']();

            await controller.playSceneById(scene.id);
            await settle();
            controller['stopTick']();

            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_SCENE_CLOCK_PAUSED, false);
            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_SCENE_PLAY_MODE, 'keep');
            expect(mockedSetStorageMany).toHaveBeenCalledWith(
                expect.objectContaining({ [STATE_ACTIVE_SCENE_ID]: scene.id, [STATE_SCENE_PLAYING]: true }));
        });

        it('playSceneById is a no-op for an unknown scene id', async () => {
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [makeScene()],
                [STATE_ACTIVE_SCENE_ID]: null,
                [STATE_SCENE_PLAYING]: false,
            });
            await settle();
            jest.clearAllMocks();
            controller['stopTick']();

            await controller.playSceneById('does-not-exist');
            await settle();

            expect(mockedSetStorage).not.toHaveBeenCalledWith(STATE_ACTIVE_SCENE_ID, expect.anything());
            expect(mockedSetStorage).not.toHaveBeenCalledWith(STATE_SCENE_PLAYING, expect.anything());
            expect(mockedSetStorageMany).not.toHaveBeenCalled();
            controller['stopTick']();
        });

        it('playSceneById keeps the shader clock: a time condition lands on the late node', async () => {
            const sceneA = timeConditionScene(60); // early=A.frag, late=B.frag
            sceneA.id = 'scene-1';
            const sceneB = makeScene({ id: 'scene-2' });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [sceneA, sceneB],
                [STATE_ACTIVE_SCENE_ID]: 'scene-2',
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();

            // Shader has been running for 300 s on scene B.
            await controller.tick(300);
            await settle();
            jest.clearAllMocks();

            await controller.playSceneById('scene-1');
            await settle();
            // Simulate the storage listener reacting to the ACTIVE/PLAYING writes.
            await controller['setActive']('scene-1', true);
            await settle();
            controller['stopTick']();

            expect((browser.runtime.sendMessage as jest.Mock).mock.calls
                .filter(([msg]) => msg?.command === RESET_TIME)).toHaveLength(0);
            expect(currentShaderCalls().pop()).toBe('B.frag');
            controller['stopTick']();
        });

        it('playSceneById on the already-playing scene restarts instead of rewriting the keys', async () => {
            const scene = makeScene();
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.playSceneById(scene.id, 'reset');
            await settle();
            controller['stopTick']();

            expect((browser.runtime.sendMessage as jest.Mock).mock.calls
                .filter(([msg]) => msg?.command === RESET_TIME)).toHaveLength(1);
            expect(mockedSetStorage).not.toHaveBeenCalledWith(STATE_ACTIVE_SCENE_ID, expect.anything());
            expect(mockedSetStorage).not.toHaveBeenCalledWith(STATE_SCENE_PLAYING, expect.anything());
            expect(mockedSetStorageMany).not.toHaveBeenCalled();
            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_SCENE_PLAY_MODE, 'reset');
        });

        it('stopScene writes PLAYING=false and CLOCK_PAUSED=false', async () => {
            const scene = makeScene();
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.stopScene();
            await settle();

            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_SCENE_PLAYING, false);
            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_SCENE_CLOCK_PAUSED, false);
            controller['stopTick']();
        });

        it('togglePause flips CLOCK_PAUSED only while playing', async () => {
            const scene = makeScene();
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
                [STATE_SCENE_CLOCK_PAUSED]: false,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.togglePause();
            await settle();
            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_SCENE_CLOCK_PAUSED, true);

            // Now stop and verify togglePause is a no-op
            await controller['setActive'](null, false);
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();
            await controller.togglePause();
            await settle();
            expect(mockedSetStorage).not.toHaveBeenCalledWith(STATE_SCENE_CLOCK_PAUSED, expect.anything());
            controller['stopTick']();
        });

        it('partial storage events fill the missing key from stored state, not stale controller state', async () => {
            const sceneA = makeScene({ id: 'scene-a' });
            const sceneB = makeScene({ id: 'scene-b' });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [sceneA, sceneB],
                [STATE_ACTIVE_SCENE_ID]: 'scene-a',
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            const listener = (browser.storage.onChanged.addListener as jest.Mock).mock.calls.pop()![0];
            jest.clearAllMocks();

            // Two back-to-back change events: the second one cannot fall back to
            // this.activeSceneId because the queued setActive hasn't run yet.
            listener({ [STATE_ACTIVE_SCENE_ID]: { newValue: 'scene-b' } }, 'local');
            listener({ [STATE_SCENE_PLAYING]: { newValue: true } }, 'local');
            await settle();
            await controller['queue'];
            await settle();
            controller['stopTick']();

            expect(controller['activeSceneId']).toBe('scene-b');
            expect(controller['isPlaying']).toBe(true);
            expect(controller['currentNodeId']).not.toBeNull();
            controller['stopTick']();
        });
    });

    describe('overlay nodes', () => {
        const startNode: SceneNode = { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} };
        const overlayNode = (data: SceneNode['data'], id = 'ov'): SceneNode =>
            ({ id, type: 'overlay', position: { x: 100, y: 0 }, data });
        const sceneNode = (id: string, shaderRef: string, extra: SceneNode['data'] = {}): SceneNode =>
            ({ id, type: 'scene', position: { x: 200, y: 0 }, data: { shaderRef, ...extra } });
        const timeEdge = (id: string, source: string, target: string, durationSeconds = 0): SceneEdge =>
            ({ id, source, target, trigger: { type: 'time', durationSeconds } });

        it('writes the overlay state when a show node is entered', async () => {
            const scene = makeScene({
                nodes: [
                    startNode,
                    overlayNode({ shaderRef: 'B.frag', overlayOpacity: 0.5, overlayBlendMode: 'normal' }),
                    sceneNode('a', 'A.frag'),
                ],
                edges: [
                    timeEdge('so', 'start', 'ov'),
                    timeEdge('oa', 'ov', 'a'),
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();

            const writes = overlayWrites();
            expect(writes[writes.length - 1]).toEqual({
                shader: expect.objectContaining({ shaderName: 'B.frag' }),
                opacity: 0.5,
                blendMode: 'normal',
            });
            // Overlay nodes are pass-through: the scene shader still activates.
            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'A.frag' }));
        });

        it('applies show-node defaults (opacity 1, additive blend)', async () => {
            const scene = makeScene({
                nodes: [
                    startNode,
                    overlayNode({ shaderRef: 'B.frag' }),
                    sceneNode('a', 'A.frag'),
                ],
                edges: [
                    timeEdge('so', 'start', 'ov'),
                    timeEdge('oa', 'ov', 'a'),
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();

            const writes = overlayWrites();
            expect(writes[writes.length - 1]).toEqual({
                shader: expect.objectContaining({ shaderName: 'B.frag' }),
                opacity: 1,
                blendMode: 'additive',
            });
        });

        it('hides the overlay when a hide node is entered', async () => {
            const scene = makeScene({
                nodes: [
                    startNode,
                    overlayNode({ shaderRef: 'B.frag' }, 'ov-show'),
                    sceneNode('a', 'A.frag'),
                    overlayNode({ overlayAction: 'hide' }, 'ov-hide'),
                    sceneNode('b', 'B.frag'),
                ],
                edges: [
                    timeEdge('so', 'start', 'ov-show'),
                    timeEdge('oa', 'ov-show', 'a'),
                    timeEdge('ah', 'a', 'ov-hide', 0.1),
                    timeEdge('hb', 'ov-hide', 'b'),
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            expect(overlayWrites()[overlayWrites().length - 1]).not.toBeNull();

            await controller.tick(0.2);
            await settle();

            expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            controller['stopTick']();
        });

        it('does not write redundant overlay state without overlay nodes', async () => {
            const scene = makeScene({
                edges: [
                    timeEdge('sa', 'start', 'a'),
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();

            // At most the initial null flush clears leftover state.
            expect(overlayWrites().length).toBeLessThanOrEqual(1);
            if (overlayWrites().length === 1) expect(overlayWrites()[0]).toBeNull();

            await controller.tick(0.1);
            await controller.tick(0.2);
            await controller.tick(0.3);
            await settle();

            expect(overlayWrites().length).toBeLessThanOrEqual(1);
            controller['stopTick']();
        });

        it('clears the overlay when playback stops', async () => {
            const scene = makeScene({
                nodes: [
                    startNode,
                    overlayNode({ shaderRef: 'B.frag' }),
                    sceneNode('a', 'A.frag'),
                ],
                edges: [
                    timeEdge('so', 'start', 'ov'),
                    timeEdge('oa', 'ov', 'a'),
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            expect(overlayWrites()[overlayWrites().length - 1]).not.toBeNull();

            await controller['setActive'](scene.id, false);
            await settle();

            expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            controller['stopTick']();
        });

        it('clears a stale overlay on restart when the start path has none', async () => {
            const scene = makeScene({
                nodes: [
                    startNode,
                    sceneNode('a', 'A.frag'),
                    overlayNode({ shaderRef: 'B.frag' }),
                    sceneNode('b', 'B.frag'),
                ],
                edges: [
                    timeEdge('sa', 'start', 'a'),
                    timeEdge('ao', 'a', 'ov', 0.1),
                    timeEdge('ob', 'ov', 'b'),
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();

            await controller.tick(0.2);
            await settle();
            expect(overlayWrites()[overlayWrites().length - 1]).not.toBeNull();

            // Restart re-enters from the start node: the overlay node is not on
            // the path until 0.1 s elapses again, so the overlay must clear.
            await controller.restart('keep');
            await settle();

            expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            controller['stopTick']();
        });

        it('auto-advances an overlay node after its configured durationSeconds', async () => {
            const scene = makeScene({
                nodes: [
                    startNode,
                    overlayNode({ shaderRef: 'B.frag', durationSeconds: 0.3 }),
                    sceneNode('a', 'A.frag'),
                ],
                edges: [
                    timeEdge('so', 'start', 'ov'),
                    { id: 'oa', source: 'ov', target: 'a', trigger: { type: 'manual' } },
                ],
            });
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [scene],
                [STATE_ACTIVE_SCENE_ID]: scene.id,
                [STATE_SCENE_PLAYING]: true,
            });
            await settle();
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.tick(0);
            await settle();
            expect(currentShaderCalls()).toHaveLength(0);

            await controller.tick(0.4);
            await settle();

            expect(mockedSetStorage).toHaveBeenCalledWith(STATE_CURRENT_SHADER, expect.objectContaining({ shaderName: 'A.frag' }));
            controller['stopTick']();
        });

        it('previewOverlay writes show/hide state and ignores unresolvable refs', async () => {
            const { controller } = await initWithDefaults({
                [STATE_SCENES]: [],
                [STATE_ACTIVE_SCENE_ID]: null,
                [STATE_SCENE_PLAYING]: false,
            });
            controller['stopTick']();
            jest.clearAllMocks();

            await controller.previewOverlay('B.frag', 0.3, 'additive');
            await settle();
            expect(overlayWrites()[overlayWrites().length - 1]).toEqual({
                shader: expect.objectContaining({ shaderName: 'B.frag' }),
                opacity: 0.3,
                blendMode: 'additive',
            });

            await controller.previewOverlay(null);
            await settle();
            expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();

            const writeCount = overlayWrites().length;
            await controller.previewOverlay('does-not-exist.frag', 0.5, 'normal');
            await settle();
            expect(overlayWrites().length).toBe(writeCount);
            controller['stopTick']();
        });

        describe('manual overlays', () => {
            const initIdle = () => initWithDefaults({
                [STATE_SCENES]: [],
                [STATE_ACTIVE_SCENE_ID]: null,
                [STATE_SCENE_PLAYING]: false,
            });

            it('show writes the manual overlay; release with the same ref writes null', async () => {
                const { controller } = await initIdle();
                controller['stopTick']();
                jest.clearAllMocks();

                await controller.manualOverlayAction({ action: 'show', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual({
                    shader: expect.objectContaining({ shaderName: 'A.frag' }),
                    opacity: 1,
                    blendMode: 'additive',
                });

                await controller.manualOverlayAction({ action: 'release', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            });

            it('release with a different ref does not change anything', async () => {
                const { controller } = await initIdle();
                controller['stopTick']();
                jest.clearAllMocks();

                await controller.manualOverlayAction({ action: 'show', shaderRef: 'A.frag' });
                const writeCount = overlayWrites().length;
                await controller.manualOverlayAction({ action: 'release', shaderRef: 'B.frag' });
                expect(overlayWrites().length).toBe(writeCount);
            });

            it('toggle shows then hides', async () => {
                const { controller } = await initIdle();
                controller['stopTick']();
                jest.clearAllMocks();

                await controller.manualOverlayAction({ action: 'toggle', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual(
                    expect.objectContaining({ shader: expect.objectContaining({ shaderName: 'A.frag' }) }));

                await controller.manualOverlayAction({ action: 'toggle', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            });

            it('a newer manual overlay survives the release of an older hold', async () => {
                const { controller } = await initIdle();
                controller['stopTick']();
                jest.clearAllMocks();

                await controller.manualOverlayAction({ action: 'show', shaderRef: 'A.frag' });
                await controller.manualOverlayAction({ action: 'show', shaderRef: 'B.frag' });
                await controller.manualOverlayAction({ action: 'release', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual(
                    expect.objectContaining({ shader: expect.objectContaining({ shaderName: 'B.frag' }) }));

                await controller.manualOverlayAction({ action: 'release', shaderRef: 'B.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            });

            it('releasing a manual overlay restores the scene overlay', async () => {
                const scene = makeScene({
                    nodes: [
                        startNode,
                        overlayNode({ shaderRef: 'B.frag' }),
                        sceneNode('a', 'A.frag'),
                    ],
                    edges: [
                        timeEdge('so', 'start', 'ov'),
                        timeEdge('oa', 'ov', 'a'),
                    ],
                });
                const { controller } = await initWithDefaults({
                    [STATE_SCENES]: [scene],
                    [STATE_ACTIVE_SCENE_ID]: scene.id,
                    [STATE_SCENE_PLAYING]: true,
                });
                await settle();
                controller['stopTick']();

                await controller.manualOverlayAction({ action: 'show', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual(
                    expect.objectContaining({ shader: expect.objectContaining({ shaderName: 'A.frag' }) }));

                await controller.manualOverlayAction({ action: 'release', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual(
                    expect.objectContaining({ shader: expect.objectContaining({ shaderName: 'B.frag' }) }));
            });

            it('a latched manual overlay survives scene stop', async () => {
                const scene = makeScene();
                const { controller } = await initWithDefaults({
                    [STATE_SCENES]: [scene],
                    [STATE_ACTIVE_SCENE_ID]: scene.id,
                    [STATE_SCENE_PLAYING]: true,
                });
                await settle();
                controller['stopTick']();

                await controller.manualOverlayAction({ action: 'toggle', shaderRef: 'A.frag' });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual(
                    expect.objectContaining({ shader: expect.objectContaining({ shaderName: 'A.frag' }) }));

                await controller['setActive'](scene.id, false);
                await settle();

                const last = overlayWrites()[overlayWrites().length - 1];
                expect(last?.shader?.shaderName).toBe('A.frag');
            });

            it('opacity shows, updates and hides the overlay', async () => {
                const { controller } = await initIdle();
                controller['stopTick']();
                jest.clearAllMocks();

                await controller.manualOverlayAction({ action: 'opacity', shaderRef: 'A.frag', opacity: 0.4 });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual(
                    expect.objectContaining({ shader: expect.objectContaining({ shaderName: 'A.frag' }), opacity: 0.4 }));

                await controller.manualOverlayAction({ action: 'opacity', shaderRef: 'A.frag', opacity: 0.8 });
                expect(overlayWrites()[overlayWrites().length - 1]).toEqual(
                    expect.objectContaining({ shader: expect.objectContaining({ shaderName: 'A.frag' }), opacity: 0.8 }));

                await controller.manualOverlayAction({ action: 'opacity', shaderRef: 'A.frag', opacity: 0 });
                expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            });

            it('hide clears any manual overlay', async () => {
                const { controller } = await initIdle();
                controller['stopTick']();
                jest.clearAllMocks();

                await controller.manualOverlayAction({ action: 'show', shaderRef: 'A.frag' });
                await controller.manualOverlayAction({ action: 'hide' });
                expect(overlayWrites()[overlayWrites().length - 1]).toBeNull();
            });

            it('show with an unresolvable ref produces no new write', async () => {
                const { controller } = await initIdle();
                controller['stopTick']();
                jest.clearAllMocks();

                await controller.manualOverlayAction({ action: 'show', shaderRef: 'does-not-exist.frag' });
                expect(overlayWrites().length).toBe(0);
            });
        });
    });
});
