import React, { useEffect } from "react";
import browser from "webextension-polyfill";
import {doesTabExist, getCurrentTab, getTabById} from "@src/helpers/tabActions";
import {START} from "@src/helpers/constants";
import css from "../styles.module.css";
import { getTabMappings } from "@src/helpers/tabMappingService";
import { openShaderAmpOptions} from "@src/backgroundPage";

export function Popup() {
    const [isContentPage, setIsContentPage] = React.useState(false);
    const [runningTab, setRunningTab] = React.useState<number>();
    const [capturedTab, setCapturedTab] = React.useState<browser.Tabs.Tab | undefined>();
    useEffect(() => {
        (async () => {
            const currentTab = await getCurrentTab()
            const openTabs: TabMapping = await getTabMappings();
            let captureTab = Object.keys(openTabs).find(key => openTabs[Number(key)].contentTabId === currentTab?.id)
            if (captureTab) {
                setIsContentPage(true)
                setCapturedTab(await getTabById(Number(captureTab)))
            }
            if (openTabs && openTabs[currentTab?.id!]) {
                setRunningTab(openTabs[currentTab?.id!].contentTabId)

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
        const currentTab = await getCurrentTab()
        const openTabs: TabMapping = await getTabMappings();
        if (openTabs && isContentPage && capturedTab?.id) {
            delete openTabs[capturedTab?.id]
            await browser.storage.local.set({tabMapping: openTabs})
            await browser.tabs.remove(currentTab?.id!)
        }
    }

    return (
        <div className={css.popupContainer} style={{ backgroundImage: 'url("images/textstudeio_msg_all_your_bass_300x225.png")', backgroundSize: 'cover', width: '100%', height: '100%' }}>
            <div className="flex-auto mx-4 my-4">
                {
                    isContentPage
                        ? <div>
                                <button
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 border border-blue-700 rounded mx-auto flex items-center justify-center"
                                onClick={closeContentPage}>Close</button>
                                <button
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 border border-blue-700 rounded mx-auto flex items-center justify-center"
                                onClick={openShaderAmpOptions}>Open Options Page</button>
                           </div>
                        : runningTab
                            ? <button
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 border border-blue-700 rounded mx-auto flex items-center justify-center"
                                onClick={openContentPage}>Jump to ShaderAmp</button>
                            : <button
                                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 border border-blue-700 rounded mx-auto flex items-center justify-center"
                                onClick={openContentPage}>Open ShaderAmp</button>
                }
            </div>
        </div>
    );
}