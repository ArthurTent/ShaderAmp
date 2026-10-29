import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import {
    importScenePackage,
    isSceneGraph,
    materializeScenePackage,
    packagedToShaderObject,
    readScenePackage,
    remapStrings,
    SCENE_PACKAGE_VERSION,
} from '../src/scene/scenePackage';
import { MediaRegistry } from '../src/media/MediaRegistry';
import type { ImportedShader, SceneGraph, ScenePackageManifest } from '../src/types';

beforeAll(() => {
    // jsdom lacks URL.createObjectURL
    (URL as any).createObjectURL ??= vi.fn((b: Blob) => `blob:mock-${b.size}`);
    (URL as any).revokeObjectURL ??= vi.fn();
});

const imported: ImportedShader = {
    id: 'imp_1',
    shadertoyId: 'abc123',
    name: 'Packaged',
    author: 'auth',
    importDate: '2026-01-01',
    mainShader: {
        filename: 'packaged.frag',
        code: 'void mainImage() {}',
        meta: { author: 'auth', modifiedBy: '', shaderName: 'Packaged', url: '', license: '', shaderSpeed: 1 } as any,
    },
    bufferShaders: [{ filename: 'bufA.frag', code: 'void mainImage() {}', meta: {} as any }],
};

const sceneGraph: SceneGraph = {
    id: 'scene-1',
    name: 'Demo',
    isLooping: false,
    nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
        { id: 'n1', type: 'scene', position: { x: 0, y: 0 }, data: { shaderRef: 'imp_1' } },
    ],
    edges: [{ id: 'e1', source: 'start', target: 'n1', trigger: { type: 'manual' } }],
};

async function makeZip(manifest: ScenePackageManifest, files: Record<string, Uint8Array> = {}) {
    const JSZipImpl = (await import('jszip')).default;
    const zip = new JSZipImpl();
    zip.file('scene.json', JSON.stringify(manifest));
    for (const [path, data] of Object.entries(files)) zip.file(path, data);
    // node:buffer Blob implements arrayBuffer() (jsdom's does not)
    return new NodeBlob([await zip.generateAsync({ type: 'arraybuffer' })], { type: 'application/zip' }) as unknown as Blob;
}

const baseManifest = (): ScenePackageManifest => ({
    version: SCENE_PACKAGE_VERSION,
    exportedAt: '2026-01-01',
    scene: sceneGraph,
    shaders: [{ ref: 'imp_1', kind: 'imported', imported }],
    media: [],
});

describe('readScenePackage', () => {
    it('rejects non-package and wrong-version blobs', async () => {
        await expect(readScenePackage(new NodeBlob([new Uint8Array([1, 2, 3])]) as unknown as Blob)).rejects.toThrow();
        const bad = await makeZip({ ...baseManifest(), version: 1 as any });
        await expect(readScenePackage(bad)).rejects.toThrow(/version/i);
    });

    it('parses a valid manifest', async () => {
        const { manifest } = await readScenePackage(await makeZip(baseManifest()));
        expect(manifest.scene.id).toBe('scene-1');
        expect(manifest.shaders).toHaveLength(1);
    });
});

describe('materializeScenePackage', () => {
    it('converts packaged shaders and media into registry entries', async () => {
        const manifest = baseManifest();
        manifest.media = [
            { ref: 'custom_images/m1', kind: 'image', id: 'm1', name: 'a.png', mimeType: 'image/png', size: 3, path: 'media/images/m1.png' },
            { ref: 'custom_volumes/v1', kind: 'volume', id: 'v1', name: 'vol.bin', size: 8, width: 2, height: 2, depth: 2, channels: 1, path: 'media/volumes/v1.bin' },
        ];
        const zip = await makeZip(manifest, {
            'media/images/m1.png': new Uint8Array([1, 2, 3]),
            'media/volumes/v1.bin': new Uint8Array(8),
        });
        const { manifest: parsed, zip: jz } = await readScenePackage(zip);
        const out = await materializeScenePackage(parsed, jz);

        const sh = out.shaders.get('imp_1');
        expect(sh?.shaderName).toBe('packaged.frag');
        expect(sh?.inlineBuffers?.['bufA.frag']).toBe('void mainImage() {}');

        const img = out.media.get('custom_images/m1');
        expect(img?.kind).toBe('image');
        const vol = out.media.get('custom_volumes/v1');
        expect(vol?.kind).toBe('volume');
        expect(out.missingRefs).toEqual([]);
    });

    it('reports media refs whose files are absent from the zip', async () => {
        const manifest = baseManifest();
        manifest.media = [
            { ref: 'custom_images/gone', kind: 'image', id: 'gone', name: 'g.png', mimeType: 'image/png', size: 1, path: 'media/images/gone.png' },
        ];
        const zip = await makeZip(manifest); // no media files written
        const { manifest: parsed, zip: jz } = await readScenePackage(zip);
        const out = await materializeScenePackage(parsed, jz);
        expect(out.missingRefs).toEqual(['custom_images/gone']);
        expect(out.media.get('custom_images/gone')).toBeUndefined();
    });

    it('remaps colliding refs to fresh ids and rewrites the scene', async () => {
        const existing = new MediaRegistry();
        existing.set('custom_images/m1', { kind: 'image', url: 'blob:existing' });
        const manifest = baseManifest();
        manifest.media = [
            { ref: 'custom_images/m1', kind: 'image', id: 'm1', name: 'a.png', mimeType: 'image/png', size: 3, path: 'media/images/m1.png' },
        ];
        manifest.scene.nodes[1].data.uniformOverrides = { tex: 'custom_images/m1' };
        const zip = await makeZip(manifest, { 'media/images/m1.png': new Uint8Array([1, 2, 3]) });
        const { manifest: parsed, zip: jz } = await readScenePackage(zip);
        const out = await materializeScenePackage(parsed, jz, { media: existing });

        expect(out.remappedRefs['custom_images/m1']).toMatch(/^custom_images\/m1_\d+$/);
        const fresh = out.remappedRefs['custom_images/m1'];
        expect(out.media.get(fresh)?.kind).toBe('image');
        expect(out.scene.nodes[1].data.uniformOverrides?.tex).toBe(fresh);
    });
});

describe('packagedToShaderObject / remapStrings / isSceneGraph', () => {
    it('prefers the edited payload for imported shaders', () => {
        const edited = { shaderName: 'edited.frag', metaData: { shaderSpeed: 2 } as any, inlineCode: 'x' };
        expect(packagedToShaderObject({ ref: 'r', kind: 'imported', imported, edited })).toBe(edited);
        expect(packagedToShaderObject({ ref: 'r', kind: 'imported', imported }).shaderName).toBe('packaged.frag');
        expect(packagedToShaderObject({ ref: 'r', kind: 'builtin-edited', shaderName: 's', edited }).shaderName).toBe('edited.frag');
    });

    it('remapStrings replaces deep exact matches only', () => {
        const obj = { a: 'x', b: ['x', 'xy'], c: { d: 'x' } };
        expect(remapStrings(obj, { x: 'y' })).toEqual({ a: 'y', b: ['y', 'xy'], c: { d: 'y' } });
    });

    it('isSceneGraph validates shape', () => {
        expect(isSceneGraph(sceneGraph)).toBe(true);
        expect(isSceneGraph({ id: 'x' })).toBe(false);
        expect(isSceneGraph(null)).toBe(false);
    });
});
