import React, { useEffect, useRef, useState, useCallback } from 'react';
import { XMarkIcon, TrashIcon, DocumentArrowDownIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import { getDebugLogs, clearDebugLogs, type DebugLogEntry } from '@src/helpers/logger';
import { STATE_DEBUG_LOGS } from '@src/storage/storageConstants';

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

export default function DebugLogModal({ isOpen, onClose }: Props) {
    const [logs, setLogs] = useState<DebugLogEntry[]>([]);
    const [selectedSource, setSelectedSource] = useState<'all' | DebugLogEntry['source']>('all');
    const [levels, setLevels] = useState({ log: true, warn: true, error: true, info: true });
    const [searchTerm, setSearchTerm] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    
    // Load logs
    const loadLogs = useCallback(async () => {
        if (isPaused) return;
        const data = await getDebugLogs();
        setLogs(data);
    }, [isPaused]);
    
    // Auto-refresh
    useEffect(() => {
        if (!isOpen || !autoRefresh) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }
        
        // Initial load
        loadLogs();
        
        // Set up polling
        intervalRef.current = setInterval(loadLogs, 1000);
        
        // Listen for storage changes (for real-time updates)
        const handleChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes[STATE_DEBUG_LOGS] && !isPaused) {
                setLogs(changes[STATE_DEBUG_LOGS].newValue || []);
            }
        };
        chrome.storage.onChanged.addListener(handleChange);
        
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            chrome.storage.onChanged.removeListener(handleChange);
        };
    }, [isOpen, autoRefresh, isPaused, loadLogs]);
    
    // Auto-scroll to bottom
    useEffect(() => {
        if (autoRefresh && !isPaused && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoRefresh, isPaused]);
    
    // Filter logs
    const filteredLogs = logs.filter(log => {
        if (selectedSource !== 'all' && log.source !== selectedSource) return false;
        if (!levels[log.level as keyof typeof levels]) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return log.message.toLowerCase().includes(term) ||
                   log.prefix.toLowerCase().includes(term) ||
                   JSON.stringify(log.args).toLowerCase().includes(term);
        }
        return true;
    });
    
    // Clear all logs
    const handleClear = async () => {
        await clearDebugLogs();
        setLogs([]);
    };
    
    // Export logs as JSON
    const handleExport = () => {
        const dataStr = JSON.stringify(logs, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `shaderamp-logs-${new Date().toISOString().replace(/:/g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    
    // Format timestamp
    const formatTime = (ts: number): string => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
    };
    
    // Level badge color
    const levelColor = (level: string): string => {
        switch (level) {
            case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'warn': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            
            <div className="relative w-full max-w-6xl h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Debug Logs</h2>
                        <p className="text-xs text-gray-500">{logs.length} total entries | {filteredLogs.length} filtered</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Controls */}
                        <button
                            onClick={() => setIsPaused(!isPaused)}
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title={isPaused ? 'Resume' : 'Pause'}
                        >
                            {isPaused ? <PlayIcon className="w-4 h-4 text-white" /> : <PauseIcon className="w-4 h-4 text-white" />}
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                            <DocumentArrowDownIcon className="w-4 h-4" />
                            Export
                        </button>
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <XMarkIcon className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {/* Source filter */}
                    <select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value as any)}
                        className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="all">All Sources</option>
                        <option value="background">Background</option>
                        <option value="content">Content</option>
                        <option value="options">Options</option>
                        <option value="renderer">Renderer</option>
                    </select>
                    
                    {/* Level filters */}
                    <div className="flex items-center gap-2">
                        {(['log', 'warn', 'error', 'info'] as const).map(level => (
                            <label key={level} className="flex items-center gap-1 text-sm">
                                <input
                                    type="checkbox"
                                    checked={levels[level]}
                                    onChange={(e) => setLevels(prev => ({ ...prev, [level]: e.target.checked }))}
                                    className="rounded"
                                />
                                <span className={`px-1.5 py-0.5 rounded text-xs ${levelColor(level)}`}>
                                    {level}
                                </span>
                            </label>
                        ))}
                    </div>
                    
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 min-w-[200px] text-sm border rounded px-3 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    
                    {/* Auto-refresh toggle */}
                    <label className="flex items-center gap-1 text-sm dark:text-white">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        Auto-refresh
                    </label>
                </div>
                
                {/* Log table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900">
                            <tr className="dark:text-white">
                                <th className="px-3 py-2 text-left font-medium dark:text-white">Time</th>
                                <th className="px-3 py-2 text-left font-medium dark:text-white">Source</th>
                                <th className="px-3 py-2 text-left font-medium dark:text-white">Level</th>
                                <th className="px-3 py-2 text-left font-medium dark:text-white">Prefix</th>
                                <th className="px-3 py-2 text-left font-medium dark:text-white">Message</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 dark:text-gray-100">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-100">
                                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-500 dark:text-gray-300">
                                        {formatTime(log.timestamp)}
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap dark:text-gray-100">
                                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-100">
                                            {log.source}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap dark:text-gray-100">
                                        <span className={`px-1.5 py-0.5 rounded ${levelColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap font-medium dark:text-gray-100">
                                        {log.prefix}
                                    </td>
                                    <td className="px-3 py-1.5 dark:text-gray-100">
                                        <div className="break-all">{log.message}</div>
                                        {log.args && log.args.length > 0 && (
                                            <div className="mt-1 text-gray-500 dark:text-gray-400">
                                                {JSON.stringify(log.args).substring(0, 200)}
                                                {JSON.stringify(log.args).length > 200 && '...'}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div ref={logsEndRef} />
                    
                    {filteredLogs.length === 0 && (
                        <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-300">
                            {logs.length === 0 ? 'No logs captured yet' : 'No logs match current filters'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
