import { getStorage, setStorage } from "./storage";

export const removeTabMapping = async(tabId : number) : Promise<number | undefined> => {
    const tabMapping: TabMapping = await getStorage("tabMapping");
    if (tabMapping && tabMapping[tabId]) {
        // Cache the content tab id so we can return it
        const contentTabId = tabMapping[tabId].contentTabId;
        // Delete the tapInfo from the mapping and store it
        delete tabMapping[tabId];
        await setStorage("tabMapping", tabMapping);
        // Return the removed content tab id
        return Promise.resolve(contentTabId);
    }
}

export const getTabMappings = async() : Promise<TabMapping> => {
    return await getStorage('tabMapping') || {};
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
