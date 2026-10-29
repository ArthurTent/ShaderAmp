/**
 * Scene package (.zip) import — a storage-free port of the extension's
 * scenePackage.ts read/apply logic. A package contains:
 *   scene.json              - manifest (ScenePackageManifest)
 *   media/images/<id>.<ext>
 *   media/videos/<id>.<ext>
 *   media/cubemaps/<id>/<face>.<ext>
 *   media/volumes/<id>.bin
 *
 * Import materializes shaders into plain ShaderObjects and media into a
 * MediaRegistry of blob object URLs / ready-made textures.
 */
import type JSZip from 'jszip';
import {
    ClampToEdgeWrapping,
    Data3DTexture,
    LinearFilter,
    RedFormat,
    RGBAFormat,
    UnsignedByteType,
} from 'three';
import { MediaRegistry } from '../media/MediaRegistry';
import type {
    CubemapFaceName,
    ImportedShader,
    SceneGraph,
    ScenePackageManifest,
    ShaderObject,
} from '../types';

export const SCENE_PACKAGE_VERSION = 2;

const CUBEMAP_FACES: CubemapFaceName[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

const CUSTOM_IMAGE_PREFIX = 'custom_images/';
const CUSTOM_VIDEO_PREFIX = 'custom_videos/';
const CUSTOM_CUBEMAP_PREFIX = 'custom_cubemaps/';
const CUSTOM_VOLUME_PREFIX = 'custom_volumes/';

export interface ImportedScene {
    scene: SceneGraph;
    /** ShaderObjects keyed by the shaderRef used in scene nodes/edges. */
    shaders: Map<string, ShaderObject>;
    /** Blob-URL / texture registry keyed by custom_* channel ref. */
    media: MediaRegistry;
    manifest: ScenePackageManifest;
    /** Refs that were remapped to fresh ids because they collided. */
    remappedRefs: Record<string, string>;
    /** Media/shader refs listed in the manifest but missing from the zip. */
    missingRefs: string[];
}

/** Deep clone `value`, replacing strings that exactly match a key in `map`. */
export function remapStrings<T>(value: T, map: Record<string, string>): T {
    if (typeof value === 'string') return (map[value] ?? value) as T;
    if (Array.isArray(value)) return value.map((item) => remapStrings(item, map)) as T;
    if (value && typeof value === 'object') {
        const out: any = {};
        for (const key of Object.keys(value as any)) out[key] = remapStrings((value as any)[key], map);
        return out;
    }
    return value;
}

/** Convert a packaged ImportedShader into a ShaderObject (mirrors the extension's resolveShaderEntry). */
export function importedToShaderObject(imported: ImportedShader): ShaderObject {
    const inlineBuffers: { [filename: string]: string } = {};
    for (const buffer of imported.bufferShaders || []) {
        inlineBuffers[buffer.filename] = buffer.code;
    }
    return {
        shaderName: imported.mainShader.filename,
        metaData: imported.mainShader.meta,
        inlineCode: imported.mainShader.code,
        inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined,
        inlineSound: imported.soundShader?.code,
    };
}

/** Convert any PackagedShader manifest entry into a ShaderObject. */
export function packagedToShaderObject(packaged: ScenePackageManifest['shaders'][number]): ShaderObject {
    if (packaged.kind === 'imported') return packaged.edited ?? importedToShaderObject(packaged.imported);
    if (packaged.kind === 'custom') {
        const { id: _id, ...obj } = packaged.custom as ShaderObject & { id: string };
        return obj;
    }
    return packaged.edited;
}

/** Read and validate a scene package zip. Throws on bad version/shape. */
export async function readScenePackage(file: File | Blob): Promise<{ manifest: ScenePackageManifest; zip: JSZip }> {
    const JSZipImpl = (await import('jszip')).default;
    const buffer = typeof (file as any).arrayBuffer === 'function'
        ? await file.arrayBuffer()
        : await new Response(file).arrayBuffer();
    const zip = await JSZipImpl.loadAsync(buffer);
    const entry = zip.file('scene.json');
    if (!entry) throw new Error('Not a scene package: scene.json missing');
    const manifest = JSON.parse(await entry.async('string')) as ScenePackageManifest;
    if (!manifest || manifest.version !== SCENE_PACKAGE_VERSION) {
        throw new Error(`Unsupported scene package version: ${manifest?.version}`);
    }
    const scene = manifest.scene;
    if (!scene || typeof scene.id !== 'string' || typeof scene.name !== 'string'
        || !Array.isArray(scene.nodes) || !Array.isArray(scene.edges)) {
        throw new Error('Invalid scene package: malformed scene');
    }
    if (!Array.isArray(manifest.shaders)) manifest.shaders = [];
    if (!Array.isArray(manifest.media)) manifest.media = [];
    return { manifest, zip };
}

async function zipEntryToBlob(zip: JSZip, path: string, mimeType?: string): Promise<Blob | null> {
    const entry = zip.file(path);
    if (!entry) return null;
    const buffer = await entry.async('arraybuffer');
    return new Blob([buffer], mimeType ? { type: mimeType } : undefined);
}

/** Build a 3D texture from raw voxel bytes (1 = red-only, 4 = RGBA channels). */
export function buildVolumeTexture(data: Uint8Array<ArrayBuffer>, item: { width: number; height: number; depth: number; channels: number }): Data3DTexture {
    const tex = new Data3DTexture(data, item.width, item.height, item.depth);
    tex.format = item.channels === 1 ? RedFormat : RGBAFormat;
    tex.type = UnsignedByteType;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Materialize a scene package manifest into shaders + media for this instance.
 * Non-destructive: refs that already exist in `existingMedia`/`existingShaders`
 * get fresh ids and all references in the scene and shader payloads are
 * remapped, mirroring the extension's applyScenePackage.
 */
export async function materializeScenePackage(
    manifest: ScenePackageManifest,
    zip: JSZip,
    existing?: { media?: MediaRegistry; shaders?: Map<string, ShaderObject> },
): Promise<ImportedScene> {
    const media = new MediaRegistry();
    const shaders = new Map<string, ShaderObject>();
    const missingRefs: string[] = [];

    // 1. Media — build entries under the manifest ref (or a fresh id on collision).
    const mediaRefMap: Record<string, string> = {};
    const collides = (ref: string) => !!existing?.media?.has(ref) || media.has(ref);
    const freshRef = (prefix: string, id: string) => {
        let candidate = `${prefix}${id}`;
        let n = 0;
        while (collides(candidate)) candidate = `${prefix}${id}_${++n}`;
        return candidate;
    };

    for (const item of manifest.media) {
        if (item.kind === 'image' || item.kind === 'video') {
            const blob = await zipEntryToBlob(zip, item.path, item.mimeType);
            if (!blob) { missingRefs.push(item.ref); continue; }
            const prefix = item.kind === 'image' ? CUSTOM_IMAGE_PREFIX : CUSTOM_VIDEO_PREFIX;
            const ref = collides(item.ref) ? freshRef(prefix, item.id) : item.ref;
            if (ref !== item.ref) mediaRefMap[item.ref] = ref;
            media.set(ref, { kind: item.kind, url: URL.createObjectURL(blob) });
        } else if (item.kind === 'cubemap') {
            const faceUrls: string[] = [];
            let missingFace = false;
            for (const faceName of CUBEMAP_FACES) {
                const path = item.faces[faceName];
                const blob = path ? await zipEntryToBlob(zip, path) : null;
                if (!blob) { missingFace = true; break; }
                faceUrls.push(URL.createObjectURL(blob));
            }
            if (missingFace) {
                faceUrls.forEach((u) => URL.revokeObjectURL(u));
                missingRefs.push(item.ref);
                continue;
            }
            const ref = collides(item.ref) ? freshRef(CUSTOM_CUBEMAP_PREFIX, item.id) : item.ref;
            if (ref !== item.ref) mediaRefMap[item.ref] = ref;
            media.set(ref, { kind: 'cubemap', faceUrls });
        } else if (item.kind === 'volume') {
            const entry = zip.file(item.path);
            if (!entry) { missingRefs.push(item.ref); continue; }
            const data = (await entry.async('uint8array')) as Uint8Array<ArrayBuffer>;
            const ref = collides(item.ref) ? freshRef(CUSTOM_VOLUME_PREFIX, item.id) : item.ref;
            if (ref !== item.ref) mediaRefMap[item.ref] = ref;
            media.set(ref, { kind: 'volume', texture: buildVolumeTexture(data, item) });
        }
    }

    // 2. Shaders — media refs inside payloads remapped first; shader-ref
    //    collisions get a fresh ref and the scene graph is remapped below.
    const shaderRefMap: Record<string, string> = {};
    for (const packaged of manifest.shaders) {
        const shader = remapStrings(packagedToShaderObject(packaged), mediaRefMap);
        let ref = packaged.ref;
        if (existing?.shaders?.has(ref) || shaders.has(ref)) {
            let n = 0;
            let fresh = `${ref}_${++n}`;
            while (existing?.shaders?.has(fresh) || shaders.has(fresh)) fresh = `${ref}_${++n}`;
            shaderRefMap[ref] = fresh;
            ref = fresh;
        }
        shaders.set(ref, shader);
    }

    // 3. Remap the scene graph for collided shader/media refs (media refs can
    //    also appear inside uniform overrides).
    const refMap = { ...mediaRefMap, ...shaderRefMap };
    const scene = Object.keys(refMap).length ? remapStrings(manifest.scene, refMap) : manifest.scene;

    return { scene, shaders, media, manifest, remappedRefs: refMap, missingRefs };
}

/**
 * Read a scene package file and materialize it in one step.
 */
export async function importScenePackage(
    file: File | Blob,
    existing?: { media?: MediaRegistry; shaders?: Map<string, ShaderObject> },
): Promise<ImportedScene> {
    const { manifest, zip } = await readScenePackage(file);
    return materializeScenePackage(manifest, zip, existing);
}

/** True for values that look like a SceneGraph (for JSON scene import). */
export function isSceneGraph(value: any): value is SceneGraph {
    return !!value && typeof value.id === 'string' && typeof value.name === 'string'
        && Array.isArray(value.nodes) && Array.isArray(value.edges);
}

/** True for refs handled by the media registry rather than the asset catalog. */
export function isCustomMediaRef(ref: string): boolean {
    return typeof ref === 'string' && ref.startsWith('custom_');
}
