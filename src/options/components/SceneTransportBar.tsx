import React, { useState } from 'react';
import { PlayIcon, PauseIcon, StopIcon, BackwardIcon, HandRaisedIcon } from "@heroicons/react/24/outline";

type SceneTransportBarProps = {
    /** The currently selected scene exists */
    hasScene: boolean;
    /** A scene is playing at all */
    isPlaying: boolean;
    /** The selected scene is the one playing */
    isThisPlaying: boolean;
    clockPaused: boolean;
    sceneHold: boolean;
    currentTime: number;
    timelineSeconds: number;
    onPlayFromZero: () => void;
    onPlayOrResume: () => void;
    onPauseClock: () => void;
    onStop: () => void;
    onToggleHold: () => void;
    onSeek: (time: number) => void;
    onTimelineSecondsChange: (seconds: number) => void;
};

function formatTime(seconds: number): string {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const rest = s - m * 60;
    return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

function formatTotal(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function SceneTransportBar({
    hasScene,
    isPlaying,
    isThisPlaying,
    clockPaused,
    sceneHold,
    currentTime,
    timelineSeconds,
    onPlayFromZero,
    onPlayOrResume,
    onPauseClock,
    onStop,
    onToggleHold,
    onSeek,
    onTimelineSecondsChange,
}: SceneTransportBarProps) {
    const [dragging, setDragging] = useState(false);
    const [dragValue, setDragValue] = useState(0);

    const sliderValue = dragging ? dragValue : Math.min(currentTime, timelineSeconds);

    const commitSeek = () => {
        setDragging(false);
        onSeek(dragValue);
    };

    const btn = 'flex items-center justify-center gap-1 px-2 py-1.5 rounded text-sm disabled:bg-gray-700 disabled:text-gray-500';

    return (
        <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-850">
            <button
                onClick={onPlayFromZero}
                disabled={!hasScene}
                className={`${btn} bg-green-600 hover:bg-green-500`}
                title="Reset shader time (iTime / iAmplifiedTime) to 0 and start this scene"
            >
                <BackwardIcon className="w-4 h-4" /> Play from 0
            </button>
            <button
                onClick={onPlayOrResume}
                disabled={!hasScene}
                className={`${btn} bg-emerald-700 hover:bg-emerald-600`}
                title="Start this scene without touching the running shader time"
            >
                <PlayIcon className="w-4 h-4" /> {isThisPlaying && clockPaused ? 'Resume' : 'Play'}
            </button>
            <button
                onClick={onPauseClock}
                disabled={!isThisPlaying || clockPaused}
                className={`${btn} bg-amber-600 hover:bg-amber-500`}
                title="Freeze the shader clock and scene switching"
            >
                <PauseIcon className="w-4 h-4" /> Pause
            </button>
            <button
                onClick={onStop}
                disabled={!isPlaying}
                className={`${btn} bg-red-700 hover:bg-red-600`}
                title="Stop scene playback (shader time keeps running)"
            >
                <StopIcon className="w-4 h-4" /> Stop
            </button>
            <button
                onClick={onToggleHold}
                className={`${btn} ${sceneHold ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title="Freeze scene switching, shader time keeps running"
            >
                <HandRaisedIcon className="w-4 h-4" /> Hold
            </button>
            <input
                type="range"
                min={0}
                max={timelineSeconds}
                step={0.1}
                value={sliderValue}
                disabled={!hasScene}
                className="flex-1 accent-indigo-500"
                onPointerDown={() => { setDragging(true); setDragValue(sliderValue); }}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    // Keyboard arrows change the value without a pointer drag: seek directly
                    if (dragging) setDragValue(v); else onSeek(v);
                }}
                onPointerUp={commitSeek}
            />
            <span className="text-xs text-gray-300 font-mono whitespace-nowrap">
                {formatTime(sliderValue)} / {formatTotal(timelineSeconds)}
            </span>
            <label className="flex items-center gap-1 text-[10px] text-gray-400 whitespace-nowrap">
                Length (s)
                <input
                    type="number"
                    min={10}
                    step={1}
                    disabled={!hasScene}
                    value={timelineSeconds}
                    onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (isFinite(v)) onTimelineSecondsChange(Math.max(10, v));
                    }}
                    className="bg-gray-800 text-xs rounded px-1 py-0.5 w-16"
                />
            </label>
        </div>
    );
}
