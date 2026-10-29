import browser from "webextension-polyfill";
import {
    IUniform,
    Texture,
    TextureLoader,
    CubeTexture,
    CubeTextureLoader,
    Data3DTexture,
    VideoTexture,
    LinearFilter,
    NearestFilter,
    LinearMipmapLinearFilter,
    UnsignedByteType,
    RedFormat,
    RGBAFormat,
    RepeatWrapping,
    ClampToEdgeWrapping } from "three";
import { getImageBlobDB, getVideoBlobDB, getCubemapFacesDB, getVolumeDB } from '@src/storage/shaderDB';
import { channelRefToImageId, isCustomImageRef } from '@src/helpers/customImageStorage';
import { channelRefToVideoId, isCustomVideoRef, isBundledVideoRef } from '@src/helpers/customVideoStorage';
import { channelRefToCubemapId, isCustomCubemapRef } from '@src/helpers/customCubemapStorage';
import { channelRefToVolumeId, isCustomVolumeRef } from '@src/helpers/customVolumeStorage';
import { getGreyNoise3DTexture, getRGBANoise3DTexture } from '@src/helpers/volumeNoiseGenerator';
import type { ShaderMetaData } from '@src/helpers/types';
import { logger } from '@src/helpers/logger';

const KEYBOARD_TEXTURE_WIDTH = 256;
const KEYBOARD_TEXTURE_HEIGHT = 2;

type SamplerConfig = { filter?: string; wrap?: string; vflip?: boolean };

function applySamplerToTexture(tex: any, sampler?: SamplerConfig, fallbackWrap?: number, fallbackFlipY?: boolean) {
    const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : (fallbackWrap ?? ClampToEdgeWrapping));
    tex.wrapS = wrap;
    tex.wrapT = wrap;
    if (sampler?.filter === 'nearest') {
        tex.minFilter = NearestFilter;
        tex.magFilter = NearestFilter;
        tex.generateMipmaps = false;
    } else if (sampler?.filter === 'mipmap') {
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = true;
    } else {
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = false;
    }
    tex.flipY = sampler?.vflip !== undefined ? sampler.vflip : (fallbackFlipY ?? true);
}

export type OverlayChannelResources = { dispose(): void };

// Single-pass overlay channel loader: same media kinds as the main pass but
// with its own resource tracking so the overlay can be torn down independently.
// Buffer/cubemap render-target refs are ignored (single pass, no feedback).
export function loadOverlayChannels(args: {
    meta: ShaderMetaData;                // overlay shader metaData
    uniforms: Record<string, IUniform>;  // overlay material uniforms (writes iChannel0..3, iChannelResolution)
    shared: { iAudioData: IUniform; iVideo: IUniform; iKeyboard: IUniform; iMidi: IUniform };
    videoElement: HTMLVideoElement | null; // the main background video (for 'video' channels)
    channelLoadTimes: number[];          // length 4, written with iTime at load (feeds iChannelTime)
    iTime: number;                       // current shader time at activation
}): OverlayChannelResources {
    const { meta, uniforms, shared, videoElement, channelLoadTimes, iTime } = args;
    const metaAny: any = meta || {};
    const fallbackWrap = metaAny.textureWrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
    const fallbackFlipY = metaAny.textureFlipY !== false;

    const textures: Texture[] = [];
    const urls: string[] = [];
    const videos: HTMLVideoElement[] = [];
    let disposed = false;

    const track = <T extends Texture>(t: T): T => {
        textures.push(t);
        return t;
    };

    const dispose = () => {
        disposed = true;
        textures.forEach(t => t.dispose());
        textures.length = 0;
        urls.forEach(u => URL.revokeObjectURL(u));
        urls.length = 0;
        videos.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
        videos.length = 0;
    };

    const recordChannelLoad = (channelIdx: number, texture: any, startTime: number) => {
        channelLoadTimes[channelIdx] = startTime;
        if (texture && texture.image) {
            const img = texture.image;
            uniforms.iChannelResolution?.value?.[channelIdx]?.set(img.width || 0, img.height || 0, 1.0);
        }
    };

    // Helper to load a cubemap texture
    // Supports two naming conventions:
    // 1. Suffix style: {baseName}.ext, {baseName}_1.ext ... {baseName}_5.ext (order: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z)
    // 2. Direction style: {baseDir}/px.png, nx.png, py.png, ny.png, pz.png, nz.png
    const loadCubemap = (basePath: string, channelIdx: number): CubeTexture => {
        const cubeLoader = new CubeTextureLoader();

        // Check if path contains directional names (px/nx/py/ny/pz/nz)
        const isDirectional = /\/(px|nx|py|ny|pz|nz)\.[a-z]+$/i.test(basePath);

        let faceUrls: string[];

        if (isDirectional) {
            // Directional naming: extract base directory and extension, then build face URLs
            const dirMatch = basePath.match(/^(.*)\/(px|nx|py|ny|pz|nz)(\.[a-z]+)$/i);
            if (dirMatch) {
                const baseDir = dirMatch[1];
                const ext = dirMatch[3];
                // Order: px (+X), nx (-X), py (+Y), ny (-Y), pz (+Z), nz (-Z)
                faceUrls = [
                    browser.runtime.getURL(`${baseDir}/px${ext}`),  // +X
                    browser.runtime.getURL(`${baseDir}/nx${ext}`),  // -X
                    browser.runtime.getURL(`${baseDir}/py${ext}`),  // +Y
                    browser.runtime.getURL(`${baseDir}/ny${ext}`),  // -Y
                    browser.runtime.getURL(`${baseDir}/pz${ext}`),  // +Z
                    browser.runtime.getURL(`${baseDir}/nz${ext}`),  // -Z
                ];
            } else {
                // Fallback to original path if pattern doesn't match
                faceUrls = [basePath, basePath, basePath, basePath, basePath, basePath];
            }
        } else {
            // Suffix style: {baseName}.ext, {baseName}_1.ext ... {baseName}_5.ext
            const extMatch = basePath.match(/(\.[a-z]+)$/i);
            const ext = extMatch ? extMatch[1] : '.jpg';
            const baseWithoutExt = extMatch ? basePath.slice(0, -ext.length) : basePath;
            faceUrls = [
                browser.runtime.getURL(`${baseWithoutExt}${ext}`),     // face 0: +X
                browser.runtime.getURL(`${baseWithoutExt}_1${ext}`),   // face 1: -X
                browser.runtime.getURL(`${baseWithoutExt}_2${ext}`),   // face 2: +Y
                browser.runtime.getURL(`${baseWithoutExt}_3${ext}`),   // face 3: -Y
                browser.runtime.getURL(`${baseWithoutExt}_4${ext}`),   // face 4: +Z
                browser.runtime.getURL(`${baseWithoutExt}_5${ext}`),   // face 5: -Z
            ];
        }

        logger.renderer.log('ShaderAmp', 'Loading overlay cubemap from: %s (style: %s)', basePath, isDirectional ? 'directional' : 'suffix');
        const cubeTex = track(cubeLoader.load(faceUrls,
            (tex) => { logger.renderer.log('ShaderAmp', 'Overlay cubemap loaded successfully'); recordChannelLoad(channelIdx, tex, iTime); },
            undefined,
            (err) => logger.renderer.warn('ShaderAmp', 'Overlay cubemap load error: %s', err)
        ));
        return cubeTex;
    };

    // Helper to load a custom image from IndexedDB by its blob, async
    const loadCustomImageTexture = async (
        channelRef: string,
        uniformKey: string,
        channelIdx: 0|1|2|3,
        sampler?: SamplerConfig
    ) => {
        const imageId = channelRefToImageId(channelRef);
        if (!imageId) return;
        try {
            const blob = await getImageBlobDB(imageId);
            if (disposed) return;
            if (!blob) {
                logger.renderer.warn('ShaderAmp', 'Custom image not found in IndexedDB: %s', imageId);
                return;
            }
            const objectUrl = URL.createObjectURL(blob);
            urls.push(objectUrl);
            const tex = track(new TextureLoader().load(objectUrl, (t) => {
                recordChannelLoad(channelIdx, t, iTime);
                URL.revokeObjectURL(objectUrl);
                // Remove from tracking list since it has been revoked
                const ui = urls.indexOf(objectUrl);
                if (ui >= 0) urls.splice(ui, 1);
            }));
            applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
            uniforms[uniformKey].value = tex;
        } catch (err) {
            logger.renderer.error('ShaderAmp', 'Failed to load custom image %s: %s', imageId, err);
        }
    };

    // Helper to load a custom video from IndexedDB, create a VideoTexture and assign it to a uniform
    const loadCustomVideoTexture = async (
        channelRef: string,
        uniformKey: string,
        channelIdx: 0|1|2|3,
        sampler?: SamplerConfig
    ) => {
        const videoId = channelRefToVideoId(channelRef);
        if (!videoId) return;
        try {
            const blob = await getVideoBlobDB(videoId);
            if (disposed) return;
            if (!blob) {
                logger.renderer.warn('ShaderAmp', 'Custom video not found in IndexedDB: %s', videoId);
                return;
            }
            const objectUrl = URL.createObjectURL(blob);
            urls.push(objectUrl);
            const videoEl = document.createElement('video');
            videoEl.src = objectUrl;
            videoEl.muted = true;
            videoEl.loop = true;
            videoEl.playsInline = true;
            videoEl.crossOrigin = 'anonymous';
            videos.push(videoEl);
            await new Promise<void>((resolve) => {
                const onReady = () => {
                    videoEl.removeEventListener('loadeddata', onReady);
                    videoEl.removeEventListener('canplay', onReady);
                    resolve();
                };
                if (videoEl.readyState >= 2) { resolve(); return; }
                videoEl.addEventListener('loadeddata', onReady);
                videoEl.addEventListener('canplay', onReady);
            });
            if (disposed) return;
            try { await videoEl.play(); } catch (_e) { /* ignore autoplay errors */ }
            if (disposed) return;
            const vtex = track(new VideoTexture(videoEl));
            vtex.generateMipmaps = false;
            applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
            uniforms[uniformKey].value = vtex;
            channelLoadTimes[channelIdx] = iTime;
        } catch (err) {
            logger.renderer.error('ShaderAmp', 'Failed to load custom video %s: %s', videoId, err);
        }
    };

    // Helper to load a bundled (dist/media/) video as a VideoTexture on a uniform slot
    const loadBundledVideoTexture = (
        channelRef: string,
        uniformKey: string,
        channelIdx: 0|1|2|3,
        sampler?: SamplerConfig
    ) => {
        const videoEl = document.createElement('video');
        videoEl.src = browser.runtime.getURL(channelRef);
        videoEl.muted = true;
        videoEl.loop = true;
        videoEl.playsInline = true;
        videoEl.crossOrigin = 'anonymous';
        videos.push(videoEl);
        videoEl.play().catch(() => {});
        const vtex = track(new VideoTexture(videoEl));
        vtex.generateMipmaps = false;
        applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
        uniforms[uniformKey].value = vtex;
        channelLoadTimes[channelIdx] = iTime;
    };

    // Helper to load a custom cubemap from IndexedDB
    const loadCustomCubemap = async (
        channelRef: string,
        uniformKey: string,
        channelIdx: 0|1|2|3,
        sampler?: SamplerConfig
    ) => {
        const cubemapId = channelRefToCubemapId(channelRef);
        if (!cubemapId) return;
        try {
            const faces = await getCubemapFacesDB(cubemapId);
            if (disposed) return;
            if (!faces) {
                logger.renderer.warn('ShaderAmp', 'Custom cubemap not found in IndexedDB: %s', cubemapId);
                return;
            }

            // Convert faces array to map
            const faceMap: Record<string, Blob> = {};
            for (const face of faces) {
                faceMap[face.name] = face.blob;
            }

            // Create object URLs for each face and load as CubeTexture
            const faceOrder: ('px'|'nx'|'py'|'ny'|'pz'|'nz')[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
            const faceUrls: string[] = [];

            for (const faceName of faceOrder) {
                const blob = faceMap[faceName];
                if (!blob) {
                    logger.renderer.warn('ShaderAmp', 'Missing cubemap face: %s', faceName);
                    return;
                }
                const url = URL.createObjectURL(blob);
                urls.push(url);
                faceUrls.push(url);
            }

            const cubeLoader = new CubeTextureLoader();
            const cubeTex = track(cubeLoader.load(faceUrls, (tex) => {
                recordChannelLoad(channelIdx, tex, iTime);
                // Revoke object URLs after loading
                faceUrls.forEach(url => {
                    URL.revokeObjectURL(url);
                    const ui = urls.indexOf(url);
                    if (ui >= 0) urls.splice(ui, 1);
                });
            }));
            uniforms[uniformKey].value = cubeTex;
        } catch (err) {
            logger.renderer.error('ShaderAmp', 'Failed to load custom cubemap %s: %s', cubemapId, err);
        }
    };

    // Helper to load a custom 3D volume texture from IndexedDB
    const loadCustomVolumeTexture = async (
        channelRef: string,
        uniformKey: string,
        channelIdx: 0|1|2|3,
        sampler?: SamplerConfig
    ) => {
        const volumeId = channelRefToVolumeId(channelRef);
        if (!volumeId) return;
        try {
            const record = await getVolumeDB(volumeId);
            if (disposed) return;
            if (!record) {
                logger.renderer.warn('ShaderAmp', 'Custom volume not found in IndexedDB: %s', volumeId);
                return;
            }
            const { width, height, depth, channels, blob } = record;
            if (!width || !height || !depth || !channels) {
                logger.renderer.warn('ShaderAmp', 'Custom volume metadata missing for %s', volumeId);
                return;
            }
            const arrayBuffer = await blob.arrayBuffer();
            if (disposed) return;
            const data = new Uint8Array(arrayBuffer);
            const tex = track(new Data3DTexture(data, width, height, depth));
            tex.format = channels === 1 ? RedFormat : RGBAFormat;
            tex.type = UnsignedByteType;
            tex.minFilter = LinearFilter;
            tex.magFilter = LinearFilter;
            tex.wrapS = ClampToEdgeWrapping;
            tex.wrapT = ClampToEdgeWrapping;
            tex.wrapR = ClampToEdgeWrapping;
            tex.needsUpdate = true;
            if (sampler) {
                tex.minFilter = sampler.filter === 'nearest' ? NearestFilter : sampler.filter === 'mipmap' ? LinearMipmapLinearFilter : LinearFilter;
                tex.magFilter = sampler.filter === 'nearest' ? NearestFilter : LinearFilter;
                tex.wrapS = sampler.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                tex.wrapT = sampler.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                tex.wrapR = sampler.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
            }
            uniforms[uniformKey].value = tex;
            uniforms.iChannelResolution?.value?.[channelIdx]?.set(width, height, depth);
            channelLoadTimes[channelIdx] = iTime;
            logger.renderer.log('ShaderAmp', 'Loaded custom volume %s: %dx%dx%d (%d channels)', volumeId, width, height, depth, channels);
        } catch (err) {
            logger.renderer.error('ShaderAmp', 'Failed to load custom volume %s: %s', volumeId, err);
        }
    };

    // Helper to load a texture or cubemap based on channel type
    const loadChannelTexture = (
        channelPath: string | undefined,
        defaultPath: string,
        channelType: 'texture' | 'cubemap' | undefined,
        channelIdx: 0|1|2|3,
        sampler?: SamplerConfig
    ) => {
        const texturePath = channelPath ?? defaultPath;

        if (channelType === 'cubemap') {
            // For cubemaps, use the default cubemap path if not specified
            const cubemapPath = channelPath ?? 'images/cubemaps/abc.jpg';
            return loadCubemap(cubemapPath, channelIdx);
        } else {
            // Load regular 2D texture
            const tex = track(new TextureLoader().load(browser.runtime.getURL(texturePath), (t) => {
                recordChannelLoad(channelIdx, t, iTime);
            }));
            applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
            return tex;
        }
    };

    const defaultPaths = [
        'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg',
        'images/beton_3_pexels-photo-5622880.jpeg',
        'images/NyanCatSprite.png',
        'images/NyanCatSprite.png',
    ];

    for (let i = 0; i < 4; i++) {
        const ch: string | undefined = metaAny['iChannel' + i];
        const chType = metaAny['iChannel' + i + 'Type'];
        const sampler: SamplerConfig | undefined = metaAny['iChannel' + i + 'Sampler'];
        const uniformKey = 'iChannel' + i;

        if (/^buffer\d+$/.test(ch!) || /^cubemap[A-Z]$/.test(ch!)) {
            // Multipass render-target refs have no meaning for a single-pass overlay
            uniforms[uniformKey].value = null;
        } else if (isCustomImageRef(ch)) {
            void loadCustomImageTexture(ch!, uniformKey, i as 0|1|2|3, sampler);
        } else if (isCustomVideoRef(ch)) {
            void loadCustomVideoTexture(ch!, uniformKey, i as 0|1|2|3, sampler);
        } else if (isCustomCubemapRef(ch)) {
            void loadCustomCubemap(ch!, uniformKey, i as 0|1|2|3, sampler);
        } else if (isCustomVolumeRef(ch)) {
            void loadCustomVolumeTexture(ch!, uniformKey, i as 0|1|2|3, sampler);
        } else if (isBundledVideoRef(ch)) {
            loadBundledVideoTexture(ch!, uniformKey, i as 0|1|2|3, sampler);
        } else if (ch === 'video' || chType === 'video') {
            if (videoElement) {
                const vtex = track(new VideoTexture(videoElement));
                vtex.generateMipmaps = false;
                applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
                uniforms[uniformKey].value = vtex;
                channelLoadTimes[i] = iTime;
            }
        } else if (chType === 'volume') {
            // Load 3D volume noise texture (shared singletons — never disposed here)
            const volumeTex = ch === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
            uniforms[uniformKey].value = volumeTex;
            uniforms.iChannelResolution?.value?.[i]?.set(32, 32, 32);
            channelLoadTimes[i] = iTime;
        } else if (ch === 'keyboard') {
            uniforms[uniformKey].value = shared.iKeyboard.value;
            uniforms.iChannelResolution?.value?.[i]?.set(KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, 1);
            channelLoadTimes[i] = iTime;
        } else if (ch === 'audio') {
            uniforms[uniformKey].value = shared.iAudioData.value;
            channelLoadTimes[i] = iTime;
        } else if (ch === 'midi') {
            uniforms[uniformKey].value = shared.iMidi.value;
            channelLoadTimes[i] = iTime;
        } else {
            uniforms[uniformKey].value = loadChannelTexture(ch, defaultPaths[i], chType, i as 0|1|2|3, sampler);
        }
    }

    return { dispose };
}
