import React, { useEffect, useState, useRef } from 'react';
import browser from "webextension-polyfill";
import { useFrame, useThree } from '@react-three/fiber';
import {
    Clock,
    Cache,
    DataTexture, DoubleSide, IUniform,
    LuminanceFormat, PixelFormat,
    RedFormat, RepeatWrapping,
    TextureLoader,
    Vector2,
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
    ClampToEdgeWrapping } from "three";
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import css from "./styles.module.css";
import { DECR_TIME, INCR_TIME, RESET_TIME } from '@src/helpers/constants';

Cache.enabled = true;
const maxRate = 15;
const minRate = 0;
const fftSize = 1024; // make this configurable
const fill_color = "#4087A0" // fill color for the 2d analyzer
const min_speed = 0.3;
const default_shader_factor = 1.0;

const general_purpose_vertex_shader = `
varying vec2 vUv; 
void main()
{
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`

type AnalyzerMeshProps = {
    analyser: AnalyserNode | undefined;
    canvas: HTMLCanvasElement | null;
    videoElement: HTMLVideoElement | null;
    shaderObject: ShaderObject;
    speedDivider: number;
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
};

type BufferRuntime = {
    material: ShaderMaterial;
    scene: Scene;
    targets: [WebGLRenderTarget, WebGLRenderTarget];
    readIndex: number;
    writeIndex: number;
    channelMeta: { iChannel0?: string; iChannel1?: string; iChannel2?: string; iChannel3?: string };
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

export const AnalyzerMesh = ({ analyser, canvas, videoElement, shaderObject, speedDivider } : AnalyzerMeshProps) => {
    const frequencyBinCount = 1024; // Assuming the analyserNode.fftSize is the default 2048;
    const fbcArrayRef = useRef<Uint8Array>(new Uint8Array(frequencyBinCount));
    const matRef = useRef<ShaderMaterial>(null);
    const [draw_analyzer, setDrawAnalyzer] = useState(true);
    const [threeProps, setThreeProps] = useState<MaterialProps>();
    const [loadedShaderName, setLoadedShaderName] = useState<string>("");
    const viewport = useThree(state => state.viewport)
    const { gl } = useThree();
    const stopVideoFrameRef = useRef<boolean>(false);

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

        // Only load file textures when meta iChannelN is not a buffer reference. Otherwise, leave to multipass setup.
        const ch0 = shaderObject.metaData?.iChannel0;
        if (!isBufferRef(ch0)) {
            const shader_texture0 = ch0 ?? 'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg';
            tuniform.iChannel0.value = new TextureLoader().load(browser.runtime.getURL(shader_texture0));
            tuniform.iChannel0.value.wrapS = tuniform.iChannel0.value.wrapT = RepeatWrapping;
        }

        const ch1 = shaderObject.metaData?.iChannel1;
        if (!isBufferRef(ch1)) {
            const shader_texture1 = ch1 ?? 'images/beton_3_pexels-photo-5622880.jpeg';
            tuniform.iChannel1.value = new TextureLoader().load(browser.runtime.getURL(shader_texture1));
            tuniform.iChannel1.value.wrapS = tuniform.iChannel1.value.wrapT = RepeatWrapping;
        }

        const ch2 = shaderObject.metaData?.iChannel2;
        if (!isBufferRef(ch2)) {
            const shader_texture2 = ch2 ?? 'images/NyanCatSprite.png';
            tuniform.iChannel2.value = new TextureLoader().load(browser.runtime.getURL(shader_texture2));
            tuniform.iChannel2.value.wrapS = tuniform.iChannel2.value.wrapT = RepeatWrapping;
        }

        const ch3 = shaderObject.metaData?.iChannel3;
        if (!isBufferRef(ch3)) {
            const shader_texture3 = ch3 ?? 'images/NyanCatSprite.png';
            tuniform.iChannel3.value = new TextureLoader().load(browser.runtime.getURL(shader_texture3));
            tuniform.iChannel3.value.wrapS = tuniform.iChannel3.value.wrapT = RepeatWrapping;
        }

        const material = matRef.current as ShaderMaterial;
        const loadedFragmentShader = await fetchFragmentShader(shaderObject.shaderName);
        material.fragmentShader = loadedFragmentShader;
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
        return new TextureLoader().load(browser.runtime.getURL(src));
    }

    // Initialize optional multipass buffers described in shaderObject.metaData.buffers
    const setupMultipassBuffers = async () => {
        if (!threeProps) return;
        const meta: any = shaderObject.metaData;
        let buffersMeta: BufferMeta[] | undefined = meta?.buffers;
        if (!buffersMeta || buffersMeta.length === 0) {
            setThreeProps({ ...threeProps, buffers: [], bufferCamera: undefined });
            return;
        }

        // Ensure deterministic rendering order (lower outputs first)
        buffersMeta = [...buffersMeta].sort((a, b) => (a.output ?? 0) - (b.output ?? 0));

        const width = window.innerWidth;
        const height = window.innerHeight;
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
                iDate: shared.iDate,
                iAudioData: shared.iAudioData,
                iResolution: shared.iResolution,
                iVideo: shared.iVideo,
                iMouse: shared.iMouse,
                iFrame: shared.iFrame,
                iChannel0: { value: undefined },
                iChannel1: { value: undefined },
                iChannel2: { value: undefined },
                iChannel3: { value: undefined },
            } as TUniform;
        }

        // helper to preload non-buffer textures once
        const preloadIfPath = (src?: string) => {
            if (!src) return undefined;
            const m = src.match(/^buffer(\d+)$/);
            if (m) return undefined;
            return new TextureLoader().load(browser.runtime.getURL(src));
        };

        // Create all targets and materials first (double-buffered)
        for (let i = 0; i < buffersMeta.length; i++) {
            const b = buffersMeta[i];
            const targetA = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false });
            targetA.texture.generateMipmaps = false; targetA.texture.minFilter = LinearFilter; targetA.texture.magFilter = LinearFilter;
            const targetB = new WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false });
            targetB.texture.generateMipmaps = false; targetB.texture.minFilter = LinearFilter; targetB.texture.magFilter = LinearFilter;

            const mat = new ShaderMaterial({
                vertexShader: general_purpose_vertex_shader,
                fragmentShader: await fetchFragmentShader(b.shaderName),
                uniforms: makePassUniforms(baseUniforms),
            });
            const scene = new Scene();
            const quad = new Mesh(geometry, mat);
            scene.add(quad);

            bufferRuntimes[b.output] = {
                material: mat,
                scene,
                targets: [targetA, targetB],
                readIndex: 0,
                writeIndex: 1,
                channelMeta: { iChannel0: b.iChannel0, iChannel1: b.iChannel1, iChannel2: b.iChannel2, iChannel3: b.iChannel3 },
                preloaded: {
                    iChannel0: preloadIfPath(b.iChannel0),
                    iChannel1: preloadIfPath(b.iChannel1),
                    iChannel2: preloadIfPath(b.iChannel2),
                    iChannel3: preloadIfPath(b.iChannel3),
                }
            };
        }

        // Prepare final pass channel mapping and preloads
        const finalMeta = shaderObject.metaData as any;
        const finalChannels = { iChannel0: finalMeta?.iChannel0, iChannel1: finalMeta?.iChannel1, iChannel2: finalMeta?.iChannel2, iChannel3: finalMeta?.iChannel3 };
        const finalPreloaded = {
            iChannel0: preloadIfPath(finalChannels.iChannel0),
            iChannel1: preloadIfPath(finalChannels.iChannel1),
            iChannel2: preloadIfPath(finalChannels.iChannel2),
            iChannel3: preloadIfPath(finalChannels.iChannel3),
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
        const fbcArray = fbcArrayRef.current;
        const format = (new WebGLRenderer().capabilities.isWebGL2) ? RedFormat : LuminanceFormat;
        const dataTexture = new DataTexture(fbcArray, fftSize / 2, 1, format);
        const video_texture = new VideoTexture(videoElement as HTMLVideoElement);
        const clock = new Clock();

        const tuniform = {
            iAmplifiedTime: { type: 'f', value: 0.1 },
            iTime: { type: 'f', value: 0.1 },
            iDate: { value: getCurrentDateVector() },
            iChannel0: { value: undefined },
            iChannel1: { value: undefined },
            iChannel2: { value: undefined },
            iChannel3: { value: undefined },
            iAudioData: { value: dataTexture },
            iResolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
            iVideo: { value: video_texture },
            iMouse: { value: new Vector4(window.innerWidth / 2, window.innerHeight / 2, 0, 0), type: 'v4', },
            iFrame: { type: 'i', value: 0 }
        };
        
        const props = {
            clock,
            format,
            tuniform
        };
        setThreeProps(props);
    }

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
        // Avoid re-loading the same shader repeatedly
        if (loadedShaderName === shaderObject.shaderName) return;
        console.log('Load Fragment Shader', threeProps, shaderObject);
        (async () => {
            await loadFragmentShader();
            await setupMultipassBuffers();
            setLoadedShaderName(shaderObject.shaderName);
        })();
    }, [threeProps, shaderObject, loadedShaderName]);


   useEffect(() => {
        if (!threeProps) {
            return;
        }
        const tuniform = threeProps.tuniform!;
        tuniform.iResolution.value.set(viewport.width, viewport.height);
    }, [threeProps, viewport.width, viewport.height]);

    useFrame((state, delta) => {
        if (!analyser || !canvas || !threeProps) return;

        // Update the frequencyBinCount array
        const fbcArray = fbcArrayRef.current;
        analyser.getByteFrequencyData(fbcArray);
        
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
        const sum = fbcArray.reduce((a, b) => a + b, 0);
        const avg = (sum / fbcArray.length) || 0.1;
        let rate = min_speed + avg / (speedDivider == 0 ? 0.1 : speedDivider);
        // Clamp to a reasonable range for HTMLVideoElement playback and GPU texture updates
        const minVideoRate = 0.25;
        const maxVideoRate = 3.0;
        rate = Math.min(Math.max(rate, minVideoRate), maxVideoRate)

        const clockDelta = threeProps.clock.getDelta();
        const shaderFactor = shaderObject.metaData?.shaderSpeed ?? default_shader_factor;
        const tuniform = threeProps.tuniform;
        tuniform.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
        tuniform.iTime.value += clockDelta;
        tuniform.iDate.value = getCurrentDateVector();
        tuniform.iFrame.value += 1;

        // Notify to update the iAudioData texture as the fbcArray has been updated
        tuniform.iAudioData.value.needsUpdate = true;

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

        // Render multipass buffers (if any) into their targets before main render
        if (threeProps.buffers && threeProps.buffers.length > 0 && threeProps.bufferCamera) {
            const prevTarget = gl.getRenderTarget();
            const prevViewport = new Vector4();
            // @ts-ignore getViewport exists at runtime
            gl.getViewport(prevViewport);

            // Build current read textures snapshot
            const readTextures: (any|undefined)[] = threeProps.buffers.map((br) => br ? br.targets[br.readIndex].texture : undefined);

            // For each buffer: bind its iChannels (buffer refs use readTextures), render to its write target, then swap indices
            for (let i = 0; i < threeProps.buffers.length; i++) {
                const br = threeProps.buffers[i];
                if (!br) continue;

                const u = br.material.uniforms as TUniform;
                const meta = br.channelMeta;
                const pre = br.preloaded;

                const resolveFromMeta = (src?: string) => {
                    if (!src) return undefined;
                    const m = src.match(/^buffer(\d+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        return readTextures[idx];
                    }
                    return pre && (pre as any)[`iChannel${src}`] ? (pre as any)[`iChannel${src}`] : undefined;
                };

                // Set channels: prefer buffer refs using read textures; otherwise use preloaded textures (if any)
                const setCh = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any) => {
                    let val: any;
                    const m = src && src.match(/^buffer(\d+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else {
                        val = preVal;
                    }
                    if (val) { (u[slot] as any).value = val; (u[slot] as any).value.wrapS = (u[slot] as any).value.wrapT = RepeatWrapping; }
                };

                setCh('iChannel0', meta.iChannel0, pre?.iChannel0);
                setCh('iChannel1', meta.iChannel1, pre?.iChannel1);
                setCh('iChannel2', meta.iChannel2, pre?.iChannel2);
                setCh('iChannel3', meta.iChannel3, pre?.iChannel3);

                const writeTarget = br.targets[br.writeIndex];
                gl.setRenderTarget(writeTarget);
                // ensure correct viewport for the target size
                // @ts-ignore setViewport signature accepts numbers
                gl.setViewport(0, 0, writeTarget.width, writeTarget.height);
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
                const setFinal = (slot: 'iChannel0'|'iChannel1'|'iChannel2'|'iChannel3', src?: string, preVal?: any) => {
                    let val: any;
                    const m = src && src.match(/^buffer(\d+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        val = readTextures[idx];
                    } else {
                        val = preVal;
                    }
                    if (val) { (finalU[slot] as any).value = val; (finalU[slot] as any).value.wrapS = (finalU[slot] as any).value.wrapT = RepeatWrapping; }
                };
                setFinal('iChannel0', fc.iChannel0, (fp as any).iChannel0);
                setFinal('iChannel1', fc.iChannel1, (fp as any).iChannel1);
                setFinal('iChannel2', fc.iChannel2, (fp as any).iChannel2);
                setFinal('iChannel3', fc.iChannel3, (fp as any).iChannel3);
            }

            // restore
            gl.setRenderTarget(prevTarget);
            // @ts-ignore setViewport signature accepts Vector4
            gl.setViewport(prevViewport);
        }
    });

    return <mesh visible>
        <planeGeometry attach="geometry" args={[window.innerWidth, window.innerHeight, 1, 1]} />
        <shaderMaterial
            attach="material"
            uniforms={threeProps?.tuniform}
            vertexShader={general_purpose_vertex_shader}
            side={DoubleSide}
            ref={matRef} />
    </mesh>;
};
