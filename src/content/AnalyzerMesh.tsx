import React, { useEffect, useState, useRef } from 'react';
import browser from "webextension-polyfill";
import { useFrame, useThree } from '@react-three/fiber';
import type { ShaderObject, ShaderUniform } from "@src/helpers/types";
import {
    Clock,
    Cache,
    DataTexture, Data3DTexture, DoubleSide, IUniform,
    LuminanceFormat, PixelFormat,
    RedFormat, RepeatWrapping,
    TextureLoader,
    CubeTexture,
    CubeTextureLoader,
    Vector2,
    Vector3,
    Vector4,
    VideoTexture,
    WebGLRenderer,
    ShaderMaterial,
    WebGLRenderTarget,
    Scene,
    OrthographicCamera,
    PlaneGeometry,
    Mesh,
    LinearFilter,
    NearestFilter,
    LinearMipmapLinearFilter,
    HalfFloatType,
    ClampToEdgeWrapping } from "three";
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import { getEditedShader, getEditedImportedShader } from '@src/helpers/shaderStorage';
import { getImageBlobDB, getVideoBlobDB, getCubemapFacesDB } from '@src/storage/shaderDB';
import { channelRefToImageId, isCustomImageRef } from '@src/helpers/customImageStorage';
import { channelRefToVideoId, isCustomVideoRef, isBundledVideoRef } from '@src/helpers/customVideoStorage';
import { channelRefToCubemapId, isCustomCubemapRef } from '@src/helpers/customCubemapStorage';
import { getGreyNoise3DTexture, getRGBANoise3DTexture, isVolumeTextureHash } from '@src/helpers/volumeNoiseGenerator';
import css from "./styles.module.css";
import { DECR_TIME, INCR_TIME, RESET_TIME, PREV_SHADER, NEXT_SHADER } from '@src/helpers/constants';
import { SETTINGS_MIDI_ENABLED, SETTINGS_MIDI_MAPPINGS, SETTINGS_ENABLE_IAMPLIFIED_TIME, SETTINGS_JOYSTICK_ENABLED, SETTINGS_JOYSTICK_MAPPINGS, SETTINGS_EQ_GAINS } from '@src/storage/storageConstants';
import type { MidiMappings, MidiMapping, JoystickMappings } from '@src/helpers/types';
import { logger } from '@src/helpers/logger';

Cache.enabled = true;
const maxRate = 15;
const minRate = 0;
const DEFAULT_FFT_SIZE = 1024; // Default FFT size if not specified in shader metadata
const fill_color = "#4087A0" // fill color for the 2d analyzer
const min_speed = 0.3;
const default_shader_factor = 1.0;

// Keyboard state tracking (ShaderToy compatible)
// 256 keys * 4 components (key down, key pressed, key released, key time)
const KEYBOARD_TEXTURE_WIDTH = 256;
const KEYBOARD_TEXTURE_HEIGHT = 4;

// MIDI state texture: 128 notes × 4 rows (held, just-pressed, just-released, velocity)
const MIDI_TEXTURE_WIDTH = 128;
const MIDI_TEXTURE_HEIGHT = 4;
// Decay factor for MIDI-injected FFT bins (per frame)
const MIDI_FFT_DECAY = 0.85;

// Joystick state texture: 32 slots × 4 rows
// row 0: axis values (128 = centre/0.0, 0 = -1.0, 255 = +1.0)
// row 1: buttons held (255 = pressed, 0 = released)
// row 2: buttons just-pressed (255 for one frame)
// row 3: buttons just-released (255 for one frame)
const JOYSTICK_TEXTURE_WIDTH = 32;
const JOYSTICK_TEXTURE_HEIGHT = 4;

const general_purpose_vertex_shader = `
varying vec2 vUv; 
void main()
{
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`

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

type AnalyzerMeshProps = {
    analyser: AnalyserNode | undefined;
    canvas: HTMLCanvasElement | null;
    videoElement: HTMLVideoElement | null;
    shaderObject: ShaderObject;
    speedDivider: number;
    randomizeBeat?: boolean;
    randomizeBeatInterval?: number;
    shaderFade?: boolean;
    renderScale?: number;
    onShaderChangeRequested?: () => void;
}

type TUniform = { [uniform: string]: IUniform }; 
// Optional multipass buffer description coming from metaData.buffers
// Example meta:
// {
//   buffers: [
//     { shaderName: "BufferA.frag", output: 0, iChannel0: "images/foo.png" },
//     { shaderName: "BufferB.frag", output: 1, iChannel0: "buffer0" }
//   ]
// }
type BufferMeta = {
    shaderName: string;
    output: number; // 0..3 -> will map to buffer index
    // optional per-pass channel mappings (string path or the special token "buffer{index}")
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    cubemaps?: string[];
};

type BufferRuntime = {
    material: ShaderMaterial;
    scene: Scene;
    targets: [WebGLRenderTarget, WebGLRenderTarget];
    readIndex: number;
    writeIndex: number;
    channelMeta: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    channelSamplers: { iChannel0?: SamplerConfig; iChannel1?: SamplerConfig; iChannel2?: SamplerConfig; iChannel3?: SamplerConfig };
    preloaded: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

type MaterialProps = {
    clock: Clock;
    format: PixelFormat;
    tuniform: TUniform;
    // multipass
    bufferCamera?: OrthographicCamera;
    buffers?: BufferRuntime[];
    finalChannels?: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    finalPreloaded?: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

export const AnalyzerMesh = ({ analyser, canvas, videoElement, shaderObject, speedDivider, randomizeBeat = false, randomizeBeatInterval = 4, shaderFade = false, renderScale = 1.0, onShaderChangeRequested } : AnalyzerMeshProps) => {
    // Get FFT size from shader metadata or use default
    const fftSize = shaderObject.metaData?.fftSize || DEFAULT_FFT_SIZE;
    const frequencyBinCount = fftSize / 2; // frequencyBinCount is always half of fftSize
    const fbcArrayRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(frequencyBinCount)));
    const matRef = useRef<ShaderMaterial>(null);
    const previousMatRef = useRef<ShaderMaterial>(null);
    const fadeRenderTargetRef = useRef<WebGLRenderTarget | null>(null);
    const [draw_analyzer, setDrawAnalyzer] = useState(true);
    const [threeProps, setThreeProps] = useState<MaterialProps>();
    const [loadedShaderName, setLoadedShaderName] = useState<string>("");
    const [loadedShaderCode, setLoadedShaderCode] = useState<string>("");
    const [loadedRenderScale, setLoadedRenderScale] = useState<number>(renderScale);
    const [previousShaderName, setPreviousShaderName] = useState<string>("");
    const [fadeProgress, setFadeProgress] = useState<number>(1.0);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
    const { gl, viewport } = useThree();
    const stopVideoFrameRef = useRef<boolean>(false);

    // Beat detection variables
    const beatCounterRef = useRef<number>(0);
    const previousEnergyRef = useRef<number>(0);
    const beatThresholdRef = useRef<number>(1.3); // Energy threshold for beat detection

    // Keyboard state tracking refs (ShaderToy compatible)
    const keyboardStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * KEYBOARD_TEXTURE_HEIGHT)));
    const keyboardPrevStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH)));
    const keyboardPressTimeRef = useRef<Float32Array>(new Float32Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * 4)));
    const currentTimeRef = useRef<number>(0);

    // MIDI state tracking refs
    const midiStateRef = useRef<Uint8Array>(new Uint8Array(MIDI_TEXTURE_WIDTH * MIDI_TEXTURE_HEIGHT));
    const midiFftInjectionRef = useRef<Float32Array>(new Float32Array(512)); // per-bin MIDI injection values
    const midiMappingsRef = useRef<MidiMappings>([]);
    const midiEnabledRef = useRef<boolean>(false);
    const midiRelativeAccRef = useRef<Map<string, number>>(new Map());
    // Cache of EQ gains so multiple MIDI mappings bound to the same event can each
    // update their band without read-modify-write races against storage.
    const eqGainsRef = useRef<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Joystick state tracking refs
    const joystickStateRef = useRef<Uint8Array>(new Uint8Array(JOYSTICK_TEXTURE_WIDTH * JOYSTICK_TEXTURE_HEIGHT));
    const joystickMappingsRef = useRef<JoystickMappings>([]);
    const joystickEnabledRef = useRef<boolean>(false);
    const joystickDirectActiveRef = useRef<boolean>(false);
    const enableIAmplifiedTimeRef = useRef<boolean>(true);

    // Channel time tracking for iChannelTime uniform (records when each channel was first loaded)
    const channelLoadTimeRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);

    // Track object URLs created for custom image blobs so we can revoke them on cleanup
    const customImageUrlsRef = useRef<string[]>([]);

    // Track custom video elements and their object URLs for cleanup
    const customVideoElementsRef = useRef<HTMLVideoElement[]>([]);
    const customVideoUrlsRef = useRef<string[]>([]);

    // Number of warmup passes to run when multipass buffers are first set up.
    // Needed to prime the dependency chain (e.g. Buffer A must write frame.z before
    // Buffer C reads it), otherwise a 1/0 divide produces NaN that persists forever.
    const bufferWarmupRef = useRef<number>(0);

    // Beat detection function
    const detectBeat = (fbcArray: Uint8Array): boolean => {
        // Calculate energy (sum of all frequency values)
        const currentEnergy = fbcArray.reduce((sum, value) => sum + value * value, 0);
        
        // Simple energy-based beat detection
        // A beat is detected if the current energy is significantly higher than the previous energy
        if (previousEnergyRef.current > 0) {
            const energyRatio = currentEnergy / previousEnergyRef.current;
            
            if (energyRatio > beatThresholdRef.current) {
                previousEnergyRef.current = currentEnergy;
                return true;
            }
        }
        
        previousEnergyRef.current = currentEnergy;
        return false;
    };

    // Configure analyser FFT size
    /*
    // using this will cause the shader to not work correctly
    // it will cut the high frequencies
    // it is not needed for the shader to work
    useEffect(() => {
        if (analyser) {
            analyser.fftSize = fftSize;
            console.log(`[ShaderAmp] Set analyser fftSize to ${fftSize} (frequencyBinCount: ${analyser.frequencyBinCount})`);
        }
    }, [analyser, fftSize]);
    */
   
    // Await video readiness so the initial VideoTexture has valid content
    const waitForVideoReady = (video: HTMLVideoElement) => new Promise<void>((resolve) => {
        if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) {
            resolve();
            return;
        }
        const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            resolve();
        };
        video.addEventListener('loadeddata', onReady);
        video.addEventListener('canplay', onReady);
    });

    const loadFragmentShader = async () => {
        logger.renderer.log('AnalyzerMesh', 'Loading shader: %s', shaderObject.shaderName);
        logger.renderer.log('SA', 'metaData.buffers: %s', JSON.stringify((shaderObject.metaData as any)?.buffers));
        logger.renderer.log('SA', 'inlineBuffers keys: %s', Object.keys(shaderObject.inlineBuffers || {}).join(', '));

        const meta = shaderObject.metaData as any;
        const fallbackWrap = meta?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
        const fallbackFlipY = meta?.textureFlipY !== false;

        const video = videoElement!;
        // improve autoplay reliability for shaders using iVideo
        // allow video decoding without tainting canvas
        // @ts-ignore
        video.crossOrigin = 'anonymous';
        video.muted = true;
        // @ts-ignore playsInline is valid on HTMLVideoElement at runtime
        video.playsInline = true;
        video.loop = true;
        video.src = shaderObject.metaData?.video ?? browser.runtime.getURL('media/SpaceTravel1Min.mp4');
        await waitForVideoReady(video);
        try { await video.play(); } catch (e) { /* ignore autoplay interruptions */ }

        const tuniform = threeProps!.tuniform;
        // Recreate the VideoTexture after (re)setting the video src to ensure correct binding
        const vtex = new VideoTexture(video);
        vtex.generateMipmaps = false;
        // Ensure linear sampling and clamp-to-edge
        vtex.minFilter = LinearFilter;
        vtex.magFilter = LinearFilter;
        vtex.wrapS = ClampToEdgeWrapping;
        vtex.wrapT = ClampToEdgeWrapping;
        tuniform.iVideo.value = vtex;

        // Prefer requestVideoFrameCallback to drive texture uploads exactly when a new frame arrives
        const anyVideo: any = video;
        stopVideoFrameRef.current = false;
        if (typeof anyVideo.requestVideoFrameCallback === 'function') {
            const cb = (_now: number, _meta: any) => {
                if (stopVideoFrameRef.current) return;
                (tuniform.iVideo.value as VideoTexture).needsUpdate = true;
                anyVideo.requestVideoFrameCallback(cb);
            };
            anyVideo.requestVideoFrameCallback(cb);
        } else {
            // Fallback to timeupdate event
            const onTimeUpdate = () => {
                (tuniform.iVideo.value as VideoTexture).needsUpdate = true;
            };
            video.addEventListener('timeupdate', onTimeUpdate);
            // Ensure removal on unmount
            // store for cleanup
            (video as any).__onTimeUpdateShaderAmp = onTimeUpdate;
        }

        // Helper to check if a meta channel references a buffer token like "buffer0" or cubemap buffer like "cubemapA"
        const isBufferRef = (s?: string) => !!s && (/^buffer(\d+)$/.test(s) || /^cubemap[A-Z]$/.test(s));

        // Helper to record channel load time and resolution
        const recordChannelLoad = (channelIdx: number, texture: any, startTime: number) => {
            channelLoadTimeRef.current[channelIdx] = startTime;
            if (texture && texture.image) {
                const img = texture.image;
                tuniform.iChannelResolution.value[channelIdx].set(img.width || 0, img.height || 0, 1.0);
            }
        };

        const currentTime = tuniform.iTime.value;

        // Helper to load a cubemap texture
        // Supports two naming conventions:
        // 1. Suffix style: {baseName}.ext, {baseName}_1.ext ... {baseName}_5.ext (order: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z)
        // 2. Direction style: {baseDir}/px.png, nx.png, py.png, ny.png, pz.png, nz.png
        const loadCubemap = (basePath: string): CubeTexture => {
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

            logger.renderer.log('ShaderAmp', 'Loading cubemap from: %s (style: %s)', basePath, isDirectional ? 'directional' : 'suffix');
            const cubeTex = cubeLoader.load(faceUrls,
                (tex) => { logger.renderer.log('ShaderAmp', 'Cubemap loaded successfully'); recordChannelLoad(0, tex, currentTime); },
                undefined,
                (err) => logger.renderer.warn('ShaderAmp', 'Cubemap load error: %s', err)
            );
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
                if (!blob) {
                    logger.renderer.warn('ShaderAmp', 'Custom image not found in IndexedDB: %s', imageId);
                    return;
                }
                const objectUrl = URL.createObjectURL(blob);
                customImageUrlsRef.current.push(objectUrl);
                const tex = new TextureLoader().load(objectUrl, (t) => {
                    recordChannelLoad(channelIdx, t, currentTime);
                    URL.revokeObjectURL(objectUrl);
                    // Remove from tracking list since it has been revoked
                    customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== objectUrl);
                });
                applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
                tuniform[uniformKey].value = tex;
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
                if (!blob) {
                    logger.renderer.warn('ShaderAmp', 'Custom video not found in IndexedDB: %s', videoId);
                    return;
                }
                const objectUrl = URL.createObjectURL(blob);
                customVideoUrlsRef.current.push(objectUrl);
                const videoEl = document.createElement('video');
                videoEl.src = objectUrl;
                videoEl.muted = true;
                videoEl.loop = true;
                videoEl.playsInline = true;
                videoEl.crossOrigin = 'anonymous';
                customVideoElementsRef.current.push(videoEl);
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
                try { await videoEl.play(); } catch (_e) { /* ignore autoplay errors */ }
                const vtex = new VideoTexture(videoEl);
                vtex.generateMipmaps = false;
                applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
                tuniform[uniformKey].value = vtex;
                channelLoadTimeRef.current[channelIdx] = tuniform.iTime.value;
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
            customVideoElementsRef.current.push(videoEl);
            videoEl.play().catch(() => {});
            const vtex = new VideoTexture(videoEl);
            vtex.generateMipmaps = false;
            applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
            tuniform[uniformKey].value = vtex;
            channelLoadTimeRef.current[channelIdx] = tuniform.iTime.value;
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
                    customImageUrlsRef.current.push(url);
                    faceUrls.push(url);
                }

                const cubeLoader = new CubeTextureLoader();
                const cubeTex = cubeLoader.load(faceUrls, (tex) => {
                    recordChannelLoad(channelIdx, tex, currentTime);
                    // Revoke object URLs after loading
                    faceUrls.forEach(url => {
                        URL.revokeObjectURL(url);
                        customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== url);
                    });
                });
                tuniform[uniformKey].value = cubeTex;
            } catch (err) {
                logger.renderer.error('ShaderAmp', 'Failed to load custom cubemap %s: %s', cubemapId, err);
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
                return loadCubemap(cubemapPath);
            } else {
                // Load regular 2D texture
                const tex = new TextureLoader().load(browser.runtime.getURL(texturePath), (t) => {
                    recordChannelLoad(channelIdx, t, currentTime);
                });
                applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
                return tex;
            }
        };

        // Get channel types and per-channel samplers from metadata
        const ch0Type = meta?.iChannel0Type;
        const ch1Type = meta?.iChannel1Type;
        const ch2Type = meta?.iChannel2Type;
        const ch3Type = meta?.iChannel3Type;

        // Only load file textures when meta iChannelN is not a buffer reference. Otherwise, leave to multipass setup.
        const ch0 = shaderObject.metaData?.iChannel0;
        if (!isBufferRef(ch0)) {
            if (isCustomImageRef(ch0)) {
                loadCustomImageTexture(ch0!, 'iChannel0', 0, meta?.iChannel0Sampler);
            } else if (isCustomVideoRef(ch0)) {
                loadCustomVideoTexture(ch0!, 'iChannel0', 0, meta?.iChannel0Sampler);
            } else if (isCustomCubemapRef(ch0)) {
                loadCustomCubemap(ch0!, 'iChannel0', 0, meta?.iChannel0Sampler);
            } else if (isBundledVideoRef(ch0)) {
                loadBundledVideoTexture(ch0!, 'iChannel0', 0, meta?.iChannel0Sampler);
            } else if (ch0 === 'video' || ch0Type === 'video') {
                const vtex0 = new VideoTexture(videoElement as HTMLVideoElement);
                vtex0.generateMipmaps = false;
                applySamplerToTexture(vtex0, meta?.iChannel0Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel0.value = vtex0;
                channelLoadTimeRef.current[0] = tuniform.iTime.value;
            } else if (ch0Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch0 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel0.value = volumeTex;
                channelLoadTimeRef.current[0] = tuniform.iTime.value;
            } else {
                tuniform.iChannel0.value = loadChannelTexture(
                    ch0,
                    'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg',
                    ch0Type,
                    0,
                    meta?.iChannel0Sampler
                );
            }
        }

        const ch1 = shaderObject.metaData?.iChannel1;
        if (!isBufferRef(ch1)) {
            if (isCustomImageRef(ch1)) {
                loadCustomImageTexture(ch1!, 'iChannel1', 1, meta?.iChannel1Sampler);
            } else if (isCustomVideoRef(ch1)) {
                loadCustomVideoTexture(ch1!, 'iChannel1', 1, meta?.iChannel1Sampler);
            } else if (isCustomCubemapRef(ch1)) {
                loadCustomCubemap(ch1!, 'iChannel1', 1, meta?.iChannel1Sampler);
            } else if (isBundledVideoRef(ch1)) {
                loadBundledVideoTexture(ch1!, 'iChannel1', 1, meta?.iChannel1Sampler);
            } else if (ch1 === 'video' || ch1Type === 'video') {
                const vtex1 = new VideoTexture(videoElement as HTMLVideoElement);
                vtex1.generateMipmaps = false;
                applySamplerToTexture(vtex1, meta?.iChannel1Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel1.value = vtex1;
                channelLoadTimeRef.current[1] = tuniform.iTime.value;
            } else if (ch1Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch1 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel1.value = volumeTex;
                channelLoadTimeRef.current[1] = tuniform.iTime.value;
            } else {
                tuniform.iChannel1.value = loadChannelTexture(
                    ch1,
                    'images/beton_3_pexels-photo-5622880.jpeg',
                    ch1Type,
                    1,
                    meta?.iChannel1Sampler
                );
            }
        }

        const ch2 = shaderObject.metaData?.iChannel2;
        if (!isBufferRef(ch2)) {
            if (isCustomImageRef(ch2)) {
                loadCustomImageTexture(ch2!, 'iChannel2', 2, meta?.iChannel2Sampler);
            } else if (isCustomVideoRef(ch2)) {
                loadCustomVideoTexture(ch2!, 'iChannel2', 2, meta?.iChannel2Sampler);
            } else if (isCustomCubemapRef(ch2)) {
                loadCustomCubemap(ch2!, 'iChannel2', 2, meta?.iChannel2Sampler);
            } else if (isBundledVideoRef(ch2)) {
                loadBundledVideoTexture(ch2!, 'iChannel2', 2, meta?.iChannel2Sampler);
            } else if (ch2 === 'video' || ch2Type === 'video') {
                const vtex2 = new VideoTexture(videoElement as HTMLVideoElement);
                vtex2.generateMipmaps = false;
                applySamplerToTexture(vtex2, meta?.iChannel2Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel2.value = vtex2;
                channelLoadTimeRef.current[2] = tuniform.iTime.value;
            } else if (ch2Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch2 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel2.value = volumeTex;
                channelLoadTimeRef.current[2] = tuniform.iTime.value;
            } else {
                tuniform.iChannel2.value = loadChannelTexture(
                    ch2,
                    'images/NyanCatSprite.png',
                    ch2Type,
                    2,
                    meta?.iChannel2Sampler
                );
            }
        }

        const ch3 = shaderObject.metaData?.iChannel3;
        if (!isBufferRef(ch3)) {
            if (isCustomImageRef(ch3)) {
                loadCustomImageTexture(ch3!, 'iChannel3', 3, meta?.iChannel3Sampler);
            } else if (isCustomVideoRef(ch3)) {
                loadCustomVideoTexture(ch3!, 'iChannel3', 3, meta?.iChannel3Sampler);
            } else if (isCustomCubemapRef(ch3)) {
                loadCustomCubemap(ch3!, 'iChannel3', 3, meta?.iChannel3Sampler);
            } else if (isBundledVideoRef(ch3)) {
                loadBundledVideoTexture(ch3!, 'iChannel3', 3, meta?.iChannel3Sampler);
            } else if (ch3 === 'video' || ch3Type === 'video') {
                const vtex3 = new VideoTexture(videoElement as HTMLVideoElement);
                vtex3.generateMipmaps = false;
                applySamplerToTexture(vtex3, meta?.iChannel3Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel3.value = vtex3;
                channelLoadTimeRef.current[3] = tuniform.iTime.value;
            } else if (ch3Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch3 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel3.value = volumeTex;
                channelLoadTimeRef.current[3] = tuniform.iTime.value;
            } else {
                tuniform.iChannel3.value = loadChannelTexture(
                    ch3,
                    'images/NyanCatSprite.png',
                    ch3Type,
                    3,
                    meta?.iChannel3Sampler
                );
            }
        }

        const material = matRef.current as ShaderMaterial;
        
        // Check for edited shader versions before loading
        let editedShaderCode: string | undefined;
        if (!shaderObject.inlineCode) {
            // Check if this is a built-in shader with an edited version
            const editedShader = await getEditedShader(shaderObject.shaderName);
            if (editedShader?.inlineCode) {
                editedShaderCode = editedShader.inlineCode;
                logger.renderer.log('AnalyzerMesh', 'Using edited version of %s', shaderObject.shaderName);
            }
        }
        
        // Use inline code if available (edited, imported, or Shadertoy shaders), otherwise fetch from file
        const loadedFragmentShader = shaderObject.inlineCode 
            ? shaderObject.inlineCode 
            : editedShaderCode
            ? editedShaderCode
            : await fetchFragmentShader(shaderObject.shaderName);
        
        let processedShader = loadedFragmentShader;
        // Inject transition opacity code for perfect fades
        if (processedShader && !processedShader.includes('iTransitionOpacity')) {
            processedShader = 'uniform float iTransitionOpacity;\n' + processedShader;
            processedShader = processedShader.replace(/\bvoid\s+main\s*\(\s*(void)?\s*\)/g, 'void shaderamp_main_fade()');
            processedShader += '\nvoid main() {\n    shaderamp_main_fade();\n    gl_FragColor *= iTransitionOpacity;\n}\n';
        }
        
        // Store previous material if we're fading
        if (shaderFade && material.fragmentShader && loadedShaderName && material.fragmentShader !== processedShader) {
            logger.renderer.log('AnalyzerMesh', 'Storing previous shader material for fade');
            const clonedMaterial = material.clone();
            
            // Preserve the previous shader's current time values for smooth animation continuity
            if (clonedMaterial.uniforms.iAmplifiedTime) {
                clonedMaterial.uniforms.iAmplifiedTime.value = material.uniforms.iAmplifiedTime?.value || 0.1;
            }
            if (clonedMaterial.uniforms.iTime) {
                clonedMaterial.uniforms.iTime.value = material.uniforms.iTime?.value || 0.1;
            }
            
            (previousMatRef.current as any) = clonedMaterial;
        }
        
        material.fragmentShader = processedShader;
        material.needsUpdate = true;
    }

    // Resolve a channel value that can be a texture path or a buffer reference like "buffer0"
    const resolveChannelValue = (src: string | undefined, bufferTargets: (WebGLRenderTarget|undefined)[] | undefined) => {
        if (!src) return undefined;
        const m = src.match(/^buffer(\d+)$/);
        if (m && bufferTargets) {
            const idx = parseInt(m[1], 10);
            return bufferTargets[idx] ? (bufferTargets[idx] as WebGLRenderTarget).texture : undefined;
        }
        const tex = new TextureLoader().load(browser.runtime.getURL(src));
        tex.flipY = false;
        return tex;
    }

    // Initialize optional multipass buffers described in shaderObject.metaData.buffers
    const setupMultipassBuffers = async () => {
        if (!threeProps) return;
        const meta: any = shaderObject.metaData || {};
        const fallbackWrap = meta?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
        const fallbackFlipY = meta?.textureFlipY !== false;
        let buffersMeta: BufferMeta[] | undefined = meta?.buffers;
        if (!buffersMeta || buffersMeta.length === 0) {
            setThreeProps({ ...threeProps, buffers: [], bufferCamera: undefined });
            return;
        }

        // Ensure deterministic rendering order (lower outputs first)
        buffersMeta = [...buffersMeta].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
        logger.renderer.log('SA', 'buffersMeta: %s', JSON.stringify(buffersMeta));

        const width = Math.max(1, Math.round(window.innerWidth * renderScale));
        const height = Math.max(1, Math.round(window.innerHeight * renderScale));
        const bufferRuntimes: BufferRuntime[] = [];

        // Shared full-screen quad setup
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new PlaneGeometry(2, 2);

        const baseUniforms = threeProps.tuniform; // share time/audio/resolution by reference across passes

        // Create per-pass uniforms that share time/audio/resolution, but have dedicated iChannel uniforms
        const makePassUniforms = (shared: TUniform): TUniform => {
            const base: TUniform = {
                iAmplifiedTime: shared.iAmplifiedTime,
                iTime: shared.iTime,
                iTimeDelta: shared.iTimeDelta,
                iDate: shared.iDate,
                iAudioData: shared.iAudioData,
                iResolution: shared.iResolution,
                iVideo: shared.iVideo,
                iMouse: shared.iMouse,
                iKeyboard: shared.iKeyboard,
                iMidi: shared.iMidi,
                iJoystick: shared.iJoystick,
                iFrame: shared.iFrame,
                iFrameRate: shared.iFrameRate,
                iChannelTime: shared.iChannelTime,
                iSampleRate: shared.iSampleRate,
                iChannelResolution: shared.iChannelResolution,
                iChannel0: { value: undefined },
                iChannel1: { value: undefined },
                iChannel2: { value: undefined },
                iChannel3: { value: undefined },
            } as TUniform;
            // Share custom uniforms by reference so storage/MIDI mutations propagate automatically
            const knownKeys = new Set(Object.keys(base));
            for (const key of Object.keys(shared)) {
                if (!knownKeys.has(key)) {
                    (base as any)[key] = shared[key];
                }
            }
            return base;
        }

        // helper to preload non-buffer textures once
        const preloadIfPath = (src?: string, channelName?: string, cubemapsList?: string[], sampler?: SamplerConfig, chType?: string) => {
            if (!src) return undefined;
            const m = src.match(/^buffer(\d+)$/);
            if (m) return undefined;
            // Cubemap buffers (e.g., cubemapA, cubemapB) are render targets, not image files
            if (src.match(/^cubemap[A-Z]$/)) return undefined;
            // Volume textures are loaded asynchronously
            if (chType === 'volume') return undefined;
            // Custom images/videos/cubemaps and bundled videos are loaded async or handled separately
            if (isCustomImageRef(src)) return undefined;
            if (isCustomVideoRef(src)) return undefined;
            if (isCustomCubemapRef(src)) return undefined;
            if (isBundledVideoRef(src)) return undefined;
            if (channelName && cubemapsList?.includes(channelName)) {
                // Load cubemap using face-based naming convention
                const extMatch = src.match(/(\.[a-z]+)$/i);
                const ext = extMatch ? extMatch[1] : '.jpg';
                const baseWithoutExt = extMatch ? src.slice(0, -ext.length) : src;
                const faceUrls = [
                    browser.runtime.getURL(`${baseWithoutExt}${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_1${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_2${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_3${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_4${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_5${ext}`),
                ];
                return new CubeTextureLoader().load(faceUrls);
            }
            const tex = new TextureLoader().load(browser.runtime.getURL(src));
            applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
            return tex;
        };

        // Create all targets and materials first (double-buffered)
        for (let i = 0; i < buffersMeta.length; i++) {
            const b = buffersMeta[i];
            const targetA = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: HalfFloatType });
            targetA.texture.generateMipmaps = false; targetA.texture.minFilter = LinearFilter; targetA.texture.magFilter = LinearFilter;
            const targetB = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: HalfFloatType });
            targetB.texture.generateMipmaps = false; targetB.texture.minFilter = LinearFilter; targetB.texture.magFilter = LinearFilter;

            // Use inline buffer code if available (from edited shaders, original, or fetch from file)
            let bufferCode: string;
            if (shaderObject.inlineBuffers?.[b.shaderName]) {
                bufferCode = shaderObject.inlineBuffers[b.shaderName];
            } else {
                // Check for edited buffer shader
                const editedShader = await getEditedShader(shaderObject.shaderName);
                if (editedShader?.inlineBuffers?.[b.shaderName]) {
                    bufferCode = editedShader.inlineBuffers[b.shaderName];
                    logger.renderer.log('AnalyzerMesh', 'Using edited buffer %s', b.shaderName);
                } else {
                    bufferCode = await fetchFragmentShader(b.shaderName);
                }
            }
            
            const mat = new ShaderMaterial({
                vertexShader: general_purpose_vertex_shader,
                fragmentShader: bufferCode,
                uniforms: makePassUniforms(baseUniforms),
            });
            const scene = new Scene();
            const quad = new Mesh(geometry, mat);
            scene.add(quad);

            logger.renderer.log('SA', 'Buffer %s hasAudioData: %s, iChannel0: %s, iChannel1: %s', b.shaderName, bufferCode.includes('iAudioData'), b.iChannel0, b.iChannel1);
            bufferRuntimes[b.output] = {
                material: mat,
                scene,
                targets: [targetA, targetB],
                readIndex: 0,
                writeIndex: 1,
                channelMeta: { iChannel0: b.iChannel0, iChannel1: b.iChannel1, iChannel2: b.iChannel2, iChannel3: b.iChannel3 },
                channelSamplers: {
                    iChannel0: (b as any).iChannel0Sampler,
                    iChannel1: (b as any).iChannel1Sampler,
                    iChannel2: (b as any).iChannel2Sampler,
                    iChannel3: (b as any).iChannel3Sampler,
                },
                preloaded: {
                    iChannel0: preloadIfPath(b.iChannel0, "iChannel0", b.cubemaps, (b as any).iChannel0Sampler, (b as any).iChannel0Type),
                    iChannel1: preloadIfPath(b.iChannel1, "iChannel1", b.cubemaps, (b as any).iChannel1Sampler, (b as any).iChannel1Type),
                    iChannel2: preloadIfPath(b.iChannel2, "iChannel2", b.cubemaps, (b as any).iChannel2Sampler, (b as any).iChannel2Type),
                    iChannel3: preloadIfPath(b.iChannel3, "iChannel3", b.cubemaps, (b as any).iChannel3Sampler, (b as any).iChannel3Type),
                }
            };
        }

        // Async-load custom images/videos for buffer channel slots
        for (let i = 0; i < buffersMeta.length; i++) {
            const b = buffersMeta[i];
            const br = bufferRuntimes[b.output];
            const channelEntries: [string, string | undefined, SamplerConfig | undefined, string | undefined, 0|1|2|3][] = [
                ['iChannel0', b.iChannel0, (b as any).iChannel0Sampler, (b as any).iChannel0Type, 0],
                ['iChannel1', b.iChannel1, (b as any).iChannel1Sampler, (b as any).iChannel1Type, 1],
                ['iChannel2', b.iChannel2, (b as any).iChannel2Sampler, (b as any).iChannel2Type, 2],
                ['iChannel3', b.iChannel3, (b as any).iChannel3Sampler, (b as any).iChannel3Type, 3],
            ];
            for (const [key, src, sampler, chType, _idx] of channelEntries) {
                if (isBundledVideoRef(src)) {
                    const bvid = document.createElement('video');
                    bvid.src = browser.runtime.getURL(src!);
                    bvid.muted = true; bvid.loop = true; bvid.playsInline = true; bvid.crossOrigin = 'anonymous';
                    customVideoElementsRef.current.push(bvid);
                    bvid.play().catch(() => {});
                    const bvtex2 = new VideoTexture(bvid);
                    bvtex2.generateMipmaps = false;
                    applySamplerToTexture(bvtex2, sampler, fallbackWrap, fallbackFlipY);
                    (br.preloaded as any)[key] = bvtex2;
                } else if (chType === 'video' && !isCustomVideoRef(src)) {
                    const bvtex = new VideoTexture(videoElement as HTMLVideoElement);
                    bvtex.generateMipmaps = false;
                    applySamplerToTexture(bvtex, sampler, fallbackWrap, fallbackFlipY);
                    (br.preloaded as any)[key] = bvtex;
                } else if (chType === 'volume') {
                    // Load 3D volume noise texture for buffer
                    const volumeTex = src === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                    (br.preloaded as any)[key] = volumeTex;
                } else if (isCustomImageRef(src)) {
                    const imageId = channelRefToImageId(src!);
                    if (imageId) {
                        getImageBlobDB(imageId).then(blob => {
                            if (!blob) return;
                            const objectUrl = URL.createObjectURL(blob);
                            customImageUrlsRef.current.push(objectUrl);
                            const tex = new TextureLoader().load(objectUrl, (t) => {
                                URL.revokeObjectURL(objectUrl);
                                customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== objectUrl);
                            });
                            applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
                            (br.preloaded as any)[key] = tex;
                        }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom image for buffer %s: %s', key, err));
                    }
                } else if (isCustomVideoRef(src)) {
                    const videoId = channelRefToVideoId(src!);
                    if (videoId) {
                        getVideoBlobDB(videoId).then(async blob => {
                            if (!blob) return;
                            const objectUrl = URL.createObjectURL(blob);
                            customVideoUrlsRef.current.push(objectUrl);
                            const videoEl = document.createElement('video');
                            videoEl.src = objectUrl;
                            videoEl.muted = true;
                            videoEl.loop = true;
                            videoEl.playsInline = true;
                            videoEl.crossOrigin = 'anonymous';
                            customVideoElementsRef.current.push(videoEl);
                            await new Promise<void>((resolve) => {
                                if (videoEl.readyState >= 2) { resolve(); return; }
                                const onReady = () => { videoEl.removeEventListener('loadeddata', onReady); videoEl.removeEventListener('canplay', onReady); resolve(); };
                                videoEl.addEventListener('loadeddata', onReady);
                                videoEl.addEventListener('canplay', onReady);
                            });
                            try { await videoEl.play(); } catch (_e) { /* ignore */ }
                            const vtex = new VideoTexture(videoEl);
                            vtex.generateMipmaps = false;
                            applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
                            (br.preloaded as any)[key] = vtex;
                        }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom video for buffer %s: %s', key, err));
                    }
                } else if (isCustomCubemapRef(src)) {
                    const cubemapId = channelRefToCubemapId(src!);
                    if (cubemapId) {
                        getCubemapFacesDB(cubemapId).then(faces => {
                            if (!faces) return;
                            // Convert faces array to map
                            const faceMap: Record<string, Blob> = {};
                            for (const face of faces) {
                                faceMap[face.name] = face.blob;
                            }
                            const faceOrder: ('px'|'nx'|'py'|'ny'|'pz'|'nz')[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
                            const faceUrls: string[] = [];
                            for (const faceName of faceOrder) {
                                const blob = faceMap[faceName];
                                if (!blob) return;
                                const url = URL.createObjectURL(blob);
                                customImageUrlsRef.current.push(url);
                                faceUrls.push(url);
                            }
                            const cubeLoader = new CubeTextureLoader();
                            const cubeTex = cubeLoader.load(faceUrls, () => {
                                faceUrls.forEach(url => {
                                    URL.revokeObjectURL(url);
                                    customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== url);
                                });
                            });
                            (br.preloaded as any)[key] = cubeTex;
                        }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom cubemap for buffer %s: %s', key, err));
                    }
                }
            }
        }

        // Prepare final pass channel mapping and preloads
        const finalMeta = shaderObject.metaData as any || {};
        const finalChannels = { iChannel0: finalMeta?.iChannel0, iChannel1: finalMeta?.iChannel1, iChannel2: finalMeta?.iChannel2, iChannel3: finalMeta?.iChannel3 };
        const finalPreloaded = {
            iChannel0: preloadIfPath(finalChannels.iChannel0, "iChannel0", finalMeta?.cubemaps, finalMeta?.iChannel0Sampler, finalMeta?.iChannel0Type),
            iChannel1: preloadIfPath(finalChannels.iChannel1, "iChannel1", finalMeta?.cubemaps, finalMeta?.iChannel1Sampler, finalMeta?.iChannel1Type),
            iChannel2: preloadIfPath(finalChannels.iChannel2, "iChannel2", finalMeta?.cubemaps, finalMeta?.iChannel2Sampler, finalMeta?.iChannel2Type),
            iChannel3: preloadIfPath(finalChannels.iChannel3, "iChannel3", finalMeta?.cubemaps, finalMeta?.iChannel3Sampler, finalMeta?.iChannel3Type),
        };

        // Async-load custom images/videos for final pass channels
        const finalChannelEntries: [string, string | undefined, SamplerConfig | undefined, string | undefined, 0|1|2|3][] = [
            ['iChannel0', finalChannels.iChannel0, finalMeta?.iChannel0Sampler, finalMeta?.iChannel0Type, 0],
            ['iChannel1', finalChannels.iChannel1, finalMeta?.iChannel1Sampler, finalMeta?.iChannel1Type, 1],
            ['iChannel2', finalChannels.iChannel2, finalMeta?.iChannel2Sampler, finalMeta?.iChannel2Type, 2],
            ['iChannel3', finalChannels.iChannel3, finalMeta?.iChannel3Sampler, finalMeta?.iChannel3Type, 3],
        ];
        for (const [key, src, sampler, chType, _idx] of finalChannelEntries) {
            if (isBundledVideoRef(src)) {
                const fvid = document.createElement('video');
                fvid.src = browser.runtime.getURL(src!);
                fvid.muted = true; fvid.loop = true; fvid.playsInline = true; fvid.crossOrigin = 'anonymous';
                customVideoElementsRef.current.push(fvid);
                fvid.play().catch(() => {});
                const fvtex2 = new VideoTexture(fvid);
                fvtex2.generateMipmaps = false;
                applySamplerToTexture(fvtex2, sampler, fallbackWrap, fallbackFlipY);
                (finalPreloaded as any)[key] = fvtex2;
            } else if (chType === 'video' && !isCustomVideoRef(src)) {
                const fvtex = new VideoTexture(videoElement as HTMLVideoElement);
                fvtex.generateMipmaps = false;
                applySamplerToTexture(fvtex, sampler, fallbackWrap, fallbackFlipY);
                (finalPreloaded as any)[key] = fvtex;
            } else if (chType === 'volume') {
                // Load 3D volume noise texture for final pass
                const volumeTex = src === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                (finalPreloaded as any)[key] = volumeTex;
            } else if (isCustomImageRef(src)) {
                const imageId = channelRefToImageId(src!);
                if (imageId) {
                    getImageBlobDB(imageId).then(blob => {
                        if (!blob) return;
                        const objectUrl = URL.createObjectURL(blob);
                        customImageUrlsRef.current.push(objectUrl);
                        const tex = new TextureLoader().load(objectUrl, (t) => {
                            URL.revokeObjectURL(objectUrl);
                            customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== objectUrl);
                        });
                        applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
                        (finalPreloaded as any)[key] = tex;
                    }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom image for final pass %s: %s', key, err));
                }
            } else if (isCustomVideoRef(src)) {
                const videoId = channelRefToVideoId(src!);
                if (videoId) {
                    getVideoBlobDB(videoId).then(async blob => {
                        if (!blob) return;
                        const objectUrl = URL.createObjectURL(blob);
                        customVideoUrlsRef.current.push(objectUrl);
                        const videoEl = document.createElement('video');
                        videoEl.src = objectUrl;
                        videoEl.muted = true;
                        videoEl.loop = true;
                        videoEl.playsInline = true;
                        videoEl.crossOrigin = 'anonymous';
                        customVideoElementsRef.current.push(videoEl);
                        await new Promise<void>((resolve) => {
                            if (videoEl.readyState >= 2) { resolve(); return; }
                            const onReady = () => { videoEl.removeEventListener('loadeddata', onReady); videoEl.removeEventListener('canplay', onReady); resolve(); };
                            videoEl.addEventListener('loadeddata', onReady);
                            videoEl.addEventListener('canplay', onReady);
                        });
                        try { await videoEl.play(); } catch (_e) { /* ignore */ }
                        const vtex = new VideoTexture(videoEl);
                        vtex.generateMipmaps = false;
                        applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
                        (finalPreloaded as any)[key] = vtex;
                    }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom video for final pass %s: %s', key, err));
                }
            } else if (isCustomCubemapRef(src)) {
                const cubemapId = channelRefToCubemapId(src!);
                if (cubemapId) {
                    getCubemapFacesDB(cubemapId).then(faces => {
                        if (!faces) return;
                        const faceMap: Record<string, Blob> = {};
                        for (const face of faces) {
                            faceMap[face.name] = face.blob;
                        }
                        const faceOrder: ('px'|'nx'|'py'|'ny'|'pz'|'nz')[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
                        const faceUrls: string[] = [];
                        for (const faceName of faceOrder) {
                            const blob = faceMap[faceName];
                            if (!blob) return;
                            const url = URL.createObjectURL(blob);
                            customImageUrlsRef.current.push(url);
                            faceUrls.push(url);
                        }
                        const cubeLoader = new CubeTextureLoader();
                        const cubeTex = cubeLoader.load(faceUrls, () => {
                            faceUrls.forEach(url => {
                                URL.revokeObjectURL(url);
                                customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== url);
                            });
                        });
                        (finalPreloaded as any)[key] = cubeTex;
                    }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom cubemap for final pass %s: %s', key, err));
                }
            }
        }

        // Schedule warmup passes equal to the number of buffer passes so the
        // dependency chain (A→B→C) is fully primed before the first visible frame.
        bufferWarmupRef.current = bufferRuntimes.filter(Boolean).length;
        setThreeProps({ ...threeProps, buffers: bufferRuntimes, bufferCamera: camera, finalChannels, finalPreloaded });
    }

    const resetTime = (tuniform : TUniform) => {
        tuniform.iAmplifiedTime.value = 0.1;
        tuniform.iTime.value = 0.1;
        tuniform.iFrame.value = 0;
    }

    const incrementTime = (tuniform : TUniform, increment: number) => {
        tuniform.iAmplifiedTime.value += increment;
        tuniform.iTime.value += increment;
    }

    const getCurrentDateVector = () => {
        const currentDate = new Date();
        // Year, month, day, time in seconds in .xyzw
        return new Vector4(currentDate.getFullYear(), currentDate.getMonth(),
            currentDate.getDate(),
            currentDate.getHours()*60.0*60 + currentDate.getMinutes()*60 + currentDate.getSeconds());
    }
  
    const initializeProps = () => {
        const fbcArray = fbcArrayRef.current as any; // Force type for Three.js compatibility
        const format = (new WebGLRenderer().capabilities.isWebGL2) ? RedFormat : LuminanceFormat;
        const dataTexture = new DataTexture(fbcArray, fftSize / 2, 1, format);
        const video_texture = new VideoTexture(videoElement as HTMLVideoElement);
        const clock = new Clock();

        const tuniform: any = {
            iAmplifiedTime: { type: 'f', value: 0.1 },
            iTime: { type: 'f', value: 0.1 },
            iTimeDelta: { type: 'f', value: 0.0 },
            iFrameRate: { type: 'f', value: 60.0 },
            iDate: { value: getCurrentDateVector() },
            iChannel0: { value: undefined },
            iChannel1: { value: undefined },
            iChannel2: { value: undefined },
            iChannel3: { value: undefined },
            iChannelResolution: { value: [new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1)] },
            iChannelTime: { value: [0.0, 0.0, 0.0, 0.0] },
            iAudioData: { value: dataTexture },
            iSampleRate: { type: 'f', value: 44100.0 },
            iResolution: { value: new Vector3(window.innerWidth, window.innerHeight, 1.0) },
            iVideo: { value: video_texture },
            iMouse: { value: new Vector4(window.innerWidth / 2, window.innerHeight / 2, 0, 0), type: 'v4', },
            iFrame: { type: 'i', value: 0 },
            iKeyboard: { value: new DataTexture(keyboardStateRef.current as any, KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, RedFormat) },
            iMidi: { value: new DataTexture(midiStateRef.current as any, MIDI_TEXTURE_WIDTH, MIDI_TEXTURE_HEIGHT, RedFormat) },
            iJoystick: { value: new DataTexture(joystickStateRef.current as any, JOYSTICK_TEXTURE_WIDTH, JOYSTICK_TEXTURE_HEIGHT, RedFormat) },
            iTransitionOpacity: { type: 'f', value: 1.0 }
        };
        
        // Add custom uniforms from shader metadata
        if (shaderObject.metaData?.customUniforms) {
            shaderObject.metaData.customUniforms.forEach((uniform: ShaderUniform) => {
                let value: any = uniform.default;
                
                switch(uniform.type) {
                    case 'int':
                        value = Math.floor(uniform.default as number);
                        break;
                    case 'float':
                        value = uniform.default as number;
                        break;
                    case 'bool':
                        value = uniform.default ? 1.0 : 0.0; // Convert bool to float for GLSL
                        break;
                    case 'vec2':
                        value = new Vector2(...(uniform.default as number[]));
                        break;
                    case 'vec3':
                        value = new Vector3(...(uniform.default as number[]));
                        break;
                    case 'vec4':
                        value = new Vector4(...(uniform.default as number[]));
                        break;
                }
                
                tuniform[uniform.name] = { value };
            });
        }
        
        const props = {
            clock,
            format,
            tuniform
        };
        setThreeProps(props);
    }

    // Load and apply custom uniform values from storage
    useEffect(() => {
        if (shaderObject?.metaData?.customUniforms && threeProps?.tuniform) {
            // Load initial values
            browser.storage.local.get(`customUniforms_${shaderObject.shaderName}`).then(result => {
                const savedValues = result[`customUniforms_${shaderObject.shaderName}`];
                if (savedValues) {
                    shaderObject.metaData?.customUniforms!.forEach((uniform: ShaderUniform) => {
                        if (savedValues[uniform.name] !== undefined && threeProps.tuniform[uniform.name]) {
                            let value = savedValues[uniform.name];
                            
                            // Convert value based on type
                            switch(uniform.type) {
                                case 'bool':
                                    value = value ? 1.0 : 0.0;
                                    break;
                                case 'vec2':
                                    value = new Vector2(...(Array.isArray(value) ? value : [value, value]));
                                    break;
                                case 'vec3':
                                    value = new Vector3(...(Array.isArray(value) ? value : [value, value, value]));
                                    break;
                                case 'vec4':
                                    value = new Vector4(...(Array.isArray(value) ? value : [value, value, value, value]));
                                    break;
                            }
                            
                            threeProps.tuniform[uniform.name].value = value;
                        }
                    });
                }
            });
            
            // Listen for changes from storage
            const storageListener = (changes: any) => {
                const key = `customUniforms_${shaderObject.shaderName}`;
                if (changes[key]) {
                    const newValues = changes[key].newValue;
                    if (newValues && shaderObject.metaData?.customUniforms) {
                        shaderObject.metaData.customUniforms.forEach((uniform: ShaderUniform) => {
                            if (newValues[uniform.name] !== undefined && threeProps.tuniform[uniform.name]) {
                                let value = newValues[uniform.name];
                                
                                // Convert value based on type
                                switch(uniform.type) {
                                    case 'bool':
                                        value = value ? 1.0 : 0.0;
                                        break;
                                    case 'vec2':
                                        value = new Vector2(...(Array.isArray(value) ? value : [value, value]));
                                        break;
                                    case 'vec3':
                                        value = new Vector3(...(Array.isArray(value) ? value : [value, value, value]));
                                        break;
                                    case 'vec4':
                                        value = new Vector4(...(Array.isArray(value) ? value : [value, value, value, value]));
                                        break;
                                }
                                
                                threeProps.tuniform[uniform.name].value = value;
                            }
                        });
                    }
                }
            };
            
            browser.storage.onChanged.addListener(storageListener);
            
            return () => {
                browser.storage.onChanged.removeListener(storageListener);
            };
        }
    }, [shaderObject, threeProps]);

    useEffect(() => {
        // Set up the frequency data array
        initializeProps();
        return () => {
            // cleanup video listeners/callback chaining
            stopVideoFrameRef.current = true;
            const v: any = videoElement;
            if (v && v.__onTimeUpdateShaderAmp) {
                v.removeEventListener('timeupdate', v.__onTimeUpdateShaderAmp);
                delete v.__onTimeUpdateShaderAmp;
            }
            // Revoke any unreleased custom image object URLs
            customImageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            customImageUrlsRef.current = [];
            // Pause and clean up custom video elements and their object URLs
            customVideoElementsRef.current.forEach(v => { v.pause(); v.src = ''; v.load(); });
            customVideoElementsRef.current = [];
            customVideoUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            customVideoUrlsRef.current = [];
        }
    }, []);

    // Mouse tracking for iMouse uniform (ShaderToy compatible)
    useEffect(() => {
        if (!threeProps) return;
        
        let isMouseDown = false;
        
        const handleMouseMove = (event: MouseEvent) => {
            const tuniform = threeProps.tuniform;
            if (tuniform && tuniform.iMouse) {
                if (isMouseDown) {
                    // Update mouse position (xy) only when button is down
                    tuniform.iMouse.value.x = event.clientX * renderScale;
                    tuniform.iMouse.value.y = (window.innerHeight - event.clientY) * renderScale; // Flip Y to match ShaderToy convention
                }
            }
        };
        
        const handleMouseDown = (event: MouseEvent) => {
            if (event.button === 0) { // Left mouse button
                isMouseDown = true;
                const tuniform = threeProps.tuniform;
                if (tuniform && tuniform.iMouse) {
                    // Set click position (zw) and current position (xy)
                    tuniform.iMouse.value.x = event.clientX * renderScale;
                    tuniform.iMouse.value.y = (window.innerHeight - event.clientY) * renderScale;
                    tuniform.iMouse.value.z = event.clientX * renderScale;
                    tuniform.iMouse.value.w = (window.innerHeight - event.clientY) * renderScale;
                }
            }
        };
        
        const handleMouseUp = (event: MouseEvent) => {
            if (event.button === 0) { // Left mouse button
                isMouseDown = false;
                const tuniform = threeProps.tuniform;
                if (tuniform && tuniform.iMouse) {
                    // Set zw to negative to indicate mouse is up (ShaderToy convention)
                    tuniform.iMouse.value.z = -Math.abs(tuniform.iMouse.value.z);
                    tuniform.iMouse.value.w = -Math.abs(tuniform.iMouse.value.w);
                }
            }
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [threeProps, renderScale]);

    // Keyboard tracking for iKeyboard uniform (ShaderToy compatible)
    useEffect(() => {
        if (!threeProps) return;
        
        const handleKeyDown = (event: KeyboardEvent) => {
            const keyCode = event.keyCode;
            if (keyCode < KEYBOARD_TEXTURE_WIDTH) {
                const prevState = keyboardPrevStateRef.current[keyCode];
                
                // Set key down state (row 0)
                keyboardStateRef.current[keyCode] = 255;
                
                // Set key pressed state (row 1) - only on transition from up to down
                if (prevState === 0) {
                    keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH + keyCode] = 255;
                    keyboardPressTimeRef.current[keyCode] = currentTimeRef.current;
                }
                
                // Clear key released state (row 2)
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 2 + keyCode] = 0;
                
                keyboardPrevStateRef.current[keyCode] = 255;
            }
        };
        
        const handleKeyUp = (event: KeyboardEvent) => {
            const keyCode = event.keyCode;
            if (keyCode < KEYBOARD_TEXTURE_WIDTH) {
                // Clear key down state (row 0)
                keyboardStateRef.current[keyCode] = 0;
                
                // Clear key pressed state (row 1)
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH + keyCode] = 0;
                
                // Set key released state (row 2)
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 2 + keyCode] = 255;
                
                keyboardPrevStateRef.current[keyCode] = 0;
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [threeProps]);

    // Joystick: keep mappings and enabled state in sync with storage
    useEffect(() => {
        const loadJoystickSettings = async () => {
            const browser = (await import('webextension-polyfill')).default;
            const result = await browser.storage.local.get([SETTINGS_JOYSTICK_ENABLED, SETTINGS_JOYSTICK_MAPPINGS]);
            joystickEnabledRef.current = result[SETTINGS_JOYSTICK_ENABLED] ?? false;
            joystickMappingsRef.current = result[SETTINGS_JOYSTICK_MAPPINGS] ?? [];
        };
        loadJoystickSettings();

        const handleStorageChange = (changes: Record<string, any>) => {
            if (changes[SETTINGS_JOYSTICK_ENABLED] !== undefined) {
                joystickEnabledRef.current = changes[SETTINGS_JOYSTICK_ENABLED].newValue ?? false;
            }
            if (changes[SETTINGS_JOYSTICK_MAPPINGS] !== undefined) {
                joystickMappingsRef.current = changes[SETTINGS_JOYSTICK_MAPPINGS].newValue ?? [];
            }
        };

        import('webextension-polyfill').then(({ default: browser }) => {
            browser.storage.onChanged.addListener(handleStorageChange);
        });

        return () => {
            import('webextension-polyfill').then(({ default: browser }) => {
                browser.storage.onChanged.removeListener(handleStorageChange);
            });
        };
    }, []);

    // MIDI: keep mappings and enabled state in sync with storage (refs so useFrame can read without re-render)
    useEffect(() => {
        const loadMidiSettings = async () => {
            const browser = (await import('webextension-polyfill')).default;
            const result = await browser.storage.local.get([SETTINGS_MIDI_ENABLED, SETTINGS_MIDI_MAPPINGS, SETTINGS_EQ_GAINS]);
            midiEnabledRef.current = result[SETTINGS_MIDI_ENABLED] ?? false;
            midiMappingsRef.current = result[SETTINGS_MIDI_MAPPINGS] ?? [];
            if (Array.isArray(result[SETTINGS_EQ_GAINS])) {
                eqGainsRef.current = [...result[SETTINGS_EQ_GAINS]];
            }
        };
        loadMidiSettings();

        const handleStorageChange = (changes: Record<string, any>) => {
            if (changes[SETTINGS_MIDI_ENABLED] !== undefined) {
                midiEnabledRef.current = changes[SETTINGS_MIDI_ENABLED].newValue ?? false;
            }
            if (changes[SETTINGS_MIDI_MAPPINGS] !== undefined) {
                midiMappingsRef.current = changes[SETTINGS_MIDI_MAPPINGS].newValue ?? [];
            }
            if (changes[SETTINGS_EQ_GAINS] !== undefined && Array.isArray(changes[SETTINGS_EQ_GAINS].newValue)) {
                eqGainsRef.current = [...changes[SETTINGS_EQ_GAINS].newValue];
            }
        };

        import('webextension-polyfill').then(({ default: browser }) => {
            browser.storage.onChanged.addListener(handleStorageChange);
        });

        return () => {
            import('webextension-polyfill').then(({ default: browser }) => {
                browser.storage.onChanged.removeListener(handleStorageChange);
            });
        };
    }, []);

    // iAmplifiedTime: load setting from storage
    useEffect(() => {
        const loadIAmplifiedTimeSetting = async () => {
            const browser = (await import('webextension-polyfill')).default;
            const result = await browser.storage.local.get(SETTINGS_ENABLE_IAMPLIFIED_TIME);
            enableIAmplifiedTimeRef.current = result[SETTINGS_ENABLE_IAMPLIFIED_TIME] ?? true;
        };
        loadIAmplifiedTimeSetting();

        const handleStorageChange = (changes: Record<string, any>) => {
            if (changes[SETTINGS_ENABLE_IAMPLIFIED_TIME] !== undefined) {
                enableIAmplifiedTimeRef.current = changes[SETTINGS_ENABLE_IAMPLIFIED_TIME].newValue ?? true;
            }
        };

        import('webextension-polyfill').then(({ default: browser }) => {
            browser.storage.onChanged.addListener(handleStorageChange);
        });

        return () => {
            import('webextension-polyfill').then(({ default: browser }) => {
                browser.storage.onChanged.removeListener(handleStorageChange);
            });
        };
    }, []);

    // Joystick: subscribe to events and handle them
    useEffect(() => {
        let unsubFn: (() => void) | null = null;

        const setupJoystick = async () => {
            const svc = await import('@src/helpers/joystickService');
            const activeAxisMappings = new Set<string>();

            const handler = (evt: import('@src/helpers/joystickService').JoystickEvent) => {
                if (!joystickEnabledRef.current) return;
                const mappings = joystickMappingsRef.current;
                const fbc = fbcArrayRef.current;
                const frequencyBins = fbc.length;

                for (const mapping of mappings) {
                    const src = mapping.source;
                    const srcType = src.type;
                    const evtIsButton = evt.type === 'button_down' || evt.type === 'button_up';
                    const evtIsAxis = evt.type === 'axis';
                    if (srcType === 'button' && !evtIsButton) continue;
                    if (srcType === 'axis' && !evtIsAxis) continue;
                    if (src.gamepadIndex !== evt.gamepadIndex) continue;
                    if (src.index !== evt.index) continue;

                    // Normalise: axis is -1..+1 -> 0..1; button value is already 0..1
                    const rawNorm = evtIsAxis ? (evt.value + 1) / 2 : evt.value;
                    const mapped = mapping.min + rawNorm * (mapping.max - mapping.min);
                    const target = mapping.target;
                    const isPress = evt.type === 'button_down';
                    const isDiscrete = target !== 'speedDivider' && target !== 'volumeAmplifier' && !target.startsWith('uniform:') && target !== 'fftInject' && target !== 'mouseX' && target !== 'mouseY';
                    let shouldTrigger: boolean;
                    if (evtIsButton) {
                        shouldTrigger = isPress;
                    } else if (isDiscrete) {
                        if (evt.value !== 0 && !activeAxisMappings.has(mapping.id)) {
                            activeAxisMappings.add(mapping.id);
                            shouldTrigger = true;
                        } else if (evt.value === 0) {
                            activeAxisMappings.delete(mapping.id);
                            shouldTrigger = false;
                        } else {
                            shouldTrigger = false;
                        }
                    } else {
                        shouldTrigger = true;
                    }

                    if (target === 'prevShader') {
                        if (shouldTrigger) browser.runtime.sendMessage({ command: PREV_SHADER }).catch(() => {});
                    } else if (target === 'nextShader') {
                        if (shouldTrigger) browser.runtime.sendMessage({ command: NEXT_SHADER }).catch(() => {});
                    } else if (target === 'resetTime') {
                        if (shouldTrigger && matRef.current) resetTime(matRef.current.uniforms as TUniform);
                    } else if (target === 'randomizeBeat') {
                        if (shouldTrigger) browser.storage.local.get('settings.randomizeBeat').then(r => {
                            browser.storage.local.set({ 'settings.randomizeBeat': !r['settings.randomizeBeat'] });
                        });
                    } else if (target === 'speedDivider') {
                        browser.storage.local.set({ 'settings.speedDivider': Math.round(mapped) });
                    } else if (target === 'volumeAmplifier') {
                        browser.storage.local.set({ 'settings.volumeAmplifier': mapped });
                    } else if (target === 'fftInject') {
                        const bin = Math.floor(rawNorm * frequencyBins);
                        if (bin < midiFftInjectionRef.current.length) {
                            midiFftInjectionRef.current[bin] = Math.min(evt.value * 255, 254);
                        }
                    } else if (target === 'mouseX') {
                        if (threeProps?.tuniform?.iMouse) {
                            threeProps.tuniform.iMouse.value.x = rawNorm * threeProps.tuniform.iResolution.value.x;
                            if (threeProps.tuniform.iMouse.value.z > 0) threeProps.tuniform.iMouse.value.z = threeProps.tuniform.iMouse.value.x;
                        }
                    } else if (target === 'mouseY') {
                        if (threeProps?.tuniform?.iMouse) {
                            threeProps.tuniform.iMouse.value.y = rawNorm * threeProps.tuniform.iResolution.value.y;
                            if (threeProps.tuniform.iMouse.value.z > 0) threeProps.tuniform.iMouse.value.w = threeProps.tuniform.iMouse.value.y;
                        }
                    } else if (target === 'mouseButton') {
                        if (threeProps?.tuniform?.iMouse) {
                            if (isPress) {
                                threeProps.tuniform.iMouse.value.z = Math.abs(threeProps.tuniform.iMouse.value.x);
                                threeProps.tuniform.iMouse.value.w = Math.abs(threeProps.tuniform.iMouse.value.y);
                            } else if (evt.type === 'button_up') {
                                threeProps.tuniform.iMouse.value.z = -Math.abs(threeProps.tuniform.iMouse.value.z);
                                threeProps.tuniform.iMouse.value.w = -Math.abs(threeProps.tuniform.iMouse.value.w);
                            }
                        }
                    } else if (target.startsWith('uniform:')) {
                        const uniformName = target.slice(8);
                        if (matRef.current?.uniforms[uniformName] !== undefined) {
                            matRef.current.uniforms[uniformName].value = mapped;
                        }
                    } else if (target.startsWith('selectShader:')) {
                        const shaderId = target.slice(13);
                        if (shouldTrigger) browser.runtime.sendMessage({ command: 'SELECT_SHADER_BY_ID', shaderId }).catch(() => {});
                    }
                }

                // Update iJoystick texture state
                if (evt.type === 'axis' && evt.index < JOYSTICK_TEXTURE_WIDTH) {
                    // Encode axis: -1..+1 -> 0..255 (128 = centre)
                    joystickStateRef.current[evt.index] = Math.round((evt.value + 1) / 2 * 255);
                } else if (evt.type === 'button_down' && evt.index < JOYSTICK_TEXTURE_WIDTH) {
                    joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH + evt.index] = 255;      // row 1: held
                    joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 2 + evt.index] = 255; // row 2: just-pressed
                    joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 3 + evt.index] = 0;   // row 3: just-released
                } else if (evt.type === 'button_up' && evt.index < JOYSTICK_TEXTURE_WIDTH) {
                    joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH + evt.index] = 0;
                    joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 2 + evt.index] = 0;
                    joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 3 + evt.index] = 255; // row 3: just-released
                }
            };

            svc.subscribe(handler);
            joystickDirectActiveRef.current = true;
            unsubFn = () => {
                svc.unsubscribe(handler);
                joystickDirectActiveRef.current = false;
            };
        };

        setupJoystick();

        return () => { unsubFn?.(); };
    }, [threeProps]);

    // Joystick: also handle events relayed from the options page via browser.runtime.onMessage
    // (The Gamepad API is per-page; the options page owns the gamepad when it was configured there,
    //  so it relays raw JoystickEvents here via browser.tabs.sendMessage → browser.runtime.onMessage)
    useEffect(() => {
        const activeAxisMappings = new Set<string>();
        const handleRelayedJoystickEvent = (msg: any) => {
            if (msg?.type !== 'JOYSTICK_EVENT') return;
            if (joystickDirectActiveRef.current) return;
            const evt: import('@src/helpers/joystickService').JoystickEvent = msg.event;
            if (!joystickEnabledRef.current) return;
            const mappings = joystickMappingsRef.current;
            const fbc = fbcArrayRef.current;
            const frequencyBins = fbc.length;

            for (const mapping of mappings) {
                const src = mapping.source;
                const srcType = src.type;
                const evtIsButton = evt.type === 'button_down' || evt.type === 'button_up';
                const evtIsAxis = evt.type === 'axis';
                if (srcType === 'button' && !evtIsButton) continue;
                if (srcType === 'axis' && !evtIsAxis) continue;
                if (src.gamepadIndex !== evt.gamepadIndex) continue;
                if (src.index !== evt.index) continue;

                const rawNorm = evtIsAxis ? (evt.value + 1) / 2 : evt.value;
                const mapped = mapping.min + rawNorm * (mapping.max - mapping.min);
                const target = mapping.target;
                const isPress = evt.type === 'button_down';
                const isDiscrete = target !== 'speedDivider' && target !== 'volumeAmplifier' && !target.startsWith('uniform:') && target !== 'fftInject' && target !== 'mouseX' && target !== 'mouseY';
                let shouldTrigger: boolean;
                if (evtIsButton) {
                    shouldTrigger = isPress;
                } else if (isDiscrete) {
                    if (evt.value !== 0 && !activeAxisMappings.has(mapping.id)) {
                        activeAxisMappings.add(mapping.id);
                        shouldTrigger = true;
                    } else if (evt.value === 0) {
                        activeAxisMappings.delete(mapping.id);
                        shouldTrigger = false;
                    } else {
                        shouldTrigger = false;
                    }
                } else {
                    shouldTrigger = true;
                }

                if (target === 'prevShader') {
                    if (shouldTrigger) browser.runtime.sendMessage({ command: PREV_SHADER }).catch(() => {});
                } else if (target === 'nextShader') {
                    if (shouldTrigger) browser.runtime.sendMessage({ command: NEXT_SHADER }).catch(() => {});
                } else if (target === 'resetTime') {
                    if (shouldTrigger && matRef.current) resetTime(matRef.current.uniforms as TUniform);
                } else if (target === 'randomizeBeat') {
                    if (shouldTrigger) browser.storage.local.get('settings.randomizeBeat').then(r => {
                        browser.storage.local.set({ 'settings.randomizeBeat': !r['settings.randomizeBeat'] });
                    });
                } else if (target === 'speedDivider') {
                    browser.storage.local.set({ 'settings.speedDivider': Math.round(mapped) });
                } else if (target === 'volumeAmplifier') {
                    browser.storage.local.set({ 'settings.volumeAmplifier': mapped });
                } else if (target === 'fftInject') {
                    const bin = Math.floor(rawNorm * frequencyBins);
                    if (bin < midiFftInjectionRef.current.length) {
                        midiFftInjectionRef.current[bin] = Math.min(evt.value * 255, 254);
                    }
                } else if (target === 'mouseX') {
                    if (threeProps?.tuniform?.iMouse) {
                        threeProps.tuniform.iMouse.value.x = rawNorm * threeProps.tuniform.iResolution.value.x;
                        if (threeProps.tuniform.iMouse.value.z > 0) threeProps.tuniform.iMouse.value.z = threeProps.tuniform.iMouse.value.x;
                    }
                } else if (target === 'mouseY') {
                    if (threeProps?.tuniform?.iMouse) {
                        threeProps.tuniform.iMouse.value.y = rawNorm * threeProps.tuniform.iResolution.value.y;
                        if (threeProps.tuniform.iMouse.value.z > 0) threeProps.tuniform.iMouse.value.w = threeProps.tuniform.iMouse.value.y;
                    }
                } else if (target === 'mouseButton') {
                    if (threeProps?.tuniform?.iMouse) {
                        if (isPress) {
                            threeProps.tuniform.iMouse.value.z = Math.abs(threeProps.tuniform.iMouse.value.x);
                            threeProps.tuniform.iMouse.value.w = Math.abs(threeProps.tuniform.iMouse.value.y);
                        } else if (evt.type === 'button_up') {
                            threeProps.tuniform.iMouse.value.z = -Math.abs(threeProps.tuniform.iMouse.value.z);
                            threeProps.tuniform.iMouse.value.w = -Math.abs(threeProps.tuniform.iMouse.value.w);
                        }
                    }
                } else if (target.startsWith('uniform:')) {
                    const uniformName = target.slice(8);
                    if (matRef.current?.uniforms[uniformName] !== undefined) {
                        matRef.current.uniforms[uniformName].value = mapped;
                    }
                } else if (target.startsWith('selectShader:')) {
                    const shaderId = target.slice(13);
                    if (shouldTrigger) browser.runtime.sendMessage({ command: 'SELECT_SHADER_BY_ID', shaderId }).catch(() => {});
                }
            }

            // Update iJoystick texture state
            if (evt.type === 'axis' && evt.index < JOYSTICK_TEXTURE_WIDTH) {
                joystickStateRef.current[evt.index] = Math.round((evt.value + 1) / 2 * 255);
            } else if (evt.type === 'button_down' && evt.index < JOYSTICK_TEXTURE_WIDTH) {
                joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH + evt.index] = 255;
                joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 2 + evt.index] = 255;
                joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 3 + evt.index] = 0;
            } else if (evt.type === 'button_up' && evt.index < JOYSTICK_TEXTURE_WIDTH) {
                joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH + evt.index] = 0;
                joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 2 + evt.index] = 0;
                joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 3 + evt.index] = 255;
            }
        };

        browser.runtime.onMessage.addListener(handleRelayedJoystickEvent);
        return () => { browser.runtime.onMessage.removeListener(handleRelayedJoystickEvent); };
    }, [threeProps]);

    // MIDI: subscribe to events and handle them
    useEffect(() => {
        let unsubFn: (() => void) | null = null;

        const setupMidi = async () => {
            const svc = await import('@src/helpers/midiService');
            // Only init if already initialized (initMidi is called from content/index.tsx)
            if (!svc.isMidiInitialized()) return;

            const handler = (evt: import('@src/helpers/midiService').MidiEvent) => {
                if (!midiEnabledRef.current) return;
                const mappings = midiMappingsRef.current;
                const fbc = fbcArrayRef.current;
                const frequencyBins = fbc.length;

                for (const mapping of mappings) {
                    const src = mapping.source;
                    const matchType = evt.type === src.type
                        || (evt.type === 'noteon' && src.type === 'noteon')
                        || (evt.type === 'noteoff' && src.type === 'noteon'); // allow release to reset momentary mappings
                    if (!matchType) continue;
                    if (src.channel !== evt.channel) continue;
                    if (src.number !== evt.number) continue;

                    let mapped: number;
                    if (mapping.encoderMode === 'relative') {
                        // Relative (endless encoder): value 1–63 = CW increment, 65–127 = CCW decrement
                        const range = mapping.max - mapping.min;
                        const step = range / 64; // one full sweep ≈ 64 ticks
                        const delta = evt.value <= 63 ? evt.value * step : (evt.value - 128) * step;
                        const prev = midiRelativeAccRef.current.get(mapping.id) ?? ((mapping.min + mapping.max) / 2);
                        mapped = Math.min(mapping.max, Math.max(mapping.min, prev + delta));
                        midiRelativeAccRef.current.set(mapping.id, mapped);
                    } else {
                        const normalized = evt.value / 127; // 0..1
                        mapped = mapping.min + normalized * (mapping.max - mapping.min);
                        if (mapping.step) mapped = Math.round(mapped / mapping.step) * mapping.step;
                    }
                    const target = mapping.target;

                    if (target === 'prevShader') {
                        if (evt.type === 'noteon') browser.runtime.sendMessage({ command: PREV_SHADER }).catch(() => {});
                    } else if (target === 'nextShader') {
                        if (evt.type === 'noteon') browser.runtime.sendMessage({ command: NEXT_SHADER }).catch(() => {});
                    } else if (target === 'resetTime') {
                        if (evt.type === 'noteon' && threeProps?.tuniform) resetTime(matRef.current!.uniforms as TUniform);
                    } else if (target === 'randomizeBeat') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.randomizeBeat').then(r => {
                            browser.storage.local.set({ 'settings.randomizeBeat': !r['settings.randomizeBeat'] });
                        });
                    } else if (target === 'toggleRandomizeShaders') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.randomizeShaders').then(r => {
                            browser.storage.local.set({ 'settings.randomizeShaders': !r['settings.randomizeShaders'] });
                        });
                    } else if (target === 'randomizeTime') {
                        browser.storage.local.set({ 'settings.randomizeTime': Math.round(mapped) });
                    } else if (target === 'randomizeVariation') {
                        browser.storage.local.set({ 'settings.randomizeVariation': Math.round(mapped) });
                    } else if (target === 'randomizeBeatInterval') {
                        browser.storage.local.set({ 'settings.randomizeBeatInterval': Math.round(mapped) });
                    } else if (target === 'toggleShaderCredits') {
                        if (evt.type === 'noteon') browser.storage.local.get('state.showshadercredits').then(r => {
                            browser.storage.local.set({ 'state.showshadercredits': !r['state.showshadercredits'] });
                        });
                    } else if (target === 'toggleTabTitle') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.showTabTitle').then(r => {
                            browser.storage.local.set({ 'settings.showTabTitle': !r['settings.showTabTitle'] });
                        });
                    } else if (target === 'toggleFps') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.showFps').then(r => {
                            browser.storage.local.set({ 'settings.showFps': !r['settings.showFps'] });
                        });
                    } else if (target === 'toggleShaderFade') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.shaderFade').then(r => {
                            browser.storage.local.set({ 'settings.shaderFade': !r['settings.shaderFade'] });
                        });
                    } else if (target === 'toggleWebcam') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.useWebcam').then(r => {
                            browser.storage.local.set({ 'settings.useWebcam': !r['settings.useWebcam'] });
                        });
                    } else if (target === 'toggleWebcamAudio') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.useWebcamAudio').then(r => {
                            browser.storage.local.set({ 'settings.useWebcamAudio': !r['settings.useWebcamAudio'] });
                        });
                    } else if (target === 'toggleDisplayCapture') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.useDisplayCapture').then(r => {
                            browser.storage.local.set({ 'settings.useDisplayCapture': !r['settings.useDisplayCapture'] });
                        });
                    } else if (target === 'toggleEnableIAmplifiedTime') {
                        if (evt.type === 'noteon') browser.storage.local.get('settings.enableIAmplifiedTime').then(r => {
                            browser.storage.local.set({ 'settings.enableIAmplifiedTime': !r['settings.enableIAmplifiedTime'] });
                        });
                    } else if (target.startsWith('eqBand:')) {
                        const bandIndex = parseInt(target.slice(7), 10);
                        if (!Number.isNaN(bandIndex) && bandIndex >= 0 && bandIndex < eqGainsRef.current.length) {
                            const clamped = Math.min(mapping.max, Math.max(mapping.min, mapped));
                            // Mutate the shared cache synchronously so multiple mappings on the
                            // same MIDI event each persist their band (no read-modify-write race).
                            eqGainsRef.current[bandIndex] = clamped;
                            browser.storage.local.set({ [SETTINGS_EQ_GAINS]: [...eqGainsRef.current] });
                        }
                    } else if (target === 'renderScale') {
                        const RENDER_PRESETS = [1.0, 0.75, 2 / 3, 0.5, 1 / 3, 0.25];
                        const idx = Math.min(RENDER_PRESETS.length - 1, Math.round((evt.value / 127) * (RENDER_PRESETS.length - 1)));
                        browser.storage.local.set({ 'settings.renderScale': RENDER_PRESETS[idx] });
                    } else if (target === 'speedDivider') {
                        browser.storage.local.set({ 'settings.speedDivider': Math.round(mapped) });
                    } else if (target === 'volumeAmplifier') {
                        browser.storage.local.set({ 'settings.volumeAmplifier': mapped });
                    } else if (target === 'fftInject') {
                        // Map MIDI note (0-127) to a frequency bin
                        const bin = Math.floor((evt.number / 128) * frequencyBins);
                        if (bin < midiFftInjectionRef.current.length) {
                            midiFftInjectionRef.current[bin] = Math.min(evt.value * 2, 254);
                        }
                    } else if (target.startsWith('uniform:')) {
                        const uniformName = target.slice(8);
                        const storageKey = `customUniforms_${shaderObject.shaderName}`;
                        if (mapping.buttonMode === 'toggle' && evt.type === 'noteon' && evt.value > 0) {
                            browser.storage.local.get(storageKey).then(saved => {
                                const current = saved[storageKey] ?? {};
                                const flipped = current[uniformName] ? 0 : 1;
                                browser.storage.local.set({ [storageKey]: { ...current, [uniformName]: flipped } });
                                if (matRef.current?.uniforms[uniformName] !== undefined) {
                                    matRef.current.uniforms[uniformName].value = flipped;
                                }
                            });
                        } else if (mapping.buttonMode === 'momentary' && (evt.type === 'noteon' || evt.type === 'noteoff')) {
                            // On while held: max on press, min on release
                            const momentaryVal = evt.type === 'noteoff' ? mapping.min : mapping.max;
                            if (matRef.current?.uniforms[uniformName] !== undefined) {
                                matRef.current.uniforms[uniformName].value = momentaryVal;
                            }
                            browser.storage.local.get(storageKey).then(saved => {
                                const current = saved[storageKey] ?? {};
                                browser.storage.local.set({ [storageKey]: { ...current, [uniformName]: momentaryVal } });
                            });
                        } else if (mapping.buttonMode !== 'toggle' && mapping.buttonMode !== 'momentary' && evt.type !== 'noteoff') {
                            if (matRef.current?.uniforms[uniformName] !== undefined) {
                                matRef.current.uniforms[uniformName].value = mapped;
                            }
                            browser.storage.local.get(storageKey).then(saved => {
                                const current = saved[storageKey] ?? {};
                                browser.storage.local.set({ [storageKey]: { ...current, [uniformName]: mapped } });
                            });
                        }
                    } else if (target.startsWith('selectShader:')) {
                        const shaderId = target.slice(13);
                        // Find and activate the shader by ID/name
                        if (evt.type === 'noteon') {
                            browser.runtime.sendMessage({ command: 'SELECT_SHADER_BY_ID', shaderId }).catch(() => {});
                        }
                    }
                }

                // Always update iMidi texture state for note events
                const note = evt.number;
                if (note < MIDI_TEXTURE_WIDTH) {
                    if (evt.type === 'noteon') {
                        midiStateRef.current[note] = 255;                                    // row 0: held
                        midiStateRef.current[MIDI_TEXTURE_WIDTH + note] = 255;              // row 1: just-pressed
                        midiStateRef.current[MIDI_TEXTURE_WIDTH * 2 + note] = 0;            // row 2: just-released
                        midiStateRef.current[MIDI_TEXTURE_WIDTH * 3 + note] = evt.value * 2; // row 3: velocity
                    } else if (evt.type === 'noteoff') {
                        midiStateRef.current[note] = 0;
                        midiStateRef.current[MIDI_TEXTURE_WIDTH + note] = 0;
                        midiStateRef.current[MIDI_TEXTURE_WIDTH * 2 + note] = 255;
                    }
                }
            };

            svc.subscribe(handler);
            unsubFn = () => svc.unsubscribe(handler);
        };

        setupMidi();

        return () => { unsubFn?.(); };
    }, [threeProps]);

    useEffect(() => {
        if (!analyser) {
            return;
        }
        console.log('analyser bin count: ', analyser.frequencyBinCount);
        const props = threeProps;
        const messageHandler = (msg: any, sender: any) => { 
            if (!msg.command) { 
                return;
            }
            const defaultIncrement = 0.5;
            const cmd = msg.command;
            const tuniform = matRef.current!.uniforms as TUniform;
            if (cmd === RESET_TIME) {
                resetTime(tuniform);
            } else if (cmd == INCR_TIME) {
                incrementTime(tuniform, defaultIncrement);
            } else if (cmd == DECR_TIME) {
                incrementTime(tuniform, -defaultIncrement);
            }
        };
        browser.runtime.onMessage.addListener(messageHandler);
        return () => {
            browser.runtime.onMessage.removeListener(messageHandler);
        }
    }, [analyser]);

    useEffect(() => {
        if (!threeProps) return;
        // Avoid re-loading the same shader and render scale repeatedly
        const currentCode = shaderObject.inlineCode || '';
        if (loadedShaderName === shaderObject.shaderName && loadedShaderCode === currentCode && loadedRenderScale === renderScale) return;
        
        console.log('Load Fragment Shader', threeProps, shaderObject, 'at scale', renderScale);
        
        // Handle fade transition
        if (shaderFade && loadedShaderName && !isTransitioning) {
            console.log('Starting fade transition from', loadedShaderName, 'to', shaderObject.shaderName);
            setPreviousShaderName(loadedShaderName);
            setIsTransitioning(true);
            setFadeProgress(0.0);
            
            // Load the new shader after a brief delay to allow fade setup
            setTimeout(async () => {
                await loadFragmentShader();
                await setupMultipassBuffers();
                setLoadedShaderName(shaderObject.shaderName);
                setLoadedShaderCode(shaderObject.inlineCode || '');
                setLoadedRenderScale(renderScale);
            }, 50); // 50ms delay
        } else {
            // Direct load when fade is disabled or no previous shader
            (async () => {
                await loadFragmentShader();
                await setupMultipassBuffers();
                setLoadedShaderName(shaderObject.shaderName);
                setLoadedShaderCode(shaderObject.inlineCode || '');
                setLoadedRenderScale(renderScale);
            })();
        }
    }, [threeProps, shaderObject, loadedShaderName, loadedShaderCode, loadedRenderScale, renderScale, shaderFade, isTransitioning]);


   useEffect(() => {
        if (!threeProps) {
            return;
        }
        const tuniform = threeProps.tuniform!;
        tuniform.iResolution.value.set(viewport.width * renderScale, viewport.height * renderScale, 1.0);
    }, [threeProps, viewport.width, viewport.height, renderScale]);

    useFrame((state, delta) => {
        if (!analyser || !canvas || !threeProps) return;

        // Update fade progress
        if (shaderFade && isTransitioning) {
            const newFadeProgress = Math.min(fadeProgress + delta * 1.25, 1.0); // ~0.8 second fade duration
            setFadeProgress(newFadeProgress);
            
            const tuniform = threeProps.tuniform!;
            if (tuniform && tuniform.iTransitionOpacity) {
                tuniform.iTransitionOpacity.value = newFadeProgress;
            }
            if (previousMatRef.current && previousMatRef.current.uniforms.iTransitionOpacity) {
                previousMatRef.current.uniforms.iTransitionOpacity.value = 1.0 - newFadeProgress;
            }
            
            if (newFadeProgress >= 1.0) {
                setIsTransitioning(false);
                setPreviousShaderName("");
                // Clean up previous material
                if (previousMatRef.current) {
                    (previousMatRef.current as any).dispose();
                    (previousMatRef.current as any) = null;
                }
                console.log('Fade transition completed');
            }
        } else {
            const tuniform = threeProps.tuniform!;
            if (tuniform && tuniform.iTransitionOpacity) {
                tuniform.iTransitionOpacity.value = 1.0;
            }
        }
        
        // Beat detection for shader randomization
        if (randomizeBeat && fbcArrayRef.current) {
            const bassEnd = Math.floor(frequencyBinCount * 0.1); // Low frequencies for beat detection
            let bassSum = 0;
            for (let i = 0; i < bassEnd; i++) {
                bassSum += fbcArrayRef.current[i];
            }
            const bassAverage = bassSum / bassEnd;
            const beatThreshold = 200; // Adjust based on audio levels
            
            if (bassAverage > beatThreshold) {
                beatCounterRef.current++;
                if (beatCounterRef.current >= randomizeBeatInterval) {
                    console.log(`[ShaderAmp] Changing shader after ${randomizeBeatInterval} beats`);
                    onShaderChangeRequested?.();
                    beatCounterRef.current = 0; // Reset counter
                }
            }
        }
        
        // Update the frequencyBinCount array
        const fbcArray = fbcArrayRef.current as any; // Force type for Three.js compatibility
        analyser.getByteFrequencyData(fbcArray);
        
        // If the 2d element is available, draw the bars
        const ctx = canvas!.getContext('2d');
        if (ctx) {
            if (draw_analyzer) {
                const bar_count = window.innerWidth / 2;
                ctx.fillStyle = fill_color;

                for (var i = 0; i < bar_count; i++) {
                    const bar_pos = i * 4;
                    const bar_width = 2;
                    const bar_height = -(fbcArray[i] / 2);

                    ctx.fillRect(bar_pos, canvas!.height, bar_width, bar_height);
                }
            }
        }
        
        // Calculate the shader specific rate
        const sum = fbcArray.reduce((a: number, b: number) => a + b, 0);
        const avg = (sum / fbcArray.length) || 0.1;
        let rate = min_speed + avg / (speedDivider == 0 ? 0.1 : speedDivider);
        // Clamp to a reasonable range for HTMLVideoElement playback and GPU texture updates
        const minVideoRate = 0.25;
        const maxVideoRate = 3.0;
        rate = Math.min(Math.max(rate, minVideoRate), maxVideoRate)

        // Update the main uniforms
        const clockDelta = threeProps.clock.getDelta();
        const shaderFactor = shaderObject.metaData?.shaderSpeed ?? default_shader_factor;
        const tuniform = threeProps.tuniform;
        if (enableIAmplifiedTimeRef.current) {
            tuniform.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
        } else {
            // When disabled, sync with normal time so shaders still animate
            tuniform.iAmplifiedTime.value = tuniform.iTime.value;
        }
        tuniform.iTime.value += clockDelta;
        tuniform.iTimeDelta.value = clockDelta;
        tuniform.iFrameRate.value = clockDelta > 0 ? 1.0 / clockDelta : 60.0;
        tuniform.iDate.value = getCurrentDateVector();

        // Update iChannelTime - time since each channel was loaded
        const currentTime = tuniform.iTime.value;
        for (let ch = 0; ch < 4; ch++) {
            const loadTime = channelLoadTimeRef.current[ch];
            if (loadTime > 0) {
                tuniform.iChannelTime.value[ch] = currentTime - loadTime;
            } else {
                tuniform.iChannelTime.value[ch] = 0.0;
            }
        }

        // Update keyboard texture (ShaderToy compatible)
        currentTimeRef.current = tuniform.iTime.value;
        
        // Clear pressed/released states each frame (rows 1 and 2)
        for (let i = 0; i < KEYBOARD_TEXTURE_WIDTH; i++) {
            keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH + i] = 0; // Clear pressed state
            keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 2 + i] = 0; // Clear released state
            
            // Update key time in row 3 (normalized 0.0-1.0 based on how long key has been held)
            if (keyboardStateRef.current[i] > 0) { // If key is currently down
                const holdTime = currentTimeRef.current - keyboardPressTimeRef.current[i];
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 3 + i] = Math.min(holdTime * 255, 255);
            } else {
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 3 + i] = 0;
            }
        }
        
        // Notify to update the iKeyboard texture
        tuniform.iKeyboard.value.needsUpdate = true;

        // MIDI: blend injected note energy into the FFT buffer and decay
        if (midiEnabledRef.current) {
            const injBins = midiFftInjectionRef.current;
            for (let i = 0; i < Math.min(injBins.length, fbcArray.length); i++) {
                if (injBins[i] > 0) {
                    fbcArray[i] = Math.min(255, fbcArray[i] + injBins[i]);
                    injBins[i] = injBins[i] * MIDI_FFT_DECAY;
                    if (injBins[i] < 1) injBins[i] = 0;
                }
            }

            // Clear iMidi just-pressed (row 1) and just-released (row 2) each frame
            for (let i = 0; i < MIDI_TEXTURE_WIDTH; i++) {
                midiStateRef.current[MIDI_TEXTURE_WIDTH + i] = 0;
                midiStateRef.current[MIDI_TEXTURE_WIDTH * 2 + i] = 0;
            }
            if (tuniform.iMidi) {
                tuniform.iMidi.value.needsUpdate = true;
            }
        }

        // Clear iJoystick just-pressed (row 2) and just-released (row 3) each frame
        for (let i = 0; i < JOYSTICK_TEXTURE_WIDTH; i++) {
            joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 2 + i] = 0;
            joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 3 + i] = 0;
        }
        if (tuniform.iJoystick) {
            tuniform.iJoystick.value.needsUpdate = true;
        }

        // Notify to update the iAudioData texture as the fbcArray has been updated
        tuniform.iAudioData.value.needsUpdate = true;

        // Synchronize uniforms between current and previous shader materials during fade
        if (shaderFade && isTransitioning && previousMatRef.current && matRef.current) {
            const currentUniforms = matRef.current.uniforms;
            const previousUniforms = previousMatRef.current.uniforms;
            
            // Apply the same audio-reactive time updates to previous shader
            if (enableIAmplifiedTimeRef.current && previousUniforms.iAmplifiedTime && currentUniforms.iAmplifiedTime) {
                previousUniforms.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
            } else if (!enableIAmplifiedTimeRef.current && previousUniforms.iAmplifiedTime && currentUniforms.iTime) {
                // When disabled, sync with normal time
                previousUniforms.iAmplifiedTime.value = currentUniforms.iTime.value;
            }
            if (previousUniforms.iTime && currentUniforms.iTime) {
                previousUniforms.iTime.value += clockDelta;
            }
            if (previousUniforms.iTimeDelta && currentUniforms.iTimeDelta) {
                previousUniforms.iTimeDelta.value = clockDelta;
            }
            if (previousUniforms.iDate && currentUniforms.iDate) {
                previousUniforms.iDate.value = getCurrentDateVector();
            }
            if (previousUniforms.iFrame && currentUniforms.iFrame) {
                previousUniforms.iFrame.value = currentUniforms.iFrame.value;
            }
            
            // Update audio and video textures for reactivity
            if (previousUniforms.iAudioData && currentUniforms.iAudioData) {
                previousUniforms.iAudioData.value = currentUniforms.iAudioData.value;
                previousUniforms.iAudioData.value.needsUpdate = true;
            }
            if (previousUniforms.iVideo && currentUniforms.iVideo) {
                previousUniforms.iVideo.value = currentUniforms.iVideo.value;
                previousUniforms.iVideo.value.needsUpdate = true;
            }
            if (previousUniforms.iKeyboard && currentUniforms.iKeyboard) {
                previousUniforms.iKeyboard.value = currentUniforms.iKeyboard.value;
                previousUniforms.iKeyboard.value.needsUpdate = true;
            }
            if (previousUniforms.iMouse && currentUniforms.iMouse) {
                previousUniforms.iMouse.value = currentUniforms.iMouse.value;
            }
            if (previousUniforms.iResolution && currentUniforms.iResolution) {
                previousUniforms.iResolution.value = currentUniforms.iResolution.value;
            }
        }

        // Ensure the video texture advances
        const videoTex = threeProps.tuniform.iVideo.value as VideoTexture;
        if (videoTex) {
            videoTex.needsUpdate = true;
        }

        const video = videoElement as HTMLVideoElement;
        if (video) {
            // Smooth playbackRate changes to reduce stalls
            const smoothed = video.playbackRate * 0.85 + rate * 0.15;
            if (Math.abs(video.playbackRate - smoothed) > 0.01) {
                video.playbackRate = smoothed;
            }
            // Auto-resume playback if paused by the browser due to rapid changes
            if (video.paused) {
                video.play().catch(() => {/* ignore */});
            }
        }

        // Simple fade using opacity transition
        // Render multipass buffers (if any) into their targets before main render
        if (threeProps.buffers && threeProps.buffers.length > 0 && threeProps.bufferCamera) {
            // On first load, run extra warmup iterations to prime the dependency chain
            // and avoid NaN from divide-by-zero in shaders with self-referencing buffers.
            const warmupIterations = bufferWarmupRef.current;
            if (warmupIterations > 0) {
                bufferWarmupRef.current = 0;
            }
            const fallbackWrap = (shaderObject.metaData as any)?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
            const prevTarget = gl.getRenderTarget();

            // Run warmup passes BEFORE the main buffer loop so all buffers are primed.
            // Each warmup iteration snapshots current read textures, renders all buffers
            // in dependency order, then swaps. After N passes (N = buffer count) the
            // full A→B→C chain has propagated valid data.
            for (let w = 0; w < warmupIterations; w++) {
                const warmupReadTextures: (any|undefined)[] = threeProps.buffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
                for (let i = 0; i < threeProps.buffers.length; i++) {
                    const br = threeProps.buffers[i];
                    if (!br) continue;
                    const u = br.material.uniforms as TUniform;
                    const meta = br.channelMeta;
                    const samplers = br.channelSamplers || {};
                    const pre = br.preloaded;
                    const setChW = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any, sampler?: SamplerConfig) => {
                        if (src === 'audio') { (u[slot] as any).value = tuniform.iAudioData.value; return; }
                        if (src === 'video') { (u[slot] as any).value = tuniform.iVideo.value; return; }
                        if (src === 'keyboard') { (u[slot] as any).value = tuniform.iKeyboard.value; return; }
                        if (src === 'midi') { (u[slot] as any).value = tuniform.iMidi.value; return; }
                        let val: any;
                        const m2 = src && src.match(/^buffer(\d+)$/);
                        if (m2) { val = warmupReadTextures[parseInt(m2[1], 10)]; }
                        else { val = preVal; }
                        if (val) {
                            (u[slot] as any).value = val;
                            const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                            (u[slot] as any).value.wrapS = (u[slot] as any).value.wrapT = wrap;
                        }
                    };
                    setChW('iChannel0', meta.iChannel0, pre?.iChannel0, samplers.iChannel0);
                    setChW('iChannel1', meta.iChannel1, pre?.iChannel1, samplers.iChannel1);
                    setChW('iChannel2', meta.iChannel2, pre?.iChannel2, samplers.iChannel2);
                    setChW('iChannel3', meta.iChannel3, pre?.iChannel3, samplers.iChannel3);
                    const wWriteTarget = br.targets[br.writeIndex];
                    gl.setRenderTarget(wWriteTarget);
                    gl.clear(true, true, false);
                    gl.render(br.scene, threeProps.bufferCamera!);
                    const tmp2 = br.readIndex; br.readIndex = br.writeIndex; br.writeIndex = tmp2;
                }
            }

            // Build current read textures snapshot (after any warmup passes)
            const readTextures: (any|undefined)[] = threeProps.buffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
            // For each buffer: bind its iChannels (buffer refs use readTextures), render to its write target, then swap indices
            for (let i = 0; i < threeProps.buffers.length; i++) {
                const br = threeProps.buffers[i];
                if (!br) continue;

                const u = br.material.uniforms as TUniform;
                const meta = br.channelMeta;
                const samplers = br.channelSamplers || {};
                const pre = br.preloaded;

                // Set channels: prefer buffer refs using read textures; otherwise use preloaded textures (if any)
                const setCh = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any, sampler?: SamplerConfig) => {
                    if (src === 'audio') {
                        (u[slot] as any).value = tuniform.iAudioData.value;
                        return;
                    }
                    if (src === 'video') {
                        (u[slot] as any).value = tuniform.iVideo.value;
                        return;
                    }
                    if (src === 'keyboard') {
                        (u[slot] as any).value = tuniform.iKeyboard.value;
                        return;
                    }
                    if (src === 'midi') {
                        (u[slot] as any).value = tuniform.iMidi.value;
                        return;
                    }
                    let val: any;
                    const m = src && src.match(/^buffer(\d+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else {
                        val = preVal;
                    }
                    if (val) {
                        (u[slot] as any).value = val;
                        const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                        (u[slot] as any).value.wrapS = (u[slot] as any).value.wrapT = wrap;
                    }
                };

                setCh('iChannel0', meta.iChannel0, pre?.iChannel0, samplers.iChannel0);
                setCh('iChannel1', meta.iChannel1, pre?.iChannel1, samplers.iChannel1);
                setCh('iChannel2', meta.iChannel2, pre?.iChannel2, samplers.iChannel2);
                setCh('iChannel3', meta.iChannel3, pre?.iChannel3, samplers.iChannel3);

                const writeTarget = br.targets[br.writeIndex];
                gl.setRenderTarget(writeTarget);
                gl.clear(true, true, false);
                gl.render(br.scene, threeProps.bufferCamera);

                // swap read/write
                const tmp = br.readIndex; br.readIndex = br.writeIndex; br.writeIndex = tmp;
            }

            // Bind final pass buffer channels from current read textures, or preloaded textures
            if (threeProps.finalChannels) {
                const finalU = matRef.current!.uniforms as TUniform;
                const fc = threeProps.finalChannels;
                const fp = threeProps.finalPreloaded || {};
                const finalMeta = shaderObject.metaData as any || {};
                const setFinal = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any) => {
                    if (src === 'audio') {
                        (finalU[slot] as any).value = tuniform.iAudioData.value;
                        return;
                    }
                    if (src === 'video') {
                        (finalU[slot] as any).value = tuniform.iVideo.value;
                        return;
                    }
                    if (src === 'keyboard') {
                        (finalU[slot] as any).value = tuniform.iKeyboard.value;
                        return;
                    }
                    if (src === 'midi') {
                        (finalU[slot] as any).value = tuniform.iMidi.value;
                        return;
                    }
                    let val: any;
                    const m = src && src.match(/^buffer(\d+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else {
                        val = preVal;
                    }
                    if (val) {
                        (finalU[slot] as any).value = val;
                        const sampler: SamplerConfig | undefined = finalMeta[`${slot}Sampler`];
                        const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                        (finalU[slot] as any).value.wrapS = (finalU[slot] as any).value.wrapT = wrap;
                    }
                };
                setFinal('iChannel0', fc.iChannel0, (fp as any).iChannel0);
                setFinal('iChannel1', fc.iChannel1, (fp as any).iChannel1);
                setFinal('iChannel2', fc.iChannel2, (fp as any).iChannel2);
                setFinal('iChannel3', fc.iChannel3, (fp as any).iChannel3);
            }

            // restore
            gl.setRenderTarget(prevTarget);
        }

        // Increment frame count at the very end of rendering the frame
        threeProps.tuniform.iFrame.value += 1;
    });

    return (
        <>
            {/* Previous shader mesh for fade out */}
            {shaderFade && isTransitioning && previousMatRef.current && (
                <mesh visible>
                    <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
                    <shaderMaterial
                        attach="material"
                        uniforms={previousMatRef.current.uniforms}
                        vertexShader={general_purpose_vertex_shader}
                        fragmentShader={previousMatRef.current.fragmentShader}
                        side={DoubleSide}
                        transparent={true}
                        opacity={1.0 - fadeProgress}
                    />
                </mesh>
            )}
            {/* Current shader mesh */}
            <mesh visible>
                <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
                <shaderMaterial
                    attach="material"
                    uniforms={threeProps?.tuniform}
                    vertexShader={general_purpose_vertex_shader}
                    side={DoubleSide}
                    transparent={shaderFade && isTransitioning}
                    opacity={shaderFade && isTransitioning ? fadeProgress : 1.0}
                    ref={matRef} />
            </mesh>
        </>
    );
};
