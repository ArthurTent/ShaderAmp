import { ClassTimer } from "@src/helpers/timer";
import { setStorage } from "@src/storage/storage";
import { SETTINGS_RANDOMIZE_SHADERS, STATE_SHADERNAME, STATE_SHADERLIST } from "@src/storage/storageConstants";

export class RandomizeShaderContoller {
    readonly defaultTimerDuration: number = 40;
    randomizeTimer: ClassTimer = new ClassTimer(this.defaultTimerDuration * 1000, () => this.onTimerCallback());
    randomizeShaders: boolean = false;
    shaderList: string[] = []; 

    initialize() {
        console.log('[ShaderAmp] initializing randomizer...');
        this.registerCallbacks();
        this.toggleRandomizeShaders(true);
    }

    private registerCallbacks() {
        chrome.storage.onChanged.addListener((changes, area) => this.onStorageChange(changes, area));
    }

    private onTimerCallback() {
        this.selectRandomShader();
    }

    private selectRandomShader() {
        if (this.shaderList.length == 0) {
            return;
        }
        const index = Math.floor(Math.random() * this.shaderList.length);
        if (index < 0 || index >= this.shaderList.length) {
            return;
        }
        const shaderName = this.shaderList[index];
        setStorage(STATE_SHADERNAME, shaderName);
    }

    private toggleRandomizeShaders(newRandomizeShaders: boolean) {
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
        if (areaName !== "local") {
            return;
        }
        
        if (STATE_SHADERLIST in changes) {
            var change = changes[STATE_SHADERLIST];
            this.onShaderlistChange(change.newValue);
        }

        if (SETTINGS_RANDOMIZE_SHADERS in changes) {
            var change = changes[SETTINGS_RANDOMIZE_SHADERS];
            this.toggleRandomizeShaders(change.newValue);
        } 
    }
}