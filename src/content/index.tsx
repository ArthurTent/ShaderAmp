import React, {useEffect, useState, useRef} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas} from '@react-three/fiber'
import { getCurrentTab, getMediaStream } from "@src/helpers/tabActions";
import "../css/app.css";
import css from "./styles.module.css";
import { getTabMappings } from '@src/helpers/tabMappingService';
import { AnalyzerMesh } from './AnalyzerMesh';

const App: React.FC = () => {
    const [openerTab, setOpenerTab] = useState<browser.Tabs.Tab | undefined>();
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
    const analyserCanvasRef = useRef<HTMLCanvasElement>(null);
    const renderCanvasRef = useRef<HTMLCanvasElement>(null);

    const initializeAnalyzer = async () => {
        const currentTab = await getCurrentTab();
        if (!currentTab?.openerTabId) {
            console.error('Error: can not open content tab without source tab.');
            return;
        }
        const openerTab = await browser.tabs.get(currentTab.openerTabId);
        setOpenerTab(openerTab);

        const tabMapping: TabMapping = await getTabMappings();
        const tabData = tabMapping[currentTab.openerTabId];
        if (!tabData) {
            console.error('[ShaderAmp] No active tab source found.');
            return;
        }

        const stream = await getMediaStream(currentTab.openerTabId, tabData);
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
        initializeAnalyzer();
    }, [window.innerHeight, window.innerWidth]);

    return (
        <div id="canvas-container">
            <h1 className="m-2 text-2xl font-medium leading-tight text-primary fixed z-40">{openerTab?.title}</h1>
            <canvas id={css.analyserCanvas} ref={analyserCanvasRef} />
            <Canvas
                id={css.renderCanvas}
                className="z-50"
                style={{position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh"}}
                ref={renderCanvasRef}>
                <perspectiveCamera
                    fov={75}
                    aspect={window.innerWidth / window.innerHeight}
                    near={0.1}
                    far={1000}
                    position={[0, 0, 90]}
                />
                <AnalyzerMesh analyser={analyser} canvas={renderCanvasRef.current}/>
            </Canvas>
            <video id={css.bgVideo} src={browser.runtime.getURL("media/SpaceTravel1Min.mp4")} controls={false} muted
                   loop autoPlay style={{visibility: analyser ? 'hidden' : 'visible'}}></video>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App/>);
