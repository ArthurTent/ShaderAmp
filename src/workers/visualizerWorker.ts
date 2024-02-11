import { KeepAliveWorker } from "./keepAliveWorker";
import { RandomizeShaderContoller } from "./randomizeShaderWorker";
import { VisualizerController } from "./visualizerController";
import WorkerState from "./workerState";

export class VisualizerWorker {
    workerState: WorkerState;
    randomizeShaderContoller: RandomizeShaderContoller;
    keepAliveWorker: KeepAliveWorker;
    visualizerController: VisualizerController;

    constructor(workerState: WorkerState) {
        this.workerState = workerState;
        this.keepAliveWorker  = new KeepAliveWorker();
        this.visualizerController = new VisualizerController(workerState);
        this.randomizeShaderContoller = new RandomizeShaderContoller(workerState, this.visualizerController);
    }

    initialize() {
        this.randomizeShaderContoller.initialize();
        this.keepAliveWorker.initialize();
        this.visualizerController.initialize();
    }
}