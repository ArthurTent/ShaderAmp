import { createGamepadUniformValue, fillGamepadUniform, injectGamepadUniform, GAMEPAD_GLSL } from './gamepadUniform';

describe('injectGamepadUniform', () => {
    it('leaves shaders that do not use iGamepad untouched', () => {
        const code = 'void mainImage(out vec4 c, in vec2 f) { c = vec4(1.0); }';
        expect(injectGamepadUniform(code)).toBe(code);
    });

    it('declares iGamepad once when used', () => {
        const code = 'void mainImage(out vec4 c, in vec2 f) { c = iGamepad.stick[0] + vec4(iGamepad.trigger[1]); }';
        const out = injectGamepadUniform(code);
        expect(out.startsWith(GAMEPAD_GLSL)).toBe(true);
        expect(out.match(/uniform ShaderAmpGamepad iGamepad;/g)).toHaveLength(1);
        expect(injectGamepadUniform(out)).toBe(out);
    });

    it('keeps #version and #extension first', () => {
        const code = '#version 300 es\n#extension GL_OES_foo : enable\nfloat x = iGamepad.home;';
        const lines = injectGamepadUniform(code).split('\n');
        expect(lines[0]).toBe('#version 300 es');
        expect(lines[1]).toBe('#extension GL_OES_foo : enable');
        expect(lines[2]).toBe('struct ShaderAmpGamepad {');
    });

    it('does not redeclare a shader-provided iGamepad', () => {
        const code = 'struct G { float home; };\nuniform G iGamepad;\nfloat x = iGamepad.home;';
        expect(injectGamepadUniform(code)).toBe(code);
    });
});

describe('fillGamepadUniform', () => {
    it('maps the W3C standard layout', () => {
        const v = createGamepadUniformValue();
        const buttons = Array.from({ length: 17 }, (_, i) => (i + 1) / 100);
        fillGamepadUniform(v, [0.1, -0.2, 0.3, -0.4], buttons);
        expect(v.connected).toBe(1);
        expect(v.buttons.toArray()).toEqual([0.01, 0.02, 0.03, 0.04]);
        expect(v.bumper.toArray()).toEqual([0.05, 0.06]);
        expect(v.trigger.toArray()).toEqual([0.07, 0.08]);
        expect(v.controls.toArray()).toEqual([0.09, 0.1]);
        expect(v.stick[0].toArray()).toEqual([0.1, -0.2, 0.11, 0]);
        expect(v.stick[1].toArray()).toEqual([0.3, -0.4, 0.12, 0]);
        expect(v.dpad.toArray()).toEqual([0.13, 0.14, 0.15, 0.16]);
        expect(v.home).toBe(0.17);
    });

    it('tolerates short arrays and resets when disconnected', () => {
        const v = createGamepadUniformValue();
        fillGamepadUniform(v, [0.5], [1]);
        expect(v.buttons.x).toBe(1);
        expect(v.stick[0].toArray()).toEqual([0.5, 0, 0, 0]);
        expect(v.home).toBe(0);
        fillGamepadUniform(v, [], null);
        expect(v.connected).toBe(0);
        expect(v.buttons.x).toBe(0);
        expect(v.stick[0].x).toBe(0);
    });
});
