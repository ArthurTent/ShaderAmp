/**
 * SoundShaderEngine
 *
 * Plays back a Shadertoy "sound" pass converted by shadertoyConverter.
 * The converted fragment shader renders one audio sample per texel on the x
 * axis (samp = iSoundBlockOffset + int(gl_FragCoord.x)) and writes the stereo
 * result to RG of a float render target.
 *
 * Each block of samples is rendered with the shared WebGLRenderer, read back
 * and scheduled on the Web Audio timeline as an AudioBuffer ahead of
 * `LOOKAHEAD_SEC`. Output is routed to both the analyser (so iAudioData reacts
 * to the generated sound) and the speakers.
 */

import {
    FloatType,
    LinearFilter,
    Mesh,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Vector3,
    WebGLRenderTarget,
    WebGLRenderer,
} from "three";
import { logger } from '@src/helpers/logger';

// Samples rendered per GPU block. ~23 ms of audio at 44.1 kHz.
const BLOCK_SIZE = 1024;
// How far ahead of AudioContext.currentTime we keep buffers scheduled.
const LOOKAHEAD_SEC = 0.5;
// Producer loop cadence.
const TIMER_MS = 25;
// Extra initial latency before the first scheduled block.
const START_LATENCY_SEC = 0.15;

const SOUND_VERTEX_SHADER = `
varying vec2 vUv;
void main()
{
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`;

export class SoundShaderEngine {
    private gl: WebGLRenderer;
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private gainNode: GainNode | null = null;

    private scene: Scene | null = null;
    private camera: OrthographicCamera | null = null;
    private material: ShaderMaterial | null = null;
    private renderTarget: WebGLRenderTarget | null = null;

    private pixelBuffer: Float32Array;
    private sampleOffset = 0;
    private nextPlayTime = 0;
    private timer: ReturnType<typeof setInterval> | null = null;
    private disposed = false;

    constructor(gl: WebGLRenderer, audioContext: AudioContext, analyser: AnalyserNode, fragmentShader: string) {
        this.gl = gl;
        this.audioContext = audioContext;
        this.analyser = analyser;
        this.pixelBuffer = new Float32Array(BLOCK_SIZE * 4);

        this.renderTarget = new WebGLRenderTarget(BLOCK_SIZE, 1, {
            depthBuffer: false,
            stencilBuffer: false,
            type: FloatType,
        });
        this.renderTarget.texture.minFilter = LinearFilter;
        this.renderTarget.texture.magFilter = LinearFilter;
        this.renderTarget.texture.generateMipmaps = false;

        this.material = new ShaderMaterial({
            vertexShader: SOUND_VERTEX_SHADER,
            fragmentShader,
            uniforms: {
                iSampleRate: { value: audioContext.sampleRate },
                iSoundBlockOffset: { value: 0 },
                iResolution: { value: new Vector3(BLOCK_SIZE, 1, 1) },
            },
        });

        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.scene = new Scene();
        this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));

        this.gainNode = audioContext.createGain();
        this.gainNode.connect(this.analyser);
        this.gainNode.connect(audioContext.destination);
    }

    start() {
        if (this.timer) return;
        this.nextPlayTime = this.audioContext.currentTime + START_LATENCY_SEC;
        this.timer = setInterval(() => this.pump(), TIMER_MS);
        this.pump();
        logger.content.log('SoundShaderEngine', 'Started (sampleRate=%d, block=%d)', this.audioContext.sampleRate, BLOCK_SIZE);
    }

    dispose() {
        this.disposed = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        try { this.gainNode?.disconnect(); } catch (_) {}
        this.gainNode = null;
        this.material?.dispose();
        this.material = null;
        this.renderTarget?.dispose();
        this.renderTarget = null;
        this.scene = null;
        this.camera = null;
    }

    /** Render and schedule as many blocks as needed to stay LOOKAHEAD_SEC ahead. */
    private pump() {
        if (this.disposed || !this.renderTarget || !this.material || !this.scene || !this.camera || !this.gainNode) return;

        const ctx = this.audioContext;
        const blockDuration = BLOCK_SIZE / ctx.sampleRate;

        // Underrun: drop the missed samples instead of playing them in a burst.
        if (this.nextPlayTime < ctx.currentTime) {
            const droppedBlocks = Math.ceil((ctx.currentTime - this.nextPlayTime) / blockDuration);
            if (droppedBlocks > 0) {
                this.sampleOffset += droppedBlocks * BLOCK_SIZE;
            }
            this.nextPlayTime = ctx.currentTime + 0.02;
        }

        while (this.nextPlayTime < ctx.currentTime + LOOKAHEAD_SEC) {
            const samples = this.renderBlock(this.sampleOffset);
            if (!samples) return;

            const audioBuffer = ctx.createBuffer(2, BLOCK_SIZE, ctx.sampleRate);
            audioBuffer.copyToChannel(samples.left, 0);
            audioBuffer.copyToChannel(samples.right, 1);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.gainNode);
            source.start(this.nextPlayTime);

            this.nextPlayTime += blockDuration;
            this.sampleOffset += BLOCK_SIZE;
        }
    }

    /** Render one block of BLOCK_SIZE stereo samples starting at `offset`. */
    private renderBlock(offset: number): { left: Float32Array<ArrayBuffer>; right: Float32Array<ArrayBuffer> } | null {
        const rt = this.renderTarget!;
        this.material!.uniforms.iSoundBlockOffset.value = offset;

        const previousTarget = this.gl.getRenderTarget();
        try {
            this.gl.setRenderTarget(rt);
            this.gl.render(this.scene!, this.camera!);
            this.gl.readRenderTargetPixels(rt, 0, 0, BLOCK_SIZE, 1, this.pixelBuffer);
        } catch (e) {
            logger.content.error('SoundShaderEngine', 'Render block failed: %s', e);
            return null;
        } finally {
            this.gl.setRenderTarget(previousTarget);
        }

        const left = new Float32Array(BLOCK_SIZE);
        const right = new Float32Array(BLOCK_SIZE);
        for (let i = 0; i < BLOCK_SIZE; i++) {
            left[i] = this.pixelBuffer[i * 4];
            right[i] = this.pixelBuffer[i * 4 + 1];
        }
        return { left, right };
    }
}
