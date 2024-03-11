import { ClassTimer } from "@src/helpers/timer";
import WorkerState from "./workerState";
import { VisualizerController } from "./visualizerController";

export class RandomizeShaderContoller {
    readonly defaultTimerDuration: number = 5;
    readonly defaultTimerVariation: number = 2;
    randomizeTimer: ClassTimer = new ClassTimer(this.defaultTimerDuration, this.defaultTimerVariation, () => this.onTimerCallback());
    randomizeShaders: boolean = false;
    workerState: WorkerState;
    visualizerController: VisualizerController;
    visibleShaderIndices: number[] = [];

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
        this.workerState.onShaderSettingsChanged = (newOptions: ShaderOptions) => this.onShaderSettingsChanged(newOptions);
    }
    
    onShaderSettingsChanged(shaderOptions: ShaderOptions): void {
        const shaders = this.workerState.shaderCatalog.shaders;
        let visibleShaders:number[] = []
        shaders.map((shaderObject, index) => {
            const shaderName = shaderObject.shaderName;
            const shaderOption : ShaderOption = shaderName in shaderOptions ? shaderOptions[shaderName] : { isHidden: false }
            if (shaderOption.isHidden) {
                return;
            }
            visibleShaders.push(index);
        });
        this.visibleShaderIndices = visibleShaders;
    }

    onRandomizeTimeChanged(randomizeTime: number, randomizeVariation: number): void {
        this.randomizeTimer.setDuration(randomizeTime, randomizeVariation);
    }

    private onTimerCallback() {
        this.selectRandomShader();
    }

    private selectRandomShader() {
        const shaderList = this.visibleShaderIndices;
        if (shaderList.length == 0) {
            console.log(`[ShaderAmp] Can't select random shader, the list is empty`, shaderList);
            return;
        }
        const randomIndex = Math.floor(Math.random() * shaderList.length);
        const shaderIndex = this.visibleShaderIndices[randomIndex];
        this.visualizerController.setShader(shaderIndex);
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