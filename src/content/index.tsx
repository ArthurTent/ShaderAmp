import React, {useEffect, useState, useRef} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas} from '@react-three/fiber'
import { OrthographicCamera } from "@react-three/drei"
import { getCurrentTab, getMediaStream } from "@src/helpers/tabActions";
import { getContentTabInfo } from '@src/helpers/tabMappingService';
import { AnalyzerMesh } from './AnalyzerMesh';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_SPEEDDIVIDER, STATE_CURRENT_SHADER, STATE_SHADERNAME } from '@src/storage/storageConstants';
import "../css/app.css";
import css from "./styles.module.css";

const App: React.FC = () => {
    // Local states
    const [showShaderName, _] = useState<boolean>(true);
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
    const analyserCanvasRef = useRef<HTMLCanvasElement>(null);
    const renderCanvasRef = useRef<HTMLCanvasElement>(null);
    //const orthoCamRef = useRef<OrthographicCamera>();

    // Synced states
    const [currentShader] = useChromeStorageLocal<ShaderObject>(STATE_CURRENT_SHADER, { shaderName: '' });
    const [speedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);

    const initializeAnalyzer = async () => {
        const currentTab = await getCurrentTab();
        const currentTabId = currentTab?.id as number;
        const tabData = await getContentTabInfo(currentTab?.id!);
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
        const mediaStream = audioContext.createMediaStreamSource(stream);

        // prevent tab mute
        const output = audioContext.createMediaStreamSource(stream);
        output.connect(audioContext.destination);

        // Todo: Clean up any previously created analyser instance
        // ...

        const analyser = audioContext.createAnalyser();
        mediaStream.connect(analyser);
        setAnalyser(analyser);
    };
    useEffect(() => {
        initializeAnalyzer().catch(console.error);
    }, [window.innerHeight, window.innerWidth]);

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
                <AnalyzerMesh analyser={analyser} canvas={renderCanvasRef.current} shaderName={currentShader.shaderName} speedDivider={speedDivider}/>
            </Canvas>
            <video id={css.bgVideo} src={browser.runtime.getURL("media/SpaceTravel1Min.mp4")} controls={false} muted
                   loop autoPlay style={{visibility: analyser ? 'hidden' : 'visible'}}></video>
            <div className="fixed flex w-screen h-screen z-[100] bg-white-200">
                {showShaderName && <h1 className="m-2 text-2xl font-medium leading-tight text-white fixed z-40">{currentShader.shaderName}</h1>}
            </div>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App />);
