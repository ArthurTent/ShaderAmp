import browser from 'webextension-polyfill';

// Runtime messages understood by the background scene controller
export const SCENE_PLAY_BY_ID = 'SCENE_PLAY_BY_ID';
export const SCENE_STOP = 'SCENE_STOP';
export const SCENE_TOGGLE_PAUSE = 'SCENE_TOGGLE_PAUSE';

/**
 * True for mapping targets that trigger scene playback:
 * 'sceneStop', 'sceneTogglePause', or 'playScene:<sceneId>'.
 */
export const isSceneTarget = (t: string): boolean =>
    t === 'sceneStop' || t === 'sceneTogglePause' || t.startsWith('playScene:');

export const sceneTargetMessage = (t: string): { command: string; sceneId?: string } | null => {
    if (t.startsWith('playScene:')) {
        const sceneId = t.slice('playScene:'.length);
        return sceneId ? { command: SCENE_PLAY_BY_ID, sceneId } : null;
    }
    if (t === 'sceneStop') return { command: SCENE_STOP };
    if (t === 'sceneTogglePause') return { command: SCENE_TOGGLE_PAUSE };
    return null;
};

export const dispatchSceneTarget = (t: string): void => {
    const m = sceneTargetMessage(t);
    if (m) browser.runtime.sendMessage(m).catch(() => {});
};
