import type { AILanguageModelSession } from '@src/types/ai';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

let apiKey: string | null = null;
let currentModelId: string = 'openai/gpt-4o-mini';
let abortController: AbortController | null = null;

// Available OpenRouter models with descriptions
export const AVAILABLE_OPENROUTER_MODELS = [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast, Cheap)', recommended: true },
    { id: 'openai/gpt-4o', name: 'GPT-4o (Best Quality)', recommended: false },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Balanced)', recommended: false },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku (Fast)', recommended: false },
    { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash (Via OpenRouter)', recommended: false },
    { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro (Via OpenRouter)', recommended: false },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B (Free Tier)', recommended: false },
];

/**
 * Initialize OpenRouter AI with API key and optional model selection
 */
export function initOpenRouterAI(apiKeyValue: string, modelId?: string): boolean {
    try {
        apiKey = apiKeyValue;
        
        // Use selected model or default
        const model = modelId?.includes('/') 
            ? modelId 
            : 'openai/gpt-4o-mini';
        currentModelId = model;
        
        console.log(`[OpenRouterAI] Initializing with model: ${model}`);
        
        return true;
    } catch (error) {
        console.error('[OpenRouterAI] Failed to initialize:', error);
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
 * Set the model to use
 */
export function setOpenRouterModel(modelId: string): boolean {
    if (!apiKey) return false;
    
    if (!modelId.includes('/')) {
        console.error(`[OpenRouterAI] Invalid model ID (must be in format 'provider/model'): ${modelId}`);
        return false;
    }
    
    currentModelId = modelId;
    console.log(`[OpenRouterAI] Switched to model: ${modelId}`);
    return true;
}

/**
 * Check if OpenRouter AI is available (initialized with valid API key)
 */
export function isOpenRouterAIAvailable(): boolean {
    return apiKey !== null;
}

/**
 * Request cancellation of current AI operation
 */
export function cancelOpenRouterAIOperation(): void {
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
 * Fix shader compile errors using OpenRouter AI
 * Returns null if cancelled or error, string if successful
 */
export async function fixShaderErrors(
    code: string, 
    errors: string
): Promise<{ code: string | null; cancelled: boolean }> {
    if (!apiKey) {
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

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://shaderamp.app',
                'X-Title': 'ShaderAmp',
            },
            body: JSON.stringify({
                model: currentModelId,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT_FIX_ERRORS },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 4096,
            }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${error}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        
        return { code: extractCodeFromResponse(text), cancelled: false };
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            return { code: null, cancelled: true };
        }
        console.error('[OpenRouterAI] Error fixing shader:', error);
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
    if (!apiKey) {
        return null;
    }

    try {
        abortController = new AbortController();
        
        // Build messages array
        const messages: Array<{ role: string; content: string }> = [
            { role: 'system', content: SYSTEM_PROMPT_GENERATE }
        ];
        
        // Add conversation history if provided
        if (conversationHistory && conversationHistory.length > 0) {
            for (const msg of conversationHistory.slice(-10)) {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }
        
        messages.push({
            role: 'user',
            content: `Create a GLSL fragment shader for: ${description}`
        });

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://shaderamp.app',
                'X-Title': 'ShaderAmp',
            },
            body: JSON.stringify({
                model: currentModelId,
                messages,
                temperature: 0.7,
                max_tokens: 4096,
                stream: true,
            }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${error}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            if (abortController?.signal.aborted) {
                onAbort?.();
                return null;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed.choices?.[0]?.delta?.content || '';
                        if (text) {
                            fullResponse += text;
                            onChunk(text);
                        }
                    } catch {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }

        return extractCodeFromResponse(fullResponse);
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            onAbort?.();
            return null;
        }
        console.error('[OpenRouterAI] Error streaming shader generation:', error);
        return null;
    }
}
