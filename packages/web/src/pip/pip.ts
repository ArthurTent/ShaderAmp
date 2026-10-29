export type PipMode = 'document' | 'video';

export function getPipMode(win: any, requested?: 'auto' | 'document' | 'video'): PipMode | null {
    const want = requested ?? 'auto';
    if (want !== 'video' && 'documentPictureInPicture' in win) return 'document';
    const doc = win.document;
    if (
        typeof win.HTMLCanvasElement?.prototype?.captureStream === 'function' &&
        doc?.pictureInPictureEnabled
    ) {
        return 'video';
    }
    return null;
}

const PIP_STYLE =
    'html,body{margin:0;height:100%;background:#000;overflow:hidden}' +
    ' .shaderamp-root,canvas{width:100%!important;height:100%!important;display:block}';

interface PipControllerOpts {
    element: HTMLElement; // root or canvas — whatever moves into the PiP window
    canvas: HTMLCanvasElement;
    onResize(): void;
    onEnter(mode: PipMode): void;
    onExit(): void;
}

// Document PiP keeps mouse/keyboard interaction and animates while the main
// tab is hidden (the PiP window has its own rAF). Video PiP is the Safari
// fallback: a hidden <video> fed by canvas.captureStream — no interaction.
export class PipController {
    private mode: PipMode | null = null;
    private pipWindow: Window | null = null;
    private placeholder: HTMLElement | null = null;
    private video: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private onPipResize = () => this.opts.onResize();
    private onPageHide = () => this.restore();

    constructor(private opts: PipControllerOpts) {}

    get active(): boolean {
        return this.mode !== null;
    }

    get currentMode(): PipMode | null {
        return this.mode;
    }

    async enter(req: { mode?: 'auto' | 'document' | 'video'; width?: number; height?: number } = {}): Promise<PipMode> {
        if (this.mode) return this.mode;
        const win = this.opts.element.ownerDocument?.defaultView ?? window;
        const mode = getPipMode(win, req.mode);
        if (!mode) throw new Error('[shaderamp] Picture-in-Picture is not supported');
        if (mode === 'document') await this.enterDocumentPiP(win, req);
        else await this.enterVideoPiP(win);
        this.mode = mode;
        this.opts.onEnter(mode);
        return mode;
    }

    async exit(): Promise<void> {
        if (this.mode === 'document') {
            this.pipWindow?.close();
            // the pagehide handler restores the element
            this.restore();
        } else if (this.mode === 'video') {
            await this.exitVideoPiP();
        }
    }

    private async enterDocumentPiP(win: Window, req: { width?: number; height?: number }): Promise<void> {
        const pipWin: Window = await (win as any).documentPictureInPicture.requestWindow({
            width: req.width ?? 480,
            height: req.height ?? 270,
        });
        const { element } = this.opts;

        const style = pipWin.document.createElement('style');
        style.textContent = PIP_STYLE;
        pipWin.document.head.appendChild(style);

        const placeholder = element.ownerDocument.createElement('div');
        placeholder.style.cssText = `width:${element.clientWidth}px;height:${element.clientHeight}px`;
        element.replaceWith(placeholder);
        pipWin.document.body.appendChild(element);

        pipWin.addEventListener('resize', this.onPipResize);
        pipWin.addEventListener('pagehide', this.onPageHide);

        this.pipWindow = pipWin;
        this.placeholder = placeholder;
    }

    private restore(): void {
        const { element } = this.opts;
        if (this.placeholder) {
            this.placeholder.replaceWith(element);
            this.placeholder = null;
        }
        this.pipWindow?.removeEventListener('resize', this.onPipResize);
        this.pipWindow?.removeEventListener('pagehide', this.onPageHide);
        if (this.mode) {
            this.mode = null;
            this.opts.onExit();
        }
    }

    private ensureVideo(doc: Document): HTMLVideoElement {
        if (!this.video) {
            const v = doc.createElement('video');
            v.muted = true;
            v.playsInline = true;
            v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
            doc.body.appendChild(v);
            this.video = v;
        }
        return this.video;
    }

    private async enterVideoPiP(win: Window): Promise<void> {
        const doc = this.opts.canvas.ownerDocument;
        const v = this.ensureVideo(doc);
        this.stream = this.opts.canvas.captureStream(30);
        v.srcObject = this.stream;
        v.addEventListener('leavepictureinpicture', this.onLeavePiP);
        await v.play();
        try {
            await v.requestPictureInPicture();
        } catch (err) {
            this.cleanupVideoStream();
            throw err;
        }
    }

    private onLeavePiP = () => {
        this.cleanupVideoStream();
        if (this.mode) {
            this.mode = null;
            this.opts.onExit();
        }
    };

    private cleanupVideoStream(): void {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        if (this.video) this.video.srcObject = null;
    }

    private async exitVideoPiP(): Promise<void> {
        const doc = this.opts.canvas.ownerDocument;
        if (doc.pictureInPictureElement) {
            await doc.exitPictureInPicture();
        }
        this.cleanupVideoStream();
        if (this.mode) {
            this.mode = null;
            this.opts.onExit();
        }
    }

    dispose(): void {
        if (this.mode === 'document') {
            this.restore();
        } else {
            this.cleanupVideoStream();
            this.video?.removeEventListener('leavepictureinpicture', this.onLeavePiP);
            this.video?.remove();
            this.video = null;
            this.mode = null;
        }
    }
}
