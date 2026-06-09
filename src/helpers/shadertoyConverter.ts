/**
 * Shadertoy to ShaderAmp Converter
 * 
 * Converts shaders from Shadertoy API format to ShaderAmp format.
 * Ported from shadertoy_to_shaderamp.py
 */

import { mapShadertoyTexture, isShadertoyMediaPath, isVolumeTextureHash } from './shadertoyAssetMapping';
import { downloadShaderAssets, isShadertoyExternalAsset } from './shadertoyAssetDownloader';

// ShaderAmp uniform header template - base uniforms without iChannel declarations
const SHADERAMP_UNIFORMS_BASE = `uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform float iSampleRate;

varying vec2 vUv;
`;

// Channel type definitions for cubemap and volume support
export type ChannelType = 'texture' | 'cubemap' | 'volume';

export interface ChannelTypes {
    iChannel0?: ChannelType;
    iChannel1?: ChannelType;
    iChannel2?: ChannelType;
    iChannel3?: ChannelType;
}

/**
 * Generate iChannel uniform declarations based on channel types
 * Uses samplerCube for cubemaps, sampler3D for volume textures, sampler2D for textures
 * Skips channels already replaced by iAudioData
 */
function generateChannelUniforms(channelTypes: ChannelTypes, skipChannels: Set<number> = new Set()): string {
    const lines: string[] = [];
    for (let i = 0; i < 4; i++) {
        if (skipChannels.has(i)) continue;
        const channelKey = `iChannel${i}` as keyof ChannelTypes;
        const type = channelTypes[channelKey] || 'texture';
        let samplerType: string;
        if (type === 'cubemap') samplerType = 'samplerCube';
        else if (type === 'volume') samplerType = 'highp sampler3D';
        else samplerType = 'sampler2D';
        lines.push(`uniform ${samplerType} iChannel${i};`);
    }
    return lines.join('\n');
}

/**
 * Generate full ShaderAmp uniforms header with correct channel types
 * Only audioChannel is omitted from iChannelN declarations (replaced by iAudioData)
 * Keyboard channels are also omitted (replaced by iKeyboard)
 * Video channels keep their iChannelN declaration
 */
function generateShaderAmpUniforms(channelTypes: ChannelTypes, audioChannel: number | null = null, _videoChannel: number | null = null, keyboardChannel: number | null = null): string {
    const skipChannels = new Set<number>();
    if (audioChannel !== null) skipChannels.add(audioChannel);
    if (keyboardChannel !== null) skipChannels.add(keyboardChannel);
    return SHADERAMP_UNIFORMS_BASE + generateChannelUniforms(channelTypes, skipChannels) + '\n';
}

// Main wrapper that converts vUv to fragCoord and calls mainImage
const SHADERAMP_MAIN_WRAPPER = `
void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
`;

// Shadertoy API response types
export interface ShadertoyInput {
    id: string;
    channel: number;
    type: string;
    filepath?: string;
    sampler?: {
        filter?: string;
        wrap?: string;
        vflip?: string;
        srgb?: string;
        internal?: string;
    };
}

export interface ShadertoyOutput {
    id: string;
    channel: number;
}

export interface ShadertoyRenderPass {
    inputs: ShadertoyInput[];
    outputs: ShadertoyOutput[];
    code: string;
    name: string;
    description: string;
    type: string; // "image", "buffer", "common", "sound", "cubemap"
}

export interface ShadertoyInfo {
    id: string;
    date: string;
    viewed: number;
    name: string;
    username: string;
    description: string;
    likes: number;
    published: number;
    flags: number;
    usePreview: number;
    tags: string[];
    hasliked: number;
    parentid: string;
    parentname: string;
}

export interface ShadertoyShader {
    ver: string;
    info: ShadertoyInfo;
    renderpass: ShadertoyRenderPass[];
}

// ShaderAmp output types
export interface SamplerConfig {
    filter: 'mipmap' | 'linear' | 'nearest';
    wrap: 'clamp' | 'repeat';
    vflip: boolean;
}

export interface ShaderAmpMeta {
    author: string;
    modifiedBy: string;
    shaderName: string;
    url: string;
    license: string;
    licenseURL?: string;
    shaderSpeed: number;
    description?: string;
    tab?: string[];
    buffers?: BufferConfig[];
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    iChannel0Type?: 'texture' | 'cubemap';
    iChannel1Type?: 'texture' | 'cubemap';
    iChannel2Type?: 'texture' | 'cubemap';
    iChannel3Type?: 'texture' | 'cubemap';
    iChannel0Sampler?: SamplerConfig;
    iChannel1Sampler?: SamplerConfig;
    iChannel2Sampler?: SamplerConfig;
    iChannel3Sampler?: SamplerConfig;
    textureWrap?: string;
    hidden?: boolean;
}

export interface BufferConfig {
    shaderName: string;
    output: number;
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    iChannel0Sampler?: SamplerConfig;
    iChannel1Sampler?: SamplerConfig;
    iChannel2Sampler?: SamplerConfig;
    iChannel3Sampler?: SamplerConfig;
    cubemaps?: string[];
}

export interface ConvertedShader {
    filename: string;
    code: string;
    meta: ShaderAmpMeta;
}

export interface ConversionResult {
    mainShader: ConvertedShader;
    bufferShaders: ConvertedShader[];
    success: boolean;
    error?: string;
}

/**
 * Sanitize shader name to create a valid filename
 */
export function sanitizeFilename(name: string): string {
    // Remove or replace invalid characters
    let sanitized = name.replace(/[<>:"/\\|?*]/g, '');
    // Replace spaces with nothing
    sanitized = sanitized.replace(/\s+/g, '');
    // Remove leading/trailing whitespace
    sanitized = sanitized.trim();
    // Ensure it's not empty
    if (!sanitized) {
        sanitized = "UnnamedShader";
    }
    return sanitized;
}

/**
 * Detect which channel is used for audio input (music, musicstream, or microphone)
 */
function detectAudioChannel(inputs: ShadertoyInput[]): number | null {
    for (const inp of inputs) {
        if (["music", "musicstream", "microphone"].includes(inp.type)) {
            return inp.channel ?? 0;
        }
    }
    return null;
}

/**
 * Detect which channel is used for microphone input specifically
 */
function detectMicrophoneChannel(inputs: ShadertoyInput[]): number | null {
    for (const inp of inputs) {
        if (inp.type === "microphone") {
            return inp.channel ?? 0;
        }
    }
    return null;
}

/**
 * Detect which channel is used for video input
 */
function detectVideoChannel(inputs: ShadertoyInput[]): number | null {
    for (const inp of inputs) {
        if (inp.type === "video") {
            return inp.channel ?? 0;
        }
    }
    return null;
}

/**
 * Detect which channel is used for keyboard input
 */
function detectKeyboardChannel(inputs: ShadertoyInput[]): number | null {
    for (const inp of inputs) {
        if (inp.type === "keyboard") {
            return inp.channel ?? 0;
        }
    }
    return null;
}

/**
 * Get texture/video inputs with their channel numbers
 */
function getTextureInputs(inputs: ShadertoyInput[]): Map<number, ShadertoyInput> {
    const textures = new Map<number, ShadertoyInput>();
    for (const inp of inputs) {
        if (["texture", "cubemap", "video", "volume"].includes(inp.type)) {
            const channel = inp.channel ?? 0;
            textures.set(channel, inp);
        }
    }
    return textures;
}

/**
 * Extract channel types (texture, cubemap, volume) from inputs
 */
function getChannelTypes(inputs: ShadertoyInput[]): ChannelTypes {
    const channelTypes: ChannelTypes = {};
    for (const inp of inputs) {
        const channel = inp.channel ?? 0;
        const key = `iChannel${channel}` as keyof ChannelTypes;
        if (inp.type === "cubemap") {
            channelTypes[key] = 'cubemap';
            console.log(`[ShaderAmp] Cubemap detected on channel ${channel}`);
        } else if (inp.type === "volume") {
            channelTypes[key] = 'volume';
            console.log(`[ShaderAmp] Volume texture detected on channel ${channel}`);
        }
    }
    return channelTypes;
}

/**
 * Replace audio channel references with iAudioData
 */
function replaceAudioChannel(code: string, audioChannel: number | null): string {
    if (audioChannel === null) {
        return code;
    }
    
    const channelName = `iChannel${audioChannel}`;
    
    // Replace all GLSL texture sampling calls for the audio channel
    const audioSamplers = ['texture', 'texelFetch', 'textureLod', 'textureGrad', 'textureProjLod', 'textureLodOffset'];
    for (const fn of audioSamplers) {
        code = code.replace(
            new RegExp(`\\b${fn}\\s*\\(\\s*${channelName}\\s*,`, 'g'),
            `${fn}(iAudioData,`
        );
    }
    
    // Replace any remaining bare iChannelN references (e.g. passed as sampler2D arguments)
    // These are left after the uniform declaration is stripped from the header
    code = code.replace(new RegExp(`\\b${channelName}\\b`, 'g'), 'iAudioData');
    
    return code;
}

/**
 * Video channels are kept as iChannelN — no renaming needed.
 * Shadertoy video inputs are stored in metadata with iChannelNType='video'
 * and loaded as VideoTexture at runtime by AnalyzerMesh.
 */
function replaceVideoChannel(code: string, _videoChannel: number | null): string {
    return code;
}

/**
 * Replace keyboard channel references with iKeyboard
 * Keyboard uses sampler2D and is handled by the existing iKeyboard uniform system
 */
function replaceKeyboardChannel(code: string, keyboardChannel: number | null): string {
    if (keyboardChannel === null) {
        return code;
    }

    const channelName = `iChannel${keyboardChannel}`;

    // Replace all GLSL texture sampling calls for the keyboard channel
    const keyboardSamplers = ['texture', 'texelFetch', 'textureLod', 'textureGrad', 'textureProjLod', 'textureLodOffset'];

    for (const sampler of keyboardSamplers) {
        // Match: sampler(iChannelN, ...) -> sampler(iKeyboard, ...)
        const pattern = new RegExp(`\\b${sampler}\\s*\\(\\s*${channelName}\\b`, 'g');
        code = code.replace(pattern, `${sampler}(iKeyboard`);
    }

    return code;
}

/**
 * Convert HLSL-style syntax to GLSL
 * Handles common HLSL types and functions that aren't in standard GLSL
 */
function convertHLSLtoGLSL(code: string): string {
    // Convert HLSL vector types to GLSL (float2/3/4 -> vec2/3/4, int2/3/4 -> ivec2/3/4, etc.)
    // Use word boundaries to avoid replacing inside other identifiers
    code = code.replace(/\bfloat2\b/g, 'vec2');
    code = code.replace(/\bfloat3\b/g, 'vec3');
    code = code.replace(/\bfloat4\b/g, 'vec4');
    code = code.replace(/\bint2\b/g, 'ivec2');
    code = code.replace(/\bint3\b/g, 'ivec3');
    code = code.replace(/\bint4\b/g, 'ivec4');
    code = code.replace(/\buint2\b/g, 'uvec2');
    code = code.replace(/\buint3\b/g, 'uvec3');
    code = code.replace(/\buint4\b/g, 'uvec4');
    code = code.replace(/\bbool2\b/g, 'bvec2');
    code = code.replace(/\bbool3\b/g, 'bvec3');
    code = code.replace(/\bbool4\b/g, 'bvec4');
    
    // Convert HLSL matrix types (float2x2 -> mat2, float3x3 -> mat3, float4x4 -> mat4)
    code = code.replace(/\bfloat2x2\b/g, 'mat2');
    code = code.replace(/\bfloat3x3\b/g, 'mat3');
    code = code.replace(/\bfloat4x4\b/g, 'mat4');
    
    // HLSL's saturate(x) is equivalent to GLSL's clamp(x, 0.0, 1.0)
    // First, remove any #define saturate(...) macros since we'll inline the calls directly
    // Match: #define saturate(x) ... (entire line)
    code = code.replace(/^\s*#define\s+saturate\s*\([^)]*\)[^\n]*/gm, 
        '// saturate macro removed by ShaderAmp converter (saturate calls are inlined)');
    
    // Remove any user-defined saturate function definitions since we'll inline the calls
    // Match any return type: float/vec2/vec3/vec4 saturate(...)  { ... }
    code = code.replace(/\b(?:float|vec2|vec3|vec4)\s+saturate\s*\([^)]*\)\s*\{[^}]*\}/g, 
        '// saturate function inlined by ShaderAmp converter');
    
    // Also handle forward declarations: float/vec2/vec3/vec4 saturate(...);
    code = code.replace(/\b(?:float|vec2|vec3|vec4)\s+saturate\s*\([^)]*\)\s*;/g, 
        '// saturate declaration removed by ShaderAmp converter');
    
    // Now replace saturate function calls with clamp
    // Match saturate( followed by balanced content and closing )
    // This handles nested parentheses up to 2 levels deep
    code = code.replace(/\bsaturate\s*\(\s*([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*)\s*\)/g, 
        'clamp($1, 0.0, 1.0)');
    
    // HLSL's lerp is GLSL's mix
    code = code.replace(/\blerp\s*\(/g, 'mix(');
    
    // HLSL's frac is GLSL's fract
    code = code.replace(/\bfrac\s*\(/g, 'fract(');
    
    // HLSL's rsqrt is 1.0/sqrt in GLSL (or inversesqrt)
    code = code.replace(/\brsqrt\s*\(/g, 'inversesqrt(');
    
    // HLSL's ddx/ddy are GLSL's dFdx/dFdy
    code = code.replace(/\bddx\s*\(/g, 'dFdx(');
    code = code.replace(/\bddy\s*\(/g, 'dFdy(');
    
    // HLSL's atan2(y,x) is GLSL's atan(y,x) - same signature, just different name
    code = code.replace(/\batan2\s*\(/g, 'atan(');
    
    return code;
}

/**
 * Process iAmplifiedTime transformations for ShaderAmp imports
 * - Removes local iAmplifiedTime variable declarations (to avoid conflict with uniform)
 * - Removes iAmplifiedTime assignments (since ShaderAmp provides the uniform value)
 * - Replaces iTime with iAmplifiedTime (only if shader doesn't already use iAmplifiedTime)
 */
export function processIAmplifiedTimeTransform(code: string): string {
    let processed = code;
    
    // Check if shader already has a local iAmplifiedTime variable definition
    const hasLocalIAmplifiedTime = /\b(float|vec2|vec3|vec4|int|double)\s+iAmplifiedTime\b/.test(code);
    
    // Step 1: Always remove local iAmplifiedTime declarations to avoid uniform redefinition
    // Match: type iAmplifiedTime; or type iAmplifiedTime = value;
    const declarationPattern = /\b(float|vec2|vec3|vec4|int|double)\s+iAmplifiedTime\b[^;]*;\s*\n?/g;
    processed = processed.replace(declarationPattern, '');
    
    // Step 2: Always remove iAmplifiedTime assignments (simple and compound)
    // Match: iAmplifiedTime = ...; iAmplifiedTime += ...; iAmplifiedTime -= ...; etc.
    const assignmentPattern = /\biAmplifiedTime\s*([+\-*\/]?=)\s*[^;]+;\s*\n?/g;
    processed = processed.replace(assignmentPattern, '');
    
    // Step 3: Only replace iTime with iAmplifiedTime if shader didn't have local iAmplifiedTime
    // This avoids changing shaders that were already adapted for ShaderAmp
    if (!hasLocalIAmplifiedTime) {
        const iTimePattern = /\biTime\b/g;
        processed = processed.replace(iTimePattern, 'iAmplifiedTime');
    }
    
    return processed;
}

/**
 * Process shader code and wrap it for ShaderAmp
 */
function processShaderCode(
    code: string, 
    commonCode: string, 
    audioChannel: number | null,
    videoChannel: number | null = null,
    isBuffer: boolean = false,
    channelTypes: ChannelTypes = {},
    useIAmplifiedTime: boolean = false,
    keyboardChannel: number | null = null
): string {
    let processedCode = code;
    let processedCommon = commonCode;
    
    // Apply iAmplifiedTime transformation if enabled (before HLSL conversion)
    if (useIAmplifiedTime) {
        processedCode = processIAmplifiedTimeTransform(processedCode);
        processedCommon = processIAmplifiedTimeTransform(processedCommon);
    }
    
    // Convert HLSL syntax to GLSL first
    processedCode = convertHLSLtoGLSL(processedCode);
    
    // Replace audio channel references
    processedCode = replaceAudioChannel(processedCode, audioChannel);

    // Replace video channel references
    processedCode = replaceVideoChannel(processedCode, videoChannel);

    // Replace keyboard channel references
    processedCode = replaceKeyboardChannel(processedCode, keyboardChannel);

    // Also process common code if present
    if (commonCode) {
        processedCommon = convertHLSLtoGLSL(processedCommon);
        processedCommon = replaceAudioChannel(processedCommon, audioChannel);
        processedCommon = replaceVideoChannel(processedCommon, videoChannel);
        processedCommon = replaceKeyboardChannel(processedCommon, keyboardChannel);
    }
    
    // Helper to strip comments for accurate function detection
    const stripComments = (code: string): string => {
        // Remove single-line comments (// ...)
        let result = code.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments (/* ... */)
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        return result;
    };
    
    const codeWithoutComments = stripComments(processedCode);
    
    // Check if mainImage function exists (after stripping comments)
    const hasMainImage = /\bvoid\s+mainImage\s*\(/.test(codeWithoutComments);
    
    // Check if main() already exists (after stripping comments)
    const hasMain = /\bvoid\s+main\s*\(\s*\)/.test(codeWithoutComments);
    
    // Build the final shader code
    const parts: string[] = [];
    
    // Add ShaderAmp uniforms at the top (with correct channel types for cubemap support)
    // Skip iChannelN declarations for audio/keyboard channels (replaced by iAudioData/iKeyboard)
    // Video channels keep their iChannelN declaration
    parts.push(generateShaderAmpUniforms(channelTypes, audioChannel, videoChannel, keyboardChannel));
    
    // Add common code if present
    if (processedCommon) {
        parts.push("\n// === Common Code ===\n");
        parts.push(processedCommon.trim());
        parts.push("\n// === End Common Code ===\n\n");
    }
    
    // Add the processed shader code
    parts.push(processedCode.trim());
    
    // Add main() wrapper if mainImage exists and main() doesn't
    if (hasMainImage && !hasMain) {
        parts.push(SHADERAMP_MAIN_WRAPPER);
    } else if (!hasMainImage && !hasMain) {
        // No mainImage and no main - add a simple main() that outputs black
        parts.push(`
void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`);
    }
    
    return parts.join("\n");
}

/**
 * Create credits header for shader file
 */
function createCreditsHeader(
    shaderId: string,
    shaderName: string,
    username: string,
    bufferName?: string
): string {
    const nameSuffix = bufferName ? ` - ${bufferName}` : '';
    return `// https://www.shadertoy.com/view/${shaderId}
// Modified by ShaderAmp Converter
// Created by ${username}
// Original Shader Name: ${shaderName}${nameSuffix}
// License: Please check the original shader's license at https://www.shadertoy.com/view/${shaderId}

`;
}

/**
 * Create meta file content for main shader
 */
function createMainMeta(
    shaderInfo: ShadertoyInfo,
    bufferConfig: BufferConfig[],
    mainChannelRefs: Map<number, string>,
    textures: Map<number, ShadertoyInput>,
    audioChannel: number | null,
    channelTypes: ChannelTypes = {},
    assetUrlMapping: Map<string, string> = new Map()
): ShaderAmpMeta {
    const meta: ShaderAmpMeta = {
        author: shaderInfo.username || "Unknown",
        modifiedBy: "ShaderAmp Converter",
        shaderName: shaderInfo.name || "Unnamed Shader",
        url: `https://www.shadertoy.com/view/${shaderInfo.id}`,
        license: `Please check the original shader license at https://www.shadertoy.com/view/${shaderInfo.id}`,
        shaderSpeed: 0.4,
    };
    
    // Add description if present
    if (shaderInfo.description) {
        meta.description = shaderInfo.description;
    }
    
    // Add tags
    if (shaderInfo.tags && shaderInfo.tags.length > 0) {
        meta.tab = ["Converted from Shadertoy"];
    }
    
    // Add buffer configuration for multipass shaders
    if (bufferConfig.length > 0) {
        meta.buffers = bufferConfig;
    }
    
    // Add main shader's buffer/cubemap channel references
    mainChannelRefs.forEach((ref, channel) => {
        (meta as any)[`iChannel${channel}`] = ref;
        // Set type for cubemap pass references
        if (ref.startsWith('cubemap')) {
            (meta as any)[`iChannel${channel}Type`] = 'cubemap';
        }
    });
    
    // Add texture/video references and per-channel sampler settings (skip audio channel)
    textures.forEach((texInfo, channel) => {
        if (channel === audioChannel) return;
        // Skip if this channel is already a cubemap pass reference
        if (mainChannelRefs.has(channel) && mainChannelRefs.get(channel)?.startsWith('cubemap')) return;
        const filepath = texInfo.filepath || "";
        const isCubemap = texInfo.type === 'cubemap';
        const isVideo = texInfo.type === 'video';
        if (isVideo) {
            // Check if we have a downloaded asset for this video
            if (assetUrlMapping.has(filepath)) {
                (meta as any)[`iChannel${channel}`] = assetUrlMapping.get(filepath);
                console.log(`[ShaderAmp] Using downloaded video for channel ${channel}: ${assetUrlMapping.get(filepath)}`);
            } else {
                // Video channels keep their iChannelN name; mark type so runtime loads VideoTexture
                (meta as any)[`iChannel${channel}Type`] = 'video';
                // Store filepath as the channel value (runtime will use fallback video)
                (meta as any)[`iChannel${channel}`] = filepath || 'video';
            }
        } else if (filepath) {
            // Check if we have a downloaded asset for this texture/cubemap
            if (assetUrlMapping.has(filepath)) {
                (meta as any)[`iChannel${channel}`] = assetUrlMapping.get(filepath);
                if (isCubemap) {
                    (meta as any)[`iChannel${channel}Type`] = 'cubemap';
                }
                console.log(`[ShaderAmp] Using downloaded asset for channel ${channel}: ${assetUrlMapping.get(filepath)}`);
            } else {
                // Check if this is a known volume texture
                const hashMatch = filepath.match(/\/media\/a\/([a-f0-9]+)\.[a-z]+$/i);
                const hash = hashMatch ? hashMatch[1] : null;
                if (hash && isVolumeTextureHash(hash)) {
                    // Volume texture - use procedurally generated noise
                    (meta as any)[`iChannel${channel}Type`] = 'volume';
                    (meta as any)[`iChannel${channel}`] = hash === 'fa9a1bb94a81f5abf54b477622351077450bf9399ea8343e7979fa8f34f947c' ? 'rgbaNoise3D' : 'greyNoise3D';
                } else if (isShadertoyMediaPath(filepath)) {
                    // Use asset mapping for Shadertoy media paths
                    (meta as any)[`iChannel${channel}`] = mapShadertoyTexture(filepath, isCubemap);
                } else {
                    // Keep original filename for non-Shadertoy paths
                    const filename = filepath.split('/').pop() || "";
                    (meta as any)[`iChannel${channel}`] = isCubemap ? `images/cubemaps/${filename.replace(/\.[^.]+$/, '')}` : `images/${filename}`;
                }
            }
        }
        // Write per-channel sampler settings
        if (texInfo.sampler) {
            const s = texInfo.sampler;
            const sampler: SamplerConfig = {
                filter: (s.filter === 'mipmap' || s.filter === 'linear' || s.filter === 'nearest') ? s.filter : 'linear',
                wrap: s.wrap === 'repeat' ? 'repeat' : 'clamp',
                vflip: s.vflip === 'true' || (s.vflip as any) === true,
            };
            (meta as any)[`iChannel${channel}Sampler`] = sampler;
        }
    });
    
    // Add channel types for cubemap and volume texture support
    if (channelTypes.iChannel0) (meta as any).iChannel0Type = channelTypes.iChannel0;
    if (channelTypes.iChannel1) (meta as any).iChannel1Type = channelTypes.iChannel1;
    if (channelTypes.iChannel2) (meta as any).iChannel2Type = channelTypes.iChannel2;
    if (channelTypes.iChannel3) (meta as any).iChannel3Type = channelTypes.iChannel3;
    
    return meta;
}

/**
 * Create meta file content for buffer shader
 */
function createBufferMeta(
    baseName: string,
    bufferName: string,
    author: string
): ShaderAmpMeta {
    return {
        hidden: true,
        shaderName: `${baseName}${bufferName}`,
        author: author,
        modifiedBy: "ShaderAmp Converter",
        url: "",
        license: "Please check the original shader license on Shadertoy",
        shaderSpeed: 1.0,
    };
}

/**
 * Convert a Shadertoy shader to ShaderAmp format
 */
export async function convertShadertoyShader(
    shader: ShadertoyShader, 
    useIAmplifiedTime: boolean = false,
    downloadAssets: boolean = false,
    onProgress?: (current: number, total: number, status: string) => void
): Promise<ConversionResult> {
    try {
        const shaderInfo = shader.info;
        const shaderId = shaderInfo.id;
        const shaderName = shaderInfo.name || "UnnamedShader";
        const username = shaderInfo.username || "Unknown";
        
        const passes = shader.renderpass || [];
        if (passes.length === 0) {
            return {
                mainShader: null as any,
                bufferShaders: [],
                success: false,
                error: "No render passes found"
            };
        }
        
        // Separate passes by type
        let imagePass: ShadertoyRenderPass | null = null;
        let commonPass: ShadertoyRenderPass | null = null;
        const bufferPasses = new Map<string, ShadertoyRenderPass>();
        const cubemapPasses = new Map<string, ShadertoyRenderPass>();

        // Debug: log all passes received
        console.log(`[ShaderAmp] Processing ${passes.length} render passes:`);
        for (const rp of passes) {
            const rpType = rp.type || "";
            const rpName = rp.name || "";
            const codeLen = rp.code?.length || 0;
            console.log(`[ShaderAmp]   - Type: "${rpType}", Name: "${rpName}", Code length: ${codeLen}`);

            const isImage = rpType === "image" || rpType === "img";
            const isCommon = rpType === "common";
            const isBuffer = rpType === "buffer" || rpType === "buf";
            const isCubemap = rpType === "cubemap";
            const nameMatchesBuffer = /Buf(?:fer)?\s*([A-D])/i.test(rpName);
            const nameMatchesCubemap = /Cube\s*([A-D])/i.test(rpName);

            if (isImage || (!isBuffer && !isCommon && !isCubemap && rpName.toLowerCase() === "image")) {
                imagePass = rp;
            } else if (isCommon || rpName.toLowerCase() === "common") {
                commonPass = rp;
            } else if (isBuffer || (!isImage && !isCommon && !isCubemap && nameMatchesBuffer)) {
                // Extract buffer letter from name (e.g., "Buffer A" or "Buf A" -> "A")
                const match = rpName.match(/Buf(?:fer)?\s*([A-D])/i);
                if (match) {
                    const bufferLetter = match[1].toUpperCase();
                    bufferPasses.set(bufferLetter, rp);
                }
            } else if (isCubemap || (!isImage && !isCommon && !isBuffer && nameMatchesCubemap)) {
                // Extract cubemap letter from name (e.g., "Cube A" -> "A")
                const match = rpName.match(/Cube\s*([A-D])/i);
                if (match) {
                    const cubeLetter = match[1].toUpperCase();
                    cubemapPasses.set(cubeLetter, rp);
                    console.log(`[ShaderAmp] Cubemap pass detected: Cube ${cubeLetter}`);
                }
            }
        }
        
        if (!imagePass) {
            return {
                mainShader: null as any,
                bufferShaders: [],
                success: false,
                error: "No image pass found"
            };
        }
        
        // Get common code if present
        const commonCode = commonPass?.code || "";
        console.log(`[ShaderAmp] Common code found: ${commonCode.length > 0 ? `${commonCode.length} chars` : 'NONE'}`);
        
        // Detect audio, video, and keyboard channels per pass
        const imageAudioChannel = detectAudioChannel(imagePass.inputs || []);
        const imageMicrophoneChannel = detectMicrophoneChannel(imagePass.inputs || []);
        const imageVideoChannel = detectVideoChannel(imagePass.inputs || []);
        const imageKeyboardChannel = detectKeyboardChannel(imagePass.inputs || []);

        const bufferAudioChannels = new Map<string, number | null>();
        const bufferVideoChannels = new Map<string, number | null>();
        const bufferKeyboardChannels = new Map<string, number | null>();
        bufferPasses.forEach((bp, letter) => {
            bufferAudioChannels.set(letter, detectAudioChannel(bp.inputs || []));
            bufferVideoChannels.set(letter, detectVideoChannel(bp.inputs || []));
            bufferKeyboardChannels.set(letter, detectKeyboardChannel(bp.inputs || []));
        });

        // Log detected special inputs
        if (imageMicrophoneChannel !== null) {
            console.log(`[ShaderAmp] Microphone input detected on channel ${imageMicrophoneChannel} -> mapped to iAudioData`);
        }
        if (imageVideoChannel !== null) {
            console.log(`[ShaderAmp] Video input detected on channel ${imageVideoChannel} -> mapped to iVideo`);
        }
        if (imageKeyboardChannel !== null) {
            console.log(`[ShaderAmp] Keyboard input detected on channel ${imageKeyboardChannel} -> mapped to iKeyboard`);
        }
        
        const textures = getTextureInputs(imagePass.inputs || []);
        
        // Extract channel types for cubemap support
        const imageChannelTypes = getChannelTypes(imagePass.inputs || []);
        
        // Collect all inputs from all passes for asset downloading
        const allInputs: ShadertoyInput[] = [];
        
        // Add image pass inputs
        if (imagePass.inputs) {
            allInputs.push(...imagePass.inputs);
        }
        
        // Add buffer pass inputs
        bufferPasses.forEach(pass => {
            if (pass.inputs) {
                allInputs.push(...pass.inputs);
            }
        });
        
        // Add cubemap pass inputs
        cubemapPasses.forEach(pass => {
            if (pass.inputs) {
                allInputs.push(...pass.inputs);
            }
        });
        
        // Download external assets if enabled
        let assetUrlMapping = new Map<string, string>();
        if (downloadAssets && allInputs.length > 0) {
            console.log(`[ShaderAmp] Downloading external assets from ${allInputs.length} inputs across all passes...`);
            assetUrlMapping = await downloadShaderAssets(allInputs, onProgress, true);
            console.log(`[ShaderAmp] Downloaded ${assetUrlMapping.size} assets`);
        }
        
        // Create output filename base
        const baseFilename = sanitizeFilename(shaderName);
        
        // Build buffer configuration for meta file
        const bufferConfig: BufferConfig[] = [];
        const bufferShaders: ConvertedShader[] = [];
        
        // Process buffer passes sorted by buffer letter (rendering order)
        // Shadertoy always renders buffers in alphabetical order: A(0) -> B(1) -> C(2) -> D(3) -> Image
        // Note: outputs[].channel is always 0 in Shadertoy JSON - it does NOT represent the buffer slot
        // The buffer slot is determined by the buffer name (Buffer A = 0, Buffer B = 1, etc.)
        const bufferPassesWithChannel: Array<{letter: string; pass: ShadertoyRenderPass; outputChannel: number}> = [];
        bufferPasses.forEach((pass, letter) => {
            // Buffer slot is determined by the letter: A=0, B=1, C=2, D=3
            const outputChannel = letter.charCodeAt(0) - 'A'.charCodeAt(0);
            bufferPassesWithChannel.push({ letter, pass, outputChannel });
        });
        
        // Sort by buffer letter to ensure correct rendering order (A, B, C, D)
        bufferPassesWithChannel.sort((a, b) => a.outputChannel - b.outputChannel);
        
        for (const { letter: bufferLetter, pass: bufferPass, outputChannel: bufferIdx } of bufferPassesWithChannel) {
            
            const bufferFilename = `${baseFilename}Buffer${bufferLetter}.frag`;
            const bufferCode = bufferPass.code || "";
            
            // Process buffer shader code
            const bufferAudio = bufferAudioChannels.get(bufferLetter) ?? null;
            const bufferVideo = bufferVideoChannels.get(bufferLetter) ?? null;
            const bufferKeyboard = bufferKeyboardChannels.get(bufferLetter) ?? null;
            const bufferChannelTypes = getChannelTypes(bufferPass.inputs || []);
            const processedBufferCode = processShaderCode(
                bufferCode, commonCode, bufferAudio, bufferVideo, true, bufferChannelTypes, useIAmplifiedTime, bufferKeyboard
            );
            
            // Create buffer shader content
            const bufferContent = createCreditsHeader(
                shaderId, shaderName, username, `Buffer ${bufferLetter}`
            ) + processedBufferCode;
            
            // Create buffer meta
            const bufferMeta = createBufferMeta(baseFilename, `Buffer${bufferLetter}`, username);
            
            bufferShaders.push({
                filename: bufferFilename,
                code: bufferContent,
                meta: bufferMeta
            });
            
            // Build buffer config entry
            const bufferEntry: BufferConfig = {
                shaderName: bufferFilename,
                output: bufferIdx
            };
            
            // Check buffer inputs for references to other buffers, textures, and cubemaps
            const bufferInputs = bufferPass.inputs || [];
            const bufferCubemaps: string[] = [];
            for (const inp of bufferInputs) {
                if (inp.type === "buffer") {
                    const inpId = inp.id || "";
                    const inpChannel = inp.channel ?? 0;
                    // Find which buffer this references by checking outputs
                    for (const entry of bufferPassesWithChannel) {
                        for (const out of entry.pass.outputs || []) {
                            if (out.id === inpId) {
                                // Use the actual output channel, not letter position
                                (bufferEntry as any)[`iChannel${inpChannel}`] = `buffer${entry.outputChannel}`;
                                break;
                            }
                        }
                    }
                } else if (inp.type === "texture" || inp.type === "cubemap" || inp.type === "video") {
                    const ch = inp.channel ?? 0;
                    const isCubemap = inp.type === "cubemap";
                    const isVideo = inp.type === "video";
                    const fp = inp.filepath || "";
                    if (isVideo) {
                        // Check if we have a downloaded asset for this video
                        if (assetUrlMapping.has(fp)) {
                            (bufferEntry as any)[`iChannel${ch}`] = assetUrlMapping.get(fp);
                        } else {
                            (bufferEntry as any)[`iChannel${ch}Type`] = 'video';
                            (bufferEntry as any)[`iChannel${ch}`] = fp || 'video';
                        }
                    } else if (fp) {
                        // Check if we have a downloaded asset for this texture/cubemap
                        if (assetUrlMapping.has(fp)) {
                            (bufferEntry as any)[`iChannel${ch}`] = assetUrlMapping.get(fp);
                            if (isCubemap) {
                                (bufferEntry as any)[`iChannel${ch}Type`] = 'cubemap';
                            }
                        } else if (isShadertoyMediaPath(fp)) {
                            (bufferEntry as any)[`iChannel${ch}`] = mapShadertoyTexture(fp, isCubemap);
                        } else {
                            const fname = fp.split('/').pop() || "";
                            (bufferEntry as any)[`iChannel${ch}`] = isCubemap
                                ? `images/cubemaps/${fname.replace(/\.[^.]+$/, '')}`
                                : `images/${fname}`;
                        }
                    }
                    if (isCubemap) bufferCubemaps.push(`iChannel${ch}`);
                    // Write per-channel sampler settings for buffer texture inputs
                    if (inp.sampler) {
                        const s = inp.sampler;
                        const sampler: SamplerConfig = {
                            filter: (s.filter === 'mipmap' || s.filter === 'linear' || s.filter === 'nearest') ? s.filter : 'linear',
                            wrap: s.wrap === 'repeat' ? 'repeat' : 'clamp',
                            vflip: s.vflip === 'true' || (s.vflip as any) === true,
                        };
                        (bufferEntry as any)[`iChannel${ch}Sampler`] = sampler;
                    }
                }
            }
            if (bufferCubemaps.length > 0) bufferEntry.cubemaps = bufferCubemaps;

            bufferConfig.push(bufferEntry);
        }

        // Process cubemap passes (similar to buffers but generate cubemap outputs)
        const cubemapPassesWithChannel: Array<{letter: string; pass: ShadertoyRenderPass; outputChannel: number}> = [];
        cubemapPasses.forEach((pass, letter) => {
            const outputChannel = letter.charCodeAt(0) - 'A'.charCodeAt(0);
            cubemapPassesWithChannel.push({ letter, pass, outputChannel });
        });
        cubemapPassesWithChannel.sort((a, b) => a.outputChannel - b.outputChannel);

        // Store cubemap info for image pass reference mapping
        const cubemapOutputMap = new Map<string, string>(); // Maps output id to cubemap reference
        for (const { letter: cubeLetter, pass: cubePass } of cubemapPassesWithChannel) {
            // Process cubemap shader code
            const cubeAudio = bufferAudioChannels.get(cubeLetter) ?? null; // Reuse buffer audio maps
            const cubeVideo = bufferVideoChannels.get(cubeLetter) ?? null;
            const cubeKeyboard = bufferKeyboardChannels.get(cubeLetter) ?? null;
            const cubeChannelTypes = getChannelTypes(cubePass.inputs || []);
            const cubeCode = cubePass.code || "";
            const processedCubeCode = processShaderCode(
                cubeCode, commonCode, cubeAudio, cubeVideo, true, cubeChannelTypes, useIAmplifiedTime, cubeKeyboard
            );

            const cubeFilename = `${baseFilename}Cube${cubeLetter}.frag`;
            const cubeContent = createCreditsHeader(
                shaderId, shaderName, username, `Cube ${cubeLetter}`
            ) + processedCubeCode;

            // Create cubemap meta
            const cubeMeta = createBufferMeta(baseFilename, `Cube${cubeLetter}`, username);

            bufferShaders.push({
                filename: cubeFilename,
                code: cubeContent,
                meta: cubeMeta
            });

            // Map cubemap output id to reference
            for (const out of cubePass.outputs || []) {
                if (out.id) {
                    cubemapOutputMap.set(out.id, `cubemap${cubeLetter}`);
                }
            }

            console.log(`[ShaderAmp] Cubemap ${cubeLetter} processed: ${cubeFilename}`);
        }

        // Process main image pass
        const imageCode = imagePass.code || "";
        const processedImageCode = processShaderCode(
            imageCode, commonCode, imageAudioChannel, imageVideoChannel, false, imageChannelTypes, useIAmplifiedTime, imageKeyboardChannel
        );
        
        // Determine main shader's channel references
        const imageInputs = imagePass.inputs || [];
        const mainChannelRefs = new Map<number, string>();
        
        for (const inp of imageInputs) {
            if (inp.type === "buffer") {
                const inpId = inp.id || "";
                const inpChannel = inp.channel ?? 0;
                // Find which buffer this references
                for (const entry of bufferPassesWithChannel) {
                    for (const out of entry.pass.outputs || []) {
                        if (out.id === inpId) {
                            // Use the actual output channel, not letter position
                            mainChannelRefs.set(inpChannel, `buffer${entry.outputChannel}`);
                            break;
                        }
                    }
                }
            } else if (inp.type === "cubemap") {
                const inpId = inp.id || "";
                const inpChannel = inp.channel ?? 0;
                // Check if this references a cubemap pass
                const cubemapRef = cubemapOutputMap.get(inpId);
                if (cubemapRef) {
                    mainChannelRefs.set(inpChannel, cubemapRef);
                    console.log(`[ShaderAmp] Image pass cubemap reference: channel ${inpChannel} -> ${cubemapRef}`);
                }
            }
        }
        
        // Create main shader content
        const mainFilename = `${baseFilename}.frag`;
        const mainContent = createCreditsHeader(shaderId, shaderName, username) + processedImageCode;
        
        // Create main meta
        console.log('[SA] bufferConfig before mainMeta:', JSON.stringify(bufferConfig));
        const mainMeta = createMainMeta(
            shaderInfo, bufferConfig, mainChannelRefs, textures, imageAudioChannel, imageChannelTypes, assetUrlMapping
        );
        console.log('[SA] mainMeta.buffers:', JSON.stringify(mainMeta.buffers));
        
        return {
            mainShader: {
                filename: mainFilename,
                code: mainContent,
                meta: mainMeta
            },
            bufferShaders,
            success: true
        };
        
    } catch (error) {
        return {
            mainShader: null as any,
            bufferShaders: [],
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Fetch shader data from Shadertoy API
 */
export async function fetchShadertoyShader(shaderId: string): Promise<ShadertoyShader | null> {
    try {
        const formData = new URLSearchParams();
        formData.append('s', JSON.stringify({ shaders: [shaderId] }));
        formData.append('nt', '1');
        formData.append('nl', '1');
        formData.append('np', '1');
        
        const response = await fetch('https://www.shadertoy.com/shadertoy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            console.error('[ShaderAmp] Failed to fetch shader:', response.status);
            return null;
        }
        
        const data = await response.json();
        console.log('[ShaderAmp] Raw API response type:', typeof data, Array.isArray(data) ? `array[${data.length}]` : 'object', 'keys:', Array.isArray(data) ? (data[0] ? Object.keys(data[0]).join(',') : 'empty') : Object.keys(data).join(','));
        
        // Response is an array with one shader
        if (Array.isArray(data) && data.length > 0) {
            // Handle both direct format {ver,renderpass} and wrapped format {Shader:{ver,renderpass}}
            const item = data[0];
            const shader = (item.Shader || item) as ShadertoyShader;
            console.log(`[ShaderAmp] API returned shader with ${shader.renderpass?.length || 0} render passes, pass types:`, shader.renderpass?.map((rp: any) => `${rp.name}(${rp.type})`).join(', '));
            return shader;
        }
        
        // Handle non-array response (some API versions return object directly)
        if (data && data.renderpass) {
            console.log(`[ShaderAmp] API returned direct shader object with ${data.renderpass.length} passes`);
            return data as ShadertoyShader;
        }
        if (data && data.Shader) {
            console.log(`[ShaderAmp] API returned wrapped shader with ${data.Shader.renderpass?.length} passes`);
            return data.Shader as ShadertoyShader;
        }
        
        console.log(`[ShaderAmp] API response format unexpected:`, JSON.stringify(data).slice(0, 200));
        return null;
    } catch (error) {
        console.error('[ShaderAmp] Error fetching shader:', error);
        return null;
    }
}

/**
 * Extract shader ID from Shadertoy URL
 */
export function extractShaderIdFromUrl(url: string): string | null {
    // Match patterns like:
    // https://www.shadertoy.com/view/WXyczK
    // https://shadertoy.com/view/WXyczK
    const match = url.match(/shadertoy\.com\/view\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}
