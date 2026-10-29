import { describe, expect, it } from 'vitest';
import { averageLevel, bassAverage, BeatDetector, computeRate, stepTimes } from '../src/render/clock';
import { MAX_RATE, MIN_SPEED } from '../src/constants';

describe('averageLevel', () => {
    it('computes the mean', () => {
        expect(averageLevel(new Uint8Array([0, 100, 200]))).toBeCloseTo(100);
        expect(averageLevel(new Uint8Array(0))).toBe(0);
    });
});

describe('computeRate', () => {
    it('computes MIN_SPEED + avg/divider, clamped', () => {
        expect(computeRate(25, 25)).toBeCloseTo(MIN_SPEED + 1);
        expect(computeRate(250, 25)).toBe(MAX_RATE);
    });
    it('clamps to [MIN_RATE, MAX_RATE]', () => {
        expect(computeRate(0, 25)).toBeCloseTo(MIN_SPEED + 0.1 / 25);
        expect(computeRate(255, 0.01)).toBe(MAX_RATE);
    });
    it('treats divider 0 as 0.1', () => {
        expect(computeRate(10, 0)).toBe(MAX_RATE);
    });
});

describe('stepTimes', () => {
    it('advances iTime by delta and iAmplifiedTime by delta*rate*speed', () => {
        const t = stepTimes({ iTime: 1, iAmplifiedTime: 1 }, 0.5, 2, 0.5);
        expect(t.iTime).toBeCloseTo(1.5);
        expect(t.iAmplifiedTime).toBeCloseTo(1.5);
    });
});

describe('BeatDetector', () => {
    const loud = () => {
        const fft = new Uint8Array(512);
        fft.fill(255, 0, 52);
        return fft;
    };
    const quiet = () => new Uint8Array(512);

    it('fires when bass exceeds the threshold', () => {
        const bd = new BeatDetector(200, 250);
        expect(bd.update(loud(), 0)).toBe(true);
        expect(bd.update(quiet(), 100)).toBe(false);
    });

    it('debounces beats within minIntervalMs', () => {
        const bd = new BeatDetector(200, 250);
        expect(bd.update(loud(), 0)).toBe(true);
        expect(bd.update(loud(), 100)).toBe(false);
        expect(bd.update(loud(), 300)).toBe(true);
    });

    it('bassAverage averages the first 10% of bins', () => {
        const fft = new Uint8Array(100);
        fft.fill(100, 0, 10);
        expect(bassAverage(fft)).toBeCloseTo(100);
    });
});
