import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useShaders } from './ShaderPreloader';
import { SETTINGS_SPEEDDIVIDER, SETTINGS_VOLUME_AMPLIFIER, SETTINGS_WEBCAM, SETTINGS_WEBCAM_AUDIO, STATE_CURRENT_SHADER, STATE_SHADERINDEX } from '@src/storage/storageConstants';
import { useFrame, useThree } from '@react-three/fiber';
import { DataTexture, Vector2, Vector3 } from 'three';
import { AnalyzerMesh, Transform } from '../AnalyzerMesh';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { defaultShader } from '@src/helpers/constants';
import { useAnalyzer } from '@src/hooks/useAnalyzer';
import { useUniforms } from '@src/hooks/useUniforms';
import LoaderHandler, { VisualizationsLoaderKey } from './LoaderHandler';
import { useLoading } from '../Context/LoaderContext';

export default function AnalyzerRoot() {
    const [useWebcam] = useChromeStorageLocal(SETTINGS_WEBCAM, false);
    const [useWebcamAudio] = useChromeStorageLocal(SETTINGS_WEBCAM_AUDIO, false);
    
    // Load the required state, asynchronously
    const shaders = useShaders();
    const { analyserNode, gainNode, videoStream } = useAnalyzer(useWebcam, useWebcamAudio);

    // Local state
    const viewport = useThree(state => state.viewport)
    const uniforms = useUniforms(viewport);
    
    // Synced states
    //const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) }); 
    const [currentShader] = useChromeStorageLocal<ShaderObject>(STATE_CURRENT_SHADER, defaultShader);
    const [shaderIndex] = useChromeStorageLocal<number>(STATE_SHADERINDEX, 0);
    const [speedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
	const [volumeAmpifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);
 
    const updateVisualizationSize = (isLoading: boolean) => {
        let visWidth = viewport.width;
        let visHeight = viewport.height;
        if (isLoading) {
            visWidth /= columns;
            visHeight /= columns;
        }
        setVisualisationWidth(visWidth);
        setVisualisationHeight(visHeight);
        uniforms.iResolution.value.set(visWidth, visHeight);
    }

    // Update the resolution when the viewport changes
    useEffect(() => {
        updateVisualizationSize(!isPreloadFinished);
    }, [viewport.width, viewport.height]);

    // Update the volume amplifier
    useEffect(() => {
        gainNode.gain.value = volumeAmpifier;
    }, [volumeAmpifier])
    
    // Update the audio data array
    useFrame(() => {
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
    const [visualisationWidth, setVisualisationWidth] = useState(0.0); 
    const [visualisationHeight, setVisualisationHeight] = useState(0.0);

    const getVisualisationTransform = (index: number) : Transform => {
        if (isPreloadFinished) {
            return {
                position: new Vector3(0, 0), 
                size: new Vector2(visualisationWidth, visualisationHeight)
            };
        }
        const halfSize = visualisationWidth / 2.0;
        const left = -viewport.width / 2.0;
        const top = viewport.height / 2.0;
        const upperLeft = new Vector3(left + halfSize, top - halfSize); 
        const col = index % columns;
        const row = Math.floor(index/columns);
        const offset = new Vector3 (col * visualisationWidth, -row * visualisationWidth);
        const position = upperLeft.clone().add(offset);
        const size = new Vector2(visualisationWidth, visualisationWidth);
        return {position, size};
    }

    const filterShaders = () => {
        const shaderBlacklist = ['Fork: Dancing Glow Lights', 'Font demo', 'Möbius Music Visualization'];
        return shaders.filter(shaderInstance => !shaderBlacklist.includes(shaderInstance.metaData.shaderName));
    }

    const [isPreloadFinished, setIsPreloadFinished] = useState<boolean>(false);
    const [preloadIndex, setPreloadIndex] = useState<number>(-1);
	const { presetLoadCount, releaseLoading } = useLoading();

    useEffect(() => {
        if (preloadIndex >= 0) {
            releaseLoading(VisualizationsLoaderKey);
        }
        const nextPreloadIndex = preloadIndex + 1;
        if (nextPreloadIndex < shaders.length) {
            setPreloadIndex(preloadIndex + 1)
        } else {
            setIsPreloadFinished(true);
            updateVisualizationSize(false);
        }
    }, [preloadIndex]);

    useEffect(() => {
        presetLoadCount(VisualizationsLoaderKey, shaders.length);
    }, []);

    const isShaderVisible = (index: number) => {
        if (!isPreloadFinished) {
            return preloadIndex == index;
        }
        return index == shaderIndex;
    }
	
    const filteredShaders = useMemo(() => filterShaders(), shaders);
    return (
        <>
            <Suspense fallback={<LoaderHandler loaderKey={VisualizationsLoaderKey}/>}>
                {filteredShaders.map((shader, index) => 
                    (<AnalyzerMesh key={index} id={index} visible={isShaderVisible(index)} speedDivider={speedDivider} 
                        shader={shader} globalUniforms={uniforms} transform={getVisualisationTransform(index)} 
                        videoStreamRef={videoStream} />))
                }
            </Suspense>
        </>
    )
}
