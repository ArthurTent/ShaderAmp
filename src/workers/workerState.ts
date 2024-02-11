import { loadShaderList } from "@src/helpers/shaderActions";
import { getStorage, setStorage } from "@src/storage/storage";
import { SETTINGS_RANDOMIZE_SHADERS, STATE_CURRENT_SHADER, STATE_SHADERINDEX, STATE_SHADERLIST, STATE_SHADERNAME, STATE_SHOWPREVIEW } from "@src/storage/storageConstants";

export default class WorkerState {
    onRandomizeShadersChanged?: (value: boolean) => void;

    shaderList:ShaderObject[] = [];
    shaderIndex: number = 0;
    shaderName: string = ''
    currentShader: ShaderObject = { shaderName: 'MusicalHeart.frag' }
    randomizeShaders: boolean = false;

    constructor() {
        console.log(`[ShaderAmp] Loading worker state...`);
        this.setupInitialStorage();    
    }
    
    async setupInitialStorage() {
        await this.setupInitialState();
        chrome.storage.onChanged.addListener((changes, area) => this.onStorageChange(changes, area));
    }

    async setupInitialState() {
        const shaders = await loadShaderList();
        await this.setShaderList(shaders);
        
        const shaderIndex = await getStorage<number>(STATE_SHADERINDEX, 0);
        
        console.log({shaders, shaderIndex});
        await this.setShaderIndex(shaderIndex);

        const randomizeShaders = await getStorage<boolean>(SETTINGS_RANDOMIZE_SHADERS, true);
        this.setRandomizeShaders(randomizeShaders);
    }

    private async setShaderList(newShaderList: ShaderObject[]) {
        this.shaderList = newShaderList;
        await setStorage(STATE_SHADERLIST, newShaderList);
    }

    private async setShaderIndex(newShaderIndex : number) {
        this.shaderIndex = newShaderIndex;
        const currentShader = this.shaderList[this.shaderIndex];
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
            this.shaderList = change.newValue ?? [];
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
