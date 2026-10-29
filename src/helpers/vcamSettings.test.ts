import { customUniformsKey, vcamSettingsChanged, vcamSettingsFromStorage, VCAM_DEFAULT_RENDER_SCALE } from './vcamSettings';

describe('vcamSettingsFromStorage', () => {
    it('uses the extension defaults when nothing is stored', () => {
        expect(vcamSettingsFromStorage(undefined)).toEqual({
            speedDivider: 25,
            volumeAmplifier: 1,
            eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            amplifiedTime: true,
            waitForAudio: false,
            fade: false,
            showCredits: false,
            showFps: false,
            renderScale: VCAM_DEFAULT_RENDER_SCALE,
            soundBuffer: true,
            videoFollowTime: false,
            useWebcam: false,
        });
    });

    it('maps stored settings', () => {
        const s = vcamSettingsFromStorage({
            'settings.speedDivider': 10,
            'settings.volumeAmplifier': 3,
            'settings.eqGains': [6, -3],
            'settings.enableIAmplifiedTime': false,
            'settings.waitForAudioStart': true,
            'settings.shaderFade': true,
            'state.showshadercredits': true,
            'settings.showFps': true,
            'settings.renderScale': 0.75,
            'settings.soundBuffer': false,
            'settings.videoFollowTime': true,
            'settings.useWebcam': true,
        });
        expect(s).toMatchObject({
            speedDivider: 10,
            volumeAmplifier: 3,
            amplifiedTime: false,
            waitForAudio: true,
            fade: true,
            showCredits: true,
            showFps: true,
            renderScale: 0.75,
            soundBuffer: false,
            videoFollowTime: true,
            useWebcam: true,
        });
        expect(s.eqGains).toEqual([6, -3, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('rejects invalid values', () => {
        const s = vcamSettingsFromStorage({
            'settings.speedDivider': 'abc',
            'settings.volumeAmplifier': -1,
            'settings.renderScale': 2,
            'settings.shaderFade': 'yes',
        });
        expect(s.speedDivider).toBe(25);
        expect(s.volumeAmplifier).toBe(1);
        expect(s.renderScale).toBe(VCAM_DEFAULT_RENDER_SCALE);
        expect(s.fade).toBe(false);
    });
});

describe('vcamSettingsChanged', () => {
    it('detects followed keys only', () => {
        expect(vcamSettingsChanged(['settings.showFps'])).toBe(true);
        expect(vcamSettingsChanged(['state.currentshader', 'settings.uiTheme'])).toBe(false);
    });

    it('builds the custom uniform key like the extension', () => {
        expect(customUniformsKey('Foo.frag')).toBe('customUniforms_Foo.frag');
    });
});
