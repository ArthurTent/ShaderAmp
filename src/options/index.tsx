import React from 'react';
import {createRoot} from "react-dom/client";
import OptionsComponent from './components/OptionsContent';

import '@src/css/app.css';
import OptionsSidebar from './components/OptionsSidebar';

const App: React.FC = () => {
    return (
        <div className="flex h-screen scrollbar-thumb-gray-500 scrollbar-track-gray-700 scrollbar-none">
            <nav className="w-1/4 bg-white dark:bg-indigo-950 sticky top-0 
                overflow-y-auto scrollbar-thin">
                <OptionsSidebar/>
            </nav>

            <main className="w-3/4 overflow-y-scroll scrollbar-thin">
                <OptionsComponent/>
            </main>
        </div>
    );
};

const container = document.getElementById('options-root');
const root = createRoot(container!);
root.render(
    <App />
);
