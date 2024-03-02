import browser from "webextension-polyfill";
import { storeTabMapping } from "./tabMappingService";

export const getCurrentTab = async (active = true, currentWindow = true): Promise<browser.Tabs.Tab | undefined> => {
    return new Promise(async (resolve) => {
        const tabs = await browser.tabs.query({active, currentWindow});
        resolve(tabs[0]);
    });
}

export const getTabById = async (tabId: number): Promise<browser.Tabs.Tab | undefined> => {
    return browser.tabs.get(tabId);
}

export const sendMessageToTab = async (tabId: number, data: any) => {
    return browser.tabs.sendMessage(tabId, data);
}

export const doesTabExist = (tabId: number): Promise<boolean> => {
    return new Promise<boolean>(async (resolve) => {
        const tabs = await browser.tabs.query({});
        const exists = tabs.some(tab => tab.id === tabId);
        resolve(exists);
    });
}

export const tabCapture = () => {
    return new Promise<MediaStream | null>((resolve) => {
        chrome.tabCapture.capture(
            {
                audio: true,
                audioConstraints: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        echoCancellation: true
                    }
                },
                video: false
            },
            (stream) => {
                resolve(stream);
            }
        );
    });
}

export const closeTab = (tabId: number) => {
    return new Promise((resolve) => {
        chrome.tabs.remove(tabId).then(resolve).catch(resolve);
    });
}

export const tabStreamCapture = (capturedTab: number, consumer: number) : Promise<string | undefined> => {
    return new Promise<string | undefined>((resolve) => {
        chrome.tabCapture.getMediaStreamId(
            {
                //consumerTabId: consumer,
                targetTabId: capturedTab,
            },
            (stream) => {
                resolve(stream);
            }
        );
    });
}


export const tryGetMediaStream = async (streamId: string) : Promise<MediaStream | undefined> => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            /*
            audio: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId,
                },
            },*/
            audio: true,
            video: false,
        });
        return stream;
    } catch { }
    return undefined;
}

export const reacquireMediaStream = async (targetTabId:number, tabData: TabInfo) : Promise<MediaStream | undefined> => {
    const newStreamId = await tabStreamCapture(targetTabId, tabData.contentTabId);
    if (newStreamId === undefined) {
        console.error('[ShaderAmp] Could not re-capture existing tab.');
        return undefined;
    }

    // Store the new streamId in the tab mapping
    tabData.stream = newStreamId;
    await storeTabMapping(targetTabId, tabData);

    const stream = await tryGetMediaStream(newStreamId);
    return stream;
}

export const getMediaStream = async(targetTabId:number, tabData: TabInfo) => {
    let stream = await tryGetMediaStream(tabData.stream!);
    if (stream != undefined) {
        return stream;
    }
    console.log(`[ShaderAmp] Trying to reaquire the media stream from ${targetTabId}`);
    return await reacquireMediaStream(targetTabId, tabData);
} 

export const getWebcamStream = async() : Promise<MediaStream | undefined> => {
    const constraints = { video: { width: 1280, height: 720, facingMode: 'user' } };
    const webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
    return webcamStream;
}