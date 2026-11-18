import { BUILTIN_UNIFORM_NAMES, builtinDeclarations, channelDeclaration } from './shaderBuiltins';

describe('shaderBuiltins', () => {
    it('covers the full Shadertoy uniform set', () => {
        const shadertoy = ['iResolution', 'iTime', 'iTimeDelta', 'iFrameRate', 'iFrame', 'iChannelTime',
            'iChannelResolution', 'iMouse', 'iChannel0', 'iChannel1', 'iChannel2', 'iChannel3',
            'iDate', 'iSampleRate', 'iGamepad'];
        for (const name of shadertoy) expect(BUILTIN_UNIFORM_NAMES).toContain(name);
    });

    it('uses Shadertoy types for the declarations', () => {
        const decls = builtinDeclarations().join('\n');
        expect(decls).toContain('uniform vec3 iResolution;');
        expect(decls).toContain('uniform int iFrame;');
        expect(decls).toContain('uniform float iChannelTime[4];');
        expect(decls).toContain('uniform vec3 iChannelResolution[4];');
        expect(decls).toContain('uniform vec4 iMouse;');
        expect(decls).toContain('uniform vec4 iDate;');
        expect(decls).toContain('uniform ShaderAmpGamepad iGamepad;');
        expect(decls.match(/\biGamepad\b/g)).toHaveLength(1);
    });

    it('picks the channel sampler type from the binding', () => {
        expect(channelDeclaration(0, undefined)).toBe('uniform sampler2D iChannel0;');
        expect(channelDeclaration(1, 'cubemap')).toBe('uniform samplerCube iChannel1;');
        expect(channelDeclaration(2, 'volume')).toBe('uniform highp sampler3D iChannel2;');
        expect(builtinDeclarations([undefined, 'cubemap'])).toContain('uniform samplerCube iChannel1;');
    });
});
