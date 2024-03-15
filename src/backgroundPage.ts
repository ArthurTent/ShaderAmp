import browser, { Tabs } from "webextension-polyfill";
import { START } from "@src/helpers/constants";
import {closeTab, doesTabExist, findOpenContentTabId, getCurrentTab, tabStreamCapture } from "@src/helpers/tabActions";
import { getAppState, getTabMappings, removeTabMapping, setAppState, storeTabMapping } from "./helpers/tabMappingService";
import { VisualizerWorker } from "./workers/visualizerWorker";
import WorkerState from "./workers/workerState";

export const openShaderAmp = async (openerTabId?: number | undefined) => {
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
        sourceTabId: openerTabId,
        contentTabId: targetTab.id as number,
        stream,
    };
    await storeTabMapping(openerTabId, tapMappingInfo);

    // Set the new content tab active
    await browser.tabs.update(targetTab.id as number, {active: true});

    return Promise.resolve();
}

export const focusWindow = async (windowId: number) => {
    await browser.windows.update(windowId, {focused: true});
}

export const focusTab = async (tabId: number) => {
    const focusTabWindow = async (tab:Tabs.Tab) => await focusWindow(tab.windowId!);
    browser.tabs.update(tabId, {active: true})
        .then(focusTabWindow); 
}

export const openShaderAmpOptions = async () => {
    // Check if options tab is not already open
    //  if so, activate/focus options tab
    const appState = await getAppState();
    const optionsTabId = appState.optionsTab?.tabId;
    const isOptionsTabOpen = optionsTabId && await doesTabExist(optionsTabId);
    if (isOptionsTabOpen) {
        console.log('[ShaderAmp] Options tab already open, activating that tab...');
        // Set the new content tab active
        await focusTab(optionsTabId);
        return;
    }

    // Create a new options tab
    const targetTab = await browser.tabs.create({url: 'options.html', active: false});
    const targetTabId = targetTab.id as number;

    // Find the content page and try to capture a stream from it
    const activeContentTabId = await findOpenContentTabId();
    
    // Store the option tab info in the state
    appState.optionsTab.tabId = targetTabId;
    appState.optionsTab.contentTabId = activeContentTabId;
    setAppState(appState);

    // Logging
    console.log(`[ShaderAmp] Active content tab: ${activeContentTabId}`);

    // Set the new options tab active
    await focusTab(targetTabId);
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

    if (command === 'open-shader-amp') {
        await openShaderAmp();
    } else if (command === 'open-shader-amp-options') {
        await openShaderAmpOptions();
    }
});

// Workaround for using setInterval in the service-worker
if (!global.window) {
    global.window = self;
}

const workerState = new WorkerState();
const visualizerWorker = new VisualizerWorker(workerState);
visualizerWorker.initialize();