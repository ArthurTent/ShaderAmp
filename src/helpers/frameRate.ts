/**
 * Smoothed frame rate for iFrameRate. Shadertoy reports an averaged rate rather than
 * 1/delta of the last frame, which jitters wildly with frame pacing.
 * Exponential moving average with a time constant of `tau` seconds.
 */
export function smoothFrameRate(previous: number, delta: number, tau = 0.5): number {
    if (!(delta > 0) || !isFinite(delta)) return previous > 0 ? previous : 60.0;
    const instant = 1.0 / delta;
    if (!(previous > 0) || !isFinite(previous)) return instant;
    const k = Math.min(1, delta / tau);
    return previous + (instant - previous) * k;
}
