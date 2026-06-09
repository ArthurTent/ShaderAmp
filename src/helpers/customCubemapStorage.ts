/**
 * Custom cubemap storage - thin wrapper around shaderDB cubemap functions
 * Supports uploading cubemaps as 6 separate face images or as a ZIP file
 */

import {
    addCubemapDB,
    getAllCubemapsDB,
    getCubemapDB,
    getCubemapFacesDB,
    deleteCubemapDB,
    type CustomCubemapRecord,
    type CubemapFaceRecord,
} from "@src/storage/shaderDB";

// Re-export types with simpler names
export type CustomCubemap = CustomCubemapRecord;
export type CubemapFace = CubemapFaceRecord;

/**
 * Generate a unique ID for a cubemap
 */
export function generateCubemapId(): string {
    return `cubemap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Upload a custom cubemap from 6 face files
 */
export async function uploadCustomCubemapFaces(
    name: string,
    faces: { px: File; nx: File; py: File; ny: File; pz: File; nz: File }
): Promise<Omit<CustomCubemap, 'faces'>> {
    const id = generateCubemapId();

    const cubemapFaces: CubemapFace[] = [
        { name: 'px', blob: faces.px },
        { name: 'nx', blob: faces.nx },
        { name: 'py', blob: faces.py },
        { name: 'ny', blob: faces.ny },
        { name: 'pz', blob: faces.pz },
        { name: 'nz', blob: faces.nz },
    ];

    const totalSize = cubemapFaces.reduce((sum, f) => sum + f.blob.size, 0);

    const cubemap: CustomCubemap = {
        id,
        name,
        faces: cubemapFaces,
        size: totalSize,
        createdAt: Date.now(),
    };

    await addCubemapDB(cubemap);

    // Return without faces
    const { faces: _faces, ...meta } = cubemap;
    return meta;
}

/**
 * Extract cubemap faces from a ZIP file
 * Expected structure: any of these files: px.png, nx.png, py.png, ny.png, pz.png, nz.png
 * (or .jpg, .jpeg extensions)
 */
export async function extractCubemapFromZip(zipFile: File): Promise<{
    name: string;
    faces: { px: Blob; nx: Blob; py: Blob; ny: Blob; pz: Blob; nz: Blob };
}> {
    // Dynamic import JSZip (will be available at runtime)
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipFile);

    const faces: { [key: string]: Blob | null } = {
        px: null, nx: null, py: null, ny: null, pz: null, nz: null
    };

    // Look for face files with various extensions
    const extensions = ['png', 'jpg', 'jpeg'];

    for (const fileName of Object.keys(zip.files)) {
        const lowerName = fileName.toLowerCase();
        for (const face of ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const) {
            for (const ext of extensions) {
                if (lowerName === `${face}.${ext}` || lowerName.endsWith(`/${face}.${ext}`)) {
                    faces[face] = await zip.files[fileName].async('blob');
                    break;
                }
            }
        }
    }

    // Check if all faces were found
    const missing = Object.entries(faces).filter(([_, blob]) => !blob).map(([name]) => name);
    if (missing.length > 0) {
        throw new Error(`Missing cubemap faces in ZIP: ${missing.join(', ')}. Expected files: px.png, nx.png, py.png, ny.png, pz.png, nz.png (or .jpg/.jpeg)`);
    }

    // Use ZIP filename (without extension) as cubemap name
    const name = zipFile.name.replace(/\.zip$/i, '');

    return {
        name,
        faces: faces as { px: Blob; nx: Blob; py: Blob; ny: Blob; pz: Blob; nz: Blob },
    };
}

/**
 * Upload a custom cubemap from a ZIP file
 */
export async function uploadCustomCubemapZip(zipFile: File): Promise<Omit<CustomCubemap, 'faces'>> {
    const { name, faces } = await extractCubemapFromZip(zipFile);

    // Convert blobs to files for the upload function
    const faceFiles = {
        px: new File([faces.px], 'px.png', { type: faces.px.type || 'image/png' }),
        nx: new File([faces.nx], 'nx.png', { type: faces.nx.type || 'image/png' }),
        py: new File([faces.py], 'py.png', { type: faces.py.type || 'image/png' }),
        ny: new File([faces.ny], 'ny.png', { type: faces.ny.type || 'image/png' }),
        pz: new File([faces.pz], 'pz.png', { type: faces.pz.type || 'image/png' }),
        nz: new File([faces.nz], 'nz.png', { type: faces.nz.type || 'image/png' }),
    };

    return uploadCustomCubemapFaces(name, faceFiles);
}

/**
 * Get all custom cubemaps
 */
export async function getAllCustomCubemaps(): Promise<Omit<CustomCubemap, 'faces'>[]> {
    return getAllCubemapsDB();
}

/**
 * Get a single cubemap by ID (includes face blobs)
 */
export async function getCustomCubemap(id: string): Promise<CustomCubemap | undefined> {
    return getCubemapDB(id);
}

/**
 * Get cubemap face blobs for a specific cubemap
 */
export async function getCubemapFaceBlobs(id: string): Promise<{ [key: string]: Blob } | null> {
    const faces = await getCubemapFacesDB(id);
    if (!faces) return null;

    const blobs: { [key: string]: Blob } = {};
    for (const face of faces) {
        blobs[face.name] = face.blob;
    }
    return blobs;
}

/**
 * Delete a custom cubemap
 */
export async function deleteCustomCubemap(id: string): Promise<void> {
    return deleteCubemapDB(id);
}

/**
 * Format bytes for display
 */
export function formatCubemapBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The prefix used in shader metadata channel values (e.g. iChannel0)
export const CUSTOM_CUBEMAP_PREFIX = 'custom_cubemaps/';

/**
 * Convert cubemap ID to channel reference
 */
export function cubemapIdToChannelRef(id: string): string {
    return `${CUSTOM_CUBEMAP_PREFIX}${id}`;
}

/**
 * Check if a value is a custom cubemap reference
 */
export function isCustomCubemapRef(value: string | undefined): boolean {
    return typeof value === 'string' && value.startsWith(CUSTOM_CUBEMAP_PREFIX);
}

/**
 * Extract cubemap ID from channel reference
 */
export function channelRefToCubemapId(ref: string): string | null {
    if (!isCustomCubemapRef(ref)) return null;
    return ref.slice(CUSTOM_CUBEMAP_PREFIX.length);
}

// Supported image extensions for cubemap faces
export const SUPPORTED_CUBEMAP_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
