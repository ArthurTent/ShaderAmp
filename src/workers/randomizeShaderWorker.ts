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
    }

    onRandomizeTimeChanged(randomizeTime: number, randomizeVariation: number): void {
        this.randomizeTimer.setDuration(randomizeTime, randomizeVariation);
    }

    private onTimerCallback() {
        this.selectRandomShader();
    }

    private selectRandomShader() {
        const catalog = this.workerState.shaderCatalog;
        const shaderList = catalog.shaders;
        if (shaderList.length == 0) {
            return;
        }
        const index = Math.floor(Math.random() * shaderList.length);
        this.visualizerController.setShader(index);
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