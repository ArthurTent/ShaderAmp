// Types copied from ShaderAmp/src/helpers/types.ts (see plan §0).

export type TextureSampler = {
    filter: 'mipmap' | 'linear' | 'nearest';
    wrap: 'clamp' | 'repeat';
    vflip: boolean;
};

export type ShaderMetaData = {
    author: string;
    modifiedBy: string;
    shaderName: string;
    url: string;
    license: string;
    licenseURL?: string;

    shaderSpeed: number;
    description?: string;

    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    iChannel0Sampler?: TextureSampler;
    iChannel1Sampler?: TextureSampler;
    iChannel2Sampler?: TextureSampler;
    iChannel3Sampler?: TextureSampler;
    iChannel0Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    iChannel1Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    iChannel2Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    iChannel3Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    video?: string;
    usesWebcam?: boolean;
    fftSize?: number;
    useMidi?: boolean;

    customUniforms?: ShaderUniform[];

    buffers?: BufferConfig[];
    cubemaps?: string[];
    /** Shadertoy cubemap passes ("Cube A"): rendered into 1024² cube targets, read as `cubemapX`. */
    cubemapPasses?: PassConfig[];
    /** Volume passes ("Volume A"): rendered into res³ 3D targets, read as `volumeX`. */
    volumePasses?: (PassConfig & { resolution?: number })[];
    hidden?: boolean;
    vr?: boolean;
    soundShader?: string;
    /** Channel bindings of the sound pass (e.g. iChannel0: "buffer0", "keyboard"). */
    soundChannels?: {
        iChannel0?: string;
        iChannel1?: string;
        iChannel2?: string;
        iChannel3?: string;
        iChannel0Sampler?: TextureSampler;
        iChannel1Sampler?: TextureSampler;
        iChannel2Sampler?: TextureSampler;
        iChannel3Sampler?: TextureSampler;
    };
    overlay?: boolean;
};

/** Cubemap / volume pass entry (same channel keys as a buffer, identified by `letter`). */
export type PassConfig = Omit<BufferConfig, 'output'> & { letter: string };

export type BufferConfig = {
    shaderName: string;
    output: number;
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    iChannel0Sampler?: TextureSampler;
    iChannel1Sampler?: TextureSampler;
    iChannel2Sampler?: TextureSampler;
    iChannel3Sampler?: TextureSampler;
    iChannel0Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    iChannel1Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    iChannel2Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    iChannel3Type?: 'texture' | 'cubemap' | 'video' | 'volume' | 'keyboard';
    cubemaps?: string[];
};

export type ShaderUniform = {
    name: string;
    label: string;
    type: 'int' | 'float' | 'vec2' | 'vec3' | 'vec4' | 'bool';
    default: number | number[] | boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: { label: string; value: number }[];
};

export type ShaderObject = {
    shaderName: string;
    metaData: ShaderMetaData;
    inlineCode?: string;
    inlineBuffers?: { [filename: string]: string };
    inlineSound?: string;
};

export type ShaderCatalog = {
    shaders: ShaderObject[];
    lastModified: Date;
};

// Public API types (plan §4.1)

export type AudioSourceInput =
    | HTMLMediaElement
    | MediaStream
    | { node: AudioNode }
    | null;

export type ShaderInput =
    | string
    | ShaderObject
    | CustomShader;

export interface CustomShader {
    code: string;
    name?: string;
    buffers?: { code: string; output: 0 | 1 | 2 | 3; channels?: ChannelMap }[];
    channels?: ChannelMap;
    shaderSpeed?: number;
    customUniforms?: ShaderUniform[];
}

export type ChannelMap = Partial<Record<'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3', string>>;

// ---- Scene graph types (copied from ShaderAmp/src/helpers/types.ts) ----

export type SceneTriggerType = 'time' | 'beat' | 'audio' | 'manual';

export type SceneTrigger = {
    type: 'time';
    durationSeconds: number;
} | {
    type: 'beat';
    beatCount: number;
} | {
    type: 'audio';
    threshold: number;
    holdSeconds?: number;
} | {
    type: 'manual';
};

export type SceneCondition =
    | { kind: 'audio'; operator: '>' | '>=' | '<' | '<='; value: number }
    | { kind: 'time'; seconds: number }
    | { kind: 'beat'; count: number }
    | { kind: 'uniform'; shaderRef?: string; name: string; operator: '==' | '!=' | '>' | '<' | '>=' | '<='; value: any }
    | { kind: 'random'; probability: number };

export type SceneNode = {
    id: string;
    type: 'start' | 'scene' | 'uniform' | 'condition' | 'overlay';
    position: { x: number; y: number };
    data: {
        label?: string;
        shaderRef?: string;
        uniformOverrides?: Record<string, any>;
        durationSeconds?: number;
        condition?: SceneCondition;
        overlayAction?: 'show' | 'hide';
        overlayOpacity?: number;
        overlayBlendMode?: 'additive' | 'normal';
    };
};

export type OverlayBlendMode = 'additive' | 'normal';
export type OverlayState = { shader: ShaderObject; opacity: number; blendMode: OverlayBlendMode };

export type SceneEdge = {
    id: string;
    source: string;
    target: string;
    trigger: SceneTrigger;
    sourceHandle?: string;
    targetHandle?: string;
};

export type SceneTimeSource = 'auto' | 'iTime' | 'iAmplifiedTime';

export type SceneGraph = {
    id: string;
    name: string;
    isLooping: boolean;
    timeSource?: SceneTimeSource;
    timelineSeconds?: number;
    nodes: SceneNode[];
    edges: SceneEdge[];
};

export type ScenePlayMode = 'reset' | 'keep';

// ---- Imported shader + scene package manifest types ----

export interface ImportedShader {
    id: string;
    shadertoyId: string;
    name: string;
    author: string;
    description?: string;
    tags?: string[];
    importDate: string;
    previewImage?: string;
    mainShader: { filename: string; code: string; meta: ShaderMetaData };
    bufferShaders?: { filename: string; code: string; meta: ShaderMetaData }[];
    soundShader?: { filename: string; code: string; meta: ShaderMetaData };
}

export type PackagedShader =
    | { ref: string; kind: 'imported'; imported: ImportedShader; edited?: ShaderObject }
    | { ref: string; kind: 'custom'; custom: ShaderObject & { id: string } }
    | { ref: string; kind: 'builtin-edited'; shaderName: string; edited: ShaderObject };

export type CubemapFaceName = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export type PackagedMedia =
    | { ref: string; kind: 'image' | 'video'; id: string; name: string; mimeType: string; size: number; path: string }
    | { ref: string; kind: 'cubemap'; id: string; name: string; size: number; faces: Record<CubemapFaceName, string> }
    | { ref: string; kind: 'volume'; id: string; name: string; size: number; width: number; height: number; depth: number; channels: number; path: string };

export type ScenePackageManifest = {
    version: number;
    exportedAt: string;
    scene: SceneGraph;
    shaders: PackagedShader[];
    media: PackagedMedia[];
};

// ---- MIDI mapping types (copied from ShaderAmp/src/helpers/types.ts) ----

export type MidiTarget =
    | 'none'
    | 'prevShader'
    | 'nextShader'
    | 'resetTime'
    | 'randomizeBeat'
    | 'toggleRandomizeShaders'
    | 'randomizeTime'
    | 'randomizeVariation'
    | 'randomizeBeatInterval'
    | 'toggleShaderCredits'
    | 'toggleTabTitle'
    | 'toggleFps'
    | 'toggleShaderFade'
    | 'toggleWebcam'
    | 'toggleWebcamAudio'
    | 'toggleDisplayCapture'
    | 'toggleEnableIAmplifiedTime'
    | 'renderScale'
    | 'speedDivider'
    | 'volumeAmplifier'
    | 'fftInject'
    | `eqBand:${number}`
    | `uniform:${string}`
    | `selectShader:${string}`
    | 'sceneStop'
    | 'sceneTogglePause'
    | `playScene:${string}`
    | `overlay:${string}`
    | 'overlayHide';

export type MidiMappingSource = {
    type: 'cc' | 'noteon';
    channel: number;
    number: number;
    inputId?: string;
};

export type MidiMapping = {
    id: string;
    label?: string;
    source: MidiMappingSource;
    target: MidiTarget;
    min: number;
    max: number;
    encoderMode?: 'absolute' | 'relative';
    buttonMode?: 'toggle' | 'momentary';
    step?: number;
    overlayOpacity?: number;
    overlayBlendMode?: OverlayBlendMode;
};

export type MidiMappings = MidiMapping[];

export type MidiEventType = 'noteon' | 'noteoff' | 'cc';

export type MidiEvent = {
    type: MidiEventType;
    channel: number;
    number: number;
    value: number;
    inputId: string;
    inputName: string;
};

export type MidiInputInfo = {
    id: string;
    name: string;
};

export interface ShaderAmpOptions {
    container?: HTMLElement;
    canvas?: HTMLCanvasElement;
    source?: AudioSourceInput;
    shader?: ShaderInput;
    assetBaseUrl?: string;
    mediaBaseUrl?: string;
    audioContext?: AudioContext;
    connectToDestination?: boolean;
    renderScale?: number;
    maxPixelRatio?: number;
    speedDivider?: number;
    volumeAmplifier?: number;
    fade?: boolean | { duration?: number };
    videoTexture?: 'auto' | 'none' | HTMLVideoElement | string;
    mouse?: boolean;
    keyboard?: 'canvas' | 'window' | false;
    controls?: boolean | ControlsOptions;
    autoStart?: boolean;
    pauseWhenHidden?: boolean;
    scenes?: SceneGraph[];
    midi?: boolean | { mappings?: MidiMappings };
    /**
     * Drive `iTime` from the bound media element's `currentTime` (requires a
     * media-element `source`). Seeks and pauses keep the shader clock — and
     * therefore scene `time` conditions — aligned to the track. Default `false`.
     */
    trackSync?: boolean;
    /**
     * When `false`, `iAmplifiedTime` mirrors `iTime` instead of accumulating at
     * the audio-reactive rate (matches the extension's enableIAmplifiedTime=off).
     * Scene `'auto'` timeSource follows whichever clock is displayed.
     * Default `true`.
     */
    amplifiedTime?: boolean;
    /**
     * Fixed output size in pixels. Ignores the element's CSS size and
     * `maxPixelRatio` — use it for off-DOM canvases whose output is consumed
     * elsewhere (e.g. `canvas.captureStream()`). The shader renders at
     * `size × renderScale` and is upscaled; a foreground stays at full size.
     */
    size?: { width: number; height: number };
    /**
     * `'raf'` (default) renders on requestAnimationFrame. `'timer'` renders on a
     * timer at `frameRate`, which keeps running in background tabs — needed when
     * the canvas feeds a MediaStream rather than the screen.
     */
    frameLoop?: 'raf' | 'timer';
    /** Target frames per second for `frameLoop: 'timer'`. Default 30. */
    frameRate?: number;
    /**
     * Lower `renderScale` automatically while frames take too long, and raise it
     * again (up to the configured `renderScale`) when there's headroom. Resets
     * to the configured scale on every shader change. Default `false`.
     */
    adaptiveScale?: boolean | { min?: number };
    /** Composite a video over the shader output using an alpha mask. See `setForeground()`. */
    foreground?: ForegroundOptions | null;
    /**
     * Draw "shader by author" bottom-left into the rendered image (works in
     * canvas mode and ends up in `captureStream()`). Extension:
     * `state.showshadercredits`. Default `false`.
     */
    showCredits?: boolean;
    /** Draw a frames-per-second counter top-left into the image. Extension: `settings.showFps`. Default `false`. */
    showFps?: boolean;
    /**
     * 10-band EQ gains in dB (31 Hz … 16 kHz, see `EQ_FREQUENCIES`) applied to
     * the analysed signal only. Extension: `settings.eqGains`. Default all 0.
     */
    eqGains?: number[];
    /**
     * Run a shader's sound pass (`metaData.soundShader` / `inlineSound`,
     * Shadertoy "Sound" tab) on the GPU. Its output feeds the analyser.
     * Extension: `settings.soundBuffer`. Default `true`.
     */
    soundBuffer?: boolean;
    /** Also play the sound pass through the speakers. Default `true`. */
    soundOutput?: boolean;
    /**
     * Hold iTime/iAmplifiedTime at 0 until the audio level stays above a small
     * threshold for 3 frames. Extension: `settings.waitForAudioStart`. Default `false`.
     */
    waitForAudio?: boolean;
    /**
     * Keep the iVideo element's position on iTime (mod duration) instead of
     * scaling its playback rate with the audio. Extension: `settings.videoFollowTime`.
     * Default `false`.
     */
    videoFollowTime?: boolean;
}

/** Options that `ShaderAmp.setOptions()` can change at runtime. */
export type LiveOptions = Partial<
    Pick<
        ShaderAmpOptions,
        | 'renderScale'
        | 'speedDivider'
        | 'volumeAmplifier'
        | 'fade'
        | 'maxPixelRatio'
        | 'trackSync'
        | 'amplifiedTime'
        | 'videoTexture'
        | 'showCredits'
        | 'showFps'
        | 'eqGains'
        | 'soundBuffer'
        | 'soundOutput'
        | 'waitForAudio'
        | 'videoFollowTime'
    >
>;

export interface ForegroundOptions {
    /** Foreground video (e.g. a webcam). Drawn "cover"-fitted over the shader. */
    video: HTMLVideoElement;
    /**
     * Mask values mapped to opacity via smoothstep(edge[0], edge[1], mask).
     * Default [0.35, 0.65].
     */
    edge?: [number, number];
    /** Mirror the foreground horizontally. Default false. */
    mirror?: boolean;
}

export interface ControlsOptions {
    pip?: boolean;
    fullscreen?: boolean;
    navigation?: boolean;
    credits?: boolean;
}

export interface ShaderAmpEvents {
    ready: void;
    shaderchange: { shader: ShaderObject };
    beat: { energy: number };
    error: { error: Error; phase: 'audio' | 'shader' | 'webgl' | 'pip' | 'scene' | 'midi' };
    pipenter: { mode: 'document' | 'video' };
    pipexit: void;
    scenechange: { scene: SceneGraph | null; playing: boolean };
    scenenode: { scene: SceneGraph; node: SceneNode };
    /**
     * Every rendered frame: the shader clock and scene inputs, so a host can
     * drive an external scene controller (e.g. the extension's virtual camera).
     * `time` is the displayed clock (iAmplifiedTime with amplifiedTime on, else
     * iTime); `level` is the time-domain RMS (0–128) used by audio triggers;
     * `gateOpened` is true on the frame the wait-for-audio gate opened.
     */
    clock: { time: number; iTime: number; iAmplifiedTime: number; level: number; gateOpened: boolean };
    midievent: MidiEvent;
}
