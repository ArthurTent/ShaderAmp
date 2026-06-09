import { getStorage, setStorage } from '@src/storage/storage';
import { 
    SETTINGS_DEBUG_LOGGING, 
    STATE_DEBUG_LOGS, 
    DEBUG_LOGS_MAX_ENTRIES,
    type DebugLogEntry as DebugLogEntryType
} from '@src/storage/storageConstants';

// Re-export for convenience
export type DebugLogEntry = DebugLogEntryType;

// Module-level cache (sync for performance)
let debugEnabledCache: boolean = false;
let cacheInitialized = false;

// Initialize cache from storage
export const initDebugCache = async (): Promise<void> => {
    if (cacheInitialized) return;
    debugEnabledCache = await getStorage(SETTINGS_DEBUG_LOGGING, false);
    cacheInitialized = true;
};

// Update cache when storage changes (call from listener)
export const updateDebugCache = (enabled: boolean): void => {
    debugEnabledCache = enabled;
    cacheInitialized = true;
};

// Check current state (sync, for hot paths)
export const isDebugEnabled = (): boolean => debugEnabledCache;

// Generate UUID (fallback for older browsers)
const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Simple sprintf-style interpolation
const interpolateMessage = (message: string, args: any[]): string => {
    let index = 0;
    return message.replace(/%[sdoOj%]/g, (match) => {
        if (match === '%%') return '%';
        if (index >= args.length) return match;
        const arg = args[index++];
        switch (match) {
            case '%s': return String(arg);
            case '%d': return Number(arg).toString();
            case '%o':
            case '%O':
            case '%j':
                try {
                    return JSON.stringify(arg);
                } catch {
                    return '[Object]';
                }
            default: return match;
        }
    });
};

// Internal: Add log to centralized storage
const addLogEntry = async (
    source: DebugLogEntry['source'],
    level: DebugLogEntry['level'],
    prefix: string,
    message: string,
    args?: any[]
): Promise<void> => {
    if (!debugEnabledCache) return;
    
    // Interpolate message with args before storing
    const interpolatedMessage = args && args.length > 0
        ? interpolateMessage(message, args)
        : message;
    
    const entry: DebugLogEntry = {
        id: generateId(),
        timestamp: Date.now(),
        source,
        level,
        prefix,
        message: interpolatedMessage,
        args: undefined // Don't store args separately - already interpolated
    };
    
    try {
        // Get existing logs
        const logs = await getStorage<DebugLogEntry[]>(STATE_DEBUG_LOGS, []);
        
        // Add new entry and maintain ring buffer
        logs.push(entry);
        if (logs.length > DEBUG_LOGS_MAX_ENTRIES) {
            logs.shift();
        }
        
        await setStorage(STATE_DEBUG_LOGS, logs);
    } catch (e) {
        // Silently fail - don't break functionality for logging
        console.error('[Logger] Failed to save log entry:', e);
    }
};

// Serialize with limits
const serializeArgs = (args: any[]): any[] => {
    return args.map(arg => {
        if (arg === null || arg === undefined) return arg;
        if (typeof arg === 'object') {
            try {
                const str = JSON.stringify(arg);
                return str.length > 500 ? str.substring(0, 500) + '...[truncated]' : arg;
            } catch {
                return '[Circular/Object]';
            }
        }
        if (typeof arg === 'string' && arg.length > 500) {
            return arg.substring(0, 500) + '...[truncated]';
        }
        return arg;
    });
};

// Synchronous console output (for immediate feedback)
const consoleOutput = (
    source: string,
    level: DebugLogEntry['level'],
    prefix: string,
    message: string,
    args?: any[]
): void => {
    const fn = console[level] || console.log;
    const prefixStr = `[${source}:${prefix}]`;
    fn(prefixStr, message, ...(args || []));
};

// Main logging API - per source
export const logger = {
    background: {
        log: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('background', 'log', prefix, msg, args);
            addLogEntry('background', 'log', prefix, msg, args);
        },
        warn: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('background', 'warn', prefix, msg, args);
            addLogEntry('background', 'warn', prefix, msg, args);
        },
        error: (prefix: string, msg: string, ...args: any[]) => {
            // Always log errors to console
            consoleOutput('background', 'error', prefix, msg, args);
            if (debugEnabledCache) {
                addLogEntry('background', 'error', prefix, msg, args);
            }
        }
    },
    content: {
        log: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('content', 'log', prefix, msg, args);
            addLogEntry('content', 'log', prefix, msg, args);
        },
        warn: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('content', 'warn', prefix, msg, args);
            addLogEntry('content', 'warn', prefix, msg, args);
        },
        error: (prefix: string, msg: string, ...args: any[]) => {
            consoleOutput('content', 'error', prefix, msg, args);
            if (debugEnabledCache) {
                addLogEntry('content', 'error', prefix, msg, args);
            }
        }
    },
    options: {
        log: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('options', 'log', prefix, msg, args);
            addLogEntry('options', 'log', prefix, msg, args);
        },
        warn: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('options', 'warn', prefix, msg, args);
            addLogEntry('options', 'warn', prefix, msg, args);
        },
        error: (prefix: string, msg: string, ...args: any[]) => {
            consoleOutput('options', 'error', prefix, msg, args);
            if (debugEnabledCache) {
                addLogEntry('options', 'error', prefix, msg, args);
            }
        }
    },
    renderer: {
        log: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('renderer', 'log', prefix, msg, args);
            addLogEntry('renderer', 'log', prefix, msg, args);
        },
        warn: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('renderer', 'warn', prefix, msg, args);
            addLogEntry('renderer', 'warn', prefix, msg, args);
        },
        error: (prefix: string, msg: string, ...args: any[]) => {
            consoleOutput('renderer', 'error', prefix, msg, args);
            if (debugEnabledCache) {
                addLogEntry('renderer', 'error', prefix, msg, args);
            }
        }
    },
    offscreen: {
        log: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('offscreen', 'log', prefix, msg, args);
            addLogEntry('offscreen', 'log', prefix, msg, args);
        },
        warn: (prefix: string, msg: string, ...args: any[]) => {
            if (!debugEnabledCache) return;
            consoleOutput('offscreen', 'warn', prefix, msg, args);
            addLogEntry('offscreen', 'warn', prefix, msg, args);
        },
        error: (prefix: string, msg: string, ...args: any[]) => {
            consoleOutput('offscreen', 'error', prefix, msg, args);
            if (debugEnabledCache) {
                addLogEntry('offscreen', 'error', prefix, msg, args);
            }
        }
    }
};

// Utility functions
export const clearDebugLogs = async (): Promise<void> => {
    await setStorage(STATE_DEBUG_LOGS, []);
};

export const getDebugLogs = async (): Promise<DebugLogEntry[]> => {
    return await getStorage<DebugLogEntry[]>(STATE_DEBUG_LOGS, []);
};
