import { ClassTimer } from "@src/helpers/timer";
import { SETTINGS_RANDOMIZE_SHADERS, SETTINGS_SPEEDDIVIDER, STATE_SHADERLIST } from "@src/storage/storageConstants";

export class RandomizeShaderContoller {
    readonly defaultTimerDuration: number = 3;
    randomizeTimer: ClassTimer = new ClassTimer(this.defaultTimerDuration * 1000, this.onTimerCallback);
    randomizeShaders: boolean = false;
    shaderList: string[] | undefined; 

    initialize() {
        console.log('[ShaderAmp] initializing randomizer...');
        this.registerCallbacks();
    }

    private registerCallbacks() {
        chrome.storage.onChanged.addListener((changes, area) => this.onStorageChange(changes, area));
    }

    private onTimerCallback() {
        console.log(`onTimerCallback...`);
    }

    private onRandomizeShadersChange(newRandomizeShaders: boolean) {
        this.randomizeShaders = newRandomizeShaders;
        if (this.randomizeShaders) {
            this.randomizeTimer.start();
        } else {
            this.randomizeTimer.stop();
        }
    }

    private onShaderlistChange(newShaderList: string[]) {
        this.shaderList = newShaderList ?? [];
    }

    private onStorageChange(changes: { [key: string]: chrome.storage.StorageChange; }, areaName: "sync" | "local" | "managed" | "session") {
        console.log(`onStorageChange: `, changes, areaName);
        if (areaName !== "local") {
            return;
        }
        
        if (STATE_SHADERLIST in changes) {
            var change = changes[STATE_SHADERLIST];
            this.onShaderlistChange(change.newValue);
        }

        if (SETTINGS_RANDOMIZE_SHADERS in changes) {
            var change = changes[SETTINGS_RANDOMIZE_SHADERS];
            this.onRandomizeShadersChange(change.newValue);
        } 
    }
}