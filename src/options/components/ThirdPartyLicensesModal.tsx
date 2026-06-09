import { XMarkIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ThirdPartyLicensesModal({ isOpen, onClose }: Props) {
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      // Fetch the markdown file from the extension
      const url = browser.runtime.getURL("third_party_licenses.md");
      fetch(url)
        .then((response) => response.text())
        .then((text) => setContent(text))
        .catch((error) => {
          console.error("Failed to load third party licenses:", error);
          setContent("Failed to load third party licenses.");
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Simple markdown to HTML conversion
  const parseMarkdown = (md: string): string => {
    return md
      // Headers
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h3>')
      // Tables
      .replace(/\|([^|]+)\|([^|]+)\|([^|]+)\|/gim, '<tr><td class="py-1 pr-3 text-gray-700 dark:text-gray-300 text-xs">$1</td><td class="py-1 pr-3 text-gray-700 dark:text-gray-300 text-xs">$2</td><td class="py-1 text-gray-700 dark:text-gray-300 text-xs">$3</td></tr>')
      // Remove table separator lines
      .replace(/\|[-\s|]+\|/gim, '')
      // Paragraphs
      .replace(/\n\n/g, '</p><p class="mb-3 text-sm text-gray-700 dark:text-gray-300">')
      // Line breaks
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
        {/* Backdrop */}
        <div className="absolute h-screen w-screen" onClick={onClose} />

        {/* Dialog */}
        <div className="relative w-full max-w-[48rem] mx-4 my-6">
          <div className="flex flex-col rounded-lg bg-white dark:bg-gray-800 shadow-2xl max-h-[80vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <DocumentTextIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Third-Party Licenses</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-indigo-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto text-sm text-gray-700 dark:text-gray-300">
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{
                  __html: parseMarkdown(content)
                }}
              />
            </div>

          </div>
        </div>
      </div>
      <div className="opacity-25 fixed inset-0 z-40 bg-black" />
    </>
  );
}
