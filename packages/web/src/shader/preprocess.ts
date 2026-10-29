// Copied from ShaderAmp/src/helpers/vrShader.ts (see plan §5.7).

export const stripGlslComments = (src: string): string =>
    src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

export const hasMainVR = (code?: string | null): boolean =>
    !!code && /\bvoid\s+mainVR\s*\(/.test(stripGlslComments(code));

const VR_UNIFORM_DECLS = 'uniform int iVRMode;\nvarying vec3 vRayOri;\nvarying vec3 vRayDir;\n';

export function injectRuntimeWrappers(code: string): string {
    if (!code || code.includes('iTransitionOpacity')) return code;

    const isVR = hasMainVR(code);
    let processed = 'uniform float iTransitionOpacity;\n';
    if (isVR && !/\biVRMode\b/.test(stripGlslComments(code))) {
        processed += VR_UNIFORM_DECLS;
    }
    processed += code;
    processed = processed.replace(/\bvoid\s+main\s*\(\s*(void)?\s*\)/g, 'void shaderamp_main_fade()');
    if (isVR) {
        processed += '\nvoid main() {\n' +
            '    if (iVRMode == 1) { mainVR(gl_FragColor, vUv * iResolution.xy, vRayOri, normalize(vRayDir)); }\n' +
            '    else { shaderamp_main_fade(); }\n' +
            '    gl_FragColor *= iTransitionOpacity;\n' +
            '}\n';
    } else {
        processed += '\nvoid main() {\n    shaderamp_main_fade();\n    gl_FragColor *= iTransitionOpacity;\n}\n';
    }
    return processed;
}

// The extension renders through react-three-fiber, whose default tone mapping
// makes three.js prepend `#define saturate( a ) clamp( a, 0.0, 1.0 )` to every
// fragment shader. Bundled shaders rely on that, so provide it here too.
const SATURATE_DEFINE = '#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\n';

function needsSaturate(code: string): boolean {
    const src = stripGlslComments(code);
    if (!/\bsaturate\s*\(/.test(src)) return false;
    const defined = /#\s*define\s+saturate\b/.test(src) || /\b(?:float|vec[234])\s+saturate\s*\(/.test(src);
    return !defined;
}

export function injectShadertoyDefines(code: string): string {
    if (!code) return code;
    let out = code;
    if (needsSaturate(out)) out = SATURATE_DEFINE + out;
    if (!/#define\s+HW_PERFORMANCE\b/.test(out)) out = '#define HW_PERFORMANCE 1\n' + out;
    return out;
}

export function prepareMainShader(code: string): string {
    return injectRuntimeWrappers(injectShadertoyDefines(code));
}

export function prepareBufferShader(code: string): string {
    return injectShadertoyDefines(code);
}
