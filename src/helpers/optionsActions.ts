import { tabStreamCapture } from '@src/helpers/tabActions';
import { getAppState } from '@src/helpers/tabMappingService';

export const acquireVideoStream = async (video : HTMLVideoElement) => {
    const appState = await getAppState()
    const optionsTab = appState.optionsTab;
    const contentTabId = optionsTab.contentTabId;
    if (contentTabId) {
        console.log(`contentTabId: ${contentTabId}`);
        const streamId = await tabStreamCapture(contentTabId, optionsTab.tabId);

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId,
                },
            },
        });
        console.log(`streamId: ${stream}`);
        video.srcObject = stream;
    }
}
