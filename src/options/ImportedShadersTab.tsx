import React, { useState, useEffect } from 'react';
import browser from "webextension-polyfill";
import { getStorage } from "@src/storage/storage";
import { STATE_IMPORTED_SHADERS } from "@src/storage/storageConstants";
import { getStorageQuotaDB } from "@src/storage/shaderDB";
import type { ImportedShader, ImportedShadersStorage } from "@src/helpers/types";

interface ImportedShadersTabProps {
    onShaderLoaded?: () => void;
    onEditTabs?: (shaderId: string, shaderName: string) => void;
    onShaderEdit?: (shader: ImportedShader) => void;
}

export default function ImportedShadersTab({ onShaderLoaded, onEditTabs, onShaderEdit }: ImportedShadersTabProps) {
    const [importedShaders, setImportedShaders] = useState<ImportedShader[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0 });
    const [deleteTarget, setDeleteTarget] = useState<ImportedShader | null>(null);
    const [showDeleteAll, setShowDeleteAll] = useState(false);
    const [deleteAllIncludeTabs, setDeleteAllIncludeTabs] = useState(false);
    const [shaderTabAssignments, setShaderTabAssignments] = useState<Record<string, string[]>>({});
    const [currentShader, setCurrentShader] = useState<any>(null);

    // Load active shader from storage
    const loadCurrentShader = async () => {
        const result = await browser.storage.local.get(['state.currentshader']);
        setCurrentShader(result['state.currentshader'] || null);
    };

    // Load imported shaders from storage
    const loadImportedShaders = async () => {
        try {
            setLoading(true);
            const response = await browser.runtime.sendMessage({
                command: 'GET_IMPORTED_SHADERS'
            });

            if (response?.success) {
                const data: ImportedShadersStorage = response.data;
                setImportedShaders((data.shaders || []).sort((a, b) =>
                    new Date(a.importDate).getTime() - new Date(b.importDate).getTime()
                ));
            } else {
                setError(response?.error || 'Failed to load imported shaders');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error loading shaders');
        } finally {
            setLoading(false);
        }
    };

    // Calculate storage usage
    const calculateStorage = async () => {
        try {
            const quota = await getStorageQuotaDB();
            setStorageInfo({ used: quota.used, total: quota.total });
        } catch (e) {
            // Ignore
        }
    };

    useEffect(() => {
        loadImportedShaders();
        calculateStorage();
        loadCurrentShader();

        const handleStorageChange = (changes: any, areaName: string) => {
            if (areaName === 'local' && changes['state.currentshader']) {
                setCurrentShader(changes['state.currentshader'].newValue || null);
            }
        };
        browser.storage.onChanged.addListener(handleStorageChange);
        return () => {
            browser.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    // Load tab assignments for delete-all logic
    const loadShaderTabAssignments = async () => {
        const result = await browser.storage.local.get('state.shadertabs');
        setShaderTabAssignments(result['state.shadertabs'] || {});
    };

    // Open delete-all dialog
    const handleDeleteAllOpen = async () => {
        await loadShaderTabAssignments();
        setDeleteAllIncludeTabs(false);
        setShowDeleteAll(true);
    };

    // Confirm and execute delete-all
    const confirmDeleteAll = async () => {
        const toDelete = importedShaders.filter(s => {
            if (deleteAllIncludeTabs) return true;
            const assigned = shaderTabAssignments[s.id] || [];
            return assigned.length === 0;
        });
        setShowDeleteAll(false);
        for (const shader of toDelete) {
            try {
                await browser.runtime.sendMessage({
                    command: 'DELETE_IMPORTED_SHADER',
                    data: { id: shader.id }
                });
            } catch {
                // continue deleting remaining
            }
        }
        await loadImportedShaders();
        await calculateStorage();
    };

    // Load a shader (set as current)
    const handleLoadShader = async (shader: ImportedShader) => {
        try {
            // Build inline buffers map
            const inlineBuffers: { [filename: string]: string } = {};
            for (const buffer of shader.bufferShaders || []) {
                inlineBuffers[buffer.filename] = buffer.code;
            }

            const shaderObject = {
                shaderName: shader.mainShader.filename,
                metaData: shader.mainShader.meta,
                inlineCode: shader.mainShader.code,
                inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined
            };

            // Store as current shader
            await browser.storage.local.set({ 'state.currentshader': shaderObject });

            // Notify parent
            onShaderLoaded?.();
        } catch (err) {
            alert(`Error loading shader: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    // Delete a shader - set the target to open the HTML modal
    const handleDeleteShader = (shader: ImportedShader) => {
        setDeleteTarget(shader);
    };

    // Confirms and executes deletion via message passing
    const confirmDeleteShader = async () => {
        if (!deleteTarget) return;
        const shader = deleteTarget;
        setDeleteTarget(null);

        try {
            const response = await browser.runtime.sendMessage({
                command: 'DELETE_IMPORTED_SHADER',
                data: { id: shader.id }
            });

            if (response?.success) {
                setImportedShaders(prev => prev.filter(s => s.id !== shader.id));
                calculateStorage();
            } else {
                alert(`Failed to delete: ${response?.error || 'Unknown error'}`);
            }
        } catch (err) {
            alert(`Error deleting shader: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    // Export shader as downloadable files
    const handleExportShader = (shader: ImportedShader) => {
        try {
            // Export main shader
            const mainBlob = new Blob([shader.mainShader.code], { type: 'text/plain' });
            const mainUrl = URL.createObjectURL(mainBlob);
            const mainLink = document.createElement('a');
            mainLink.href = mainUrl;
            mainLink.download = shader.mainShader.filename;
            mainLink.click();
            URL.revokeObjectURL(mainUrl);

            // Export main shader meta
            const mainMetaBlob = new Blob([JSON.stringify(shader.mainShader.meta, null, 2)], { type: 'application/json' });
            const mainMetaUrl = URL.createObjectURL(mainMetaBlob);
            const mainMetaLink = document.createElement('a');
            mainMetaLink.href = mainMetaUrl;
            mainMetaLink.download = `${shader.mainShader.filename}.meta`;
            mainMetaLink.click();
            URL.revokeObjectURL(mainMetaUrl);

            // Export buffer shaders
            for (const buffer of shader.bufferShaders || []) {
                const bufferBlob = new Blob([buffer.code], { type: 'text/plain' });
                const bufferUrl = URL.createObjectURL(bufferBlob);
                const bufferLink = document.createElement('a');
                bufferLink.href = bufferUrl;
                bufferLink.download = buffer.filename;
                bufferLink.click();
                URL.revokeObjectURL(bufferUrl);

                const bufferMetaBlob = new Blob([JSON.stringify(buffer.meta, null, 2)], { type: 'application/json' });
                const bufferMetaUrl = URL.createObjectURL(bufferMetaBlob);
                const bufferMetaLink = document.createElement('a');
                bufferMetaLink.href = bufferMetaUrl;
                bufferMetaLink.download = `${buffer.filename}.meta`;
                bufferMetaLink.click();
                URL.revokeObjectURL(bufferMetaUrl);
            }
        } catch (err) {
            alert(`Error exporting: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    // Format storage size
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const storagePercent = (storageInfo.used / storageInfo.total) * 100;

    if (loading) {
        return <div className="p-4 text-gray-600 dark:text-gray-400">Loading imported shaders...</div>;
    }

    if (error) {
        return (
            <div className="p-4 text-red-600 dark:text-red-400">
                Error: {error}
                <button
                    onClick={loadImportedShaders}
                    className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col">
            {/* Storage info */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                        Storage: {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.total)}
                        <a
                            href="https://www.shadertoy.com/playlist/4sjRzK"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-3 text-indigo-400 hover:text-indigo-300 transition-colors"
                            title="ShaderAmp-compatible shaders playlist on Shadertoy"
                        >
                            ↗ get more ShaderAmp compatible shaders
                        </a>
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="text-gray-500 dark:text-gray-500">
                            {importedShaders.length} shader{importedShaders.length !== 1 ? 's' : ''} imported
                        </span>
                        {importedShaders.length > 0 && (
                            <button
                                onClick={handleDeleteAllOpen}
                                className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                                title="Delete all imported shaders"
                            >
                                Delete All
                            </button>
                        )}
                    </div>
                </div>
                {storagePercent > 80 && (
                    <div className={`mt-1 text-xs ${storagePercent > 90 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {storagePercent > 90 ? 'Warning: Storage almost full!' : 'Storage getting full'}
                    </div>
                )}
            </div>

            {/* Shader list */}
            {importedShaders.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <p className="mb-2">No imported shaders yet.</p>
                    <p className="text-sm">
                        Go to any Shadertoy shader page and click "Load to ShaderAmp" to import shaders.
                    </p>
                    <p className="text-sm mt-3">
                        Looking for compatible shaders? Check out the{' '}
                        <a
                            href="https://www.shadertoy.com/playlist/4sjRzK"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                        >
                            ShaderAmp-compatible playlist on Shadertoy
                        </a>
                        .
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {importedShaders.map((shader) => {
                        const isCurrent = currentShader && 
                            currentShader.shaderName === shader.mainShader.filename && 
                            currentShader.inlineCode === shader.mainShader.code;
                        return (
                            <div
                                key={shader.id}
                                className={`p-4 transition-colors ${
                                    isCurrent 
                                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-l-4 border-pink-500' 
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-transparent'
                                }`}
                            >
                                <div className="flex gap-4 items-start">
                                    {shader.previewImage ? (
                                        <img
                                            src={shader.previewImage}
                                            alt={shader.name}
                                            className={`w-24 h-16 object-cover rounded shadow bg-gray-100 dark:bg-gray-900 flex-shrink-0 ${
                                                isCurrent ? 'outline outline-offset-2 outline-pink-500' : ''
                                            }`}
                                        />
                                    ) : (
                                        <div className={`w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded shadow flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 font-medium flex-shrink-0 ${
                                            isCurrent ? 'outline outline-offset-2 outline-pink-500' : ''
                                        }`}>
                                            No Image
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                            <a
                                                href={`https://www.shadertoy.com/view/${shader.shadertoyId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {shader.name}
                                            </a>
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            by <a
                                                href={`https://www.shadertoy.com/user/${shader.author}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {shader.author}
                                            </a>
                                        </p>
                                        {shader.description && (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">
                                                {shader.description}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            Imported: {new Date(shader.importDate).toLocaleDateString()}
                                        </p>
                                        {shader.tags && shader.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {shader.tags.slice(0, 5).map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {shader.tags.length > 5 && (
                                                    <span className="px-2 py-0.5 text-xs text-gray-400">
                                                        +{shader.tags.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => !isCurrent && handleLoadShader(shader)}
                                            className={`px-3 py-1.5 text-sm rounded font-medium transition-all ${
                                                isCurrent 
                                                    ? "bg-green-600 text-white cursor-default shadow-md"
                                                    : "bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            }`}
                                            title={isCurrent ? "Currently active shader" : "Load shader"}
                                            disabled={isCurrent}
                                        >
                                            {isCurrent ? "Active ✓" : "Load"}
                                        </button>
                                        <button
                                            onClick={() => handleExportShader(shader)}
                                            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                            title="Export shader files"
                                        >
                                            Export
                                        </button>
                                        <button
                                            onClick={() => onEditTabs?.(shader.id, shader.name)}
                                            className="px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            title="Manage tabs"
                                        >
                                            Tabs
                                        </button>
                                        <button
                                            onClick={() => onShaderEdit?.(shader)}
                                            className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            title="Edit shader code"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteShader(shader)}
                                            className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                                            title="Delete shader"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Delete All Confirmation Modal */}
            {showDeleteAll && (() => {
                const protectedCount = importedShaders.filter(s => {
                    const assigned = shaderTabAssignments[s.id] || [];
                    return assigned.length > 0;
                }).length;
                const deleteCount = deleteAllIncludeTabs
                    ? importedShaders.length
                    : importedShaders.length - protectedCount;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                Delete All Imported Shaders
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                This action cannot be undone.
                            </p>
                            <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={deleteAllIncludeTabs}
                                    onChange={e => setDeleteAllIncludeTabs(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Also delete shaders assigned to custom tabs
                                </span>
                            </label>
                            <p className="text-sm mb-6 font-medium">
                                <span className="text-red-600 dark:text-red-400">Will delete {deleteCount} shader{deleteCount !== 1 ? 's' : ''}</span>
                                {!deleteAllIncludeTabs && protectedCount > 0 && (
                                    <span className="text-gray-500 dark:text-gray-400">, {protectedCount} protected (assigned to tabs)</span>
                                )}
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteAll(false)}
                                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteAll}
                                    disabled={deleteCount === 0}
                                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    Delete {deleteCount > 0 ? deleteCount : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Custom Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            Delete Shader
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete <strong className="text-gray-950 dark:text-white">"{deleteTarget.name}"</strong>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteShader}
                                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
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
