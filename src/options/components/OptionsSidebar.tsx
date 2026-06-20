import { acquireVideoStream } from '@src/helpers/optionsActions';
import browser from "webextension-polyfill";
import React, { useEffect, useRef, useState } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import type { ShaderCatalog, ShaderObject } from "@src/helpers/types";
import { removeFromStorage } from '@src/storage/storage';
import { SETTINGS_RANDOMIZE_SHADERS, SETTINGS_RANDOMIZE_TIME, SETTINGS_RANDOMIZE_VARIATION, SETTINGS_RANDOMIZE_BEAT, SETTINGS_RANDOMIZE_BEAT_INTERVAL, SETTINGS_SPEEDDIVIDER, SETTINGS_WEBCAM, STATE_SHADERINDEX, STATE_SHADERLIST, STATE_SHADERNAME, STATE_CURRENT_SHADER, SETTINGS_SHADEROPTIONS, STATE_SHOWSHADERCREDITS, STATE_SHOWPREVIEW, SETTINGS_WEBCAM_AUDIO, SETTINGS_VOLUME_AMPLIFIER, SETTINGS_SHOW_TAB_TITLE, SETTINGS_SHOW_FPS, SETTINGS_SHADER_FADE, SETTINGS_RENDER_SCALE, SETTINGS_USE_IAMPLIFIED_TIME, SETTINGS_ENABLE_IAMPLIFIED_TIME, SETTINGS_DISPLAY_CAPTURE, SETTINGS_DOWNLOAD_SHADERTOY_ASSETS, SETTINGS_DOWNLOAD_SHADERTOY_ASSETS_CONFIRMED, SETTINGS_AI_PROVIDER, SETTINGS_GEMINI_API_KEY, SETTINGS_GEMINI_MODEL, SETTINGS_OPENROUTER_API_KEY, SETTINGS_OPENROUTER_MODEL, SETTINGS_OLLAMA_BASE_URL, SETTINGS_OLLAMA_MODEL, SETTINGS_DEBUG_LOGGING, SETTINGS_EQ_GAINS, SETTINGS_EQ_APPLY_TO_OUTPUT, SETTINGS_AI_PROMPT_FIX, SETTINGS_AI_PROMPT_GENERATE } from '@src/storage/storageConstants';
import { logger, initDebugCache, updateDebugCache } from '@src/helpers/logger';
import { RESET_TIME, PREV_SHADER, NEXT_SHADER, DECR_TIME, INCR_TIME } from '@src/helpers/constants';
import RangeSlider from '@src/components/RangeSlider';
import { ArrowLongLeftIcon, ArrowLongRightIcon, ClockIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, MusicalNoteIcon, VideoCameraIcon, VideoCameraSlashIcon, Cog6ToothIcon, CpuChipIcon, KeyIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Toggle from '@src/components/Toggle';

type Props = {
    onAboutClick: () => void;
    onOpenDebugLogs?: () => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onOpenAssetConfirmModal?: (onConfirm: (dontAskAgain: boolean) => void, onCancel: () => void) => void;
    uiTheme?: 'classic' | 'audio';
    onToggleTheme?: () => void;
};

export default function OptionsSidebar({ onAboutClick, onOpenDebugLogs, collapsed = false, onToggleCollapse, onOpenAssetConfirmModal, uiTheme = 'classic', onToggleTheme }: Props) {
    // Local states
    const videoElement = useRef<HTMLVideoElement>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | undefined>();
    const [isVideoAvailable, setIsVideoAvailable] = useState<boolean>(true);

    // Synced states
    const [shaderIndex] = useChromeStorageLocal(STATE_SHADERINDEX, 0);
    const [currentShader] = useChromeStorageLocal<ShaderObject | null>(STATE_CURRENT_SHADER, null);
    const [showPreview, setShowPreview] = useChromeStorageLocal(STATE_SHOWPREVIEW, false);
    const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) });
    const [speedDivider, setSpeedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
    const [playRandomShader, setPlayRandomShader] = useChromeStorageLocal(SETTINGS_RANDOMIZE_SHADERS, false);
    const [randomizeTime, setRandomizeTime] = useChromeStorageLocal(SETTINGS_RANDOMIZE_TIME, 5);
    const [randomizeVariation, setRandomizeVariation] = useChromeStorageLocal(SETTINGS_RANDOMIZE_VARIATION, 2);
    const [randomizeBeat, setRandomizeBeat] = useChromeStorageLocal(SETTINGS_RANDOMIZE_BEAT, false);
    const [randomizeBeatInterval, setRandomizeBeatInterval] = useChromeStorageLocal(SETTINGS_RANDOMIZE_BEAT_INTERVAL, 100);
    const [useWebcam, setUseWebcam] = useChromeStorageLocal(SETTINGS_WEBCAM, false);
    const [useWebcamAudio, setUseWebcamAudio] = useChromeStorageLocal(SETTINGS_WEBCAM_AUDIO, false);
    const [showShaderCredits, setShowShaderCredits] = useChromeStorageLocal(STATE_SHOWSHADERCREDITS, false);
    const [volumeAmpifier, setVolumeAmplifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);
    const EQ_FREQUENCIES = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];
    const EQ_DEFAULT_GAINS: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const [eqGains, setEqGains] = useChromeStorageLocal<number[]>(SETTINGS_EQ_GAINS, EQ_DEFAULT_GAINS);
    const [eqApplyToOutput, setEqApplyToOutput] = useChromeStorageLocal(SETTINGS_EQ_APPLY_TO_OUTPUT, false);
    const [showEq, setShowEq] = useState(false);
    const [showTabTitle, setShowTabTitle] = useChromeStorageLocal(SETTINGS_SHOW_TAB_TITLE, false);
    const [showFps, setShowFps] = useChromeStorageLocal(SETTINGS_SHOW_FPS, false);
    const [shaderFade, setShaderFade] = useChromeStorageLocal(SETTINGS_SHADER_FADE, false);
    const [renderScale, setRenderScale] = useChromeStorageLocal(SETTINGS_RENDER_SCALE, 0.5);
    const [enableIAmplifiedTime, setEnableIAmplifiedTime] = useChromeStorageLocal(SETTINGS_ENABLE_IAMPLIFIED_TIME, true);
    const [useIAmplifiedTime, setUseIAmplifiedTime] = useChromeStorageLocal(SETTINGS_USE_IAMPLIFIED_TIME, false);
    const [useDisplayCapture, setUseDisplayCapture] = useChromeStorageLocal(SETTINGS_DISPLAY_CAPTURE, false);
    const [downloadShadertoyAssets, setDownloadShadertoyAssets] = useChromeStorageLocal(SETTINGS_DOWNLOAD_SHADERTOY_ASSETS, false);
    const [downloadShadertoyAssetsConfirmed, setDownloadShadertoyAssetsConfirmed] = useChromeStorageLocal(SETTINGS_DOWNLOAD_SHADERTOY_ASSETS_CONFIRMED, false);
    const [debugLogging, setDebugLogging] = useChromeStorageLocal(SETTINGS_DEBUG_LOGGING, false);
    
    // AI Settings
    const [aiProvider, setAIProvider] = useChromeStorageLocal<'chrome' | 'gemini' | 'openrouter' | 'ollama'>(SETTINGS_AI_PROVIDER, 'chrome');
    const [geminiApiKey, setGeminiApiKey] = useChromeStorageLocal(SETTINGS_GEMINI_API_KEY, '');
    const [geminiModel, setGeminiModel] = useChromeStorageLocal(SETTINGS_GEMINI_MODEL, 'gemini-1.5-flash');
    const [openRouterApiKey, setOpenRouterApiKey] = useChromeStorageLocal(SETTINGS_OPENROUTER_API_KEY, '');
    const [openRouterModel, setOpenRouterModel] = useChromeStorageLocal(SETTINGS_OPENROUTER_MODEL, 'openai/gpt-4o-mini');
    const [ollamaBaseUrl, setOllamaBaseUrl] = useChromeStorageLocal(SETTINGS_OLLAMA_BASE_URL, 'http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useChromeStorageLocal(SETTINGS_OLLAMA_MODEL, 'llama3.2');
    const [aiPromptFix, setAiPromptFix] = useChromeStorageLocal(SETTINGS_AI_PROMPT_FIX, '');
    const [aiPromptGenerate, setAiPromptGenerate] = useChromeStorageLocal(SETTINGS_AI_PROMPT_GENERATE, '');
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [showAISettings, setShowAISettings] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState<'uninitialized' | 'valid' | 'invalid'>('uninitialized');
    const [openRouterStatus, setOpenRouterStatus] = useState<'uninitialized' | 'valid' | 'invalid'>('uninitialized');
    const [ollamaStatus, setOllamaStatus] = useState<'uninitialized' | 'valid' | 'invalid'>('uninitialized');
    const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string, recommended?: boolean}>>([]);
    const [customModelId, setCustomModelId] = useState('');
    const [isCustomModel, setIsCustomModel] = useState(false);
    
    // Push custom prompts to AI service on load and change
    useEffect(() => {
        import('@src/helpers/aiService').then(({ setPromptFix, setPromptGenerate, DEFAULT_PROMPT_FIX_ERRORS, DEFAULT_PROMPT_GENERATE }) => {
            setPromptFix(aiPromptFix || DEFAULT_PROMPT_FIX_ERRORS);
            setPromptGenerate(aiPromptGenerate || DEFAULT_PROMPT_GENERATE);
        });
    }, [aiPromptFix, aiPromptGenerate]);

    // Load available models when AI settings opens
    useEffect(() => {
        if (showAISettings) {
            if (aiProvider === 'gemini') {
                import('@src/helpers/geminiAIService').then(({ AVAILABLE_GEMINI_MODELS }) => {
                    setAvailableModels(AVAILABLE_GEMINI_MODELS);
                });
            } else if (aiProvider === 'openrouter') {
                import('@src/helpers/openRouterAIService').then(({ AVAILABLE_OPENROUTER_MODELS }) => {
                    setAvailableModels(AVAILABLE_OPENROUTER_MODELS);
                });
            } else if (aiProvider === 'ollama') {
                import('@src/helpers/ollamaAIService').then(({ AVAILABLE_OLLAMA_MODELS }) => {
                    setAvailableModels(AVAILABLE_OLLAMA_MODELS);
                });
            }
        }
    }, [showAISettings, aiProvider]);
    
    // Initialize Gemini AI when API key is set
    useEffect(() => {
        if (aiProvider === 'gemini' && geminiApiKey && geminiApiKey.length > 10) {
            import('@src/helpers/aiService').then(({ initGeminiAI }) => {
                const success = initGeminiAI(geminiApiKey, geminiModel);
                setGeminiStatus(success ? 'valid' : 'invalid');
            });
        }
    }, [aiProvider, geminiApiKey, geminiModel]);
    
    // Initialize OpenRouter AI when API key is set
    useEffect(() => {
        if (aiProvider === 'openrouter' && openRouterApiKey && openRouterApiKey.length > 10) {
            import('@src/helpers/aiService').then(({ initOpenRouterAI }) => {
                const success = initOpenRouterAI(openRouterApiKey, openRouterModel);
                setOpenRouterStatus(success ? 'valid' : 'invalid');
            });
        }
    }, [aiProvider, openRouterApiKey, openRouterModel]);
    
    // Initialize Ollama AI when settings are configured
    useEffect(() => {
        if (aiProvider === 'ollama' && ollamaBaseUrl) {
            import('@src/helpers/aiService').then(({ initOllamaAI }) => {
                const success = initOllamaAI(ollamaBaseUrl, ollamaModel);
                setOllamaStatus(success ? 'valid' : 'invalid');
            });
        }
    }, [aiProvider, ollamaBaseUrl, ollamaModel]);
    
    // Update AI provider when changed
    useEffect(() => {
        import('@src/helpers/aiService').then(({ setAIProvider }) => {
            setAIProvider(aiProvider);
        });
    }, [aiProvider]);

    // Initialize debug cache
    useEffect(() => {
        initDebugCache();
    }, []);

    // Sync cache when storage changes
    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes[SETTINGS_DEBUG_LOGGING]) {
                updateDebugCache(changes[SETTINGS_DEBUG_LOGGING].newValue);
            }
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const sendMessage = (command: string) => {
        browser.runtime.sendMessage({ command: command }).catch(error => console.error(error));
    }

    const cycleShaders = (next: boolean) => {
        sendMessage(next ? NEXT_SHADER : PREV_SHADER);
    }

    const incrementTime = () => {
        sendMessage(INCR_TIME);
    }

    const decrementTime = () => {
        sendMessage(DECR_TIME);
    }

    const resetTime = () => {
        sendMessage(RESET_TIME);
    }

    const setupVideoStream = async () => {
        const stream = await acquireVideoStream(videoElement.current as HTMLVideoElement);
        setVideoStream(stream);
    }

    const shutDownVideoStream = async () => {
        if (!videoStream) {
            return;
        }
        const videoTrack = videoStream.getTracks()[0];
        videoTrack?.stop();
    }

    const resetSettings = async () => {
        await removeFromStorage('settings.');
    }

    // Handle Shadertoy asset toggle with confirmation modal
    const handleDownloadAssetsToggle = (value: React.SetStateAction<boolean>) => {
        const newValue = typeof value === 'function' ? value(downloadShadertoyAssets) : value;
        if (newValue && !downloadShadertoyAssetsConfirmed && onOpenAssetConfirmModal) {
            // Show modal via parent instead of enabling directly
            onOpenAssetConfirmModal(
                (dontAskAgain) => {
                    // onConfirm callback
                    setDownloadShadertoyAssets(true);
                    if (dontAskAgain) {
                        setDownloadShadertoyAssetsConfirmed(true);
                    }
                },
                () => {
                    // onCancel callback - do nothing, keep setting disabled
                }
            );
        } else {
            // Either turning off, or already confirmed - enable directly
            setDownloadShadertoyAssets(newValue);
        }
    };

    useEffect(() => {
        const isAvailable = videoStream !== undefined;
        setIsVideoAvailable(isAvailable)
    }, [videoStream])

    useEffect(() => {
        if (showPreview) {
            setupVideoStream();
        } else {
            shutDownVideoStream();
        }
    }, [showPreview]);

    return (
        <>
        <div className={`flex flex-col space-y-4 select-none ${collapsed ? 'p-2' : 'p-4'}`}>
            <div className="flex items-center justify-between pb-4">
                {!collapsed && (
                    <div className="flex flex-col gap-1">
                        <h5 className="text-xl dark:text-blue-400">Settings</h5>
                        <button
                            onClick={onToggleTheme}
                            className="self-start px-2 py-0.5 rounded text-[10px] font-mono border border-indigo-400 text-indigo-400 bg-white dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                            title="Switch to Green skin"
                        >
                            🟢 Green
                        </button>
                    </div>
                )}
                {collapsed && <div className="w-5" />}
                <div className="flex items-center gap-1">
                    {/* AI Settings Button - hidden when collapsed */}
                    {!collapsed && (
                        <button
                            onClick={() => setShowAISettings(!showAISettings)}
                            className={`p-2 rounded-lg transition-colors ${
                                showAISettings 
                                    ? 'bg-purple-500/20 text-purple-400' 
                                    : 'text-gray-400 hover:text-purple-400 hover:bg-purple-500/10'
                            }`}
                            title="AI Settings"
                        >
                            <Cog6ToothIcon className="w-5 h-5" />
                        </button>
                    )}
                    {/* Collapse/Expand Toggle */}
                    <button
                        onClick={onToggleCollapse}
                        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <Bars3Icon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* AI Settings Panel */}
            {showAISettings && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-3">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-700">
                        <CpuChipIcon className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-gray-300">AI Provider</span>
                    </div>
                    
                    {/* Provider Selection */}
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                value="chrome"
                                checked={aiProvider === 'chrome'}
                                onChange={() => setAIProvider('chrome')}
                                className="w-4 h-4 text-purple-500 focus:ring-purple-500 bg-gray-700 border-gray-600"
                            />
                            <span className="text-sm text-gray-300">Chrome Built-in AI (Gemini Nano)</span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6">
                            Requires Chrome flags: Enable "Enables optimization guide on device" and "Prompt API for Gemini Nano"
                        </p>
                        
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                value="gemini"
                                checked={aiProvider === 'gemini'}
                                onChange={() => setAIProvider('gemini')}
                                className="w-4 h-4 text-purple-500 focus:ring-purple-500 bg-gray-700 border-gray-600"
                            />
                            <span className="text-sm text-gray-300">Google Gemini API (Free Tier)</span>
                        </label>
                        
                        {/* Gemini API Key Input */}
                        {aiProvider === 'gemini' && (
                            <div className="ml-6 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <KeyIcon className="w-4 h-4 text-gray-400" />
                                    <input
                                        type="password"
                                        placeholder="Enter Gemini API Key"
                                        value={geminiApiKey}
                                        onChange={(e) => setGeminiApiKey(e.target.value)}
                                        className="flex-1 px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:text-purple-300 underline"
                                >
                                    Get your free API key from Google AI Studio →
                                </a>
                                {geminiStatus === 'valid' && (
                                    <p className="text-xs text-green-400">✓ Gemini API connected</p>
                                )}
                                {geminiStatus === 'invalid' && geminiApiKey && (
                                    <p className="text-xs text-red-400">✗ Invalid API key</p>
                                )}
                                
                                {/* Model Selection */}
                                <div className="pt-2">
                                    <label className="text-xs text-gray-400 block mb-1">Model</label>
                                    <select
                                        value={isCustomModel ? 'custom' : geminiModel}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === 'custom') {
                                                setIsCustomModel(true);
                                                setCustomModelId(geminiModel);
                                            } else {
                                                setIsCustomModel(false);
                                                setGeminiModel(value);
                                            }
                                        }}
                                        className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-purple-500"
                                    >
                                        {availableModels.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name} {model.recommended ? '(Recommended)' : ''}
                                            </option>
                                        ))}
                                        <option value="custom">Custom...</option>
                                    </select>
                                    
                                    {/* Custom Model Input */}
                                    {isCustomModel && (
                                        <div className="mt-2 space-y-1">
                                            <input
                                                type="text"
                                                placeholder="Enter model ID (e.g., gemini-2.5-flash-preview)"
                                                value={customModelId}
                                                onChange={(e) => {
                                                    setCustomModelId(e.target.value);
                                                    setGeminiModel(e.target.value);
                                                }}
                                                className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                            />
                                            <p className="text-xs text-amber-400">
                                                Custom model IDs may not work. Check Google AI docs for valid names.
                                            </p>
                                        </div>
                                    )}
                                    
                                    {!isCustomModel && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Flash models are faster and cheaper. Pro models are more capable but slower.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* OpenRouter Option */}
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                value="openrouter"
                                checked={aiProvider === 'openrouter'}
                                onChange={() => setAIProvider('openrouter')}
                                className="w-4 h-4 text-purple-500 focus:ring-purple-500 bg-gray-700 border-gray-600"
                            />
                            <span className="text-sm text-gray-300">OpenRouter (Multiple AI Providers)</span>
                        </label>
                        
                        {/* OpenRouter API Key Input */}
                        {aiProvider === 'openrouter' && (
                            <div className="ml-6 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <KeyIcon className="w-4 h-4 text-gray-400" />
                                    <input
                                        type="password"
                                        placeholder="Enter OpenRouter API Key"
                                        value={openRouterApiKey}
                                        onChange={(e) => setOpenRouterApiKey(e.target.value)}
                                        className="flex-1 px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <a
                                    href="https://openrouter.ai/keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:text-purple-300 underline"
                                >
                                    Get your API key from OpenRouter →
                                </a>
                                {openRouterStatus === 'valid' && (
                                    <p className="text-xs text-green-400">✓ OpenRouter API connected</p>
                                )}
                                {openRouterStatus === 'invalid' && openRouterApiKey && (
                                    <p className="text-xs text-red-400">✗ Invalid API key</p>
                                )}
                                
                                {/* Model Selection */}
                                <div className="pt-2">
                                    <label className="text-xs text-gray-400 block mb-1">Model</label>
                                    <select
                                        value={isCustomModel ? 'custom' : openRouterModel}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === 'custom') {
                                                setIsCustomModel(true);
                                                setCustomModelId(openRouterModel);
                                            } else {
                                                setIsCustomModel(false);
                                                setOpenRouterModel(value);
                                            }
                                        }}
                                        className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-purple-500"
                                    >
                                        {availableModels.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name} {model.recommended ? '(Recommended)' : ''}
                                            </option>
                                        ))}
                                        <option value="custom">Custom...</option>
                                    </select>
                                    
                                    {/* Custom Model Input */}
                                    {isCustomModel && (
                                        <div className="mt-2 space-y-1">
                                            <input
                                                type="text"
                                                placeholder="provider/model (e.g., openai/gpt-4o, anthropic/claude-3-opus)"
                                                value={customModelId}
                                                onChange={(e) => {
                                                    setCustomModelId(e.target.value);
                                                    setOpenRouterModel(e.target.value);
                                                }}
                                                className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                            />
                                            <p className="text-xs text-amber-400">
                                                Use format: provider/model-name. See openrouter.ai/docs/models
                                            </p>
                                        </div>
                                    )}
                                    
                                    {!isCustomModel && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            GPT-4o Mini is cheapest. Claude 3.5 Sonnet has best code quality.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Ollama Option */}
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                value="ollama"
                                checked={aiProvider === 'ollama'}
                                onChange={() => setAIProvider('ollama')}
                                className="w-4 h-4 text-purple-500 focus:ring-purple-500 bg-gray-700 border-gray-600"
                            />
                            <span className="text-sm text-gray-300">Ollama (Self-Hosted)</span>
                        </label>
                        
                        {/* Ollama Settings Input */}
                        {aiProvider === 'ollama' && (
                            <div className="ml-6 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        placeholder="http://localhost:11434"
                                        value={ollamaBaseUrl}
                                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                                        className="flex-1 px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <a
                                    href="https://ollama.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:text-purple-300 underline"
                                >
                                    Download Ollama →
                                </a>
                                {ollamaStatus === 'valid' && (
                                    <p className="text-xs text-green-400">✓ Ollama connected</p>
                                )}
                                {ollamaStatus === 'invalid' && ollamaBaseUrl && (
                                    <p className="text-xs text-red-400">✗ Could not connect to Ollama</p>
                                )}
                                
                                {/* CORS Help Text */}
                                <div className="mt-2 text-xs text-gray-500 space-y-1 bg-gray-800/50 p-2 rounded">
                                    <p className="font-medium text-gray-400">Connection issues?</p>
                                    <p>Start Ollama with CORS enabled:</p>
                                    <code className="block bg-gray-900 p-1.5 rounded text-gray-400 font-mono text-[10px]">
                                        OLLAMA_ORIGINS=&quot;*&quot; ollama serve
                                    </code>
                                    <p className="text-[10px] text-gray-500">
                                        Or for specific extension: <code className="text-gray-400">OLLAMA_ORIGINS=&quot;chrome-extension://*&quot;</code>
                                    </p>
                                </div>
                                
                                {/* Model Selection */}
                                <div className="pt-2">
                                    <label className="text-xs text-gray-400 block mb-1">Model</label>
                                    <select
                                        value={isCustomModel ? 'custom' : ollamaModel}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === 'custom') {
                                                setIsCustomModel(true);
                                                setCustomModelId(ollamaModel);
                                            } else {
                                                setIsCustomModel(false);
                                                setOllamaModel(value);
                                            }
                                        }}
                                        className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-purple-500"
                                    >
                                        {availableModels.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name} {model.recommended ? '(Recommended)' : ''}
                                            </option>
                                        ))}
                                        <option value="custom">Custom...</option>
                                    </select>
                                    
                                    {/* Custom Model Input */}
                                    {isCustomModel && (
                                        <div className="mt-2 space-y-1">
                                            <input
                                                type="text"
                                                placeholder="model-name (e.g., llama3.2, codellama)"
                                                value={customModelId}
                                                onChange={(e) => {
                                                    setCustomModelId(e.target.value);
                                                    setOllamaModel(e.target.value);
                                                }}
                                                className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                            />
                                            <p className="text-xs text-amber-400">
                                                Run `ollama pull model-name` first to download the model
                                            </p>
                                        </div>
                                    )}
                                    
                                    {!isCustomModel && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Llama 3.2 is fast. CodeLlama is best for code generation.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Prompt Editor */}
                    <div className="pt-2 border-t border-gray-700">
                        <button
                            onClick={() => setShowPromptEditor(!showPromptEditor)}
                            className="flex items-center justify-between w-full text-xs text-gray-400 hover:text-purple-400 transition-colors"
                        >
                            <span>Advanced: Prompts</span>
                            <span>{showPromptEditor ? '▲' : '▼'}</span>
                        </button>
                        {showPromptEditor && (
                            <div className="mt-2 space-y-3">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Fix Errors Prompt</label>
                                        <button
                                            onClick={() => setAiPromptFix('')}
                                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                        >Reset</button>
                                    </div>
                                    <textarea
                                        value={aiPromptFix}
                                        onChange={(e) => setAiPromptFix(e.target.value)}
                                        placeholder="Leave empty to use default prompt"
                                        rows={6}
                                        className="w-full px-2 py-1.5 text-xs font-mono bg-gray-900 border border-gray-600 rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-y"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-gray-400">Generate Prompt</label>
                                        <button
                                            onClick={() => setAiPromptGenerate('')}
                                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                        >Reset</button>
                                    </div>
                                    <textarea
                                        value={aiPromptGenerate}
                                        onChange={(e) => setAiPromptGenerate(e.target.value)}
                                        placeholder="Leave empty to use default prompt"
                                        rows={6}
                                        className="w-full px-2 py-1.5 text-xs font-mono bg-gray-900 border border-gray-600 rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-y"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 italic">Changes apply immediately. Reset clears to built-in default.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!collapsed ? (
                <>
            { /* Preview */}
            <Toggle label="Show Preview (experimental)" checked={showPreview} updateValue={setShowPreview} />
            {showPreview && <div className="flex flex-col items-center">
                <p className="text-xs text-gray-500">
                    {shaderCatalog.shaders[shaderIndex]?.shaderName || currentShader?.shaderName || 'Current shader'}
                </p>
                <video ref={videoElement} className={`max-w-44 max-h-44 rounded-lg ${(!isVideoAvailable ? 'hidden' : '')}`} playsInline autoPlay muted />
                {!isVideoAvailable && <div className="w-full rounded-lg font-semibold italic text-gray-900 dark:text-gray-300 bg-orange-800 items-center flex flex-row">
                    <p className="p-2">Preview stream not available.</p>
                    <VideoCameraSlashIcon className="flex h-6 w-6" />
                </div>}
                { /* Previous/next buttons */ }
                <div className="flex flex-row mx-auto">
                    <button type="button" className="bg-indigo-700 text-white rounded-l-md border-r border-gray-100 py-2 hover:bg-indigo-800 hover:text-white px-3"
                        onClick={() => cycleShaders(false)}>
                        <div className="flex flex-row align-middle">
                            <ArrowLongLeftIcon className="w-5 mr-2"/>
                            <p className="ml-2">Prev</p>
                        </div>
                    </button>
                    <button type="button" className="bg-indigo-700 text-white rounded-r-md py-2 border-l border-gray-200 hover:bg-indigo-800 hover:text-white px-3" 
                    onClick={() => cycleShaders(true)}>
                        <div className="flex flex-row align-middle">
                            <span className="mr-2">Next</span>
                            <ArrowLongRightIcon className="w-5 ml-2"/>
                        </div>
                    </button>
                </div>
                <div className="flex flex-row mx-auto py-1 space-x-1">
                    { /* Decrease time */ }
                    <button className="p-3 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800"
                        onClick={decrementTime}><div className="flex flex-row align-middle">
                        <ChevronDoubleLeftIcon className="w-5"/>
                        </div>
                    </button>
                    { /* Reset time */ }
                    <button className="p-3 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800"
                        onClick={resetTime}><div className="flex flex-row align-middle">
                        <ClockIcon className="w-5"/>
                        </div>
                    </button>
                    { /* Increase time */ }
                    <button className="p-3 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800"
                        onClick={incrementTime}><div className="flex flex-row align-middle">
                        <ChevronDoubleRightIcon className="w-5"/>
                        </div>
                    </button>
                </div>
            </div>}

            { /* Webcam */}
            <div className="flex flex-col space-y-2">
                <div>
                    <Toggle label="Use webcam video input" checked={useWebcam} updateValue={setUseWebcam} icon={<VideoCameraIcon className="h-4 w-4 ml-2 stroke-indigo-500" />} />
                    <p className="text-gray-500 text-xs italic">Requires webcam access</p>
                </div>
                <div>
                    <Toggle label="Use webcam audio input" checked={useWebcamAudio} updateValue={setUseWebcamAudio} icon={<MusicalNoteIcon className="h-4 w-4 ml-2 stroke-indigo-500" />} />
                    <p className="text-gray-500 text-xs italic">Requires webcam access and this overrides the source tab audio.</p>
                    <p className="text-gray-500 text-xs italic">Warning: This is an experimental feature and may not work properly!</p>
                </div>
                <div>
                    <Toggle label="Use screen/app share as input" checked={useDisplayCapture} updateValue={setUseDisplayCapture} icon={<VideoCameraIcon className="h-4 w-4 ml-2 stroke-indigo-500" />} />
                    <p className="text-gray-500 text-xs italic">Share a screen, window or tab as video background and audio source. On Firefox this replaces the default screen share.</p>
                </div>
            </div>

            {/* Shader Credits toggle */}
            <Toggle label="Show shader credits" checked={showShaderCredits} updateValue={setShowShaderCredits} />
            
            {/* Show Tab Title toggle */}
            <Toggle 
                label="Show tab title" 
                checked={showTabTitle} 
                updateValue={setShowTabTitle} 
                disabled={false}
            />
            
            {/* FPS Counter toggle */}
            <Toggle 
                label="Show FPS counter" 
                checked={showFps} 
                updateValue={setShowFps} 
                disabled={false}
            />

            {/* Shader Fade toggle */}
            <Toggle 
                label="Fade shader transitions" 
                checked={shaderFade} 
                updateValue={setShaderFade} 
                disabled={false}
            />
            <p className="text-gray-500 text-xs italic">Enable smooth fade transitions between shaders</p>

            { /* Random shader toggle */}
            <Toggle label="Play random shader" checked={playRandomShader} updateValue={setPlayRandomShader} />

            { /* Random shader sliders */}
            {playRandomShader && (
                <>
                    <RangeSlider label="Randomize time" value={randomizeTime} updateValue={setRandomizeTime}
                        min="0" max="60" step="1" />
                    <RangeSlider label="Variation" value={randomizeVariation} updateValue={setRandomizeVariation}
                        min="0" max="5" step="1" />
                </>
            )}

            { /* Beat-based randomization toggle */}
            <Toggle label="Randomize on beat" checked={randomizeBeat} updateValue={setRandomizeBeat} />

            { /* Beat interval slider */}
            {randomizeBeat && (
                <RangeSlider label="Beat interval" value={randomizeBeatInterval} updateValue={setRandomizeBeatInterval}
                    min="1" max="255" step="1" />
            )}

            { /* Render Resolution */}
            <div className="flex flex-col space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Render Resolution
                </label>
                <select
                    value={renderScale}
                    onChange={(e) => setRenderScale(parseFloat(e.target.value))}
                    className="text-xs px-2 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                >
                    <option value="1.0">Full (100%)</option>
                    <option value="0.75">3/4 (75%)</option>
                    <option value="0.6666666666666666">2/3 (66%)</option>
                    <option value="0.5">1/2 (50%)</option>
                    <option value="0.3333333333333333">1/3 (33%)</option>
                    <option value="0.25">1/4 (25%)</option>
                </select>
                <p className="text-gray-500 text-xs italic">
                    Lower values render fewer pixels and scale up, improving performance on slower hardware.
                </p>
            </div>

            { /* Enable iAmplifiedTime (CPU audio-reactive time) toggle */}
            <Toggle 
                label="Enable iAmplifiedTime" 
                checked={enableIAmplifiedTime} 
                updateValue={setEnableIAmplifiedTime} 
                disabled={false}
            />
            <p className="text-gray-500 text-xs italic mb-3">When enabled, iAmplifiedTime is updated every frame based on audio input. Disable to save CPU.</p>

            { /* Use iAmplifiedTime for Imports toggle - only shown when main toggle is enabled */}
            {enableIAmplifiedTime && (
                <>
                    <Toggle 
                        label="Use iAmplifiedTime for Shadertoy imports" 
                        checked={useIAmplifiedTime} 
                        updateValue={setUseIAmplifiedTime} 
                        disabled={false}
                    />
                    <p className="text-gray-500 text-xs italic">When enabled, imported Shadertoy shaders get their time code transformed to use iAmplifiedTime</p>
                </>
            )}

            <Toggle 
                label="Import assets when importing from Shadertoy" 
                checked={downloadShadertoyAssets} 
                updateValue={handleDownloadAssetsToggle} 
                disabled={false}
            />

            { /* Speed slider */}
            <RangeSlider label="Speed divider" value={speedDivider} updateValue={setSpeedDivider}
                min="0.1" max="100" step="0.1" />

            { /* Volume amplifier slider */}
            <RangeSlider label="Volume amplifier" value={volumeAmpifier} updateValue={setVolumeAmplifier}
                min="0.1" max="10" step="0.1" />
            <p className="text-gray-500 text-xs italic">This multiplies the source volume</p>

            { /* 10-band Equalizer */}
            <div className="flex flex-col space-y-2">
                <button
                    onClick={() => setShowEq(!showEq)}
                    className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-400 transition-colors"
                >
                    <span>Equalizer</span>
                    <span className="text-xs text-gray-500">{showEq ? '▲' : '▼'}</span>
                </button>
                {showEq && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3 space-y-2">
                        <div className="flex items-end justify-between gap-1" style={{height: '96px'}}>
                            {EQ_FREQUENCIES.map((label, i) => (
                                <div key={label} className="flex flex-col items-center flex-1 gap-1">
                                    <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="0.5"
                                        value={(eqGains ?? EQ_DEFAULT_GAINS)[i] ?? 0}
                                        onChange={(e) => {
                                            const next = [...(eqGains ?? EQ_DEFAULT_GAINS)];
                                            next[i] = parseFloat(e.target.value);
                                            setEqGains(next);
                                        }}
                                        className="accent-indigo-500"
                                        style={{
                                            writingMode: 'vertical-lr' as any,
                                            direction: 'rtl' as any,
                                            width: '100%',
                                            height: '80px',
                                            cursor: 'pointer',
                                        } as React.CSSProperties}
                                        title={`${label}: ${((eqGains ?? EQ_DEFAULT_GAINS)[i] ?? 0) > 0 ? '+' : ''}${((eqGains ?? EQ_DEFAULT_GAINS)[i] ?? 0)} dB`}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex items-end justify-between gap-1">
                            {EQ_FREQUENCIES.map((label) => (
                                <div key={label} className="flex-1 flex justify-center">
                                    <span className="text-[9px] text-gray-500 leading-none">{label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-gray-500">
                                {(eqGains ?? EQ_DEFAULT_GAINS).every(g => g === 0) ? 'Flat' : 'Modified'}
                            </span>
                            <button
                                onClick={() => setEqGains([...EQ_DEFAULT_GAINS])}
                                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                            >
                                Reset EQ
                            </button>
                        </div>
                        <div className="pt-2 border-t border-gray-700">
                            <Toggle
                                label="Apply EQ to playback audio"
                                checked={eqApplyToOutput}
                                updateValue={setEqApplyToOutput}
                            />
                            <p className="text-gray-500 text-xs italic mt-1">Routes the EQ-filtered signal to the speaker. May affect tab audio quality.</p>
                        </div>
                    </div>
                )}
                <p className="text-gray-500 text-xs italic">Boost or cut individual frequency bands before they reach the shader.</p>
            </div>

            { /* Debug logging toggle */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Toggle 
                    label="Enable debug logging" 
                    checked={debugLogging} 
                    updateValue={(value) => {
                        const newValue = typeof value === 'function' ? value(debugLogging) : value;
                        setDebugLogging(newValue);
                        updateDebugCache(newValue);
                        if (newValue) {
                            logger.options.log('Options', 'Debug logging enabled');
                        }
                    }}
                    disabled={false}
                />
                <p className="text-gray-500 text-xs italic">
                    When enabled, captures logs from all extension contexts. Reload content tabs for full effect.
                </p>
                <button
                    onClick={() => onOpenDebugLogs?.()}
                    disabled={!debugLogging}
                    className={`mt-2 text-xs px-3 py-1.5 rounded transition-colors ${
                        debugLogging 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    View Debug Logs
                </button>
            </div>
            
            { /* Actions */ }
            <p className="my-4 text-lg text-gray-500 dark:text-white-500">Actions</p>
            <div className="flex flex-col flex-wrap">
            
                { /* Reset settings */ }
                <button className="p-3 text-white font-medium transition-colors duration-150 bg-red-700 rounded-lg focus:shadow-outline hover:bg-red-800"
                    onClick={resetSettings}>Reset settings</button>
            </div>

            { /* About / Credits */ }
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={onAboutClick}
                    className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-400 dark:hover:text-indigo-400 transition-colors text-left"
                >
                    About ShaderAmp
                </button>
            </div>
                </>
            ) : (
                /* Collapsed view - minimal icon buttons */
                <div className="flex flex-col items-center gap-4 mt-4">
                    <button
                        onClick={() => cycleShaders(false)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Previous Shader"
                    >
                        <ArrowLongLeftIcon className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => cycleShaders(true)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Next Shader"
                    >
                        <ArrowLongRightIcon className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => sendMessage(RESET_TIME)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Reset Time"
                    >
                        <ClockIcon className="w-6 h-6" />
                    </button>
                </div>
            )}

        </div>

        </>
    )
}