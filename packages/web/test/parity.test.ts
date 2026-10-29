import { describe, expect, it } from 'vitest';
import { AudioGate, AUDIO_GATE_MIN_FRAMES, wrappedDiff, wrapTime } from '../src/render/clock';
import { computeSyncedSampleOffset } from '../src/audio/SoundShaderEngine';
import { isStaticVolumeCode, passNeedsMipmaps, volumeResolution } from '../src/shader/ShaderProgram';
import { FpsMeter, formatCredits, formatFps } from '../src/render/hud';

describe('AudioGate (waitForAudioStart)', () => {
    it('is open when disabled', () => {
        const g = new AudioGate(false);
        expect(g.update(0)).toBe(false);
    });

    it('needs a sustained level for N consecutive frames', () => {
        const g = new AudioGate(true);
        expect(g.update(5)).toBe(true);
        expect(g.update(0)).toBe(true); // reset by a silent frame
        for (let i = 0; i < AUDIO_GATE_MIN_FRAMES - 1; i++) expect(g.update(5)).toBe(true);
        expect(g.update(5)).toBe(false);
        expect(g.update(0)).toBe(false); // latched
    });

    it('re-arms when re-enabled', () => {
        const g = new AudioGate(true);
        g.release();
        expect(g.gated).toBe(false);
        g.setEnabled(false);
        g.setEnabled(true);
        expect(g.gated).toBe(true);
    });
});

describe('video follow helpers', () => {
    it('wraps time and computes circular drift', () => {
        expect(wrapTime(25, 10)).toBe(5);
        expect(wrapTime(-1, 10)).toBe(9);
        expect(wrappedDiff(0.5, 9.5, 10)).toBeCloseTo(1);
        expect(wrappedDiff(9.5, 0.5, 10)).toBeCloseTo(-1);
    });
});

describe('sound pass iTime lock', () => {
    const base = { currentTime: 10, nextPlayTime: 10.1, sampleRate: 1000 };

    it('forces the first sync to iTime + lookahead', () => {
        const off = computeSyncedSampleOffset({ ...base, sample: { iTime: 2, audioTime: 10 }, sampleOffset: 0, force: true });
        expect(off).toBe(2100);
    });

    it('ignores drift below 50 ms and resyncs above', () => {
        const sample = { iTime: 2, audioTime: 10 };
        expect(computeSyncedSampleOffset({ ...base, sample, sampleOffset: 2130, force: false })).toBeNull();
        expect(computeSyncedSampleOffset({ ...base, sample, sampleOffset: 2300, force: false })).toBe(2100);
    });

    it('extrapolates iTime by the audio time elapsed since the sample', () => {
        const off = computeSyncedSampleOffset({ ...base, sample: { iTime: 2, audioTime: 9.5 }, sampleOffset: 0, force: true });
        expect(off).toBe(2600);
    });
});

describe('cubemap / volume pass helpers', () => {
    it('clamps volume resolution like the extension', () => {
        expect(volumeResolution(undefined)).toBe(128);
        expect(volumeResolution(1)).toBe(4);
        expect(volumeResolution(1000)).toBe(256);
        expect(volumeResolution(64.7)).toBe(64);
    });

    it('detects static volume code', () => {
        expect(isStaticVolumeCode('void mainVolume(out vec4 c, in vec3 p){ c = vec4(p,1.); }')).toBe(true);
        expect(isStaticVolumeCode('c = vec4(sin(iTime));')).toBe(false);
        expect(isStaticVolumeCode('c = texture(iChannel0, p);')).toBe(false);
    });

    it('requires mipmaps only when a consumer samples with filter:mipmap', () => {
        const mip = { filter: 'mipmap', wrap: 'clamp', vflip: false };
        expect(passNeedsMipmaps('cubemapA', [{ iChannel1: 'cubemapA' }])).toBe(false);
        expect(passNeedsMipmaps('cubemapA', [{}, { iChannel2: 'cubemapA', iChannel2Sampler: mip }])).toBe(true);
        expect(passNeedsMipmaps('volumeA', [{ iChannel2: 'cubemapA', iChannel2Sampler: mip }])).toBe(false);
    });
});

describe('HUD text', () => {
    it('formats credits like the extension', () => {
        const s = { shaderName: 'X.frag', metaData: { shaderName: 'Nice', author: 'Ann' } } as any;
        expect(formatCredits(s)).toBe('Nice by Ann');
        expect(formatCredits({ shaderName: 'X.frag', metaData: {} } as any)).toBe('X.frag');
        expect(formatCredits(null)).toBeNull();
    });

    it('formats and smooths fps', () => {
        expect(formatFps(29.6)).toBe('30 FPS');
        const m = new FpsMeter();
        expect(m.sample(1 / 30, 0)).toBe(true);
        expect(m.shown).toBe(30);
        expect(m.sample(1 / 60, 100)).toBe(false); // refreshed at most twice a second
    });
});
