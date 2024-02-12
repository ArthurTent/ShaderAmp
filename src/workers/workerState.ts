import { loadShaderList } from "@src/helpers/shaderActions";
import { ClassTimer } from "@src/helpers/timer";
import { getStorage, setStorage } from "@src/storage/storage";
import { SETTINGS_RANDOMIZE_SHADERS, STATE_CURRENT_SHADER, STATE_SHADERINDEX, STATE_SHADERLIST, STATE_SHADERNAME, STATE_SHOWPREVIEW } from "@src/storage/storageConstants";
const IS_DEV_MODE = !('update_url' in chrome.runtime.getManifest());

export default class WorkerState {
    onRandomizeShadersChanged?: (value: boolean) => void;

    shaderCatalog:ShaderCatalog = {
        shaders: [],
        lastModified: new Date(0)
    };
    shaderIndex: number = 0;
    shaderName: string = ''
    currentShader: ShaderObject = { shaderName: 'MusicalHeart.frag' }
    randomizeShaders: boolean = false;
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
        this.pollingTimer = new ClassTimer(this.pollShadersDuration * 1000, () => this.pollShaders());
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
        
        const shaderIndex = await getStorage<number>(STATE_SHADERINDEX, 0);
        
        console.log({shaders, shaderIndex});
        await this.setShaderIndex(shaderIndex);

        const randomizeShaders = await getStorage<boolean>(SETTINGS_RANDOMIZE_SHADERS, true);
        this.setRandomizeShaders(randomizeShaders);
    }

    private async setShaderCatalog(newShaderCatalog: ShaderCatalog) {
        this.shaderCatalog = newShaderCatalog;
        await setStorage(STATE_SHADERLIST, newShaderCatalog);
    }

    private async setShaderIndex(newShaderIndex : number) {
        this.shaderIndex = newShaderIndex;
        const currentShader = this.shaderCatalog.shaders[this.shaderIndex];
        console.log(`setting currentShader to: `, currentShader);
        await setStorage(STATE_CURRENT_SHADER, currentShader);
    }

    private setRandomizeShaders(newRandomizeShaders : boolean) {
        this.randomizeShaders = newRandomizeShaders;
        this.onRandomizeShadersChanged?.(newRandomizeShaders);
    }

    private onStorageChange(changes: { [key: string]: chrome.storage.StorageChange; }, areaName: "sync" | "local" | "managed" | "session") {
        if (areaName !== "local") {
            return;
        }
        
        if (STATE_SHADERLIST in changes) {
            var change = changes[STATE_SHADERLIST];
            this.shaderCatalog = change.newValue ?? [];
        }

        if (STATE_SHADERINDEX in changes) {
            var change = changes[STATE_SHADERINDEX] ?? 0;
            this.setShaderIndex(change.newValue);
        } 

        if (STATE_SHADERNAME in changes) {
            var change = changes[STATE_SHADERNAME];
            this.shaderName = change.newValue;
        }

        if (SETTINGS_RANDOMIZE_SHADERS in changes) {
            var change = changes[SETTINGS_RANDOMIZE_SHADERS] ?? false;
            this.setRandomizeShaders(change.newValue);
        }
    }
}
