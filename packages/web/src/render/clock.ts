import { BEAT_BASS_THRESHOLD, MAX_RATE, MIN_RATE, MIN_SPEED } from '../constants';

export function averageLevel(fft: Uint8Array): number {
    if (!fft.length) return 0;
    let sum = 0;
    for (let i = 0; i < fft.length; i++) sum += fft[i];
    return sum / fft.length;
}

export function computeRate(avg: number, speedDivider: number): number {
    const rate = MIN_SPEED + (avg || 0.1) / (speedDivider === 0 ? 0.1 : speedDivider);
    return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

export function stepTimes(
    t: { iTime: number; iAmplifiedTime: number },
    delta: number,
    rate: number,
    shaderSpeed: number,
): { iTime: number; iAmplifiedTime: number } {
    return {
        iTime: t.iTime + delta,
        iAmplifiedTime: t.iAmplifiedTime + delta * rate * shaderSpeed,
    };
}

export function bassAverage(fft: Uint8Array): number {
    const n = Math.max(1, Math.floor(fft.length * 0.1));
    let sum = 0;
    for (let i = 0; i < n; i++) sum += fft[i];
    return sum / n;
}

export class BeatDetector {
    private lastBeatMs = -Infinity;

    constructor(
        private threshold = BEAT_BASS_THRESHOLD,
        private minIntervalMs = 250,
    ) {}

    update(fft: Uint8Array, nowMs: number): boolean {
        if (bassAverage(fft) <= this.threshold) return false;
        if (nowMs - this.lastBeatMs < this.minIntervalMs) return false;
        this.lastBeatMs = nowMs;
        return true;
    }
}

/** Average FFT level (0–255) that counts as "audio started" (extension: AUDIO_GATE_MIN_AVG). */
export const AUDIO_GATE_MIN_AVG = 2.0;
/** Consecutive frames the level must hold before the gate opens (AUDIO_GATE_MIN_FRAMES). */
export const AUDIO_GATE_MIN_FRAMES = 3;

/**
 * Wait-for-audio gate (extension: settings.waitForAudioStart). While closed
 * the shader clock holds at 0; it latches open once the average FFT level has
 * stayed at or above AUDIO_GATE_MIN_AVG for AUDIO_GATE_MIN_FRAMES frames, so a
 * single frame of capture noise doesn't start the clock.
 */
export class AudioGate {
    private frames = 0;
    private open = false;

    constructor(public enabled = false) {}

    /** True while time must be held (gate enabled and no audio detected yet). */
    get gated(): boolean {
        return this.enabled && !this.open;
    }

    /** Feed this frame's average level; returns `gated` after the update. */
    update(avg: number): boolean {
        if (this.enabled && !this.open) {
            this.frames = avg >= AUDIO_GATE_MIN_AVG ? this.frames + 1 : 0;
            if (this.frames >= AUDIO_GATE_MIN_FRAMES) this.open = true;
        }
        return this.gated;
    }

    /** Enable/disable; (re-)enabling re-arms the gate like the extension does. */
    setEnabled(on: boolean): void {
        if (on && !this.enabled) this.rearm();
        this.enabled = on;
    }

    rearm(): void {
        this.open = false;
        this.frames = 0;
    }

    /** Open immediately (explicit user action such as a seek). */
    release(): void {
        this.open = true;
    }
}

/** t mod period in [0, period); invalid periods return max(0, t). (Copied from src/helpers/videoSync.ts.) */
export function wrapTime(t: number, period: number): number {
    if (!isFinite(period) || period <= 0) return Math.max(0, t);
    return ((t % period) + period) % period;
}

/** Signed shortest difference target - current on a circular timeline of `period` seconds. */
export function wrappedDiff(target: number, current: number, period: number): number {
    if (!isFinite(period) || period <= 0) return target - current;
    let d = (target - current) % period;
    if (d > period / 2) d -= period;
    if (d <= -period / 2) d += period;
    return d;
}
