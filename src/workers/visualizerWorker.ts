import { loadShaderList } from "@src/helpers/shaderActions";
import { setStorage, getStorage } from "@src/storage/storage";
import { STATE_SHADERLIST } from "@src/storage/storageConstants";

export class VisualizerWorker {
    initialize() {
        // Fetch initial shader-list
        this.fetchShaderList().catch(error => console.error(error));
    }

    fetchShaderList = async () => {
        const shaders = await loadShaderList();
        await setStorage(STATE_SHADERLIST, shaders);
        console.log(`[ShaderAmp] Retrieved shaderlist, result: ${shaders}`);
    }
}