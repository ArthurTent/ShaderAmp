import { NEXT_SHADER, PREV_SHADER } from "@src/helpers/constants";
import browser from "webextension-polyfill";
import { STATE_SHADERINDEX } from "@src/storage/storageConstants";
import WorkerState from './workerState';
import { setStorage } from "@src/storage/storage";

// Controls the visualisation
export class VisualizerController {
    workerState: WorkerState;
    public get shaderList() {
        return this.workerState.shaderList;
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

            const shaderList = this.workerState.shaderList;
            const shaderIndex = this.workerState.shaderIndex;

            switch (msg.command) {
                case PREV_SHADER:
                    let previousShaderIndex = shaderIndex - 1;
                    if (previousShaderIndex < 0) { // loop around
                        previousShaderIndex = shaderList.length - 1;
                    }
                    this.setShader(previousShaderIndex);
                break;
                case NEXT_SHADER:
                    let nextShaderIndex = shaderIndex + 1;
                    if (nextShaderIndex == shaderList.length) { // loop around
                        nextShaderIndex = 0;
                    }
                    this.setShader(nextShaderIndex); 
                break;
            }
        });    

    }

    setShader(index: number) {
        if (index < 0 || index >= this.shaderList.length) {
            return;
        }
        setStorage(STATE_SHADERINDEX, index);
    }

}