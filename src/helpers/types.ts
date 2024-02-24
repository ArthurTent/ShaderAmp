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

type ShaderResourceType = "webcam" | "video" | "texture";

type ShaderResource = { 
    type: ShaderResourceType;
    // ... no default properties
}

class WebcamShaderResource implements ShaderResource {
    type: ShaderResourceType = "webcam";
}

class VideoShaderResource implements ShaderResource {
    type: ShaderResourceType = "video";
}

type ShaderObject = {
    shaderName: string;
    metaData?: any;
}

type ShaderCatalog = {
    shaders: ShaderObject[];
    lastModified: Date;
}

/*
// move to loadFragmentShader func
const loadShader = (shaderObject : ShaderObject) => {
    const resources:ShaderResource[] = shaderObject.metaData?.resources;
    if (resources) {
        resources.forEach(function (resource) {
            switch (resource.type) {
                case "webcam":
                    loadWebCam();
                    putWebcamResourceInUniform();
                case "video":
                case "texture":
            }
        });
    }
}
*/