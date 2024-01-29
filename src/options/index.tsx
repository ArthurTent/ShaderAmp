import React from 'react';
import {createRoot} from "react-dom/client";
import OptionsComponent from './Options';
import { store } from '@src/app/store';
import { Provider } from 'react-redux';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';

let persistor = persistStore(store)

const App: React.FC = () => {
    return (
        <OptionsComponent />
    );
};

const container = document.getElementById('options-root');
const root = createRoot(container!);
root.render(<Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
        <App />
    </PersistGate>
</Provider>);
