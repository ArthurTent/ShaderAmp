import browser, { Tabs } from "webextension-polyfill";
import { START } from "@src/helpers/constants";
import {closeTab, doesTabExist, findOpenContentTabId, getCurrentTab, tabStreamCapture } from "@src/helpers/tabActions";
import { isFirefox } from "@src/helpers/browserDetect";
import { getAppState, getTabMappings, removeTabMapping, setAppState, storeTabMapping } from "./helpers/tabMappingService";
import { VisualizerWorker } from "./workers/visualizerWorker";
import WorkerState from "./workers/workerState";
import { setStorage, getStorage } from "./storage/storage";
import { STATE_CURRENT_SHADER, STATE_IMPORTED_SHADERS, SETTINGS_DEBUG_LOGGING, STATE_EQ_MODE_ACTIVE, STATE_EQ_TARGET_TAB_ID, SETTINGS_EQ_GAINS, SETTINGS_VOLUME_AMPLIFIER } from "./storage/storageConstants";
import { updateDebugCache, logger } from "./helpers/logger";
import { 
    getImportedShadersDB, 
    saveImportedShaderDB, 
    deleteImportedShaderDB,
    migrateFromChromeStorage 
} from "./storage/shaderDB";
import type { TabMapping, TabInfo, ShaderObject, ImportedShader, ImportedShadersStorage } from "@src/helpers/types";
import { uploadCustomImage, getAllCustomImages } from "./helpers/customImageStorage";
import { uploadCustomVideo, getAllCustomVideos } from "./helpers/customVideoStorage";
import { uploadCustomCubemapFaces, getAllCustomCubemaps } from "./helpers/customCubemapStorage";
import { getImageDB, getVideoDB, getCubemapDB } from "./storage/shaderDB";

// Listen for debug logging toggle changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes[SETTINGS_DEBUG_LOGGING]) {
        updateDebugCache(changes[SETTINGS_DEBUG_LOGGING].newValue);
        if (changes[SETTINGS_DEBUG_LOGGING].newValue) {
            logger.background.log('Background', 'Debug logging enabled');
        }
    }
});

// EQ-only mode state
let offscreenDocumentPath: string | null = null;
let offscreenReady = false;
let pendingOffscreenInit: { streamId: string; tabId: number; eqGains: number[]; volumeAmp: number } | null = null;
let eqModeActive = false;
let eqModeTargetTabId: number | null = null;

// Offscreen document management for EQ-only mode
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Send init to offscreen document if pending
async function sendPendingInitToOffscreen(): Promise<void> {
    if (!pendingOffscreenInit || !offscreenReady) return;

    try {
        await chrome.runtime.sendMessage({
            type: 'AUDIO_PIPELINE_INIT',
            data: pendingOffscreenInit,
        });
        logger.background.log('Background', 'Sent pending init to offscreen document');
    } catch (error) {
        logger.background.error('Background', 'Failed to send init to offscreen: %s', error);
    }
    pendingOffscreenInit = null;
}

async function createOffscreenDocument(): Promise<void> {
    // Check if offscreen document already exists
    if (offscreenDocumentPath) {
        return;
    }

    // @ts-ignore - chrome.offscreen is available in Chrome 109+
    if (chrome.offscreen) {
        // @ts-ignore
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['AUDIO_PLAYBACK' as chrome.offscreen.Reason],
            justification: 'ShaderAmp Audio EQ processing',
        });
        offscreenDocumentPath = OFFSCREEN_DOCUMENT_PATH;
        logger.background.log('Background', 'Offscreen document created for EQ mode');
    } else {
        throw new Error('Offscreen API not available - requires Chrome 109+');
    }
}

async function closeOffscreenDocument(): Promise<void> {
    if (!offscreenDocumentPath) {
        return;
    }

    // @ts-ignore
    if (chrome.offscreen) {
        // @ts-ignore
        await chrome.offscreen.closeDocument();
        offscreenDocumentPath = null;
        logger.background.log('Background', 'Offscreen document closed');
    }
}

async function startEQMode(tabId: number): Promise<boolean> {
    try {
        // Get current settings
        const [eqGains, volumeAmp] = await Promise.all([
            getStorage(SETTINGS_EQ_GAINS) as Promise<number[] | undefined>,
            getStorage(SETTINGS_VOLUME_AMPLIFIER) as Promise<number | undefined>,
        ]);

        // Create offscreen document
        await createOffscreenDocument();

        // Get stream ID using tabCapture
        // @ts-ignore - chrome.tabCapture is available in Chrome
        const streamId = await new Promise<string>((resolve, reject) => {
            // @ts-ignore
            chrome.tabCapture.getMediaStreamId(
                { targetTabId: tabId },
                (id: string) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(id);
                    }
                }
            );
        });

        // Store init payload - it will be sent when offscreen signals ready
        pendingOffscreenInit = {
            streamId,
            tabId,
            eqGains: eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            volumeAmp: volumeAmp || 1,
        };

        // If offscreen is already ready, send immediately
        if (offscreenReady) {
            await sendPendingInitToOffscreen();
        }
        // Otherwise wait for OFFSCREEN_READY signal

        // Update state
        eqModeActive = true;
        eqModeTargetTabId = tabId;
        await setStorage(STATE_EQ_MODE_ACTIVE, true);
        await setStorage(STATE_EQ_TARGET_TAB_ID, tabId);

        logger.background.log('Background', 'EQ mode started for tab %d', tabId);
        return true;
    } catch (error) {
        logger.background.error('Background', 'Failed to start EQ mode: %s', error);
        await stopEQMode();
        throw error;
    }
}

async function stopEQMode(): Promise<void> {
    try {
        // Clear pending init
        pendingOffscreenInit = null;

        // Dispose audio pipeline
        await chrome.runtime.sendMessage({
            type: 'AUDIO_PIPELINE_DISPOSE',
        }).catch(() => {});

        // Close offscreen document
        await closeOffscreenDocument();

        // Reset ready state
        offscreenReady = false;

        // Update state
        eqModeActive = false;
        eqModeTargetTabId = null;
        await setStorage(STATE_EQ_MODE_ACTIVE, false);
        await setStorage(STATE_EQ_TARGET_TAB_ID, null);

        logger.background.log('Background', 'EQ mode stopped');
    } catch (error) {
        logger.background.error('Background', 'Error stopping EQ mode: %s', error);
    }
}

async function updateEQGains(gains: number[]): Promise<void> {
    if (!eqModeActive) return;

    await chrome.runtime.sendMessage({
        type: 'AUDIO_PIPELINE_UPDATE_EQ',
        data: { eqGains: gains },
    }).catch(err => {
        logger.background.error('Background', 'Failed to update EQ gains: %s', err);
    });
}

async function updateEQVolume(volume: number): Promise<void> {
    if (!eqModeActive) return;

    await chrome.runtime.sendMessage({
        type: 'AUDIO_PIPELINE_UPDATE_VOLUME',
        data: { volume },
    }).catch(err => {
        logger.background.error('Background', 'Failed to update EQ volume: %s', err);
    });
}

export const openShaderAmp = async (openerTabId?: number | undefined) => {
    // Fetch the current tab id in case it's not passed as a parameter
    if (openerTabId === undefined) {
        const currentTab = await getCurrentTab();
        openerTabId = currentTab?.id!;
    }

    // Check if the content tab is not already open
    const openTabs: TabMapping = await getTabMappings();
    if (openTabs) {
        const isTargetTabContentTab = Object.values(openTabs).some(x => x.contentTabId == openerTabId);
        if (isTargetTabContentTab) { // We're already on a content tab, ignore.
            logger.background.log('ShaderAmp', 'Already on content tab, ignoring');
            return Promise.resolve();
        }

        const alreadyOpened = openTabs[openerTabId];
        const isContentTabOpenOnTarget = await doesTabExist(alreadyOpened?.contentTabId);
        if (isContentTabOpenOnTarget) {
            if (alreadyOpened) {
                logger.background.log('ShaderAmp', 'Content tab already open for tab %d, activating', openerTabId);
                // Jump to the already opened tab
                await browser.tabs.update(alreadyOpened.contentTabId, {active: true})
                return Promise.resolve();
            } else {
                // Do we allow multiple content tabs? If not;
                // Close the existing content tab that targets the other tab and re-open?
                // ...
            }
        }
    }

    logger.background.log('ShaderAmp', 'Opening content tab for targetTab: %d', openerTabId);

    // Create a new content tab
    const targetTab = await browser.tabs.create({url: 'content.html', openerTabId: openerTabId, active: false});

    // On Firefox, chrome.tabCapture is unavailable; the content page handles capture via getDisplayMedia instead
    const stream = isFirefox() ? null : await tabStreamCapture(openerTabId, targetTab.id as number);

    // Cache the content tab id and target stream
    const tapMappingInfo : TabInfo = {
        sourceTabId: openerTabId,
        contentTabId: targetTab.id as number,
        stream,
    };
    await storeTabMapping(openerTabId, tapMappingInfo);

    // Set the new content tab active
    await browser.tabs.update(targetTab.id as number, {active: true});

    return Promise.resolve();
}

export const focusWindow = async (windowId: number) => {
    await browser.windows.update(windowId, {focused: true});
}

export const focusTab = async (tabId: number) => {
    const focusTabWindow = async (tab:Tabs.Tab) => await focusWindow(tab.windowId!);
    browser.tabs.update(tabId, {active: true})
        .then(focusTabWindow); 
}

export const openShaderAmpOptions = async () => {
    // Check if options tab is not already open
    //  if so, activate/focus options tab
    const appState = await getAppState();
    const optionsTabId = appState.optionsTab?.tabId;
    const isOptionsTabOpen = optionsTabId && await doesTabExist(optionsTabId);
    if (isOptionsTabOpen) {
        logger.background.log('ShaderAmp', 'Options tab already open, activating');
        // Set the new content tab active
        await focusTab(optionsTabId);
        return;
    }

    // Create a new options tab
    const targetTab = await browser.tabs.create({url: 'options.html', active: false});
    const targetTabId = targetTab.id as number;

    // Find the content page and try to capture a stream from it
    const activeContentTabId = await findOpenContentTabId();
    
    // Store the option tab info in the state
    appState.optionsTab.tabId = targetTabId;
    appState.optionsTab.contentTabId = activeContentTabId;
    setAppState(appState);

    // Logging
    logger.background.log('ShaderAmp', 'Active content tab: %d', activeContentTabId);

    // Set the new options tab active
    await focusTab(targetTabId);
}


browser.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: any) => {
    // Handle start command
    if (msg.command && (msg.command === START)) {
        openShaderAmp(msg.openerTabId)
            .then(() => sendResponse())
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    // Handle offscreen ready signal
    if (msg.type === 'OFFSCREEN_READY') {
        offscreenReady = true;
        logger.background.log('Background', 'Offscreen document signaled ready');
        // Send pending init if there is one
        sendPendingInitToOffscreen();
        return;
    }

    // Handle EQ-only mode commands
    if (msg.command === 'START_EQ_MODE') {
        (async () => {
            try {
                const { tabId } = msg.data;
                const success = await startEQMode(tabId);
                sendResponse({ success });
            } catch (error) {
                logger.background.error('Background', 'START_EQ_MODE error: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    if (msg.command === 'STOP_EQ_MODE') {
        (async () => {
            try {
                await stopEQMode();
                sendResponse({ success: true });
            } catch (error) {
                logger.background.error('Background', 'STOP_EQ_MODE error: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    if (msg.command === 'UPDATE_EQ_GAINS') {
        (async () => {
            try {
                const { gains } = msg.data;
                await updateEQGains(gains);
                sendResponse({ success: true });
            } catch (error) {
                logger.background.error('Background', 'UPDATE_EQ_GAINS error: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    if (msg.command === 'UPDATE_EQ_VOLUME') {
        (async () => {
            try {
                const { volume } = msg.data;
                await updateEQVolume(volume);
                sendResponse({ success: true });
            } catch (error) {
                logger.background.error('Background', 'UPDATE_EQ_VOLUME error: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    if (msg.command === 'GET_EQ_MODE_STATUS') {
        (async () => {
            try {
                let isActive = eqModeActive;
                const targetTab = eqModeTargetTabId;
                let targetTabInfo = null;

                // Check if target tab still exists
                if (targetTab && isActive) {
                    const tabExists = await doesTabExist(targetTab);
                    if (!tabExists) {
                        // Tab was closed, clean up EQ state
                        await stopEQMode();
                        isActive = false;
                    } else {
                        try {
                            targetTabInfo = await browser.tabs.get(targetTab);
                        } catch (_) {}
                    }
                }

                sendResponse({
                    success: true,
                    isActive,
                    targetTabId: isActive ? targetTab : null,
                    targetTabTitle: targetTabInfo?.title,
                    targetTabFavIconUrl: targetTabInfo?.favIconUrl,
                });
            } catch (error) {
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    // Handle loading shader from Shadertoy
    if (msg.command === 'LOAD_SHADERTOY_SHADER') {
        (async () => {
            try {
                const { mainShader, bufferShaders, shaderId, passDebug } = msg.data;
                if (passDebug) logger.background.log('SA', 'pass debug from page: %s', JSON.stringify(passDebug));
                
                // Build inline buffers map
                const inlineBuffers: { [filename: string]: string } = {};
                for (const buffer of bufferShaders || []) {
                    inlineBuffers[buffer.filename] = buffer.code;
                }
                
                // Create ShaderObject with inline code
                const shaderObject: ShaderObject = {
                    shaderName: mainShader.filename,
                    metaData: mainShader.meta,
                    inlineCode: mainShader.code,
                    inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined
                };
                
                // Store as current shader
                await setStorage(STATE_CURRENT_SHADER, shaderObject);
                
                logger.background.log('ShaderAmp', 'Loaded Shadertoy shader: %s, buffers: %s', mainShader.meta.shaderName, JSON.stringify(mainShader.meta.buffers));
                
                sendResponse({ success: true });
            } catch (error) {
                logger.background.error('ShaderAmp', 'Error loading Shadertoy shader: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }
    
    // Handle saving imported shader to storage
    if (msg.command === 'SAVE_IMPORTED_SHADER') {
        const { mainShader, bufferShaders, shaderId, name, author, description, tags, previewImage } = msg.data;
        
        (async () => {
            try {
                // Get existing imported shaders from IndexedDB
                const existingData = await getImportedShadersDB();
                const shaders = existingData?.shaders || [];
            
            // Check if already imported (by shadertoyId)
            const existingIndex = shaders.findIndex(s => s.shadertoyId === shaderId);
            
            // Create imported shader record
            const importedShader: ImportedShader = {
                id: existingIndex >= 0 ? shaders[existingIndex].id : `${shaderId}_${Date.now()}`,
                shadertoyId: shaderId,
                name: name || mainShader.meta.shaderName || 'Unnamed Shader',
                author: author || mainShader.meta.author || 'Unknown',
                description: description || mainShader.meta.description,
                tags: tags || [],
                importDate: new Date().toISOString(),
                previewImage: previewImage || (existingIndex >= 0 ? shaders[existingIndex].previewImage : undefined),
                mainShader: {
                    filename: mainShader.filename,
                    code: mainShader.code,
                    meta: mainShader.meta
                },
                bufferShaders: bufferShaders?.map((b: any) => ({
                    filename: b.filename,
                    code: b.code,
                    meta: b.meta
                }))
            };
            
            // Save to IndexedDB
            await saveImportedShaderDB(importedShader);
            
            if (existingIndex >= 0) {
                logger.background.log('ShaderAmp', 'Updated imported shader: %s', importedShader.name);
            } else {
                logger.background.log('ShaderAmp', 'Saved imported shader: %s', importedShader.name);
            }
            
            // Signal change via chrome.storage.local for sync purposes
            await setStorage(STATE_IMPORTED_SHADERS, { lastModified: new Date().toISOString() });
            
            sendResponse({ success: true, id: importedShader.id });
        } catch (error) {
            logger.background.error('ShaderAmp', 'Error saving imported shader: %s', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
        })();
        return true;
    }
    
    // Handle getting imported shaders
    if (msg.command === 'GET_IMPORTED_SHADERS') {
        (async () => {
            try {
                // Migrate from chrome.storage.local if needed (first run)
                await migrateFromChromeStorage(
                    async () => await getStorage(STATE_IMPORTED_SHADERS),
                    async (key: string, value: any) => { await setStorage(key, value); }
                );
                
                const data = await getImportedShadersDB();
                sendResponse({ success: true, data: data || { shaders: [], lastModified: new Date().toISOString() } });
            } catch (error) {
                logger.background.error('ShaderAmp', 'Error getting imported shaders: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }
    
    // Handle deleting imported shader
    if (msg.command === 'DELETE_IMPORTED_SHADER') {
        (async () => {
            try {
                const { id } = msg.data;
                
                // Delete from IndexedDB
                await deleteImportedShaderDB(id);
                
                // Signal change via chrome.storage.local for sync purposes
                await setStorage(STATE_IMPORTED_SHADERS, { lastModified: new Date().toISOString() });
                
                logger.background.log('ShaderAmp', 'Deleted imported shader: %s', id);
                sendResponse({ success: true });
            } catch (error) {
                logger.background.error('ShaderAmp', 'Error deleting imported shader: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }
    
    // Handle Ollama proxy requests (bypasses CORS)
    if (msg.type === 'OLLAMA_REQUEST') {
        const { baseUrl, endpoint, body, streaming } = msg;
        
        (async () => {
            try {
                // Background service worker can fetch any URL without explicit host permissions
                const response = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    sendResponse({ error: `Ollama API error: ${response.status} - ${errorText}` });
                    return;
                }
                
                if (streaming) {
                    // For streaming, return the response body as text chunks
                    const reader = response.body?.getReader();
                    if (!reader) {
                        sendResponse({ error: 'No response body' });
                        return;
                    }
                    
                    const decoder = new TextDecoder();
                    let fullText = '';
                    
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n').filter(line => line.trim());
                        
                        for (const line of lines) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.response) {
                                    fullText += parsed.response;
                                }
                                if (parsed.done) break;
                            } catch {
                                // Ignore parse errors
                            }
                        }
                    }
                    
                    sendResponse({ success: true, text: fullText });
                } else {
                    // For non-streaming, return the JSON response
                    const data = await response.json();
                    sendResponse({ success: true, data });
                }
            } catch (error) {
                logger.background.error('ShaderAmp', 'Ollama proxy error: %s', error);
                sendResponse({ 
                    error: error instanceof Error ? error.message : String(error),
                    corsHint: 'If CORS error, try starting Ollama with: OLLAMA_ORIGINS="*" ollama serve'
                });
            }
        })();
        return true;
    }
    
    // Handle saving custom assets from content script
    if (msg.action === 'saveCustomImage') {
        (async () => {
            try {
                const { blobBase64, filename, mimeType } = msg.data;
                const blob = base64ToBlob(blobBase64, mimeType);
                const file = new File([blob], filename, { type: mimeType });
                const result = await uploadCustomImage(file);
                logger.background.log('Background', 'Saved custom image: %s', result.id);
                sendResponse({ success: true, result });
            } catch (error) {
                logger.background.error('Background', 'Error saving custom image: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }
    
    if (msg.action === 'saveCustomVideo') {
        (async () => {
            try {
                logger.background.log('Background', 'saveCustomVideo handler called');
                const { blobBase64, filename, mimeType } = msg.data;
                logger.background.log('Background', 'Received data: filename=%s, mimeType=%s, base64 length=%d', filename, mimeType, blobBase64?.length || 0);
                
                if (!blobBase64 || blobBase64.length === 0) {
                    throw new Error('Empty base64 data received');
                }
                
                const videoMimeType = mimeType || 'video/webm';
                logger.background.log('Background', 'Converting base64 to blob with mimeType: %s', videoMimeType);
                
                const blob = base64ToBlob(blobBase64, videoMimeType);
                logger.background.log('Background', 'Created blob: %d bytes, type=%s', blob.size, blob.type);
                
                const file = new File([blob], filename, { type: videoMimeType });
                logger.background.log('Background', 'Created file: %d bytes, name=%s', file.size, file.name);
                
                logger.background.log('Background', 'Calling uploadCustomVideo...');
                const result = await uploadCustomVideo(file);
                logger.background.log('Background', 'uploadCustomVideo succeeded: %s', result.id);
                
                sendResponse({ success: true, result });
            } catch (error) {
                logger.background.error('Background', 'Error in saveCustomVideo handler: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }
    
    if (msg.action === 'saveCustomCubemap') {
        (async () => {
            try {
                const { faceBlobs, name } = msg.data;
                const faceFiles = {
                    px: new File([base64ToBlob(faceBlobs.px, 'image/png')], 'face_px.png', { type: 'image/png' }),
                    nx: new File([base64ToBlob(faceBlobs.nx, 'image/png')], 'face_nx.png', { type: 'image/png' }),
                    py: new File([base64ToBlob(faceBlobs.py, 'image/png')], 'face_py.png', { type: 'image/png' }),
                    ny: new File([base64ToBlob(faceBlobs.ny, 'image/png')], 'face_ny.png', { type: 'image/png' }),
                    pz: new File([base64ToBlob(faceBlobs.pz, 'image/png')], 'face_pz.png', { type: 'image/png' }),
                    nz: new File([base64ToBlob(faceBlobs.nz, 'image/png')], 'face_nz.png', { type: 'image/png' }),
                };
                const result = await uploadCustomCubemapFaces(name, faceFiles);
                logger.background.log('Background', 'Saved custom cubemap: %s', result.id);
                sendResponse({ success: true, result });
            } catch (error) {
                logger.background.error('Background', 'Error saving custom cubemap: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    // Handle asset existence checks from content script (cross-origin IndexedDB access)
    if (msg.action === 'checkAssetExists') {
        (async () => {
            try {
                const { type, customId } = msg.data;
                logger.background.log('Background', 'checkAssetExists: type=%s, id=%s', type, customId);
                let exists = false;
                if (type === 'image') {
                    const record = await getImageDB(customId);
                    exists = record !== null;
                } else if (type === 'video') {
                    const record = await getVideoDB(customId);
                    exists = record !== null;
                } else if (type === 'cubemap') {
                    const record = await getCubemapDB(customId);
                    exists = record !== undefined;
                }
                logger.background.log('Background', 'checkAssetExists result: %s', exists);
                sendResponse({ success: true, exists });
            } catch (error) {
                logger.background.error('Background', 'Error checking asset existence: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    // Handle getting all custom videos (for MediaTab)
    if (msg.action === 'getAllCustomVideos') {
        (async () => {
            try {
                logger.background.log('Background', 'getAllCustomVideos called');
                const videos = await getAllCustomVideos();
                logger.background.log('Background', 'Returning %d videos', videos.length);
                sendResponse({ success: true, videos });
            } catch (error) {
                logger.background.error('Background', 'Error getting videos: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    // Handle getting all custom images (for MediaTab)
    if (msg.action === 'getAllCustomImages') {
        (async () => {
            try {
                logger.background.log('Background', 'getAllCustomImages called');
                const images = await getAllCustomImages();
                logger.background.log('Background', 'Returning %d images', images.length);
                sendResponse({ success: true, images });
            } catch (error) {
                logger.background.error('Background', 'Error getting images: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }

    // Relay joystick events from options page to content tab
    if (msg.type === 'RELAY_JOYSTICK_EVENT') {
        findOpenContentTabId().then(contentTabId => {
            if (contentTabId) {
                browser.tabs.sendMessage(contentTabId, { type: 'JOYSTICK_EVENT', event: msg.event }).catch(() => {});
            }
        });
        return;
    }

    // Handle getting all custom cubemaps (for MediaTab)
    if (msg.action === 'getAllCustomCubemaps') {
        (async () => {
            try {
                logger.background.log('Background', 'getAllCustomCubemaps called');
                const cubemaps = await getAllCustomCubemaps();
                logger.background.log('Background', 'Returning %d cubemaps', cubemaps.length);
                sendResponse({ success: true, cubemaps });
            } catch (error) {
                logger.background.error('Background', 'Error getting cubemaps: %s', error);
                sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
        return true;
    }
});

browser.tabs.onRemoved.addListener(async (tabId) => {
    const removedContentTabId = await removeTabMapping(tabId);
    if (removedContentTabId) {
        await closeTab(removedContentTabId);
    }
});

browser.commands.onCommand.addListener(async (command) => {
    if (command === 'open-shader-amp') {
        await openShaderAmp();
    } else if (command === 'open-shader-amp-options') {
        await openShaderAmpOptions();
    }
});

// Workaround for using setInterval in the service-worker
if (!global.window) {
    global.window = self;
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
}

const workerState = new WorkerState();
const visualizerWorker = new VisualizerWorker(workerState);
visualizerWorker.initialize();