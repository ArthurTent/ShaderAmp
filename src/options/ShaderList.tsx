import React, { useState } from 'react'
import { EyeIcon, EyeSlashIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

type ShaderListProps = {
    shaderCatalog: ShaderCatalog;
    shaderOptions: ShaderOptions;
    selectedShaderIndex: number;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void;
    onShaderInfoRequested: (shaderIndex: number) => void;
}

type ShaderListElementProps = {
    itemShader:ShaderObject;
    index: number;
    isSelected: boolean; 
    isVisible: boolean;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void;
    onShaderInfoRequested: (shaderIndex: number) => void;
}

function ShaderListElement({itemShader, index, isSelected, isVisible, onShaderSelected, onVisiblityToggled, onShaderInfoRequested} : ShaderListElementProps) {
    const shaderName = itemShader.shaderName.replace('.frag', '');
    const containerOpacity = isSelected ? 'opacity-100' : "opacity-75";
    const imageOutline = isSelected ? 'outline outline-offset-2 outline-pink-500' : "";
    return (<div className={`w-1/4 p-2 ${containerOpacity} hover:opacity-100`}>
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
            <div className="absolute h-6 w-6 text-white top-0 left-0 drop-shadow-lg rounded-lg
                transition-colors duration-150 hover:bg-indigo-800 cursor-pointer" onClick={(e) => onShaderInfoRequested(index)}>
                <InformationCircleIcon className="stroke-white-500 shadow-lg"/>
            </div>
            <div className="absolute h-6 w-6 text-white top-0 right-0 drop-shadow-lg rounded-lg
                transition-colors duration-150 hover:bg-indigo-800 cursor-pointer" onClick={(e) => onVisiblityToggled(index, isVisible)}>
                { isVisible ? 
                    <EyeIcon className="stroke-white-500 shadow-lg"/> :
                    <EyeSlashIcon className="stroke-white-500 shadow-lg"/> }
            </div>
        </div>
    </div>);
}

export default function ShaderList({shaderCatalog, shaderOptions, selectedShaderIndex, onShaderSelected, onVisiblityToggled, onShaderInfoRequested} : ShaderListProps) {
    const [toggleVisible, setToggleVisible] = useState<boolean>(true);
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
    return (<div className="container px-10 mx-auto items-center select-none">
        <div className="flex items-center justify-center text-gray-400 cursor-pointer"
            onClick={handleToggleAllVisible}>
            { toggleVisible ? <EyeIcon className="h-6 w-6 m-1 shadow-lg"/> :  
                <EyeSlashIcon className="h-6 w-6 m-1 shadow-lg"/> }
                Toggle All Visible/Invisible
        </div>
        <div className="flex flex-wrap">
            {shaderCatalog.shaders.map((itemShader: ShaderObject, index: number) => (
                <ShaderListElement key={index} itemShader={itemShader} index={index} isVisible={isShaderVisible(index)} 
                    isSelected={selectedShaderIndex === index} onShaderSelected={onShaderSelected} onVisiblityToggled={onVisiblityToggled} onShaderInfoRequested={onShaderInfoRequested}/> 
            ))}
        </div>
    </div>);
}
