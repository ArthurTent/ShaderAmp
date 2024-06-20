import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useShaders } from './ShaderPreloader';
import { SETTINGS_SPEEDDIVIDER, SETTINGS_VOLUME_AMPLIFIER, STATE_CURRENT_SHADER, STATE_SHADERINDEX } from '@src/storage/storageConstants';
import { useFrame, useThree } from '@react-three/fiber';
import { DataTexture, Vector2, Vector3 } from 'three';
import { AnalyzerMesh, Transform } from '../AnalyzerMesh';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { defaultShader } from '@src/helpers/constants';
import { useAnalyzer } from '@src/hooks/useAnalyzer';
import { useUniforms } from '@src/hooks/useUniforms';
import LoaderHandler from './LoaderHandler';
import { getCurrentDateVector } from '@src/helpers/utils';


type Props = {
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

export default function AnalyzerRoot({ canvasRef }: Props) {

    // Load the required state, asynchronously
    const shaders = useShaders();
    const { analyserNode, gainNode } = useAnalyzer(false, false);

    // Local state
    const viewport = useThree(state => state.viewport)
    const uniforms = useUniforms(viewport);
    
    // Synced states
    //const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) }); 
    const [currentShader] = useChromeStorageLocal<ShaderObject>(STATE_CURRENT_SHADER, defaultShader);
    const [shaderIndex] = useChromeStorageLocal<number>(STATE_SHADERINDEX, 0);
    const [speedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
	const [volumeAmpifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);
 
    // Update the resolution when the viewport changes
    useEffect(() => {
        uniforms.iResolution.value.set(viewport.width, viewport.height);
    }, [viewport.width, viewport.height]);

    // Update the volume amplifier
    useEffect(() => {
        gainNode.gain.value = volumeAmpifier;
    }, [volumeAmpifier])
    
    // Update the audio data array
    useFrame((state, delta) => {
        // Update the frequencyBinCount array
        const audioDataTex: DataTexture = uniforms.iAudioData.value;
        const fbcArray: Uint8Array = audioDataTex.source.data.data;
        if (analyserNode) {
            analyserNode.getByteFrequencyData(fbcArray);

            // Notify to update the iAudioData texture as the fbcArray has been updated
            uniforms.iAudioData.value.needsUpdate = true;
        }
    });

    const columns = 20;
    const [visualisationSize, setVisualisationSize] = useState(0.0); 

    const getVisualisationTransform = (index: number) : Transform => {
        const halfSize = visualisationSize / 2.0;
        const left = -viewport.width / 2.0;
        const top = viewport.height / 2.0;
        const upperLeft = new Vector3(left + halfSize, top - halfSize); 
        const col = index % columns;
        const row = Math.floor(index/columns);
        const offset = new Vector3 (col * visualisationSize, -row * visualisationSize);
        const position = upperLeft.clone().add(offset);
        const size = new Vector2(visualisationSize, visualisationSize);
        return {position, size};
    }

    useEffect(() => {
        const visSize = viewport.width / columns;
        setVisualisationSize(visSize);
    }, [viewport.width, viewport.height]);

    const filterShaders = () => {
        const shaderBlacklist = ['Fork: Dancing Glow Lights'];
        return shaders.filter(shaderInstance => !shaderBlacklist.includes(shaderInstance.metaData.shaderName));
    }

    const filteredShaders = useMemo(() => filterShaders(), shaders);

    console.log('shaders: ' + shaders.length);
    
    return (
        <>
            <Suspense fallback={<LoaderHandler/>}>
                {filteredShaders.slice(100, 150).map((shader, index) => (<AnalyzerMesh key={index} analyser={analyserNode} speedDivider={speedDivider} 
                        shader={shader} globalUniforms={uniforms} transform={getVisualisationTransform(index)} />))}
            </Suspense>
        </>
    )
}
