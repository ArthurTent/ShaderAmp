/**
 * ShaderAmp virtual camera — helper frame (runs in dist/vcam-segmenter.html).
 *
 * The page is embedded as a hidden iframe by vcamContent.ts. It lives on the
 * extension origin, so
 *  - MediaPipe's WASM runs under the extension CSP no matter how strict the
 *    host page's CSP is (person segmentation), and
 *  - it can read the extension's IndexedDB, where custom images / videos /
 *    cubemaps / volumes used by imported shaders are stored.
 *
 * Protocol (private MessagePort per caller):
 *   in:  { type: 'frame', bitmap: ImageBitmap, ts: number }   (bitmap transferred)
 *   out: { type: 'ready' } | { type: 'error', message }
 *        { type: 'mask', data: Uint8Array, width, height }   (buffer transferred)
 *   in:  { type: 'media', refs: string[] }
 *   out: { type: 'media', items: VcamMediaItem[], missing: string[] }
 */
import { ImageSegmenter } from '@mediapipe/tasks-vision';
import { getCubemapFacesDB, getImageBlobDB, getVideoBlobDB, getVolumeDB } from '../storage/shaderDB';
import { VCAM_PORT_MESSAGE, type VcamMediaItem } from './protocol';

const runtime: typeof chrome.runtime = (globalThis as any).browser?.runtime ?? chrome.runtime;
const base = runtime.getURL('mediapipe/');

// Temporal smoothing: weight of the newest mask. Lower = steadier edges, more lag.
const SMOOTHING = 0.6;

const createSegmenter = async (delegate: 'GPU' | 'CPU') =>
    ImageSegmenter.createFromOptions(
        { wasmLoaderPath: base + 'vision_wasm_internal.js', wasmBinaryPath: base + 'vision_wasm_internal.wasm' },
        {
            baseOptions: { modelAssetPath: base + 'selfie_segmenter.tflite', delegate },
            runningMode: 'VIDEO',
            outputCategoryMask: false,
            outputConfidenceMasks: true,
        },
    );

let segmenterPromise: Promise<ImageSegmenter> | null = null;
const getSegmenter = () => {
    segmenterPromise ??= createSegmenter('GPU')
        .then(s => { stats.delegate = 'GPU'; return s; })
        .catch((err) => {
            console.warn('[ShaderAmp Camera] GPU segmentation unavailable, using CPU', err);
            return createSegmenter('CPU').then(s => { stats.delegate = 'CPU'; return s; });
        });
    return segmenterPromise;
};

// VIDEO mode requires strictly increasing timestamps across *all* callers —
// several sessions (e.g. a preview and the call) can share this segmenter.
let lastTs = 0;

// Diagnostics (DevTools: inspect this frame, then `__shaderampSegStats`).
const stats = { ports: 0, frames: 0, masks: 0, delegate: '', lastError: '' };
(window as any).__shaderampSegStats = stats;

const CUBEMAP_FACE_ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const;

const loadMedia = async (ref: string): Promise<VcamMediaItem | null> => {
    const [prefix, id] = [ref.slice(0, ref.indexOf('/') + 1), ref.slice(ref.indexOf('/') + 1)];
    if (!id) return null;
    switch (prefix) {
        case 'custom_images/': {
            const blob = await getImageBlobDB(id);
            return blob ? { ref, kind: 'image', blob } : null;
        }
        case 'custom_videos/': {
            const blob = await getVideoBlobDB(id);
            return blob ? { ref, kind: 'video', blob } : null;
        }
        case 'custom_cubemaps/': {
            const faces = await getCubemapFacesDB(id);
            if (!faces) return null;
            const ordered = CUBEMAP_FACE_ORDER.map(name => faces.find(f => f.name === name)?.blob);
            return ordered.every(Boolean) ? { ref, kind: 'cubemap', faces: ordered as Blob[] } : null;
        }
        case 'custom_volumes/': {
            const rec = await getVolumeDB(id);
            if (!rec?.width || !rec.height || !rec.depth || !rec.channels) return null;
            const data = await rec.blob.arrayBuffer();
            return { ref, kind: 'volume', data, width: rec.width, height: rec.height, depth: rec.depth, channels: rec.channels };
        }
        default:
            return null;
    }
};

const answerMedia = async (port: MessagePort, refs: unknown) => {
    const list = Array.isArray(refs) ? refs.filter((r): r is string => typeof r === 'string') : [];
    const items: VcamMediaItem[] = [];
    const missing: string[] = [];
    for (const ref of list) {
        try {
            const item = await loadMedia(ref);
            if (item) items.push(item); else missing.push(ref);
        } catch {
            missing.push(ref);
        }
    }
    port.postMessage({ type: 'media', items, missing });
};

const attach = (port: MessagePort) => {
    let smoothed: Float32Array | null = null;
    stats.ports++;

    getSegmenter().then(
        () => port.postMessage({ type: 'ready' }),
        (err) => port.postMessage({ type: 'error', message: String(err?.message ?? err) }),
    );

    port.onmessage = async (e: MessageEvent) => {
        const msg = e.data;
        if (msg?.type === 'media') return void answerMedia(port, msg.refs);
        if (msg?.type !== 'frame') return;
        const bitmap: ImageBitmap = msg.bitmap;
        stats.frames++;
        try {
            const segmenter = await getSegmenter();
            const ts = Math.max(lastTs + 1, Math.round(msg.ts));
            lastTs = ts;
            let out: { data: Uint8Array; width: number; height: number } | null = null;
            segmenter.segmentForVideo(bitmap, ts, (result) => {
                const mask = result.confidenceMasks?.[0];
                if (!mask) return;
                const src = mask.getAsFloat32Array();
                if (!smoothed || smoothed.length !== src.length) smoothed = Float32Array.from(src);
                const data = new Uint8Array(src.length);
                for (let i = 0; i < src.length; i++) {
                    const v = smoothed[i] + (src[i] - smoothed[i]) * SMOOTHING;
                    smoothed[i] = v;
                    data[i] = v * 255;
                }
                out = { data, width: mask.width, height: mask.height };
            });
            if (out) {
                const { data, width, height } = out as { data: Uint8Array; width: number; height: number };
                stats.masks++;
                port.postMessage({ type: 'mask', data, width, height }, [data.buffer]);
            } else {
                port.postMessage({ type: 'skip' });
            }
        } catch (err: any) {
            stats.lastError = String(err?.message ?? err);
            port.postMessage({ type: 'error', message: String(err?.message ?? err) });
        } finally {
            bitmap.close();
        }
    };
};

// Only the embedding content script knows the port handshake; anything else is ignored.
window.addEventListener('message', (e) => {
    if (e.source !== window.parent || e.data !== VCAM_PORT_MESSAGE || !e.ports[0]) return;
    attach(e.ports[0]);
});
