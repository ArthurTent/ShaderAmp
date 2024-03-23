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

type ShaderMetaData = {
    author: string;
    shaderName: string;
    shaderSpeed: number;
    
    iChannel0?: string;
    iChannel1?: string;
    video?: string;
}

type ShaderObject = {
    shaderName: string;
    metaData: ShaderMetaData;
}

type ShaderCatalog = {
    shaders: ShaderObject[];
    lastModified: Date;
}

type ShaderOption = {
    isHidden: boolean;
}

type ShaderOptions = { [id: string] : ShaderOption; }