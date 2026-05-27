import React, { useEffect, useState, useRef } from 'react';
import browser from "webextension-polyfill";
import { useFrame, useThree } from '@react-three/fiber';
import type { ShaderObject, ShaderUniform } from "@src/helpers/types";
import {
    Clock,
    Cache,
    DataTexture, DoubleSide, IUniform,
    LuminanceFormat, PixelFormat,
    RedFormat, RepeatWrapping,
    TextureLoader,
    CubeTexture,
    CubeTextureLoader,
    Vector2,
    Vector3,
    Vector4,
    VideoTexture,
    WebGLRenderer,
    ShaderMaterial,
    WebGLRenderTarget,
    Scene,
    OrthographicCamera,
    PlaneGeometry,
    Mesh,
    LinearFilter,
    NearestFilter,
    LinearMipmapLinearFilter,
    HalfFloatType,
    ClampToEdgeWrapping } from "three";
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import { getEditedShader, getEditedImportedShader } from '@src/helpers/shaderStorage';
import css from "./styles.module.css";
import { DECR_TIME, INCR_TIME, RESET_TIME } from '@src/helpers/constants';

Cache.enabled = true;
const maxRate = 15;
const minRate = 0;
const DEFAULT_FFT_SIZE = 1024; // Default FFT size if not specified in shader metadata
const fill_color = "#4087A0" // fill color for the 2d analyzer
const min_speed = 0.3;
const default_shader_factor = 1.0;

// Keyboard state tracking (ShaderToy compatible)
// 256 keys * 4 components (key down, key pressed, key released, key time)
const KEYBOARD_TEXTURE_WIDTH = 256;
const KEYBOARD_TEXTURE_HEIGHT = 4;

const general_purpose_vertex_shader = `
varying vec2 vUv; 
void main()
{
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`

type SamplerConfig = { filter?: string; wrap?: string; vflip?: boolean };

function applySamplerToTexture(tex: any, sampler?: SamplerConfig, fallbackWrap?: number, fallbackFlipY?: boolean) {
    const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : (fallbackWrap ?? ClampToEdgeWrapping));
    tex.wrapS = wrap;
    tex.wrapT = wrap;
    if (sampler?.filter === 'nearest') {
        tex.minFilter = NearestFilter;
        tex.magFilter = NearestFilter;
        tex.generateMipmaps = false;
    } else if (sampler?.filter === 'mipmap') {
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = true;
    } else {
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = false;
    }
    tex.flipY = sampler?.vflip !== undefined ? sampler.vflip : (fallbackFlipY ?? true);
}

type AnalyzerMeshProps = {
    analyser: AnalyserNode | undefined;
    canvas: HTMLCanvasElement | null;
    videoElement: HTMLVideoElement | null;
    shaderObject: ShaderObject;
    speedDivider: number;
    randomizeBeat?: boolean;
    randomizeBeatInterval?: number;
    shaderFade?: boolean;
    renderScale?: number;
    onShaderChangeRequested?: () => void;
}

type TUniform = { [uniform: string]: IUniform }; 
// Optional multipass buffer description coming from metaData.buffers
// Example meta:
// {
//   buffers: [
//     { shaderName: "BufferA.frag", output: 0, iChannel0: "images/foo.png" },
//     { shaderName: "BufferB.frag", output: 1, iChannel0: "buffer0" }
//   ]
// }
type BufferMeta = {
    shaderName: string;
    output: number; // 0..3 -> will map to buffer index
    // optional per-pass channel mappings (string path or the special token "buffer{index}")
    iChannel0?: string;
    iChannel1?: string;
    iChannel2?: string;
    iChannel3?: string;
    cubemaps?: string[];
};

type BufferRuntime = {
    material: ShaderMaterial;
    scene: Scene;
    targets: [WebGLRenderTarget, WebGLRenderTarget];
    readIndex: number;
    writeIndex: number;
    channelMeta: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    channelSamplers: { iChannel0?: SamplerConfig; iChannel1?: SamplerConfig; iChannel2?: SamplerConfig; iChannel3?: SamplerConfig };
    preloaded: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

type MaterialProps = {
    clock: Clock;
    format: PixelFormat;
    tuniform: TUniform;
    // multipass
    bufferCamera?: OrthographicCamera;
    buffers?: BufferRuntime[];
    finalChannels?: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
    finalPreloaded?: { iChannel0?: any; iChannel1?: any; iChannel2?: any; iChannel3?: any };
};

export const AnalyzerMesh = ({ analyser, canvas, videoElement, shaderObject, speedDivider, randomizeBeat = false, randomizeBeatInterval = 4, shaderFade = false, renderScale = 1.0, onShaderChangeRequested } : AnalyzerMeshProps) => {
    // Get FFT size from shader metadata or use default
    const fftSize = shaderObject.metaData?.fftSize || DEFAULT_FFT_SIZE;
    const frequencyBinCount = fftSize / 2; // frequencyBinCount is always half of fftSize
    const fbcArrayRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(frequencyBinCount)));
    const matRef = useRef<ShaderMaterial>(null);
    const previousMatRef = useRef<ShaderMaterial>(null);
    const fadeRenderTargetRef = useRef<WebGLRenderTarget | null>(null);
    const [draw_analyzer, setDrawAnalyzer] = useState(true);
    const [threeProps, setThreeProps] = useState<MaterialProps>();
    const [loadedShaderName, setLoadedShaderName] = useState<string>("");
    const [loadedRenderScale, setLoadedRenderScale] = useState<number>(renderScale);
    const [previousShaderName, setPreviousShaderName] = useState<string>("");
    const [fadeProgress, setFadeProgress] = useState<number>(1.0);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
    const { gl, viewport } = useThree();
    const stopVideoFrameRef = useRef<boolean>(false);

    // Beat detection variables
    const beatCounterRef = useRef<number>(0);
    const previousEnergyRef = useRef<number>(0);
    const beatThresholdRef = useRef<number>(1.3); // Energy threshold for beat detection

    // Keyboard state tracking refs (ShaderToy compatible)
    const keyboardStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * KEYBOARD_TEXTURE_HEIGHT)));
    const keyboardPrevStateRef = useRef<Uint8Array>(new Uint8Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH)));
    const keyboardPressTimeRef = useRef<Float32Array>(new Float32Array(new ArrayBuffer(KEYBOARD_TEXTURE_WIDTH * 4)));
    const currentTimeRef = useRef<number>(0);

    // Channel time tracking for iChannelTime uniform (records when each channel was first loaded)
    const channelLoadTimeRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);

    // Beat detection function
    const detectBeat = (fbcArray: Uint8Array): boolean => {
        // Calculate energy (sum of all frequency values)
        const currentEnergy = fbcArray.reduce((sum, value) => sum + value * value, 0);
        
        // Simple energy-based beat detection
        // A beat is detected if the current energy is significantly higher than the previous energy
        if (previousEnergyRef.current > 0) {
            const energyRatio = currentEnergy / previousEnergyRef.current;
            
            if (energyRatio > beatThresholdRef.current) {
                previousEnergyRef.current = currentEnergy;
                return true;
            }
        }
        
        previousEnergyRef.current = currentEnergy;
        return false;
    };

    // Configure analyser FFT size
    /*
    // using this will cause the shader to not work correctly
    // it will cut the high frequencies
    // it is not needed for the shader to work
    useEffect(() => {
        if (analyser) {
            analyser.fftSize = fftSize;
            console.log(`[ShaderAmp] Set analyser fftSize to ${fftSize} (frequencyBinCount: ${analyser.frequencyBinCount})`);
        }
    }, [analyser, fftSize]);
    */
   
    // Await video readiness so the initial VideoTexture has valid content
    const waitForVideoReady = (video: HTMLVideoElement) => new Promise<void>((resolve) => {
        if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) {
            resolve();
            return;
        }
        const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            resolve();
        };
        video.addEventListener('loadeddata', onReady);
        video.addEventListener('canplay', onReady);
    });

    const loadFragmentShader = async () => {
        console.log(`loading shader with name: ${shaderObject.shaderName}, and metaData: `, shaderObject.metaData);
        console.log('[SA] metaData.buffers:', JSON.stringify((shaderObject.metaData as any)?.buffers));
        console.log('[SA] inlineBuffers keys:', Object.keys(shaderObject.inlineBuffers || {}));

        const meta = shaderObject.metaData as any;
        const fallbackWrap = meta?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
        const fallbackFlipY = meta?.textureFlipY !== false;

        const video = videoElement!;
        // improve autoplay reliability for shaders using iVideo
        // allow video decoding without tainting canvas
        // @ts-ignore
        video.crossOrigin = 'anonymous';
        video.muted = true;
        // @ts-ignore playsInline is valid on HTMLVideoElement at runtime
        video.playsInline = true;
        video.loop = true;
        video.src = shaderObject.metaData?.video ?? browser.runtime.getURL('media/SpaceTravel1Min.mp4');
        await waitForVideoReady(video);
        try { await video.play(); } catch (e) { /* ignore autoplay interruptions */ }

        const tuniform = threeProps!.tuniform;
        // Recreate the VideoTexture after (re)setting the video src to ensure correct binding
        const vtex = new VideoTexture(video);
        vtex.generateMipmaps = false;
        // Ensure linear sampling and clamp-to-edge
        vtex.minFilter = LinearFilter;
        vtex.magFilter = LinearFilter;
        vtex.wrapS = ClampToEdgeWrapping;
        vtex.wrapT = ClampToEdgeWrapping;
        tuniform.iVideo.value = vtex;

        // Prefer requestVideoFrameCallback to drive texture uploads exactly when a new frame arrives
        const anyVideo: any = video;
        stopVideoFrameRef.current = false;
        if (typeof anyVideo.requestVideoFrameCallback === 'function') {
            const cb = (_now: number, _meta: any) => {
                if (stopVideoFrameRef.current) return;
                (tuniform.iVideo.value as VideoTexture).needsUpdate = true;
                anyVideo.requestVideoFrameCallback(cb);
            };
            anyVideo.requestVideoFrameCallback(cb);
        } else {
            // Fallback to timeupdate event
            const onTimeUpdate = () => {
                (tuniform.iVideo.value as VideoTexture).needsUpdate = true;
            };
            video.addEventListener('timeupdate', onTimeUpdate);
            // Ensure removal on unmount
            // store for cleanup
            (video as any).__onTimeUpdateShaderAmp = onTimeUpdate;
        }

        // Helper to check if a meta channel references a buffer token like "buffer0"
        const isBufferRef = (s?: string) => !!s && /^buffer(\d+)$/.test(s);

        // Helper to record channel load time and resolution
        const recordChannelLoad = (channelIdx: number, texture: any, startTime: number) => {
            channelLoadTimeRef.current[channelIdx] = startTime;
            if (texture && texture.image) {
                const img = texture.image;
                tuniform.iChannelResolution.value[channelIdx].set(img.width || 0, img.height || 0, 1.0);
            }
        };

        const currentTime = tuniform.iTime.value;

        // Helper to load a cubemap texture
        // Cubemap faces are named: {baseName}.ext, {baseName}_1.ext ... {baseName}_5.ext
        // Order: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
        const loadCubemap = (basePath: string): CubeTexture => {
            const cubeLoader = new CubeTextureLoader();
            // Extract extension from basePath (e.g., "images/cubemaps/abc.jpg" -> ".jpg")
            const extMatch = basePath.match(/(\.[a-z]+)$/i);
            const ext = extMatch ? extMatch[1] : '.jpg';
            const baseWithoutExt = extMatch ? basePath.slice(0, -ext.length) : basePath;
            const faceUrls = [
                browser.runtime.getURL(`${baseWithoutExt}${ext}`),     // face 0: +X
                browser.runtime.getURL(`${baseWithoutExt}_1${ext}`),   // face 1: -X
                browser.runtime.getURL(`${baseWithoutExt}_2${ext}`),   // face 2: +Y
                browser.runtime.getURL(`${baseWithoutExt}_3${ext}`),   // face 3: -Y
                browser.runtime.getURL(`${baseWithoutExt}_4${ext}`),   // face 4: +Z
                browser.runtime.getURL(`${baseWithoutExt}_5${ext}`),   // face 5: -Z
            ];
            
            console.log(`[ShaderAmp] Loading cubemap from: ${basePath}`);
            const cubeTex = cubeLoader.load(faceUrls, 
                (tex) => { console.log('[ShaderAmp] Cubemap loaded successfully'); recordChannelLoad(0, tex, currentTime); },
                undefined,
                (err) => console.warn('[ShaderAmp] Cubemap load error:', err)
            );
            return cubeTex;
        };

        // Helper to load a texture or cubemap based on channel type
        const loadChannelTexture = (
            channelPath: string | undefined,
            defaultPath: string,
            channelType: 'texture' | 'cubemap' | undefined,
            channelIdx: 0|1|2|3,
            sampler?: SamplerConfig
        ) => {
            const texturePath = channelPath ?? defaultPath;
            
            if (channelType === 'cubemap') {
                // For cubemaps, use the default cubemap path if not specified
                const cubemapPath = channelPath ?? 'images/cubemaps/abc.jpg';
                return loadCubemap(cubemapPath);
            } else {
                // Load regular 2D texture
                const tex = new TextureLoader().load(browser.runtime.getURL(texturePath), (t) => {
                    recordChannelLoad(channelIdx, t, currentTime);
                });
                applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
                return tex;
            }
        };

        // Get channel types and per-channel samplers from metadata
        const ch0Type = meta?.iChannel0Type;
        const ch1Type = meta?.iChannel1Type;
        const ch2Type = meta?.iChannel2Type;
        const ch3Type = meta?.iChannel3Type;

        // Only load file textures when meta iChannelN is not a buffer reference. Otherwise, leave to multipass setup.
        const ch0 = shaderObject.metaData?.iChannel0;
        if (!isBufferRef(ch0)) {
            tuniform.iChannel0.value = loadChannelTexture(
                ch0,
                'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg',
                ch0Type,
                0,
                meta?.iChannel0Sampler
            );
        }

        const ch1 = shaderObject.metaData?.iChannel1;
        if (!isBufferRef(ch1)) {
            tuniform.iChannel1.value = loadChannelTexture(
                ch1,
                'images/beton_3_pexels-photo-5622880.jpeg',
                ch1Type,
                1,
                meta?.iChannel1Sampler
            );
        }

        const ch2 = shaderObject.metaData?.iChannel2;
        if (!isBufferRef(ch2)) {
            tuniform.iChannel2.value = loadChannelTexture(
                ch2,
                'images/NyanCatSprite.png',
                ch2Type,
                2,
                meta?.iChannel2Sampler
            );
        }

        const ch3 = shaderObject.metaData?.iChannel3;
        if (!isBufferRef(ch3)) {
            tuniform.iChannel3.value = loadChannelTexture(
                ch3,
                'images/NyanCatSprite.png',
                ch3Type,
                3,
                meta?.iChannel3Sampler
            );
        }

        const material = matRef.current as ShaderMaterial;
        
        // Check for edited shader versions before loading
        let editedShaderCode: string | undefined;
        if (!shaderObject.inlineCode) {
            // Check if this is a built-in shader with an edited version
            const editedShader = await getEditedShader(shaderObject.shaderName);
            if (editedShader?.inlineCode) {
                editedShaderCode = editedShader.inlineCode;
                console.log(`[AnalyzerMesh] Using edited version of ${shaderObject.shaderName}`);
            }
        }
        
        // Use inline code if available (edited, imported, or Shadertoy shaders), otherwise fetch from file
        const loadedFragmentShader = shaderObject.inlineCode 
            ? shaderObject.inlineCode 
            : editedShaderCode
            ? editedShaderCode
            : await fetchFragmentShader(shaderObject.shaderName);
        
        let processedShader = loadedFragmentShader;
        // Inject transition opacity code for perfect fades
        if (processedShader && !processedShader.includes('iTransitionOpacity')) {
            processedShader = 'uniform float iTransitionOpacity;\n' + processedShader;
            processedShader = processedShader.replace(/\bvoid\s+main\s*\(\s*(void)?\s*\)/g, 'void shaderamp_main_fade()');
            processedShader += '\nvoid main() {\n    shaderamp_main_fade();\n    gl_FragColor *= iTransitionOpacity;\n}\n';
        }
        
        // Store previous material if we're fading
        if (shaderFade && material.fragmentShader && loadedShaderName && material.fragmentShader !== processedShader) {
            console.log('Storing previous shader material for fade');
            const clonedMaterial = material.clone();
            
            // Preserve the previous shader's current time values for smooth animation continuity
            if (clonedMaterial.uniforms.iAmplifiedTime) {
                clonedMaterial.uniforms.iAmplifiedTime.value = material.uniforms.iAmplifiedTime?.value || 0.1;
            }
            if (clonedMaterial.uniforms.iTime) {
                clonedMaterial.uniforms.iTime.value = material.uniforms.iTime?.value || 0.1;
            }
            
            (previousMatRef.current as any) = clonedMaterial;
        }
        
        material.fragmentShader = processedShader;
        material.needsUpdate = true;
    }

    // Resolve a channel value that can be a texture path or a buffer reference like "buffer0"
    const resolveChannelValue = (src: string | undefined, bufferTargets: (WebGLRenderTarget|undefined)[] | undefined) => {
        if (!src) return undefined;
        const m = src.match(/^buffer(\d+)$/);
        if (m && bufferTargets) {
            const idx = parseInt(m[1], 10);
            return bufferTargets[idx] ? (bufferTargets[idx] as WebGLRenderTarget).texture : undefined;
        }
        const tex = new TextureLoader().load(browser.runtime.getURL(src));
        tex.flipY = false;
        return tex;
    }

    // Initialize optional multipass buffers described in shaderObject.metaData.buffers
    const setupMultipassBuffers = async () => {
        if (!threeProps) return;
        const meta: any = shaderObject.metaData || {};
        const fallbackWrap = meta?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
        const fallbackFlipY = meta?.textureFlipY !== false;
        let buffersMeta: BufferMeta[] | undefined = meta?.buffers;
        if (!buffersMeta || buffersMeta.length === 0) {
            setThreeProps({ ...threeProps, buffers: [], bufferCamera: undefined });
            return;
        }

        // Ensure deterministic rendering order (lower outputs first)
        buffersMeta = [...buffersMeta].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));
        console.log('[SA] buffersMeta:', JSON.stringify(buffersMeta));

        const width = Math.max(1, Math.round(window.innerWidth * renderScale));
        const height = Math.max(1, Math.round(window.innerHeight * renderScale));
        const bufferRuntimes: BufferRuntime[] = [];

        // Shared full-screen quad setup
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new PlaneGeometry(2, 2);

        const baseUniforms = threeProps.tuniform; // share time/audio/resolution by reference across passes

        // Create per-pass uniforms that share time/audio/resolution, but have dedicated iChannel uniforms
        const makePassUniforms = (shared: TUniform): TUniform => {
            return {
                iAmplifiedTime: shared.iAmplifiedTime,
                iTime: shared.iTime,
                iTimeDelta: shared.iTimeDelta,
                iDate: shared.iDate,
                iAudioData: shared.iAudioData,
                iResolution: shared.iResolution,
                iVideo: shared.iVideo,
                iMouse: shared.iMouse,
                iKeyboard: shared.iKeyboard,
                iFrame: shared.iFrame,
                iFrameRate: shared.iFrameRate,
                iChannelTime: shared.iChannelTime,
                iSampleRate: shared.iSampleRate,
                iChannelResolution: shared.iChannelResolution,
                iChannel0: { value: undefined },
                iChannel1: { value: undefined },
                iChannel2: { value: undefined },
                iChannel3: { value: undefined },
            } as TUniform;
        }

        // helper to preload non-buffer textures once
        const preloadIfPath = (src?: string, channelName?: string, cubemapsList?: string[], sampler?: SamplerConfig) => {
            if (!src) return undefined;
            const m = src.match(/^buffer(\d+)$/);
            if (m) return undefined;
            if (channelName && cubemapsList?.includes(channelName)) {
                // Load cubemap using face-based naming convention
                const extMatch = src.match(/(\.[a-z]+)$/i);
                const ext = extMatch ? extMatch[1] : '.jpg';
                const baseWithoutExt = extMatch ? src.slice(0, -ext.length) : src;
                const faceUrls = [
                    browser.runtime.getURL(`${baseWithoutExt}${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_1${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_2${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_3${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_4${ext}`),
                    browser.runtime.getURL(`${baseWithoutExt}_5${ext}`),
                ];
                return new CubeTextureLoader().load(faceUrls);
            }
            const tex = new TextureLoader().load(browser.runtime.getURL(src));
            applySamplerToTexture(tex, sampler, fallbackWrap, fallbackFlipY);
            return tex;
        };

        // Create all targets and materials first (double-buffered)
        for (let i = 0; i < buffersMeta.length; i++) {
            const b = buffersMeta[i];
            const targetA = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: HalfFloatType });
            targetA.texture.generateMipmaps = false; targetA.texture.minFilter = LinearFilter; targetA.texture.magFilter = LinearFilter;
            const targetB = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false, type: HalfFloatType });
            targetB.texture.generateMipmaps = false; targetB.texture.minFilter = LinearFilter; targetB.texture.magFilter = LinearFilter;

            // Use inline buffer code if available (from edited shaders, original, or fetch from file)
            let bufferCode: string;
            if (shaderObject.inlineBuffers?.[b.shaderName]) {
                bufferCode = shaderObject.inlineBuffers[b.shaderName];
            } else {
                // Check for edited buffer shader
                const editedShader = await getEditedShader(shaderObject.shaderName);
                if (editedShader?.inlineBuffers?.[b.shaderName]) {
                    bufferCode = editedShader.inlineBuffers[b.shaderName];
                    console.log(`[AnalyzerMesh] Using edited buffer ${b.shaderName}`);
                } else {
                    bufferCode = await fetchFragmentShader(b.shaderName);
                }
            }
            
            const mat = new ShaderMaterial({
                vertexShader: general_purpose_vertex_shader,
                fragmentShader: bufferCode,
                uniforms: makePassUniforms(baseUniforms),
            });
            const scene = new Scene();
            const quad = new Mesh(geometry, mat);
            scene.add(quad);

            console.log(`[SA] Buffer ${b.shaderName} hasAudioData:`, bufferCode.includes('iAudioData'), 'iChannel0:', b.iChannel0, 'iChannel1:', b.iChannel1);
            bufferRuntimes[b.output] = {
                material: mat,
                scene,
                targets: [targetA, targetB],
                readIndex: 0,
                writeIndex: 1,
                channelMeta: { iChannel0: b.iChannel0, iChannel1: b.iChannel1, iChannel2: b.iChannel2, iChannel3: b.iChannel3 },
                channelSamplers: {
                    iChannel0: (b as any).iChannel0Sampler,
                    iChannel1: (b as any).iChannel1Sampler,
                    iChannel2: (b as any).iChannel2Sampler,
                    iChannel3: (b as any).iChannel3Sampler,
                },
                preloaded: {
                    iChannel0: preloadIfPath(b.iChannel0, "iChannel0", b.cubemaps, (b as any).iChannel0Sampler),
                    iChannel1: preloadIfPath(b.iChannel1, "iChannel1", b.cubemaps, (b as any).iChannel1Sampler),
                    iChannel2: preloadIfPath(b.iChannel2, "iChannel2", b.cubemaps, (b as any).iChannel2Sampler),
                    iChannel3: preloadIfPath(b.iChannel3, "iChannel3", b.cubemaps, (b as any).iChannel3Sampler),
                }
            };
        }

        // Prepare final pass channel mapping and preloads
        const finalMeta = shaderObject.metaData as any || {};
        const finalChannels = { iChannel0: finalMeta?.iChannel0, iChannel1: finalMeta?.iChannel1, iChannel2: finalMeta?.iChannel2, iChannel3: finalMeta?.iChannel3 };
        const finalPreloaded = {
            iChannel0: preloadIfPath(finalChannels.iChannel0, "iChannel0", finalMeta?.cubemaps, finalMeta?.iChannel0Sampler),
            iChannel1: preloadIfPath(finalChannels.iChannel1, "iChannel1", finalMeta?.cubemaps, finalMeta?.iChannel1Sampler),
            iChannel2: preloadIfPath(finalChannels.iChannel2, "iChannel2", finalMeta?.cubemaps, finalMeta?.iChannel2Sampler),
            iChannel3: preloadIfPath(finalChannels.iChannel3, "iChannel3", finalMeta?.cubemaps, finalMeta?.iChannel3Sampler),
        };

        setThreeProps({ ...threeProps, buffers: bufferRuntimes, bufferCamera: camera, finalChannels, finalPreloaded });
    }

    const resetTime = (tuniform : TUniform) => {
        tuniform.iAmplifiedTime.value = 0.1;
        tuniform.iTime.value = 0.1;
        tuniform.iFrame.value = 0;
    }

    const incrementTime = (tuniform : TUniform, increment: number) => {
        tuniform.iAmplifiedTime.value += increment;
        tuniform.iTime.value += increment;
    }

    const getCurrentDateVector = () => {
        const currentDate = new Date();
        // Year, month, day, time in seconds in .xyzw
        return new Vector4(currentDate.getFullYear(), currentDate.getMonth(),
            currentDate.getDate(),
            currentDate.getHours()*60.0*60 + currentDate.getMinutes()*60 + currentDate.getSeconds());
    }
  
    const initializeProps = () => {
        const fbcArray = fbcArrayRef.current as any; // Force type for Three.js compatibility
        const format = (new WebGLRenderer().capabilities.isWebGL2) ? RedFormat : LuminanceFormat;
        const dataTexture = new DataTexture(fbcArray, fftSize / 2, 1, format);
        const video_texture = new VideoTexture(videoElement as HTMLVideoElement);
        const clock = new Clock();

        const tuniform: any = {
            iAmplifiedTime: { type: 'f', value: 0.1 },
            iTime: { type: 'f', value: 0.1 },
            iTimeDelta: { type: 'f', value: 0.0 },
            iFrameRate: { type: 'f', value: 60.0 },
            iDate: { value: getCurrentDateVector() },
            iChannel0: { value: undefined },
            iChannel1: { value: undefined },
            iChannel2: { value: undefined },
            iChannel3: { value: undefined },
            iChannelResolution: { value: [new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1)] },
            iChannelTime: { value: [0.0, 0.0, 0.0, 0.0] },
            iAudioData: { value: dataTexture },
            iSampleRate: { type: 'f', value: 44100.0 },
            iResolution: { value: new Vector3(window.innerWidth, window.innerHeight, 1.0) },
            iVideo: { value: video_texture },
            iMouse: { value: new Vector4(window.innerWidth / 2, window.innerHeight / 2, 0, 0), type: 'v4', },
            iFrame: { type: 'i', value: 0 },
            iKeyboard: { value: new DataTexture(keyboardStateRef.current as any, KEYBOARD_TEXTURE_WIDTH, KEYBOARD_TEXTURE_HEIGHT, RedFormat) },
            iTransitionOpacity: { type: 'f', value: 1.0 }
        };
        
        // Add custom uniforms from shader metadata
        if (shaderObject.metaData?.customUniforms) {
            shaderObject.metaData.customUniforms.forEach((uniform: ShaderUniform) => {
                let value: any = uniform.default;
                
                switch(uniform.type) {
                    case 'int':
                        value = Math.floor(uniform.default as number);
                        break;
                    case 'float':
                        value = uniform.default as number;
                        break;
                    case 'bool':
                        value = uniform.default ? 1.0 : 0.0; // Convert bool to float for GLSL
                        break;
                    case 'vec2':
                        value = new Vector2(...(uniform.default as number[]));
                        break;
                    case 'vec3':
                        value = new Vector3(...(uniform.default as number[]));
                        break;
                    case 'vec4':
                        value = new Vector4(...(uniform.default as number[]));
                        break;
                }
                
                tuniform[uniform.name] = { value };
            });
        }
        
        const props = {
            clock,
            format,
            tuniform
        };
        setThreeProps(props);
    }

    // Load and apply custom uniform values from storage
    useEffect(() => {
        if (shaderObject?.metaData?.customUniforms && threeProps?.tuniform) {
            // Load initial values
            browser.storage.local.get(`customUniforms_${shaderObject.shaderName}`).then(result => {
                const savedValues = result[`customUniforms_${shaderObject.shaderName}`];
                if (savedValues) {
                    shaderObject.metaData?.customUniforms!.forEach((uniform: ShaderUniform) => {
                        if (savedValues[uniform.name] !== undefined && threeProps.tuniform[uniform.name]) {
                            let value = savedValues[uniform.name];
                            
                            // Convert value based on type
                            switch(uniform.type) {
                                case 'bool':
                                    value = value ? 1.0 : 0.0;
                                    break;
                                case 'vec2':
                                    value = new Vector2(...(Array.isArray(value) ? value : [value, value]));
                                    break;
                                case 'vec3':
                                    value = new Vector3(...(Array.isArray(value) ? value : [value, value, value]));
                                    break;
                                case 'vec4':
                                    value = new Vector4(...(Array.isArray(value) ? value : [value, value, value, value]));
                                    break;
                            }
                            
                            threeProps.tuniform[uniform.name].value = value;
                        }
                    });
                }
            });
            
            // Listen for changes from storage
            const storageListener = (changes: any) => {
                const key = `customUniforms_${shaderObject.shaderName}`;
                if (changes[key]) {
                    const newValues = changes[key].newValue;
                    if (newValues && shaderObject.metaData?.customUniforms) {
                        shaderObject.metaData.customUniforms.forEach((uniform: ShaderUniform) => {
                            if (newValues[uniform.name] !== undefined && threeProps.tuniform[uniform.name]) {
                                let value = newValues[uniform.name];
                                
                                // Convert value based on type
                                switch(uniform.type) {
                                    case 'bool':
                                        value = value ? 1.0 : 0.0;
                                        break;
                                    case 'vec2':
                                        value = new Vector2(...(Array.isArray(value) ? value : [value, value]));
                                        break;
                                    case 'vec3':
                                        value = new Vector3(...(Array.isArray(value) ? value : [value, value, value]));
                                        break;
                                    case 'vec4':
                                        value = new Vector4(...(Array.isArray(value) ? value : [value, value, value, value]));
                                        break;
                                }
                                
                                threeProps.tuniform[uniform.name].value = value;
                            }
                        });
                    }
                }
            };
            
            browser.storage.onChanged.addListener(storageListener);
            
            return () => {
                browser.storage.onChanged.removeListener(storageListener);
            };
        }
    }, [shaderObject, threeProps]);

    useEffect(() => {
        // Set up the frequency data array
        initializeProps();
        return () => {
            // cleanup video listeners/callback chaining
            stopVideoFrameRef.current = true;
            const v: any = videoElement;
            if (v && v.__onTimeUpdateShaderAmp) {
                v.removeEventListener('timeupdate', v.__onTimeUpdateShaderAmp);
                delete v.__onTimeUpdateShaderAmp;
            }
        }
    }, []);

    // Mouse tracking for iMouse uniform (ShaderToy compatible)
    useEffect(() => {
        if (!threeProps) return;
        
        let isMouseDown = false;
        
        const handleMouseMove = (event: MouseEvent) => {
            const tuniform = threeProps.tuniform;
            if (tuniform && tuniform.iMouse) {
                if (isMouseDown) {
                    // Update mouse position (xy) only when button is down
                    tuniform.iMouse.value.x = event.clientX;
                    tuniform.iMouse.value.y = window.innerHeight - event.clientY; // Flip Y to match ShaderToy convention
                }
            }
        };
        
        const handleMouseDown = (event: MouseEvent) => {
            if (event.button === 0) { // Left mouse button
                isMouseDown = true;
                const tuniform = threeProps.tuniform;
                if (tuniform && tuniform.iMouse) {
                    // Set click position (zw) and current position (xy)
                    tuniform.iMouse.value.x = event.clientX;
                    tuniform.iMouse.value.y = window.innerHeight - event.clientY;
                    tuniform.iMouse.value.z = event.clientX;
                    tuniform.iMouse.value.w = window.innerHeight - event.clientY;
                }
            }
        };
        
        const handleMouseUp = (event: MouseEvent) => {
            if (event.button === 0) { // Left mouse button
                isMouseDown = false;
                const tuniform = threeProps.tuniform;
                if (tuniform && tuniform.iMouse) {
                    // Set zw to negative to indicate mouse is up (ShaderToy convention)
                    tuniform.iMouse.value.z = -Math.abs(tuniform.iMouse.value.z);
                    tuniform.iMouse.value.w = -Math.abs(tuniform.iMouse.value.w);
                }
            }
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [threeProps]);

    // Keyboard tracking for iKeyboard uniform (ShaderToy compatible)
    useEffect(() => {
        if (!threeProps) return;
        
        const handleKeyDown = (event: KeyboardEvent) => {
            const keyCode = event.keyCode;
            if (keyCode < KEYBOARD_TEXTURE_WIDTH) {
                const prevState = keyboardPrevStateRef.current[keyCode];
                
                // Set key down state (row 0)
                keyboardStateRef.current[keyCode] = 255;
                
                // Set key pressed state (row 1) - only on transition from up to down
                if (prevState === 0) {
                    keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH + keyCode] = 255;
                    keyboardPressTimeRef.current[keyCode] = currentTimeRef.current;
                }
                
                // Clear key released state (row 2)
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 2 + keyCode] = 0;
                
                keyboardPrevStateRef.current[keyCode] = 255;
            }
        };
        
        const handleKeyUp = (event: KeyboardEvent) => {
            const keyCode = event.keyCode;
            if (keyCode < KEYBOARD_TEXTURE_WIDTH) {
                // Clear key down state (row 0)
                keyboardStateRef.current[keyCode] = 0;
                
                // Clear key pressed state (row 1)
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH + keyCode] = 0;
                
                // Set key released state (row 2)
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 2 + keyCode] = 255;
                
                keyboardPrevStateRef.current[keyCode] = 0;
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [threeProps]);

    useEffect(() => {
        if (!analyser) {
            return;
        }
        console.log('analyser bin count: ', analyser.frequencyBinCount);
        const props = threeProps;
        const messageHandler = (msg: any, sender: any) => { 
            if (!msg.command) { 
                return;
            }
            const defaultIncrement = 0.5;
            const cmd = msg.command;
            const tuniform = matRef.current!.uniforms as TUniform;
            if (cmd === RESET_TIME) {
                resetTime(tuniform);
            } else if (cmd == INCR_TIME) {
                incrementTime(tuniform, defaultIncrement);
            } else if (cmd == DECR_TIME) {
                incrementTime(tuniform, -defaultIncrement);
            }
        };
        browser.runtime.onMessage.addListener(messageHandler);
        return () => {
            browser.runtime.onMessage.removeListener(messageHandler);
        }
    }, [analyser]);

    useEffect(() => {
        if (!threeProps) return;
        // Avoid re-loading the same shader and render scale repeatedly
        if (loadedShaderName === shaderObject.shaderName && loadedRenderScale === renderScale) return;
        
        console.log('Load Fragment Shader', threeProps, shaderObject, 'at scale', renderScale);
        
        // Handle fade transition
        if (shaderFade && loadedShaderName && !isTransitioning) {
            console.log('Starting fade transition from', loadedShaderName, 'to', shaderObject.shaderName);
            setPreviousShaderName(loadedShaderName);
            setIsTransitioning(true);
            setFadeProgress(0.0);
            
            // Load the new shader after a brief delay to allow fade setup
            setTimeout(async () => {
                await loadFragmentShader();
                await setupMultipassBuffers();
                setLoadedShaderName(shaderObject.shaderName);
                setLoadedRenderScale(renderScale);
            }, 50); // 50ms delay
        } else {
            // Direct load when fade is disabled or no previous shader
            (async () => {
                await loadFragmentShader();
                await setupMultipassBuffers();
                setLoadedShaderName(shaderObject.shaderName);
                setLoadedRenderScale(renderScale);
            })();
        }
    }, [threeProps, shaderObject, loadedShaderName, loadedRenderScale, renderScale, shaderFade, isTransitioning]);


   useEffect(() => {
        if (!threeProps) {
            return;
        }
        const tuniform = threeProps.tuniform!;
        tuniform.iResolution.value.set(viewport.width * renderScale, viewport.height * renderScale, 1.0);
    }, [threeProps, viewport.width, viewport.height, renderScale]);

    useFrame((state, delta) => {
        if (!analyser || !canvas || !threeProps) return;

        // Update fade progress
        if (shaderFade && isTransitioning) {
            const newFadeProgress = Math.min(fadeProgress + delta * 1.25, 1.0); // ~0.8 second fade duration
            setFadeProgress(newFadeProgress);
            
            const tuniform = threeProps.tuniform!;
            if (tuniform && tuniform.iTransitionOpacity) {
                tuniform.iTransitionOpacity.value = newFadeProgress;
            }
            if (previousMatRef.current && previousMatRef.current.uniforms.iTransitionOpacity) {
                previousMatRef.current.uniforms.iTransitionOpacity.value = 1.0 - newFadeProgress;
            }
            
            if (newFadeProgress >= 1.0) {
                setIsTransitioning(false);
                setPreviousShaderName("");
                // Clean up previous material
                if (previousMatRef.current) {
                    (previousMatRef.current as any).dispose();
                    (previousMatRef.current as any) = null;
                }
                console.log('Fade transition completed');
            }
        } else {
            const tuniform = threeProps.tuniform!;
            if (tuniform && tuniform.iTransitionOpacity) {
                tuniform.iTransitionOpacity.value = 1.0;
            }
        }
        
        // Beat detection for shader randomization
        if (randomizeBeat && fbcArrayRef.current) {
            const bassEnd = Math.floor(frequencyBinCount * 0.1); // Low frequencies for beat detection
            let bassSum = 0;
            for (let i = 0; i < bassEnd; i++) {
                bassSum += fbcArrayRef.current[i];
            }
            const bassAverage = bassSum / bassEnd;
            const beatThreshold = 200; // Adjust based on audio levels
            
            if (bassAverage > beatThreshold) {
                beatCounterRef.current++;
                if (beatCounterRef.current >= randomizeBeatInterval) {
                    console.log(`[ShaderAmp] Changing shader after ${randomizeBeatInterval} beats`);
                    onShaderChangeRequested?.();
                    beatCounterRef.current = 0; // Reset counter
                }
            }
        }
        
        // Update the frequencyBinCount array
        const fbcArray = fbcArrayRef.current as any; // Force type for Three.js compatibility
        analyser.getByteFrequencyData(fbcArray);
        if (currentTimeRef.current % 1 < 0.02) {
            const arr = fbcArray as Uint8Array;
            console.log('[SA] audio max:', Math.max(...Array.from(arr.slice(0, 32))));
        }
        
        // If the 2d element is available, draw the bars
        const ctx = canvas!.getContext('2d');
        if (ctx) {
            if (draw_analyzer) {
                const bar_count = window.innerWidth / 2;
                ctx.fillStyle = fill_color;

                for (var i = 0; i < bar_count; i++) {
                    const bar_pos = i * 4;
                    const bar_width = 2;
                    const bar_height = -(fbcArray[i] / 2);

                    ctx.fillRect(bar_pos, canvas!.height, bar_width, bar_height);
                }
            }
        }
        
        // Calculate the shader specific rate
        const sum = fbcArray.reduce((a: number, b: number) => a + b, 0);
        const avg = (sum / fbcArray.length) || 0.1;
        let rate = min_speed + avg / (speedDivider == 0 ? 0.1 : speedDivider);
        // Clamp to a reasonable range for HTMLVideoElement playback and GPU texture updates
        const minVideoRate = 0.25;
        const maxVideoRate = 3.0;
        rate = Math.min(Math.max(rate, minVideoRate), maxVideoRate)

        // Update the main uniforms
        const clockDelta = threeProps.clock.getDelta();
        const shaderFactor = shaderObject.metaData?.shaderSpeed ?? default_shader_factor;
        const tuniform = threeProps.tuniform;
        tuniform.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
        tuniform.iTime.value += clockDelta;
        tuniform.iTimeDelta.value = clockDelta;
        tuniform.iFrameRate.value = clockDelta > 0 ? 1.0 / clockDelta : 60.0;
        tuniform.iDate.value = getCurrentDateVector();

        // Update iChannelTime - time since each channel was loaded
        const currentTime = tuniform.iTime.value;
        for (let ch = 0; ch < 4; ch++) {
            const loadTime = channelLoadTimeRef.current[ch];
            if (loadTime > 0) {
                tuniform.iChannelTime.value[ch] = currentTime - loadTime;
            } else {
                tuniform.iChannelTime.value[ch] = 0.0;
            }
        }

        // Update keyboard texture (ShaderToy compatible)
        currentTimeRef.current = tuniform.iTime.value;
        
        // Clear pressed/released states each frame (rows 1 and 2)
        for (let i = 0; i < KEYBOARD_TEXTURE_WIDTH; i++) {
            keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH + i] = 0; // Clear pressed state
            keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 2 + i] = 0; // Clear released state
            
            // Update key time in row 3 (normalized 0.0-1.0 based on how long key has been held)
            if (keyboardStateRef.current[i] > 0) { // If key is currently down
                const holdTime = currentTimeRef.current - keyboardPressTimeRef.current[i];
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 3 + i] = Math.min(holdTime * 255, 255);
            } else {
                keyboardStateRef.current[KEYBOARD_TEXTURE_WIDTH * 3 + i] = 0;
            }
        }
        
        // Notify to update the iKeyboard texture
        tuniform.iKeyboard.value.needsUpdate = true;

        // Notify to update the iAudioData texture as the fbcArray has been updated
        tuniform.iAudioData.value.needsUpdate = true;

        // Synchronize uniforms between current and previous shader materials during fade
        if (shaderFade && isTransitioning && previousMatRef.current && matRef.current) {
            const currentUniforms = matRef.current.uniforms;
            const previousUniforms = previousMatRef.current.uniforms;
            
            // Apply the same audio-reactive time updates to previous shader
            if (previousUniforms.iAmplifiedTime && currentUniforms.iAmplifiedTime) {
                previousUniforms.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
            }
            if (previousUniforms.iTime && currentUniforms.iTime) {
                previousUniforms.iTime.value += clockDelta;
            }
            if (previousUniforms.iTimeDelta && currentUniforms.iTimeDelta) {
                previousUniforms.iTimeDelta.value = clockDelta;
            }
            if (previousUniforms.iDate && currentUniforms.iDate) {
                previousUniforms.iDate.value = getCurrentDateVector();
            }
            if (previousUniforms.iFrame && currentUniforms.iFrame) {
                previousUniforms.iFrame.value = currentUniforms.iFrame.value;
            }
            
            // Update audio and video textures for reactivity
            if (previousUniforms.iAudioData && currentUniforms.iAudioData) {
                previousUniforms.iAudioData.value = currentUniforms.iAudioData.value;
                previousUniforms.iAudioData.value.needsUpdate = true;
            }
            if (previousUniforms.iVideo && currentUniforms.iVideo) {
                previousUniforms.iVideo.value = currentUniforms.iVideo.value;
                previousUniforms.iVideo.value.needsUpdate = true;
            }
            if (previousUniforms.iKeyboard && currentUniforms.iKeyboard) {
                previousUniforms.iKeyboard.value = currentUniforms.iKeyboard.value;
                previousUniforms.iKeyboard.value.needsUpdate = true;
            }
            if (previousUniforms.iMouse && currentUniforms.iMouse) {
                previousUniforms.iMouse.value = currentUniforms.iMouse.value;
            }
            if (previousUniforms.iResolution && currentUniforms.iResolution) {
                previousUniforms.iResolution.value = currentUniforms.iResolution.value;
            }
        }

        // Ensure the video texture advances
        const videoTex = threeProps.tuniform.iVideo.value as VideoTexture;
        if (videoTex) {
            videoTex.needsUpdate = true;
        }

        const video = videoElement as HTMLVideoElement;
        if (video) {
            // Smooth playbackRate changes to reduce stalls
            const smoothed = video.playbackRate * 0.85 + rate * 0.15;
            if (Math.abs(video.playbackRate - smoothed) > 0.01) {
                video.playbackRate = smoothed;
            }
            // Auto-resume playback if paused by the browser due to rapid changes
            if (video.paused) {
                video.play().catch(() => {/* ignore */});
            }
        }

        // Simple fade using opacity transition
        // Render multipass buffers (if any) into their targets before main render
        if (threeProps.buffers && threeProps.buffers.length > 0 && threeProps.bufferCamera) {
            const fallbackWrap = (shaderObject.metaData as any)?.textureWrap === "repeat" ? RepeatWrapping : ClampToEdgeWrapping;
            const prevTarget = gl.getRenderTarget();
            // Build current read textures snapshot
            const readTextures: (any|undefined)[] = threeProps.buffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);
            // For each buffer: bind its iChannels (buffer refs use readTextures), render to its write target, then swap indices
            for (let i = 0; i < threeProps.buffers.length; i++) {
                const br = threeProps.buffers[i];
                if (!br) continue;

                const u = br.material.uniforms as TUniform;
                const meta = br.channelMeta;
                const samplers = br.channelSamplers || {};
                const pre = br.preloaded;

                // Set channels: prefer buffer refs using read textures; otherwise use preloaded textures (if any)
                const setCh = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any, sampler?: SamplerConfig) => {
                    if (src === 'audio') {
                        (u[slot] as any).value = tuniform.iAudioData.value;
                        return;
                    }
                    let val: any;
                    const m = src && src.match(/^buffer(\d+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else {
                        val = preVal;
                    }
                    if (val) {
                        (u[slot] as any).value = val;
                        const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                        (u[slot] as any).value.wrapS = (u[slot] as any).value.wrapT = wrap;
                    }
                };

                setCh('iChannel0', meta.iChannel0, pre?.iChannel0, samplers.iChannel0);
                setCh('iChannel1', meta.iChannel1, pre?.iChannel1, samplers.iChannel1);
                setCh('iChannel2', meta.iChannel2, pre?.iChannel2, samplers.iChannel2);
                setCh('iChannel3', meta.iChannel3, pre?.iChannel3, samplers.iChannel3);

                const writeTarget = br.targets[br.writeIndex];
                gl.setRenderTarget(writeTarget);
                gl.clear(true, true, false);
                gl.render(br.scene, threeProps.bufferCamera);

                // swap read/write
                const tmp = br.readIndex; br.readIndex = br.writeIndex; br.writeIndex = tmp;
            }

            // Bind final pass buffer channels from current read textures, or preloaded textures
            if (threeProps.finalChannels) {
                const finalU = matRef.current!.uniforms as TUniform;
                const fc = threeProps.finalChannels;
                const fp = threeProps.finalPreloaded || {};
                const finalMeta = shaderObject.metaData as any || {};
                const setFinal = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any) => {
                    if (src === 'audio') {
                        (finalU[slot] as any).value = tuniform.iAudioData.value;
                        return;
                    }
                    let val: any;
                    const m = src && src.match(/^buffer(\d+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else {
                        val = preVal;
                    }
                    if (val) {
                        (finalU[slot] as any).value = val;
                        const sampler: SamplerConfig | undefined = finalMeta[`${slot}Sampler`];
                        const wrap = sampler?.wrap === 'repeat' ? RepeatWrapping : (sampler?.wrap === 'clamp' ? ClampToEdgeWrapping : fallbackWrap);
                        (finalU[slot] as any).value.wrapS = (finalU[slot] as any).value.wrapT = wrap;
                    }
                };
                setFinal('iChannel0', fc.iChannel0, (fp as any).iChannel0);
                setFinal('iChannel1', fc.iChannel1, (fp as any).iChannel1);
                setFinal('iChannel2', fc.iChannel2, (fp as any).iChannel2);
                setFinal('iChannel3', fc.iChannel3, (fp as any).iChannel3);
            }

            // restore
            gl.setRenderTarget(prevTarget);
        }

        // Increment frame count at the very end of rendering the frame
        threeProps.tuniform.iFrame.value += 1;
    });

    return (
        <>
            {/* Previous shader mesh for fade out */}
            {shaderFade && isTransitioning && previousMatRef.current && (
                <mesh visible>
                    <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
                    <shaderMaterial
                        attach="material"
                        uniforms={previousMatRef.current.uniforms}
                        vertexShader={general_purpose_vertex_shader}
                        fragmentShader={previousMatRef.current.fragmentShader}
                        side={DoubleSide}
                        transparent={true}
                        opacity={1.0 - fadeProgress}
                    />
                </mesh>
            )}
            {/* Current shader mesh */}
            <mesh visible>
                <planeGeometry attach="geometry" args={[viewport.width, viewport.height, 1, 1]} />
                <shaderMaterial
                    attach="material"
                    uniforms={threeProps?.tuniform}
                    vertexShader={general_purpose_vertex_shader}
                    side={DoubleSide}
                    transparent={shaderFade && isTransitioning}
                    opacity={shaderFade && isTransitioning ? fadeProgress : 1.0}
                    ref={matRef} />
            </mesh>
        </>
    );
};
