import React, { useState, useCallback } from 'react';
import {createRoot} from "react-dom/client";
import OptionsComponent from './components/OptionsContent';

import '@src/css/app.css';
import OptionsSidebar from './components/OptionsSidebar';
import WebAudioSidebar from './components/WebAudioSidebar';
import AboutModal from './components/AboutModal';
import ThirdPartyLicensesModal from './components/ThirdPartyLicensesModal';
import DebugLogModal from './components/DebugLogModal';
import ShadertoyAssetConfirmModal from './components/ShadertoyAssetConfirmModal';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_UI_THEME } from '@src/storage/storageConstants';

const App: React.FC = () => {
    const [showAbout, setShowAbout] = useState(false);
    const [showLicenses, setShowLicenses] = useState(false);
    const [showDebugLogs, setShowDebugLogs] = useState(false);
    const [showAssetConfirmModal, setShowAssetConfirmModal] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [uiTheme, setUiTheme] = useChromeStorageLocal<'classic' | 'audio'>(SETTINGS_UI_THEME, 'classic');
    
    // Callback refs for communicating with OptionsSidebar
    const assetConfirmCallbackRef = React.useRef<((dontAskAgain: boolean) => void) | null>(null);
    const assetCancelCallbackRef = React.useRef<(() => void) | null>(null);

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => !prev);
    }, []);

    const toggleTheme = useCallback(() => {
        setUiTheme((prev: 'classic' | 'audio') => prev === 'classic' ? 'audio' : 'classic');
    }, [setUiTheme]);

    return (
        <div className={`dark flex h-screen scrollbar-thumb-gray-500 scrollbar-track-gray-700 scrollbar-none${uiTheme === 'audio' ? ' green-theme' : ''}`}>
            <nav className={`${sidebarCollapsed ? 'w-16' : 'w-[30%]'} ${uiTheme === 'audio' ? 'bg-[#0d0d1a]' : 'bg-white dark:bg-indigo-950'} sticky top-0 h-screen transition-all duration-300`}>
                <div className="h-full overflow-y-auto scrollbar-thin">
                {uiTheme === 'audio' ? (
                    <WebAudioSidebar
                        onAboutClick={() => setShowAbout(true)}
                        onOpenDebugLogs={() => setShowDebugLogs(true)}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={toggleSidebar}
                        uiTheme={uiTheme}
                        onToggleTheme={toggleTheme}
                        onOpenAssetConfirmModal={(onConfirm, onCancel) => {
                            assetConfirmCallbackRef.current = onConfirm;
                            assetCancelCallbackRef.current = onCancel;
                            setShowAssetConfirmModal(true);
                        }}
                    />
                ) : (
                    <OptionsSidebar
                        onAboutClick={() => setShowAbout(true)}
                        onOpenDebugLogs={() => setShowDebugLogs(true)}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={toggleSidebar}
                        uiTheme={uiTheme}
                        onToggleTheme={toggleTheme}
                        onOpenAssetConfirmModal={(onConfirm, onCancel) => {
                            assetConfirmCallbackRef.current = onConfirm;
                            assetCancelCallbackRef.current = onCancel;
                            setShowAssetConfirmModal(true);
                        }}
                    />
                )}
                </div>
            </nav>

            <main className={`${sidebarCollapsed ? 'w-[calc(100%-4rem)]' : 'w-[70%]'} overflow-y-scroll scrollbar-thin bg-white dark:bg-gray-900 min-h-screen transition-all duration-300`}>
                <OptionsComponent/>
            </main>

            <AboutModal 
                isOpen={showAbout} 
                onClose={() => setShowAbout(false)} 
                onOpenLicenses={() => setShowLicenses(true)}
            />
            <ThirdPartyLicensesModal 
                isOpen={showLicenses} 
                onClose={() => setShowLicenses(false)} 
            />
            <DebugLogModal 
                isOpen={showDebugLogs} 
                onClose={() => setShowDebugLogs(false)} 
            />
            <ShadertoyAssetConfirmModal 
                isOpen={showAssetConfirmModal}
                onConfirm={(dontAskAgain) => {
                    setShowAssetConfirmModal(false);
                    assetConfirmCallbackRef.current?.(dontAskAgain);
                    assetConfirmCallbackRef.current = null;
                    assetCancelCallbackRef.current = null;
                }}
                onCancel={() => {
                    setShowAssetConfirmModal(false);
                    assetCancelCallbackRef.current?.();
                    assetConfirmCallbackRef.current = null;
                    assetCancelCallbackRef.current = null;
                }}
            />
        </div>
    );
};

const container = document.getElementById('options-root');
const root = createRoot(container!);
root.render(
    <App />
);
