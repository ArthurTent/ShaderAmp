import {
    Mesh,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Vector2,
    WebGLRenderTarget,
    WebGLRenderer,
} from 'three';

// 1:1 texel copy: pixel (x,y) keeps its value, the area outside the old size becomes 0.
// Shadertoy keeps buffer contents the same way when the canvas is resized, so shaders that
// store state at fixed pixels (feedback buffers, camera state, simulations) survive a resize.
const COPY_FRAGMENT = `
uniform sampler2D src;
uniform vec2 srcSize;
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    gl_FragColor = (float(p.x) < srcSize.x && float(p.y) < srcSize.y) ? texelFetch(src, p, 0) : vec4(0.0);
}
`;

let copyScene: Scene | null = null;
let copyMaterial: ShaderMaterial | null = null;
let copyCamera: OrthographicCamera | null = null;

function getCopyPass() {
    if (!copyScene || !copyMaterial || !copyCamera) {
        copyMaterial = new ShaderMaterial({
            vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
            fragmentShader: COPY_FRAGMENT,
            uniforms: { src: { value: null }, srcSize: { value: new Vector2() } },
            depthTest: false,
            depthWrite: false,
        });
        copyScene = new Scene();
        copyScene.add(new Mesh(new PlaneGeometry(2, 2), copyMaterial));
        copyCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    return { scene: copyScene, material: copyMaterial, camera: copyCamera };
}

function copyInto(renderer: WebGLRenderer, from: WebGLRenderTarget, to: WebGLRenderTarget) {
    const { scene, material, camera } = getCopyPass();
    material.uniforms.src.value = from.texture;
    material.uniforms.srcSize.value.set(from.width, from.height);
    renderer.setRenderTarget(to);
    renderer.render(scene, camera);
    material.uniforms.src.value = null;
}

/**
 * Resize a render target while keeping its contents (1:1, bottom-left anchored).
 * WebGLRenderTarget.setSize() alone discards the GPU texture, wiping feedback-buffer state.
 * Requires WebGL2 (texelFetch); falls back to a plain resize otherwise.
 */
export function resizeRenderTargetPreserving(renderer: WebGLRenderer, target: WebGLRenderTarget, width: number, height: number): void {
    if (target.width === width && target.height === height) return;
    if (!renderer.capabilities.isWebGL2) {
        target.setSize(width, height);
        return;
    }
    const prevTarget = renderer.getRenderTarget();
    const autoClearWas = renderer.autoClear;
    renderer.autoClear = false;
    const temp = new WebGLRenderTarget(target.width, target.height, {
        type: target.texture.type,
        format: target.texture.format,
        depthBuffer: false,
        stencilBuffer: false,
    });
    try {
        copyInto(renderer, target, temp);
        target.setSize(width, height);
        copyInto(renderer, temp, target);
    } finally {
        temp.dispose();
        renderer.setRenderTarget(prevTarget);
        renderer.autoClear = autoClearWas;
    }
}
