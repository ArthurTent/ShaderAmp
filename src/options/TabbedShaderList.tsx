import React, { useState, useEffect, useMemo } from 'react';
import ShaderList from './ShaderList';

type TabType = 'all' | 'stable' | 'experimental' | string;

type TabbedShaderListProps = {
    shaderCatalog: ShaderCatalog;
    shaderOptions: ShaderOptions;
    selectedShaderIndex: number;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void;
    onShaderInfoRequested: (shaderIndex: number) => void;
}

export default function TabbedShaderList({
    shaderCatalog,
    shaderOptions,
    selectedShaderIndex,
    onShaderSelected,
    onVisiblityToggled,
    onShaderInfoRequested
}: TabbedShaderListProps) {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [filteredShaders, setFilteredShaders] = useState<ShaderObject[]>([]);
    const [shaderMetadata, setShaderMetadata] = useState<Record<string, any>>({});

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

    // Count shaders in each category
    const [shaderCounts, setShaderCounts] = useState<Record<string, number>>({
        all: 0,
        stable: 0,
        experimental: 0
    });

    // Filter shaders based on active tab and update counts
    useEffect(() => {
        const counts: Record<string, number> = {
            all: 0,
            stable: 0,
            experimental: 0,
        };

        // Initialize counts for custom tabs
        allTabs.forEach(tab => {
            counts[`tab-${tab}`] = 0;
        });

        const filtered = shaderCatalog.shaders.filter(shader => {
            const meta = shaderMetadata[shader.shaderName] || {};
            const isExperimental = meta.experimental === true;
            const shaderTab = meta.tab;
            
            // Count for all tabs
            counts.all++;
            
            // Count for stable/experimental
            if (isExperimental) {
                counts.experimental++;
            } else {
                counts.stable++;
            }
            
            // Count for custom tabs
            if (shaderTab) {
                const tabs = Array.isArray(shaderTab) ? shaderTab : [shaderTab];
                tabs.forEach(tab => {
                    if (typeof tab === 'string') {
                        const tabKey = `tab-${tab}`;
                        counts[tabKey] = (counts[tabKey] || 0) + 1;
                    }
                });
            }
            
            // Filter logic
            if (activeTab === 'all') return true;
            if (activeTab === 'stable') return !isExperimental;
            if (activeTab === 'experimental') return isExperimental;
            if (activeTab.startsWith('tab-')) {
                const tabName = activeTab.substring(4);
                if (Array.isArray(meta.tab)) {
                    return meta.tab.includes(tabName);
                }
                return meta.tab === tabName;
            }
            return true;
        });

        setShaderCounts(counts);
        setFilteredShaders(filtered);
    }, [activeTab, shaderCatalog.shaders, shaderMetadata, allTabs]);

    // Map the filtered shader indices back to the original shader catalog indices
    const getOriginalShaderIndex = (filteredIndex: number): number => {
        const filteredShader = filteredShaders[filteredIndex];
        return shaderCatalog.shaders.findIndex(s => s.shaderName === filteredShader.shaderName);
    };

    const handleShaderSelected = (filteredIndex: number) => {
        const originalIndex = getOriginalShaderIndex(filteredIndex);
        onShaderSelected(originalIndex);
    };

    const handleVisibilityToggled = (filteredIndex: number, isVisible: boolean) => {
        const originalIndex = getOriginalShaderIndex(filteredIndex);
        onVisiblityToggled(originalIndex, isVisible);
    };

    const handleShaderInfoRequested = (filteredIndex: number) => {
        const originalIndex = getOriginalShaderIndex(filteredIndex);
        onShaderInfoRequested(originalIndex);
    };

    // Create a modified shader catalog with only the filtered shaders
    const filteredCatalog = {
        ...shaderCatalog,
        shaders: filteredShaders
    };

    // Get the selected shader's index in the filtered list
    const selectedFilteredIndex = filteredShaders.findIndex(
        shader => shader.shaderName === shaderCatalog.shaders[selectedShaderIndex]?.shaderName
    );

    return (
        <div className="w-full flex flex-col flex-1">
            {/* Tabs */}
            <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
                <button
                    key="all"
                    className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'all'
                            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
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
                            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab('stable')}
                >
                    Stable Shaders ({shaderCounts.stable || 0})
                </button>
                {allTabs.map(tab => (
                    <button
                        key={`tab-${tab}`}
                        className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                            activeTab === `tab-${tab}`
                                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                        onClick={() => setActiveTab(`tab-${tab}`)}
                    >
                        {tab} ({shaderCounts[`tab-${tab}`] || 0})
                    </button>
                ))}
                <button
                    key="experimental"
                    className={`py-2 px-4 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'experimental'
                            ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => setActiveTab('experimental')}
                >
                    Experimental ({shaderCounts.experimental || 0})
                </button>
            </div>

            {/* Shader List */}
            <div className="flex-1 w-full bg-white dark:bg-gray-900">
                <ShaderList 
                    shaderCatalog={filteredCatalog}
                    shaderOptions={shaderOptions}
                    selectedShaderIndex={selectedFilteredIndex}
                    onShaderSelected={handleShaderSelected}
                    onVisiblityToggled={handleVisibilityToggled}
                    onShaderInfoRequested={handleShaderInfoRequested}
                />
            </div>
        </div>
    );
}
