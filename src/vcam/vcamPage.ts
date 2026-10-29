/**
 * ShaderAmp virtual camera — page-context (MAIN world) script.
 *
 * Only injected on sites the user enabled in the popup (registered at runtime
 * by the background page). Adds a "ShaderAmp Camera" video input to
 * navigator.mediaDevices. When a page opens it, the isolated content script
 * (vcamContent.ts) builds the pipeline — real webcam, person segmentation,
 * shader background — into a canvas; this script only turns that canvas into
 * the MediaStream the page receives.
 *
 * Runs at document_start. Plain DOM only — no extension APIs. Nothing here may
 * throw into the host page unless the page asked for the virtual camera.
 */
import {
    VCAM_AUDIO_ATTR,
    VCAM_CANVAS_ATTR,
    VCAM_DEVICE_ID,
    VCAM_EVT_AUDIO,
    VCAM_EVT_ERROR,
    VCAM_EVT_READY,
    VCAM_EVT_START,
    VCAM_EVT_STOP,
    VCAM_GROUP_ID,
    VCAM_LABEL,
} from './protocol';

(function () {
    try {
        const w = window as any;
        if (w.__shaderampVcam) return;
        w.__shaderampVcam = true;

        const md = navigator.mediaDevices;
        if (!md || !md.getUserMedia || !md.enumerateDevices) return;

        const WIDTH = 1280;
        const HEIGHT = 720;
        const FPS = 30;
        const START_TIMEOUT_MS = 30000;

        const origGetUserMedia = md.getUserMedia.bind(md);
        const origEnumerateDevices = md.enumerateDevices.bind(md);

        // ---- device list ----

        const fakeDevice = (): MediaDeviceInfo => {
            const info: any = {
                toJSON: () => ({ deviceId: VCAM_DEVICE_ID, groupId: VCAM_GROUP_ID, kind: 'videoinput', label: VCAM_LABEL }),
                getCapabilities: () => ({
                    deviceId: VCAM_DEVICE_ID,
                    groupId: VCAM_GROUP_ID,
                    width: { min: 1, max: WIDTH },
                    height: { min: 1, max: HEIGHT },
                    frameRate: { min: 1, max: FPS },
                }),
            };
            // Make `instanceof MediaDeviceInfo` / InputDeviceInfo checks pass;
            // own properties shadow the prototype getters (which would throw).
            const proto = (w.InputDeviceInfo || w.MediaDeviceInfo)?.prototype;
            if (proto) Object.setPrototypeOf(info, proto);
            Object.defineProperty(info, 'deviceId', { value: VCAM_DEVICE_ID, enumerable: true });
            Object.defineProperty(info, 'groupId', { value: VCAM_GROUP_ID, enumerable: true });
            Object.defineProperty(info, 'kind', { value: 'videoinput', enumerable: true });
            Object.defineProperty(info, 'label', { value: VCAM_LABEL, enumerable: true });
            return info as MediaDeviceInfo;
        };

        md.enumerateDevices = async function () {
            const list = await origEnumerateDevices();
            return [...list, fakeDevice()];
        };

        // ---- constraint helpers ----

        const wantsVcam = (video: MediaStreamConstraints['video']): boolean => {
            if (!video || typeof video !== 'object') return false;
            const id = video.deviceId;
            const matches = (v: unknown): boolean =>
                v === VCAM_DEVICE_ID || (Array.isArray(v) && v.includes(VCAM_DEVICE_ID));
            if (matches(id)) return true;
            if (id && typeof id === 'object' && !Array.isArray(id)) {
                return matches(id.exact) || matches(id.ideal);
            }
            return false;
        };

        // ---- microphone sharing (audio-reactive shaders) ----
        //
        // The shader reacts to the microphone track the *page* opened, so it
        // follows the page's mute (track.enabled = false) and never listens
        // on its own when the page doesn't.

        const micTracks: MediaStreamTrack[] = [];

        const publishMic = () => {
            const live = micTracks.filter(t => t.readyState === 'live');
            micTracks.splice(0, micTracks.length, ...live);
            const track = live[live.length - 1];
            let el: HTMLAudioElement | null = null;
            if (track) {
                el = document.createElement('audio');
                el.muted = true;
                el.setAttribute(VCAM_AUDIO_ATTR, '');
                el.style.display = 'none';
                el.srcObject = new MediaStream([track]);
                document.documentElement.appendChild(el);
            }
            try {
                emit(VCAM_EVT_AUDIO, {});
            } finally {
                el?.remove();
            }
        };

        const trackMic = (stream: MediaStream) => {
            for (const t of stream.getAudioTracks()) {
                if (micTracks.includes(t)) continue;
                micTracks.push(t);
                t.addEventListener('ended', publishMic);
                // Pages often "hang up" by stop(), which doesn't fire 'ended'.
                const origStop = t.stop.bind(t);
                t.stop = () => { origStop(); publishMic(); };
            }
            if (stream.getAudioTracks().length) publishMic();
        };

        // ---- pipeline handshake with the isolated world ----

        const emit = (type: string, payload: object) =>
            document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(payload) }));

        const parse = (e: Event): any => {
            try { return JSON.parse((e as CustomEvent).detail); } catch { return null; }
        };

        const requestCanvas = (id: string): Promise<HTMLCanvasElement> =>
            new Promise((resolve, reject) => {
                const cleanup = () => {
                    clearTimeout(timer);
                    document.removeEventListener(VCAM_EVT_READY, onReady);
                    document.removeEventListener(VCAM_EVT_ERROR, onError);
                };
                const onReady = (e: Event) => {
                    if (parse(e)?.id !== id) return;
                    cleanup();
                    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[${VCAM_CANVAS_ATTR}="${id}"]`);
                    if (!canvas) return reject(new DOMException('ShaderAmp Camera canvas missing', 'NotReadableError'));
                    // Take it out of the page; both worlds keep their reference.
                    canvas.remove();
                    resolve(canvas);
                };
                const onError = (e: Event) => {
                    const d = parse(e);
                    if (d?.id !== id) return;
                    cleanup();
                    reject(new DOMException(`ShaderAmp Camera failed: ${d.message ?? 'unknown error'}`, 'NotReadableError'));
                };
                const timer = setTimeout(() => {
                    cleanup();
                    emit(VCAM_EVT_STOP, { id });
                    reject(new DOMException('ShaderAmp Camera timed out', 'AbortError'));
                }, START_TIMEOUT_MS);
                document.addEventListener(VCAM_EVT_READY, onReady);
                document.addEventListener(VCAM_EVT_ERROR, onError);
                emit(VCAM_EVT_START, { id, width: WIDTH, height: HEIGHT, fps: FPS });
            });

        const disguiseTrack = (track: MediaStreamTrack, onStop: () => void) => {
            const origStop = track.stop.bind(track);
            const origGetSettings = track.getSettings.bind(track);
            let stopped = false;
            const stopOnce = () => { if (!stopped) { stopped = true; onStop(); } };
            Object.defineProperty(track, 'label', { value: VCAM_LABEL });
            track.stop = () => { stopOnce(); origStop(); };
            track.addEventListener('ended', stopOnce);
            track.getSettings = () => ({
                ...origGetSettings(),
                deviceId: VCAM_DEVICE_ID,
                groupId: VCAM_GROUP_ID,
                width: WIDTH,
                height: HEIGHT,
                frameRate: FPS,
            });
            track.getCapabilities = () => ({
                deviceId: VCAM_DEVICE_ID,
                groupId: VCAM_GROUP_ID,
                width: { min: 1, max: WIDTH },
                height: { min: 1, max: HEIGHT },
                frameRate: { min: 1, max: FPS },
            } as MediaTrackCapabilities);
            // Pages may apply resolution constraints; the output size is fixed.
            track.applyConstraints = async () => {};
        };

        let counter = 0;

        md.getUserMedia = async function (constraints?: MediaStreamConstraints) {
            if (!constraints || !wantsVcam(constraints.video)) {
                const stream = await origGetUserMedia(constraints);
                try { if (constraints?.audio) trackMic(stream); } catch { /* never break the page */ }
                return stream;
            }

            const id = `${Date.now().toString(36)}-${++counter}`;
            const canvas = await requestCanvas(id);
            const stream = canvas.captureStream(FPS);
            const [videoTrack] = stream.getVideoTracks();
            disguiseTrack(videoTrack, () => emit(VCAM_EVT_STOP, { id }));

            if (constraints.audio) {
                try {
                    const audio = await origGetUserMedia({ audio: constraints.audio });
                    audio.getAudioTracks().forEach(t => stream.addTrack(t));
                    try { trackMic(audio); } catch { /* ignore */ }
                } catch (e) {
                    videoTrack.stop();
                    throw e;
                }
            }
            return stream;
        };
    } catch (_) { /* never break the host page */ }
})();
