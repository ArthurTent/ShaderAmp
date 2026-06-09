import React, { useState, useEffect, useCallback, useRef } from "react";
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import browser from "webextension-polyfill";
import {
    XMarkIcon,
    DocumentArrowDownIcon,
    TrashIcon,
    ArrowPathIcon,
    PlusIcon,
    MinusIcon,
    CodeBracketIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    PlayIcon,
    AdjustmentsHorizontalIcon,
    MagnifyingGlassIcon,
    SparklesIcon,
    WrenchIcon,
    CpuChipIcon,
    StopIcon,
    MusicalNoteIcon
} from "@heroicons/react/24/outline";
import AISidePanel from "./AISidePanel";
import { fixShaderErrors, isAIAvailable, isAIAvailableWithRetry, destroySession, cancelAIOperation } from "@src/helpers/aiService";
import { fetchFragmentShader } from "@src/helpers/shaderActions";
import type { ShaderObject, BufferConfig, ShaderMetaData, ShaderUniform } from "@src/helpers/types";
import {
    type CustomImage,
    getAllCustomImages,
    getCustomImageBlob,
    imageIdToChannelRef,
    channelRefToImageId,
    isCustomImageRef,
    SUPPORTED_IMAGE_EXTENSIONS,
    uploadCustomImage,
    formatBytes,
} from "@src/helpers/customImageStorage";
import {
    type CustomVideo,
    getAllCustomVideos,
    videoIdToChannelRef,
    isCustomVideoRef,
    isBundledVideoRef,
    SUPPORTED_VIDEO_EXTENSIONS,
    uploadCustomVideo,
    formatVideoBytes,
} from "@src/helpers/customVideoStorage";
import {
    type CustomCubemap,
    getAllCustomCubemaps,
    cubemapIdToChannelRef,
    isCustomCubemapRef,
    formatCubemapBytes,
} from "@src/helpers/customCubemapStorage";
import {
    saveEditedShader,
    deleteEditedShader,
    saveEditedImportedShader,
    deleteEditedImportedShader,
    saveCustomShader,
    deleteCustomShader,
    generateShaderId,
    createEmptyShader,
    type CustomShader,
    type EditedShader
} from "@src/helpers/shaderStorage";

type EditorTab = 'image' | 'bufferA' | 'bufferB' | 'bufferC' | 'bufferD';

interface ChannelSampler {
    filter: 'mipmap' | 'linear' | 'nearest';
    wrap: 'clamp' | 'repeat';
    vflip: boolean;
}

const DEFAULT_SAMPLER: ChannelSampler = { filter: 'linear', wrap: 'clamp', vflip: false };

interface BufferDefinition {
    name: string;
    code: string;
    channel0?: string;
    channel1?: string;
    channel2?: string;
    channel3?: string;
    channel0Sampler?: ChannelSampler;
    channel1Sampler?: ChannelSampler;
    channel2Sampler?: ChannelSampler;
    channel3Sampler?: ChannelSampler;
}

type ActivePanelTab = EditorTab | 'uniforms' | 'midi';

interface ShaderEditorState {
    name: string;
    originalName: string; // Track original name to detect "save as copy"
    author: string;
    description: string;
    speed: number;
    tabs: EditorTab[];
    activeTab: EditorTab;
    activePanelTab: ActivePanelTab;
    buffers: Partial<Record<EditorTab, BufferDefinition>>;
    customUniforms: ShaderUniform[];
}

type Props = {
    shaderObject: ShaderObject | null;
    importId?: string;
    isCustom?: boolean;
    customId?: string;
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void;
    onDelete?: () => void;
};

const CHANNEL_LABELS = ['iChannel0', 'iChannel1', 'iChannel2', 'iChannel3'];
const CHANNEL_KEYS = ['channel0', 'channel1', 'channel2', 'channel3'];
const SAMPLER_KEYS = ['channel0Sampler', 'channel1Sampler', 'channel2Sampler', 'channel3Sampler'];

const BUNDLED_TEXTURES = [
    { value: 'images/38c3_visuals.png',                                                      label: '38c3_visuals.png' },
    { value: 'images/NyanCatSprite.png',                                                     label: 'NyanCatSprite.png' },
    { value: 'images/arthurtent.jpeg',                                                       label: 'arthurtent.jpeg' },
    { value: 'images/beton_3_pexels-photo-5622880.jpeg',                                     label: 'beton_3_pexels.jpeg' },
    { value: 'images/otaviogood_shader_fontgen.png',                                         label: 'otaviogood_fontgen.png' },
    { value: 'images/pexels-eberhard-grossgasteiger-966927.jpg',                             label: 'eberhard_966927.jpg' },
    { value: 'images/pierre-bamin-_EzTds6Fo44-unsplash.jpg',                                 label: 'pierre-bamin_unsplash.jpg' },
    { value: 'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg',         label: 'sky-night-milky-way.jpg' },
];

const BUNDLED_VIDEOS = [
    { value: 'media/SpaceTravel1Min.mp4',                  label: 'SpaceTravel1Min.mp4' },
    { value: 'media/c-base-full-loop-blue-green.mp4',      label: 'c-base-full-loop-blue-green.mp4' },
    { value: 'media/pexels_videos_3931(1080p).mp4',        label: 'pexels_videos_3931 (1080p).mp4' },
];

const BUNDLED_CUBEMAPS = [
    { value: 'images/cubemaps/abc.jpg',                                                                                      label: 'abc (office)' },
    { value: 'images/cubemaps/94284d43be78f00eb6b298e6d78656a1b34e2b91b34940d02f1ca8b22310e8a0.png',                          label: '94284d…e8a0 (park)' },
    { value: 'images/cubemaps/leen_outdoor/px.png',                                                                          label: 'leen_outdoor (outdoor)' },
];

const BUNDLED_VOLUME_TEXTURES = [
    { value: 'greyNoise3D',  label: 'greyNoise3D (32x32x32, grey)' },
    { value: 'rgbaNoise3D', label: 'rgbaNoise3D (32x32x32, RGBA)' },
];

function isTextureOrCubemap(val?: string) {
    if (!val) return false;
    if (val === 'audio') return false;
    if (val === 'video') return false;
    if (val === 'keyboard') return false;
    if (val === 'midi') return false;
    if (/^buffer\d+$/.test(val)) return false;
    if (isCustomVideoRef(val)) return false;
    if (isBundledVideoRef(val)) return false;
    // Volume textures (3D) don't use 2D sampler controls
    if (val === 'greyNoise3D' || val === 'rgbaNoise3D') return false;
    return true;
}


export default function ShaderEditorModal({ 
    shaderObject, 
    importId,
    isCustom = false,
    customId,
    isOpen, 
    onClose, 
    onSave,
    onDelete 
}: Props) {
    const [state, setState] = useState<ShaderEditorState>(() => createInitialState(shaderObject, isCustom));
    const [isSaving, setIsSaving] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [compileResult, setCompileResult] = useState<{success: boolean; errors: string} | null>(null);
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [customImages, setCustomImages] = useState<CustomImage[]>([]);
    const [customImageThumbs, setCustomImageThumbs] = useState<Record<string, string>>({});
    const thumbUrlsRef = useRef<Record<string, string>>({});
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);
    const [customCubemaps, setCustomCubemaps] = useState<Omit<CustomCubemap, 'faces'>[]>([]);

    // AI-related state
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
    const [aiPanelWidth, setAiPanelWidth] = useState(320); // Default 320px (w-80)
    const isResizingRef = useRef(false);
    const resizeStartXRef = useRef(0);
    const resizeStartWidthRef = useRef(320);

    // Check AI availability when modal opens (with retry for Chrome AI initialization)
    useEffect(() => {
        if (!isOpen) return;
        const checkAI = async () => {
            console.log('[ShaderEditor] Checking AI availability...');
            const available = await isAIAvailableWithRetry(3, 800);
            console.log('[ShaderEditor] AI available:', available);
            setAiAvailable(available);
        };
        checkAI();
    }, [isOpen]);

    // Cleanup AI session when modal closes
    useEffect(() => {
        if (!isOpen) {
            destroySession();
        }
    }, [isOpen]);

    // Resize handlers for AI panel
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const delta = resizeStartXRef.current - e.clientX;
            const newWidth = Math.max(250, Math.min(800, resizeStartWidthRef.current + delta));
            setAiPanelWidth(newWidth);
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Load custom images, videos, and cubemaps whenever modal opens
    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            const [imgs, vids, cmaps] = await Promise.all([getAllCustomImages(), getAllCustomVideos(), getAllCustomCubemaps()]);
            setCustomImages(imgs);
            setCustomVideos(vids);
            setCustomCubemaps(cmaps);
            // Revoke old thumbs
            Object.values(thumbUrlsRef.current).forEach(u => URL.revokeObjectURL(u));
            thumbUrlsRef.current = {};
            const thumbs: Record<string, string> = {};
            for (const img of imgs) {
                const blob = await getCustomImageBlob(img.id);
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    thumbs[img.id] = url;
                    thumbUrlsRef.current[img.id] = url;
                }
            }
            setCustomImageThumbs(thumbs);
        };
        load();
        return () => {
            Object.values(thumbUrlsRef.current).forEach(u => URL.revokeObjectURL(u));
            thumbUrlsRef.current = {};
        };
    }, [isOpen]);

    const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        try {
            const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
            const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'));
            for (const file of imageFiles) { await uploadCustomImage(file); }
            for (const file of videoFiles) { await uploadCustomVideo(file); }
            // Reload lists
            const [imgs, vids] = await Promise.all([getAllCustomImages(), getAllCustomVideos()]);
            setCustomImages(imgs);
            setCustomVideos(vids);
            Object.values(thumbUrlsRef.current).forEach(u => URL.revokeObjectURL(u));
            thumbUrlsRef.current = {};
            const thumbs: Record<string, string> = {};
            for (const img of imgs) {
                const blob = await getCustomImageBlob(img.id);
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    thumbs[img.id] = url;
                    thumbUrlsRef.current[img.id] = url;
                }
            }
            setCustomImageThumbs(thumbs);
            e.target.value = '';
        } catch (err) {
            setNotification({ message: err instanceof Error ? err.message : 'Upload failed', type: 'error' });
        }
    };

    // Reset state when modal opens with new shader
    useEffect(() => {
        if (isOpen) {
            setNotification(null);
            setShowResetConfirm(false);
            setShowDeleteConfirm(false);
            
            // Async load shader code (needed for built-in shaders)
            const loadShaderCode = async () => {
                if (!shaderObject) {
                    // New custom shader
                    setState(createInitialState(null, isCustom));
                    return;
                }
                
                // For built-in shaders without inlineCode, fetch from file
                if (!shaderObject.inlineCode && !isCustom && !importId) {
                    try {
                        const response = await fetch(browser.runtime.getURL(`shaders/${shaderObject.shaderName}`));
                        const code = await response.text();
                        
                        // Also fetch buffer codes for built-in shaders with buffers
                        const inlineBuffers: { [filename: string]: string } = {};
                        const meta = shaderObject.metaData || {};
                        if (meta.buffers) {
                            for (const buffer of meta.buffers) {
                                if (!shaderObject.inlineBuffers?.[buffer.shaderName]) {
                                    try {
                                        const bufferCode = await fetchFragmentShader(buffer.shaderName);
                                        inlineBuffers[buffer.shaderName] = bufferCode;
                                        console.log(`[ShaderEditor] Fetched buffer code: ${buffer.shaderName}`);
                                    } catch (bufferError) {
                                        console.error(`[ShaderEditor] Failed to fetch buffer ${buffer.shaderName}:`, bufferError);
                                    }
                                }
                            }
                        }
                        
                        // Create shader object with fetched code
                        const shaderWithCode = {
                            ...shaderObject,
                            inlineCode: code,
                            inlineBuffers: {
                                ...shaderObject.inlineBuffers,
                                ...inlineBuffers
                            }
                        };
                        setState(createInitialState(shaderWithCode, isCustom));
                    } catch (error) {
                        console.error('[ShaderEditor] Failed to fetch shader code:', error);
                        setNotification({ message: "Failed to load shader code", type: 'error' });
                        setState(createInitialState(shaderObject, isCustom));
                    }
                } else {
                    // Imported or custom shader with inlineCode
                    setState(createInitialState(shaderObject, isCustom));
                }
            };
            
            loadShaderCode();
        }
    }, [isOpen, shaderObject, isCustom, importId]);

    // Known ShaderAmp uniforms/varyings injected by the preamble — stripped from user code to avoid redefinitions
    const PREAMBLE_IDENTIFIERS = [
        'iAmplifiedTime', 'iTime', 'iTimeDelta', 'iFrameRate', 'iFrame', 'iDate',
        'iResolution', 'iMouse', 'iSampleRate', 'iAudioData',
        'iChannel0', 'iChannel1', 'iChannel2', 'iChannel3',
        'iChannelResolution', 'iChannelTime', 'iVideo', 'iTransitionOpacity', 'iKeyboard', 'iMidi', 'iJoystick', 'vUv',
    ];

    const stripPreambleDeclarations = (code: string): string => {
        return code.split('\n').filter(line => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('uniform ') && !trimmed.startsWith('varying ') && !trimmed.startsWith('in ')) return true;
            return !PREAMBLE_IDENTIFIERS.some(id => new RegExp(`\\b${id}\\b`).test(trimmed));
        }).join('\n');
    };

    // Preamble using GLSL ES 3.00 (WebGL2) — supports texture(), in/out, etc.
    const SHADER_PREAMBLE = [
        '#version 300 es',
        'precision highp float;',
        'precision highp int;',
        'uniform float iAmplifiedTime;',
        'uniform float iTime;',
        'uniform float iTimeDelta;',
        'uniform float iFrameRate;',
        'uniform int iFrame;',
        'uniform vec4 iDate;',
        'uniform vec3 iResolution;',
        'uniform vec4 iMouse;',
        'uniform float iSampleRate;',
        'uniform sampler2D iAudioData;',
        'uniform sampler2D iChannel0;',
        'uniform sampler2D iChannel1;',
        'uniform sampler2D iChannel2;',
        'uniform sampler2D iChannel3;',
        'uniform vec3 iChannelResolution[4];',
        'uniform float iChannelTime[4];',
        'uniform sampler2D iVideo;',
        'uniform sampler2D iKeyboard;',
        'uniform sampler2D iMidi;',
        'uniform sampler2D iJoystick;',
        'uniform float iTransitionOpacity;',
        'in vec2 vUv;',
        'out vec4 fragColor;',
    ].join('\n') + '\n';

    const handleCompile = () => {
        const userCode = stripPreambleDeclarations(state.buffers[state.activeTab]?.code || '');
        // Replace gl_FragColor with fragColor for GLSL ES 3.00 compatibility
        const patchedUserCode = userCode.replace(/\bgl_FragColor\b/g, 'fragColor');
        const code = SHADER_PREAMBLE + patchedUserCode;
        setIsCompiling(true);
        setCompileResult(null);
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
            if (!gl) {
                setCompileResult({ success: false, errors: 'WebGL2 not available — cannot compile.' });
                return;
            }
            const shader = gl.createShader(gl.FRAGMENT_SHADER)!;
            gl.shaderSource(shader, code);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                // Adjust line numbers to map back to user code (subtract preamble lines)
                const preambleLines = SHADER_PREAMBLE.split('\n').length - 1;
                const raw = gl.getShaderInfoLog(shader) || 'Unknown compile error';
                const adjusted = raw.replace(/ERROR: 0:([0-9]+):/g, (_match, lineStr) => {
                    const line = parseInt(lineStr, 10) - preambleLines;
                    return `ERROR: 0:${line > 0 ? line : lineStr}:`;
                });
                setCompileResult({ success: false, errors: adjusted });
            } else {
                setCompileResult({ success: true, errors: '' });
            }
            gl.deleteShader(shader);
        } catch (e) {
            setCompileResult({ success: false, errors: e instanceof Error ? e.message : String(e) });
        } finally {
            setIsCompiling(false);
        }
    };

    const handleAIFix = async () => {
        if (!compileResult?.errors || isAILoading) return;

        const currentCode = state.buffers[state.activeTab]?.code || '';
        setIsAILoading(true);
        setNotification({ message: 'AI is analyzing the errors...', type: 'success' });

        try {
            const result = await fixShaderErrors(currentCode, compileResult.errors);

            if (result.cancelled) {
                setNotification({ message: 'AI fix cancelled.', type: 'success' });
                return;
            }

            if (result.code) {
                setState(prev => ({
                    ...prev,
                    buffers: {
                        ...prev.buffers,
                        [prev.activeTab]: {
                            ...prev.buffers[prev.activeTab],
                            code: result.code!
                        }
                    }
                }));
                setNotification({ message: 'AI fix applied! Recompiling...', type: 'success' });
                // Auto-compile after applying fix
                setTimeout(() => handleCompile(), 100);
            } else {
                setNotification({ message: 'AI could not fix the errors. Try manual editing.', type: 'error' });
            }
        } catch (error) {
            console.error('[ShaderEditor] AI fix failed:', error);
            setNotification({ message: 'AI fix failed. Please try again.', type: 'error' });
        } finally {
            setIsAILoading(false);
        }
    };

    const handleCancelAI = () => {
        cancelAIOperation();
        setIsAILoading(false);
        setNotification({ message: 'AI operation cancelled.', type: 'success' });
    };

    const handleCodeChange = useCallback((value: string | undefined) => {
        if (!value) return;
        setState(prev => ({
            ...prev,
            buffers: {
                ...prev.buffers,
                [prev.activeTab]: {
                    ...prev.buffers[prev.activeTab],
                    code: value
                }
            }
        }));
    }, []);

    const handleTabChange = (tab: EditorTab) => {
        setState(prev => ({ ...prev, activeTab: tab, activePanelTab: tab }));
    };

    const handleAddBuffer = () => {
        const availableTabs: EditorTab[] = ['bufferA', 'bufferB', 'bufferC', 'bufferD'];
        const nextTab = availableTabs.find(t => !state.tabs.includes(t));
        
        if (!nextTab) {
            setNotification({ message: "Maximum 4 buffers allowed", type: 'error' });
            return;
        }

        setState(prev => ({
            ...prev,
            tabs: [...prev.tabs, nextTab],
            activeTab: nextTab,
            activePanelTab: nextTab,
            buffers: {
                ...prev.buffers,
                [nextTab]: {
                    name: nextTab,
                    code: getDefaultBufferCode(nextTab),
                    channel0: "",
                    channel1: "",
                    channel2: "",
                    channel3: ""
                }
            }
        }));
    };

    const handleRemoveBuffer = (tabToRemove: EditorTab) => {
        setState(prev => {
            const newTabs = prev.tabs.filter(t => t !== tabToRemove);
            const newBuffers = { ...prev.buffers };
            delete newBuffers[tabToRemove];
            const newActive = newTabs.includes(prev.activeTab) ? prev.activeTab : 'image';
            return {
                ...prev,
                tabs: newTabs,
                activeTab: newActive,
                activePanelTab: newActive,
                buffers: newBuffers
            };
        });
    };

    const handleChannelChange = (tab: EditorTab, channel: string, value: string) => {
        setState(prev => {
            const samplerKey = SAMPLER_KEYS[CHANNEL_KEYS.indexOf(channel)] as keyof BufferDefinition;
            const prevSampler = (prev.buffers[tab] as any)?.[samplerKey];
            const keepSampler = isTextureOrCubemap(value) ? (prevSampler ?? { ...DEFAULT_SAMPLER }) : undefined;
            return {
                ...prev,
                buffers: {
                    ...prev.buffers,
                    [tab]: {
                        ...prev.buffers[tab],
                        [channel]: value,
                        [samplerKey]: keepSampler
                    }
                }
            };
        });
    };

    // ── Custom Uniforms ──────────────────────────────────────────────────────

    const STANDARD_UNIFORM_NAMES = new Set([
        'iAmplifiedTime', 'iTime', 'iTimeDelta', 'iFrameRate', 'iFrame', 'iDate',
        'iAudioData', 'iSampleRate', 'iResolution', 'iMouse', 'iKeyboard', 'iMidi', 'iJoystick',
        'iChannel0', 'iChannel1', 'iChannel2', 'iChannel3',
        'iChannelResolution', 'iChannelTime', 'iTransitionOpacity'
    ]);

    const camelToLabel = (name: string): string => {
        // Strip leading 'i' prefix common in ShaderAmp uniforms
        const stripped = name.startsWith('i') ? name.slice(1) : name;
        return stripped
            .replace(/([A-Z])/g, ' $1')
            .replace(/([0-9]+)/g, ' $1')
            .trim()
            .replace(/^./, c => c.toUpperCase());
    };

    const handleDetectUniforms = () => {
        const allCode = Object.values(state.buffers).map(b => b?.code || '').join('\n');
        const lines = allCode.split('\n');
        const detected: ShaderUniform[] = [];
        const seen = new Set<string>(state.customUniforms.map(u => u.name));

        const uniformRe = /^\s*uniform\s+(float|int|vec2|vec3|vec4|bool)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;(.*)$/;
        const rangeRe = /([\d.+-]+)\s*(?:to|--)\s*([\d.+-]+)/i;
        const offOnRe = /0\s*:\s*off.*1\s*:\s*on/i;

        for (const line of lines) {
            const m = uniformRe.exec(line);
            if (!m) continue;
            const [, glslType, uName, comment] = m;
            if (STANDARD_UNIFORM_NAMES.has(uName)) continue;
            if (seen.has(uName)) continue;
            seen.add(uName);

            const type = glslType as ShaderUniform['type'];
            let min: number | undefined;
            let max: number | undefined;
            let step: number | undefined;
            let options: ShaderUniform['options'];

            const rangeM = rangeRe.exec(comment);
            if (rangeM) {
                min = parseFloat(rangeM[1]);
                max = parseFloat(rangeM[2]);
                step = type === 'int' ? 1 : parseFloat(((max - min) / 100).toFixed(4));
            } else if (offOnRe.test(comment)) {
                min = 0; max = 1; step = 1;
                options = [{ label: 'Off', value: 0 }, { label: 'On', value: 1 }];
            } else if (type === 'float') {
                min = 0; max = 1; step = 0.01;
            } else if (type === 'int') {
                min = 0; max = 10; step = 1;
            }

            let defaultVal: ShaderUniform['default'];
            if (type === 'vec2') defaultVal = [0, 0];
            else if (type === 'vec3') defaultVal = [0, 0, 0];
            else if (type === 'vec4') defaultVal = [0, 0, 0, 1];
            else if (type === 'bool') defaultVal = false;
            else defaultVal = min ?? 0;

            const u: ShaderUniform = { name: uName, label: camelToLabel(uName), type, default: defaultVal };
            if (min !== undefined) u.min = min;
            if (max !== undefined) u.max = max;
            if (step !== undefined) u.step = step;
            if (options) u.options = options;
            detected.push(u);
        }

        if (detected.length === 0) {
            setNotification({ message: 'No new custom uniforms detected in shader code', type: 'error' });
            return;
        }
        setState(prev => ({ ...prev, customUniforms: [...prev.customUniforms, ...detected] }));
        setNotification({ message: `Detected ${detected.length} uniform(s) — review and adjust below`, type: 'success' });
    };

    const handleAddUniform = () => {
        const newU: ShaderUniform = { name: '', label: '', type: 'float', default: 0, min: 0, max: 1, step: 0.01 };
        setState(prev => ({ ...prev, customUniforms: [...prev.customUniforms, newU] }));
    };

    const handleRemoveUniform = (idx: number) => {
        setState(prev => ({ ...prev, customUniforms: prev.customUniforms.filter((_, i) => i !== idx) }));
    };

    const handleUniformChange = (idx: number, field: keyof ShaderUniform, value: any) => {
        setState(prev => {
            const updated = [...prev.customUniforms];
            updated[idx] = { ...updated[idx], [field]: value } as ShaderUniform;
            return { ...prev, customUniforms: updated };
        });
    };

    const handleUniformOptionChange = (uIdx: number, oIdx: number, field: 'label' | 'value', val: string) => {
        setState(prev => {
            const updated = [...prev.customUniforms];
            const opts = [...(updated[uIdx].options || [])];
            opts[oIdx] = { ...opts[oIdx], [field]: field === 'value' ? parseFloat(val) || 0 : val };
            updated[uIdx] = { ...updated[uIdx], options: opts };
            return { ...prev, customUniforms: updated };
        });
    };

    const handleAddUniformOption = (uIdx: number) => {
        setState(prev => {
            const updated = [...prev.customUniforms];
            const opts = [...(updated[uIdx].options || []), { label: '', value: 0 }];
            updated[uIdx] = { ...updated[uIdx], options: opts };
            return { ...prev, customUniforms: updated };
        });
    };

    const handleRemoveUniformOption = (uIdx: number, oIdx: number) => {
        setState(prev => {
            const updated = [...prev.customUniforms];
            const opts = (updated[uIdx].options || []).filter((_, i) => i !== oIdx);
            updated[uIdx] = { ...updated[uIdx], options: opts.length ? opts : undefined };
            return { ...prev, customUniforms: updated };
        });
    };

    const handleSamplerChange = (tab: EditorTab, samplerKey: string, field: keyof ChannelSampler, value: string | boolean) => {
        setState(prev => {
            const prevSampler: ChannelSampler = (prev.buffers[tab] as any)?.[samplerKey] ?? { ...DEFAULT_SAMPLER };
            return {
                ...prev,
                buffers: {
                    ...prev.buffers,
                    [tab]: {
                        ...prev.buffers[tab],
                        [samplerKey]: { ...prevSampler, [field]: value }
                    }
                }
            };
        });
    };

    const handleSave = async (andRun = false) => {
        setIsSaving(true);
        setNotification(null);
        
        console.log('[ShaderEditor] Starting save...', { isCustom, customId, importId, shaderObject });

        try {
            // Build inline buffers
            const inlineBuffers: { [filename: string]: string } = {};
            const buffers: BufferConfig[] = [];

            const bufferOrder = ['bufferA', 'bufferB', 'bufferC', 'bufferD'];
            state.tabs.forEach((tab) => {
                if (tab === 'image') return;
                
                const buffer = state.buffers[tab];
                if (!buffer) return;
                
                const outputIndex = bufferOrder.indexOf(tab);
                // Preserve original buffer filename from metadata if available
                const originalFilename = shaderObject?.metaData?.buffers?.[outputIndex]?.shaderName;
                const filename = originalFilename || `${tab}.frag`;
                inlineBuffers[filename] = buffer.code;
                
                buffers.push({
                    shaderName: filename,
                    output: outputIndex,
                    iChannel0: buffer.channel0 || undefined,
                    iChannel1: buffer.channel1 || undefined,
                    iChannel2: buffer.channel2 || undefined,
                    iChannel3: buffer.channel3 || undefined,
                    iChannel0Sampler: buffer.channel0Sampler || undefined,
                    iChannel1Sampler: buffer.channel1Sampler || undefined,
                    iChannel2Sampler: buffer.channel2Sampler || undefined,
                    iChannel3Sampler: buffer.channel3Sampler || undefined,
                });
            });

            const imageChannels = state.buffers.image;

            // Build metadata
            const metaData: ShaderMetaData = {
                ...shaderObject?.metaData,
                shaderName: state.name,
                author: state.author,
                modifiedBy: shaderObject?.metaData?.modifiedBy || "",
                url: shaderObject?.metaData?.url || "",
                license: shaderObject?.metaData?.license || "MIT",
                licenseURL: shaderObject?.metaData?.licenseURL || "",
                description: state.description,
                shaderSpeed: state.speed,
                customUniforms: state.customUniforms.length > 0 ? state.customUniforms : undefined,
                buffers: buffers.length > 0 ? buffers : undefined,
                iChannel0: imageChannels?.channel0 || undefined,
                iChannel1: imageChannels?.channel1 || undefined,
                iChannel2: imageChannels?.channel2 || undefined,
                iChannel3: imageChannels?.channel3 || undefined,
                iChannel0Sampler: imageChannels?.channel0Sampler || undefined,
                iChannel1Sampler: imageChannels?.channel1Sampler || undefined,
                iChannel2Sampler: imageChannels?.channel2Sampler || undefined,
                iChannel3Sampler: imageChannels?.channel3Sampler || undefined,
            };

            // Build shader object
            const updatedShader: ShaderObject = {
                shaderName: `${state.name}.frag`,
                metaData,
                inlineCode: state.buffers.image?.code || '',
                inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined
            };

            console.log('[ShaderEditor] Saving shader:', updatedShader);

            // Check if name has changed - if so, save as a new copy
            const isNameChanged = state.name !== state.originalName;

            // Save based on shader type
            if (isNameChanged) {
                // Name changed - save as a new custom shader copy
                console.log('[ShaderEditor] Name changed from', state.originalName, 'to', state.name, '- saving as new copy');
                const newCustomShader: CustomShader = {
                    ...updatedShader,
                    id: generateShaderId(),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                await saveCustomShader(newCustomShader);
                console.log('[ShaderEditor] New shader copy saved successfully with ID:', newCustomShader.id);
                setNotification({ message: `Saved as new shader: ${state.name}`, type: 'success' });
            } else if (isCustom && customId) {
                console.log('[ShaderEditor] Saving as custom shader with ID:', customId);
                const customShader: CustomShader = {
                    ...updatedShader,
                    id: customId,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                await saveCustomShader(customShader);
                console.log('[ShaderEditor] Custom shader saved successfully');
                setNotification({ message: "Shader saved successfully!", type: 'success' });
            } else if (importId) {
                console.log('[ShaderEditor] Saving as edited imported shader:', importId);
                await saveEditedImportedShader(importId, updatedShader);
                setNotification({ message: "Shader saved successfully!", type: 'success' });
            } else if (shaderObject) {
                console.log('[ShaderEditor] Saving as edited built-in shader:', shaderObject.shaderName);
                await saveEditedShader(shaderObject.shaderName, updatedShader);
                setNotification({ message: "Shader saved successfully!", type: 'success' });
            } else {
                console.error('[ShaderEditor] Cannot save: no shader type determined');
                throw new Error('Cannot determine shader type to save');
            }

            if (andRun) {
                // Auto-activate the saved shader so it starts running immediately
                await browser.storage.local.set({ 'state.currentshader': updatedShader });
            }

            onSave?.();
        } catch (error) {
            console.error("[ShaderEditor] Failed to save shader:", error);
            setNotification({ message: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFactoryReset = async () => {
        if (!shaderObject) return;
        
        try {
            await deleteEditedShader(shaderObject.shaderName);
            setNotification({ message: "Shader reset to factory defaults", type: 'success' });
            onSave?.();
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            setNotification({ message: "Failed to reset shader", type: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!customId) return;
        
        try {
            await deleteCustomShader(customId);
            setNotification({ message: "Shader deleted", type: 'success' });
            onDelete?.();
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            setNotification({ message: "Failed to delete shader", type: 'error' });
        }
    };

    const canFactoryReset = !isCustom && !importId && shaderObject;
    const canDelete = isCustom && customId;

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
                
                <div className="relative w-full h-full bg-gray-800 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
                        <div className="flex items-center space-x-4">
                            <CodeBracketIcon className="w-6 h-6 text-indigo-400" />
                            <h2 className="text-lg font-semibold text-white">
                                {isCustom ? 'Edit Custom Shader' : importId ? 'Edit Imported Shader' : 'Edit Shader'}
                            </h2>
                            {canFactoryReset && (
                                <span className="text-xs text-yellow-500 bg-yellow-500/20 px-2 py-1 rounded">
                                    Modified from built-in
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* Compile Button */}
                            <button
                                onClick={handleCompile}
                                disabled={isCompiling || isSaving}
                                className="flex items-center px-3 py-1.5 text-sm text-green-400 hover:text-green-300 hover:bg-green-400/10 disabled:opacity-50 rounded transition-colors"
                                title="Compile current shader tab"
                            >
                                <PlayIcon className="w-4 h-4 mr-1" />
                                {isCompiling ? 'Compiling...' : 'Compile'}
                            </button>

                            {/* AI Fix Button - shows on compile errors */}
                            {compileResult && !compileResult.success && aiAvailable && (
                                <>
                                    <button
                                        onClick={handleAIFix}
                                        disabled={isAILoading || isSaving}
                                        className="flex items-center px-3 py-1.5 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 disabled:opacity-50 rounded transition-colors"
                                        title="Use AI to fix compile errors"
                                    >
                                        {isAILoading ? (
                                            <>
                                                <svg className="animate-spin w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                AI Fixing...
                                            </>
                                        ) : (
                                            <>
                                                <WrenchIcon className="w-4 h-4 mr-1" />
                                                AI Fix
                                            </>
                                        )}
                                    </button>
                                    {/* Cancel AI Fix Button */}
                                    {isAILoading && (
                                        <button
                                            onClick={handleCancelAI}
                                            className="flex items-center px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                                            title="Cancel AI fix"
                                        >
                                            <StopIcon className="w-4 h-4 mr-1" />
                                            Stop
                                        </button>
                                    )}
                                </>
                            )}

                            {/* AI Generate Button */}
                            {aiAvailable && (
                                <button
                                    onClick={() => setShowAIPanel(prev => !prev)}
                                    disabled={isSaving}
                                    className={`flex items-center px-3 py-1.5 text-sm rounded transition-colors ${
                                        showAIPanel
                                            ? 'text-purple-300 bg-purple-400/20'
                                            : 'text-purple-400 hover:text-purple-300 hover:bg-purple-400/10'
                                    } disabled:opacity-50`}
                                    title={showAIPanel ? 'Close AI Panel' : 'Open AI Shader Generator'}
                                >
                                    <SparklesIcon className="w-4 h-4 mr-1" />
                                    {showAIPanel ? 'Close AI' : 'AI Gen'}
                                </button>
                            )}

                            {/* Factory Reset Button */}
                            {canFactoryReset && (
                                <button
                                    onClick={() => setShowResetConfirm(true)}
                                    className="flex items-center px-3 py-1.5 text-sm text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                                    title="Reset to factory defaults"
                                >
                                    <ArrowPathIcon className="w-4 h-4 mr-1" />
                                    Factory Reset
                                </button>
                            )}
                            
                            {/* Delete Button */}
                            {canDelete && (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="flex items-center px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4 mr-1" />
                                    Delete
                                </button>
                            )}
                            
                            {/* Save Button */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSave(false);
                                }}
                                disabled={isSaving}
                                className="flex items-center px-4 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 text-white rounded transition-colors"
                            >
                                <DocumentArrowDownIcon className="w-4 h-4 mr-1" />
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>

                            {/* Save and Run Button */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSave(true);
                                }}
                                disabled={isSaving}
                                className="flex items-center px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded transition-colors"
                            >
                                <PlayIcon className="w-4 h-4 mr-1" />
                                {isSaving ? 'Saving...' : 'Save and Run'}
                            </button>
                            
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Compile Result */}
                    {compileResult && (
                        <div className={`px-4 py-2 flex items-start ${
                            compileResult.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                        }`}>
                            {compileResult.success ? (
                                <CheckCircleIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            ) : (
                                <ExclamationCircleIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                                {compileResult.success ? (
                                    <span className="text-sm">Compiled OK</span>
                                ) : (
                                    <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">{compileResult.errors}</pre>
                                )}
                            </div>
                            <button onClick={() => setCompileResult(null)} className="ml-2 text-gray-400 hover:text-white flex-shrink-0">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Notification */}
                    {notification && (
                        <div className={`px-4 py-2 flex items-center ${
                            notification.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                        }`}>
                            {notification.type === 'success' ? (
                                <CheckCircleIcon className="w-4 h-4 mr-2" />
                            ) : (
                                <ExclamationCircleIcon className="w-4 h-4 mr-2" />
                            )}
                            <span className="text-sm">{notification.message}</span>
                        </div>
                    )}

                    {/* Reset Confirmation */}
                    {showResetConfirm && (
                        <div className="px-4 py-3 bg-yellow-900/30 border-b border-yellow-700/50">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-yellow-300">
                                    Reset to factory defaults? This will discard all your edits.
                                </span>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setShowResetConfirm(false)}
                                        className="px-3 py-1 text-sm text-gray-300 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleFactoryReset}
                                        className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Delete Confirmation */}
                    {showDeleteConfirm && (
                        <div className="px-4 py-3 bg-red-900/30 border-b border-red-700/50">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-red-300">
                                    Delete this custom shader? This cannot be undone.
                                </span>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-3 py-1 text-sm text-gray-300 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-white rounded"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Content Area - Flex row for editor + AI panel */}
                    <div className="flex-1 flex flex-row overflow-hidden">
                        {/* Main Editor Content */}
                        <div className="flex-1 flex flex-col overflow-hidden">

                    {/* Metadata Fields */}
                    <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Shader Name</label>
                            <input
                                type="text"
                                value={state.name}
                                onChange={(e) => setState(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                placeholder="My Shader"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Author</label>
                            <input
                                type="text"
                                value={state.author}
                                onChange={(e) => setState(prev => ({ ...prev, author: e.target.value }))}
                                className="w-full px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                placeholder="Your Name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Speed</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={state.speed}
                                onChange={(e) => setState(prev => ({ ...prev, speed: parseFloat(e.target.value) || 1 }))}
                                className="w-full px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-3">
                            <label className="block text-xs text-gray-400 mb-1">Description</label>
                            <input
                                type="text"
                                value={state.description}
                                onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                placeholder="Describe your shader..."
                            />
                        </div>
                    </div>

                    {/* Tab Bar */}
                    <div className="flex items-center px-4 py-2 bg-gray-800 border-b border-gray-700 space-x-2">
                        {state.tabs.map((tab) => (
                            <div key={tab} className="flex items-center">
                                <button
                                    onClick={() => handleTabChange(tab)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                                        state.activePanelTab === tab
                                            ? 'bg-gray-700 text-white'
                                            : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    {tab === 'image' ? 'Image' : `Buffer ${tab.replace('buffer', '')}`}
                                </button>
                                {tab !== 'image' && (
                                    <button
                                        onClick={() => handleRemoveBuffer(tab)}
                                        className="ml-1 p-0.5 text-gray-500 hover:text-red-400 rounded"
                                        title="Remove buffer"
                                    >
                                        <MinusIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={handleAddBuffer}
                            className="flex items-center px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            title="Add buffer"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={() => setState(prev => ({ ...prev, activePanelTab: 'uniforms' }))}
                            className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                                state.activePanelTab === 'uniforms'
                                    ? 'bg-gray-700 text-indigo-300'
                                    : 'text-gray-400 hover:text-gray-200'
                            }`}
                            title="Edit custom uniforms"
                        >
                            <AdjustmentsHorizontalIcon className="w-4 h-4 mr-1" />
                            Uniforms {state.customUniforms.length > 0 && <span className="ml-1 text-xs bg-indigo-600 text-white rounded-full px-1.5">{state.customUniforms.length}</span>}
                        </button>
                        <button
                            onClick={() => setState(prev => ({ ...prev, activePanelTab: 'midi' }))}
                            className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                                state.activePanelTab === 'midi'
                                    ? 'bg-gray-700 text-purple-300'
                                    : 'text-gray-400 hover:text-gray-200'
                            }`}
                            title="Configure MIDI mappings"
                        >
                            <MusicalNoteIcon className="w-4 h-4 mr-1" />
                            MIDI
                        </button>
                    </div>

                    {/* Uniforms Panel */}
                    {state.activePanelTab === 'uniforms' && (
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-gray-900">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-300 flex items-center">
                                    <AdjustmentsHorizontalIcon className="w-4 h-4 mr-2 text-indigo-400" />
                                    Custom Uniforms
                                </h3>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={handleDetectUniforms}
                                        className="flex items-center px-3 py-1.5 text-xs bg-teal-700 hover:bg-teal-600 text-white rounded transition-colors"
                                        title="Scan shader code for non-standard uniform declarations"
                                    >
                                        <MagnifyingGlassIcon className="w-3.5 h-3.5 mr-1" />
                                        Detect from code
                                    </button>
                                    <button
                                        onClick={handleAddUniform}
                                        className="flex items-center px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5 mr-1" />
                                        Add uniform
                                    </button>
                                </div>
                            </div>

                            {state.customUniforms.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 text-sm">
                                    <AdjustmentsHorizontalIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    No custom uniforms defined.<br />
                                    Click <strong className="text-gray-400">Detect from code</strong> to auto-detect from <code className="text-xs">uniform</code> declarations, or <strong className="text-gray-400">Add uniform</strong> to add one manually.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {state.customUniforms.map((u, idx) => (
                                        <div key={idx} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-mono text-indigo-400">{u.name || <em className="text-gray-500">unnamed</em>}</span>
                                                <button onClick={() => handleRemoveUniform(idx)} className="text-gray-500 hover:text-red-400 transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Uniform name</label>
                                                    <input
                                                        type="text"
                                                        value={u.name}
                                                        onChange={e => handleUniformChange(idx, 'name', e.target.value)}
                                                        placeholder="iMyParam"
                                                        className="w-full px-2 py-1 text-xs bg-gray-700 text-white border border-gray-600 rounded font-mono focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Label (UI display)</label>
                                                    <input
                                                        type="text"
                                                        value={u.label}
                                                        onChange={e => handleUniformChange(idx, 'label', e.target.value)}
                                                        placeholder="My Parameter"
                                                        className="w-full px-2 py-1 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 mb-2">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Type</label>
                                                    <select
                                                        value={u.type}
                                                        onChange={e => handleUniformChange(idx, 'type', e.target.value)}
                                                        className="w-full px-2 py-1 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                                    >
                                                        <option value="float">float</option>
                                                        <option value="int">int</option>
                                                        <option value="bool">bool</option>
                                                        <option value="vec2">vec2</option>
                                                        <option value="vec3">vec3</option>
                                                        <option value="vec4">vec4</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Default</label>
                                                    <input
                                                        type={u.type === 'bool' ? 'checkbox' : (u.type === 'float' || u.type === 'int') ? 'number' : 'text'}
                                                        checked={u.type === 'bool' ? !!u.default : undefined}
                                                        value={u.type === 'bool' ? undefined : (Array.isArray(u.default) ? (u.default as number[]).join(', ') : String(u.default))}
                                                        step={u.type === 'float' ? u.step ?? 0.01 : 1}
                                                        onChange={e => {
                                                            if (u.type === 'bool') handleUniformChange(idx, 'default', e.target.checked);
                                                            else if (u.type === 'int') handleUniformChange(idx, 'default', parseInt(e.target.value) || 0);
                                                            else if (u.type === 'float') handleUniformChange(idx, 'default', parseFloat(e.target.value) || 0);
                                                            else handleUniformChange(idx, 'default', e.target.value.split(',').map(v => parseFloat(v.trim()) || 0));
                                                        }}
                                                        className={u.type === 'bool' ? 'mt-1 w-4 h-4 accent-indigo-500' : 'w-full px-2 py-1 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500'}
                                                    />
                                                </div>
                                                {(u.type === 'float' || u.type === 'int') && (
                                                    <div className="grid grid-cols-3 gap-1 col-span-1">
                                                        {(['min', 'max', 'step'] as const).map(f => (
                                                            <div key={f}>
                                                                <label className="block text-xs text-gray-400 mb-1">{f}</label>
                                                                <input
                                                                    type="number"
                                                                    value={u[f] ?? ''}
                                                                    step={f === 'step' ? 'any' : undefined}
                                                                    onChange={e => handleUniformChange(idx, f, parseFloat(e.target.value))}
                                                                    className="w-full px-1 py-1 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Options (dropdown) */}
                                            {(u.type === 'float' || u.type === 'int') && (
                                                <div className="mt-2 pt-2 border-t border-gray-700">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-gray-400">Dropdown options <span className="text-gray-500">(optional — shows as select instead of slider)</span></span>
                                                        <button onClick={() => handleAddUniformOption(idx)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center">
                                                            <PlusIcon className="w-3 h-3 mr-0.5" /> Add
                                                        </button>
                                                    </div>
                                                    {(u.options || []).map((opt, oIdx) => (
                                                        <div key={oIdx} className="flex items-center space-x-2 mb-1">
                                                            <input
                                                                type="text"
                                                                value={opt.label}
                                                                placeholder="Label"
                                                                onChange={e => handleUniformOptionChange(idx, oIdx, 'label', e.target.value)}
                                                                className="flex-1 px-2 py-0.5 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                                            />
                                                            <input
                                                                type="number"
                                                                value={opt.value}
                                                                placeholder="Value"
                                                                onChange={e => handleUniformOptionChange(idx, oIdx, 'value', e.target.value)}
                                                                className="w-16 px-2 py-0.5 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
                                                            />
                                                            <button onClick={() => handleRemoveUniformOption(idx, oIdx)} className="text-gray-500 hover:text-red-400">
                                                                <XMarkIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MIDI Panel */}
                    {state.activePanelTab === 'midi' && (
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-gray-900">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-300 flex items-center">
                                    <MusicalNoteIcon className="w-4 h-4 mr-2 text-purple-400" />
                                    MIDI Mappings
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mb-4">
                                Configure MIDI mappings for this shader in the MIDI tab of the main options page.
                                MIDI mappings are shared across all shaders and can target shader parameters.
                            </p>
                            {state.customUniforms.length > 0 ? (
                                <div className="bg-gray-800 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-700 text-gray-500 uppercase tracking-wide">
                                                <th className="text-left px-3 py-2 font-medium">Parameter</th>
                                                <th className="text-left px-3 py-2 font-medium">Type</th>
                                                <th className="text-left px-3 py-2 font-medium">Range</th>
                                                <th className="text-left px-3 py-2 font-medium">MIDI target</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {state.customUniforms.map((u, i) => (
                                                <tr key={u.name} className={i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                                                    <td className="px-3 py-2 text-gray-200 font-medium">{u.label || u.name}</td>
                                                    <td className="px-3 py-2 text-indigo-300 font-mono">{u.type}</td>
                                                    <td className="px-3 py-2 text-gray-400 font-mono">
                                                        {u.min !== undefined && u.max !== undefined
                                                            ? `${u.min} – ${u.max}`
                                                            : u.type === 'bool' ? 'off / on'
                                                            : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-purple-300 font-mono">uniform:{u.name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 italic">No custom uniforms defined yet. Add uniforms in the Uniforms tab to enable MIDI control.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Channel Configuration + Editor — hidden when Uniforms or MIDI tab is active */}
                    {(state.activePanelTab !== 'uniforms' && state.activePanelTab !== 'midi') && (<>
                    <div className="px-4 py-2 bg-gray-850 border-b border-gray-700" style={{ backgroundColor: '#1a1f2e' }}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">Channel Inputs</span>
                            <button
                                type="button"
                                onClick={() => uploadInputRef.current?.click()}
                                className="flex items-center text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                title="Upload a custom image or video"
                            >
                                <PlusIcon className="w-3 h-3 mr-1" />
                                Upload Media
                            </button>
                            <input
                                ref={uploadInputRef}
                                type="file"
                                accept={`${SUPPORTED_IMAGE_EXTENSIONS},${SUPPORTED_VIDEO_EXTENSIONS}`}
                                multiple
                                className="hidden"
                                onChange={handleQuickUpload}
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {CHANNEL_LABELS.map((label, idx) => {
                                const chKey = CHANNEL_KEYS[idx] as keyof BufferDefinition;
                                const samplerKey = SAMPLER_KEYS[idx];
                                const chVal = (state.buffers[state.activeTab]?.[chKey] as string) || "";
                                const sampler: ChannelSampler = (state.buffers[state.activeTab] as any)?.[samplerKey] ?? { ...DEFAULT_SAMPLER };
                                const showSampler = isTextureOrCubemap(chVal);
                                return (
                                    <div key={label} className="flex flex-col space-y-1 bg-gray-800 rounded p-2">
                                        <label className="text-xs font-mono text-indigo-400">{label}</label>
                                        {/* Asset picker */}
                                        <select
                                            value={chVal}
                                            onChange={(e) => handleChannelChange(state.activeTab, chKey as string, e.target.value)}
                                            className="text-xs bg-gray-700 text-white border border-gray-600 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500 w-full"
                                        >
                                            <option value="">— None —</option>
                                            <option value="audio">Audio (iAudioData)</option>
                                            <option value="video">Video / Display Capture (iVideo)</option>
                                            <option value="keyboard">Keyboard (iKeyboard)</option>
                                            <option value="midi">MIDI State (iMidi)</option>
                                            <optgroup label="Buffers">
                                                <option value="buffer0">Buffer A</option>
                                                <option value="buffer1">Buffer B</option>
                                                <option value="buffer2">Buffer C</option>
                                                <option value="buffer3">Buffer D</option>
                                            </optgroup>
                                            <optgroup label="Textures">
                                                {BUNDLED_TEXTURES.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Cubemaps">
                                                {BUNDLED_CUBEMAPS.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Volume Textures (3D)">
                                                {BUNDLED_VOLUME_TEXTURES.map(v => (
                                                    <option key={v.value} value={v.value}>{v.label}</option>
                                                ))}
                                            </optgroup>
                                            {customImages.length > 0 && (
                                                <optgroup label="Custom Images">
                                                    {customImages.map(img => (
                                                        <option key={img.id} value={imageIdToChannelRef(img.id)}>
                                                            {img.name} ({formatBytes(img.size)})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="Bundled Videos">
                                                {BUNDLED_VIDEOS.map(v => (
                                                    <option key={v.value} value={v.value}>{v.label}</option>
                                                ))}
                                            </optgroup>
                                            {customVideos.length > 0 && (
                                                <optgroup label="Custom Videos">
                                                    {customVideos.map(vid => (
                                                        <option key={vid.id} value={videoIdToChannelRef(vid.id)}>
                                                            {vid.name} ({formatVideoBytes(vid.size)})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            {customCubemaps.length > 0 && (
                                                <optgroup label="Custom Cubemaps">
                                                    {customCubemaps.map(cmap => (
                                                        <option key={cmap.id} value={cubemapIdToChannelRef(cmap.id)}>
                                                            {cmap.name} ({formatCubemapBytes(cmap.size)})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                        {/* Thumbnail preview for selected custom image */}
                                        {isCustomImageRef(chVal) && customImageThumbs[channelRefToImageId(chVal)!] && (
                                            <img
                                                src={customImageThumbs[channelRefToImageId(chVal)!]}
                                                alt="preview"
                                                className="w-full h-10 object-cover rounded border border-gray-600 mt-1"
                                            />
                                        )}
                                        {/* Video indicator for selected custom video, bundled video, or live capture */}
                                        {(chVal === 'video' || isCustomVideoRef(chVal) || isBundledVideoRef(chVal)) && (
                                            <div className="flex items-center justify-center w-full h-10 rounded border border-gray-600 mt-1 bg-gray-800 text-gray-400 text-xs gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                                                Video
                                            </div>
                                        )}
                                        {/* Sampler controls — only when a texture/cubemap is selected */}
                                        {showSampler && (
                                            <div className="flex flex-col space-y-1 pt-1 border-t border-gray-700">
                                                {/* Filter */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-400 w-10">Filter</span>
                                                    <select
                                                        value={sampler.filter}
                                                        onChange={(e) => handleSamplerChange(state.activeTab, samplerKey, 'filter', e.target.value)}
                                                        className="text-xs bg-gray-700 text-white border border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500 flex-1 ml-1"
                                                    >
                                                        <option value="mipmap">Mipmap</option>
                                                        <option value="linear">Linear</option>
                                                        <option value="nearest">Nearest</option>
                                                    </select>
                                                </div>
                                                {/* Wrap */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-400 w-10">Wrap</span>
                                                    <select
                                                        value={sampler.wrap}
                                                        onChange={(e) => handleSamplerChange(state.activeTab, samplerKey, 'wrap', e.target.value)}
                                                        className="text-xs bg-gray-700 text-white border border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500 flex-1 ml-1"
                                                    >
                                                        <option value="clamp">Clamp</option>
                                                        <option value="repeat">Repeat</option>
                                                    </select>
                                                </div>
                                                {/* VFlip */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-400 w-10">VFlip</span>
                                                    <label className="flex items-center cursor-pointer ml-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={sampler.vflip}
                                                            onChange={(e) => handleSamplerChange(state.activeTab, samplerKey, 'vflip', e.target.checked)}
                                                            className="w-3 h-3 accent-indigo-500"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Editor */}
                    <div className="flex-1 min-h-0">
                        <CodeMirror
                            value={state.buffers[state.activeTab]?.code || ''}
                            height="100%"
                            theme={oneDark}
                            editable={!isSaving}
                            onChange={handleCodeChange}
                            className="h-full text-sm"
                            basicSetup={{
                                lineNumbers: true,
                                highlightActiveLineGutter: true,
                                highlightActiveLine: true,
                                foldGutter: true,
                                autocompletion: false
                            }}
                        />
                    </div>
                    </>)}
                    </div> {/* Close main editor content flex-col */}

                        {/* Resize Handle */}
                        {showAIPanel && (
                            <div
                                className="w-1 cursor-col-resize bg-gray-600 hover:bg-indigo-500 transition-colors z-10"
                                onMouseDown={(e) => {
                                    isResizingRef.current = true;
                                    resizeStartXRef.current = e.clientX;
                                    resizeStartWidthRef.current = aiPanelWidth;
                                    e.preventDefault();
                                }}
                                style={{ cursor: 'col-resize' }}
                            />
                        )}

                        {/* AI Side Panel */}
                        <AISidePanel
                            isOpen={showAIPanel}
                            onClose={() => setShowAIPanel(false)}
                            onInsertCode={(code, targetBuffer) => {
                                const bufferKey = targetBuffer || state.activeTab;
                                setState(prev => ({
                                    ...prev,
                                    buffers: {
                                        ...prev.buffers,
                                        [bufferKey]: {
                                            ...prev.buffers[bufferKey],
                                            code: code
                                        }
                                    }
                                }));
                                // Switch to the target buffer if different
                                if (targetBuffer && targetBuffer !== state.activeTab) {
                                    setState(prev => ({ ...prev, activeTab: targetBuffer }));
                                }
                                setNotification({ message: `AI code applied to ${bufferKey}!`, type: 'success' });
                            }}
                            currentCode={state.buffers[state.activeTab]?.code}
                            allBufferCodes={{
                                image: state.buffers.image?.code,
                                bufferA: state.buffers.bufferA?.code,
                                bufferB: state.buffers.bufferB?.code,
                                bufferC: state.buffers.bufferC?.code,
                                bufferD: state.buffers.bufferD?.code,
                            }}
                            activeTab={state.activeTab}
                            width={aiPanelWidth}
                            isGenerating={isAILoading}
                            onCancelGeneration={handleCancelAI}
                        />
                    </div> {/* Close flex-row main content area */}
                </div>
            </div>
        </>
    );
}

// Helper functions
function createInitialState(shaderObject: ShaderObject | null, isCustom: boolean): ShaderEditorState {
    if (!shaderObject) {
        // New custom shader
        const empty = createEmptyShader(generateShaderId(), "New Shader");
        return {
            name: "New Shader",
            originalName: "New Shader",
            author: "",
            description: "",
            speed: 1.0,
            tabs: ['image'],
            activeTab: 'image',
            activePanelTab: 'image',
            buffers: {
                image: {
                    name: 'image',
                    code: empty.inlineCode!,
                    channel0: "",
                    channel1: "",
                    channel2: "",
                    channel3: ""
                }
            },
            customUniforms: []
        };
    }

    // Existing shader
    const meta: any = shaderObject.metaData || {};
    const tabs: EditorTab[] = ['image'];
    const buffers: Partial<Record<EditorTab, BufferDefinition>> = {
        image: {
            name: 'image',
            code: shaderObject.inlineCode || '',
            channel0: meta.iChannel0 || "",
            channel1: meta.iChannel1 || "",
            channel2: meta.iChannel2 || "",
            channel3: meta.iChannel3 || "",
            channel0Sampler: isTextureOrCubemap(meta.iChannel0) ? (meta.iChannel0Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
            channel1Sampler: isTextureOrCubemap(meta.iChannel1) ? (meta.iChannel1Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
            channel2Sampler: isTextureOrCubemap(meta.iChannel2) ? (meta.iChannel2Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
            channel3Sampler: isTextureOrCubemap(meta.iChannel3) ? (meta.iChannel3Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
        }
    };

    // Add buffer tabs from metadata
    console.log('[ShaderEditor] Loading shader, meta.buffers:', meta.buffers);
    if (meta.buffers) {
        const bufferOrder: EditorTab[] = ['bufferA', 'bufferB', 'bufferC', 'bufferD'];
        
        meta.buffers.forEach((buffer: BufferConfig) => {
            const outputIndex = buffer.output;
            const tabName = bufferOrder[outputIndex];
            
            console.log(`[ShaderEditor] Processing buffer ${buffer.shaderName}:`, {
                outputIndex, tabName, 
                iChannel0: buffer.iChannel0,
                iChannel1: buffer.iChannel1,
                iChannel2: buffer.iChannel2,
                iChannel3: buffer.iChannel3
            });
            
            if (tabName && !tabs.includes(tabName)) {
                tabs.push(tabName);
                const bufferCode = shaderObject.inlineBuffers?.[buffer.shaderName] || getDefaultBufferCode(tabName);
                
                buffers[tabName] = {
                    name: tabName,
                    code: bufferCode,
                    channel0: buffer.iChannel0 || "",
                    channel1: buffer.iChannel1 || "",
                    channel2: buffer.iChannel2 || "",
                    channel3: buffer.iChannel3 || "",
                    channel0Sampler: isTextureOrCubemap(buffer.iChannel0) ? ((buffer as any).iChannel0Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
                    channel1Sampler: isTextureOrCubemap(buffer.iChannel1) ? ((buffer as any).iChannel1Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
                    channel2Sampler: isTextureOrCubemap(buffer.iChannel2) ? ((buffer as any).iChannel2Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
                    channel3Sampler: isTextureOrCubemap(buffer.iChannel3) ? ((buffer as any).iChannel3Sampler ?? { ...DEFAULT_SAMPLER }) : undefined,
                };
            }
        });
    }

    // Also check inlineBuffers for any not in metadata
    if (shaderObject.inlineBuffers) {
        Object.entries(shaderObject.inlineBuffers).forEach(([filename, code]) => {
            const tabName = filename.replace('.frag', '') as EditorTab;
            if (['bufferA', 'bufferB', 'bufferC', 'bufferD'].includes(tabName) && !tabs.includes(tabName)) {
                tabs.push(tabName);
                buffers[tabName] = {
                    name: tabName,
                    code,
                    channel0: "",
                    channel1: "",
                    channel2: "",
                    channel3: ""
                };
            }
        });
    }

    const shaderName = meta.shaderName || shaderObject.shaderName.replace('.frag', '');
    return {
        name: shaderName,
        originalName: shaderName,
        author: meta.author || "",
        description: meta.description || "",
        speed: meta.shaderSpeed ?? 0.4,
        tabs,
        activeTab: 'image',
        activePanelTab: 'image',
        buffers,
        customUniforms: meta.customUniforms ? [...meta.customUniforms] : []
    };
}

function getDefaultBufferCode(bufferName: string): string {
    return `// ${bufferName}
// This buffer can be referenced by the main image shader

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    
    // Sample from input channels
    vec4 channel0 = texture(iChannel0, uv);
    
    // Your buffer code here
    gl_FragColor = vec4(uv, 0.0, 1.0);
}`;
}
