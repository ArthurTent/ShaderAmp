import { describe, expect, it, vi } from 'vitest';
import { PipController } from '../src/pip/pip';

function fakePipWindow() {
    const doc = document.implementation.createHTMLDocument();
    const target = new EventTarget();
    const win = {
        document: doc,
        closed: false,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
        close() {
            this.closed = true;
            this.dispatchEvent(new Event('pagehide'));
        },
    };
    return win;
}

describe('PipController (document mode)', () => {
    function setup() {
        const pipWin = fakePipWindow();
        const requestWindow = vi.fn(async () => pipWin as unknown as Window);
        Object.defineProperty(window, 'documentPictureInPicture', {
            value: { requestWindow },
            configurable: true,
        });
        return { pipWin, requestWindow };
    }

    it('moves the element into the PiP document with a placeholder, restores on pagehide', async () => {
        const { pipWin, requestWindow } = setup();
        const host = document.createElement('div');
        const element = document.createElement('div');
        element.id = 'viz';
        host.appendChild(element);
        document.body.appendChild(host);

        const onResize = vi.fn();
        const onEnter = vi.fn();
        const onExit = vi.fn();
        const canvas = document.createElement('canvas');
        const pip = new PipController({ element, canvas, onResize, onEnter, onExit });

        const mode = await pip.enter({ mode: 'document' });
        expect(mode).toBe('document');
        expect(requestWindow).toHaveBeenCalledWith({ width: 480, height: 270 });
        expect(pip.active).toBe(true);
        expect(onEnter).toHaveBeenCalledWith('document');
        // element moved into pip document, placeholder in its place
        expect(pipWin.document.body.contains(element)).toBe(true);
        expect(element.ownerDocument).toBe(pipWin.document);
        expect(host.children.length).toBe(1);
        expect(host.children[0]).not.toBe(element);
        // style injected
        expect(pipWin.document.head.querySelector('style')?.textContent).toContain('shaderamp-root');
        // resize forwards to onResize
        pipWin.dispatchEvent(new Event('resize'));
        expect(onResize).toHaveBeenCalled();

        // closing the window fires pagehide -> restore
        (pipWin as any).close();
        expect(onExit).toHaveBeenCalled();
        expect(pip.active).toBe(false);
        expect(host.children[0]).toBe(element);

        host.remove();
        delete (window as any).documentPictureInPicture;
    });

    it('exit() restores the element even without a real pagehide', async () => {
        setup();
        const host = document.createElement('div');
        const element = document.createElement('div');
        host.appendChild(element);
        document.body.appendChild(host);
        const onExit = vi.fn();
        const pip = new PipController({ element, canvas: document.createElement('canvas'), onResize: () => {}, onEnter: () => {}, onExit });
        await pip.enter();
        await pip.exit();
        expect(host.children[0]).toBe(element);
        expect(onExit).toHaveBeenCalledTimes(1);
        host.remove();
        delete (window as any).documentPictureInPicture;
    });
});
