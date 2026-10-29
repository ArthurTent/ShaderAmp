import type { Vector4 } from 'three';

export function mapPointer(
    clientX: number,
    clientY: number,
    rect: { left: number; right?: number; top?: number; bottom: number; width: number; height: number },
    bufW: number,
    bufH: number,
): { x: number; y: number } {
    return {
        x: (clientX - rect.left) * (bufW / rect.width),
        y: (rect.bottom - clientY) * (bufH / rect.height),
    };
}

export function attachMouse(
    canvas: HTMLCanvasElement,
    iMouse: Vector4,
    getBufferSize: () => { width: number; height: number },
): { endFrame(): void; dispose(): void } {
    let isDown = false;
    let clickFrame = false;

    const init = getBufferSize();
    iMouse.set(init.width / 2, init.height / 2, 0, 0);

    const pos = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const buf = getBufferSize();
        return mapPointer(e.clientX, e.clientY, rect, buf.width, buf.height);
    };

    const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        isDown = true;
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch {
            // pointer may already be released
        }
        const p = pos(e);
        iMouse.set(p.x, p.y, p.x, p.y);
        clickFrame = true;
    };

    const onMove = (e: PointerEvent) => {
        if (!isDown) return;
        const p = pos(e);
        iMouse.x = p.x;
        iMouse.y = p.y;
    };

    const onUp = (e: PointerEvent) => {
        if (e.button !== 0 || !isDown) return;
        isDown = false;
        iMouse.z = -Math.abs(iMouse.z);
        iMouse.w = -Math.abs(iMouse.w);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return {
        endFrame() {
            // Shadertoy keeps iMouse.w > 0 only on the click frame
            if (clickFrame) {
                clickFrame = false;
            } else if (iMouse.w > 0) {
                iMouse.w = -Math.abs(iMouse.w);
            }
        },
        dispose() {
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
        },
    };
}
