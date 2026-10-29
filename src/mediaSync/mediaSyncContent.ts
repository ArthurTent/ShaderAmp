/**
 * ShaderAmp media sync — ISOLATED-world content script.
 *
 * Watches the host page's media (video/audio elements, SoundCloud DOM fallback,
 * or Spotify player_state relayed from the MAIN-world page script) and reports
 * TrackPositionSamples to the extension via runtime.sendMessage MEDIA_POSITION.
 * Receives MEDIA_CONTROL (seek/pause/play) messages relayed from the
 * background worker.
 *
 * Active only while SETTINGS_TRACK_SYNC is enabled. Must never throw into the
 * host page — every handler is wrapped.
 */

import browser from "webextension-polyfill";
import { logger, initDebugCache, updateDebugCache } from "@src/helpers/logger";
import { SETTINGS_DEBUG_LOGGING, SETTINGS_TRACK_SYNC } from "@src/storage/storageConstants";
import { MEDIA_POSITION, MEDIA_CONTROL } from "@src/helpers/constants";
import { detectPlatform, parseSpotifyPlayerState, parseMediaSessionState, parseClockText } from "@src/helpers/trackSync";
import type { TrackPositionSample, TrackPlatform } from "@src/helpers/trackSync";

initDebugCache();
chrome.storage.onChanged.addListener((changes) => {
    if (changes[SETTINGS_DEBUG_LOGGING]) {
        updateDebugCache(changes[SETTINGS_DEBUG_LOGGING].newValue);
    }
});

const LOG_TAG = 'ShaderAmp mediaSync';
// MAIN-world scripts share the DOM but not JS globals — use a DOM marker so
// on-demand executeScript re-injection is a no-op.
if (document.documentElement && document.documentElement.dataset.shaderampMediaSync !== '1') {
    document.documentElement.dataset.shaderampMediaSync = '1';
    try {
        main();
    } catch (e) {
        logger.content.error(LOG_TAG, 'init failed: %s', e);
    }
}

function main() {
    const platform: TrackPlatform = detectPlatform(location.hostname);
    let enabled = false;

    // --- emit -------------------------------------------------------------
    const emit = (sample: TrackPositionSample) => {
        if (!enabled) return;
        try {
            browser.runtime.sendMessage({ type: MEDIA_POSITION, sample }).catch(() => {});
        } catch (_) { /* ignore */ }
    };

    // --- HTML media strategy (YouTube, direct files, generic pages) --------
    const MEDIA_EVENTS = ['timeupdate', 'seeking', 'seeked', 'play', 'pause', 'ratechange', 'ended', 'emptied', 'loadedmetadata'];
    let mediaEl: HTMLMediaElement | null = null;
    let mediaObserver: MutationObserver | null = null;
    let rescanTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const emitFrom = (el: HTMLMediaElement) => {
        try {
            emit({
                platform,
                position: el.currentTime || 0,
                duration: isFinite(el.duration) ? el.duration : undefined,
                playbackRate: el.playbackRate || 1,
                paused: el.paused || el.ended,
                sampledAt: Date.now(),
            });
        } catch (_) { /* ignore */ }
    };

    const detachMedia = () => {
        if (mediaEl) {
            for (const ev of MEDIA_EVENTS) {
                try { mediaEl.removeEventListener(ev, onMediaEvent); } catch (_) { /* ignore */ }
            }
            mediaEl = null;
        }
    };

    const onMediaEvent = (e: Event) => {
        try { if (e.target && (e.target as HTMLMediaElement).currentTime !== undefined) emitFrom(e.target as HTMLMediaElement); } catch (_) { /* ignore */ }
    };

    const attachMedia = (el: HTMLMediaElement) => {
        if (el === mediaEl) return;
        detachMedia();
        mediaEl = el;
        for (const ev of MEDIA_EVENTS) {
            try { el.addEventListener(ev, onMediaEvent); } catch (_) { /* ignore */ }
        }
        emitFrom(el);
    };

    const pickMediaElement = (): HTMLMediaElement | null => {
        try {
            if (platform === 'youtube') {
                const yt = document.querySelector('video.html5-main-video') as HTMLMediaElement | null;
                if (yt) return yt;
            }
            const els = Array.from(document.querySelectorAll('video, audio')) as HTMLMediaElement[];
            if (els.length === 0) return null;
            const playing = els.find(el => !el.paused && !el.ended && el.currentTime > 0);
            if (playing) return playing;
            return els.reduce((best, el) => (el.currentTime > best.currentTime ? el : best), els[0]);
        } catch (_) {
            return null;
        }
    };

    const rescan = () => {
        try {
            const el = pickMediaElement();
            if (el && el !== mediaEl) attachMedia(el);
        } catch (_) { /* ignore */ }
    };

    // YouTube mutates the DOM constantly — coalesce observer-driven rescans to
    // at most one per 500 ms.
    let rescanDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const startHtmlMedia = () => {
        rescan();
        rescanTimer = setInterval(rescan, 1000);
        heartbeatTimer = setInterval(() => {
            try { if (mediaEl && !mediaEl.paused && !mediaEl.ended) emitFrom(mediaEl); } catch (_) { /* ignore */ }
        }, 500);
        try {
            mediaObserver = new MutationObserver(() => {
                try {
                    if (rescanDebounceTimer) return;
                    rescanDebounceTimer = setTimeout(() => {
                        rescanDebounceTimer = null;
                        rescan();
                    }, 500);
                } catch (_) { /* ignore */ }
            });
            mediaObserver.observe(document.documentElement, { childList: true, subtree: true });
        } catch (_) { /* ignore */ }
    };

    // --- SoundCloud DOM fallback -------------------------------------------
    let scFallbackTimer: ReturnType<typeof setInterval> | null = null;
    let scLastProgress = 0; // Date.now() of last observed element progress

    const startSoundCloudFallback = () => {
        let lastText = '';
        let lastPaused = false;
        scFallbackTimer = setInterval(() => {
            try {
                if (mediaEl && mediaEl.currentTime > 0) { scLastProgress = Date.now(); return; }
                if (Date.now() - scLastProgress < 2000 && mediaEl) return;
                const posEl = document.querySelector('.playbackTimeline__timePassed [aria-hidden="true"]');
                const text = posEl?.textContent || '';
                const pos = parseClockText(text);
                if (pos === null) return;
                const playBtn = document.querySelector('.playControls__play');
                const paused = !(playBtn && playBtn.classList.contains('playing'));
                // Whole-second resolution: emit only on change so sampledAt
                // aligns with the displayed tick edge.
                if (text === lastText && paused === lastPaused) return;
                lastText = text;
                lastPaused = paused;
                emit({
                    platform: 'soundcloud',
                    position: pos,
                    playbackRate: 1,
                    paused,
                    sampledAt: Date.now(),
                    precision: 'coarse',
                });
            } catch (_) { /* ignore */ }
        }, 250);
    };

    // --- Spotify strategy ----------------------------------------------------
    let lastApiSampleAt = 0;
    let spotifyFallbackTimer: ReturnType<typeof setInterval> | null = null;
    let spotifyStartAt = 0;

    const onWindowMessage = (event: MessageEvent) => {
        try {
            if (event.source !== window) return;
            const data = event.data;
            if (!data || data.source !== 'shaderamp-media-sync-page') return;
            // Event-driven Media Session updates (pause/seek/position) are the
            // primary path; connect-state responses are secondary.
            const parsed = data.mediaSession ? parseMediaSessionState(data.mediaSession)
                : data.player_state ? parseSpotifyPlayerState(data.player_state) : null;
            if (parsed && parsed.position !== undefined) {
                lastApiSampleAt = Date.now();
                emit({
                    platform: 'spotify',
                    position: parsed.position,
                    duration: parsed.duration,
                    playbackRate: parsed.playbackRate ?? 1,
                    paused: !!parsed.paused,
                    sampledAt: Date.now(),
                    precision: parsed.precision ?? 'exact',
                });
            }
        } catch (_) { /* ignore */ }
    };

    const startSpotify = () => {
        window.addEventListener('message', onWindowMessage);
        spotifyStartAt = Date.now();
        // Last-resort DOM poll once the API path has been silent for a while
        let lastText = '';
        let lastPaused = false;
        spotifyFallbackTimer = setInterval(() => {
            try {
                if (Date.now() - spotifyStartAt < 1500) return;
                if (Date.now() - lastApiSampleAt < 1500 && lastApiSampleAt > 0) return;
                const posEl = document.querySelector('[data-testid="playback-position"]');
                const text = posEl?.textContent || '';
                const pos = parseClockText(text);
                if (pos === null) return;
                const btn = document.querySelector('[data-testid="control-button-playpause"]');
                const paused = (btn?.getAttribute('aria-label') || '').toLowerCase().includes('play');
                // Whole-second resolution: emit only on change so sampledAt
                // aligns with the displayed tick edge.
                if (text === lastText && paused === lastPaused) return;
                lastText = text;
                lastPaused = paused;
                emit({
                    platform: 'spotify',
                    position: pos,
                    playbackRate: 1,
                    paused,
                    sampledAt: Date.now(),
                    precision: 'coarse',
                });
            } catch (_) { /* ignore */ }
        }, 250);
    };

    // --- MEDIA_CONTROL -------------------------------------------------------
    const postToPage = (payload: any) => {
        try { window.postMessage({ source: 'shaderamp-media-sync-ext', ...payload }, window.location.origin); } catch (_) { /* ignore */ }
    };

    const handleControl = (msg: any) => {
        try {
            const action = msg?.action;
            const time = typeof msg?.time === 'number' && isFinite(msg.time) ? msg.time : undefined;
            if (!enabled) return;
            if (platform === 'spotify') {
                postToPage({ control: { action, time } });
                return;
            }
            const el = mediaEl || pickMediaElement();
            if (!el) return;
            if (action === 'seek' && time !== undefined) el.currentTime = time;
            else if (action === 'pause') el.pause();
            else if (action === 'play') el.play().catch(() => {});
            emitFrom(el);
        } catch (_) { /* ignore */ }
    };

    browser.runtime.onMessage.addListener((msg: any) => {
        try { if (msg?.type === MEDIA_CONTROL) handleControl(msg); } catch (_) { /* ignore */ }
    });

    // --- strategy lifecycle --------------------------------------------------
    // Nothing runs while the setting is off: no intervals, no observers, no
    // page listeners. The storage + MEDIA_CONTROL listeners stay registered
    // (cheap) and handleControl no-ops while disabled.
    let strategiesRunning = false;

    const startStrategies = () => {
        if (strategiesRunning) return;
        strategiesRunning = true;
        startHtmlMedia();
        if (platform === 'soundcloud') startSoundCloudFallback();
        if (platform === 'spotify') startSpotify();
    };

    const stopStrategies = () => {
        if (!strategiesRunning) return;
        strategiesRunning = false;
        if (rescanTimer) { clearInterval(rescanTimer); rescanTimer = null; }
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        if (rescanDebounceTimer) { clearTimeout(rescanDebounceTimer); rescanDebounceTimer = null; }
        if (mediaObserver) { try { mediaObserver.disconnect(); } catch (_) { /* ignore */ } mediaObserver = null; }
        if (scFallbackTimer) { clearInterval(scFallbackTimer); scFallbackTimer = null; }
        if (spotifyFallbackTimer) { clearInterval(spotifyFallbackTimer); spotifyFallbackTimer = null; }
        try { window.removeEventListener('message', onWindowMessage); } catch (_) { /* ignore */ }
        detachMedia();
        scLastProgress = 0;
        lastApiSampleAt = 0;
        spotifyStartAt = 0;
    };

    // --- enable / disable ----------------------------------------------------
    const setEnabled = (value: boolean) => {
        enabled = !!value;
        postToPage({ enabled });
        if (enabled) startStrategies(); else stopStrategies();
    };

    try {
        browser.storage.local.get(SETTINGS_TRACK_SYNC).then(r => setEnabled(!!r[SETTINGS_TRACK_SYNC])).catch(() => {});
        browser.storage.onChanged.addListener((changes: any, area: string) => {
            try {
                if (area !== 'local') return;
                if (changes[SETTINGS_TRACK_SYNC]) setEnabled(!!changes[SETTINGS_TRACK_SYNC].newValue);
            } catch (_) { /* ignore */ }
        });
    } catch (_) { /* ignore */ }

    // Strategies start only once the setting is on (see setEnabled).
    logger.content.log(LOG_TAG, 'watching %s on %s (enabled: %s)', platform, location.hostname, enabled);
}
