import browser from "webextension-polyfill";
import { getTabMappings, storeTabMapping } from "./tabMappingService";
import { sidePanelUrlMatchesSource } from "./renderTarget";
import type { TabInfo, TabMapping } from "./types";
import { logger } from './logger';

export const getCurrentTab = async (active = true, currentWindow = true): Promise<browser.Tabs.Tab | undefined> => {
    return new Promise(async (resolve) => {
        const tabs = await browser.tabs.query({active, currentWindow});
        resolve(tabs[0]);
    });
}

// Liveness check for a render session. A 'sidepanel' session is alive while
// the panel page (identified by its document URL) is present in
// chrome.runtime.getContexts. The API exists since Chrome 116; treat a
// missing/failing API as "dead" so stale mappings get replaced on re-open.
export const isSessionAlive = async (info: TabInfo): Promise<boolean> => {
    if (!info) return false;
    if (info.kind === 'sidepanel') {
        try {
            const contexts = await chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'] });
            return contexts.some(c => sidePanelUrlMatchesSource(c.documentUrl, info.sourceTabId));
        } catch {
            return false;
        }
    }
    return info.contentTabId !== undefined && await doesTabExist(info.contentTabId);
}

export const findOpenContentTab = async () : Promise<TabInfo | undefined> => {
    const mappedTabs: TabMapping = await getTabMappings();
    for (const mapInfo of Object.values(mappedTabs)) {
        if (await isSessionAlive(mapInfo)) {
            return mapInfo;
        }
    }
    return undefined;
}

export const findOpenContentTabId = async () : Promise<number | undefined> => {
    const contentTabMapping = await findOpenContentTab();
    return contentTabMapping?.contentTabId;
}

export const getTabById = async (tabId: number): Promise<browser.Tabs.Tab | undefined> => {
    return browser.tabs.get(tabId);
}

export const sendMessageToTab = async (tabId: number, data: any) => {
    return browser.tabs.sendMessage(tabId, data);
}

// Deliver a message to whichever surface hosts the render session:
// tabs.sendMessage for content tabs; a runtime broadcast tagged with the
// source tab id for side-panel pages (they have no tab id of their own).
export const sendToSession = (info: TabInfo, msg: any) => {
    if (info.kind === 'sidepanel') {
        browser.runtime.sendMessage({ ...msg, sessionSourceTabId: info.sourceTabId }).catch(() => {});
        return;
    }
    if (info.contentTabId !== undefined) {
        browser.tabs.sendMessage(info.contentTabId, msg).catch(() => {});
    }
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

export const tabStreamCapture = (capturedTab: number, consumer?: number) : Promise<string | undefined> => {
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
            audio: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId,
                },
            },
            video: false,
        });
        return stream;
    } catch { }
    return undefined;
}

export const reacquireMediaStream = async (targetTabId:number, tabData: TabInfo) : Promise<MediaStream | undefined> => {
    const newStreamId = await tabStreamCapture(targetTabId);
    if (newStreamId === undefined) {
        logger.content.error('ShaderAmp', 'Could not re-capture existing tab');
        return undefined;
    }

    // Store the new streamId in the tab mapping
    tabData.stream = newStreamId;
    await storeTabMapping(targetTabId, tabData);

    const stream = await tryGetMediaStream(newStreamId);
    return stream;
}

export const getMediaStreamFromTab = async(targetTabId:number, tabData: TabInfo) => {
    let stream = await tryGetMediaStream(tabData.stream!);
    if (stream != undefined) {
        return stream;
    }
    logger.content.log('ShaderAmp', 'Trying to reacquire media stream from %d', targetTabId);
    return await reacquireMediaStream(targetTabId, tabData);
} 

export enum WebcamSource {
    Audio,
    Video
};
export const getWebcamStream = async(source: WebcamSource) : Promise<MediaStream | undefined> => {
    const constraints:MediaStreamConstraints = source === WebcamSource.Video ?
        { video: { width: 1280, height: 720, facingMode: 'user' } } :
        { audio: true };
    return await navigator.mediaDevices.getUserMedia(constraints);
}

export const getDisplayMediaStream = async (): Promise<MediaStream | undefined> => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        return stream;
    } catch (e) {
        logger.content.error('ShaderAmp', 'getDisplayMedia failed: %s', e);
        return undefined;
    }
}