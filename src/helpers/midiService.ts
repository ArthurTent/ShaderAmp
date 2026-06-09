import { logger } from './logger';

export type MidiEventType = 'noteon' | 'noteoff' | 'cc';

export type MidiEvent = {
    type: MidiEventType;
    channel: number;
    number: number;
    value: number;
    inputId: string;
    inputName: string;
};

export type MidiInputInfo = {
    id: string;
    name: string;
};

type MidiHandler = (event: MidiEvent) => void;

let midiAccess: MIDIAccess | null = null;
const subscribers: Set<MidiHandler> = new Set();
let initialized = false;

const dispatch = (event: MidiEvent) => {
    subscribers.forEach(fn => fn(event));
};

const onMidiMessage = (inputId: string, inputName: string, msg: MIDIMessageEvent) => {
    const data = msg.data;
    if (!data || data.length < 2) return;

    const statusByte = data[0];
    const type = statusByte >> 4;
    const channel = statusByte & 0x0f;
    const number = data[1];
    const value = data.length > 2 ? data[2] : 0;

    if (type === 0x9 && value > 0) {
        dispatch({ type: 'noteon', channel, number, value, inputId, inputName });
    } else if (type === 0x8 || (type === 0x9 && value === 0)) {
        dispatch({ type: 'noteoff', channel, number, value: 0, inputId, inputName });
    } else if (type === 0xb) {
        dispatch({ type: 'cc', channel, number, value, inputId, inputName });
    }
};

const bindInputs = () => {
    if (!midiAccess) return;
    (midiAccess.inputs as unknown as Map<string, MIDIInput>).forEach((input) => {
        input.onmidimessage = (msg: Event) => {
            onMidiMessage(input.id, input.name || input.id, msg as MIDIMessageEvent);
        };
    });
};

export const initMidi = async (): Promise<boolean> => {
    if (initialized && midiAccess) return true;
    if (!navigator.requestMIDIAccess) {
        logger.background.warn('ShaderAmp MIDI', 'Web MIDI API not supported in this browser');
        return false;
    }
    try {
        midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        bindInputs();
        midiAccess.onstatechange = () => bindInputs();
        initialized = true;
        const inputMap = midiAccess.inputs as unknown as Map<string, MIDIInput>;
        logger.background.log('ShaderAmp MIDI', 'Initialized with %d inputs', inputMap.size);
        return true;
    } catch (err) {
        logger.background.warn('ShaderAmp MIDI', 'Access denied or error: %s', err);
        return false;
    }
};

export const getMidiInputs = (): MidiInputInfo[] => {
    if (!midiAccess) return [];
    const inputs: MidiInputInfo[] = [];
    (midiAccess.inputs as unknown as Map<string, MIDIInput>).forEach((input) => {
        inputs.push({ id: input.id, name: input.name || input.id });
    });
    return inputs;
};

export const isMidiInitialized = (): boolean => initialized && midiAccess !== null;

export const subscribe = (handler: MidiHandler): void => {
    subscribers.add(handler);
};

export const unsubscribe = (handler: MidiHandler): void => {
    subscribers.delete(handler);
};

export const disposeMidi = (): void => {
    if (midiAccess) {
        (midiAccess.inputs as unknown as Map<string, MIDIInput>).forEach(input => { input.onmidimessage = null; });
    }
    subscribers.clear();
    midiAccess = null;
    initialized = false;
};
