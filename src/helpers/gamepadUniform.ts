import { Vector2, Vector4 } from 'three';

/**
 * Shadertoy-compatible `iGamepad` uniform.
 *
 * Shadertoy injects this struct into every pass; shaders use it without declaring it.
 * GLSL ES cannot name the struct type and the instance the same, so a named type is used.
 */
export const GAMEPAD_GLSL = [
    'struct ShaderAmpGamepad {',
    '    vec4  stick[2];   // [0]=left, [1]=right, .xy=axes, .z=press',
    '    vec4  buttons;    // .x=bottom, .y=right, .z=left, .w=top',
    '    vec2  bumper;     // .x=left, .y=right',
    '    vec2  trigger;    // .x=left, .y=right',
    '    vec4  dpad;       // .x=up, .y=down, .z=left, .w=right',
    '    vec2  controls;   // .x=View/Share/+, .y=Menu/Options/-',
    '    float home;',
    '    float connected;  // 0.0=off, 1.0=on',
    '};',
    'uniform ShaderAmpGamepad iGamepad;',
].join('\n') + '\n';

const USES_GAMEPAD = /\biGamepad\b/;
const DECLARES_GAMEPAD = /\buniform\s+\w+\s+iGamepad\b|\buniform\s+struct\b[^;]*\biGamepad\b/;

export const usesGamepadUniform = (code: string): boolean => !!code && USES_GAMEPAD.test(code);

/** Insert the iGamepad declaration when the code uses it and does not declare it itself. */
export function injectGamepadUniform(code: string): string {
    if (!usesGamepadUniform(code) || DECLARES_GAMEPAD.test(code)) return code;
    // Keep #version / #extension directives first.
    const lines = code.split('\n');
    let i = 0;
    while (i < lines.length && /^\s*(#\s*(version|extension)\b|$)/.test(lines[i])) i++;
    lines.splice(i, 0, GAMEPAD_GLSL);
    return lines.join('\n');
}

export type GamepadUniformValue = {
    stick: [Vector4, Vector4];
    buttons: Vector4;
    bumper: Vector2;
    trigger: Vector2;
    dpad: Vector4;
    controls: Vector2;
    home: number;
    connected: number;
};

export function createGamepadUniformValue(): GamepadUniformValue {
    return {
        stick: [new Vector4(), new Vector4()],
        buttons: new Vector4(),
        bumper: new Vector2(),
        trigger: new Vector2(),
        dpad: new Vector4(),
        controls: new Vector2(),
        home: 0,
        connected: 0,
    };
}

/**
 * Fill the uniform from W3C "standard" gamepad layout values.
 * `buttons` holds button values (0..1, analog for triggers); null = no gamepad connected.
 * Axes are passed through raw (y down = +), as on Shadertoy.
 */
export function fillGamepadUniform(value: GamepadUniformValue, axes: ArrayLike<number>, buttons: ArrayLike<number> | null): void {
    if (!buttons) {
        value.stick[0].set(0, 0, 0, 0);
        value.stick[1].set(0, 0, 0, 0);
        value.buttons.set(0, 0, 0, 0);
        value.bumper.set(0, 0);
        value.trigger.set(0, 0);
        value.dpad.set(0, 0, 0, 0);
        value.controls.set(0, 0);
        value.home = 0;
        value.connected = 0;
        return;
    }
    const b = (i: number) => (i < buttons.length ? buttons[i] || 0 : 0);
    const a = (i: number) => (i < axes.length ? axes[i] || 0 : 0);
    value.buttons.set(b(0), b(1), b(2), b(3));
    value.bumper.set(b(4), b(5));
    value.trigger.set(b(6), b(7));
    value.controls.set(b(8), b(9));
    value.stick[0].set(a(0), a(1), b(10), 0);
    value.stick[1].set(a(2), a(3), b(11), 0);
    value.dpad.set(b(12), b(13), b(14), b(15));
    value.home = b(16);
    value.connected = 1;
}

/** First connected gamepad from the Gamepad API, or null. */
export function readFirstGamepad(): { axes: readonly number[]; buttons: number[] } | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
    let pads: (Gamepad | null)[];
    try { pads = Array.from(navigator.getGamepads()); } catch { return null; }
    const gp = pads.find(p => p && p.connected);
    if (!gp) return null;
    return { axes: gp.axes, buttons: gp.buttons.map(btn => btn.value || (btn.pressed ? 1 : 0)) };
}
