import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ShaderAmpCanvas } from '../src/react/index';
import type { ShaderAmp } from '../src/index';

function App() {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const ampRef = React.useRef<ShaderAmp | null>(null);
    const fileRef = React.useRef<HTMLInputElement | null>(null);
    const [shaders, setShaders] = React.useState<string[]>([]);

    return (
        <div>
            <ShaderAmpCanvas
                ref={ampRef}
                className="viz"
                source={audioRef}
                assetBaseUrl="/assets/"
                controls={true}
                onReady={(amp) => {
                    (window as any).amp = amp;
                    void amp.listShaders().then((list) => setShaders(list.map((s) => s.shaderName)));
                }}
                onError={(e) => console.error('[react-demo]', e)}
            />
            <div className="row">
                <audio ref={audioRef} controls crossOrigin="anonymous" style={{ width: 360 }} />
                <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,video/*"
                    onChange={() => {
                        const f = fileRef.current?.files?.[0];
                        const el = audioRef.current;
                        if (f && el) {
                            el.src = URL.createObjectURL(f);
                            void el.play();
                        }
                    }}
                />
            </div>
            <div className="row">
                <select onChange={(e) => void ampRef.current?.loadShader(e.target.value)}>
                    {shaders.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <button type="button" onClick={() => void ampRef.current?.next()}>Next</button>
                <button type="button" onClick={() => void ampRef.current?.toggleFullscreen()}>Fullscreen</button>
            </div>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
