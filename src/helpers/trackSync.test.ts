import { detectPlatform, interpolatePosition, isSampleUsable, parseSpotifyPlayerState, parseMediaSessionState, parseClockText, stepSyncedClock, TRACK_SAMPLE_STALE_MS, SYNC_MAX_RATE_ADJ } from './trackSync';
import type { TrackPositionSample } from './trackSync';

const sample = (overrides: Partial<TrackPositionSample> = {}): TrackPositionSample => ({
    platform: 'html-media',
    position: 10,
    playbackRate: 1,
    paused: false,
    sampledAt: 1000,
    ...overrides,
});

describe('detectPlatform', () => {
    it('maps known hosts and falls back to html-media', () => {
        expect(detectPlatform('www.youtube.com')).toBe('youtube');
        expect(detectPlatform('m.youtube.com')).toBe('youtube');
        expect(detectPlatform('music.youtube.com')).toBe('youtube');
        expect(detectPlatform('soundcloud.com')).toBe('soundcloud');
        expect(detectPlatform('open.spotify.com')).toBe('spotify');
        expect(detectPlatform('example.com')).toBe('html-media');
        expect(detectPlatform('')).toBe('html-media');
    });
});

describe('interpolatePosition', () => {
    it('advances playing samples by elapsed time on the given base axis', () => {
        expect(interpolatePosition(sample(), 4000)).toBe(13); // 10 + 3s
        expect(interpolatePosition(sample(), 4000, 2000)).toBe(12); // custom baseMs
    });
    it('does not advance paused samples', () => {
        expect(interpolatePosition(sample({ paused: true }), 999999)).toBe(10);
    });
    it('honours playbackRate', () => {
        expect(interpolatePosition(sample({ playbackRate: 1.5 }), 3000)).toBe(13); // 10 + 2*1.5
    });
    it('clamps to duration and never below 0', () => {
        expect(interpolatePosition(sample({ duration: 12 }), 4000)).toBe(12);
        expect(interpolatePosition(sample({ position: 0.2, paused: true }), 0)).toBe(0.2);
    });
});

describe('isSampleUsable', () => {
    it('paused samples never go stale', () => {
        expect(isSampleUsable(sample({ paused: true }), 1e12)).toBe(true);
    });
    it('playing samples are fresh within staleMs and stale after', () => {
        expect(isSampleUsable(sample(), 1000 + TRACK_SAMPLE_STALE_MS)).toBe(true);
        expect(isSampleUsable(sample(), 1000 + TRACK_SAMPLE_STALE_MS + 1)).toBe(false);
    });
});

describe('stepSyncedClock', () => {
    const dt = 1 / 60;

    it('holds exactly at the target while paused', () => {
        expect(stepSyncedClock(5, 10, dt, 1, 'exact', true)).toBe(10);
    });

    it('snaps instantly on a 1.0s error for exact samples', () => {
        expect(stepSyncedClock(10, 11, dt, 1, 'exact')).toBe(11); // err 1.0 > 0.75 snap
    });

    it('does not snap on a 1.0s error for coarse samples', () => {
        const next = stepSyncedClock(10, 11, dt, 1, 'coarse');
        expect(next).not.toBe(11);
        expect(next).toBeCloseTo(10 + dt * (1 + SYNC_MAX_RATE_ADJ), 6); // rate-corrects instead
    });

    it('converges a 0.3s positive error below 0.05s within 3s of 1/60 steps', () => {
        let t = 0;
        let target = 0.3;
        for (let i = 0; i < 180; i++) {
            target += dt; // target advances at rate 1 as the media plays
            t = stepSyncedClock(t, target, dt, 1, 'exact');
        }
        expect(Math.abs(target - t)).toBeLessThan(0.05);
    });

    it('never steps backwards on a small negative error and converges', () => {
        let t = 0.3;
        let target = 0;
        for (let i = 0; i < 180; i++) {
            target += dt;
            const next = stepSyncedClock(t, target, dt, 1, 'exact');
            expect(next).toBeGreaterThanOrEqual(t);
            t = next;
        }
        expect(Math.abs(target - t)).toBeLessThan(0.05);
    });

    it('runs at exactly rate 1 inside the deadband', () => {
        const next = stepSyncedClock(10, 10.01, dt, 1, 'exact'); // |err| < 0.02
        expect(next).toBeCloseTo(10 + dt, 9);
    });
});

describe('parseSpotifyPlayerState', () => {
    it('extracts position/duration/paused from a connect-state payload', () => {
        const now = Date.now();
        const parsed = parseSpotifyPlayerState({
            player_state: {
                position_as_of_timestamp: String(now - 5000), // position was 5s ago? no: position ms
            },
        });
        expect(parsed).toBeNull(); // position_as_of_timestamp is ms position, timestamp missing
    });

    it('computes position = (pos + elapsed * rate) / 1000', () => {
        jest.useFakeTimers().setSystemTime(10_000);
        const parsed = parseSpotifyPlayerState({
            player_state: {
                position_as_of_timestamp: '30000', // 30s
                timestamp: '8000',                 // sampled 2s ago (system time 10s)
                is_paused: false,
                duration: '180000',
                playback_speed: '1',
            },
        });
        expect(parsed).not.toBeNull();
        expect(parsed!.position).toBeCloseTo(32, 5); // 30 + (10000-8000)/1000
        expect(parsed!.duration).toBe(180);
        expect(parsed!.paused).toBe(false);
        expect(parsed!.platform).toBe('spotify');
        expect(parsed!.sampledAt).toBe(10_000);
        jest.useRealTimers();
    });

    it('frozen position when paused and accepts bare player_state object', () => {
        jest.useFakeTimers().setSystemTime(10_000);
        const parsed = parseSpotifyPlayerState({
            position_as_of_timestamp: 30000,
            timestamp: 1000,
            is_paused: true,
        });
        expect(parsed!.position).toBe(30);
        expect(parsed!.paused).toBe(true);
        expect(parsed!.playbackRate).toBe(1);
        jest.useRealTimers();
    });

    it('returns null on garbage', () => {
        expect(parseSpotifyPlayerState(null)).toBeNull();
        expect(parseSpotifyPlayerState({})).toBeNull();
        expect(parseSpotifyPlayerState({ player_state: { foo: 'bar' } })).toBeNull();
        expect(parseSpotifyPlayerState('junk')).toBeNull();
    });
});

describe('parseMediaSessionState', () => {
    it('maps position/duration/playbackState to a sample', () => {
        const parsed = parseMediaSessionState({
            position: 42.5, duration: 200, playbackRate: 1, playbackState: 'playing',
        });
        expect(parsed).not.toBeNull();
        expect(parsed!.position).toBe(42.5);
        expect(parsed!.duration).toBe(200);
        expect(parsed!.paused).toBe(false);
        expect(parsed!.platform).toBe('spotify');
        expect(parsed!.precision).toBe('exact');
    });

    it('treats non-playing playbackState as paused', () => {
        expect(parseMediaSessionState({ position: 10, playbackState: 'paused' })!.paused).toBe(true);
        expect(parseMediaSessionState({ position: 10 })!.paused).toBe(true); // missing state → paused
        expect(parseMediaSessionState({ position: 10, playbackState: 'none' })!.paused).toBe(true);
    });

    it('defaults playbackRate and drops invalid duration', () => {
        const p = parseMediaSessionState({ position: 5, playbackState: 'playing', duration: NaN });
        expect(p!.playbackRate).toBe(1);
        expect(p!.duration).toBeUndefined();
    });

    it('returns null without a numeric position', () => {
        expect(parseMediaSessionState(null)).toBeNull();
        expect(parseMediaSessionState({ playbackState: 'playing' })).toBeNull();
        expect(parseMediaSessionState({ position: 'abc' })).toBeNull();
        expect(parseMediaSessionState('junk')).toBeNull();
    });
});

describe('parseClockText', () => {
    it('parses m:ss and h:mm:ss', () => {
        expect(parseClockText('0:07')).toBe(7);
        expect(parseClockText('12:34')).toBe(754);
        expect(parseClockText('1:02:03')).toBe(3723);
        expect(parseClockText(' 2:05 ')).toBe(125);
    });
    it('returns null on junk', () => {
        expect(parseClockText('')).toBeNull();
        expect(parseClockText(null)).toBeNull();
        expect(parseClockText('12')).toBeNull();
        expect(parseClockText('a:b')).toBeNull();
        expect(parseClockText('1:2:3:4')).toBeNull();
    });
});
