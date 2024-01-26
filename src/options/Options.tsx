import { acquireVideoStream } from '@src/helpers/optionsActions';
import React, { useEffect, useRef } from 'react';
import '../css/app.css';
import "./styles.module.css";

const Options: React.FC = () => {
    const videoElement = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        acquireVideoStream(videoElement.current as HTMLVideoElement);
    }, []);


    return (
        <div className="flex items-center flex-col p-5 w-screen	h-screen bg-white dark:bg-gray-900 antialiased">
            <h2 className="text-4xl font-extrabold dark:text-white">ShaderAmp Options Page</h2>
            <p className="my-4 text-lg text-gray-500">Preview</p>
            <video ref={videoElement} className="max-w-96 max-h-96 rounded-lg" playsInline autoPlay muted/>
            <p className="my-4 text-lg text-gray-500">Actions</p>
            <div className="flex flex-wrap">
                <button className="h-10 px-5 m-2 text-white font-medium transition-colors duration-150 bg-indigo-700 rounded-lg focus:shadow-outline hover:bg-indigo-800">Button</button>
            </div>
        </div>
    );
};

export default Options;