import { tabStreamCapture, tryGetMediaStream } from '@src/helpers/tabActions';
import { getAppState } from '@src/helpers/tabMappingService';
import React, { Ref, useEffect, useRef } from 'react';
import '../css/app.css';
import "./styles.module.css";

const Options: React.FC = () => {
    const videoElement = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        (async () => {
            const appState = await getAppState()
            const optionsTab = appState.optionsTab;
            const contentTabId = optionsTab.contentTabId;
            if (contentTabId) {
                console.log(`contentTabId: ${contentTabId}`);
                const streamId = await tabStreamCapture(contentTabId, optionsTab.tabId);

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        // @ts-ignore
                        mandatory: {
                            chromeMediaSource: "tab",
                            chromeMediaSourceId: streamId,
                        },
                    },
                });
                console.log(`streamId: ${stream}`);
                const video = videoElement.current as HTMLVideoElement;
                video.srcObject = stream;
            }
            //const videoElm = getElementById('streamVideo');
        })();
    }, []);


    return (
        <div className="flex items-center flex-col p-5 w-screen	h-screen bg-white dark:bg-gray-900 antialiased">
            <h2 className="text-4xl font-extrabold dark:text-white">React Options Page</h2>
            <p className="my-4 text-lg text-gray-500">Preview</p>
            <video ref={videoElement} className="max-w-96 max-h-96 rounded-lg" playsInline autoPlay muted/>
        </div>
    );
};

export default Options;