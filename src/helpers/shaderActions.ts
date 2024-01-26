import browser from "webextension-polyfill";

export const fetchFragmentShader = async (name: string) => {
    const res = await fetch(browser.runtime.getURL(`shaders/${name}.frag`), {
        cache: "no-cache",
    })
    return res.text()
}
