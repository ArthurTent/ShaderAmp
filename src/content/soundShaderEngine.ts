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
 *
 * Sound passes may read other passes (Shadertoy sound inputs, e.g. iChannel0 =
 * Buffer A). A `channelResolver` returns the texture to bind per channel; it is
 * queried before every block, so the audio follows the buffer's live contents.
 * In that mode a shorter block/lookahead is used to keep the latency low, and
 * the sample clock is locked to the image passes' iTime (via `getShaderTime`),
 * because such shaders compare mainSound's `time` against iTime stamps written
 * by a buffer (e.g. key press times).
 */

import {
    FloatType,
    LinearFilter,
    Mesh,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Texture,
    Vector3,
    WebGLRenderTarget,
    WebGLRenderer,
} from "three";
import { logger } from '@src/helpers/logger';

// Samples rendered per GPU block. ~23 ms of audio at 44.1 kHz.
const BLOCK_SIZE = 1024;
// How far ahead of AudioContext.currentTime we keep buffers scheduled.
const LOOKAHEAD_SEC = 0.5;
// Interactive mode (sound pass reads live buffers): smaller blocks, less lookahead.
const INTERACTIVE_BLOCK_SIZE = 512;
const INTERACTIVE_LOOKAHEAD_SEC = 0.08;
const INTERACTIVE_TIMER_MS = 10;
// Interactive mode: resync the sample clock to iTime when it drifts further than this.
const SHADER_TIME_MAX_DRIFT_SEC = 0.05;
// Producer loop cadence.
const TIMER_MS = 25;

export type SoundChannelUniform = 'iChannel0' | 'iChannel1' | 'iChannel2' | 'iChannel3' | 'iKeyboard';
export type SoundChannelResolver = (uniform: SoundChannelUniform) => Texture | null | undefined;
/** Latest iTime sample from the render loop, with the AudioContext time it was taken at. */
export type ShaderTimeSample = { iTime: number; audioTime: number };
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
    private channelResolver?: SoundChannelResolver;
    private blockSize: number;
    private lookaheadSec: number;
    private getShaderTime?: () => ShaderTimeSample | undefined;
    private lastShaderTime: number | null = null;

    constructor(
        gl: WebGLRenderer,
        audioContext: AudioContext,
        analyser: AnalyserNode,
        fragmentShader: string,
        channelResolver?: SoundChannelResolver,
        getShaderTime?: () => ShaderTimeSample | undefined
    ) {
        this.gl = gl;
        this.audioContext = audioContext;
        this.analyser = analyser;
        this.channelResolver = channelResolver;
        this.getShaderTime = getShaderTime;
        this.blockSize = channelResolver ? INTERACTIVE_BLOCK_SIZE : BLOCK_SIZE;
        this.lookaheadSec = channelResolver ? INTERACTIVE_LOOKAHEAD_SEC : LOOKAHEAD_SEC;
        const size = this.blockSize;
        this.pixelBuffer = new Float32Array(size * 4);

        this.renderTarget = new WebGLRenderTarget(size, 1, {
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
                iResolution: { value: new Vector3(size, 1, 1) },
                iChannel0: { value: null },
                iChannel1: { value: null },
                iChannel2: { value: null },
                iChannel3: { value: null },
                iKeyboard: { value: null },
                iChannelResolution: { value: [new Vector3(), new Vector3(), new Vector3(), new Vector3()] },
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
        this.timer = setInterval(() => this.pump(), this.channelResolver ? INTERACTIVE_TIMER_MS : TIMER_MS);
        this.pump();
        logger.content.log('SoundShaderEngine', 'Started (sampleRate=%d, block=%d, inputs=%s)', this.audioContext.sampleRate, this.blockSize, !!this.channelResolver);
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
        const BLOCK_SIZE = this.blockSize;
        const blockDuration = BLOCK_SIZE / ctx.sampleRate;

        // Underrun: drop the missed samples instead of playing them in a burst.
        if (this.nextPlayTime < ctx.currentTime) {
            const droppedBlocks = Math.ceil((ctx.currentTime - this.nextPlayTime) / blockDuration);
            if (droppedBlocks > 0) {
                this.sampleOffset += droppedBlocks * BLOCK_SIZE;
            }
            this.nextPlayTime = ctx.currentTime + 0.02;
        }

        this.syncToShaderTime();

        while (this.nextPlayTime < ctx.currentTime + this.lookaheadSec) {
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

    /**
     * Keep the sample clock on iTime: the block scheduled at `nextPlayTime`
     * must carry the iTime the image passes will have at that moment. Only
     * resyncs while iTime advances (a paused/gated clock would loop the audio).
     */
    private syncToShaderTime() {
        const sample = this.getShaderTime?.();
        if (!sample || !Number.isFinite(sample.iTime)) return;
        const advancing = this.lastShaderTime === null || sample.iTime !== this.lastShaderTime;
        const firstSync = this.lastShaderTime === null;
        this.lastShaderTime = sample.iTime;
        if (!advancing) return;

        const ctx = this.audioContext;
        const iTimeNow = sample.iTime + Math.max(0, ctx.currentTime - sample.audioTime);
        const expectedTime = iTimeNow + (this.nextPlayTime - ctx.currentTime);
        const currentTime = this.sampleOffset / ctx.sampleRate;
        if (firstSync || Math.abs(expectedTime - currentTime) > SHADER_TIME_MAX_DRIFT_SEC) {
            this.sampleOffset = Math.max(0, Math.round(expectedTime * ctx.sampleRate));
        }
    }

    /** Bind the current textures of the passes this sound pass reads. */
    private bindChannels() {
        if (!this.channelResolver || !this.material) return;
        const u = this.material.uniforms;
        const res = u.iChannelResolution.value as Vector3[];
        for (let i = 0; i < 4; i++) {
            const tex = this.channelResolver(`iChannel${i}` as SoundChannelUniform) ?? null;
            u[`iChannel${i}`].value = tex;
            const img: any = tex ? (tex as any).image : null;
            if (img) res[i].set(img.width || 0, img.height || 0, img.depth || 1);
        }
        u.iKeyboard.value = this.channelResolver('iKeyboard') ?? null;
    }

    /** Render one block of BLOCK_SIZE stereo samples starting at `offset`. */
    private renderBlock(offset: number): { left: Float32Array<ArrayBuffer>; right: Float32Array<ArrayBuffer> } | null {
        const BLOCK_SIZE = this.blockSize;
        const rt = this.renderTarget!;
        this.material!.uniforms.iSoundBlockOffset.value = offset;
        this.bindChannels();

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
