import { stripGlslComments, hasMainVR, VR_VERTEX_SHADER, injectRuntimeWrappers, eyeRayDirection, cinemaRenderSize, CINEMA_ASPECT } from './vrShader';
import { PerspectiveCamera, Vector3 } from 'three';

describe('stripGlslComments', () => {
    it('removes line and block comments', () => {
        const src = 'int a; // void mainVR(\n/* void mainVR( */\nint b;';
        const stripped = stripGlslComments(src);
        expect(stripped).not.toContain('mainVR');
        expect(stripped).toContain('int a;');
        expect(stripped).toContain('int b;');
    });
});

describe('hasMainVR', () => {
    it('detects a real mainVR definition', () => {
        const code = 'void mainVR( out vec4 c, in vec2 f, in vec3 o, in vec3 d ) { }';
        expect(hasMainVR(code)).toBe(true);
    });

    it('ignores mainVR inside comments', () => {
        expect(hasMainVR('/*\nvoid mainVR( out vec4 c, in vec2 f, in vec3 o, in vec3 d ) {}\n*/\nvoid main() {}')).toBe(false);
        expect(hasMainVR('// void mainVR( out vec4 c, in vec2 f, in vec3 o, in vec3 d )\nvoid main() {}')).toBe(false);
    });

    it('ignores names that only start with mainVR', () => {
        expect(hasMainVR('void mainVRx( out vec4 c ) {}')).toBe(false);
    });

    it('returns false for null/undefined/empty', () => {
        expect(hasMainVR(undefined)).toBe(false);
        expect(hasMainVR(null)).toBe(false);
        expect(hasMainVR('')).toBe(false);
    });
});

describe('injectRuntimeWrappers', () => {
    const sampleShader = 'varying vec2 vUv;\nvoid main() {\n    gl_FragColor = vec4(1.0);\n}\n';

    // The algorithm as it existed inline in AnalyzerMesh before extraction
    const legacyWrap = (code: string): string => {
        let processed = 'uniform float iTransitionOpacity;\n' + code;
        processed = processed.replace(/\bvoid\s+main\s*\(\s*(void)?\s*\)/g, 'void shaderamp_main_fade()');
        processed += '\nvoid main() {\n    shaderamp_main_fade();\n    gl_FragColor *= iTransitionOpacity;\n}\n';
        return processed;
    };

    it('produces byte-identical output to the old algorithm for non-VR shaders', () => {
        expect(injectRuntimeWrappers(sampleShader)).toBe(legacyWrap(sampleShader));
    });

    it('returns code unchanged when iTransitionOpacity is already present', () => {
        const already = 'uniform float iTransitionOpacity;\nvoid main() {}';
        expect(injectRuntimeWrappers(already)).toBe(already);
    });

    it('injects iVRMode dispatch for mainVR shaders', () => {
        const vrShader = 'varying vec2 vUv;\nvoid mainVR( out vec4 c, in vec2 f, in vec3 o, in vec3 d ) { c = vec4(0.5); }\nvoid main() { gl_FragColor = vec4(0.0); }\n';
        const out = injectRuntimeWrappers(vrShader);
        expect(out).toContain('uniform int iVRMode;');
        expect(out).toContain('varying vec3 vRayOri;');
        expect(out).toContain('varying vec3 vRayDir;');
        expect(out).toContain('shaderamp_main_fade()');
        expect(out).toContain('mainVR(gl_FragColor, vUv * iResolution.xy, vRayOri, normalize(vRayDir))');
        // exactly one real void main()
        expect((out.match(/\bvoid\s+main\s*\(/g) || [])).toHaveLength(1);
        // original main renamed, mainVR left intact
        expect(out).toContain('void shaderamp_main_fade()');
        expect(out).toContain('void mainVR(');
    });

    it('does not double-declare iVRMode when the shader declares it', () => {
        const vrShader = 'uniform int iVRMode;\nvarying vec2 vUv;\nvoid mainVR( out vec4 c, in vec2 f, in vec3 o, in vec3 d ) {}\nvoid main() {}\n';
        const out = injectRuntimeWrappers(vrShader);
        expect((out.match(/uniform\s+int\s+iVRMode/g) || [])).toHaveLength(1);
    });

    it('does not emit the VR branch when mainVR is only commented out', () => {
        const code = 'varying vec2 vUv;\n/* void mainVR( out vec4 c, in vec2 f, in vec3 o, in vec3 d ) {} */\nvoid main() {}\n';
        const out = injectRuntimeWrappers(code);
        expect(out).not.toContain('iVRMode == 1');
        expect(out).toBe(legacyWrap(code));
    });
});

describe('VR_VERTEX_SHADER', () => {
    it('is a fullscreen clip-space quad with ray varyings', () => {
        expect(VR_VERTEX_SHADER).toContain('varying vec3 vRayOri;');
        expect(VR_VERTEX_SHADER).toContain('varying vec3 vRayDir;');
        expect(VR_VERTEX_SHADER).toContain('projectionMatrix');
        expect(VR_VERTEX_SHADER).toContain('viewMatrix');
        expect(VR_VERTEX_SHADER).toContain('gl_Position = vec4(ndc, 0.0, 1.0)');
        expect(VR_VERTEX_SHADER).toContain('ndc.x + projectionMatrix[2][0]');
        expect(VR_VERTEX_SHADER).toContain('ndc.y + projectionMatrix[2][1]');
    });
});

describe('eyeRayDirection', () => {
    it('matches three.js Vector3.unproject on an asymmetric (XR-style) frustum', () => {
        const camera = new PerspectiveCamera();
        camera.position.set(0.03, 1.6, 0);
        camera.rotation.set(0.2, 0.5, 0);
        camera.updateMatrixWorld(true);
        camera.projectionMatrix.makePerspective(-0.09, 0.07, 0.08, -0.08, 0.1, 1000);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

        for (const [x, y] of [[-1, -1], [0, 0], [0.7, -0.3], [1, 1]]) {
            const expected = new Vector3(x, y, 1)
                .unproject(camera)
                .sub(camera.position)
                .normalize();
            const actual = eyeRayDirection(
                x, y,
                camera.projectionMatrix.elements,
                camera.matrixWorldInverse.elements
            );
            expect(actual[0]).toBeCloseTo(expected.x, 5);
            expect(actual[1]).toBeCloseTo(expected.y, 5);
            expect(actual[2]).toBeCloseTo(expected.z, 5);
        }
    });
});

describe('cinemaRenderSize', () => {
    it('converts a near-square eye viewport to 16:9 at the same width', () => {
        const size = cinemaRenderSize({ width: 1832, height: 1920 });
        expect(size).toEqual({ width: 1832, height: 1031 });
        expect(size.width / size.height).toBeCloseTo(CINEMA_ASPECT, 2);
    });

    it('clamps height to at least 1 for tiny inputs', () => {
        expect(cinemaRenderSize({ width: 1, height: 1 }).height).toBeGreaterThanOrEqual(1);
    });
});
