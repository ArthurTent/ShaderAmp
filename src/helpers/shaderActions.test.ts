import type { ShaderObject } from './types';
import { getShaderLoadIdentity } from './shaderActions';

jest.mock('webextension-polyfill', () => ({ __esModule: true, default: {} }));

const shader: ShaderObject = {
    shaderName: 'font.frag',
    inlineCode: 'void main() {}',
    inlineBuffers: { 'bufferA.frag': 'void main() {}' },
    metaData: {
        shaderName: 'Font', author: '', modifiedBy: '', url: '', license: '', shaderSpeed: 1,
        iChannel3: 'images/otaviogood_shader_fontgen.png',
    },
};

describe('shader load identity', () => {
    it('is stable for identical shader content', () => {
        expect(getShaderLoadIdentity(JSON.parse(JSON.stringify(shader)))).toBe(getShaderLoadIdentity(shader));
    });

    it('is stable when metadata keys are reordered', () => {
        const metaData = Object.fromEntries(Object.entries(shader.metaData).reverse()) as ShaderObject['metaData'];
        expect(getShaderLoadIdentity({ ...shader, metaData })).toBe(getShaderLoadIdentity(shader));
    });

    it('ignores unrelated storage timestamps', () => {
        expect(getShaderLoadIdentity({ ...shader, ...{ editedAt: 123 } })).toBe(getShaderLoadIdentity(shader));
    });

    it('changes for sampler-only edits', () => {
        expect(getShaderLoadIdentity({ ...shader, metaData: {
            ...shader.metaData,
            iChannel3Sampler: { filter: 'linear', wrap: 'repeat', vflip: true },
        } })).not.toBe(getShaderLoadIdentity(shader));
    });

    it('changes for channel-path edits', () => {
        expect(getShaderLoadIdentity({ ...shader, metaData: {
            ...shader.metaData, iChannel3: 'images/NyanCatSprite.png',
        } })).not.toBe(getShaderLoadIdentity(shader));
    });

    it('changes for buffer-only edits', () => {
        expect(getShaderLoadIdentity({ ...shader, inlineBuffers: {
            'bufferA.frag': 'void main() { gl_FragColor = vec4(1.0); }',
        } })).not.toBe(getShaderLoadIdentity(shader));
    });

    it('changes for main source and name edits', () => {
        expect(getShaderLoadIdentity({ ...shader, inlineCode: 'void main() { discard; }' })).not.toBe(getShaderLoadIdentity(shader));
        expect(getShaderLoadIdentity({ ...shader, shaderName: 'other.frag' })).not.toBe(getShaderLoadIdentity(shader));
    });
});
