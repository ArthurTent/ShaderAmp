import React, {useEffect, useState, useRef, MutableRefObject} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas} from '@react-three/fiber'
import { OrthographicCamera, Stats } from "@react-three/drei"
import { WebcamSource, findOpenContentTab, findOpenContentTabId, getCurrentTab, getMediaStreamFromTab, getWebcamStream, getDisplayMediaStream } from "@src/helpers/tabActions";
import { isFirefox } from "@src/helpers/browserDetect";
import { getContentTabInfo } from '@src/helpers/tabMappingService';
import { AnalyzerMesh } from './AnalyzerMesh';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_SPEEDDIVIDER, SETTINGS_VOLUME_AMPLIFIER, SETTINGS_WEBCAM, SETTINGS_WEBCAM_AUDIO, STATE_CURRENT_SHADER, STATE_SHADERNAME, STATE_SHOWSHADERCREDITS, SETTINGS_SHOW_TAB_TITLE, SETTINGS_SHOW_FPS, SETTINGS_RANDOMIZE_BEAT, SETTINGS_RANDOMIZE_BEAT_INTERVAL, SETTINGS_SHADER_FADE, SETTINGS_RENDER_SCALE, SETTINGS_DISPLAY_CAPTURE, SETTINGS_MIDI_ENABLED, SETTINGS_JOYSTICK_ENABLED, SETTINGS_DEBUG_LOGGING, SETTINGS_EQ_GAINS, SETTINGS_EQ_APPLY_TO_OUTPUT } from '@src/storage/storageConstants';
import { initDebugCache, updateDebugCache, logger } from '@src/helpers/logger';
import "../css/app.css";
import css from "./styles.module.css";
import { defaultShader } from '@src/helpers/constants';
import type { ShaderObject } from "@src/helpers/types";

const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_DEFAULT_GAINS: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const App: React.FC = () => {
    // Consts
    const fallbackVideoUrl = browser.runtime.getURL("media/SpaceTravel1Min.mp4");

    // Local states
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
    const [needsUserGesture, setNeedsUserGesture] = useState<boolean>(isFirefox());
    const [firefoxNoAudio, setFirefoxNoAudio] = useState<boolean>(false);
    const refAudioSourceStream: MutableRefObject<MediaStream | null> = useRef(null);
    const refWebcamStream: MutableRefObject<MediaStream | null> = useRef(null);
    const refDisplayCaptureStream: MutableRefObject<MediaStream | null> = useRef(null);
    const refGainNode: MutableRefObject<GainNode | null> = useRef(null);
    const refEqFilters: MutableRefObject<BiquadFilterNode[]> = useRef([]);
    const refRawOutputNode: MutableRefObject<MediaStreamAudioSourceNode | null> = useRef(null);
    const analyserCanvasRef = useRef<HTMLCanvasElement>(null);
    const renderCanvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Synced states
    const [currentShader] = useChromeStorageLocal<ShaderObject>(STATE_CURRENT_SHADER, defaultShader);
    const [speedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
    const [useWebcam] = useChromeStorageLocal(SETTINGS_WEBCAM, false);
    const [useWebcamAudio] = useChromeStorageLocal(SETTINGS_WEBCAM_AUDIO, false);
    const [useDisplayCapture] = useChromeStorageLocal(SETTINGS_DISPLAY_CAPTURE, false);
    const [shaderCredits] = useChromeStorageLocal(STATE_SHOWSHADERCREDITS, false);
    const [volumeAmpifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);
    const [eqGains] = useChromeStorageLocal<number[]>(SETTINGS_EQ_GAINS, EQ_DEFAULT_GAINS);
    const [eqApplyToOutput] = useChromeStorageLocal(SETTINGS_EQ_APPLY_TO_OUTPUT, false);
    const [showTabTitle] = useChromeStorageLocal(SETTINGS_SHOW_TAB_TITLE, false);
    const [showFps] = useChromeStorageLocal(SETTINGS_SHOW_FPS, false);
    const [randomizeBeat] = useChromeStorageLocal(SETTINGS_RANDOMIZE_BEAT, false);
    const [randomizeBeatInterval] = useChromeStorageLocal(SETTINGS_RANDOMIZE_BEAT_INTERVAL, 4);
    const [shaderFade] = useChromeStorageLocal(SETTINGS_SHADER_FADE, false);
    const [renderScale] = useChromeStorageLocal(SETTINGS_RENDER_SCALE, 0.5);
    const [midiEnabled] = useChromeStorageLocal(SETTINGS_MIDI_ENABLED, false);
    const [joystickEnabled] = useChromeStorageLocal(SETTINGS_JOYSTICK_ENABLED, false);
    const [sourceTabTitle, setSourceTabTitle] = useState('');

    // Initialize debug cache and listen for changes
    useEffect(() => {
        initDebugCache();
        
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes[SETTINGS_DEBUG_LOGGING]) {
                updateDebugCache(changes[SETTINGS_DEBUG_LOGGING].newValue);
            }
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    // Initialize MIDI when enabled
    useEffect(() => {
        if (!midiEnabled) return;
        import('@src/helpers/midiService').then(svc => {
            svc.initMidi().then(ok => {
                if (!ok) logger.content.warn('ShaderAmp', 'MIDI init failed — check browser support and permissions');
            });
        });
    }, [midiEnabled]);

    // Initialize Joystick when enabled
    useEffect(() => {
        if (!joystickEnabled) return;
        import('@src/helpers/joystickService').then(svc => {
            const ok = svc.initJoystick();
            if (!ok) logger.content.warn('ShaderAmp', 'Joystick init failed — Gamepad API not supported in this browser');
        });
    }, [joystickEnabled]);

    const handleShaderChangeRequested = () => {
        logger.content.log('ShaderAmp', 'Beat-based shader change requested');
        browser.runtime.sendMessage({ command: 'RANDOM_SHADER_ON_BEAT' }).catch(error => logger.content.error('ShaderAmp', 'Error sending random shader message: %s', error));
    };

    const acquireStreamFromTab = async (): Promise<MediaStream | undefined> => {
        if (isFirefox()) {
            logger.content.log('ShaderAmp', 'Firefox detected: using getDisplayMedia for audio+video capture');
            return await getDisplayMediaStream();
        }
        const currentTab = await getCurrentTab();
        const currentTabId = currentTab?.id as number;
        const activeContentTab = await findOpenContentTab();
        if (!activeContentTab) {
            logger.content.error('ShaderAmp', 'No active tab source found at: %d', currentTabId);
            return;
        }
        return await getMediaStreamFromTab(activeContentTab.sourceTabId, activeContentTab);
    }

    const initializeAnalyzer = async () => {
        logger.content.log('ShaderAmp', 'Initializing media stream... existing analyser: %s, useWebcamAudio: %s', analyser ? 'exists' : 'none', useWebcamAudio);
        let audioStream: MediaStream | undefined;

        if (useDisplayCapture) {
            // Display capture: video track only — audio still comes from tab capture below
            const capturedStream = await getDisplayMediaStream();
            if (capturedStream) {
                refDisplayCaptureStream.current = capturedStream;
                const videoTrack = capturedStream.getVideoTracks()[0];
                if (videoTrack && videoRef.current) {
                    videoRef.current.src = '';
                    videoRef.current.srcObject = new MediaStream([videoTrack]);
                    videoRef.current.play().catch(console.error);
                }
            }
        }

        if (useWebcamAudio) {
            audioStream = await getWebcamStream(WebcamSource.Audio);
        }

        // If we're not using display capture or webcam audio, or they failed,
        //  try to get the media stream from the tab
        if (!audioStream) {
            const capturedStream = await acquireStreamFromTab();
            if (capturedStream && isFirefox()) {
                // On Firefox, feed the video track into the background video element
                const videoTrack = capturedStream.getVideoTracks()[0];
                if (videoTrack && videoRef.current) {
                    const videoOnlyStream = new MediaStream([videoTrack]);
                    videoRef.current.src = '';
                    videoRef.current.srcObject = videoOnlyStream;
                    videoRef.current.play().catch((e: any) => logger.content.error('ShaderAmp', 'Video play error: %s', e));
                }
                // Build an audio-only stream for the analyser
                const audioTracks = capturedStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    audioStream = new MediaStream(audioTracks);
                } else {
                    // Firefox getDisplayMedia never returns audio tracks (Bugzilla #1541425).
                    // Fall back to microphone / virtual loopback device.
                    logger.content.warn('ShaderAmp', 'Firefox: no audio from getDisplayMedia, falling back to getUserMedia mic');
                    try {
                        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    } catch (e) {
                        logger.content.error('ShaderAmp', 'Firefox mic fallback failed: %s', e);
                        setFirefoxNoAudio(true);
                    }
                }
            } else {
                audioStream = capturedStream;
            }
        }

        if (audioStream === undefined) {
            logger.content.error('ShaderAmp', 'Failed to reacquire stream from tab/webcam');
            return;
        }

        let audioContext: AudioContext;
        try {
            audioContext = new AudioContext();
        } catch (e) {
            logger.content.error('ShaderAmp', 'Failed to create AudioContext: %s', e);
            return;
        }
        const mediaStreamNode = audioContext.createMediaStreamSource(audioStream);
        refAudioSourceStream.current = mediaStreamNode.mediaStream;

        // Create a GainNode for amplification
        const gainNode = audioContext.createGain();
        mediaStreamNode.connect(gainNode);

        // Set the gain value to amplify or reduce the volume
        gainNode.gain.value = volumeAmpifier;

        // Cache the gain node so we can change it later on
        refGainNode.current = gainNode;

        // Build 10-band BiquadFilterNode EQ chain
        const currentEqGains = eqGains ?? EQ_DEFAULT_GAINS;
        const filters: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, i) => {
            const filter = audioContext.createBiquadFilter();
            if (i === 0) {
                filter.type = 'lowshelf';
            } else if (i === EQ_FREQUENCIES.length - 1) {
                filter.type = 'highshelf';
            } else {
                filter.type = 'peaking';
                filter.Q.value = 1.4;
            }
            filter.frequency.value = freq;
            filter.gain.value = currentEqGains[i] ?? 0;
            return filter;
        });
        // Chain: gainNode -> filter[0] -> ... -> filter[9]
        filters.reduce<AudioNode>((prev, curr) => { prev.connect(curr); return curr; }, gainNode);
        refEqFilters.current = filters;

        // prevent tab mute — raw branch; may be swapped out by eqApplyToOutput
        const output = audioContext.createMediaStreamSource(audioStream);
        refRawOutputNode.current = output;
        output.connect(audioContext.destination);

        // Todo: Clean up any previously created analyser instance
        // ...

        const newAnalyser = audioContext.createAnalyser();
        filters[filters.length - 1].connect(newAnalyser);

        setAnalyser(newAnalyser);
    };

    const setupWebcamStream = async () => {
        const stream = await getWebcamStream(WebcamSource.Video);
        if (!stream) {
            logger.content.warn('ShaderAmp', 'Failed to initialize webcam');
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

    const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const fallbackAnimationRef = useRef<number | null>(null);

    const setupFallbackVideo = async () => {
        try {
            const videoElement = videoRef.current as HTMLVideoElement;
            if (!videoElement) return;
            videoElement.src = fallbackVideoUrl;
            videoElement.onerror = (e) => {
                logger.content.error('ShaderAmp', 'Video error: %s', e);
                setupFallbackCanvas();
            };
            await videoElement.play();
        } catch (e) {
            logger.content.error('ShaderAmp', 'Failed to play fallback video: %s', e);
            setupFallbackCanvas();
        }
    }

    const setupFallbackCanvas = () => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        // Create canvas for fallback animation
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        fallbackCanvasRef.current = canvas;

        // Stream canvas to video element
        const stream = canvas.captureStream(30);
        videoElement.srcObject = stream;
        videoElement.play().catch((e: any) => logger.content.error('ShaderAmp', 'Canvas video play error: %s', e));

        // Animate the canvas
        const ctx = canvas.getContext('2d')!;
        let time = 0;

        const animate = () => {
            time += 0.02;

            // Create animated gradient background
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, `hsl(${(time * 20) % 360}, 50%, 20%)`);
            gradient.addColorStop(1, `hsl(${(time * 20 + 180) % 360}, 50%, 10%)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw some moving shapes
            for (let i = 0; i < 5; i++) {
                const x = canvas.width / 2 + Math.sin(time + i * 1.5) * 200;
                const y = canvas.height / 2 + Math.cos(time * 0.7 + i * 1.2) * 100;
                const size = 20 + Math.sin(time * 2 + i) * 10;

                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${(time * 30 + i * 60) % 360}, 70%, 60%, 0.6)`;
                ctx.fill();
            }

            fallbackAnimationRef.current = requestAnimationFrame(animate);
        };

        animate();
        logger.content.log('ShaderAmp', 'Using canvas fallback animation');
    }

    const disposeWebcamStream = () => {
        const videoElement = videoRef.current!;
        videoElement.srcObject = null;
        stopMediaStream(refWebcamStream.current);
    }

    const disposeDisplayCaptureStream = () => {
        stopMediaStream(refDisplayCaptureStream.current);
        refDisplayCaptureStream.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
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
                logger.content.error('ShaderAmp', 'Error getting source tab title: %s', error);
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
        const filters = refEqFilters.current;
        if (!filters.length) return;
        const gains = eqGains ?? EQ_DEFAULT_GAINS;
        filters.forEach((filter, i) => {
            filter.gain.value = gains[i] ?? 0;
        });
    }, [eqGains]);

    useEffect(() => {
        const filters = refEqFilters.current;
        const rawOutput = refRawOutputNode.current;
        if (!filters.length || !rawOutput) return;
        const lastFilter = filters[filters.length - 1];
        if (eqApplyToOutput) {
            try { rawOutput.disconnect(rawOutput.context.destination); } catch (_) {}
            try { lastFilter.connect(rawOutput.context.destination); } catch (_) {}
        } else {
            try { lastFilter.disconnect(rawOutput.context.destination); } catch (_) {}
            try { rawOutput.connect(rawOutput.context.destination); } catch (_) {}
        }
    }, [eqApplyToOutput]);

    const handleFirefoxStart = async () => {
        setNeedsUserGesture(false);
        if (useWebcam && !useDisplayCapture) {
            setupWebcamStream().catch((e) => {
                setupFallbackVideo();
                logger.content.error('ShaderAmp', 'Setup webcam stream error: %s', e);
            });
        }
        initializeAnalyzer().catch((e: any) => logger.content.error('ShaderAmp', 'Initialize analyzer error: %s', e));
    };

    useEffect(() => {
        if (isFirefox()) {
            // On Firefox, getDisplayMedia requires a user gesture — defer to the overlay button
            if (!useWebcam && !useDisplayCapture) {
                setupFallbackVideo().catch((e: any) => logger.content.error('ShaderAmp', 'Setup fallback video error: %s', e));
            }
            return;
        }

        if (useDisplayCapture) {
            // display capture handles its own video in initializeAnalyzer
        } else if (useWebcam) {
            setupWebcamStream().catch((e) => {
                setupFallbackVideo();
                logger.content.error('ShaderAmp', 'Setup webcam stream error: %s', e);
            });
        } else {
            setupFallbackVideo().catch((e: any) => logger.content.error('ShaderAmp', 'Setup fallback video error: %s', e));
        }

        initializeAnalyzer().catch((e: any) => logger.content.error('ShaderAmp', 'Initialize analyzer error: %s', e));

        return () => {
            disposeDisplayCaptureStream();
            disposeWebcamStream();
            disposeAudioStream();
            disposeAnalyzer();
            if (fallbackAnimationRef.current) {
                cancelAnimationFrame(fallbackAnimationRef.current);
            }
        }
    }, [useWebcam, useWebcamAudio, useDisplayCapture]);

    return (
        <div id="canvas-container">
            <Canvas
                id={css.renderCanvas}
                className="z-50"
                style={{position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh"}}
                dpr={window.devicePixelRatio * renderScale}
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
                renderScale={renderScale}
                onShaderChangeRequested={handleShaderChangeRequested}
            />
            </Canvas>
            <video ref={videoRef} id={css.bgVideo} controls={false} muted
                   loop style={{visibility: (analyser && !isFirefox()) ? 'hidden' : 'visible'}}></video>
            {firefoxNoAudio && (
                <div style={{
                    position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 300, background: 'rgba(180,60,40,0.92)', color: '#fff',
                    borderRadius: 8, padding: '10px 20px', fontSize: '0.8rem',
                    maxWidth: 480, textAlign: 'center', lineHeight: 1.5,
                }}>
                    ⚠ No audio captured. Firefox does not support tab audio via screen share.<br/>
                    Route your audio through a virtual loopback device (BlackHole / PulseAudio monitor) and allow microphone access.
                </div>
            )}
            {needsUserGesture && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.75)',
                    }}
                >
                    <div style={{ textAlign: 'center', maxWidth: 420 }}>
                        <button
                            onClick={handleFirefoxStart}
                            style={{
                                padding: '18px 40px', fontSize: '1.25rem', fontWeight: 700,
                                borderRadius: '12px', border: 'none', cursor: 'pointer',
                                background: '#6366f1', color: '#fff', letterSpacing: '0.05em',
                                boxShadow: '0 4px 24px rgba(99,102,241,0.5)',
                                marginBottom: 16,
                            }}
                        >
                            ▶ Start ShaderAmp
                        </button>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
                            Firefox: you will be asked to <strong style={{color:'#fff'}}>share a screen/window</strong> (video background)
                            and then grant <strong style={{color:'#fff'}}>microphone access</strong> (audio analysis).<br/>
                            For tab audio, select a virtual loopback device (e.g. BlackHole / PulseAudio monitor) as the microphone.
                        </p>
                    </div>
                </div>
            )}
            <div className="fixed w-screen h-screen z-[100] bg-white-200">
                {shaderCredits && (
                    <div className="fixed bottom-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded z-50 max-w-xs">
                        <h1 className="text-2xl font-medium leading-tight">
                            {currentShader.metaData.shaderName} by {currentShader.metaData.author}
                        </h1>
                    </div>
                )}
                {showTabTitle && sourceTabTitle && (
                    <div className="fixed bottom-4 right-4 bg-black bg-opacity-70 text-white p-2 rounded z-50 max-w-xs">
                        <h1 className="text-2xl font-medium leading-tight truncate">
                            {sourceTabTitle}
                        </h1>
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
