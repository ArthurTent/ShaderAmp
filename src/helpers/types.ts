type RenderTarget = 'tab' | 'sidepanel';

type TabInfo = {
    sourceTabId: number;
    // Only set when kind is 'tab'. Undefined for side-panel sessions.
    contentTabId?: number;
    // undefined means 'tab' for mappings stored before render targets existed
    kind?: RenderTarget;
    // Window the side panel was opened in (kind 'sidepanel')
    windowId?: number;
    stream?: string | null
}

type TabMapping = {
    [key: number]: TabInfo
}

type OptionsTab = {
    tabId: number;
    contentTabId?: number | undefined;
};

type AppState = {
    optionsTab: OptionsTab;
} 

/*
    "author": "knarkowicz",
    "modifiedBy": "ArthurTent",
    "shaderName": "[SH17A] Funky Disco Ball",
    "url": "https://www.shadertoy.com/view/wd3XzS",
    "license": "Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License",
    "licenseURL": "https://creativecommons.org/licenses/by-nc-sa/3.0/",
    "shaderSpeed": 0.5,
    "iChannel0": "images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg"
*/

type TextureSampler = {
    filter: 'mipmap' | 'linear' | 'nearest';
    wrap: 'clamp' | 'repeat';
    vflip: boolean;
}

type ShaderMetaData = {
    author: string;
    modifiedBy: string;
    shaderName: string;
    url: string;
    license: string;
    licenseURL?: string;

    // Shader properties
    shaderSpeed: number;
    description?: string;
    
    // Optional properties
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
    fftSize?: number; // FFT size for audio analysis (default: 1024)
    useMidi?: boolean; // Whether to expose iMidi texture uniform
    
    // Interactive shader parameters
    customUniforms?: ShaderUniform[];
    
    // Multipass buffer configuration
    buffers?: BufferConfig[];
    cubemaps?: string[];
    // Shadertoy-style cubemap render pass configuration (Cube A)
    cubemapPasses?: any[];
    volumePasses?: any[];
    hidden?: boolean;
    // Set when the shader defines Shadertoy's mainVR() entrypoint (WebXR ready)
    vr?: boolean;
    // Filename of the generated sound pass shader (Shadertoy sound tab)
    soundShader?: string;
    // Default 'overlay' flag for bundled shaders (usable in overlay scene nodes)
    overlay?: boolean;
}

// Buffer configuration for multipass shaders loaded from Shadertoy
type BufferConfig = {
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
}

// Custom uniform definition
type ShaderUniform = {
    name: string;          // Uniform name in shader (e.g., "iCubeType")
    label: string;         // Display label in UI (e.g., "Cube Type")
    type: 'int' | 'float' | 'vec2' | 'vec3' | 'vec4' | 'bool';
    default: number | number[] | boolean;
    min?: number;          // For int/float
    max?: number;          // For int/float
    step?: number;         // For int/float
    options?: { label: string; value: number }[]; // For select dropdown
}

type ShaderObject = {
    shaderName: string;
    metaData: ShaderMetaData;
    // Inline shader code (for dynamically loaded shaders from Shadertoy)
    inlineCode?: string;
    // Inline buffer shader codes (keyed by buffer filename)
    inlineBuffers?: { [filename: string]: string };
    // Inline sound pass shader code (Shadertoy sound tab)
    inlineSound?: string;
}

type ShaderCatalog = {
    shaders: ShaderObject[];
    lastModified: Date;
}

type ShaderOption = {
    isHidden: boolean;
    isOverlay?: boolean;
}

type ShaderOptions = { [id: string] : ShaderOption; }

// Imported shader from Shadertoy for persistence
interface ImportedShader {
    id: string;                    // Unique ID (shadertoy ID + timestamp)
    shadertoyId: string;           // Original Shadertoy ID
    name: string;                  // Shader name
    author: string;                // Original author
    description?: string;          // Shader description
    tags?: string[];               // Tags from Shadertoy
    importDate: string;            // ISO date string
    previewImage?: string;         // Base64 encoded preview image or URL
    
    // Shader content
    mainShader: {
        filename: string;
        code: string;
        meta: ShaderMetaData;
    };
    bufferShaders?: {
        filename: string;
        code: string;
        meta: ShaderMetaData;
    }[];
    soundShader?: {
        filename: string;
        code: string;
        meta: ShaderMetaData;
    };
}

interface ImportedShadersStorage {
    shaders: ImportedShader[];
    lastModified: string;
}

// MIDI mapping target: either a named action, shader uniform reference, or shader selection
type MidiTarget =
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

type MidiMappingSource = {
    type: 'cc' | 'noteon';
    channel: number;
    number: number;
    inputId?: string;
};

type MidiMapping = {
    id: string;
    label?: string;
    source: MidiMappingSource;
    target: MidiTarget;
    min: number;
    max: number;
    encoderMode?: 'absolute' | 'relative';
    buttonMode?: 'toggle' | 'momentary';
    step?: number;
    overlayOpacity?: number;             // overlay targets: max opacity 0..1 (default 1)
    overlayBlendMode?: OverlayBlendMode; // overlay targets (default 'additive')
};

type MidiMappings = MidiMapping[];

// Joystick mapping target: same actions as MIDI
type JoystickTarget =
    | 'prevShader'
    | 'nextShader'
    | 'resetTime'
    | 'randomizeBeat'
    | 'speedDivider'
    | 'volumeAmplifier'
    | 'fftInject'
    | 'mouseX'
    | 'mouseY'
    | 'mouseButton'
    | `uniform:${string}`
    | `selectShader:${string}`
    | 'sceneStop'
    | 'sceneTogglePause'
    | `playScene:${string}`
    | `overlay:${string}`
    | 'overlayHide';

type JoystickMappingSource = {
    type: 'axis' | 'button';
    gamepadIndex: number;
    index: number;
    gamepadId?: string;
};

type JoystickMapping = {
    id: string;
    label?: string;
    source: JoystickMappingSource;
    target: JoystickTarget;
    min: number;
    max: number;
    buttonMode?: 'toggle' | 'momentary';
    overlayOpacity?: number;             // overlay targets: max opacity 0..1 (default 1)
    overlayBlendMode?: OverlayBlendMode; // overlay targets (default 'additive')
};

type JoystickMappings = JoystickMapping[];

// Scene graph types for the scriptable shader switch editor
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

// Condition node predicates for if/else branching
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
        // For scene nodes: which shader to load (built-in shaderName, imported id, or custom id)
        shaderRef?: string;
        // Override values for the shader's custom uniforms
        uniformOverrides?: Record<string, any>;
        // For scene nodes: auto-advance to the first outgoing edge after this many seconds
        durationSeconds?: number;
        // For condition nodes: the predicate to evaluate
        condition?: SceneCondition;
        // For overlay nodes
        overlayAction?: 'show' | 'hide';           // default 'show'
        overlayOpacity?: number;                   // 0..1, default 1
        overlayBlendMode?: 'additive' | 'normal';  // default 'additive'
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

// Which shader clock drives a scene's time conditions:
//   'auto' (default) = whatever the renderer displays (iAmplifiedTime when enabled, else iTime)
//   'iTime'          = real shader seconds regardless of amplification
//   'iAmplifiedTime' = audio-amplified clock
export type SceneTimeSource = 'auto' | 'iTime' | 'iAmplifiedTime';

export type SceneGraph = {
    id: string;
    name: string;
    isLooping: boolean;
    timeSource?: SceneTimeSource;
    // Length of the transport timeline in the scene editor (default 180s, min 10s)
    timelineSeconds?: number;
    nodes: SceneNode[];
    edges: SceneEdge[];
};

// Export all types
export type {
    RenderTarget,
    TabInfo,
    TabMapping,
    OptionsTab,
    AppState,
    TextureSampler,
    ShaderMetaData,
    BufferConfig,
    ShaderUniform,
    ShaderObject,
    ShaderCatalog,
    ShaderOption,
    ShaderOptions,
    ImportedShader,
    ImportedShadersStorage,
    MidiTarget,
    MidiMappingSource,
    MidiMapping,
    MidiMappings,
    JoystickTarget,
    JoystickMappingSource,
    JoystickMapping,
    JoystickMappings
};