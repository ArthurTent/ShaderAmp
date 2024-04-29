import React, { useRef } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { STATE_SHADERINDEX, STATE_SHADERLIST, SETTINGS_SHADEROPTIONS } from '@src/storage/storageConstants';
//import '../css/app.css';
import "../styles.module.css";
import ShaderList from '../ShaderList';
import ShaderInfoModal from './ShaderInfoModal';

const OptionsContent: React.FC = () => {
    // Synced states
    const [shaderIndex, setShaderIndex] = useChromeStorageLocal(STATE_SHADERINDEX, 0);
    const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) });
    const [shaderOptions, setShaderOptions] = useChromeStorageLocal<ShaderOptions>(SETTINGS_SHADEROPTIONS, {});

    // Local states
    const [showModal, setShowModal] = React.useState(false);
    const [currentShader, setCurrentShader] = React.useState<ShaderObject | undefined>(undefined);

    const handleOnShaderListClick = (shaderIndex: number) => {
        setShaderIndex(shaderIndex);
    }

    const handleOnShaderInfoRequested = (shaderIndex: number) => {
        const shader = shaderCatalog.shaders[shaderIndex];
        setCurrentShader(shader);
        setShowModal(true);
    }

    const handleOnVisibilityToggled = (shaderIndex: number, isVisible: boolean) => {
        const shaderName = shaderCatalog.shaders[shaderIndex].shaderName;
        const shaderOption: ShaderOption = shaderOptions[shaderName] ?? {};
        shaderOption.isHidden = isVisible;
        shaderOptions[shaderName] = shaderOption;
        setShaderOptions(shaderOptions);
    }

    return (
        <div className="flex items-center flex-col w-full bg-white dark:bg-gray-900 antialiased">
            <h2 className="text-2xl font-extrabold dark:text-blue-400">ShaderAmp Options Page</h2>

            {/* Shader list */}
            <ShaderList shaderCatalog={shaderCatalog} shaderOptions={shaderOptions} selectedShaderIndex={shaderIndex}
                onShaderSelected={handleOnShaderListClick} onVisiblityToggled={handleOnVisibilityToggled} onShaderInfoRequested={handleOnShaderInfoRequested} />

            {/* Shader info modal */}
            <ShaderInfoModal shaderObject={currentShader!} showModal={showModal} setShowModal={setShowModal}/>
        </div>
    );
};

export default OptionsContent;


