import {getStorage, setStorage} from "@src/helpers/storage";
import browser from "webextension-polyfill";
import {START} from "@src/helpers/constants";
import {tabStreamCapture} from "@src/helpers/tabActions";

const removeTab = (tabId: number) => {
    return new Promise((resolve) => {
        chrome.tabs.remove(tabId).then(resolve).catch(resolve);
    });
}

browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg.command && (msg.command === START)) {
        const targetTab = await browser.tabs.create({url: 'content.html', openerTabId: msg.openerTabId, active: false});
        const stream =  await tabStreamCapture(msg.openerTabId as number, targetTab.id as number);

        const tabMapping : TabMapping = {};
        tabMapping[msg.openerTabId as number] = {
            contentTabId: targetTab.id as number,
            stream,
        };
        await setStorage("tabMapping", tabMapping);
        await browser.tabs.update(targetTab.id as number, {active: true});
        return Promise.resolve();
    }
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