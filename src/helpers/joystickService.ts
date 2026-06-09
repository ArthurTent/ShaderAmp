import { logger } from './logger';

export type JoystickEventType = 'axis' | 'button_down' | 'button_up';

export type JoystickEvent = {
    type: JoystickEventType;
    gamepadIndex: number;
    index: number;
    value: number;
    gamepadId: string;
};

export type JoystickInputInfo = {
    index: number;
    id: string;
    axisCount: number;
    buttonCount: number;
};

type JoystickHandler = (event: JoystickEvent) => void;

const AXIS_DEADZONE = 0.05;

const subscribers: Set<JoystickHandler> = new Set();
let rafId: number | null = null;
let initialized = false;

const prevAxisValues: Map<number, number[]> = new Map();
const prevButtonStates: Map<number, boolean[]> = new Map();

const dispatch = (event: JoystickEvent) => {
    subscribers.forEach(fn => fn(event));
};

const poll = () => {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;

        // Poll axes
        let prevAxes = prevAxisValues.get(gp.index);
        if (!prevAxes) {
            prevAxes = new Array(gp.axes.length).fill(0);
            prevAxisValues.set(gp.index, prevAxes);
        }
        for (let a = 0; a < gp.axes.length; a++) {
            const raw = gp.axes[a];
            const value = Math.abs(raw) < AXIS_DEADZONE ? 0 : raw;
            if (Math.abs(value - prevAxes[a]) > AXIS_DEADZONE || (value === 0 && prevAxes[a] !== 0)) {
                prevAxes[a] = value;
                dispatch({ type: 'axis', gamepadIndex: gp.index, index: a, value, gamepadId: gp.id });
            }
        }

        // Poll buttons
        let prevBtns = prevButtonStates.get(gp.index);
        if (!prevBtns) {
            prevBtns = new Array(gp.buttons.length).fill(false);
            prevButtonStates.set(gp.index, prevBtns);
        }
        for (let b = 0; b < gp.buttons.length; b++) {
            const pressed = gp.buttons[b].pressed;
            if (pressed !== prevBtns[b]) {
                prevBtns[b] = pressed;
                dispatch({
                    type: pressed ? 'button_down' : 'button_up',
                    gamepadIndex: gp.index,
                    index: b,
                    value: gp.buttons[b].value,
                    gamepadId: gp.id,
                });
            }
        }
    }
    rafId = requestAnimationFrame(poll);
};

const startPolling = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(poll);
};

const stopPolling = () => {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
};

export const initJoystick = (): boolean => {
    if (initialized) return true;
    if (typeof navigator.getGamepads !== 'function') {
        logger.background.warn('ShaderAmp Joystick', 'Gamepad API not supported in this browser');
        return false;
    }

    window.addEventListener('gamepadconnected', (e) => {
        logger.background.log('ShaderAmp Joystick', 'Gamepad connected: %s (index %d)', e.gamepad.id, e.gamepad.index);
        prevAxisValues.delete(e.gamepad.index);
        prevButtonStates.delete(e.gamepad.index);
        startPolling();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
        logger.background.log('ShaderAmp Joystick', 'Gamepad disconnected: %s (index %d)', e.gamepad.id, e.gamepad.index);
        prevAxisValues.delete(e.gamepad.index);
        prevButtonStates.delete(e.gamepad.index);
        if (getJoystickInputs().length === 0) stopPolling();
    });

    initialized = true;

    // If gamepads are already connected (e.g. page reload), start polling immediately
    const existing = Array.from(navigator.getGamepads()).filter(Boolean);
    if (existing.length > 0) {
        logger.background.log('ShaderAmp Joystick', 'Found %d already-connected gamepad(s)', existing.length);
        startPolling();
    } else {
        logger.background.log('ShaderAmp Joystick', 'Initialized — waiting for gamepad connection');
    }

    return true;
};

export const getJoystickInputs = (): JoystickInputInfo[] => {
    const result: JoystickInputInfo[] = [];
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp) result.push({ index: gp.index, id: gp.id, axisCount: gp.axes.length, buttonCount: gp.buttons.length });
    }
    return result;
};

export const isJoystickInitialized = (): boolean => initialized;

export const subscribe = (handler: JoystickHandler): void => {
    subscribers.add(handler);
};

export const unsubscribe = (handler: JoystickHandler): void => {
    subscribers.delete(handler);
};

export const disposeJoystick = (): void => {
    stopPolling();
    subscribers.clear();
    prevAxisValues.clear();
    prevButtonStates.clear();
    initialized = false;
};

let relayActive = false;

export const relayEventsToContentScript = async (): Promise<void> => {
    if (relayActive) return;
    relayActive = true;
    const browser = (await import('webextension-polyfill')).default;
    subscribe((evt) => {
        // Send to background, which will forward to the content tab
        browser.runtime.sendMessage({ type: 'RELAY_JOYSTICK_EVENT', event: evt }).catch(() => {});
    });
};
