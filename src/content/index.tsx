import React, {Suspense} from 'react';
import { createRoot } from 'react-dom/client';
import {Canvas} from '@react-three/fiber'
import { OrthographicCamera, Preload } from "@react-three/drei"
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { STATE_CURRENT_SHADER, STATE_SHOWSHADERCREDITS } from '@src/storage/storageConstants';
import "../css/app.css";
import css from "./styles.module.css";
import { defaultShader } from '@src/helpers/constants';
import AnalyzerRoot from './Components/AnalyzerRoot';
import { CanvasLoader } from './Components/CanvasLoader';
import { LoadersProvider } from './Context/LoaderContext';
import LoaderHandler, { LoaderKey as AnalyserRootKey } from './Components/LoaderHandler';


const App: React.FC = () => {
    // Synced states
    const [currentShader] = useChromeStorageLocal<ShaderObject>(STATE_CURRENT_SHADER, defaultShader);
    const [shaderCredits] = useChromeStorageLocal(STATE_SHOWSHADERCREDITS, false);

    return(
        <div id="canvas-container">
                <Canvas
                    id={css.renderCanvas}
                    className="z-50"
                    style={{position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh"}}>
                    <OrthographicCamera makeDefault zoom={1}
                        near={0.1}
                        far={1000}
                        position={[0, 0, 1]}
                    />
                    <Suspense fallback={<LoaderHandler loaderKey={AnalyserRootKey}/>}>
                        <AnalyzerRoot/>
                    </Suspense>
                    <Preload/>
                </Canvas>

                <CanvasLoader/>
                <div className="fixed flex w-screen h-screen z-[100] bg-white-200">
                    {shaderCredits && <h1 className="m-2 text-2xl font-medium leading-tight text-white fixed z-40">{currentShader.metaData.shaderName} by {currentShader.metaData.author}</h1>}
                </div>
        </div>
    );
};

const container = document.getElementById('content-root');
const root = createRoot(container!);
root.render(
    <LoadersProvider>
      <App />
    </LoadersProvider>
);
