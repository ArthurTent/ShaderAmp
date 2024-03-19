import { acquireVideoStream } from '@src/helpers/optionsActions';
import browser from "webextension-polyfill";
import React, { useEffect, useRef, useState } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { removeFromStorage } from '@src/storage/storage';
import { SETTINGS_RANDOMIZE_SHADERS, SETTINGS_RANDOMIZE_TIME, SETTINGS_RANDOMIZE_VARIATION, SETTINGS_SPEEDDIVIDER, SETTINGS_WEBCAM, STATE_SHADERINDEX, STATE_SHADERLIST, STATE_SHADERNAME, SETTINGS_SHADEROPTIONS, STATE_SHOWSHADERCREDITS, STATE_SHOWPREVIEW, SETTINGS_WEBCAM_AUDIO, SETTINGS_VOLUME_AMPLIFIER } from '@src/storage/storageConstants';
import { NEXT_SHADER, PREV_SHADER } from '@src/helpers/constants';
import RangeSlider from '@src/components/RangeSlider';
import { MusicalNoteIcon, VideoCameraIcon, VideoCameraSlashIcon } from '@heroicons/react/24/outline';
import Toggle from '@src/components/Toggle';

export default function OptionsSidebar() {
    // Local states
    const videoElement = useRef<HTMLVideoElement>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | undefined>();
    const [isVideoAvailable, setIsVideoAvailable] = useState<boolean>(true);

    // Synced states
    const [shaderIndex] = useChromeStorageLocal(STATE_SHADERINDEX, 0);
    const [showPreview, setShowPreview] = useChromeStorageLocal(STATE_SHOWPREVIEW, false);
    const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) });
    const [speedDivider, setSpeedDivider] = useChromeStorageLocal(SETTINGS_SPEEDDIVIDER, 25);
    const [playRandomShader, setPlayRandomShader] = useChromeStorageLocal(SETTINGS_RANDOMIZE_SHADERS, true);
    const [randomizeTime, setRandomizeTime] = useChromeStorageLocal(SETTINGS_RANDOMIZE_TIME, 5);
    const [randomizeVariation, setRandomizeVariation] = useChromeStorageLocal(SETTINGS_RANDOMIZE_VARIATION, 2);
    const [useWebcam, setUseWebcam] = useChromeStorageLocal(SETTINGS_WEBCAM, false);
    const [useWebcamAudio, setUseWebcamAudio] = useChromeStorageLocal(SETTINGS_WEBCAM_AUDIO, false);
    const [showShaderCredits, setShowShaderCredits] = useChromeStorageLocal(STATE_SHOWSHADERCREDITS, false);
    const [volumeAmpifier, setVolumeAmplifier] = useChromeStorageLocal(SETTINGS_VOLUME_AMPLIFIER, 1);



    const cycleShaders = (next: boolean) => {
        browser.runtime.sendMessage({ command: next ? NEXT_SHADER : PREV_SHADER }).catch(error => console.error(error));
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

    const resetSettings = async () => {
        await removeFromStorage('settings.');
    }

    useEffect(() => {
        const isAvailable = videoStream !== undefined;
        setIsVideoAvailable(isAvailable)
    }, [videoStream])

    useEffect(() => {
        if (showPreview) {
            setupVideoStream();
        } else {
            shutDownVideoStream();
        }
    }, [showPreview]);

    return (
        <div className="flex flex-col space-y-4 p-4 select-none">
            <h5 className="text-xl dark:text-blue-400 pb-4">Settings</h5>

            { /* Preview */}
            <Toggle label="Show Preview (experimental)" checked={showPreview} updateValue={setShowPreview} />
            {showPreview && <>
                <video ref={videoElement} className={`max-w-96 max-h-96 rounded-lg ${(!isVideoAvailable ? 'hidden' : '')}`} playsInline autoPlay muted />
                {!isVideoAvailable && <div className="w-full rounded-lg font-semibold italic text-gray-900 dark:text-gray-300 bg-orange-800 items-center flex flex-row">
                    <p className="p-2">Preview stream not available.</p>
                    <VideoCameraSlashIcon className="flex h-6 w-6" />
                </div>}
                <p className="text-xs text-gray-500">
                    {shaderCatalog.shaders[shaderIndex].shaderName}
                </p>
            </>}

            { /* Webcam */}
            <div className="flex flex-col">
                <Toggle label="Use webcam video input" checked={useWebcam} updateValue={setUseWebcam} icon={<VideoCameraIcon className="h-4 w-4 ml-2 stroke-indigo-500" />} />
                <p className="text-gray-500 text-xs italic">Requires webcam access</p>
            </div>
            <div className="flex flex-col">
                <Toggle label="Use webcam audio input" checked={useWebcamAudio} updateValue={setUseWebcamAudio} icon={<MusicalNoteIcon className="h-4 w-4 ml-2 stroke-indigo-500" />} />
                <p className="text-gray-500 text-xs italic">Requires webcam access and this overrides the source tab audio.</p>
                <p className="text-gray-500 text-xs italic">Warning: This is an experimental feature and may not work properly!</p>
            </div>

            { /* Shader Credits toggle */}
            <Toggle label="Show shader credits" checked={showShaderCredits} updateValue={setShowShaderCredits} />

            { /* Random shader toggle */}
            <Toggle label="Play random shader" checked={playRandomShader} updateValue={setPlayRandomShader} />

            { /* Random shader sliders */}
            {playRandomShader && <>
                <RangeSlider label="Randomize time" value={randomizeTime} updateValue={setRandomizeTime}
                    min="0" max="60" step="1" />
                <RangeSlider label="Variation" value={randomizeVariation} updateValue={setRandomizeVariation}
                    min="0" max="5" step="1" />
            </>}

            { /* Speed slider */}
            <RangeSlider label="Speed divider" value={speedDivider} updateValue={setSpeedDivider}
                min="0.1" max="100" step="0.1" />

            { /* Volume amplifier slider */}
            <RangeSlider label="Volume amplifier" value={volumeAmpifier} updateValue={setVolumeAmplifier}
                min="0.1" max="10" step="0.1" />
            <p className="text-gray-500 text-xs italic">This multiplies the source volume</p>
            
            <p className="my-4 text-lg text-gray-500 dark:text-white-500">Actions</p>

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

        </div>
    )
}