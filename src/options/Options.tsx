import { acquireVideoStream } from '@src/helpers/optionsActions';
import browser from "webextension-polyfill";
import React, { useEffect, useRef, useState } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { removeFromStorage } from '@src/storage/storage';
import { SETTINGS_RANDOMIZE_SHADERS, SETTINGS_RANDOMIZE_TIME, SETTINGS_RANDOMIZE_VARIATION, SETTINGS_SPEEDDIVIDER, SETTINGS_WEBCAM, STATE_SHADERINDEX, STATE_SHADERLIST, STATE_SHADERNAME, SETTINGS_SHADEROPTIONS, STATE_SHOWSHADERCREDITS, STATE_SHOWPREVIEW } from '@src/storage/storageConstants';
import '../css/app.css';
import "./styles.module.css";
import { NEXT_SHADER, PREV_SHADER } from '@src/helpers/constants';
import RangeSlider from '@src/components/RangeSlider';
import { VideoCameraIcon } from "@heroicons/react/24/outline";
import ShaderList from './ShaderList';

const Options: React.FC = () => {
    // Local states
    const videoElement = useRef<HTMLVideoElement>(null);
    const [videoStream, setVideoStream] = useState<MediaStream|undefined>();

    // Synced states
    const [shaderIndex, setShaderIndex] = useChromeStorageLocal(STATE_SHADERINDEX, 0);
    const [showPreview, setShowPreview] = useChromeStorageLocal(STATE_SHOWPREVIEW, false);
    const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) });
    const [shaderOptions, setShaderOptions] = useChromeStorageLocal<ShaderOptions>(SETTINGS_SHADEROPTIONS, { });
    const [speedDivider, setSpeedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
    const [playRandomShader, setPlayRandomShader] = useChromeStorageLocal(SETTINGS_RANDOMIZE_SHADERS, true);
    const [randomizeTime, setRandomizeTime] = useChromeStorageLocal(SETTINGS_RANDOMIZE_TIME, 5);
    const [randomizeVariation, setRandomizeVariation] = useChromeStorageLocal(SETTINGS_RANDOMIZE_VARIATION, 2);
    const [useWebcam, setUseWebcam] = useChromeStorageLocal(SETTINGS_WEBCAM, false);
    const [showShaderCredits, setShowShaderCredits] = useChromeStorageLocal(STATE_SHOWSHADERCREDITS, false);

    const cycleShaders = (next: boolean) => {
        browser.runtime.sendMessage({ command: next ? NEXT_SHADER : PREV_SHADER }).catch(error => console.error(error));
    }

    const handleShowPreviewInput = (event:any) => {
        setShowPreview(!showPreview);
    }
    const handleOnShaderListClick = (shaderIndex : number) => {
        setShaderIndex(shaderIndex);
    }

    const handleOnVisibilityToggled = (shaderIndex: number, isVisible: boolean) => {
        const shaderName = shaderCatalog.shaders[shaderIndex].shaderName;
        const shaderOption: ShaderOption = shaderOptions[shaderName] ?? {};
        shaderOption.isHidden = isVisible;
        shaderOptions[shaderName] = shaderOption;
        setShaderOptions(shaderOptions);
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

    const resetSettings = async () => {
        await removeFromStorage('settings.');
    }

    const handleTogglePlayRandomShader = (event:any) => {
        setPlayRandomShader(!playRandomShader);
    }

    const handleShowShaderCredits = (event:any) => {
        setShowShaderCredits(!showShaderCredits);
    }

    const handleToggleUseWebcam = (event:any) => {
        setUseWebcam(!useWebcam);
    }

    return (
        <div className="flex items-center flex-col p-5 w-full h-full bg-white dark:bg-gray-900 antialiased">
            <h2 className="text-4xl font-extrabold dark:text-white">ShaderAmp Options Page</h2>

            { /* Preview */ }
            <label className="my-4 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" onChange={handleShowPreviewInput} checked={showPreview} className="sr-only peer"/>
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Show Preview (experimental):</span>
            </label>
            {showPreview && <><p className="my-4 text-lg text-gray-500">Preview ({shaderCatalog.shaders[shaderIndex].shaderName})</p><video ref={videoElement} className="max-w-96 max-h-96 rounded-lg" playsInline autoPlay muted/></>}
            
            <p className="my-4 text-lg text-gray-500">Options</p>
            
            { /* Webcam */ }
            <div className="my-4 flex flex-col">
                <label className="mb-2 relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" onChange={handleToggleUseWebcam} checked={useWebcam} className="sr-only peer"/>
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    <span className="mx-3 text-sm font-medium text-gray-900 dark:text-gray-300">Use webcam input</span>
                    <VideoCameraIcon className="h-6 w-6 stroke-indigo-500"/>
                </label>
                <p className="text-gray-600 text-xs italic">(Requires webcam access)</p>
            </div>

            { /* Speed slider */ }
            <div className="rounded-lg p-4 shadow-lg select-none">
                <RangeSlider label="Speed divider" value={speedDivider} updateValue={setSpeedDivider} 
                    min="0.1" max="100" step="0.1" />
            </div>

            { /* Random shader toggle */ }
            <label className="my-4 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" onChange={handleTogglePlayRandomShader} checked={playRandomShader} className="mr-2"/>
                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Play random shader</span>
            </label>

            { /* Shader Credits toggle */ }
            <label className="my-4 relative inline-flex items-center cursor-pointer">
                <input type="checkbox" onChange={handleShowShaderCredits} checked={showShaderCredits} className="mr-2"/>
                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Show shader credits</span>
            </label>

            { /* Random shader sliders */ }
            {playRandomShader && <>
                <RangeSlider label="Randomize time" value={randomizeTime} updateValue={setRandomizeTime} 
                    min="0" max="60" step="1" />
                <RangeSlider label="Variation" value={randomizeVariation} updateValue={setRandomizeVariation} 
                    min="0" max="5" step="1" />
            </>}

            <p className="my-4 text-lg text-gray-500">Actions</p>

            {/* Previous/next buttons */}
            <div className="flex flex-row">
                <button className="h-10 px-5 m-2 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800"
                onClick={() => cycleShaders(false)}>Previous Shader</button>
                <button className="h-10 px-5 m-2 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800"
                onClick={() => cycleShaders(true)}>Next Shader</button>
            </div>

            {/* Reset settings */}
            <div className="flex flex-wrap">
                <button className="h-10 px-5 m-2 text-white font-medium transition-colors duration-150 bg-red-700 rounded-lg focus:shadow-outline hover:bg-red-800"
                onClick={resetSettings}>Reset settings</button>
            </div>

            {/* Shader list */}
            <ShaderList shaderCatalog={shaderCatalog} shaderOptions={shaderOptions} selectedShaderIndex={shaderIndex} onShaderSelected={handleOnShaderListClick} onVisiblityToggled={handleOnVisibilityToggled}/>

        </div>
    );
};

export default Options;


