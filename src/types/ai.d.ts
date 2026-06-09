// Type definitions for Chrome Built-in AI (LanguageModel global / Gemini Nano)
// https://developer.chrome.com/docs/ai/built-in
// For Chrome extensions, use the global LanguageModel API, not window.ai

declare global {
    interface Window {
        /**
         * Legacy window.ai API (for web pages, not extensions)
         * @deprecated Use global LanguageModel for extensions
         */
        ai?: AI;
        LanguageModel?: LanguageModelConstructor;
    }
}

/**
 * LanguageModel constructor interface
 */
export interface LanguageModelConstructor {
    /**
     * Get the default parameters for the language model
     */
    params(): Promise<LanguageModelParams>;

    /**
     * Create a new language model session
     */
    create(options?: LanguageModelCreateOptions): Promise<AILanguageModelSession>;
}

/**
 * Language model parameters returned by LanguageModel.params()
 */
export interface LanguageModelParams {
    defaultTemperature: number;
    defaultTopK: number;
    maxTopK: number;
    maxTemperature?: number;
}

/**
 * Options for creating a LanguageModel session
 */
export interface LanguageModelCreateOptions {
    /**
     * System prompt to set the behavior of the model
     */
    systemPrompt?: string;

    /**
     * Initial prompts to seed the conversation (including system role)
     */
    initialPrompts?: AIPrompt[];

    /**
     * Temperature for sampling (0.0 - 1.0)
     */
    temperature?: number;

    /**
     * Top-k sampling parameter
     */
    topK?: number;
}

/**
 * Legacy window.ai interface (for web pages)
 */
export interface AI {
    languageModel: AILanguageModel;
}

/**
 * Legacy AILanguageModel interface (for web pages)
 */
export interface AILanguageModel {
    /**
     * Check if the language model is available
     */
    capabilities(): Promise<AICapabilities>;

    /**
     * Create a new language model session
     */
    create(options?: AILanguageModelCreateOptions): Promise<AILanguageModelSession>;
}

/**
 * Legacy capabilities interface
 */
export interface AICapabilities {
    /**
     * 'no' - not available
     * 'after-download' - available after download
     * 'readily' - immediately available
     */
    available: 'no' | 'after-download' | 'readily';
}

/**
 * Legacy create options interface
 */
export interface AILanguageModelCreateOptions {
    systemPrompt?: string;
    initialPrompts?: AIPrompt[];
    temperature?: number;
    topK?: number;
}

/**
 * Prompt interface for AI conversations
 */
export interface AIPrompt {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Language Model Session interface (returned by LanguageModel.create())
 */
export interface AILanguageModelSession {
    /**
     * Send a prompt to the model and get a response
     */
    prompt(prompt: string): Promise<string>;

    /**
     * Send a prompt and get a streaming response
     */
    promptStreaming(prompt: string): ReadableStream<string>;

    /**
     * Clone the session with the same state
     */
    clone(): Promise<AILanguageModelSession>;

    /**
     * Destroy the session and free up resources
     */
    destroy(): void;
}

export {};
