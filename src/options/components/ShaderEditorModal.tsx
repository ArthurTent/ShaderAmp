import React, { useState, useEffect, useCallback } from "react";
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
    ExclamationCircleIcon
} from "@heroicons/react/24/outline";
import type { ShaderObject, BufferConfig, ShaderMetaData } from "@src/helpers/types";
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

interface ShaderEditorState {
    name: string;
    author: string;
    description: string;
    speed: number;
    tabs: EditorTab[];
    activeTab: EditorTab;
    buffers: Partial<Record<EditorTab, BufferDefinition>>;
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

const BUNDLED_CUBEMAPS = [
    { value: 'images/cubemaps/abc.jpg',                                                                                      label: 'abc (forest)' },
    { value: 'images/cubemaps/94284d43be78f00eb6b298e6d78656a1b34e2b91b34940d02f1ca8b22310e8a0.png',                          label: '94284d…e8a0 (shadertoy)' },
];

function isTextureOrCubemap(val?: string) {
    if (!val) return false;
    if (val === 'audio') return false;
    if (/^buffer\d+$/.test(val)) return false;
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
    const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
                        
                        // Create shader object with fetched code
                        const shaderWithCode = {
                            ...shaderObject,
                            inlineCode: code
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
        setState(prev => ({ ...prev, activeTab: tab }));
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
            
            return {
                ...prev,
                tabs: newTabs,
                activeTab: newTabs.includes(prev.activeTab) ? prev.activeTab : 'image',
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

    const handleSave = async () => {
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

            // Save based on shader type
            if (isCustom && customId) {
                console.log('[ShaderEditor] Saving as custom shader with ID:', customId);
                const customShader: CustomShader = {
                    ...updatedShader,
                    id: customId,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                await saveCustomShader(customShader);
                console.log('[ShaderEditor] Custom shader saved successfully');
            } else if (importId) {
                console.log('[ShaderEditor] Saving as edited imported shader:', importId);
                await saveEditedImportedShader(importId, updatedShader);
            } else if (shaderObject) {
                console.log('[ShaderEditor] Saving as edited built-in shader:', shaderObject.shaderName);
                await saveEditedShader(shaderObject.shaderName, updatedShader);
            } else {
                console.error('[ShaderEditor] Cannot save: no shader type determined');
                throw new Error('Cannot determine shader type to save');
            }

            setNotification({ message: "Shader saved successfully!", type: 'success' });
            onSave?.();
            
            // Close after short delay
            setTimeout(() => onClose(), 1000);
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
                
                <div className="relative w-full max-w-6xl h-[90vh] bg-gray-800 rounded-lg shadow-2xl flex flex-col overflow-hidden">
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
                                    console.log('SAVE BUTTON CLICKED');
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSave();
                                }}
                                disabled={isSaving}
                                className="flex items-center px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded transition-colors"
                            >
                                <DocumentArrowDownIcon className="w-4 h-4 mr-1" />
                                {isSaving ? 'Saving...' : 'Save'}
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
                                        state.activeTab === tab
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
                    </div>

                    {/* Channel Configuration — all tabs */}
                    <div className="px-4 py-2 bg-gray-850 border-b border-gray-700" style={{ backgroundColor: '#1a1f2e' }}>
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
                                        </select>
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
            author: "",
            description: "",
            speed: 1.0,
            tabs: ['image'],
            activeTab: 'image',
            buffers: {
                image: {
                    name: 'image',
                    code: empty.inlineCode!,
                    channel0: "",
                    channel1: "",
                    channel2: "",
                    channel3: ""
                }
            }
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

    return {
        name: meta.shaderName || shaderObject.shaderName.replace('.frag', ''),
        author: meta.author || "",
        description: meta.description || "",
        speed: meta.shaderSpeed ?? 1.0,
        tabs,
        activeTab: 'image',
        buffers
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
