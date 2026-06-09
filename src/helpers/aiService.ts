import type { AILanguageModelSession } from '@src/types/ai';
import {
    initGeminiAI as initGemini,
    isGeminiAIAvailable,
    fixShaderErrors as geminiFixShaderErrors,
    generateShaderStreaming as geminiGenerateShaderStreaming,
    cancelGeminiAIOperation,
    setGeminiModel,
    setPromptFix as setGeminiPromptFix,
    setPromptGenerate as setGeminiPromptGenerate
} from './geminiAIService';
import {
    initOpenRouterAI as initOpenRouter,
    isOpenRouterAIAvailable,
    fixShaderErrors as openRouterFixShaderErrors,
    generateShaderStreaming as openRouterGenerateShaderStreaming,
    cancelOpenRouterAIOperation,
    setOpenRouterModel,
    setPromptFix as setOpenRouterPromptFix,
    setPromptGenerate as setOpenRouterPromptGenerate
} from './openRouterAIService';
import {
    initOllamaAI as initOllama,
    isOllamaAIAvailable,
    fixShaderErrors as ollamaFixShaderErrors,
    generateShaderStreaming as ollamaGenerateShaderStreaming,
    cancelOllamaAIOperation,
    setOllamaModel,
    setPromptFix as setOllamaPromptFix,
    setPromptGenerate as setOllamaPromptGenerate
} from './ollamaAIService';

// Use global LanguageModel API for Chrome extensions (not window.ai.languageModel)
declare global {
    interface Window {
        LanguageModel?: LanguageModelConstructor;
    }
    const LanguageModel: LanguageModelConstructor | undefined;
}

// AI Provider type
type AIProvider = 'chrome' | 'gemini' | 'openrouter' | 'ollama';

// Current provider and settings
let currentProvider: AIProvider = 'chrome';
let geminiApiKey: string | null = null;
let isGeminiInitialized = false;
let openRouterApiKey: string | null = null;
let isOpenRouterInitialized = false;
let ollamaBaseUrl: string | null = null;
let isOllamaInitialized = false;

interface LanguageModelConstructor {
    params(): Promise<LanguageModelParams>;
    create(options?: LanguageModelCreateOptions): Promise<AILanguageModelSession>;
}

export interface LanguageModelParams {
    defaultTemperature: number;
    defaultTopK: number;
    maxTopK: number;
    maxTemperature?: number;
}

interface LanguageModelCreateOptions {
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
    initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export const DEFAULT_PROMPT_FIX_ERRORS = `You are an expert WebGL and GLSL shader developer. Your task is to fix compile errors in fragment shader code.

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

export const DEFAULT_PROMPT_GENERATE = `You are a creative GLSL shader developer specializing in audio-reactive visualizations for ShaderAmp.

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

let activePromptFix = DEFAULT_PROMPT_FIX_ERRORS;
let activePromptGenerate = DEFAULT_PROMPT_GENERATE;

export function setPromptFix(prompt: string): void {
    activePromptFix = prompt;
    setGeminiPromptFix(prompt);
    setOpenRouterPromptFix(prompt);
    setOllamaPromptFix(prompt);
}

export function setPromptGenerate(prompt: string): void {
    activePromptGenerate = prompt;
    setGeminiPromptGenerate(prompt);
    setOpenRouterPromptGenerate(prompt);
    setOllamaPromptGenerate(prompt);
}

let currentSession: AILanguageModelSession | null = null;
let sessionType: 'fix' | 'generate' | null = null;
let abortRequested = false;

/**
 * Set the AI provider to use
 */
export function setAIProvider(provider: AIProvider): void {
    currentProvider = provider;
    console.log(`[AI] Provider set to: ${provider}`);
}

/**
 * Get the current AI provider
 */
export function getAIProvider(): AIProvider {
    return currentProvider;
}

/**
 * Initialize Gemini AI with API key and optional model selection
 */
export function initGeminiAI(apiKey: string, modelId?: string): boolean {
    geminiApiKey = apiKey;
    isGeminiInitialized = initGemini(apiKey, modelId);
    if (isGeminiInitialized) {
        console.log('[AI] Gemini AI initialized successfully');
    }
    return isGeminiInitialized;
}

/**
 * Set the Gemini model to use
 */
export function setGeminiModelId(modelId: string): boolean {
    if (!isGeminiInitialized) return false;
    return setGeminiModel(modelId);
}

/**
 * Initialize OpenRouter AI with API key and optional model selection
 */
export function initOpenRouterAI(apiKey: string, modelId?: string): boolean {
    openRouterApiKey = apiKey;
    isOpenRouterInitialized = initOpenRouter(apiKey, modelId);
    if (isOpenRouterInitialized) {
        console.log('[AI] OpenRouter AI initialized successfully');
    }
    return isOpenRouterInitialized;
}

/**
 * Set the OpenRouter model to use
 */
export function setOpenRouterModelId(modelId: string): boolean {
    if (!isOpenRouterInitialized) return false;
    return setOpenRouterModel(modelId);
}

/**
 * Initialize Ollama AI with base URL and optional model selection
 */
export function initOllamaAI(baseUrl: string, modelId?: string): boolean {
    ollamaBaseUrl = baseUrl;
    isOllamaInitialized = initOllama(baseUrl, modelId);
    if (isOllamaInitialized) {
        console.log('[AI] Ollama AI initialized successfully');
    }
    return isOllamaInitialized;
}

/**
 * Set the Ollama model to use
 */
export function setOllamaModelId(modelId: string): boolean {
    if (!isOllamaInitialized) return false;
    return setOllamaModel(modelId);
}

/**
 * Request cancellation of current AI operation
 */
export function cancelAIOperation(): void {
    if (currentProvider === 'gemini' && isGeminiInitialized) {
        cancelGeminiAIOperation();
    } else if (currentProvider === 'openrouter' && isOpenRouterInitialized) {
        cancelOpenRouterAIOperation();
    } else if (currentProvider === 'ollama' && isOllamaInitialized) {
        cancelOllamaAIOperation();
    } else {
        abortRequested = true;
        destroySession();
    }
}

/**
 * Check if abort was requested and reset the flag
 */
function checkAndResetAbort(): boolean {
    const wasAborted = abortRequested;
    abortRequested = false;
    return wasAborted;
}

/**
 * Check if Chrome built-in AI is available (using global LanguageModel API)
 */
export async function isChromeAIAvailable(): Promise<boolean> {
    try {
        // Chrome extensions use LanguageModel global, not window.ai
        if (typeof LanguageModel === 'undefined') {
            console.log('[AI] LanguageModel global not available - Chrome flags may not be enabled');
            return false;
        }

        // Check if the API is functional by calling params()
        const params = await LanguageModel.params();
        console.log('[AI] LanguageModel params:', params);
        return true;
    } catch (error) {
        console.error('[AI] Error checking availability:', error);
        return false;
    }
}

/**
 * Check if AI is available (based on current provider)
 */
export async function isAIAvailable(): Promise<boolean> {
    if (currentProvider === 'gemini' && isGeminiInitialized) {
        return isGeminiAIAvailable();
    }
    if (currentProvider === 'openrouter' && isOpenRouterInitialized) {
        return isOpenRouterAIAvailable();
    }
    if (currentProvider === 'ollama' && isOllamaInitialized) {
        return isOllamaAIAvailable();
    }
    return isChromeAIAvailable();
}

/**
 * Check AI availability with retry (useful when Chrome AI is still initializing)
 */
export async function isAIAvailableWithRetry(maxRetries = 3, delay = 800): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        const available = await isAIAvailable();
        if (available) {
            console.log(`[AI] Available after ${i + 1} attempt(s)`);
            return true;
        }
        if (i < maxRetries - 1) {
            console.log(`[AI] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return false;
}

/**
 * Get detailed AI capabilities
 */
export async function getAICapabilities(): Promise<LanguageModelParams | null> {
    try {
        if (typeof LanguageModel === 'undefined') {
            return null;
        }
        return await LanguageModel.params();
    } catch {
        return null;
    }
}

/**
 * Create or reuse an AI session
 */
async function getSession(
    type: 'fix' | 'generate',
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AILanguageModelSession | null> {
    try {
        // Reuse existing session if type matches and no conversation history (stateless)
        if (currentSession && sessionType === type && !conversationHistory) {
            return currentSession;
        }

        // Clean up existing session if type differs or has conversation history
        if (currentSession) {
            currentSession.destroy();
            currentSession = null;
        }

        if (typeof LanguageModel === 'undefined') {
            return null;
        }

        // Get default params - Chrome AI requires BOTH temperature AND topK, or neither
        const defaults = await LanguageModel.params();

        const systemPrompt = type === 'fix' ? activePromptFix : activePromptGenerate;

        // Build initial prompts - system prompt first, then conversation history
        const initialPrompts: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt }
        ];

        // Add conversation history if provided (limit to last 10 messages to prevent token overflow)
        if (conversationHistory && conversationHistory.length > 0) {
            const recentHistory = conversationHistory.slice(-10);
            initialPrompts.push(...recentHistory);
        }

        const session = await LanguageModel.create({
            initialPrompts,
            temperature: type === 'fix' ? 0.1 : 0.7, // Lower temp for fixes, higher for creativity
            topK: defaults.defaultTopK, // Must specify topK when temperature is specified
        });

        currentSession = session;
        sessionType = type;
        return session;
    } catch (error) {
        console.error('[AI] Failed to create session:', error);
        return null;
    }
}

/**
 * Fix shader compile errors using AI (delegates to active provider)
 * Returns null if cancelled or error, string if successful
 */
export async function fixShaderErrors(code: string, errors: string): Promise<{ code: string | null; cancelled: boolean }> {
    // Use Gemini if initialized and selected
    if (currentProvider === 'gemini' && isGeminiInitialized) {
        return geminiFixShaderErrors(code, errors);
    }
    
    // Use OpenRouter if initialized and selected
    if (currentProvider === 'openrouter' && isOpenRouterInitialized) {
        return openRouterFixShaderErrors(code, errors);
    }
    
    // Use Ollama if initialized and selected
    if (currentProvider === 'ollama' && isOllamaInitialized) {
        return ollamaFixShaderErrors(code, errors);
    }
    
    // Otherwise use Chrome AI
    abortRequested = false; // Reset abort flag at start

    const session = await getSession('fix');
    if (!session) {
        return { code: null, cancelled: false };
    }

    try {
        const prompt = `Fix the compile errors in this GLSL fragment shader.

Compile errors:
${errors}

Shader code:
${code}

Return the corrected shader code only:`;

        const response = await session.prompt(prompt);

        if (checkAndResetAbort()) {
            return { code: null, cancelled: true };
        }

        return { code: extractCodeFromResponse(response), cancelled: false };
    } catch (error) {
        if (checkAndResetAbort()) {
            return { code: null, cancelled: true };
        }
        console.error('[AI] Error fixing shader:', error);
        return { code: null, cancelled: false };
    }
}

/**
 * Generate a shader from a description
 */
export async function generateShaderFromPrompt(description: string): Promise<string | null> {
    const session = await getSession('generate');
    if (!session) {
        return null;
    }

    try {
        const prompt = `Create a GLSL fragment shader for: ${description}`;
        const response = await session.prompt(prompt);
        return extractCodeFromResponse(response);
    } catch (error) {
        console.error('[AI] Error generating shader:', error);
        return null;
    }
}

interface ShaderContext {
    image?: string;
    bufferA?: string;
    bufferB?: string;
    bufferC?: string;
    bufferD?: string;
}

/**
 * Generate a shader with streaming response and optional conversation history
 * Returns null if cancelled or error, string if successful
 */
export async function generateShaderStreaming(
    description: string,
    onChunk: (chunk: string) => void,
    onAbort?: () => void,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    shaderContext?: ShaderContext
): Promise<string | null> {
    // Build context-aware description if shader context is provided
    let enhancedDescription = description;
    if (shaderContext) {
        const contextParts: string[] = [];
        if (shaderContext.image) contextParts.push(`Current Image shader code:\n${shaderContext.image}`);
        if (shaderContext.bufferA) contextParts.push(`Current BufferA code:\n${shaderContext.bufferA}`);
        if (shaderContext.bufferB) contextParts.push(`Current BufferB code:\n${shaderContext.bufferB}`);
        if (shaderContext.bufferC) contextParts.push(`Current BufferC code:\n${shaderContext.bufferC}`);
        if (shaderContext.bufferD) contextParts.push(`Current BufferD code:\n${shaderContext.bufferD}`);
        
        if (contextParts.length > 0) {
            enhancedDescription = `Context - Current shader buffers:\n${contextParts.join('\n\n---\n\n')}\n\n---\n\nRequest: ${description}`;
        }
    }

    // Use Gemini if initialized and selected
    if (currentProvider === 'gemini' && isGeminiInitialized) {
        return geminiGenerateShaderStreaming(enhancedDescription, onChunk, onAbort, conversationHistory);
    }
    
    // Use OpenRouter if initialized and selected
    if (currentProvider === 'openrouter' && isOpenRouterInitialized) {
        return openRouterGenerateShaderStreaming(enhancedDescription, onChunk, onAbort, conversationHistory);
    }
    
    // Use Ollama if initialized and selected
    if (currentProvider === 'ollama' && isOllamaInitialized) {
        return ollamaGenerateShaderStreaming(enhancedDescription, onChunk, onAbort, conversationHistory);
    }
    
    // Otherwise use Chrome AI
    abortRequested = false; // Reset abort flag at start

    const session = await getSession('generate', conversationHistory);
    if (!session) {
        return null;
    }

    try {
        const prompt = `Create a GLSL fragment shader for: ${enhancedDescription}`;
        const stream = session.promptStreaming(prompt);

        let fullResponse = '';
        const reader = stream.getReader();

        while (true) {
            // Check for abort before each read
            if (abortRequested) {
                reader.cancel();
                destroySession();
                checkAndResetAbort();
                onAbort?.();
                return null;
            }

            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += value;
            onChunk(value);
        }

        return extractCodeFromResponse(fullResponse);
    } catch (error) {
        if (checkAndResetAbort()) {
            onAbort?.();
            return null;
        }
        console.error('[AI] Error streaming shader generation:', error);
        return null;
    }
}

/**
 * Clean up AI session
 */
export function destroySession(): void {
    if (currentSession) {
        currentSession.destroy();
        currentSession = null;
        sessionType = null;
    }
}

/**
 * Extract code from AI response, handling markdown code blocks
 */
function extractCodeFromResponse(response: string): string {
    // Try to extract from markdown code block
    const codeBlockMatch = response.match(/```(?:glsl)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
    }

    // If no code block, return the whole response trimmed
    return response.trim();
}
