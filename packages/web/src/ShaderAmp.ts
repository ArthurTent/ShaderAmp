import {
    ClampToEdgeWrapping,
    FloatType,
    HalfFloatType,
    LinearFilter,
    LinearSRGBColorSpace,
    OrthographicCamera,
    Scene,
    Vector2,
    VideoTexture,
    WebGLRenderer,
    WebGLRenderTarget,
} from 'three';
import type { Texture } from 'three';
import { AudioInput, isCrossOriginUrl } from './audio/AudioInput';
import { ForegroundCompositor } from './render/foreground';
import { Blitter } from './render/blit';
import { Catalog, normalizeShaderInput } from './assets/catalog';
import { resolveAssetUrl } from './assets/assetUrl';
import {
    DEFAULT_ASSET_BASE_URL,
    DEFAULT_SHADER,
    FADE_DURATION,
    MAX_FRAME_DELTA,
    MIDI_FFT_DECAY,
    MIDI_FFT_INJECTION_BINS,
    MIDI_TEXTURE_WIDTH,
} from './constants';
import { EventEmitter } from './events';
import { attachKeyboard } from './input/keyboard';
import { attachMouse } from './input/mouse';
import { MediaRegistry } from './media/MediaRegistry';
import type { MediaEntry } from './media/MediaRegistry';
import { MidiMapper } from './midi/MidiMapper';
import { MidiService } from './midi/midiService';
import { getPipMode, PipController } from './pip/pip';
import { importScenePackage, isSceneGraph, packagedToShaderObject } from './scene/scenePackage';
import { ScenePlayer } from './scene/ScenePlayer';
import { createControls } from './ui/controls';
import { AudioGate, averageLevel, BeatDetector, computeRate, stepTimes, wrappedDiff, wrapTime } from './render/clock';
import { FpsMeter, formatCredits, formatFps, Hud } from './render/hud';
import { SoundShaderEngine } from './audio/SoundShaderEngine';
import type { SoundChannelResolver, ShaderTimeSample } from './audio/SoundShaderEngine';
import { injectShadertoyDefines } from './shader/preprocess';
import { createSharedUniforms, getDateVector } from './shader/uniforms';
import type { SharedUniforms } from './shader/uniforms';
import { ShaderProgram } from './shader/ShaderProgram';
import { getBlackTexture } from './textures/TextureCache';
import { createFallbackVideoTexture } from './textures/fallbackVideo';
import type {
    AudioSourceInput,
    ForegroundOptions,
    LiveOptions,
    MidiInputInfo,
    MidiMappings,
    OverlayBlendMode,
    OverlayState,
    SceneGraph,
    ScenePlayMode,
    ShaderAmpEvents,
    ShaderAmpOptions,
    ShaderInput,
    ShaderObject,
} from './types';

type VideoBinding =
    | { kind: 'black' }
    | { kind: 'fallback'; fb: ReturnType<typeof createFallbackVideoTexture> }
    | { kind: 'video'; texture: VideoTexture; element: HTMLVideoElement; internal: boolean; cancelled: boolean };

type FrameHandle = { type: 'raf'; id: number; win: Window } | { type: 'timeout'; id: ReturnType<typeof setTimeout> };

export class ShaderAmp {
    readonly canvas: HTMLCanvasElement;
    readonly root: HTMLElement | null;

    private renderer: WebGLRenderer;
    private scene = new Scene();
    private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private shared: SharedUniforms;
    private audio: AudioInput;
    private catalog: Catalog;
    private emitter = new EventEmitter<ShaderAmpEvents>();

    private current: ShaderProgram | null = null;
    private previous: ShaderProgram | null = null;
    private fadeT = 0;
    private loadToken = 0;

    private opts: Required<Pick<ShaderAmpOptions, 'renderScale' | 'maxPixelRatio' | 'speedDivider' | 'volumeAmplifier' | 'trackSync' | 'amplifiedTime' | 'showCredits' | 'showFps' | 'soundBuffer' | 'soundOutput' | 'videoFollowTime'>> & {
        fadeDuration: number | null;
        videoTexture: NonNullable<ShaderAmpOptions['videoTexture']>;
        mediaBaseUrl?: string;
        assetBaseUrl: string;
        pauseWhenHidden: boolean;
        size: { width: number; height: number } | null;
        frameLoop: 'raf' | 'timer';
        frameRate: number;
    };

    private fftArray: Uint8Array;
    private beatDetector = new BeatDetector();
    private mouse: ReturnType<typeof attachMouse> | null = null;
    private keyboard: ReturnType<typeof attachKeyboard> | null = null;

    private video: VideoBinding = { kind: 'black' };
    private internalVideo: HTMLVideoElement | null = null;
    private internalVideoUrl: string | null = null;
    private videoRvfc = false;

    // Sound pass (Shadertoy sound tab) + displayed-clock sample for its iTime lock
    private soundEngine: SoundShaderEngine | null = null;
    private soundToken = 0;
    private shaderTime: ShaderTimeSample | undefined;
    private audioGate = new AudioGate(false);
    private hud: Hud | null = null;
    private fpsMeter = new FpsMeter();
    private lastVideoSyncMs = 0;

    private customUniformValues = new Map<string, Record<string, number | number[] | boolean>>();

    private running = false;
    private visible = true;
    private frameHandle: FrameHandle | null = null;
    private lastFrameMs = 0;
    private resizeObserver: ResizeObserver | null = null;
    private intersectionObserver: IntersectionObserver | null = null;
    private destroyed = false;
    private bufferSize = { width: 1, height: 1 };
    private pip: PipController;
    private controls: ReturnType<typeof createControls> | null = null;

    // Scenes / MIDI / overlays
    private scenePlayer: ScenePlayer;
    private mediaRegistry = new MediaRegistry();
    private sceneShaders = new Map<string, ShaderObject>();
    private catalogCache: ShaderObject[] | null = null;
    private midiService: MidiService | null = null;
    private midiMapper: MidiMapper;
    private midiUnsub: (() => void) | null = null;
    private midiMappings: MidiMappings = [];
    private midiActive = false;
    private midiFftInjection = new Float32Array(MIDI_FFT_INJECTION_BINS);
    private timeDomainArray: Uint8Array | null = null;
    private overlayProgram: ShaderProgram | null = null;
    private overlayLoadToken = 0;
    private desiredOverlay: OverlayState | null = null;
    private foreground: ForegroundCompositor | null = null;
    private lastAudioLevel = 0;
    /** RMS of the time-domain signal (0–128), the scene graph's audio level. */
    private lastRmsLevel = 0;
    /** Wait-for-audio gate state of the previous frame (gate-open edge detection). */
    private wasTimeGated = false;
    // Fixed-size mode with renderScale < 1: the shader renders here, then is upscaled.
    private screenTarget: WebGLRenderTarget | null = null;
    private blitter: Blitter | null = null;
    private outputSize = { width: 1, height: 1 };
    private adaptive: {
        min: number;
        max: number;
        fps: number;
        gpuFps: number;
        probe: { sync: WebGLSync; t: number } | null;
        lastChange: number;
        ceiling: number;
        ceilingUntil: number;
    } | null = null;

    private constructor(options: ShaderAmpOptions) {
        if (!!options.container === !!options.canvas) {
            throw new Error('Provide exactly one of container or canvas');
        }
        if (!ShaderAmp.isSupported()) {
            throw new Error('WebGL2 is required');
        }

        if (options.container) {
            const root = document.createElement('div');
            root.className = 'shaderamp-root';
            root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;background:#000';
            this.canvas = document.createElement('canvas');
            this.canvas.style.cssText = 'display:block;width:100%;height:100%';
            root.appendChild(this.canvas);
            options.container.appendChild(root);
            this.root = root;
        } else {
            this.canvas = options.canvas!;
            this.root = null;
            if (options.controls) {
                console.warn('[shaderamp] controls require container mode');
            }
        }

        const fade = options.fade ?? true;
        this.opts = {
            renderScale: options.renderScale ?? 0.75,
            maxPixelRatio: options.maxPixelRatio ?? 2,
            speedDivider: options.speedDivider ?? 25,
            volumeAmplifier: options.volumeAmplifier ?? 1,
            fadeDuration: fade === false ? null : typeof fade === 'object' ? fade.duration ?? FADE_DURATION : FADE_DURATION,
            videoTexture: options.videoTexture ?? 'auto',
            mediaBaseUrl: options.mediaBaseUrl,
            assetBaseUrl: options.assetBaseUrl ?? DEFAULT_ASSET_BASE_URL,
            pauseWhenHidden: options.pauseWhenHidden ?? true,
            trackSync: options.trackSync ?? false,
            amplifiedTime: options.amplifiedTime ?? true,
            size: options.size ?? null,
            frameLoop: options.frameLoop ?? 'raf',
            frameRate: options.frameRate ?? 30,
            showCredits: options.showCredits ?? false,
            showFps: options.showFps ?? false,
            soundBuffer: options.soundBuffer ?? true,
            soundOutput: options.soundOutput ?? true,
            videoFollowTime: options.videoFollowTime ?? false,
        };
        this.audioGate.setEnabled(options.waitForAudio ?? false);

        this.renderer = new WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
        });
        this.renderer.autoClear = false;
        this.renderer.outputColorSpace = LinearSRGBColorSpace;
        // GLSL errors surface at first render, not in loadShader(): report them
        // as 'error' events so callers can fall back to another shader.
        this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
            const log = [gl.getShaderInfoLog(fs), gl.getShaderInfoLog(vs), gl.getProgramInfoLog(program)]
                .map((l) => l?.trim())
                .filter(Boolean)
                .join('\n') || 'unknown error';
            console.error(`[shaderamp] shader compile error (${this.current?.shader.shaderName ?? '?'}):\n${log}`);
            this.emitter.emit('error', { error: new Error(`Shader compile error: ${log}`), phase: 'shader' });
        };

        this.audio = new AudioInput({
            audioContext: options.audioContext,
            volumeAmplifier: this.opts.volumeAmplifier,
            connectToDestination: options.connectToDestination,
            eqGains: options.eqGains,
        });
        this.audio.setSource(options.source ?? null);

        this.shared = createSharedUniforms(this.audio.sampleRate);
        this.fftArray = (this.shared.iAudioData.value as any).image.data;

        if (options.mouse !== false) {
            this.mouse = attachMouse(this.canvas, this.shared.iMouse.value, () => this.bufferSize);
        }

        const kbData = (this.shared.iKeyboard.value as any).image.data as Float32Array<ArrayBuffer>;
        const kbMode = options.keyboard ?? 'canvas';
        if (kbMode === 'canvas') {
            if (!this.canvas.hasAttribute('tabindex')) this.canvas.tabIndex = 0;
            this.canvas.style.outline = 'none';
            this.keyboard = attachKeyboard(this.canvas, kbData);
        } else if (kbMode === 'window') {
            this.keyboard = attachKeyboard(window, kbData);
        }

        this.catalog = new Catalog(this.opts.assetBaseUrl);

        this.scenePlayer = new ScenePlayer({
            resolveShader: (ref) => this.resolveShaderRef(ref),
            activateShader: (shader) => this.loadShaderInternal(shader, false),
            applyUniforms: (shaderName, values) => this.applyShaderUniforms(shaderName, values),
            getUniform: (shaderName, name) => this.customUniformValues.get(shaderName)?.[name],
            currentShaderName: () => this.current?.shader.shaderName,
            setOverlay: (state) => this.applyOverlayState(state),
            resetShaderClock: () => this.resetTime(),
            onEnterNode: (scene, node) => this.emitter.emit('scenenode', { scene, node }),
            onStateChange: (scene, playing) => this.emitter.emit('scenechange', { scene, playing }),
        });
        for (const scene of options.scenes ?? []) this.scenePlayer.addScene(scene);

        this.midiMapper = new MidiMapper({
            prevShader: () => void this.prev(),
            nextShader: () => void this.next(),
            resetTime: () => this.resetTime(),
            setOption: (key, value) => {
                if (key === 'fade') this.setOptions({ fade: value as boolean });
                else if (key === 'renderScale') this.setOptions({ renderScale: value as number });
                else if (key === 'speedDivider') this.setOptions({ speedDivider: value as number });
                else this.setOptions({ volumeAmplifier: value as number });
            },
            getOption: (key) => (key === 'fade' ? this.opts.fadeDuration !== null : this.opts[key]),
            setUniform: (name, value) => this.setUniform(name, value),
            getUniform: (name) => {
                const shaderName = this.current?.shader.shaderName;
                return shaderName ? this.customUniformValues.get(shaderName)?.[name] : undefined;
            },
            selectShader: (ref) => void this.selectShaderByRef(ref),
            playScene: (id) => void this.playScene(id),
            stopScene: () => void this.stopScene(),
            toggleScenePause: () => void this.toggleScenePause(),
            overlay: (msg) => void this.scenePlayer.manualOverlayAction(msg),
            injectFft: (bin, value) => {
                if (bin < this.midiFftInjection.length) this.midiFftInjection[bin] = value;
            },
            frequencyBins: () => this.fftArray.length,
            midiState: (this.shared.iMidi.value as any).image.data as Uint8Array,
        });

        if (options.foreground) this.foreground = new ForegroundCompositor(options.foreground);
        if (options.adaptiveScale) {
            const min = typeof options.adaptiveScale === 'object' ? options.adaptiveScale.min ?? 0.25 : 0.25;
            const max = this.opts.renderScale;
            this.adaptive = { min: Math.min(min, max), max, fps: 0, gpuFps: 0, probe: null, lastChange: 0, ceiling: max, ceilingUntil: 0 };
        }

        this.resize();
        this.shared.iMouse.value.set(this.bufferSize.width / 2, this.bufferSize.height / 2, 0, 0);
        this.resolveVideoTexture();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.root ?? this.canvas);

        if (this.opts.pauseWhenHidden && typeof IntersectionObserver !== 'undefined') {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                const was = this.visible;
                // Never pause while in PiP — the IO can't see the element in the PiP document.
                this.visible = this.pip.active || entries.some((e) => e.isIntersecting);
                if (this.visible && !was && this.running) this.scheduleFrame();
            });
            this.intersectionObserver.observe(this.root ?? this.canvas);
        }

        this.pip = new PipController({
            element: this.root ?? this.canvas,
            canvas: this.canvas,
            onResize: () => this.resize(),
            onEnter: (mode) => {
                this.visible = true;
                this.emitter.emit('pipenter', { mode });
                if (this.running) this.scheduleFrame();
            },
            onExit: () => {
                this.resize();
                this.emitter.emit('pipexit', undefined);
            },
        });

        if (options.controls && this.root) {
            const c = options.controls;
            this.controls = createControls(this.root, this, c === true ? { pip: true, fullscreen: true, navigation: true, credits: true } : c);
        }

        this.canvas.addEventListener('webglcontextlost', this.onContextLost);
        this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    }

    static async create(options: ShaderAmpOptions): Promise<ShaderAmp> {
        const amp = new ShaderAmp(options);
        try {
            await amp.loadShaderInternal(options.shader ?? DEFAULT_SHADER, true);
        } catch (err) {
            amp.destroy();
            throw err;
        }
        // Warm the synchronous shader-ref cache used by scenes/MIDI.
        amp.catalog.load().then((l) => { amp.catalogCache = l; }).catch(() => {});
        if (options.midi) {
            const mappings = typeof options.midi === 'object' ? options.midi.mappings : undefined;
            amp.enableMidi(mappings).catch((err) =>
                amp.emitter.emit('error', { error: err as Error, phase: 'midi' }));
        }
        amp.emitter.emit('ready', undefined);
        if (options.autoStart !== false) amp.start();
        return amp;
    }

    static isSupported(): boolean {
        try {
            return !!document.createElement('canvas').getContext('webgl2');
        } catch {
            return false;
        }
    }

    static isPictureInPictureSupported(): boolean {
        try {
            return getPipMode(window, 'auto') !== null;
        } catch {
            return false;
        }
    }

    get currentShader(): ShaderObject | null {
        return this.current?.shader ?? null;
    }

    get analyser(): AnalyserNode | null {
        return this.audio.analyser;
    }

    get audioContext(): AudioContext | null {
        return this.audio.context;
    }

    get isPictureInPicture(): boolean {
        return this.pip.active;
    }

    on<K extends keyof ShaderAmpEvents>(e: K, cb: (p: ShaderAmpEvents[K]) => void): () => void {
        return this.emitter.on(e, cb);
    }

    off<K extends keyof ShaderAmpEvents>(e: K, cb: (p: ShaderAmpEvents[K]) => void): void {
        this.emitter.off(e, cb);
    }

    setSource(input: AudioSourceInput): void {
        this.audio.setSource(input);
        this.shared.iSampleRate.value = this.audio.sampleRate;
        this.resolveVideoTexture();
        // The sound pass feeds the analyser, which is rebuilt per source.
        void this.syncSoundEngine();
    }

    resumeAudio(): Promise<void> {
        return this.audio.resume();
    }

    async listShaders(): Promise<ShaderObject[]> {
        return this.catalog.load();
    }

    setUniform(name: string, value: number | number[] | boolean): void {
        const shaderName = this.current?.shader.shaderName;
        if (!shaderName) return;
        const record = this.customUniformValues.get(shaderName) ?? {};
        record[name] = value;
        this.customUniformValues.set(shaderName, record);
        this.current?.setUniform(name, value);
    }

    setOptions(partial: LiveOptions): void {
        if (partial.renderScale !== undefined) {
            this.opts.renderScale = partial.renderScale;
            if (this.adaptive) {
                this.adaptive.max = partial.renderScale;
                this.adaptive.ceiling = partial.renderScale;
                this.adaptive.min = Math.min(this.adaptive.min, partial.renderScale);
            }
        }
        if (partial.maxPixelRatio !== undefined) this.opts.maxPixelRatio = partial.maxPixelRatio;
        if (partial.speedDivider !== undefined) this.opts.speedDivider = partial.speedDivider;
        if (partial.trackSync !== undefined) this.opts.trackSync = partial.trackSync;
        if (partial.amplifiedTime !== undefined) this.opts.amplifiedTime = partial.amplifiedTime;
        if (partial.volumeAmplifier !== undefined) {
            this.opts.volumeAmplifier = partial.volumeAmplifier;
            this.audio.setVolumeAmplifier(partial.volumeAmplifier);
        }
        if (partial.eqGains !== undefined) this.audio.setEqGains(partial.eqGains);
        if (partial.fade !== undefined) {
            const f = partial.fade;
            this.opts.fadeDuration = f === false ? null : typeof f === 'object' ? f.duration ?? FADE_DURATION : FADE_DURATION;
        }
        if (partial.showCredits !== undefined) this.opts.showCredits = partial.showCredits;
        if (partial.showFps !== undefined) this.opts.showFps = partial.showFps;
        if (partial.waitForAudio !== undefined) this.audioGate.setEnabled(partial.waitForAudio);
        if (partial.videoFollowTime !== undefined) this.opts.videoFollowTime = partial.videoFollowTime;
        if (partial.videoTexture !== undefined) {
            this.opts.videoTexture = partial.videoTexture;
            if (this.current) this.applyShaderVideo(this.current.shader);
            else this.resolveVideoTexture();
        }
        if (partial.soundBuffer !== undefined || partial.soundOutput !== undefined) {
            const changed =
                (partial.soundBuffer !== undefined && partial.soundBuffer !== this.opts.soundBuffer) ||
                (partial.soundOutput !== undefined && partial.soundOutput !== this.opts.soundOutput);
            if (partial.soundBuffer !== undefined) this.opts.soundBuffer = partial.soundBuffer;
            if (partial.soundOutput !== undefined) this.opts.soundOutput = partial.soundOutput;
            if (changed) void this.syncSoundEngine(true);
        }
        this.resize();
    }

    /**
     * Set several custom uniform values of a shader at once (e.g. stored
     * per-shader settings). Applied now if it is the current shader, and on
     * every later load of it.
     */
    setCustomUniformValues(shaderName: string, values: Record<string, number | number[] | boolean>): void {
        const record = { ...(this.customUniformValues.get(shaderName) ?? {}), ...values };
        this.customUniformValues.set(shaderName, record);
        for (const program of [this.current, this.previous]) {
            if (program?.shader.shaderName !== shaderName) continue;
            for (const [name, value] of Object.entries(values)) program.setUniform(name, value);
        }
    }

    /**
     * Composite a video (e.g. a webcam) over the shader output, keyed by a mask
     * supplied via `setForegroundMask()`. Until the first mask arrives only the
     * shader is visible. Pass `null` to remove it.
     */
    setForeground(opts: ForegroundOptions | null): void {
        this.foreground?.dispose();
        this.foreground = opts ? new ForegroundCompositor(opts) : null;
    }

    /** Update the foreground mask: one byte per pixel (255 = foreground), top row first. */
    setForegroundMask(data: Uint8Array, width: number, height: number): void {
        this.foreground?.setMask(data, width, height);
    }

    resetTime(): void {
        this.shaderTime = undefined;
        this.shared.iTime.value = 0.1;
        this.shared.iAmplifiedTime.value = 0.1;
        this.shared.iFrame.value = 0;
        // Key press/release times are iTime stamps: drop them with the old clock
        this.keyboard?.reset();
    }

    async loadShader(input: ShaderInput): Promise<void> {
        return this.loadShaderInternal(input, false);
    }

    async loadShaderInternal(input: ShaderInput, first: boolean): Promise<void> {
        const token = ++this.loadToken;
        try {
            const shader = typeof input === 'string'
                ? (this.findImportedShader(input) ?? (await normalizeShaderInput(input, this.catalog)))
                : await normalizeShaderInput(input, this.catalog);
            const program = await ShaderProgram.build({
                shader,
                renderer: this.renderer,
                catalog: this.catalog,
                assetBaseUrl: this.opts.assetBaseUrl,
                mediaBaseUrl: this.opts.mediaBaseUrl,
                media: this.mediaRegistry,
                shared: this.shared,
                size: this.bufferSize,
                floatType: this.floatType(),
                camera: this.camera,
            });
            if (token !== this.loadToken || this.destroyed) {
                program.dispose();
                return;
            }

            const saved = this.customUniformValues.get(shader.shaderName);
            if (saved) {
                for (const [name, value] of Object.entries(saved)) program.setUniform(name, value);
            }

            this.applyShaderVideo(shader);

            const fading = !first && this.opts.fadeDuration !== null && this.current !== null;
            if (fading) {
                this.previous?.mesh.removeFromParent();
                this.previous?.dispose();
                this.previous = this.current!;
                this.current = program;
                this.fadeT = 0;
                this.previous.mesh.renderOrder = 0;
                this.current.mesh.renderOrder = 1;
                this.current.setOpacity(0);
                this.scene.add(this.current.mesh);
            } else {
                if (this.current) {
                    this.current.mesh.removeFromParent();
                    this.current.dispose();
                }
                this.previous?.mesh.removeFromParent();
                this.previous?.dispose();
                this.previous = null;
                this.current = program;
                this.current.mesh.renderOrder = 0;
                this.scene.add(this.current.mesh);
            }
            this.resetAdaptiveScale();
            void this.syncSoundEngine(true);
            this.emitter.emit('shaderchange', { shader });
        } catch (err) {
            this.emitter.emit('error', { error: err as Error, phase: 'shader' });
            throw err;
        }
    }

    private floatType(): number {
        return this.renderer.extensions.has('EXT_color_buffer_float') ? FloatType : HalfFloatType;
    }

    async next(): Promise<void> {
        await this.stepShader(1);
    }

    async prev(): Promise<void> {
        await this.stepShader(-1);
    }

    async random(): Promise<void> {
        const list = await this.visibleShaders();
        if (list.length < 2) return;
        const currentName = this.current?.shader.shaderName;
        let pick = list[Math.floor(Math.random() * list.length)];
        while (pick.shaderName === currentName) {
            pick = list[Math.floor(Math.random() * list.length)];
        }
        await this.loadShader(pick);
    }

    /** Catalog + scene-imported shaders, minus hidden — mirrors the extension's unified list. */
    private async visibleShaders(): Promise<ShaderObject[]> {
        this.catalogCache = await this.catalog.load();
        return [
            ...this.catalogCache.filter((s) => !s.metaData?.hidden),
            ...this.sceneShaders.values(),
        ];
    }

    private async stepShader(dir: 1 | -1): Promise<void> {
        const list = await this.visibleShaders();
        if (!list.length) return;
        const idx = list.findIndex((s) => s.shaderName === this.current?.shader.shaderName);
        const nextIdx = idx < 0 ? 0 : (idx + dir + list.length) % list.length;
        await this.loadShader(list[nextIdx]);
    }

    // ---- scenes ----

    /** Register a SceneGraph (from the extension's scene editor or hand-built). */
    addScene(scene: SceneGraph, extras?: { shaders?: Map<string, ShaderObject> | Record<string, ShaderObject>; media?: MediaRegistry }): void {
        if (extras?.media) this.mediaRegistry.merge(extras.media);
        if (extras?.shaders) {
            const entries = extras.shaders instanceof Map ? extras.shaders.entries() : Object.entries(extras.shaders);
            for (const [ref, shader] of entries) this.sceneShaders.set(ref, shader);
        }
        this.scenePlayer.addScene(scene);
    }

    /**
     * Import a `.zip` scene package exported by the ShaderAmp extension
     * (scene.json + packaged shaders + media) or a plain SceneGraph/JSON object.
     * Returns the registered scene.
     */
    async importScene(input: File | Blob | SceneGraph | object | string): Promise<SceneGraph> {
        if (isSceneGraph(input)) {
            this.scenePlayer.addScene(input);
            return input;
        }
        if (input instanceof Blob) {
            const imported = await importScenePackage(input, {
                media: this.mediaRegistry,
                shaders: this.sceneShaders,
            });
            this.mediaRegistry.merge(imported.media);
            for (const [ref, shader] of imported.shaders) this.sceneShaders.set(ref, shader);
            this.scenePlayer.addScene(imported.scene);
            if (imported.missingRefs.length) {
                console.warn(`[shaderamp] scene package missing ${imported.missingRefs.length} ref(s):`, imported.missingRefs);
            }
            return imported.scene;
        }
        // Plain JSON manifest or scene-shaped object
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (isSceneGraph(parsed)) {
            this.scenePlayer.addScene(parsed);
            return parsed;
        }
        if (parsed && typeof parsed === 'object' && isSceneGraph((parsed as any).scene)) {
            const manifest = parsed as any;
            for (const packaged of manifest.shaders ?? []) {
                this.sceneShaders.set(packaged.ref, packagedToShaderObject(packaged));
            }
            this.scenePlayer.addScene(manifest.scene);
            return manifest.scene;
        }
        throw new Error('Unsupported scene input: expected a SceneGraph, manifest, or .zip package');
    }

    listScenes(): SceneGraph[] {
        return this.scenePlayer.listScenes();
    }

    /** Shaders registered by scene imports (packaged imported/custom/edited shaders). */
    listImportedShaders(): ShaderObject[] {
        return [...this.sceneShaders.values()];
    }

    removeScene(id: string): boolean {
        return this.scenePlayer.removeScene(id);
    }

    get activeScene(): SceneGraph | null {
        return this.scenePlayer.activeScene;
    }

    get isScenePlaying(): boolean {
        return this.scenePlayer.playing;
    }

    get isScenePaused(): boolean {
        return this.scenePlayer.paused;
    }

    /** Play a registered scene by id, or an unregistered SceneGraph. */
    async playScene(scene: string | SceneGraph, opts?: { mode?: ScenePlayMode }): Promise<void> {
        // Warm the ref cache so builtin shader refs resolve on first play.
        this.catalogCache = await this.catalog.load().catch(() => this.catalogCache);
        return this.scenePlayer.play(scene, opts?.mode ?? 'keep');
    }

    stopScene(): Promise<void> {
        return this.scenePlayer.stop();
    }

    /** Freeze/unfreeze the scene graph (the shader clock keeps running). */
    toggleScenePause(): Promise<void> {
        return this.scenePlayer.togglePause();
    }

    /** Follow the current node's manual edge (or first outgoing edge). */
    advanceScene(): Promise<void> {
        return this.scenePlayer.manualAdvance();
    }

    /** Re-evaluate the graph as if the shader clock were at `time` seconds. */
    seekScene(time: number): Promise<void> {
        return this.scenePlayer.seek(time);
    }

    /**
     * Show/hide an overlay shader layer (the manual overlay — takes priority
     * over scene overlay nodes). Pass null to hide.
     */
    setOverlay(shader: string | ShaderObject | null, opts?: { opacity?: number; blendMode?: OverlayBlendMode }): void {
        if (shader === null) {
            void this.scenePlayer.manualOverlayAction({ action: 'hide' });
            return;
        }
        if (typeof shader === 'string') {
            void this.scenePlayer.manualOverlayAction({
                action: 'show',
                shaderRef: shader,
                opacity: opts?.opacity ?? 1,
                blendMode: opts?.blendMode ?? 'additive',
            });
            return;
        }
        this.applyOverlayState({ shader, opacity: opts?.opacity ?? 1, blendMode: opts?.blendMode ?? 'additive' });
    }

    // ---- MIDI ----

    /**
     * Request Web MIDI access and start dispatching mappings. Safe to call
     * again with fresh mappings. Returns false when unsupported/denied.
     */
    async enableMidi(mappings?: MidiMappings): Promise<boolean> {
        if (mappings) this.midiMappings = mappings;
        if (!this.midiService) this.midiService = new MidiService();
        const ok = await this.midiService.init();
        if (ok && !this.midiUnsub) {
            this.midiUnsub = this.midiService.subscribe((evt) => {
                this.midiMapper.handleEvent(evt, this.midiMappings);
                (this.shared.iMidi.value as any).needsUpdate = true;
                this.emitter.emit('midievent', evt);
            });
        }
        this.midiActive = ok;
        return ok;
    }

    disableMidi(): void {
        this.midiUnsub?.();
        this.midiUnsub = null;
        this.midiService?.dispose();
        this.midiService = null;
        this.midiActive = false;
    }

    setMidiMappings(mappings: MidiMappings): void {
        this.midiMappings = mappings;
    }

    getMidiInputs(): MidiInputInfo[] {
        return this.midiService?.getInputs() ?? [];
    }

    get isMidiActive(): boolean {
        return this.midiActive;
    }

    // ---- scene/midi internals ----

    /**
     * Provide content for a `custom_images/…`, `custom_videos/…`,
     * `custom_cubemaps/…` or `custom_volumes/…` channel ref used by a shader.
     * Register before loading the shader. Object URLs and textures passed here
     * are owned (and eventually revoked/disposed) by this instance.
     */
    registerMedia(ref: string, entry: MediaEntry): void {
        this.mediaRegistry.set(ref, entry);
    }

    /** Whether media for a custom channel ref has been registered. */
    hasMedia(ref: string): boolean {
        return this.mediaRegistry.has(ref);
    }

    /** Imported (scene-packaged) shader by ref, file name or display name. */
    private findImportedShader(ref: string): ShaderObject | undefined {
        return (
            this.sceneShaders.get(ref) ??
            [...this.sceneShaders.values()].find(
                (s) => s.shaderName === ref || s.metaData?.shaderName === ref,
            )
        );
    }

    /** Synchronous ref resolution for the scene player / MIDI selectShader. */
    private resolveShaderRef(ref: string): ShaderObject | undefined {
        const packaged = this.findImportedShader(ref);
        if (packaged) return packaged;
        const list = this.catalogCache;
        if (!list) {
            // Warm the cache; the ref may resolve on a later evaluation.
            void this.catalog.load().then((l) => { this.catalogCache = l; });
            return undefined;
        }
        return (
            list.find((s) => s.shaderName === ref) ??
            list.find((s) => s.shaderName === `${ref}.frag`) ??
            list.find((s) => s.metaData?.shaderName?.toLowerCase() === ref.toLowerCase())
        );
    }

    private async selectShaderByRef(ref: string): Promise<void> {
        const shader = this.resolveShaderRef(ref) ?? (await this.catalog.find(ref));
        if (!shader) {
            console.warn(`[shaderamp] selectShader: unresolved ref ${ref}`);
            return;
        }
        await this.loadShaderInternal(shader, false);
    }

    /** Merge uniform overrides for a shader and apply live when it is active. */
    private applyShaderUniforms(shaderName: string, values: Record<string, any>): void {
        const saved = this.customUniformValues.get(shaderName) ?? {};
        this.customUniformValues.set(shaderName, { ...saved, ...values });
        if (this.current?.shader.shaderName === shaderName) {
            for (const [name, value] of Object.entries(values)) this.current.setUniform(name, value);
        }
    }

    private applyOverlayState(state: OverlayState | null): void {
        this.desiredOverlay = state;
        void this.syncOverlayProgram();
    }

    /** Load/swap/dispose the overlay ShaderProgram to match desiredOverlay. */
    private async syncOverlayProgram(): Promise<void> {
        const token = ++this.overlayLoadToken;
        const desired = this.desiredOverlay;
        try {
            if (!desired) {
                this.removeOverlayProgram();
                return;
            }
            // Storage/scene updates hand over a fresh object on every change (e.g. an
            // opacity fader): only rebuild when the shader itself differs.
            const cur = this.overlayProgram?.shader;
            const sameShader =
                !!cur &&
                (cur === desired.shader ||
                    (cur.shaderName === desired.shader.shaderName &&
                        cur.inlineCode === desired.shader.inlineCode &&
                        JSON.stringify(cur.inlineBuffers ?? null) === JSON.stringify(desired.shader.inlineBuffers ?? null)));
            if (!sameShader) {
                const program = await ShaderProgram.build({
                    shader: desired.shader,
                    renderer: this.renderer,
                    catalog: this.catalog,
                    assetBaseUrl: this.opts.assetBaseUrl,
                    mediaBaseUrl: this.opts.mediaBaseUrl,
                    media: this.mediaRegistry,
                    shared: this.shared,
                    size: this.bufferSize,
                    floatType: this.floatType(),
                    camera: this.camera,
                });
                if (token !== this.overlayLoadToken || this.destroyed) {
                    program.dispose();
                    return;
                }
                this.removeOverlayProgram();
                this.overlayProgram = program;
                program.mesh.renderOrder = 2;
                this.scene.add(program.mesh);
            }
            this.overlayProgram!.setOpacity(desired.opacity);
            this.overlayProgram!.setBlendMode(desired.blendMode);
        } catch (err) {
            this.emitter.emit('error', { error: err as Error, phase: 'scene' });
        }
    }

    private removeOverlayProgram(): void {
        if (!this.overlayProgram) return;
        this.overlayProgram.mesh.removeFromParent();
        this.overlayProgram.dispose();
        this.overlayProgram = null;
    }

    start(): void {
        if (this.running || this.destroyed) return;
        this.running = true;
        this.lastFrameMs = 0;
        this.scheduleFrame();
        void this.syncSoundEngine();
    }

    stop(): void {
        this.running = false;
        this.cancelFrame();
        // A stopped renderer freezes iTime: don't keep generating audio.
        this.disposeSoundEngine();
    }

    // ---- sound pass (extension: SoundShaderEngine, settings.soundBuffer) ----

    private disposeSoundEngine(): void {
        this.soundToken++;
        this.soundEngine?.dispose();
        this.soundEngine = null;
    }

    /**
     * Start/stop the GPU sound pass for the current shader. The engine plays
     * into the analyser (so iAudioData reacts) and — unless `soundOutput` is
     * false — the speakers. Passes listed in `soundChannels` are read live.
     */
    private async syncSoundEngine(restart = false): Promise<void> {
        const shader = this.current?.shader;
        const soundFile = shader?.metaData?.soundShader;
        const analyser = this.audio.analyser;
        const wanted = !!(this.running && this.opts.soundBuffer && analyser && shader && (soundFile || shader.inlineSound));
        if (!wanted) {
            this.disposeSoundEngine();
            return;
        }
        if (this.soundEngine && !restart) return;
        this.disposeSoundEngine();
        const token = this.soundToken;
        let code: string | undefined;
        try {
            code = shader!.inlineSound ?? (soundFile ? await this.catalog.fetchCode(soundFile) : undefined);
        } catch (err) {
            this.emitter.emit('error', { error: err as Error, phase: 'shader' });
            return;
        }
        if (!code || token !== this.soundToken || this.destroyed || this.current?.shader !== shader) return;
        const channels = shader!.metaData?.soundChannels;
        const resolver: SoundChannelResolver | undefined = channels
            ? (uniform) => {
                  const keyboard = this.shared.iKeyboard.value as Texture;
                  if (uniform === 'iKeyboard') return keyboard;
                  const src = (channels as Record<string, string | undefined>)[uniform];
                  if (src === 'keyboard') return keyboard;
                  return this.current?.resolvePassRef(src);
              }
            : undefined;
        try {
            const engine = new SoundShaderEngine(
                this.renderer,
                analyser!.context as AudioContext,
                analyser!,
                injectShadertoyDefines(code),
                resolver,
                resolver ? () => this.shaderTime : undefined,
                this.opts.soundOutput,
            );
            this.soundEngine = engine;
            engine.start();
        } catch (err) {
            this.emitter.emit('error', { error: err as Error, phase: 'shader' });
        }
    }

    async toggleFullscreen(): Promise<void> {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await (this.root ?? this.canvas).requestFullscreen();
        }
    }

    // Must be called from a user gesture (transient activation is required).
    async enterPictureInPicture(opts?: { mode?: 'auto' | 'document' | 'video'; width?: number; height?: number }): Promise<void> {
        try {
            await this.pip.enter(opts);
        } catch (err) {
            this.emitter.emit('error', { error: err as Error, phase: 'pip' });
            throw err;
        }
    }

    async exitPictureInPicture(): Promise<void> {
        try {
            await this.pip.exit();
        } catch (err) {
            this.emitter.emit('error', { error: err as Error, phase: 'pip' });
            throw err;
        }
    }

    async togglePictureInPicture(): Promise<void> {
        if (this.pip.active) await this.exitPictureInPicture();
        else await this.enterPictureInPicture();
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.pip.dispose();
        this.controls?.dispose();
        this.disableMidi();
        this.disposeSoundEngine();
        this.hud?.dispose();
        this.hud = null;
        void this.scenePlayer.stop();
        this.removeOverlayProgram();
        this.mediaRegistry.dispose();
        this.stop();
        this.foreground?.dispose();
        this.foreground = null;
        this.screenTarget?.dispose();
        this.screenTarget = null;
        this.blitter?.dispose();
        this.blitter = null;
        this.resizeObserver?.disconnect();
        this.intersectionObserver?.disconnect();
        this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
        this.mouse?.dispose();
        this.keyboard?.dispose();
        this.disposeVideo();
        this.previous?.dispose();
        this.current?.dispose();
        this.previous = null;
        this.current = null;
        this.scene.clear();
        this.audio.dispose();
        this.renderer.dispose();
        if (this.root) {
            this.root.remove();
        }
        this.emitter.clear();
    }

    // ---- video texture (§5.4) ----

    private ensureInternalVideo(): HTMLVideoElement {
        if (!this.internalVideo) {
            const v = document.createElement('video');
            v.muted = true;
            v.loop = true;
            v.playsInline = true;
            v.crossOrigin = 'anonymous';
            v.style.display = 'none';
            this.internalVideo = v;
        }
        return this.internalVideo;
    }

    private isVideoTainted(el: HTMLVideoElement): boolean {
        const url = el.currentSrc || el.src;
        return !!url && isCrossOriginUrl(url, location.origin) && el.crossOrigin === null;
    }

    private makeVideoTexture(el: HTMLVideoElement, internal: boolean): Extract<VideoBinding, { kind: 'video' }> {
        const texture = new VideoTexture(el);
        texture.generateMipmaps = false;
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        this.videoRvfc = false;
        const binding: Extract<VideoBinding, { kind: 'video' }> = { kind: 'video', texture, element: el, internal, cancelled: false };
        const anyEl = el as any;
        if (typeof anyEl.requestVideoFrameCallback === 'function') {
            this.videoRvfc = true;
            const cb = () => {
                texture.needsUpdate = true;
                if (!binding.cancelled && !this.destroyed) anyEl.requestVideoFrameCallback(cb);
            };
            anyEl.requestVideoFrameCallback(cb);
        }
        return binding;
    }

    private disposeVideoBinding(b: VideoBinding): void {
        if (b.kind === 'video') {
            b.cancelled = true;
            b.texture.dispose();
        } else if (b.kind === 'fallback') {
            b.fb.dispose();
        }
    }

    private disposeVideo(): void {
        this.disposeVideoBinding(this.video);
        this.video = { kind: 'black' };
        this.shared.iVideo.value = getBlackTexture();
        if (this.internalVideo) {
            try {
                this.internalVideo.pause();
                this.internalVideo.removeAttribute('src');
                this.internalVideo.load();
            } catch {
                // ignore
            }
            this.internalVideo = null;
            this.internalVideoUrl = null;
        }
    }

    // Resolve the default iVideo texture from options + current source.
    private resolveVideoTexture(): Texture {
        const opt = this.opts.videoTexture;
        let desired: 'black' | 'fallback' | { el: HTMLVideoElement; internal: boolean };
        if (opt === 'none') {
            desired = 'black';
        } else if (typeof opt === 'string' && opt !== 'auto') {
            const v = this.ensureInternalVideo();
            if (this.internalVideoUrl !== opt) {
                this.internalVideoUrl = opt;
                v.src = opt;
                v.play().catch(() => {});
            }
            desired = { el: v, internal: true };
        } else if (opt instanceof HTMLVideoElement) {
            desired = this.isVideoTainted(opt) ? 'fallback' : { el: opt, internal: false };
        } else {
            // 'auto': use the source <video> when it isn't cross-origin-tainted
            const source = this.audio.source;
            const el = source instanceof HTMLVideoElement ? source : null;
            desired = el && !this.isVideoTainted(el) ? { el, internal: false } : 'fallback';
        }

        const current = this.video;
        if (
            (desired === 'black' && current.kind === 'black') ||
            (desired === 'fallback' && current.kind === 'fallback') ||
            (typeof desired === 'object' && current.kind === 'video' && current.element === desired.el)
        ) {
            return this.shared.iVideo.value as Texture;
        }

        const binding: VideoBinding =
            desired === 'black'
                ? { kind: 'black' }
                : desired === 'fallback'
                  ? { kind: 'fallback', fb: createFallbackVideoTexture() }
                  : this.makeVideoTexture(desired.el, desired.internal);
        this.disposeVideoBinding(current);
        this.video = binding;
        const tex =
            binding.kind === 'black'
                ? getBlackTexture()
                : binding.kind === 'fallback'
                  ? binding.fb.texture
                  : binding.texture;
        this.shared.iVideo.value = tex;
        return tex;
    }

    // Per-shader override: metaData.video + mediaBaseUrl.
    private applyShaderVideo(shader: ShaderObject): void {
        const videoPath = shader.metaData?.video;
        // An explicit video element (e.g. a webcam) wins over the shader's own
        // video, like the extension's webcam/display capture (srcObject beats src).
        const explicitElement = this.opts.videoTexture instanceof HTMLVideoElement;
        if (videoPath && this.opts.mediaBaseUrl && !explicitElement) {
            const url = resolveAssetUrl(videoPath, this.opts.mediaBaseUrl);
            const v = this.ensureInternalVideo();
            if (this.internalVideoUrl !== url) {
                this.internalVideoUrl = url;
                v.src = url;
                v.play().catch(() => {});
            }
            if (this.video.kind === 'video' && this.video.element === v) return;
            this.disposeVideoBinding(this.video);
            const binding = this.makeVideoTexture(v, true);
            this.video = binding;
            this.shared.iVideo.value = binding.texture;
            return;
        }
        this.resolveVideoTexture();
    }

    // ---- adaptive render scale ----

    /** Average FFT level (0–255) of the last rendered frame — 0 when silent. */
    get audioLevel(): number {
        return this.lastAudioLevel;
    }

    /** Current effective render scale (changes over time with `adaptiveScale`). */
    get renderScale(): number {
        return this.opts.renderScale;
    }

    /**
     * The JS frame loop doesn't notice a GPU-bound shader (draw calls return
     * immediately; frames are dropped downstream). Keep one fence in flight and
     * use the time until the GPU signals it as a second fps estimate.
     */
    private probeGpu(): void {
        const a = this.adaptive!;
        const gl = this.renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync !== 'function') return;
        const now = performance.now();
        if (a.probe) {
            if (gl.getSyncParameter(a.probe.sync, gl.SYNC_STATUS) !== gl.SIGNALED) {
                // Still pending: a long backlog already counts as a slow sample.
                const pending = now - a.probe.t;
                if (pending > 250) a.gpuFps = Math.min(a.gpuFps || Infinity, 1000 / pending);
                return;
            }
            const fps = 1000 / Math.max(1, now - a.probe.t);
            a.gpuFps = a.gpuFps ? a.gpuFps * 0.8 + fps * 0.2 : fps;
            gl.deleteSync(a.probe.sync);
            a.probe = null;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
            gl.flush();
            a.probe = { sync, t: now };
        }
    }

    private adaptScale(rawDelta: number, nowMs: number): void {
        const a = this.adaptive!;
        const sample = 1 / rawDelta;
        a.fps = a.fps ? a.fps * 0.9 + sample * 0.1 : sample;
        if (nowMs - a.lastChange < 2000) return;
        const fps = a.gpuFps ? Math.min(a.fps, a.gpuFps) : a.fps;
        const target = this.opts.frameLoop === 'timer' ? this.opts.frameRate : 60;
        const scale = this.opts.renderScale;
        if (nowMs > a.ceilingUntil) a.ceiling = a.max;
        let next = scale;
        if (fps < target * 0.7 && scale > a.min) {
            next = Math.max(a.min, scale * 0.75);
            // Don't climb straight back to the scale that was too slow.
            a.ceiling = scale * 0.99;
            a.ceilingUntil = nowMs + 30000;
        } else if (fps > target * 0.9 && scale < Math.min(a.max, a.ceiling) && nowMs - a.lastChange > 8000) {
            next = Math.min(a.max, a.ceiling, scale * 1.15);
        }
        if (next !== scale) {
            a.lastChange = nowMs;
            a.fps = 0;
            a.gpuFps = 0;
            this.opts.renderScale = next;
            this.resize();
        }
    }

    private resetAdaptiveScale(): void {
        const a = this.adaptive;
        if (!a) return;
        a.fps = 0;
        a.gpuFps = 0;
        a.lastChange = performance.now();
        a.ceiling = a.max;
        a.ceilingUntil = 0;
        if (this.opts.renderScale !== a.max) {
            this.opts.renderScale = a.max;
            this.resize();
        }
    }

    // ---- sizing / observers / context ----

    private resize(): void {
        const fixed = this.opts.size;
        if (fixed) {
            const w = Math.max(1, Math.round(fixed.width));
            const h = Math.max(1, Math.round(fixed.height));
            this.renderer.setPixelRatio(1);
            this.renderer.setSize(w, h, false);
            this.outputSize = { width: w, height: h };
            const scale = Math.min(1, Math.max(0.05, this.opts.renderScale));
            const bw = Math.max(1, Math.round(w * scale));
            const bh = Math.max(1, Math.round(h * scale));
            if (bw === w && bh === h) {
                this.screenTarget?.dispose();
                this.screenTarget = null;
            } else if (!this.screenTarget) {
                this.screenTarget = new WebGLRenderTarget(bw, bh, { depthBuffer: false });
                this.blitter ??= new Blitter();
            } else {
                this.screenTarget.setSize(bw, bh);
            }
            this.setBufferSize(bw, bh);
            return;
        }
        const el = this.root ?? this.canvas;
        const cssW = Math.max(1, el.clientWidth || 1);
        const cssH = Math.max(1, el.clientHeight || 1);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, this.opts.maxPixelRatio) * this.opts.renderScale;
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(cssW, cssH, false);
        this.applyBufferSize();
    }

    private applyBufferSize(): void {
        const buf = this.renderer.getDrawingBufferSize(new Vector2());
        this.outputSize = { width: Math.max(1, buf.x), height: Math.max(1, buf.y) };
        this.setBufferSize(buf.x, buf.y);
    }

    private setBufferSize(width: number, height: number): void {
        this.bufferSize = { width: Math.max(1, width), height: Math.max(1, height) };
        this.shared.iResolution.value.set(this.bufferSize.width, this.bufferSize.height, 1);
        this.previous?.resize(this.bufferSize.width, this.bufferSize.height);
        this.current?.resize(this.bufferSize.width, this.bufferSize.height);
        this.overlayProgram?.resize(this.bufferSize.width, this.bufferSize.height);
    }

    private onContextLost = (e: Event) => {
        e.preventDefault();
        this.stop();
        this.emitter.emit('error', { error: new Error('WebGL context lost'), phase: 'webgl' });
    };

    private onContextRestored = () => {
        const shader = this.current?.shader;
        if (!shader) return;
        void this.loadShaderInternal(shader, true)
            .then(() => this.start())
            .catch(() => {});
    };

    // ---- canvas HUD (credits / fps) ----

    private renderHud(): void {
        const credits = this.opts.showCredits ? formatCredits(this.current?.shader) : null;
        const fps = this.opts.showFps ? formatFps(this.fpsMeter.shown) : null;
        if (!credits && !fps) return;
        this.hud ??= new Hud();
        const drawn = this.hud.update({ credits, fps, width: this.outputSize.width, height: this.outputSize.height });
        if (drawn) this.hud.render(this.renderer, this.camera);
    }

    // ---- frame loop ----

    private scheduleFrame(): void {
        if (!this.running || this.destroyed || !this.visible || this.frameHandle) return;
        if (this.opts.frameLoop === 'timer') {
            const interval = 1000 / Math.max(1, this.opts.frameRate);
            this.frameHandle = { type: 'timeout', id: setTimeout(() => this.frame(performance.now()), interval) };
            return;
        }
        // Video PiP keeps animating while the main tab is hidden (rAF is paused then).
        if (this.pip.active && this.pip.currentMode === 'video' && document.hidden) {
            this.frameHandle = { type: 'timeout', id: setTimeout(() => this.frame(performance.now()), 33) };
            return;
        }
        const win = this.canvas.ownerDocument?.defaultView ?? window;
        const id = win.requestAnimationFrame(this.frame);
        this.frameHandle = { type: 'raf', id, win };
    }

    private cancelFrame(): void {
        const h = this.frameHandle;
        this.frameHandle = null;
        if (!h) return;
        if (h.type === 'raf') h.win.cancelAnimationFrame(h.id);
        else clearTimeout(h.id);
    }

    private frame = (nowMs: number): void => {
        this.frameHandle = null;
        if (!this.running || this.destroyed) return;

        const rawDelta = this.lastFrameMs ? Math.max((nowMs - this.lastFrameMs) / 1000, 0) : 0;
        const delta = Math.min(rawDelta, MAX_FRAME_DELTA);
        this.lastFrameMs = nowMs;
        if (this.adaptive && rawDelta > 0) this.adaptScale(rawDelta, nowMs);

        // 1. audio
        this.audio.getFrequencyData(this.fftArray);
        // Wait-for-audio gate: checked before MIDI injection so only real audio opens it.
        const timeGated = this.audioGate.enabled ? this.audioGate.update(averageLevel(this.fftArray)) : false;
        if (this.midiActive) {
            // MIDI: blend injected note energy into the FFT buffer and decay
            const inj = this.midiFftInjection;
            for (let i = 0; i < Math.min(inj.length, this.fftArray.length); i++) {
                if (inj[i] > 0) {
                    this.fftArray[i] = Math.min(255, this.fftArray[i] + inj[i]);
                    inj[i] = inj[i] * MIDI_FFT_DECAY;
                    if (inj[i] < 1) inj[i] = 0;
                }
            }
            // Clear iMidi just-pressed (row 1) and just-released (row 2) each frame
            const state = (this.shared.iMidi.value as any).image.data as Uint8Array;
            for (let i = 0; i < MIDI_TEXTURE_WIDTH; i++) {
                state[MIDI_TEXTURE_WIDTH + i] = 0;
                state[MIDI_TEXTURE_WIDTH * 2 + i] = 0;
            }
            (this.shared.iMidi.value as any).needsUpdate = true;
        }
        const avg = averageLevel(this.fftArray);
        this.lastAudioLevel = avg;
        if (this.opts.showFps) this.fpsMeter.sample(rawDelta, nowMs);
        const beat = this.beatDetector.update(this.fftArray, nowMs);
        if (beat) {
            this.emitter.emit('beat', { energy: averageLevel(this.fftArray) });
            void this.scenePlayer.onBeat();
        }

        // Scene controller inputs: RMS time-domain level + shader clock tick.
        const analyser = this.audio.analyser;
        if (analyser) {
            if (!this.timeDomainArray || this.timeDomainArray.length !== analyser.fftSize) {
                this.timeDomainArray = new Uint8Array(analyser.fftSize);
            }
            this.audio.getTimeDomainData(this.timeDomainArray);
            let sum = 0;
            for (let i = 0; i < this.timeDomainArray.length; i++) {
                const v = this.timeDomainArray[i] - 128;
                sum += v * v;
            }
            this.lastRmsLevel = Math.sqrt(sum / this.timeDomainArray.length);
        } else {
            this.lastRmsLevel = 0;
        }
        this.scenePlayer.onAudioLevel(this.lastRmsLevel);
        // The gate just opened: the shader clock restarts from 0 and so does the scene.
        const gateOpened = this.wasTimeGated && !timeGated;
        this.wasTimeGated = timeGated;

        // 2. time
        const rate = computeRate(avg, this.opts.speedDivider);
        const shaderSpeed = this.current?.shader.metaData?.shaderSpeed ?? 1;
        const prevITime = this.shared.iTime.value;
        const mediaEl = this.opts.trackSync ? this.audio.mediaElement : null;
        const syncEl = mediaEl && (mediaEl.src || mediaEl.srcObject) ? mediaEl : null;
        if (timeGated) {
            // Hold the clock at 0 until audio starts (reproducible audio/video sync).
            this.shared.iTime.value = 0;
            this.shared.iAmplifiedTime.value = 0;
        } else if (syncEl) {
            // Track sync: the shader clock follows the media position exactly —
            // snaps on seeks, freezes while paused (extension's settings.trackSync).
            this.shared.iTime.value = syncEl.currentTime;
            if (!syncEl.paused) this.shared.iAmplifiedTime.value += delta * rate * shaderSpeed;
        } else {
            const t = stepTimes(
                { iTime: prevITime, iAmplifiedTime: this.shared.iAmplifiedTime.value },
                delta,
                rate,
                shaderSpeed,
            );
            this.shared.iTime.value = t.iTime;
            this.shared.iAmplifiedTime.value = t.iAmplifiedTime;
        }
        if (!this.opts.amplifiedTime) this.shared.iAmplifiedTime.value = this.shared.iTime.value;
        this.shared.iTimeDelta.value = timeGated ? 0 : Math.max(0, this.shared.iTime.value - prevITime);
        const audioCtx = this.audio.context;
        if (this.soundEngine && audioCtx) {
            this.shaderTime = { iTime: this.shared.iTime.value, audioTime: audioCtx.currentTime };
        }
        this.shared.iFrameRate.value = delta > 0 ? 1 / delta : 60;
        this.shared.iDate.value = getDateVector();

        // 3. inputs + textures
        this.keyboard?.update(this.shared.iTime.value);
        (this.shared.iKeyboard.value as any).needsUpdate = true;
        (this.shared.iAudioData.value as any).needsUpdate = true;
        if (this.video.kind === 'fallback') this.video.fb.update(delta);
        if (this.video.kind === 'video') {
            const el = this.video.element;
            if (this.opts.videoFollowTime) {
                // Video follows iTime (mod duration): rate-correct small drift,
                // hard seek on large drift (extension: settings.videoFollowTime).
                if (!timeGated && nowMs - this.lastVideoSyncMs > 250) {
                    this.lastVideoSyncMs = nowMs;
                    const dur = el.duration;
                    if (isFinite(dur) && dur > 0 && !el.seeking && el.readyState >= 2) {
                        const target = wrapTime(this.shared.iTime.value, dur);
                        const drift = wrappedDiff(target, el.currentTime, dur);
                        if (Math.abs(drift) > 0.3) {
                            el.currentTime = target;
                            el.playbackRate = 1;
                        } else {
                            el.playbackRate = Math.abs(drift) > 0.05 ? 1 + Math.sign(drift) * 0.1 : 1;
                        }
                        if (el.paused) el.play().catch(() => {});
                    }
                }
            } else if (this.video.internal && el.playbackRate && !timeGated) {
                const smoothed = el.playbackRate * 0.85 + rate * 0.15;
                if (Math.abs(el.playbackRate - smoothed) > 0.01) el.playbackRate = smoothed;
                if (el.paused) el.play().catch(() => {});
            }
            if (!this.videoRvfc) this.video.texture.needsUpdate = true;
        }

        // 4. fade
        if (this.previous && this.current) {
            const dur = this.opts.fadeDuration ?? FADE_DURATION;
            this.fadeT += delta / dur;
            const f = Math.min(this.fadeT, 1);
            this.previous.setOpacity(1 - f);
            this.current.setOpacity(f);
            if (this.fadeT >= 1) {
                this.previous.mesh.removeFromParent();
                this.previous.dispose();
                this.previous = null;
                this.current.setOpacity(1);
            }
        }

        // 5. passes
        const iTime = this.shared.iTime.value;
        this.previous?.updateChannelTimes(iTime);
        this.current?.updateChannelTimes(iTime);
        this.overlayProgram?.updateChannelTimes(iTime);
        this.previous?.renderPasses(this.renderer, this.camera);
        this.current?.renderPasses(this.renderer, this.camera);
        this.overlayProgram?.renderPasses(this.renderer, this.camera);

        // Scene graph tick — 'auto' timeSource follows the displayed clock
        // (iAmplifiedTime, or iTime when amplifiedTime is off).
        const clock = {
            time: this.opts.amplifiedTime ? this.shared.iAmplifiedTime.value : iTime,
            iTime,
            iAmplifiedTime: this.shared.iAmplifiedTime.value,
            level: this.lastRmsLevel,
            gateOpened,
        };
        void this.scenePlayer.tick(clock);
        this.emitter.emit('clock', clock);

        // 6. screen
        if (this.screenTarget && this.blitter) {
            this.renderer.setRenderTarget(this.screenTarget);
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.renderer.setRenderTarget(null);
            this.renderer.clear();
            this.blitter.render(this.renderer, this.camera, this.screenTarget.texture);
        } else {
            this.renderer.setRenderTarget(null);
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
        }
        this.foreground?.render(this.renderer, this.camera, this.outputSize);
        this.renderHud();
        if (this.adaptive) this.probeGpu();

        // 7. bookkeeping
        this.mouse?.endFrame();
        if (!timeGated) this.shared.iFrame.value += 1;

        // 8. next frame (rAF of the window owning the canvas)
        this.scheduleFrame();
    };
}
