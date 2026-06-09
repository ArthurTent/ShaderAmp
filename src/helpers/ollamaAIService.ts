import browser from 'webextension-polyfill';

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

export function setPromptFix(prompt: string): void { SYSTEM_PROMPT_FIX_ERRORS = prompt; }
export function setPromptGenerate(prompt: string): void { SYSTEM_PROMPT_GENERATE = prompt; }

let baseUrl: string = 'http://localhost:11434';
let currentModelId: string = 'llama3.2';
let abortController: AbortController | null = null;

// Helper to send Ollama request via background script (bypasses CORS)
async function sendOllamaRequest(
    endpoint: string,
    body: object,
    streaming: boolean = false
): Promise<{ success?: boolean; data?: any; text?: string; error?: string; corsHint?: string }> {
    return browser.runtime.sendMessage({
        type: 'OLLAMA_REQUEST',
        baseUrl,
        endpoint,
        body,
        streaming,
    });
}

// Popular Ollama models
export const AVAILABLE_OLLAMA_MODELS = [
    { id: 'llama3.2', name: 'Llama 3.2 (Fast, Good)', recommended: true },
    { id: 'codellama', name: 'CodeLlama (Best for Code)', recommended: false },
    { id: 'mistral', name: 'Mistral (Balanced)', recommended: false },
    { id: 'qwen2.5', name: 'Qwen 2.5 (Good at Following)', recommended: false },
    { id: 'phi4', name: 'Phi-4 (Small, Fast)', recommended: false },
];

/**
 * Initialize Ollama AI with base URL and optional model selection
 */
export function initOllamaAI(baseUrlValue: string = 'http://localhost:11434', modelId?: string): boolean {
    try {
        baseUrl = baseUrlValue.replace(/\/$/, ''); // Remove trailing slash
        
        // Use selected model or default
        currentModelId = modelId || 'llama3.2';
        
        console.log(`[OllamaAI] Initializing with base URL: ${baseUrl}, model: ${currentModelId}`);
        
        return true;
    } catch (error) {
        console.error('[OllamaAI] Failed to initialize:', error);
        return false;
    }
}

/**
 * Get the current base URL
 */
export function getOllamaBaseUrl(): string {
    return baseUrl;
}

/**
 * Get the currently selected model ID
 */
export function getCurrentModelId(): string {
    return currentModelId;
}

/**
 * Set the model to use
 */
export function setOllamaModel(modelId: string): boolean {
    currentModelId = modelId;
    console.log(`[OllamaAI] Switched to model: ${modelId}`);
    return true;
}

/**
 * Set the base URL
 */
export function setOllamaBaseUrl(url: string): boolean {
    baseUrl = url.replace(/\/$/, '');
    console.log(`[OllamaAI] Base URL set to: ${baseUrl}`);
    return true;
}

/**
 * Check if Ollama AI is available (initialized)
 */
export function isOllamaAIAvailable(): boolean {
    return baseUrl !== null;
}

/**
 * Request cancellation of current AI operation
 */
export function cancelOllamaAIOperation(): void {
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

/**
 * Fix shader compile errors using Ollama AI
 * Returns null if cancelled or error, string if successful
 */
export async function fixShaderErrors(
    code: string, 
    errors: string
): Promise<{ code: string | null; cancelled: boolean }> {
    if (!baseUrl) {
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

        // Send request via background script to bypass CORS
        const result = await sendOllamaRequest('/api/generate', {
            model: currentModelId,
            system: SYSTEM_PROMPT_FIX_ERRORS,
            prompt: prompt,
            stream: false,
            temperature: 0.1,
        }, false);

        if (result.error) {
            console.error('[OllamaAI] Error from background:', result.error);
            if (result.corsHint) {
                console.log('[OllamaAI] CORS hint:', result.corsHint);
            }
            throw new Error(result.error);
        }

        const text = result.data?.response || '';
        
        return { code: extractCodeFromResponse(text), cancelled: false };
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            return { code: null, cancelled: true };
        }
        console.error('[OllamaAI] Error fixing shader:', error);
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
    if (!baseUrl) {
        return null;
    }

    try {
        abortController = new AbortController();
        
        // Build the prompt with conversation history
        let fullPrompt = '';
        
        // Add conversation history if provided
        if (conversationHistory && conversationHistory.length > 0) {
            for (const msg of conversationHistory.slice(-10)) {
                if (msg.role === 'user') {
                    fullPrompt += `User: ${msg.content}\n`;
                } else {
                    fullPrompt += `Assistant: ${msg.content}\n`;
                }
            }
        }
        
        fullPrompt += `Create a GLSL fragment shader for: ${description}`;

        // Send request via background script to bypass CORS
        // Note: Background handles streaming and returns full response
        const result = await sendOllamaRequest('/api/generate', {
            model: currentModelId,
            system: SYSTEM_PROMPT_GENERATE,
            prompt: fullPrompt,
            stream: true,
            temperature: 0.7,
        }, true);

        if (result.error) {
            console.error('[OllamaAI] Error from background:', result.error);
            if (result.corsHint) {
                console.log('[OllamaAI] CORS hint:', result.corsHint);
            }
            throw new Error(result.error);
        }

        const fullText = result.text || '';
        
        // Simulate streaming by calling onChunk with segments
        const chunkSize = 50;
        for (let i = 0; i < fullText.length; i += chunkSize) {
            if (abortController?.signal.aborted) {
                onAbort?.();
                return null;
            }
            const chunk = fullText.slice(i, i + chunkSize);
            onChunk(chunk);
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        return extractCodeFromResponse(fullText);
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            onAbort?.();
            return null;
        }
        console.error('[OllamaAI] Error streaming shader generation:', error);
        return null;
    }
}
