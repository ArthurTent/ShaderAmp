import React, {useEffect, useState, useRef, useCallback} from 'react';
import { createRoot } from 'react-dom/client';
import browser from "webextension-polyfill";
import {Canvas} from '@react-three/fiber'
import { OrthographicCamera } from "@react-three/drei"
import { getCurrentTab, getMediaStream } from "@src/helpers/tabActions";
import {START, SPACE} from "@src/helpers/constants";
import "../css/app.css";
import css from "./styles.module.css";
import { getContentTabInfo, getTabMappings } from '@src/helpers/tabMappingService';
import { AnalyzerMesh } from './AnalyzerMesh';
import { KeyboardEvent } from 'react';
import { loadShaderList } from '@src/helpers/shaderActions';

const App: React.FC = () => {
    const [showShaderName, _] = useState<boolean>(true);
    const [openerTab, setOpenerTab] = useState<browser.Tabs.Tab | undefined>();
    const [analyser, setAnalyser] = useState<AnalyserNode | undefined>();
    const [shaderName, setShaderName] = useState<string>('MusicalHeart.frag');
    const [shaderList, setShaderList] = useState<string[]>([]);
    const [shaderIndex, setShaderIndex] = useState<number>(0);
    const analyserCanvasRef = useRef<HTMLCanvasElement>(null);
    const renderCanvasRef = useRef<HTMLCanvasElement>(null);
    //const orthoCamRef = useRef<OrthographicCamera>();
    
    const cycleShaders = () => {
        if (shaderList.length == 0) {
            return;
        }
        const newShaderName = shaderList[shaderIndex];
        setShaderName(newShaderName);
        const newShaderIndex = (shaderIndex + 1) % shaderList.length;
        setShaderIndex(newShaderIndex);
    }


    const fetchShaderList = async () => {
        const shaders = await loadShaderList();
        setShaderList(shaders);
    }

    // Initial shader list retrieval
    useEffect(() => {
        fetchShaderList().catch(console.error);
    }, []);

    const handleKeyUp = (e:any) => {
        const evt = e as KeyboardEvent;
        if (e.code != 'Space') {
            return;
        }
        cycleShaders();
    };

    // Shader cycle input logic
    // Work-around/hack to get the update state in the listener
    useEffect(() => {
        browser.runtime.onMessage.addListener(async (msg, sender) => {
            if (msg.command && (msg.command === SPACE)) {
                cycleShaders();
            }
        });
        document.removeEventListener('keyup', handleKeyUp);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [shaderList, shaderName, shaderIndex]);

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
            <h1 className="m-2 text-2xl font-medium leading-tight text-primary fixed z-40">{openerTab?.title}</h1>

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
                <AnalyzerMesh analyser={analyser} canvas={renderCanvasRef.current} shaderName={shaderName}/>
            </Canvas>
            <video id={css.bgVideo} src={browser.runtime.getURL("media/SpaceTravel1Min.mp4")} controls={false} muted
                   loop autoPlay style={{visibility: analyser ? 'hidden' : 'visible'}}></video>
            <div className="fixed flex w-screen h-screen z-[100] bg-white-200">
                {showShaderName && <h1 className="m-2 text-2xl font-medium leading-tight text-white fixed z-40">{shaderName}</h1>}
            </div>;
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(<App/>);
