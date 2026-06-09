// IndexedDB storage for imported shaders
// Provides much larger quota than chrome.storage.local (~5MB)

import type { ImportedShader, ImportedShadersStorage } from "@src/helpers/types";

const DB_NAME = 'ShaderAmpShaderDB';
const DB_VERSION = 4;
const STORE_SHADERS = 'shaders';
const STORE_META = 'meta';
const STORE_IMAGES = 'images';
const STORE_VIDEOS = 'videos';
const STORE_CUBEMAPS = 'cubemaps';

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
            
            // Store custom images by ID (version 2+)
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
            }

            // Store custom videos by ID (version 3+)
            if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
                db.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
            }

            // Store custom cubemaps by ID (version 4+)
            if (!db.objectStoreNames.contains(STORE_CUBEMAPS)) {
                db.createObjectStore(STORE_CUBEMAPS, { keyPath: 'id' });
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

// ─── Custom Image Storage ─────────────────────────────────────────────────────

export interface CustomImageRecord {
    id: string;
    name: string;
    mimeType: string;
    blob: Blob;
    size: number;
    addedAt: string;
}

// Add or replace a custom image
export const addImageDB = async (record: CustomImageRecord): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// Get all custom images (without blob data for listing)
export const getAllImagesDB = async (): Promise<Omit<CustomImageRecord, 'blob'>[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const results: Omit<CustomImageRecord, 'blob'>[] = [];
        const req = store.openCursor();
        req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const { blob: _blob, ...meta } = cursor.value as CustomImageRecord;
                results.push(meta);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        req.onerror = () => reject(req.error);
    });
};

// Get the full record for a specific image by ID (includes blob)
export const getImageDB = async (id: string): Promise<CustomImageRecord | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
};

// Get the Blob for a specific image by ID
export const getImageBlobDB = async (id: string): Promise<Blob | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.get(id);
        req.onsuccess = () => {
            const record = req.result as CustomImageRecord | undefined;
            resolve(record ? record.blob : null);
        };
        req.onerror = () => reject(req.error);
    });
};

// Delete a custom image by ID
export const deleteImageDB = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// ─── Custom Video Storage ────────────────────────────────────────────────────

export interface CustomVideoRecord {
    id: string;
    name: string;
    mimeType: string;
    blob: Blob;
    size: number;
    addedAt: string;
}

export const addVideoDB = async (record: CustomVideoRecord): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VIDEOS, 'readwrite');
        const store = tx.objectStore(STORE_VIDEOS);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const getAllVideosDB = async (): Promise<Omit<CustomVideoRecord, 'blob'>[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VIDEOS, 'readonly');
        const store = tx.objectStore(STORE_VIDEOS);
        const results: Omit<CustomVideoRecord, 'blob'>[] = [];
        const req = store.openCursor();
        req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const { blob: _blob, ...meta } = cursor.value as CustomVideoRecord;
                results.push(meta);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        req.onerror = () => reject(req.error);
    });
};

export const getVideoBlobDB = async (id: string): Promise<Blob | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VIDEOS, 'readonly');
        const store = tx.objectStore(STORE_VIDEOS);
        const req = store.get(id);
        req.onsuccess = () => {
            const record = req.result as CustomVideoRecord | undefined;
            resolve(record ? record.blob : null);
        };
        req.onerror = () => reject(req.error);
    });
};

export const deleteVideoDB = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VIDEOS, 'readwrite');
        const store = tx.objectStore(STORE_VIDEOS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const getVideoDB = async (id: string): Promise<CustomVideoRecord | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_VIDEOS, 'readonly');
        const store = tx.objectStore(STORE_VIDEOS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
};

// ─── Custom Cubemap Storage ───────────────────────────────────────────────────

export interface CubemapFaceRecord {
    name: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
    blob: Blob;
}

export interface CustomCubemapRecord {
    id: string;
    name: string;
    faces: CubemapFaceRecord[];
    size: number;
    createdAt: number;
}

export const addCubemapDB = async (record: CustomCubemapRecord): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CUBEMAPS, 'readwrite');
        const store = tx.objectStore(STORE_CUBEMAPS);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const getAllCubemapsDB = async (): Promise<Omit<CustomCubemapRecord, 'faces'>[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CUBEMAPS, 'readonly');
        const store = tx.objectStore(STORE_CUBEMAPS);
        const results: Omit<CustomCubemapRecord, 'faces'>[] = [];
        const req = store.openCursor();
        req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const { faces: _faces, ...meta } = cursor.value as CustomCubemapRecord;
                results.push(meta);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        req.onerror = () => reject(req.error);
    });
};

export const getCubemapDB = async (id: string): Promise<CustomCubemapRecord | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CUBEMAPS, 'readonly');
        const store = tx.objectStore(STORE_CUBEMAPS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result as CustomCubemapRecord | undefined);
        req.onerror = () => reject(req.error);
    });
};

export const getCubemapFacesDB = async (id: string): Promise<CubemapFaceRecord[] | null> => {
    const record = await getCubemapDB(id);
    return record ? record.faces : null;
};

export const deleteCubemapDB = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CUBEMAPS, 'readwrite');
        const store = tx.objectStore(STORE_CUBEMAPS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

// ─── Migration from chrome.storage.local ──────────────────────────────────────

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
