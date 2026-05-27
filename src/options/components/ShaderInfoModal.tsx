import { DocumentTextIcon, LinkIcon, PencilIcon, UserIcon, XMarkIcon, AdjustmentsHorizontalIcon, CodeBracketIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import type { ShaderObject, ShaderUniform } from "@src/helpers/types";

type Props = {
  shaderObject: ShaderObject;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ShaderInfoModal({ shaderObject, showModal, setShowModal }: Props) {
  const [customUniformValues, setCustomUniformValues] = useState<{[key: string]: any}>({});
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

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