import React, { useState, useRef, useEffect } from 'react'
import { EyeIcon, EyeSlashIcon, InformationCircleIcon, TagIcon, PencilIcon, Square2StackIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import type { ShaderCatalog, ShaderOptions, ShaderObject } from "@src/helpers/types";
import { hasMainVR } from "@src/helpers/vrShader";
import { isOverlayShader } from "@src/helpers/overlayShaders";
import { sendOverlayManual } from "@src/helpers/overlayMappingActions";

type ShaderListProps = {
    shaderCatalog: ShaderCatalog;
    shaderOptions: ShaderOptions;
    selectedShaderIndex: number;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void;
    onToggleAllVisibility: (hideAll: boolean) => void;
    onShaderInfoRequested: (shaderIndex: number) => void;
    onOverlayToggled: (shaderIndex: number, isOverlay: boolean) => void;
    onEditTabs?: (shaderIdOrName: string, shaderName: string) => void;
    onShaderEdit?: (shaderIndex: number) => void;
}

type ShaderListElementProps = {
    itemShader:ShaderObject;
    index: number;
    isSelected: boolean; 
    isVisible: boolean;
    isOverlay: boolean;
    onShaderSelected: (shaderIndex: number) => void;
    onVisiblityToggled: (shaderIndex: number, isVisible: boolean) => void;
    onShaderInfoRequested: (shaderIndex: number) => void;
    onOverlayToggled: (shaderIndex: number, isOverlay: boolean) => void;
    onOverlayHold: (action: 'show' | 'release' | 'toggle') => void;
    onEditTabs?: (shaderIdOrName: string, shaderName: string) => void;
    onShaderEdit?: (shaderIndex: number) => void;
}

function ShaderListElement({itemShader, index, isSelected, isVisible, isOverlay, onShaderSelected, onVisiblityToggled, onShaderInfoRequested, onOverlayToggled, onOverlayHold, onEditTabs, onShaderEdit} : ShaderListElementProps) {
    const shaderName = (itemShader.metaData?.shaderName || itemShader.shaderName).replace('.frag', '');
    const containerOpacity = isSelected ? 'opacity-100' : "opacity-75";
    const imageOutline = isSelected ? 'outline outline-offset-2 outline-pink-500' : "";
    const [holding, setHolding] = useState(false);
    const holdingRef = useRef(false);
    const endHold = () => {
        if (!holdingRef.current) return;
        holdingRef.current = false;
        setHolding(false);
        onOverlayHold('release');
    };
    useEffect(() => () => { if (holdingRef.current) onOverlayHold('release'); }, []); // release if the card unmounts mid-hold
    
    // Determine preview image: custom/imported shaders use metadata previewImage or placeholder
    const hasInlineCode = !!itemShader.inlineCode;
    const previewImage = (itemShader.metaData as any)?.previewImage || 
        (hasInlineCode ? null : `images/preview/${itemShader.shaderName}.png`);
    
    return (<div className={`w-1/4 p-2 ${containerOpacity} hover:opacity-100`}>
        <div className="flex relative">
            {previewImage ? (
                <img src={previewImage} alt={itemShader.shaderName} 
                    className={`inset-0 h-28 w-full object-cover object-center rounded-lg ${imageOutline}`}
                    onClick={(e) => onShaderSelected(index)}/>
            ) : (
                <div 
                    className={`inset-0 h-28 w-full rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center ${imageOutline}`}
                    onClick={(e) => onShaderSelected(index)}>
                    <span className="text-white text-2xl font-bold">{shaderName.charAt(0).toUpperCase()}</span>
                </div>
            )}
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
            <div className="absolute h-6 w-6 text-white top-8 left-0 drop-shadow-lg rounded-lg
                transition-colors duration-150 hover:bg-indigo-800 cursor-pointer" 
                title="Manage tabs"
                onClick={(e) => {
                    let shaderKey: string;
                    if ((itemShader as any).isImported && (itemShader as any).isEdited) {
                        // For edited imported shaders, use edited: prefix
                        shaderKey = `edited:${(itemShader as any).importedId}`;
                    } else if ((itemShader as any).isImported) {
                        // For original imported shaders, use importedId
                        shaderKey = (itemShader as any).importedId;
                    } else if ((itemShader as any).isCustom && (itemShader as any).customId) {
                        // For custom shaders, use customId
                        shaderKey = (itemShader as any).customId;
                    } else {
                        // For built-in shaders, use shaderName
                        shaderKey = itemShader.shaderName;
                    }
                    onEditTabs?.(shaderKey, itemShader.metaData?.shaderName || itemShader.shaderName);
                }}>
                <TagIcon className="stroke-white-500 shadow-lg"/>
            </div>
            <div className="absolute h-6 w-6 text-white top-0 left-8 drop-shadow-lg rounded-lg
                transition-colors duration-150 hover:bg-indigo-800 cursor-pointer" 
                title="Edit shader code"
                onClick={(e) => onShaderEdit?.(index)}>
                <PencilIcon className="stroke-white-500 shadow-lg"/>
            </div>
            {isOverlay && (
                <div className={`absolute h-6 w-6 text-white top-0 left-16 drop-shadow-lg rounded-lg
                    transition-colors duration-150 hover:bg-indigo-800 cursor-pointer ${holding ? 'bg-cyan-500 rounded-lg' : ''}`}
                    title="Hold to overlay on the current shader · Shift+click to latch on/off"
                    onPointerDown={(e) => {
                        e.stopPropagation(); e.preventDefault();
                        if (e.shiftKey) { onOverlayHold('toggle'); return; }
                        e.currentTarget.setPointerCapture(e.pointerId);
                        holdingRef.current = true; setHolding(true);
                        onOverlayHold('show');
                    }}
                    onPointerUp={endHold}
                    onPointerCancel={endHold}
                    onLostPointerCapture={endHold}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}>
                    <HandRaisedIcon className="stroke-white-500 shadow-lg"/>
                </div>
            )}
            {(itemShader.metaData?.vr || hasMainVR(itemShader.inlineCode)) && (
                <span className="absolute top-8 right-0 m-0.5 px-1 rounded bg-emerald-600 text-white text-[10px] font-bold pointer-events-none">VR</span>
            )}
            {isOverlay && (
                <span className="absolute top-14 right-0 m-0.5 px-1 rounded bg-cyan-600 text-white text-[10px] font-bold pointer-events-none">OL</span>
            )}
            <div className={`absolute h-6 w-6 text-white top-0 right-8 drop-shadow-lg rounded-lg
                transition-colors duration-150 hover:bg-indigo-800 cursor-pointer ${isOverlay ? 'bg-cyan-600 rounded-lg' : ''}`}
                title={isOverlay ? 'Overlay shader (click to unmark)' : 'Mark as overlay shader'}
                onClick={(e) => { e.stopPropagation(); onOverlayToggled(index, isOverlay); }}>
                <Square2StackIcon className="stroke-white-500 shadow-lg"/>
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

export default function ShaderList({shaderCatalog, shaderOptions, selectedShaderIndex, onShaderSelected, onVisiblityToggled, onToggleAllVisibility, onShaderInfoRequested, onOverlayToggled, onEditTabs, onShaderEdit} : ShaderListProps) {
    const shaderKey = (shaderIndex : number): string => {
        const shader = shaderCatalog.shaders[shaderIndex] as any;
        if (shader.isImported) {
            return shader.importedId;
        } else if (shader.isCustom && shader.customId) {
            return shader.customId;
        }
        return shader.shaderName;
    }

    const isShaderVisible = (shaderIndex : number): boolean => {
        const key = shaderKey(shaderIndex);
        return key in shaderOptions ? !shaderOptions[key].isHidden : true;
    }

    const isShaderOverlay = (shaderIndex : number): boolean => {
        const shader = shaderCatalog.shaders[shaderIndex];
        return isOverlayShader(shaderKey(shaderIndex), shader.metaData, shaderOptions);
    }

    // Derived: are all shaders in the current view visible?
    const allVisible = shaderCatalog.shaders.every((_, i) => isShaderVisible(i));

    const handleToggleAllVisible = () => {
        onToggleAllVisibility(allVisible); // allVisible=true means hide all; false means show all
    }
    return (<div className="container px-2 mx-auto items-center select-none">
        <div className="flex items-center justify-center text-gray-400 cursor-pointer"
            onClick={handleToggleAllVisible}>
            { allVisible ? <EyeIcon className="h-6 w-6 m-1 shadow-lg"/> :  
                <EyeSlashIcon className="h-6 w-6 m-1 shadow-lg"/> }
                Toggle All Visible/Invisible
        </div>
        <div className="flex flex-wrap">
            {shaderCatalog.shaders.map((itemShader: ShaderObject, index: number) => (
                <ShaderListElement key={index} itemShader={itemShader} index={index} isVisible={isShaderVisible(index)} isOverlay={isShaderOverlay(index)}
                    isSelected={selectedShaderIndex === index} onShaderSelected={onShaderSelected} onVisiblityToggled={onVisiblityToggled} onShaderInfoRequested={onShaderInfoRequested} onOverlayToggled={onOverlayToggled}
                    onOverlayHold={(action: 'show' | 'release' | 'toggle') =>
                        sendOverlayManual({ action, shaderRef: shaderKey(index), opacity: 1, blendMode: 'additive' })}
                    onEditTabs={onEditTabs} onShaderEdit={onShaderEdit}/> 
            ))}
        </div>
    </div>);
}
