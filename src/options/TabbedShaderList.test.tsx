import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import browser from 'webextension-polyfill';
import { saveCustomShader, deleteCustomShader, saveEditedImportedShader, deleteEditedImportedShader, CustomShader } from '@src/helpers/shaderStorage';
import type { ImportedShader, ShaderObject } from '@src/helpers/types';
import ShaderList from './ShaderList';
import TabbedShaderList from './TabbedShaderList';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: {
            local: { get: jest.fn(), set: jest.fn() },
            onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
        },
        runtime: { sendMessage: jest.fn().mockResolvedValue({ success: true, data: { shaders: [] } }) },
    },
}));
jest.mock('./ShaderList', () => ({ __esModule: true, default: () => null }));
jest.mock('./ImportedShadersTab', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/ShaderInfoModal', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/MediaTab', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/MidiTab', () => ({ __esModule: true, default: () => null }));

type StorageListener = Parameters<typeof browser.storage.onChanged.addListener>[0];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
let renderer: ReactTestRenderer;
let stored: Record<string, unknown>;
let listeners: Set<StorageListener>;
const onShaderEdit = jest.fn();

function makeShader(id: string): CustomShader {
    return {
        id,
        shaderName: `${id}.frag`,
        metaData: {
            shaderName: id, author: '', modifiedBy: '', url: '', license: '', shaderSpeed: 1,
            buffers: [{ shaderName: 'bufferA.frag', output: 0 }],
        },
        inlineCode: `void main() { gl_FragColor = vec4(0.0); }`,
        inlineBuffers: { 'bufferA.frag': 'void main() {}' },
        createdAt: 1,
        updatedAt: 1,
    };
}

function tabButton(label: string) {
    return renderer.root.findAllByType('button').find(node =>
        node.children.filter(child => typeof child === 'string' || typeof child === 'number').join('').includes(`${label} (`)
    )!;
}

function list(): React.ComponentProps<typeof ShaderList> {
    return renderer.root.findByType(ShaderList).props as React.ComponentProps<typeof ShaderList>;
}

async function openTab(label: string) {
    await act(async () => {
        renderer = create(<TabbedShaderList
            shaderCatalog={{ shaders: [], lastModified: new Date(0) }}
            shaderOptions={{}}
            selectedShaderIndex={0}
            onShaderSelected={jest.fn()}
            onVisiblityToggled={jest.fn()}
            onShaderInfoRequested={jest.fn()}
            onShaderEdit={onShaderEdit}
        />);
    });
    act(() => tabButton('Built-in Shaders').props.onClick());
    act(() => tabButton(label).props.onClick());
    expect(list().shaderCatalog.shaders).toHaveLength(2);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true, data: { shaders: [] } });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    listeners = new Set();
    stored = {
        'state.customtabs': ['bla'],
        'state.shadertabs': { first: ['bla'], second: ['bla'], third: ['bla'] },
        'state.customshaders': [makeShader('first'), makeShader('second')],
    };
    jest.mocked(browser.storage.local.get).mockImplementation(async () => clone(stored));
    jest.mocked(browser.storage.local.set).mockImplementation(async values => {
        const changes: Record<string, browser.Storage.StorageChange> = {};
        for (const key of Object.keys(values)) {
            changes[key] = { oldValue: stored[key], newValue: clone(values[key]) };
            stored[key] = clone(values[key]);
        }
        listeners.forEach(listener => listener(clone(changes), 'local'));
    });
    jest.mocked(browser.storage.onChanged.addListener).mockImplementation(listener => { listeners.add(listener); });
    jest.mocked(browser.storage.onChanged.removeListener).mockImplementation(listener => { listeners.delete(listener); });
});

afterEach(() => {
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
});

describe('custom shader storage refresh', () => {
    it.each(['bla', 'All Shaders'])('selects and reopens saved contents without leaving %s', async tab => {
        await openTab(tab);
        act(() => list().onShaderEdit!(0));
        expect(onShaderEdit).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'first' }), { isCustom: true, customId: 'first' });
        const updated: CustomShader = {
            ...makeShader('first'),
            inlineCode: 'void main() { gl_FragColor = vec4(1.0); }',
            inlineBuffers: { 'bufferA.frag': 'void main() { gl_FragColor = vec4(0.5); }' },
            metaData: { ...makeShader('first').metaData, description: 'Saved edit', shaderSpeed: 2 },
        };
        const assignments = clone(stored['state.shadertabs']);
        await act(async () => {
            await saveCustomShader(updated);
            await browser.storage.local.set({ 'state.currentshader': updated });
        });
        expect((stored['state.customshaders'] as CustomShader[])[0]).toMatchObject({ ...updated, updatedAt: expect.any(Number) });
        await act(async () => { await list().onShaderSelected(1); });
        await act(async () => { await list().onShaderSelected(0); });
        expect(stored['state.currentshader']).toMatchObject({
            customId: 'first', inlineCode: updated.inlineCode,
            inlineBuffers: updated.inlineBuffers, metaData: updated.metaData,
        });
        act(() => list().onShaderEdit!(0));
        expect(onShaderEdit).toHaveBeenLastCalledWith(expect.objectContaining({
            id: 'first', inlineCode: updated.inlineCode,
            inlineBuffers: updated.inlineBuffers, metaData: updated.metaData,
        }), { isCustom: true, customId: 'first' });
        expect(stored['state.shadertabs']).toEqual(assignments);
        expect(stored['state.customshaders']).toHaveLength(2);
    });

    it.each(['bla', 'All Shaders'])('updates additions, removals, and counts while %s stays open', async tab => {
        await openTab(tab);
        const assignments = clone(stored['state.shadertabs']);
        await act(async () => { await saveCustomShader(makeShader('third')); });
        expect(list().shaderCatalog.shaders).toHaveLength(3);
        expect(tabButton('Custom').children).toContain('3');
        expect(tabButton('bla').children).toContain('3');
        expect(tabButton('All Shaders').children).toContain('3');
        await act(async () => { await deleteCustomShader('third'); });
        expect(list().shaderCatalog.shaders).toHaveLength(2);
        expect(tabButton('Custom').children).toContain('2');
        expect(tabButton('bla').children).toContain('2');
        expect(tabButton('All Shaders').children).toContain('2');
        expect(stored['state.shadertabs']).toEqual(assignments);
    });
});

function makeImportedShader(id: string): ImportedShader {
    const shader = makeShader(id);
    return {
        id,
        shadertoyId: id,
        name: id,
        author: '',
        importDate: new Date(0).toISOString(),
        mainShader: { filename: shader.shaderName, code: shader.inlineCode!, meta: shader.metaData },
        bufferShaders: [{ filename: 'bufferA.frag', code: shader.inlineBuffers!['bufferA.frag'], meta: shader.metaData }],
    };
}

function importedEdit(): ShaderObject {
    const original = makeShader('first');
    return {
        shaderName: original.shaderName,
        inlineCode: 'void main() { gl_FragColor = vec4(1.0); }',
        inlineBuffers: { 'bufferA.frag': 'void main() { gl_FragColor = vec4(0.5); }' },
        metaData: { ...original.metaData, description: 'Saved imported edit', shaderSpeed: 2 },
    };
}

describe('imported shader selection from named tabs', () => {
    beforeEach(() => {
        const shaders = [makeImportedShader('first'), makeImportedShader('second')];
        stored = {
            'state.customtabs': ['deadline berlin'],
            'state.shadertabs': { first: ['deadline berlin'], second: ['deadline berlin'] },
            'state.importedshaders': { shaders },
        };
        jest.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true, data: { shaders } });
    });

    it('selects successive saved edits from the original assignment without leaving the tab', async () => {
        await openTab('deadline berlin');
        const originalImports = clone(stored['state.importedshaders']);
        const assignments = clone(stored['state.shadertabs']);
        for (const shaderSpeed of [2, 3]) {
            const updated = importedEdit();
            updated.metaData.shaderSpeed = shaderSpeed;
            await act(async () => {
                await saveEditedImportedShader('first', updated);
                await browser.storage.local.set({ 'state.currentshader': updated });
            });
            expect(list().shaderCatalog.shaders).toHaveLength(2);
            expect(tabButton('deadline berlin').children).toContain('2');
            expect(list().selectedShaderIndex).toBe(0);
            await act(async () => { await list().onShaderSelected(1); });
            await act(async () => { await list().onShaderSelected(0); });
            expect(stored['state.currentshader']).toEqual({ ...updated, importedId: 'first', isEdited: true });
            expect(list().selectedShaderIndex).toBe(0);
            act(() => list().onShaderEdit!(0));
            expect(onShaderEdit).toHaveBeenLastCalledWith(expect.objectContaining(updated), { importId: 'first' });
        }
        expect(stored['state.shadertabs']).toEqual(assignments);
        expect(stored['state.importedshaders']).toEqual(originalImports);
        expect(stored['state.customshaders']).toBeUndefined();
        expect(Object.keys(stored['state.editedimported'] as object)).toEqual(['first']);
    });

    it.each(['buffers', 'sampler', 'removed buffers'])('preserves %s-only edits when selecting and remounting', async change => {
        const original = makeShader('first');
        const updated: ShaderObject = {
            shaderName: original.shaderName,
            inlineCode: original.inlineCode,
            inlineBuffers: original.inlineBuffers,
            metaData: original.metaData,
        };
        if (change === 'buffers') updated.inlineBuffers = importedEdit().inlineBuffers;
        if (change === 'sampler') updated.metaData = {
            ...updated.metaData, iChannel0Sampler: { filter: 'nearest', wrap: 'repeat', vflip: false },
        };
        if (change === 'removed buffers') {
            updated.inlineBuffers = undefined;
            updated.metaData = { ...updated.metaData, buffers: undefined };
        }
        await saveEditedImportedShader('first', updated);
        await openTab('deadline berlin');
        await act(async () => { await list().onShaderSelected(0); });
        expect(stored['state.currentshader']).toMatchObject(clone(updated));
        expect((stored['state.currentshader'] as ShaderObject).inlineBuffers).toEqual(updated.inlineBuffers);
        act(() => renderer.unmount());
        await openTab('deadline berlin');
        await act(async () => { await list().onShaderSelected(1); });
        await act(async () => { await list().onShaderSelected(0); });
        expect(stored['state.currentshader']).toMatchObject(clone(updated));
        expect((stored['state.currentshader'] as ShaderObject).inlineBuffers).toEqual(updated.inlineBuffers);
        expect(list().selectedShaderIndex).toBe(0);
    });

    it('uses the original when unedited or when a saved edit has been removed', async () => {
        await openTab('deadline berlin');
        await act(async () => { await list().onShaderSelected(0); });
        expect(stored['state.currentshader']).toMatchObject({ inlineCode: makeShader('first').inlineCode });
        await act(async () => { await saveEditedImportedShader('first', importedEdit()); });
        await act(async () => { await list().onShaderSelected(0); });
        expect(stored['state.currentshader']).toMatchObject(importedEdit());
        await act(async () => { await deleteEditedImportedShader('first'); });
        await act(async () => { await list().onShaderSelected(0); });
        expect(stored['state.currentshader']).toMatchObject({
            inlineCode: makeShader('first').inlineCode,
            inlineBuffers: makeShader('first').inlineBuffers,
            metaData: makeShader('first').metaData,
        });
        expect(list().selectedShaderIndex).toBe(0);
    });

    it('retains explicitly assigned edited entries and selects one active row for shared assignments', async () => {
        await saveEditedImportedShader('first', importedEdit());
        stored['state.shadertabs'] = { 'edited:first': ['deadline berlin'], second: ['deadline berlin'] };
        await openTab('deadline berlin');
        const editedIndex = list().shaderCatalog.shaders.findIndex(shader => shader.shaderName === 'first.frag');
        await act(async () => { await list().onShaderSelected(editedIndex); });
        expect(stored['state.currentshader']).toMatchObject(importedEdit());
        expect(list().selectedShaderIndex).toBe(editedIndex);
        await act(async () => {
            await browser.storage.local.set({ 'state.shadertabs': {
                first: ['deadline berlin'], 'edited:first': ['deadline berlin'], second: ['deadline berlin'],
            } });
        });
        expect(list().shaderCatalog.shaders).toHaveLength(3);
        expect(list().selectedShaderIndex).toBe(0);
    });

    it('keeps original and edited selections distinct in All Shaders', async () => {
        await openTab('All Shaders');
        await act(async () => { await saveEditedImportedShader('first', importedEdit()); });
        await act(async () => { await list().onShaderSelected(0); });
        expect((stored['state.currentshader'] as ShaderObject).inlineCode).toBe(makeShader('first').inlineCode);
        expect(list().selectedShaderIndex).toBe(0);
        await act(async () => { await list().onShaderSelected(2); });
        expect(stored['state.currentshader']).toMatchObject(importedEdit());
        expect(list().selectedShaderIndex).toBe(2);
    });

    it('matches active imports by ID even when names and code are identical', async () => {
        const first = makeImportedShader('first');
        const second = { ...clone(first), id: 'second' };
        jest.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true, data: { shaders: [first, second] } });
        await saveEditedImportedShader('first', importedEdit());
        await saveEditedImportedShader('second', importedEdit());
        await openTab('deadline berlin');
        await act(async () => { await list().onShaderSelected(1); });
        expect(stored['state.currentshader']).toMatchObject({ ...importedEdit(), importedId: 'second' });
        expect(list().selectedShaderIndex).toBe(1);
    });
});
