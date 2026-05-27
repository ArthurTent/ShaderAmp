// IndexedDB storage for imported shaders
// Provides much larger quota than chrome.storage.local (~5MB)

import type { ImportedShader, ImportedShadersStorage } from "@src/helpers/types";

const DB_NAME = 'ShaderAmpShaderDB';
const DB_VERSION = 1;
const STORE_SHADERS = 'shaders';
const STORE_META = 'meta';

interface ShaderDBMeta {
    lastModified: string;
    version: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Store individual shaders by ID
            if (!db.objectStoreNames.contains(STORE_SHADERS)) {
                db.createObjectStore(STORE_SHADERS, { keyPath: 'id' });
            }
            
            // Store metadata (lastModified, etc.)
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
        };
    });
    
    return dbPromise;
};

// Get all imported shaders
export const getImportedShadersDB = async (): Promise<ImportedShadersStorage | null> => {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SHADERS, STORE_META], 'readonly');
        const shaderStore = transaction.objectStore(STORE_SHADERS);
        const metaStore = transaction.objectStore(STORE_META);
        
        const shaders: ImportedShader[] = [];
        let meta: ShaderDBMeta | null = null;
        
        const shaderRequest = shaderStore.openCursor();
        
        shaderRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                shaders.push(cursor.value as ImportedShader);
                cursor.continue();
            } else {
                // All shaders loaded, now get meta
                const metaRequest = metaStore.get('main');
                metaRequest.onsuccess = () => {
                    meta = metaRequest.result as ShaderDBMeta | null;
                    resolve({
                        shaders,
                        lastModified: meta?.lastModified || new Date().toISOString()
                    });
                };
                metaRequest.onerror = () => reject(metaRequest.error);
            }
        };
        
        shaderRequest.onerror = () => reject(shaderRequest.error);
    });
};

// Save a shader (add or update)
export const saveImportedShaderDB = async (shader: ImportedShader): Promise<void> => {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SHADERS, STORE_META], 'readwrite');
        const shaderStore = transaction.objectStore(STORE_SHADERS);
        const metaStore = transaction.objectStore(STORE_META);
        
        const now = new Date().toISOString();
        
        // Save the shader
        const shaderRequest = shaderStore.put(shader);
        
        shaderRequest.onsuccess = () => {
            // Update metadata
            const metaRequest = metaStore.put({
                key: 'main',
                lastModified: now,
                version: 1
            });
            
            metaRequest.onsuccess = () => resolve();
            metaRequest.onerror = () => reject(metaRequest.error);
        };
        
        shaderRequest.onerror = () => reject(shaderRequest.error);
    });
};

// Delete a shader by ID
export const deleteImportedShaderDB = async (id: string): Promise<void> => {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SHADERS, STORE_META], 'readwrite');
        const shaderStore = transaction.objectStore(STORE_SHADERS);
        const metaStore = transaction.objectStore(STORE_META);
        
        const now = new Date().toISOString();
        
        const deleteRequest = shaderStore.delete(id);
        
        deleteRequest.onsuccess = () => {
            // Update metadata
            const metaRequest = metaStore.put({
                key: 'main',
                lastModified: now,
                version: 1
            });
            
            metaRequest.onsuccess = () => resolve();
            metaRequest.onerror = () => reject(metaRequest.error);
        };
        
        deleteRequest.onerror = () => reject(deleteRequest.error);
    });
};

// Calculate total storage used by shaders
export const calculateStorageUsageDB = async (): Promise<number> => {
    const data = await getImportedShadersDB();
    if (!data) return 0;
    
    // Calculate size by serializing to JSON
    return new Blob([JSON.stringify(data)]).size;
};

// Get IndexedDB quota info
export const getStorageQuotaDB = async (): Promise<{ used: number; total: number }> => {
    try {
        // @ts-ignore - navigator.storage is not in all TypeScript versions
        if (navigator.storage && navigator.storage.estimate) {
            // @ts-ignore
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                total: estimate.quota || (1024 * 1024 * 1024) // Default 1GB if unknown
            };
        }
    } catch (e) {
        // Fallback
    }
    
    // Fallback: just return shader data size with a large max
    const used = await calculateStorageUsageDB();
    return { used, total: 1024 * 1024 * 1024 }; // 1GB as reasonable default
};

// Migration from chrome.storage.local
export const migrateFromChromeStorage = async (
    getStorage: (key: string) => Promise<any>,
    setStorage: (key: string, value: any) => Promise<void>
): Promise<boolean> => {
    const DB_MIGRATION_KEY = 'db.migration.complete';
    
    // Check if already migrated
    // @ts-ignore - using chrome.storage.local directly
    const migrated = await chrome.storage.local.get(DB_MIGRATION_KEY);
    if (migrated[DB_MIGRATION_KEY]) return false;
    
    // Get old data
    const oldData = await getStorage('state.importedshaders');
    if (!oldData || !oldData.shaders || oldData.shaders.length === 0) {
        // Mark as migrated even if empty (nothing to migrate)
        // @ts-ignore
        await chrome.storage.local.set({ [DB_MIGRATION_KEY]: true });
        return false;
    }
    
    console.log(`[ShaderAmp] Migrating ${oldData.shaders.length} shaders to IndexedDB...`);
    
    // Migrate each shader
    for (const shader of oldData.shaders) {
        await saveImportedShaderDB(shader);
    }
    
    // Mark migration complete
    // @ts-ignore
    await chrome.storage.local.set({ [DB_MIGRATION_KEY]: true });
    
    console.log('[ShaderAmp] Migration complete');
    return true;
};
