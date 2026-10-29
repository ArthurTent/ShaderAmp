import { wrappedDiff, wrapTime } from './videoSync';

describe('wrappedDiff', () => {
    it('plain difference when within half a period', () => {
        expect(wrappedDiff(5, 2, 10)).toBe(3);
        expect(wrappedDiff(2, 5, 10)).toBe(-3);
    });
    it('takes the short way around the loop boundary', () => {
        // target just past loop start, current near loop end → forward +2
        expect(wrappedDiff(1, 9, 10)).toBe(2);
        // …and the reverse
        expect(wrappedDiff(9, 1, 10)).toBe(-2);
    });
    it('handles exact half period (boundary → positive side)', () => {
        expect(wrappedDiff(0, 5, 10)).toBe(5);
    });
    it('falls back to plain difference for invalid periods', () => {
        expect(wrappedDiff(8, 3, NaN)).toBe(5);
        expect(wrappedDiff(8, 3, 0)).toBe(5);
        expect(wrappedDiff(8, 3, -1)).toBe(5);
    });
});

describe('wrapTime', () => {
    it('wraps into [0, period)', () => {
        expect(wrapTime(12, 10)).toBe(2);
        expect(wrapTime(10, 10)).toBe(0);
        expect(wrapTime(0, 10)).toBe(0);
        expect(wrapTime(25.5, 10)).toBe(5.5);
    });
    it('handles negatives', () => {
        expect(wrapTime(-1, 10)).toBe(9);
    });
    it('clamps at 0 for invalid periods', () => {
        expect(wrapTime(7, NaN)).toBe(7);
        expect(wrapTime(-2, NaN)).toBe(0);
    });
});
