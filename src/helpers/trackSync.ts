// Track-position sync data model — pure helpers shared by the media-sync
// content script, the visualizer, and tests.
//
// `sampledAt` is a Date.now() epoch ms stamp taken in the *source* tab. The
// visualizer interpolates on its local performance.now() axis using the
// `receivedAt` stamp it attaches on arrival, so cross-context clock skew does
// not matter (pass receivedAt as `baseMs`).

export type TrackPlatform = 'youtube' | 'soundcloud' | 'spotify' | 'html-media';

export type TrackPositionSample = {
    platform: TrackPlatform;
    position: number;      // seconds
    duration?: number;     // seconds
    playbackRate: number;
    paused: boolean;
    sampledAt: number;     // Date.now() epoch ms when the sample was taken
    precision?: 'exact' | 'coarse'; // 'coarse' = DOM-text poll (whole-second resolution)
};

export const TRACK_SAMPLE_STALE_MS = 3000;

// Smooth-lock tuning: errors above the snap threshold are applied instantly
// (scrubs/track changes); smaller errors are absorbed by rate correction so
// sample jitter never visibly jumps the clock.
export const SYNC_SNAP_EXACT_S = 0.75;
export const SYNC_SNAP_COARSE_S = 1.5;
export const SYNC_DEADBAND_S = 0.02;
export const SYNC_MAX_RATE_ADJ = 0.25;

// Advance `current` toward `target` for one frame: snap on large errors,
// rate-correct on small ones, hold exactly while paused. Never steps
// backwards in the non-snap path.
export function stepSyncedClock(
    current: number,
    target: number,
    dt: number,
    rate: number,
    precision: 'exact' | 'coarse' = 'exact',
    paused = false,
): number {
    if (paused) return target;
    const err = target - current;
    const snap = precision === 'coarse' ? SYNC_SNAP_COARSE_S : SYNC_SNAP_EXACT_S;
    if (Math.abs(err) > snap) return target;
    const adj = Math.abs(err) < SYNC_DEADBAND_S ? 0 : Math.max(-SYNC_MAX_RATE_ADJ, Math.min(SYNC_MAX_RATE_ADJ, err));
    const next = current + dt * (rate || 1) * Math.max(0, 1 + adj);
    return Math.max(current, next);
}

export function detectPlatform(hostname: string): TrackPlatform {
    const h = (hostname || '').toLowerCase();
    if (h === 'youtube.com' || h === 'www.youtube.com' || h === 'm.youtube.com' || h.endsWith('.youtube.com')) return 'youtube';
    if (h === 'soundcloud.com' || h.endsWith('.soundcloud.com')) return 'soundcloud';
    if (h === 'open.spotify.com' || h.endsWith('.spotify.com')) return 'spotify';
    return 'html-media';
}

// Project the sample's position onto `nowMs`, using `baseMs` as the timestamp
// axis on which the sample was taken (sample.sampledAt for Date.now() callers,
// sample.receivedAt for the renderer's performance.now() axis).
export function interpolatePosition(sample: TrackPositionSample, nowMs: number, baseMs: number = sample.sampledAt): number {
    let position = sample.position;
    if (!sample.paused) {
        position += ((nowMs - baseMs) / 1000) * (sample.playbackRate || 1);
    }
    position = Math.max(0, position);
    if (typeof sample.duration === 'number' && isFinite(sample.duration) && sample.duration > 0) {
        position = Math.min(position, sample.duration);
    }
    return position;
}

// Paused samples never go stale (position is stable); playing samples must be
// refreshed within `staleMs` or the source is considered gone.
export function isSampleUsable(sample: TrackPositionSample, nowMs: number, staleMs: number = TRACK_SAMPLE_STALE_MS): boolean {
    if (sample.paused) return true;
    return (nowMs - sample.sampledAt) <= staleMs;
}

// Spotify web player PUTs connect-state responses carrying `player_state`.
// `position_as_of_timestamp` and `timestamp` are epoch ms (string or number).
export function parseSpotifyPlayerState(json: any): Partial<TrackPositionSample> | null {
    const ps = json?.player_state ?? json;
    if (!ps || typeof ps !== 'object') return null;
    const positionMs = Number(ps.position_as_of_timestamp);
    const timestampMs = Number(ps.timestamp);
    if (!isFinite(positionMs) || !isFinite(timestampMs)) return null;
    const paused = !!ps.is_paused;
    const playbackRate = isFinite(Number(ps.playback_speed)) ? Number(ps.playback_speed) : 1;
    const durationMs = Number(ps.duration);
    return {
        platform: 'spotify',
        position: Math.max(0, (positionMs + (paused ? 0 : (Date.now() - timestampMs) * playbackRate)) / 1000),
        duration: isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : undefined,
        playbackRate,
        paused,
        sampledAt: Date.now(),
    };
}

// Chrome Media Session position/playbackState forwarded by the MAIN-world
// script (event-driven, exact — used for Spotify pause/seek).
export function parseMediaSessionState(ms: any): Partial<TrackPositionSample> | null {
    if (!ms || typeof ms !== 'object') return null;
    const position = Number(ms.position);
    if (!isFinite(position)) return null;
    const duration = Number(ms.duration);
    const rate = Number(ms.playbackRate);
    return {
        platform: 'spotify',
        position: Math.max(0, position),
        duration: isFinite(duration) && duration > 0 ? duration : undefined,
        playbackRate: isFinite(rate) && rate > 0 ? rate : 1,
        paused: ms.playbackState !== 'playing',
        sampledAt: Date.now(),
        precision: 'exact',
    };
}

// Parse "m:ss" or "h:mm:ss" clock text into seconds; null on junk.
export function parseClockText(text: string | null | undefined): number | null {
    if (!text) return null;
    const parts = text.trim().split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    const nums = parts.map(p => {
        const n = Number(p.trim());
        return isFinite(n) && n >= 0 && /^\d+$/.test(p.trim()) ? n : NaN;
    });
    if (nums.some(n => !isFinite(n))) return null;
    return parts.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
}
