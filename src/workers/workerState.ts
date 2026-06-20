import { defaultShader } from "@src/helpers/constants";
import { loadShaderList } from "@src/helpers/shaderActions";
import { ClassTimer } from "@src/helpers/timer";
import { getStorage, setStorage } from "@src/storage/storage";
import { SETTINGS_RANDOMIZE_SHADERS, SETTINGS_RANDOMIZE_TIME, SETTINGS_RANDOMIZE_VARIATION, SETTINGS_SHADEROPTIONS, STATE_CURRENT_SHADER, STATE_SHADERINDEX, STATE_SHADERLIST, STATE_SHADERNAME, STATE_SHOWPREVIEW, SETTINGS_RANDOMIZE_BEAT, SETTINGS_RANDOMIZE_BEAT_INTERVAL, STATE_IMPORTED_SHADERS } from "@src/storage/storageConstants";
import { getImportedShadersDB } from "@src/storage/shaderDB";
import type { ShaderOptions, ShaderCatalog, ShaderObject, ImportedShader } from "@src/helpers/types";
const IS_DEV_MODE = !('update_url' in chrome.runtime.getManifest());

export default class WorkerState {
    onRandomizeShadersChanged?: (value: boolean) => void;
    onRandomizeTimesChanged?: (randomizeTime: number, randomizeVariation: number) => void;
    onRandomizeBeatChanged?: (enabled: boolean, interval: number) => void;
    onRandomizeBeatTriggered?: () => void;
    onShaderSettingsChanged?: (newOptions: ShaderOptions) => void;
    
    shaderCatalog:ShaderCatalog = {
        shaders: [],
        lastModified: new Date(0)
    };
    shaderOptions:ShaderOptions = { };
    importedShaders: ImportedShader[] = [];
    customShaders: any[] = [];
    shaderTabs: Record<string, string[]> = {};
    shaderIndex: number = 0;
    shaderName: string = ''
    currentShader: ShaderObject = defaultShader;
    randomizeShaders: boolean = false;
    randomizeTime: number = 5;
    randomizeVariation: number = 2;
    randomizeBeat: boolean = false;
    randomizeBeatInterval: number = 4;
    pollingTimer?: ClassTimer = undefined;
    pollShadersDuration: number = 1;
    
    constructor() {
        console.log(`[ShaderAmp] Loading worker state...`);
        this.setupInitialStorage();   
        this.setupPolling(); 
    }

    setupPolling() {
        if (!IS_DEV_MODE) {
            return;
        }
        this.pollingTimer = new ClassTimer(this.pollShadersDuration * 1000, 0, () => this.pollShaders());
        this.pollingTimer.start();
    }

    async pollShaders() {
        const catalog = await loadShaderList();
        if (catalog.lastModified <= this.shaderCatalog.lastModified) {
            return;
        }
        await this.setShaderCatalog(catalog);
        await this.refreshCurrentShader();
    }
    
    async refreshCurrentShader() {
        await this.setShaderIndex(this.shaderIndex);
    }

    async setupInitialStorage() {
        await this.setupInitialState();
        chrome.storage.onChanged.addListener((changes, area) => this.onStorageChange(changes, area));
    }

    async setupInitialState() {
        const shaders = await loadShaderList();
        await this.setShaderCatalog(shaders);
        
        // First run (no shader index stored yet): default to "A Gift For You" and persist it.
        const storedIndex = await chrome.storage.local.get(STATE_SHADERINDEX);
        let shaderIndex: number;
        if (storedIndex[STATE_SHADERINDEX] === undefined) {
            const giftIndex = this.shaderCatalog.shaders.findIndex(s => s.shaderName === 'AGiftForYou.frag');
            shaderIndex = giftIndex >= 0 ? giftIndex : 0;
            await setStorage(STATE_SHADERINDEX, shaderIndex);
        } else {
            shaderIndex = storedIndex[STATE_SHADERINDEX];
        }
        await this.setShaderIndex(shaderIndex);

        const randomizeShaders = await getStorage<boolean>(SETTINGS_RANDOMIZE_SHADERS, false);
        this.setRandomizeShaders(randomizeShaders);

        const randomizeTime = await getStorage<number>(SETTINGS_RANDOMIZE_TIME, 5);
        this.setRandomizeTime(randomizeTime);

        const randomizeVariation = await getStorage<number>(SETTINGS_RANDOMIZE_VARIATION, 2);
        this.setRandomizeVariation(randomizeVariation);

        const randomizeBeat = await getStorage<boolean>(SETTINGS_RANDOMIZE_BEAT, false);
        this.setRandomizeBeat(randomizeBeat);

        const randomizeBeatInterval = await getStorage<number>(SETTINGS_RANDOMIZE_BEAT_INTERVAL, 4);
        this.setRandomizeBeatInterval(randomizeBeatInterval);

        const shaderOptions = await getStorage<ShaderOptions>(SETTINGS_SHADEROPTIONS, {});
        this.setShaderOptions(shaderOptions);

        const importedShadersData = await getImportedShadersDB();
        this.importedShaders = importedShadersData?.shaders || [];

        const customShadersResult = await chrome.storage.local.get('state.customshaders');
        this.customShaders = customShadersResult['state.customshaders'] || [];

        const shaderTabs = await getStorage<Record<string, string[]>>('state.shadertabs', {});
        this.shaderTabs = shaderTabs;
    }

    isShaderVisible(shaderName: string) {
        return shaderName in this.shaderOptions ? !this.shaderOptions[shaderName].isHidden : true;
    }

    setShaderOptions(shaderOptions: ShaderOptions) {
        this.shaderOptions = shaderOptions;
        this.onShaderSettingsChanged?.(this.shaderOptions);
    }

    setRandomizeVariation(randomizeVariation: number) {
        this.randomizeVariation = randomizeVariation;
        this.onRandomizeTimesChanged?.(this.randomizeTime, this.randomizeVariation);
    }

    setRandomizeTime(randomizeTime: number) {
        this.randomizeTime = randomizeTime;
        this.onRandomizeTimesChanged?.(this.randomizeTime, this.randomizeVariation);
    }

    setRandomizeBeat(randomizeBeat: boolean) {
        this.randomizeBeat = randomizeBeat;
        this.onRandomizeBeatChanged?.(this.randomizeBeat, this.randomizeBeatInterval);
    }

    setRandomizeBeatInterval(randomizeBeatInterval: number) {
        this.randomizeBeatInterval = randomizeBeatInterval;
        this.onRandomizeBeatChanged?.(this.randomizeBeat, this.randomizeBeatInterval);
    }

    triggerRandomizeBeat() {
        this.onRandomizeBeatTriggered?.();
    }

    private async setShaderCatalog(newShaderCatalog: ShaderCatalog) {
        this.shaderCatalog = newShaderCatalog;
        console.log('[ShaderAmp] Shader catalog updated:', this.shaderCatalog);
        await setStorage(STATE_SHADERLIST, newShaderCatalog);
    }

    private async setShaderIndex(newShaderIndex : number, forceUpdate: boolean = false) {
        this.shaderIndex = newShaderIndex;

        const currentShader = this.shaderCatalog.shaders[this.shaderIndex];
        if (!currentShader) {
            console.warn(`[ShaderAmp] Invalid shader index ${this.shaderIndex} (catalog size ${this.shaderCatalog.shaders.length}), not overwriting current shader`);
            return;
        }

        // Check if there's an existing inline/imported shader that shouldn't be overwritten
        if (!forceUpdate) {
            const existingShader = await getStorage<ShaderObject>(STATE_CURRENT_SHADER, undefined);
            if (existingShader?.inlineCode) {
                // Don't overwrite dynamically imported shaders (e.g., from Shadertoy)
                console.log('[ShaderAmp] Preserving inline shader, not overwriting with catalog shader');
                return;
            }
        }

        await setStorage(STATE_CURRENT_SHADER, currentShader);
    }

    private setRandomizeShaders(newRandomizeShaders : boolean) {
        this.randomizeShaders = newRandomizeShaders;
        this.onRandomizeShadersChanged?.(newRandomizeShaders);
    }

    private async onStorageChange(changes: { [key: string]: chrome.storage.StorageChange; }, areaName: "sync" | "local" | "managed" | "session") {
        if (areaName !== "local") {
            return;
        }
        
        if (STATE_SHADERLIST in changes) {
            var change = changes[STATE_SHADERLIST];
            this.shaderCatalog = change.newValue ?? [];
        }

        if (STATE_SHADERINDEX in changes) {
            var shaderIndex = changes[STATE_SHADERINDEX].newValue ?? 0;
            // User explicitly selected a shader, force update even if inline shader exists
            this.setShaderIndex(shaderIndex, true);
        } 

        if (STATE_SHADERNAME in changes) {
            var shaderName = changes[STATE_SHADERNAME].newValue;
            this.shaderName = shaderName;
        }

        if (SETTINGS_RANDOMIZE_SHADERS in changes) {
            var randomizeShaders = changes[SETTINGS_RANDOMIZE_SHADERS].newValue ?? false;
            this.setRandomizeShaders(randomizeShaders);
        }

        if (SETTINGS_RANDOMIZE_TIME in changes) {
            var randomizeTime = changes[SETTINGS_RANDOMIZE_TIME].newValue ?? 5;
            this.setRandomizeTime(randomizeTime);
        }

        if (SETTINGS_RANDOMIZE_VARIATION in changes) {
            var randomizeVariation = changes[SETTINGS_RANDOMIZE_VARIATION].newValue ?? 2;
            this.setRandomizeVariation(randomizeVariation);
        }

        if (SETTINGS_RANDOMIZE_BEAT in changes) {
            var randomizeBeat = changes[SETTINGS_RANDOMIZE_BEAT].newValue ?? false;
            this.setRandomizeBeat(randomizeBeat);
        }

        if (SETTINGS_RANDOMIZE_BEAT_INTERVAL in changes) {
            var randomizeBeatInterval = changes[SETTINGS_RANDOMIZE_BEAT_INTERVAL].newValue ?? 4;
            this.setRandomizeBeatInterval(randomizeBeatInterval);
        }

        if (SETTINGS_SHADEROPTIONS in changes) {
            var shaderOptions = changes[SETTINGS_SHADEROPTIONS].newValue ?? {};
            this.setShaderOptions(shaderOptions);
        }

        if (STATE_IMPORTED_SHADERS in changes) {
            // Reload from IndexedDB when sync signal changes
            const importedShadersData = await getImportedShadersDB();
            this.importedShaders = importedShadersData?.shaders || [];
            this.setShaderOptions(this.shaderOptions);
        }

        if ('state.customshaders' in changes) {
            this.customShaders = changes['state.customshaders'].newValue || [];
        }

        if ('state.shadertabs' in changes) {
            this.shaderTabs = changes['state.shadertabs'].newValue || {};
            this.setShaderOptions(this.shaderOptions);
        }
    }
}
