import { GAMEPAD_GLSL } from './gamepadUniform';

/**
 * Single source of truth for the built-in uniforms ShaderAmp provides to every pass
 * (Shadertoy set plus ShaderAmp extras). The shader editor derives its compile preamble,
 * the declarations it strips from user code and the "not a custom uniform" list from here.
 */
export type BuiltinUniform = { name: string; decl: string };

export const BUILTIN_UNIFORMS: BuiltinUniform[] = [
    // Shadertoy
    { name: 'iResolution', decl: 'uniform vec3 iResolution;' },
    { name: 'iTime', decl: 'uniform float iTime;' },
    { name: 'iTimeDelta', decl: 'uniform float iTimeDelta;' },
    { name: 'iFrameRate', decl: 'uniform float iFrameRate;' },
    { name: 'iFrame', decl: 'uniform int iFrame;' },
    { name: 'iChannelTime', decl: 'uniform float iChannelTime[4];' },
    { name: 'iChannelResolution', decl: 'uniform vec3 iChannelResolution[4];' },
    { name: 'iMouse', decl: 'uniform vec4 iMouse;' },
    { name: 'iDate', decl: 'uniform vec4 iDate;' },
    { name: 'iSampleRate', decl: 'uniform float iSampleRate;' },
    { name: 'iGamepad', decl: GAMEPAD_GLSL.trimEnd() },
    // ShaderAmp extras
    { name: 'iAmplifiedTime', decl: 'uniform float iAmplifiedTime;' },
    { name: 'iAudioData', decl: 'uniform sampler2D iAudioData;' },
    { name: 'iVideo', decl: 'uniform sampler2D iVideo;' },
    { name: 'iKeyboard', decl: 'uniform sampler2D iKeyboard;' },
    { name: 'iMidi', decl: 'uniform sampler2D iMidi;' },
    { name: 'iJoystick', decl: 'uniform sampler2D iJoystick;' },
    { name: 'iTransitionOpacity', decl: 'uniform float iTransitionOpacity;' },
];

export const CHANNEL_UNIFORM_NAMES = ['iChannel0', 'iChannel1', 'iChannel2', 'iChannel3'] as const;

/** Every built-in uniform name, channels included. */
export const BUILTIN_UNIFORM_NAMES: string[] = [...BUILTIN_UNIFORMS.map(u => u.name), ...CHANNEL_UNIFORM_NAMES];

export type ChannelSamplerKind = 'cubemap' | 'volume' | string | undefined;

/** `uniform samplerXX iChannelN;` with XX = 2D / Cube / 3D, as on Shadertoy. */
export function channelDeclaration(index: number, kind: ChannelSamplerKind): string {
    const sampler = kind === 'cubemap' ? 'samplerCube' : kind === 'volume' ? 'highp sampler3D' : 'sampler2D';
    return `uniform ${sampler} ${CHANNEL_UNIFORM_NAMES[index]};`;
}

/** All built-in declarations, one line per array entry; channel types default to 2D. */
export function builtinDeclarations(channelKinds: ChannelSamplerKind[] = []): string[] {
    return [
        ...BUILTIN_UNIFORMS.flatMap(u => u.decl.split('\n')),
        ...CHANNEL_UNIFORM_NAMES.map((_, i) => channelDeclaration(i, channelKinds[i])),
    ];
}
