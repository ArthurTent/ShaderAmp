import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import browser from "webextension-polyfill";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    type Node,
    type Edge,
    type Connection,
} from '@xyflow/react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import type { SceneGraph, SceneNode, SceneEdge, SceneTrigger, SceneCondition, SceneTimeSource, ShaderUniform, ShaderMetaData, ShaderObject, ShaderCatalog, ShaderOptions, ImportedShader, MidiMappings, MidiMapping, MidiMappingSource, JoystickMappings, JoystickMapping, JoystickMappingSource } from "@src/helpers/types";
import type { MidiEvent } from "@src/helpers/midiService";
import type { JoystickEvent } from "@src/helpers/joystickService";
import {
    STATE_SCENES,
    STATE_ACTIVE_SCENE_ID,
    STATE_SCENE_PLAYING,
    STATE_SCENE_PLAY_MODE,
    STATE_SCENE_CLOCK_PAUSED,
    STATE_SCENE_HOLD,
    STATE_SCENE_CURRENT_NODE_ID,
    STATE_IMPORTED_SHADERS,
    SETTINGS_SCENE_HIGHLIGHT_ACTIVE,
    SETTINGS_MIDI_ENABLED,
    SETTINGS_MIDI_MAPPINGS,
    SETTINGS_JOYSTICK_ENABLED,
    SETTINGS_JOYSTICK_MAPPINGS,
    SETTINGS_SHADEROPTIONS,
} from "@src/storage/storageConstants";
import { SET_TIME, MEDIA_CONTROL } from "@src/helpers/constants";
import { isOverlayShader } from "@src/helpers/overlayShaders";
import { collectSceneCredits, formatCredits } from "@src/helpers/sceneCredits";
import { buildScenePackage, readScenePackage, applyScenePackage } from "@src/helpers/scenePackage";
import { getImageDB, getVideoDB, getCubemapDB, getVolumeDB, addImageDB, addVideoDB, addCubemapDB, addVolumeDB, saveImportedShaderDB, getAllImagesDB, getAllVideosDB, getAllCubemapsDB, getAllVolumesDB } from "@src/storage/shaderDB";
import { getAllEditedShaders, saveEditedShader, saveEditedImportedShader, saveCustomShader, type CustomShader } from "@src/helpers/shaderStorage";
import { setStorageMany } from "@src/storage/storage";
import SceneTransportBar from "./SceneTransportBar";
import { PlusIcon, TrashIcon, ArrowPathIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ClipboardDocumentIcon, PlayIcon, PauseIcon, BackwardIcon, StopIcon, MusicalNoteIcon } from "@heroicons/react/24/outline";

type ScenePlayMode = 'reset' | 'keep';

const MINIMAP_NODE_COLORS: Record<string, string> = {
    start: '#059669',
    scene: '#4f46e5',
    uniform: '#9333ea',
    condition: '#ca8a04',
    overlay: '#0891b2',
};

interface ShaderOptionItem {
    id: string;
    label: string;
    kind: 'builtin' | 'imported' | 'custom';
}

// Overlay-node shader picker: the flagged-shader list depends on async data
// (settings.shaderOptions + built-in meta), so it's provided via context
// instead of being baked into node data.
const OverlayOptionsContext = React.createContext<ShaderOptionItem[]>([]);

function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const TIME_SOURCE_LABELS: Record<SceneTimeSource, string> = {
    auto: 'the renderer clock (iTime / iAmplifiedTime)',
    iTime: 'iTime (real seconds)',
    iAmplifiedTime: 'iAmplifiedTime (audio)',
};

function defaultTimeTrigger(): SceneTrigger {
    return { type: 'time', durationSeconds: 0 };
}

function triggerLabel(trigger: SceneTrigger): string {
    switch (trigger.type) {
        case 'time': return `${trigger.durationSeconds}s`;
        case 'beat': return `${trigger.beatCount} beat${trigger.beatCount === 1 ? '' : 's'}`;
        case 'audio': return `audio ≥ ${trigger.threshold}`;
        case 'manual': return 'manual';
    }
}

function parseVecValue(value: string, size: number): number[] | undefined {
    const parts = value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length !== size) return undefined;
    return parts;
}

function formatVecValue(value: any): string {
    if (Array.isArray(value)) return value.join(', ');
    return '';
}

function UniformInput({
    uniform,
    value,
    onChange,
}: {
    uniform: { name: string; type: string; label?: string; default?: any };
    value: any;
    onChange: (v: any) => void;
}) {
    const type = uniform.type;
    const defaultValue = uniform.default;
    const current = value !== undefined ? value : defaultValue;

    if (type === 'bool') {
        return (
            <input
                type="checkbox"
                aria-label={uniform.label || uniform.name}
                checked={!!current}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
            />
        );
    }
    if (type === 'int' || type === 'float') {
        return (
            <input
                type="number"
                aria-label={uniform.label || uniform.name}
                step={type === 'int' ? 1 : 0.01}
                value={current ?? ''}
                onChange={(e) => {
                    const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                    onChange(v);
                }}
                className="w-20 px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
            />
        );
    }
    if (type === 'vec2' || type === 'vec3' || type === 'vec4') {
        const size = parseInt(type.slice(3), 10);
        return (
            <input
                type="text"
                aria-label={uniform.label || uniform.name}
                placeholder={Array(size).fill('0').join(', ')}
                value={formatVecValue(current)}
                onChange={(e) => {
                    const parsed = parseVecValue(e.target.value, size);
                    if (parsed) onChange(parsed);
                }}
                className="w-28 px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
            />
        );
    }
    return (
        <input
            type="text"
            aria-label={uniform.label || uniform.name}
            value={current ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
        />
    );
}

function UniformOverrides({
    uniforms,
    values = {},
    onChange,
}: {
    uniforms: ShaderUniform[];
    values?: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
}) {
    const update = (name: string, value: any) => {
        const next = { ...values };
        if (value === undefined) delete next[name];
        else next[name] = value;
        onChange(next);
    };
    return (
        <div className="space-y-1 nodrag nopan">
            <div className="text-[10px] text-gray-400">Checked values apply on entry. Unchecked values stay unchanged.</div>
            {uniforms.map(uniform => {
                const enabled = values[uniform.name] !== undefined;
                return (
                    <div key={uniform.name} className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1 min-w-0 text-[10px] text-gray-300" title={uniform.name}>
                            <input
                                type="checkbox"
                                aria-label={`Apply ${uniform.name}`}
                                checked={enabled}
                                onChange={(e) => update(uniform.name, e.target.checked
                                    ? (Array.isArray(uniform.default) ? [...uniform.default] : uniform.default)
                                    : undefined)}
                                className="accent-indigo-500"
                            />
                            <span className="truncate">{uniform.label || uniform.name}</span>
                        </label>
                        <fieldset disabled={!enabled} className={enabled ? '' : 'opacity-40'}>
                            <UniformInput uniform={uniform} value={values[uniform.name]} onChange={value => update(uniform.name, value)} />
                        </fieldset>
                    </div>
                );
            })}
        </div>
    );
}

function StartNode() {
    return (
        <div className="px-3 py-2 bg-emerald-700 text-white rounded shadow text-xs font-semibold">
            Start
            <Handle type="source" position={Position.Right} id="out" />
        </div>
    );
}

function SceneNodeComponent({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const {
        shaderRef,
        durationSeconds,
        uniformOverrides,
        shaderOptions,
        getShaderMeta,
        onChange,
        onDelete,
    } = data;

    const meta: ShaderMetaData | null = shaderRef ? getShaderMeta(shaderRef) : null;

    return (
        <div className={`min-w-[220px] max-w-[260px] p-3 rounded shadow border ${selected ? 'border-indigo-400 bg-gray-800' : 'border-gray-600 bg-gray-800'} ${data.active ? 'ring-2 ring-emerald-400' : ''} text-gray-100`}>
            <Handle type="target" position={Position.Left} id="in" />
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-indigo-300">Scene</div>
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(id); }} className="p-1 text-gray-500 hover:text-red-400" title="Delete node">
                    <TrashIcon className="w-3 h-3" />
                </button>
            </div>
            <select
                value={shaderRef || ''}
                onChange={(e) => onChange(id, { shaderRef: e.target.value || undefined, uniformOverrides: {} })}
                className="w-full mb-2 px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
            >
                <option value="">-- select shader --</option>
                {shaderOptions.map((opt: ShaderOptionItem) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
            </select>
            <div className="flex items-center gap-2 mt-2">
                <label className="text-[10px] text-gray-400 whitespace-nowrap">Duration (s)</label>
                <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={durationSeconds ?? ''}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onChange(id, { durationSeconds: isNaN(val) ? undefined : val });
                    }}
                    className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                    placeholder="auto-advance"
                    title="Advance after this duration unless an outgoing trigger fires earlier."
                />
            </div>
            {meta && (
                <div className="mt-2 space-y-1 border-t border-gray-700 pt-2">
                    <div className="text-[10px] uppercase text-gray-400">Uniform overrides</div>
                    {meta.customUniforms && meta.customUniforms.length > 0 ? (
                        <UniformOverrides
                            uniforms={meta.customUniforms}
                            values={uniformOverrides}
                            onChange={values => onChange(id, { uniformOverrides: values })}
                        />
                    ) : (
                        <div className="text-[10px] text-gray-500 italic">No custom uniforms on this shader.</div>
                    )}
                </div>
            )}
            <Handle type="source" position={Position.Right} id="out" />
        </div>
    );
}

function UniformNodeComponent({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const {
        shaderRef,
        uniformOverrides,
        shaderOptions,
        getShaderMeta,
        onChange,
        onDelete,
    } = data;
    const meta: ShaderMetaData | null = shaderRef ? getShaderMeta(shaderRef) : null;

    return (
        <div className={`min-w-[220px] max-w-[260px] p-3 rounded shadow border ${selected ? 'border-purple-400 bg-gray-800' : 'border-purple-600 bg-gray-800'} ${data.active ? 'ring-2 ring-emerald-400' : ''} text-gray-100`}>
            <Handle type="target" position={Position.Left} id="in" />
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-purple-300">Set Uniforms</div>
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(id); }} className="p-1 text-gray-500 hover:text-red-400" title="Delete node">
                    <TrashIcon className="w-3 h-3" />
                </button>
            </div>
            <div className="text-[10px] text-gray-400 mb-2">Updates the target shader&apos;s saved values when reached. Does not switch shaders.</div>
            <select
                aria-label="Target shader"
                value={shaderRef || ''}
                onChange={(e) => onChange(id, { shaderRef: e.target.value || undefined, uniformOverrides: {} })}
                className="w-full mb-2 px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
            >
                <option value="">-- select target shader --</option>
                {shaderOptions.map((opt: ShaderOptionItem) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
            </select>
            {meta?.customUniforms && meta.customUniforms.length > 0 ? (
                <div className="mt-2 space-y-1 border-t border-gray-700 pt-2">
                    <UniformOverrides
                        uniforms={meta.customUniforms}
                        values={uniformOverrides}
                        onChange={values => onChange(id, { uniformOverrides: values })}
                    />
                </div>
            ) : (
                <div className="text-[10px] text-gray-500 italic mt-1">No custom uniforms on this shader.</div>
            )}
            <Handle type="source" position={Position.Right} id="out" />
        </div>
    );
}

function OverlayNodeComponent({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const overlayOptions = React.useContext(OverlayOptionsContext);
    const {
        shaderRef,
        overlayAction = 'show',
        overlayOpacity = 1,
        overlayBlendMode = 'additive',
        durationSeconds,
        onChange,
        onDelete,
    } = data;

    return (
        <div className={`min-w-[220px] max-w-[260px] p-3 rounded shadow border ${selected ? 'border-cyan-400 bg-gray-800' : 'border-cyan-600 bg-gray-800'} ${data.active ? 'ring-2 ring-emerald-400' : ''} text-gray-100`}>
            <Handle type="target" position={Position.Left} id="in" />
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-cyan-300">Overlay</div>
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(id); }} className="p-1 text-gray-500 hover:text-red-400" title="Delete node">
                    <TrashIcon className="w-3 h-3" />
                </button>
            </div>
            <div className="nodrag nopan">
                <select
                    aria-label="Overlay action"
                    value={overlayAction}
                    onChange={(e) => onChange(id, { overlayAction: e.target.value as 'show' | 'hide' })}
                    className="w-full mb-2 px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                >
                    <option value="show">Show overlay</option>
                    <option value="hide">Hide overlay</option>
                </select>
                {overlayAction === 'show' && (
                    <>
                        <select
                            aria-label="Overlay shader"
                            value={shaderRef || ''}
                            onChange={(e) => onChange(id, { shaderRef: e.target.value || undefined })}
                            className="w-full mb-2 px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                        >
                            <option value="">-- select overlay shader --</option>
                            {overlayOptions.map((opt: ShaderOptionItem) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                            {shaderRef && !overlayOptions.some(o => o.id === shaderRef) && (
                                <option value={shaderRef}>{shaderRef} (not flagged)</option>
                            )}
                        </select>
                        {overlayOptions.length === 0 && (
                            <div className="text-[10px] text-gray-500 italic mb-2">No overlay shaders yet — mark shaders as overlay in the Shaders tab.</div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            <label className="text-[10px] text-gray-400 whitespace-nowrap">Opacity</label>
                            <input
                                type="number"
                                aria-label="Overlay opacity"
                                min={0}
                                max={1}
                                step={0.05}
                                value={overlayOpacity}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    onChange(id, { overlayOpacity: isNaN(val) ? 1 : Math.min(1, Math.max(0, val)) });
                                }}
                                className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <label className="text-[10px] text-gray-400 whitespace-nowrap">Blend</label>
                            <select
                                aria-label="Blend mode"
                                value={overlayBlendMode}
                                onChange={(e) => onChange(id, { overlayBlendMode: e.target.value as 'additive' | 'normal' })}
                                className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                            >
                                <option value="additive">Additive</option>
                                <option value="normal">Normal (alpha)</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <label className="text-[10px] text-gray-400 whitespace-nowrap">Duration (s)</label>
                            <input
                                type="number"
                                step={0.1}
                                min={0}
                                value={durationSeconds ?? ''}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    onChange(id, { durationSeconds: isNaN(val) ? undefined : val });
                                }}
                                className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                                placeholder="auto-advance"
                                title="Advance after this duration unless an outgoing trigger fires earlier."
                            />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">Single pass; buffer passes are ignored.</div>
                    </>
                )}
                <div className="flex gap-2 mt-2">
                    <button
                        disabled={overlayAction === 'hide' || !shaderRef}
                        onClick={(e) => { e.stopPropagation(); browser.runtime.sendMessage({ command: 'SCENE_OVERLAY_PREVIEW', shaderRef, opacity: overlayOpacity, blendMode: overlayBlendMode }).catch(() => {}); }}
                        className="px-2 py-0.5 rounded text-[10px] bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-default"
                        title="Preview this overlay on the running visualizer"
                    >Preview</button>
                    <button
                        onClick={(e) => { e.stopPropagation(); browser.runtime.sendMessage({ command: 'SCENE_OVERLAY_PREVIEW', shaderRef: null }).catch(() => {}); }}
                        className="px-2 py-0.5 rounded text-[10px] bg-gray-700 hover:bg-gray-600"
                        title="Hide the current overlay"
                    >Hide</button>
                </div>
            </div>
            <Handle type="source" position={Position.Right} id="out" />
        </div>
    );
}

function conditionLabel(condition?: SceneCondition): string {
    if (!condition) return 'condition';
    switch (condition.kind) {
        case 'audio': return `audio ${condition.operator} ${condition.value}`;
        case 'time': return `time ≥ ${condition.seconds}s`;
        case 'beat': return `beats ≥ ${condition.count}`;
        case 'uniform': return `uniform ${condition.name} ${condition.operator} ${condition.value}`;
        case 'random': return `random ${condition.probability * 100}%`;
        default: return 'unknown';
    }
}

function ConditionNodeComponent({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const { condition, onChange, onDelete } = data;
    const kind = condition?.kind || 'audio';

    const setKind = (newKind: SceneCondition['kind']) => {
        let next: SceneCondition;
        switch (newKind) {
            case 'audio': next = { kind: 'audio', operator: '>=', value: 40 }; break;
            case 'time': next = { kind: 'time', seconds: 1 }; break;
            case 'beat': next = { kind: 'beat', count: 1 }; break;
            case 'uniform': next = { kind: 'uniform', name: '', operator: '==', value: 1 }; break;
            case 'random': next = { kind: 'random', probability: 0.5 }; break;
        }
        onChange(id, { condition: next });
    };

    return (
        <div className={`relative min-w-[220px] max-w-[280px] p-3 rounded shadow border ${selected ? 'border-yellow-400 bg-gray-800' : 'border-yellow-600 bg-gray-800'} ${data.active ? 'ring-2 ring-emerald-400' : ''} text-gray-100`}>
            <Handle type="target" position={Position.Left} id="in" />
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-yellow-300">If / Else</div>
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(id); }} className="p-1 text-gray-500 hover:text-red-400" title="Delete node">
                    <TrashIcon className="w-3 h-3" />
                </button>
            </div>
            <div className="text-[10px] text-gray-400 mb-1">{conditionLabel(condition)}</div>
            <select
                value={kind}
                onChange={(e) => setKind(e.target.value as SceneCondition['kind'])}
                className="w-full mb-2 px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
            >
                <option value="audio">Audio level</option>
                <option value="time">Time elapsed</option>
                <option value="beat">Beat count</option>
                <option value="uniform">Uniform value</option>
                <option value="random">Random</option>
            </select>
            {kind === 'audio' && (
                <div className="space-y-1">
                    <select
                        value={condition?.kind === 'audio' ? condition.operator : '>='}
                        onChange={(e) => onChange(id, { condition: { ...condition, kind: 'audio', operator: e.target.value as any } })}
                        className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                    >
                        <option value=">">&gt;</option>
                        <option value=">=">&ge;</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&le;</option>
                    </select>
                    <input
                        type="number"
                        value={condition?.kind === 'audio' ? condition.value : 40}
                        onChange={(e) => onChange(id, { condition: { ...condition, kind: 'audio', operator: condition?.kind === 'audio' ? condition.operator : '>=', value: parseFloat(e.target.value) || 0 } })}
                        className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                        placeholder="threshold"
                    />
                </div>
            )}
            {kind === 'time' && (
                <input
                    type="number"
                    step={0.1}
                    value={condition?.kind === 'time' ? condition.seconds : 1}
                    onChange={(e) => onChange(id, { condition: { ...condition, kind: 'time', seconds: parseFloat(e.target.value) || 0 } })}
                    className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                    placeholder="seconds"
                />
            )}
            {kind === 'beat' && (
                <input
                    type="number"
                    min={1}
                    value={condition?.kind === 'beat' ? condition.count : 1}
                    onChange={(e) => onChange(id, { condition: { ...condition, kind: 'beat', count: parseInt(e.target.value) || 1 } })}
                    className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                    placeholder="beats"
                />
            )}
            {kind === 'uniform' && (
                <div className="space-y-1">
                    <input
                        type="text"
                        value={condition?.kind === 'uniform' ? condition.name : ''}
                        onChange={(e) => onChange(id, { condition: { ...condition, kind: 'uniform', name: e.target.value, operator: condition?.kind === 'uniform' ? condition.operator : '==', value: condition?.kind === 'uniform' ? condition.value : 0 } })}
                        className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                        placeholder="uniform name"
                    />
                    <select
                        value={condition?.kind === 'uniform' ? condition.operator : '=='}
                        onChange={(e) => onChange(id, { condition: { ...condition, kind: 'uniform', name: condition?.kind === 'uniform' ? condition.name : '', operator: e.target.value as any, value: condition?.kind === 'uniform' ? condition.value : 0 } })}
                        className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                    >
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value=">=">&ge;</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&le;</option>
                    </select>
                    <input
                        type="text"
                        value={condition?.kind === 'uniform' ? String(condition.value) : ''}
                        onChange={(e) => onChange(id, { condition: { ...condition, kind: 'uniform', name: condition?.kind === 'uniform' ? condition.name : '', operator: condition?.kind === 'uniform' ? condition.operator : '==', value: e.target.value } })}
                        className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                        placeholder="value"
                    />
                </div>
            )}
            {kind === 'random' && (
                <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={condition?.kind === 'random' ? Math.round(condition.probability * 100) : 50}
                    onChange={(e) => onChange(id, { condition: { ...condition, kind: 'random', probability: (parseInt(e.target.value) || 0) / 100 } })}
                    className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-white"
                    placeholder="probability %"
                />
            )}
            <span className="absolute right-0 -translate-y-1/2 text-[9px] text-gray-400 pr-1" style={{ top: '60%' }}>false</span>
            <Handle type="source" position={Position.Right} id="false" style={{ top: '60%' }} />
            <span className="absolute right-0 -translate-y-1/2 text-[9px] text-gray-400 pr-1" style={{ top: '80%' }}>true</span>
            <Handle type="source" position={Position.Right} id="true" style={{ top: '80%' }} />
        </div>
    );
}

const nodeTypes = {
    start: StartNode,
    scene: SceneNodeComponent,
    uniform: UniformNodeComponent,
    condition: ConditionNodeComponent,
    overlay: OverlayNodeComponent,
};

interface SceneEditorProps {
    shaderCatalog: ShaderCatalog;
}

export default function SceneEditor({ shaderCatalog }: SceneEditorProps) {
    const [scenes, setScenes] = useState<SceneGraph[]>([]);
    const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    // The scene the background controller is actually running (may differ from the editor selection).
    const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
    const [importedShaders, setImportedShaders] = useState<ImportedShader[]>([]);
    const [customShaders, setCustomShaders] = useState<CustomShader[]>([]);
    const [editedShaders, setEditedShaders] = useState<Record<string, ShaderObject>>({});
    const [editedImported, setEditedImported] = useState<Record<string, ShaderObject>>({});
    const [builtinMeta, setBuiltinMeta] = useState<Record<string, ShaderMetaData>>({});
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
    // Transport state: shader-clock freeze (video-style pause) and graph hold
    const [clockPaused, setClockPaused] = useState(false);
    const [sceneHold, setSceneHold] = useState(false);
    // Live shader clock reported by the visualizer via SCENE_TICK
    const [currentTime, setCurrentTime] = useState(0);
    // Optional ring on the node the engine is currently sitting on
    const [highlightActive, setHighlightActive] = useState(false);
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const pendingActiveNodeRef = useRef<string | null>(null);
    const activeNodeRafRef = useRef<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Per-row "map this scene to a MIDI pad / joystick button" learn state
    const [midiEnabled] = useChromeStorageLocal(SETTINGS_MIDI_ENABLED, false);
    const [midiMappings, setMidiMappings] = useChromeStorageLocal<MidiMappings>(SETTINGS_MIDI_MAPPINGS, []);
    const [joystickEnabled] = useChromeStorageLocal(SETTINGS_JOYSTICK_ENABLED, false);
    const [joystickMappings, setJoystickMappings] = useChromeStorageLocal<JoystickMappings>(SETTINGS_JOYSTICK_MAPPINGS, []);
    const [learningSceneId, setLearningSceneId] = useState<string | null>(null);
    const sceneLearnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scenesRef = useRef<SceneGraph[]>(scenes);
    useEffect(() => { scenesRef.current = scenes; }, [scenes]);
    const learningSceneIdRef = useRef<string | null>(null);
    useEffect(() => { learningSceneIdRef.current = learningSceneId; }, [learningSceneId]);

    const stopSceneLearn = () => {
        setLearningSceneId(null);
        if (sceneLearnTimeoutRef.current) clearTimeout(sceneLearnTimeoutRef.current);
    };

    const startSceneLearn = (sceneId: string) => {
        if (!midiEnabled && !joystickEnabled) {
            setNotification({ message: 'Enable MIDI or Joystick in the MIDI & Joystick tab first', type: 'info' });
            return;
        }
        setLearningSceneId(sceneId);
        if (sceneLearnTimeoutRef.current) clearTimeout(sceneLearnTimeoutRef.current);
        sceneLearnTimeoutRef.current = setTimeout(() => setLearningSceneId(null), 8000);
    };

    // Subscribe to MIDI + joystick events while a scene row is in learn mode.
    // The first qualifying event creates a playScene:<id> mapping, replacing any
    // existing mapping for that target.
    useEffect(() => {
        if (learningSceneId === null) return;
        let midiSvc: typeof import('@src/helpers/midiService') | undefined;
        let joySvc: typeof import('@src/helpers/joystickService') | undefined;

        const midiHandler = (evt: MidiEvent) => {
            const sceneId = learningSceneIdRef.current;
            if (!sceneId) return;
            if (evt.type !== 'noteon' && evt.type !== 'cc') return;
            const scene = scenesRef.current.find(s => s.id === sceneId);
            const source: MidiMappingSource = {
                type: evt.type === 'cc' ? 'cc' : 'noteon',
                channel: evt.channel,
                number: evt.number,
                inputId: evt.inputId,
            };
            const mapping: MidiMapping = {
                id: `midi_${Date.now()}`,
                label: `Play scene: ${scene?.name ?? sceneId}`,
                source,
                target: `playScene:${sceneId}`,
                min: 0,
                max: 127,
            };
            setMidiMappings(prev => [...(prev || []).filter(m => m.target !== `playScene:${sceneId}`), mapping]);
            stopSceneLearn();
        };

        const joyHandler = (evt: JoystickEvent) => {
            const sceneId = learningSceneIdRef.current;
            if (!sceneId) return;
            if (evt.type !== 'button_down') return; // ignore axis noise
            const scene = scenesRef.current.find(s => s.id === sceneId);
            const source: JoystickMappingSource = {
                type: 'button',
                gamepadIndex: evt.gamepadIndex,
                index: evt.index,
                gamepadId: evt.gamepadId,
            };
            const mapping: JoystickMapping = {
                id: `joy_${Date.now()}`,
                label: `Play scene: ${scene?.name ?? sceneId}`,
                source,
                target: `playScene:${sceneId}`,
                min: 0,
                max: 1,
            };
            setJoystickMappings(prev => [...(prev || []).filter(m => m.target !== `playScene:${sceneId}`), mapping]);
            stopSceneLearn();
        };

        if (midiEnabled) {
            import('@src/helpers/midiService').then(s => { midiSvc = s; s.subscribe(midiHandler); });
        }
        if (joystickEnabled) {
            import('@src/helpers/joystickService').then(s => { joySvc = s; s.subscribe(joyHandler); });
        }
        return () => {
            if (midiSvc) midiSvc.unsubscribe(midiHandler);
            if (joySvc) joySvc.unsubscribe(joyHandler);
        };
    }, [learningSceneId, midiEnabled, joystickEnabled]);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const lastSyncedSceneIdRef = useRef<string | null>(null);
    const lastSavedJsonRef = useRef<string | null>(null);

    const shaderOptions: ShaderOptionItem[] = useMemo(() => {
        const list: ShaderOptionItem[] = [];
        for (const s of shaderCatalog.shaders) {
            list.push({ id: s.shaderName, label: s.metaData?.shaderName || s.shaderName, kind: 'builtin' });
        }
        for (const imp of importedShaders) {
            list.push({ id: imp.id, label: imp.name || imp.id, kind: 'imported' });
        }
        for (const c of customShaders) {
            list.push({ id: c.id, label: c.metaData?.shaderName || c.shaderName, kind: 'custom' });
        }
        return list;
    }, [shaderCatalog, importedShaders, customShaders]);

    const getShaderMeta = useCallback((shaderRef: string): ShaderMetaData | null => {
        const builtin = shaderCatalog.shaders.find(s => s.shaderName === shaderRef);
        if (builtin) return builtinMeta[shaderRef] || builtin.metaData || null;
        const imp = importedShaders.find(i => i.id === shaderRef);
        if (imp) return imp.mainShader.meta as any;
        const custom = customShaders.find(c => c.id === shaderRef);
        if (custom) return custom.metaData || null;
        return null;
    }, [shaderCatalog, builtinMeta, importedShaders, customShaders]);

    const [userShaderOptions] = useChromeStorageLocal<ShaderOptions>(SETTINGS_SHADEROPTIONS, {});
    const overlayOptions = useMemo(
        () => shaderOptions.filter(o => isOverlayShader(o.id, getShaderMeta(o.id), userShaderOptions)),
        [shaderOptions, getShaderMeta, userShaderOptions]);

    // Load external data (extracted so it can be re-run after a scene import,
    // which may have added imported/custom shaders and edits)
    const loadExternalData = useCallback(async () => {
        const [scenesData, activeId, playing, customData, paused, hold, edited, editedImp] = await Promise.all([
            browser.storage.local.get(STATE_SCENES).then(r => r[STATE_SCENES] || []),
            browser.storage.local.get(STATE_ACTIVE_SCENE_ID).then(r => r[STATE_ACTIVE_SCENE_ID] || null),
            browser.storage.local.get(STATE_SCENE_PLAYING).then(r => !!r[STATE_SCENE_PLAYING]),
            browser.storage.local.get('state.customshaders').then(r => r['state.customshaders'] || []),
            browser.storage.local.get(STATE_SCENE_CLOCK_PAUSED).then(r => !!r[STATE_SCENE_CLOCK_PAUSED]),
            browser.storage.local.get(STATE_SCENE_HOLD).then(r => !!r[STATE_SCENE_HOLD]),
            getAllEditedShaders(),
            browser.storage.local.get('state.editedimported').then(r => r['state.editedimported'] || {}),
        ]);
        setClockPaused(paused);
        setSceneHold(hold);
        const importedResponse = await browser.runtime.sendMessage({ command: 'GET_IMPORTED_SHADERS' });
        setScenes(scenesData);
        setActiveSceneId(activeId);
        setIsPlaying(playing);
        setPlayingSceneId(playing ? activeId : null);
        setCustomShaders(customData);
        setEditedShaders(edited);
        setEditedImported(editedImp);
        setImportedShaders(importedResponse?.data?.shaders || []);

        // Pre-load built-in shader metadata for uniform override UI
        const meta: Record<string, ShaderMetaData> = {};
        await Promise.all(shaderCatalog.shaders.map(async (s) => {
            try {
                const res = await fetch(`/shaders/${s.shaderName}.meta`);
                if (res.ok) meta[s.shaderName] = await res.json();
            } catch {
                // ignore
            }
        }));
        setBuiltinMeta(meta);
    }, [shaderCatalog]);

    useEffect(() => {
        loadExternalData();
    }, [loadExternalData]);

    // Mirror playback state written by other surfaces (background controller, popup).
    useEffect(() => {
        const handler = async (changes: Record<string, browser.Storage.StorageChange>, area: string) => {
            if (area !== 'local') return;
            if (changes[SETTINGS_SCENE_HIGHLIGHT_ACTIVE]) {
                setHighlightActive(!!changes[SETTINGS_SCENE_HIGHLIGHT_ACTIVE].newValue);
            }
            if (!changes[STATE_SCENE_PLAYING] && !changes[STATE_ACTIVE_SCENE_ID] && !changes[STATE_SCENE_CLOCK_PAUSED] && !changes[STATE_SCENE_HOLD]) return;
            const r = await browser.storage.local.get([STATE_SCENE_PLAYING, STATE_ACTIVE_SCENE_ID, STATE_SCENE_CLOCK_PAUSED, STATE_SCENE_HOLD]);
            const playing = !!r[STATE_SCENE_PLAYING];
            setIsPlaying(playing);
            setPlayingSceneId(playing ? (r[STATE_ACTIVE_SCENE_ID] || null) : null);
            setClockPaused(!!r[STATE_SCENE_CLOCK_PAUSED]);
            setSceneHold(!!r[STATE_SCENE_HOLD]);
        };
        browser.storage.onChanged.addListener(handler);
        return () => browser.storage.onChanged.removeListener(handler);
    }, []);

    // Highlight-active-node: subscribe to the controller's node writes only
    // while the setting is on; updates are coalesced to one per animation
    // frame so rapid transitions can't flood React.
    useEffect(() => {
        browser.storage.local.get(SETTINGS_SCENE_HIGHLIGHT_ACTIVE)
            .then(r => setHighlightActive(!!r[SETTINGS_SCENE_HIGHLIGHT_ACTIVE]))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!highlightActive) return;
        let disposed = false;
        const apply = () => {
            activeNodeRafRef.current = 0;
            if (!disposed) setActiveNodeId(pendingActiveNodeRef.current);
        };
        const update = (id: string | null) => {
            pendingActiveNodeRef.current = id;
            if (!activeNodeRafRef.current) activeNodeRafRef.current = requestAnimationFrame(apply);
        };
        browser.storage.local.get(STATE_SCENE_CURRENT_NODE_ID)
            .then(r => update(r[STATE_SCENE_CURRENT_NODE_ID] || null))
            .catch(() => {});
        const handler = (changes: Record<string, any>, area: string) => {
            if (area === 'local' && changes[STATE_SCENE_CURRENT_NODE_ID]) {
                update(changes[STATE_SCENE_CURRENT_NODE_ID].newValue || null);
            }
        };
        browser.storage.onChanged.addListener(handler);
        return () => {
            disposed = true;
            if (activeNodeRafRef.current) cancelAnimationFrame(activeNodeRafRef.current);
            browser.storage.onChanged.removeListener(handler);
            setActiveNodeId(null);
        };
    }, [highlightActive]);

    const currentScene = useMemo(() => scenes.find(s => s.id === activeSceneId) || null, [scenes, activeSceneId]);

    // The scene the background controller is actually playing (drives which
    // clock field the timeline shows)
    const playingScene = useMemo(() => scenes.find(s => s.id === playingSceneId) || null, [scenes, playingSceneId]);

    // Live shader clock: the content page broadcasts SCENE_TICK every ~100ms to
    // all extension contexts while a scene is playing.
    useEffect(() => {
        const handler = (msg: any) => {
            if (msg?.command !== 'SCENE_TICK') return;
            const source = playingScene?.timeSource ?? 'auto';
            const v = source === 'iTime' ? msg.iTime : source === 'iAmplifiedTime' ? msg.iAmplifiedTime : msg.time;
            if (typeof v === 'number' && isFinite(v)) setCurrentTime(v);
        };
        browser.runtime.onMessage.addListener(handler);
        return () => browser.runtime.onMessage.removeListener(handler);
    }, [playingScene]);

    const syncGraphToScene = useCallback((scene: SceneGraph) => {
        const rfNodes: Node[] = scene.nodes.map(n => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: {
                ...n.data,
                shaderOptions,
                getShaderMeta,
                onChange: (id: string, partial: any) => {
                    setNodes(prev => prev.map(node =>
                        node.id === id ? { ...node, data: { ...node.data, ...partial } } : node
                    ));
                },
                onDelete: removeNode,
            },
        }));
        const rfEdges: Edge[] = scene.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            label: triggerLabel(e.trigger),
            data: { trigger: e.trigger },
        }));
        setNodes(rfNodes);
        setEdges(rfEdges);
        lastSavedJsonRef.current = JSON.stringify({ nodes: scene.nodes, edges: scene.edges });
    }, [shaderOptions, getShaderMeta, setNodes, setEdges]);

    // When the active scene selection changes, load its graph into the canvas.
    // Avoid re-syncing when the same scene is updated by our own save.
    useEffect(() => {
        if (!activeSceneId) {
            if (scenes.length > 0) {
                setActiveSceneId(scenes[0].id);
            } else {
                setNodes([]);
                setEdges([]);
            }
            return;
        }
        if (lastSyncedSceneIdRef.current === activeSceneId) return;
        const scene = scenes.find(s => s.id === activeSceneId);
        if (scene) {
            syncGraphToScene(scene);
            lastSyncedSceneIdRef.current = activeSceneId;
        }
    }, [activeSceneId, scenes, syncGraphToScene, setNodes, setEdges]);

    const saveCurrentScene = useCallback(async () => {
        if (!currentScene) return;
        const graphNodes: SceneNode[] = nodes.map(n => {
            const data = n.data as any;
            return {
                id: n.id,
                type: n.type as SceneNode['type'],
                position: n.position,
                data: {
                    label: data?.label,
                    shaderRef: data?.shaderRef,
                    uniformOverrides: data?.uniformOverrides,
                    durationSeconds: data?.durationSeconds,
                    condition: data?.condition,
                    overlayAction: data?.overlayAction,
                    overlayOpacity: data?.overlayOpacity,
                    overlayBlendMode: data?.overlayBlendMode,
                },
            };
        });
        const graphEdges: SceneEdge[] = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? undefined,
            targetHandle: e.targetHandle ?? undefined,
            trigger: (e.data as any)?.trigger || defaultTimeTrigger(),
        }));
        const serialized = JSON.stringify({ nodes: graphNodes, edges: graphEdges });
        if (serialized === lastSavedJsonRef.current) return;
        lastSavedJsonRef.current = serialized;
        const updated: SceneGraph = { ...currentScene, nodes: graphNodes, edges: graphEdges };
        const nextScenes = scenes.map(s => s.id === updated.id ? updated : s);
        setScenes(nextScenes);
        await setStorage(STATE_SCENES, nextScenes);
    }, [currentScene, nodes, edges, scenes]);

    // Persist graph changes (debounced)
    useEffect(() => {
        if (!currentScene) return;
        const timer = setTimeout(() => {
            saveCurrentScene();
        }, 500);
        return () => clearTimeout(timer);
    }, [nodes, edges, currentScene, saveCurrentScene]);

    const createScene = async () => {
        const startId = generateId();
        const sceneId = generateId();
        const newScene: SceneGraph = {
            id: sceneId,
            name: `Scene ${scenes.length + 1}`,
            isLooping: false,
            timeSource: 'auto',
            timelineSeconds: 180,
            nodes: [
                { id: startId, type: 'start', position: { x: 50, y: 150 }, data: {} },
            ],
            edges: [],
        };
        const next = [...scenes, newScene];
        setScenes(next);
        setActiveSceneId(sceneId);
        await setStorage(STATE_SCENES, next);
    };

    const renameScene = async (id: string, name: string) => {
        const next = scenes.map(s => s.id === id ? { ...s, name } : s);
        setScenes(next);
        await setStorage(STATE_SCENES, next);
    };

    const deleteScene = async (id: string) => {
        const next = scenes.filter(s => s.id !== id);
        setScenes(next);
        if (isPlaying && playingSceneId === id) {
            setIsPlaying(false);
            setPlayingSceneId(null);
            await setStorage(STATE_SCENE_PLAYING, false);
        }
        if (activeSceneId === id) {
            const nextActive = next.length > 0 ? next[0].id : null;
            setActiveSceneId(nextActive);
        }
        await setStorage(STATE_SCENES, next);
    };

    const toggleLoop = async () => {
        if (!currentScene) return;
        const next = scenes.map(s => s.id === currentScene.id ? { ...s, isLooping: !s.isLooping } : s);
        setScenes(next);
        await setStorage(STATE_SCENES, next);
    };

    const setTimeSource = async (timeSource: SceneTimeSource) => {
        if (!currentScene) return;
        const next = scenes.map(s => s.id === currentScene.id ? { ...s, timeSource } : s);
        setScenes(next);
        await setStorage(STATE_SCENES, next);
    };

    /**
     * Start the selected scene. 'reset' rewinds the visualizer's shader clock
     * (iTime / iAmplifiedTime) to 0 first; 'keep' continues from the current time.
     * If/Else time conditions compare against that shader clock directly.
     */
    const playScene = async (scene: SceneGraph, mode: ScenePlayMode) => {
        const alreadyPlayingThisScene = isPlaying && playingSceneId === scene.id;
        // Starting playback also unfreezes the clock transport
        await setStorage(STATE_SCENE_CLOCK_PAUSED, false);
        sendMediaControl('play');
        setIsPlaying(true);
        setPlayingSceneId(scene.id);
        setActiveSceneId(scene.id);
        await setStorage(STATE_SCENE_PLAY_MODE, mode);
        if (alreadyPlayingThisScene) {
            // Storage keys won't change, so tell the controller to restart explicitly.
            browser.runtime.sendMessage({ command: 'SCENE_RESTART', mode }).catch(() => {});
            return;
        }
        // One write so the background controller's listener sees both keys in
        // a single change event (avoids a stale fallback on the second event).
        await setStorageMany({ [STATE_ACTIVE_SCENE_ID]: scene.id, [STATE_SCENE_PLAYING]: true });
    };

    const pause = async () => {
        setIsPlaying(false);
        setPlayingSceneId(null);
        await setStorage(STATE_SCENE_PLAYING, false);
    };

    // Transport bar actions. MEDIA_CONTROL is sent unconditionally — the
    // background drops it when there is no mapped source tab, and the mediaSync
    // content script ignores it when the track-sync setting is off.
    const sendMediaControl = (action: 'seek' | 'pause' | 'play', time?: number) => {
        browser.runtime.sendMessage({ type: MEDIA_CONTROL, action, time }).catch(() => {});
    };

    const pauseClock = async () => {
        await setStorage(STATE_SCENE_CLOCK_PAUSED, true);
        sendMediaControl('pause');
    };

    const resumeClock = async () => {
        await setStorage(STATE_SCENE_CLOCK_PAUSED, false);
        sendMediaControl('play');
    };

    const stop = async () => {
        await setStorage(STATE_SCENE_CLOCK_PAUSED, false);
        await pause();
    };

    const toggleHold = async () => {
        await setStorage(STATE_SCENE_HOLD, !sceneHold);
    };

    const setTimelineSeconds = async (seconds: number) => {
        if (!currentScene || !isFinite(seconds)) return;
        const clamped = Math.max(10, seconds);
        const next = scenes.map(s => s.id === currentScene.id ? { ...s, timelineSeconds: clamped } : s);
        setScenes(next);
        await setStorage(STATE_SCENES, next);
    };

    const seek = (time: number) => {
        setCurrentTime(time);
        browser.runtime.sendMessage({ command: SET_TIME, time }).catch(() => {});
        sendMediaControl('seek', time);
        if (isPlaying) {
            browser.runtime.sendMessage({ command: 'SCENE_SEEK', time }).catch(() => {});
        }
    };

    // Credits for the sidebar — derived from the live React Flow nodes so
    // unsaved edits are reflected.
    const sceneCredits = useMemo(() => collectSceneCredits(
        nodes.map(n => ({ type: n.type, data: n.data })),
        (ref) => ({ meta: getShaderMeta(ref), label: shaderOptions.find(o => o.id === ref)?.label || ref }),
    ), [nodes, getShaderMeta, shaderOptions]);

    const copyCredits = async () => {
        try {
            await navigator.clipboard.writeText(formatCredits(sceneCredits));
            setNotification({ message: 'Credits copied', type: 'success' });
        } catch {
            setNotification({ message: 'Failed to copy credits', type: 'error' });
        }
    };

    const exportScene = async () => {
        if (!currentScene) {
            setNotification({ message: 'Select a scene to export', type: 'error' });
            return;
        }
        try {
            const { blob, missing } = await buildScenePackage(currentScene, {
                importedShaders,
                editedImported,
                customShaders,
                editedShaders,
                builtinShaderNames: shaderCatalog.shaders.map(s => s.shaderName),
                getImage: getImageDB,
                getVideo: getVideoDB,
                getCubemap: getCubemapDB,
                getVolume: getVolumeDB,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = currentScene.name.replace(/[^a-z0-9_-]+/gi, '_') || currentScene.id;
            a.download = `scene_${safeName}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            setNotification({
                message: missing.length > 0
                    ? `Exported "${currentScene.name}" (${missing.length} unresolved ref${missing.length === 1 ? '' : 's'})`
                    : `Exported "${currentScene.name}"`,
                type: 'success',
            });
        } catch (err) {
            setNotification({ message: 'Failed to export scene package', type: 'error' });
        }
    };

    const importScenePackageZip = async (file: File) => {
        const { manifest, zip } = await readScenePackage(file);
        const [imageList, videoList, cubemapList, volumeList] = await Promise.all([
            getAllImagesDB(), getAllVideosDB(), getAllCubemapsDB(), getAllVolumesDB(),
        ]);
        const { scene, summary } = await applyScenePackage(manifest, zip, {
            existingImages: Object.fromEntries(imageList.map(i => [i.id, i.size])),
            existingVideos: Object.fromEntries(videoList.map(v => [v.id, v.size])),
            existingCubemaps: Object.fromEntries(cubemapList.map(c => [c.id, c.size])),
            existingVolumes: Object.fromEntries(volumeList.map(v => [v.id, v.size])),
            addImage: addImageDB,
            addVideo: addVideoDB,
            addCubemap: addCubemapDB,
            addVolume: addVolumeDB,
            importedShaders,
            editedImported,
            customShaders,
            editedShaders,
            saveImported: async (shader) => {
                await saveImportedShaderDB(shader);
                await setStorage(STATE_IMPORTED_SHADERS, { lastModified: new Date().toISOString() });
            },
            saveEditedImported: saveEditedImportedShader,
            saveCustom: saveCustomShader,
            saveEditedBuiltin: saveEditedShader,
        }, scenes);
        const next = [...scenes, scene];
        setScenes(next);
        setActiveSceneId(scene.id);
        await setStorage(STATE_SCENES, next);
        // Refresh shader lists so the new entries show up in pickers/metadata
        await loadExternalData();
        setActiveSceneId(scene.id);
        const parts: string[] = [];
        if (summary.shadersAdded) parts.push(`${summary.shadersAdded} shader${summary.shadersAdded === 1 ? '' : 's'} added`);
        if (summary.shadersReused) parts.push(`${summary.shadersReused} reused`);
        if (summary.shadersCopied) parts.push(`${summary.shadersCopied} imported as copy`);
        if (summary.mediaAdded) parts.push(`${summary.mediaAdded} media added`);
        if (summary.mediaReused) parts.push(`${summary.mediaReused} media reused`);
        if (summary.mediaCopied) parts.push(`${summary.mediaCopied} media copied`);
        if (summary.missingRefs.length) parts.push(`${summary.missingRefs.length} missing ref${summary.missingRefs.length === 1 ? '' : 's'}`);
        setNotification({
            message: `Imported "${scene.name}"${parts.length ? ` — ${parts.join(', ')}` : ''}`,
            type: summary.missingRefs.length ? 'info' : 'success',
        });
    };

    const importScene = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (file.name.toLowerCase().endsWith('.zip')) {
            try {
                await importScenePackageZip(file);
            } catch (err) {
                setNotification({ message: `Failed to import scene package: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
            }
            return;
        }
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const scene: SceneGraph | undefined = parsed?.scene ?? parsed;
            if (!scene || typeof scene.id !== 'string' || typeof scene.name !== 'string' || !Array.isArray(scene.nodes) || !Array.isArray(scene.edges)) {
                setNotification({ message: 'Invalid scene JSON format', type: 'error' });
                return;
            }
            const imported: SceneGraph = {
                ...scene,
                id: scene.id && scenes.some(s => s.id === scene.id) ? generateId() : scene.id,
                isLooping: !!scene.isLooping,
                timeSource: scene.timeSource === 'iTime' || scene.timeSource === 'iAmplifiedTime' || scene.timeSource === 'auto'
                    ? scene.timeSource
                    : 'auto',
                timelineSeconds: typeof scene.timelineSeconds === 'number' && isFinite(scene.timelineSeconds) && scene.timelineSeconds >= 10
                    ? scene.timelineSeconds
                    : 180,
            };
            const next = [...scenes, imported];
            setScenes(next);
            setActiveSceneId(imported.id);
            await setStorage(STATE_SCENES, next);
            setNotification({ message: `Imported "${imported.name}"`, type: 'success' });
        } catch (err) {
            setNotification({ message: 'Failed to import scene JSON', type: 'error' });
        }
    };

    const removeNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
    };

    const addSceneNode = () => {
        const id = generateId();
        const newNode: Node = {
            id,
            type: 'scene',
            position: { x: 250, y: 150 + nodes.length * 20 },
            data: {
                shaderOptions,
                getShaderMeta,
                onChange: (nid: string, partial: any) => {
                    setNodes(prev => prev.map(node =>
                        node.id === nid ? { ...node, data: { ...node.data, ...partial } } : node
                    ));
                },
                onDelete: removeNode,
            },
        };
        setNodes(prev => [...prev, newNode]);
    };

    const addUniformNode = () => {
        const id = generateId();
        const newNode: Node = {
            id,
            type: 'uniform',
            position: { x: 250, y: 150 + nodes.length * 20 },
            data: {
                shaderOptions,
                getShaderMeta,
                onChange: (nid: string, partial: any) => {
                    setNodes(prev => prev.map(node =>
                        node.id === nid ? { ...node, data: { ...node.data, ...partial } } : node
                    ));
                },
                onDelete: removeNode,
            },
        };
        setNodes(prev => [...prev, newNode]);
    };

    const addOverlayNode = () => {
        const id = generateId();
        const newNode: Node = {
            id,
            type: 'overlay',
            position: { x: 250, y: 150 + nodes.length * 20 },
            data: {
                overlayAction: 'show',
                overlayOpacity: 1,
                overlayBlendMode: 'additive',
                getShaderMeta,
                onChange: (nid: string, partial: any) => {
                    setNodes(prev => prev.map(node =>
                        node.id === nid ? { ...node, data: { ...node.data, ...partial } } : node
                    ));
                },
                onDelete: removeNode,
            },
        };
        setNodes(prev => [...prev, newNode]);
    };

    const addConditionNode = () => {
        const id = generateId();
        const newNode: Node = {
            id,
            type: 'condition',
            position: { x: 250, y: 150 + nodes.length * 20 },
            data: {
                onChange: (nid: string, partial: any) => {
                    setNodes(prev => prev.map(node =>
                        node.id === nid ? { ...node, data: { ...node.data, ...partial } } : node
                    ));
                },
                onDelete: removeNode,
            },
        };
        setNodes(prev => [...prev, newNode]);
    };

    const onConnect = useCallback((connection: Connection) => {
        if (!connection.source || !connection.target) return;
        const edge: Edge = {
            id: generateId(),
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            label: triggerLabel(defaultTimeTrigger()),
            data: { trigger: defaultTimeTrigger() },
        };
        setEdges(prev => addEdge(edge, prev));
    }, [setEdges]);

    const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId), [edges, selectedEdgeId]);

    // Feed the active-node flag into node data for the ring highlight.
    const displayNodes = useMemo(() => nodes.map(n => ({ ...n, data: { ...n.data, active: n.id === activeNodeId } })), [nodes, activeNodeId]);

    const updateEdgeTrigger = (edgeId: string, trigger: SceneTrigger) => {
        setEdges(prev => prev.map(e => e.id === edgeId ? { ...e, data: { trigger }, label: triggerLabel(trigger) } : e));
    };

    return (
        <div className="flex w-full h-[calc(100vh-150px)] min-h-[500px] bg-gray-900 text-gray-100 border-t border-gray-800">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-700 flex flex-col p-3 gap-3 bg-gray-850">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-indigo-300">Scenes</h3>
                    <div className="flex gap-1">
                        <button onClick={createScene} className="p-1 rounded hover:bg-gray-700" title="New scene">
                            <PlusIcon className="w-4 h-4" />
                        </button>
                        <button onClick={exportScene} className="p-1 rounded hover:bg-gray-700" title="Export current scene (zip with shaders & media)">
                            <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="p-1 rounded hover:bg-gray-700" title="Import scene">
                            <ArrowUpTrayIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip,.json,application/zip,application/json"
                        onChange={importScene}
                        className="hidden"
                    />
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2">
                    {scenes.map(scene => {
                        const thisPlaying = isPlaying && playingSceneId === scene.id;
                        const iconColor = thisPlaying ? 'text-emerald-400' : 'text-gray-400';
                        const sceneTarget = `playScene:${scene.id}`;
                        const midiMap = (midiMappings || []).find(m => m.target === sceneTarget);
                        const joyMap = (joystickMappings || []).find(m => m.target === sceneTarget);
                        const isLearning = learningSceneId === scene.id;
                        const mapTitle = midiMap
                            ? `Mapped: MIDI ${midiMap.source.type.toUpperCase()} ch${midiMap.source.channel} ${midiMap.source.type === 'noteon' ? 'note' : 'cc'} ${midiMap.source.number}`
                            : joyMap
                                ? `Mapped: Gamepad ${joyMap.source.gamepadIndex} button ${joyMap.source.index}`
                                : 'Map to MIDI / joystick button';
                        return (
                        <div
                            key={scene.id}
                            onClick={() => setActiveSceneId(scene.id)}
                            className={`p-2 rounded cursor-pointer flex items-center justify-between ${activeSceneId === scene.id ? 'bg-indigo-900' : 'bg-gray-800 hover:bg-gray-700'}`}
                        >
                            <div className="flex gap-0.5 mr-1 flex-shrink-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); playScene(scene, 'reset'); }}
                                    className={`p-0.5 ${iconColor} hover:text-emerald-300`}
                                    title="Play from 0"
                                >
                                    <BackwardIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (thisPlaying && !clockPaused) pauseClock();
                                        else if (thisPlaying && clockPaused) resumeClock();
                                        else playScene(scene, 'keep');
                                    }}
                                    className={`p-0.5 ${iconColor} hover:text-emerald-300`}
                                    title={thisPlaying && !clockPaused ? 'Pause' : 'Play'}
                                >
                                    {thisPlaying && !clockPaused
                                        ? <PauseIcon className="w-3.5 h-3.5" />
                                        : <PlayIcon className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); stop(); }}
                                    disabled={!thisPlaying}
                                    className={`p-0.5 ${thisPlaying ? 'text-emerald-400 hover:text-red-400' : 'text-gray-600 cursor-default'}`}
                                    title="Stop"
                                >
                                    <StopIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); startSceneLearn(scene.id); }}
                                    className={`p-0.5 ${isLearning ? 'text-yellow-400 animate-pulse' : (midiMap || joyMap) ? 'text-emerald-400 hover:text-emerald-300' : 'text-gray-400 hover:text-gray-300'}`}
                                    title={isLearning ? 'Listening…' : mapTitle}
                                >
                                    <MusicalNoteIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {isLearning && <span className="text-[10px] text-yellow-300 mr-1 flex-shrink-0">Press a pad / button…</span>}
                            <input
                                value={scene.name}
                                onChange={(e) => renameScene(scene.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent text-sm flex-1 min-w-0 truncate outline-none"
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteScene(scene.id); }}
                                className="ml-2 p-1 text-gray-400 hover:text-red-400"
                                title="Delete scene"
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                        </div>
                        );
                    })}
                </div>
                {currentScene && (
                    <div className="border-t border-gray-700 pt-3 space-y-2">
                        <div className="flex gap-2">
                            <button onClick={toggleLoop} className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-sm ${currentScene.isLooping ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`} title="Loop scene">
                                <ArrowPathIcon className="w-4 h-4" /> Loop
                            </button>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Time source</div>
                            <select
                                value={currentScene.timeSource ?? 'auto'}
                                onChange={(e) => setTimeSource(e.target.value as SceneTimeSource)}
                                className="bg-gray-800 text-xs rounded px-2 py-1 w-full"
                                title="Which shader clock drives this scene's If/Else time conditions"
                            >
                                <option value="auto">Auto (renderer)</option>
                                <option value="iTime">iTime (real seconds)</option>
                                <option value="iAmplifiedTime">iAmplifiedTime (audio)</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer" title="Ring the node the playing scene is currently on">
                            <input
                                type="checkbox"
                                checked={highlightActive}
                                onChange={async (e) => {
                                    const on = e.target.checked;
                                    setHighlightActive(on);
                                    await setStorage(SETTINGS_SCENE_HIGHLIGHT_ACTIVE, on);
                                }}
                                className="accent-emerald-500"
                            />
                            Highlight active node
                        </label>
                        <div className="text-[10px] text-gray-400 text-center space-y-0.5">
                            <div>{currentScene.isLooping ? 'Loops to start when graph ends' : 'Stops when graph ends'}</div>
                            <div>If/Else time uses {TIME_SOURCE_LABELS[currentScene.timeSource ?? 'auto']}</div>
                            {isPlaying && playingSceneId === currentScene.id && (
                                <div className="text-green-400">Playing · time source: {TIME_SOURCE_LABELS[currentScene.timeSource ?? 'auto']}</div>
                            )}
                        </div>
                        {sceneCredits.length > 0 && (
                            <div className="border-t border-gray-700 pt-2 flex items-center justify-between gap-2">
                                <button
                                    onClick={copyCredits}
                                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                                    title="Copy shader credits as plain text"
                                >
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5" /> Copy credits
                                </button>
                                <span className="text-[10px] text-gray-400">{sceneCredits.length} shaders</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Canvas */}
            <div className="flex-1 flex flex-col">
                <SceneTransportBar
                    hasScene={!!currentScene}
                    isPlaying={isPlaying}
                    isThisPlaying={isPlaying && playingSceneId === currentScene?.id}
                    clockPaused={clockPaused}
                    sceneHold={sceneHold}
                    currentTime={currentTime}
                    timelineSeconds={currentScene?.timelineSeconds ?? 180}
                    onPlayFromZero={() => currentScene && playScene(currentScene, 'reset')}
                    onPlayOrResume={() => {
                        if (!currentScene) return;
                        if (isPlaying && playingSceneId === currentScene.id && clockPaused) resumeClock();
                        else playScene(currentScene, 'keep');
                    }}
                    onPauseClock={pauseClock}
                    onStop={stop}
                    onToggleHold={toggleHold}
                    onSeek={seek}
                    onTimelineSecondsChange={setTimelineSeconds}
                />
                <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-850">
                    <button onClick={addSceneNode} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm">
                        <PlusIcon className="w-4 h-4" /> Add Scene Node
                    </button>
                    <button onClick={addUniformNode} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm">
                        <PlusIcon className="w-4 h-4" /> Add Set Uniforms
                    </button>
                    <button onClick={addConditionNode} className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded text-sm">
                        <PlusIcon className="w-4 h-4" /> Add Condition
                    </button>
                    <button onClick={addOverlayNode} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 rounded text-sm">
                        <PlusIcon className="w-4 h-4" /> Overlay
                    </button>
                    <span className="text-xs text-gray-400 ml-2">Drag to connect nodes. New connections advance immediately; click an edge to set its timing or trigger.</span>
                </div>
                <div className="flex-1 relative">
                    {currentScene ? (
                        <OverlayOptionsContext.Provider value={overlayOptions}>
                        <ReactFlow
                            nodes={displayNodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            nodeTypes={nodeTypes}
                            onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}
                            onPaneClick={() => setSelectedEdgeId(null)}
                            deleteKeyCode={['Backspace', 'Delete']}
                            colorMode="dark"
                            proOptions={{ hideAttribution: true }}
                            fitView
                        >
                            <Background color="#4b5563" gap={16} />
                            <Controls />
                            <MiniMap
                                pannable
                                zoomable
                                nodeColor={(n) => MINIMAP_NODE_COLORS[n.type || ''] || '#6b7280'}
                                nodeStrokeWidth={2}
                            />
                        </ReactFlow>
                        </OverlayOptionsContext.Provider>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Create a scene to start building a shader switch graph.
                        </div>
                    )}
                </div>
            </div>

            {/* Notification toast */}
            {notification && (
                <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-sm z-50 ${notification.type === 'error' ? 'bg-red-600' : notification.type === 'success' ? 'bg-green-600' : 'bg-gray-700'}`}>
                    {notification.message}
                </div>
            )}

            {/* Edge properties */}
            {selectedEdge && (
                <div className="w-64 border-l border-gray-700 p-3 bg-gray-850">
                    <h4 className="font-bold text-indigo-300 mb-3">Transition Trigger</h4>
                    {(() => {
                        const trigger = (selectedEdge.data as any)?.trigger as SceneTrigger | undefined;
                        return (
                            <>
                                <select
                                    value={trigger?.type || 'time'}
                                    onChange={(e) => {
                                        const type = e.target.value as SceneTrigger['type'];
                                        let newTrigger: SceneTrigger;
                                        switch (type) {
                                            case 'time': newTrigger = { type, durationSeconds: 0 }; break;
                                            case 'beat': newTrigger = { type, beatCount: 4 }; break;
                                            case 'audio': newTrigger = { type, threshold: 30, holdSeconds: 0.2 }; break;
                                            case 'manual': newTrigger = { type }; break;
                                        }
                                        updateEdgeTrigger(selectedEdge.id, newTrigger);
                                    }}
                                    className="w-full mb-3 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white"
                                >
                                    <option value="time">Time (seconds)</option>
                                    <option value="beat">Beat count</option>
                                    <option value="audio">Audio threshold</option>
                                    <option value="manual">Manual</option>
                                </select>
                                {trigger?.type === 'time' && (
                                    <label className="block text-sm mb-2">
                                        Duration (s)
                                        <input
                                            type="number"
                                            step={0.1}
                                            min={0}
                                            value={(trigger as any).durationSeconds}
                                            onChange={(e) => updateEdgeTrigger(selectedEdge.id, { type: 'time', durationSeconds: parseFloat(e.target.value) || 0 })}
                                            className="w-full mt-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white"
                                        />
                                    </label>
                                )}
                                {trigger?.type === 'beat' && (
                                    <label className="block text-sm mb-2">
                                        Beats
                                        <input
                                            type="number"
                                            min={1}
                                            value={(trigger as any).beatCount}
                                            onChange={(e) => updateEdgeTrigger(selectedEdge.id, { type: 'beat', beatCount: parseInt(e.target.value) || 1 })}
                                            className="w-full mt-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white"
                                        />
                                    </label>
                                )}
                                {trigger?.type === 'audio' && (
                                    <>
                                        <label className="block text-sm mb-2">
                                            Threshold
                                            <input
                                                type="number"
                                                min={0}
                                                value={(trigger as any).threshold}
                                                onChange={(e) => updateEdgeTrigger(selectedEdge.id, { ...(trigger as any), threshold: parseFloat(e.target.value) || 0 })}
                                                className="w-full mt-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white"
                                            />
                                        </label>
                                        <label className="block text-sm">
                                            Hold (s)
                                            <input
                                                type="number"
                                                step={0.1}
                                                min={0}
                                                value={(trigger as any).holdSeconds ?? 0.2}
                                                onChange={(e) => updateEdgeTrigger(selectedEdge.id, { ...(trigger as any), holdSeconds: parseFloat(e.target.value) || 0 })}
                                                className="w-full mt-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white"
                                            />
                                        </label>
                                    </>
                                )}
                            </>
                        );
                    })()}
                    <button
                        onClick={() => setSelectedEdgeId(null)}
                        className="mt-4 w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}

async function setStorage(key: string, value: any) {
    await browser.storage.local.set({ [key]: value });
}
