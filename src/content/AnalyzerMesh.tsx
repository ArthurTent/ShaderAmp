import React, { useEffect, useState, useRef, useMemo } from 'react';
import browser from "webextension-polyfill";
import { useFrame, useThree } from '@react-three/fiber';
import type { ShaderObject, ShaderUniform, OverlayState } from "@src/helpers/types";
import {
    Clock,
    Cache,
    DataTexture, Data3DTexture, DoubleSide, IUniform,
    LuminanceFormat, PixelFormat,
    RGBAFormat, RedFormat, RepeatWrapping,
    Texture,
    TextureLoader,
    BufferGeometry,
    CubeTexture,
    CubeTextureLoader,
    Vector2,
    Vector3,
    Vector4,
    VideoTexture,
    ShaderMaterial,
    WebGLRenderTarget,
    WebGLCubeRenderTarget,
    WebGL3DRenderTarget,
    Scene,
    OrthographicCamera,
    PlaneGeometry,
    Mesh,
    LinearFilter,
    NearestFilter,
    LinearMipmapLinearFilter,
    FloatType,
    HalfFloatType,
    UnsignedByteType,
    ClampToEdgeWrapping,
    AdditiveBlending,
    NormalBlending } from "three";
import { fetchFragmentShader, getShaderLoadIdentity } from '@src/helpers/shaderActions';
import { getEditedShader, getEditedImportedShader } from '@src/helpers/shaderStorage';
import { getImageBlobDB, getVideoBlobDB, getCubemapFacesDB, getVolumeDB } from '@src/storage/shaderDB';
import { channelRefToImageId, isCustomImageRef } from '@src/helpers/customImageStorage';
import { channelRefToVideoId, isCustomVideoRef, isBundledVideoRef } from '@src/helpers/customVideoStorage';
import { channelRefToCubemapId, isCustomCubemapRef } from '@src/helpers/customCubemapStorage';
import { channelRefToVolumeId, isCustomVolumeRef } from '@src/helpers/customVolumeStorage';
import { getGreyNoise3DTexture, getRGBANoise3DTexture, isVolumeTextureHash } from '@src/helpers/volumeNoiseGenerator';
import css from "./styles.module.css";
import { DECR_TIME, INCR_TIME, RESET_TIME, SET_TIME, MEDIA_CONTROL, PREV_SHADER, NEXT_SHADER } from '@src/helpers/constants';
import { interpolatePosition, isSampleUsable, stepSyncedClock, type TrackPositionSample } from '@src/helpers/trackSync';
import { wrapTime, wrappedDiff } from '@src/helpers/videoSync';
import { SETTINGS_MIDI_ENABLED, SETTINGS_MIDI_MAPPINGS, SETTINGS_ENABLE_IAMPLIFIED_TIME, SETTINGS_WAIT_FOR_AUDIO, SETTINGS_JOYSTICK_ENABLED, SETTINGS_JOYSTICK_MAPPINGS, SETTINGS_EQ_GAINS, SETTINGS_SOUND_BUFFER, STATE_SCENE_CLOCK_PAUSED, SETTINGS_TRACK_SYNC, SETTINGS_VIDEO_FOLLOW_TIME } from '@src/storage/storageConstants';
import { SoundShaderEngine } from './soundShaderEngine';
import { hasMainVR, injectRuntimeWrappers, VR_VERTEX_SHADER, CINEMA_ASPECT, cinemaRenderSize } from '@src/helpers/vrShader';
import { isSceneTarget, dispatchSceneTarget } from '@src/helpers/sceneMappingActions';
import { isOverlayTarget, dispatchOverlayTarget, createOverlayOpacityThrottle } from '@src/helpers/overlayMappingActions';
import { loadOverlayChannels, OverlayChannelResources } from './overlayChannels';
import type { MidiMappings, MidiMapping, JoystickMappings } from '@src/helpers/types';
import { logger } from '@src/helpers/logger';

Cache.enabled = true;
const maxRate = 15;
const minRate = 0;
const DEFAULT_FFT_SIZE = 1024; // Default FFT size if not specified in shader metadata
const fill_color = "#4087A0" // fill color for the 2d analyzer
const min_speed = 0.3;
const default_shader_factor = 1.0;
// Wait-for-audio gate: the shader clock only starts once the mean FFT byte
// value (0-255) has stayed at or above AUDIO_GATE_MIN_AVG for
// AUDIO_GATE_MIN_FRAMES consecutive frames — a single frame of capture noise
// before the song starts must not unlock shader time.
const AUDIO_GATE_MIN_AVG = 2.0;
const AUDIO_GATE_MIN_FRAMES = 3;

// Keyboard state tracking (ShaderToy compatible)
// 256x2 RGBA texture:
// row 0: pixel = vec4(down, pressed, released, toggle) per key (Shadertoy compatible)
// row 1: pixel = vec4(holdTime, 0, 0, 0) per key (ShaderAmp extension)
const KEYBOARD_TEXTURE_WIDTH = 256;
const KEYBOARD_TEXTURE_HEIGHT = 2;
const KEYBOARD_BYTES_PER_PIXEL = 4; // RGBA

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

// Map a KeyboardEvent to a Shadertoy-compatible key code (0-255).
// keyCode is deprecated but still the source of truth for Shadertoy; fall back
// to event.key for printable characters and event.code for common special keys.
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
varying vec3 vRayOri;
varying vec3 vRayDir;
void main()
{
    vUv = uv;
    vRayOri = cameraPosition;
    vRayDir = vec3(0.0, 0.0, -1.0);

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
    soundBufferEnabled?: boolean;
    onShaderChangeRequested?: () => void;
    sceneBeatEnabled?: boolean;
    onSceneBeat?: () => void;
    sceneAudioEnabled?: boolean;
    onSceneAudioLevel?: (level: number) => void;
    trackSampleRef?: { current: (TrackPositionSample & { receivedAt?: number }) | null };
    vrActive?: boolean;
    overlay?: OverlayState | null;
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

// Shadertoy cubemap render pass (e.g., "Cube A"): renders 6 faces of a cubemap
// per frame via mainCubemap(). Double-buffered because passes commonly sample
// their own previous frame (used as "3D texture" storage by many shaders).
type CubemapPassMeta = {
    shaderName: string;
    letter: string; // 'A'..'D'
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    cubemaps?: string[];
};

// Shadertoy cubemap passes render at a fixed 1024x1024 per face
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

// Shadertoy volume render pass (e.g., "Volume A"): bakes a 3D texture via
// mainVolume(), rendered slice-by-slice into a WebGL3DRenderTarget.
type VolumePassMeta = {
    shaderName: string;
    letter: string; // 'A'..'D'
    resolution?: number; // volume edge length in voxels (Shadertoy: 128)
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    cubemaps?: string[];
};

type VolumeRuntime = {
    material: ShaderMaterial;
    scene: Scene;
    // Ping-pong pair: a volume pass that samples its own previous frame
    // (feedback/history volumes) must not read the target it writes to
    // (WebGL framebuffer feedback loop → draw calls dropped). Passes that
    // never read themselves share one target in both slots.
    targets: [WebGL3DRenderTarget, WebGL3DRenderTarget];
    readIndex: number;
    writeIndex: number;
    letter: string;
    resolution: number;
    // Static bakes (no time/audio/frame refs in the source) render once
    isStatic: boolean;
    baked: boolean;
    channelMeta: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    channelSamplers: { iChannel0?: SamplerConfig; iChannel1?: SamplerConfig; iChannel2?: SamplerConfig; iChannel3?: SamplerConfig };
    preloaded: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

// Dispose multipass buffer/cubemap runtimes: both ping-pong render targets and
// the pass material each, plus the shared full-screen quad geometry once
// (the same PlaneGeometry instance is shared across all passes of one build).
function disposeBufferRuntimes(buffers?: BufferRuntime[], cubemaps?: CubemapRuntime[], volumes?: VolumeRuntime[]) {
    const geometries = new Set<BufferGeometry>();
    for (const br of buffers || []) {
        if (!br) continue;
        br.targets?.[0]?.dispose();
        br.targets?.[1]?.dispose();
        br.material?.dispose();
        const geom = (br.scene?.children?.[0] as Mesh | undefined)?.geometry;
        if (geom) geometries.add(geom);
    }
    for (const cm of cubemaps || []) {
        if (!cm) continue;
        cm.targets?.[0]?.dispose();
        cm.targets?.[1]?.dispose();
        cm.material?.dispose();
        const geom = (cm.scene?.children?.[0] as Mesh | undefined)?.geometry;
        if (geom) geometries.add(geom);
    }
    for (const vr of volumes || []) {
        if (!vr) continue;
        vr.targets?.[0]?.dispose();
        if (vr.targets?.[1] !== vr.targets?.[0]) vr.targets?.[1]?.dispose();
        vr.material?.dispose();
        const geom = (vr.scene?.children?.[0] as Mesh | undefined)?.geometry;
        if (geom) geometries.add(geom);
    }
    geometries.forEach(g => g.dispose());
}

// Live overlay runtime: compiled single-pass overlay shader + its channel resources.
type OverlayRuntime = { key: string; material: ShaderMaterial; channels: OverlayChannelResources; channelLoadTimes: number[] };

type MaterialProps = {
    clock: Clock;
    format: PixelFormat;
    tuniform: TUniform;
    // multipass
    bufferCamera?: OrthographicCamera;
    buffers?: BufferRuntime[];
    cubemaps?: CubemapRuntime[];
    volumes?: VolumeRuntime[];
    finalChannels?: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    finalPreloaded?: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

export const AnalyzerMesh = ({ analyser, canvas, videoElement, shaderObject, speedDivider, randomizeBeat = false, randomizeBeatInterval = 4, shaderFade = false, renderScale = 1.0, soundBufferEnabled = true, onShaderChangeRequested, sceneBeatEnabled = false, onSceneBeat, sceneAudioEnabled = false, onSceneAudioLevel, trackSampleRef, vrActive = false, overlay = null } : AnalyzerMeshProps) => {
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
    // Whether the currently loaded shader defines Shadertoy's mainVR() entrypoint
    const [shaderIsVR, setShaderIsVR] = useState<boolean>(false);
    // Same value as a ref: shaderIsVR state is stale inside the load that just
    // computed it (React hasn't re-rendered yet).
    const shaderIsVRCalcRef = useRef<boolean>(false);
    const [loadedShaderIdentity, setLoadedShaderIdentity] = useState<string>("");
    const shaderLoadIdentity = useMemo(() => getShaderLoadIdentity(shaderObject), [shaderObject]);
    const [loadedRenderScale, setLoadedRenderScale] = useState<number>(renderScale);
    // Mirrors loadedRenderScale for VR enter/exit so multipass buffers are
    // reallocated at eye resolution.
    const [loadedVrActive, setLoadedVrActive] = useState<boolean>(vrActive);
    const [previousShaderName, setPreviousShaderName] = useState<string>("");
    const [fadeProgress, setFadeProgress] = useState<number>(1.0);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
    const [previousBuffers, setPreviousBuffers] = useState<BufferRuntime[] | undefined>();
    const { gl, viewport, size, camera } = useThree();
    const stopVideoFrameRef = useRef<boolean>(false);
    const soundEngineRef = useRef<SoundShaderEngine | null>(null);
    const [overlayRuntime, setOverlayRuntime] = useState<OverlayRuntime | null>(null);
    const overlayRuntimeRef = useRef<OverlayRuntime | null>(null);

    // Beat detection variables
    const beatCounterRef = useRef<number>(0);
    const sceneBeatCounterRef = useRef<number>(0);
    const previousEnergyRef = useRef<number>(0);
    const timeDomainArrayRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(2048));
    const lastSceneAudioSendRef = useRef<number>(0);
    const lastSceneTickSendRef = useRef<number>(0);
    const sceneTickNonFiniteWarnedRef = useRef<boolean>(false);
    const trackSyncEnabledRef = useRef<boolean>(false);
    const lastCoarseSampleRef = useRef<any>(null);
    const coarseStalledRef = useRef<boolean>(false);
    const videoFollowTimeRef = useRef<boolean>(false);
    const lastVideoSyncRef = useRef<number>(0);
    const beatThresholdRef = useRef<number>(1.3); // Energy threshold for beat detection

    // Keyboard state tracking refs (ShaderToy compatible)
    // Interleaved RGBA: pixel(keyCode, 0) = vec4(down, pressed, released, toggle)
    const keyboardStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * KEYBOARD_TEXTURE_HEIGHT * KEYBOARD_BYTES_PER_PIXEL)));
    const keyboardPrevStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH)));
    const keyboardPressTimeRef = useRef<Float32Array>(new Float32Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * 4)));
    const keyboardToggleRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH)));
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
    const waitForAudioRef = useRef<boolean>(false);
    const audioDetectedRef = useRef<boolean>(false);
    const audioGateFramesRef = useRef<number>(0);
    const sceneGateOpenedPendingRef = useRef<boolean>(false);
    const wasTimeGatedRef = useRef<boolean>(false);
    // Editor transport pause: freezes the shader clock (iTime/iAmplifiedTime/iFrame)
    const clockPausedRef = useRef<boolean>(false);
    const wasClockPausedRef = useRef<boolean>(false);
    // Shadertoy iMouse.w semantics: positive only on the frame of the click
    const mouseClickFrameRef = useRef<boolean>(false);

    // Channel time tracking for iChannelTime uniform (records when each channel was first loaded)
    const channelLoadTimeRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);

    // Track object URLs created for custom image blobs so we can revoke them on cleanup
    const customImageUrlsRef = useRef<string[]>([]);

    // Track custom video elements and their object URLs for cleanup
    const customVideoElementsRef = useRef<HTMLVideoElement[]>([]);
    const customVideoUrlsRef = useRef<string[]>([]);
    // Per-load GPU/DOM resources (channel textures, custom media). Released at
    // the start of each shader load; while a fade transition is in progress they
    // are handed to fadeResourcesRef so the previous material/buffers keep
    // sampling them until the fade ends.
    const loadDisposablesRef = useRef<Texture[]>([]);
    const buffersHandedToFadeRef = useRef<boolean>(false);
    const fadeResourcesRef = useRef<{ textures: Texture[]; videoElements: HTMLVideoElement[]; videoUrls: string[]; imageUrls: string[] } | null>(null);
    // Buffer/cubemap runtimes taken out of service by setupMultipassBuffers.
    // Disposed only after the replacement threeProps commit lands — never while
    // useFrame can still render into their (live) render targets.
    const retiredPassRuntimesRef = useRef<{ buffers?: BufferRuntime[]; cubemaps?: CubemapRuntime[]; volumes?: VolumeRuntime[] } | null>(null);
    // Re-entry guard for the shader-load effect: the async load triggers
    // threeProps updates that re-fire the effect while loadedShaderIdentity is
    // still stale — without this, every load runs twice and the second run
    // disposes the buffers the first run just built.
    const loadingIdentityRef = useRef<string | null>(null);

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

    // "Video inputs follow iTime": position a looping video at the shader
    // clock (mod duration). Safe no-op until metadata is known.
    const seekVideoToTime = (el: HTMLVideoElement, t: number) => {
        try {
            if (isFinite(el.duration) && el.duration > 0 && !el.seeking) {
                el.currentTime = wrapTime(t, el.duration);
            }
        } catch (_) { /* ignore */ }
    };

    // Shadertoy injects HW_PERFORMANCE (0 = mobile, 1 = desktop) into every pass; define it here so
    // shaders using "#if HW_PERFORMANCE==0" compile. Guarded to avoid double-definition.
    const injectShadertoyDefines = (code: string): string =>
        (!code || /#define\s+HW_PERFORMANCE\b/.test(code)) ? code : '#define HW_PERFORMANCE 1\n' + code;

    // Sound pass support: when the shader carries a converted Shadertoy sound tab,
    // render blocks of audio samples on the GPU and play them through Web Audio.
    // The engine output feeds the analyser (iAudioData reacts) and the speakers.
    useEffect(() => {
        let cancelled = false;
        const disposeEngine = () => {
            soundEngineRef.current?.dispose();
            soundEngineRef.current = null;
        };

        const resolveSoundCode = async (): Promise<string | undefined> => {
            const filename = shaderObject.metaData?.soundShader;
            if (!filename) return undefined;
            if (shaderObject.inlineSound) return shaderObject.inlineSound;
            const editedShader = await getEditedShader(shaderObject.shaderName);
            const editedSound = (editedShader as any)?.inlineSound;
            if (editedSound) return editedSound;
            return fetchFragmentShader(filename);
        };

        if (!soundBufferEnabled || !analyser || !shaderObject.metaData?.soundShader) {
            disposeEngine();
            return;
        }

        resolveSoundCode()
            .then((code) => {
                if (cancelled || !code) return;
                disposeEngine();
                const engine = new SoundShaderEngine(gl, analyser.context as AudioContext, analyser, injectShadertoyDefines(code));
                soundEngineRef.current = engine;
                engine.start();
                logger.renderer.log('AnalyzerMesh', 'Sound pass started: %s', shaderObject.metaData?.soundShader);
            })
            .catch((e) => logger.renderer.error('AnalyzerMesh', 'Failed to init sound pass: %s', e));

        return () => {
            cancelled = true;
            disposeEngine();
        };
    }, [shaderLoadIdentity, analyser, soundBufferEnabled, gl]);

    // Track a texture created during the current shader load so it is disposed on
    // the next load (or at fade end while a transition keeps the old shader alive).
    const track = <T extends Texture>(t: T): T => {
        loadDisposablesRef.current.push(t);
        return t;
    };

    const releaseCustomMedia = () => {
        customImageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        customImageUrlsRef.current = [];
        customVideoElementsRef.current.forEach(v => { v.pause(); v.src = ''; v.load(); });
        customVideoElementsRef.current = [];
        customVideoUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        customVideoUrlsRef.current = [];
    };

    // material.clone() clones texture uniform values, and material.dispose()
    // does not free them — dispose the cloned channel textures explicitly.
    // Skip shared slots (iAudioData, iVideo, iKeyboard, iMidi, iJoystick): the
    // fade sync reassigns those to the live textures each frame.
    const disposeFadeMaterial = (mat: ShaderMaterial | null) => {
        if (!mat) return;
        for (const key of ['iChannel0', 'iChannel1', 'iChannel2', 'iChannel3'] as const) {
            const v = (mat.uniforms as any)[key]?.value;
            if (v?.isTexture && !v.isRenderTargetTexture) {
                v.dispose();
            }
        }
        mat.dispose();
    };

    const disposeFadeResources = () => {
        const fade = fadeResourcesRef.current;
        if (!fade) return;
        fadeResourcesRef.current = null;
        fade.textures.forEach(t => t.dispose());
        fade.imageUrls.forEach(url => URL.revokeObjectURL(url));
        fade.videoUrls.forEach(url => URL.revokeObjectURL(url));
        fade.videoElements.forEach(v => { v.pause(); v.src = ''; v.load(); });
    };

    // Called once per shader load (start of loadFragmentShader). During a fade
    // the outgoing material still samples the old channel textures and custom
    // videos, so they are stashed for the fade-end cleanup instead of disposed.
    const releaseLoadResources = () => {
        const fade = fadeResourcesRef.current;
        if (fade) {
            fade.textures.push(...loadDisposablesRef.current);
            fade.imageUrls.push(...customImageUrlsRef.current);
            fade.videoUrls.push(...customVideoUrlsRef.current);
            fade.videoElements.push(...customVideoElementsRef.current);
        } else {
            loadDisposablesRef.current.forEach(t => t.dispose());
            releaseCustomMedia();
        }
        loadDisposablesRef.current = [];
        customImageUrlsRef.current = [];
        customVideoElementsRef.current = [];
        customVideoUrlsRef.current = [];
    };

    const loadFragmentShader = async () => {
        releaseLoadResources();
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
        // Only re-assign src when it actually changed — reassigning the same
        // URL resets playback to 0, breaking "videos follow iTime" continuity
        // (compare both the attribute and the resolved absolute URL).
        const targetSrc = shaderObject.metaData?.video ?? browser.runtime.getURL('media/SpaceTravel1Min.mp4');
        if (video.getAttribute('src') !== targetSrc && video.src !== targetSrc) {
            video.src = targetSrc;
            await waitForVideoReady(video);
        }
        try { await video.play(); } catch (e) { /* ignore autoplay interruptions */ }
        if (videoFollowTimeRef.current) {
            seekVideoToTime(video, threeProps!.tuniform.iTime.value);
        }

        const tuniform = threeProps!.tuniform;
        // Recreate the VideoTexture after (re)setting the video src to ensure correct binding
        const vtex = new VideoTexture(video);
        vtex.generateMipmaps = false;
        // Ensure linear sampling and clamp-to-edge
        vtex.minFilter = LinearFilter;
        vtex.magFilter = LinearFilter;
        vtex.wrapS = ClampToEdgeWrapping;
        vtex.wrapT = ClampToEdgeWrapping;
        // Dispose the previous iVideo texture — it is replaced per load.
        // Safe during fades: the fade sync reassigns previousMat's iVideo to the
        // live texture every frame.
        const prevVideoTex = tuniform.iVideo.value;
        if (prevVideoTex && prevVideoTex !== vtex && prevVideoTex.isTexture) {
            prevVideoTex.dispose();
        }
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
            const cubeTex = track(cubeLoader.load(faceUrls,
                (tex) => { logger.renderer.log('ShaderAmp', 'Cubemap loaded successfully'); recordChannelLoad(0, tex, currentTime); },
                undefined,
                (err) => logger.renderer.warn('ShaderAmp', 'Cubemap load error: %s', err)
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
                if (!blob) {
                    logger.renderer.warn('ShaderAmp', 'Custom image not found in IndexedDB: %s', imageId);
                    return;
                }
                const objectUrl = URL.createObjectURL(blob);
                customImageUrlsRef.current.push(objectUrl);
                const tex = track(new TextureLoader().load(objectUrl, (t) => {
                    recordChannelLoad(channelIdx, t, currentTime);
                    URL.revokeObjectURL(objectUrl);
                    // Remove from tracking list since it has been revoked
                    customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== objectUrl);
                }));
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
                if (videoFollowTimeRef.current) seekVideoToTime(videoEl, tuniform.iTime.value);
                const vtex = track(new VideoTexture(videoEl));
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
            videoEl.addEventListener('loadedmetadata', () => {
                if (videoFollowTimeRef.current) seekVideoToTime(videoEl, tuniform.iTime.value);
            }, { once: true });
            videoEl.play().catch(() => {});
            const vtex = track(new VideoTexture(videoEl));
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
                const cubeTex = track(cubeLoader.load(faceUrls, (tex) => {
                    recordChannelLoad(channelIdx, tex, currentTime);
                    // Revoke object URLs after loading
                    faceUrls.forEach(url => {
                        URL.revokeObjectURL(url);
                        customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== url);
                    });
                }));
                tuniform[uniformKey].value = cubeTex;
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
                tuniform[uniformKey].value = tex;
                tuniform.iChannelResolution.value[channelIdx].set(width, height, depth);
                channelLoadTimeRef.current[channelIdx] = tuniform.iTime.value;
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
                return loadCubemap(cubemapPath);
            } else {
                // Load regular 2D texture
                const tex = track(new TextureLoader().load(browser.runtime.getURL(texturePath), (t) => {
                    recordChannelLoad(channelIdx, t, currentTime);
                }));
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
            } else if (isCustomVolumeRef(ch0)) {
                loadCustomVolumeTexture(ch0!, 'iChannel0', 0, meta?.iChannel0Sampler);
            } else if (isBundledVideoRef(ch0)) {
                loadBundledVideoTexture(ch0!, 'iChannel0', 0, meta?.iChannel0Sampler);
            } else if (ch0 === 'video' || ch0Type === 'video') {
                const vtex0 = track(new VideoTexture(videoElement as HTMLVideoElement));
                vtex0.generateMipmaps = false;
                applySamplerToTexture(vtex0, meta?.iChannel0Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel0.value = vtex0;
                channelLoadTimeRef.current[0] = tuniform.iTime.value;
            } else if (ch0Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch0 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel0.value = volumeTex;
                tuniform.iChannelResolution.value[0].set(32, 32, 32);
                channelLoadTimeRef.current[0] = tuniform.iTime.value;
            } else if (ch0 === 'keyboard') {
                tuniform.iChannel0.value = tuniform.iKeyboard.value;
                tuniform.iChannelResolution.value[0].set(KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, 1);
                channelLoadTimeRef.current[0] = tuniform.iTime.value;
            } else if (ch0 === 'audio') {
                tuniform.iChannel0.value = tuniform.iAudioData.value;
                channelLoadTimeRef.current[0] = tuniform.iTime.value;
            } else if (ch0 === 'midi') {
                tuniform.iChannel0.value = tuniform.iMidi.value;
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
            } else if (isCustomVolumeRef(ch1)) {
                loadCustomVolumeTexture(ch1!, 'iChannel1', 1, meta?.iChannel1Sampler);
            } else if (isBundledVideoRef(ch1)) {
                loadBundledVideoTexture(ch1!, 'iChannel1', 1, meta?.iChannel1Sampler);
            } else if (ch1 === 'video' || ch1Type === 'video') {
                const vtex1 = track(new VideoTexture(videoElement as HTMLVideoElement));
                vtex1.generateMipmaps = false;
                applySamplerToTexture(vtex1, meta?.iChannel1Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel1.value = vtex1;
                channelLoadTimeRef.current[1] = tuniform.iTime.value;
            } else if (ch1Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch1 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel1.value = volumeTex;
                tuniform.iChannelResolution.value[1].set(32, 32, 32);
                channelLoadTimeRef.current[1] = tuniform.iTime.value;
            } else if (ch1 === 'keyboard') {
                tuniform.iChannel1.value = tuniform.iKeyboard.value;
                tuniform.iChannelResolution.value[1].set(KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, 1);
                channelLoadTimeRef.current[1] = tuniform.iTime.value;
            } else if (ch1 === 'audio') {
                tuniform.iChannel1.value = tuniform.iAudioData.value;
                channelLoadTimeRef.current[1] = tuniform.iTime.value;
            } else if (ch1 === 'midi') {
                tuniform.iChannel1.value = tuniform.iMidi.value;
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
            } else if (isCustomVolumeRef(ch2)) {
                loadCustomVolumeTexture(ch2!, 'iChannel2', 2, meta?.iChannel2Sampler);
            } else if (isBundledVideoRef(ch2)) {
                loadBundledVideoTexture(ch2!, 'iChannel2', 2, meta?.iChannel2Sampler);
            } else if (ch2 === 'video' || ch2Type === 'video') {
                const vtex2 = track(new VideoTexture(videoElement as HTMLVideoElement));
                vtex2.generateMipmaps = false;
                applySamplerToTexture(vtex2, meta?.iChannel2Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel2.value = vtex2;
                channelLoadTimeRef.current[2] = tuniform.iTime.value;
            } else if (ch2Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch2 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel2.value = volumeTex;
                tuniform.iChannelResolution.value[2].set(32, 32, 32);
                channelLoadTimeRef.current[2] = tuniform.iTime.value;
            } else if (ch2 === 'keyboard') {
                tuniform.iChannel2.value = tuniform.iKeyboard.value;
                tuniform.iChannelResolution.value[2].set(KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, 1);
                channelLoadTimeRef.current[2] = tuniform.iTime.value;
            } else if (ch2 === 'audio') {
                tuniform.iChannel2.value = tuniform.iAudioData.value;
                channelLoadTimeRef.current[2] = tuniform.iTime.value;
            } else if (ch2 === 'midi') {
                tuniform.iChannel2.value = tuniform.iMidi.value;
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
            } else if (isCustomVolumeRef(ch3)) {
                loadCustomVolumeTexture(ch3!, 'iChannel3', 3, meta?.iChannel3Sampler);
            } else if (isBundledVideoRef(ch3)) {
                loadBundledVideoTexture(ch3!, 'iChannel3', 3, meta?.iChannel3Sampler);
            } else if (ch3 === 'video' || ch3Type === 'video') {
                const vtex3 = track(new VideoTexture(videoElement as HTMLVideoElement));
                vtex3.generateMipmaps = false;
                applySamplerToTexture(vtex3, meta?.iChannel3Sampler, fallbackWrap, fallbackFlipY);
                tuniform.iChannel3.value = vtex3;
                channelLoadTimeRef.current[3] = tuniform.iTime.value;
            } else if (ch3Type === 'volume') {
                // Load 3D volume noise texture
                const volumeTex = ch3 === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                tuniform.iChannel3.value = volumeTex;
                tuniform.iChannelResolution.value[3].set(32, 32, 32);
                channelLoadTimeRef.current[3] = tuniform.iTime.value;
            } else if (ch3 === 'keyboard') {
                tuniform.iChannel3.value = tuniform.iKeyboard.value;
                tuniform.iChannelResolution.value[3].set(KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, 1);
                channelLoadTimeRef.current[3] = tuniform.iTime.value;
            } else if (ch3 === 'audio') {
                tuniform.iChannel3.value = tuniform.iAudioData.value;
                channelLoadTimeRef.current[3] = tuniform.iTime.value;
            } else if (ch3 === 'midi') {
                tuniform.iChannel3.value = tuniform.iMidi.value;
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
        
        const processedShader = injectRuntimeWrappers(injectShadertoyDefines(loadedFragmentShader));
        const isVRShaderLocal = hasMainVR(processedShader);
        shaderIsVRCalcRef.current = isVRShaderLocal;
        setShaderIsVR(isVRShaderLocal);
        
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
        const tex = track(new TextureLoader().load(browser.runtime.getURL(src)));
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
        const cubemapPassesMeta: CubemapPassMeta[] = meta?.cubemapPasses || [];
        const volumePassesMeta: VolumePassMeta[] = meta?.volumePasses || [];
        // Dispose previous pass runtimes before rebuilding. When a fade
        // transition just handed the buffers to previousBuffers they are still
        // rendering — skip them and let the fade-end cleanup dispose them.
        const buffersInFade = buffersHandedToFadeRef.current || threeProps.buffers === previousBuffers;
        buffersHandedToFadeRef.current = false;
        if (!buffersInFade) {
            // Retire (don't dispose yet): threeProps.buffers stays the live set
            // until the new runtimes below commit — destroying render targets
            // while useFrame still renders them can inject garbage into
            // feedback-buffer shaders. A post-commit effect disposes them.
            const retired = retiredPassRuntimesRef.current;
            retiredPassRuntimesRef.current = { buffers: threeProps.buffers, cubemaps: threeProps.cubemaps, volumes: threeProps.volumes };
            if (retired) disposeBufferRuntimes(retired.buffers, retired.cubemaps, retired.volumes);
        }
        if ((!buffersMeta || buffersMeta.length === 0) && cubemapPassesMeta.length === 0 && volumePassesMeta.length === 0) {
            setThreeProps({ ...threeProps, buffers: [], cubemaps: [], volumes: [], bufferCamera: undefined });
            return;
        }

        // Ensure deterministic rendering order (lower outputs first)
        buffersMeta = [...(buffersMeta || [])].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
        logger.renderer.log('SA', 'buffersMeta: %s', JSON.stringify(buffersMeta));
        if (cubemapPassesMeta.length > 0) {
            logger.renderer.log('SA', 'cubemapPasses: %s', JSON.stringify(cubemapPassesMeta));
        }

        const { width, height } = getPassSize(shaderIsVRCalcRef.current);
        // Keep iResolution in lockstep with the buffers being built
        threeProps.tuniform.iResolution.value.set(width, height, 1.0);
        logger.renderer.log('SA', 'multipass size %dx%d (renderScale %s, canvas %sx%s)', width, height, renderScale, size.width, size.height);
        const bufferRuntimes: BufferRuntime[] = [];
        const cubemapRuntimes: CubemapRuntime[] = [];
        const volumeRuntimes: VolumeRuntime[] = [];

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
                // Per-pass channel resolutions: each pass has different channel sources
                // (buffer = screen size, cubemap pass = 1024, textures = image size)
                iChannelResolution: { value: [new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1)] },
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
            // Built-in volume noise textures can be preloaded synchronously; custom volumes load async
            if (chType === 'volume') {
                if (src === 'rgbaNoise3D') return getRGBANoise3DTexture();
                if (src === 'greyNoise3D') return getGreyNoise3DTexture();
                return undefined;
            }
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
                return track(new CubeTextureLoader().load(faceUrls));
            }
            const tex = track(new TextureLoader().load(browser.runtime.getURL(src)));
            applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
            return tex;
        };

        // Create all targets and materials first (double-buffered)
        for (let i = 0; i < buffersMeta.length; i++) {
            const b = buffersMeta[i];
            const targetA = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: FloatType });
            targetA.texture.generateMipmaps = false; targetA.texture.minFilter = LinearFilter; targetA.texture.magFilter = LinearFilter;
            const targetB = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: FloatType });
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
                fragmentShader: injectShadertoyDefines(bufferCode),
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
            for (const [key, src, sampler, chType, idx] of channelEntries) {
                if (isBundledVideoRef(src)) {
                    const bvid = document.createElement('video');
                    bvid.src = browser.runtime.getURL(src!);
                    bvid.muted = true; bvid.loop = true; bvid.playsInline = true; bvid.crossOrigin = 'anonymous';
                    customVideoElementsRef.current.push(bvid);
                    bvid.addEventListener('loadedmetadata', () => {
                        if (videoFollowTimeRef.current) seekVideoToTime(bvid, threeProps!.tuniform.iTime.value);
                    }, { once: true });
                    bvid.play().catch(() => {});
                    const bvtex2 = track(new VideoTexture(bvid));
                    bvtex2.generateMipmaps = false;
                    applySamplerToTexture(bvtex2, sampler, fallbackWrap, fallbackFlipY);
                    (br.preloaded as any)[key] = bvtex2;
                } else if (chType === 'video' && !isCustomVideoRef(src)) {
                    const bvtex = track(new VideoTexture(videoElement as HTMLVideoElement));
                    bvtex.generateMipmaps = false;
                    applySamplerToTexture(bvtex, sampler, fallbackWrap, fallbackFlipY);
                    (br.preloaded as any)[key] = bvtex;
                } else if (chType === 'volume' && isCustomVolumeRef(src)) {
                    getVolumeDB(channelRefToVolumeId(src!)!).then(record => {
                        if (!record) return;
                        const { width, height, depth, channels, blob } = record;
                        blob.arrayBuffer().then(ab => {
                            const tex = track(new Data3DTexture(new Uint8Array(ab), width, height, depth));
                            tex.format = channels === 1 ? RedFormat : RGBAFormat;
                            tex.type = UnsignedByteType;
                            tex.minFilter = sampler?.filter === 'nearest' ? NearestFilter : LinearFilter;
                            tex.magFilter = sampler?.filter === 'nearest' ? NearestFilter : LinearFilter;
                            tex.wrapS = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                            tex.wrapT = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                            tex.wrapR = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                            tex.needsUpdate = true;
                            (br.preloaded as any)[key] = tex;
                            (br.material.uniforms.iChannelResolution.value as any)[idx].set(width, height, depth);
                        });
                    }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom volume for buffer %s: %s', key, err));
                } else if (chType === 'volume') {
                    // Load 3D volume noise texture for buffer
                    const volumeTex = src === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                    (br.preloaded as any)[key] = volumeTex;
                    (br.material.uniforms.iChannelResolution.value as any)[idx].set(32, 32, 32);
                } else if (isCustomImageRef(src)) {
                    const imageId = channelRefToImageId(src!);
                    if (imageId) {
                        getImageBlobDB(imageId).then(blob => {
                            if (!blob) return;
                            const objectUrl = URL.createObjectURL(blob);
                            customImageUrlsRef.current.push(objectUrl);
                            const tex = track(new TextureLoader().load(objectUrl, (t) => {
                                URL.revokeObjectURL(objectUrl);
                                customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== objectUrl);
                            }));
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
                            if (videoFollowTimeRef.current) seekVideoToTime(videoEl, threeProps!.tuniform.iTime.value);
                            const vtex = track(new VideoTexture(videoEl));
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
                            const cubeTex = track(cubeLoader.load(faceUrls, () => {
                                faceUrls.forEach(url => {
                                    URL.revokeObjectURL(url);
                                    customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== url);
                                });
                            }));
                            (br.preloaded as any)[key] = cubeTex;
                        }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom cubemap for buffer %s: %s', key, err));
                    }
                }
            }
        }

        // Create cubemap pass runtimes (double-buffered cube render targets)
        // A cube target needs mipmaps when any consumer samples it with textureLod (filter: 'mipmap')
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
                // RGBA32F cannot be mipmapped in WebGL2 (generateMipmap requires a
                // color-renderable AND texture-filterable format) — use RGBA16F when
                // consumers sample via textureLod (filter: 'mipmap'), otherwise keep full float.
                const t = new WebGLCubeRenderTarget(CUBEMAP_PASS_SIZE, { depthBuffer: false, stencilBuffer: false, type: useMipmaps ? HalfFloatType : FloatType });
                t.texture.generateMipmaps = useMipmaps;
                t.texture.minFilter = useMipmaps ? LinearMipmapLinearFilter : LinearFilter;
                t.texture.magFilter = LinearFilter;
                return t;
            };
            const cubeTargetA = makeCubeTarget();
            const cubeTargetB = makeCubeTarget();

            // Use inline code if available (imported shaders), otherwise fetch from file
            let cubeCode: string;
            if (shaderObject.inlineBuffers?.[cp.shaderName]) {
                cubeCode = shaderObject.inlineBuffers[cp.shaderName];
            } else {
                const editedShader = await getEditedShader(shaderObject.shaderName);
                if (editedShader?.inlineBuffers?.[cp.shaderName]) {
                    cubeCode = editedShader.inlineBuffers[cp.shaderName];
                    logger.renderer.log('AnalyzerMesh', 'Using edited cubemap pass %s', cp.shaderName);
                } else {
                    cubeCode = await fetchFragmentShader(cp.shaderName);
                }
            }

            const cubeUniforms = makePassUniforms(baseUniforms);
            (cubeUniforms as any).iCubeFace = { value: 0 };
            // Cubemap passes render at a fixed per-face resolution, not screen resolution
            (cubeUniforms as any).iResolution = { value: new Vector3(CUBEMAP_PASS_SIZE, CUBEMAP_PASS_SIZE, 1) };
            const cubeMat = new ShaderMaterial({
                vertexShader: general_purpose_vertex_shader,
                fragmentShader: injectShadertoyDefines(cubeCode),
                uniforms: cubeUniforms,
            });
            const cubeScene = new Scene();
            cubeScene.add(new Mesh(geometry, cubeMat));

            logger.renderer.log('SA', 'Cubemap pass %s (mipmaps: %s), iChannel0: %s, iChannel3: %s', cp.shaderName, useMipmaps, cp.iChannel0, cp.iChannel3);
            const cubeRuntime: CubemapRuntime = {
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
            };
            cubemapRuntimes.push(cubeRuntime);

            // Async-load custom volume textures for cubemap pass channels
            const cubeVolumeEntries: [string, string | undefined, SamplerConfig | undefined, number][] = [
                ['iChannel0', cp.iChannel0, (cp as any).iChannel0Sampler, 0],
                ['iChannel1', cp.iChannel1, (cp as any).iChannel1Sampler, 1],
                ['iChannel2', cp.iChannel2, (cp as any).iChannel2Sampler, 2],
                ['iChannel3', cp.iChannel3, (cp as any).iChannel3Sampler, 3],
            ];
            for (const [key, src, sampler, idx] of cubeVolumeEntries) {
                if (isCustomVolumeRef(src)) {
                    getVolumeDB(channelRefToVolumeId(src!)!).then(record => {
                        if (!record) return;
                        const { width, height, depth, channels, blob } = record;
                        blob.arrayBuffer().then(ab => {
                            const tex = track(new Data3DTexture(new Uint8Array(ab), width, height, depth));
                            tex.format = channels === 1 ? RedFormat : RGBAFormat;
                            tex.type = UnsignedByteType;
                            tex.minFilter = sampler?.filter === 'nearest' ? NearestFilter : LinearFilter;
                            tex.magFilter = sampler?.filter === 'nearest' ? NearestFilter : LinearFilter;
                            tex.wrapS = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                            tex.wrapT = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                            tex.wrapR = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                            tex.needsUpdate = true;
                            (cubeRuntime.preloaded as any)[key] = tex;
                            cubeRuntime.material.uniforms.iChannelResolution.value[idx].set(width, height, depth);
                        });
                    }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom volume for cubemap pass %s: %s', key, err));
                }
            }
        }

        // Create volume pass runtimes (single 3D render target each).
        // A 3D target needs mipmaps (and a filterable format) when any consumer
        // samples it with textureLod (filter: 'mipmap') — same rule as cubemaps.
        const volumeNeedsMipmaps = (letter: string): boolean => {
            const ref = `volume${letter}`;
            const consumers: any[] = [...(buffersMeta || []), ...cubemapPassesMeta, meta];
            for (const c of consumers) {
                for (let ch = 0; ch < 4; ch++) {
                    if (c[`iChannel${ch}`] === ref && c[`iChannel${ch}Sampler`]?.filter === 'mipmap') return true;
                }
            }
            return false;
        };

        for (const vp of volumePassesMeta) {
            const res = Math.max(4, Math.min(256, Math.floor(vp.resolution || 128)));
            const useMipmaps = volumeNeedsMipmaps(vp.letter);
            // Shadertoy volume buffers are 32-bit float; shaders pack integers
            // into the mantissa (e.g. n / 2^24), which 8-bit or half-float
            // storage flattens to zero. Mipmapped volumes fall back to half
            // float because 32F mipmap generation isn't renderable everywhere.
            const volType = useMipmaps ? HalfFloatType : FloatType;
            const makeVolTarget = () => {
                const t = new WebGL3DRenderTarget(res, res, res, { depthBuffer: false, stencilBuffer: false, type: volType });
                // WebGL3DRenderTarget replaces .texture with a fresh Data3DTexture
                // AFTER applying options, so the requested type/format are lost
                // (defaults to RGBA8). Re-apply them on the texture itself.
                t.texture.type = volType;
                t.texture.format = RGBAFormat;
                t.texture.generateMipmaps = useMipmaps;
                t.texture.minFilter = useMipmaps ? LinearMipmapLinearFilter : LinearFilter;
                t.texture.magFilter = LinearFilter;
                t.texture.needsUpdate = true;
                return t;
            };
            if (volType === FloatType && !gl.extensions.has('OES_texture_float_linear')) {
                logger.renderer.warn('ShaderAmp', 'OES_texture_float_linear unavailable: linear sampling of 32F volume %s may read as zero', vp.shaderName);
            }
            // Self-referencing volumes (history/feedback) need a second target
            // so the previous frame can be sampled while the new one is written.
            const selfRef = `volume${vp.letter}`;
            const readsSelf = [vp.iChannel0, vp.iChannel1, vp.iChannel2, vp.iChannel3].includes(selfRef);
            const volTargetA = makeVolTarget();
            const volTargetB = readsSelf ? makeVolTarget() : volTargetA;

            // Use inline code if available (imported shaders), otherwise fetch from file
            let volCode: string;
            if (shaderObject.inlineBuffers?.[vp.shaderName]) {
                volCode = shaderObject.inlineBuffers[vp.shaderName];
            } else {
                const editedShader = await getEditedShader(shaderObject.shaderName);
                if (editedShader?.inlineBuffers?.[vp.shaderName]) {
                    volCode = editedShader.inlineBuffers[vp.shaderName];
                    logger.renderer.log('AnalyzerMesh', 'Using edited volume pass %s', vp.shaderName);
                } else {
                    volCode = await fetchFragmentShader(vp.shaderName);
                }
            }

            const volUniforms = makePassUniforms(baseUniforms);
            (volUniforms as any).iVolumeSlice = { value: 0 };
            // Volume passes shade texels of a res^3 grid, not the screen
            (volUniforms as any).iResolution = { value: new Vector3(res, res, res) };
            const volMat = new ShaderMaterial({
                vertexShader: general_purpose_vertex_shader,
                fragmentShader: injectShadertoyDefines(volCode),
                uniforms: volUniforms,
            });
            const volScene = new Scene();
            volScene.add(new Mesh(geometry, volMat));

            // A volume that never reads time/frame/audio re-bakes only once
            const isStatic = !/\b(iTime|iFrame|iMouse|iAudioData|iAmplifiedTime|iChannelTime|iChannel0|iChannel1|iChannel2|iChannel3)\b/.test(volCode);

            logger.renderer.log('SA', 'Volume pass %s (%d^3, mipmap: %s, static: %s, self-ref: %s)', vp.shaderName, res, useMipmaps, isStatic, readsSelf);
            volumeRuntimes.push({
                material: volMat,
                scene: volScene,
                targets: [volTargetA, volTargetB],
                readIndex: 0,
                writeIndex: readsSelf ? 1 : 0,
                letter: vp.letter,
                resolution: res,
                isStatic,
                baked: false,
                channelMeta: { iChannel0: vp.iChannel0, iChannel1: vp.iChannel1, iChannel2: vp.iChannel2, iChannel3: vp.iChannel3 },
                channelSamplers: {
                    iChannel0: (vp as any).iChannel0Sampler,
                    iChannel1: (vp as any).iChannel1Sampler,
                    iChannel2: (vp as any).iChannel2Sampler,
                    iChannel3: (vp as any).iChannel3Sampler,
                },
                preloaded: {
                    iChannel0: preloadIfPath(vp.iChannel0, "iChannel0", vp.cubemaps, (vp as any).iChannel0Sampler, (vp as any).iChannel0Type),
                    iChannel1: preloadIfPath(vp.iChannel1, "iChannel1", vp.cubemaps, (vp as any).iChannel1Sampler, (vp as any).iChannel1Type),
                    iChannel2: preloadIfPath(vp.iChannel2, "iChannel2", vp.cubemaps, (vp as any).iChannel2Sampler, (vp as any).iChannel2Type),
                    iChannel3: preloadIfPath(vp.iChannel3, "iChannel3", vp.cubemaps, (vp as any).iChannel3Sampler, (vp as any).iChannel3Type),
                },
            });
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
        for (const [key, src, sampler, chType, idx] of finalChannelEntries) {
            if (isBundledVideoRef(src)) {
                const fvid = document.createElement('video');
                fvid.src = browser.runtime.getURL(src!);
                fvid.muted = true; fvid.loop = true; fvid.playsInline = true; fvid.crossOrigin = 'anonymous';
                customVideoElementsRef.current.push(fvid);
                fvid.addEventListener('loadedmetadata', () => {
                    if (videoFollowTimeRef.current) seekVideoToTime(fvid, threeProps!.tuniform.iTime.value);
                }, { once: true });
                fvid.play().catch(() => {});
                const fvtex2 = track(new VideoTexture(fvid));
                fvtex2.generateMipmaps = false;
                applySamplerToTexture(fvtex2, sampler, fallbackWrap, fallbackFlipY);
                (finalPreloaded as any)[key] = fvtex2;
            } else if (chType === 'video' && !isCustomVideoRef(src)) {
                const fvtex = track(new VideoTexture(videoElement as HTMLVideoElement));
                fvtex.generateMipmaps = false;
                applySamplerToTexture(fvtex, sampler, fallbackWrap, fallbackFlipY);
                (finalPreloaded as any)[key] = fvtex;
            } else if (chType === 'volume' && isCustomVolumeRef(src)) {
                getVolumeDB(channelRefToVolumeId(src!)!).then(record => {
                    if (!record) return;
                    const { width, height, depth, channels, blob } = record;
                    blob.arrayBuffer().then(ab => {
                        const tex = track(new Data3DTexture(new Uint8Array(ab), width, height, depth));
                        tex.format = channels === 1 ? RedFormat : RGBAFormat;
                        tex.type = UnsignedByteType;
                        tex.minFilter = sampler?.filter === 'nearest' ? NearestFilter : LinearFilter;
                        tex.magFilter = sampler?.filter === 'nearest' ? NearestFilter : LinearFilter;
                        tex.wrapS = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                        tex.wrapT = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                        tex.wrapR = sampler?.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
                        tex.needsUpdate = true;
                        (finalPreloaded as any)[key] = tex;
                        if (baseUniforms.iChannelResolution.value[idx]) {
                            baseUniforms.iChannelResolution.value[idx].set(width, height, depth);
                        }
                    });
                }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom volume for final pass %s: %s', key, err));
            } else if (chType === 'volume') {
                // Load 3D volume noise texture for final pass
                const volumeTex = src === 'rgbaNoise3D' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
                (finalPreloaded as any)[key] = volumeTex;
                if (baseUniforms.iChannelResolution.value[idx]) {
                    baseUniforms.iChannelResolution.value[idx].set(32, 32, 32);
                }
            } else if (isCustomImageRef(src)) {
                const imageId = channelRefToImageId(src!);
                if (imageId) {
                    getImageBlobDB(imageId).then(blob => {
                        if (!blob) return;
                        const objectUrl = URL.createObjectURL(blob);
                        customImageUrlsRef.current.push(objectUrl);
                        const tex = track(new TextureLoader().load(objectUrl, (t) => {
                            URL.revokeObjectURL(objectUrl);
                            customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== objectUrl);
                        }));
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
                        if (videoFollowTimeRef.current) seekVideoToTime(videoEl, threeProps!.tuniform.iTime.value);
                        const vtex = track(new VideoTexture(videoEl));
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
                        const cubeTex = track(cubeLoader.load(faceUrls, () => {
                            faceUrls.forEach(url => {
                                URL.revokeObjectURL(url);
                                customImageUrlsRef.current = customImageUrlsRef.current.filter(u => u !== url);
                            });
                        }));
                        (finalPreloaded as any)[key] = cubeTex;
                    }).catch((err: any) => logger.renderer.error('ShaderAmp', 'Failed to load custom cubemap for final pass %s: %s', key, err));
                }
            }
        }

        // Schedule warmup passes equal to the number of passes so the
        // dependency chain (A→B→C) is fully primed before the first visible frame.
        bufferWarmupRef.current = bufferRuntimes.filter(Boolean).length + cubemapRuntimes.length + volumeRuntimes.length;
        setThreeProps({ ...threeProps, buffers: bufferRuntimes, cubemaps: cubemapRuntimes, volumes: volumeRuntimes, bufferCamera: camera, finalChannels, finalPreloaded });
    }

    // Per-eye pixel size while an XR session is presenting. R3F's `viewport`
    // is useless in VR (world units at a 0 camera→target distance), so use the
    // XR camera's per-eye viewport, falling back to the session's base layer.
    const getXrEyeSize = (): { width: number; height: number } | null => {
        const cams = (gl.xr.getCamera() as any)?.cameras;
        const vp = cams?.[0]?.viewport;
        if (vp && vp.z > 0) return { width: vp.z, height: vp.w };
        const layer = gl.xr.getSession?.()?.renderState?.baseLayer;
        if (layer?.framebufferWidth) return { width: layer.framebufferWidth / 2, height: layer.framebufferHeight };
        return null;
    };

    // Render size while presenting: per-eye shape only for mainVR shaders;
    // 2D/cinema shaders render at 16:9 (Quest eye buffers are ~1:1 and would
    // squeeze them into a square).
    const getXrRenderSize = (isVRShader: boolean): { width: number; height: number } | null => {
        const eye = getXrEyeSize();
        if (!eye) return null;
        return isVRShader ? eye : cinemaRenderSize(eye);
    };

    // Single source of truth for the shader render resolution: multipass
    // buffer targets AND iResolution must be the same whole-pixel size.
    // Shaders derive fragCoord = vUv * iResolution; a fractional iResolution
    // (e.g. 937 * 0.75 = 702.75) against a 703px buffer maps two buffer pixels
    // onto one integer coordinate, shifting texelFetch-addressed state rows
    // (Neural Pet) by a pixel — corrupting them for good.
    const getPassSize = (isVRShader: boolean): { width: number; height: number } => {
        const eye = vrActive ? getXrRenderSize(isVRShader) : null;
        return {
            width: Math.max(1, Math.round(eye ? eye.width : size.width * renderScale)),
            height: Math.max(1, Math.round(eye ? eye.height : size.height * renderScale)),
        };
    };

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
            currentDate.getHours()*60.0*60 + currentDate.getMinutes()*60 + currentDate.getSeconds() + currentDate.getMilliseconds()/1000);
    }
  
    const initializeProps = () => {
        const fbcArray = fbcArrayRef.current as any; // Force type for Three.js compatibility
        const format = gl.capabilities.isWebGL2 ? RedFormat : LuminanceFormat;
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
            iSampleRate: { type: 'f', value: analyser?.context?.sampleRate ?? 44100.0 },
            iResolution: { value: new Vector3(window.innerWidth, window.innerHeight, 1.0) },
            iVideo: { value: video_texture },
            iMouse: { value: new Vector4(window.innerWidth / 2, window.innerHeight / 2, 0, 0), type: 'v4', },
            iFrame: { type: 'i', value: 0 },
            iKeyboard: { value: new DataTexture(keyboardStateRef.current as any, KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, RGBAFormat) },
            iMidi: { value: new DataTexture(midiStateRef.current as any, MIDI_TEXTURE_WIDTH, MIDI_TEXTURE_HEIGHT, RedFormat) },
            iJoystick: { value: new DataTexture(joystickStateRef.current as any, JOYSTICK_TEXTURE_WIDTH, JOYSTICK_TEXTURE_HEIGHT, RedFormat) },
            iTransitionOpacity: { type: 'f', value: 1.0 },
            iVRMode: { type: 'i', value: 0 }
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
            // Release per-load textures/media (and any fade-stashed ones)
            releaseLoadResources();
            disposeFadeResources();
            if (previousMatRef.current) {
                disposeFadeMaterial(previousMatRef.current);
                (previousMatRef.current as any) = null;
            }
            // Tear down any retired pass runtimes still pending disposal
            const retired = retiredPassRuntimesRef.current;
            retiredPassRuntimesRef.current = null;
            if (retired) disposeBufferRuntimes(retired.buffers, retired.cubemaps, retired.volumes);
            const ov = overlayRuntimeRef.current;
            overlayRuntimeRef.current = null;
            if (ov) {
                ov.channels.dispose();
                ov.material.dispose();
            }
        }
    }, []);

    // Overlay shader lifecycle: build/dispose a transparent ShaderMaterial
    // composited on top of the current shader. Rebuilt only when the overlay's
    // shader identity or blend mode changes — opacity updates in place.
    useEffect(() => {
        if (!threeProps) return;
        const key = overlay ? getShaderLoadIdentity(overlay.shader) + '|' + overlay.blendMode : '';
        if (overlay && key === overlayRuntimeRef.current?.key) {
            overlayRuntimeRef.current.material.uniforms.iTransitionOpacity.value = overlay.opacity;
            return;
        }
        if (overlayRuntimeRef.current) {
            overlayRuntimeRef.current.channels.dispose();
            overlayRuntimeRef.current.material.dispose();
            overlayRuntimeRef.current = null;
            setOverlayRuntime(null);
        }
        if (!overlay) return;

        let cancelled = false;
        const built: { material?: ShaderMaterial; channels?: OverlayChannelResources } = {};
        const shaderName = overlay.shader.shaderName;
        (async () => {
            try {
                // Code: inline (imported/custom) -> edited built-in -> bundled file
                let code = overlay.shader.inlineCode;
                if (!code) {
                    code = (await getEditedShader(shaderName))?.inlineCode;
                }
                if (!code) {
                    code = await fetchFragmentShader(shaderName);
                }
                if (cancelled || !code) return;
                const fragmentShader = injectRuntimeWrappers(injectShadertoyDefines(code));

                const tuniform = threeProps.tuniform;
                // Share the live IUniform objects for time/audio/input; own the
                // channel and transition uniforms (the fade loop writes the
                // main iTransitionOpacity every frame).
                const uniforms: TUniform = {
                    iAmplifiedTime: tuniform.iAmplifiedTime,
                    iTime: tuniform.iTime,
                    iTimeDelta: tuniform.iTimeDelta,
                    iDate: tuniform.iDate,
                    iAudioData: tuniform.iAudioData,
                    iResolution: tuniform.iResolution,
                    iVideo: tuniform.iVideo,
                    iMouse: tuniform.iMouse,
                    iKeyboard: tuniform.iKeyboard,
                    iMidi: tuniform.iMidi,
                    iJoystick: tuniform.iJoystick,
                    iFrame: tuniform.iFrame,
                    iFrameRate: tuniform.iFrameRate,
                    iSampleRate: tuniform.iSampleRate,
                    iChannel0: { value: null },
                    iChannel1: { value: null },
                    iChannel2: { value: null },
                    iChannel3: { value: null },
                    iChannelResolution: { value: [new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1)] },
                    iChannelTime: { value: [0, 0, 0, 0] },
                    iTransitionOpacity: { value: overlay.opacity },
                    iVRMode: { value: 0 },
                } as TUniform;

                // Custom uniform defaults from the overlay shader's meta
                overlay.shader.metaData?.customUniforms?.forEach((uniform: ShaderUniform) => {
                    let value: any = uniform.default;
                    switch (uniform.type) {
                        case 'int':
                            value = Math.floor(uniform.default as number);
                            break;
                        case 'float':
                            value = uniform.default as number;
                            break;
                        case 'bool':
                            value = uniform.default ? 1.0 : 0.0;
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
                    uniforms[uniform.name] = { value };
                });

                // One-time read of values saved by uniform nodes / the uniforms editor
                const savedValues = (await browser.storage.local.get(`customUniforms_${shaderName}`))[`customUniforms_${shaderName}`];
                if (cancelled) return;
                if (savedValues) {
                    overlay.shader.metaData?.customUniforms?.forEach((uniform: ShaderUniform) => {
                        if (savedValues[uniform.name] !== undefined && uniforms[uniform.name]) {
                            let value = savedValues[uniform.name];
                            switch (uniform.type) {
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
                            uniforms[uniform.name].value = value;
                        }
                    });
                }

                const material = new ShaderMaterial({
                    vertexShader: general_purpose_vertex_shader,
                    fragmentShader,
                    uniforms,
                    transparent: true,
                    depthTest: false,
                    depthWrite: false,
                    blending: overlay.blendMode === 'normal' ? NormalBlending : AdditiveBlending,
                });
                built.material = material;

                const channelLoadTimes = [0, 0, 0, 0];
                const channels = loadOverlayChannels({
                    meta: overlay.shader.metaData,
                    uniforms,
                    shared: { iAudioData: tuniform.iAudioData, iVideo: tuniform.iVideo, iKeyboard: tuniform.iKeyboard, iMidi: tuniform.iMidi },
                    videoElement,
                    channelLoadTimes,
                    iTime: tuniform.iTime.value,
                });
                built.channels = channels;

                // Compile check on a throwaway scene so a broken overlay shader
                // logs an error instead of breaking the main render.
                let compileOk = true;
                const tmpScene = new Scene();
                const tmpGeom = new PlaneGeometry(2, 2);
                tmpScene.add(new Mesh(tmpGeom, material));
                const dbg: any = (gl as any).debug;
                const prevOnShaderError = dbg?.onShaderError;
                if (dbg) {
                    dbg.onShaderError = (...args: any[]) => {
                        compileOk = false;
                        if (prevOnShaderError) prevOnShaderError(...args);
                    };
                }
                try {
                    gl.compile(tmpScene, camera);
                } finally {
                    if (dbg) dbg.onShaderError = prevOnShaderError;
                    tmpGeom.dispose();
                }
                if (cancelled) return;
                if (!compileOk) {
                    logger.renderer.error('AnalyzerMesh', 'Overlay shader failed: %s', shaderName);
                    channels.dispose();
                    material.dispose();
                    built.channels = undefined;
                    built.material = undefined;
                    return;
                }
                const runtime: OverlayRuntime = { key, material, channels, channelLoadTimes };
                built.material = undefined;
                built.channels = undefined;
                overlayRuntimeRef.current = runtime;
                setOverlayRuntime(runtime);
            } catch (e) {
                built.channels?.dispose();
                built.material?.dispose();
                built.channels = undefined;
                built.material = undefined;
                logger.renderer.error('AnalyzerMesh', 'Overlay shader failed: %s', shaderName);
            }
        })();

        return () => {
            cancelled = true;
            built.channels?.dispose();
            built.material?.dispose();
        };
    }, [overlay, threeProps]);

    // Dispose retired buffer/cubemap runtimes once the replacement threeProps
    // commit has landed — by then useFrame renders the new runtimes and never
    // touches the retired render targets. One rAF of slack lets an in-flight
    // gl.render into the old targets complete first.
    useEffect(() => {
        const retired = retiredPassRuntimesRef.current;
        if (!retired) return;
        retiredPassRuntimesRef.current = null;
        requestAnimationFrame(() => disposeBufferRuntimes(retired.buffers, retired.cubemaps, retired.volumes));
    }, [threeProps]);

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
                    mouseClickFrameRef.current = true;
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
            const keyCode = getKeyboardKeyCode(event);
            if (keyCode === null) return;
            const offset = keyCode * KEYBOARD_BYTES_PER_PIXEL;
            // Row 0: key currently held (R component)
            keyboardStateRef.current[offset + 0] = 255;
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            const keyCode = getKeyboardKeyCode(event);
            if (keyCode === null) return;
            const offset = keyCode * KEYBOARD_BYTES_PER_PIXEL;
            // Row 0: key no longer held (R component)
            keyboardStateRef.current[offset + 0] = 0;
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
            const result = await browser.storage.local.get([SETTINGS_ENABLE_IAMPLIFIED_TIME, SETTINGS_WAIT_FOR_AUDIO, STATE_SCENE_CLOCK_PAUSED, SETTINGS_TRACK_SYNC, SETTINGS_VIDEO_FOLLOW_TIME]);
            enableIAmplifiedTimeRef.current = result[SETTINGS_ENABLE_IAMPLIFIED_TIME] ?? true;
            waitForAudioRef.current = result[SETTINGS_WAIT_FOR_AUDIO] ?? false;
            clockPausedRef.current = result[STATE_SCENE_CLOCK_PAUSED] ?? false;
            trackSyncEnabledRef.current = result[SETTINGS_TRACK_SYNC] ?? false;
            videoFollowTimeRef.current = result[SETTINGS_VIDEO_FOLLOW_TIME] ?? false;
        };
        loadIAmplifiedTimeSetting();

        const handleStorageChange = (changes: Record<string, any>) => {
            if (changes[SETTINGS_ENABLE_IAMPLIFIED_TIME] !== undefined) {
                enableIAmplifiedTimeRef.current = changes[SETTINGS_ENABLE_IAMPLIFIED_TIME].newValue ?? true;
            }
            if (changes[SETTINGS_WAIT_FOR_AUDIO] !== undefined) {
                const newValue = changes[SETTINGS_WAIT_FOR_AUDIO].newValue ?? false;
                waitForAudioRef.current = newValue;
                if (newValue) {
                    // Re-arm the gate when the option is (re-)enabled
                    audioDetectedRef.current = false;
                    audioGateFramesRef.current = 0;
                }
            }
            if (changes[STATE_SCENE_CLOCK_PAUSED] !== undefined) {
                clockPausedRef.current = changes[STATE_SCENE_CLOCK_PAUSED].newValue ?? false;
            }
            if (changes[SETTINGS_TRACK_SYNC] !== undefined) {
                trackSyncEnabledRef.current = changes[SETTINGS_TRACK_SYNC].newValue ?? false;
            }
            if (changes[SETTINGS_VIDEO_FOLLOW_TIME] !== undefined) {
                videoFollowTimeRef.current = changes[SETTINGS_VIDEO_FOLLOW_TIME].newValue ?? false;
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
        const overlayThrottle = createOverlayOpacityThrottle();

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
                    } else if (isOverlayTarget(target)) {
                        if (evtIsButton) dispatchOverlayTarget(target, { kind: 'button', pressed: isPress }, mapping, overlayThrottle);
                        else dispatchOverlayTarget(target, { kind: 'fader', value01: Math.min(1, Math.abs(evt.value)) }, mapping, overlayThrottle);
                    } else if (isSceneTarget(target)) {
                        if (shouldTrigger) dispatchSceneTarget(target);
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
        const overlayThrottle = createOverlayOpacityThrottle();
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
                } else if (isOverlayTarget(target)) {
                    if (evtIsButton) dispatchOverlayTarget(target, { kind: 'button', pressed: isPress }, mapping, overlayThrottle);
                    else dispatchOverlayTarget(target, { kind: 'fader', value01: Math.min(1, Math.abs(evt.value)) }, mapping, overlayThrottle);
                } else if (isSceneTarget(target)) {
                    if (shouldTrigger) dispatchSceneTarget(target);
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
        const overlayThrottle = createOverlayOpacityThrottle();

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
                    } else if (isOverlayTarget(target)) {
                        if (mapping.source.type === 'noteon') {
                            if (evt.type === 'noteon' || evt.type === 'noteoff') dispatchOverlayTarget(target, { kind: 'button', pressed: evt.type === 'noteon' }, mapping, overlayThrottle);
                        } else if (evt.type === 'cc') {
                            const value01 = mapping.max !== mapping.min ? Math.min(1, Math.max(0, (mapped - mapping.min) / (mapping.max - mapping.min))) : evt.value / 127;
                            dispatchOverlayTarget(target, { kind: 'fader', value01 }, mapping, overlayThrottle);
                        }
                    } else if (isSceneTarget(target)) {
                        if (evt.type === 'noteon') {
                            logger.content.log('ShaderAmp', 'MIDI ch%d note %d -> %s', evt.channel, evt.number, target);
                            dispatchSceneTarget(target);
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
            // When track sync is active, time adjustments must move the media
            // too — otherwise the next frame's lock would undo them.
            const sendMediaSeekIfSynced = () => {
                try {
                    const s = trackSampleRef?.current;
                    if (s && trackSyncEnabledRef.current &&
                        isSampleUsable({ ...s, sampledAt: s.receivedAt ?? s.sampledAt }, performance.now())) {
                        browser.runtime.sendMessage({ type: MEDIA_CONTROL, action: 'seek', time: tuniform.iTime.value }).catch(() => {});
                    }
                } catch (_) { /* ignore */ }
            };
            if (cmd === RESET_TIME) {
                resetTime(tuniform);
                sendMediaSeekIfSynced();
            } else if (cmd === SET_TIME && typeof msg.time === 'number' && isFinite(msg.time)) {
                // Editor timeline seek: jump both shader clocks to the target time
                const t = Math.max(0, msg.time);
                tuniform.iTime.value = t;
                tuniform.iAmplifiedTime.value = t;
                // Seeking is an explicit user action — open the wait-for-audio gate
                // (without flagging a gateOpened scene restart).
                if (waitForAudioRef.current && !audioDetectedRef.current) {
                    audioDetectedRef.current = true;
                }
                lastSceneTickSendRef.current = 0;
                sendMediaSeekIfSynced();
            } else if (cmd == INCR_TIME) {
                incrementTime(tuniform, defaultIncrement);
                sendMediaSeekIfSynced();
            } else if (cmd == DECR_TIME) {
                incrementTime(tuniform, -defaultIncrement);
                sendMediaSeekIfSynced();
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
        if (loadedShaderIdentity === shaderLoadIdentity && loadedRenderScale === renderScale && loadedVrActive === vrActive) return;
        // Re-entry guard: the async load updates threeProps, which re-fires this
        // effect while loadedShaderIdentity is still stale — without the guard
        // every load runs twice and the second run tears down the buffers the
        // first run just built. Keyed on everything that requires a rebuild
        // (render scale / VR change keep the shader identity but must reload).
        const loadKey = `${shaderLoadIdentity}|${renderScale}|${vrActive}`;
        if (loadingIdentityRef.current === loadKey) return;
        loadingIdentityRef.current = loadKey;

        console.log('Load Fragment Shader', threeProps, shaderObject, 'at scale', renderScale);
        
        // Handle fade transition
        if (shaderFade && loadedShaderName && !isTransitioning) {
            console.log('Starting fade transition from', loadedShaderName, 'to', shaderObject.shaderName);
            setPreviousShaderName(loadedShaderName);
            setIsTransitioning(true);
            setFadeProgress(0.0);
            // Store current buffer runtimes so previous shader's multipass buffers continue rendering during fade
            setPreviousBuffers(threeProps?.buffers);
            buffersHandedToFadeRef.current = true;
            // Keep the outgoing load's textures/media alive until the fade ends
            fadeResourcesRef.current = { textures: [], videoElements: [], videoUrls: [], imageUrls: [] };
            
            // Load the new shader after a brief delay to allow fade setup
            setTimeout(async () => {
                try {
                    await loadFragmentShader();
                    await setupMultipassBuffers();
                    setLoadedShaderName(shaderObject.shaderName);
                    setLoadedShaderIdentity(shaderLoadIdentity);
                    setLoadedRenderScale(renderScale);
                    setLoadedVrActive(vrActive);
                } catch (e) {
                    loadingIdentityRef.current = null;
                    logger.renderer.error('AnalyzerMesh', 'Shader load failed: %s', e);
                }
            }, 50); // 50ms delay
        } else {
            // Direct load when fade is disabled or no previous shader
            (async () => {
                try {
                    await loadFragmentShader();
                    await setupMultipassBuffers();
                    setLoadedShaderName(shaderObject.shaderName);
                    setLoadedShaderIdentity(shaderLoadIdentity);
                    setLoadedRenderScale(renderScale);
                    setLoadedVrActive(vrActive);
                } catch (e) {
                    loadingIdentityRef.current = null;
                    logger.renderer.error('AnalyzerMesh', 'Shader load failed: %s', e);
                }
            })();
        }
    }, [threeProps, shaderObject, shaderLoadIdentity, loadedShaderName, loadedShaderIdentity, loadedRenderScale, renderScale, shaderFade, isTransitioning, vrActive, loadedVrActive]);


   useEffect(() => {
        if (!threeProps) {
            return;
        }
        const tuniform = threeProps.tuniform!;
        // Never use R3F `viewport` while in VR — with the swapped-in
        // PerspectiveCamera it degenerates to 0×0 and collapses iResolution.
        // Whole-pixel size shared with the multipass targets (see getPassSize).
        // `size` (canvas CSS px) instead of `viewport`, which degenerates in VR.
        const { width, height } = getPassSize(shaderIsVR);
        tuniform.iResolution.value.set(width, height, 1.0);
        // Window resize: resize live buffer targets so they keep matching
        // iResolution (shaders re-derive state when the resolution changes).
        for (const br of threeProps.buffers || []) {
            if (!br) continue;
            for (const t of br.targets) {
                if (t.width !== width || t.height !== height) t.setSize(width, height);
            }
        }
    }, [threeProps, renderScale, vrActive, size.width, size.height, shaderIsVR]);

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
                // Clean up previous material and buffers
                if (previousMatRef.current) {
                    disposeFadeMaterial(previousMatRef.current);
                    (previousMatRef.current as any) = null;
                }
                if (previousBuffers) {
                    disposeBufferRuntimes(previousBuffers);
                    setPreviousBuffers(undefined);
                }
                // Channel textures/media the outgoing shader was still sampling
                disposeFadeResources();
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

        // Scene controller beat detection (works even when randomizeBeat is off)
        if (sceneBeatEnabled && fbcArrayRef.current) {
            const bassEnd = Math.floor(frequencyBinCount * 0.1);
            let bassSum = 0;
            for (let i = 0; i < bassEnd; i++) {
                bassSum += fbcArrayRef.current[i];
            }
            const bassAverage = bassSum / bassEnd;
            const beatThreshold = 200;

            if (bassAverage > beatThreshold) {
                sceneBeatCounterRef.current++;
                if (sceneBeatCounterRef.current >= 1) {
                    onSceneBeat?.();
                    sceneBeatCounterRef.current = 0;
                }
            }
        }

        // Scene controller audio-level reporting
        if (sceneAudioEnabled && analyser && onSceneAudioLevel) {
            const now = performance.now();
            if (now - lastSceneAudioSendRef.current > 100) {
                if (timeDomainArrayRef.current.length !== analyser.fftSize) {
                    timeDomainArrayRef.current = new Uint8Array(analyser.fftSize);
                }
                analyser.getByteTimeDomainData(timeDomainArrayRef.current);
                let sum = 0;
                for (let i = 0; i < timeDomainArrayRef.current.length; i++) {
                    const v = timeDomainArrayRef.current[i] - 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / timeDomainArrayRef.current.length);
                onSceneAudioLevel(rms);
                lastSceneAudioSendRef.current = now;
            }
        }

        // Scene controller regular tick — drives time/beat conditions reliably even
        // when the MV3 service-worker setInterval is throttled or there is no audio stream.
        // Carries the shader's displayed time so scene conditions stay in sync with
        // what the user actually sees (respects wait-for-audio gating and shaderSpeed).
        if (sceneAudioEnabled) {
            const now = performance.now();
            if (now - lastSceneTickSendRef.current > 100) {
                const tuniform = threeProps.tuniform;
                const shaderTime = enableIAmplifiedTimeRef.current
                    ? tuniform?.iAmplifiedTime?.value
                    : tuniform?.iTime?.value;
                const iTimeVal = Number(tuniform?.iTime?.value);
                const iAmpVal = Number(tuniform?.iAmplifiedTime?.value);
                if ((!isFinite(iTimeVal) || !isFinite(iAmpVal)) && !sceneTickNonFiniteWarnedRef.current) {
                    sceneTickNonFiniteWarnedRef.current = true;
                    logger.content.warn('ShaderAmp', 'SCENE_TICK clock not finite: iTime=%s iAmplifiedTime=%s', tuniform?.iTime?.value, tuniform?.iAmplifiedTime?.value);
                }
                const gateOpened = sceneGateOpenedPendingRef.current;
                sceneGateOpenedPendingRef.current = false;
                browser.runtime.sendMessage({
                    command: 'SCENE_TICK',
                    time: shaderTime,
                    iTime: isFinite(iTimeVal) ? iTimeVal : undefined,
                    iAmplifiedTime: isFinite(iAmpVal) ? iAmpVal : undefined,
                    gateOpened,
                }).catch(error =>
                    logger.content.error('ShaderAmp', 'Error sending scene tick: %s', error)
                );
                lastSceneTickSendRef.current = now;
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
        const avgLevel = sum / fbcArray.length;

        // Wait-for-audio gate: latch once a real audio signal is detected.
        // Requires a sustained average level across consecutive frames so capture
        // noise alone doesn't start the clock. Checked before MIDI FFT injection
        // so only actual tab audio unlocks time.
        if (waitForAudioRef.current && !audioDetectedRef.current) {
            if (avgLevel >= AUDIO_GATE_MIN_AVG) {
                audioGateFramesRef.current++;
            } else {
                audioGateFramesRef.current = 0;
            }
            if (audioGateFramesRef.current >= AUDIO_GATE_MIN_FRAMES) {
                audioDetectedRef.current = true;
                sceneGateOpenedPendingRef.current = true;
                logger.content.log('ShaderAmp', 'Audio signal detected, starting shader time');
            }
        }
        // Track sync: a usable position sample from the captured tab locks
        // iTime to the media's playback position. Freshness is measured on the
        // local performance.now() axis via the sample's receivedAt stamp.
        const trackSample = trackSampleRef?.current ?? null;
        const frameNow = performance.now();
        const trackSynced = !!trackSyncEnabledRef.current && !!trackSample &&
            isSampleUsable({ ...trackSample, sampledAt: trackSample.receivedAt ?? trackSample.sampledAt }, frameNow);
        if (trackSynced) {
            // Bypass the wait-for-audio gate, but latch it open so disabling
            // sync later doesn't snap the clock back to a frozen 0.
            audioDetectedRef.current = true;
        }

        // Coarse (whole-second DOM) samples: two consecutive samples reporting
        // the same position >1s apart mean the player is paused but never
        // produced a pause event — treat the clock as held.
        if (trackSample?.precision === 'coarse' && trackSample !== lastCoarseSampleRef.current) {
            const prev = lastCoarseSampleRef.current;
            lastCoarseSampleRef.current = trackSample;
            coarseStalledRef.current = !!(prev && !trackSample.paused && prev.position === trackSample.position &&
                (trackSample.receivedAt ?? 0) - (prev.receivedAt ?? 0) > 1000);
        }
        if (!trackSample || trackSample.precision !== 'coarse') {
            coarseStalledRef.current = false;
        }
        const trackPaused = !!trackSample && (trackSample.paused || coarseStalledRef.current);

        const timeGated = waitForAudioRef.current && !audioDetectedRef.current;

        // Gate video inputs alongside shader time: hold all video elements paused
        // at position 0 while gated, restart them from 0 exactly when audio starts.
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
            // Gate just unlocked: start all videos from 0 in sync with shader time
            for (const v of gatedVideoElements) {
                v.currentTime = 0;
                v.play().catch(() => {/* ignore autoplay errors */});
            }
        }
        wasTimeGatedRef.current = timeGated;

        // Editor transport pause: freeze the shader clock and hold videos where
        // they are (the audio capture keeps playing — resume is offset by design).
        // The wait-for-audio gate takes precedence: while gated its own pause
        // handling above already applies.
        const clockPaused = clockPausedRef.current && !timeGated;
        if (clockPaused) {
            for (const v of gatedVideoElements) {
                if (!v.paused) v.pause();
            }
        } else if (wasClockPausedRef.current) {
            // Unpaused: resume videos without rewinding
            for (const v of gatedVideoElements) {
                v.play().catch(() => {/* ignore autoplay errors */});
            }
        }
        wasClockPausedRef.current = clockPaused;

        const avg = avgLevel || 0.1;
        let rate = min_speed + avg / (speedDivider == 0 ? 0.1 : speedDivider);
        // Clamp to a reasonable range for HTMLVideoElement playback and GPU texture updates
        const minVideoRate = 0.25;
        const maxVideoRate = 3.0;
        rate = Math.min(Math.max(rate, minVideoRate), maxVideoRate)

        // Update the main uniforms
        const clockDelta = threeProps.clock.getDelta();
        const shaderFactor = shaderObject.metaData?.shaderSpeed ?? default_shader_factor;
        const tuniform = threeProps.tuniform;
        if (timeGated) {
            // Hold time at 0.0 until audio starts (for reproducible audio/video sync)
            tuniform.iAmplifiedTime.value = 0.0;
            tuniform.iTime.value = 0.0;
            tuniform.iTimeDelta.value = 0.0;
        } else if (clockPaused) {
            // Transport pause: freeze the clock (getDelta still consumed above)
            tuniform.iTimeDelta.value = 0.0;
        } else if (trackSynced && trackSample) {
            // Follow track position: soft-lock iTime to the media clock
            // (snap on scrubs, rate-correct small drift so sample jitter
            // doesn't visibly jump the shader).
            const target = interpolatePosition(trackSample, frameNow, trackSample.receivedAt ?? trackSample.sampledAt);
            const next = stepSyncedClock(tuniform.iTime.value, target, clockDelta, trackSample.playbackRate, trackSample.precision ?? 'exact', trackPaused);
            tuniform.iTimeDelta.value = Math.max(0, next - tuniform.iTime.value);
            tuniform.iTime.value = next;
            if (!trackPaused) {
                if (enableIAmplifiedTimeRef.current) {
                    tuniform.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
                } else {
                    // When disabled, sync with normal time so shaders still animate
                    tuniform.iAmplifiedTime.value = tuniform.iTime.value;
                }
            }
        } else {
            if (enableIAmplifiedTimeRef.current) {
                tuniform.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
            } else {
                // When disabled, sync with normal time so shaders still animate
                tuniform.iAmplifiedTime.value = tuniform.iTime.value;
            }
            tuniform.iTime.value += clockDelta;
            tuniform.iTimeDelta.value = clockDelta;
        }
        tuniform.iFrameRate.value = clockDelta > 0 ? 1.0 / clockDelta : 60.0;
        tuniform.iDate.value = getCurrentDateVector();

        // In-frame VR flag: prefer the React prop, fall back to the renderer's
        // presenting flag so a missed state update can't desync the render path.
        const xrOn = vrActive || gl.xr.isPresenting;

        // VR mode: shaders with mainVR() render per-eye; others go to the cinema screen
        if (tuniform.iVRMode) {
            tuniform.iVRMode.value = xrOn && shaderIsVR ? 1 : 0;
        }
        // Per-eye resolution for every shader while presenting (mainVR shaders
        // need it for ray/fragCoord; cinema and multipass need it for aspect/sharpness)
        if (xrOn) {
            const eye = getXrRenderSize(shaderIsVR);
            if (eye) {
                tuniform.iResolution.value.set(Math.max(1, Math.round(eye.width)), Math.max(1, Math.round(eye.height)), 1.0);
            }
        }

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
        const ov = overlayRuntimeRef.current;
        if (ov) {
            const times = ov.material.uniforms.iChannelTime.value as number[];
            for (let ch = 0; ch < 4; ch++) times[ch] = ov.channelLoadTimes[ch] > 0 ? currentTime - ov.channelLoadTimes[ch] : 0;
        }

        // Update keyboard texture (ShaderToy compatible)
        currentTimeRef.current = tuniform.iTime.value;

        for (let i = 0; i < KEYBOARD_TEXTURE_WIDTH; i++) {
            const offset = i * KEYBOARD_BYTES_PER_PIXEL;
            const currentState = keyboardStateRef.current[offset + 0];
            const previousState = keyboardPrevStateRef.current[i];

            // Clear last frame's pressed/released states (G and B components of row 0)
            keyboardStateRef.current[offset + 1] = 0;
            keyboardStateRef.current[offset + 2] = 0;

            // Detect transitions and set pressed/released for one frame
            if (currentState > 0 && previousState === 0) {
                keyboardStateRef.current[offset + 1] = 255; // just pressed (G)
                keyboardPressTimeRef.current[i] = currentTimeRef.current;
                // Flip toggle state on each press (Shadertoy compatible)
                keyboardToggleRef.current[i] = keyboardToggleRef.current[i] > 0 ? 0 : 255;
            }
            if (currentState === 0 && previousState > 0) {
                keyboardStateRef.current[offset + 2] = 255; // just released (B)
            }

            // Row 0, A component: persistent toggle state (Shadertoy compatible)
            keyboardStateRef.current[offset + 3] = keyboardToggleRef.current[i];

            // Row 1, R component: hold time (ShaderAmp extension, normalized 0.0-1.0)
            const row1Offset = (KEYBOARD_TEXTURE_WIDTH + i) * KEYBOARD_BYTES_PER_PIXEL;
            if (currentState > 0) {
                const holdTime = currentTimeRef.current - keyboardPressTimeRef.current[i];
                keyboardStateRef.current[row1Offset + 0] = Math.min(holdTime * 255, 255);
            } else {
                keyboardStateRef.current[row1Offset + 0] = 0;
            }

            // Store current state for next frame's transition detection
            keyboardPrevStateRef.current[i] = currentState;
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
            if (timeGated) {
                if (previousUniforms.iAmplifiedTime) previousUniforms.iAmplifiedTime.value = 0.0;
                if (previousUniforms.iTime) previousUniforms.iTime.value = 0.0;
                if (previousUniforms.iTimeDelta) previousUniforms.iTimeDelta.value = 0.0;
            } else if (clockPaused) {
                if (previousUniforms.iTimeDelta) previousUniforms.iTimeDelta.value = 0.0;
            } else if (trackSynced && trackSample) {
                // Mirror the track-locked clock into the fading shader
                if (previousUniforms.iTime && currentUniforms.iTime) {
                    previousUniforms.iTime.value = currentUniforms.iTime.value;
                }
                if (previousUniforms.iTimeDelta && currentUniforms.iTimeDelta) {
                    previousUniforms.iTimeDelta.value = currentUniforms.iTimeDelta.value;
                }
                if (!trackPaused) {
                    if (enableIAmplifiedTimeRef.current && previousUniforms.iAmplifiedTime && currentUniforms.iAmplifiedTime) {
                        previousUniforms.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
                    } else if (!enableIAmplifiedTimeRef.current && previousUniforms.iAmplifiedTime && currentUniforms.iTime) {
                        previousUniforms.iAmplifiedTime.value = currentUniforms.iTime.value;
                    }
                }
            } else {
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
        if (videoFollowTimeRef.current) {
            // Video inputs follow iTime: keep every video element's position on
            // the shader clock (mod duration). Rate-correct small drift, hard
            // seek on large drift; playbackRate stays 1×.
            if (!timeGated && !clockPaused && frameNow - lastVideoSyncRef.current > 250) {
                lastVideoSyncRef.current = frameNow;
                const iTime = tuniform.iTime.value;
                for (const el of [video, ...customVideoElementsRef.current]) {
                    if (!el) continue;
                    try {
                        const dur = el.duration;
                        if (!isFinite(dur) || dur <= 0 || el.seeking || el.readyState < 2) continue;
                        const target = wrapTime(iTime, dur);
                        const drift = wrappedDiff(target, el.currentTime, dur);
                        if (Math.abs(drift) > 0.3) {
                            el.currentTime = target;
                            el.playbackRate = 1;
                        } else {
                            el.playbackRate = Math.abs(drift) > 0.05 ? 1 + Math.sign(drift) * 0.1 : 1;
                        }
                        if (el.paused) el.play().catch(() => {});
                    } catch (_) { /* ignore */ }
                }
            }
        } else if (video && !timeGated && !clockPaused) {
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
        // Render multipass buffers and cubemap passes (if any) into their targets before main render
        const passBuffers = threeProps.buffers || [];
        const passCubemaps = threeProps.cubemaps || [];
        const passVolumes = threeProps.volumes || [];

        // three.js swaps in the XR camera for EVERY gl.render() while
        // xr.enabled && isPresenting — offscreen passes must run with it off.
        const xrWasEnabled = gl.xr.enabled;
        if (xrWasEnabled) gl.xr.enabled = false;
        // Buffer passes must NOT be cleared: Shadertoy leaves a buffer's previous
        // contents in place where a pass discards, and shaders rely on it
        // (e.g. N33Xz8 unpacks weights once into both ping-pong targets, then
        // discards). gl.render() would clear via autoClear, so disable it for
        // the offscreen passes; a fullscreen quad overwrites every kept pixel.
        const autoClearWas = gl.autoClear;
        gl.autoClear = false;

        // Render previous shader's buffer passes during fade transition
        // This ensures the previous multipass shader continues animating while fading out
        if (shaderFade && isTransitioning && previousBuffers && previousMatRef.current && threeProps.bufferCamera) {
            const prevTarget = gl.getRenderTarget();
            const prevReadTextures: (any|undefined)[] = previousBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
            for (let i = 0; i < previousBuffers.length; i++) {
                const br = previousBuffers[i];
                if (!br) continue;
                const u = br.material.uniforms as TUniform;
                const meta = br.channelMeta;
                const samplers = br.channelSamplers || {};
                const pre = br.preloaded;
                const setPrevCh = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any, sampler?: SamplerConfig) => {
                    if (src === 'audio') { (u[slot] as any).value = tuniform.iAudioData.value; return; }
                    if (src === 'video') { (u[slot] as any).value = tuniform.iVideo.value; return; }
                    if (src === 'keyboard') { (u[slot] as any).value = tuniform.iKeyboard.value; return; }
                    if (src === 'midi') { (u[slot] as any).value = tuniform.iMidi.value; return; }
                    let val: any;
                    const m = src && src.match(/^buffer(\d+)$/);
                    if (m) { val = prevReadTextures[parseInt(m[1], 10)]; }
                    else { val = preVal; }
                    if (val) {
                        (u[slot] as any).value = val;
                        if (!(val as any).isCubeTexture) {
                            const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : ClampToEdgeWrapping);
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
                gl.render(br.scene, threeProps.bufferCamera!);
                const tmp = br.readIndex; br.readIndex = br.writeIndex; br.writeIndex = tmp;
            }
            gl.setRenderTarget(prevTarget);
        }

        if ((passBuffers.length > 0 || passCubemaps.length > 0 || passVolumes.length > 0) && threeProps.bufferCamera) {
            // On first load, run extra warmup iterations to prime the dependency chain
            // and avoid NaN from divide-by-zero in shaders with self-referencing buffers.
            const warmupIterations = bufferWarmupRef.current;
            if (warmupIterations > 0) {
                bufferWarmupRef.current = 0;
            }
            const fallbackWrap = (shaderObject.metaData as any)?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
            const prevTarget = gl.getRenderTarget();

            // Update a pass's iChannelResolution entry from the bound texture
            const updateChannelResolution = (u: TUniform, slot: string, val: any) => {
                const chIdx = parseInt(slot.charAt(8), 10);
                const arr = (u.iChannelResolution as any)?.value;
                if (!arr || !arr[chIdx]) return;
                if ((val as any).isData3DTexture) {
                    const img = (val as any).image;
                    if (img) arr[chIdx].set(img.width || 1, img.height || 1, img.depth || 1);
                    return;
                }
                let img = (val as any).image;
                if (Array.isArray(img)) img = img[0];
                if (img && img.width) arr[chIdx].set(img.width, img.height, 1);
            };

            // Snapshot current cubemap pass read textures by letter (e.g., { A: tex })
            const snapshotCubeReads = (): Record<string, any> => {
                const cm: Record<string, any> = {};
                for (const cr of passCubemaps) cm[cr.letter] = cr.targets[cr.readIndex].texture;
                return cm;
            };

            // Volume read textures by letter. Updated in place after each volume
            // pass swaps, so consumers rendered later in the frame see the new data.
            const volReads: Record<string, any> = {};
            for (const vr of passVolumes) volReads[vr.letter] = vr.targets[vr.readIndex].texture;

            // Render all volume passes: bind channels, then render one quad per
            // z-slice into the matching layer of the 3D render target.
            // Static volumes bake once (vr.baked); dynamic ones re-bake per frame.
            const renderVolumePasses = (bufReads: (any|undefined)[], cubeReads: Record<string, any>) => {
                for (const vr of passVolumes) {
                    if (vr.isStatic && vr.baked) continue;
                    const vu = vr.material.uniforms as TUniform;
                    const vmeta = vr.channelMeta;
                    const vpre = vr.preloaded;
                    const setVolCh = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any) => {
                        if (src === 'audio') { (vu[slot] as any).value = tuniform.iAudioData.value; return; }
                        if (src === 'video') { (vu[slot] as any).value = tuniform.iVideo.value; return; }
                        if (src === 'keyboard') { (vu[slot] as any).value = tuniform.iKeyboard.value; return; }
                        if (src === 'midi') { (vu[slot] as any).value = tuniform.iMidi.value; return; }
                        let val: any;
                        const mb = src && src.match(/^buffer(\d+)$/);
                        const mc = src && src.match(/^cubemap([A-Z])$/);
                        const mv = src && src.match(/^volume([A-Z])$/);
                        if (mb) val = bufReads[parseInt(mb[1], 10)];
                        else if (mc) val = cubeReads[mc[1]];
                        else if (mv) val = volReads[mv[1]];
                        else val = preVal;
                        if (val) {
                            (vu[slot] as any).value = val;
                            updateChannelResolution(vu, slot, val);
                        }
                    };
                    setVolCh('iChannel0', vmeta.iChannel0, vpre?.iChannel0);
                    setVolCh('iChannel1', vmeta.iChannel1, vpre?.iChannel1);
                    setVolCh('iChannel2', vmeta.iChannel2, vpre?.iChannel2);
                    setVolCh('iChannel3', vmeta.iChannel3, vpre?.iChannel3);

                    const volWriteTarget = vr.targets[vr.writeIndex];
                    for (let z = 0; z < vr.resolution; z++) {
                        ((vu as any).iVolumeSlice as any).value = z + 0.5;
                        gl.setRenderTarget(volWriteTarget, z);
                        gl.render(vr.scene, threeProps.bufferCamera!);
                    }
                    vr.baked = true;
                    // Swap (no-op for single-target volumes where both indices match)
                    const vt = vr.readIndex; vr.readIndex = vr.writeIndex; vr.writeIndex = vt;
                    volReads[vr.letter] = vr.targets[vr.readIndex].texture;
                }
            };

            // Render all cubemap passes: bind channels, render 6 faces, swap targets
            const renderCubemapPasses = (bufReads: (any|undefined)[], cubeReads: Record<string, any>) => {
                for (const cr of passCubemaps) {
                    const cu = cr.material.uniforms as TUniform;
                    const cmeta = cr.channelMeta;
                    const cpre = cr.preloaded;
                    const setCubeCh = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any) => {
                        if (src === 'audio') { (cu[slot] as any).value = tuniform.iAudioData.value; return; }
                        if (src === 'video') { (cu[slot] as any).value = tuniform.iVideo.value; return; }
                        if (src === 'keyboard') { (cu[slot] as any).value = tuniform.iKeyboard.value; return; }
                        if (src === 'midi') { (cu[slot] as any).value = tuniform.iMidi.value; return; }
                        let val: any;
                        const mb = src && src.match(/^buffer(\d+)$/);
                        const mc = src && src.match(/^cubemap([A-Z])$/);
                        const mv = src && src.match(/^volume([A-Z])$/);
                        if (mb) val = bufReads[parseInt(mb[1], 10)];
                        else if (mc) val = cubeReads[mc[1]];
                        else if (mv) val = volReads[mv[1]];
                        else val = preVal;
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

            // Run warmup passes BEFORE the main buffer loop so all buffers are primed.
            // Each warmup iteration snapshots current read textures, renders all buffers
            // in dependency order, then swaps. After N passes (N = buffer count) the
            // full A→B→C chain has propagated valid data.
            for (let w = 0; w < warmupIterations; w++) {
                const warmupReadTextures: (any|undefined)[] = passBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
                renderVolumePasses(warmupReadTextures, snapshotCubeReads());
                renderCubemapPasses(warmupReadTextures, snapshotCubeReads());
                const warmupCubeReads = snapshotCubeReads();
                for (let i = 0; i < passBuffers.length; i++) {
                    const br = passBuffers[i];
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
                        const mc2 = src && src.match(/^cubemap([A-Z])$/);
                        const mv2 = src && src.match(/^volume([A-Z])$/);
                        if (m2) { val = warmupReadTextures[parseInt(m2[1], 10)]; }
                        else if (mc2) { val = warmupCubeReads[mc2[1]]; }
                        else if (mv2) { val = volReads[mv2[1]]; }
                        else { val = preVal; }
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
                    gl.render(br.scene, threeProps.bufferCamera!);
                    const tmp2 = br.readIndex; br.readIndex = br.writeIndex; br.writeIndex = tmp2;
                }
            }

            // Render volume passes first (they typically feed buffer passes),
            // then cubemap passes
            renderVolumePasses(passBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined), snapshotCubeReads());
            renderCubemapPasses(passBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined), snapshotCubeReads());
            const cubeReadTextures = snapshotCubeReads();

            // Build current read textures snapshot (after any warmup passes)
            const readTextures: (any|undefined)[] = passBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
            // For each buffer: bind its iChannels (buffer refs use readTextures), render to its write target, then swap indices
            for (let i = 0; i < passBuffers.length; i++) {
                const br = passBuffers[i];
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
                    const mc = src && src.match(/^cubemap([A-Z])$/);
                    const mv = src && src.match(/^volume([A-Z])$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else if (mc) {
                        val = cubeReadTextures[mc[1]];
                    } else if (mv) {
                        val = volReads[mv[1]];
                    } else {
                        val = preVal;
                    }
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
                    const mc = src && src.match(/^cubemap([A-Z])$/);
                    const mv = src && src.match(/^volume([A-Z])$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else if (mc) {
                        val = cubeReadTextures[mc[1]];
                    } else if (mv) {
                        val = volReads[mv[1]];
                    } else {
                        val = preVal;
                    }
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

            // restore
            gl.setRenderTarget(prevTarget);
        }

        gl.autoClear = autoClearWas;
        if (xrWasEnabled) gl.xr.enabled = true;

        // Update previous material's iChannel bindings to use its own buffer outputs during fade
        // This must happen regardless of whether the current shader has buffers
        if (shaderFade && isTransitioning && previousBuffers && previousMatRef.current) {
            const prevU = previousMatRef.current.uniforms as TUniform;
            const prevReadTextures: (any|undefined)[] = previousBuffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
            const setPrevFinal = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', idx: number) => {
                if (prevReadTextures[idx]) {
                    (prevU[slot] as any).value = prevReadTextures[idx];
                }
            };
            setPrevFinal('iChannel0', 0);
            setPrevFinal('iChannel1', 1);
            setPrevFinal('iChannel2', 2);
            setPrevFinal('iChannel3', 3);
        }

        // Shadertoy keeps iMouse.w > 0 only on the frame of the click
        if (mouseClickFrameRef.current) {
            mouseClickFrameRef.current = false;
        } else if (tuniform.iMouse.value.w > 0) {
            tuniform.iMouse.value.w = -Math.abs(tuniform.iMouse.value.w);
        }

        // Increment frame count at the very end of rendering the frame
        if (!timeGated && !clockPaused) {
            threeProps.tuniform.iFrame.value += 1;
        }
    });

    // Render mode per mesh: flat fills the viewport as today; 'vr' is a
    // per-eye ray-traced fullscreen quad (mainVR shaders); 'cinema' is a fixed
    // 4m screen in front of the viewer for 2D shaders during an XR session.
    const xrPresenting = vrActive || (gl?.xr?.isPresenting ?? false);
    const currentMode: 'flat' | 'vr' | 'cinema' = !xrPresenting ? 'flat' : (shaderIsVR ? 'vr' : 'cinema');
    const previousIsVR = !!previousMatRef.current?.fragmentShader?.includes('iVRMode');
    const previousMode: 'flat' | 'vr' | 'cinema' = !xrPresenting ? 'flat' : (previousIsVR ? 'vr' : 'cinema');

    // Changing the vertexShader prop alone doesn't recompile the program —
    // bump material.version when the render mode changes.
    useEffect(() => {
        if (matRef.current) matRef.current.needsUpdate = true;
    }, [currentMode]);

    return (
        <>
            {/* Previous shader mesh for fade out */}
            {shaderFade && isTransitioning && previousMatRef.current && (
                <mesh visible
                    key={previousMode}
                    frustumCulled={previousMode !== 'vr'}
                    position={previousMode === 'cinema' ? [0, 1.6, -3] : [0, 0, 0]}>
                    {previousMode === 'flat' ? (
                        <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
                    ) : previousMode === 'vr' ? (
                        <planeGeometry attach="geometry" args={[2, 2, 1, 1]} />
                    ) : (
                        <planeGeometry attach="geometry" args={[4, 4 / CINEMA_ASPECT, 1, 1]} />
                    )}
                    <shaderMaterial
                        attach="material"
                        uniforms={previousMatRef.current.uniforms}
                        vertexShader={previousMode === 'vr' ? VR_VERTEX_SHADER : general_purpose_vertex_shader}
                        fragmentShader={previousMatRef.current.fragmentShader}
                        side={DoubleSide}
                        transparent={true}
                        depthTest={previousMode !== 'vr'}
                        depthWrite={previousMode !== 'vr'}
                        opacity={1.0 - fadeProgress}
                    />
                </mesh>
            )}
            {/* Current shader mesh */}
            <mesh visible
                frustumCulled={currentMode !== 'vr'}
                position={currentMode === 'cinema' ? [0, 1.6, -3] : [0, 0, 0]}>
                {currentMode === 'flat' ? (
                    <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
                ) : currentMode === 'vr' ? (
                    <planeGeometry attach="geometry" args={[2, 2, 1, 1]} />
                ) : (
                    <planeGeometry attach="geometry" args={[4, 4 / CINEMA_ASPECT, 1, 1]} />
                )}
                <shaderMaterial
                    attach="material"
                    uniforms={threeProps?.tuniform}
                    vertexShader={currentMode === 'vr' ? VR_VERTEX_SHADER : general_purpose_vertex_shader}
                    side={DoubleSide}
                    transparent={shaderFade && isTransitioning}
                    depthTest={currentMode !== 'vr'}
                    depthWrite={currentMode !== 'vr'}
                    opacity={shaderFade && isTransitioning ? fadeProgress : 1.0}
                    ref={matRef} />
            </mesh>
            {/* Overlay shader mesh: single-pass transparent layer on top */}
            {overlayRuntime && (
                <mesh key={overlayRuntime.key} visible renderOrder={10} frustumCulled={false}
                    position={currentMode === 'flat' ? [0, 0, 0] : [0, 1.6, -3]}>
                    {currentMode === 'flat'
                        ? <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
                        : <planeGeometry attach="geometry" args={[4, 4 / CINEMA_ASPECT, 1, 1]} />}
                    <primitive object={overlayRuntime.material} attach="material" />
                </mesh>
            )}
        </>
    );
};
