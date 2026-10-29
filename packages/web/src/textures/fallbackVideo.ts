import { CanvasTexture } from 'three';

// Port of setupFallbackCanvas (ShaderAmp/src/content/index.tsx): animated
// 640x360 canvas used as iVideo when there is no real video source.
export function createFallbackVideoTexture(): {
    texture: CanvasTexture;
    update(dt: number): void;
    dispose(): void;
} {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;
    const texture = new CanvasTexture(canvas);
    let time = 0;

    const draw = () => {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, `hsl(${(time * 20) % 360}, 50%, 20%)`);
        gradient.addColorStop(1, `hsl(${(time * 20 + 180) % 360}, 50%, 10%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 5; i++) {
            const x = canvas.width / 2 + Math.sin(time + i * 1.5) * 200;
            const y = canvas.height / 2 + Math.cos(time * 0.7 + i * 1.2) * 100;
            const size = 20 + Math.sin(time * 2 + i) * 10;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${(time * 30 + i * 60) % 360}, 70%, 60%, 0.6)`;
            ctx.fill();
        }
        texture.needsUpdate = true;
    };

    draw();

    return {
        texture,
        update(dt: number) {
            time += dt;
            draw();
        },
        dispose() {
            texture.dispose();
        },
    };
}
