import { DocumentTextIcon, LinkIcon, PencilIcon, UserIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState } from "react";

type Props = {
  shaderObject: ShaderObject;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ShaderInfoModal({ shaderObject, showModal, setShowModal }: Props) {
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
                  src={`images/preview/${shaderObject.shaderName}.png`}
                  alt="" />
                <div className="flex flex-col justify-start p-6 text-base">
                  <h5 className="mb-2 text-xl font-medium dark:text-gray-300 pb-5">{shaderObject.metaData.shaderName}</h5>
                  
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
                        {shaderObject.metaData.author}
                      </p>
                    </div>

                    <div className="flex">
                      <PencilIcon className="w-4 h-4 text-indigo-500 mr-1"/>
                      <p className="w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                        Modified by
                      </p>
                      <p className="text-xs font-normal text-gray-700 dark:text-gray-400">
                        {shaderObject.metaData.modifiedBy}
                      </p>
                    </div>

                    <div className="flex">
                      <LinkIcon className="w-4 h-4 text-indigo-500 mr-1"/>
                      <p className="w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                        Url
                      </p>
                      <a href={shaderObject.metaData.url} target="_blank" 
                        className="text-xs text-indigo-400 visited:italic">{shaderObject.metaData.url}</a>
                    </div>

                    <div className="flex">
                      <DocumentTextIcon className="flex-none w-4 h-4 text-indigo-500 mr-1"/>
                      <p className="flex-none w-20 text-xs font-bold text-gray-700 dark:text-gray-400">
                        License
                      </p>
                      <a href={shaderObject.metaData.licenseURL} target="_blank" 
                        className="text-xs text-indigo-400 visited:italic">{shaderObject.metaData.license}</a> 
                    </div>
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