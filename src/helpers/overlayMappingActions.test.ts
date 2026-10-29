import {
    isOverlayTarget,
    overlayTargetRef,
    overlayButtonAction,
    dispatchOverlayTarget,
    createOverlayOpacityThrottle,
    sendOverlayManual,
    OVERLAY_MANUAL,
    type OverlayManualMessage,
} from './overlayMappingActions';
import browser from 'webextension-polyfill';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        runtime: { sendMessage: jest.fn(() => Promise.resolve()) },
    },
}));

const mockedSendMessage = browser.runtime.sendMessage as jest.Mock;

describe('isOverlayTarget', () => {
    it('recognises overlay targets', () => {
        expect(isOverlayTarget('overlayHide')).toBe(true);
        expect(isOverlayTarget('overlay:A.frag')).toBe(true);
    });

    it('rejects non-overlay targets', () => {
        expect(isOverlayTarget('overlay:')).toBe(false);
        expect(isOverlayTarget('overlayX')).toBe(false);
        expect(isOverlayTarget('selectShader:A.frag')).toBe(false);
        expect(isOverlayTarget('playScene:x')).toBe(false);
    });
});

describe('overlayTargetRef', () => {
    it('extracts the shader ref', () => {
        expect(overlayTargetRef('overlay:A.frag')).toBe('A.frag');
    });

    it('returns null for empty refs and non-overlay targets', () => {
        expect(overlayTargetRef('overlay:')).toBeNull();
        expect(overlayTargetRef('overlayHide')).toBeNull();
        expect(overlayTargetRef('prevShader')).toBeNull();
    });
});

describe('overlayButtonAction', () => {
    it('momentary (default/undefined) press -> show, release -> release', () => {
        expect(overlayButtonAction(undefined, true)).toBe('show');
        expect(overlayButtonAction(undefined, false)).toBe('release');
        expect(overlayButtonAction('momentary', true)).toBe('show');
        expect(overlayButtonAction('momentary', false)).toBe('release');
    });

    it('toggle press -> toggle, release -> null', () => {
        expect(overlayButtonAction('toggle', true)).toBe('toggle');
        expect(overlayButtonAction('toggle', false)).toBeNull();
    });
});

describe('dispatchOverlayTarget', () => {
    const send = jest.fn();
    const throttle = jest.fn();

    beforeEach(() => {
        send.mockClear();
        throttle.mockClear();
    });

    it('button momentary press sends show, release sends release', () => {
        dispatchOverlayTarget('overlay:A.frag', { kind: 'button', pressed: true }, {}, throttle, send);
        expect(send).toHaveBeenCalledWith({ action: 'show', shaderRef: 'A.frag', opacity: 1, blendMode: 'additive' });

        send.mockClear();
        dispatchOverlayTarget('overlay:A.frag', { kind: 'button', pressed: false }, {}, throttle, send);
        expect(send).toHaveBeenCalledWith({ action: 'release', shaderRef: 'A.frag', opacity: 1, blendMode: 'additive' });
    });

    it('toggle release sends nothing', () => {
        dispatchOverlayTarget('overlay:A.frag', { kind: 'button', pressed: false }, { buttonMode: 'toggle' }, throttle, send);
        expect(send).not.toHaveBeenCalled();
        dispatchOverlayTarget('overlay:A.frag', { kind: 'button', pressed: true }, { buttonMode: 'toggle' }, throttle, send);
        expect(send).toHaveBeenCalledWith({ action: 'toggle', shaderRef: 'A.frag', opacity: 1, blendMode: 'additive' });
    });

    it('passes overlayOpacity as opacity; blend defaults to additive', () => {
        dispatchOverlayTarget('overlay:A.frag', { kind: 'button', pressed: true }, { overlayOpacity: 0.6 }, throttle, send);
        expect(send).toHaveBeenCalledWith({ action: 'show', shaderRef: 'A.frag', opacity: 0.6, blendMode: 'additive' });

        send.mockClear();
        dispatchOverlayTarget('overlay:A.frag', { kind: 'button', pressed: true }, { overlayOpacity: 0.6, overlayBlendMode: 'normal' }, throttle, send);
        expect(send).toHaveBeenCalledWith({ action: 'show', shaderRef: 'A.frag', opacity: 0.6, blendMode: 'normal' });
    });

    it('overlayHide press sends {action:hide}', () => {
        dispatchOverlayTarget('overlayHide', { kind: 'button', pressed: true }, {}, throttle, send);
        expect(send).toHaveBeenCalledWith({ action: 'hide' });

        send.mockClear();
        dispatchOverlayTarget('overlayHide', { kind: 'button', pressed: false }, {}, throttle, send);
        expect(send).not.toHaveBeenCalled();
    });

    it('fader calls the throttle with value01 * overlayOpacity', () => {
        dispatchOverlayTarget('overlay:A.frag', { kind: 'fader', value01: 0.5 }, { overlayOpacity: 0.8 }, throttle, send);
        expect(throttle).toHaveBeenCalledWith('A.frag', 0.4, 'additive');
        expect(send).not.toHaveBeenCalled();
    });

    it('fader on overlayHide only fires past halfway', () => {
        dispatchOverlayTarget('overlayHide', { kind: 'fader', value01: 0.4 }, {}, throttle, send);
        expect(send).not.toHaveBeenCalled();
        dispatchOverlayTarget('overlayHide', { kind: 'fader', value01: 0.6 }, {}, throttle, send);
        expect(send).toHaveBeenCalledWith({ action: 'hide' });
    });
});

describe('createOverlayOpacityThrottle', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('sends first at once, throttles to latest value, always delivers the final value', () => {
        const send = jest.fn<void, [OverlayManualMessage]>();
        const throttle = createOverlayOpacityThrottle(send, 50);

        throttle('A.frag', 0.1, 'additive');
        throttle('A.frag', 0.5, 'additive');
        throttle('A.frag', 0.9, 'additive');
        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenLastCalledWith({ action: 'opacity', shaderRef: 'A.frag', opacity: 0.1, blendMode: 'additive' });

        jest.advanceTimersByTime(50);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send).toHaveBeenLastCalledWith({ action: 'opacity', shaderRef: 'A.frag', opacity: 0.9, blendMode: 'additive' });

        jest.advanceTimersByTime(200);
        expect(send).toHaveBeenCalledTimes(2);
    });
});

describe('sendOverlayManual', () => {
    it('sends the OVERLAY_MANUAL runtime message', () => {
        mockedSendMessage.mockClear();
        sendOverlayManual({ action: 'show', shaderRef: 'A.frag', opacity: 1, blendMode: 'additive' });
        expect(mockedSendMessage).toHaveBeenCalledWith({ command: OVERLAY_MANUAL, action: 'show', shaderRef: 'A.frag', opacity: 1, blendMode: 'additive' });
    });
});
