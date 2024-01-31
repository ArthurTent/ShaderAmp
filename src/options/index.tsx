import React from 'react';
import {createRoot} from "react-dom/client";
import OptionsComponent from './Options';

const App: React.FC = () => {
    return (
        <OptionsComponent />
    );
};

const container = document.getElementById('options-root');
const root = createRoot(container!);
root.render(
    <App />
);
