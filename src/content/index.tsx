import React, {useEffect, useState, useRef} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import { Canvas, useFrame, Camera } from '@react-three/fiber'
import {getCurrentTab} from "@src/helpers/tabActions";
import {getStorage} from "@src/helpers/storage";
import {
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
    const res = await fetch(browser.runtime.getURL(`shaders/${name}.frag`))
    return res.text()
}

const AnalyzerMesh: React.FC<{
    analyser: AnalyserNode | undefined,
    canvas: HTMLCanvasElement | null
}> = ({ analyser, canvas }) => {
    const [draw_analyzer, setDrawAnalyzer] = useState(true)

    const threeProps = useRef<{
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
                threeProps.current = {
                    clock,
                    format,
                    tuniform,
                    fragmentShader: initialFragmentShader,
                }
            }
        })();
    }, [analyser, window.innerHeight, window.innerWidth]);
    const [hovered, setHover] = useState(false)

    useFrame((state, delta) => {
        if (!analyser || !canvas) return;
        const fbc_array = new Uint8Array(analyser.frequencyBinCount);
        const bar_count = window.innerWidth / 2;

        analyser.getByteFrequencyData(fbc_array);
        const ctx = canvas!.getContext('2d');
        if (ctx) {
            if (draw_analyzer) {
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

        if (threeProps.current) {
            const current = threeProps.current;
            const delta = current.clock.getDelta();
            current.tuniform.iGlobalTime.value += (delta * rate * shader_factor); //* shader_factor;
            current.tuniform['iTime'].value += delta;
            current.tuniform['iFrame'].value += 1;

            // music related shader updates
            //fbc_array = new Uint8Array(analyser.frequencyBinCount);
            //analyser.getByteFrequencyData(fbc_array);
            current.tuniform.iAudioData = {value: new DataTexture(fbc_array, fftSize / 2, 1, current.format)};
            current.tuniform.iAudioData.value.needsUpdate = true;
            threeProps.current = current;
        }

        const video = document.getElementById(css.bgVideo) as HTMLVideoElement;
        if (video) {
            video.playbackRate = rate;
        }
    })

    return threeProps.current
        ? <mesh visible>
            <planeGeometry attach="geometry" args={[228, 138, 1, 1]}/>
            <shaderMaterial
                attach="material"
                uniforms={threeProps.current.tuniform}
                vertexShader={general_purpose_vertex_shader}
                fragmentShader={threeProps.current.fragmentShader}
                side={DoubleSide}
            />
        </mesh>
        : null
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
    }, []);

    return (
        <div>
            <h1 className="m-2 text-2xl font-medium leading-tight text-primary fixed z-40">{openerTab?.title}</h1>
            <canvas id={css.analyserCanvas} ref={analyserCanvasRef} />
            <Canvas
                id={css.renderCanvas}
                className="z-50"
                style={{position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh"}}
                camera={{position: [0, 0, 90]}}
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
                   loop autoPlay></video>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App/>);