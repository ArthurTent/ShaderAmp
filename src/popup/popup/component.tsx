import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import { doesTabExist, getCurrentTab, getTabById } from "@src/helpers/tabActions";
import { START } from "@src/helpers/constants";
import css from "../styles.module.css";
import { getTabMappings } from "@src/helpers/tabMappingService";
import type { TabMapping } from "@src/helpers/types";
import { openShaderAmpOptions } from "@src/backgroundPage";
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_EQ_MODE_ONLY, SETTINGS_EQ_GAINS, SETTINGS_VOLUME_AMPLIFIER, STATE_EQ_MODE_ACTIVE, STATE_EQ_TARGET_TAB_ID } from "@src/storage/storageConstants";

const MAX_RECOMMENDED_WIDTH = 1280;
const MAX_RECOMMENDED_HEIGHT = 720;

const EQ_FREQUENCIES = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];
const EQ_DEFAULT_GAINS: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export function Popup() {
    const [isContentPage, setIsContentPage] = useState(false);
    const [runningTab, setRunningTab] = useState<number>();
    const [capturedTab, setCapturedTab] = useState<browser.Tabs.Tab | undefined>();
    const [tabMappings, setTabMappings] = useState<TabMapping>({});
    const [showResolutionWarning, setShowResolutionWarning] = useState(false);

    // EQ Mode state
    const [eqModeOnly, setEqModeOnly] = useChromeStorageLocal(SETTINGS_EQ_MODE_ONLY, false);
    const [eqGains, setEqGains] = useChromeStorageLocal<number[]>(SETTINGS_EQ_GAINS, EQ_DEFAULT_GAINS);
    const [volumeAmplifier, setVolumeAmplifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);
    const [eqModeActive, setEqModeActive] = useState(false);
    const [eqTargetTab, setEqTargetTab] = useState<{id?: number, title?: string, favIconUrl?: string} | null>(null);
    const [showEqPanel, setShowEqPanel] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
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

    // Check EQ mode status on load
    useEffect(() => {
        checkEQModeStatus();
    }, []);

    const checkEQModeStatus = async () => {
        try {
            const response = await browser.runtime.sendMessage({ command: 'GET_EQ_MODE_STATUS' });
            if (response?.success) {
                setEqModeActive(response.isActive);
                if (response.targetTabId) {
                    setEqTargetTab({
                        id: response.targetTabId,
                        title: response.targetTabTitle,
                        favIconUrl: response.targetTabFavIconUrl,
                    });
                }
            }
        } catch (error) {
            console.error('Error checking EQ mode status:', error);
        }
    };

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

    // EQ Mode functions
    const startEQMode = async () => {
        const currentTab = await getCurrentTab();
        if (!currentTab?.id) return;

        setIsLoading(true);
        try {
            const response = await browser.runtime.sendMessage({
                command: 'START_EQ_MODE',
                data: { tabId: currentTab.id }
            });
            if (response?.success) {
                setEqModeActive(true);
                setEqTargetTab({
                    id: currentTab.id,
                    title: currentTab.title,
                    favIconUrl: currentTab.favIconUrl,
                });
            }
        } catch (error) {
            console.error('Error starting EQ mode:', error);
            alert('Failed to start EQ mode. Make sure you are on a page with audio.');
        } finally {
            setIsLoading(false);
        }
    };

    const stopEQMode = async () => {
        setIsLoading(true);
        try {
            await browser.runtime.sendMessage({ command: 'STOP_EQ_MODE' });
            setEqModeActive(false);
            setEqTargetTab(null);
        } catch (error) {
            console.error('Error stopping EQ mode:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateEQGain = async (index: number, value: number) => {
        const newGains = [...(eqGains ?? EQ_DEFAULT_GAINS)];
        newGains[index] = value;
        setEqGains(newGains);

        // Debounce the update to background
        if (eqModeActive) {
            await browser.runtime.sendMessage({
                command: 'UPDATE_EQ_GAINS',
                data: { gains: newGains }
            }).catch(() => {});
        }
    };

    const resetEQ = async () => {
        setEqGains([...EQ_DEFAULT_GAINS]);
        if (eqModeActive) {
            await browser.runtime.sendMessage({
                command: 'UPDATE_EQ_GAINS',
                data: { gains: EQ_DEFAULT_GAINS }
            }).catch(() => {});
        }
    };

    const updateVolume = async (newVolume: number) => {
        setVolumeAmplifier(newVolume);
        if (eqModeActive) {
            await browser.runtime.sendMessage({
                command: 'UPDATE_EQ_VOLUME',
                data: { volume: newVolume }
            }).catch(() => {});
        }
    };

    return (
        <div className={css.popupContainer}>
            {showResolutionWarning && !eqModeOnly && (
                <div className={css.warning}>
                    <span>High resolution warning! For best performance, use {MAX_RECOMMENDED_WIDTH}x{MAX_RECOMMENDED_HEIGHT} or lower. Start it ONLY if you are aware of the performance impact.</span>
                </div>
            )}

            {/* Mode Toggle */}
            {!isContentPage && !eqModeActive && (
                <div className={css.modeToggle}>
                    <label className={css.toggleLabel}>
                        <input
                            type="checkbox"
                            checked={eqModeOnly}
                            onChange={(e) => setEqModeOnly(e.target.checked)}
                            className={css.toggleInput}
                        />
                        <span className={css.toggleText}>Audio EQ Only (no visualizer{eqModeOnly ? ' 😢' : ''})</span>
                    </label>
                </div>
            )}

            {/* EQ Mode Status */}
            {eqModeActive && eqTargetTab && (
                <div className={css.eqStatus}>
                    <div className={css.tabInfo}>
                        <div className={css.favicon}>
                            {eqTargetTab.favIconUrl && <img src={eqTargetTab.favIconUrl} alt="" />}
                        </div>
                        <div className={css.tabTitle} title={eqTargetTab.title}>
                            EQ Active: {eqTargetTab.title}
                        </div>
                    </div>
                </div>
            )}

            {/* EQ Panel */}
            {(eqModeOnly || eqModeActive) && (
                <div className={css.eqSection}>
                    <button
                        className={css.eqToggleBtn}
                        onClick={() => setShowEqPanel(!showEqPanel)}
                    >
                        {showEqPanel ? '▼ Hide Equalizer' : '▸ Show Equalizer'}
                    </button>

                    {showEqPanel && (
                        <div className={css.eqPanel}>
                            <div className={css.eqSliders}>
                                {EQ_FREQUENCIES.map((label, i) => (
                                    <div key={label} className={css.eqSliderContainer}>
                                        <input
                                            type="range"
                                            min="-12"
                                            max="12"
                                            step="0.5"
                                            value={(eqGains ?? EQ_DEFAULT_GAINS)[i] ?? 0}
                                            onChange={(e) => updateEQGain(i, parseFloat(e.target.value))}
                                            className={css.eqSlider}
                                            title={`${label}: ${((eqGains ?? EQ_DEFAULT_GAINS)[i] ?? 0) > 0 ? '+' : ''}${(eqGains ?? EQ_DEFAULT_GAINS)[i] ?? 0} dB`}
                                            disabled={isLoading}
                                        />
                                        <span className={css.eqLabel}>{label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className={css.eqActions}>
                                <button
                                    className={css.eqResetBtn}
                                    onClick={resetEQ}
                                    disabled={isLoading}
                                >
                                    Reset EQ
                                </button>
                            </div>
                            <div className={css.volumeSection}>
                                <label className={css.volumeLabel}>Volume Boost</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="5"
                                    step="0.1"
                                    value={volumeAmplifier}
                                    onChange={(e) => updateVolume(parseFloat(e.target.value))}
                                    className={css.volumeSlider}
                                />
                                <span className={css.volumeValue}>{volumeAmplifier.toFixed(1)}x</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Visualizer Status */}
            {!eqModeOnly && !eqModeActive && (
                <>
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
                </>
            )}

            {/* Action Buttons */}
            <div className={css.buttons}>
                {/* Visualizer buttons - only in normal mode */}
                {!eqModeOnly && !eqModeActive && (
                    <>
                        {!isContentPage ? (
                            <button className={css.button} onClick={openContentPage}>
                                Jump to ShaderAmp
                            </button>
                        ) : (
                            <button className={css.button} onClick={closeContentPage}>
                                Close ShaderAmp
                            </button>
                        )}
                    </>
                )}

                {/* EQ Mode buttons */}
                {eqModeOnly && !eqModeActive && (
                    <button
                        className={css.button}
                        onClick={startEQMode}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Starting EQ...' : 'Start Audio EQ'}
                    </button>
                )}

                {eqModeActive && (
                    <button
                        className={`${css.button} ${css.stopButton}`}
                        onClick={stopEQMode}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Stopping...' : 'Stop EQ'}
                    </button>
                )}

                <button className={css.buttonSecondary} onClick={openShaderAmpOptions}>
                    Options
                </button>
            </div>
        </div>
    );
}