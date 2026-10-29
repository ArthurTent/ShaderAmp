import JSZip from 'jszip';
import {
    SCENE_PACKAGE_VERSION,
    collectShaderRefs,
    collectMediaRefs,
    remapStrings,
    buildScenePackage,
    readScenePackage,
    applyScenePackage,
    type ScenePackageSources,
    type ApplyTargets,
    type ScenePackageManifest,
} from './scenePackage';
import { CUSTOM_IMAGE_PREFIX } from './customImageStorage';
import { CUSTOM_VIDEO_PREFIX } from './customVideoStorage';
import { CUSTOM_CUBEMAP_PREFIX } from './customCubemapStorage';
import { CUSTOM_VOLUME_PREFIX } from './customVolumeStorage';
import type { SceneGraph, ShaderObject, ImportedShader, ShaderMetaData } from './types';
import type { CustomShader } from './shaderStorage';
import type {
    CustomImageRecord,
    CustomVideoRecord,
    CustomCubemapRecord,
    CustomVolumeRecord,
} from '@src/storage/shaderDB';

jest.mock('webextension-polyfill', () => ({
    storage: { local: { get: jest.fn(), set: jest.fn() } },
}));

const metaFor = (overrides: Partial<ShaderMetaData> = {}): ShaderMetaData => ({
    author: 'a',
    modifiedBy: '',
    shaderName: 's',
    url: '',
    license: '',
    shaderSpeed: 1,
    ...overrides,
} as ShaderMetaData);

const shaderObj = (name: string, meta: Partial<ShaderMetaData> = {}): ShaderObject => ({
    shaderName: name,
    metaData: metaFor(meta),
    inlineCode: `// ${name}`,
});

const makeScene = (overrides: Partial<SceneGraph> = {}): SceneGraph => ({
    id: 'scene1',
    name: 'Test Scene',
    isLooping: true,
    timeSource: 'iTime',
    timelineSeconds: 120,
    nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [],
    ...overrides,
});

const blobOf = (s: string) => new Blob([s]);

describe('collectShaderRefs', () => {
    it('collects scene/uniform/condition refs, dedupes, ignores empty', () => {
        const scene = makeScene({
            nodes: [
                { id: 'a', type: 'scene', position: { x: 0, y: 0 }, data: { shaderRef: 'A.frag' } },
                { id: 'b', type: 'uniform', position: { x: 0, y: 0 }, data: { shaderRef: 'B.frag' } },
                { id: 'c', type: 'scene', position: { x: 0, y: 0 }, data: { shaderRef: 'A.frag' } },
                { id: 'd', type: 'scene', position: { x: 0, y: 0 }, data: {} },
                { id: 'e', type: 'scene', position: { x: 0, y: 0 }, data: { shaderRef: '' } },
                {
                    id: 'f', type: 'condition', position: { x: 0, y: 0 },
                    data: { condition: { kind: 'uniform', shaderRef: 'C.frag', name: 'x', operator: '==', value: 1 } },
                },
                {
                    id: 'g', type: 'condition', position: { x: 0, y: 0 },
                    data: { condition: { kind: 'audio', operator: '>=', value: 40 } },
                },
            ],
        });
        expect(collectShaderRefs(scene).sort()).toEqual(['A.frag', 'B.frag', 'C.frag']);
    });
});

describe('collectMediaRefs', () => {
    it('finds refs in iChannelN, buffers, cubemapPasses and imported bufferShaders meta', () => {
        const value = {
            metaData: {
                iChannel0: `${CUSTOM_IMAGE_PREFIX}img1`,
                iChannel1: 'images/bundled.jpg',
                buffers: [
                    { shaderName: 'BufA', iChannel2: `${CUSTOM_VIDEO_PREFIX}vid1` },
                ],
                cubemapPasses: [
                    { iChannel0: `${CUSTOM_CUBEMAP_PREFIX}cube1` },
                ],
            },
            bufferShaders: [
                { filename: 'b.frag', code: '', meta: { iChannel3: `${CUSTOM_VOLUME_PREFIX}vol1` } },
            ],
        };
        const refs = collectMediaRefs(value).sort();
        expect(refs).toEqual([
            `${CUSTOM_CUBEMAP_PREFIX}cube1`,
            `${CUSTOM_IMAGE_PREFIX}img1`,
            `${CUSTOM_VIDEO_PREFIX}vid1`,
            `${CUSTOM_VOLUME_PREFIX}vol1`,
        ]);
    });

    it('ignores bundled media refs', () => {
        expect(collectMediaRefs({ a: 'images/foo.jpg', b: 'media/bar.mp4', c: ['presets/x.bin'] })).toEqual([]);
    });
});

describe('remapStrings', () => {
    it('replaces exact string matches deeply', () => {
        const input = { a: 'old', b: ['old', 'prefix_old', { c: 'old' }], d: 3 };
        const out = remapStrings(input, { old: 'new' });
        expect(out).toEqual({ a: 'new', b: ['new', 'prefix_old', { c: 'new' }], d: 3 });
        expect(input.a).toBe('old');
    });
});

// ─── Round-trip fixture ───────────────────────────────────────────────────

const IMG_ID = 'img_a';
const VID_ID = 'vid_a';
const CUBE_ID = 'cube_a';
const VOL_ID = 'vol_a';

const customShader: CustomShader = {
    id: 'custom_1',
    shaderName: 'Custom.frag',
    metaData: metaFor({
        shaderName: 'Custom',
        iChannel0: `${CUSTOM_IMAGE_PREFIX}${IMG_ID}`,
        iChannel1: `${CUSTOM_VIDEO_PREFIX}${VID_ID}`,
    }),
    inlineCode: '// custom',
    createdAt: 1,
    updatedAt: 1,
};

const importedShader: ImportedShader = {
    id: 'imp_1',
    shadertoyId: 'stoy1',
    name: 'Imported',
    author: 'auth',
    importDate: '2026-01-01T00:00:00Z',
    mainShader: { filename: 'image.frag', code: '// main', meta: metaFor({ shaderName: 'Imported' }) },
    bufferShaders: [
        {
            filename: 'buffera.frag', code: '// buf',
            meta: metaFor({ shaderName: 'Buf', iChannel0: `${CUSTOM_CUBEMAP_PREFIX}${CUBE_ID}` }),
        },
    ],
};

const importedEdit: ShaderObject = {
    shaderName: 'image.frag',
    metaData: metaFor({ shaderName: 'Imported (edited)' }),
    inlineCode: '// edited main',
};

const builtinEdit: ShaderObject = {
    shaderName: 'Builtin.frag',
    metaData: metaFor({ shaderName: 'Builtin', iChannel0: `${CUSTOM_VOLUME_PREFIX}${VOL_ID}` }),
    inlineCode: '// builtin edit',
};

const roundTripScene = makeScene({
    nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
        { id: 'n1', type: 'scene', position: { x: 1, y: 0 }, data: { shaderRef: 'custom_1' } },
        { id: 'n2', type: 'scene', position: { x: 2, y: 0 }, data: { shaderRef: 'imp_1' } },
        { id: 'n3', type: 'scene', position: { x: 3, y: 0 }, data: { shaderRef: 'Builtin.frag' } },
        { id: 'n4', type: 'scene', position: { x: 4, y: 0 }, data: { shaderRef: 'Plain.frag' } },
    ],
});

const imageRecord: CustomImageRecord = {
    id: IMG_ID, name: 'pic.png', mimeType: 'image/png', blob: blobOf('PNGDATA'), size: 7, addedAt: 't',
};
const videoRecord: CustomVideoRecord = {
    id: VID_ID, name: 'clip.mp4', mimeType: 'video/mp4', blob: blobOf('VIDDATA'), size: 7, addedAt: 't',
};
const cubemapRecord: CustomCubemapRecord = {
    id: CUBE_ID, name: 'sky', size: 6,
    faces: (['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const).map(name => ({
        name, blob: new Blob([`face_${name}`], { type: 'image/png' }),
    })),
    createdAt: 1,
};
const volumeRecord: CustomVolumeRecord = {
    id: VOL_ID, name: 'noise.bin', width: 2, height: 2, depth: 2, channels: 1,
    blob: blobOf('VOLDATA'), size: 7, createdAt: 1,
};

const makeSources = (): ScenePackageSources => ({
    importedShaders: [importedShader],
    editedImported: { imp_1: importedEdit },
    customShaders: [customShader],
    editedShaders: { 'Builtin.frag': builtinEdit },
    builtinShaderNames: ['Builtin.frag', 'Plain.frag'],
    getImage: async (id) => id === IMG_ID ? imageRecord : null,
    getVideo: async (id) => id === VID_ID ? videoRecord : null,
    getCubemap: async (id) => id === CUBE_ID ? cubemapRecord : undefined,
    getVolume: async (id) => id === VOL_ID ? volumeRecord : undefined,
});

const emptyZip = () => new JSZip();

const makeTargets = (overrides: Partial<ApplyTargets> = {}) => {
    const added = {
        images: [] as CustomImageRecord[],
        videos: [] as CustomVideoRecord[],
        cubemaps: [] as CustomCubemapRecord[],
        volumes: [] as CustomVolumeRecord[],
        imported: [] as ImportedShader[],
        editedImported: [] as { id: string; shader: ShaderObject }[],
        custom: [] as CustomShader[],
        editedBuiltin: [] as { name: string; shader: ShaderObject }[],
    };
    const targets: ApplyTargets = {
        existingImages: {},
        existingVideos: {},
        existingCubemaps: {},
        existingVolumes: {},
        addImage: async (r) => { added.images.push(r); },
        addVideo: async (r) => { added.videos.push(r); },
        addCubemap: async (r) => { added.cubemaps.push(r); },
        addVolume: async (r) => { added.volumes.push(r); },
        importedShaders: [],
        editedImported: {},
        customShaders: [],
        editedShaders: {},
        saveImported: async (s) => { added.imported.push(s); },
        saveEditedImported: async (id, shader) => { added.editedImported.push({ id, shader }); },
        saveCustom: async (s) => { added.custom.push(s); },
        saveEditedBuiltin: async (name, shader) => { added.editedBuiltin.push({ name, shader }); },
        ...overrides,
    };
    return { targets, added };
};

describe('buildScenePackage + readScenePackage', () => {
    it('round-trips a scene with 3 shaders and 4 media entries', async () => {
        const { blob, manifest, missing } = await buildScenePackage(roundTripScene, makeSources());
        expect(missing).toEqual([]);
        expect(manifest.version).toBe(SCENE_PACKAGE_VERSION);
        expect(manifest.shaders).toHaveLength(3); // custom + imported(+edit) + builtin-edited; Plain.frag not packaged
        expect(manifest.media).toHaveLength(4);
        expect(manifest.shaders.map(s => s.kind).sort()).toEqual(['builtin-edited', 'custom', 'imported']);

        const { manifest: read, zip } = await readScenePackage(blob);
        expect(read.scene.name).toBe('Test Scene');
        expect(read.shaders).toHaveLength(3);
        const imp = read.shaders.find(s => s.kind === 'imported');
        expect(imp && imp.kind === 'imported' && imp.edited?.inlineCode).toBe('// edited main');

        // Blob bytes survive the zip round trip
        const img = read.media.find(m => m.kind === 'image');
        expect(img && img.kind === 'image' && img.path.startsWith('media/images/')).toBe(true);
        const imgEntry = zip.file((img as any).path);
        expect(new TextDecoder().decode(await imgEntry!.async('uint8array'))).toBe('PNGDATA');
        const vol = read.media.find(m => m.kind === 'volume') as any;
        expect(vol.path).toBe(`media/volumes/${VOL_ID}.bin`);
        expect(new TextDecoder().decode(await zip.file(vol.path)!.async('uint8array'))).toBe('VOLDATA');
        const cube = read.media.find(m => m.kind === 'cubemap') as any;
        expect(Object.keys(cube.faces).sort()).toEqual(['nx', 'ny', 'nz', 'px', 'py', 'pz']);
        expect(new TextDecoder().decode(await zip.file(cube.faces.px)!.async('uint8array'))).toBe('face_px');
    });

    it('reports unknown shader refs as missing but leaves them in the scene', async () => {
        const scene = makeScene({
            nodes: [{ id: 'n', type: 'scene', position: { x: 0, y: 0 }, data: { shaderRef: 'ghost' } }],
        });
        const { manifest, missing } = await buildScenePackage(scene, makeSources());
        expect(missing).toEqual(['ghost']);
        expect(manifest.scene.nodes[0].data.shaderRef).toBe('ghost');
    });

    it('rejects a zip with a bad version', async () => {
        const zip = emptyZip();
        zip.file('scene.json', JSON.stringify({ version: 1, scene: makeScene() }));
        const blob = new Blob([await zip.generateAsync({ type: 'arraybuffer' })]);
        await expect(readScenePackage(blob)).rejects.toThrow(/version/);
    });

    it('rejects a zip with a malformed/missing scene', async () => {
        const zip = emptyZip();
        zip.file('scene.json', JSON.stringify({ version: SCENE_PACKAGE_VERSION, scene: { id: 5 } }));
        const blob = new Blob([await zip.generateAsync({ type: 'arraybuffer' })]);
        await expect(readScenePackage(blob)).rejects.toThrow(/scene/);

        const empty = new Blob([await emptyZip().generateAsync({ type: 'arraybuffer' })]);
        await expect(readScenePackage(empty)).rejects.toThrow(/scene\.json/);
    });
});

describe('applyScenePackage', () => {
    const readPkg = async () => {
        const { blob } = await buildScenePackage(roundTripScene, makeSources());
        return readScenePackage(blob);
    };

    it('adds everything on an empty client and keeps refs unchanged', async () => {
        const { manifest, zip } = await readPkg();
        const { targets, added } = makeTargets();
        const { scene, summary } = await applyScenePackage(manifest, zip, targets, []);
        expect(summary.shadersAdded).toBe(3);
        expect(summary.mediaAdded).toBe(4);
        expect(summary.shadersCopied).toBe(0);
        expect(summary.missingRefs).toEqual([]);
        expect(scene.nodes.find(n => n.id === 'n1')!.data.shaderRef).toBe('custom_1');
        expect(scene.nodes.find(n => n.id === 'n3')!.data.shaderRef).toBe('Builtin.frag');
        expect(added.imported[0].id).toBe('imp_1');
        // edited-import payload saved under the import id
        expect(added.editedImported).toEqual([{ id: 'imp_1', shader: expect.objectContaining({ inlineCode: '// edited main' }) }]);
        expect(added.editedBuiltin[0].name).toBe('Builtin.frag');
        expect(added.images[0].id).toBe(IMG_ID);
        expect(added.volumes[0].id).toBe(VOL_ID);
        // media blob contents survived
        expect(await added.images[0].blob.text()).toBe('PNGDATA');
        expect(added.cubemaps[0].faces).toHaveLength(6);
    });

    it('reuses identical ids and writes nothing for them', async () => {
        const { manifest, zip } = await readPkg();
        const { targets, added } = makeTargets({
            existingImages: { [IMG_ID]: 7 },
            existingVideos: { [VID_ID]: 7 },
            existingCubemaps: { [CUBE_ID]: 6 },
            existingVolumes: { [VOL_ID]: 7 },
            importedShaders: [importedShader],
            customShaders: [customShader],
            editedShaders: { 'Builtin.frag': builtinEdit },
            editedImported: { imp_1: importedEdit },
        });
        const { scene, summary } = await applyScenePackage(manifest, zip, targets, []);
        expect(summary.mediaReused).toBe(4);
        expect(summary.mediaAdded).toBe(0);
        expect(summary.shadersReused).toBe(3);
        expect(added.images).toHaveLength(0);
        expect(added.imported).toHaveLength(0);
        expect(added.editedImported).toHaveLength(0);
        expect(added.editedBuiltin).toHaveLength(0);
        expect(scene.nodes.find(n => n.id === 'n2')!.data.shaderRef).toBe('imp_1');
    });

    it('copies conflicting ids under fresh ids and remaps scene + shader meta refs', async () => {
        const { manifest, zip } = await readPkg();
        const conflictingImported: ImportedShader = { ...importedShader, mainShader: { ...importedShader.mainShader, code: '// different' } };
        const conflictingCustom: CustomShader = { ...customShader, inlineCode: '// different custom' };
        const { targets, added } = makeTargets({
            existingImages: { [IMG_ID]: 999 },          // different size → copy
            existingVideos: { [VID_ID]: 7 },            // same size → reuse
            existingCubemaps: { [CUBE_ID]: 999 },
            existingVolumes: { [VOL_ID]: 999 },
            importedShaders: [conflictingImported],
            customShaders: [conflictingCustom],
            editedShaders: {},
        });
        const { scene, summary } = await applyScenePackage(manifest, zip, targets, []);
        expect(summary.mediaReused).toBe(1); // video
        expect(summary.mediaCopied).toBe(3); // image + cubemap + volume
        expect(summary.shadersCopied).toBe(2); // imported + custom (builtin-edited had no local edit → added)
        expect(summary.shadersAdded).toBe(1);  // builtin-edited saved via saveEditedBuiltin

        const n1 = scene.nodes.find(n => n.id === 'n1')!.data.shaderRef!;
        const n2 = scene.nodes.find(n => n.id === 'n2')!.data.shaderRef!;
        const n3 = scene.nodes.find(n => n.id === 'n3')!.data.shaderRef!;
        const n4 = scene.nodes.find(n => n.id === 'n4')!.data.shaderRef!;
        expect(n1).not.toBe('custom_1');
        expect(n1.startsWith('custom_')).toBe(true);
        expect(n2).not.toBe('imp_1');
        expect(n2.startsWith('stoy1_')).toBe(true);
        expect(n3).toBe('Builtin.frag'); // no local edit → saved as builtin edit, ref unchanged
        expect(n4).toBe('Plain.frag');   // plain builtin ref untouched
        // the copied imported shader was saved under its fresh id
        expect(added.imported[0].id).toBe(n2);
        // builtin edit carries the remapped volume ref
        expect(added.editedBuiltin[0].shader.metaData.iChannel0).not.toBe(`${CUSTOM_VOLUME_PREFIX}${VOL_ID}`);
        expect(added.editedBuiltin[0].shader.metaData.iChannel0!.startsWith(CUSTOM_VOLUME_PREFIX)).toBe(true);

        // media remap landed inside shader meta
        const savedCustom = added.custom.find(c => c.id === n1)!;
        expect(savedCustom.metaData.iChannel0).not.toBe(`${CUSTOM_IMAGE_PREFIX}${IMG_ID}`);
        expect(savedCustom.metaData.iChannel0!.startsWith(CUSTOM_IMAGE_PREFIX)).toBe(true);
        expect(savedCustom.metaData.iChannel1).toBe(`${CUSTOM_VIDEO_PREFIX}${VID_ID}`); // reused video untouched
        // fresh image id got added
        expect(added.images[0].id).not.toBe(IMG_ID);
        // edited-import payload saved under the new import id
        expect(added.editedImported[0].id).toBe(n2);
    });

    it('converts a conflicting builtin edit into a custom shader copy', async () => {
        const { manifest, zip } = await readPkg();
        const otherEdit: ShaderObject = { shaderName: 'Builtin.frag', metaData: metaFor({ shaderName: 'Builtin' }), inlineCode: '// local edit' };
        const { targets, added } = makeTargets({ editedShaders: { 'Builtin.frag': otherEdit } });
        const { scene, summary } = await applyScenePackage(manifest, zip, targets, []);
        expect(added.editedBuiltin).toHaveLength(0);
        const copy = added.custom.find(c => c.shaderName === 'Builtin.frag');
        expect(copy).toBeDefined();
        expect(copy!.inlineCode).toBe('// builtin edit');
        expect(scene.nodes.find(n => n.id === 'n3')!.data.shaderRef).toBe(copy!.id);
        expect(summary.shadersCopied).toBeGreaterThanOrEqual(1);
    });

    it('gives the scene a fresh id on collision and normalises fields', async () => {
        const { manifest, zip } = await readPkg();
        manifest.scene.timeSource = 'bogus' as any;
        manifest.scene.timelineSeconds = 5;
        const { targets } = makeTargets();
        const { scene } = await applyScenePackage(manifest, zip, targets, [makeScene()]);
        expect(scene.id).not.toBe('scene1');
        expect(scene.timeSource).toBe('auto');
        expect(scene.timelineSeconds).toBe(180);
        expect(scene.isLooping).toBe(true);
    });

    it('reports media refs that are missing from the zip manifest', async () => {
        const { manifest, zip } = await readPkg();
        manifest.media = manifest.media.filter(m => m.kind !== 'volume');
        const { targets } = makeTargets();
        const { summary } = await applyScenePackage(manifest, zip, targets, []);
        expect(summary.missingRefs).toContain(`${CUSTOM_VOLUME_PREFIX}${VOL_ID}`);
    });
});
