/**
 * Tests for the Shadertoy to ShaderAmp converter's saturate() handling.
 *
 * Regressions covered:
 * 1. Shaders defining their own saturate() overloads (e.g. in Common) previously
 *    had those definitions stripped while deeply nested saturate(...) calls
 *    survived the inlining regex, producing
 *    "'saturate' : no matching overloaded function found".
 * 2. three.js injects `#define saturate( a ) clamp( a, 0.0, 1.0 )` into fragment
 *    shaders, so any function literally named saturate gets macro-expanded into
 *    invalid GLSL ("'0.0' : syntax error"). All saturate identifiers are renamed
 *    to saturate_sa during conversion.
 */

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: { local: { get: jest.fn(), set: jest.fn() } },
        runtime: { sendMessage: jest.fn() },
    },
}));

import {
    convertShadertoyShader,
    needsSaturateInjection,
    ShadertoyShader,
} from './shadertoyConverter';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('needsSaturateInjection', () => {
    it('returns false when saturate is not used', () => {
        expect(needsSaturateInjection('void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }')).toBe(false);
    });

    it('returns true when saturate_sa is used but not defined', () => {
        expect(needsSaturateInjection('float a = saturate_sa(x);')).toBe(true);
    });

    it('returns true for deeply nested saturate_sa calls without a definition', () => {
        const code = 'float stars = saturate_sa( 1.0 - ( ( sin( iTime * 1.0 + 50.0 * rd.y ) ) * 0.5 + 6.0 ) * length( starPos ) );';
        expect(needsSaturateInjection(code)).toBe(true);
    });

    it('returns false when a saturate_sa function is defined', () => {
        const code = 'float saturate_sa( float x ) { return clamp( x, 0., 1. ); }\nfloat a = saturate_sa(x);';
        expect(needsSaturateInjection(code)).toBe(false);
    });

    it('returns false when a saturate_sa macro is defined', () => {
        const code = '#define saturate_sa(x) clamp(x, 0.0, 1.0)\nfloat a = saturate_sa(x);';
        expect(needsSaturateInjection(code)).toBe(false);
    });
});

function makeShader(imageCode: string, commonCode?: string, bufferCode?: string): ShadertoyShader {
    const renderpass: any[] = [
        {
            inputs: [],
            outputs: [{ id: 'out0', channel: 0 }],
            code: imageCode,
            name: 'Image',
            description: '',
            type: 'image',
        },
    ];
    if (commonCode !== undefined) {
        renderpass.push({
            inputs: [],
            outputs: [],
            code: commonCode,
            name: 'Common',
            description: '',
            type: 'common',
        });
    }
    if (bufferCode !== undefined) {
        renderpass.push({
            inputs: [],
            outputs: [{ id: 'bufA', channel: 0 }],
            code: bufferCode,
            name: 'Buffer A',
            description: '',
            type: 'buffer',
        });
    }
    return {
        info: {
            id: 'test01',
            name: 'Test Shader',
            username: 'tester',
            description: '',
            tags: [],
        },
        renderpass,
    } as unknown as ShadertoyShader;
}

describe('convertShadertoyShader saturate handling', () => {
    // Guard against the three.js `#define saturate( a )` macro clash:
    // no bare saturate identifier may survive conversion (comments are fine)
    const expectNoBareSaturate = (code: string) => {
        const stripped = code
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
        expect(stripped).not.toMatch(/\bsaturate\b(?!_sa)/);
    };

    it('renames user-defined saturate overloads and deep-nested calls to saturate_sa', async () => {
        const common = [
            'float saturate( float x ) { return clamp( x, 0., 1. ); }',
            'vec3 saturate( vec3 x ) { return clamp( x, vec3( 0. ), vec3( 1. ) ); }',
        ].join('\n');
        const buffer = [
            'void mainImage( out vec4 fragColor, in vec2 fragCoord ) {',
            '    float stars = saturate( 1.0 - ( ( sin( iTime * 1.0 + 50.0 * rd.y ) ) * 0.5 + 6.0 ) * length( starPos ) );',
            '    fragColor = vec4( stars );',
            '}',
        ].join('\n');
        const image = 'void mainImage( out vec4 fragColor, in vec2 fragCoord ) { fragColor = vec4( saturate( 0.5 ) ); }';

        const result = await convertShadertoyShader(makeShader(image, common, buffer));
        expect(result.success).toBe(true);

        const bufferShader = result.bufferShaders.find(b => b.filename.includes('BufferA'));
        expect(bufferShader).toBeDefined();
        // User definitions must survive, renamed to saturate_sa
        expect(bufferShader!.code).toContain('float saturate_sa( float x ) { return clamp( x, 0., 1. ); }');
        expect(bufferShader!.code).toContain('vec3 saturate_sa( vec3 x )');
        // Deep-nested call must survive, renamed (no partial inlining)
        expect(bufferShader!.code).toContain('saturate_sa( 1.0 - ( ( sin(');
        // No overloads injected since the shader defines its own
        expect(bufferShader!.code).not.toContain('injected by ShaderAmp converter');
        expectNoBareSaturate(bufferShader!.code);
        expectNoBareSaturate(result.mainShader.code);
    });

    it('injects saturate_sa overloads when saturate is used without a definition', async () => {
        const image = 'void mainImage( out vec4 fragColor, in vec2 fragCoord ) { fragColor = vec4( saturate( sin( iTime ) ) ); }';

        const result = await convertShadertoyShader(makeShader(image));
        expect(result.success).toBe(true);
        expect(result.mainShader.code).toContain('injected by ShaderAmp converter');
        expect(result.mainShader.code).toContain('float saturate_sa(float x) { return clamp(x, 0.0, 1.0); }');
        expect(result.mainShader.code).toContain('saturate_sa( sin(');
        expectNoBareSaturate(result.mainShader.code);
    });

    it('renames user saturate macros so they cannot clash with the three.js macro', async () => {
        const image = [
            '#define saturate(x) clamp(x, 0.0, 1.0)',
            'void mainImage( out vec4 fragColor, in vec2 fragCoord ) { fragColor = vec4( saturate( sin( iTime ) ) ); }',
        ].join('\n');

        const result = await convertShadertoyShader(makeShader(image));
        expect(result.success).toBe(true);
        expect(result.mainShader.code).toContain('#define saturate_sa(x)');
        expect(result.mainShader.code).toContain('saturate_sa( sin(');
        // Macro defined by user -> no injection
        expect(result.mainShader.code).not.toContain('injected by ShaderAmp converter');
        expectNoBareSaturate(result.mainShader.code);
    });

    it('does not inject saturate_sa overloads when saturate is unused', async () => {
        const image = 'void mainImage( out vec4 fragColor, in vec2 fragCoord ) { fragColor = vec4( 1.0 ); }';

        const result = await convertShadertoyShader(makeShader(image));
        expect(result.success).toBe(true);
        expect(result.mainShader.code).not.toContain('injected by ShaderAmp converter');
    });
});

describe('convertShadertoyShader keyboard channel handling', () => {
    // Regression: shaders passing the keyboard channel as a bare sampler2D
    // argument (e.g. `#define iChannelKeyboard iChannel3` + Key_IsPressed(iChannelKeyboard, ...))
    // previously left `iChannel3` references behind while its uniform declaration
    // was skipped, producing "'iChannel3' : undeclared identifier".
    function makeKeyboardShader(imageCode: string): ShadertoyShader {
        const shader = makeShader(imageCode);
        (shader.renderpass[0] as any).inputs = [
            { id: 'kbd', channel: 3, type: 'keyboard', filepath: '', sampler: {} },
        ];
        return shader;
    }

    it('replaces bare keyboard channel references passed as sampler arguments', async () => {
        const image = [
            '#define iChannelKeyboard iChannel3',
            'bool Key_IsPressed( sampler2D samp, int key ) { return texelFetch( samp, ivec2( key, 0 ), 0 ).x > 0.0; }',
            'void mainImage( out vec4 fragColor, in vec2 fragCoord ) {',
            '    bool up = Key_IsPressed( iChannelKeyboard, 38 );',
            '    fragColor = vec4( up ? 1.0 : 0.0 );',
            '}',
        ].join('\n');

        const result = await convertShadertoyShader(makeKeyboardShader(image));
        expect(result.success).toBe(true);
        expect(result.mainShader.code).toContain('#define iChannelKeyboard iKeyboard');
        expect(result.mainShader.code).not.toMatch(/\biChannel3\b/);
    });

    it('replaces keyboard channel references inside texture sampling calls', async () => {
        const image = [
            'void mainImage( out vec4 fragColor, in vec2 fragCoord ) {',
            '    float down = texelFetch( iChannel3, ivec2( 32, 0 ), 0 ).x;',
            '    fragColor = vec4( down );',
            '}',
        ].join('\n');

        const result = await convertShadertoyShader(makeKeyboardShader(image));
        expect(result.success).toBe(true);
        expect(result.mainShader.code).toContain('texelFetch(iKeyboard');
        expect(result.mainShader.code).not.toMatch(/\biChannel3\b/);
    });
});

function makeSoundShader(soundCode: string, commonCode?: string): ShadertoyShader {
    const shader = makeShader('void mainImage( out vec4 fragColor, in vec2 fragCoord ) { fragColor = vec4(1.0); }', commonCode);
    shader.renderpass.push({
        inputs: [],
        outputs: [],
        code: soundCode,
        name: 'Sound',
        description: '',
        type: 'sound',
    });
    return shader;
}

describe('convertShadertoyShader sound pass', () => {
    it('converts a sound pass into a soundShader with the sample-offset wrapper', async () => {
        const sound = 'vec2 mainSound( in int samp, float time ) { return vec2(sin(6.2831*440.0*time)); }';
        const result = await convertShadertoyShader(makeSoundShader(sound));
        expect(result.success).toBe(true);
        expect(result.soundShader).toBeDefined();
        expect(result.soundShader!.filename).toBe('TestShaderSound.frag');
        expect(result.mainShader.meta.soundShader).toBe('TestShaderSound.frag');
        expect(result.soundShader!.code).toContain('uniform int iSoundBlockOffset;');
        expect(result.soundShader!.code).toContain('mainSound(samp, time)');
        expect(result.soundShader!.code).toContain('iSampleRate');
    });

    it('prepends common code so shared tables/functions resolve', async () => {
        const common = '#define TAU 6.283185307\nfloat commonFreq() { return 440.0; }';
        const sound = 'vec2 mainSound( in int samp, float time ) { return vec2(sin(TAU*commonFreq()*time)); }';
        const result = await convertShadertoyShader(makeSoundShader(sound, common));
        expect(result.success).toBe(true);
        expect(result.soundShader!.code).toContain('commonFreq');
        expect(result.soundShader!.code).toContain('=== Common Code ===');
    });

    it('does not rewrite iTime to iAmplifiedTime in sound code', async () => {
        const sound = 'vec2 mainSound( in int samp, float time ) { return vec2(sin(iTime)); }';
        const result = await convertShadertoyShader(makeSoundShader(sound), true);
        expect(result.success).toBe(true);
        expect(result.soundShader!.code).toContain('sin(iTime)');
        // iAmplifiedTime only appears via the shared uniforms header
        expect(result.soundShader!.code).not.toContain('sin(iAmplifiedTime)');
    });

    it('supports the legacy mainSound(float time) signature', async () => {
        const sound = 'vec2 mainSound( float time ) { return vec2(sin(440.0*time)); }';
        const result = await convertShadertoyShader(makeSoundShader(sound));
        expect(result.success).toBe(true);
        expect(result.soundShader!.code).toContain('mainSound(time)');
    });

    it('returns no soundShader for shaders without a sound pass', async () => {
        const result = await convertShadertoyShader(makeShader('void mainImage( out vec4 fragColor, in vec2 fragCoord ) { fragColor = vec4(0.0); }'));
        expect(result.success).toBe(true);
        expect(result.soundShader).toBeUndefined();
        expect(result.mainShader.meta.soundShader).toBeUndefined();
    });
});

describe('convertShadertoyShader CubemapA buffer support', () => {
    const slVBzm = JSON.parse(readFileSync(resolve(__dirname, 'fixtures', 'slVBzm.json'), 'utf8')) as ShadertoyShader;

    it('detects Cube A and maps it to cubemapA on any channel', async () => {
        const result = await convertShadertoyShader(slVBzm, false, false);
        expect(result.success).toBe(true);
        expect(result.mainShader.meta.cubemapPasses).toHaveLength(1);
        expect(result.mainShader.meta.cubemapPasses![0].letter).toBe('A');

        // Image pass samples cubemapA on iChannel0
        expect(result.mainShader.meta.iChannel0).toBe('cubemapA');
        expect(result.mainShader.meta.iChannel0Type).toBe('cubemap');
    });

    it('handles Cube A self-feedback and keyboard input', async () => {
        const result = await convertShadertoyShader(slVBzm, false, false);
        expect(result.success).toBe(true);

        const cubePass = result.mainShader.meta.cubemapPasses![0];
        // Cube A samples itself on iChannel0
        expect(cubePass.iChannel0).toBe('cubemapA');
        expect((cubePass as any).iChannel0Type).toBe('cubemap');
        // Keyboard is on iChannel3 inside the cube pass
        expect(cubePass.iChannel3).toBe('keyboard');

        const cubeShader = result.bufferShaders.find(b => b.filename.includes('CubeA'));
        expect(cubeShader).toBeDefined();
        expect(cubeShader!.code).toContain('texelFetch(iKeyboard');
        expect(cubeShader!.code).not.toMatch(/\biChannel3\b/);
    });

    it('maps cubemapA to the channel declared by the shader, not a fixed channel', async () => {
        // Mutate a copy so the Image pass references the cubemap on iChannel2
        const shader = JSON.parse(JSON.stringify(slVBzm)) as ShadertoyShader;
        const imagePass = shader.renderpass.find((rp: any) => rp.type === 'image');
        const cubemapInput = imagePass?.inputs.find((inp: any) => inp.type === 'cubemap');
        if (cubemapInput) cubemapInput.channel = 2;

        const result = await convertShadertoyShader(shader, false, false);
        expect(result.success).toBe(true);
        expect(result.mainShader.meta.iChannel2).toBe('cubemapA');
        expect(result.mainShader.meta.iChannel2Type).toBe('cubemap');
        expect(result.mainShader.meta.iChannel0).toBeUndefined();
    });
});

describe('convertShadertoyShader volume render passes', () => {
    it('converts a Volume A pass to a 3D render target instead of greyNoise3D', async () => {
        // Mirrors 73ySDW.json (Cyber-Menger Volume Edition): Volume A bakes a
        // distance field, Buffer A samples it as sampler3D iChannel0.
        const renderpass: any[] = [
            {
                inputs: [{ channel: 0, type: 'buffer', id: 'bufAId', filepath: '/media/previz/buffer00.png', sampler: { filter: 'linear', wrap: 'clamp' } }],
                outputs: [{ channel: 0, id: 'imgId' }],
                code: 'void mainImage( out vec4 c, in vec2 f ) { c = texture(iChannel0, f/iResolution.xy); }',
                name: 'Image', description: '', type: 'image',
            },
            {
                inputs: [{ channel: 0, type: 'volume', id: 'volAId', filepath: '/media/a//media/previz/volume00.png', sampler: { filter: 'linear', wrap: 'clamp' } }],
                outputs: [{ channel: 0, id: 'bufAId' }],
                code: 'uniform highp sampler3D iChannel0;\nvoid mainImage( out vec4 c, in vec2 f ) { c = vec4(texture(iChannel0, vec3(0.5)).r); }',
                name: 'Buffer A', description: '', type: 'buffer',
            },
            {
                inputs: [],
                outputs: [{ channel: 0, id: 'volAId' }],
                code: 'void mainVolume( out vec4 c, in vec3 fragCoord ) { c = vec4(length(fragCoord)); }',
                name: 'Volume A', description: '', type: 'volume',
            },
        ];
        const shader = {
            info: { id: '73ySDW', name: 'Cyber-Menger Volume edition', username: 'dathor', description: '', tags: [] },
            renderpass,
        } as unknown as ShadertoyShader;

        const result = await convertShadertoyShader(shader);
        expect(result.success).toBe(true);

        // The volume pass is emitted as its own .frag with the slice wrapper
        const volShader = result.bufferShaders.find(b => b.filename.includes('VolumeA'));
        expect(volShader).toBeDefined();
        expect(volShader!.code).toContain('mainVolume(');
        expect(volShader!.code).toContain('iVolumeSlice');
        expect(volShader!.code).toContain('vec3 fragCoord = vec3(gl_FragCoord.xy, iVolumeSlice)');

        // Meta carries the pass config at Shadertoy's 128^3 bake resolution
        const meta = result.mainShader.meta as any;
        expect(meta.volumePasses).toHaveLength(1);
        expect(meta.volumePasses[0].letter).toBe('A');
        expect(meta.volumePasses[0].resolution).toBe(128);

        // Buffer A binds the baked volume, NOT procedural noise
        const bufferEntry = meta.buffers.find((b: any) => b.shaderName.includes('BufferA'));
        expect(bufferEntry).toBeDefined();
        expect(bufferEntry.iChannel0).toBe('volumeA');
        expect(bufferEntry.iChannel0Type).toBe('volume');
        expect(bufferEntry.iChannel0).not.toBe('greyNoise3D');
    });

    it('rewrites music input and keeps self-feedback for a history volume pass', async () => {
        // Mirrors sXySWw.json (Volume notes): Volume A reads its own previous
        // frame on iChannel0 and the music FFT on iChannel1; Image samples it.
        const renderpass: any[] = [
            {
                inputs: [{ channel: 0, type: 'volume', id: 'volAId', filepath: '/media/previz/volume00.png', sampler: { filter: 'linear', wrap: 'clamp' } }],
                outputs: [{ channel: 0, id: 'imgId' }],
                code: 'void mainImage( out vec4 c, in vec2 f ) { c = vec4(texelFetch(iChannel0, ivec3(0), 0).r); }',
                name: 'Image', description: '', type: 'image',
            },
            {
                inputs: [
                    { channel: 0, type: 'volume', id: 'volAId', filepath: '/media/previz/volume00.png', sampler: { filter: 'linear', wrap: 'clamp' } },
                    { channel: 1, type: 'music', id: 'musicId', filepath: '/media/a/music.mp3', sampler: { filter: 'linear', wrap: 'clamp' } },
                ],
                outputs: [{ channel: 0, id: 'volAId' }],
                code: 'float spec(int i) { return texelFetch(iChannel1, ivec2(i, 0), 0).x; }\nvoid mainVolume( out vec4 c, in vec3 fragCoord ) { c = vec4(texelFetch(iChannel0, ivec3(fragCoord) - ivec3(0,0,1), 0).r + spec(3)); }',
                name: 'Volume A', description: '', type: 'volume',
            },
        ];
        const shader = {
            info: { id: 'sXySWw', name: 'Volume notes', username: 'dathor', description: '', tags: [] },
            renderpass,
        } as unknown as ShadertoyShader;

        const result = await convertShadertoyShader(shader);
        expect(result.success).toBe(true);

        const volShader = result.bufferShaders.find(b => b.filename.includes('VolumeA'));
        expect(volShader).toBeDefined();
        // Music channel is routed to the analyser texture, like buffers/cubemaps
        expect(volShader!.code).toContain('texelFetch(iAudioData,');
        expect(volShader!.code).not.toMatch(/uniform\s+\w*\s*sampler2D\s+iChannel1\b/);
        // Self-reference stays a sampler3D read of iChannel0
        expect(volShader!.code).toMatch(/sampler3D\s+iChannel0\b/);
        expect(volShader!.code).toContain('texelFetch(iChannel0,');

        const meta = result.mainShader.meta as any;
        expect(meta.volumePasses).toHaveLength(1);
        expect(meta.volumePasses[0].iChannel0).toBe('volumeA');
        expect(meta.volumePasses[0].iChannel0Type).toBe('volume');
        expect(meta.iChannel0).toBe('volumeA');
        expect(meta.iChannel0Type).toBe('volume');
    });
});
