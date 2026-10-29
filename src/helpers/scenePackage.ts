/**
 * Scene package (.zip) import/export.
 *
 * A package is a zip containing:
 *   scene.json              - manifest (ScenePackageManifest)
 *   media/images/<id>.<ext>
 *   media/videos/<id>.<ext>
 *   media/cubemaps/<id>/<face>.<ext>
 *   media/volumes/<id>.bin
 *
 * The module is pure logic: all storage/DB access is injected so it can be
 * used from the options page and tested in node.
 */

import type JSZip from 'jszip';
import type {
    SceneGraph,
    SceneNode,
    ShaderObject,
    ImportedShader,
} from './types';
import type { CustomShader } from './shaderStorage';
import { generateShaderId } from './shaderStorage';
import { CUSTOM_IMAGE_PREFIX, generateImageId } from './customImageStorage';
import { CUSTOM_VIDEO_PREFIX, generateVideoId } from './customVideoStorage';
import { CUSTOM_CUBEMAP_PREFIX, generateCubemapId } from './customCubemapStorage';
import { CUSTOM_VOLUME_PREFIX, generateVolumeId } from './customVolumeStorage';
import type {
    CustomImageRecord,
    CustomVideoRecord,
    CustomCubemapRecord,
    CustomVolumeRecord,
    CubemapFaceRecord,
} from '@src/storage/shaderDB';

export const SCENE_PACKAGE_VERSION = 2;

export type CubemapFaceName = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
const CUBEMAP_FACES: CubemapFaceName[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export type PackagedShader =
    | { ref: string; kind: 'imported'; imported: ImportedShader; edited?: ShaderObject }
    | { ref: string; kind: 'custom'; custom: CustomShader }
    | { ref: string; kind: 'builtin-edited'; shaderName: string; edited: ShaderObject };

export type PackagedMedia =
    | { ref: string; kind: 'image' | 'video'; id: string; name: string; mimeType: string; size: number; path: string }
    | { ref: string; kind: 'cubemap'; id: string; name: string; size: number; faces: Record<CubemapFaceName, string> }
    | { ref: string; kind: 'volume'; id: string; name: string; size: number; width: number; height: number; depth: number; channels: number; path: string };

export type ScenePackageManifest = {
    version: typeof SCENE_PACKAGE_VERSION;
    exportedAt: string;
    scene: SceneGraph;
    shaders: PackagedShader[];
    media: PackagedMedia[];
};

export interface ScenePackageSources {
    importedShaders: ImportedShader[];
    editedImported: Record<string, ShaderObject>;
    customShaders: CustomShader[];
    editedShaders: Record<string, ShaderObject>;
    // shaderName of every built-in so plain built-in refs can be told apart
    // from unknown refs (plain built-ins are not packaged, unknowns are missing)
    builtinShaderNames: string[];
    getImage: (id: string) => Promise<CustomImageRecord | null>;
    getVideo: (id: string) => Promise<CustomVideoRecord | null>;
    getCubemap: (id: string) => Promise<CustomCubemapRecord | null | undefined>;
    getVolume: (id: string) => Promise<CustomVolumeRecord | null | undefined>;
}

export interface ApplyTargets {
    existingImages: Record<string, number>;    // id -> size
    existingVideos: Record<string, number>;
    existingCubemaps: Record<string, number>;
    existingVolumes: Record<string, number>;
    addImage: (record: CustomImageRecord) => Promise<void>;
    addVideo: (record: CustomVideoRecord) => Promise<void>;
    addCubemap: (record: CustomCubemapRecord) => Promise<void>;
    addVolume: (record: CustomVolumeRecord) => Promise<void>;
    importedShaders: ImportedShader[];
    editedImported: Record<string, ShaderObject>;
    customShaders: CustomShader[];
    editedShaders: Record<string, ShaderObject>;
    saveImported: (shader: ImportedShader) => Promise<void>;
    saveEditedImported: (importId: string, shader: ShaderObject) => Promise<void>;
    saveCustom: (shader: CustomShader) => Promise<void>;
    saveEditedBuiltin: (shaderName: string, shader: ShaderObject) => Promise<void>;
}

export interface ApplySummary {
    shadersAdded: number;
    shadersReused: number;
    shadersCopied: number;
    mediaAdded: number;
    mediaReused: number;
    mediaCopied: number;
    missingRefs: string[];
}

function generateSceneId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MEDIA_PREFIXES = [CUSTOM_IMAGE_PREFIX, CUSTOM_VIDEO_PREFIX, CUSTOM_CUBEMAP_PREFIX, CUSTOM_VOLUME_PREFIX];

/**
 * All shader references used by a scene: scene/uniform node `data.shaderRef`
 * plus `condition.shaderRef` on uniform-condition nodes. Deduped, no empties.
 */
export function collectShaderRefs(scene: SceneGraph): string[] {
    const refs = new Set<string>();
    for (const node of scene.nodes) {
        const ref = node.data?.shaderRef;
        if (typeof ref === 'string' && ref) refs.add(ref);
        const condRef = node.data?.condition?.kind === 'uniform' ? node.data.condition.shaderRef : undefined;
        if (typeof condRef === 'string' && condRef) refs.add(condRef);
    }
    return Array.from(refs);
}

/**
 * Deep-walk any value and return the deduped set of strings that start with
 * one of the custom media prefixes (custom_images/, custom_videos/,
 * custom_cubemaps/, custom_volumes/).
 */
export function collectMediaRefs(value: any): string[] {
    const refs = new Set<string>();
    const walk = (v: any) => {
        if (typeof v === 'string') {
            if (MEDIA_PREFIXES.some(p => v.startsWith(p))) refs.add(v);
            return;
        }
        if (Array.isArray(v)) {
            for (const item of v) walk(item);
            return;
        }
        if (v && typeof v === 'object') {
            for (const key of Object.keys(v)) walk(v[key]);
        }
    };
    walk(value);
    return Array.from(refs);
}

/**
 * Deep clone `value`, replacing any string that exactly matches a key in
 * `map` with the mapped value.
 */
export function remapStrings<T>(value: T, map: Record<string, string>): T {
    if (typeof value === 'string') {
        return (map[value] ?? value) as T;
    }
    if (Array.isArray(value)) {
        return value.map(item => remapStrings(item, map)) as T;
    }
    if (value && typeof value === 'object') {
        const out: any = {};
        for (const key of Object.keys(value as any)) {
            out[key] = remapStrings((value as any)[key], map);
        }
        return out;
    }
    return value;
}

const MIME_TO_EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'application/octet-stream': 'bin',
};

function extFor(mimeType: string | undefined, name: string | undefined, fallback: string): string {
    if (mimeType && MIME_TO_EXT[mimeType]) return MIME_TO_EXT[mimeType];
    const m = name?.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
    return fallback;
}

function shaderContentKey(shader: Pick<ShaderObject, 'shaderName' | 'metaData' | 'inlineCode' | 'inlineBuffers' | 'inlineSound'>): string {
    return JSON.stringify({
        shaderName: shader.shaderName,
        metaData: shader.metaData,
        inlineCode: shader.inlineCode,
        inlineBuffers: shader.inlineBuffers,
        inlineSound: shader.inlineSound,
    });
}

function importedContentKey(shader: Pick<ImportedShader, 'mainShader' | 'bufferShaders' | 'soundShader'>): string {
    return JSON.stringify({
        mainShader: shader.mainShader,
        bufferShaders: shader.bufferShaders,
        soundShader: shader.soundShader,
    });
}

/**
 * Resolve a node shaderRef against the injected sources into a PackagedShader.
 * Plain (unedited) built-ins return null — they are left as refs. Unknown
 * refs return undefined-ish via the missing list.
 */
function resolvePackagedShader(ref: string, sources: ScenePackageSources): PackagedShader | 'builtin' | null {
    const imported = sources.importedShaders.find(s => s.id === ref);
    if (imported) {
        const edited = sources.editedImported[ref];
        return { ref, kind: 'imported', imported, edited };
    }
    const custom = sources.customShaders.find(s => s.id === ref);
    if (custom) {
        return { ref, kind: 'custom', custom };
    }
    const edited = sources.editedShaders[ref];
    if (edited) {
        return { ref, kind: 'builtin-edited', shaderName: ref, edited };
    }
    if (sources.builtinShaderNames.includes(ref)) return 'builtin';
    return null;
}

/**
 * Build a .zip package for `scene`: the scene graph, every non-bundled shader
 * it references (imported, custom, edited built-ins) and all custom media
 * those shaders use.
 */
export async function buildScenePackage(
    scene: SceneGraph,
    sources: ScenePackageSources
): Promise<{ blob: Blob; manifest: ScenePackageManifest; missing: string[] }> {
    const JSZipImpl = (await import('jszip')).default;
    const zip = new JSZipImpl();

    const shaders: PackagedShader[] = [];
    const missing: string[] = [];
    for (const ref of collectShaderRefs(scene)) {
        const packaged = resolvePackagedShader(ref, sources);
        if (packaged === 'builtin') continue;
        if (packaged === null) {
            missing.push(ref);
            continue;
        }
        shaders.push(packaged);
    }

    const mediaRefs = new Set<string>();
    for (const shader of shaders) {
        const payload = shader.kind === 'imported' ? shader.imported
            : shader.kind === 'custom' ? shader.custom
            : shader.edited;
        for (const ref of collectMediaRefs(payload)) mediaRefs.add(ref);
        if (shader.kind === 'imported' && shader.edited) {
            for (const ref of collectMediaRefs(shader.edited)) mediaRefs.add(ref);
        }
    }

    const media: PackagedMedia[] = [];
    for (const ref of Array.from(mediaRefs)) {
        if (ref.startsWith(CUSTOM_IMAGE_PREFIX)) {
            const id = ref.slice(CUSTOM_IMAGE_PREFIX.length);
            const record = await sources.getImage(id);
            if (!record) { missing.push(ref); continue; }
            const path = `media/images/${id}.${extFor(record.mimeType, record.name, 'png')}`;
            zip.file(path, await record.blob.arrayBuffer(), { binary: true, compression: 'STORE' });
            media.push({ ref, kind: 'image', id, name: record.name, mimeType: record.mimeType, size: record.size, path });
        } else if (ref.startsWith(CUSTOM_VIDEO_PREFIX)) {
            const id = ref.slice(CUSTOM_VIDEO_PREFIX.length);
            const record = await sources.getVideo(id);
            if (!record) { missing.push(ref); continue; }
            const path = `media/videos/${id}.${extFor(record.mimeType, record.name, 'mp4')}`;
            zip.file(path, await record.blob.arrayBuffer(), { binary: true, compression: 'STORE' });
            media.push({ ref, kind: 'video', id, name: record.name, mimeType: record.mimeType, size: record.size, path });
        } else if (ref.startsWith(CUSTOM_CUBEMAP_PREFIX)) {
            const id = ref.slice(CUSTOM_CUBEMAP_PREFIX.length);
            const record = await sources.getCubemap(id);
            if (!record) { missing.push(ref); continue; }
            const faces = {} as Record<CubemapFaceName, string>;
            for (const face of record.faces) {
                const path = `media/cubemaps/${id}/${face.name}.${extFor(face.blob.type, undefined, 'png')}`;
                faces[face.name] = path;
                zip.file(path, await face.blob.arrayBuffer(), { binary: true, compression: 'STORE' });
            }
            media.push({ ref, kind: 'cubemap', id, name: record.name, size: record.size, faces });
        } else if (ref.startsWith(CUSTOM_VOLUME_PREFIX)) {
            const id = ref.slice(CUSTOM_VOLUME_PREFIX.length);
            const record = await sources.getVolume(id);
            if (!record) { missing.push(ref); continue; }
            const path = `media/volumes/${id}.bin`;
            zip.file(path, await record.blob.arrayBuffer(), { binary: true, compression: 'STORE' });
            media.push({
                ref, kind: 'volume', id, name: record.name, size: record.size,
                width: record.width, height: record.height, depth: record.depth, channels: record.channels, path,
            });
        }
    }

    const manifest: ScenePackageManifest = {
        version: SCENE_PACKAGE_VERSION,
        exportedAt: new Date().toISOString(),
        scene,
        shaders,
        media,
    };
    zip.file('scene.json', JSON.stringify(manifest, null, 2));

    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    return { blob: new Blob([buffer], { type: 'application/zip' }), manifest, missing };
}

/**
 * Read and validate a scene package zip. Throws on bad version/shape.
 */
export async function readScenePackage(file: File | Blob): Promise<{ manifest: ScenePackageManifest; zip: JSZip }> {
    const JSZipImpl = (await import('jszip')).default;
    const zip = await JSZipImpl.loadAsync(await file.arrayBuffer());
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

/**
 * Apply a scene package to this client non-destructively: media and shaders
 * whose ids already exist with different content are imported as copies under
 * fresh ids and all references are remapped.
 */
export async function applyScenePackage(
    manifest: ScenePackageManifest,
    zip: JSZip,
    targets: ApplyTargets,
    existingScenes: SceneGraph[]
): Promise<{ scene: SceneGraph; summary: ApplySummary }> {
    const summary: ApplySummary = {
        shadersAdded: 0,
        shadersReused: 0,
        shadersCopied: 0,
        mediaAdded: 0,
        mediaReused: 0,
        mediaCopied: 0,
        missingRefs: [],
    };

    // 1. Media
    const mediaRefMap: Record<string, string> = {};
    const now = new Date().toISOString();
    for (const item of manifest.media) {
        if (item.kind === 'image' || item.kind === 'video') {
            const existing = item.kind === 'image' ? targets.existingImages : targets.existingVideos;
            const add = item.kind === 'image' ? targets.addImage : targets.addVideo;
            const generateId = item.kind === 'image' ? generateImageId : generateVideoId;
            const prefix = item.kind === 'image' ? CUSTOM_IMAGE_PREFIX : CUSTOM_VIDEO_PREFIX;
            const blob = await zipEntryToBlob(zip, item.path, item.mimeType);
            if (!blob) { summary.missingRefs.push(item.ref); continue; }
            const existingSize = existing[item.id];
            if (existingSize === undefined) {
                await add({ id: item.id, name: item.name, mimeType: item.mimeType, blob, size: item.size, addedAt: now });
                summary.mediaAdded++;
            } else if (existingSize === item.size) {
                summary.mediaReused++;
            } else {
                const newId = generateId();
                await add({ id: newId, name: item.name, mimeType: item.mimeType, blob, size: item.size, addedAt: now });
                mediaRefMap[item.ref] = `${prefix}${newId}`;
                summary.mediaCopied++;
            }
        } else if (item.kind === 'cubemap') {
            const faces: CubemapFaceRecord[] = [];
            let missingFace = false;
            for (const faceName of CUBEMAP_FACES) {
                const path = item.faces[faceName];
                const blob = path ? await zipEntryToBlob(zip, path) : null;
                if (!blob) { missingFace = true; break; }
                faces.push({ name: faceName, blob });
            }
            if (missingFace) { summary.missingRefs.push(item.ref); continue; }
            const existingSize = targets.existingCubemaps[item.id];
            if (existingSize === undefined) {
                await targets.addCubemap({ id: item.id, name: item.name, faces, size: item.size, createdAt: Date.now() });
                summary.mediaAdded++;
            } else if (existingSize === item.size) {
                summary.mediaReused++;
            } else {
                const newId = generateCubemapId();
                await targets.addCubemap({ id: newId, name: item.name, faces, size: item.size, createdAt: Date.now() });
                mediaRefMap[item.ref] = `${CUSTOM_CUBEMAP_PREFIX}${newId}`;
                summary.mediaCopied++;
            }
        } else if (item.kind === 'volume') {
            const blob = await zipEntryToBlob(zip, item.path, 'application/octet-stream');
            if (!blob) { summary.missingRefs.push(item.ref); continue; }
            const existingSize = targets.existingVolumes[item.id];
            if (existingSize === undefined) {
                await targets.addVolume({
                    id: item.id, name: item.name, width: item.width, height: item.height,
                    depth: item.depth, channels: item.channels as 1 | 4, blob, size: item.size, createdAt: Date.now(),
                });
                summary.mediaAdded++;
            } else if (existingSize === item.size) {
                summary.mediaReused++;
            } else {
                const newId = generateVolumeId();
                await targets.addVolume({
                    id: newId, name: item.name, width: item.width, height: item.height,
                    depth: item.depth, channels: item.channels as 1 | 4, blob, size: item.size, createdAt: Date.now(),
                });
                mediaRefMap[item.ref] = `${CUSTOM_VOLUME_PREFIX}${newId}`;
                summary.mediaCopied++;
            }
        }
    }

    // 2. Shaders (media refs inside them remapped first)
    const shaderRefMap: Record<string, string> = {};
    for (const packaged of manifest.shaders) {
        if (packaged.kind === 'imported') {
            const imported = remapStrings(packaged.imported, mediaRefMap);
            const edited = packaged.edited ? remapStrings(packaged.edited, mediaRefMap) : undefined;
            const existing = targets.importedShaders.find(s => s.id === imported.id);
            let finalId = imported.id;
            if (!existing) {
                await targets.saveImported(imported);
                summary.shadersAdded++;
            } else if (importedContentKey(existing) === importedContentKey(imported)) {
                summary.shadersReused++;
            } else {
                finalId = `${imported.shadertoyId}_${Date.now()}`;
                while (targets.importedShaders.some(s => s.id === finalId)) {
                    finalId = `${imported.shadertoyId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                }
                await targets.saveImported({ ...imported, id: finalId });
                shaderRefMap[packaged.ref] = finalId;
                summary.shadersCopied++;
            }
            if (edited) {
                // Never overwrite an existing client edit: for a reused id the
                // client's own edit wins (identical or not).
                if (!targets.editedImported[finalId]) {
                    await targets.saveEditedImported(finalId, edited);
                }
            }
        } else if (packaged.kind === 'custom') {
            const custom = remapStrings(packaged.custom, mediaRefMap);
            const existing = targets.customShaders.find(s => s.id === custom.id);
            if (!existing) {
                await targets.saveCustom(custom);
                summary.shadersAdded++;
            } else if (shaderContentKey(existing) === shaderContentKey(custom)) {
                summary.shadersReused++;
            } else {
                const newId = generateShaderId();
                await targets.saveCustom({ ...custom, id: newId, createdAt: Date.now(), updatedAt: Date.now() });
                shaderRefMap[packaged.ref] = newId;
                summary.shadersCopied++;
            }
        } else {
            const edited = remapStrings(packaged.edited, mediaRefMap);
            const existingEdit = targets.editedShaders[packaged.shaderName];
            if (!existingEdit) {
                await targets.saveEditedBuiltin(packaged.shaderName, edited);
                summary.shadersAdded++;
            } else if (shaderContentKey(existingEdit) === shaderContentKey(edited)) {
                summary.shadersReused++;
            } else {
                // A different local edit exists: convert the packaged edit into
                // a standalone custom shader copy and remap the ref.
                const newId = generateShaderId();
                await targets.saveCustom({
                    id: newId,
                    shaderName: edited.shaderName,
                    metaData: edited.metaData,
                    inlineCode: edited.inlineCode,
                    inlineBuffers: edited.inlineBuffers,
                    inlineSound: edited.inlineSound,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
                shaderRefMap[packaged.ref] = newId;
                summary.shadersCopied++;
            }
        }
    }

    // Media refs in packaged shaders that never made it into the manifest
    const packagedMediaRefs = new Set(manifest.media.map(m => m.ref));
    for (const packaged of manifest.shaders) {
        const payload = packaged.kind === 'imported' ? packaged.imported
            : packaged.kind === 'custom' ? packaged.custom
            : packaged.edited;
        for (const ref of collectMediaRefs(payload)) {
            if (!packagedMediaRefs.has(ref) && !summary.missingRefs.includes(ref)) {
                summary.missingRefs.push(ref);
            }
        }
        if (packaged.kind === 'imported' && packaged.edited) {
            for (const ref of collectMediaRefs(packaged.edited)) {
                if (!packagedMediaRefs.has(ref) && !summary.missingRefs.includes(ref)) {
                    summary.missingRefs.push(ref);
                }
            }
        }
    }

    // 3. Scene
    const remappedNodes = remapStrings(manifest.scene.nodes, shaderRefMap) as SceneNode[];
    const source = manifest.scene;
    const scene: SceneGraph = {
        ...source,
        nodes: remappedNodes,
        id: source.id && existingScenes.some(s => s.id === source.id) ? generateSceneId() : source.id,
        isLooping: !!source.isLooping,
        timeSource: source.timeSource === 'iTime' || source.timeSource === 'iAmplifiedTime' || source.timeSource === 'auto'
            ? source.timeSource
            : 'auto',
        timelineSeconds: typeof source.timelineSeconds === 'number' && isFinite(source.timelineSeconds) && source.timelineSeconds >= 10
            ? source.timelineSeconds
            : 180,
    };

    return { scene, summary };
}
