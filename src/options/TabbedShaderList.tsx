import React, { useState, useEffect, useMemo } from 'react';
import ShaderList from './ShaderList';
import ImportedShadersTab from './ImportedShadersTab';
import ShaderInfoModal from "./components/ShaderInfoModal";
import type { ShaderCatalog, ShaderOptions, ShaderObject, ImportedShader } from "@src/helpers/types";
import type { CustomShader } from "@src/helpers/shaderStorage";
import browser from "webextension-polyfill";
import { TagIcon, XMarkIcon, TrashIcon, PlusIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";

type TabType = 'all' | 'stable' | 'experimental' | 'imported' | 'custom' | string;

type TabbedShaderListProps = {
    shaderCatalog: ShaderCatalog;
    shaderOptions: ShaderOptions;
    selectedShaderIndex: number;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void;
    onShaderInfoRequested: (shaderIndex: number) => void;
    onShaderEdit?: (shader: ShaderObject | null, options?: { importId?: string; isCustom?: boolean; customId?: string }) => void;
}

export default function TabbedShaderList({
    shaderCatalog,
    shaderOptions,
    selectedShaderIndex,
    onShaderSelected,
    onVisiblityToggled,
    onShaderInfoRequested,
    onShaderEdit
}: TabbedShaderListProps) {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [filteredShaders, setFilteredShaders] = useState<(ShaderObject & { isImported?: boolean; importedId?: string; isEdited?: boolean })[]>([]);
    const [shaderMetadata, setShaderMetadata] = useState<Record<string, any>>({});
    const [currentShader, setCurrentShader] = useState<ShaderObject | null>(null);
    
    // Custom Tabs State
    const [customTabs, setCustomTabs] = useState<string[]>([]);
    const [shaderTabs, setShaderTabs] = useState<Record<string, string[]>>({});
    const [importedShaders, setImportedShaders] = useState<ImportedShader[]>([]);
    const [importedCount, setImportedCount] = useState(0);
    
    // Custom Shaders State
    const [customShaders, setCustomShaders] = useState<CustomShader[]>([]);
    
    // Edited Imported Shaders State
    const [editedImported, setEditedImported] = useState<Record<string, ShaderObject>>({});

    // Modal States
    const [showManageTabs, setShowManageTabs] = useState(false);
    const [tabEditTarget, setTabEditTarget] = useState<{ idOrName: string; displayName: string } | null>(null);
    const [infoModalShader, setInfoModalShader] = useState<ShaderObject | null>(null);
    const [showInfoModal, setShowInfoModal] = useState(false);

    // Load shader metadata on component mount
    useEffect(() => {
        const loadMetadata = async () => {
            const metadata: Record<string, any> = {};
            
            for (const shader of shaderCatalog.shaders) {
                try {
                    const response = await fetch(`/shaders/${shader.shaderName}.meta`);
                    if (response.ok) {
                        metadata[shader.shaderName] = await response.json();
                    }
                } catch (error) {
                    console.error(`Failed to load metadata for ${shader.shaderName}:`, error);
                    metadata[shader.shaderName] = { experimental: false };
                }
            }
            
            setShaderMetadata(metadata);
        };

        loadMetadata();
    }, [shaderCatalog.shaders]);

    const loadCustomTabsData = async () => {
        const result = await browser.storage.local.get(['state.customtabs', 'state.shadertabs']);
        setCustomTabs(result['state.customtabs'] || []);
        setShaderTabs(result['state.shadertabs'] || {});
    };

    const loadImportedCountAndShaders = async () => {
        const response = await browser.runtime.sendMessage({ command: 'GET_IMPORTED_SHADERS' });
        if (response?.success) {
            const list = response.data?.shaders || [];
            setImportedShaders(list);
            setImportedCount(list.length);
        }
    };

    const loadCustomShaders = async () => {
        const result = await browser.storage.local.get('state.customshaders');
        setCustomShaders(result['state.customshaders'] || []);
    };

    const loadEditedImported = async () => {
        const result = await browser.storage.local.get('state.editedimported');
        setEditedImported(result['state.editedimported'] || {});
    };

    const loadCurrentShader = async () => {
        const result = await browser.storage.local.get(['state.currentshader']);
        setCurrentShader(result['state.currentshader'] || null);
    };

    useEffect(() => {
        loadCustomTabsData();
        loadImportedCountAndShaders();
        loadCurrentShader();
        loadCustomShaders();
        loadEditedImported();

        // Sync count and tabs across storage changes
        const handleStorageChange = (changes: any, areaName: string) => {
            if (areaName === 'local') {
                if (changes['state.importedshaders']) {
                    const list = changes['state.importedshaders'].newValue?.shaders || [];
                    setImportedShaders(list);
                    setImportedCount(list.length);
                }
                if (changes['state.customshaders']) {
                    setCustomShaders(changes['state.customshaders'].newValue || []);
                }
                if (changes['state.editedimported']) {
                    setEditedImported(changes['state.editedimported'].newValue || {});
                }
                if (changes['state.customtabs']) {
                    setCustomTabs(changes['state.customtabs'].newValue || []);
                }
                if (changes['state.shadertabs']) {
                    setShaderTabs(changes['state.shadertabs'].newValue || {});
                }
                if (changes['state.currentshader']) {
                    setCurrentShader(changes['state.currentshader'].newValue || null);
                }
            }
        };
        browser.storage.onChanged.addListener(handleStorageChange);
        return () => {
            browser.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    // Get all unique tabs from shader metadata
    const allTabs = useMemo(() => {
        const tabs = new Set<string>();
        Object.values(shaderMetadata).forEach((meta: any) => {
            if (meta.tab) {
                if (Array.isArray(meta.tab)) {
                    meta.tab.forEach((tab: string) => tabs.add(tab));
                } else if (typeof meta.tab === 'string') {
                    tabs.add(meta.tab);
                }
            }
        });
        return Array.from(tabs);
    }, [shaderMetadata]);
    
    // Save edited imported shader count
    const editedImportedCount = Object.keys(editedImported).length;

    // Count shaders in each category
    const [shaderCounts, setShaderCounts] = useState<Record<string, number>>({
        all: 0,
        stable: 0,
        experimental: 0,
        imported: 0
    });

    // Filter shaders based on active tab and update counts
    useEffect(() => {
        const editedImportedCount = Object.keys(editedImported).length;
        const counts: Record<string, number> = {
            all: 0,
            stable: 0,
            experimental: 0,
            imported: importedCount,
            custom: customShaders.length + editedImportedCount
        };

        // Initialize counts for custom tabs
        customTabs.forEach(tab => {
            counts[`custom-${tab}`] = 0;
        });

        // Map all candidate shaders: standard shaders + imported shaders + edited imported shaders
        const allCandidates: (ShaderObject & { isImported?: boolean; importedId?: string; isEdited?: boolean })[] = [
            ...shaderCatalog.shaders.map(s => ({ ...s, isImported: false })),
            ...importedShaders.map(imp => {
                const inlineBuffers: { [filename: string]: string } = {};
                for (const buffer of imp.bufferShaders || []) {
                    inlineBuffers[buffer.filename] = buffer.code;
                }
                const meta = { ...imp.mainShader.meta, previewImage: imp.previewImage } as any;
                return {
                    shaderName: imp.mainShader.filename,
                    metaData: meta,
                    inlineCode: imp.mainShader.code,
                    inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined,
                    isImported: true,
                    importedId: imp.id
                };
            }),
            // Add edited imported shaders as separate entries
            ...Object.entries(editedImported).map(([importId, editedShader]) => ({
                ...editedShader,
                isImported: true,
                importedId: importId,
                isEdited: true
            }))
        ];

        // Process candidate counts for custom tabs
        allCandidates.forEach(shader => {
            if (shader.isImported && shader.isEdited) {
                // For edited imported shaders, use edited: prefix
                const editedKey = `edited:${shader.importedId}`;
                const editedAssigned = shaderTabs[editedKey] || [];
                editedAssigned.forEach(tab => {
                    counts[`custom-${tab}`] = (counts[`custom-${tab}`] || 0) + 1;
                });
            } else if (!shader.isImported && shader.inlineCode) {
                // For custom shaders, use their ID directly (from CustomShader type)
                const customShader = shader as any;
                if (customShader.id) {
                    const assigned = shaderTabs[customShader.id] || [];
                    assigned.forEach(tab => {
                        counts[`custom-${tab}`] = (counts[`custom-${tab}`] || 0) + 1;
                    });
                }
            } else {
                // For original imported and built-in shaders, use base key
                const baseKey = shader.isImported ? shader.importedId! : shader.shaderName;
                const assigned = shaderTabs[baseKey] || [];
                assigned.forEach(tab => {
                    counts[`custom-${tab}`] = (counts[`custom-${tab}`] || 0) + 1;
                });
            }
        });

        // Counts for default tags derived from built-in shader metadata
        shaderCatalog.shaders.forEach(shader => {
            const meta = shaderMetadata[shader.shaderName] || {};
            const isExperimental = meta.experimental === true;
            
            counts.all++;
            if (isExperimental) {
                counts.experimental++;
            } else {
                counts.stable++;
            }
        });
        // Also count imported and custom shaders in the "All" tab
        counts.all += importedShaders.length + customShaders.length;

        // Filter candidates based on active tab
        const filtered = allCandidates.filter(shader => {
            const meta = shader.isImported ? shader.metaData : (shaderMetadata[shader.shaderName] || {});
            const isExperimental = meta.experimental === true;

            if (activeTab === 'all') return true; // "All" lists every shader including imported and custom
            if (activeTab === 'custom') return false; // Custom tab handled separately
            if (activeTab === 'stable') return !shader.isImported && !isExperimental;
            if (activeTab === 'experimental') return !shader.isImported && isExperimental;
            if (activeTab === 'imported') return shader.isImported;
            
            if (activeTab.startsWith('custom-')) {
                const tabName = activeTab.substring(7);
                
                // For edited imported shaders, use edited: prefix key
                if (shader.isImported && shader.isEdited) {
                    const editedKey = `edited:${shader.importedId}`;
                    const assigned = shaderTabs[editedKey] || [];
                    return assigned.includes(tabName);
                }
                
                // For custom shaders, use their ID directly
                if (!shader.isImported && shader.inlineCode) {
                    const customShader = shader as any;
                    if (customShader.id) {
                        const assigned = shaderTabs[customShader.id] || [];
                        return assigned.includes(tabName);
                    }
                    return false;
                }
                
                // For original imported shaders and built-in shaders, use base key
                const baseKey = shader.isImported ? shader.importedId! : shader.shaderName;
                const assigned = shaderTabs[baseKey] || [];
                return assigned.includes(tabName);
            }
            return true;
        });

        setShaderCounts(counts);
        setFilteredShaders(filtered);
    }, [activeTab, shaderCatalog.shaders, shaderMetadata, customTabs, shaderTabs, importedShaders, importedCount, editedImported]);

    const handleShaderSelected = async (filteredIndex: number) => {
        const selected = filteredShaders[filteredIndex];
        if (selected.isImported) {
            // If clicking the edited version (has isEdited flag), load edited version
            if (selected.isEdited) {
                const editedShader = editedImported[selected.importedId!];
                if (editedShader) {
                    const shaderObject = {
                        shaderName: editedShader.shaderName,
                        metaData: editedShader.metaData,
                        inlineCode: editedShader.inlineCode,
                        inlineBuffers: editedShader.inlineBuffers
                    };
                    await browser.storage.local.set({ 'state.currentshader': shaderObject });
                }
            } else {
                // Load original imported shader
                const imp = importedShaders.find(s => s.id === selected.importedId);
                if (imp) {
                    const inlineBuffers: { [filename: string]: string } = {};
                    for (const buffer of imp.bufferShaders || []) {
                        inlineBuffers[buffer.filename] = buffer.code;
                    }
                    const shaderObject = {
                        shaderName: imp.mainShader.filename,
                        metaData: imp.mainShader.meta,
                        inlineCode: imp.mainShader.code,
                        inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined
                    };
                    await browser.storage.local.set({ 'state.currentshader': shaderObject });
                }
            }
        } else {
            const originalIndex = shaderCatalog.shaders.findIndex(s => s.shaderName === selected.shaderName);
            onShaderSelected(originalIndex);
        }
    };

    const handleToggleAllVisibility = async (hideAll: boolean) => {
        // Batch all built-in visibility changes into one options object
        const updatedOptions = { ...shaderOptions };
        let hasImported = false;

        for (const shader of filteredShaders) {
            if (shader.isImported) {
                const key = (shader as any).importedId!;
                updatedOptions[key] = { ...updatedOptions[key], isHidden: hideAll };
                hasImported = true;
            } else {
                updatedOptions[shader.shaderName] = { ...updatedOptions[shader.shaderName], isHidden: hideAll };
            }
        }

        if (hasImported) {
            // Write everything (built-in + imported) atomically to storage
            await browser.storage.local.set({ 'settings.shaderOptions': updatedOptions });
        } else {
            // Only built-in shaders — go through OptionsContent's setter so chrome storage syncs properly
            // Build a name→index map and call the parent once per shader
            const builtInOnly: ShaderOptions = {};
            filteredShaders.forEach(s => {
                builtInOnly[s.shaderName] = { ...updatedOptions[s.shaderName], isHidden: hideAll };
            });
            const merged = { ...shaderOptions, ...builtInOnly };
            await browser.storage.local.set({ 'settings.shaderOptions': merged });
        }
    };

    const handleVisibilityToggled = async (filteredIndex: number, isVisible: boolean) => {
        const selected = filteredShaders[filteredIndex];
        if (selected.isImported) {
            const key = selected.importedId!;
            const updated = { ...shaderOptions };
            updated[key] = { ...updated[key], isHidden: isVisible };
            await browser.storage.local.set({ 'settings.shaderOptions': updated });
        } else {
            const originalIndex = shaderCatalog.shaders.findIndex(s => s.shaderName === selected.shaderName);
            onVisiblityToggled(originalIndex, isVisible);
        }
    };

    const handleShaderInfoRequested = (filteredIndex: number) => {
        const selected = filteredShaders[filteredIndex];
        setInfoModalShader(selected);
        setShowInfoModal(true);
    };

    // Create a modified shader catalog with only the filtered shaders
    const filteredCatalog = {
        ...shaderCatalog,
        shaders: filteredShaders
    };

    // Get the selected shader's index in the filtered list
    const selectedFilteredIndex = filteredShaders.findIndex(shader => {
        if (!currentShader) return false;
        if (shader.isImported) {
            return currentShader.shaderName === shader.shaderName && currentShader.inlineCode === shader.inlineCode;
        } else {
            return currentShader.shaderName === shader.shaderName && !currentShader.inlineCode;
        }
    });

    const handleOpenTabsModal = (shaderIdOrName: string, shaderName: string) => {
        setTabEditTarget({ idOrName: shaderIdOrName, displayName: shaderName });
    };

    const handleShaderEdit = (filteredIndex: number) => {
        const selected = filteredShaders[filteredIndex];
        if (!onShaderEdit) return;

        if (selected.isImported && selected.importedId) {
            // Prefer edited version if it exists
            const edited = editedImported[selected.importedId];
            if (edited) {
                onShaderEdit(edited, { importId: selected.importedId });
            } else {
                onShaderEdit(selected, { importId: selected.importedId });
            }
        } else {
            // Edit built-in shader
            onShaderEdit(selected);
        }
    };

    const handleImportedShaderEdit = (shader: ImportedShader) => {
        if (!onShaderEdit) return;
        
        // Prefer edited version if it exists
        const edited = editedImported[shader.id];
        if (edited) {
            onShaderEdit(edited, { importId: shader.id });
            return;
        }

        // Build inline buffers map from original
        const inlineBuffers: { [filename: string]: string } = {};
        for (const buffer of shader.bufferShaders || []) {
            inlineBuffers[buffer.filename] = buffer.code;
        }

        // Create a ShaderObject from the ImportedShader
        const shaderObject: ShaderObject = {
            shaderName: shader.mainShader.filename,
            metaData: shader.mainShader.meta,
            inlineCode: shader.mainShader.code,
            inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined
        };

        onShaderEdit(shaderObject, { importId: shader.id });
    };

    return (
        <div className="w-full flex flex-col flex-1">
            {/* Tabs Row */}
            <div className="flex flex-wrap items-center border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto gap-1">
                <button
                    key="all"
                    className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'all'
                            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab('all')}
                >
                    All Shaders ({shaderCounts.all || 0})
                </button>
                <button
                    key="stable"
                    className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'stable'
                            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab('stable')}
                >
                    Stable Shaders ({shaderCounts.stable || 0})
                </button>
                <button
                    key="experimental"
                    className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'experimental'
                            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab('experimental')}
                >
                    Experimental ({shaderCounts.experimental || 0})
                </button>
                <button
                    key="imported"
                    className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'imported'
                            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab('imported')}
                >
                    Imported ({importedCount})
                </button>
                <button
                    key="custom"
                    className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'custom'
                            ? 'text-purple-600 border-b-2 border-purple-600 dark:text-purple-400 dark:border-purple-400 font-semibold'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab('custom')}
                >
                    Custom ({shaderCounts.custom || 0})
                </button>

                {/* Custom Tabs */}
                {customTabs.map(tab => (
                    <button
                        key={`custom-${tab}`}
                        className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                            activeTab === `custom-${tab}`
                                ? 'text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                        onClick={() => setActiveTab(`custom-${tab}`)}
                    >
                        📁 {tab} ({shaderCounts[`custom-${tab}`] || 0})
                    </button>
                ))}

                {/* Manage Tabs Button */}
                <button
                    onClick={() => setShowManageTabs(true)}
                    className="ml-auto py-1 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded font-medium flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    title="Manage custom categories/tabs"
                >
                    <Cog6ToothIcon className="w-3.5 h-3.5" />
                    Manage Tabs
                </button>
            </div>

            {/* Shader List */}
            <div className="flex-1 w-full bg-white dark:bg-gray-900">
                {activeTab === 'imported' ? (
                    <ImportedShadersTab onEditTabs={handleOpenTabsModal} onShaderEdit={handleImportedShaderEdit} />
                ) : activeTab === 'custom' ? (
                    <CustomShadersList 
                        customShaders={customShaders}
                        editedImported={editedImported}
                        onShaderEdit={(shader, isEditedImported, importId) => {
                            if (isEditedImported && importId) {
                                onShaderEdit?.(shader, { importId });
                            } else if ('id' in shader) {
                                onShaderEdit?.(shader, { isCustom: true, customId: shader.id });
                            }
                        }}
                        onShaderSelect={async (shader, isEditedImported) => {
                            // Load shader into state.currentshader
                            // For edited imported shaders, the shader object already has the edited code
                            const shaderObject = {
                                shaderName: shader.shaderName,
                                metaData: shader.metaData,
                                inlineCode: shader.inlineCode,
                                inlineBuffers: shader.inlineBuffers
                            };
                            await browser.storage.local.set({ 'state.currentshader': shaderObject });
                        }}
                        onEditTabs={handleOpenTabsModal}
                        onDelete={() => {
                            loadCustomShaders();
                            loadEditedImported();
                        }}
                    />
                ) : (
                    <ShaderList
                        shaderCatalog={filteredCatalog}
                        shaderOptions={shaderOptions}
                        selectedShaderIndex={selectedFilteredIndex}
                        onShaderSelected={handleShaderSelected}
                        onVisiblityToggled={handleVisibilityToggled}
                        onToggleAllVisibility={handleToggleAllVisibility}
                        onShaderInfoRequested={handleShaderInfoRequested}
                        onEditTabs={handleOpenTabsModal}
                        onShaderEdit={handleShaderEdit}
                    />
                )}
            </div>

            {/* TAB MANAGEMENT MODAL */}
            {showManageTabs && (
                <TabManagementModal
                    customTabs={customTabs}
                    onClose={() => setShowManageTabs(false)}
                    onUpdate={loadCustomTabsData}
                />
            )}

            {/* SHADER TAB ASSIGNMENT MODAL */}
            {tabEditTarget && (
                <ShaderTabAssignmentModal
                    shaderIdOrName={tabEditTarget.idOrName}
                    shaderDisplayName={tabEditTarget.displayName}
                    customTabs={customTabs}
                    assignedTabs={shaderTabs[tabEditTarget.idOrName] || []}
                    onClose={() => setTabEditTarget(null)}
                    onUpdate={loadCustomTabsData}
                />
            )}

            {/* SHADER INFO MODAL */}
            {showInfoModal && infoModalShader && (
                <ShaderInfoModal
                    shaderObject={infoModalShader}
                    showModal={showInfoModal}
                    setShowModal={setShowInfoModal}
                />
            )}
        </div>
    );
}

// === SUB-COMPONENTS ===

// Tab Management Modal
interface TabManagementModalProps {
    customTabs: string[];
    onClose: () => void;
    onUpdate: () => void;
}

function TabManagementModal({ customTabs, onClose, onUpdate }: TabManagementModalProps) {
    const [newTabName, setNewTabName] = useState("");

    const handleCreateTab = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newTabName.trim();
        if (!trimmed || customTabs.includes(trimmed)) return;
        
        const updated = [...customTabs, trimmed];
        await browser.storage.local.set({ 'state.customtabs': updated });
        setNewTabName("");
        onUpdate();
    };

    const handleDeleteTab = async (tabName: string) => {
        const updated = customTabs.filter(t => t !== tabName);
        await browser.storage.local.set({ 'state.customtabs': updated });
        
        // Clean up any assignments for deleted tab
        const result = await browser.storage.local.get('state.shadertabs');
        const assignments = result['state.shadertabs'] || {};
        Object.keys(assignments).forEach(key => {
            assignments[key] = (assignments[key] || []).filter((t: string) => t !== tabName);
            if (assignments[key].length === 0) {
                delete assignments[key];
            }
        });
        await browser.storage.local.set({ 'state.shadertabs': assignments });
        onUpdate();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Manage Custom Tabs
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Create tab form */}
                <form onSubmit={handleCreateTab} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        placeholder="New tab name..."
                        value={newTabName}
                        onChange={(e) => setNewTabName(e.target.value)}
                        className="flex-1 text-sm px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-950 dark:text-white border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                        type="submit"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded font-medium flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Create
                    </button>
                </form>

                {/* Tab List */}
                <div className="flex-1 overflow-y-auto space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                        Your Tabs
                    </h4>
                    {customTabs.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No custom tabs created yet.</p>
                    ) : (
                        customTabs.map(tab => (
                            <div key={tab} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600">
                                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                                    📁 {tab}
                                </span>
                                <button
                                    onClick={() => handleDeleteTab(tab)}
                                    className="p-1 text-red-500 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none"
                                    title="Delete category"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// Shader Tab Assignment Modal
interface ShaderTabAssignmentModalProps {
    shaderIdOrName: string;
    shaderDisplayName: string;
    customTabs: string[];
    assignedTabs: string[];
    onClose: () => void;
    onUpdate: () => void;
}

function ShaderTabAssignmentModal({ shaderIdOrName, shaderDisplayName, customTabs, assignedTabs, onClose, onUpdate }: ShaderTabAssignmentModalProps) {
    const handleToggleTab = async (tabName: string) => {
        const updated = assignedTabs.includes(tabName)
            ? assignedTabs.filter(t => t !== tabName)
            : [...assignedTabs, tabName];
        
        const result = await browser.storage.local.get('state.shadertabs');
        const assignments = result['state.shadertabs'] || {};
        if (updated.length > 0) {
            assignments[shaderIdOrName] = updated;
        } else {
            delete assignments[shaderIdOrName];
        }
        await browser.storage.local.set({ 'state.shadertabs': assignments });
        onUpdate();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Configure Tabs
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            For: {shaderDisplayName}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {customTabs.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">No custom tabs found.</p>
                            <p className="text-xs text-gray-400">Click "Manage Tabs" on the top right to create your first tab!</p>
                        </div>
                    ) : (
                        customTabs.map(tab => (
                            <label
                                key={tab}
                                className="flex items-center gap-3 p-3 rounded bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-100 dark:border-gray-600 cursor-pointer select-none transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={assignedTabs.includes(tab)}
                                    onChange={() => handleToggleTab(tab)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-500 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                                    📁 {tab}
                                </span>
                            </label>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// Custom Shaders List Component
interface CustomShadersListProps {
    customShaders: CustomShader[];
    editedImported: Record<string, ShaderObject>;
    onShaderEdit: (shader: CustomShader | ShaderObject, isEditedImported?: boolean, importId?: string) => void;
    onShaderSelect: (shader: CustomShader | ShaderObject, isEditedImported?: boolean) => void;
    onEditTabs?: (shaderId: string, shaderName: string) => void;
    onDelete: () => void;
}

function CustomShadersList({ customShaders, editedImported, onShaderEdit, onShaderSelect, onEditTabs, onDelete }: CustomShadersListProps) {
    const [deleteTarget, setDeleteTarget] = useState<CustomShader | null>(null);
    const [deleteImportedTarget, setDeleteImportedTarget] = useState<string | null>(null);

    const handleDelete = async () => {
        if (deleteTarget) {
            const result = await browser.storage.local.get('state.customshaders');
            const shaders = result['state.customshaders'] || [];
            const filtered = shaders.filter((s: CustomShader) => s.id !== deleteTarget.id);
            await browser.storage.local.set({ 'state.customshaders': filtered });
            setDeleteTarget(null);
        }
        if (deleteImportedTarget) {
            const result = await browser.storage.local.get('state.editedimported');
            const edited = result['state.editedimported'] || {};
            delete edited[deleteImportedTarget];
            await browser.storage.local.set({ 'state.editedimported': edited });
            setDeleteImportedTarget(null);
        }
        onDelete();
    };

    const editedImportedEntries = Object.entries(editedImported);
    const totalCount = customShaders.length + editedImportedEntries.length;

    if (totalCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <p className="text-lg mb-2">No custom shaders yet</p>
                <p className="text-sm">Click "New Shader" to create your first custom shader, or edit an imported shader</p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customShaders.map((shader) => (
                    <div 
                        key={shader.id} 
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {shader.metaData?.shaderName || shader.shaderName}
                            </h3>
                            <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                                Custom
                            </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                            {shader.metaData?.description || "No description"}
                        </p>
                        
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => onShaderSelect(shader)}
                                className="flex-1 min-w-[60px] px-2 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                            >
                                Use
                            </button>
                            <button
                                onClick={() => onShaderEdit(shader)}
                                className="flex-1 min-w-[60px] px-2 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                            >
                                Edit
                            </button>
                            {onEditTabs && (
                                <button
                                    onClick={() => onEditTabs(shader.id, shader.metaData?.shaderName || shader.shaderName)}
                                    className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    title="Manage Tabs"
                                >
                                    📁
                                </button>
                            )}
                            <button
                                onClick={() => setDeleteTarget(shader)}
                                className="px-2 py-1.5 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
                {editedImportedEntries.map(([importId, shader]) => (
                    <div 
                        key={importId} 
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {shader.metaData?.shaderName || shader.shaderName}
                            </h3>
                            <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                Edited Import
                            </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                            {shader.metaData?.description || "Edited imported shader"}
                        </p>
                        
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => onShaderSelect(shader)}
                                className="flex-1 min-w-[60px] px-2 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                            >
                                Use
                            </button>
                            <button
                                onClick={() => onShaderEdit(shader, true, importId)}
                                className="flex-1 min-w-[60px] px-2 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                            >
                                Edit
                            </button>
                            {onEditTabs && (
                                <button
                                    onClick={() => onEditTabs(`edited:${importId}`, shader.metaData?.shaderName || shader.shaderName)}
                                    className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    title="Manage Tabs"
                                >
                                    📁
                                </button>
                            )}
                            <button
                                onClick={() => setDeleteImportedTarget(importId)}
                                className="px-2 py-1.5 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Delete Confirmation Modal for Custom Shaders */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            Delete Custom Shader
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete <strong>"{deleteTarget.metaData?.shaderName || deleteTarget.shaderName}"</strong>? 
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal for Edited Imported Shaders */}
            {deleteImportedTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            Delete Edited Import
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete this edited import? 
                            This will revert to the original imported shader.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteImportedTarget(null)}
                                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
