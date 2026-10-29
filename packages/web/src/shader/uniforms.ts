import {
    DataTexture,
    FloatType,
    NearestFilter,
    RedFormat,
    RGBAFormat,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import type { IUniform, Texture } from 'three';
import {
    FFT_TEXTURE_WIDTH,
    KEYBOARD_TEXTURE_HEIGHT,
    KEYBOARD_TEXTURE_WIDTH,
} from '../constants';
import type { ShaderUniform } from '../types';
import { createKeyboardState } from '../input/keyboardTexture';

export type SharedUniforms = { [key: string]: IUniform };
export type PassUniforms = { [key: string]: IUniform };

const blackDataTexture = (width: number, height: number) => {
    const tex = new DataTexture(new Uint8Array(width * height), width, height, RedFormat);
    tex.needsUpdate = true;
    return tex;
};

export function createSharedUniforms(sampleRate: number): SharedUniforms {
    const audioData = new DataTexture(new Uint8Array(FFT_TEXTURE_WIDTH), FFT_TEXTURE_WIDTH, 1, RedFormat);
    audioData.needsUpdate = true;
    // Float texture: rows 3/4 hold key press/release times in seconds
    const keyboard = new DataTexture(
        createKeyboardState().data,
        KEYBOARD_TEXTURE_WIDTH,
        KEYBOARD_TEXTURE_HEIGHT,
        RGBAFormat,
        FloatType,
    );
    keyboard.minFilter = NearestFilter;
    keyboard.magFilter = NearestFilter;
    keyboard.needsUpdate = true;
    return {
        iAmplifiedTime: { value: 0.1 },
        iTime: { value: 0.1 },
        iTimeDelta: { value: 0.0 },
        iFrameRate: { value: 60.0 },
        iFrame: { value: 0 },
        iDate: { value: getDateVector() },
        iAudioData: { value: audioData },
        iSampleRate: { value: sampleRate },
        iResolution: { value: new Vector3(1, 1, 1) },
        iVideo: { value: null as Texture | null },
        iMouse: { value: new Vector4(0, 0, 0, 0) },
        iKeyboard: { value: keyboard },
        iMidi: { value: blackDataTexture(128, 4) },
        iJoystick: { value: blackDataTexture(32, 4) },
        iVRMode: { value: 0 },
    };
}

export function createCustomUniformMap(defs?: ShaderUniform[]): Record<string, IUniform> {
    const map: Record<string, IUniform> = {};
    for (const def of defs ?? []) {
        map[def.name] = { value: toUniformValue(def, def.default) };
    }
    return map;
}

export function createPassUniforms(
    shared: SharedUniforms,
    custom?: ShaderUniform[] | Record<string, IUniform>,
    opts?: { main?: boolean },
): PassUniforms {
    const customMap = Array.isArray(custom) || custom === undefined
        ? createCustomUniformMap(custom as ShaderUniform[] | undefined)
        : custom;
    const uniforms: PassUniforms = { ...shared };
    uniforms.iChannel0 = { value: null as Texture | null };
    uniforms.iChannel1 = { value: null as Texture | null };
    uniforms.iChannel2 = { value: null as Texture | null };
    uniforms.iChannel3 = { value: null as Texture | null };
    uniforms.iChannelResolution = {
        value: [new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1)],
    };
    uniforms.iChannelTime = { value: [0, 0, 0, 0] };
    if (opts?.main) {
        uniforms.iTransitionOpacity = { value: 1.0 };
    }
    Object.assign(uniforms, customMap);
    return uniforms;
}

export function toUniformValue(def: ShaderUniform, raw: number | number[] | boolean): any {
    switch (def.type) {
        case 'int':
            return Math.floor(raw as number);
        case 'bool':
            return raw ? 1.0 : 0.0;
        case 'vec2':
            return Array.isArray(raw) ? new Vector2(...(raw as [number, number])) : new Vector2(raw as number, raw as number);
        case 'vec3':
            return Array.isArray(raw) ? new Vector3(...(raw as [number, number, number])) : new Vector3(raw as number, raw as number, raw as number);
        case 'vec4':
            return Array.isArray(raw)
                ? new Vector4(...(raw as [number, number, number, number]))
                : new Vector4(raw as number, raw as number, raw as number, raw as number);
        default:
            return raw as number;
    }
}

export function getDateVector(): Vector4 {
    const d = new Date();
    return new Vector4(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000,
    );
}
