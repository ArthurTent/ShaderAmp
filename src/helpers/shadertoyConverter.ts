/**
 * Shadertoy to ShaderAmp Converter
 * 
 * Converts shaders from Shadertoy API format to ShaderAmp format.
 * Ported from shadertoy_to_shaderamp.py
 */

import { mapShadertoyTexture, isShadertoyMediaPath } from './shadertoyAssetMapping';

// ShaderAmp uniform header template
const SHADERAMP_UNIFORMS = `uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;

varying vec2 vUv;
`;

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
export interface ShaderAmpMeta {
    author: string;
    modifiedBy: string;
    shaderName: string;
    url: string;
    license: string;
    licenseURL: string;
    shaderSpeed: number;
    description?: string;
    tab?: string[];
    buffers?: BufferConfig[];
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
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
 * Get texture inputs with their channel numbers (excludes video, handled separately)
 */
function getTextureInputs(inputs: ShadertoyInput[]): Map<number, ShadertoyInput> {
    const textures = new Map<number, ShadertoyInput>();
    for (const inp of inputs) {
        // Exclude video - it's handled separately via iVideo
        if (["texture", "cubemap"].includes(inp.type)) {
            const channel = inp.channel ?? 0;
            textures.set(channel, inp);
        }
    }
    return textures;
}

/**
 * Replace audio channel references with iAudioData
 */
function replaceAudioChannel(code: string, audioChannel: number | null): string {
    if (audioChannel === null) {
        return code;
    }
    
    const channelName = `iChannel${audioChannel}`;
    
    // Replace texture/texelFetch calls for the audio channel
    code = code.replace(
        new RegExp(`\\btexture\\s*\\(\\s*${channelName}\\s*,`, 'g'),
        'texture(iAudioData,'
    );
    code = code.replace(
        new RegExp(`\\btexelFetch\\s*\\(\\s*${channelName}\\s*,`, 'g'),
        'texelFetch(iAudioData,'
    );
    
    return code;
}

/**
 * Replace video channel references with iVideo
 */
function replaceVideoChannel(code: string, videoChannel: number | null): string {
    if (videoChannel === null) {
        return code;
    }
    
    const channelName = `iChannel${videoChannel}`;
    
    // Replace texture/texelFetch calls for the video channel
    code = code.replace(
        new RegExp(`\\btexture\\s*\\(\\s*${channelName}\\s*,`, 'g'),
        'texture(iVideo,'
    );
    code = code.replace(
        new RegExp(`\\btexelFetch\\s*\\(\\s*${channelName}\\s*,`, 'g'),
        'texelFetch(iVideo,'
    );
    
    return code;
}

/**
 * Process shader code and wrap it for ShaderAmp
 */
function processShaderCode(
    code: string, 
    commonCode: string, 
    audioChannel: number | null,
    videoChannel: number | null = null,
    isBuffer: boolean = false
): string {
    // Replace audio channel references
    let processedCode = replaceAudioChannel(code, audioChannel);
    
    // Replace video channel references
    processedCode = replaceVideoChannel(processedCode, videoChannel);
    
    // Also process common code if present
    let processedCommon = commonCode;
    if (commonCode) {
        processedCommon = replaceAudioChannel(commonCode, audioChannel);
        processedCommon = replaceVideoChannel(processedCommon, videoChannel);
    }
    
    // Check if mainImage function exists
    const hasMainImage = /\bvoid\s+mainImage\s*\(/.test(processedCode);
    
    // Check if main() already exists
    const hasMain = /\bvoid\s+main\s*\(\s*\)/.test(processedCode);
    
    // Build the final shader code
    const parts: string[] = [];
    
    // Add ShaderAmp uniforms at the top
    parts.push(SHADERAMP_UNIFORMS);
    
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
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

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
    audioChannel: number | null
): ShaderAmpMeta {
    const meta: ShaderAmpMeta = {
        author: shaderInfo.username || "Unknown",
        modifiedBy: "ShaderAmp Converter",
        shaderName: shaderInfo.name || "Unnamed Shader",
        url: `https://www.shadertoy.com/view/${shaderInfo.id}`,
        license: "Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License",
        licenseURL: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
        shaderSpeed: 1.0,
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
    
    // Add main shader's buffer channel references
    mainChannelRefs.forEach((ref, channel) => {
        (meta as any)[`iChannel${channel}`] = ref;
    });
    
    // Add texture references (skip audio channel)
    textures.forEach((texInfo, channel) => {
        if (channel === audioChannel) return;
        const filepath = texInfo.filepath || "";
        if (filepath) {
            // Use asset mapping for Shadertoy media paths
            if (isShadertoyMediaPath(filepath)) {
                (meta as any)[`iChannel${channel}`] = mapShadertoyTexture(filepath);
            } else {
                // Keep original filename for non-Shadertoy paths
                const filename = filepath.split('/').pop() || "";
                (meta as any)[`iChannel${channel}`] = `images/${filename}`;
            }
        }
    });
    
    // Add texture wrap setting if any texture uses repeat
    const textureValues = Array.from(textures.values());
    for (let i = 0; i < textureValues.length; i++) {
        if (textureValues[i].sampler?.wrap === "repeat") {
            meta.textureWrap = "repeat";
            break;
        }
    }
    
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
        license: "Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License",
        licenseURL: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
        shaderSpeed: 1.0,
    };
}

/**
 * Convert a Shadertoy shader to ShaderAmp format
 */
export function convertShadertoyShader(shader: ShadertoyShader): ConversionResult {
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
        
        for (const rp of passes) {
            const rpType = rp.type || "";
            const rpName = rp.name || "";
            
            if (rpType === "image") {
                imagePass = rp;
            } else if (rpType === "common") {
                commonPass = rp;
            } else if (rpType === "buffer") {
                // Extract buffer letter from name (e.g., "Buffer A" -> "A")
                const match = rpName.match(/Buffer\s*([A-D])/i);
                if (match) {
                    const bufferLetter = match[1].toUpperCase();
                    bufferPasses.set(bufferLetter, rp);
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
        
        // Detect audio and video channels per pass
        const imageAudioChannel = detectAudioChannel(imagePass.inputs || []);
        const imageMicrophoneChannel = detectMicrophoneChannel(imagePass.inputs || []);
        const imageVideoChannel = detectVideoChannel(imagePass.inputs || []);
        
        const bufferAudioChannels = new Map<string, number | null>();
        const bufferVideoChannels = new Map<string, number | null>();
        bufferPasses.forEach((bp, letter) => {
            bufferAudioChannels.set(letter, detectAudioChannel(bp.inputs || []));
            bufferVideoChannels.set(letter, detectVideoChannel(bp.inputs || []));
        });
        
        // Log detected special inputs
        if (imageMicrophoneChannel !== null) {
            console.log(`[ShaderAmp] Microphone input detected on channel ${imageMicrophoneChannel} -> mapped to iAudioData`);
        }
        if (imageVideoChannel !== null) {
            console.log(`[ShaderAmp] Video input detected on channel ${imageVideoChannel} -> mapped to iVideo`);
        }
        
        const textures = getTextureInputs(imagePass.inputs || []);
        
        // Create output filename base
        const baseFilename = sanitizeFilename(shaderName);
        
        // Build buffer configuration for meta file
        const bufferConfig: BufferConfig[] = [];
        const bufferShaders: ConvertedShader[] = [];
        
        // Process buffer passes first (sorted by letter)
        const sortedBufferLetters = Array.from(bufferPasses.keys()).sort();
        
        for (const bufferLetter of sortedBufferLetters) {
            const bufferPass = bufferPasses.get(bufferLetter)!;
            const bufferIdx = bufferLetter.charCodeAt(0) - 'A'.charCodeAt(0); // A=0, B=1, C=2, D=3
            
            const bufferFilename = `${baseFilename}Buffer${bufferLetter}.frag`;
            const bufferCode = bufferPass.code || "";
            
            // Process buffer shader code
            const bufferAudio = bufferAudioChannels.get(bufferLetter) ?? null;
            const bufferVideo = bufferVideoChannels.get(bufferLetter) ?? null;
            const processedBufferCode = processShaderCode(
                bufferCode, commonCode, bufferAudio, bufferVideo, true
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
            
            // Check buffer inputs for references to other buffers
            const bufferInputs = bufferPass.inputs || [];
            for (const inp of bufferInputs) {
                if (inp.type === "buffer") {
                    const inpId = inp.id || "";
                    const inpChannel = inp.channel ?? 0;
                    // Find which buffer this references by checking outputs
                    const bufferPassEntries = Array.from(bufferPasses.entries());
                    for (let j = 0; j < bufferPassEntries.length; j++) {
                        const [otherLetter, otherPass] = bufferPassEntries[j];
                        for (const out of otherPass.outputs || []) {
                            if (out.id === inpId) {
                                const otherIdx = otherLetter.charCodeAt(0) - 'A'.charCodeAt(0);
                                (bufferEntry as any)[`iChannel${inpChannel}`] = `buffer${otherIdx}`;
                                break;
                            }
                        }
                    }
                }
            }
            
            bufferConfig.push(bufferEntry);
        }
        
        // Process main image pass
        const imageCode = imagePass.code || "";
        const processedImageCode = processShaderCode(
            imageCode, commonCode, imageAudioChannel, imageVideoChannel, false
        );
        
        // Determine main shader's channel references
        const imageInputs = imagePass.inputs || [];
        const mainChannelRefs = new Map<number, string>();
        
        for (const inp of imageInputs) {
            if (inp.type === "buffer") {
                const inpId = inp.id || "";
                const inpChannel = inp.channel ?? 0;
                // Find which buffer this references
                const bufferPassEntries2 = Array.from(bufferPasses.entries());
                for (let k = 0; k < bufferPassEntries2.length; k++) {
                    const [bufferLetter, bufferPass] = bufferPassEntries2[k];
                    for (const out of bufferPass.outputs || []) {
                        if (out.id === inpId) {
                            const bufferIdx = bufferLetter.charCodeAt(0) - 'A'.charCodeAt(0);
                            mainChannelRefs.set(inpChannel, `buffer${bufferIdx}`);
                            break;
                        }
                    }
                }
            }
        }
        
        // Create main shader content
        const mainFilename = `${baseFilename}.frag`;
        const mainContent = createCreditsHeader(shaderId, shaderName, username) + processedImageCode;
        
        // Create main meta
        const mainMeta = createMainMeta(
            shaderInfo, bufferConfig, mainChannelRefs, textures, imageAudioChannel
        );
        
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
        
        // Response is an array with one shader
        if (Array.isArray(data) && data.length > 0) {
            return data[0] as ShadertoyShader;
        }
        
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
