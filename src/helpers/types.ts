type TabInfo = {
    contentTabId: number;
    stream?: string | null
}

type TabMapping = {
    [key: number]: TabInfo
}

type OptionsTab = {
    tabId: number;
    contentTabId?: number | undefined;
    contentStreamId?: string | undefined;
};

type AppState = {
    optionsTab: OptionsTab;
} 