import { isOverlayShader } from './overlayShaders';
import type { ShaderMetaData, ShaderOptions } from './types';

const metaFor = (overrides: Partial<ShaderMetaData>): ShaderMetaData => ({
    author: '',
    modifiedBy: '',
    shaderName: '',
    url: '',
    license: '',
    shaderSpeed: 1,
    ...overrides,
} as ShaderMetaData);

describe('isOverlayShader', () => {
    it('returns false with no option and no meta', () => {
        expect(isOverlayShader('A.frag', null, null)).toBe(false);
        expect(isOverlayShader('A.frag', undefined, undefined)).toBe(false);
        expect(isOverlayShader('A.frag', metaFor({}), {})).toBe(false);
    });

    it('returns true when the meta flag is set', () => {
        expect(isOverlayShader('A.frag', metaFor({ overlay: true }), null)).toBe(true);
        expect(isOverlayShader('A.frag', metaFor({ overlay: true }), {})).toBe(true);
    });

    it('option false overrides meta true', () => {
        const options: ShaderOptions = { 'A.frag': { isHidden: false, isOverlay: false } };
        expect(isOverlayShader('A.frag', metaFor({ overlay: true }), options)).toBe(false);
    });

    it('option true marks a shader without meta flag', () => {
        const options: ShaderOptions = { 'A.frag': { isHidden: false, isOverlay: true } };
        expect(isOverlayShader('A.frag', metaFor({}), options)).toBe(true);
        expect(isOverlayShader('A.frag', null, options)).toBe(true);
    });
});
