/**
 * Offscreen Audio Pipeline for EQ-only mode
 * Runs in the background without any visual output
 * Receives audio from tabCapture, applies EQ, and routes to output
 */

import { logger, initDebugCache } from '@src/helpers/logger';

// EQ frequencies matching the main app
const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_DEFAULT_GAINS: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// Audio pipeline state
let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let mediaStreamNode: MediaStreamAudioSourceNode | null = null;
let gainNode: GainNode | null = null;
let eqFilters: BiquadFilterNode[] = [];
let volumeAmplifier = 1;
let currentEqGains: number[] = [...EQ_DEFAULT_GAINS];
let targetTabId: number | null = null;

// Initialize message listeners from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUDIO_PIPELINE_INIT') {
        const { streamId, tabId, eqGains, volumeAmp } = message.data;
        targetTabId = tabId;
        currentEqGains = eqGains || EQ_DEFAULT_GAINS;
        volumeAmplifier = volumeAmp || 1;
        initAudioPipeline(streamId)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep channel open for async
    }

    if (message.type === 'AUDIO_PIPELINE_UPDATE_EQ') {
        const { eqGains } = message.data;
        updateEQGains(eqGains);
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'AUDIO_PIPELINE_UPDATE_VOLUME') {
        const { volume } = message.data;
        updateVolume(volume);
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'AUDIO_PIPELINE_DISPOSE') {
        disposeAudioPipeline();
        sendResponse({ success: true });
        return true;
    }

    return false;
});

async function initAudioPipeline(streamId: string): Promise<void> {
    // Clean up any existing pipeline
    disposeAudioPipeline();

    try {
        // Get the media stream using the stream ID from tabCapture
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                // @ts-ignore - chrome-specific properties
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId,
                },
            },
            video: false,
        });

        // Create audio context
        audioContext = new AudioContext();

        // Create media stream source
        mediaStreamNode = audioContext.createMediaStreamSource(mediaStream);

        // Create gain node for volume amplification
        gainNode = audioContext.createGain();
        gainNode.gain.value = volumeAmplifier;

        // Build 10-band EQ filter chain
        eqFilters = EQ_FREQUENCIES.map((freq, i) => {
            const filter = audioContext!.createBiquadFilter();
            if (i === 0) {
                filter.type = 'lowshelf';
            } else if (i === EQ_FREQUENCIES.length - 1) {
                filter.type = 'highshelf';
            } else {
                filter.type = 'peaking';
                filter.Q.value = 1.4;
            }
            filter.frequency.value = freq;
            filter.gain.value = currentEqGains[i] ?? 0;
            return filter;
        });

        // Connect the pipeline:
        // mediaStreamNode -> gainNode -> filter[0] -> ... -> filter[9] -> destination
        mediaStreamNode.connect(gainNode);
        eqFilters.reduce<AudioNode>((prev, curr) => {
            prev.connect(curr);
            return curr;
        }, gainNode);
        eqFilters[eqFilters.length - 1].connect(audioContext.destination);

        // Keep the stream alive
        const audioTrack = mediaStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.onended = () => {
                logger.offscreen.log('AudioPipeline', 'Audio track ended, disposing pipeline');
                disposeAudioPipeline();
                // Notify background that audio stopped
                chrome.runtime.sendMessage({
                    type: 'AUDIO_PIPELINE_STOPPED',
                    data: { tabId: targetTabId }
                }).catch(() => {});
            };
        }

        logger.offscreen.log('AudioPipeline', 'Initialized successfully for tab: %d', targetTabId);
    } catch (error) {
        logger.offscreen.error('AudioPipeline', 'Initialization failed: %s', error);
        throw error;
    }
}

function updateEQGains(newGains: number[]): void {
    if (!eqFilters.length) return;

    currentEqGains = newGains;
    eqFilters.forEach((filter, i) => {
        filter.gain.value = newGains[i] ?? 0;
    });
}

function updateVolume(newVolume: number): void {
    volumeAmplifier = newVolume;
    if (gainNode) {
        gainNode.gain.value = newVolume;
    }
}

function disposeAudioPipeline(): void {
    // Disconnect all nodes
    if (eqFilters.length) {
        eqFilters.forEach(filter => {
            try {
                filter.disconnect();
            } catch (_) {}
        });
        eqFilters = [];
    }

    if (gainNode) {
        try {
            gainNode.disconnect();
        } catch (_) {}
        gainNode = null;
    }

    if (mediaStreamNode) {
        try {
            mediaStreamNode.disconnect();
        } catch (_) {}
        mediaStreamNode = null;
    }

    // Stop all tracks in the media stream
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Close the audio context
    if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
    }

    targetTabId = null;
    logger.offscreen.log('AudioPipeline', 'Disposed');
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    disposeAudioPipeline();
});

// Initialize debug cache
initDebugCache();

// Keep the service worker alive by sending periodic keepalive messages
setInterval(() => {
    chrome.runtime.sendMessage({ type: 'AUDIO_PIPELINE_KEEPALIVE' }).catch(() => {});
}, 20000);

logger.offscreen.log('AudioPipeline', 'Offscreen document loaded and ready');

// Signal to background that we're ready to receive commands
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }).catch(() => {});
