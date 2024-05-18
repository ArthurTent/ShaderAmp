import React, { useEffect, useState, useRef } from 'react';
import browser from "webextension-polyfill";
import { useFrame } from '@react-three/fiber';
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
    ShaderMaterial } from "three";
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import css from "./styles.module.css";
import { DECR_TIME, INCR_TIME, RESET_TIME } from '@src/helpers/constants';

Cache.enabled = true;
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
    videoElement: HTMLVideoElement | null;
    shaderObject: ShaderObject;
    speedDivider: number;
}

type TUniform = { [uniform: string]: IUniform }; 

type MaterialProps = {
    clock: Clock;
    format: PixelFormat;
    tuniform: TUniform;
};

export const AnalyzerMesh = ({ analyser, canvas, videoElement, shaderObject, speedDivider } : AnalyzerMeshProps) => {
    const frequencyBinCount = 1024; // Assuming the analyserNode.fftSize is the default 2048;
    const fbcArrayRef = useRef<Uint8Array>(new Uint8Array(frequencyBinCount));
    const matRef = useRef<ShaderMaterial>(null);
    const [draw_analyzer, setDrawAnalyzer] = useState(true);
    const [threeProps, setThreeProps] = useState<MaterialProps>();
    const [loadedShaderName, setLoadedShaderName] = useState<string>("");

    const loadFragmentShader = async () => {
        console.log(`loading shader with name: ${shaderObject.shaderName}, and metaData: `, shaderObject.metaData);

        const video = videoElement!;
        video.src = shaderObject.metaData?.video ?? browser.runtime.getURL('media/SpaceTravel1Min.mp4');
        video.play();

        const tuniform = threeProps!.tuniform;

        const shader_texture0 = shaderObject.metaData?.iChannel0?? 'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg'
        tuniform.iChannel0.value = new TextureLoader().load(browser.runtime.getURL(shader_texture0));
        tuniform.iChannel0.value.wrapS = tuniform.iChannel0.value.wrapT = RepeatWrapping;

        const shader_texture1 = shaderObject.metaData?.iChannel1?? 'images/beton_3_pexels-photo-5622880.jpeg'
        tuniform.iChannel1.value = new TextureLoader().load(browser.runtime.getURL(shader_texture1));
        tuniform.iChannel1.value.wrapS = tuniform.iChannel1.value.wrapT = RepeatWrapping;

        const shader_texture2 = shaderObject.metaData?.iChannel2?? 'images/NyanCatSprite.png'
        tuniform.iChannel2.value = new TextureLoader().load(browser.runtime.getURL(shader_texture2));
        tuniform.iChannel2.value.wrapS = tuniform.iChannel2.value.wrapT = RepeatWrapping;

        const shader_texture3 = shaderObject.metaData?.iChannel3?? 'images/NyanCatSprite.png'
        tuniform.iChannel3.value = new TextureLoader().load(browser.runtime.getURL(shader_texture3));
        tuniform.iChannel3.value.wrapS = tuniform.iChannel3.value.wrapT = RepeatWrapping;

        const material = matRef.current as ShaderMaterial;
        const loadedFragmentShader = await fetchFragmentShader(shaderObject.shaderName);
        material.fragmentShader = loadedFragmentShader;
        material.needsUpdate = true;
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
            iMouse: { value: new Vector4(window.innerWidth / 2, window.innerHeight / 2), type: 'v4', },
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
    }, []);

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
            const tuniform = props?.tuniform!;
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
        console.log('Load Fragment Shader', threeProps, shaderObject);
        loadFragmentShader();
    }, [threeProps, shaderObject]);


    useEffect(() => {
        if (threeProps) {
            const tuniform = threeProps.tuniform!;
            tuniform.iResolution.value.set(window.innerWidth, window.innerHeight);
        }
    }, [window.innerWidth, window.innerHeight]);

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
        rate = Math.min(Math.max(rate, minRate), maxRate)

        const clockDelta = threeProps.clock.getDelta();
        const shaderFactor = shaderObject.metaData?.shaderSpeed ?? default_shader_factor;
        const tuniform = threeProps.tuniform;
        tuniform.iAmplifiedTime.value += (clockDelta * rate * shaderFactor);
        tuniform.iTime.value += clockDelta;
        tuniform.iDate.value = getCurrentDateVector();
        tuniform.iFrame.value += 1;

        // Notify to update the iAudioData texture as the fbcArray has been updated
        tuniform.iAudioData.value.needsUpdate = true;

        const video = videoElement as HTMLVideoElement;
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
