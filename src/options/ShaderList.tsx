import React, { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

type ShaderListProps = {
    shaderCatalog: ShaderCatalog;
    shaderOptions: ShaderOptions;
    selectedShaderIndex: number;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void
}

type ShaderListElementProps = {
    itemShader:ShaderObject;
    index: number;
    isSelected: boolean; 
    isVisible: boolean;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void;
}

function ShaderListElement({itemShader, index, isSelected, isVisible, onShaderSelected, onVisiblityToggled} : ShaderListElementProps) {
    const shaderName = itemShader.shaderName.replace('.frag', '');
    const containerOpacity = isSelected ? 'opacity-100' : "opacity-75";
    const imageOutline = isSelected ? 'outline outline-offset-2 outline-pink-500' : "";
    return (<div className={`lg:w-1/4 sm:w-1/2 p-2 ${containerOpacity} hover:opacity-100`}>
        <div className="flex relative">
            <img src={`images/preview/${itemShader.shaderName}.png`} alt={itemShader.shaderName} 
                className={`inset-0 h-full w-full object-cover object-center rounded-lg rounded-lg ${imageOutline}`}
                onClick={(e) => onShaderSelected(index)}/>
            <p className="p-1 absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-lg
                pointer-events-none
                bg-opacity-80 bg-purple-500 
                font-mono text-white text-xs font-bold
                truncate">
                    {shaderName}
            </p>
            <div className="absolute h-6 w-6 text-white top-0 right-0 drop-shadow-lg rounded-lg
                transition-colors duration-150 hover:bg-indigo-800 cursor-pointer" onClick={(e) => onVisiblityToggled(index, isVisible)}>
                { isVisible ? 
                    <EyeIcon className="stroke-white-500 shadow-lg"/> :
                    <EyeSlashIcon className="stroke-white-500 shadow-lg"/> }
            </div>
        </div>
    </div>);
}

export default function ShaderList({shaderCatalog, shaderOptions, selectedShaderIndex, onShaderSelected, onVisiblityToggled} : ShaderListProps) {
    const [toggleVisible, setToggleVisible] = useState<boolean>(false);
    const isShaderVisible = (shaderIndex : number): boolean => {
        const shaderName = shaderCatalog.shaders[shaderIndex].shaderName;
        return shaderName in shaderOptions ? !shaderOptions[shaderName].isHidden : true;
    }

    const toggleAllShaderVisible = () => {
        const shaders = shaderCatalog.shaders;
        for (let i = 0; i < shaders.length; i++) {
            onVisiblityToggled(i, toggleVisible);
        }
    }

    const handleToggleAllVisible = () => {
        setToggleVisible(!toggleVisible);
        toggleAllShaderVisible();
    }
    return (<div className="container px-10 py-8 mx-auto items-center select-none">
        <p className="flex justify-center my-4 text-lg text-gray-500">Shader List</p>
        <div className="flex items-center justify-center text-white cursor-pointer"
            onClick={handleToggleAllVisible}>
            { toggleVisible ? <EyeIcon className="h-6 w-6 m-1 stroke-white-500 shadow-lg"/> :  
                <EyeSlashIcon className="h-6 w-6 m-1 stroke-white-500 shadow-lg"/> }
                Toggle All Visible/Invisible
        </div>
        <div className="flex flex-wrap">
            {shaderCatalog.shaders.map((itemShader: ShaderObject, index: number) => (
                <ShaderListElement key={index} itemShader={itemShader} index={index} isVisible={isShaderVisible(index)} 
                    isSelected={selectedShaderIndex === index} onShaderSelected={onShaderSelected} onVisiblityToggled={onVisiblityToggled}/> 
            ))}
        </div>
    </div>);
}
