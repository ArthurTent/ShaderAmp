import {
    addVideoDB,
    getAllVideosDB,
    getVideoBlobDB,
    deleteVideoDB,
    type CustomVideoRecord,
} from "@src/storage/shaderDB";

export const CUSTOM_VIDEO_PREFIX = 'custom_videos/';
export const BUNDLED_VIDEO_PREFIX = 'media/';
export type CustomVideo = Omit<CustomVideoRecord, 'blob'>;
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const SUPPORTED_VIDEO_EXTENSIONS = '.mp4,.webm';

export function generateVideoId(): string {
    return `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function videoIdToChannelRef(id: string): string {
    return `${CUSTOM_VIDEO_PREFIX}${id}`;
}

export function channelRefToVideoId(ref: string): string | null {
    if (!ref.startsWith(CUSTOM_VIDEO_PREFIX)) return null;
    return ref.slice(CUSTOM_VIDEO_PREFIX.length) || null;
}

export function isCustomVideoRef(value: string | undefined): boolean {
    return typeof value === 'string' && value.startsWith(CUSTOM_VIDEO_PREFIX);
}

export function isBundledVideoRef(value: string | undefined): boolean {
    return typeof value === 'string' && value.startsWith(BUNDLED_VIDEO_PREFIX);
}

export async function uploadCustomVideo(file: File): Promise<CustomVideo> {
    console.log(`[CustomVideoStorage] uploadCustomVideo called: ${file.name}, type=${file.type}, size=${file.size}`);
    
    if (!SUPPORTED_VIDEO_TYPES.includes(file.type)) {
        console.error(`[CustomVideoStorage] Unsupported video type: ${file.type}`);
        throw new Error(`Unsupported video type: ${file.type}. Supported: ${SUPPORTED_VIDEO_TYPES.join(', ')}`);
    }
    
    const id = generateVideoId();
    console.log(`[CustomVideoStorage] Generated video ID: ${id}`);
    
    const record: CustomVideoRecord = {
        id,
        name: file.name,
        mimeType: file.type,
        blob: file,
        size: file.size,
        addedAt: new Date().toISOString(),
    };
    
    console.log(`[CustomVideoStorage] Saving to addVideoDB...`);
    try {
        await addVideoDB(record);
        console.log(`[CustomVideoStorage] addVideoDB succeeded for ${id}`);
    } catch (dbError) {
        console.error(`[CustomVideoStorage] addVideoDB failed:`, dbError);
        throw dbError;
    }
    
    const { blob: _blob, ...meta } = record;
    console.log(`[CustomVideoStorage] Returning meta:`, meta);
    return meta;
}

export async function getAllCustomVideos(): Promise<CustomVideo[]> {
    return getAllVideosDB();
}

export async function getCustomVideoBlob(id: string): Promise<Blob | null> {
    return getVideoBlobDB(id);
}

export async function deleteCustomVideo(id: string): Promise<void> {
    return deleteVideoDB(id);
}

export function formatVideoBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
