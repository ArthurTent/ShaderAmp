import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { useFrame } from '@react-three/fiber';
import { fetchFragmentShader } from '@src/helpers/shaderActions';
import { getWebcamStream, WebcamSource, acquireStreamFromTab } from '@src/helpers/tabActions';
import { SETTINGS_VOLUME_AMPLIFIER } from '@src/storage/storageConstants';
import { useState, MutableRefObject, useRef, useEffect } from 'react';
import { suspend } from 'suspend-react'

type AnalyserObject = {
    analyserNode: AnalyserNode;
    gainNode: GainNode;
}

export function useAnalyzer(useWebcam : boolean, useWebcamAudio : boolean) : AnalyserObject {
    // Local states
    //const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
	const analyserRef = useRef<AnalyserNode>();
    const refWebcamStream = useRef<MediaStream | null>(null);
    const refGainNode = useRef<GainNode | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
	
    const createEmptyObject = () => {
        const emptyContext = new BaseAudioContext();
        const analyserNode = new AnalyserNode(emptyContext);
        const gainNode = new GainNode(emptyContext);
        return { analyserNode, gainNode };
    }

    const initializeAnalyzer = async () : Promise<AnalyserObject> => {
        console.log(`[ShaderAmp] initializing media stream... existing analyser: `, analyserRef.current, useWebcamAudio)
        let audioStream: MediaStream | undefined;
        if (useWebcamAudio) {
            audioStream = await getWebcamStream(WebcamSource.Audio);
        }
        // If we're not using a web cam or the webcam failed, 
        //  try to get the media stream from the tab
        if (!audioStream) {
            audioStream = await acquireStreamFromTab();
        }

        if (audioStream === undefined) {
            console.error('[ShaderAmp] Failed to reaquire stream from tab/webcam.');
            const emptyObject = createEmptyObject();
            return emptyObject;
        }

        const audioContext = new AudioContext();
        const mediaStreamNode = audioContext.createMediaStreamSource(audioStream);

        // Create a GainNode for amplification
        const gainNode = audioContext.createGain();
        mediaStreamNode.connect(gainNode);

        // Set the gain value to amplify or reduce the volume
        gainNode.gain.value = 1.0;

        // prevent tab mute
        const output = audioContext.createMediaStreamSource(audioStream);
        output.connect(audioContext.destination);

        // Todo: Clean up any previously created analyser instance
        // ...

        const newAnalyser = audioContext.createAnalyser();
        gainNode.connect(newAnalyser);

        const analyserObject: AnalyserObject = {
            analyserNode: newAnalyser,
            gainNode: gainNode
        }
        return analyserObject;
    };

	return suspend(async () => {
		console.time('useAnalyzer')
		const analyserObject = await initializeAnalyzer();
        console.timeEnd('useAnalyzer');
		return analyserObject;
	}, [useWebcam, useWebcamAudio]);
}
