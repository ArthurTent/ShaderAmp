import { smoothFrameRate } from './frameRate';

describe('smoothFrameRate', () => {
    it('converges to a steady rate', () => {
        let fps = 60;
        for (let i = 0; i < 200; i++) fps = smoothFrameRate(fps, 1 / 30);
        expect(fps).toBeCloseTo(30, 3);
    });

    it('damps a single slow frame', () => {
        const fps = smoothFrameRate(60, 1 / 10); // one 100 ms hitch
        expect(fps).toBeGreaterThan(45);
        expect(fps).toBeLessThan(60);
    });

    it('keeps the previous value for zero or invalid deltas', () => {
        expect(smoothFrameRate(42, 0)).toBe(42);
        expect(smoothFrameRate(42, NaN)).toBe(42);
        expect(smoothFrameRate(0, 0)).toBe(60);
    });
});
