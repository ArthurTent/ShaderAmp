import React, {useEffect, useState, useRef, MutableRefObject} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas} from '@react-three/fiber'
import { OrthographicCamera } from "@react-three/drei"
import { getCurrentTab, getMediaStream, getWebcamStream } from "@src/helpers/tabActions";
import { getContentTabInfo } from '@src/helpers/tabMappingService';
import { AnalyzerMesh } from './AnalyzerMesh';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_SPEEDDIVIDER, SETTINGS_WEBCAM, STATE_CURRENT_SHADER, STATE_SHADERNAME } from '@src/storage/storageConstants';
import "../css/app.css";
import css from "./styles.module.css";

const App: React.FC = () => {
    // Consts
    const fallbackVideoUrl = browser.runtime.getURL("media/SpaceTravel1Min.mp4");

    // Local states
    const [showShaderName, _] = useState<boolean>(true);
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
    const refAudioSourceStream: MutableRefObject<MediaStream | null> = useRef(null);
    const refWebcamStream: MutableRefObject<MediaStream | null> = useRef(null);
    const analyserCanvasRef = useRef<HTMLCanvasElement>(null);
    const renderCanvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Synced states
    const [currentShader] = useChromeStorageLocal<ShaderObject>(STATE_CURRENT_SHADER, { shaderName: '' });
    const [speedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
    const [useWebcam] = useChromeStorageLocal(SETTINGS_WEBCAM, false);

    const initializeAnalyzer = async () => {
        console.log(`[ShaderAmp] initializing media stream... existing analyser: `, analyser)
        const currentTab = await getCurrentTab();
        const currentTabId = currentTab?.id as number;
        const tabData = await getContentTabInfo(currentTabId);
        if (!tabData) {
            console.error('[ShaderAmp] No active tab source found.');
            return;
        }

        const stream = await getMediaStream(tabData.sourceTabId, tabData);
        if (stream === undefined) {
            console.error('[ShaderAmp] Failed to reaquire stream from tab.');
            return;
        }

        const audioContext = new AudioContext();
        const mediaStreamNode = audioContext.createMediaStreamSource(stream);
        refAudioSourceStream.current = mediaStreamNode.mediaStream;

        // prevent tab mute
        const output = audioContext.createMediaStreamSource(stream);
        output.connect(audioContext.destination);

        // Todo: Clean up any previously created analyser instance
        // ...

        const newAnalyser = audioContext.createAnalyser();
        mediaStreamNode.connect(newAnalyser);
        setAnalyser(newAnalyser);
    };

    const setupWebcamStream = async () => {
        const stream = await getWebcamStream();
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

    useEffect(() => {
        if (useWebcam) {
            setupWebcamStream().catch((e) => {
                setupFallbackVideo();
                console.error(e);
            });
        } else {
            setupFallbackVideo();
        }
        return () => {
            disposeWebcamStream();
        }
    }, [useWebcam]);

    useEffect(() => {
        initializeAnalyzer().catch(console.error);
        return () => {
            stopMediaStream(refAudioSourceStream.current);
        }
    }, []);

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
                {showShaderName && <h1 className="m-2 text-2xl font-medium leading-tight text-white fixed z-40">{currentShader.shaderName}</h1>}
            </div>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App />);
