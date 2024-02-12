import { NEXT_SHADER, PREV_SHADER } from "@src/helpers/constants";
import browser from "webextension-polyfill";
import { STATE_SHADERINDEX } from "@src/storage/storageConstants";
import WorkerState from './workerState';
import { setStorage } from "@src/storage/storage";

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
    
    registerCallbacks() {
        browser.runtime.onMessage.addListener((msg, sender) => {
            if (!msg.command) {
                return;
            }

            const shaderCatalog = this.workerState.shaderCatalog;
            const shaderIndex = this.workerState.shaderIndex;

            switch (msg.command) {
                case PREV_SHADER:
                    let previousShaderIndex = shaderIndex - 1;
                    if (previousShaderIndex < 0) { // loop around
                        previousShaderIndex = shaderCatalog.shaders.length - 1;
                    }
                    this.setShader(previousShaderIndex);
                break;
                case NEXT_SHADER:
                    let nextShaderIndex = shaderIndex + 1;
                    if (nextShaderIndex == shaderCatalog.shaders.length) { // loop around
                        nextShaderIndex = 0;
                    }
                    this.setShader(nextShaderIndex); 
                break;
            }
        });    

    }

    setShader(index: number) {
        if (index < 0 || index >= this.shaderCatalog.shaders.length) {
            return;
        }
        setStorage(STATE_SHADERINDEX, index);
    }

}