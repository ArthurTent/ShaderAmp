import { tabStreamCapture } from '@src/helpers/tabActions';
import { getAppState } from '@src/helpers/tabMappingService';

export const acquireVideoStream = async (video : HTMLVideoElement): Promise<MediaStream | undefined> => {
    const appState = await getAppState()
    const optionsTab = appState.optionsTab;
    const contentTabId = optionsTab.contentTabId;
    if (contentTabId) {
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
        video.srcObject = stream;
        return stream;
    }
}
