/**
 * ShaderAmp virtual camera — isolated-world content script.
 *
 * Only injected on sites the user enabled in the popup. When the page opens
 * the "ShaderAmp Camera" (see vcamPage.ts), this builds the pipeline:
 *
 *   real webcam ─► <video> ─┬─► 256² ImageBitmap ─► segmenter iframe ─► mask
 *                           │                                            │
 *                           └─► ShaderAmp (shader background + webcam keyed by mask) ─► canvas
 *
 * The canvas is handed to the MAIN world through the shared DOM; it turns it
 * into the MediaStream the page receives. Running here (not in the MAIN world)
 * keeps the page's CSP out of the way and the extension APIs in reach.
 */
import { ShaderAmp } from '../../packages/web/src/ShaderAmp';
import { DEFAULT_SHADER } from '../../packages/web/src/constants';
import { buildVolumeTexture } from '../../packages/web/src/scene/scenePackage';
import type { LiveOptions, ShaderInput, ShaderObject } from '../../packages/web/src/types';
import { STATE_CURRENT_SHADER, STATE_OVERLAY, STATE_SCENE_PLAYING } from '../storage/storageConstants';
import {
    customUniformsKey,
    VCAM_SETTING_KEYS,
    vcamSettingsChanged,
    vcamSettingsFromStorage,
    type VcamSettings,
} from '../helpers/vcamSettings';
import {
    VCAM_AUDIO_ATTR,
    VCAM_CANVAS_ATTR,
    VCAM_CUSTOM_REF_RE,
    VCAM_EVT_AUDIO,
    VCAM_EVT_ERROR,
    VCAM_EVT_READY,
    VCAM_EVT_START,
    VCAM_EVT_STOP,
    VCAM_PORT_MESSAGE,
    VCAM_SEGMENTER_PAGE,
    type VcamMediaItem,
} from './protocol';

(function () {
    const w = window as any;
    if (w.__shaderampVcamContent) return;
    w.__shaderampVcamContent = true;

    const api: typeof chrome = (globalThis as any).browser ?? chrome;
    const LOG = '[ShaderAmp Camera]';
    const SEG_SIZE = 256;
    const SEGMENTER_TIMEOUT_MS = 20000;
    const MEDIA_TIMEOUT_MS = 20000;
    // Same cadence the visualizer tab uses for SCENE_TICK / SCENE_AUDIO_LEVEL.
    const SCENE_SIGNAL_INTERVAL_MS = 100;

    // Diagnostics, visible only in this isolated world (DevTools: pick the
    // "ShaderAmp" context in the console dropdown, then `__shaderampVcamStats`).
    const stats = { sessions: 0, frames: 0, masks: 0, lastError: '', mic: false, renderScale: 0, beats: 0, audioLevel: 0, shader: '', overlay: '', scenePlaying: false, sceneTicks: 0, settings: null as VcamSettings | null };
    w.__shaderampVcamStats = stats;

    const emit = (type: string, payload: object) =>
        document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(payload) }));

    const parse = (e: Event): any => {
        try { return JSON.parse((e as CustomEvent).detail); } catch { return null; }
    };

    // ---- segmenter iframe (one per page, one MessagePort per session) ----

    let segmenterFrame: { iframe: HTMLIFrameElement; loaded: Promise<void> } | null = null;

    const getSegmenterFrame = () => {
        if (segmenterFrame) return segmenterFrame;
        const iframe = document.createElement('iframe');
        iframe.src = api.runtime.getURL(VCAM_SEGMENTER_PAGE);
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        // Not display:none — some browsers throttle or skip work in undisplayed frames.
        iframe.style.cssText = 'position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
        const loaded = new Promise<void>((resolve) => iframe.addEventListener('load', () => resolve(), { once: true }));
        (document.body ?? document.documentElement).appendChild(iframe);
        segmenterFrame = { iframe, loaded };
        return segmenterFrame;
    };

    const releaseSegmenterFrame = () => {
        segmenterFrame?.iframe.remove();
        segmenterFrame = null;
    };

    /** Open a private channel to the segmenter; resolves once the model is loaded. */
    const connectSegmenter = async (): Promise<MessagePort> => {
        const { iframe, loaded } = getSegmenterFrame();
        await loaded;
        const channel = new MessageChannel();
        const port = channel.port1;
        const ready = new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('segmenter did not start')), SEGMENTER_TIMEOUT_MS);
            port.onmessage = (e) => {
                if (e.data?.type === 'ready') { clearTimeout(timer); resolve(); }
                else if (e.data?.type === 'error') { clearTimeout(timer); reject(new Error(e.data.message)); }
            };
        });
        iframe.contentWindow!.postMessage(VCAM_PORT_MESSAGE, new URL(iframe.src).origin, [channel.port2]);
        await ready;
        return port;
    };

    /** Fetch custom media (images, videos, cubemaps, volumes) from the extension's IndexedDB via the helper frame. */
    const requestMedia = async (refs: string[]): Promise<{ items: VcamMediaItem[]; missing: string[] }> => {
        const { iframe, loaded } = getSegmenterFrame();
        await loaded;
        const channel = new MessageChannel();
        try {
            return await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('media request timed out')), MEDIA_TIMEOUT_MS);
                channel.port1.onmessage = (e) => {
                    if (e.data?.type !== 'media') return;
                    clearTimeout(timer);
                    resolve({ items: e.data.items ?? [], missing: e.data.missing ?? [] });
                };
                iframe.contentWindow!.postMessage(VCAM_PORT_MESSAGE, new URL(iframe.src).origin, [channel.port2]);
                channel.port1.postMessage({ type: 'media', refs });
            });
        } finally {
            channel.port1.close();
        }
    };

    // ---- shader selection ----

    // The ShaderAmp UI stores the full shader object; imported, custom and
    // edited shaders carry their code inline and aren't in the bundled catalog.
    const readStoredShader = async (): Promise<unknown> => {
        try {
            return (await api.storage.local.get(STATE_CURRENT_SHADER))?.[STATE_CURRENT_SHADER];
        } catch {
            return undefined;
        }
    };

    const shaderInputOf = (stored: any): ShaderInput => {
        if (stored && typeof stored.inlineCode === 'string' && stored.metaData) return stored as ShaderObject;
        return typeof stored?.shaderName === 'string' ? stored.shaderName : DEFAULT_SHADER;
    };

    /** Register the custom media a shader references that this instance doesn't have yet. */
    const ensureMedia = async (amp: ShaderAmp, stored: unknown) => {
        const refs = Array.from(new Set(JSON.stringify(stored ?? null).match(VCAM_CUSTOM_REF_RE) ?? []))
            .filter(ref => !amp.hasMedia(ref));
        if (!refs.length) return;
        const { items, missing } = await requestMedia(refs);
        for (const item of items) {
            if (item.kind === 'cubemap') {
                amp.registerMedia(item.ref, { kind: 'cubemap', faceUrls: item.faces.map(b => URL.createObjectURL(b)) });
            } else if (item.kind !== 'volume') {
                amp.registerMedia(item.ref, { kind: item.kind, url: URL.createObjectURL(item.blob) });
            } else {
                amp.registerMedia(item.ref, { kind: 'volume', texture: buildVolumeTexture(new Uint8Array(item.data), item) });
            }
        }
        if (missing.length) console.warn(LOG, 'custom media not found', missing);
    };

    // ---- overlay layer ("Hold to overlay", scene overlay nodes, MIDI overlay mappings) ----
    // The scene controller writes the effective overlay to state.overlay as
    // { shader: ShaderObject, opacity, blendMode } (null = none).

    const readStoredOverlay = async (): Promise<unknown> => {
        try {
            return (await api.storage.local.get(STATE_OVERLAY))?.[STATE_OVERLAY] ?? null;
        } catch {
            return null;
        }
    };

    const overlayOf = (raw: any): { shader: ShaderObject; opacity: number; blendMode: 'additive' | 'normal' } | null => {
        if (!raw || typeof raw !== 'object' || !raw.shader || typeof raw.shader.shaderName !== 'string') return null;
        const opacity = Number(raw.opacity);
        return {
            shader: raw.shader as ShaderObject,
            opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1,
            blendMode: raw.blendMode === 'normal' ? 'normal' : 'additive',
        };
    };

    // Placeholder while the real shader's media is fetched (fades in from black).
    const BLANK_SHADER: ShaderInput = {
        name: 'shaderamp-vcam-blank.frag',
        code: 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }',
    };

    // ---- ShaderAmp settings (speed, volume, EQ, fade, credits, fps, scale, video …) ----

    // Same default background video as the extension renderer (AnalyzerMesh).
    const DEFAULT_VIDEO = 'media/SpaceTravel1Min.mp4';

    const readSettings = async (): Promise<VcamSettings> => {
        try {
            return vcamSettingsFromStorage(await api.storage.local.get([...VCAM_SETTING_KEYS]));
        } catch {
            return vcamSettingsFromStorage(undefined);
        }
    };

    /**
     * Library options for the given settings. iVideo is the webcam with
     * settings.useWebcam on; otherwise the extension's default background video
     * (a shader's own `video` still overrides it, as in the extension).
     */
    const settingsToOptions = (s: VcamSettings, webcam: HTMLVideoElement, base: string): LiveOptions => ({
        speedDivider: s.speedDivider,
        volumeAmplifier: s.volumeAmplifier,
        eqGains: s.eqGains,
        amplifiedTime: s.amplifiedTime,
        waitForAudio: s.waitForAudio,
        fade: s.fade,
        showCredits: s.showCredits,
        showFps: s.showFps,
        renderScale: s.renderScale,
        soundBuffer: s.soundBuffer,
        videoFollowTime: s.videoFollowTime,
        videoTexture: s.useWebcam ? webcam : `${base}${DEFAULT_VIDEO}`,
    });

    const readCustomUniforms = async (shaderName: string): Promise<Record<string, any> | null> => {
        try {
            const key = customUniformsKey(shaderName);
            const v = (await api.storage.local.get(key))?.[key];
            return v && typeof v === 'object' ? v : null;
        } catch {
            return null;
        }
    };

    const readScenePlaying = async (): Promise<boolean> => {
        try {
            return (await api.storage.local.get(STATE_SCENE_PLAYING))?.[STATE_SCENE_PLAYING] === true;
        } catch {
            return false;
        }
    };

    /**
     * Feed the background scene controller with this camera's clock, beats and
     * audio level while a scene plays. The controller ignores these while a
     * visualizer tab is ticking, so the camera only drives scenes on its own.
     */
    const driveScenes = (amp: ShaderAmp, cleanups: (() => void)[], isStopped: () => boolean) => {
        let playing = false;
        let lastSent = 0;
        let gateOpenedPending = false;
        const send = (msg: object) => {
            api.runtime.sendMessage({ ...msg, source: 'vcam' }).catch(() => { /* worker asleep / reloading */ });
        };
        const setPlaying = (on: boolean) => {
            playing = on;
            stats.scenePlaying = on;
            lastSent = 0;
        };
        void readScenePlaying().then((on) => { if (!isStopped()) setPlaying(on); });
        const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area === 'local' && STATE_SCENE_PLAYING in changes) setPlaying(changes[STATE_SCENE_PLAYING].newValue === true);
        };
        api.storage.onChanged.addListener(onStorage);
        cleanups.push(() => api.storage.onChanged.removeListener(onStorage));

        cleanups.push(amp.on('clock', (c) => {
            if (c.gateOpened) gateOpenedPending = true;
            if (!playing || isStopped()) return;
            const now = performance.now();
            if (now - lastSent < SCENE_SIGNAL_INTERVAL_MS) return;
            lastSent = now;
            const gateOpened = gateOpenedPending;
            gateOpenedPending = false;
            send({ command: 'SCENE_TICK', time: c.time, iTime: c.iTime, iAmplifiedTime: c.iAmplifiedTime, gateOpened });
            send({ command: 'SCENE_AUDIO_LEVEL', level: c.level });
            stats.sceneTicks++;
        }));
        cleanups.push(amp.on('beat', () => {
            if (playing && !isStopped()) send({ command: 'SCENE_BEAT' });
        }));
    };

    // ---- microphone of the page (see vcamPage.ts) ----

    let mic: MediaStream | null = null;

    // ---- sessions ----

    interface Session { stop(): void; setMic(stream: MediaStream | null): void }
    const sessions = new Map<string, Session>();

    const startSession = async (id: string, width: number, height: number, fps: number) => {
        let stopped = false;
        const cleanups: (() => void)[] = [];
        const stop = () => {
            if (stopped) return;
            stopped = true;
            sessions.delete(id);
            for (const fn of cleanups.reverse()) { try { fn(); } catch { /* ignore */ } }
            if (sessions.size === 0) releaseSegmenterFrame();
        };
        let ampRef: ShaderAmp | null = null;
        sessions.set(id, { stop, setMic: (s) => ampRef?.setSource(s) });
        stats.sessions++;

        try {
            // Isolated world: this is the unpatched getUserMedia, i.e. the real webcam.
            const cam = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps } },
                audio: false,
            });
            cleanups.push(() => cam.getTracks().forEach(t => t.stop()));
            if (stopped) return stop();

            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.srcObject = cam;
            cleanups.push(() => { video.srcObject = null; });
            await video.play();

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            cleanups.push(() => canvas.remove());

            const base = api.runtime.getURL('');
            let settings = await readSettings();
            if (stopped) return stop();
            const options = {
                canvas,
                ...settingsToOptions(settings, video, base),
                adaptiveScale: { min: 0.2 },
                // The meeting page must not hear a shader's sound pass; it still drives iAudioData.
                soundOutput: false,
                source: mic,
                connectToDestination: false,
                assetBaseUrl: base,
                mediaBaseUrl: base,
                size: { width, height },
                frameLoop: 'timer' as const,
                frameRate: fps,
                pauseWhenHidden: false,
                mouse: false,
                keyboard: false as const,
                foreground: { video },
            };
            const amp = await ShaderAmp.create({ ...options, shader: BLANK_SHADER });
            cleanups.push(() => amp.destroy());

            let applyToken = 0;
            const applyShader = async (stored: unknown) => {
                const token = ++applyToken;
                try {
                    await ensureMedia(amp, stored);
                    if (token !== applyToken || stopped) return;
                    resetFallback();
                    await amp.loadShader(shaderInputOf(stored));
                    await applyCustomUniforms();
                    stats.shader = String((stored as any)?.metaData?.shaderName ?? (stored as any)?.shaderName ?? DEFAULT_SHADER);
                    stats.lastError = '';
                } catch (err: any) {
                    stats.lastError = String(err?.message ?? err);
                    console.warn(LOG, 'shader failed', err);
                    if (token === applyToken && !stopped) await amp.loadShader(DEFAULT_SHADER).catch(() => {});
                }
            };
            // GLSL compile errors only show up when rendering: fall back once.
            let fellBack = false;
            cleanups.push(amp.on('error', ({ error, phase }) => {
                if (phase !== 'shader' || stopped) return;
                stats.lastError = String(error.message).slice(0, 300);
                if (fellBack) return;
                fellBack = true;
                console.warn(LOG, 'shader does not compile here; showing the default shader');
                amp.loadShader(DEFAULT_SHADER).catch(() => {});
            }));
            const resetFallback = () => { fellBack = false; };

            // Per-shader custom uniform values set in ShaderAmp (options page, MIDI, scenes).
            const applyCustomUniforms = async () => {
                const name = amp.currentShader?.shaderName;
                if (!name || !amp.currentShader?.metaData?.customUniforms?.length) return;
                const values = await readCustomUniforms(name);
                if (values && !stopped) amp.setCustomUniformValues(name, values);
            };

            let overlayToken = 0;
            const applyOverlay = async (raw: unknown) => {
                const token = ++overlayToken;
                const o = overlayOf(raw);
                try {
                    if (o) await ensureMedia(amp, o.shader);
                    if (token !== overlayToken || stopped) return;
                    amp.setOverlay(o ? o.shader : null, o ? { opacity: o.opacity, blendMode: o.blendMode } : undefined);
                    stats.overlay = o ? String(o.shader.metaData?.shaderName ?? o.shader.shaderName) : '';
                } catch (err) {
                    console.warn(LOG, 'overlay failed', err);
                }
            };

            await applyShader(await readStoredShader());
            await applyOverlay(await readStoredOverlay());
            ampRef = amp;
            cleanups.push(amp.on('beat', () => { stats.beats++; }));
            driveScenes(amp, cleanups, () => stopped);
            stats.settings = settings;
            if (stopped) return stop();
            // The microphone may have changed while the shader was loading.
            if (mic !== options.source) amp.setSource(mic);

            // Follow shader, settings and custom uniform changes made in ShaderAmp while the camera is live.
            const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
                if (area !== 'local' || stopped) return;
                const next = changes[STATE_CURRENT_SHADER]?.newValue;
                if (next) void applyShader(next);
                if (STATE_OVERLAY in changes) void applyOverlay(changes[STATE_OVERLAY].newValue ?? null);
                const keys = Object.keys(changes);
                if (vcamSettingsChanged(keys)) {
                    void readSettings().then((s) => {
                        if (stopped) return;
                        settings = s;
                        amp.setOptions(settingsToOptions(settings, video, base));
                        stats.settings = settings;
                    });
                }
                const name = amp.currentShader?.shaderName;
                const uniforms = name ? changes[customUniformsKey(name)]?.newValue : undefined;
                if (name && uniforms && typeof uniforms === 'object') amp.setCustomUniformValues(name, uniforms);
            };
            api.storage.onChanged.addListener(onStorage);
            cleanups.push(() => api.storage.onChanged.removeListener(onStorage));

            // Hand the canvas over right away; the person appears once masks arrive.
            canvas.setAttribute(VCAM_CANVAS_ATTR, id);
            canvas.style.display = 'none';
            document.documentElement.appendChild(canvas);
            emit(VCAM_EVT_READY, { id });

            runSegmentation(amp, video, fps, cleanups, () => stopped);
        } catch (err: any) {
            stats.lastError = String(err?.message ?? err);
            stop();
            emit(VCAM_EVT_ERROR, { id, message: String(err?.message ?? err) });
        }
    };

    const runSegmentation = async (
        amp: ShaderAmp,
        video: HTMLVideoElement,
        fps: number,
        cleanups: (() => void)[],
        isStopped: () => boolean,
    ) => {
        let port: MessagePort;
        try {
            port = await connectSegmenter();
        } catch (err) {
            // Without a mask only the shader is shown — the room never leaks through.
            stats.lastError = String(err);
            console.warn(LOG, 'person segmentation unavailable; showing background only', err);
            return;
        }
        if (isStopped()) { port.close(); return; }
        cleanups.push(() => port.close());

        let busy = false;
        port.onmessage = (e) => {
            const msg = e.data;
            if (msg?.type === 'mask') {
                stats.masks++;
                amp.setForegroundMask(msg.data, msg.width, msg.height);
            } else if (msg?.type === 'error') {
                stats.lastError = msg.message;
                console.warn(LOG, 'segmentation error', msg.message);
            }
            busy = false;
        };
        const tick = async () => {
            stats.renderScale = amp.renderScale;
            stats.audioLevel = Math.round(amp.audioLevel * 10) / 10;
            if (busy || isStopped() || video.readyState < 2) return;
            busy = true;
            try {
                const bitmap = await createImageBitmap(video, { resizeWidth: SEG_SIZE, resizeHeight: SEG_SIZE, resizeQuality: 'low' });
                if (isStopped()) { bitmap.close(); return; }
                port.postMessage({ type: 'frame', bitmap, ts: performance.now() }, [bitmap]);
                stats.frames++;
            } catch {
                busy = false;
            }
        };
        const timer = setInterval(tick, 1000 / fps);
        cleanups.push(() => clearInterval(timer));
    };

    document.addEventListener(VCAM_EVT_AUDIO, () => {
        const el = document.querySelector<HTMLAudioElement>(`audio[${VCAM_AUDIO_ATTR}]`);
        const stream = el?.srcObject;
        mic = stream instanceof MediaStream ? stream : null;
        stats.mic = !!mic;
        for (const s of sessions.values()) s.setMic(mic);
    });

    document.addEventListener(VCAM_EVT_START, (e) => {
        const d = parse(e);
        if (!d?.id || sessions.has(d.id)) return;
        void startSession(String(d.id), d.width | 0 || 1280, d.height | 0 || 720, d.fps | 0 || 30);
    });

    document.addEventListener(VCAM_EVT_STOP, (e) => {
        const id = parse(e)?.id;
        if (id) sessions.get(String(id))?.stop();
    });

    window.addEventListener('pagehide', () => {
        for (const s of [...sessions.values()]) s.stop();
    });
})();
