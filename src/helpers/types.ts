type TabInfo = {
    sourceTabId: number;
    contentTabId: number;
    stream?: string | null
}

type TabMapping = {
    [key: number]: TabInfo
}

type OptionsTab = {
    tabId: number;
    contentTabId?: number | undefined;
};

type AppState = {
    optionsTab: OptionsTab;
} 

type ShaderObject = {
    shaderName: string;
    metaData?: any;
}

type ShaderCatalog = {
    shaders: ShaderObject[];
    lastModified: Date;
}

