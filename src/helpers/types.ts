type TabInfo = {
    contentTabId: number;
    stream?: string | null
}

type TabMapping = {
    [key: number]: TabInfo
}