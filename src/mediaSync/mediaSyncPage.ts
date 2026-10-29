/**
 * ShaderAmp media sync — page-context (MAIN world) script for open.spotify.com.
 *
 * Wraps window.fetch and XMLHttpRequest to observe Spotify's connect-state /
 * track-playback responses and relays the raw player_state to the isolated
 * content script via window.postMessage. Also captures the page's
 * mediaSession action handlers so the isolated script can drive seek/pause/play.
 *
 * Runs at document_start. Plain DOM only — no extension APIs. Nothing here may
 * throw into the host page.
 */
(function () {
    try {
        if ((window as any).__shaderampMediaSync) return;
        (window as any).__shaderampMediaSync = true;

        const OUT_TAG = 'shaderamp-media-sync-page';
        const IN_TAG = 'shaderamp-media-sync-ext';
        const URL_PATTERN = /(connect-state|track-playback)\/v1\//;

        // Whether the isolated script (and the user setting) wants samples.
        let relayEnabled = false;

        const post = (payload: any) => {
            try {
                window.postMessage({ source: OUT_TAG, ...payload }, window.location.origin);
            } catch (_) { /* ignore */ }
        };

        const relayPlayerState = (json: any) => {
            try {
                const ps = json && (json.player_state ?? json);
                if (ps && typeof ps === 'object' && (ps.position_as_of_timestamp !== undefined || ps.timestamp !== undefined)) {
                    post({ player_state: ps });
                }
            } catch (_) { /* ignore */ }
        };

        // ---- fetch hook -------------------------------------------------
        try {
            const origFetch = window.fetch;
            if (typeof origFetch === 'function') {
                window.fetch = function (...args: any[]) {
                    const result = origFetch.apply(this, args as any);
                    try {
                        const url = typeof args[0] === 'string' ? args[0] : (args[0] && (args[0] as Request).url) || '';
                        if (relayEnabled && URL_PATTERN.test(url)) {
                            Promise.resolve(result).then((res: any) => {
                                res?.clone?.().json?.().then(relayPlayerState).catch(() => {});
                            }).catch(() => {});
                        }
                    } catch (_) { /* never disturb the page */ }
                    return result;
                };
            }
        } catch (_) { /* ignore */ }

        // ---- XHR hook ---------------------------------------------------
        try {
            const origOpen = XMLHttpRequest.prototype.open;
            const origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (this: any, method: string, url: string, ...rest: any[]) {
                try { this.__shaderampUrl = url; } catch (_) { /* ignore */ }
                return origOpen.call(this, method, url, ...(rest as [any, any]));
            };
            XMLHttpRequest.prototype.send = function (this: any, ...args: any[]) {
                try {
                    if (relayEnabled && this.__shaderampUrl && URL_PATTERN.test(this.__shaderampUrl)) {
                        this.addEventListener('load', () => {
                            try {
                                const text = typeof this.responseText === 'string' ? this.responseText
                                    : typeof this.response === 'string' ? this.response : null;
                                if (text) relayPlayerState(JSON.parse(text));
                            } catch (_) { /* ignore */ }
                        });
                    }
                } catch (_) { /* ignore */ }
                return origSend.apply(this, args as any);
            };
        } catch (_) { /* ignore */ }

        // ---- Media Session hooks (event-driven pause/seek/position) -------
        // Spotify drives Chrome's global media controls via setPositionState
        // and the playbackState setter — hook both so pause/seek arrives
        // event-driven instead of depending on connect-state responses.
        let lastPositionState: { position?: number; duration?: number; playbackRate?: number } | null = null;
        let lastPlaybackState: string | null = null;
        let lastPositionAt = 0;

        // A bare playbackState change (pause) may arrive seconds after the
        // last setPositionState: advance the stored position by the elapsed
        // playing time first so the paused sample isn't stale. Call before
        // mutating lastPositionState / lastPlaybackState.
        const advancePosition = () => {
            const now = Date.now();
            if (lastPositionState && typeof lastPositionState.position === 'number' && lastPlaybackState === 'playing' && lastPositionAt > 0) {
                lastPositionState.position += ((now - lastPositionAt) / 1000) * (lastPositionState.playbackRate || 1);
            }
            lastPositionAt = now;
        };

        const postMediaSession = () => {
            try {
                if (!relayEnabled) return;
                post({
                    mediaSession: {
                        ...(lastPositionState || {}),
                        playbackState: lastPlaybackState ?? (navigator as any).mediaSession?.playbackState,
                    },
                });
            } catch (_) { /* ignore */ }
        };

        try {
            const MSP: any = (window as any).MediaSession;
            if (MSP?.prototype) {
                const origSetPos = MSP.prototype.setPositionState;
                if (typeof origSetPos === 'function') {
                    MSP.prototype.setPositionState = function (state: any) {
                        try {
                            advancePosition();
                            lastPositionState = {
                                position: state?.position,
                                duration: state?.duration,
                                playbackRate: state?.playbackRate,
                            };
                            postMediaSession();
                        } catch (_) { /* ignore */ }
                        return origSetPos.call(this, state);
                    };
                }
                const pbDesc = Object.getOwnPropertyDescriptor(MSP.prototype, 'playbackState');
                if (pbDesc) {
                    Object.defineProperty(MSP.prototype, 'playbackState', {
                        configurable: true,
                        enumerable: pbDesc.enumerable,
                        get: function () {
                            return pbDesc.get ? pbDesc.get.call(this) : (this as any).__shaderampPlaybackState || 'none';
                        },
                        set: function (v: any) {
                            try { advancePosition(); lastPlaybackState = v; postMediaSession(); } catch (_) { /* ignore */ }
                            if (pbDesc.set) pbDesc.set.call(this, v); else (this as any).__shaderampPlaybackState = v;
                        },
                    });
                }
            }
        } catch (_) { /* ignore */ }

        // ---- mediaSession handler capture (seek/pause/play control) -----
        const capturedHandlers: Record<string, ((details: any) => void) | null> = {};
        try {
            const ms: any = (navigator as any).mediaSession;
            if (ms && typeof ms.setActionHandler === 'function') {
                const origSet = ms.setActionHandler.bind(ms);
                ms.setActionHandler = (action: string, handler: ((details: any) => void) | null) => {
                    try { capturedHandlers[action] = handler; } catch (_) { /* ignore */ }
                    return origSet(action, handler);
                };
            }
        } catch (_) { /* ignore */ }

        const handleControl = (control: { action?: string; time?: number }) => {
            try {
                const name = control.action === 'seek' ? 'seekto'
                    : control.action === 'pause' ? 'pause'
                    : control.action === 'play' ? 'play' : null;
                const handler = name ? capturedHandlers[name] : null;
                if (handler) {
                    handler({ action: name, seekTime: control.time, fastSeek: false });
                }
            } catch (_) { /* ignore */ }
        };

        // ---- messages from the isolated content script ------------------
        window.addEventListener('message', (event) => {
            try {
                if (event.source !== window) return;
                const data = event.data;
                if (!data || data.source !== IN_TAG) return;
                if (typeof data.enabled === 'boolean') relayEnabled = data.enabled;
                if (data.control) handleControl(data.control);
            } catch (_) { /* ignore */ }
        });
    } catch (_) { /* never throw into the host page */ }
})();
