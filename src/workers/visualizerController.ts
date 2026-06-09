import { NEXT_SHADER, PREV_SHADER } from "@src/helpers/constants";
import browser from "webextension-polyfill";
import { STATE_CURRENT_SHADER, STATE_SHADERINDEX } from "@src/storage/storageConstants";
import WorkerState from './workerState';
import { getStorage, setStorage } from "@src/storage/storage";
import type { ShaderObject } from "@src/helpers/types";

type UnifiedShader =
    | { kind: 'builtin'; catalogIndex: number; shader: ShaderObject }
    | { kind: 'imported'; importedId: string; shader: ShaderObject }
    | { kind: 'custom'; customId: string; shader: ShaderObject };

// Controls the visualisation
export class VisualizerController {
    workerState: WorkerState;
    public get shaderCatalog() {
        return this.workerState.shaderCatalog;
    }

    constructor(workerState: WorkerState) {
        this.workerState = workerState;
    }

    initialize() {
        this.registerCallbacks();
    }

    /** Build the same unified ordered list that the "All Shaders" view shows. */
    private buildUnifiedList(): UnifiedShader[] {
        const list: UnifiedShader[] = [];

        for (let i = 0; i < this.workerState.shaderCatalog.shaders.length; i++) {
            list.push({ kind: 'builtin', catalogIndex: i, shader: this.workerState.shaderCatalog.shaders[i] });
        }

        for (const imp of this.workerState.importedShaders) {
            const inlineBuffers: { [filename: string]: string } = {};
            for (const buffer of imp.bufferShaders || []) {
                inlineBuffers[buffer.filename] = buffer.code;
            }
            list.push({
                kind: 'imported',
                importedId: imp.id,
                shader: {
                    shaderName: imp.mainShader.filename,
                    metaData: imp.mainShader.meta as any,
                    inlineCode: imp.mainShader.code,
                    inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined,
                }
            });
        }

        for (const custom of this.workerState.customShaders) {
            list.push({
                kind: 'custom',
                customId: custom.id,
                shader: {
                    shaderName: custom.shaderName,
                    metaData: custom.metaData,
                    inlineCode: custom.inlineCode,
                    inlineBuffers: custom.inlineBuffers,
                }
            });
        }

        return list;
    }

    /** Activate a unified shader entry. */
    private async activateUnified(entry: UnifiedShader): Promise<void> {
        if (entry.kind === 'builtin') {
            this.workerState.shaderIndex = entry.catalogIndex;
            await setStorage(STATE_SHADERINDEX, entry.catalogIndex);
        } else {
            await browser.storage.local.set({ 'state.currentshader': entry.shader });
        }
    }
    
    registerCallbacks() {
        browser.runtime.onMessage.addListener((msg, sender) => {
            if (!msg.command) {
                return;
            }

            switch (msg.command) {
                case PREV_SHADER:
                    this.navigateShader(-1);
                break;
                case NEXT_SHADER:
                    this.navigateShader(+1);
                break;
                case 'RANDOM_SHADER_ON_BEAT':
                    this.workerState.triggerRandomizeBeat();
                break;
                case 'SELECT_SHADER_BY_ID':
                    if (msg.shaderId) {
                        this.selectShaderById(msg.shaderId);
                    }
                break;
            }
        });    

    }

    /** Returns the shaderOptions key for a unified entry (used for visibility lookup). */
    private visibilityKey(entry: UnifiedShader): string {
        if (entry.kind === 'builtin') return entry.shader.shaderName;
        if (entry.kind === 'imported') return entry.importedId;
        return entry.customId;
    }

    /** Returns true if the entry is visible (not hidden by the eye-icon toggle). */
    private isEntryVisible(entry: UnifiedShader): boolean {
        const key = this.visibilityKey(entry);
        const opt = this.workerState.shaderOptions[key];
        return !opt?.isHidden;
    }

    async navigateShader(delta: number): Promise<void> {
        const unified = this.buildUnifiedList();
        if (unified.length === 0) return;

        // Filter to only visible shaders (respects the eye-icon toggle)
        const visible = unified.filter(e => this.isEntryVisible(e));
        if (visible.length === 0) return;

        // Find where the currently active shader sits in the visible list
        const current = await getStorage<ShaderObject>(STATE_CURRENT_SHADER, undefined);
        let currentVisibleIdx = -1;
        if (current) {
            currentVisibleIdx = visible.findIndex(e => {
                if (!current.inlineCode) {
                    return e.kind === 'builtin' && e.shader.shaderName === current.shaderName;
                }
                return e.shader.shaderName === current.shaderName && e.shader.inlineCode === current.inlineCode;
            });
        }

        // If current shader is hidden or not found, start from edge of visible list
        if (currentVisibleIdx < 0) {
            currentVisibleIdx = delta > 0 ? visible.length - 1 : 0;
        }

        const nextIdx = (currentVisibleIdx + delta + visible.length) % visible.length;
        console.log('[VC] navigateShader: delta=', delta, 'from visible[', currentVisibleIdx, ']→[', nextIdx, '] (visible:', visible.length, '/ total:', unified.length, ')');
        await this.activateUnified(visible[nextIdx]);
    }

    setShader(index: number) {
        if (index < 0 || index >= this.shaderCatalog.shaders.length) {
            return;
        }
        this.workerState.shaderIndex = index;
        setStorage(STATE_SHADERINDEX, index);
    }

    async selectShaderById(shaderId: string) {
        // First try to find in main catalog by shaderName
        const catalogIndex = this.shaderCatalog.shaders.findIndex(
            s => s.shaderName === shaderId || s.shaderName === `${shaderId}.frag` || s.metaData?.shaderName === shaderId
        );
        
        if (catalogIndex >= 0) {
            this.setShader(catalogIndex);
            return;
        }
        
        // If not found in catalog, try to load from custom/imported shaders
        // Check custom shaders first
        const customShadersResult = await browser.storage.local.get('state.customshaders');
        const customShaders = customShadersResult['state.customshaders'] || [];
        const customShader = customShaders.find((s: any) => 
            s.id === shaderId || s.metaData?.shaderName === shaderId
        );
        
        if (customShader) {
            // Load custom shader directly
            const shaderObject = {
                shaderName: customShader.shaderName,
                metaData: customShader.metaData,
                inlineCode: customShader.inlineCode,
                inlineBuffers: customShader.inlineBuffers,
                customId: customShader.id
            };
            await browser.storage.local.set({ 'state.currentshader': shaderObject });
            return;
        }
        
        // Check imported shaders
        const importedResult = await browser.storage.local.get('state.importedshaders');
        const importedStorage = importedResult['state.importedshaders'];
        const importedList = importedStorage?.shaders || [];
        const importedShader = importedList.find((s: any) => 
            s.id === shaderId || s.name === shaderId || s.mainShader?.meta?.shaderName === shaderId
        );
        
        if (importedShader) {
            // Build inline buffers
            const inlineBuffers: { [filename: string]: string } = {};
            for (const buffer of importedShader.bufferShaders || []) {
                inlineBuffers[buffer.filename] = buffer.code;
            }
            
            const shaderObject = {
                shaderName: importedShader.mainShader.filename,
                metaData: importedShader.mainShader.meta,
                inlineCode: importedShader.mainShader.code,
                inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined
            };
            await browser.storage.local.set({ 'state.currentshader': shaderObject });
            return;
        }
        
        // Check edited imported shaders
        const editedResult = await browser.storage.local.get('state.editedimported');
        const editedImported = editedResult['state.editedimported'] || {};
        const editedEntry = Object.entries(editedImported).find(([id, s]: [string, any]) => 
            id === shaderId || s.metaData?.shaderName === shaderId
        );
        
        if (editedEntry) {
            const [importId, editedShader] = editedEntry as [string, any];
            const shaderObject = {
                shaderName: editedShader.shaderName,
                metaData: editedShader.metaData,
                inlineCode: editedShader.inlineCode,
                inlineBuffers: editedShader.inlineBuffers
            };
            await browser.storage.local.set({ 'state.currentshader': shaderObject });
        }
    }

}