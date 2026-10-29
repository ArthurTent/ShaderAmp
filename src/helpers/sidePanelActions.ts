import browser from "webextension-polyfill";
import { SIDEPANEL_CLOSE } from "./constants";
import { buildSidePanelPath } from "./renderTarget";
import { logger } from "./logger";

/**
 * Open the extension side panel pointing at the ShaderAmp renderer for the
 * given source tab. MUST be invoked synchronously inside a user-gesture
 * handler (e.g. a popup click) — Chrome rejects open() otherwise, so no
 * `await` may precede it. setOptions and open are processed in order, so
 * the new path is installed before the panel shows.
 */
export const openSidePanelFromGesture = (tab: {
    id: number;
    windowId: number;
}): Promise<void> => {
    chrome.sidePanel
        .setOptions({ path: buildSidePanelPath(tab.id), enabled: true })
        .catch(() => {});
    return chrome.sidePanel.open({ windowId: tab.windowId });
};

/**
 * Close the ShaderAmp side-panel session. Every step is best effort because
 * different Chrome versions support different close mechanisms:
 * 1. Ask the panel page to window.close() itself.
 * 2. chrome.sidePanel.close (Chrome 141+).
 * 3. Disable the panel globally — closes it and removes the stale
 *    entry from Chrome's side-panel menu.
 */
export const closeSidePanel = async (windowId?: number): Promise<void> => {
    await browser.runtime
        .sendMessage({ type: SIDEPANEL_CLOSE })
        .catch(() => {});

    if (
        windowId !== undefined &&
        typeof chrome.sidePanel?.close === "function"
    ) {
        try {
            await chrome.sidePanel.close({ windowId });
        } catch {
            logger.background.log(
                "ShaderAmp",
                "sidePanel.close failed for window %d",
                windowId,
            );
        }
    }

    try {
        await chrome.sidePanel.setOptions({ enabled: false });
    } catch {
        logger.background.log(
            "ShaderAmp",
            "sidePanel.setOptions({enabled:false}) failed",
        );
    }
};
