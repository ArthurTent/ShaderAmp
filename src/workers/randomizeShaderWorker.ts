import { ClassTimer } from "@src/helpers/timer";
import WorkerState from "./workerState";
import { VisualizerController } from "./visualizerController";
import type { ShaderOptions, ShaderOption, ShaderObject } from "@src/helpers/types";
import { setStorage } from "@src/storage/storage";
import { STATE_CURRENT_SHADER, STATE_SHADERINDEX } from "@src/storage/storageConstants";

export class RandomizeShaderContoller {
    readonly defaultTimerDuration: number = 5;
    readonly defaultTimerVariation: number = 2;
    randomizeTimer: ClassTimer = new ClassTimer(this.defaultTimerDuration, this.defaultTimerVariation, () => this.onTimerCallback());
    randomizeShaders: boolean = false;
    workerState: WorkerState;
    visualizerController: VisualizerController;
    visibleShaders: ShaderObject[] = [];

    constructor(workerState: WorkerState, visualizerController: VisualizerController) {
        this.workerState = workerState;
        this.visualizerController = visualizerController;
    }

    initialize() {
        console.log('[ShaderAmp] Initializing randomizer...');
        this.registerCallbacks();
        this.toggleRandomizeShaders(true);
    }

    private registerCallbacks() {
        this.workerState.onRandomizeShadersChanged = (newRandomizeShaders: boolean) => this.toggleRandomizeShaders(newRandomizeShaders);
        this.workerState.onRandomizeTimesChanged = (randomizeTime: number, randomizeVariation: number) => this.onRandomizeTimeChanged(randomizeTime, randomizeVariation);
        this.workerState.onRandomizeBeatTriggered = () => this.selectRandomShaderOnBeat();
        this.workerState.onShaderSettingsChanged = (newOptions: ShaderOptions) => this.onShaderSettingsChanged(newOptions);
    }
    
    onShaderSettingsChanged(shaderOptions: ShaderOptions): void {
        const builtInShaders = this.workerState.shaderCatalog.shaders;
        let pool: ShaderObject[] = [];

        // 1. Add visible built-in shaders
        builtInShaders.forEach((shaderObject) => {
            const shaderName = shaderObject.shaderName;
            const shaderOption : ShaderOption = shaderName in shaderOptions ? shaderOptions[shaderName] : { isHidden: false }
            if (!shaderOption.isHidden) {
                pool.push(shaderObject);
            }
        });

        // 2. Add imported shaders that are assigned to at least one custom tab
        const imported = this.workerState.importedShaders || [];
        const tabs = this.workerState.shaderTabs || {};

        imported.forEach((imp: any) => {
            const assignedTabs = tabs[imp.id] || [];
            if (assignedTabs.length > 0) {
                // Check if this imported shader is hidden by the user
                const shaderOption : ShaderOption = imp.id in shaderOptions ? shaderOptions[imp.id] : { isHidden: false };
                if (shaderOption.isHidden) {
                    return;
                }
                const inlineBuffers: { [filename: string]: string } = {};
                for (const buffer of imp.bufferShaders || []) {
                    inlineBuffers[buffer.filename] = buffer.code;
                }
                const meta = { ...imp.mainShader.meta, previewImage: imp.previewImage } as any;
                const shaderObject: ShaderObject = {
                    shaderName: imp.mainShader.filename,
                    metaData: meta,
                    inlineCode: imp.mainShader.code,
                    inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined
                };
                pool.push(shaderObject);
            }
        });

        this.visibleShaders = pool;
    }

    onRandomizeTimeChanged(randomizeTime: number, randomizeVariation: number): void {
        this.randomizeTimer.setDuration(randomizeTime, randomizeVariation);
    }

    private onTimerCallback() {
        this.selectRandomShader();
    }

    private async selectRandomShader() {
        const shaderList = this.visibleShaders;
        if (shaderList.length == 0) {
            console.log(`[ShaderAmp] Can't select random shader, the pool is empty`, shaderList);
            return;
        }
        const randomIndex = Math.floor(Math.random() * shaderList.length);
        const selectedShader = shaderList[randomIndex];

        if (selectedShader.inlineCode) {
            // Imported shader: set current shader and clear built-in index
            await setStorage(STATE_CURRENT_SHADER, selectedShader);
            await setStorage(STATE_SHADERINDEX, -1);
        } else {
            // Built-in shader: set index which updates current shader automatically
            const index = this.workerState.shaderCatalog.shaders.findIndex(s => s.shaderName === selectedShader.shaderName);
            if (index !== -1) {
                this.visualizerController.setShader(index);
            }
        }
    }

    public selectRandomShaderOnBeat() {
        console.log('[ShaderAmp] Beat-based random shader selection');
        this.selectRandomShader();
    }

    private toggleRandomizeShaders(newRandomizeShaders: boolean) {
        this.randomizeShaders = newRandomizeShaders;
        if (this.randomizeShaders) {
            this.randomizeTimer.start();
        } else {
            this.randomizeTimer.stop();
        }
    }
}