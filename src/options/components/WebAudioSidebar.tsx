import { acquireVideoStream } from '@src/helpers/optionsActions';
import browser from "webextension-polyfill";
import React, { useEffect, useRef, useState } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import type { ShaderCatalog } from "@src/helpers/types";
import { removeFromStorage } from '@src/storage/storage';
import {
    SETTINGS_RANDOMIZE_SHADERS, SETTINGS_RANDOMIZE_TIME, SETTINGS_RANDOMIZE_VARIATION,
    SETTINGS_RANDOMIZE_BEAT, SETTINGS_RANDOMIZE_BEAT_INTERVAL, SETTINGS_SPEEDDIVIDER,
    SETTINGS_WEBCAM, STATE_SHADERINDEX, STATE_SHADERLIST, SETTINGS_SHADEROPTIONS,
    STATE_SHOWSHADERCREDITS, STATE_SHOWPREVIEW, SETTINGS_WEBCAM_AUDIO,
    SETTINGS_VOLUME_AMPLIFIER, SETTINGS_SHOW_TAB_TITLE, SETTINGS_SHOW_FPS,
    SETTINGS_SHADER_FADE, SETTINGS_RENDER_SCALE, SETTINGS_USE_IAMPLIFIED_TIME,
    SETTINGS_ENABLE_IAMPLIFIED_TIME, SETTINGS_DISPLAY_CAPTURE,
    SETTINGS_DOWNLOAD_SHADERTOY_ASSETS, SETTINGS_DOWNLOAD_SHADERTOY_ASSETS_CONFIRMED,
    SETTINGS_AI_PROVIDER, SETTINGS_GEMINI_API_KEY, SETTINGS_GEMINI_MODEL,
    SETTINGS_OPENROUTER_API_KEY, SETTINGS_OPENROUTER_MODEL, SETTINGS_OLLAMA_BASE_URL,
    SETTINGS_OLLAMA_MODEL, SETTINGS_DEBUG_LOGGING, SETTINGS_EQ_GAINS,
    SETTINGS_EQ_APPLY_TO_OUTPUT, SETTINGS_AI_PROMPT_FIX, SETTINGS_AI_PROMPT_GENERATE,
    SETTINGS_UI_SPEED_OPEN, SETTINGS_UI_RANDOMIZE_OPEN
} from '@src/storage/storageConstants';
import { logger, initDebugCache, updateDebugCache } from '@src/helpers/logger';
import { RESET_TIME, PREV_SHADER, NEXT_SHADER, DECR_TIME, INCR_TIME } from '@src/helpers/constants';
import { ArrowLongLeftIcon, ArrowLongRightIcon, ClockIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, VideoCameraSlashIcon, Cog6ToothIcon, CpuChipIcon, KeyIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

type Props = {
    onAboutClick: () => void;
    onOpenDebugLogs?: () => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onOpenAssetConfirmModal?: (onConfirm: (dontAskAgain: boolean) => void, onCancel: () => void) => void;
    uiTheme?: 'classic' | 'audio';
    onToggleTheme?: () => void;
};

// Rack color palette: bgOff;active;body
const KNOB_COLORS = '#2a2a3a;#00ff88;#1a1a2a';
const SWITCH_COLORS = '#0d0d1a;#00ff88;#1a1a2a';
const SLIDER_COLORS = '#2a2a3a;#00ff88;#1a1a2a';

function RackKnob({
    label, value, min, max, step, onChange, diameter = 48, tooltip
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    diameter?: number;
    tooltip?: string;
}) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        const el = ref.current as any;
        if (!el) return;
        el.min = min;
        el.max = max;
        el.step = step;
    }, [min, max, step]);

    useEffect(() => {
        const el = ref.current as any;
        if (!el) return;
        if (el.value !== value) el.value = value;
    }, [value]);

    useEffect(() => {
        const el = ref.current as any;
        if (!el) return;
        const handler = () => onChange(parseFloat(el.value));
        el.addEventListener('input', handler);
        return () => el.removeEventListener('input', handler);
    }, [onChange]);

    return (
        <div className="flex flex-col items-center gap-1">
            <webaudio-knob
                ref={ref as any}
                min={min}
                max={max}
                step={step}
                value={value}
                diameter={diameter}
                colors={KNOB_COLORS}
                tooltip={tooltip ?? `${label}: %s`}
            />
            <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest leading-none text-center">{label}</span>
            <span className="text-[9px] font-mono text-green-600">{value}</span>
        </div>
    );
}

function RackSwitch({
    label, value, onChange
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none group">
            <button
                role="switch"
                aria-checked={value}
                onClick={() => onChange(!value)}
                className={`relative inline-flex items-center w-9 h-5 rounded-full border transition-colors duration-200 focus:outline-none ${
                    value
                        ? 'bg-green-500 border-green-400'
                        : 'bg-[#0d0d1a] border-green-900'
                }`}
            >
                <span className={`inline-block w-3.5 h-3.5 rounded-full transition-transform duration-200 shadow ${
                    value
                        ? 'translate-x-[18px] bg-[#0d0d1a]'
                        : 'translate-x-[2px] bg-green-900'
                }`} />
            </button>
            <span className={`text-xs font-mono transition-colors duration-150 ${value ? 'text-green-300' : 'text-green-700'}`}>{label}</span>
        </label>
    );
}

function RackVSlider({
    label, value, min, max, step, onChange, width = 16, height = 80, tooltip
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    width?: number;
    height?: number;
    tooltip?: string;
}) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        const el = ref.current as any;
        if (!el) return;
        el.min = min; el.max = max; el.step = step;
    }, [min, max, step]);

    useEffect(() => {
        const el = ref.current as any;
        if (!el) return;
        if (el.value !== value) el.value = value;
    }, [value]);

    useEffect(() => {
        const el = ref.current as any;
        if (!el) return;
        const handler = () => onChange(parseFloat(el.value));
        el.addEventListener('input', handler);
        return () => el.removeEventListener('input', handler);
    }, [onChange]);

    return (
        <div className="flex flex-col items-center gap-1">
            <webaudio-slider
                ref={ref as any}
                direction="vert"
                min={min}
                max={max}
                step={step}
                value={value}
                width={width}
                height={height}
                colors={SLIDER_COLORS}
                tooltip={tooltip ?? `${label}: %s`}
            />
            <span className="text-[8px] font-mono text-green-500 leading-none">{label}</span>
        </div>
    );
}

function RackSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="border border-green-900 rounded bg-[#12121f] p-2 space-y-2">
            <div className="text-[9px] font-mono text-green-600 uppercase tracking-[0.2em] border-b border-green-900 pb-1">{title}</div>
            {children}
        </div>
    );
}

export default function WebAudioSidebar({ onAboutClick, onOpenDebugLogs, collapsed = false, onToggleCollapse, onOpenAssetConfirmModal, onToggleTheme }: Props) {
    const videoElement = useRef<HTMLVideoElement>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | undefined>();
    const [isVideoAvailable, setIsVideoAvailable] = useState<boolean>(true);

    const [shaderIndex] = useChromeStorageLocal(STATE_SHADERINDEX, 0);
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
    const [volumeAmplifier, setVolumeAmplifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);
    const EQ_FREQUENCIES = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
    const EQ_DEFAULT_GAINS: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const [eqGains, setEqGains] = useChromeStorageLocal<number[]>(SETTINGS_EQ_GAINS, EQ_DEFAULT_GAINS);
    const [eqApplyToOutput, setEqApplyToOutput] = useChromeStorageLocal(SETTINGS_EQ_APPLY_TO_OUTPUT, false);
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
    const [showEq, setShowEq] = useState(false);
    const [speedOpen, setSpeedOpen] = useChromeStorageLocal(SETTINGS_UI_SPEED_OPEN, true);
    const [randomizeOpen, setRandomizeOpen] = useChromeStorageLocal(SETTINGS_UI_RANDOMIZE_OPEN, true);

    const [aiProvider, setAIProvider] = useChromeStorageLocal<'chrome' | 'gemini' | 'openrouter' | 'ollama'>(SETTINGS_AI_PROVIDER, 'chrome');
    const [geminiApiKey, setGeminiApiKey] = useChromeStorageLocal(SETTINGS_GEMINI_API_KEY, '');
    const [geminiModel, setGeminiModel] = useChromeStorageLocal(SETTINGS_GEMINI_MODEL, 'gemini-1.5-flash');
    const [openRouterApiKey, setOpenRouterApiKey] = useChromeStorageLocal(SETTINGS_OPENROUTER_API_KEY, '');
    const [openRouterModel, setOpenRouterModel] = useChromeStorageLocal(SETTINGS_OPENROUTER_MODEL, 'openai/gpt-4o-mini');
    const [ollamaBaseUrl, setOllamaBaseUrl] = useChromeStorageLocal(SETTINGS_OLLAMA_BASE_URL, 'http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useChromeStorageLocal(SETTINGS_OLLAMA_MODEL, 'llama3.2');
    const [aiPromptFix, setAiPromptFix] = useChromeStorageLocal(SETTINGS_AI_PROMPT_FIX, '');
    const [aiPromptGenerate, setAiPromptGenerate] = useChromeStorageLocal(SETTINGS_AI_PROMPT_GENERATE, '');
    const [showAISettings, setShowAISettings] = useState(false);
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState<'uninitialized' | 'valid' | 'invalid'>('uninitialized');
    const [openRouterStatus, setOpenRouterStatus] = useState<'uninitialized' | 'valid' | 'invalid'>('uninitialized');
    const [ollamaStatus, setOllamaStatus] = useState<'uninitialized' | 'valid' | 'invalid'>('uninitialized');
    const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string, recommended?: boolean}>>([]);
    const [customModelId, setCustomModelId] = useState('');
    const [isCustomModel, setIsCustomModel] = useState(false);

    useEffect(() => {
        import('@src/helpers/aiService').then(({ setPromptFix, setPromptGenerate, DEFAULT_PROMPT_FIX_ERRORS, DEFAULT_PROMPT_GENERATE }) => {
            setPromptFix(aiPromptFix || DEFAULT_PROMPT_FIX_ERRORS);
            setPromptGenerate(aiPromptGenerate || DEFAULT_PROMPT_GENERATE);
        });
    }, [aiPromptFix, aiPromptGenerate]);

    useEffect(() => {
        if (showAISettings) {
            if (aiProvider === 'gemini') {
                import('@src/helpers/geminiAIService').then(({ AVAILABLE_GEMINI_MODELS }) => setAvailableModels(AVAILABLE_GEMINI_MODELS));
            } else if (aiProvider === 'openrouter') {
                import('@src/helpers/openRouterAIService').then(({ AVAILABLE_OPENROUTER_MODELS }) => setAvailableModels(AVAILABLE_OPENROUTER_MODELS));
            } else if (aiProvider === 'ollama') {
                import('@src/helpers/ollamaAIService').then(({ AVAILABLE_OLLAMA_MODELS }) => setAvailableModels(AVAILABLE_OLLAMA_MODELS));
            }
        }
    }, [showAISettings, aiProvider]);

    useEffect(() => {
        if (aiProvider === 'gemini' && geminiApiKey && geminiApiKey.length > 10) {
            import('@src/helpers/aiService').then(({ initGeminiAI }) => {
                setGeminiStatus(initGeminiAI(geminiApiKey, geminiModel) ? 'valid' : 'invalid');
            });
        }
    }, [aiProvider, geminiApiKey, geminiModel]);

    useEffect(() => {
        if (aiProvider === 'openrouter' && openRouterApiKey && openRouterApiKey.length > 10) {
            import('@src/helpers/aiService').then(({ initOpenRouterAI }) => {
                setOpenRouterStatus(initOpenRouterAI(openRouterApiKey, openRouterModel) ? 'valid' : 'invalid');
            });
        }
    }, [aiProvider, openRouterApiKey, openRouterModel]);

    useEffect(() => {
        if (aiProvider === 'ollama' && ollamaBaseUrl) {
            import('@src/helpers/aiService').then(({ initOllamaAI }) => {
                setOllamaStatus(initOllamaAI(ollamaBaseUrl, ollamaModel) ? 'valid' : 'invalid');
            });
        }
    }, [aiProvider, ollamaBaseUrl, ollamaModel]);

    useEffect(() => {
        import('@src/helpers/aiService').then(({ setAIProvider }) => setAIProvider(aiProvider));
    }, [aiProvider]);

    useEffect(() => { initDebugCache(); }, []);

    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes[SETTINGS_DEBUG_LOGGING]) updateDebugCache(changes[SETTINGS_DEBUG_LOGGING].newValue);
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const sendMessage = (command: string) => {
        browser.runtime.sendMessage({ command }).catch(error => console.error(error));
    };
    const cycleShaders = (next: boolean) => sendMessage(next ? NEXT_SHADER : PREV_SHADER);

    const setupVideoStream = async () => {
        const stream = await acquireVideoStream(videoElement.current as HTMLVideoElement);
        setVideoStream(stream);
    };
    const shutDownVideoStream = async () => {
        if (!videoStream) return;
        videoStream.getTracks()[0]?.stop();
    };
    const resetSettings = async () => { await removeFromStorage('settings.'); };

    const handleDownloadAssetsToggle = (value: boolean) => {
        if (value && !downloadShadertoyAssetsConfirmed && onOpenAssetConfirmModal) {
            onOpenAssetConfirmModal(
                (dontAskAgain) => {
                    setDownloadShadertoyAssets(true);
                    if (dontAskAgain) setDownloadShadertoyAssetsConfirmed(true);
                },
                () => {}
            );
        } else {
            setDownloadShadertoyAssets(value);
        }
    };

    useEffect(() => { setIsVideoAvailable(videoStream !== undefined); }, [videoStream]);
    useEffect(() => {
        if (showPreview) setupVideoStream(); else shutDownVideoStream();
    }, [showPreview]);

    const eqGainsArr = eqGains ?? EQ_DEFAULT_GAINS;

    if (collapsed) {
        return (
            <div className="flex flex-col items-center gap-4 p-2 bg-[#0d0d1a] min-h-screen">
                <button onClick={onToggleCollapse}
                    className="p-2 rounded text-green-600 hover:text-green-400 transition-colors"
                    title="Expand sidebar">
                    <Bars3Icon className="w-5 h-5" />
                </button>
                <button onClick={() => cycleShaders(false)} className="p-2 text-green-600 hover:text-green-400" title="Previous Shader">
                    <ArrowLongLeftIcon className="w-6 h-6" />
                </button>
                <button onClick={() => cycleShaders(true)} className="p-2 text-green-600 hover:text-green-400" title="Next Shader">
                    <ArrowLongRightIcon className="w-6 h-6" />
                </button>
                <button onClick={() => sendMessage(RESET_TIME)} className="p-2 text-green-600 hover:text-green-400" title="Reset Time">
                    <ClockIcon className="w-6 h-6" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-3 p-3 bg-[#0d0d1a] min-h-screen font-mono select-none">

            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-green-900">
                <div className="flex flex-col gap-1">
                    <span className="text-green-400 text-sm font-mono tracking-widest uppercase">Settings</span>
                    <button
                        onClick={onToggleTheme}
                        className="self-start px-2 py-0.5 rounded text-[10px] font-mono border border-green-700 text-green-400 bg-[#0d0d1a] hover:bg-green-900/30 transition-colors"
                        title="Switch to Classic skin"
                    >
                        ⚙ Classic
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowAISettings(!showAISettings)}
                        className={`p-1.5 rounded transition-colors ${showAISettings ? 'text-green-400 bg-green-900/30' : 'text-green-700 hover:text-green-400'}`}
                        title="AI Settings">
                        <Cog6ToothIcon className="w-4 h-4" />
                    </button>
                    <button onClick={onToggleCollapse}
                        className="p-1.5 rounded text-green-700 hover:text-green-400 transition-colors"
                        title="Collapse sidebar">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* AI Settings Panel — reuse existing structure, restyled */}
            {showAISettings && (
                <div className="border border-green-900 rounded bg-[#12121f] p-2 space-y-2">
                    <div className="flex items-center gap-2 pb-1 border-b border-green-900">
                        <CpuChipIcon className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-[10px] text-green-400 uppercase tracking-widest">AI Provider</span>
                    </div>
                    <div className="space-y-1.5">
                        {(['chrome', 'gemini', 'openrouter', 'ollama'] as const).map(p => (
                            <label key={p} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" value={p} checked={aiProvider === p} onChange={() => setAIProvider(p)}
                                    className="w-3 h-3 accent-green-500" />
                                <span className="text-xs text-green-300">{p === 'chrome' ? 'Chrome Built-in (Nano)' : p === 'gemini' ? 'Google Gemini' : p === 'openrouter' ? 'OpenRouter' : 'Ollama (local)'}</span>
                            </label>
                        ))}
                    </div>
                    {aiProvider === 'gemini' && (
                        <div className="ml-4 space-y-1.5">
                            <div className="flex items-center gap-1">
                                <KeyIcon className="w-3 h-3 text-green-700" />
                                <input type="password" placeholder="Gemini API Key" value={geminiApiKey}
                                    onChange={e => setGeminiApiKey(e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-600" />
                            </div>
                            {geminiStatus === 'valid' && <p className="text-[10px] text-green-400">✓ Connected</p>}
                            {geminiStatus === 'invalid' && geminiApiKey && <p className="text-[10px] text-red-400">✗ Invalid key</p>}
                            <select value={isCustomModel ? 'custom' : geminiModel}
                                onChange={e => { if (e.target.value === 'custom') { setIsCustomModel(true); setCustomModelId(geminiModel); } else { setIsCustomModel(false); setGeminiModel(e.target.value); } }}
                                className="w-full px-1 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 focus:outline-none focus:border-green-600">
                                {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}{m.recommended ? ' ★' : ''}</option>)}
                                <option value="custom">Custom…</option>
                            </select>
                            {isCustomModel && <input type="text" placeholder="model-id" value={customModelId}
                                onChange={e => { setCustomModelId(e.target.value); setGeminiModel(e.target.value); }}
                                className="w-full px-2 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-600" />}
                        </div>
                    )}
                    {aiProvider === 'openrouter' && (
                        <div className="ml-4 space-y-1.5">
                            <div className="flex items-center gap-1">
                                <KeyIcon className="w-3 h-3 text-green-700" />
                                <input type="password" placeholder="OpenRouter API Key" value={openRouterApiKey}
                                    onChange={e => setOpenRouterApiKey(e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-600" />
                            </div>
                            {openRouterStatus === 'valid' && <p className="text-[10px] text-green-400">✓ Connected</p>}
                            {openRouterStatus === 'invalid' && openRouterApiKey && <p className="text-[10px] text-red-400">✗ Invalid key</p>}
                            <select value={isCustomModel ? 'custom' : openRouterModel}
                                onChange={e => { if (e.target.value === 'custom') { setIsCustomModel(true); setCustomModelId(openRouterModel); } else { setIsCustomModel(false); setOpenRouterModel(e.target.value); } }}
                                className="w-full px-1 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 focus:outline-none focus:border-green-600">
                                {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}{m.recommended ? ' ★' : ''}</option>)}
                                <option value="custom">Custom…</option>
                            </select>
                            {isCustomModel && <input type="text" placeholder="provider/model" value={customModelId}
                                onChange={e => { setCustomModelId(e.target.value); setOpenRouterModel(e.target.value); }}
                                className="w-full px-2 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-600" />}
                        </div>
                    )}
                    {aiProvider === 'ollama' && (
                        <div className="ml-4 space-y-1.5">
                            <input type="text" placeholder="http://localhost:11434" value={ollamaBaseUrl}
                                onChange={e => setOllamaBaseUrl(e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-600" />
                            {ollamaStatus === 'valid' && <p className="text-[10px] text-green-400">✓ Connected</p>}
                            {ollamaStatus === 'invalid' && ollamaBaseUrl && <p className="text-[10px] text-red-400">✗ Cannot connect</p>}
                            <select value={isCustomModel ? 'custom' : ollamaModel}
                                onChange={e => { if (e.target.value === 'custom') { setIsCustomModel(true); setCustomModelId(ollamaModel); } else { setIsCustomModel(false); setOllamaModel(e.target.value); } }}
                                className="w-full px-1 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 focus:outline-none focus:border-green-600">
                                {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}{m.recommended ? ' ★' : ''}</option>)}
                                <option value="custom">Custom…</option>
                            </select>
                            {isCustomModel && <input type="text" placeholder="model-name" value={customModelId}
                                onChange={e => { setCustomModelId(e.target.value); setOllamaModel(e.target.value); }}
                                className="w-full px-2 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none focus:border-green-600" />}
                        </div>
                    )}
                    <div className="pt-1 border-t border-green-900">
                        <button onClick={() => setShowPromptEditor(!showPromptEditor)}
                            className="flex items-center justify-between w-full text-[10px] text-green-700 hover:text-green-400 transition-colors">
                            <span>Advanced: Prompts</span>
                            <span>{showPromptEditor ? '▲' : '▼'}</span>
                        </button>
                        {showPromptEditor && (
                            <div className="mt-2 space-y-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-[10px] text-green-700">Fix Errors Prompt</span>
                                        <button onClick={() => setAiPromptFix('')} className="text-[10px] text-green-900 hover:text-red-400">Reset</button>
                                    </div>
                                    <textarea value={aiPromptFix} onChange={e => setAiPromptFix(e.target.value)}
                                        placeholder="Leave empty for default"
                                        rows={4} className="w-full px-2 py-1 text-[10px] font-mono bg-[#0a0a14] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none resize-y" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-[10px] text-green-700">Generate Prompt</span>
                                        <button onClick={() => setAiPromptGenerate('')} className="text-[10px] text-green-900 hover:text-red-400">Reset</button>
                                    </div>
                                    <textarea value={aiPromptGenerate} onChange={e => setAiPromptGenerate(e.target.value)}
                                        placeholder="Leave empty for default"
                                        rows={4} className="w-full px-2 py-1 text-[10px] font-mono bg-[#0a0a14] border border-green-900 rounded text-green-300 placeholder-green-900 focus:outline-none resize-y" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Preview */}
            <RackSection title="Preview">
                <RackSwitch label="Show Preview (exp.)" value={showPreview} onChange={v => setShowPreview(v)} />
                {showPreview && (
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-[9px] text-green-700">{shaderCatalog.shaders[shaderIndex]?.shaderName}</p>
                        <video ref={videoElement} className={`max-w-36 max-h-36 rounded ${!isVideoAvailable ? 'hidden' : ''}`} playsInline autoPlay muted />
                        {!isVideoAvailable && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-900/30 rounded p-1">
                                <VideoCameraSlashIcon className="w-4 h-4" />
                                <span>Preview unavailable</span>
                            </div>
                        )}
                        <div className="flex gap-1 mt-1">
                            <button onClick={() => cycleShaders(false)} className="px-2 py-1 text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-400 rounded border border-green-800">
                                <ArrowLongLeftIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => sendMessage(DECR_TIME)} className="px-2 py-1 text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-400 rounded border border-green-800">
                                <ChevronDoubleLeftIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => sendMessage(RESET_TIME)} className="px-2 py-1 text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-400 rounded border border-green-800">
                                <ClockIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => sendMessage(INCR_TIME)} className="px-2 py-1 text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-400 rounded border border-green-800">
                                <ChevronDoubleRightIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => cycleShaders(true)} className="px-2 py-1 text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-400 rounded border border-green-800">
                                <ArrowLongRightIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </RackSection>

            {/* Shader Speed — collapsible vertical sliders */}
            <div className="border border-green-900 rounded bg-[#12121f] p-2 space-y-2">
                <button
                    onClick={() => setSpeedOpen(o => !o)}
                    className="flex items-center justify-between w-full text-[9px] font-mono text-green-600 uppercase tracking-[0.2em] hover:text-green-400 transition-colors">
                    <span>Shader Speed</span>
                    <span>{speedOpen ? '▲' : '▼'}</span>
                </button>
                {speedOpen && (
                    <>
                        <div className="flex justify-around items-end py-2 gap-4">
                            <RackVSlider
                                label="Speed ÷"
                                value={speedDivider}
                                min={0.1} max={100} step={0.1}
                                width={24} height={100}
                                onChange={v => setSpeedDivider(v)}
                                tooltip="Speed Divider: %s"
                            />
                            <RackVSlider
                                label="Vol Amp"
                                value={volumeAmplifier}
                                min={0.1} max={10} step={0.1}
                                width={24} height={100}
                                onChange={v => setVolumeAmplifier(v)}
                                tooltip="Volume Amplifier: %sx"
                            />
                        </div>
                        <p className="text-[9px] text-green-800 italic text-center">Vol amp multiplies source volume</p>
                    </>
                )}
            </div>

            {/* Input section */}
            <RackSection title="Input">
                <div className="space-y-1.5">
                    <RackSwitch label="Webcam video" value={useWebcam} onChange={v => setUseWebcam(v)} />
                    <RackSwitch label="Webcam audio" value={useWebcamAudio} onChange={v => setUseWebcamAudio(v)} />
                    <RackSwitch label="Screen/app share" value={useDisplayCapture} onChange={v => setUseDisplayCapture(v)} />
                </div>
            </RackSection>

            {/* 10-band EQ */}
            <RackSection title="Equalizer">
                <button onClick={() => setShowEq(!showEq)}
                    className="flex items-center justify-between w-full text-[10px] text-green-600 hover:text-green-400 transition-colors">
                    <span>{showEq ? 'Hide EQ' : 'Show EQ'}</span>
                    <span>{showEq ? '▲' : '▼'}</span>
                </button>
                {showEq && (
                    <>
                        <div className="flex justify-between gap-0.5 pt-2">
                            {EQ_FREQUENCIES.map((label, i) => (
                                <RackVSlider
                                    key={label}
                                    label={label}
                                    value={eqGainsArr[i] ?? 0}
                                    min={-12} max={12} step={0.5}
                                    height={72}
                                    onChange={v => {
                                        const next = [...eqGainsArr];
                                        next[i] = v;
                                        setEqGains(next);
                                    }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[9px] text-green-800">{eqGainsArr.every(g => g === 0) ? 'Flat' : 'Modified'}</span>
                            <button onClick={() => setEqGains([...EQ_DEFAULT_GAINS])}
                                className="text-[10px] px-2 py-0.5 rounded border border-green-900 text-green-700 hover:text-green-400 hover:border-green-700 transition-colors">
                                Reset
                            </button>
                        </div>
                        <RackSwitch label="Apply EQ to output" value={eqApplyToOutput} onChange={v => setEqApplyToOutput(v)} />
                        <p className="text-[9px] text-green-800 italic">Routes EQ signal to speaker</p>
                    </>
                )}
                <p className="text-[9px] text-green-800 italic">Boost/cut frequency bands before shader</p>
            </RackSection>

            {/* Randomize — collapsible */}
            <div className="border border-green-900 rounded bg-[#12121f] p-2 space-y-2">
                <button
                    onClick={() => setRandomizeOpen(o => !o)}
                    className="flex items-center justify-between w-full text-[9px] font-mono text-green-600 uppercase tracking-[0.2em] hover:text-green-400 transition-colors">
                    <span>Randomize</span>
                    <span>{randomizeOpen ? '▲' : '▼'}</span>
                </button>
                {randomizeOpen && (
                    <>
                        {/* Two toggles side-by-side */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <RackSwitch label="Random shader" value={playRandomShader} onChange={v => setPlayRandomShader(v)} />
                            <RackSwitch label="On beat" value={randomizeBeat} onChange={v => setRandomizeBeat(v)} />
                        </div>
                        {/* Sliders row — fixed 3-column grid so columns never reflow */}
                        {(playRandomShader || randomizeBeat) && (
                            <div className="grid grid-cols-3 items-end pt-1" style={{gap: '0.5rem'}}>
                                {/* Col 1: Interval — always occupies col 1 slot */}
                                <div className="flex justify-center">
                                    {playRandomShader ? (
                                        <RackVSlider
                                            label="Interval"
                                            value={randomizeTime}
                                            min={0} max={60} step={1}
                                            width={20} height={80}
                                            onChange={v => setRandomizeTime(v)}
                                            tooltip="Randomize every %ss"
                                        />
                                    ) : <div style={{width: 20, height: 80}} />}
                                </div>
                                {/* Col 2: Variation — always occupies col 2 slot */}
                                <div className="flex justify-center">
                                    {playRandomShader ? (
                                        <RackVSlider
                                            label="Variation"
                                            value={randomizeVariation}
                                            min={0} max={5} step={1}
                                            width={20} height={80}
                                            onChange={v => setRandomizeVariation(v)}
                                        />
                                    ) : <div style={{width: 20, height: 80}} />}
                                </div>
                                {/* Col 3: Beat int. — always occupies col 3 slot */}
                                <div className="flex justify-center">
                                    {randomizeBeat ? (
                                        <RackVSlider
                                            label="Beat int."
                                            value={randomizeBeatInterval}
                                            min={1} max={255} step={1}
                                            width={20} height={80}
                                            onChange={v => setRandomizeBeatInterval(v)}
                                            tooltip="Beat interval: %s"
                                        />
                                    ) : <div style={{width: 20, height: 80}} />}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* iAmplifiedTime */}
            <RackSection title="iAmplifiedTime">
                <RackSwitch label="Enable iAmplifiedTime" value={enableIAmplifiedTime} onChange={v => setEnableIAmplifiedTime(v)} />
                <p className="text-[9px] text-green-800 italic">Updated every frame from audio. Disable to save CPU.</p>
                {enableIAmplifiedTime && (
                    <>
                        <RackSwitch label="Use for Shadertoy imports" value={useIAmplifiedTime} onChange={v => setUseIAmplifiedTime(v)} />
                        <p className="text-[9px] text-green-800 italic">Transforms imported time code</p>
                    </>
                )}
            </RackSection>

            {/* Display */}
            <RackSection title="Display">
                <div className="space-y-1.5">
                    <RackSwitch label="Show shader credits" value={showShaderCredits} onChange={v => setShowShaderCredits(v)} />
                    <RackSwitch label="Show tab title" value={showTabTitle} onChange={v => setShowTabTitle(v)} />
                    <RackSwitch label="Show FPS counter" value={showFps} onChange={v => setShowFps(v)} />
                    <RackSwitch label="Fade transitions" value={shaderFade} onChange={v => setShaderFade(v)} />
                </div>
                <div className="pt-1 space-y-1">
                    <span className="text-[9px] text-green-700 uppercase tracking-widest">Render Resolution</span>
                    <select value={renderScale} onChange={e => setRenderScale(parseFloat(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-[#0d0d1a] border border-green-900 rounded text-green-300 focus:outline-none focus:border-green-600">
                        <option value="1.0">Full (100%)</option>
                        <option value="0.75">3/4 (75%)</option>
                        <option value="0.6666666666666666">2/3 (66%)</option>
                        <option value="0.5">1/2 (50%)</option>
                        <option value="0.3333333333333333">1/3 (33%)</option>
                        <option value="0.25">1/4 (25%)</option>
                    </select>
                </div>
            </RackSection>

            {/* Assets */}
            <RackSection title="Shadertoy">
                <RackSwitch label="Import assets from Shadertoy" value={downloadShadertoyAssets} onChange={v => handleDownloadAssetsToggle(v)} />
            </RackSection>

            {/* Debug */}
            <RackSection title="Debug">
                <RackSwitch label="Enable debug logging" value={debugLogging}
                    onChange={v => {
                        setDebugLogging(v);
                        updateDebugCache(v);
                        if (v) logger.options.log('Options', 'Debug logging enabled');
                    }} />
                <p className="text-[9px] text-green-800 italic">Reload content tabs for full effect.</p>
                <button onClick={() => onOpenDebugLogs?.()}
                    disabled={!debugLogging}
                    className={`mt-1 text-[10px] px-2 py-1 rounded border transition-colors ${debugLogging ? 'border-green-700 text-green-400 hover:border-green-500' : 'border-green-950 text-green-900 cursor-not-allowed'}`}>
                    View Debug Logs
                </button>
            </RackSection>

            {/* Actions */}
            <RackSection title="Actions">
                <button onClick={resetSettings}
                    className="w-full text-[10px] px-2 py-1.5 rounded border border-red-900 text-red-500 hover:bg-red-900/30 transition-colors">
                    Reset All Settings
                </button>
            </RackSection>

            {/* About */}
            <div className="pt-2 border-t border-green-900">
                <button onClick={onAboutClick}
                    className="w-full text-[9px] text-green-900 hover:text-green-600 transition-colors text-left font-mono">
                    About ShaderAmp
                </button>
            </div>

        </div>
    );
}
