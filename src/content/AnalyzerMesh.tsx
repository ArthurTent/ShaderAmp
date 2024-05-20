import React, { useEffect, useRef } from 'react';
import browser from "webextension-polyfill";
import { useFrame } from '@react-three/fiber';
import {
    Cache,
    DataTexture, IUniform,
    ShaderMaterial,
    Vector2,
    Vector3
} from "three";
import { DECR_TIME, INCR_TIME, RESET_TIME } from '@src/helpers/constants';
import { ShaderInstance } from './Components/ShaderPreloader';
import { useVideoTexture } from '@react-three/drei';
import { getCurrentDateVector } from '@src/helpers/utils';

Cache.enabled = true;
const maxRate = 15;
const minRate = 0;
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

export type Transform = {
    position: Vector3;
    size: Vector2;
}

type AnalyzerMeshProps = {
    id: number;
    visible: boolean;
    speedDivider: number;
    shader: ShaderInstance;
    globalUniforms: TUniform;
    transform: Transform;
}

export type TUniform = { [uniform: string]: IUniform };

export const AnalyzerMesh = ({ id, visible, speedDivider, shader, globalUniforms, transform }: AnalyzerMeshProps) => {
    const matRef = useRef<ShaderMaterial>(null);
    const [draw_analyzer, setDrawAnalyzer] = useState(true);
    const [threeProps, setThreeProps] = useState<MaterialProps>();
    const [loadedShaderName, setLoadedShaderName] = useState<string>("");
    const viewport = useThree(state => state.viewport)
    const [fragmentShader, setFragmentShader] = useState<string | undefined>(undefined);
    const videoTexture = shader.metaData.video ? useVideoTexture(shader.metaData.video!) : undefined;
    const uniforms = useRef(
        {
            iChannel0: {
                type: "t",
                value: shader.channels[0],
            },
            iChannel1: {
                type: "t",
                value: shader.channels[1],
            },
            iChannel2: {
                type: "t",
                value: shader.channels[2],
            },
            iChannel3: {
                type: "t",
                value: shader.channels[3],
            },
            iVideo: {
                type: "t",
                value: videoTexture
            },

            iFrame: { type: 'i', value: 0 },
            iAmplifiedTime: { type: 'f', value: 0.1 },
            iTime: { type: 'f', value: 0.1 },

            // Global data
            ...globalUniforms
        }
    );

    const resetTime = (tuniform: TUniform) => {
        tuniform.iAmplifiedTime.value = 0.1;
        tuniform.iTime.value = 0.1;
        tuniform.iFrame.value = 0;
    }

    const incrementTime = (tuniform: TUniform, increment: number) => {
        tuniform.iAmplifiedTime.value += increment;
        tuniform.iTime.value += increment;
    }

    useEffect(() => {
        const messageHandler = (msg: any, sender: any) => {
            if (!msg.command) {
                return;
            }
            const defaultIncrement = 0.5;
            const cmd = msg.command;
            const tuniform = matRef.current!.uniforms as TUniform;
            //const tuniform = matRef.current!.uniforms;
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
    }, []);


   useEffect(() => {
        if (!threeProps) {
            return;
        }
        const tuniform = threeProps.tuniform!;
        tuniform.iResolution.value.set(viewport.width, viewport.height);
    }, [threeProps, viewport.width, viewport.height]);

    useFrame((state, delta) => {
        const audioDataTex: DataTexture = globalUniforms.iAudioData.value;
        const fbcArray: Uint8Array = audioDataTex.source.data.data;

        // Calculate the shader specific rate
        const shaderFactor = shader.metaData?.shaderSpeed ?? default_shader_factor;
        const sum = fbcArray.reduce((a, b) => a + b, 0);
        const avg = (sum / fbcArray.length) || 0.1;
        let rate = min_speed + avg / (speedDivider == 0 ? 0.1 : speedDivider);
        rate = Math.min(Math.max(rate, minRate), maxRate)

        const tuniform = matRef.current!.uniforms;
        tuniform.iAmplifiedTime.value += (delta * rate * shaderFactor);
        tuniform.iTime.value += delta;
        tuniform.iDate.value = getCurrentDateVector();
        tuniform.iFrame.value += 1;

        // Update the video playback rate
        if (videoTexture) {
            const video = videoTexture.image as HTMLVideoElement;
            video.playbackRate = rate;
        }
    });

    return (<mesh position={transform.position} visible={visible}>
        <planeGeometry attach="geometry" args={[transform.size.x, transform.size.y, 1]} />
        <shaderMaterial
            attach="material"
            uniforms={uniforms.current}
            vertexShader={general_purpose_vertex_shader}
            fragmentShader={shader.shaderText}
            ref={matRef} />
    </mesh>);
};
