import browser from "webextension-polyfill";

export const getCurrentTab = async (active = true, currentWindow = true): Promise<browser.Tabs.Tab | undefined> => {
    return new Promise(async (resolve) => {
        const tabs = await browser.tabs.query({active, currentWindow});
        resolve(tabs[0]);
    });
}

export const getTabById = async (tabId: number): Promise<browser.Tabs.Tab | undefined> => {
    return browser.tabs.get(tabId);
}

export const  sendMessageToTab = async (tabId: number, data: any) => {
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

export const tabStreamCapture = (capturedTab: number, consumer: number) => {
    return new Promise<string | null>((resolve) => {
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