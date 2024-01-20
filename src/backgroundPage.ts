import {getStorage, setStorage} from "@src/helpers/storage";
import browser from "webextension-polyfill";
import {START} from "@src/helpers/constants";
import {doesTabExist, getCurrentTab, tabStreamCapture} from "@src/helpers/tabActions";

const removeTab = (tabId: number) => {
    return new Promise((resolve) => {
        chrome.tabs.remove(tabId).then(resolve).catch(resolve);
    });
}

const openShaderAmp = async (openerTabId: number | undefined) => {
    // Fetch the current tab id in case it's not passed as a parameter
    if (openerTabId === undefined) {
        const currentTab = await getCurrentTab();
        openerTabId = currentTab?.id!;
    }
    // Check if the content tab is not already open
    const openTabs: TabMapping = await getStorage('tabMapping')
    if (openTabs) {
        const alreadyOpened = openTabs[openerTabId]
        if (alreadyOpened && await doesTabExist(alreadyOpened.contentTabId)) {
            // jump to the already opened tab
            await browser.tabs.update(alreadyOpened.contentTabId, {active: true})
            return Promise.resolve();
        }
    }

    // Create a new content tab
    const targetTab = await browser.tabs.create({url: 'content.html', openerTabId: openerTabId, active: false});
    const stream =  await tabStreamCapture(openerTabId, targetTab.id as number);

    // Cache the content tab id and target stream
    const tabMapping : TabMapping = {};
    tabMapping[openerTabId] = {
        contentTabId: targetTab.id as number,
        stream,
    };
    await setStorage("tabMapping", tabMapping);
    // Set the new content tab active
    await browser.tabs.update(targetTab.id as number, {active: true});

    return Promise.resolve();
}

browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg.command && (msg.command === START)) {
        await openShaderAmp(msg.openerTabId);
    }
    return Promise.resolve();
});

browser.tabs.onRemoved.addListener(async (tabId) => {
    const tabMapping: TabMapping = await getStorage("tabMapping");
    // when the current tab is closed, the content tab is also closed
    if (tabMapping && tabMapping[tabId]) {
        await removeTab(tabMapping[tabId].contentTabId);
        delete tabMapping[tabId];
        await setStorage("tabMapping", tabMapping)
    }
});

browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'open-shader-amp') {
        return Promise.resolve();
    }
    await openShaderAmp(undefined);
});