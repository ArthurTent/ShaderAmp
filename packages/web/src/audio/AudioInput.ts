import type { AudioSourceInput } from '../types';
import { ANALYSER_FFT_SIZE } from '../constants';

const mediaElementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export function isCrossOriginUrl(url: string, pageOrigin: string): boolean {
    if (!/^https?:/i.test(url)) return false;
    try {
        return new URL(url, pageOrigin).origin !== pageOrigin;
    } catch {
        return false;
    }
}

/** Centre frequencies of the 10-band EQ (same bands as the extension's popup EQ). */
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

interface Opts {
    audioContext?: AudioContext;
    volumeAmplifier: number;
    connectToDestination?: boolean;
    /** dB gains per EQ_FREQUENCIES band; analysed signal only. */
    eqGains?: number[];
}

export class AudioInput {
    private ctx: AudioContext | null = null;
    private ownsContext = false;
    private sourceNode: AudioNode | null = null;
    private gainNode: GainNode | null = null;
    private analyserNode: AnalyserNode | null = null;
    private eqFilters: BiquadFilterNode[] = [];
    private eqGains: number[];
    private volumeAmplifier: number;
    private connectToDestination?: boolean;
    private userContext?: AudioContext;
    private resumeCleanup: (() => void) | null = null;
    private connectedToDestination = false;
    private mediaElementSource = false;
    private mediaEl: HTMLMediaElement | null = null;
    private currentSource: AudioSourceInput = null;

    get source(): AudioSourceInput {
        return this.currentSource;
    }

    /** The bound media element, when `source` is an `HTMLMediaElement`. */
    get mediaElement(): HTMLMediaElement | null {
        return this.mediaEl;
    }

    constructor(opts: Opts) {
        this.userContext = opts.audioContext;
        this.volumeAmplifier = opts.volumeAmplifier;
        this.connectToDestination = opts.connectToDestination;
        this.eqGains = [...(opts.eqGains ?? [])];
    }

    private ensureContext(preferred?: AudioContext): AudioContext {
        if (preferred) return preferred;
        if (this.ctx) return this.ctx;
        this.ctx = this.userContext ?? new AudioContext();
        this.ownsContext = !this.userContext;
        return this.ctx;
    }

    setSource(input: AudioSourceInput): void {
        this.currentSource = input;
        this.disconnectSource();
        this.cleanupResumeListeners();

        let connectToDestination = this.connectToDestination;
        let source: AudioNode | null = null;
        let mediaElement: HTMLMediaElement | null = null;

        if (input instanceof HTMLMediaElement) {
            mediaElement = input;
            let node = mediaElementSources.get(input);
            if (node) {
                if (this.userContext && this.userContext !== node.context) {
                    console.warn('[shaderamp] audio element is already bound to a different AudioContext; reusing it.');
                }
                this.adoptContext(node.context as AudioContext);
            } else {
                const ctx = this.ensureContext();
                node = ctx.createMediaElementSource(input);
                mediaElementSources.set(input, node);
            }
            source = node;
            connectToDestination = connectToDestination ?? true;
            this.warnIfCrossOrigin(input);
        } else if (input instanceof MediaStream) {
            const ctx = this.ensureContext();
            source = ctx.createMediaStreamSource(input);
            connectToDestination = connectToDestination ?? false;
        } else if (input && 'node' in input) {
            this.adoptContext(input.node.context as unknown as AudioContext);
            source = input.node;
            connectToDestination = connectToDestination ?? false;
        } else {
            connectToDestination = connectToDestination ?? false;
        }

        this.gainNode = null;
        this.analyserNode = null;
        this.sourceNode = null;
        this.connectedToDestination = false;
        this.mediaElementSource = false;

        if (source && this.ctx) {
            const ctx = this.ctx;
            const gain = ctx.createGain();
            gain.gain.value = this.volumeAmplifier;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = ANALYSER_FFT_SIZE;
            source.connect(gain);
            // gain -> 10-band EQ -> analyser (extension: content/index.tsx)
            const filters = this.createEq(ctx);
            filters.reduce<AudioNode>((prev, f) => (prev.connect(f), f), gain).connect(analyser);
            this.eqFilters = filters;
            if (connectToDestination) source.connect(ctx.destination);
            this.gainNode = gain;
            this.analyserNode = analyser;
            this.sourceNode = source;
            this.connectedToDestination = !!connectToDestination;
            this.mediaElementSource = !!mediaElement;
            this.mediaEl = mediaElement;
        }

        this.maybeAttachResumeListeners(mediaElement);
    }

    private adoptContext(ctx: AudioContext): void {
        if (this.ctx === ctx) return;
        if (this.ownsContext && this.ctx) {
            void this.ctx.close();
        }
        this.ctx = ctx;
        this.ownsContext = false;
    }

    private disconnectSource(): void {
        if (!this.sourceNode) return;
        if (this.gainNode) {
            try {
                this.sourceNode.disconnect(this.gainNode);
            } catch {
                // edge already gone
            }
        }
        // Media-element sources are permanently routed through their context, so the
        // destination edge must stay connected or the element would go silent.
        if (this.connectedToDestination && !this.mediaElementSource && this.ctx) {
            try {
                this.sourceNode.disconnect(this.ctx.destination);
            } catch {
                // edge already gone
            }
        }
        this.sourceNode = null;
        try {
            this.gainNode?.disconnect();
        } catch {
            // already gone
        }
        for (const f of this.eqFilters) {
            try {
                f.disconnect();
            } catch {
                // already gone
            }
        }
        this.eqFilters = [];
        this.gainNode = null;
        this.analyserNode = null;
        this.connectedToDestination = false;
        this.mediaElementSource = false;
        this.mediaEl = null;
    }

    private createEq(ctx: BaseAudioContext): BiquadFilterNode[] {
        return EQ_FREQUENCIES.map((freq, i) => {
            const f = ctx.createBiquadFilter();
            if (i === 0) f.type = 'lowshelf';
            else if (i === EQ_FREQUENCIES.length - 1) f.type = 'highshelf';
            else {
                f.type = 'peaking';
                f.Q.value = 1.4;
            }
            f.frequency.value = freq;
            f.gain.value = this.eqGains[i] ?? 0;
            return f;
        });
    }

    /** Set the EQ band gains in dB (missing bands = 0). Affects the analysed signal only. */
    setEqGains(gains: number[]): void {
        this.eqGains = [...gains];
        this.eqFilters.forEach((f, i) => {
            f.gain.value = this.eqGains[i] ?? 0;
        });
    }

    private warnIfCrossOrigin(el: HTMLMediaElement): void {
        const url = el.currentSrc || el.src;
        if (!url) return;
        if (isCrossOriginUrl(url, location.origin) && el.crossOrigin === null) {
            console.warn(
                `[shaderamp] media element "${url}" is cross-origin without crossorigin="anonymous"; ` +
                'the analyser will output silence. Set crossorigin="anonymous" on the element and serve CORS headers.',
            );
        }
    }

    private maybeAttachResumeListeners(el: HTMLMediaElement | null): void {
        if (!this.ctx || this.ctx.state !== 'suspended') return;
        const resume = () => {
            void this.ctx?.resume();
            this.cleanupResumeListeners();
        };
        const opts: AddEventListenerOptions = { once: true, capture: true };
        const doc = typeof document !== 'undefined' ? document : null;
        el?.addEventListener('play', resume, opts);
        doc?.addEventListener('pointerdown', resume, opts);
        doc?.addEventListener('keydown', resume, opts);
        this.resumeCleanup = () => {
            el?.removeEventListener('play', resume, opts);
            doc?.removeEventListener('pointerdown', resume, opts);
            doc?.removeEventListener('keydown', resume, opts);
        };
    }

    private cleanupResumeListeners(): void {
        this.resumeCleanup?.();
        this.resumeCleanup = null;
    }

    resume(): Promise<void> {
        return this.ctx ? this.ctx.resume() : Promise.resolve();
    }

    getFrequencyData(target: Uint8Array): void {
        if (this.analyserNode) {
            this.analyserNode.getByteFrequencyData(target as Uint8Array<ArrayBuffer>);
        } else {
            target.fill(0);
        }
    }

    getTimeDomainData(target: Uint8Array): void {
        if (this.analyserNode) {
            this.analyserNode.getByteTimeDomainData(target as Uint8Array<ArrayBuffer>);
        } else {
            target.fill(128);
        }
    }

    setVolumeAmplifier(v: number): void {
        this.volumeAmplifier = v;
        if (this.gainNode) this.gainNode.gain.value = v;
    }

    get analyser(): AnalyserNode | null {
        return this.analyserNode;
    }

    get context(): AudioContext | null {
        return this.ctx;
    }

    get sampleRate(): number {
        return this.ctx?.sampleRate ?? 44100;
    }

    dispose(): void {
        this.disconnectSource();
        this.cleanupResumeListeners();
        if (this.ownsContext && this.ctx) {
            void this.ctx.close();
        }
        this.ctx = null;
        this.ownsContext = false;
    }
}
