import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import { doesTabExist, getCurrentTab, getTabById } from "@src/helpers/tabActions";
import { START } from "@src/helpers/constants";
import css from "../styles.module.css";
import { getTabMappings } from "@src/helpers/tabMappingService";
import { openShaderAmpOptions } from "@src/backgroundPage";

const MAX_RECOMMENDED_WIDTH = 1280;
const MAX_RECOMMENDED_HEIGHT = 720;

export function Popup() {
    const [isContentPage, setIsContentPage] = useState(false);
    const [runningTab, setRunningTab] = useState<number>();
    const [capturedTab, setCapturedTab] = useState<browser.Tabs.Tab | undefined>();
    const [showResolutionWarning, setShowResolutionWarning] = useState(false);
    useEffect(() => {
        // Check screen resolution
        const checkResolution = () => {
            const width = window.screen.width * window.devicePixelRatio;
            const height = window.screen.height * window.devicePixelRatio;
            setShowResolutionWarning(
                width > MAX_RECOMMENDED_WIDTH || 
                height > MAX_RECOMMENDED_HEIGHT
            );
        };

        // Initial check
        checkResolution();

        // Check on resize
        window.addEventListener('resize', checkResolution);
        return () => window.removeEventListener('resize', checkResolution);
    }, []);

    useEffect(() => {
        (async () => {
            const currentTab = await getCurrentTab();
            if (!currentTab?.id) return;
            
            const openTabs: TabMapping = await getTabMappings();
            
            // Check if current tab is a content tab
            const isContentTab = Object.values(openTabs).some(
                tab => tab.contentTabId === currentTab.id
            );
            
            // Check if current tab is a captured tab
            const captureTabId = Object.keys(openTabs).find(
                key => openTabs[Number(key)].contentTabId === currentTab.id
            );
            
            if (isContentTab || captureTabId) {
                setIsContentPage(true);
                const sourceTabId = captureTabId || 
                    Object.entries(openTabs).find(
                        ([_, tab]) => tab.contentTabId === currentTab.id
                    )?.[0];
                
                if (sourceTabId) {
                    setCapturedTab(await getTabById(Number(sourceTabId)));
                }
            }
            
            // Check if current tab has an associated content tab
            if (openTabs[currentTab.id]) {
                setRunningTab(openTabs[currentTab.id].contentTabId);
            }
        })();
    }, []);

    const openContentPage = async () => {
        const currentTab = await getCurrentTab()
        const openTabs: TabMapping = await getTabMappings();
        if (openTabs) {
            const alreadyOpened = openTabs[currentTab?.id!]
            if (alreadyOpened && await doesTabExist(alreadyOpened.contentTabId)) {
                // jump to the already opened tab
                await browser.tabs.update(alreadyOpened.contentTabId, {active: true})
                return
            }
        }
        await browser.runtime.sendMessage({ command: START, openerTabId: currentTab?.id });
    };

    const closeContentPage = async () => {
        const currentTab = await getCurrentTab();
        if (!currentTab?.id) return;
        
        const openTabs: TabMapping = await getTabMappings();
        
        // Find the tab to close (either the current tab or its associated content tab)
        const tabIdToClose = isContentPage 
            ? currentTab.id 
            : openTabs[currentTab.id]?.contentTabId;
            
        if (tabIdToClose) {
            // Remove the content tab
            if (isContentPage) {
                // If we're on the content page, find and remove the source tab mapping
                const sourceTabEntry = Object.entries(openTabs).find(
                    ([_, tab]) => tab.contentTabId === currentTab.id
                );
                if (sourceTabEntry) {
                    delete openTabs[Number(sourceTabEntry[0])];
                }
            } else {
                // If we're on the source tab, remove its mapping
                delete openTabs[currentTab.id];
            }
            
            // Save the updated mappings
            await browser.storage.local.set({ tabMapping: openTabs });
            
            // Close the content tab
            try {
                await browser.tabs.remove(tabIdToClose);
            } catch (error) {
                console.error('Error closing tab:', error);
            }
            
            // Close the popup
            window.close();
        }
    };

    return (
        <div className={css.popupContainer}>
            {showResolutionWarning && (
                <div className={css.warning}>
                    <span>High resolution warning! For best performance, use {MAX_RECOMMENDED_WIDTH}x{MAX_RECOMMENDED_HEIGHT} or lower. Start it ONLY if you are aware of the performance impact.</span>
                </div>
            )}
            <div className={css.status}>
                {isContentPage ? "Running on" : ""}
            </div>
            {isContentPage && capturedTab && (
                <div className={css.tabInfo}>
                    <div className={css.favicon}>
                        {capturedTab.favIconUrl && <img src={capturedTab.favIconUrl} alt="" />}
                    </div>
                    <div className={css.tabTitle} title={capturedTab.title}>
                        {capturedTab.title}
                    </div>
                </div>
            )}
            <div className={css.buttons}>
                {!isContentPage ? (
                    <button className={css.button} onClick={openContentPage}>
                        Jump to ShaderAmp
                    </button>
                ) : (
                    <button className={css.button} onClick={closeContentPage}>
                        Close ShaderAmp
                    </button>
                )}
                <button className={css.button} onClick={openShaderAmpOptions}>
                    Options
                </button>
            </div>
        </div>
    );
}