export const START = "START";
// Popup -> background: open the visualizer in the Chrome side panel
export const START_SIDEPANEL = "START_SIDEPANEL";
// Popup -> background: close an open side-panel session
export const STOP_SIDEPANEL = "STOP_SIDEPANEL";
// Background -> side-panel page (uses `type`, not `command`, like the
// media-sync messages): tells the panel page to close itself
export const SIDEPANEL_CLOSE = "SIDEPANEL_CLOSE";
export const DATA = "DATA";
export const STOP = "STOP";
export const SPACE = "SPACE";
export const PREV_SHADER = "PREV";
export const NEXT_SHADER = "NEXT";
export const RESET_TIME = "RESET_TIME";
export const SET_TIME = "SET_TIME";
// Track-sync message types (use `type`, not `command`, so they don't collide
// with the visualizer's command handler)
export const MEDIA_POSITION = "MEDIA_POSITION";
export const MEDIA_CONTROL = "MEDIA_CONTROL";
export const MEDIA_SYNC_HINT = "MEDIA_SYNC_HINT";
export const INCR_TIME = "INCR_TIME";
export const DECR_TIME = "DECR_TIME";

import type { ShaderObject } from "./types";

export const defaultShader : ShaderObject = {
    shaderName: 'MusicalHeart.frag',
    metaData: {
        author: "",
        shaderSpeed: 0.4,
        shaderName: "",
        modifiedBy: "",
        url: "",
        license: "",
        licenseURL: ""
    } 
}
