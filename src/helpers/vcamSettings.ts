// Virtual camera: map the ShaderAmp extension settings (browser.storage.local)
// to options of the shaderamp web library that renders the camera. Pure, so
// the defaults stay in one place and can be unit-tested. Defaults mirror the
// extension's own (content/index.tsx), not the library's.
import {
    SETTINGS_EQ_GAINS,
    SETTINGS_ENABLE_IAMPLIFIED_TIME,
    SETTINGS_RENDER_SCALE,
    SETTINGS_SHADER_FADE,
    SETTINGS_SHOW_FPS,
    SETTINGS_SOUND_BUFFER,
    SETTINGS_SPEEDDIVIDER,
    SETTINGS_VIDEO_FOLLOW_TIME,
    SETTINGS_VOLUME_AMPLIFIER,
    SETTINGS_WAIT_FOR_AUDIO,
    SETTINGS_WEBCAM,
    STATE_SHOWSHADERCREDITS,
} from '../storage/storageConstants';

/** Storage keys the camera follows live. */
export const VCAM_SETTING_KEYS = [
    SETTINGS_SPEEDDIVIDER,
    SETTINGS_VOLUME_AMPLIFIER,
    SETTINGS_EQ_GAINS,
    SETTINGS_ENABLE_IAMPLIFIED_TIME,
    SETTINGS_WAIT_FOR_AUDIO,
    SETTINGS_SHADER_FADE,
    STATE_SHOWSHADERCREDITS,
    SETTINGS_SHOW_FPS,
    SETTINGS_RENDER_SCALE,
    SETTINGS_SOUND_BUFFER,
    SETTINGS_VIDEO_FOLLOW_TIME,
    SETTINGS_WEBCAM,
] as const;

/** Per-shader custom uniform values (written by the options page / MIDI / scenes). */
export const customUniformsKey = (shaderName: string) => `customUniforms_${shaderName}`;

export const VCAM_DEFAULT_RENDER_SCALE = 0.5;
const EQ_BANDS = 10;

export interface VcamSettings {
    speedDivider: number;
    volumeAmplifier: number;
    eqGains: number[];
    amplifiedTime: boolean;
    waitForAudio: boolean;
    fade: boolean;
    showCredits: boolean;
    showFps: boolean;
    renderScale: number;
    soundBuffer: boolean;
    videoFollowTime: boolean;
    /** settings.useWebcam: feed the camera's webcam into iVideo. */
    useWebcam: boolean;
}

const num = (v: unknown, fallback: number, ok: (n: number) => boolean = Number.isFinite): number => {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) && ok(n) ? n : fallback;
};
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

export function vcamSettingsFromStorage(stored: Record<string, unknown> | null | undefined): VcamSettings {
    const s = stored ?? {};
    const eq = Array.isArray(s[SETTINGS_EQ_GAINS]) ? (s[SETTINGS_EQ_GAINS] as unknown[]) : [];
    return {
        speedDivider: num(s[SETTINGS_SPEEDDIVIDER], 25, (n) => n >= 0),
        volumeAmplifier: num(s[SETTINGS_VOLUME_AMPLIFIER], 1, (n) => n >= 0),
        eqGains: Array.from({ length: EQ_BANDS }, (_, i) => num(eq[i], 0)),
        amplifiedTime: bool(s[SETTINGS_ENABLE_IAMPLIFIED_TIME], true),
        waitForAudio: bool(s[SETTINGS_WAIT_FOR_AUDIO], false),
        fade: bool(s[SETTINGS_SHADER_FADE], false),
        showCredits: bool(s[STATE_SHOWSHADERCREDITS], false),
        showFps: bool(s[SETTINGS_SHOW_FPS], false),
        // The camera output has a fixed size: scales above 1 would only cost GPU.
        renderScale: num(s[SETTINGS_RENDER_SCALE], VCAM_DEFAULT_RENDER_SCALE, (n) => n > 0 && n <= 1),
        soundBuffer: bool(s[SETTINGS_SOUND_BUFFER], true),
        videoFollowTime: bool(s[SETTINGS_VIDEO_FOLLOW_TIME], false),
        useWebcam: bool(s[SETTINGS_WEBCAM], false),
    };
}

/** True when a storage change touches anything the camera follows. */
export function vcamSettingsChanged(changedKeys: string[]): boolean {
    return changedKeys.some((k) => (VCAM_SETTING_KEYS as readonly string[]).includes(k));
}
