import browser from "webextension-polyfill";
import type { ShaderCatalog, ShaderObject } from "./types";

export const getShaderLoadIdentity = (shader: ShaderObject): string => JSON.stringify(
    [shader.shaderName, shader.inlineCode || '', shader.inlineBuffers || {}, shader.metaData],
    (_key, value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
        return Object.keys(value).sort().reduce((sorted, key) => {
            sorted[key] = value[key];
            return sorted;
        }, {} as Record<string, unknown>);
    }
);

export const fetchFragmentShader = async (name: string) => {
    const res = await fetch(browser.runtime.getURL(`shaders/${name}`), {
        cache: "no-cache",
    })
    return res.text()
}

export const loadShaderList = async () : Promise<ShaderCatalog> => {
    const res = await fetch(browser.runtime.getURL(`shaders/list.json`), {
        cache: "no-cache",
    })
    const result = await res.json();
    return result as ShaderCatalog;
}