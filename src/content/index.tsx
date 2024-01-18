import React, {useEffect, useState, useRef} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas, useFrame} from '@react-three/fiber'
import {getCurrentTab} from "@src/helpers/tabActions";
import {getStorage} from "@src/helpers/storage";
import {
    Scene,
    Clock,
    DataTexture, DoubleSide, IUniform,
    LuminanceFormat, PixelFormat,
    RedFormat, RepeatWrapping,
    TextureLoader,
    Vector2,
    Vector4,
    VideoTexture,
    WebGLRenderer
} from "three";
import "../css/app.css";
import css from "./styles.module.css";

const fftSize = 128;
const fill_color = "#4087A0" // fill color for the 2d analyzer
const min_speed = 0.3;
const speed_devider = 25.1;
const shader_factor = 1.0;

const general_purpose_vertex_shader = `
varying vec2 vUv; 
void main()
{
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`

const fetchFragmentShader = async (name: string) => {
    const res = await fetch(browser.runtime.getURL(`shaders/${name}.frag`), {
        cache: "no-cache",
    })
    return res.text()
}

const hash = (input?: string) => {
    if (!input) return '';
    let h = 0
    for(let i = 0, h = 0; i < input.length; i++)
        h = Math.imul(31, h) + input.charCodeAt(i) | 0;
    return h.toString();
}

const AnalyzerMesh: React.FC<{
    analyser: AnalyserNode | undefined,
    canvas: HTMLCanvasElement | null
}> = ({ analyser, canvas }) => {
    const [draw_analyzer, setDrawAnalyzer] = useState(true)

    const [threeProps, setThreeProps] = useState<{
        clock: Clock,
        format: PixelFormat,
        tuniform: { [uniform: string]: IUniform; },
        fragmentShader: string
    }>()
    useEffect(() => {
        (async () => {
            if (analyser) {
                const format = (new WebGLRenderer().capabilities.isWebGL2) ? RedFormat : LuminanceFormat

                const fbc_array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(fbc_array);

                const webcam = document.getElementById(css.bgVideo);
                const video_texture = new VideoTexture(webcam as HTMLVideoElement);
                const clock = new Clock();

                const tuniform = {
                    iGlobalTime: {type: 'f', value: 0.1},
                    iChannel0: {
                        type: 't',
                        value: new TextureLoader().load(browser.runtime.getURL('images/pexels-eberhard-grossgasteiger-966927.jpg'))
                    },
                    iChannel1: {
                        type: 't',
                        value: new TextureLoader().load(browser.runtime.getURL('images/beton_3_pexels-photo-5622880.jpeg'))
                    },
                    iAudioData: {value: new DataTexture(fbc_array, fftSize / 2, 1, format)},
                    iResolution: {value: new Vector2(window.innerWidth, window.innerHeight)},
                    iVideo: {value: video_texture},
                    iMouse: {value: new Vector4(window.innerWidth / 2, window.innerHeight / 2), type: 'v4',},
                    iTime: {type: 'f', value: 0.1},
                    iFrame: {type: 'i', value: 0}

                }
                tuniform.iChannel0.value.wrapS = tuniform.iChannel0.value.wrapT = RepeatWrapping;
                tuniform.iChannel1.value.wrapS = tuniform.iChannel1.value.wrapT = RepeatWrapping;

                const initialFragmentShader = await fetchFragmentShader("MusicalHeart")
                setThreeProps({
                    clock,
                    format,
                    tuniform,
                    fragmentShader: initialFragmentShader,
                })
            }
        })();
    }, [analyser]);
    const [hovered, setHover] = useState(false)

    useFrame((state, delta) => {
        if (!analyser || !canvas) return;

        // We should probably re-use this array so it doesn't allocate every frame
        // More info here: https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/frequencyBinCount
        const fbc_array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(fbc_array);

        // If the 2d element is available, draw the bars
        const ctx = canvas!.getContext('2d');
        if (ctx) {
            if (draw_analyzer) {
                const bar_count = window.innerWidth / 2;
                ctx.fillStyle = fill_color;

                for (var i = 0; i < bar_count; i++) {
                    const bar_pos = i * 4;
                    const bar_width = 2;
                    const bar_height = -(fbc_array[i] / 2);

                    ctx.fillRect(bar_pos, canvas!.height, bar_width, bar_height);
                }
            }
        }
        const sum = fbc_array.reduce((a, b) => a + b, 0);
        const avg = (sum / fbc_array.length) || 0.1;

        // @ts-ignore
        let rate = min_speed + avg / (speed_devider == 0 ? 0.1 : speed_devider);
        if (rate > 15) rate = 15;
        if (rate < 0) rate = 0;

        if (threeProps) {
            const current = {...threeProps};
            const delta = current.clock.getDelta();
            current.tuniform.iGlobalTime.value += (delta * rate * shader_factor); //* shader_factor;
            current.tuniform['iTime'].value += delta;
            current.tuniform['iFrame'].value += 1;

            // music related shader updates
            current.tuniform.iAudioData = {value: new DataTexture(fbc_array, fftSize / 2, 1, current.format)};
            current.tuniform.iAudioData.value.needsUpdate = true;
            setThreeProps(current);
        }

        const video = document.getElementById(css.bgVideo) as HTMLVideoElement;
        if (video) {
            video.playbackRate = rate;
        }
    })

    return <mesh visible>
        <planeGeometry attach="geometry" args={[228, 138, 1, 1]}/>
        <shaderMaterial
            key={hash(threeProps?.fragmentShader)}
            attach="material"
            uniforms={threeProps?.tuniform}
            vertexShader={general_purpose_vertex_shader}
            fragmentShader={threeProps?.fragmentShader}
            side={DoubleSide}
        />
    </mesh>
}

const App: React.FC = () => {
    const [openerTab, setOpenerTab] = useState<browser.Tabs.Tab | undefined>();
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
    const analyserCanvasRef = useRef<HTMLCanvasElement>(null)
    const renderCanvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = analyserCanvasRef.current;
        const context = canvas!.getContext('2d');
        context!.fillStyle = fill_color;
    }, [analyserCanvasRef]);

    useEffect(() => {
        (async () => {
            // Todo: Clean up any previously created analyser
            const currentTab = await getCurrentTab()
            if (currentTab?.openerTabId) {
                const openerTab = await browser.tabs.get(currentTab.openerTabId)
                setOpenerTab(openerTab)

                const tabMapping: TabMapping = await getStorage("tabMapping")
                const tabData = tabMapping[currentTab.openerTabId]

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        // @ts-ignore
                        mandatory: {
                            chromeMediaSource: "tab",
                            chromeMediaSourceId: tabData.stream,
                        },
                    },
                    video: false,
                });

                const audioContext = new AudioContext();
                const mediaStream = audioContext.createMediaStreamSource(stream);

                // prevent tab mute
                const output = audioContext.createMediaStreamSource(stream);
                output.connect(audioContext.destination);

                const analyser = audioContext.createAnalyser();
                mediaStream.connect(analyser);
                setAnalyser(analyser);
            }
        })();
    }, [window.innerHeight, window.innerWidth]);

    return (
        <div id="canvas-container">
            <h1 className="m-2 text-2xl font-medium leading-tight text-primary fixed z-40">{openerTab?.title}</h1>
            <canvas id={css.analyserCanvas} ref={analyserCanvasRef} />
            <Canvas
                id={css.renderCanvas}
                className="z-50"
                style={{position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh"}}
                ref={renderCanvasRef}>
                <perspectiveCamera
                    fov={75}
                    aspect={window.innerWidth / window.innerHeight}
                    near={0.1}
                    far={1000}
                    position={[0, 0, 90]}
                />
                <AnalyzerMesh analyser={analyser} canvas={renderCanvasRef.current}/>
            </Canvas>
            <video id={css.bgVideo} src={browser.runtime.getURL("media/SpaceTravel1Min.mp4")} controls={false} muted
                   loop autoPlay style={{visibility: analyser ? 'hidden' : 'visible'}}></video>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App/>);