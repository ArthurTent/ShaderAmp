import browser from "webextension-polyfill";

export const fetchFragmentShader = async (name: string) => {
    const res = await fetch(browser.runtime.getURL(`shaders/${name}`), {
        cache: "no-cache",
    })
    return res.text()
}

export const loadShaderList = async () : Promise<ShaderObject[]> => {
    const res = await fetch(browser.runtime.getURL(`shaders/list.json`), {
        cache: "no-cache",
    })
    const result = await res.json();
    return result as ShaderObject[];
}