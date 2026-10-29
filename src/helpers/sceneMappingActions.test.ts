import { isSceneTarget, sceneTargetMessage, dispatchSceneTarget, SCENE_PLAY_BY_ID, SCENE_STOP, SCENE_TOGGLE_PAUSE } from './sceneMappingActions';
import browser from 'webextension-polyfill';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        runtime: { sendMessage: jest.fn(() => Promise.resolve()) },
    },
}));

const mockedSendMessage = browser.runtime.sendMessage as jest.Mock;

describe('isSceneTarget', () => {
    it('recognises scene targets', () => {
        expect(isSceneTarget('sceneStop')).toBe(true);
        expect(isSceneTarget('sceneTogglePause')).toBe(true);
        expect(isSceneTarget('playScene:abc123')).toBe(true);
    });

    it('rejects non-scene targets', () => {
        expect(isSceneTarget('prevShader')).toBe(false);
        expect(isSceneTarget('sceneStopX')).toBe(false);
        expect(isSceneTarget('playSceneX:abc')).toBe(false);
        expect(isSceneTarget('uniform:foo')).toBe(false);
        expect(isSceneTarget('selectShader:A.frag')).toBe(false);
    });
});

describe('sceneTargetMessage', () => {
    it('maps playScene:<id> to SCENE_PLAY_BY_ID with the scene id', () => {
        expect(sceneTargetMessage('playScene:scene-1')).toEqual({ command: SCENE_PLAY_BY_ID, sceneId: 'scene-1' });
    });

    it('returns null for an empty scene id', () => {
        expect(sceneTargetMessage('playScene:')).toBeNull();
    });

    it('maps sceneStop and sceneTogglePause', () => {
        expect(sceneTargetMessage('sceneStop')).toEqual({ command: SCENE_STOP });
        expect(sceneTargetMessage('sceneTogglePause')).toEqual({ command: SCENE_TOGGLE_PAUSE });
    });

    it('returns null for unknown targets', () => {
        expect(sceneTargetMessage('prevShader')).toBeNull();
    });
});

describe('dispatchSceneTarget', () => {
    beforeEach(() => mockedSendMessage.mockClear());

    it('sends the mapped message', () => {
        dispatchSceneTarget('playScene:xyz');
        expect(mockedSendMessage).toHaveBeenCalledWith({ command: SCENE_PLAY_BY_ID, sceneId: 'xyz' });
    });

    it('sends nothing for non-scene targets', () => {
        dispatchSceneTarget('prevShader');
        expect(mockedSendMessage).not.toHaveBeenCalled();
    });
});
