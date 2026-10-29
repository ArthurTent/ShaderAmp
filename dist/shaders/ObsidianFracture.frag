// https://www.shadertoy.com/view/sXtXzS
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Obsidian Fracture (audio)
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
/*
 * ============================================================================
 * SHADER: Obsidian Fracture (X'TrackTure Cut)
 * AUTHOR: dathor (https://www.shadertoy.com/user/dathor)
 * ----------------------------------------------------------------------------
 * DESCRIPTION:
 * An enhanced version of "Cosmic Candy Rock Trip" (https://www.shadertoy.com/view/sX3SzB),
 * heavily inspired by prior work. Development is done partly in my WGSL tool 
 * TinyShade, VSCode, and Nullpunk42 tools. Finalized and adjusted in ShaderToy.
 * 
 * A wild cruise through and outside a carved 4D Julia fractal wormhole. 
 * Features a 12-cam sequencer jumping between sweeping exterior fly-bys and 
 * fast interior tunnel dives. Hope you like it!
 *
 * Buffer A handles the dynamic camera sequencing, while this Image 
 * tab applies TAA, radial DOF, anamorphic streaks, and audio-reactive 
 * glitches (UV tearing, chromatic aberration, gentle strobes & beat zooms) 
 * synced to fast tracker/breakcore beats.
 * ----------------------------------------------------------------------------
 * AUDIO / PLAYBACK NOTE: 
 * Buffer D processes the audio ("X'trackTure" Track).
 * If audio doesn't start automatically, press the rewind/play button in Shadertoy.
 * 
 * SETUP FOR THIS TAB:
 * iChannel0 = Buffer B (Main Render)
 * iChannel1 = Buffer D (Audio Processor)
 * ----------------------------------------------------------------------------
 * DEVELOPER NOTE:
 * Thanks to mrange, shane, IQ, Dave Hoskins, Artur Tent, msm01, diatribes, 
 * and many more for the inspiration and sharing tricks!
 * ============================================================================
*/


float hash11(float n) { 
    return fract(sin(n) * 43758.5453123); 
}

vec3 radialDOF(sampler2D tex, vec2 uv, float blurRadius, float aspect) {
    vec3 col = vec3(0.0);
    float tot = 0.0;

    const float goldenAngle = 2.39996323;
    const float iterations = 100.0;

    for (float i = 0.0; i < iterations; i++) {
        float r = sqrt(i / iterations) * blurRadius;
        float theta = i * goldenAngle;

        vec2 offset = vec2(cos(theta), sin(theta)) * r;
        offset.x /= aspect;

        vec3 smpl = texture(tex, uv + offset).rgb;

        float luma = dot(smpl, vec3(0.299, 0.587, 0.114));
        float w = 1.0 / (1.0 + luma * 2.0);

        col += smpl * w;
        tot += w;
    }
    return col / max(tot, 0.0001);
}

vec3 bloomBrightPass(sampler2D tex, vec2 uv, float threshold) {
    vec3 col = vec3(0.0);
    float totWeight = 0.0;
    const float taps = 24.0;
    const float goldenAngle = 2.39996323;

    for (float i = 0.0; i < taps; i++) {
        float r = sqrt(i / taps) * 0.018; 
        float theta = i * goldenAngle;
        vec2 offset = vec2(cos(theta), sin(theta)) * r;

        vec3 smpl = texture(tex, uv + offset).rgb;
        float luma = dot(smpl, vec3(0.299, 0.587, 0.114));

        vec3 bright = max(smpl - threshold, vec3(0.0));
        float karisWeight = 1.0 / (1.0 + luma);

        col += bright * karisWeight;
        totWeight += karisWeight;
    }
    return col / max(totWeight, 0.0001);
}

vec3 anamorphicStreak(sampler2D tex, vec2 uv, vec2 ts, float threshold) {
    vec3 streak = vec3(0.0);
    float tot = 0.0;

    for (float i = 1.0; i <= 22.0; i++) {
        float w = 1.0 / sqrt(i);
        vec2 off = vec2(i * ts.x * 3.5, 0.0);

        vec3 sR = texture(tex, uv + off).rgb;
        vec3 sL = texture(tex, uv - off).rgb;

        vec3 bR = max(sR - threshold, vec3(0.0));
        vec3 bL = max(sL - threshold, vec3(0.0));

        vec3 tintR = mix(vec3(1.0), vec3(0.35, 0.75, 1.0), 0.6);
        vec3 tintL = mix(vec3(1.0), vec3(0.35, 0.75, 1.0), 0.6);

        streak += (bR * tintR + bL * tintL) * w;
        tot += w * 2.0;
    }
    return streak / max(tot, 0.0001);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 ts = 1.0 / iResolution.xy;
    vec2 uv = fragCoord * ts;

    float targetAspect = 2.35;
    float aspect = iResolution.x / iResolution.y;
    float barH = max(0.0, (1.0 - (aspect / targetAspect)) * 0.5);

    if (uv.y < barH || uv.y > 1.0 - barH) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 audioData = texelFetch(iChannel1, ivec2(0, 0), 0);
    float bass = audioData.r;
    float treble = audioData.g;
    float peak = audioData.b;

    float zoomAmount = peak * 0.035; 
    uv = (uv - 0.5) * (1.0 - zoomAmount) + 0.5;

    float trackerBeat = floor(iTime * 12.0); 
    
    float glitchTrig = step(0.80, hash11(trackerBeat * 1.3)) * peak;
    float strobeTrig = step(0.85, hash11(trackerBeat * 2.7)) * peak;

    vec2 tc = uv;
    if (glitchTrig > 0.0) {
        float sliceY = floor(tc.y * mix(12.0, 32.0, hash11(trackerBeat)));
        
        float offset = (hash11(sliceY + trackerBeat) - 0.5) * 0.10;
        tc.x += offset * step(0.5, hash11(sliceY * 0.5 + trackerBeat));
        
        if (hash11(trackerBeat * 1.5) > 0.88) {
            tc.y = fract(tc.y + offset * 0.3);
        }
    }

    float seqLength = 10.0;
    float localTime = mod(iTime, seqLength);
    float whipDur = 0.40;

    float wIn = 1.0 - smoothstep(0.0, whipDur, localTime);
    float wOut = smoothstep(seqLength - whipDur, seqLength, localTime);
    float wInt = clamp(wIn + wOut, 0.0, 1.0);

    float caStrength = 0.004 + (glitchTrig * 0.03) + (treble * 0.012);
    vec2 caOffset = (tc - 0.5) * length(tc - 0.5) * caStrength;
    
    float r = texture(iChannel0, tc - caOffset).r;
    float g = texture(iChannel0, tc).g;
    float b = texture(iChannel0, tc + caOffset).b;
    vec3 col = vec3(r, g, b);

    vec2 centerUV = tc - 0.5;
    centerUV.x *= aspect;
    float dist = length(centerUV);

    float blurMask = smoothstep(0.35, 1.0, dist) * (1.0 - wInt);

    if (blurMask > 0.0) {
        vec3 bokehCol = radialDOF(iChannel0, tc, blurMask * 0.025, aspect);
        float handoff = smoothstep(0.0, 0.1, blurMask);
        col = mix(col, bokehCol, handoff);
    }

    if (wInt > 0.01) {
        vec3 motionAcc = vec3(0.0);
        for(float m = -3.0; m <= 3.0; m++) {
            motionAcc += texture(iChannel0, tc + vec2(m * ts.x * 6.0 * wInt, 0.0)).rgb;
        }
        col = mix(col, motionAcc / 7.0, wInt * 0.85);
    }

    vec3 bloom = bloomBrightPass(iChannel0, tc, 0.72);
    col += bloom * (0.55 + peak * 0.25); 

    vec3 streak = anamorphicStreak(iChannel0, tc, ts, 0.78);
    col += streak * (0.45 + treble * 0.4); 

    if (strobeTrig > 0.0) {
        col += vec3(0.12) * peak; 
        col *= 1.1; 
    }

    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, 1.25);

    col *= vec3(0.96, 1.00, 1.04);

    vec2 vUV = uv - 0.5;
    float vig = 1.0 - smoothstep(0.2, 1.3, length(vUV));
    col *= mix(1.0, vig, 0.35);

    col = pow(max(col, 0.0), vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
