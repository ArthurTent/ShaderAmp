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
