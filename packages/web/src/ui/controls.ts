import type { ShaderAmp } from '../ShaderAmp';
import { ShaderAmp as ShaderAmpClass } from '../ShaderAmp';
import type { ControlsOptions, ShaderObject } from '../types';

const CSS = `
.shaderamp-controls, .shaderamp-credits {
    position: absolute; z-index: 10; display: flex; gap: 4px; align-items: center;
    opacity: 0; transition: opacity 0.3s; pointer-events: none;
    font-family: system-ui, sans-serif; color: #fff;
}
.shaderamp-controls { right: 8px; bottom: 8px; }
.shaderamp-credits { left: 8px; bottom: 8px; font-size: 12px; text-shadow: 0 1px 2px #000; }
.shaderamp-controls.shaderamp-visible, .shaderamp-credits.shaderamp-visible { opacity: 1; pointer-events: auto; }
.shaderamp-btn {
    background: rgba(0,0,0,0.55); color: #fff; border: 1px solid rgba(255,255,255,0.25);
    border-radius: 4px; width: 32px; height: 32px; font-size: 15px; line-height: 1;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
}
.shaderamp-btn:hover { background: rgba(0,0,0,0.8); }
.shaderamp-credits a { color: #fff; }
`;

export function createControls(
    root: HTMLElement,
    amp: ShaderAmp,
    opts: ControlsOptions,
): { setShader(shader: ShaderObject): void; dispose(): void } {
    const doc = root.ownerDocument;
    const style = doc.createElement('style');
    style.textContent = CSS;
    doc.head.appendChild(style);

    const bar = doc.createElement('div');
    bar.className = 'shaderamp-controls';

    const svg = (inner: string) =>
        `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${inner}</svg>`;
    const ICONS = {
        prev: svg('<path d="M11 2v12L4 8z"/><rect x="2" y="2" width="1.6" height="12"/>'),
        next: svg('<path d="M5 2v12l7-6z"/><rect x="12.4" y="2" width="1.6" height="12"/>'),
        pip: svg('<rect x="1" y="2.5" width="14" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="8.2" y="8.2" width="5" height="3.6" rx="0.6"/>'),
        fullscreen: svg(
            '<path d="M1.5 5V1.5H5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
            '<path d="M11 1.5h3.5V5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
            '<path d="M14.5 11v3.5H11" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
            '<path d="M5 14.5H1.5V11" fill="none" stroke="currentColor" stroke-width="1.6"/>',
        ),
    };

    const mkButton = (icon: string, aria: string, onClick: () => void) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'shaderamp-btn';
        b.innerHTML = icon;
        b.setAttribute('aria-label', aria);
        b.addEventListener('click', onClick);
        return b;
    };

    const buttons: HTMLElement[] = [];
    if (opts.navigation) {
        buttons.push(mkButton(ICONS.prev, 'Previous shader', () => void amp.prev()));
        buttons.push(mkButton(ICONS.next, 'Next shader', () => void amp.next()));
    }
    if (opts.pip && ShaderAmpClass.isPictureInPictureSupported()) {
        buttons.push(mkButton(ICONS.pip, 'Picture in picture', () => void amp.togglePictureInPicture().catch(() => {})));
    }
    if (opts.fullscreen) {
        buttons.push(mkButton(ICONS.fullscreen, 'Toggle fullscreen', () => void amp.toggleFullscreen().catch(() => {})));
    }
    buttons.forEach((b) => bar.appendChild(b));

    let credits: HTMLElement | null = null;
    const setShader = (shader: ShaderObject) => {
        if (!credits) return;
        const m = shader.metaData;
        const label = `${m?.shaderName || shader.shaderName}${m?.author ? ` by ${m.author}` : ''}`;
        credits.textContent = '';
        if (m?.url) {
            const a = doc.createElement('a');
            a.href = m.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = label;
            credits.appendChild(a);
        } else {
            credits.textContent = label;
        }
    };
    if (opts.credits) {
        credits = doc.createElement('div');
        credits.className = 'shaderamp-credits';
    }

    // Show on pointer activity over root; hide after 2 s idle.
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const show = () => {
        bar.classList.add('shaderamp-visible');
        credits?.classList.add('shaderamp-visible');
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            bar.classList.remove('shaderamp-visible');
            credits?.classList.remove('shaderamp-visible');
        }, 2000);
    };
    root.addEventListener('pointermove', show);
    root.addEventListener('pointerdown', show);
    root.addEventListener('focusin', show);

    if (buttons.length) root.appendChild(bar);
    if (credits) root.appendChild(credits);
    if (amp.currentShader) setShader(amp.currentShader);
    const unsub = amp.on('shaderchange', ({ shader }) => setShader(shader));

    return {
        setShader,
        dispose() {
            unsub();
            if (hideTimer) clearTimeout(hideTimer);
            root.removeEventListener('pointermove', show);
            root.removeEventListener('pointerdown', show);
            root.removeEventListener('focusin', show);
            bar.remove();
            credits?.remove();
            style.remove();
        },
    };
}
