type TabInfo = {
    sourceTabId: number;
    contentTabId: number;
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
    hidden?: boolean;
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
}

type ShaderCatalog = {
    shaders: ShaderObject[];
    lastModified: Date;
}

type ShaderOption = {
    isHidden: boolean;
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
}

interface ImportedShadersStorage {
    shaders: ImportedShader[];
    lastModified: string;
}

// MIDI mapping target: either a named action, shader uniform reference, or shader selection
type MidiTarget =
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
    | 'renderScale'
    | 'speedDivider'
    | 'volumeAmplifier'
    | 'fftInject'
    | `uniform:${string}`
    | `selectShader:${string}`;

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
    | `selectShader:${string}`;

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
};

type JoystickMappings = JoystickMapping[];

// Export all types
export type {
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