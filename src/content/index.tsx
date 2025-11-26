import React, {useEffect, useState, useRef, MutableRefObject} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas} from '@react-three/fiber'
import { OrthographicCamera, Stats } from "@react-three/drei"
import { WebcamSource, findOpenContentTab, findOpenContentTabId, getCurrentTab, getMediaStreamFromTab, getWebcamStream } from "@src/helpers/tabActions";
import { getContentTabInfo } from '@src/helpers/tabMappingService';
import { AnalyzerMesh } from './AnalyzerMesh';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_SPEEDDIVIDER, SETTINGS_VOLUME_AMPLIFIER, SETTINGS_WEBCAM, SETTINGS_WEBCAM_AUDIO, STATE_CURRENT_SHADER, STATE_SHADERNAME, STATE_SHOWSHADERCREDITS, SETTINGS_SHOW_TAB_TITLE, SETTINGS_SHOW_FPS, SETTINGS_RANDOMIZE_BEAT, SETTINGS_RANDOMIZE_BEAT_INTERVAL, SETTINGS_SHADER_FADE } from '@src/storage/storageConstants';
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
    const [showTabTitle] = useChromeStorageLocal(SETTINGS_SHOW_TAB_TITLE, false);
    const [showFps] = useChromeStorageLocal(SETTINGS_SHOW_FPS, false);
    const [randomizeBeat] = useChromeStorageLocal(SETTINGS_RANDOMIZE_BEAT, false);
    const [randomizeBeatInterval] = useChromeStorageLocal(SETTINGS_RANDOMIZE_BEAT_INTERVAL, 4);
    const [shaderFade] = useChromeStorageLocal(SETTINGS_SHADER_FADE, false);
    const [sourceTabTitle, setSourceTabTitle] = useState('');

    const handleShaderChangeRequested = () => {
        console.log('[ShaderAmp] Beat-based shader change requested');
        browser.runtime.sendMessage({ command: 'RANDOM_SHADER_ON_BEAT' }).catch(error => console.error(error));
    };

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

    // Get the source tab's title
    useEffect(() => {
        const getSourceTabTitle = async () => {
            try {
                const activeContentTab = await findOpenContentTab();
                if (activeContentTab) {
                    const tabInfo = await browser.tabs.get(activeContentTab.sourceTabId);
                    const sanitizedTitle = (tabInfo.title || '').replace(/•/g, '-');
                    setSourceTabTitle(sanitizedTitle);
                }
            } catch (error) {
                console.error('Error getting source tab title:', error);
            }
        };

        getSourceTabTitle();
        
        // Set up a listener for tab updates
        const handleTabUpdate = (tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType) => {
            if (changeInfo.title) {
                getSourceTabTitle();
            }
        };

        browser.tabs.onUpdated.addListener(handleTabUpdate);
        return () => {
            browser.tabs.onUpdated.removeListener(handleTabUpdate);
        };
    }, []);

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
                <AnalyzerMesh 
                analyser={analyser} 
                canvas={renderCanvasRef.current} 
                videoElement={videoRef.current} 
                shaderObject={currentShader} 
                speedDivider={speedDivider}
                randomizeBeat={randomizeBeat}
                randomizeBeatInterval={randomizeBeatInterval}
                shaderFade={shaderFade}
                onShaderChangeRequested={handleShaderChangeRequested}
            />
            </Canvas>
            <video ref={videoRef} id={css.bgVideo} controls={false} muted
                   loop style={{visibility: analyser ? 'hidden' : 'visible'}}></video>
            <div className="fixed w-screen h-screen z-[100] bg-white-200">
                {shaderCredits && (
                    <div className="fixed bottom-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded z-50 max-w-xs">
                        <h1 className="text-2xl font-medium leading-tight">
                            {currentShader.metaData.shaderName} by {currentShader.metaData.author}
                        </h1>
                    </div>
                )}
                {showTabTitle && sourceTabTitle && (
                    <div className="fixed bottom-4 right-4 bg-black bg-opacity-70 text-white p-2 rounded z-50 max-w-xs truncate">
                        {sourceTabTitle}
                    </div>
                )}
                {showFps && (
                    <div className="fixed top-0 left-0 p-4 z-50">
                        <Stats className="stats" />
                    </div>
                )}
            </div>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App />);
