import React from 'react';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import browser from 'webextension-polyfill';
import CodeMirror from '@uiw/react-codemirror';
import type { CustomShader } from '@src/helpers/shaderStorage';
import type { ImportedShader, ShaderObject, ShaderMetaData } from '@src/helpers/types';
import ShaderEditorModal from './ShaderEditorModal';
import TabbedShaderList from '../TabbedShaderList';
import ShaderList from '../ShaderList';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: {
            local: { get: jest.fn(), set: jest.fn() },
            onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
        },
        runtime: { getURL: (path: string) => path, sendMessage: jest.fn() },
    },
}));
jest.mock('@uiw/react-codemirror', () => ({ __esModule: true, default: () => null }));
jest.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }));
jest.mock('./AISidePanel', () => ({ __esModule: true, default: () => null }));
jest.mock('../ShaderList', () => ({ __esModule: true, default: () => null }));
jest.mock('../ImportedShadersTab', () => ({ __esModule: true, default: () => null }));
jest.mock('./ShaderInfoModal', () => ({ __esModule: true, default: () => null }));
jest.mock('./MediaTab', () => ({ __esModule: true, default: () => null }));
jest.mock('./MidiTab', () => ({ __esModule: true, default: () => null }));
jest.mock('@src/helpers/aiService', () => ({
    isAIAvailableWithRetry: jest.fn().mockResolvedValue(false),
    destroySession: jest.fn(),
}));
jest.mock('@src/helpers/customImageStorage', () => ({
    ...jest.requireActual('@src/helpers/customImageStorage'),
    getAllCustomImages: jest.fn().mockResolvedValue([]),
}));
jest.mock('@src/helpers/customVideoStorage', () => ({
    ...jest.requireActual('@src/helpers/customVideoStorage'),
    getAllCustomVideos: jest.fn().mockResolvedValue([]),
}));
jest.mock('@src/helpers/customCubemapStorage', () => ({
    ...jest.requireActual('@src/helpers/customCubemapStorage'),
    getAllCustomCubemaps: jest.fn().mockResolvedValue([]),
}));

const fontPath = 'images/otaviogood_shader_fontgen.png';
const fixtureMeta = JSON.parse(readFileSync(resolve(__dirname, '../../../dist/shaders/MirrorOnTheWallsAudio.frag.meta'), 'utf8'));
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let renderer: ReactTestRenderer | undefined;
let stored: Record<string, unknown>;

function makeShader(meta: Partial<ShaderMetaData> & { textureWrap?: string; textureFlipY?: boolean } = {}): ShaderObject {
    const metaData = { ...JSON.parse(JSON.stringify(fixtureMeta)), ...meta };
    return {
        shaderName: 'MirrorOnTheWallsAudio.frag',
        metaData,
        inlineCode: 'void main() { gl_FragColor = vec4(1.0); }',
        inlineBuffers: Object.fromEntries(metaData.buffers.map((buffer: { shaderName: string }) => [buffer.shaderName, 'void main() {}'])),
    };
}

async function openEditor(
    shader: ShaderObject,
    options: Pick<React.ComponentProps<typeof ShaderEditorModal>, 'isCustom' | 'customId' | 'importId'> = {}
) {
    await act(async () => {
        renderer = create(<ShaderEditorModal shaderObject={shader} isOpen onClose={() => undefined} {...options} />);
    });
}

function button(label: string): ReactTestInstance {
    return renderer!.root.findAllByType('button').find(node => node.children.includes(label))!;
}

function channel(index = 3): ReactTestInstance {
    return renderer!.root.findAllByType('label').find(node => node.children.includes(`iChannel${index}`))!.parent!;
}

async function save(andRun = true): Promise<ShaderObject> {
    await act(async () => {
        button(andRun ? 'Save and Run' : 'Save').props.onClick({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    });
    const edits = stored['state.editedshaders'] as Record<string, ShaderObject>;
    expect(edits).toBeDefined();
    const saved = edits['MirrorOnTheWallsAudio.frag'];
    if (andRun) expect(stored['state.currentshader']).toEqual({
        shaderName: saved.shaderName,
        inlineCode: saved.inlineCode,
        metaData: saved.metaData,
        inlineBuffers: saved.inlineBuffers,
    });
    else expect(stored['state.currentshader']).toBeUndefined();
    return saved;
}

beforeEach(() => {
    stored = {};
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
    const listeners = new Set<Parameters<typeof browser.storage.onChanged.addListener>[0]>();
    jest.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true, data: { shaders: [] } });
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
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        addEventListener: jest.fn(), removeEventListener: jest.fn(), hasFocus: () => true,
    } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        addEventListener: jest.fn(), removeEventListener: jest.fn(),
    } });
});

afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
    for (const [key, descriptor] of [['document', originalDocument], ['window', originalWindow]] as const) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
});

describe('shader editor sampler preservation', () => {
    it.each([false, true])('preserves inherited font sampling on untouched save (andRun=%s)', async andRun => {
        const shader = makeShader();
        await openEditor(shader);
        const saved = await save(andRun);
        expect(saved.metaData.iChannel3).toBe(fontPath);
        expect(saved.metaData.iChannel3Sampler).toBeUndefined();
        expect(saved.metaData).toMatchObject({ textureWrap: 'repeat' });
        expect(saved.inlineCode).toBe(shader.inlineCode);
        expect(saved.inlineBuffers).toEqual(shader.inlineBuffers);
    });

    it('displays renderer defaults without introducing an override', async () => {
        await openEditor(makeShader());
        const selects = channel().findAllByType('select');
        expect(selects.map(select => select.props.value)).toEqual([fontPath, 'linear', 'repeat']);
        expect(channel().findByType('input').props.checked).toBe(true);
    });

    it('retains inherited orientation and wrap when only the filter changes', async () => {
        await openEditor(makeShader());
        act(() => channel().findAllByType('select')[1].props.onChange({ target: { value: 'nearest' } }));
        expect((await save()).metaData.iChannel3Sampler).toEqual({ filter: 'nearest', wrap: 'repeat', vflip: true });
    });

    it('saves a VFlip-only correction without changing the shader code', async () => {
        const shader = makeShader({ iChannel3Sampler: { filter: 'linear', wrap: 'repeat', vflip: false } });
        await openEditor(shader);
        act(() => channel().findByType('input').props.onChange({ target: { checked: true } }));
        const saved = await save();
        expect(saved.metaData.iChannel3Sampler).toEqual({ filter: 'linear', wrap: 'repeat', vflip: true });
        expect(saved.inlineCode).toBe(shader.inlineCode);
    });

    it('inherits defaults when assigning the font to an empty channel', async () => {
        await openEditor(makeShader({ iChannel3: undefined }));
        act(() => channel().findAllByType('select')[0].props.onChange({ target: { value: fontPath } }));
        expect(channel().findByType('input').props.checked).toBe(true);
        expect((await save()).metaData.iChannel3Sampler).toBeUndefined();
    });

    it('honors global false and default clamp when changing one setting', async () => {
        await openEditor(makeShader({ textureWrap: undefined, textureFlipY: false }));
        expect(channel().findByType('input').props.checked).toBe(false);
        act(() => channel().findAllByType('select')[1].props.onChange({ target: { value: 'mipmap' } }));
        expect((await save()).metaData.iChannel3Sampler).toEqual({ filter: 'mipmap', wrap: 'clamp', vflip: false });
    });

    it.each(['nearest', 'mipmap'] as const)('preserves explicit %s/clamp/false settings', async filter => {
        const sampler = { filter, wrap: 'clamp' as const, vflip: false };
        await openEditor(makeShader({ iChannel3Sampler: sampler }));
        expect(channel().findByType('input').props.checked).toBe(false);
        expect((await save()).metaData.iChannel3Sampler).toEqual(sampler);
    });

    it('does not introduce overrides when reselecting a texture', async () => {
        await openEditor(makeShader());
        act(() => channel().findAllByType('select')[0].props.onChange({ target: { value: fontPath } }));
        expect((await save()).metaData.iChannel3Sampler).toBeUndefined();
    });

    it('clears sampler settings when switching to a non-texture input', async () => {
        await openEditor(makeShader({ iChannel3Sampler: { filter: 'nearest', wrap: 'repeat', vflip: true } }));
        act(() => channel().findAllByType('select')[0].props.onChange({ target: { value: 'audio' } }));
        const saved = await save();
        expect(saved.metaData.iChannel3).toBe('audio');
        expect(saved.metaData.iChannel3Sampler).toBeUndefined();
    });

    it('preserves inherited and explicit sampler settings in buffer passes', async () => {
        const explicit = { filter: 'mipmap' as const, wrap: 'clamp' as const, vflip: false };
        const shader = makeShader();
        shader.metaData.buffers![0].iChannel3 = fontPath;
        shader.metaData.buffers![1].iChannel3 = fontPath;
        shader.metaData.buffers![1].iChannel3Sampler = explicit;
        await openEditor(shader);
        const saved = await save();
        expect(saved.metaData.buffers![0].iChannel3Sampler).toBeUndefined();
        expect(saved.metaData.buffers![1].iChannel3Sampler).toEqual(explicit);
    });
});

describe('same-name Custom shader saves', () => {
    it.each([false, true])('updates the existing Custom record by ID (andRun=%s)', async andRun => {
        const shader: CustomShader = { ...makeShader(), id: 'custom_copy', createdAt: 1, updatedAt: 1 };
        const other: CustomShader = { ...makeShader(), id: 'custom_other', createdAt: 1, updatedAt: 1 };
        stored['state.customshaders'] = [shader, other];
        stored['state.shadertabs'] = { custom_copy: ['bla'], custom_other: ['bla'] };
        await openEditor(shader, { isCustom: true, customId: shader.id });
        const imageCode = 'void main() { gl_FragColor = vec4(0.5); }';
        const bufferCode = 'void main() { gl_FragColor = vec4(0.25); }';
        act(() => renderer!.root.findByType(CodeMirror).props.onChange(imageCode));
        act(() => button('Buffer A').props.onClick());
        act(() => renderer!.root.findByType(CodeMirror).props.onChange(bufferCode));
        act(() => renderer!.root.findByProps({ placeholder: 'Describe your shader...' }).props.onChange({
            target: { value: 'Updated saved copy' },
        }));
        await act(async () => {
            button(andRun ? 'Save and Run' : 'Save').props.onClick({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
        });
        const savedShaders = stored['state.customshaders'] as CustomShader[];
        expect(savedShaders).toHaveLength(2);
        const saved = savedShaders.find(item => item.id === shader.id)!;
        expect(saved.inlineCode).toBe(imageCode);
        expect(saved.inlineBuffers![shader.metaData.buffers![0].shaderName]).toBe(bufferCode);
        expect(saved.metaData.description).toBe('Updated saved copy');
        expect(saved.metaData.shaderName).toBe(shader.metaData.shaderName);
        expect(savedShaders[1]).toEqual(other);
        expect(stored['state.editedshaders']).toBeUndefined();
        expect(stored['state.editedimported']).toBeUndefined();
        expect(stored['state.shadertabs']).toEqual({ custom_copy: ['bla'], custom_other: ['bla'] });
        if (andRun) expect(stored['state.currentshader']).toMatchObject({
            inlineCode: saved.inlineCode, inlineBuffers: saved.inlineBuffers, metaData: saved.metaData,
        });
        else expect(stored['state.currentshader']).toBeUndefined();
    });
});

function ImportedEditorWorkflow() {
    const [editor, setEditor] = React.useState<{ shader: ShaderObject | null; importId?: string } | null>(null);
    const catalog = React.useMemo(() => ({ shaders: [], lastModified: new Date(0) }), []);
    return <>
        <TabbedShaderList
            shaderCatalog={catalog}
            shaderOptions={{}}
            selectedShaderIndex={0}
            onShaderSelected={() => undefined}
            onVisiblityToggled={() => undefined}
            onShaderInfoRequested={() => undefined}
            onShaderEdit={(shader, options) => setEditor({ shader, importId: options?.importId })}
        />
        {editor && <ShaderEditorModal
            shaderObject={editor.shader}
            importId={editor.importId}
            isOpen
            onClose={() => setEditor(null)}
        />}
    </>;
}

describe('imported editor saves followed by named-tab selection', () => {
    it.each([false, true])('runs the saved edit after switching away and back (andRun=%s)', async andRun => {
        const shader = makeShader();
        const imported: ImportedShader = {
            id: 'shadertoy-import',
            shadertoyId: 'fixture',
            name: shader.metaData.shaderName,
            author: '',
            importDate: new Date(0).toISOString(),
            mainShader: { filename: shader.shaderName, code: shader.inlineCode!, meta: shader.metaData },
            bufferShaders: Object.entries(shader.inlineBuffers!).map(([filename, code]) => ({ filename, code, meta: shader.metaData })),
        };
        const other: ImportedShader = {
            ...imported, id: 'other-import',
            mainShader: { ...imported.mainShader, filename: 'Other.frag', code: 'void main() { gl_FragColor = vec4(0.0); }' },
        };
        stored['state.importedshaders'] = { shaders: [imported, other] };
        stored['state.customtabs'] = ['deadline berlin'];
        stored['state.shadertabs'] = { [imported.id]: ['deadline berlin'], [other.id]: ['deadline berlin'] };
        const originalImports = JSON.parse(JSON.stringify(stored['state.importedshaders']));
        const assignments = JSON.parse(JSON.stringify(stored['state.shadertabs']));
        jest.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true, data: { shaders: [imported, other] } });
        await act(async () => { renderer = create(<ImportedEditorWorkflow />); });
        act(() => renderer!.root.findAllByType('button').find(node =>
            node.children.filter(child => typeof child === 'string' || typeof child === 'number').join('').includes('deadline berlin (')
        )!.props.onClick());
        const list = () => renderer!.root.findByType(ShaderList).props as React.ComponentProps<typeof ShaderList>;
        await act(async () => { list().onShaderEdit!(0); });
        expect(renderer!.root.findByType(ShaderEditorModal).props.importId).toBe(imported.id);
        const imageCode = 'void main() { gl_FragColor = vec4(0.6); }';
        const bufferCode = 'void main() { gl_FragColor = vec4(0.3); }';
        act(() => renderer!.root.findByType(CodeMirror).props.onChange(imageCode));
        act(() => channel().findByType('input').props.onChange({ target: { checked: false } }));
        act(() => button('Buffer A').props.onClick());
        act(() => renderer!.root.findByType(CodeMirror).props.onChange(bufferCode));
        act(() => renderer!.root.findByProps({ placeholder: 'Describe your shader...' }).props.onChange({
            target: { value: 'Saved from deadline berlin' },
        }));
        await act(async () => {
            button(andRun ? 'Save and Run' : 'Save').props.onClick({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
        });
        const saved = (stored['state.editedimported'] as Record<string, ShaderObject>)[imported.id];
        const renderContent = {
            shaderName: saved.shaderName, inlineCode: saved.inlineCode,
            inlineBuffers: saved.inlineBuffers, metaData: saved.metaData,
        };
        expect(saved.inlineCode).toBe(imageCode);
        expect(saved.inlineBuffers![shader.metaData.buffers![0].shaderName]).toBe(bufferCode);
        expect(saved.metaData.description).toBe('Saved from deadline berlin');
        expect(saved.metaData.iChannel3Sampler?.vflip).toBe(false);
        if (andRun) expect(stored['state.currentshader']).toEqual(renderContent);
        else expect(stored['state.currentshader']).toBeUndefined();
        act(() => renderer!.root.findByType(ShaderEditorModal).props.onClose());
        expect(list().shaderCatalog.shaders).toHaveLength(2);
        await act(async () => { await list().onShaderSelected(1); });
        await act(async () => { await list().onShaderSelected(0); });
        expect(stored['state.currentshader']).toEqual({ ...renderContent, importedId: imported.id, isEdited: true });
        expect(list().selectedShaderIndex).toBe(0);
        await act(async () => { list().onShaderEdit!(0); });
        expect(renderer!.root.findByType(CodeMirror).props.value).toBe(imageCode);
        expect(channel().findByType('input').props.checked).toBe(false);
        act(() => button('Buffer A').props.onClick());
        expect(renderer!.root.findByType(CodeMirror).props.value).toBe(bufferCode);
        expect(stored['state.importedshaders']).toEqual(originalImports);
        expect(stored['state.shadertabs']).toEqual(assignments);
        expect(stored['state.customshaders']).toBeUndefined();
        expect(stored['state.editedshaders']).toBeUndefined();
        expect(Object.keys(stored['state.editedimported'] as object)).toEqual([imported.id]);
    });
});
