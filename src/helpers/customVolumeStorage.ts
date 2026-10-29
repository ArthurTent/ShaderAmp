/**
 * Custom 3D volume texture storage
 *
 * Supports Shadertoy-style .bin files with the header:
 *   "BIN\0" + width(uint32) + height(uint32) + depth(uint32) + channels(uint32)
 * followed by raw 8-bit voxel data.
 *
 * Headerless .vol files can be uploaded by supplying dimensions/channels manually.
 */

import {
    addVolumeDB,
    getAllVolumesDB,
    getVolumeBlobDB,
    deleteVolumeDB,
    type CustomVolumeRecord,
} from "@src/storage/shaderDB";

export type CustomVolume = Omit<CustomVolumeRecord, 'blob'>;

// The prefix used in shader metadata channel values (e.g. iChannel0)
export const CUSTOM_VOLUME_PREFIX = 'custom_volumes/';

export const SUPPORTED_VOLUME_BIN_TYPES = ['application/octet-stream', 'application/x-binary'];
export const SUPPORTED_VOLUME_EXTENSIONS = '.bin,.vol';

export interface VolumeHeader {
    width: number;
    height: number;
    depth: number;
    channels: 1 | 4;
    headerSize: number;
}

export interface VolumeUploadOptions {
    width?: number;
    height?: number;
    depth?: number;
    channels?: 1 | 4;
}

/**
 * Generate a unique ID for a custom volume
 */
export function generateVolumeId(): string {
    return `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert volume ID to channel reference
 */
export function volumeIdToChannelRef(id: string): string {
    return `${CUSTOM_VOLUME_PREFIX}${id}`;
}

/**
 * Extract volume ID from channel reference
 */
export function channelRefToVolumeId(ref: string): string | null {
    if (!isCustomVolumeRef(ref)) return null;
    return ref.slice(CUSTOM_VOLUME_PREFIX.length);
}

/**
 * Check if a value is a custom volume reference
 */
export function isCustomVolumeRef(value: string | undefined): boolean {
    return typeof value === 'string' && value.startsWith(CUSTOM_VOLUME_PREFIX);
}

/**
 * Parse a Shadertoy .bin header.
 * Returns null if the file does not start with the BIN magic.
 * Throws if the header declares dimensions that are inconsistent with the file size.
 */
export function parseVolumeHeader(buffer: ArrayBuffer): VolumeHeader | null {
    const view = new DataView(buffer);
    if (buffer.byteLength < 20) return null;

    const magic = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2)
    );
    const nullByte = view.getUint8(3);
    if (magic !== 'BIN' || nullByte !== 0) return null;

    const width = view.getUint32(4, true);
    const height = view.getUint32(8, true);
    const depth = view.getUint32(12, true);
    const channels = view.getUint32(16, true) as 1 | 4;

    if (channels !== 1 && channels !== 4) {
        throw new Error(`Unsupported channel count: ${channels}. Only 1 (grey) and 4 (RGBA) are supported.`);
    }

    const voxelCount = width * height * depth;
    const dataSize = voxelCount * channels;
    if (20 + dataSize !== buffer.byteLength) {
        throw new Error(
            `Volume header dimensions (${width}x${height}x${depth}x${channels} = ${20 + dataSize} bytes) do not match file size (${buffer.byteLength} bytes).`
        );
    }

    return { width, height, depth, channels, headerSize: 20 };
}

/**
 * Read a .bin file and extract the raw voxel data without header.
 * Returns the header too so callers can upload the trimmed blob.
 */
export function extractVolumeVoxels(file: File | Blob): Promise<{ header: VolumeHeader; voxels: Blob }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const buffer = reader.result as ArrayBuffer;
                const header = parseVolumeHeader(buffer);
                if (!header) {
                    reject(new Error('File does not have a Shadertoy .bin header (BIN\\0 + dimensions).'));
                    return;
                }
                const voxels = new Blob([new Uint8Array(buffer, header.headerSize)]);
                resolve({ header, voxels });
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read volume file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Upload a custom 3D volume texture.
 *
 * - If the file has a Shadertoy .bin header, dimensions are read from it.
 * - Otherwise `options` must provide width/height/depth/channels.
 */
export async function uploadCustomVolume(
    file: File,
    options?: VolumeUploadOptions
): Promise<CustomVolume> {
    let width: number;
    let height: number;
    let depth: number;
    let channels: 1 | 4;
    let blob: Blob;

    const buffer = await file.arrayBuffer();
    const header = parseVolumeHeader(buffer);

    if (header) {
        ({ width, height, depth, channels } = header);
        blob = new Blob([new Uint8Array(buffer, header.headerSize)]);
    } else {
        if (!options?.width || !options?.height || !options?.depth || !options?.channels) {
            throw new Error('Headerless volume files require width, height, depth, and channels to be specified.');
        }
        ({ width, height, depth, channels } = options);
        const expectedSize = width * height * depth * channels;
        if (buffer.byteLength !== expectedSize) {
            throw new Error(
                `Headerless volume size (${buffer.byteLength} bytes) does not match ${width}x${height}x${depth}x${channels} = ${expectedSize} bytes.`
            );
        }
        blob = new Blob([new Uint8Array(buffer)]);
    }

    const id = generateVolumeId();
    const record: CustomVolumeRecord = {
        id,
        name: file.name,
        width,
        height,
        depth,
        channels,
        blob,
        size: file.size,
        createdAt: Date.now(),
    };

    await addVolumeDB(record);

    const { blob: _blob, ...meta } = record;
    return meta;
}

/**
 * Get all custom volumes (metadata only)
 */
export async function getAllCustomVolumes(): Promise<CustomVolume[]> {
    return getAllVolumesDB();
}

/**
 * Get the raw voxel Blob for a volume by ID
 */
export async function getCustomVolumeBlob(id: string): Promise<Blob | null> {
    return getVolumeBlobDB(id);
}

/**
 * Delete a custom volume by ID
 */
export async function deleteCustomVolume(id: string): Promise<void> {
    return deleteVolumeDB(id);
}

/**
 * Format bytes for display
 */
export function formatVolumeBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
