import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioInput, EQ_FREQUENCIES, isCrossOriginUrl } from '../src/audio/AudioInput';

class FakeParam {
    value = 0;
    constructor(v?: number) {
        if (v !== undefined) this.value = v;
    }
}
class FakeNode {
    connections: FakeNode[] = [];
    disconnectCalls: any[] = [];
    constructor(public context: FakeAudioContext) {}
    connect(n: any) {
        this.connections.push(n);
        return n;
    }
    disconnect(n?: any) {
        this.disconnectCalls.push(n);
        this.connections = n === undefined ? [] : this.connections.filter((c) => c !== n);
    }
}
class FakeAnalyser extends FakeNode {
    fftSize = 0;
    data = new Uint8Array(1024).fill(7);
    getByteFrequencyData(target: Uint8Array) {
        target.set(this.data.subarray(0, target.length));
    }
}
class FakeGain extends FakeNode {
    gain = new FakeParam(1);
}
class FakeBiquad extends FakeNode {
    type = 'peaking';
    frequency = new FakeParam(0);
    gain = new FakeParam(0);
    Q = new FakeParam(1);
}
class FakeMediaElementSource extends FakeNode {}
class FakeMediaStreamSource extends FakeNode {}

class FakeAudioContext {
    static created: FakeAudioContext[] = [];
    state = 'running';
    sampleRate = 48000;
    destination = new FakeNode(this as any);
    mediaElementSourceCalls = 0;
    mediaStreamSourceCalls = 0;
    closed = false;
    constructor() {
        FakeAudioContext.created.push(this);
    }
    createGain() {
        return new FakeGain(this as any);
    }
    createAnalyser() {
        return new FakeAnalyser(this as any);
    }
    createBiquadFilter() {
        return new FakeBiquad(this as any);
    }
    createMediaElementSource(_el: HTMLMediaElement) {
        this.mediaElementSourceCalls++;
        return new FakeMediaElementSource(this as any);
    }
    createMediaStreamSource(_s: MediaStream) {
        this.mediaStreamSourceCalls++;
        return new FakeMediaStreamSource(this as any);
    }
    resume() {
        this.state = 'running';
        return Promise.resolve();
    }
    close() {
        this.closed = true;
        return Promise.resolve();
    }
}

class FakeMediaStream {}

const ctxOf = (ai: AudioInput) => ai.context as unknown as FakeAudioContext;

describe('isCrossOriginUrl', () => {
    it('detects cross-origin http(s) urls', () => {
        expect(isCrossOriginUrl('https://other.com/a.mp3', 'https://me.com')).toBe(true);
        expect(isCrossOriginUrl('https://me.com/a.mp3', 'https://me.com')).toBe(false);
        expect(isCrossOriginUrl('/a.mp3', 'https://me.com')).toBe(false);
        expect(isCrossOriginUrl('blob:https://other.com/x', 'https://me.com')).toBe(false);
        expect(isCrossOriginUrl('data:audio/mp3;base64,x', 'https://me.com')).toBe(false);
        expect(isCrossOriginUrl('relative.mp3', 'https://me.com')).toBe(false);
    });
});

describe('AudioInput', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        FakeAudioContext.created = [];
    });

    function setup() {
        vi.stubGlobal('AudioContext', FakeAudioContext);
        vi.stubGlobal('MediaStream', FakeMediaStream);
    }

    it('calls createMediaElementSource only once per element across instances', () => {
        setup();
        const el = document.createElement('audio');
        el.src = 'http://localhost:3000/a.mp3';
        const a1 = new AudioInput({ volumeAmplifier: 1 });
        a1.setSource(el);
        const ctx1 = ctxOf(a1);
        a1.dispose();

        const a2 = new AudioInput({ volumeAmplifier: 1 });
        a2.setSource(el);
        const ctx2 = ctxOf(a2);
        a2.dispose();

        expect(ctx1).toBe(ctx2);
        expect(ctx1.mediaElementSourceCalls).toBe(1);
    });

    it('connects media elements to destination by default', () => {
        setup();
        const el = document.createElement('audio');
        el.src = 'http://localhost:3000/a.mp3';
        const a = new AudioInput({ volumeAmplifier: 1 });
        a.setSource(el);
        const ctx = ctxOf(a);
        const src = (a as any).sourceNode as FakeNode;
        expect(src.connections).toContain(ctx.destination);
        a.dispose();
    });

    it('does not connect MediaStream or node sources to destination by default', () => {
        setup();
        const stream = new FakeMediaStream() as unknown as MediaStream;
        const a = new AudioInput({ volumeAmplifier: 1 });
        a.setSource(stream);
        const ctx = ctxOf(a);
        const src = (a as any).sourceNode as FakeNode;
        expect(src.connections).not.toContain(ctx.destination);
        expect(a.analyser).not.toBeNull();
        a.dispose();
    });

    it('zero-fills frequency data without a source', () => {
        setup();
        const a = new AudioInput({ volumeAmplifier: 1 });
        a.setSource(null);
        const target = new Uint8Array(512).fill(9);
        a.getFrequencyData(target);
        expect(target.every((v) => v === 0)).toBe(true);
        a.dispose();
    });

    it('fills frequency data from the analyser when a source exists', () => {
        setup();
        const a = new AudioInput({ volumeAmplifier: 1 });
        a.setSource(new FakeMediaStream() as unknown as MediaStream);
        const target = new Uint8Array(512);
        a.getFrequencyData(target);
        expect(target[0]).toBe(7);
        a.dispose();
    });

    it('respects connectToDestination override and warns for cross-origin media', () => {
        setup();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const el = document.createElement('audio');
        el.src = 'https://cdn.example.com/a.mp3';
        const a = new AudioInput({ volumeAmplifier: 1, connectToDestination: false });
        a.setSource(el);
        const ctx = ctxOf(a);
        const src = (a as any).sourceNode as FakeNode;
        expect(src.connections).not.toContain(ctx.destination);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('cross-origin'));
        warn.mockRestore();
        a.dispose();
    });

    it('does not sever a host node graph on disconnect', () => {
        setup();
        const ctx = new FakeAudioContext() as unknown as AudioContext;
        const host = new FakeNode(ctx as any) as unknown as AudioNode;
        const other = new FakeNode(ctx as any);
        (host as unknown as FakeNode).connect(other);
        const a = new AudioInput({ volumeAmplifier: 1 });
        a.setSource({ node: host });
        a.setSource(null);
        const h = host as unknown as FakeNode;
        expect(h.connections).toContain(other);
        expect(h.connections.length).toBe(1);
        a.dispose();
    });

    it('keeps a media element connected to destination across setSource(null)', () => {
        setup();
        const el = document.createElement('audio');
        el.src = 'http://localhost:3000/a.mp3';
        const a = new AudioInput({ volumeAmplifier: 1 });
        a.setSource(el);
        const ctx = ctxOf(a);
        const src = (a as any).sourceNode as FakeNode;
        a.setSource(null);
        expect(src.connections).toContain(ctx.destination);
        expect(src.connections.length).toBe(1);
        a.dispose();
    });

    it('closes a previously owned context when adopting a foreign one', () => {
        setup();
        const a = new AudioInput({ volumeAmplifier: 1 });
        a.setSource(new FakeMediaStream() as unknown as MediaStream);
        const owned = ctxOf(a);

        const hostCtx = new FakeAudioContext() as unknown as AudioContext;
        const host = new FakeNode(hostCtx as any) as unknown as AudioNode;
        a.setSource({ node: host });
        expect(a.context).toBe(hostCtx);
        expect(owned.closed).toBe(true);
        a.dispose();
        expect((hostCtx as unknown as FakeAudioContext).closed).toBe(false);
    });

    it('closes an owned context when adopting a cached media element context', () => {
        setup();
        const el = document.createElement('audio');
        el.src = 'http://localhost:3000/a.mp3';
        const first = new AudioInput({ volumeAmplifier: 1 });
        first.setSource(el);
        const shared = ctxOf(first);
        (first as any).ownsContext = false; // pretend the context outlives this instance

        const second = new AudioInput({ volumeAmplifier: 1 });
        second.setSource(new FakeMediaStream() as unknown as MediaStream);
        const owned = ctxOf(second);
        second.setSource(el);
        expect(second.context).toBe(shared);
        expect(owned.closed).toBe(true);
        second.dispose();
        first.dispose();
    });

    it('closes an owned context but not a user-provided one', () => {
        setup();
        const owned = new AudioInput({ volumeAmplifier: 1 });
        owned.setSource(new FakeMediaStream() as unknown as MediaStream);
        const ownedCtx = ctxOf(owned);
        owned.dispose();
        expect(ownedCtx.closed).toBe(true);

        const userCtx = new FakeAudioContext() as unknown as AudioContext;
        const a = new AudioInput({ volumeAmplifier: 1, audioContext: userCtx });
        a.setSource(new FakeMediaStream() as unknown as MediaStream);
        a.dispose();
        expect((userCtx as unknown as FakeAudioContext).closed).toBe(false);
    });

    it('routes gain -> 10-band EQ -> analyser and applies gains live', () => {
        setup();
        const a = new AudioInput({ volumeAmplifier: 2, eqGains: [3, 0, -2] });
        a.setSource(new FakeMediaStream() as unknown as MediaStream);
        const filters = (a as any).eqFilters as FakeBiquad[];
        expect(filters).toHaveLength(EQ_FREQUENCIES.length);
        expect(filters[0].type).toBe('lowshelf');
        expect(filters[9].type).toBe('highshelf');
        expect(filters[1].Q.value).toBe(1.4);
        expect(filters.map((f) => f.frequency.value)).toEqual(EQ_FREQUENCIES);
        expect(filters[0].gain.value).toBe(3);
        expect(filters[2].gain.value).toBe(-2);
        const gain = (a as any).gainNode as FakeGain;
        expect(gain.connections).toContain(filters[0]);
        expect(filters[9].connections).toContain(a.analyser);
        a.setEqGains([0, 6]);
        expect(filters[0].gain.value).toBe(0);
        expect(filters[1].gain.value).toBe(6);
        expect(filters[2].gain.value).toBe(0);
        a.dispose();
    });
});
