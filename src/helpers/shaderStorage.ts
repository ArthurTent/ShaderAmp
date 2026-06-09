import browser from "webextension-polyfill";
import type { ShaderObject, BufferConfig } from "./types";

// Storage keys
const EDITED_SHADERS_KEY = 'state.editedshaders';
const EDITED_IMPORTED_KEY = 'state.editedimported';
const CUSTOM_SHADERS_KEY = 'state.customshaders';

// Type definitions
export type EditedShader = ShaderObject & {
    originalShaderName?: string;  // For factory reset tracking
    editedAt: number;
};

export type CustomShader = ShaderObject & {
    id: string;
    createdAt: number;
    updatedAt: number;
};

export type ShaderBufferConfig = BufferConfig;

/**
 * Get edited version of a built-in shader
 */
export async function getEditedShader(shaderName: string): Promise<EditedShader | undefined> {
    const result = await browser.storage.local.get(EDITED_SHADERS_KEY);
    const editedShaders = result[EDITED_SHADERS_KEY] || {};
    return editedShaders[shaderName];
}

/**
 * Save edited version of a built-in shader
 */
export async function saveEditedShader(shaderName: string, shader: ShaderObject): Promise<void> {
    const result = await browser.storage.local.get(EDITED_SHADERS_KEY);
    const editedShaders = result[EDITED_SHADERS_KEY] || {};
    
    editedShaders[shaderName] = {
        ...shader,
        originalShaderName: shaderName,
        editedAt: Date.now()
    };
    
    await browser.storage.local.set({ [EDITED_SHADERS_KEY]: editedShaders });
}

/**
 * Delete edited version (factory reset)
 */
export async function deleteEditedShader(shaderName: string): Promise<void> {
    const result = await browser.storage.local.get(EDITED_SHADERS_KEY);
    const editedShaders = result[EDITED_SHADERS_KEY] || {};
    
    delete editedShaders[shaderName];
    
    await browser.storage.local.set({ [EDITED_SHADERS_KEY]: editedShaders });
}

/**
 * Check if a built-in shader has been edited
 */
export async function isShaderEdited(shaderName: string): Promise<boolean> {
    const result = await browser.storage.local.get(EDITED_SHADERS_KEY);
    const editedShaders = result[EDITED_SHADERS_KEY] || {};
    return shaderName in editedShaders;
}

/**
 * Get all edited shaders
 */
export async function getAllEditedShaders(): Promise<Record<string, EditedShader>> {
    const result = await browser.storage.local.get(EDITED_SHADERS_KEY);
    return result[EDITED_SHADERS_KEY] || {};
}

/**
 * Get edited version of an imported shader
 */
export async function getEditedImportedShader(importId: string): Promise<EditedShader | undefined> {
    const result = await browser.storage.local.get(EDITED_IMPORTED_KEY);
    const editedImported = result[EDITED_IMPORTED_KEY] || {};
    return editedImported[importId];
}

/**
 * Save edited version of an imported shader
 */
export async function saveEditedImportedShader(importId: string, shader: ShaderObject): Promise<void> {
    const result = await browser.storage.local.get(EDITED_IMPORTED_KEY);
    const editedImported = result[EDITED_IMPORTED_KEY] || {};
    
    editedImported[importId] = {
        ...shader,
        editedAt: Date.now()
    };
    
    await browser.storage.local.set({ [EDITED_IMPORTED_KEY]: editedImported });
}

/**
 * Delete edited version of an imported shader (revert to original)
 */
export async function deleteEditedImportedShader(importId: string): Promise<void> {
    const result = await browser.storage.local.get(EDITED_IMPORTED_KEY);
    const editedImported = result[EDITED_IMPORTED_KEY] || {};
    
    delete editedImported[importId];
    
    await browser.storage.local.set({ [EDITED_IMPORTED_KEY]: editedImported });
}

/**
 * Get all custom shaders
 */
export async function getCustomShaders(): Promise<CustomShader[]> {
    const result = await browser.storage.local.get(CUSTOM_SHADERS_KEY);
    return result[CUSTOM_SHADERS_KEY] || [];
}

/**
 * Save a custom shader
 */
export async function saveCustomShader(shader: CustomShader): Promise<void> {
    console.log('[shaderStorage] Saving custom shader:', shader.id, shader.shaderName);
    const result = await browser.storage.local.get(CUSTOM_SHADERS_KEY);
    const customShaders = result[CUSTOM_SHADERS_KEY] || [];
    
    const existingIndex = customShaders.findIndex((s: CustomShader) => s.id === shader.id);
    
    if (existingIndex >= 0) {
        console.log('[shaderStorage] Updating existing shader at index:', existingIndex);
        customShaders[existingIndex] = {
            ...shader,
            updatedAt: Date.now()
        };
    } else {
        console.log('[shaderStorage] Adding new shader');
        customShaders.push({
            ...shader,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    }
    
    await browser.storage.local.set({ [CUSTOM_SHADERS_KEY]: customShaders });
    console.log('[shaderStorage] Saved! Total shaders:', customShaders.length);
}

/**
 * Delete a custom shader
 */
export async function deleteCustomShader(shaderId: string): Promise<void> {
    const result = await browser.storage.local.get(CUSTOM_SHADERS_KEY);
    const customShaders = result[CUSTOM_SHADERS_KEY] || [];
    
    const filtered = customShaders.filter((s: CustomShader) => s.id !== shaderId);
    
    await browser.storage.local.set({ [CUSTOM_SHADERS_KEY]: filtered });
}

/**
 * Resolve shader to use - checks for edited versions first
 */
export async function resolveShader(
    shaderName: string, 
    importId?: string,
    originalShader?: ShaderObject
): Promise<ShaderObject> {
    // Check for edited imported shader
    if (importId) {
        const editedImported = await getEditedImportedShader(importId);
        if (editedImported) {
            return editedImported;
        }
    }
    
    // Check for edited built-in shader
    const editedShader = await getEditedShader(shaderName);
    if (editedShader) {
        return editedShader;
    }
    
    // Return original
    return originalShader!;
}

/**
 * Generate unique ID for custom shader
 */
export function generateShaderId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create empty shader template
 */
export function createEmptyShader(id: string, name: string): CustomShader {
    const defaultCode = `// ${name}
// Your shader code here

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;

#define PI 3.14159265359

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 color = vec3(0.0);

    // Get audio data
    float audio = texture(iAudioData, vec2(0.1, 0.0)).r;

    // Your code here
    color = vec3(uv, audio + 0.5 * sin(iAmplifiedTime));

    fragColor = vec4(color, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}`;

    return {
        id,
        shaderName: `${name}.frag`,
        metaData: {
            shaderName: name,
            author: "Custom",
            modifiedBy: "",
            url: "",
            license: "MIT",
            licenseURL: "https://opensource.org/licenses/MIT",
            shaderSpeed: 0.4,
            description: "Custom shader created in ShaderAmp editor",
            customUniforms: []
        },
        inlineCode: defaultCode,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}
