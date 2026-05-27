import React, { useRef } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { STATE_SHADERINDEX, STATE_SHADERLIST, SETTINGS_SHADEROPTIONS } from '@src/storage/storageConstants';
import type { ShaderCatalog, ShaderOptions, ShaderObject, ShaderOption } from "@src/helpers/types";
//import '../css/app.css';
import "../styles.module.css";
import TabbedShaderList from '../TabbedShaderList';
import ShaderInfoModal from './ShaderInfoModal';
import ShaderEditorModal from './ShaderEditorModal';
import { PlusIcon } from "@heroicons/react/24/outline";
import { generateShaderId } from "@src/helpers/shaderStorage";

const OptionsContent: React.FC = () => {
    // Synced states
    const [shaderIndex, setShaderIndex] = useChromeStorageLocal(STATE_SHADERINDEX, 0);
    const [shaderCatalog] = useChromeStorageLocal<ShaderCatalog>(STATE_SHADERLIST, { shaders: [], lastModified: new Date(0) });
    const [shaderOptions, setShaderOptions] = useChromeStorageLocal<ShaderOptions>(SETTINGS_SHADEROPTIONS, {});

    // Local states
    const [showModal, setShowModal] = React.useState(false);
    const [currentShader, setCurrentShader] = React.useState<ShaderObject | undefined>(undefined);
    
    // Shader editor state
    const [showEditor, setShowEditor] = React.useState(false);
    const [editorShader, setEditorShader] = React.useState<ShaderObject | null>(null);
    const [editorImportId, setEditorImportId] = React.useState<string | undefined>(undefined);
    const [editorIsCustom, setEditorIsCustom] = React.useState(false);
    const [editorCustomId, setEditorCustomId] = React.useState<string | undefined>(undefined);

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

    const handleOpenEditor = (shader: ShaderObject | null, options?: { importId?: string; isCustom?: boolean; customId?: string }) => {
        setEditorShader(shader);
        setEditorImportId(options?.importId);
        setEditorIsCustom(options?.isCustom || false);
        setEditorCustomId(options?.customId);
        setShowEditor(true);
    };

    const handleNewShader = () => {
        // Create a new custom shader with generated ID
        const newId = generateShaderId();
        handleOpenEditor(null, { isCustom: true, customId: newId });
    };

    const handleEditorSave = () => {
        // Refresh the shader list after saving (delay to ensure storage is persisted)
        setTimeout(() => window.location.reload(), 500);
    };

    const handleEditorDelete = () => {
        // Refresh the shader list after deletion
        setTimeout(() => window.location.reload(), 500);
    };

    return (
        <div className="flex items-center flex-col w-full bg-white dark:bg-gray-900 antialiased">
            <div className="flex items-center justify-between w-full max-w-6xl px-4 py-4">
                <h2 className="text-2xl font-extrabold dark:text-blue-400">ShaderAmp Options Page</h2>
                
                {/* New Shader Button */}
                <button
                    onClick={handleNewShader}
                    className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-md"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    New Shader
                </button>
            </div>

            {/* Shader list with tabs */}
            <TabbedShaderList 
                shaderCatalog={shaderCatalog} 
                shaderOptions={shaderOptions} 
                selectedShaderIndex={shaderIndex}
                onShaderSelected={handleOnShaderListClick} 
                onVisiblityToggled={handleOnVisibilityToggled} 
                onShaderInfoRequested={handleOnShaderInfoRequested}
                onShaderEdit={handleOpenEditor}
            />

            {/* Shader info modal */}
            <ShaderInfoModal shaderObject={currentShader!} showModal={showModal} setShowModal={setShowModal}/>

            {/* Shader Editor Modal */}
            <ShaderEditorModal
                shaderObject={editorShader}
                importId={editorImportId}
                isCustom={editorIsCustom}
                customId={editorCustomId}
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                onSave={handleEditorSave}
                onDelete={handleEditorDelete}
            />
        </div>
    );
};

export default OptionsContent;


