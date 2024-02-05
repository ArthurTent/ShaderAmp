import { acquireVideoStream } from '@src/helpers/optionsActions';
import React, { useEffect, useRef, useState } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import '../css/app.css';
import "./styles.module.css";

const Options: React.FC = () => {
    // Local states
    const videoElement = useRef<HTMLVideoElement>(null);
    const [videoStream, setVideoStream] = useState<MediaStream|undefined>();
    const [shaderIndex, setShaderIndex] = useState<number>(0);

    // Synced states
    const [shaderName, setShaderName] = useChromeStorageLocal('shadername', 'MusicalHeart.frag');
    const [showPreview, setShowPreview] = useChromeStorageLocal('showpreview', false);
    const [shaderList] = useChromeStorageLocal('shaderlist', []);

    const cycleShaders = () => {
        if (shaderList.length == 0) {
            return;
        }
        const newShaderName = shaderList[shaderIndex];
        setShaderName(newShaderName);
        const newShaderIndex = (shaderIndex + 1) % shaderList.length;
        setShaderIndex(newShaderIndex);
    }

    const handleShowPreviewInput = (event:any) => {
        setShowPreview(!showPreview);
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
        if (showPreview) {
            setupVideoStream();
        } else {
            shutDownVideoStream();
        }
    }, [showPreview]);

    return (
        <div className="flex items-center flex-col p-5 w-screen	h-screen bg-white dark:bg-gray-900 antialiased">
            <h2 className="text-4xl font-extrabold dark:text-white">ShaderAmp Options Page</h2>
            <label className="my-4 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" onChange={handleShowPreviewInput} checked={showPreview} className="sr-only peer"/>
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Show Preview (experimental):</span>
            </label>
            {showPreview && <><p className="my-4 text-lg text-gray-500">Preview ({shaderName})</p><video ref={videoElement} className="max-w-96 max-h-96 rounded-lg" playsInline autoPlay muted/></>}
            <p className="my-4 text-lg text-gray-500">Actions</p>
            <div className="flex flex-wrap">
                <button className="h-10 px-5 m-2 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800"
                onClick={cycleShaders}>Next Shader</button>
            </div>
        </div>
    );
};

export default Options;