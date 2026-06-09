import { XMarkIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

type Props = {
  isOpen: boolean;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
};

export default function ShadertoyAssetConfirmModal({ isOpen, onConfirm, onCancel }: Props) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
        {/* Backdrop */}
        <div className="absolute h-screen w-screen" onClick={onCancel} />

        {/* Dialog */}
        <div className="relative w-full max-w-lg mx-4 my-6">
          <div className="flex flex-col rounded-lg bg-white dark:bg-gray-800 shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <ArrowDownTrayIcon className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Enable Local Asset Cache?</h2>
              </div>
              <button
                onClick={onCancel}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh] text-sm text-gray-700 dark:text-gray-300">
              
              <p>
                When you enable this feature, ShaderAmp downloads the required textures and media once from shadertoy.com while importing shaders which reference the asset. Since the asset is already loaded in browser memory when viewing the shader on Shadertoy, it's typically served from cache rather than re-downloaded.
              </p>
              
              <p className="text-gray-600 dark:text-gray-400">
                <strong>Benefit:</strong> If another shader uses the same asset, no additional network request is sent.
              </p>

              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold">•</span>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Storage:</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">
                      The assets (images, videos, cubemaps) are stored locally on your hard drive (IndexedDB). You can clear this data anytime in the settings.
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold">•</span>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Copyright:</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">
                      ShaderAmp does not mirror assets on its own servers. The files are processed exclusively locally on your device for real-time visualization. You will find them in the 'Media' tab.
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold">•</span>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Loading mechanism:</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">
                      Assets are first loaded from the browser cache (avoiding network requests), then stored in IndexedDB for reuse.
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 font-bold">•</span>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Privacy:</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">
                      When loading an asset for the first time, your IP address may be transmitted to Shadertoy's content delivery network.
                    </span>
                  </div>
                </div>
              </div>

              {/* Don't ask again checkbox */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dontAskAgain}
                    onChange={(e) => setDontAskAgain(e.target.checked)}
                    className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 rounded"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Don't ask again</span>
                </label>
              </div>
            </div>

            {/* Footer with buttons */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(dontAskAgain)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Yes, enable loading of assets from shadertoy.com 
              </button>
            </div>

          </div>
        </div>
      </div>
      <div className="opacity-25 fixed inset-0 z-40 bg-black" />
    </>
  );
}
