import { describe, expect, it } from 'vitest';
import { hasMainVR, injectRuntimeWrappers, injectShadertoyDefines, prepareMainShader, prepareBufferShader, stripGlslComments } from '../src/shader/preprocess';

const simpleShader = `uniform float iTime;
void main() {
    gl_FragColor = vec4(1.0);
}
`;

describe('stripGlslComments', () => {
    it('strips line and block comments', () => {
        expect(stripGlslComments('a // b\n/* c */d')).toBe('a \nd');
    });
});

describe('hasMainVR', () => {
    it('detects mainVR', () => {
        expect(hasMainVR('void mainVR(out vec4 c, in vec2 f, in vec3 o, in vec3 d) {}')).toBe(true);
        expect(hasMainVR('void main() {}')).toBe(false);
        expect(hasMainVR(null)).toBe(false);
    });
});

describe('injectShadertoyDefines', () => {
    it('prepends HW_PERFORMANCE once', () => {
        const out = injectShadertoyDefines(simpleShader);
        expect(out.startsWith('#define HW_PERFORMANCE 1\n')).toBe(true);
        expect(injectShadertoyDefines(out)).toBe(out);
    });

    it('defines saturate() when a shader uses it without defining it (like three.js tone mapping)', () => {
        const code = 'void main() { gl_FragColor = vec4(saturate(2.0)); }';
        const out = injectShadertoyDefines(code);
        expect(out).toContain('#define saturate( a ) clamp( a, 0.0, 1.0 )');
        expect(injectShadertoyDefines(out)).toBe(out);
    });

    it('leaves shaders alone that define saturate themselves or only mention it in comments', () => {
        const fn = 'float saturate(float x) { return clamp(x, 0.0, 1.0); }\nvoid main() { gl_FragColor = vec4(saturate(2.0)); }';
        expect(injectShadertoyDefines(fn)).not.toContain('#define saturate');
        const macro = '#define saturate(a) clamp(a, 0.0, 1.0)\nvoid main() { gl_FragColor = vec4(saturate(2.0)); }';
        expect(injectShadertoyDefines(macro)).not.toContain('#ifndef saturate');
        const comment = '// saturate(x) would be nice\nvoid main() { gl_FragColor = vec4(1.0); }';
        expect(injectShadertoyDefines(comment)).not.toContain('saturate( a )');
    });
});

describe('prepareMainShader', () => {
    it('renames void main() and adds the fade wrapper', () => {
        const out = prepareMainShader(simpleShader);
        expect(out).toContain('uniform float iTransitionOpacity;');
        expect(out).toContain('void shaderamp_main_fade()');
        expect(out.match(/void main\(\)/g)?.length).toBe(1);
        expect(out).toContain('gl_FragColor *= iTransitionOpacity;');
    });

    it('is idempotent when iTransitionOpacity is already present', () => {
        const once = prepareMainShader(simpleShader);
        expect(prepareMainShader(once)).toBe(once);
    });

    it('adds the mainVR dispatch branch for VR shaders', () => {
        const vr = simpleShader + '\nvoid mainVR(out vec4 fragColor, in vec2 fragCoord, in vec3 ro, in vec3 rd) { fragColor = vec4(0.0); }\n';
        const out = prepareMainShader(vr);
        expect(out).toContain('uniform int iVRMode;');
        expect(out).toContain('if (iVRMode == 1)');
        expect(out).toContain('mainVR(gl_FragColor');
    });
});

describe('prepareBufferShader', () => {
    it('adds the define but no fade wrapper', () => {
        const out = prepareBufferShader(simpleShader);
        expect(out).toContain('#define HW_PERFORMANCE 1');
        expect(out).not.toContain('iTransitionOpacity');
        expect(out).toContain('void main()');
    });
});
