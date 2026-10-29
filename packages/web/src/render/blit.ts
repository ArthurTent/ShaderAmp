import { Mesh, PlaneGeometry, Scene, ShaderMaterial } from 'three';
import type { Camera, Texture, WebGLRenderer } from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tSource;
varying vec2 vUv;
void main() {
    gl_FragColor = vec4(texture2D(tSource, vUv).rgb, 1.0);
}`;

/** Draws a texture over the whole current render target (used to upscale a low-res pass). */
export class Blitter {
    private scene = new Scene();
    private geometry = new PlaneGeometry(2, 2);
    private material = new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { tSource: { value: null } },
        depthTest: false,
        depthWrite: false,
    });

    constructor() {
        const mesh = new Mesh(this.geometry, this.material);
        mesh.frustumCulled = false;
        this.scene.add(mesh);
    }

    render(renderer: WebGLRenderer, camera: Camera, source: Texture): void {
        this.material.uniforms.tSource.value = source;
        renderer.render(this.scene, camera);
    }

    dispose(): void {
        this.material.dispose();
        this.geometry.dispose();
    }
}
