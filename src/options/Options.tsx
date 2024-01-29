import browser, { Tabs } from "webextension-polyfill";
import { acquireVideoStream } from '@src/helpers/optionsActions';
import React, { useEffect, useRef, useState } from 'react';
import { getAppState, getTabMappings } from "@src/helpers/tabMappingService";
import { SPACE } from "@src/helpers/constants";
import { doesTabExist, getCurrentTab, tabStreamCapture } from "@src/helpers/tabActions";
import { focusTab, focusWindow } from "@src/backgroundPage";
import '../css/app.css';
import "./styles.module.css";


const Options: React.FC = () => {
    const [showVideoPreview, setShowVideoPreview] = useState<boolean>(false);
    const videoElement = useRef<HTMLVideoElement>(null);
    const [videoStream, setVideoStream] = useState<MediaStream|undefined>();

    const [shaderName, setShaderName] = useState<string>('MusicalHeart.frag');
    const [shaderList, setShaderList] = useState<string[]>([]);
    const [shaderIndex, setShaderIndex] = useState<number>(0);

    const handleShowPreviewInput = (event:any) => {
        event.preventDefault();
        setShowVideoPreview(!showVideoPreview);
    }

    const setupVideoStream = async () => {
        const stream = await acquireVideoStream(videoElement.current as HTMLVideoElement);
        setVideoStream(stream);
    }

    const shutDownVideoStream = async () => {
        if (!videoStream) {
            return;
        }
        const videoTrack = videoStream.getTracks()[0];
        videoTrack?.stop();
    }

    useEffect(() => {
        if (showVideoPreview) {
            setupVideoStream();
        } else {
            shutDownVideoStream();
        }
    }, [showVideoPreview]);

    const sendTestMessage = async() => {
        const currentTab = await getCurrentTab();
        browser.runtime.sendMessage({ command: SPACE, openerTabId: currentTab?.id });
    }

    return (
        <div className="flex items-center flex-col p-5 w-screen	h-screen bg-white dark:bg-gray-900 antialiased">
            <h2 className="text-4xl font-extrabold dark:text-white">ShaderAmp Options Page</h2>
            <label className="my-4 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" onInput={handleShowPreviewInput} value={showVideoPreview ? 1 : 0} className="sr-only peer"/>
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Show Preview (experimental)</span>
            </label>
            {showVideoPreview && <><p className="my-4 text-lg text-gray-500">Preview</p><video ref={videoElement} className="max-w-96 max-h-96 rounded-lg" playsInline autoPlay muted/></>}
            <p className="my-4 text-lg text-gray-500">Actions</p>
            <div className="flex flex-wrap">
                <button className="h-10 px-5 m-2 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800"
                onClick={sendTestMessage}>Next Shader</button>
            </div>
        </div>
    );
};

export default Options;