import { XMarkIcon, CodeBracketIcon, LinkIcon, UserIcon, HeartIcon } from "@heroicons/react/24/outline";
import React from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOpenLicenses?: () => void;
};

export default function AboutModal({ isOpen, onClose, onOpenLicenses }: Props) {
  if (!isOpen) return null;

  return (
    <>
      <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
        {/* Backdrop */}
        <div className="absolute h-screen w-screen" onClick={onClose} />

        {/* Dialog */}
        <div className="relative w-full max-w-[56rem] mx-4 my-6">
          <div className="flex flex-col rounded-lg bg-white dark:bg-gray-800 shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <CodeBracketIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">About ShaderAmp</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-indigo-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh] text-sm text-gray-700 dark:text-gray-300">

              {/* App info */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-400 mb-1">About</h3>
                <p className="font-semibold text-gray-900 dark:text-gray-100">ShaderAmp <span className="font-normal text-gray-500 dark:text-gray-400">a c-base(d) project</span></p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  
                  "Unlimited unpaid free time pays off" - Oleg
                  <br />
                  <br />
                  This project is a hobby project started by Arthur Tent. It is 100% free, non-commercial and open source.

                  However, if you like it, consider supporting the project by spreading the word or donating to any of the mentioned people or projects below.
                  Also keep in mind to respect the licenses of the shaders you use.
                  <br />
                  GET A LICENSE FROM THE SHADER AUTHORS IF YOU USE THEIR WORK IN YOUR COMMERCIAL PROJECTS!
                </p>
              </section>

              {/* Author */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-400 mb-2">Author</h3>
                <div className="flex items-center space-x-2">
                  <UserIcon className="w-4 h-4 text-indigo-500 flex-none" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Arthur Tent</span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <LinkIcon className="w-4 h-4 text-indigo-500 flex-none" />
                  <a
                    href="https://github.com/arthurtent/ShaderAmp"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    github.com/arthurtent/ShaderAmp
                  </a>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <LinkIcon className="w-4 h-4 text-indigo-500 flex-none" />
                  <a
                    href="https://chromewebstore.google.com/detail/shaderamp/pbgkhemojiabmajgkcgjelgpnpoddcgl"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    chrome web store
                  </a>
                </div>
              </section>

              {/* Third-party shader credits */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-400 mb-2">Credits</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">
                  ShaderAmp has multiple contributors and sources. ShaderAmp wouldn't exist without them.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  First and foremost, special thanks to the contributors of the following projects:
                </p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-1 pr-3 font-semibold">What</th>
                      <th className="pb-1 pr-3 font-semibold">Who</th>
                      <th className="pb-1 font-semibold">License</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {/* Projects */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">shadertoy.com</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Inigo Quilez and team</td>
                      <td className="py-1 text-gray-700 dark:text-gray-300"></td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300"><a href="https://github.com/patuwwy/ShaderToy-Chrome-Plugin" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Shadertoy plugin</a></td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Patu</td>
                      <td className="py-1 text-gray-700 dark:text-gray-300"></td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">three.js</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Ricardo Cabello (mrdoob)</td>
                      <td className="py-1 text-gray-700 dark:text-gray-300"></td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">react-three/fiber & drei</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300"><a href="https://github.com/pmndrs/react-three-fiber" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">pmndrs</a></td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">MIT</td>
                    </tr>
                    
                    
                    {/* Cubemaps */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Cubemap faces (abc.jpg)</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300"><a href="http://instagram.com/leen.oaw" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Leen Abdul Wahed</a></td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">CC0</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Cubemap faces (94284d43…_1–_5)</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">M. Maher Mhalhal</td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">CC0</td>
                    </tr>
                    {/* Sprite / fallback texture */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Nyan Cat Sprite</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">
                        <a href="https://www.nyan.cat" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          prguitarman (Chris Torres)
                        </a>
                      </td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">Asked for non-commercial license for ShaderAmp</td>
                    </tr>
                    {/* Shader font texture */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Font / ASCII texture</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">otaviogood
                        <a href="https://www.shadertoy.com/user/otaviogood" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          shadertoy.com
                        </a>/
                        <a href="https://github.com/otaviogood/shader_fontgen" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          github
                        </a>
                      </td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">CC0</td>
                    </tr>
                    {/* Photo textures */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Mountain / landscape texture</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">
                        <a href="https://www.pexels.com/photo/966927" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          Eberhard Grossgasteiger
                        </a>
                      </td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">Pexels License</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Concrete / stone texture</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">
                        <a href="https://www.pexels.com/photo/5622880" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          Piyapong Sayduang
                        </a>
                      </td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">Pexels License</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Organic / landscape texture</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">
                        <a href="https://unsplash.com/photos/_EzTds6Fo44" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          Pierre Bamin
                        </a>
                      </td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">Unsplash License</td>
                    </tr>
                    {/* TODO: find author/license for sky-night-milky-way-star-...jpg */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Night sky / milky way texture</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300"><a href="https://www.pickpik.com/sky-night-milky-way-star-constellations-star-space-138344" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Milky Way at night</a></td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">Public Domain</td>
                    </tr>
                    {/* TODO: find author/license for 38c3_visuals.png */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">38C3 visuals</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300"><a href="https://events.ccc.de/congress/2024/infos/styleguide.html" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">38C3 Styleguide</a></td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">CC0</td>
                    </tr>
                    {/* Icon & event */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">ShaderAmp Icon</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Franz</td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">CC0</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">ShaderAmp release Party</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300"><a href="http://c-base.de/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">c-base</a></td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">sorry, you missed it</td>
                    </tr>
                    {/* ShaderAmp contributors */}
                    <tr>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">ShaderAmp</td>
                      <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">Eamon Woortman, Philipp Kühn,<br/>Kai Rathmann, Jonathan R. Warden, ArthurTent</td>
                      <td className="py-1 text-gray-700 dark:text-gray-300">MIT</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">
                  Special thanks to: Patu, cven, mecci, epunk, ligi, alg, all c-base members, creative code berlin, and last but not least, my wife for being patient with me.
                </p>
                {onOpenLicenses && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        onOpenLicenses();
                        onClose();
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                    >
                      View Third-Party Licenses →
                    </button>
                  </div>
                )}
              </section>

              {/* Links */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-400 mb-2">Links</h3>
                <ul className="space-y-1">
                  <li className="flex items-center space-x-2">
                    <LinkIcon className="w-4 h-4 text-indigo-500 flex-none" />
                    <a href="https://github.com/arthurtent/ShaderAmp" target="_blank" rel="noreferrer"
                      className="text-xs text-indigo-400 hover:underline whitespace-nowrap">
                      GitHub Repository
                    </a>
                  </li>
                  <li className="flex items-center space-x-2">
                    <LinkIcon className="w-4 h-4 text-indigo-500 flex-none" />
                    <a href="https://github.com/arthurtent/ShaderAmp/issues" target="_blank" rel="noreferrer"
                      className="text-xs text-indigo-400 hover:underline whitespace-nowrap">
                      Report an Issue
                    </a>
                  </li>
                </ul>
              </section>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-center px-6 py-3 border-t border-gray-200 dark:border-gray-700">
              <HeartIcon className="w-3 h-3 text-rose-400 mr-1" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Made with love for the <a href="https://en.wikipedia.org/wiki/Demoscene" className="text-indigo-400 hover:underline" target="_blank" rel="noreferrer">demoscene</a> community</p>
            </div>

          </div>
        </div>
      </div>
      <div className="opacity-25 fixed inset-0 z-40 bg-black" />
    </>
  );
}
