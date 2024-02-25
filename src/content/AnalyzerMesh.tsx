import React, { useEffect, useState, useRef } from 'react';
import browser from "webextension-polyfill";
import { useFrame } from '@react-three/fiber';
import {
    Clock,
    DataTexture, DoubleSide, IUniform,
    LuminanceFormat, PixelFormat,
    RedFormat, RepeatWrapping,
    TextureLoader,
    Vector2,
    Vector4,
    VideoTexture,
    WebGLRenderer,
    ShaderMaterial } from "three";
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import css from "./styles.module.css";

const maxRate = 15;
const minRate = 0;
const fftSize = 128;
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
    shaderObject: ShaderObject;
    speedDivider: number;
}

export const AnalyzerMesh = ({ analyser, canvas, shaderObject, speedDivider } : AnalyzerMeshProps) => {
    const matRef = useRef<ShaderMaterial>(null);
    const [draw_analyzer, setDrawAnalyzer] = useState(true);
    const [threeProps, setThreeProps] = useState<{
        clock: Clock;
        format: PixelFormat;
        tuniform: { [uniform: string]: IUniform; };
    }>();
    
    const loadFragmentShader = async () => {
        console.log(`loading shader with name: ${shaderObject.shaderName}, and metaData: `, shaderObject.metaData);
        const material = matRef.current as ShaderMaterial;
        const loadedFragmentShader = await fetchFragmentShader(shaderObject.shaderName);
        material.fragmentShader = loadedFragmentShader;
        material.needsUpdate = true;
    }

    useEffect(() => {
        loadFragmentShader();
    }, [shaderObject]);

    useEffect(() => {
        (async () => {
            if (analyser) {
                const format = (new WebGLRenderer().capabilities.isWebGL2) ? RedFormat : LuminanceFormat;

                const fbc_array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(fbc_array);

                const webcam = document.getElementById(css.bgVideo);
                const video_texture = new VideoTexture(webcam as HTMLVideoElement);
                const clock = new Clock();

                const tuniform = {
                    iGlobalTime: { type: 'f', value: 0.1 },
                    iChannel0: {
                        type: 't',
                        value: new TextureLoader().load(browser.runtime.getURL('images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg'))
                    },
                    iChannel1: {
                        type: 't',
                        value: new TextureLoader().load(browser.runtime.getURL('images/beton_3_pexels-photo-5622880.jpeg'))
                    },
                    iAudioData: { value: new DataTexture(fbc_array, fftSize / 2, 1, format) },
                    iResolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
                    iVideo: { value: video_texture },
                    iMouse: { value: new Vector4(window.innerWidth / 2, window.innerHeight / 2), type: 'v4', },
                    iTime: { type: 'f', value: 0.1 },
                    iFrame: { type: 'i', value: 0 }
                };
                tuniform.iChannel0.value.wrapS = tuniform.iChannel0.value.wrapT = RepeatWrapping;
                tuniform.iChannel1.value.wrapS = tuniform.iChannel1.value.wrapT = RepeatWrapping;
                setThreeProps({
                    clock,
                    format,
                    tuniform
                });
            }
        })();
    }, [analyser]);

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
        let rate = min_speed + avg / (speedDivider == 0 ? 0.1 : speedDivider);
        rate = Math.min(Math.max(rate, minRate), maxRate)

        if (threeProps) {
            const current = { ...threeProps };
            const delta = current.clock.getDelta();
            const shaderFactor = shaderObject.metaData?.shaderSpeed ?? default_shader_factor;
            current.tuniform.iGlobalTime.value += (delta * rate * shaderFactor);
            current.tuniform['iTime'].value += delta;
            current.tuniform['iFrame'].value += 1;

            // music related shader updates
            current.tuniform.iAudioData = { value: new DataTexture(fbc_array, fftSize / 2, 1, current.format) };
            current.tuniform.iAudioData.value.needsUpdate = true;
            setThreeProps(current);
        }

        const video = document.getElementById(css.bgVideo) as HTMLVideoElement;
        if (video) {
            video.playbackRate = rate;
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
