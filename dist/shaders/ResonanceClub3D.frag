// https://www.shadertoy.com/view/sXV3zR
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Resonance Club 3D (audio)
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

// 2026-09-20 21:49:29
/*
 * ============================================================================
 * SHADER: Resonance Club 3D (Audio-Reactive)
 * AUTHOR: dathor (https://www.shadertoy.com/user/dathor)
 * ----------------------------------------------------------------------------
 * DESCRIPTION:
 * An audio-reactive, raymarched "nightclub scene" featuring a central dot-matrix 
 * cube surrounded by dual concentric audio-reactive rings and a glitching video wall. 
 * Driven by an sequence manager that dynamically adapts camera pacing, 
 * movement speed, and volumetric laser sweeps directly to the track's audio energy.
 *
 * Features:
 * - FFT Sound Array: 8-band audio processing with automatic gain control & tilt
 * - Multi-Bounce Raymarching: Pure physical reflections and soft shadow mapping
 * - Dynamic Camera System: 20 distinct camera shots with audio-driven velocity, 
 *   parabolic whip-pans, and rhythmic beat-snapping focus
 * - Volumetric Lighting: Overhead key light, 4 orbiting plasma orbs, floor fog, 
 *   and audio-reactive laser beams with smoke scattering
 * - Cinematic Post-Processing: Depth-of-Field (DOF) with bleed mitigation, 
 *   bokeh chromatic aberration, and a 2.35:1 Cinemascope mask
 * ----------------------------------------------------------------------------
 * AUDIO / PLAYBACK NOTE: 
 * Bound audio track to Buffer A / iChannel0 - "X'trackTure" Track
 * If audio doesn't start automatically, press the rewind/play button in Shadertoy.
 * ============================================================================
 */

vec3 getScene(vec2 uv) {
    return texture(iChannel0, uv).rgb;
}

vec3 applyDOF(vec2 uv, vec2 res, float focusDist, float focusRangeNear, float focusRangeFar, float maxRadiusPx) {
    float depth = texture(iChannel0, uv).w;

    float coc = (depth < focusDist)
        ? clamp((focusDist - depth) / focusRangeNear, 0.0, 1.0)
        : clamp((depth - focusDist) / focusRangeFar, 0.0, 1.0);

    float radiusPx = coc * maxRadiusPx;

    const float DOF_SKIP_THRESHOLD = 0.6; 
    if (radiusPx < DOF_SKIP_THRESHOLD) return getScene(uv);

    vec2 pxToUV = 1.0 / res;
    vec3 sum = getScene(uv);
    float total = 1.0;

    const float GOLDEN_ANGLE = 2.39996; 
    for (int i = 0; i < 16; i++) {
        float t = float(i) + 0.5;
        float ang = t * GOLDEN_ANGLE;
        float r = radiusPx * sqrt(t / 16.0);

        vec2 offs = vec2(cos(ang), sin(ang)) * r * pxToUV;

        float sDepth = texture(iChannel0, uv + offs).w;
        float sCoc = (sDepth < focusDist)
            ? clamp((focusDist - sDepth) / focusRangeNear, 0.0, 1.0)
            : clamp((sDepth - focusDist) / focusRangeFar, 0.0, 1.0);
        float w = mix(0.3, 1.0, sCoc);

        sum += getScene(uv + offs) * w;
        total += w;
    }
    return sum / total;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float focusDist     = 4.0; 
    float focusRangeNear = 1.6;
    float focusRangeFar  = 4.0; 
    float maxRadiusPx    = 6.0; 

    vec3 finalColor = applyDOF(uv, iResolution.xy, focusDist, focusRangeNear, focusRangeFar, maxRadiusPx);


    float currentAspect = iResolution.x / iResolution.y;
    float targetAspect = 2.35;
    float barHeight = max(0.0, (1.0 - (currentAspect / targetAspect)) * 0.5);
    float cinemascopeMask = step(barHeight, uv.y) * step(uv.y, 1.0 - barHeight);
    finalColor *= cinemascopeMask;

    fragColor = vec4(finalColor, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
