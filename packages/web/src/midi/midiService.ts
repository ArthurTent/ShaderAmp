// Port of ShaderAmp/src/helpers/midiService.ts — Web MIDI access + event fan-out.
import type { MidiEvent, MidiInputInfo } from '../types';

type MidiHandler = (event: MidiEvent) => void;

export class MidiService {
    private midiAccess: MIDIAccess | null = null;
    private subscribers = new Set<MidiHandler>();
    private initialized = false;

    private dispatch = (event: MidiEvent) => {
        this.subscribers.forEach((fn) => fn(event));
    };

    private onMidiMessage(inputId: string, inputName: string, msg: MIDIMessageEvent) {
        const data = msg.data;
        if (!data || data.length < 2) return;

        const statusByte = data[0];
        const type = statusByte >> 4;
        const channel = statusByte & 0x0f;
        const number = data[1];
        const value = data.length > 2 ? data[2] : 0;

        if (type === 0x9 && value > 0) {
            this.dispatch({ type: 'noteon', channel, number, value, inputId, inputName });
        } else if (type === 0x8 || (type === 0x9 && value === 0)) {
            this.dispatch({ type: 'noteoff', channel, number, value: 0, inputId, inputName });
        } else if (type === 0xb) {
            this.dispatch({ type: 'cc', channel, number, value, inputId, inputName });
        }
    }

    private bindInputs() {
        if (!this.midiAccess) return;
        (this.midiAccess.inputs as unknown as Map<string, MIDIInput>).forEach((input) => {
            input.onmidimessage = (msg: Event) => {
                this.onMidiMessage(input.id, input.name || input.id, msg as MIDIMessageEvent);
            };
        });
    }

    async init(): Promise<boolean> {
        if (this.initialized && this.midiAccess) return true;
        if (!navigator.requestMIDIAccess) {
            console.warn('[shaderamp] Web MIDI API not supported in this browser');
            return false;
        }
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            this.bindInputs();
            this.midiAccess.onstatechange = () => this.bindInputs();
            this.initialized = true;
            return true;
        } catch (err) {
            console.warn('[shaderamp] MIDI access denied or error: %s', err);
            return false;
        }
    }

    getInputs(): MidiInputInfo[] {
        if (!this.midiAccess) return [];
        const inputs: MidiInputInfo[] = [];
        (this.midiAccess.inputs as unknown as Map<string, MIDIInput>).forEach((input) => {
            inputs.push({ id: input.id, name: input.name || input.id });
        });
        return inputs;
    }

    get isInitialized(): boolean {
        return this.initialized && this.midiAccess !== null;
    }

    subscribe(handler: MidiHandler): () => void {
        this.subscribers.add(handler);
        return () => this.subscribers.delete(handler);
    }

    dispose(): void {
        if (this.midiAccess) {
            (this.midiAccess.inputs as unknown as Map<string, MIDIInput>).forEach((input) => {
                input.onmidimessage = null;
            });
        }
        this.subscribers.clear();
        this.midiAccess = null;
        this.initialized = false;
    }
}
