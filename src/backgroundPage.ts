import browser from "webextension-polyfill";
import {START} from "@src/helpers/constants";
import {closeTab, doesTabExist, getCurrentTab, tabStreamCapture} from "@src/helpers/tabActions";
import { getTabMappings, removeTabMapping, storeTabMapping } from "./helpers/tabMappingService";

const openShaderAmp = async (openerTabId: number | undefined) => {
    // Fetch the current tab id in case it's not passed as a parameter
    if (openerTabId === undefined) {
        const currentTab = await getCurrentTab();
        openerTabId = currentTab?.id!;
    }

    // Check if the content tab is not already open
    const openTabs: TabMapping = await getTabMappings();
    if (openTabs) {
        const isTargetTabContentTab = Object.values(openTabs).some(x => x.contentTabId == openerTabId);
        if (isTargetTabContentTab) { // We're already on a content tab, ignore.
            console.log('[ShaderAmp] Already on content tab, ignoring.');
            return Promise.resolve();
        }

        const alreadyOpened = openTabs[openerTabId];
        const isContentTabOpenOnTarget = await doesTabExist(alreadyOpened?.contentTabId);
        if (isContentTabOpenOnTarget) {
            if (alreadyOpened) {
                console.log(`[ShaderAmp] Content tab is already open for tab ${openerTabId}, activating content tab...`);
                // Jump to the already opened tab
                await browser.tabs.update(alreadyOpened.contentTabId, {active: true})
                return Promise.resolve();
            } else {
                // Do we allow multiple content tabs? If not;
                // Close the existing content tab that targets the other tab and re-open?
                // ...
            }
        }
    }

    console.log(`[ShaderAmp] Opening content tab for targetTab: ${openerTabId}`);

    // Create a new content tab
    const targetTab = await browser.tabs.create({url: 'content.html', openerTabId: openerTabId, active: false});
    const stream =  await tabStreamCapture(openerTabId, targetTab.id as number);

    // Cache the content tab id and target stream
    const tapMappingInfo : TabInfo = {
        contentTabId: targetTab.id as number,
        stream,
    };
    await storeTabMapping(openerTabId, tapMappingInfo);

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
    const removedContentTabId = await removeTabMapping(tabId);
    if (removedContentTabId) {
        await closeTab(removedContentTabId);
    }
});

browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'open-shader-amp') {
        return Promise.resolve();
    }
    await openShaderAmp(undefined);
});
