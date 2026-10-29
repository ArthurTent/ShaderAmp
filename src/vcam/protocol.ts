/**
 * Shared constants for the virtual camera (vcamPage.ts ⇄ vcamContent.ts ⇄ segmenter.ts).
 *
 * MAIN world ⇄ isolated world talk via CustomEvents on `document` whose
 * `detail` is a JSON string (objects don't cross worlds reliably). The rendered
 * canvas is handed over through the shared DOM.
 */
export const VCAM_DEVICE_ID = 'shaderamp-cam';
export const VCAM_GROUP_ID = 'shaderamp';
export const VCAM_LABEL = 'ShaderAmp Camera';

/** MAIN → isolated: { id, width, height, fps } */
export const VCAM_EVT_START = 'shaderamp-vcam:start';
/** MAIN → isolated: { id } */
export const VCAM_EVT_STOP = 'shaderamp-vcam:stop';
/** isolated → MAIN: { id } — canvas is in the DOM as canvas[data-shaderamp-vcam="<id>"] */
export const VCAM_EVT_READY = 'shaderamp-vcam:ready';
/** isolated → MAIN: { id, message } */
export const VCAM_EVT_ERROR = 'shaderamp-vcam:error';

export const VCAM_CANVAS_ATTR = 'data-shaderamp-vcam';

/**
 * MAIN → isolated: the page's current microphone changed. Dispatched while an
 * audio[data-shaderamp-vcam-audio] element carrying it (srcObject) is in the
 * DOM; listeners run synchronously, the element is removed right after.
 * No element → the page has no live microphone.
 */
export const VCAM_EVT_AUDIO = 'shaderamp-vcam:audio';
export const VCAM_AUDIO_ATTR = 'data-shaderamp-vcam-audio';

/** Custom media served by the helper frame from the extension's IndexedDB. */
export type VcamMediaItem =
    | { ref: string; kind: 'image' | 'video'; blob: Blob }
    | { ref: string; kind: 'cubemap'; faces: Blob[] }   // px, nx, py, ny, pz, nz
    | { ref: string; kind: 'volume'; data: ArrayBuffer; width: number; height: number; depth: number; channels: number };

/** Matches custom channel refs (e.g. "custom_images/abc123") anywhere in a shader object. */
export const VCAM_CUSTOM_REF_RE = /custom_(?:images|videos|cubemaps|volumes)\/[A-Za-z0-9_.-]+/g;

/** Handshake posted (with a MessagePort) from vcamContent.ts to the segmenter iframe. */
export const VCAM_PORT_MESSAGE = 'shaderamp-vcam-port';

export const VCAM_SEGMENTER_PAGE = 'vcam-segmenter.html';

/** Registered content-script ids (backgroundPage → chrome.scripting). */
export const VCAM_SCRIPT_ID_MAIN = 'shaderamp-vcam-main';
export const VCAM_SCRIPT_ID_ISOLATED = 'shaderamp-vcam-isolated';
