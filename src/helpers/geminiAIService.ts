import { GoogleGenAI, type Chat, type GenerateContentConfig } from '@google/genai';
import type { AILanguageModelSession } from '@src/types/ai';

let SYSTEM_PROMPT_FIX_ERRORS = `You are an expert WebGL and GLSL shader developer. Your task is to fix compile errors in fragment shader code.

ShaderAmp shaders use WebGL1-compatible GLSL (Three.js ShaderMaterial). A minimal working example:

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
    float audio = texture(iAudioData, vec2(0.1, 0.0)).r;
    color = vec3(uv, audio + 0.5 * sin(iAmplifiedTime));
    fragColor = vec4(color, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}

Important rules:
1. Use 'varying' (NOT 'in'), use 'gl_FragColor' only inside void main()
2. Use 'texture()' instead of 'texture2D()'
3. User logic goes inside mainImage(); void main() only converts vUv and calls it
4. All uniforms listed above are always available — do not redeclare them, just fix errors
5. Keep the original shader's logic and visual intent

Return ONLY the corrected shader code, no explanations, no markdown code blocks.`;

let SYSTEM_PROMPT_GENERATE = `You are a creative GLSL shader developer specializing in audio-reactive visualizations for ShaderAmp.

ShaderAmp shaders use WebGL1-compatible GLSL (Three.js ShaderMaterial). Every generated shader must be a complete, self-contained fragment shader using this exact structure:

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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // all shader logic here
    fragColor = vec4(color, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}

Rules:
1. Always include the full uniform block and both functions (mainImage + void main)
2. Use 'varying' (NOT 'in'), use 'gl_FragColor' only in void main()
3. Use 'texture()' instead of 'texture2D()'
4. iAudioData: sample with texture(iAudioData, vec2(freq, 0.0)).r — freq 0..1 maps bass to treble
5. iAmplifiedTime is beat-synced; iTime is wall clock
6. When modifying existing code, preserve the overall structure and only change what's needed
7. Create visually interesting, audio-reactive effects
8. Keep code concise (under 150 lines if possible)

Return ONLY the corrected shader code, no explanations, no markdown code blocks.`;

let genAI: GoogleGenAI | null = null;
let abortController: AbortController | null = null;

// Available Gemini models with descriptions
export const AVAILABLE_GEMINI_MODELS = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast, Free Tier)', recommended: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (More Capable)', recommended: false },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B (Ultra Fast)', recommended: false },
];

let currentModelId: string = 'gemini-1.5-flash';

/**
 * Initialize Gemini AI with API key and optional model selection
 * Uses the new Google GenAI SDK with v1 API
 */
export function initGeminiAI(apiKey: string, modelId?: string): boolean {
    try {
        // Use new GoogleGenAI (defaults to v1beta which supports system instructions)
        genAI = new GoogleGenAI({ apiKey });
        
        // Use selected model (allow custom model IDs) or default
        // Also migrate old -002 suffix model names to simple names
        let model = modelId?.startsWith('gemini-') 
            ? modelId 
            : 'gemini-1.5-flash';
        
        // Migrate old model names (gemini-1.5-flash-002 -> gemini-1.5-flash)
        if (model.endsWith('-002')) {
            model = model.replace('-002', '');
        }
        
        currentModelId = model;
        
        console.log(`[GeminiAI] Initializing with model: ${model}`);
        
        return true;
    } catch (error) {
        console.error('[GeminiAI] Failed to initialize:', error);
        return false;
    }
}

/**
 * Get the currently selected model ID
 */
export function getCurrentModelId(): string {
    return currentModelId;
}

/**
 * Set the model to use (reinitializes if already initialized)
 * Allows custom model IDs that start with 'gemini-'
 */
export function setGeminiModel(modelId: string): boolean {
    if (!genAI) return false;
    
    if (!modelId.startsWith('gemini-')) {
        console.error(`[GeminiAI] Invalid model ID (must start with 'gemini-'): ${modelId}`);
        return false;
    }
    
    currentModelId = modelId;
    
    console.log(`[GeminiAI] Switched to model: ${modelId}`);
    return true;
}

/**
 * Check if Gemini AI is available (initialized with valid API key)
 */
export function isGeminiAIAvailable(): boolean {
    return genAI !== null;
}

/**
 * Request cancellation of current AI operation
 */
export function cancelGeminiAIOperation(): void {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
}

/**
 * Extract code from markdown response
 */
function extractCodeFromResponse(response: string): string | null {
    // Try to extract from markdown code block
    const codeBlockMatch = response.match(/```(?:glsl)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
    }
    // If no code block, return entire response trimmed
    return response.trim();
}

export function setPromptFix(prompt: string): void { SYSTEM_PROMPT_FIX_ERRORS = prompt; currentChat = null; }
export function setPromptGenerate(prompt: string): void { SYSTEM_PROMPT_GENERATE = prompt; currentChat = null; }

// Active chat session for generation
let currentChat: Chat | null = null;

/**
 * Fix shader compile errors using Gemini AI
 * Returns null if cancelled or error, string if successful
 */
export async function fixShaderErrors(
    code: string, 
    errors: string
): Promise<{ code: string | null; cancelled: boolean }> {
    if (!genAI) {
        return { code: null, cancelled: false };
    }

    try {
        abortController = new AbortController();
        
        const prompt = `Fix the compile errors in this GLSL fragment shader.

Compile errors:
${errors}

Shader code:
${code}

Return the corrected shader code only:`;

        const response = await genAI.models.generateContent({
            model: currentModelId,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: SYSTEM_PROMPT_FIX_ERRORS,
                temperature: 0.1,
                maxOutputTokens: 4096,
            }
        });

        const text = response.text || '';
        return { code: extractCodeFromResponse(text), cancelled: false };
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            return { code: null, cancelled: true };
        }
        console.error('[GeminiAI] Error fixing shader:', error);
        return { code: null, cancelled: false };
    }
}

/**
 * Generate a shader with streaming response and optional conversation history
 * Returns null if cancelled or error, string if successful
 */
export async function generateShaderStreaming(
    description: string,
    onChunk: (chunk: string) => void,
    onAbort?: () => void,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string | null> {
    if (!genAI) {
        return null;
    }

    try {
        abortController = new AbortController();
        
        const prompt = `Create a GLSL fragment shader for: ${description}`;
        
        // Build history for chat
        const history = conversationHistory?.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        })) || [];
        
        // Create or get chat session
        if (!currentChat || history.length === 0) {
            currentChat = genAI.chats.create({
                model: currentModelId,
                config: {
                    systemInstruction: SYSTEM_PROMPT_GENERATE,
                    temperature: 0.7,
                    maxOutputTokens: 4096,
                },
                history: history.length > 0 ? history : undefined
            });
        }
        
        // Send message and stream response
        const result = await currentChat.sendMessageStream({
            message: prompt
        });
        
        let fullResponse = '';
        
        for await (const chunk of result) {
            if (abortController?.signal.aborted) {
                onAbort?.();
                return null;
            }
            const text = chunk.text;
            if (text) {
                fullResponse += text;
                onChunk(text);
            }
        }
        
        return extractCodeFromResponse(fullResponse);
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            onAbort?.();
            return null;
        }
        console.error('[GeminiAI] Error streaming shader generation:', error);
        return null;
    }
}
