import React, { useEffect, useState, useRef, useMemo } from 'react';
import browser from "webextension-polyfill";
import { useFrame, useThree } from '@react-three/fiber';
import type { ShaderObject, ShaderUniform } from "@src/helpers/types";
import {
    Clock,
    Cache,
    DataTexture, DoubleSide, IUniform,
    LuminanceFormat, PixelFormat,
    RGBAFormat, RedFormat, RepeatWrapping,
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
    WebGLCubeRenderTarget,
    Scene,
    OrthographicCamera,
    PlaneGeometry,
    Mesh,
    LinearFilter,
    NearestFilter,
    LinearMipmapLinearFilter,
    FloatType,
    HalfFloatType,
    ClampToEdgeWrapping,
    Camera
} from "three";
import { fetchFragmentShader, getShaderLoadIdentity } from '@src/helpers/shaderActions';
import { getEditedShader } from '@src/helpers/shaderStorage';
import { getImageBlobDB, getVideoBlobDB, getCubemapFacesDB } from '@src/storage/shaderDB';
import { channelRefToImageId, isCustomImageRef } from '@src/helpers/customImageStorage';
import { channelRefToVideoId, isCustomVideoRef, isBundledVideoRef } from '@src/helpers/customVideoStorage';
import { channelRefToCubemapId, isCustomCubemapRef } from '@src/helpers/customCubemapStorage';
import { getGreyNoise3DTexture, getRGBANoise3DTexture } from '@src/helpers/volumeNoiseGenerator';
import { DECR_TIME, INCR_TIME, RESET_TIME } from '@src/helpers/constants';
import { SETTINGS_MIDI_ENABLED, SETTINGS_MIDI_MAPPINGS, SETTINGS_ENABLE_IAMPLIFIED_TIME, SETTINGS_WAIT_FOR_AUDIO, SETTINGS_JOYSTICK_ENABLED, SETTINGS_JOYSTICK_MAPPINGS, SETTINGS_EQ_GAINS } from '@src/storage/storageConstants';
import type { MidiMappings, JoystickMappings } from '@src/helpers/types';
import { logger } from '@src/helpers/logger';
import { ShaderTransitionPass, TransitionEffect, TRANSITION_EFFECT_CONFIGS } from '@src/helpers/ShaderTransitionPass';

Cache.enabled = true;
const DEFAULT_FFT_SIZE = 1024;
const fill_color = "#4087A0";
const min_speed = 0.3;
const default_shader_factor = 1.0;
const AUDIO_DETECT_THRESHOLD = 1;
const TRANSITION_FBO_SCALE = 0.65;

const KEYBOARD_TEXTURE_WIDTH = 256;
const KEYBOARD_TEXTURE_HEIGHT = 2;
const KEYBOARD_BYTES_PER_PIXEL = 4;

const MIDI_TEXTURE_WIDTH = 128;
const MIDI_TEXTURE_HEIGHT = 4;
const MIDI_FFT_DECAY = 0.85;

const JOYSTICK_TEXTURE_WIDTH = 32;
const JOYSTICK_TEXTURE_HEIGHT = 4;

function getKeyboardKeyCode(event: KeyboardEvent): number | null {
    if (event.keyCode != null && event.keyCode > 0 && event.keyCode < KEYBOARD_TEXTURE_WIDTH) {
        return event.keyCode;
    }

    if (event.key && event.key.length === 1) {
        const code = event.key.toUpperCase().charCodeAt(0);
        if (code >= 0 && code < KEYBOARD_TEXTURE_WIDTH) return code;
    }

    if (event.code) {
        switch (event.code) {
            case 'Space': return 32;
            case 'Enter': return 13;
            case 'Escape': return 27;
            case 'Backspace': return 8;
            case 'Tab': return 9;
            case 'ShiftLeft':
            case 'ShiftRight': return 16;
            case 'ControlLeft':
            case 'ControlRight': return 17;
            case 'AltLeft':
            case 'AltRight': return 18;
            case 'CapsLock': return 20;
            case 'ArrowLeft': return 37;
            case 'ArrowUp': return 38;
            case 'ArrowRight': return 39;
            case 'ArrowDown': return 40;
            case 'Digit0': return 48;
            case 'Digit1': return 49;
            case 'Digit2': return 50;
            case 'Digit3': return 51;
            case 'Digit4': return 52;
            case 'Digit5': return 53;
            case 'Digit6': return 54;
            case 'Digit7': return 55;
            case 'Digit8': return 56;
            case 'Digit9': return 57;
            case 'KeyA': return 65;
            case 'KeyB': return 66;
            case 'KeyC': return 67;
            case 'KeyD': return 68;
            case 'KeyE': return 69;
            case 'KeyF': return 70;
            case 'KeyG': return 71;
            case 'KeyH': return 72;
            case 'KeyI': return 73;
            case 'KeyJ': return 74;
            case 'KeyK': return 75;
            case 'KeyL': return 76;
            case 'KeyM': return 77;
            case 'KeyN': return 78;
            case 'KeyO': return 79;
            case 'KeyP': return 80;
            case 'KeyQ': return 81;
            case 'KeyR': return 82;
            case 'KeyS': return 83;
            case 'KeyT': return 84;
            case 'KeyU': return 85;
            case 'KeyV': return 86;
            case 'KeyW': return 87;
            case 'KeyX': return 88;
            case 'KeyY': return 89;
            case 'KeyZ': return 90;
        }
    }

    return null;
}

const general_purpose_vertex_shader = `
varying vec2 vUv; 
void main()
{
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`;

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
    nextShaderObject?: ShaderObject;
    speedDivider: number;
    randomizeBeat?: boolean;
    randomizeBeatInterval?: number;
    shaderFade?: boolean;
    transitionEffect?: TransitionEffect;
    transitionDuration?: number;
    customTransitionShader?: string;
    renderScale?: number;
    onShaderChangeRequested?: () => void;
};

type TUniform = { [uniform: string]: IUniform };

type BufferMeta = {
    shaderName: string;
    output: number;
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

type CubemapPassMeta = {
    shaderName: string;
    letter: string;
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    cubemaps?: string[];
};

const CUBEMAP_PASS_SIZE = 1024;

type CubemapRuntime = {
    material: ShaderMaterial;
    scene: Scene;
    targets: [WebGLCubeRenderTarget, WebGLCubeRenderTarget];
    readIndex: number;
    writeIndex: number;
    letter: string;
    channelMeta: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    channelSamplers: { iChannel0?: SamplerConfig; iChannel1?: SamplerConfig; iChannel2?: SamplerConfig; iChannel3?: SamplerConfig };
    preloaded: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

type MaterialProps = {
    clock: Clock;
    format: PixelFormat;
    tuniform: TUniform;
    bufferCamera?: OrthographicCamera;
    buffers?: BufferRuntime[];
    cubemaps?: CubemapRuntime[];
    finalChannels?: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    finalPreloaded?: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

export const AnalyzerMesh = ({
    analyser,
    canvas,
    videoElement,
    shaderObject,
    nextShaderObject,
    speedDivider,
    randomizeBeat = false,
    randomizeBeatInterval = 4,
    shaderFade = false,
    transitionEffect ,
    transitionDuration = 2.0,
    customTransitionShader,
    renderScale = 1.0,
    onShaderChangeRequested,
}: AnalyzerMeshProps) => {
    const fftSize = shaderObject.metaData?.fftSize || DEFAULT_FFT_SIZE;
    const frequencyBinCount = fftSize / 2;
    const fbcArrayRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(frequencyBinCount)));
    const meshRef = useRef<Mesh>(null);
    const matRef = useRef<ShaderMaterial>(null);
    const previousMatRef = useRef<ShaderMaterial | null>(null);
    const transitionPassRef = useRef<ShaderTransitionPass | null>(null);
    const isPreparingShaderRef = useRef<boolean>(false);
    const prewarmedRef = useRef<{
        identity: string;
        shaderName: string;
        fragmentShader: string;
        material: ShaderMaterial;
    } | null>(null);
    const [draw_analyzer] = useState(true);
    const [threeProps, setThreeProps] = useState<MaterialProps>();
    const threePropsRef = useRef<MaterialProps | undefined>(undefined);
    threePropsRef.current = threeProps;
    const [loadedShaderName, setLoadedShaderName] = useState<string>("");
    const [loadedShaderIdentity, setLoadedShaderIdentity] = useState<string>("");
    const shaderLoadIdentity = useMemo(() => getShaderLoadIdentity(shaderObject), [shaderObject]);
    const [loadedRenderScale, setLoadedRenderScale] = useState<number>(renderScale);
    const [fadeProgress, setFadeProgress] = useState<number>(1.0);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
    const [previousBuffers, setPreviousBuffers] = useState<BufferRuntime[] | undefined>();
    const { gl, viewport, camera } = useThree();
    const stopVideoFrameRef = useRef<boolean>(false);

    const beatCounterRef = useRef<number>(0);

    const keyboardStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * KEYBOARD_TEXTURE_HEIGHT * KEYBOARD_BYTES_PER_PIXEL)));
    const keyboardPrevStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH)));
    const keyboardPressTimeRef = useRef<Float32Array>(new Float32Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * 4)));
    const keyboardToggleRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH)));
    const currentTimeRef = useRef<number>(0);

    const midiStateRef = useRef<Uint8Array>(new Uint8Array(MIDI_TEXTURE_WIDTH * MIDI_TEXTURE_HEIGHT));
    const midiFftInjectionRef = useRef<Float32Array>(new Float32Array(512));
    const midiMappingsRef = useRef<MidiMappings>([]);
    const midiEnabledRef = useRef<boolean>(false);
    const midiRelativeAccRef = useRef(new Map());
    const eqGainsRef = useRef<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const joystickStateRef = useRef<Uint8Array>(new Uint8Array(JOYSTICK_TEXTURE_WIDTH * JOYSTICK_TEXTURE_HEIGHT));
    const joystickMappingsRef = useRef<JoystickMappings>([]);
    const joystickEnabledRef = useRef<boolean>(false);
    const joystickDirectActiveRef = useRef<boolean>(false);
    const enableIAmplifiedTimeRef = useRef<boolean>(true);
    const waitForAudioRef = useRef<boolean>(false);
    const audioDetectedRef = useRef<boolean>(false);
    const wasTimeGatedRef = useRef<boolean>(false);

    const channelLoadTimeRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);
    const customImageUrlsRef = useRef<string[]>([]);
    const customVideoElementsRef = useRef<HTMLVideoElement[]>([]);
    const customVideoUrlsRef = useRef<string[]>([]);
    const bufferWarmupRef = useRef<number>(0);

    useEffect(() => {
        const w = Math.max(1, Math.round(window.innerWidth * renderScale * TRANSITION_FBO_SCALE));
        const h = Math.max(1, Math.round(window.innerHeight * renderScale * TRANSITION_FBO_SCALE));
        if (!transitionPassRef.current) {
            const pass = new ShaderTransitionPass(w, h, threeProps?.tuniform?.iAudioData?.value);
            transitionPassRef.current = pass;
            ShaderTransitionPass.precompileShaders(gl, camera, [pass.activeMaterial]);
        } else {
            transitionPassRef.current.resize(w, h);
        }
    }, [viewport.width, viewport.height, renderScale, threeProps, gl, camera]);

    useEffect(() => {
        if (customTransitionShader && transitionPassRef.current) {
            transitionPassRef.current.setCustomTransitionShader(customTransitionShader);
            ShaderTransitionPass.precompileShaders(gl, camera, [transitionPassRef.current.activeMaterial]);
        }
    }, [customTransitionShader, gl, camera]);

    useEffect(() => {
        return () => {
            transitionPassRef.current?.dispose();
            transitionPassRef.current = null;
            prewarmedRef.current?.material.dispose();
            prewarmedRef.current = null;
        };
    }, []);

    const waitForVideoReady = (video: HTMLVideoElement) => new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
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

    const injectShadertoyDefines = (code: string): string =>
        (!code || /#define\s+HW_PERFORMANCE\b/.test(code)) ? code : '#define HW_PERFORMANCE 1\n' + code;

    const wrapFadeUniform = (code: string): string => {
        if (!code || code.includes('iTransitionOpacity')) return code;
        let out = 'uniform float iTransitionOpacity;\n' + code;
        out = out.replace(/\bvoid\s+main\s*\(\s*(void)?\s*\)/g, 'void shaderamp_main_fade()');
        out += '\nvoid main() {\n    shaderamp_main_fade();\n    gl_FragColor *= iTransitionOpacity;\n}\n';
        return out;
    };

    useEffect(() => {
        if (!nextShaderObject || !threePropsRef.current) return;
        const nextIdentity = getShaderLoadIdentity(nextShaderObject);
        if (nextIdentity === shaderLoadIdentity || prewarmedRef.current?.identity === nextIdentity) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            if (cancelled || !threePropsRef.current) return;
            try {
                let code = nextShaderObject.inlineCode;
                if (!code) {
                    const edited = await getEditedShader(nextShaderObject.shaderName);
                    code = edited?.inlineCode ?? (await fetchFragmentShader(nextShaderObject.shaderName));
                }
                if (cancelled || !code) return;

                const processed = wrapFadeUniform(injectShadertoyDefines(code));
                const warmMat = new ShaderMaterial({
                    vertexShader: general_purpose_vertex_shader,
                    fragmentShader: processed,
                    uniforms: threePropsRef.current.tuniform,
                    side: DoubleSide,
                });

                const ms = await ShaderTransitionPass.precompileShaders(gl, camera, [warmMat]);
                if (cancelled) {
                    warmMat.dispose();
                    return;
                }

                prewarmedRef.current?.material.dispose();
                prewarmedRef.current = {
                    identity: nextIdentity,
                    shaderName: nextShaderObject.shaderName,
                    fragmentShader: processed,
                    material: warmMat,
                };
                console.log(`[ShaderTransitionPass] Background pre-warmed "${nextShaderObject.shaderName}" in ${ms.toFixed(1)} ms`);
            } catch (err) {
                logger.renderer.warn('ShaderTransitionPass', 'Background prewarm skipped: %s', err);
            }
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [nextShaderObject, shaderLoadIdentity, gl, camera]);

    const loadFragmentShader = async () => {
        const activeProps = threePropsRef.current;
        if (!activeProps) return;

        logger.renderer.log('AnalyzerMesh', 'Loading shader: %s', shaderObject.shaderName);
        const meta = shaderObject.metaData as any;
        const fallbackWrap = meta?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
        const fallbackFlipY = meta?.textureFlipY !== false;

        const video = videoElement!;
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        video.src = shaderObject.metaData?.video ?? browser.runtime.getURL('media/SpaceTravel1Min.mp4');
        await waitForVideoReady(video);
        try { await video.play(); } catch (e) { }

        const tuniform = activeProps.tuniform;
        const vtex = new VideoTexture(video);
        vtex.generateMipmaps = false;
        vtex.minFilter = LinearFilter;
        vtex.magFilter = LinearFilter;
        vtex.wrapS = ClampToEdgeWrapping;
        vtex.wrapT = ClampToEdgeWrapping;
        tuniform.iVideo.value = vtex;

        const anyVideo: any = video;
        stopVideoFrameRef.current = false;
        if (typeof anyVideo.requestVideoFrameCallback === 'function') {
            const cb = (_now: number, _meta: any) => {
                if (stopVideoFrameRef.current) return;
                ShaderTransitionPass.syncVideoTexture(tuniform.iVideo.value as VideoTexture, video);
                anyVideo.requestVideoFrameCallback(cb);
            };
            anyVideo.requestVideoFrameCallback(cb);
        } else {
            const onTimeUpdate = () => {
                ShaderTransitionPass.syncVideoTexture(tuniform.iVideo.value as VideoTexture, video);
            };
            video.addEventListener('timeupdate', onTimeUpdate);
            (video as any).__onTimeUpdateShaderAmp = onTimeUpdate;
        }

        const isBufferRef = (s?: string) => !!s && (/^buffer(\d+)$/.test(s) || /^cubemap[A-Z]$/.test(s));

        const recordChannelLoad = (channelIdx: number, texture: any, startTime: number) => {
            channelLoadTimeRef.current[channelIdx] = startTime;
            if (texture && texture.image) {
                const img = texture.image;
                tuniform.iChannelResolution.value[channelIdx].set(img.width || 0, img.height || 0, 1.0);
            }
        };

        const currentTime = tuniform.iTime.value;

        const loadCubemap = (basePath: string, channelIdx: number): Promise<CubeTexture> => {
            return new Promise((resolve) => {
                const cubeLoader = new CubeTextureLoader();
                const isDirectional = /\/(px|nx|py|ny|pz|nz)\.[a-z]+$/i.test(basePath);
                let faceUrls: string[];

                if (isDirectional) {
                    const dirMatch = basePath.match(/^(.*)\/(px|nx|py|ny|pz|nz)(\.[a-z]+)$/i);
                    if (dirMatch) {
                        const baseDir = dirMatch[1];
                        const ext = dirMatch[3];
                        faceUrls = [
                            browser.runtime.getURL(`${baseDir}/px${ext}`),
                            browser.runtime.getURL(`${baseDir}/nx${ext}`),
                            browser.runtime.getURL(`${baseDir}/py${ext}`),
                            browser.runtime.getURL(`${baseDir}/ny${ext}`),
                            browser.runtime.getURL(`${baseDir}/pz${ext}`),
                            browser.runtime.getURL(`${baseDir}/nz${ext}`),
                        ];
                    } else {
                        faceUrls = [basePath, basePath, basePath, basePath, basePath, basePath];
                    }
                } else {
                    const extMatch = basePath.match(/(\.[a-z]+)$/i);
                    const ext = extMatch ? extMatch[1] : '.jpg';
                    const baseWithoutExt = extMatch ? basePath.slice(0, -ext.length) : basePath;
                    faceUrls = [
                        browser.runtime.getURL(`${baseWithoutExt}${ext}`),
                        browser.runtime.getURL(`${baseWithoutExt}_1${ext}`),
                        browser.runtime.getURL(`${baseWithoutExt}_2${ext}`),
                        browser.runtime.getURL(`${baseWithoutExt}_3${ext}`),
                        browser.runtime.getURL(`${baseWithoutExt}_4${ext}`),
                        browser.runtime.getURL(`${baseWithoutExt}_5${ext}`),
                    ];
                }

                const cubeTex = cubeLoader.load(
                    faceUrls,
                    (tex) => {
                        recordChannelLoad(channelIdx, tex, currentTime);
                        resolve(tex);
                    },
                    undefined,
                    (err) => {
                        logger.renderer.warn('ShaderAmp', 'Cubemap load error: %s', err);
                        resolve(cubeTex);
                    }
                );
            });
        };

        const loadCustomImageTexture = async (
            channelRef: string,
            uniformKey: string,
            channelIdx: 0 | 1 | 2 | 3,
            sampler?: SamplerConfig
        ) => {
            const imageId = channelRefToImageId(channelRef);
            if (!imageId) return;
            try {
                const blob = await getImageBlobDB(imageId);
                if (!blob) return;
                const objectUrl = URL.createObjectURL(blob);
                customImageUrlsRef.current.push(objectUrl);
                await new Promise<void>((resolve) => {
                    const tex = new TextureLoader().load(
                        objectUrl,
                        (t) => {
                            recordChannelLoad(channelIdx, t, currentTime);
                            URL.revokeObjectURL(objectUrl);
                            customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== objectUrl);
                            resolve();
                        },
                        undefined,
                        () => resolve()
                    );
                    applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
                    tuniform[uniformKey].value = tex;
                });
            } catch (err) {
                logger.renderer.error('ShaderAmp', 'Failed to load custom image %s: %s', imageId, err);
            }
        };

        const loadCustomVideoTexture = async (
            channelRef: string,
            uniformKey: string,
            channelIdx: 0 | 1 | 2 | 3,
            sampler?: SamplerConfig
        ) => {
            const videoId = channelRefToVideoId(channelRef);
            if (!videoId) return;
            try {
                const blob = await getVideoBlobDB(videoId);
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
                await waitForVideoReady(videoEl);
                try { await videoEl.play(); } catch (_e) { }
                const vtex = new VideoTexture(videoEl);
                vtex.generateMipmaps = false;
                applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
                tuniform[uniformKey].value = vtex;
                channelLoadTimeRef.current[channelIdx] = tuniform.iTime.value;
            } catch (err) {
                logger.renderer.error('ShaderAmp', 'Failed to load custom video %s: %s', videoId, err);
            }
        };

        const loadBundledVideoTexture = async (
            channelRef: string,
            uniformKey: string,
            channelIdx: 0 | 1 | 2 | 3,
            sampler?: SamplerConfig
        ) => {
            const videoEl = document.createElement('video');
            videoEl.src = browser.runtime.getURL(channelRef);
            videoEl.muted = true;
            videoEl.loop = true;
            videoEl.playsInline = true;
            videoEl.crossOrigin = 'anonymous';
            customVideoElementsRef.current.push(videoEl);
            await waitForVideoReady(videoEl);
            videoEl.play().catch(() => {});
            const vtex = new VideoTexture(videoEl);
            vtex.generateMipmaps = false;
            applySamplerToTexture(vtex, sampler, fallbackWrap, fallbackFlipY);
            tuniform[uniformKey].value = vtex;
            channelLoadTimeRef.current[channelIdx] = tuniform.iTime.value;
        };

        const loadCustomCubemap = async (
            channelRef: string,
            uniformKey: string,
            channelIdx: 0 | 1 | 2 | 3,
            _sampler?: SamplerConfig
        ) => {
            const cubemapId = channelRefToCubemapId(channelRef);
            if (!cubemapId) return;
            try {
                const faces = await getCubemapFacesDB(cubemapId);
                if (!faces) return;
                const faceMap: Record<string, Blob> = {};
                for (const face of faces) {
                    faceMap[face.name] = face.blob;
                }
                const faceOrder: ('px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz')[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
                const faceUrls: string[] = [];
                for (const faceName of faceOrder) {
                    const blob = faceMap[faceName];
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    customImageUrlsRef.current.push(url);
                    faceUrls.push(url);
                }
                await new Promise<void>((resolve) => {
                    const cubeLoader = new CubeTextureLoader();
                    const cubeTex = cubeLoader.load(
                        faceUrls,
                        (tex) => {
                            recordChannelLoad(channelIdx, tex, currentTime);
                            faceUrls.forEach(url => {
                                URL.revokeObjectURL(url);
                                customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== url);
                            });
                            resolve();
                        },
                        undefined,
                        () => resolve()
                    );
                    tuniform[uniformKey].value = cubeTex;
                });
            } catch (err) {
                logger.renderer.error('ShaderAmp', 'Failed to load custom cubemap %s: %s', cubemapId, err);
            }
        };

        const loadChannelTexture = async (
            channelPath: string | undefined,
            defaultPath: string,
            channelType: 'texture' | 'cubemap' | undefined,
            channelIdx: 0 | 1 | 2 | 3,
            sampler?: SamplerConfig
        ) => {
            const texturePath = channelPath ?? defaultPath;
            if (channelType === 'cubemap') {
                return await loadCubemap(channelPath ?? 'images/cubemaps/abc.jpg', channelIdx);
            }
            return await new Promise<any>((resolve) => {
                const tex = new TextureLoader().load(
                    browser.runtime.getURL(texturePath),
                    (t) => {
                        recordChannelLoad(channelIdx, t, currentTime);
                        resolve(t);
                    },
                    undefined,
                    () => resolve(tex)
                );
                applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
            });
        };

        const channelDefaults = [
            'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg',
            'images/beton_3_pexels-photo-5622880.jpeg',
            'images/NyanCatSprite.png',
            'images/NyanCatSprite.png',
        ];

        const channelLoadPromises: Promise<void>[] = [];

        for (let idx = 0; idx < 4; idx++) {
            const chIdx = idx as 0 | 1 | 2 | 3;
            const key = `iChannel${idx}` as 'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3';
            const ch = (shaderObject.metaData as any)?.[key];
            const chType = meta?.[`${key}Type`];
            const sampler = meta?.[`${key}Sampler`];

            if (isBufferRef(ch)) continue;

            if (isCustomImageRef(ch)) {
                channelLoadPromises.push(loadCustomImageTexture(ch!, key, chIdx, sampler));
            } else if (isCustomVideoRef(ch)) {
                channelLoadPromises.push(loadCustomVideoTexture(ch!, key, chIdx, sampler));
            } else if (isCustomCubemapRef(ch)) {
                channelLoadPromises.push(loadCustomCubemap(ch!, key, chIdx, sampler));
            } else if (isBundledVideoRef(ch)) {
                channelLoadPromises.push(loadBundledVideoTexture(ch!, key, chIdx, sampler));
            } else if (ch === 'video' || chType === 'video') {
                const vtexCh = new VideoTexture(videoElement as HTMLVideoElement);
                vtexCh.generateMipmaps = false;
                applySamplerToTexture(vtexCh, sampler, fallbackWrap, fallbackFlipY);
                tuniform[key].value = vtexCh;
                channelLoadTimeRef.current[chIdx] = tuniform.iTime.value;
            } else if (chType === 'volume') {
                const volumeTex = ch === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform[key].value = volumeTex;
                channelLoadTimeRef.current[chIdx] = tuniform.iTime.value;
            } else if (ch === 'keyboard') {
                tuniform[key].value = tuniform.iKeyboard.value;
                tuniform.iChannelResolution.value[chIdx].set(KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, 1);
                channelLoadTimeRef.current[chIdx] = tuniform.iTime.value;
            } else if (ch === 'audio') {
                tuniform[key].value = tuniform.iAudioData.value;
                channelLoadTimeRef.current[chIdx] = tuniform.iTime.value;
            } else if (ch === 'midi') {
                tuniform[key].value = tuniform.iMidi.value;
                channelLoadTimeRef.current[chIdx] = tuniform.iTime.value;
            } else {
                channelLoadPromises.push(
                    loadChannelTexture(ch, channelDefaults[idx], chType, chIdx, sampler).then((tex) => {
                        tuniform[key].value = tex;
                    })
                );
            }
        }

        const material = matRef.current as ShaderMaterial;

        const cachedPrewarm = prewarmedRef.current?.identity === shaderLoadIdentity ? prewarmedRef.current : null;

        let processedShader: string;
        if (cachedPrewarm) {
            processedShader = cachedPrewarm.fragmentShader;
            await Promise.all(channelLoadPromises);
            cachedPrewarm.material.dispose();
            prewarmedRef.current = null;
        } else {
            let editedShaderCode: string | undefined;
            if (!shaderObject.inlineCode) {
                const editedShader = await getEditedShader(shaderObject.shaderName);
                if (editedShader?.inlineCode) {
                    editedShaderCode = editedShader.inlineCode;
                }
            }

            const [loadedFragmentShader] = await Promise.all([
                shaderObject.inlineCode
                    ? Promise.resolve(shaderObject.inlineCode)
                    : editedShaderCode
                    ? Promise.resolve(editedShaderCode)
                    : fetchFragmentShader(shaderObject.shaderName),
                ...channelLoadPromises,
            ]);

            processedShader = wrapFadeUniform(injectShadertoyDefines(loadedFragmentShader));
        }

        if (shaderFade && material.fragmentShader && loadedShaderName && material.fragmentShader !== processedShader) {
            if (previousMatRef.current) {
                previousMatRef.current.dispose();
            }
            previousMatRef.current = ShaderTransitionPass.createSnapshotMaterial(
                material,
                general_purpose_vertex_shader
            );
        }

        material.fragmentShader = processedShader;
        material.needsUpdate = true;
    };

    const setupMultipassBuffers = async (): Promise<{ bufferRuntimes: BufferRuntime[]; cubemapRuntimes: CubemapRuntime[]; bufferCamera?: OrthographicCamera }> => {
        const activeProps = threePropsRef.current;
        if (!activeProps) return { bufferRuntimes: [], cubemapRuntimes: [] };
        const meta: any = shaderObject.metaData || {};
        const fallbackWrap = meta?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
        const fallbackFlipY = meta?.textureFlipY !== false;
        let buffersMeta: BufferMeta[] | undefined = meta?.buffers;
        const cubemapPassesMeta: CubemapPassMeta[] = meta?.cubemapPasses || [];

        activeProps.cubemaps?.forEach(c => { c.targets[0].dispose(); c.targets[1].dispose(); });
        if ((!buffersMeta || buffersMeta.length === 0) && cubemapPassesMeta.length === 0) {
            setThreeProps({ ...activeProps, buffers: [], cubemaps: [], bufferCamera: undefined });
            return { bufferRuntimes: [], cubemapRuntimes: [] };
        }

        buffersMeta = [...(buffersMeta || [])].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));

        const width = Math.max(1, Math.round(window.innerWidth * renderScale));
        const height = Math.max(1, Math.round(window.innerHeight * renderScale));
        const bufferRuntimes: BufferRuntime[] = [];
        const cubemapRuntimes: CubemapRuntime[] = [];

        const bufCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new PlaneGeometry(2, 2);
        const baseUniforms = activeProps.tuniform;

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
                iChannelResolution: { value: [new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1)] },
                iChannel0: { value: undefined },
                iChannel1: { value: undefined },
                iChannel2: { value: undefined },
                iChannel3: { value: undefined },
            } as TUniform;
            const knownKeys = new Set(Object.keys(base));
            for (const key of Object.keys(shared)) {
                if (!knownKeys.has(key)) {
                    (base as any)[key] = shared[key];
                }
            }
            return base;
        };

        const preloadIfPath = (src?: string, channelName?: string, cubemapsList?: string[], sampler?: SamplerConfig, chType?: string) => {
            if (!src) return undefined;
            if (src.match(/^buffer(\d+)$/) || src.match(/^cubemap[A-Z]$/)) return undefined;
            if (chType === 'volume' || isCustomImageRef(src) || isCustomVideoRef(src) || isCustomCubemapRef(src) || isBundledVideoRef(src)) return undefined;
            if (channelName && cubemapsList?.includes(channelName)) {
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

        for (let i = 0; i < buffersMeta.length; i++) {
            const b = buffersMeta[i];
            const targetA = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: FloatType });
            targetA.texture.generateMipmaps = false; targetA.texture.minFilter = LinearFilter; targetA.texture.magFilter = LinearFilter;
            const targetB = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: FloatType });
            targetB.texture.generateMipmaps = false; targetB.texture.minFilter = LinearFilter; targetB.texture.magFilter = LinearFilter;

            let bufferCode: string;
            if (shaderObject.inlineBuffers?.[b.shaderName]) {
                bufferCode = shaderObject.inlineBuffers[b.shaderName];
            } else {
                const editedShader = await getEditedShader(shaderObject.shaderName);
                if (editedShader?.inlineBuffers?.[b.shaderName]) {
                    bufferCode = editedShader.inlineBuffers[b.shaderName];
                } else {
                    bufferCode = await fetchFragmentShader(b.shaderName);
                }
            }

            const mat = new ShaderMaterial({
                vertexShader: general_purpose_vertex_shader,
                fragmentShader: injectShadertoyDefines(bufferCode),
                uniforms: makePassUniforms(baseUniforms),
            });
            const scene = new Scene();
            scene.add(new Mesh(geometry, mat));

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

        const cubemapNeedsMipmaps = (letter: string): boolean => {
            const ref = `cubemap${letter}`;
            const consumers: any[] = [...(buffersMeta || []), ...cubemapPassesMeta, meta];
            for (const c of consumers) {
                for (let ch = 0; ch < 4; ch++) {
                    if (c[`iChannel${ch}`] === ref && c[`iChannel${ch}Sampler`]?.filter === 'mipmap') return true;
                }
            }
            return false;
        };

        for (const cp of cubemapPassesMeta) {
            const useMipmaps = cubemapNeedsMipmaps(cp.letter);
            const makeCubeTarget = () => {
                const t = new WebGLCubeRenderTarget(CUBEMAP_PASS_SIZE, { depthBuffer: false, stencilBuffer: false, type: useMipmaps ? HalfFloatType : FloatType });
                t.texture.generateMipmaps = useMipmaps;
                t.texture.minFilter = useMipmaps ? LinearMipmapLinearFilter : LinearFilter;
                t.texture.magFilter = LinearFilter;
                return t;
            };
            const cubeTargetA = makeCubeTarget();
            const cubeTargetB = makeCubeTarget();

            let cubeCode: string;
            if (shaderObject.inlineBuffers?.[cp.shaderName]) {
                cubeCode = shaderObject.inlineBuffers[cp.shaderName];
            } else {
                const editedShader = await getEditedShader(shaderObject.shaderName);
                if (editedShader?.inlineBuffers?.[cp.shaderName]) {
                    cubeCode = editedShader.inlineBuffers[cp.shaderName];
                } else {
                    cubeCode = await fetchFragmentShader(cp.shaderName);
                }
            }

            const cubeUniforms = makePassUniforms(baseUniforms);
            (cubeUniforms as any).iCubeFace = { value: 0 };
            (cubeUniforms as any).iResolution = { value: new Vector3(CUBEMAP_PASS_SIZE, CUBEMAP_PASS_SIZE, 1) };
            const cubeMat = new ShaderMaterial({
                vertexShader: general_purpose_vertex_shader,
                fragmentShader: injectShadertoyDefines(cubeCode),
                uniforms: cubeUniforms,
            });
            const cubeScene = new Scene();
            cubeScene.add(new Mesh(geometry, cubeMat));

            cubemapRuntimes.push({
                material: cubeMat,
                scene: cubeScene,
                targets: [cubeTargetA, cubeTargetB],
                readIndex: 0,
                writeIndex: 1,
                letter: cp.letter,
                channelMeta: { iChannel0: cp.iChannel0, iChannel1: cp.iChannel1, iChannel2: cp.iChannel2, iChannel3: cp.iChannel3 },
                channelSamplers: {
                    iChannel0: (cp as any).iChannel0Sampler,
                    iChannel1: (cp as any).iChannel1Sampler,
                    iChannel2: (cp as any).iChannel2Sampler,
                    iChannel3: (cp as any).iChannel3Sampler,
                },
                preloaded: {
                    iChannel0: preloadIfPath(cp.iChannel0, "iChannel0", cp.cubemaps, (cp as any).iChannel0Sampler, (cp as any).iChannel0Type),
                    iChannel1: preloadIfPath(cp.iChannel1, "iChannel1", cp.cubemaps, (cp as any).iChannel1Sampler, (cp as any).iChannel1Type),
                    iChannel2: preloadIfPath(cp.iChannel2, "iChannel2", cp.cubemaps, (cp as any).iChannel2Sampler, (cp as any).iChannel2Type),
                    iChannel3: preloadIfPath(cp.iChannel3, "iChannel3", cp.cubemaps, (cp as any).iChannel3Sampler, (cp as any).iChannel3Type),
                },
            });
        }

        const finalMeta = shaderObject.metaData as any || {};
        const finalChannels = { iChannel0: finalMeta?.iChannel0, iChannel1: finalMeta?.iChannel1, iChannel2: finalMeta?.iChannel2, iChannel3: finalMeta?.iChannel3 };
        const finalPreloaded = {
            iChannel0: preloadIfPath(finalChannels.iChannel0, "iChannel0", finalMeta?.cubemaps, finalMeta?.iChannel0Sampler, finalMeta?.iChannel0Type),
            iChannel1: preloadIfPath(finalChannels.iChannel1, "iChannel1", finalMeta?.cubemaps, finalMeta?.iChannel1Sampler, finalMeta?.iChannel1Type),
            iChannel2: preloadIfPath(finalChannels.iChannel2, "iChannel2", finalMeta?.cubemaps, finalMeta?.iChannel2Sampler, finalMeta?.iChannel2Type),
            iChannel3: preloadIfPath(finalChannels.iChannel3, "iChannel3", finalMeta?.cubemaps, finalMeta?.iChannel3Sampler, finalMeta?.iChannel3Type),
        };

        bufferWarmupRef.current = bufferRuntimes.filter(Boolean).length + cubemapRuntimes.length;
        setThreeProps({ ...activeProps, buffers: bufferRuntimes, cubemaps: cubemapRuntimes, bufferCamera: bufCam, finalChannels, finalPreloaded });
        return { bufferRuntimes, cubemapRuntimes, bufferCamera: bufCam };
    };

    const disposePreviousTransitionResources = () => {
        if (previousMatRef.current) {
            previousMatRef.current.dispose();
            previousMatRef.current = null;
        }
        setPreviousBuffers((prev) => {
            if (prev) {
                for (const br of prev) {
                    if (br) {
                        br.targets[0].dispose();
                        br.targets[1].dispose();
                        br.material.dispose();
                    }
                }
            }
            return undefined;
        });
    };

    const resetTime = (tuniform: TUniform) => {
        tuniform.iAmplifiedTime.value = 0.1;
        tuniform.iTime.value = 0.1;
        tuniform.iFrame.value = 0;
    };

    const incrementTime = (tuniform: TUniform, increment: number) => {
        tuniform.iAmplifiedTime.value += increment;
        tuniform.iTime.value += increment;
    };

    const getCurrentDateVector = () => {
        const currentDate = new Date();
        return new Vector4(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
            currentDate.getHours() * 3600 + currentDate.getMinutes() * 60 + currentDate.getSeconds()
        );
    };

    const initializeProps = () => {
        const fbcArray = fbcArrayRef.current as any;
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
            iMouse: { value: new Vector4(window.innerWidth / 2, window.innerHeight / 2, 0, 0), type: 'v4' },
            iFrame: { type: 'i', value: 0 },
            iKeyboard: { value: new DataTexture(keyboardStateRef.current as any, KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, RGBAFormat) },
            iMidi: { value: new DataTexture(midiStateRef.current as any, MIDI_TEXTURE_WIDTH, MIDI_TEXTURE_HEIGHT, RedFormat) },
            iJoystick: { value: new DataTexture(joystickStateRef.current as any, JOYSTICK_TEXTURE_WIDTH, JOYSTICK_TEXTURE_HEIGHT, RedFormat) },
            iTransitionOpacity: { type: 'f', value: 1.0 }
        };

        if (shaderObject.metaData?.customUniforms) {
            shaderObject.metaData.customUniforms.forEach((uniform: ShaderUniform) => {
                let value: any = uniform.default;
                switch (uniform.type) {
                    case 'int': value = Math.floor(uniform.default as number); break;
                    case 'float': value = uniform.default as number; break;
                    case 'bool': value = uniform.default ? 1.0 : 0.0; break;
                    case 'vec2': value = new Vector2(...(uniform.default as number[])); break;
                    case 'vec3': value = new Vector3(...(uniform.default as number[])); break;
                    case 'vec4': value = new Vector4(...(uniform.default as number[])); break;
                }
                tuniform[uniform.name] = { value };
            });
        }

        setThreeProps({ clock, format, tuniform });
    };

    useEffect(() => {
        if (shaderObject?.metaData?.customUniforms && threeProps?.tuniform) {
            browser.storage.local.get(`customUniforms_${shaderObject.shaderName}`).then(result => {
                const savedValues = result[`customUniforms_${shaderObject.shaderName}`];
                if (savedValues) {
                    shaderObject.metaData?.customUniforms!.forEach((uniform: ShaderUniform) => {
                        if (savedValues[uniform.name] !== undefined && threeProps.tuniform[uniform.name]) {
                            let value = savedValues[uniform.name];
                            switch (uniform.type) {
                                case 'bool': value = value ? 1.0 : 0.0; break;
                                case 'vec2': value = new Vector2(...(Array.isArray(value) ? value : [value, value])); break;
                                case 'vec3': value = new Vector3(...(Array.isArray(value) ? value : [value, value, value])); break;
                                case 'vec4': value = new Vector4(...(Array.isArray(value) ? value : [value, value, value, value])); break;
                            }
                            threeProps.tuniform[uniform.name].value = value;
                        }
                    });
                }
            });

            const storageListener = (changes: any) => {
                const key = `customUniforms_${shaderObject.shaderName}`;
                if (changes[key]) {
                    const newValues = changes[key].newValue;
                    if (newValues && shaderObject.metaData?.customUniforms) {
                        shaderObject.metaData.customUniforms.forEach((uniform: ShaderUniform) => {
                            if (newValues[uniform.name] !== undefined && threeProps.tuniform[uniform.name]) {
                                let value = newValues[uniform.name];
                                switch (uniform.type) {
                                    case 'bool': value = value ? 1.0 : 0.0; break;
                                    case 'vec2': value = new Vector2(...(Array.isArray(value) ? value : [value, value])); break;
                                    case 'vec3': value = new Vector3(...(Array.isArray(value) ? value : [value, value, value])); break;
                                    case 'vec4': value = new Vector4(...(Array.isArray(value) ? value : [value, value, value, value])); break;
                                }
                                threeProps.tuniform[uniform.name].value = value;
                            }
                        });
                    }
                }
            };

            browser.storage.onChanged.addListener(storageListener);
            return () => { browser.storage.onChanged.removeListener(storageListener); };
        }
    }, [shaderObject, threeProps]);

    useEffect(() => {
        initializeProps();
        return () => {
            stopVideoFrameRef.current = true;
            const v: any = videoElement;
            if (v && v.__onTimeUpdateShaderAmp) {
                v.removeEventListener('timeupdate', v.__onTimeUpdateShaderAmp);
                delete v.__onTimeUpdateShaderAmp;
            }
            customImageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            customImageUrlsRef.current = [];
            customVideoElementsRef.current.forEach(v => { v.pause(); v.src = ''; v.load(); });
            customVideoElementsRef.current = [];
            customVideoUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            customVideoUrlsRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (!threeProps) return;
        let isMouseDown = false;
        const handleMouseMove = (event: MouseEvent) => {
            if (isMouseDown && threeProps.tuniform?.iMouse) {
                threeProps.tuniform.iMouse.value.x = event.clientX * renderScale;
                threeProps.tuniform.iMouse.value.y = (window.innerHeight - event.clientY) * renderScale;
            }
        };
        const handleMouseDown = (event: MouseEvent) => {
            if (event.button === 0 && threeProps.tuniform?.iMouse) {
                isMouseDown = true;
                threeProps.tuniform.iMouse.value.set(
                    event.clientX * renderScale,
                    (window.innerHeight - event.clientY) * renderScale,
                    event.clientX * renderScale,
                    (window.innerHeight - event.clientY) * renderScale
                );
            }
        };
        const handleMouseUp = (event: MouseEvent) => {
            if (event.button === 0 && threeProps.tuniform?.iMouse) {
                isMouseDown = false;
                threeProps.tuniform.iMouse.value.z = -Math.abs(threeProps.tuniform.iMouse.value.z);
                threeProps.tuniform.iMouse.value.w = -Math.abs(threeProps.tuniform.iMouse.value.w);
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

    useEffect(() => {
        if (!threeProps) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            const keyCode = getKeyboardKeyCode(event);
            if (keyCode !== null) keyboardStateRef.current[keyCode * KEYBOARD_BYTES_PER_PIXEL] = 255;
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            const keyCode = getKeyboardKeyCode(event);
            if (keyCode !== null) keyboardStateRef.current[keyCode * KEYBOARD_BYTES_PER_PIXEL] = 0;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [threeProps]);

    useEffect(() => {
        const loadSettings = async () => {
            const result = await browser.storage.local.get([
                SETTINGS_JOYSTICK_ENABLED, SETTINGS_JOYSTICK_MAPPINGS,
                SETTINGS_MIDI_ENABLED, SETTINGS_MIDI_MAPPINGS, SETTINGS_EQ_GAINS,
                SETTINGS_ENABLE_IAMPLIFIED_TIME, SETTINGS_WAIT_FOR_AUDIO
            ]);
            joystickEnabledRef.current = result[SETTINGS_JOYSTICK_ENABLED] ?? false;
            joystickMappingsRef.current = result[SETTINGS_JOYSTICK_MAPPINGS] ?? [];
            midiEnabledRef.current = result[SETTINGS_MIDI_ENABLED] ?? false;
            midiMappingsRef.current = result[SETTINGS_MIDI_MAPPINGS] ?? [];
            if (Array.isArray(result[SETTINGS_EQ_GAINS])) eqGainsRef.current = [...result[SETTINGS_EQ_GAINS]];
            enableIAmplifiedTimeRef.current = result[SETTINGS_ENABLE_IAMPLIFIED_TIME] ?? true;
            waitForAudioRef.current = result[SETTINGS_WAIT_FOR_AUDIO] ?? false;
        };
        loadSettings();

        const handleStorageChange = (changes: Record<string, any>) => {
            if (changes[SETTINGS_JOYSTICK_ENABLED] !== undefined) joystickEnabledRef.current = changes[SETTINGS_JOYSTICK_ENABLED].newValue ?? false;
            if (changes[SETTINGS_JOYSTICK_MAPPINGS] !== undefined) joystickMappingsRef.current = changes[SETTINGS_JOYSTICK_MAPPINGS].newValue ?? [];
            if (changes[SETTINGS_MIDI_ENABLED] !== undefined) midiEnabledRef.current = changes[SETTINGS_MIDI_ENABLED].newValue ?? false;
            if (changes[SETTINGS_MIDI_MAPPINGS] !== undefined) midiMappingsRef.current = changes[SETTINGS_MIDI_MAPPINGS].newValue ?? [];
            if (changes[SETTINGS_EQ_GAINS] !== undefined && Array.isArray(changes[SETTINGS_EQ_GAINS].newValue)) eqGainsRef.current = [...changes[SETTINGS_EQ_GAINS].newValue];
            if (changes[SETTINGS_ENABLE_IAMPLIFIED_TIME] !== undefined) enableIAmplifiedTimeRef.current = changes[SETTINGS_ENABLE_IAMPLIFIED_TIME].newValue ?? true;
            if (changes[SETTINGS_WAIT_FOR_AUDIO] !== undefined) {
                const newValue = changes[SETTINGS_WAIT_FOR_AUDIO].newValue ?? false;
                waitForAudioRef.current = newValue;
                if (newValue) audioDetectedRef.current = false;
            }
        };

        browser.storage.onChanged.addListener(handleStorageChange);
        return () => { browser.storage.onChanged.removeListener(handleStorageChange); };
    }, []);

    useEffect(() => {
        if (!analyser) return;
        const messageHandler = (msg: any) => {
            if (!msg.command || !matRef.current) return;
            const tuniform = matRef.current.uniforms as TUniform;
            if (msg.command === RESET_TIME) resetTime(tuniform);
            else if (msg.command === INCR_TIME) incrementTime(tuniform, 0.5);
            else if (msg.command === DECR_TIME) incrementTime(tuniform, -0.5);
        };
        browser.runtime.onMessage.addListener(messageHandler);
        return () => { browser.runtime.onMessage.removeListener(messageHandler); };
    }, [analyser]);

    useEffect(() => {
        const currentProps = threePropsRef.current;
        if (!currentProps) return;
        if (loadedShaderIdentity === shaderLoadIdentity && loadedRenderScale === renderScale) return;
        if (isPreparingShaderRef.current) return;

        isPreparingShaderRef.current = true;

        (async () => {
            try {
                const shouldTransition = Boolean(shaderFade && loadedShaderName);
                const outgoingBuffers = currentProps.buffers;

                console.log(
                    `[ShaderTransitionPass] Precompiling next shader: "${shaderObject.shaderName}" (from "${loadedShaderName || 'none'}")...`
                );

                await loadFragmentShader();

                if (shouldTransition && meshRef.current && previousMatRef.current) {
                    meshRef.current.material = previousMatRef.current;
                }

                const { bufferRuntimes, cubemapRuntimes, bufferCamera } = await setupMultipassBuffers();

                const extraPasses: { scene: Scene; camera: Camera }[] = [];
                if (bufferCamera) {
                    for (const br of bufferRuntimes) {
                        if (br) extraPasses.push({ scene: br.scene, camera: bufferCamera });
                    }
                    for (const cr of cubemapRuntimes) {
                        if (cr) extraPasses.push({ scene: cr.scene, camera: bufferCamera });
                    }
                }
                const compileMs = await ShaderTransitionPass.precompileShaders(
                    gl,
                    camera,
                    [previousMatRef.current, matRef.current],
                    extraPasses
                );

                console.log(
                    `[ShaderTransitionPass] Compiled & warmed "${shaderObject.shaderName}" (${1 + extraPasses.length} pass${extraPasses.length === 0 ? '' : 'es'}) in ${compileMs.toFixed(1)} ms`
                );

                if (shouldTransition && previousMatRef.current) {
                    let chosen: TransitionEffect = TransitionEffect.CustomShader;
                    if (transitionPassRef.current) {
                        transitionPassRef.current.resetTransitionCapture();
                        if (!customTransitionShader) {
                            if (transitionEffect !== undefined) {
                                transitionPassRef.current.setTransitionType(transitionEffect);
                                chosen = transitionEffect;
                            } else {
                                chosen = transitionPassRef.current.pickRandomTransition();
                            }
                        }
                        const cfg = TRANSITION_EFFECT_CONFIGS[chosen];
                        console.log(
                            `[ShaderTransitionPass] Transition started (precompiled): ${cfg.name} (${chosen}) | freezeOutgoing=${cfg.freezeOutgoing}`
                        );
                    }
                    setPreviousBuffers(outgoingBuffers);
                    setFadeProgress(0.0);
                    setIsTransitioning(true);
                } else if (meshRef.current && matRef.current) {
                    meshRef.current.material = matRef.current;
                }

                setLoadedShaderName(shaderObject.shaderName);
                setLoadedShaderIdentity(shaderLoadIdentity);
                setLoadedRenderScale(renderScale);
            } finally {
                isPreparingShaderRef.current = false;
            }
        })();
    }, [Boolean(threeProps), shaderLoadIdentity, renderScale]);

    useEffect(() => {
        if (!threeProps) return;
        threeProps.tuniform.iResolution.value.set(viewport.width * renderScale, viewport.height * renderScale, 1.0);
    }, [threeProps, viewport.width, viewport.height, renderScale]);

    useFrame((_state, delta) => {
        if (!analyser || !canvas || !threeProps) return;

        let currentProgress = fadeProgress;
        if (shaderFade && isTransitioning) {
            const safeDelta = Math.min(delta, 1 / 30);
            const speed = 1.0 / Math.max(0.1, transitionDuration);
            currentProgress = Math.min(fadeProgress + safeDelta * speed, 1.0);
            setFadeProgress(currentProgress);

            if (currentProgress >= 1.0) {
                setIsTransitioning(false);
                if (meshRef.current && matRef.current) {
                    meshRef.current.material = matRef.current;
                }
                disposePreviousTransitionResources();
            }
        } else if (!isPreparingShaderRef.current) {
            if (threeProps.tuniform?.iTransitionOpacity) {
                threeProps.tuniform.iTransitionOpacity.value = 1.0;
            }
            if (meshRef.current && matRef.current && meshRef.current.material !== matRef.current) {
                meshRef.current.material = matRef.current;
            }
        }

        if (randomizeBeat && fbcArrayRef.current) {
            const bassEnd = Math.floor(frequencyBinCount * 0.1);
            let bassSum = 0;
            for (let i = 0; i < bassEnd; i++) bassSum += fbcArrayRef.current[i];
            if (bassSum / bassEnd > 200) {
                beatCounterRef.current++;
                if (beatCounterRef.current >= randomizeBeatInterval) {
                    onShaderChangeRequested?.();
                    beatCounterRef.current = 0;
                }
            }
        }

        const fbcArray = fbcArrayRef.current as any;
        analyser.getByteFrequencyData(fbcArray);

        const ctx = canvas.getContext('2d');
        if (ctx && draw_analyzer) {
            const bar_count = window.innerWidth / 2;
            ctx.fillStyle = fill_color;
            for (let i = 0; i < bar_count; i++) {
                ctx.fillRect(i * 4, canvas.height, 2, -(fbcArray[i] / 2));
            }
        }

        const sum = fbcArray.reduce((a: number, b: number) => a + b, 0);
        if (waitForAudioRef.current && !audioDetectedRef.current && sum >= AUDIO_DETECT_THRESHOLD) {
            audioDetectedRef.current = true;
        }
        const timeGated = waitForAudioRef.current && !audioDetectedRef.current;

        const gatedVideoElements: HTMLVideoElement[] = [
            videoElement as HTMLVideoElement,
            ...customVideoElementsRef.current,
        ].filter((v): v is HTMLVideoElement => !!v);
        if (timeGated) {
            for (const v of gatedVideoElements) {
                if (!v.paused) v.pause();
                if (v.currentTime > 0) v.currentTime = 0;
            }
        } else if (wasTimeGatedRef.current) {
            for (const v of gatedVideoElements) {
                v.currentTime = 0;
                v.play().catch(() => {});
            }
        }
        wasTimeGatedRef.current = timeGated;

        const avg = (sum / fbcArray.length) || 0.1;
        let rate = min_speed + avg / (speedDivider == 0 ? 0.1 : speedDivider);
        rate = Math.min(Math.max(rate, 0.25), 3.0);

        const clockDelta = threeProps.clock.getDelta();
        const shaderFactor = shaderObject.metaData?.shaderSpeed ?? default_shader_factor;
        const tuniform = threeProps.tuniform;

        if (timeGated) {
            tuniform.iAmplifiedTime.value = 0.0;
            tuniform.iTime.value = 0.0;
            tuniform.iTimeDelta.value = 0.0;
        } else {
            if (enableIAmplifiedTimeRef.current) {
                tuniform.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
            } else {
                tuniform.iAmplifiedTime.value = tuniform.iTime.value;
            }
            tuniform.iTime.value += clockDelta;
            tuniform.iTimeDelta.value = clockDelta;
        }
        tuniform.iFrameRate.value = clockDelta > 0 ? 1.0 / clockDelta : 60.0;
        tuniform.iDate.value = getCurrentDateVector();

        const currentTime = tuniform.iTime.value;
        for (let ch = 0; ch < 4; ch++) {
            const loadTime = channelLoadTimeRef.current[ch];
            tuniform.iChannelTime.value[ch] = loadTime > 0 ? currentTime - loadTime : 0.0;
        }

        currentTimeRef.current = tuniform.iTime.value;
        for (let i = 0; i < KEYBOARD_TEXTURE_WIDTH; i++) {
            const offset = i * KEYBOARD_BYTES_PER_PIXEL;
            const currentState = keyboardStateRef.current[offset + 0];
            const previousState = keyboardPrevStateRef.current[i];
            keyboardStateRef.current[offset + 1] = 0;
            keyboardStateRef.current[offset + 2] = 0;
            if (currentState > 0 && previousState === 0) {
                keyboardStateRef.current[offset + 1] = 255;
                keyboardPressTimeRef.current[i] = currentTimeRef.current;
                keyboardToggleRef.current[i] = keyboardToggleRef.current[i] > 0 ? 0 : 255;
            }
            if (currentState === 0 && previousState > 0) {
                keyboardStateRef.current[offset + 2] = 255;
            }
            keyboardStateRef.current[offset + 3] = keyboardToggleRef.current[i];
            const row1Offset = (KEYBOARD_TEXTURE_WIDTH + i) * KEYBOARD_BYTES_PER_PIXEL;
            keyboardStateRef.current[row1Offset + 0] = currentState > 0
                ? Math.min((currentTimeRef.current - keyboardPressTimeRef.current[i]) * 255, 255)
                : 0;
            keyboardPrevStateRef.current[i] = currentState;
        }
        tuniform.iKeyboard.value.needsUpdate = true;

        if (midiEnabledRef.current) {
            const injBins = midiFftInjectionRef.current;
            for (let i = 0; i < Math.min(injBins.length, fbcArray.length); i++) {
                if (injBins[i] > 0) {
                    fbcArray[i] = Math.min(255, fbcArray[i] + injBins[i]);
                    injBins[i] = injBins[i] * MIDI_FFT_DECAY;
                    if (injBins[i] < 1) injBins[i] = 0;
                }
            }
            for (let i = 0; i < MIDI_TEXTURE_WIDTH; i++) {
                midiStateRef.current[MIDI_TEXTURE_WIDTH + i] = 0;
                midiStateRef.current[MIDI_TEXTURE_WIDTH * 2 + i] = 0;
            }
            if (tuniform.iMidi) tuniform.iMidi.value.needsUpdate = true;
        }

        for (let i = 0; i < JOYSTICK_TEXTURE_WIDTH; i++) {
            joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 2 + i] = 0;
            joystickStateRef.current[JOYSTICK_TEXTURE_WIDTH * 3 + i] = 0;
        }
        if (tuniform.iJoystick) tuniform.iJoystick.value.needsUpdate = true;
        tuniform.iAudioData.value.needsUpdate = true;

        const isOutgoingFrozen = Boolean(transitionPassRef.current?.shouldFreezeOutgoing);
        const alreadyCaptured = Boolean(transitionPassRef.current?.hasCapturedOutgoingFrame);
        const needOutgoingRender = Boolean(
            shaderFade &&
            previousMatRef.current &&
            (isPreparingShaderRef.current || (isTransitioning && (!isOutgoingFrozen || !alreadyCaptured)))
        );

        if (needOutgoingRender && previousMatRef.current && matRef.current) {
            const currentUniforms = matRef.current.uniforms;
            const previousUniforms = previousMatRef.current.uniforms;

            if (timeGated) {
                if (previousUniforms.iAmplifiedTime) previousUniforms.iAmplifiedTime.value = 0.0;
                if (previousUniforms.iTime) previousUniforms.iTime.value = 0.0;
                if (previousUniforms.iTimeDelta) previousUniforms.iTimeDelta.value = 0.0;
            } else {
                if (enableIAmplifiedTimeRef.current && previousUniforms.iAmplifiedTime) {
                    previousUniforms.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
                } else if (previousUniforms.iAmplifiedTime && currentUniforms.iTime) {
                    previousUniforms.iAmplifiedTime.value = currentUniforms.iTime.value;
                }
                if (previousUniforms.iTime) previousUniforms.iTime.value += clockDelta;
                if (previousUniforms.iTimeDelta) previousUniforms.iTimeDelta.value = clockDelta;
            }
            if (previousUniforms.iDate) previousUniforms.iDate.value = getCurrentDateVector();
            if (previousUniforms.iFrame && currentUniforms.iFrame) previousUniforms.iFrame.value = currentUniforms.iFrame.value;
            if (previousUniforms.iAudioData && currentUniforms.iAudioData) previousUniforms.iAudioData.value = currentUniforms.iAudioData.value;
            if (previousUniforms.iVideo && currentUniforms.iVideo) previousUniforms.iVideo.value = currentUniforms.iVideo.value;
            if (previousUniforms.iKeyboard && currentUniforms.iKeyboard) previousUniforms.iKeyboard.value = currentUniforms.iKeyboard.value;
            if (previousUniforms.iMouse && currentUniforms.iMouse) previousUniforms.iMouse.value = currentUniforms.iMouse.value;
            if (previousUniforms.iResolution && currentUniforms.iResolution) previousUniforms.iResolution.value = currentUniforms.iResolution.value;
        }

        const video = videoElement as HTMLVideoElement;
        ShaderTransitionPass.syncVideoTexture(
            threeProps.tuniform.iVideo.value as VideoTexture,
            video
        );

        if (video && !timeGated) {
            const smoothed = video.playbackRate * 0.85 + rate * 0.15;
            if (Math.abs(video.playbackRate - smoothed) > 0.01) video.playbackRate = smoothed;
            if (video.paused) video.play().catch(() => {});
        }

        const passBuffers = threeProps.buffers || [];
        const passCubemaps = threeProps.cubemaps || [];

        if (needOutgoingRender && isTransitioning && previousBuffers && previousMatRef.current && threeProps.bufferCamera) {
            const prevTarget = gl.getRenderTarget();
            const prevReadTextures: (any | undefined)[] = previousBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
            for (let i = 0; i < previousBuffers.length; i++) {
                const br = previousBuffers[i];
                if (!br) continue;
                const u = br.material.uniforms as TUniform;
                const meta = br.channelMeta;
                const samplers = br.channelSamplers || {};
                const pre = br.preloaded;
                const setPrevCh = (slot: 'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3', src?: string, preVal?: any, sampler?: SamplerConfig) => {
                    if (src === 'audio') { (u[slot] as any).value = tuniform.iAudioData.value; return; }
                    if (src === 'video') { (u[slot] as any).value = tuniform.iVideo.value; return; }
                    if (src === 'keyboard') { (u[slot] as any).value = tuniform.iKeyboard.value; return; }
                    if (src === 'midi') { (u[slot] as any).value = tuniform.iMidi.value; return; }
                    const m = src && src.match(/^buffer(\d+)$/);
                    const val = m ? prevReadTextures[parseInt(m[1], 10)] : preVal;
                    if (val) {
                        (u[slot] as any).value = val;
                        if (!(val as any).isCubeTexture) {
                            const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                            (u[slot] as any).value.wrapS = (u[slot] as any).value.wrapT = wrap;
                        }
                    }
                };
                setPrevCh('iChannel0', meta.iChannel0, pre?.iChannel0, samplers.iChannel0);
                setPrevCh('iChannel1', meta.iChannel1, pre?.iChannel1, samplers.iChannel1);
                setPrevCh('iChannel2', meta.iChannel2, pre?.iChannel2, samplers.iChannel2);
                setPrevCh('iChannel3', meta.iChannel3, pre?.iChannel3, samplers.iChannel3);
                const writeTarget = br.targets[br.writeIndex];
                gl.setRenderTarget(writeTarget);
                gl.clear(true, true, false);
                gl.render(br.scene, threeProps.bufferCamera!);
                const tmp = br.readIndex; br.readIndex = br.writeIndex; br.writeIndex = tmp;
            }
            gl.setRenderTarget(prevTarget);
        }

        if ((passBuffers.length > 0 || passCubemaps.length > 0) && threeProps.bufferCamera) {
            const warmupIterations = bufferWarmupRef.current;
            if (warmupIterations > 0) bufferWarmupRef.current = 0;

            const fallbackWrap = (shaderObject.metaData as any)?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
            const prevTarget = gl.getRenderTarget();

            const updateChannelResolution = (u: TUniform, slot: string, val: any) => {
                const chIdx = parseInt(slot.charAt(8), 10);
                const arr = (u.iChannelResolution as any)?.value;
                if (!arr || !arr[chIdx]) return;
                let img = (val as any).image;
                if (Array.isArray(img)) img = img[0];
                if (img && img.width) arr[chIdx].set(img.width, img.height, 1);
            };

            const snapshotCubeReads = (): Record<string, any> => {
                const cm: Record<string, any> = {};
                for (const cr of passCubemaps) cm[cr.letter] = cr.targets[cr.readIndex].texture;
                return cm;
            };

            const renderCubemapPasses = (bufReads: (any | undefined)[], cubeReads: Record<string, any>) => {
                for (const cr of passCubemaps) {
                    const cu = cr.material.uniforms as TUniform;
                    const cmeta = cr.channelMeta;
                    const cpre = cr.preloaded;
                    const setCubeCh = (slot: 'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3', src?: string, preVal?: any) => {
                        if (src === 'audio') { (cu[slot] as any).value = tuniform.iAudioData.value; return; }
                        if (src === 'video') { (cu[slot] as any).value = tuniform.iVideo.value; return; }
                        if (src === 'keyboard') { (cu[slot] as any).value = tuniform.iKeyboard.value; return; }
                        if (src === 'midi') { (cu[slot] as any).value = tuniform.iMidi.value; return; }
                        const mb = src && src.match(/^buffer(\d+)$/);
                        const mc = src && src.match(/^cubemap([A-Z])$/);
                        const val = mb ? bufReads[parseInt(mb[1], 10)] : mc ? cubeReads[mc[1]] : preVal;
                        if (val) {
                            (cu[slot] as any).value = val;
                            updateChannelResolution(cu, slot, val);
                        }
                    };
                    setCubeCh('iChannel0', cmeta.iChannel0, cpre?.iChannel0);
                    setCubeCh('iChannel1', cmeta.iChannel1, cpre?.iChannel1);
                    setCubeCh('iChannel2', cmeta.iChannel2, cpre?.iChannel2);
                    setCubeCh('iChannel3', cmeta.iChannel3, cpre?.iChannel3);

                    const cubeWriteTarget = cr.targets[cr.writeIndex];
                    for (let face = 0; face < 6; face++) {
                        ((cu as any).iCubeFace as any).value = face;
                        gl.setRenderTarget(cubeWriteTarget, face);
                        gl.clear(true, true, false);
                        gl.render(cr.scene, threeProps.bufferCamera!);
                    }
                    const ct = cr.readIndex; cr.readIndex = cr.writeIndex; cr.writeIndex = ct;
                }
            };

            for (let w = 0; w < warmupIterations; w++) {
                const warmupReadTextures = passBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
                renderCubemapPasses(warmupReadTextures, snapshotCubeReads());
                const warmupCubeReads = snapshotCubeReads();
                for (let i = 0; i < passBuffers.length; i++) {
                    const br = passBuffers[i];
                    if (!br) continue;
                    const u = br.material.uniforms as TUniform;
                    const meta = br.channelMeta;
                    const samplers = br.channelSamplers || {};
                    const pre = br.preloaded;
                    const setChW = (slot: 'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3', src?: string, preVal?: any, sampler?: SamplerConfig) => {
                        if (src === 'audio') { (u[slot] as any).value = tuniform.iAudioData.value; return; }
                        if (src === 'video') { (u[slot] as any).value = tuniform.iVideo.value; return; }
                        if (src === 'keyboard') { (u[slot] as any).value = tuniform.iKeyboard.value; return; }
                        if (src === 'midi') { (u[slot] as any).value = tuniform.iMidi.value; return; }
                        const m2 = src && src.match(/^buffer(\d+)$/);
                        const mc2 = src && src.match(/^cubemap([A-Z])$/);
                        const val = m2 ? warmupReadTextures[parseInt(m2[1], 10)] : mc2 ? warmupCubeReads[mc2[1]] : preVal;
                        if (val) {
                            (u[slot] as any).value = val;
                            updateChannelResolution(u, slot, val);
                            if (!(val as any).isCubeTexture) {
                                const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                                (u[slot] as any).value.wrapS = (u[slot] as any).value.wrapT = wrap;
                            }
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

            renderCubemapPasses(passBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined), snapshotCubeReads());
            const cubeReadTextures = snapshotCubeReads();
            const readTextures = passBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);

            for (let i = 0; i < passBuffers.length; i++) {
                const br = passBuffers[i];
                if (!br) continue;
                const u = br.material.uniforms as TUniform;
                const meta = br.channelMeta;
                const samplers = br.channelSamplers || {};
                const pre = br.preloaded;
                const setCh = (slot: 'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3', src?: string, preVal?: any, sampler?: SamplerConfig) => {
                    if (src === 'audio') { (u[slot] as any).value = tuniform.iAudioData.value; return; }
                    if (src === 'video') { (u[slot] as any).value = tuniform.iVideo.value; return; }
                    if (src === 'keyboard') { (u[slot] as any).value = tuniform.iKeyboard.value; return; }
                    if (src === 'midi') { (u[slot] as any).value = tuniform.iMidi.value; return; }
                    const m = src && src.match(/^buffer(\d+)$/);
                    const mc = src && src.match(/^cubemap([A-Z])$/);
                    const val = m ? readTextures[parseInt(m[1], 10)] : mc ? cubeReadTextures[mc[1]] : preVal;
                    if (val) {
                        (u[slot] as any).value = val;
                        updateChannelResolution(u, slot, val);
                        if (!(val as any).isCubeTexture) {
                            const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                            (u[slot] as any).value.wrapS = (u[slot] as any).value.wrapT = wrap;
                        }
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

                const tmp = br.readIndex; br.readIndex = br.writeIndex; br.writeIndex = tmp;
            }

            if (threeProps.finalChannels) {
                const finalU = matRef.current!.uniforms as TUniform;
                const fc = threeProps.finalChannels;
                const fp = threeProps.finalPreloaded || {};
                const finalMeta = shaderObject.metaData as any || {};
                const setFinal = (slot: 'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3', src?: string, preVal?: any) => {
                    if (src === 'audio') { (finalU[slot] as any).value = tuniform.iAudioData.value; return; }
                    if (src === 'video') { (finalU[slot] as any).value = tuniform.iVideo.value; return; }
                    if (src === 'keyboard') { (finalU[slot] as any).value = tuniform.iKeyboard.value; return; }
                    if (src === 'midi') { (finalU[slot] as any).value = tuniform.iMidi.value; return; }
                    const m = src && src.match(/^buffer(\d+)$/);
                    const mc = src && src.match(/^cubemap([A-Z])$/);
                    const val = m ? readTextures[parseInt(m[1], 10)] : mc ? cubeReadTextures[mc[1]] : preVal;
                    if (val) {
                        (finalU[slot] as any).value = val;
                        updateChannelResolution(finalU, slot, val);
                        if (!(val as any).isCubeTexture) {
                            const sampler: SamplerConfig | undefined = finalMeta[`${slot}Sampler`];
                            const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                            (finalU[slot] as any).value.wrapS = (finalU[slot] as any).value.wrapT = wrap;
                        }
                    }
                };
                setFinal('iChannel0', fc.iChannel0, (fp as any).iChannel0);
                setFinal('iChannel1', fc.iChannel1, (fp as any).iChannel1);
                setFinal('iChannel2', fc.iChannel2, (fp as any).iChannel2);
                setFinal('iChannel3', fc.iChannel3, (fp as any).iChannel3);
            }

            gl.setRenderTarget(prevTarget);
        }

        if (needOutgoingRender && isTransitioning && previousBuffers && previousMatRef.current) {
            const prevU = previousMatRef.current.uniforms as TUniform;
            const prevReadTextures = previousBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
            if (prevReadTextures[0]) (prevU.iChannel0 as any).value = prevReadTextures[0];
            if (prevReadTextures[1]) (prevU.iChannel1 as any).value = prevReadTextures[1];
            if (prevReadTextures[2]) (prevU.iChannel2 as any).value = prevReadTextures[2];
            if (prevReadTextures[3]) (prevU.iChannel3 as any).value = prevReadTextures[3];
        }

        if (!timeGated) {
            threeProps.tuniform.iFrame.value += 1;
        }

        if (shaderFade && isTransitioning && matRef.current && transitionPassRef.current && (previousMatRef.current || alreadyCaptured)) {
            transitionPassRef.current.updateOffscreenTargets(
                gl,
                camera,
                viewport.width,
                viewport.height,
                previousMatRef.current,
                matRef.current,
                currentProgress,
                tuniform.iTime.value,
                tuniform.iAudioData.value
            );
            if (isOutgoingFrozen && previousMatRef.current) {
                disposePreviousTransitionResources();
            }
            if (meshRef.current) {
                meshRef.current.material = transitionPassRef.current.activeMaterial;
            }
        }
    });

    return (
        <mesh ref={meshRef} frustumCulled={false}>
            <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
            <shaderMaterial
                attach="material"
                uniforms={threeProps?.tuniform}
                vertexShader={general_purpose_vertex_shader}
                side={DoubleSide}
                ref={matRef}
            />
        </mesh>
    );
};