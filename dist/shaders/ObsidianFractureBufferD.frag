// https://www.shadertoy.com/view/sXtXzS
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Obsidian Fracture (audio) - Buffer D
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;

varying vec2 vUv;


// === Common Code ===

// 1015
vec2 getTunnelCenter(float z, float t) {
    return vec2(-sin(z * 0.8 + t * 0.4) * 0.3, -cos(z * 0.9 + t * 0.3) * 0.3);
}
mat3 setCamera(in vec3 ro, in vec3 ta, float cr) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(cr), cos(cr), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = cross(cu, cw);
    return mat3(cu, cv, cw);
}

// === End Common Code ===


// 1015
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    if (fragCoord.x > 1.0 || fragCoord.y > 1.0) {
        discard;
    }

    float bass = texture(iAudioData, vec2(0.05, 0.25)).x * 1.4;
    float treble = texture(iAudioData, vec2(0.70, 0.25)).x * 1.4;

    float glitchPeak = smoothstep(0.45, 0.85, bass);

    float volPump = smoothstep(0.35, 0.85, bass);

    fragColor = vec4(bass, treble, glitchPeak, volPump);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
