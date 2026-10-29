import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import browser from 'webextension-polyfill';
import type { SceneGraph, SceneNode, ShaderCatalog, ShaderMetaData } from '@src/helpers/types';
import { STATE_SCENES, STATE_ACTIVE_SCENE_ID } from '@src/storage/storageConstants';
import SceneEditor from './SceneEditor';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: {
            local: { get: jest.fn(), set: jest.fn() },
            onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
        },
        runtime: {
            sendMessage: jest.fn(),
            onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
        },
    },
}));
jest.mock('@eamonwoortman/use-chrome-storage', () => ({
    useChromeStorageLocal: (_key: string, initial: unknown) => require('react').useState(initial),
}));
jest.mock('@xyflow/react', () => {
    const React = require('react');
    const useGraphState = (initial: unknown) => [...React.useState(initial), jest.fn()];
    return {
        ReactFlow: ({ nodes, nodeTypes, children }: any) => React.createElement('div', null,
            ...nodes.map((node: any) => React.createElement('div', { key: node.id, 'data-scene-node': node.id },
                React.createElement(nodeTypes[node.type], { id: node.id, data: node.data }))),
            children),
        useNodesState: useGraphState,
        useEdgesState: useGraphState,
        addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
        Handle: () => null,
        Background: () => null,
        Controls: () => null,
        MiniMap: () => null,
        Position: { Left: 'left', Right: 'right' },
    };
});
jest.mock('./SceneTransportBar', () => ({ __esModule: true, default: () => null }));
jest.mock('@src/storage/shaderDB', () => ({}));
jest.mock('@src/storage/storage', () => ({ setStorageMany: jest.fn() }));
jest.mock('@src/helpers/scenePackage', () => ({}));
jest.mock('@src/helpers/shaderStorage', () => ({
    getAllEditedShaders: jest.fn(async () => ({})),
}));

const meta: ShaderMetaData = {
    shaderName: 'A', author: '', modifiedBy: '', url: '', license: '', shaderSpeed: 1,
    customUniforms: [
        { name: 'uLevel', label: 'uLevel', type: 'float', default: 0.25 },
        { name: 'uEnabled', label: 'uEnabled', type: 'bool', default: false },
        { name: 'uColor', label: 'uColor', type: 'vec3', default: [1, 0, 0] },
    ],
};
const catalog: ShaderCatalog = {
    shaders: [{ shaderName: 'A.frag', metaData: meta }, { shaderName: 'B.frag', metaData: meta }],
    lastModified: new Date(0),
};
const originalFetch = globalThis.fetch;
let renderer: ReactTestRenderer;
let stored: Record<string, any>;

async function openEditor(type: 'scene' | 'uniform', data: SceneNode['data'] = {}) {
    const scene: SceneGraph = {
        id: 'test-scene',
        name: 'Test scene',
        isLooping: false,
        nodes: [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
            { id: 'target', type, position: { x: 100, y: 0 }, data: { shaderRef: 'A.frag', ...data } },
        ],
        edges: [{ id: 'edge', source: 'start', target: 'target', trigger: { type: 'time', durationSeconds: 0 } }],
    };
    stored[STATE_SCENES] = [scene];
    stored[STATE_ACTIVE_SCENE_ID] = scene.id;
    await act(async () => {
        renderer = create(<SceneEditor shaderCatalog={catalog} />);
    });
}

function node() {
    return renderer.root.findByProps({ 'data-scene-node': 'target' });
}

function override(name: string) {
    return node().findByProps({ 'aria-label': `Apply ${name}` });
}

async function save() {
    await act(async () => {
        jest.advanceTimersByTime(500);
    });
    return (stored[STATE_SCENES] as SceneGraph[])[0].nodes.find(n => n.id === 'target')!.data;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    stored = {};
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false });
    jest.mocked(browser.runtime.sendMessage).mockResolvedValue({ data: { shaders: [] } });
    jest.mocked(browser.storage.local.get).mockImplementation(async () => JSON.parse(JSON.stringify(stored)));
    jest.mocked(browser.storage.local.set).mockImplementation(async (items) => {
        Object.assign(stored, JSON.parse(JSON.stringify(items)));
    });
});

afterEach(() => {
    act(() => renderer?.unmount());
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
});

it('persists a scene duration through editing and reopening', async () => {
    await openEditor('scene', { durationSeconds: 3 });
    await act(async () => {
        node().findByProps({ placeholder: 'auto-advance' }).props.onChange({ target: { value: '7.5' } });
    });
    expect((await save()).durationSeconds).toBe(7.5);

    act(() => renderer.unmount());
    await act(async () => {
        renderer = create(<SceneEditor shaderCatalog={catalog} />);
    });
    expect(node().findByProps({ placeholder: 'auto-advance' }).props.value).toBe(7.5);

    await act(async () => {
        node().findByProps({ placeholder: 'auto-advance' }).props.onChange({ target: { value: '' } });
    });
    expect((await save()).durationSeconds).toBeUndefined();
});

describe.each(['scene', 'uniform'] as const)('%s node overrides', (type) => {
    it('leaves unset uniforms unchanged until explicitly enabled', async () => {
        await openEditor(type);
        expect(override('uLevel').props.checked).toBe(false);
        expect(node().findAllByType('fieldset')[0].props.disabled).toBe(true);

        await act(async () => {
            override('uLevel').props.onChange({ target: { checked: true } });
        });
        expect((await save()).uniformOverrides).toEqual({ uLevel: 0.25 });

        await act(async () => {
            node().findAllByType('input').find(input => input.props.type === 'number' && input.props.step === 0.01)!
                .props.onChange({ target: { value: '0' } });
        });
        expect((await save()).uniformOverrides).toEqual({ uLevel: 0 });

        await act(async () => {
            override('uLevel').props.onChange({ target: { checked: false } });
        });
        expect((await save()).uniformOverrides).toEqual({});
    });

    it('enables existing false, zero, and vector overrides without changing them', async () => {
        const uniformOverrides = { uLevel: 0, uEnabled: false, uColor: [0, 1, 0] };
        await openEditor(type, { uniformOverrides });
        for (const name of Object.keys(uniformOverrides)) {
            expect(override(name).props.checked).toBe(true);
        }
        expect((await save()).uniformOverrides).toEqual(uniformOverrides);
    });

    it('can explicitly apply boolean and vector defaults', async () => {
        await openEditor(type);
        await act(async () => {
            override('uEnabled').props.onChange({ target: { checked: true } });
        });
        await act(async () => {
            override('uColor').props.onChange({ target: { checked: true } });
        });
        expect((await save()).uniformOverrides).toEqual({ uEnabled: false, uColor: [1, 0, 0] });
    });

    it('clears stale overrides when selecting another shader', async () => {
        await openEditor(type, { uniformOverrides: { uLevel: 0.9 } });
        await act(async () => {
            node().findByType('select').props.onChange({ target: { value: 'B.frag' } });
        });
        const data = await save();
        expect(data.shaderRef).toBe('B.frag');
        expect(data.uniformOverrides).toEqual({});
    });
});
