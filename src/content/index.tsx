import React, {useEffect, useState, useRef, MutableRefObject} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas} from '@react-three/fiber'
import { OrthographicCamera } from "@react-three/drei"
import { WebcamSource, findOpenContentTab, findOpenContentTabId, getCurrentTab, getMediaStreamFromTab, getWebcamStream } from "@src/helpers/tabActions";
import { getContentTabInfo } from '@src/helpers/tabMappingService';
import { AnalyzerMesh } from './AnalyzerMesh';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_SPEEDDIVIDER, SETTINGS_VOLUME_AMPLIFIER, SETTINGS_WEBCAM, SETTINGS_WEBCAM_AUDIO, STATE_CURRENT_SHADER, STATE_SHADERNAME, STATE_SHOWSHADERCREDITS } from '@src/storage/storageConstants';
import "../css/app.css";
import css from "./styles.module.css";
import { defaultShader } from '@src/helpers/constants';

const App: React.FC = () => {
    // Consts
    const fallbackVideoUrl = browser.runtime.getURL("media/SpaceTravel1Min.mp4");

    // Local states
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
    const refAudioSourceStream: MutableRefObject<MediaStream | null> = useRef(null);
    const refWebcamStream: MutableRefObject<MediaStream | null> = useRef(null);
    const refGainNode: MutableRefObject<GainNode | null> = useRef(null);
    const analyserCanvasRef = useRef<HTMLCanvasElement>(null);
    const renderCanvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Synced states
    const [currentShader] = useChromeStorageLocal<ShaderObject>(STATE_CURRENT_SHADER, defaultShader);
    const [speedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
    const [useWebcam] = useChromeStorageLocal(SETTINGS_WEBCAM, false);
    const [useWebcamAudio] = useChromeStorageLocal(SETTINGS_WEBCAM_AUDIO, false);
    const [shaderCredits] = useChromeStorageLocal(STATE_SHOWSHADERCREDITS, false);
    const [volumeAmpifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);

    const acquireStreamFromTab = async () => {
        const currentTab = await getCurrentTab();
        const currentTabId = currentTab?.id as number;
        const activeContentTab = await findOpenContentTab();
        if (!activeContentTab) {
            console.error(`[ShaderAmp] No active tab source found at: ${currentTabId}`);
            return;
        }
        return await getMediaStreamFromTab(activeContentTab.sourceTabId, activeContentTab);
    }

    const initializeAnalyzer = async () => {
        console.log(`[ShaderAmp] initializing media stream... existing analyser: `, analyser, useWebcamAudio)
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
            return;
        }

        const audioContext = new AudioContext();
        const mediaStreamNode = audioContext.createMediaStreamSource(audioStream);
        refAudioSourceStream.current = mediaStreamNode.mediaStream;

        // Create a GainNode for amplification
        const gainNode = audioContext.createGain();
        mediaStreamNode.connect(gainNode);

        // Set the gain value to amplify or reduce the volume
        gainNode.gain.value = volumeAmpifier;

        // Cache the gain node so we can change it later on
        refGainNode.current = gainNode;

        // prevent tab mute
        const output = audioContext.createMediaStreamSource(audioStream);
        output.connect(audioContext.destination);

        // Todo: Clean up any previously created analyser instance
        // ...

        const newAnalyser = audioContext.createAnalyser();
        gainNode.connect(newAnalyser);

        setAnalyser(newAnalyser);
    };

    const setupWebcamStream = async () => {
        const stream = await getWebcamStream(WebcamSource.Video);
        if (!stream) {
            console.log(`[ShaderAmp] Failed to initialize webcam.`);
            return;
        }
        refWebcamStream.current = stream;
        const videoElement = videoRef.current as HTMLVideoElement;
        videoElement.srcObject = stream;
        videoElement.play();
    }

    const stopMediaStream = (mediaStream: MediaStream | null) => {
        if (mediaStream === null) {
            return;
        }
        mediaStream.getTracks().forEach(function(track) {
            track.stop();
        });
    }

    const setupFallbackVideo = () => {
        const videoElement = videoRef.current as HTMLVideoElement;
        videoElement.src = fallbackVideoUrl;
        videoElement.play();
    }

    const disposeWebcamStream = () => {
        const videoElement = videoRef.current!;
        videoElement.srcObject = null;
        stopMediaStream(refWebcamStream.current);
    }

    const disposeAudioStream = () => {
        stopMediaStream(refAudioSourceStream.current);
    }

    const disposeAnalyzer = () => {
        if (!analyser) {
            return;
        }
        analyser.disconnect();
    }

    useEffect(() => {
        if (refGainNode.current) {
            refGainNode.current.gain.value = volumeAmpifier;
        }
    }, [volumeAmpifier]);

    useEffect(() => {
        if (useWebcam) {
            setupWebcamStream().catch((e) => {
                setupFallbackVideo();
                console.error(e);
            });
        } else {
            setupFallbackVideo();
        }

        initializeAnalyzer().catch(console.error);

        return () => {
            disposeWebcamStream();
            disposeAudioStream();
            disposeAnalyzer();
        }
    }, [useWebcam, useWebcamAudio]);

    return (
        <div id="canvas-container">
            <canvas id={css.analyserCanvas} ref={analyserCanvasRef} />
            <Canvas
                id={css.renderCanvas}
                className="z-50"
                style={{position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh"}}
                ref={renderCanvasRef}>
                <OrthographicCamera makeDefault zoom={1}
                    near={0.1}
                    far={1000}
                    position={[0, 0, 1]}
                />
                <AnalyzerMesh analyser={analyser} canvas={renderCanvasRef.current} shaderObject={currentShader} speedDivider={speedDivider}/>
            </Canvas>
            <video ref={videoRef} id={css.bgVideo} controls={false} muted
                   loop style={{visibility: analyser ? 'hidden' : 'visible'}}></video>
            <div className="fixed flex w-screen h-screen z-[100] bg-white-200">
                {shaderCredits && <h1 className="m-2 text-2xl font-medium leading-tight text-white fixed z-40">{currentShader.metaData.shaderName} by {currentShader.metaData.author}</h1>}
            </div>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App />);
