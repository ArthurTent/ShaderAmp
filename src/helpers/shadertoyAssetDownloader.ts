/**
 * ShaderToy Asset Downloader
 * 
 * Downloads external assets (textures, videos, cubemaps) from shadertoy.com
 * and stores them as custom media in IndexedDB.
 */

import browser from "webextension-polyfill";
import {
    imageIdToChannelRef,
} from "./customImageStorage";
import {
    videoIdToChannelRef,
} from "./customVideoStorage";
import {
    cubemapIdToChannelRef,
} from "./customCubemapStorage";
import { logger } from './logger';

// Storage key for hash-to-custom-id mapping
const SHADERTOY_ASSET_HASHES_KEY = 'shadertoyAssetHashes';

interface AssetHashMapping {
    type: 'image' | 'video' | 'cubemap';
    customId: string;
    downloadedAt: string;
    originalUrl: string;
}

interface ShadertoyAssetHashMap {
    [hash: string]: AssetHashMapping;
}

/**
 * Extract the hash from a Shadertoy media filepath
 * e.g., "/media/a/94284d43be78f00eb6b298e6d78656a1b34e2b91b34940d02f1ca8b22310e8a0.png" -> "94284d43be78f00eb6b298e6d78656a1b34e2b91b34940d02f1ca8b22310e8a0"
 */
export function extractHashFromPath(filepath: string): string | null {
    const match = filepath.match(/\/media\/a\/([a-f0-9]+)(?:_[0-5])?\.[a-z0-9]+$/i);
    return match ? match[1] : null;
}

/**
 * Check if a filepath is a Shadertoy external media path
 */
export function isShadertoyExternalAsset(filepath: string): boolean {
    return filepath.startsWith('/media/a/') && !filepath.includes('/previz/');
}

/**
 * Get the base URL for downloading Shadertoy assets
 */
function getShadertoyMediaUrl(filepath: string): string {
    return `https://www.shadertoy.com${filepath}`;
}

/**
 * Convert ArrayBuffer to base64 string for message passing
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Load the hash mapping from storage
 */
async function loadHashMapping(): Promise<ShadertoyAssetHashMap> {
    const result = await browser.storage.local.get(SHADERTOY_ASSET_HASHES_KEY);
    return result[SHADERTOY_ASSET_HASHES_KEY] || {};
}

/**
 * Save the hash mapping to storage
 */
async function saveHashMapping(mapping: ShadertoyAssetHashMap): Promise<void> {
    await browser.storage.local.set({ [SHADERTOY_ASSET_HASHES_KEY]: mapping });
}

/**
 * Verify that an asset actually exists in IndexedDB (via background script for cross-origin access)
 */
async function verifyAssetExists(type: 'image' | 'video' | 'cubemap', customId: string): Promise<boolean> {
    logger.content.log('ShaderAmp', 'verifyAssetExists called: type=%s, customId=%s', type, customId);
    try {
        // Use message passing to access IndexedDB from background script (handles cross-origin isolation)
        const response = await browser.runtime.sendMessage({
            action: 'checkAssetExists',
            data: { type, customId }
        });
        logger.content.log('ShaderAmp', 'checkAssetExists response: %s', JSON.stringify(response));
        return response?.success && response.exists;
    } catch (error) {
        logger.content.error('ShaderAmp', 'Error verifying %s asset %s: %s', type, customId, error);
        return false;
    }
}

/**
 * Find an existing asset by its hash, verifying it actually exists in IndexedDB
 */
export async function findExistingAssetByHash(hash: string): Promise<AssetHashMapping | null> {
    const mapping = await loadHashMapping();
    const entry = mapping[hash];
    if (!entry) return null;
    
    // Verify the asset actually exists in IndexedDB
    const exists = await verifyAssetExists(entry.type, entry.customId);
    if (!exists) {
        logger.content.log('ShaderAmp', 'Asset %s found in mapping but not in IndexedDB, removing stale entry', hash);
        // Clean up stale mapping entry
        delete mapping[hash];
        await saveHashMapping(mapping);
        return null;
    }
    
    return entry;
}

/**
 * Fetch from browser cache using only-if-cached strategy (zero network requests)
 * Falls back to force-cache if not in cache or if only-if-cached fails
 */
async function fetchFromBrowserCache(url: string, useOnlyIfCached: boolean = true): Promise<Response> {
    if (useOnlyIfCached) {
        try {
            // Try to get from cache without any network validation (zero requests)
            const response = await fetch(url, { cache: 'only-if-cached' });
            if (response.ok) {
                logger.content.log('ShaderAmp', 'Cache hit (only-if-cached): %s', url);
                return response;
            }
        } catch (error) {
            // only-if-cached throws if not in cache, fall through to fallback
            logger.content.log('ShaderAmp', 'only-if-cached miss for %s, falling back to force-cache', url);
        }
    }
    
    // Fallback: use force-cache (may result in 304 validation request)
    logger.content.log('ShaderAmp', 'Using force-cache: %s', url);
    return fetch(url, { cache: 'force-cache' });
}

/**
 * Download a file from URL as Blob
 */
async function downloadFile(url: string, useOnlyIfCached: boolean = true): Promise<Blob> {
    const response = await fetchFromBrowserCache(url, useOnlyIfCached);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }
    return response.blob();
}

/**
 * Download a texture/image asset and store as custom image
 */
export async function downloadAndStoreTexture(
    filepath: string,
    hash: string,
    forceReDownload: boolean = false,
    useOnlyIfCached: boolean = true
): Promise<string> {
    logger.content.log('ShaderAmp', 'downloadAndStoreTexture called: filepath=%s, hash=%s..., forceReDownload=%s, useOnlyIfCached=%s', filepath, hash.substring(0, 16), forceReDownload, useOnlyIfCached);

    if (!forceReDownload) {
        const existing = await findExistingAssetByHash(hash);
        logger.content.log('ShaderAmp', 'findExistingAssetByHash result: %s', existing ? `found type=${existing.type}, id=${existing.customId}` : 'not found');
        if (existing && existing.type === 'image') {
            logger.content.log('ShaderAmp', 'Texture %s... already exists, returning %s', hash.substring(0, 16), imageIdToChannelRef(existing.customId));
            return imageIdToChannelRef(existing.customId);
        }
    } else {
        logger.content.log('ShaderAmp', 'Force re-download enabled, skipping cache check');
    }

    const url = getShadertoyMediaUrl(filepath);
    logger.content.log('ShaderAmp', 'Downloading texture from URL: %s', url);

    const blob = await downloadFile(url, useOnlyIfCached);
    logger.content.log('ShaderAmp', 'Downloaded blob: %d bytes, type=%s', blob.size, blob.type);

    // Validate blob has content
    if (!blob || blob.size === 0) {
        throw new Error(`Downloaded blob is empty for ${filepath}`);
    }
    
    // Determine mime type from filepath
    const ext = filepath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                     ext === 'png' ? 'image/png' : 
                     ext === 'webp' ? 'image/webp' : 'image/png';

    // Create a File from the Blob
    const filename = filepath.split('/').pop() || `texture_${hash}.png`;
    const file = new File([blob], filename, { type: mimeType });

    // Convert blob to base64 for message passing (avoids binary data corruption)
    const arrayBuffer = await blob.arrayBuffer();
    const base64Data = arrayBufferToBase64(arrayBuffer);
    logger.content.log('ShaderAmp', 'Converted %d bytes to base64 (%d chars)', blob.size, base64Data.length);

    // Send to background script to save in extension's IndexedDB
    const response = await browser.runtime.sendMessage({
        action: 'saveCustomImage',
        data: {
            blobBase64: base64Data,
            filename,
            mimeType,
            source: 'shadertoy'
        }
    });

    if (!response || !response.success) {
        throw new Error(`Failed to save image: ${response?.error || 'Background script returned null'}`);
    }

    const customImage = response.result;
    const channelRef = imageIdToChannelRef(customImage.id);

    // Store hash mapping
    const mapping = await loadHashMapping();
    mapping[hash] = {
        type: 'image',
        customId: customImage.id,
        downloadedAt: new Date().toISOString(),
        originalUrl: url,
    };
    await saveHashMapping(mapping);

    logger.content.log('ShaderAmp', 'Stored texture as %s', channelRef);
    return channelRef;
}

/**
 * Download a video asset and store as custom video
 */
export async function downloadAndStoreVideo(
    filepath: string,
    hash: string,
    forceReDownload: boolean = false,
    useOnlyIfCached: boolean = true
): Promise<string> {
    if (!forceReDownload) {
        const existing = await findExistingAssetByHash(hash);
        if (existing && existing.type === 'video') {
            logger.content.log('ShaderAmp', 'Video %s... already exists, returning %s', hash.substring(0, 16), videoIdToChannelRef(existing.customId));
            return videoIdToChannelRef(existing.customId);
        }
    } else {
        logger.content.log('ShaderAmp', 'Force re-download enabled for video %s...', hash.substring(0, 16));
    }

    const url = getShadertoyMediaUrl(filepath);
    logger.content.log('ShaderAmp', 'Downloading video: %s', url);

    // Determine filename
    const filename = filepath.split('/').pop() || `video_${hash}.webm`;

    // Download directly from content script - browser will serve from cache
    logger.content.log('ShaderAmp', 'Fetching video from cache: %s', url);
    const fetchResponse = await fetchFromBrowserCache(url, useOnlyIfCached);
    if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch video: ${fetchResponse.status}`);
    }
    const blob = await fetchResponse.blob();
    logger.content.log('ShaderAmp', 'Fetched %d bytes from cache', blob.size);

    // Determine mime type from blob or filename
    const mimeType = blob.type || (filename.endsWith('.webm') ? 'video/webm' : 'video/mp4');
    logger.content.log('ShaderAmp', 'Video blob type: %s', mimeType);

    // Convert blob to base64 for message passing (matching image handling)
    const arrayBuffer = await blob.arrayBuffer();
    const base64Data = arrayBufferToBase64(arrayBuffer);
    logger.content.log('ShaderAmp', 'Converted %d bytes to base64 (%d chars)', blob.size, base64Data.length);

    // Validate base64 data before sending
    if (!base64Data || base64Data.length === 0) {
        throw new Error('Failed to convert video to base64 - empty data');
    }
    logger.content.log('ShaderAmp', 'Sending video to background script: %d chars base64', base64Data.length);

    // Send to background script to save in IndexedDB
    let response;
    try {
        response = await browser.runtime.sendMessage({
            action: 'saveCustomVideo',
            data: {
                blobBase64: base64Data,
                filename,
                mimeType,
                source: 'shadertoy'
            }
        });
        logger.content.log('ShaderAmp', 'Background script response: %s', JSON.stringify(response));
    } catch (sendError) {
        logger.content.error('ShaderAmp', 'Error sending message to background: %s', sendError);
        throw new Error(`Failed to send video to background: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
    }

    if (!response) {
        throw new Error('Background script returned null response');
    }
    if (!response.success) {
        throw new Error(`Background script failed to save video: ${response.error || 'Unknown error'}`);
    }

    const customVideo = response.result;
    const channelRef = videoIdToChannelRef(customVideo.id);

    // Store hash mapping
    const mapping = await loadHashMapping();
    mapping[hash] = {
        type: 'video',
        customId: customVideo.id,
        downloadedAt: new Date().toISOString(),
        originalUrl: url,
    };
    await saveHashMapping(mapping);

    logger.content.log('ShaderAmp', 'Stored video as %s', channelRef);
    return channelRef;
}

/**
 * Download a cubemap asset (6 faces) and store as custom cubemap
 */
export async function downloadAndStoreCubemap(
    filepath: string,
    hash: string,
    forceReDownload: boolean = false,
    useOnlyIfCached: boolean = true
): Promise<string> {
    if (!forceReDownload) {
        const existing = await findExistingAssetByHash(hash);
        if (existing && existing.type === 'cubemap') {
            logger.content.log('ShaderAmp', 'Cubemap %s... already exists, returning %s', hash.substring(0, 16), cubemapIdToChannelRef(existing.customId));
            return cubemapIdToChannelRef(existing.customId);
        }
    } else {
        logger.content.log('ShaderAmp', 'Force re-download enabled for cubemap %s...', hash.substring(0, 16));
    }

    logger.content.log('ShaderAmp', 'Downloading cubemap: %s...', hash.substring(0, 16));

    // Determine file extension
    const extMatch = filepath.match(/\.[a-z0-9]+$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : '.png';

    // Download all 6 faces from cache
    const faceNames = ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const;
    const faceBlobs: { [key: string]: string } = {}; // base64 strings

    logger.content.log('ShaderAmp', 'Downloading cubemap faces from cache...');
    
    for (let i = 0; i < 6; i++) {
        const faceUrl = i === 0 
            ? getShadertoyMediaUrl(filepath)
            : getShadertoyMediaUrl(filepath.replace(ext, `_${i}${ext}`));
        logger.content.log('ShaderAmp', 'Fetching face %s: %s', faceNames[i], faceUrl);
        
        const response = await fetchFromBrowserCache(faceUrl, useOnlyIfCached);
        if (!response.ok) {
            throw new Error(`Failed to fetch face ${faceNames[i]}: ${response.status}`);
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        faceBlobs[faceNames[i]] = arrayBufferToBase64(arrayBuffer);
        logger.content.log('ShaderAmp', 'Face %s: %d bytes -> base64 (%d chars)', faceNames[i], blob.size, faceBlobs[faceNames[i]].length);
    }

    // Send to background script to save in IndexedDB
    const response = await browser.runtime.sendMessage({
        action: 'saveCustomCubemap',
        data: {
            name: `Cubemap_${hash.substring(0, 16)}`,
            faceBlobs
        }
    });

    if (!response || !response.success) {
        throw new Error(`Failed to save cubemap: ${response?.error || 'Background script returned null'}`);
    }

    const cubemapMeta = response.result;
    const channelRef = cubemapIdToChannelRef(cubemapMeta.id);

    // Store hash mapping
    const mapping = await loadHashMapping();
    mapping[hash] = {
        type: 'cubemap',
        customId: cubemapMeta.id,
        downloadedAt: new Date().toISOString(),
        originalUrl: getShadertoyMediaUrl(filepath),
    };
    await saveHashMapping(mapping);

    logger.content.log('ShaderAmp', 'Stored cubemap as %s', channelRef);
    return channelRef;
}

/**
 * Download and store an asset based on its type
 */
export async function downloadAndStoreAsset(
    filepath: string,
    type: 'texture' | 'video' | 'cubemap',
    forceReDownload: boolean = false,
    useOnlyIfCached: boolean = true
): Promise<string> {
    const hash = extractHashFromPath(filepath);
    if (!hash) {
        throw new Error(`Could not extract hash from filepath: ${filepath}`);
    }

    switch (type) {
        case 'texture':
            return downloadAndStoreTexture(filepath, hash, forceReDownload, useOnlyIfCached);
        case 'video':
            return downloadAndStoreVideo(filepath, hash, forceReDownload, useOnlyIfCached);
        case 'cubemap':
            return downloadAndStoreCubemap(filepath, hash, forceReDownload, useOnlyIfCached);
        default:
            throw new Error(`Unknown asset type: ${type}`);
    }
}

/**
 * Progress callback type for batch downloads
 */
export type DownloadProgressCallback = (
    current: number,
    total: number,
    status: string
) => void;

/**
 * Download all external assets for a shader
 */
export async function downloadShaderAssets(
    inputs: Array<{
        filepath?: string;
        type: string;
    }>,
    onProgress?: DownloadProgressCallback,
    useOnlyIfCached: boolean = true,
    forceReDownload: boolean = false  // Default to false to check cache first
): Promise<Map<string, string>> {
    const urlMapping = new Map<string, string>();
    
    // Debug: Log all inputs received
    logger.content.log('ShaderAmp', 'downloadShaderAssets received %d inputs, useOnlyIfCached=%s, forceReDownload=%s', inputs.length, useOnlyIfCached, forceReDownload);
    inputs.forEach((inp, idx) => {
        logger.content.log('ShaderAmp', '  Input %d: type=%s, filepath=%s', idx, inp.type, inp.filepath);
    });
    
    // Filter to only external assets
    const externalAssets = inputs.filter(
        inp => inp.filepath && isShadertoyExternalAsset(inp.filepath)
    );

    logger.content.log('ShaderAmp', 'Filtered to %d external assets', externalAssets.length);
    externalAssets.forEach((inp, idx) => {
        logger.content.log('ShaderAmp', '  External %d: type=%s, filepath=%s', idx, inp.type, inp.filepath);
    });

    if (externalAssets.length === 0) {
        logger.content.log('ShaderAmp', 'No external assets to download');
        return urlMapping;
    }

    const total = externalAssets.length;
    let current = 0;

    for (const asset of externalAssets) {
        const filepath = asset.filepath!;
        const hash = extractHashFromPath(filepath);
        
        if (!hash) {
            logger.content.warn('ShaderAmp', 'Could not extract hash from: %s', filepath);
            continue;
        }
        
        logger.content.log('ShaderAmp', 'Processing asset: %s (hash: %s)', filepath, hash);

        current++;
        onProgress?.(current, total, `Downloading asset ${current}/${total}...`);

        try {
            let channelRef: string;
            
            if (asset.type === 'cubemap') {
                channelRef = await downloadAndStoreCubemap(filepath, hash, forceReDownload, useOnlyIfCached);
            } else if (asset.type === 'video') {
                channelRef = await downloadAndStoreVideo(filepath, hash, forceReDownload, useOnlyIfCached);
            } else if (asset.type === 'texture') {
                channelRef = await downloadAndStoreTexture(filepath, hash, forceReDownload, useOnlyIfCached);
            } else {
                continue;
            }

            logger.content.log('ShaderAmp', 'Asset downloaded successfully: %s -> %s', filepath.substring(filepath.lastIndexOf('/') + 1), channelRef);
            urlMapping.set(filepath, channelRef);
        } catch (error) {
            logger.content.error('ShaderAmp', 'Failed to download asset %s: %s', filepath, error);
            // Continue with other assets, don't throw
        }
    }

    logger.content.log('ShaderAmp', 'Download complete. Mapped %d assets:', urlMapping.size);
    urlMapping.forEach((channelRef, filepath) => {
        logger.content.log('ShaderAmp', '  %s -> %s', filepath, channelRef);
    });

    return urlMapping;
}
