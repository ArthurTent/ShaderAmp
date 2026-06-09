import { DocumentTextIcon, LinkIcon, PencilIcon, UserIcon, XMarkIcon, AdjustmentsHorizontalIcon, CodeBracketIcon, MusicalNoteIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useRef, useState } from "react";
import browser from "webextension-polyfill";
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import { SETTINGS_MIDI_ENABLED, SETTINGS_MIDI_MAPPINGS, SETTINGS_JOYSTICK_ENABLED, SETTINGS_JOYSTICK_MAPPINGS } from '@src/storage/storageConstants';
import type { ShaderObject, ShaderUniform, MidiMappings, MidiMapping, MidiTarget, JoystickMappings, JoystickMapping, JoystickTarget } from "@src/helpers/types";
import type { MidiEvent } from "@src/helpers/midiService";
import type { JoystickEvent } from "@src/helpers/joystickService";

type Props = {
  shaderObject: ShaderObject;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  onConfigureMIDI?: () => void;
}

export default function ShaderInfoModal({ shaderObject, showModal, setShowModal, onConfigureMIDI }: Props) {
  const [customUniformValues, setCustomUniformValues] = useState<{[key: string]: any}>({});
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // MIDI state
  const [midiEnabled, setMidiEnabled] = useChromeStorageLocal(SETTINGS_MIDI_ENABLED, false);
  const [mappings, setMappings] = useChromeStorageLocal<MidiMappings>(SETTINGS_MIDI_MAPPINGS, []);
  const [lastEvent, setLastEvent] = useState<MidiEvent | null>(null);
  const [learningUniform, setLearningUniform] = useState<string | null>(null);
  const [learningShaderSelect, setLearningShaderSelect] = useState(false);
  const learnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mappingsRef = useRef<MidiMappings>(mappings || []);
  useEffect(() => { mappingsRef.current = mappings || []; }, [mappings]);
  const midiRelativeAccRef = useRef<Map<string, number>>(new Map());

  // Joystick state
  const [joystickEnabled, setJoystickEnabled] = useChromeStorageLocal(SETTINGS_JOYSTICK_ENABLED, false);
  const [joystickMappings, setJoystickMappings] = useChromeStorageLocal<JoystickMappings>(SETTINGS_JOYSTICK_MAPPINGS, []);
  const [lastJoyEvent, setLastJoyEvent] = useState<JoystickEvent | null>(null);
  const [learningJoyShaderSelect, setLearningJoyShaderSelect] = useState(false);
  const joyLearnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get shader identifier for MIDI mapping
  const getShaderIdentifier = () => {
    return shaderObject.metaData?.shaderName || shaderObject.shaderName.replace('.frag', '');
  };

  // Get existing mapping for a uniform
  const getMappingForUniform = (uniformName: string) => {
    return mappings.find(m => m.target === `uniform:${uniformName}`);
  };

  // Get existing mapping for shader selection
  const getMappingForShaderSelect = () => {
    return mappings.find(m => m.target === `selectShader:${getShaderIdentifier()}`);
  };

  // Get existing joystick mapping for shader selection
  const getJoyMappingForShaderSelect = () => {
    return (joystickMappings || []).find(m => m.target === `selectShader:${getShaderIdentifier()}`);
  };

  // Start learn mode for a uniform
  const startLearnForUniform = (uniformName: string) => {
    setLearningUniform(uniformName);
    setLearningShaderSelect(false);
    if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
    learnTimeoutRef.current = setTimeout(() => setLearningUniform(null), 8000);
  };

  // Start learn mode for shader selection
  const startLearnForShaderSelect = () => {
    setLearningShaderSelect(true);
    setLearningUniform(null);
    if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
    learnTimeoutRef.current = setTimeout(() => setLearningShaderSelect(false), 8000);
  };

  // Start joystick learn mode for shader selection
  const startLearnForJoyShaderSelect = () => {
    setLearningJoyShaderSelect(true);
    if (joyLearnTimeoutRef.current) clearTimeout(joyLearnTimeoutRef.current);
    joyLearnTimeoutRef.current = setTimeout(() => setLearningJoyShaderSelect(false), 8000);
  };

  // Subscribe to MIDI events when enabled
  useEffect(() => {
    if (!midiEnabled) return;

    let svc: typeof import('@src/helpers/midiService');
    const handler = (evt: MidiEvent) => {
      setLastEvent(evt);

      // Apply mapped uniform values to UI (outside learn mode)
      for (const mapping of mappingsRef.current) {
        const src = mapping.source;
        if (src.type !== evt.type) continue;
        if (src.channel !== evt.channel) continue;
        if (src.number !== evt.number) continue;
        if (!mapping.target.startsWith('uniform:')) continue;

        const uniformName = mapping.target.slice(8);
        let mapped: number;
        if (mapping.encoderMode === 'relative') {
          const range = mapping.max - mapping.min;
          const stepSize = range / 64;
          const delta = evt.value <= 63 ? evt.value * stepSize : (evt.value - 128) * stepSize;
          const prev = midiRelativeAccRef.current.get(mapping.id) ?? ((mapping.min + mapping.max) / 2);
          mapped = Math.min(mapping.max, Math.max(mapping.min, prev + delta));
          midiRelativeAccRef.current.set(mapping.id, mapped);
        } else {
          const normalized = evt.value / 127;
          mapped = mapping.min + normalized * (mapping.max - mapping.min);
        }
        if (mapping.step) mapped = Math.round(mapped / mapping.step) * mapping.step;

        setCustomUniformValues(prev => {
          const next = { ...prev, [uniformName]: mapped };
          if (shaderObject?.shaderName) {
            browser.storage.local.set({
              [`customUniforms_${shaderObject.shaderName}`]: next
            });
          }
          return next;
        });
      }

      // If in learn mode for uniform, create/update mapping
      if (learningUniform) {
        const uniformDef = shaderObject.metaData?.customUniforms?.find(u => u.name === learningUniform);
        const uniformMin = uniformDef?.min ?? 0;
        const uniformMax = uniformDef?.max ?? 127;
        const uniformStep = uniformDef?.step;
        const newMapping: MidiMapping = {
          id: `midi_${Date.now()}`,
          label: `${shaderObject.metaData?.shaderName || 'Shader'} - ${learningUniform}`,
          source: {
            type: evt.type === 'cc' ? 'cc' : 'noteon',
            channel: evt.channel,
            number: evt.number,
            inputId: evt.inputId,
          },
          target: `uniform:${learningUniform}` as MidiTarget,
          min: uniformMin,
          max: uniformMax,
          ...(uniformStep !== undefined ? { step: uniformStep } : {}),
        };

        // Remove existing mapping for this uniform, add new one
        setMappings(prev => [...prev.filter(m => m.target !== `uniform:${learningUniform}`), newMapping]);
        setLearningUniform(null);
        if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
      }

      // If in learn mode for shader selection, create/update mapping
      if (learningShaderSelect) {
        const shaderId = getShaderIdentifier();
        const newMapping: MidiMapping = {
          id: `midi_${Date.now()}`,
          label: `Select: ${shaderId}`,
          source: {
            type: evt.type === 'cc' ? 'cc' : 'noteon',
            channel: evt.channel,
            number: evt.number,
            inputId: evt.inputId,
          },
          target: `selectShader:${shaderId}` as MidiTarget,
          min: 0,
          max: 127,
        };

        // Remove existing mapping for this shader, add new one
        setMappings(prev => [...prev.filter(m => m.target !== `selectShader:${shaderId}`), newMapping]);
        setLearningShaderSelect(false);
        if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
      }
    };

    // Subscribe via midiService
    import('@src/helpers/midiService').then(s => {
      svc = s;
      svc.subscribe(handler);
    });

    return () => {
      if (svc) svc.unsubscribe(handler);
    };
  }, [midiEnabled, learningUniform, learningShaderSelect, shaderObject, setMappings]);

  // Subscribe to joystick events when enabled
  useEffect(() => {
    if (!joystickEnabled) return;

    let svc: typeof import('@src/helpers/joystickService');
    const handler = (evt: JoystickEvent) => {
      setLastJoyEvent(evt);

      if (learningJoyShaderSelect) {
        const shaderId = getShaderIdentifier();
        const newMapping: JoystickMapping = {
          id: `joy_${Date.now()}`,
          label: `Select: ${shaderId}`,
          source: {
            type: evt.type === 'axis' ? 'axis' : 'button',
            gamepadIndex: evt.gamepadIndex,
            index: evt.index,
            gamepadId: evt.gamepadId,
          },
          target: `selectShader:${shaderId}` as JoystickTarget,
          min: 0,
          max: 1,
        };
        setJoystickMappings(prev => [
          ...(prev || []).filter(m => m.target !== `selectShader:${shaderId}`),
          newMapping,
        ]);
        setLearningJoyShaderSelect(false);
        if (joyLearnTimeoutRef.current) clearTimeout(joyLearnTimeoutRef.current);
      }
    };

    import('@src/helpers/joystickService').then(s => {
      svc = s;
      svc.subscribe(handler);
    });

    return () => {
      if (svc) svc.unsubscribe(handler);
    };
  }, [joystickEnabled, learningJoyShaderSelect, shaderObject, setJoystickMappings]);

  // Initialize custom uniform values with defaults
  useEffect(() => {
    if (shaderObject?.metaData?.customUniforms) {
      const initialValues: {[key: string]: any} = {};
      shaderObject.metaData.customUniforms.forEach(uniform => {
        initialValues[uniform.name] = uniform.default;
      });
      setCustomUniformValues(initialValues);
      
      // Load saved values from storage
      browser.storage.local.get(`customUniforms_${shaderObject.shaderName}`).then(result => {
        if (result[`customUniforms_${shaderObject.shaderName}`]) {
          setCustomUniformValues(result[`customUniforms_${shaderObject.shaderName}`]);
        }
      });
    }
  }, [shaderObject]);

  const handleUniformChange = (uniformName: string, value: any) => {
    const newValues = { ...customUniformValues, [uniformName]: value };
    setCustomUniformValues(newValues);
    
    // Save to storage
    browser.storage.local.set({
      [`customUniforms_${shaderObject.shaderName}`]: newValues
    });
    
    // Send to content script
    browser.runtime.sendMessage({
      type: 'UPDATE_CUSTOM_UNIFORMS',
      shaderName: shaderObject.shaderName,
      uniforms: newValues
    }).catch(() => {
      // Ignore errors if no content script is listening
    });
  };
  return (
    <>
      {showModal ? (
        <>
          <div
            className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none"
          >
            {/* Backdrop */}
            <div className="absolute h-screen w-screen" onClick={() => setShowModal(false)} />

            {/* Content */}
            <div className="relative w-auto my-6 mx-auto max-w-3xl">


              { /* Card content */}
              <div
                className="flex flex-col rounded-lg bg-white dark:bg-gray-700 text-surface shadow-secondary-1 dark:bg-surface-dark dark:text-gray-500 md:max-w-2xl md:flex-row">
                <img
                  className="h-96 w-full rounded-t-lg object-cover md:h-auto md:w-48 md:!rounded-none md:!rounded-s-lg"
                  src={(shaderObject.metaData as any)?.previewImage || `images/preview/${shaderObject.shaderName}.png`}
                  alt="" />
                <div className="flex flex-col justify-start p-6 text-base">
                  <h5 className="mb-2 text-xl font-medium dark:text-gray-300 pb-5">{shaderObject.metaData?.shaderName || shaderObject.shaderName}</h5>
                  
                  <div className="absolute h-6 w-6 text-gray-300 top-1 right-1 drop-shadow-lg rounded-lg
                      transition-colors duration-150 hover:bg-indigo-800 cursor-pointer" onClick={(e) => setShowModal(false)}>
                        <XMarkIcon className="stroke-white-500 shadow-lg"/>
                  </div>

                  <div className="font-sans">
                    <div className="flex">
                      <UserIcon className="w-4 h-4 text-indigo-500 mr-1"/>
                      <p className="w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                        Author
                      </p>
                      <p className="text-xs font-normal text-gray-700 dark:text-gray-400">
                        {shaderObject.metaData?.author || "Unknown"}
                      </p>
                    </div>

                    {shaderObject.metaData?.modifiedBy && (
                      <div className="flex">
                        <PencilIcon className="w-4 h-4 text-indigo-500 mr-1"/>
                        <p className="w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                          Modified by
                        </p>
                        <p className="text-xs font-normal text-gray-700 dark:text-gray-400">
                          {shaderObject.metaData?.modifiedBy}
                        </p>
                      </div>
                    )}

                    {shaderObject.metaData?.url && (
                      <div className="flex">
                        <LinkIcon className="w-4 h-4 text-indigo-500 mr-1"/>
                        <p className="w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                          Url
                        </p>
                        <a href={shaderObject.metaData.url} target="_blank" 
                          className="text-xs text-indigo-400 visited:italic">{shaderObject.metaData.url}</a>
                      </div>
                    )}

                    {((shaderObject as any).isImported || shaderObject.metaData?.modifiedBy === "ShaderAmp Converter") ? (
                      <div className="flex">
                        <DocumentTextIcon className="flex-none w-4 h-4 text-indigo-500 mr-1"/>
                        <p className="flex-none w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                          License
                        </p>
                        <span className="text-xs text-gray-700 dark:text-gray-400">Unknown</span>
                      </div>
                    ) : shaderObject.metaData?.license ? (
                      <div className="flex">
                        <DocumentTextIcon className="flex-none w-4 h-4 text-indigo-500 mr-1"/>
                        <p className="flex-none w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                          License
                        </p>
                        {shaderObject.metaData.licenseURL ? (
                          <a href={shaderObject.metaData.licenseURL} target="_blank" 
                            className="text-xs text-indigo-400 visited:italic">{shaderObject.metaData.license}</a>
                        ) : (
                          <span className="text-xs text-gray-700 dark:text-gray-400">{shaderObject.metaData.license}</span>
                        )}
                      </div>
                    ) : null}

                    
                    {shaderObject.metaData?.description && (
                      <div className="mt-4">
                        <h6 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-400 mb-1">
                          Description
                        </h6>
                        <div
                          className="text-xs text-gray-700 dark:text-gray-400 leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: shaderObject.metaData.description }}
                        />
                      </div>
                    )}

                    {notification && (
                      <div className={`mt-4 p-2 rounded text-xs ${notification.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                        {notification.message}
                      </div>
                    )}
                  </div>
                  
                  {/* Custom Uniforms Section */}
                  {shaderObject.metaData?.customUniforms && shaderObject.metaData.customUniforms.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                      <div className="flex items-center mb-3">
                        <AdjustmentsHorizontalIcon className="w-4 h-4 text-indigo-500 mr-2"/>
                        <h6 className="text-sm font-bold text-gray-700 dark:text-gray-300">Shader Parameters</h6>
                      </div>
                      <div className="space-y-3">
                        {shaderObject.metaData.customUniforms.map((uniform) => (
                          <div key={uniform.name} className="flex items-center">
                            <label className="w-32 text-xs font-semibold text-gray-600 dark:text-gray-400">
                              {uniform.label}
                            </label>
                            {(uniform.type === 'int' || uniform.type === 'float') && uniform.options ? (
                              <select 
                                value={customUniformValues[uniform.name] ?? uniform.default}
                                onChange={(e) => handleUniformChange(uniform.name, uniform.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
                                className="flex-1 text-xs px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                {uniform.options.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : uniform.type === 'float' || uniform.type === 'int' ? (
                              <div className="flex-1 flex items-center space-x-2">
                                <input 
                                  type="range"
                                  min={uniform.min}
                                  max={uniform.max}
                                  step={uniform.step || (uniform.type === 'int' ? 1 : 0.01)}
                                  value={customUniformValues[uniform.name] ?? uniform.default}
                                  onChange={(e) => handleUniformChange(uniform.name, uniform.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
                                  className="flex-1"
                                />
                                <span className="text-xs w-12 text-gray-600 dark:text-gray-400 text-right">
                                  {(customUniformValues[uniform.name] ?? uniform.default).toFixed(uniform.type === 'int' ? 0 : 2)}
                                </span>
                              </div>
                            ) : uniform.type === 'bool' ? (
                              <input 
                                type="checkbox"
                                checked={customUniformValues[uniform.name] ?? uniform.default}
                                onChange={(e) => handleUniformChange(uniform.name, e.target.checked)}
                                className="ml-2"
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Inline MIDI Mapping Section */}
                  <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <MusicalNoteIcon className="w-4 h-4 text-purple-400" />
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">MIDI Mapping</h4>
                    </div>

                    {/* Enable MIDI Toggle */}
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer" onClick={() => setMidiEnabled(!midiEnabled)}>
                        <div className={`relative w-8 h-5 rounded-full transition-colors ${midiEnabled ? 'bg-purple-500' : 'bg-gray-600'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${midiEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">Enable MIDI</span>
                      </label>
                    </div>

                    {midiEnabled && (
                      <>
                        {/* MIDI Status / Event Monitor */}
                        <div className="mb-3 text-xs font-mono bg-gray-800 rounded px-2 py-1.5 text-gray-300">
                          {lastEvent ? (
                            <>
                              <span className="text-gray-500">Last:</span>{' '}
                              <span className="text-purple-300">{lastEvent.type.toUpperCase()}</span>{' '}
                              ch<span className="text-green-300">{lastEvent.channel}</span>
                              #{lastEvent.number}={lastEvent.value}
                            </>
                          ) : (
                            <span className="text-gray-500">Twiddle a knob to see MIDI input...</span>
                          )}
                        </div>

                        {/* Custom Uniforms List with Learn */}
                        {shaderObject.metaData?.customUniforms && shaderObject.metaData.customUniforms.length > 0 && (
                          <div className="space-y-2 mb-3">
                            <p className="text-xs text-gray-500">Click &quot;Learn&quot; next to a parameter, then move a MIDI knob:</p>
                            {shaderObject.metaData.customUniforms.map((uniform) => (
                              <div key={uniform.name} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-300">{uniform.label || uniform.name}</span>
                                  <span className="text-xs text-gray-500">({uniform.type})</span>
                                  {/* Show if mapped */}
                                  {getMappingForUniform(uniform.name) && (
                                    <span className="text-xs text-green-400">
                                      → CC{getMappingForUniform(uniform.name)?.source.number}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => startLearnForUniform(uniform.name)}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    learningUniform === uniform.name
                                      ? 'bg-yellow-600 text-white animate-pulse'
                                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                                  }`}
                                >
                                  {learningUniform === uniform.name ? 'Listening...' : 'Learn'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Shader Selection via MIDI */}
                        <div className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2 mb-3 border border-purple-500/30">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-purple-300 font-medium">🎹 Select This Shader</span>
                            {/* Show if mapped */}
                            {getMappingForShaderSelect() && (
                              <span className="text-xs text-green-400">
                                → {getMappingForShaderSelect()?.source.type.toUpperCase()} ch{getMappingForShaderSelect()?.source.channel}#{getMappingForShaderSelect()?.source.number}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={startLearnForShaderSelect}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              learningShaderSelect
                                ? 'bg-yellow-600 text-white animate-pulse'
                                : 'bg-purple-600 hover:bg-purple-500 text-white'
                            }`}
                          >
                            {learningShaderSelect ? 'Listening...' : 'Learn'}
                          </button>
                        </div>

                        {/* Link to full MIDI tab */}
                        {onConfigureMIDI && (
                          <button
                            onClick={() => {
                              setShowModal(false);
                              onConfigureMIDI();
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 underline"
                          >
                            Open full MIDI settings →
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Inline Joystick Mapping Section */}
                  <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">🕹️</span>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Joystick Mapping</h4>
                    </div>

                    {/* Enable Joystick Toggle */}
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer" onClick={() => setJoystickEnabled(!joystickEnabled)}>
                        <div className={`relative w-8 h-5 rounded-full transition-colors ${joystickEnabled ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${joystickEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">Enable Joystick</span>
                      </label>
                    </div>

                    {joystickEnabled && (
                      <>
                        {/* Joystick Event Monitor */}
                        <div className="mb-3 text-xs font-mono bg-gray-800 rounded px-2 py-1.5 text-gray-300">
                          {lastJoyEvent ? (
                            <>
                              <span className="text-gray-500">Last:</span>{' '}
                              <span className="text-indigo-300">{lastJoyEvent.type.toUpperCase()}</span>{' '}
                              gp<span className="text-green-300">{lastJoyEvent.gamepadIndex}</span>
                              {' '}idx<span className="text-yellow-300">{lastJoyEvent.index}</span>
                              ={lastJoyEvent.value.toFixed(3)}
                            </>
                          ) : (
                            <span className="text-gray-500">Press a button or move a stick to see input...</span>
                          )}
                        </div>

                        {/* Shader Selection via Joystick */}
                        <div className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2 mb-3 border border-indigo-500/30">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-indigo-300 font-medium">🕹️ Select This Shader</span>
                            {getJoyMappingForShaderSelect() && (
                              <span className="text-xs text-green-400">
                                → {getJoyMappingForShaderSelect()?.source.type.toUpperCase()}
                                {' '}gp{getJoyMappingForShaderSelect()?.source.gamepadIndex}
                                {' '}idx{getJoyMappingForShaderSelect()?.source.index}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={startLearnForJoyShaderSelect}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              learningJoyShaderSelect
                                ? 'bg-yellow-600 text-white animate-pulse'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {learningJoyShaderSelect ? 'Listening...' : 'Learn'}
                          </button>
                        </div>

                        {/* Link to full Joystick tab */}
                        {onConfigureMIDI && (
                          <button
                            onClick={() => {
                              setShowModal(false);
                              onConfigureMIDI();
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                          >
                            Open full Joystick settings →
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <p className="mb-4 my-4 text-base text-xs italic">
                    The licensor does not support ShaderAmp or our use of this work in ShaderAmp.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
      ) : null}
    </>
  );
}