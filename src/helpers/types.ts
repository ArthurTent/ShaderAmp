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

type ShaderMetaData = {
    author: string;
    modifiedBy: string;
    shaderName: string;
    url: string;
    license: string;
    licenseURL: string;

    // Shader properties
    shaderSpeed: number;
    description?: string;
    
    // Optional properties
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    video?: string;
    usesWebcam?: boolean;
    fftSize?: number; // FFT size for audio analysis (default: 1024)
    
    // Interactive shader parameters
    customUniforms?: ShaderUniform[];
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
}

type ShaderCatalog = {
    shaders: ShaderObject[];
    lastModified: Date;
}

type ShaderOption = {
    isHidden: boolean;
}

type ShaderOptions = { [id: string] : ShaderOption; }