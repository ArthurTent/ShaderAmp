import {
    addImageDB,
    getAllImagesDB,
    getImageBlobDB,
    deleteImageDB,
    type CustomImageRecord,
} from "@src/storage/shaderDB";

// The prefix used in shader metadata channel values (e.g. iChannel0)
export const CUSTOM_IMAGE_PREFIX = 'custom_images/';

export type CustomImage = Omit<CustomImageRecord, 'blob'>;

// Supported MIME types
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const SUPPORTED_IMAGE_EXTENSIONS = '.png,.jpg,.jpeg,.webp,.gif';

/**
 * Generate a unique ID for a custom image
 */
export function generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build the channel reference string for use in shader metadata
 */
export function imageIdToChannelRef(id: string): string {
    return `${CUSTOM_IMAGE_PREFIX}${id}`;
}

/**
 * Extract image ID from a channel reference string
 * Returns null if the value is not a custom image reference
 */
export function channelRefToImageId(ref: string): string | null {
    if (ref.startsWith(CUSTOM_IMAGE_PREFIX)) {
        return ref.slice(CUSTOM_IMAGE_PREFIX.length);
    }
    return null;
}

/**
 * Check if a channel value is a custom image reference
 */
export function isCustomImageRef(value: string | undefined): boolean {
    return typeof value === 'string' && value.startsWith(CUSTOM_IMAGE_PREFIX);
}

/**
 * Upload a File as a custom image record, storing the raw Blob in IndexedDB
 */
export async function uploadCustomImage(file: File): Promise<CustomImage> {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        throw new Error(`Unsupported image type: ${file.type}. Supported: PNG, JPG, WebP, GIF`);
    }

    const id = generateImageId();
    const record: CustomImageRecord = {
        id,
        name: file.name,
        mimeType: file.type,
        blob: file,
        size: file.size,
        addedAt: new Date().toISOString(),
    };

    await addImageDB(record);

    const { blob: _blob, ...meta } = record;
    return meta;
}

/**
 * Get all custom images (metadata only, no blob)
 */
export async function getAllCustomImages(): Promise<CustomImage[]> {
    return getAllImagesDB();
}

/**
 * Get the Blob for a custom image by ID
 */
export async function getCustomImageBlob(id: string): Promise<Blob | null> {
    return getImageBlobDB(id);
}

/**
 * Delete a custom image by ID
 */
export async function deleteCustomImage(id: string): Promise<void> {
    return deleteImageDB(id);
}

/**
 * Format bytes to a human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
