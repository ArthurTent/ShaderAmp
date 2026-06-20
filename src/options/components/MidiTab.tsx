import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import browser from 'webextension-polyfill';
import {
    MusicalNoteIcon,
    PlusIcon,
    TrashIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { SETTINGS_MIDI_ENABLED, SETTINGS_MIDI_MAPPINGS, SETTINGS_JOYSTICK_ENABLED, SETTINGS_JOYSTICK_MAPPINGS, STATE_CURRENT_SHADER } from '@src/storage/storageConstants';
import { PREV_SHADER, NEXT_SHADER } from '@src/helpers/constants';
import type { MidiMapping, MidiMappings, MidiTarget, MidiMappingSource, ShaderUniform, JoystickMapping, JoystickMappings, JoystickTarget, JoystickMappingSource } from '@src/helpers/types';
import type { MidiInputInfo, MidiEvent } from '@src/helpers/midiService';
import type { JoystickInputInfo, JoystickEvent } from '@src/helpers/joystickService';

const ACTION_TARGETS: { value: MidiTarget; label: string }[] = [
    { value: 'none', label: '— None (unassigned) —' },
    { value: 'prevShader', label: 'Previous Shader' },
    { value: 'nextShader', label: 'Next Shader' },
    { value: 'resetTime', label: 'Reset Time' },
    { value: 'toggleRandomizeShaders', label: 'Toggle Randomize Shaders' },
    { value: 'randomizeBeat', label: 'Toggle Beat Randomize' },
    { value: 'randomizeTime', label: 'Randomize Time (knob, 0–60)' },
    { value: 'randomizeVariation', label: 'Randomize Variation (knob, 0–5)' },
    { value: 'randomizeBeatInterval', label: 'Beat Interval (knob, 1–255)' },
    { value: 'toggleShaderCredits', label: 'Toggle Shader Credits' },
    { value: 'toggleTabTitle', label: 'Toggle Tab Title' },
    { value: 'toggleFps', label: 'Toggle FPS Counter' },
    { value: 'toggleShaderFade', label: 'Toggle Shader Fade' },
    { value: 'toggleWebcam', label: 'Toggle Webcam Video' },
    { value: 'toggleWebcamAudio', label: 'Toggle Webcam Audio' },
    { value: 'toggleDisplayCapture', label: 'Toggle Screen/App Share' },
    { value: 'toggleEnableIAmplifiedTime', label: 'Toggle Enable iAmplifiedTime' },
    { value: 'renderScale', label: 'Render Resolution (knob → 6 presets)' },
    { value: 'speedDivider', label: 'Speed Divider (knob)' },
    { value: 'volumeAmplifier', label: 'Volume Amplifier (knob)' },
    { value: 'fftInject', label: 'Inject Note into FFT' },
];

const EQ_BAND_LABELS = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

const EQ_BAND_TARGETS: { value: MidiTarget; label: string }[] = EQ_BAND_LABELS.map((freq, i) => ({
    value: `eqBand:${i}` as MidiTarget,
    label: `EQ ${freq} (knob, -12..+12 dB)`,
}));

const DEFAULT_MAPPING: Omit<MidiMapping, 'id'> = {
    label: '',
    source: { type: 'cc', channel: 0, number: 0 },
    target: 'none',
    min: 0,
    max: 127,
    encoderMode: 'absolute',
};

const detectEncoderMode = (samples: number[]): 'absolute' | 'relative' => {
    if (samples.length === 0) return 'absolute';
    const allEdge = samples.every(v => v <= 10 || v >= 117);
    return allEdge ? 'relative' : 'absolute';
};

let midiServiceModule: typeof import('@src/helpers/midiService') | null = null;

const getMidiService = async () => {
    if (!midiServiceModule) {
        midiServiceModule = await import('@src/helpers/midiService');
    }
    return midiServiceModule;
};

export default function MidiTab() {
    const [midiEnabled, setMidiEnabled] = useChromeStorageLocal(SETTINGS_MIDI_ENABLED, false);
    const [mappings, setMappings] = useChromeStorageLocal<MidiMappings>(SETTINGS_MIDI_MAPPINGS, []);

    const [inputs, setInputs] = useState<MidiInputInfo[]>([]);
    const [midiStatus, setMidiStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const [learnTarget, setLearnTarget] = useState<string | null>(null);
    const [lastEvent, setLastEvent] = useState<MidiEvent | null>(null);
    const learnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const learnSamplesRef = useRef<number[]>([]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<Omit<MidiMapping, 'id'> | null>(null);

    // Mirror edit state into refs so the MIDI learn handler can read the
    // current draft (target/range) without stale closures.
    const editingIdRef = useRef<string | null>(null);
    const editDraftRef = useRef<Omit<MidiMapping, 'id'> | null>(null);
    useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
    useEffect(() => { editDraftRef.current = editDraft; }, [editDraft]);

    const [customUniforms, setCustomUniforms] = useState<ShaderUniform[]>([]);

    const loadUniformsFromShader = (shader: any) => {
        if (shader?.metaData?.customUniforms) {
            setCustomUniforms(shader.metaData.customUniforms as ShaderUniform[]);
        } else {
            setCustomUniforms([]);
        }
    };

    useEffect(() => {
        browser.storage.local.get(STATE_CURRENT_SHADER).then(result => {
            loadUniformsFromShader(result[STATE_CURRENT_SHADER]);
        });

        const handleStorageChange = (changes: Record<string, any>) => {
            if (changes[STATE_CURRENT_SHADER] !== undefined) {
                loadUniformsFromShader(changes[STATE_CURRENT_SHADER].newValue);
            }
        };
        browser.storage.onChanged.addListener(handleStorageChange);
        return () => browser.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const connectMidi = useCallback(async () => {
        setMidiStatus('connecting');
        setErrorMsg('');
        try {
            const svc = await getMidiService();
            const ok = await svc.initMidi();
            if (ok) {
                setInputs(svc.getMidiInputs());
                setMidiStatus('connected');
            } else {
                setMidiStatus('error');
                setErrorMsg('MIDI access denied. Allow MIDI access in browser permissions and try again.');
            }
        } catch (e) {
            setMidiStatus('error');
            setErrorMsg(String(e));
        }
    }, []);

    useEffect(() => {
        if (!midiEnabled) return;
        connectMidi();
    }, [midiEnabled]);

    useEffect(() => {
        if (midiStatus !== 'connected') return;
        let svc: typeof import('@src/helpers/midiService');
        const handler = (evt: MidiEvent) => {
            setLastEvent(evt);
            if (learnTarget !== null) {
                if (evt.type === 'cc') {
                    learnSamplesRef.current.push(evt.value);
                }
                if (learnSamplesRef.current.length < 3 && evt.type === 'cc') {
                    return;
                }
                const detectedMode = evt.type === 'cc'
                    ? detectEncoderMode(learnSamplesRef.current)
                    : 'absolute';
                const source: MidiMappingSource = {
                    type: evt.type === 'cc' ? 'cc' : 'noteon',
                    channel: evt.channel,
                    number: evt.number,
                    inputId: evt.inputId,
                };
                learnSamplesRef.current = [];
                setMappings(prev => {
                    const updated = (prev || []).map(m => {
                        if (m.id !== learnTarget) return m;
                        // Merge any in-progress edits (target/min/max/step) so the
                        // live mapping reflects the user's current Target selection,
                        // then apply the learned source. Without this, learning would
                        // operate on the saved (default) target.
                        const draft = (editingIdRef.current === learnTarget && editDraftRef.current)
                            ? editDraftRef.current
                            : {};
                        return { ...m, ...draft, source, encoderMode: detectedMode };
                    });
                    return updated;
                });
                // Keep the open edit form in sync so saveEdit doesn't overwrite
                // the learned source/encoderMode with the stale draft values.
                setEditDraft(d => d ? { ...d, source, encoderMode: detectedMode } : d);
                setLearnTarget(null);
                if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
            }
        };
        getMidiService().then(s => {
            svc = s;
            svc.subscribe(handler);
        });
        return () => {
            if (svc) svc.unsubscribe(handler);
        };
    }, [midiStatus, learnTarget]);

    const startLearn = (id: string) => {
        learnSamplesRef.current = [];
        setLearnTarget(id);
        if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
        learnTimeoutRef.current = setTimeout(() => { learnSamplesRef.current = []; setLearnTarget(null); }, 8000);
    };

    const addMapping = () => {
        const id = `midi_${Date.now()}`;
        const newMapping: MidiMapping = { id, ...DEFAULT_MAPPING };
        setMappings(prev => [newMapping, ...(prev || [])]);
        setEditingId(id);
        setEditDraft({ ...DEFAULT_MAPPING });
    };

    const deleteMapping = (id: string) => {
        setMappings(prev => (prev || []).filter(m => m.id !== id));
        if (editingId === id) { setEditingId(null); setEditDraft(null); }
    };

    const startEdit = (m: MidiMapping) => {
        setEditingId(m.id);
        setEditDraft({ label: m.label, source: { ...m.source }, target: m.target, min: m.min, max: m.max, encoderMode: m.encoderMode ?? 'absolute', buttonMode: m.buttonMode, step: m.step });
    };

    const saveEdit = () => {
        if (!editingId || !editDraft) return;
        setMappings(prev => (prev || []).map(m => m.id === editingId ? { ...m, ...editDraft } : m));
        setEditingId(null);
        setEditDraft(null);
    };

    const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

    const allTargets: { value: MidiTarget; label: string }[] = [
        ...ACTION_TARGETS,
        ...EQ_BAND_TARGETS,
        ...customUniforms.map(u => ({ value: `uniform:${u.name}` as MidiTarget, label: `Uniform: ${u.label || u.name} (${u.type})` })),
    ];

    const uniformForTarget = (t: MidiTarget): ShaderUniform | undefined => {
        if (!t.startsWith('uniform:')) return undefined;
        const name = t.slice(8);
        return customUniforms.find(u => u.name === name);
    };

    const defaultRangeForUniform = (u: ShaderUniform): { min: number; max: number } => {
        if (u.min !== undefined && u.max !== undefined) return { min: u.min, max: u.max };
        switch (u.type) {
            case 'bool': return { min: 0, max: 1 };
            case 'int':  return { min: 0, max: 10 };
            default:     return { min: 0, max: 1 };
        }
    };

    const labelForTarget = (t: MidiTarget) => allTargets.find(x => x.value === t)?.label ?? t;

    return (
        <div className="flex flex-col gap-6 p-4 max-w-2xl">
            <div className="flex items-center gap-3">
                <MusicalNoteIcon className="w-6 h-6 text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">MIDI Mapping</h2>
            </div>

            {/* Enable toggle + connect */}
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                        className={`relative w-10 h-6 rounded-full transition-colors ${midiEnabled ? 'bg-indigo-500' : 'bg-gray-600'}`}
                        onClick={() => setMidiEnabled(!midiEnabled)}
                    >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${midiEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-gray-200">Enable MIDI</span>
                </label>

                {midiEnabled && (
                    <button
                        onClick={connectMidi}
                        className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                    >
                        <ArrowPathIcon className={`w-3 h-3 ${midiStatus === 'connecting' ? 'animate-spin' : ''}`} />
                        {midiStatus === 'connecting' ? 'Connecting…' : 'Refresh Devices'}
                    </button>
                )}
            </div>

            {/* Status */}
            {midiEnabled && (
                <div className="text-sm">
                    {midiStatus === 'connected' && (
                        <div className="flex items-center gap-2 text-green-400">
                            <CheckCircleIcon className="w-4 h-4" />
                            {inputs.length === 0
                                ? 'Connected — no MIDI devices found. Plug in a controller and click Refresh.'
                                : `${inputs.length} device${inputs.length !== 1 ? 's' : ''} detected: ${inputs.map(i => i.name).join(', ')}`
                            }
                        </div>
                    )}
                    {midiStatus === 'error' && (
                        <div className="flex items-start gap-2 text-red-400">
                            <ExclamationCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{errorMsg || 'Could not access MIDI. Make sure your browser supports Web MIDI (Chrome/Edge recommended).'}</span>
                        </div>
                    )}
                    {midiStatus === 'idle' && (
                        <p className="text-gray-500 text-xs">Toggle Enable above to request MIDI access.</p>
                    )}
                </div>
            )}

            {/* Firefox note */}
            {midiEnabled && (
                <p className="text-xs text-yellow-400/80 bg-yellow-900/20 border border-yellow-700/30 rounded px-3 py-2">
                    <strong>Firefox:</strong> Web MIDI requires enabling <code>dom.webmidi.enabled</code> in <code>about:config</code>.
                    Chrome and Edge support it out of the box.
                </p>
            )}

            {/* Last MIDI event monitor */}
            {midiStatus === 'connected' && lastEvent && (
                <div className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-300">
                    <span className="text-gray-500">Last event:</span>{' '}
                    <span className="text-indigo-300">{lastEvent.type.toUpperCase()}</span>{' '}
                    ch<span className="text-green-300">{lastEvent.channel}</span>{' '}
                    #{lastEvent.number} = <span className="text-yellow-300">{lastEvent.value}</span>
                    {' '}— <span className="text-gray-400">{lastEvent.inputName}</span>
                </div>
            )}

            {/* Mappings */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-300">Mappings</h3>
                    <button
                        onClick={addMapping}
                        className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                        <PlusIcon className="w-3 h-3" /> Add Mapping
                    </button>
                </div>

                {(!mappings || mappings.length === 0) && (
                    <p className="text-xs text-gray-500 italic">
                        No mappings yet. Click "Add Mapping" to create one, then use "Learn" to auto-detect your controller's knob or pad.
                    </p>
                )}

                <div className="flex flex-col gap-2">
                    {(mappings || []).map(m => (
                        <div key={m.id} className="rounded bg-gray-800 border border-gray-700 overflow-hidden">
                            {editingId === m.id && editDraft ? (
                                /* ── Edit form ── */
                                <div className="p-3 flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs text-gray-400 mb-1">Label (optional)</label>
                                            <input
                                                className="w-full text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-indigo-500"
                                                value={editDraft.label || ''}
                                                onChange={e => setEditDraft(d => ({ ...d!, label: e.target.value }))}
                                                placeholder="e.g. Reverb amount"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Type</label>
                                            <select
                                                className="text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.source.type}
                                                onChange={e => setEditDraft(d => ({ ...d!, source: { ...d!.source, type: e.target.value as 'cc' | 'noteon' } }))}
                                            >
                                                <option value="cc">CC (knob/fader)</option>
                                                <option value="noteon">Note On (pad/button)</option>
                                            </select>
                                        </div>
                                        {editDraft.source.type === 'cc' && (
                                            <div>
                                                <label className="block text-xs text-gray-400 mb-1">Encoder Mode</label>
                                                <select
                                                    className="text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                    value={editDraft.encoderMode ?? 'absolute'}
                                                    onChange={e => setEditDraft(d => ({ ...d!, encoderMode: e.target.value as 'absolute' | 'relative' }))}
                                                >
                                                    <option value="absolute">Absolute (0–127)</option>
                                                    <option value="relative">Relative (endless encoder)</option>
                                                </select>
                                            </div>
                                        )}
                                        {editDraft.source.type === 'noteon' && (
                                            <div>
                                                <label className="block text-xs text-gray-400 mb-1">Button Mode</label>
                                                <select
                                                    className="text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                    value={editDraft.buttonMode ?? 'momentary'}
                                                    onChange={e => setEditDraft(d => ({ ...d!, buttonMode: e.target.value as 'toggle' | 'momentary' }))}
                                                >
                                                    <option value="momentary">Momentary (on while held)</option>
                                                    <option value="toggle">Toggle (press to flip)</option>
                                                </select>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Channel (0-15)</label>
                                            <input
                                                type="number" min={0} max={15}
                                                className="w-16 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.source.channel}
                                                onChange={e => setEditDraft(d => ({ ...d!, source: { ...d!.source, channel: +e.target.value } }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Number (0-127)</label>
                                            <input
                                                type="number" min={0} max={127}
                                                className="w-16 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.source.number}
                                                onChange={e => setEditDraft(d => ({ ...d!, source: { ...d!.source, number: +e.target.value } }))}
                                            />
                                        </div>
                                        {midiStatus === 'connected' && (
                                            <div className="flex items-end">
                                                <button
                                                    onClick={() => startLearn(m.id)}
                                                    className={`text-xs px-3 py-1 rounded transition-colors ${learnTarget === m.id ? 'bg-yellow-500 text-black animate-pulse' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
                                                >
                                                    {learnTarget === m.id ? '⏺ Listening…' : '🎹 Learn'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 flex-wrap items-end">
                                        <div className="flex-1 min-w-[180px]">
                                            <label className="block text-xs text-gray-400 mb-1">Target</label>
                                            <select
                                                className="w-full text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.target}
                                                onChange={e => {
                                                    const t = e.target.value as MidiTarget;
                                                    const u = uniformForTarget(t);
                                                    if (u) {
                                                        const range = defaultRangeForUniform(u);
                                                        setEditDraft(d => ({ ...d!, target: t, min: range.min, max: range.max }));
                                                    } else if (t.startsWith('eqBand:')) {
                                                        setEditDraft(d => ({ ...d!, target: t, min: -12, max: 12 }));
                                                    } else {
                                                        setEditDraft(d => ({ ...d!, target: t }));
                                                    }
                                                }}
                                            >
                                                {allTargets.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {(editDraft.target === 'speedDivider' || editDraft.target === 'volumeAmplifier' || editDraft.target === 'randomizeTime' || editDraft.target === 'randomizeVariation' || editDraft.target === 'randomizeBeatInterval' || editDraft.target.startsWith('eqBand:') || editDraft.target.startsWith('uniform:')) && (
                                            <>
                                                {uniformForTarget(editDraft.target) && (
                                                    <div className="w-full text-xs text-indigo-300 font-mono bg-gray-900/50 rounded px-2 py-1">
                                                        type: <strong>{uniformForTarget(editDraft.target)!.type}</strong>
                                                        {uniformForTarget(editDraft.target)!.min !== undefined && ` · declared range: ${uniformForTarget(editDraft.target)!.min}–${uniformForTarget(editDraft.target)!.max}`}
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Min value</label>
                                                    <input
                                                        type="number"
                                                        className="w-20 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                        value={editDraft.min}
                                                        onChange={e => setEditDraft(d => ({ ...d!, min: +e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Max value</label>
                                                    <input
                                                        type="number"
                                                        className="w-20 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                        value={editDraft.max}
                                                        onChange={e => setEditDraft(d => ({ ...d!, max: +e.target.value }))}
                                                    />
                                                </div>
                                                {editDraft.target.startsWith('uniform:') && (
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Step (optional)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            className="w-20 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                            value={editDraft.step ?? ''}
                                                            placeholder="e.g. 1"
                                                            onChange={e => setEditDraft(d => ({ ...d!, step: e.target.value === '' ? undefined : +e.target.value }))}
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button onClick={cancelEdit} className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">Cancel</button>
                                        <button onClick={saveEdit} className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Save</button>
                                    </div>
                                </div>
                            ) : (
                                /* ── Summary row ── */
                                <div className="flex items-center gap-3 px-3 py-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-white font-medium truncate">
                                            {m.label || labelForTarget(m.target)}
                                        </p>
                                        <p className="text-xs text-gray-500 font-mono">
                                            {m.source.type.toUpperCase()} ch{m.source.channel} #{m.source.number}
                                            {' → '}
                                            <span className="text-indigo-300">{labelForTarget(m.target)}</span>
                                        </p>
                                    </div>
                                    {midiStatus === 'connected' && (
                                        <button
                                            onClick={() => startLearn(m.id)}
                                            className={`text-xs px-2 py-0.5 rounded transition-colors ${learnTarget === m.id ? 'bg-yellow-500 text-black animate-pulse' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                        >
                                            {learnTarget === m.id ? '⏺ Listening…' : '🎹 Learn'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => startEdit(m)}
                                        className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => deleteMapping(m.id)}
                                        className="text-gray-600 hover:text-red-400 transition-colors"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Usage hints */}
            <div className="text-xs text-gray-500 border-t border-gray-700 pt-4 space-y-1">
                <p><strong className="text-gray-400">CC (knob/fader):</strong> Maps the 0–127 MIDI value to your min/max range. Works with speed, volume, and shader uniforms.</p>
                <p><strong className="text-gray-400">Note On (pad/button):</strong> Triggers actions (next/prev shader, reset time) or injects notes into the audio FFT.</p>
                <p><strong className="text-gray-400">FFT Inject:</strong> Playing a note will inject velocity into the audio frequency buffer — shaders react to MIDI just like real audio.</p>
                <p><strong className="text-gray-400">iMidi texture:</strong> Add <code className="bg-gray-800 px-1 rounded">useMidi: true</code> to a shader's metadata to expose a 128×4 MIDI state texture (<code>iMidi</code>) for per-note scripting.</p>
            </div>

            {/* ── Joystick Section ── */}
            <JoystickSection customUniforms={customUniforms} />
        </div>
    );
}

// ── Joystick sub-component ──────────────────────────────────────────────────

const JOYSTICK_ACTION_TARGETS: { value: JoystickTarget; label: string }[] = [
    { value: 'prevShader', label: 'Previous Shader' },
    { value: 'nextShader', label: 'Next Shader' },
    { value: 'resetTime', label: 'Reset Time' },
    { value: 'randomizeBeat', label: 'Toggle Beat Randomize' },
    { value: 'speedDivider', label: 'Speed Divider (axis/knob)' },
    { value: 'volumeAmplifier', label: 'Volume Amplifier (axis/knob)' },
    { value: 'fftInject', label: 'Inject into FFT' },
    { value: 'mouseX', label: 'Mouse X (iMouse.x — axis)' },
    { value: 'mouseY', label: 'Mouse Y (iMouse.y — axis)' },
    { value: 'mouseButton', label: 'Mouse Click (iMouse.zw — button)' },
];

const DEFAULT_JOYSTICK_MAPPING: Omit<JoystickMapping, 'id'> = {
    label: '',
    source: { type: 'button', gamepadIndex: 0, index: 0 },
    target: 'nextShader',
    min: 0,
    max: 1,
};

let joystickServiceModule: typeof import('@src/helpers/joystickService') | null = null;
const getJoystickService = async () => {
    if (!joystickServiceModule) joystickServiceModule = await import('@src/helpers/joystickService');
    return joystickServiceModule;
};

function JoystickSection({ customUniforms }: { customUniforms: ShaderUniform[] }) {
    const [joystickEnabled, setJoystickEnabled] = useChromeStorageLocal(SETTINGS_JOYSTICK_ENABLED, false);
    const [mappings, setMappings] = useChromeStorageLocal<JoystickMappings>(SETTINGS_JOYSTICK_MAPPINGS, []);

    const [inputs, setInputs] = React.useState<JoystickInputInfo[]>([]);
    const [status, setStatus] = React.useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = React.useState('');
    const [lastEvent, setLastEvent] = React.useState<JoystickEvent | null>(null);
    const [learnTarget, setLearnTarget] = React.useState<string | null>(null);
    const learnTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const mappingsRef = React.useRef<JoystickMappings>(mappings || []);
    React.useEffect(() => { mappingsRef.current = mappings || []; }, [mappings]);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editDraft, setEditDraft] = React.useState<Omit<JoystickMapping, 'id'> | null>(null);

    const allTargets: { value: JoystickTarget; label: string }[] = [
        ...JOYSTICK_ACTION_TARGETS,
        ...customUniforms.map(u => ({ value: `uniform:${u.name}` as JoystickTarget, label: `Uniform: ${u.label || u.name} (${u.type})` })),
    ];

    const labelForTarget = (t: JoystickTarget) => allTargets.find(x => x.value === t)?.label ?? t;

    const connectJoystick = React.useCallback(async () => {
        setStatus('connecting');
        setErrorMsg('');
        try {
            const svc = await getJoystickService();
            const ok = svc.initJoystick();
            if (ok) {
                setInputs(svc.getJoystickInputs());
                setStatus('connected');
                svc.relayEventsToContentScript();
            } else {
                setStatus('error');
                setErrorMsg('Gamepad API not supported in this browser.');
            }
        } catch (e) {
            setStatus('error');
            setErrorMsg(String(e));
        }
    }, []);

    React.useEffect(() => {
        if (!joystickEnabled) return;
        connectJoystick();
    }, [joystickEnabled]);

    React.useEffect(() => {
        if (status !== 'connected') return;
        let svc: typeof import('@src/helpers/joystickService');
        const activeAxisMappings = new Set<string>();
        const handler = (evt: JoystickEvent) => {
            setInputs(svc.getJoystickInputs());
            setLastEvent(evt);

            // Learn mode
            if (learnTarget !== null) {
                const source: JoystickMappingSource = {
                    type: evt.type === 'axis' ? 'axis' : 'button',
                    gamepadIndex: evt.gamepadIndex,
                    index: evt.index,
                    gamepadId: evt.gamepadId,
                };
                setMappings(prev =>
                    (prev || []).map(m => m.id === learnTarget ? { ...m, source } : m)
                );
                setLearnTarget(null);
                if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
                return;
            }

            // Mapping dispatch
            const evtIsButton = evt.type === 'button_down' || evt.type === 'button_up';
            const evtIsAxis = evt.type === 'axis';
            const isPress = evt.type === 'button_down';
            for (const mapping of mappingsRef.current) {
                const src = mapping.source;
                if (src.type === 'button' && !evtIsButton) continue;
                if (src.type === 'axis' && !evtIsAxis) continue;
                if (src.gamepadIndex !== evt.gamepadIndex) continue;
                if (src.index !== evt.index) continue;

                const rawNorm = evtIsAxis ? (evt.value + 1) / 2 : evt.value;
                const mapped = mapping.min + rawNorm * (mapping.max - mapping.min);
                const target = mapping.target;

                const isDiscrete = target !== 'speedDivider' && target !== 'volumeAmplifier' && !target.startsWith('uniform:') && target !== 'fftInject' && target !== 'mouseX' && target !== 'mouseY';
                let shouldTrigger: boolean;
                if (evtIsButton) {
                    shouldTrigger = isPress;
                } else if (isDiscrete) {
                    if (evt.value !== 0 && !activeAxisMappings.has(mapping.id)) {
                        activeAxisMappings.add(mapping.id);
                        shouldTrigger = true;
                    } else if (evt.value === 0) {
                        activeAxisMappings.delete(mapping.id);
                        shouldTrigger = false;
                    } else {
                        shouldTrigger = false;
                    }
                } else {
                    shouldTrigger = evt.value !== 0;
                }

                if (target === 'prevShader') {
                    if (shouldTrigger) browser.runtime.sendMessage({ command: PREV_SHADER }).catch(() => {});
                } else if (target === 'nextShader') {
                    if (shouldTrigger) browser.runtime.sendMessage({ command: NEXT_SHADER }).catch(() => {});
                } else if (target === 'resetTime') {
                    if (shouldTrigger) browser.storage.local.get('settings.randomizeBeat').then(r => {
                        browser.storage.local.set({ 'settings.randomizeBeat': r['settings.randomizeBeat'] });
                    });
                } else if (target === 'randomizeBeat') {
                    if (shouldTrigger) browser.storage.local.get('settings.randomizeBeat').then(r => {
                        browser.storage.local.set({ 'settings.randomizeBeat': !r['settings.randomizeBeat'] });
                    });
                } else if (target === 'speedDivider') {
                    browser.storage.local.set({ 'settings.speedDivider': Math.round(mapped) });
                } else if (target === 'volumeAmplifier') {
                    browser.storage.local.set({ 'settings.volumeAmplifier': mapped });
                } else if (target.startsWith('selectShader:')) {
                    const shaderId = target.slice(13);
                    if (shouldTrigger) browser.runtime.sendMessage({ command: 'SELECT_SHADER_BY_ID', shaderId }).catch(() => {});
                }
            }
        };
        getJoystickService().then(s => {
            svc = s;
            svc.subscribe(handler);
        });
        return () => { if (svc) svc.unsubscribe(handler); };
    }, [status, learnTarget]);

    const startLearn = (id: string) => {
        setLearnTarget(id);
        if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
        learnTimeoutRef.current = setTimeout(() => setLearnTarget(null), 8000);
    };

    const addMapping = () => {
        const id = `joy_${Date.now()}`;
        setMappings(prev => [...(prev || []), { id, ...DEFAULT_JOYSTICK_MAPPING }]);
        setEditingId(id);
        setEditDraft({ ...DEFAULT_JOYSTICK_MAPPING });
    };

    const deleteMapping = (id: string) => {
        setMappings(prev => (prev || []).filter(m => m.id !== id));
        if (editingId === id) { setEditingId(null); setEditDraft(null); }
    };

    const startEdit = (m: JoystickMapping) => {
        setEditingId(m.id);
        setEditDraft({ label: m.label, source: { ...m.source }, target: m.target, min: m.min, max: m.max });
    };

    const saveEdit = () => {
        if (!editingId || !editDraft) return;
        setMappings(prev => (prev || []).map(m => m.id === editingId ? { ...m, ...editDraft } : m));
        setEditingId(null);
        setEditDraft(null);
    };

    const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

    const showRangeForTarget = (t: JoystickTarget) =>
        t === 'speedDivider' || t === 'volumeAmplifier' || t.startsWith('uniform:');

    return (
        <div className="flex flex-col gap-6 pt-6 border-t border-gray-700">
            <div className="flex items-center gap-3">
                <span className="text-xl">🕹️</span>
                <h2 className="text-lg font-semibold text-white">Joystick / Gamepad Mapping</h2>
            </div>

            {/* Enable toggle + connect */}
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                        className={`relative w-10 h-6 rounded-full transition-colors ${joystickEnabled ? 'bg-indigo-500' : 'bg-gray-600'}`}
                        onClick={() => setJoystickEnabled(!joystickEnabled)}
                    >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${joystickEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-gray-200">Enable Joystick</span>
                </label>

                {joystickEnabled && (
                    <button
                        onClick={connectJoystick}
                        className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                    >
                        <ArrowPathIcon className={`w-3 h-3 ${status === 'connecting' ? 'animate-spin' : ''}`} />
                        {status === 'connecting' ? 'Connecting…' : 'Refresh Devices'}
                    </button>
                )}
            </div>

            {/* Status */}
            {joystickEnabled && (
                <div className="text-sm">
                    {status === 'connected' && (
                        <div className="flex items-center gap-2 text-green-400">
                            <CheckCircleIcon className="w-4 h-4" />
                            {inputs.length === 0
                                ? 'Ready — no gamepads detected. Press a button on your controller to connect it.'
                                : `${inputs.length} gamepad${inputs.length !== 1 ? 's' : ''}: ${inputs.map(i => i.id.split('(')[0].trim()).join(', ')}`
                            }
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="flex items-start gap-2 text-red-400">
                            <ExclamationCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{errorMsg || 'Could not initialize Gamepad API.'}</span>
                        </div>
                    )}
                    {status === 'idle' && (
                        <p className="text-gray-500 text-xs">Toggle Enable above to start listening for gamepads.</p>
                    )}
                </div>
            )}

            {/* Live event monitor */}
            {status === 'connected' && lastEvent && (
                <div className="text-xs font-mono bg-gray-800 rounded px-3 py-2 text-gray-300">
                    <span className="text-gray-500">Last event:</span>{' '}
                    <span className="text-indigo-300">{lastEvent.type.toUpperCase()}</span>{' '}
                    gamepad<span className="text-green-300">{lastEvent.gamepadIndex}</span>{' '}
                    idx <span className="text-yellow-300">{lastEvent.index}</span>{' '}
                    = <span className="text-yellow-300">{lastEvent.value.toFixed(3)}</span>
                </div>
            )}

            {/* Mappings */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-300">Mappings</h3>
                    <button
                        onClick={addMapping}
                        className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                        <PlusIcon className="w-3 h-3" /> Add Mapping
                    </button>
                </div>

                {(!mappings || mappings.length === 0) && (
                    <p className="text-xs text-gray-500 italic">
                        No mappings yet. Click “Add Mapping” and use “Learn” to auto-detect an axis or button.
                    </p>
                )}

                <div className="flex flex-col gap-2">
                    {(mappings || []).map(m => (
                        <div key={m.id} className="rounded bg-gray-800 border border-gray-700 overflow-hidden">
                            {editingId === m.id && editDraft ? (
                                <div className="p-3 flex flex-col gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Label (optional)</label>
                                        <input
                                            className="w-full text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-indigo-500"
                                            value={editDraft.label || ''}
                                            onChange={e => setEditDraft(d => ({ ...d!, label: e.target.value }))}
                                            placeholder="e.g. Left stick X"
                                        />
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Type</label>
                                            <select
                                                className="text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.source.type}
                                                onChange={e => setEditDraft(d => ({ ...d!, source: { ...d!.source, type: e.target.value as 'axis' | 'button' } }))}
                                            >
                                                <option value="button">Button (digital)</option>
                                                <option value="axis">Axis (analog)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Gamepad #</label>
                                            <input
                                                type="number" min={0} max={3}
                                                className="w-16 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.source.gamepadIndex}
                                                onChange={e => setEditDraft(d => ({ ...d!, source: { ...d!.source, gamepadIndex: +e.target.value } }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Index</label>
                                            <input
                                                type="number" min={0} max={31}
                                                className="w-16 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.source.index}
                                                onChange={e => setEditDraft(d => ({ ...d!, source: { ...d!.source, index: +e.target.value } }))}
                                            />
                                        </div>
                                        {status === 'connected' && (
                                            <div className="flex items-end">
                                                <button
                                                    onClick={() => startLearn(m.id)}
                                                    className={`text-xs px-3 py-1 rounded transition-colors ${
                                                        learnTarget === m.id
                                                            ? 'bg-yellow-500 text-black animate-pulse'
                                                            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                                    }`}
                                                >
                                                    {learnTarget === m.id ? '⏺ Listening…' : '🕹️ Learn'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 flex-wrap items-end">
                                        <div className="flex-1 min-w-[180px]">
                                            <label className="block text-xs text-gray-400 mb-1">Target</label>
                                            <select
                                                className="w-full text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                value={editDraft.target}
                                                onChange={e => setEditDraft(d => ({ ...d!, target: e.target.value as JoystickTarget }))}
                                            >
                                                {allTargets.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {showRangeForTarget(editDraft.target) && (
                                            <>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Min value</label>
                                                    <input
                                                        type="number"
                                                        className="w-20 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                        value={editDraft.min}
                                                        onChange={e => setEditDraft(d => ({ ...d!, min: +e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Max value</label>
                                                    <input
                                                        type="number"
                                                        className="w-20 text-xs bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                                        value={editDraft.max}
                                                        onChange={e => setEditDraft(d => ({ ...d!, max: +e.target.value }))}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button onClick={cancelEdit} className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">Cancel</button>
                                        <button onClick={saveEdit} className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 px-3 py-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-white font-medium truncate">
                                            {m.label || labelForTarget(m.target)}
                                        </p>
                                        <p className="text-xs text-gray-500 font-mono">
                                            {m.source.type.toUpperCase()} gp{m.source.gamepadIndex} idx{m.source.index}
                                            {' → '}
                                            <span className="text-indigo-300">{labelForTarget(m.target)}</span>
                                        </p>
                                    </div>
                                    {status === 'connected' && (
                                        <button
                                            onClick={() => startLearn(m.id)}
                                            className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                                learnTarget === m.id
                                                    ? 'bg-yellow-500 text-black animate-pulse'
                                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                            }`}
                                        >
                                            {learnTarget === m.id ? '⏺ Listening…' : '🕹️ Learn'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => startEdit(m)}
                                        className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => deleteMapping(m.id)}
                                        className="text-gray-600 hover:text-red-400 transition-colors"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Usage hints */}
            <div className="text-xs text-gray-500 border-t border-gray-700 pt-4 space-y-1">
                <p><strong className="text-gray-400">Axis:</strong> Maps the −1..+1 range to your min/max. Good for analog sticks and triggers controlling speed, volume, or shader uniforms.</p>
                <p><strong className="text-gray-400">Button:</strong> Triggers on press. Use for prev/next shader, reset time, or beat toggle.</p>
                <p><strong className="text-gray-400">iJoystick texture:</strong> A 32×4 texture uniform exposed to all shaders. Row 0 = axes (normalised), row 1 = buttons held, row 2 = just-pressed, row 3 = just-released.</p>
                <p><strong className="text-gray-400">Tip:</strong> Click “Learn” then move a stick or press a button — the source is auto-detected.</p>
            </div>
        </div>
    );
}
