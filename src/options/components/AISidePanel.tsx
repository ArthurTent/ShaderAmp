import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    SparklesIcon,
    XMarkIcon,
    PaperAirplaneIcon,
    ArrowDownTrayIcon,
    ChatBubbleLeftIcon,
    CpuChipIcon,
    StopIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { generateShaderStreaming, isAIAvailable } from '@src/helpers/aiService';
import type { LanguageModelParams } from '@src/helpers/aiService';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

interface BufferCodeMap {
    image?: string;
    bufferA?: string;
    bufferB?: string;
    bufferC?: string;
    bufferD?: string;
}

interface AISidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    onInsertCode: (code: string, targetBuffer?: keyof BufferCodeMap) => void;
    currentCode?: string;
    allBufferCodes?: BufferCodeMap;
    activeTab?: keyof BufferCodeMap;
    width?: number;
    isGenerating?: boolean;
    onCancelGeneration?: () => void;
}

export default function AISidePanel({ 
    isOpen, 
    onClose, 
    onInsertCode, 
    currentCode, 
    allBufferCodes = {},
    activeTab = 'image',
    width = 320, 
    isGenerating, 
    onCancelGeneration 
}: AISidePanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
    const [aiCapabilities, setAiCapabilities] = useState<LanguageModelParams | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Check AI availability when panel opens
    useEffect(() => {
        if (isOpen && aiAvailable === null) {
            checkAvailability();
        }
    }, [isOpen]);

    // Sync external isGenerating state with internal isLoading
    useEffect(() => {
        if (isGenerating !== undefined) {
            setIsLoading(isGenerating);
        }
    }, [isGenerating]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const checkAvailability = async () => {
        const available = await isAIAvailable();
        setAiAvailable(available);
        if (available) {
            const { getAICapabilities } = await import('@src/helpers/aiService');
            const caps = await getAICapabilities();
            setAiCapabilities(caps);
        }
    };

    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: inputValue.trim() };
        const assistantMessage: ChatMessage = { role: 'assistant', content: '', isStreaming: true };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setInputValue('');
        setIsLoading(true);

        let accumulatedResponse = '';

        // Build conversation history from previous messages (exclude current user message and placeholder)
        const conversationHistory = messages.length > 0
            ? messages.filter(m => !m.isStreaming).map(m => ({ role: m.role, content: m.content }))
            : undefined;

        // Build shader context with all buffer codes
        const shaderContext = {
            image: allBufferCodes.image || currentCode,
            bufferA: allBufferCodes.bufferA,
            bufferB: allBufferCodes.bufferB,
            bufferC: allBufferCodes.bufferC,
            bufferD: allBufferCodes.bufferD,
        };

        const code = await generateShaderStreaming(
            userMessage.content,
            (chunk) => {
                accumulatedResponse += chunk;
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'assistant') {
                        lastMsg.content = accumulatedResponse;
                    }
                    return newMessages;
                });
            },
            () => {
                // onAbort callback - generation was cancelled
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'assistant') {
                        lastMsg.isStreaming = false;
                        lastMsg.content += '\n\n_Generation stopped by user._';
                    }
                    return newMessages;
                });
                setIsLoading(false);
            },
            conversationHistory,
            shaderContext
        );

        // Only update if not aborted (abort handler already sets state)
        if (code !== null) {
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'assistant') {
                    lastMsg.isStreaming = false;
                    // If we got a clean code result, use it
                    if (code) {
                        lastMsg.content = '```glsl\n' + code + '\n```';
                    }
                }
                return newMessages;
            });
            setIsLoading(false);
        }
    }, [inputValue, isLoading]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInsertCode = (content: string, targetBuffer?: keyof BufferCodeMap) => {
        // Extract code from markdown block if present
        const codeMatch = content.match(/```(?:glsl)?\s*([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : content.trim();
        onInsertCode(code, targetBuffer);
    };

    // Extract all code blocks with their labels from AI response
    const extractCodeBlocks = (content: string): Array<{ label: string; code: string }> => {
        const blocks: Array<{ label: string; code: string }> = [];
        
        // Match code blocks with optional buffer labels
        const regex = /(?:\/\/\s*(Image|Buffer\s*[A-D])\s*\n)?```(?:glsl)?\s*([\s\S]*?)```/gi;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            const label = match[1] || 'Generated Code';
            const code = match[2].trim();
            blocks.push({ label, code });
        }
        
        // If no code blocks found, try to extract any code
        if (blocks.length === 0) {
            const codeMatch = content.match(/```(?:glsl)?\s*([\s\S]*?)```/);
            if (codeMatch) {
                blocks.push({ label: 'Generated Code', code: codeMatch[1].trim() });
            }
        }
        
        return blocks;
    };

    // Map label to buffer key
    const labelToBufferKey = (label: string): keyof BufferCodeMap => {
        const lower = label.toLowerCase();
        if (lower.includes('buffer a') || lower.includes('buffera')) return 'bufferA';
        if (lower.includes('buffer b') || lower.includes('bufferb')) return 'bufferB';
        if (lower.includes('buffer c') || lower.includes('bufferc')) return 'bufferC';
        if (lower.includes('buffer d') || lower.includes('bufferd')) return 'bufferD';
        return 'image';
    };

    const extractCode = (content: string): string | null => {
        const codeMatch = content.match(/```(?:glsl)?\s*([\s\S]*?)```/);
        return codeMatch ? codeMatch[1].trim() : null;
    };

    // Get available buffers for the apply buttons
    const availableBuffers = Object.entries(allBufferCodes)
        .filter(([, code]) => code && code.trim().length > 0)
        .map(([key]) => key as keyof BufferCodeMap);

    if (!isOpen) return null;

    return (
        <div className="flex flex-col bg-gray-900 border-l border-gray-700 h-full" style={{ width: `${width}px` }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                    <SparklesIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium text-white">AI Shader Gen</span>
                    {isLoading ? (
                        <button
                            onClick={onCancelGeneration}
                            className="flex items-center text-xs text-red-400 hover:text-red-300 bg-red-400/10 px-1.5 py-0.5 rounded transition-colors"
                            title="Stop generation"
                        >
                            <StopIcon className="w-3 h-3 mr-1" />
                            Stop
                        </button>
                    ) : aiAvailable && (
                        <span className="text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                            Ready
                        </span>
                    )}
                </div>
                {/* Clear Chat Button */}
                {messages.length > 0 && !isLoading && (
                    <button
                        onClick={() => setMessages([])}
                        className="p-1 text-gray-400 hover:text-red-400 rounded mr-1"
                        title="Clear chat history"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-white rounded"
                >
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>

            {/* AI Status */}
            {aiAvailable === false && (
                <div className="px-3 py-2 bg-yellow-900/30 border-b border-yellow-700/50">
                    <div className="flex items-start space-x-2">
                        <CpuChipIcon className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-yellow-300">
                            <p className="font-medium">Chrome AI not available</p>
                            <p className="text-yellow-400/80 mt-1">
                                Enable in <code className="bg-yellow-900/50 px-1 rounded">chrome://flags</code>:
                            </p>
                            <ul className="list-disc list-inside mt-1 text-yellow-400/70">
                                <li>"Enables optimization guide on device"</li>
                                <li>"Prompt API for Gemini Nano"</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <SparklesIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Describe the shader you want to create</p>
                        <p className="text-xs mt-2 text-gray-600">
                            Example: "A colorful audio-reactive waveform"
                        </p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                                    msg.role === 'user'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-800 text-gray-200'
                                }`}
                            >
                                {msg.role === 'assistant' ? (
                                    <div className="space-y-2">
                                        <div className="whitespace-pre-wrap font-mono text-xs">
                                            {msg.content || (msg.isStreaming ? 'Thinking...' : '')}
                                        </div>
                                        {msg.isStreaming && (
                                            <div className="flex items-center space-x-1">
                                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        )}
                                        {!msg.isStreaming && extractCode(msg.content) && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {/* Apply to active buffer button */}
                                                <button
                                                    onClick={() => handleInsertCode(msg.content, activeTab)}
                                                    className="flex items-center space-x-1 text-xs text-green-400 hover:text-green-300 bg-green-400/10 px-2 py-1 rounded transition-colors"
                                                >
                                                    <ArrowDownTrayIcon className="w-3 h-3" />
                                                    <span>Apply to {activeTab}</span>
                                                </button>
                                                
                                                {/* Buttons for other available buffers */}
                                                {availableBuffers.filter(b => b !== activeTab).map(buffer => (
                                                    <button
                                                        key={buffer}
                                                        onClick={() => handleInsertCode(msg.content, buffer)}
                                                        className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-400/10 px-2 py-1 rounded transition-colors"
                                                    >
                                                        <ArrowDownTrayIcon className="w-3 h-3" />
                                                        <span>Apply to {buffer}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span>{msg.content}</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-gray-800 border-t border-gray-700">
                <div className="flex items-end space-x-2">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={aiAvailable ? "Describe your shader..." : "AI not available"}
                        disabled={!aiAvailable || isLoading}
                        className="flex-1 min-h-[60px] max-h-[120px] px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded resize-none focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || !aiAvailable || isLoading}
                        className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded transition-colors"
                    >
                        <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Press Enter to send, Shift+Enter for new line
                </p>
            </div>
        </div>
    );
}
