/**
 * WebXR / Shadertoy mainVR() support helpers.
 *
 * Shadertoy VR shaders define `mainVR(out fragColor, in fragCoord, in rayOri,
 * in rayDir)` alongside the regular `main`/`mainImage`. When such a shader is
 * rendered in an immersive session we swap in a per-eye ray vertex shader and
 * branch in the injected main() on the iVRMode uniform.
 */

export const stripGlslComments = (src: string): string =>
    src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

export const hasMainVR = (code?: string | null): boolean =>
    !!code && /\bvoid\s+mainVR\s*\(/.test(stripGlslComments(code));

/**
 * Fullscreen clip-space quad vertex shader that also computes a per-eye world
 * ray. three.js fills projectionMatrix/viewMatrix/cameraPosition from the XR
 * sub-camera of the ArrayCamera, so the same program works for both eyes.
 * `dirView * mat3(viewMatrix)` is transpose(rotation) * dirView — valid in
 * GLSL ES 1.0 where inverse()/transpose() don't exist.
 * Direction normalisation happens in the fragment wrapper.
 */
export const VR_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vRayOri;
varying vec3 vRayDir;
void main()
{
    vUv = uv;
    vec2 ndc = uv * 2.0 - 1.0;
    vec3 dirView = vec3((ndc.x + projectionMatrix[2][0]) / projectionMatrix[0][0],
                        (ndc.y + projectionMatrix[2][1]) / projectionMatrix[1][1],
                        -1.0);
    vRayDir = dirView * mat3(viewMatrix);
    vRayOri = cameraPosition;
    gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

const VR_UNIFORM_DECLS = 'uniform int iVRMode;\nvarying vec3 vRayOri;\nvarying vec3 vRayDir;\n';

/**
 * TypeScript twin of the VR_VERTEX_SHADER ray math, for tests and debugging.
 * `projElements`/`viewElements` are three.js column-major matrix elements.
 * In GLSL `v * M` means result[i] = dot(v, column_i(M)) = dirView.x*M[4i] +
 * dirView.y*M[4i+1] + dirView.z*M[4i+2]. Result is normalized (the fragment
 * wrapper also normalizes, this makes direct comparisons easier).
 */
export function eyeRayDirection(
    ndcX: number,
    ndcY: number,
    projElements: ArrayLike<number>,
    viewElements: ArrayLike<number>
): [number, number, number] {
    const dirView = [
        (ndcX + projElements[8]) / projElements[0],
        (ndcY + projElements[9]) / projElements[5],
        -1.0,
    ];
    const out: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        out[i] = dirView[0] * viewElements[i * 4]
            + dirView[1] * viewElements[i * 4 + 1]
            + dirView[2] * viewElements[i * 4 + 2];
    }
    const len = Math.hypot(out[0], out[1], out[2]) || 1;
    return [out[0] / len, out[1] / len, out[2] / len];
}

/**
 * Wrap a fragment shader with ShaderAmp's runtime scaffolding:
 *  - declares iTransitionOpacity and renames the shader's `void main()` to
 *    `shaderamp_main_fade()`, then appends a real main() that multiplies the
 *    output by the fade opacity;
 *  - when the shader also defines mainVR(), declares iVRMode + the ray
 *    varyings and appends a main() that dispatches to mainVR() when iVRMode
 *    is 1 (immersive VR session).
 * Returns the input unchanged when it already contains iTransitionOpacity
 * (matches the previous inline behaviour).
 */
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

/** Fixed widescreen aspect for the cinema screen + 2D render targets in VR. */
export const CINEMA_ASPECT = 16 / 9;

/**
 * Render size for non-mainVR (cinema) shaders during an XR session: keep the
 * eye buffer's width but use 16:9 so 2D shaders don't get squeezed into the
 * per-eye ~1:1 viewport shape.
 */
export function cinemaRenderSize(eye: { width: number; height: number }): { width: number; height: number } {
    return { width: Math.round(eye.width), height: Math.max(1, Math.round(eye.width / CINEMA_ASPECT)) };
}
