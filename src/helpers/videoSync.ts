// "Video inputs follow iTime" helpers — pure, unit-tested.
//
// Videos loop, so drift between the shader clock and the element's
// currentTime is measured modulo the media duration.

// Signed shortest difference (target - current) on a circular timeline of
// `period` seconds, in (-period/2, period/2]. For invalid periods falls back
// to the plain difference.
export function wrappedDiff(target: number, current: number, period: number): number {
    if (!isFinite(period) || period <= 0) return target - current;
    let d = (target - current) % period;
    if (d > period / 2) d -= period;
    if (d <= -period / 2) d += period;
    return d;
}

// t mod period, always in [0, period) — handles negatives. For invalid
// periods returns t clamped at 0.
export function wrapTime(t: number, period: number): number {
    if (!isFinite(period) || period <= 0) return Math.max(0, t);
    return ((t % period) + period) % period;
}
