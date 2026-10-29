import { getStorage, setStorage } from "../storage/storage";
import type { TabMapping, TabInfo, AppState } from "./types";

// Returns the removed session info so callers can decide how to tear it
// down (close the content tab vs. close the side panel).
export const removeTabMapping = async(tabId : number) : Promise<TabInfo | undefined> => {
    const tabMapping: TabMapping = await getStorage("tabMapping");
    if (tabMapping && tabMapping[tabId]) {
        const info = tabMapping[tabId];
        // Delete the tapInfo from the mapping and store it
        delete tabMapping[tabId];
        await setStorage("tabMapping", tabMapping);
        return Promise.resolve(info);
    }
}

export const getTabMappings = async() : Promise<TabMapping> => {
    return await getStorage('tabMapping') || {};
}

export const getContentTabInfo = async(tabId: number) : Promise<TabInfo | undefined> => {
    const tabMapping : TabMapping = await getTabMappings();
    const foundTabInfo = Object.values(tabMapping).find(x => x.contentTabId == tabId);
    return foundTabInfo;
}

export const storeTabMapping = async(tabId : number, tabInfo : TabInfo) => {
    const tabMapping : TabMapping = await getTabMappings();
    tabMapping[tabId] = tabInfo;
    await setStorage("tabMapping", tabMapping);
}

export const getAppState = async() : Promise<AppState> => {
    return await getStorage('appState') || { optionsTab: {} };
}

export const setAppState = async(appState : AppState) => {
    await setStorage("appState", appState);
}

// The side-panel page loads concurrently with the background writing its
// session mapping, so the page polls until the mapping of the expected kind
// appears (the background write wins because storeTabMapping runs before the
// panel finishes loading; the poll covers the remaining race window).
export const waitForTabMapping = async(
    sourceTabId: number,
    kind?: TabInfo["kind"],
    timeoutMs = 5000,
    intervalMs = 100
) : Promise<TabInfo | undefined> => {
    const deadline = Date.now() + timeoutMs;
    do {
        const info = (await getTabMappings())?.[sourceTabId];
        if (info && info.kind === kind) {
            return info;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    return undefined;
}
