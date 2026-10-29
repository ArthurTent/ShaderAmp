// https://www.shadertoy.com/view/NXcSDf
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Synaptic Drive ( audio)
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

struct CameraState {
    vec3 ro;
    vec3 ta;
    float roll;
    float fov;
    float bass;
    float mid;
    float treble;
    float kickEnv;
};


CameraState loadCameraState(sampler2D stateTex) {
    vec4 p0 = texelFetch(stateTex, ivec2(0, 0), 0);
    vec4 p1 = texelFetch(stateTex, ivec2(1, 0), 0);
    vec4 p2 = texelFetch(stateTex, ivec2(2, 0), 0);

    CameraState c;
    c.ro      = p0.xyz;
    c.roll    = p0.w;
    c.ta      = p1.xyz;
    c.fov     = p1.w;
    c.bass    = p2.x;
    c.mid     = p2.y;
    c.treble  = p2.z;
    c.kickEnv = p2.w;
    return c;
}

// === End Common Code ===


/*
 * ============================================================================
 * SHADER: Chrono-Kinesis 
 * AUTHOR: dathor (https://www.shadertoy.com/user/dathor)
 * ----------------------------------------------------------------------------
 * DESCRIPTION:
 * Dive into a cinematic, audio-reactive IFS void where deep obsidian glass meets screaming neon circuitry!
 * The visuals are wrapped in a heavy post-processing stack featuring FXAA, true Bokeh Depth of Field, anamorphic flares, and ACES tonemapping.
 * ----------------------------------------------------------------------------
 * AUDIO / PLAYBACK NOTE: 
 * Buffer B processes the audio ("X'trackTure" Track).
 * If audio doesn't start automatically, press the rewind/play button in Shadertoy.
 * 
 */
 
vec4 fxaa(sampler2D tex, vec2 uv, vec2 ts) {
    const float spanMax = 8.0, redMin = 1.0/128.0, redMul = 1.0/32.0;
    const vec3 luma = vec3(0.299, 0.587, 0.114);

    vec4 cc = texture(tex, uv);
    vec3 c00 = texture(tex, uv + vec2(-0.5,-0.5)*ts).rgb;
    vec3 c10 = texture(tex, uv + vec2(+0.5,-0.5)*ts).rgb;
    vec3 c01 = texture(tex, uv + vec2(-0.5,+0.5)*ts).rgb;
    vec3 c11 = texture(tex, uv + vec2(+0.5,+0.5)*ts).rgb;

    float lCC = dot(cc.rgb,luma), l00 = dot(c00,luma), l10 = dot(c10,luma), l01 = dot(c01,luma), l11 = dot(c11,luma);

    vec2 dir;
    dir.x = (l01+l11)-(l00+l10);
    dir.y = (l00+l01)-(l10+l11);

    float redDir = max((l00+l10+l01+l11)*redMul, redMin);
    float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + redDir);
    dir = clamp(dir * rcp, -spanMax, spanMax) * ts;

    vec4 sA = 0.5 * (texture(tex, uv - dir*(1.0/6.0)) + texture(tex, uv + dir*(1.0/6.0)));
    vec4 sB = sA * 0.5 + 0.25 * (texture(tex, uv - dir*0.5) + texture(tex, uv + dir*0.5));

    float lMin = min(lCC, min(min(l00, l10), min(l01, l11)));
    float lMax = max(lCC, max(max(l00, l10), max(l01, l11)));
    float lB = dot(sB.rgb, luma);

    vec3 aa = (lB < lMin || lB > lMax) ? sA.rgb : sB.rgb;
    return vec4(aa, cc.a);
}

vec3 radialDOF(sampler2D tex, vec2 uv, float blurRadius, float aspect) {
    vec3 col = vec3(0.0);
    const float goldenAngle = 2.39996323;
    const float iterations = 48.0; 

    for (float i = 0.0; i < iterations; i++) {
        float r = sqrt((i + 0.5) / iterations) * blurRadius;
        float theta = i * goldenAngle;
        vec2 offset = vec2(cos(theta), sin(theta)) * r;
        offset.x /= aspect;
        col += texture(tex, uv + offset).rgb;
    }
    return col / iterations;
}

vec3 bloomBrightPass(sampler2D tex, vec2 uv, vec2 ts, float threshold) {
    vec3 col = vec3(0.0);
    float totWeight = 0.0;
    const float taps = 20.0;
    const float goldenAngle = 2.39996323;

    for (float i = 0.0; i < taps; i++) {
        float r = sqrt(i / taps) * 0.012; 
        float theta = i * goldenAngle;
        vec2 offset = vec2(cos(theta), sin(theta)) * r;

        vec3 smpl = texture(tex, uv + offset).rgb;
        float luma = dot(smpl, vec3(0.299, 0.587, 0.114));

        vec3 bright = max(smpl - threshold, 0.0);
        float karisWeight = 1.0 / (1.0 + luma);

        col += bright * karisWeight;
        totWeight += karisWeight;
    }
    return col / max(totWeight, 0.0001);
}

vec3 anamorphicStreak(sampler2D tex, vec2 uv, vec2 ts, float threshold) {
    vec3 streak = vec3(0.0);
    float tot = 0.0;
    for (float i = 1.0; i <= 14.0; i++) {
        float w = 1.0 / i;
        vec3 sR = texture(tex, uv + vec2(i * ts.x * 2.5, 0.0)).rgb;
        vec3 sL = texture(tex, uv - vec2(i * ts.x * 2.5, 0.0)).rgb;
        streak += max(sR - threshold, 0.0) * w;
        streak += max(sL - threshold, 0.0) * w;
        tot += w * 2.0;
    }
    return streak / max(tot, 0.0001);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 ts = 1.0 / iResolution.xy;
    vec2 uv = fragCoord * ts;

    float targetAspect = 2.35;
    float aspect = iResolution.x / iResolution.y;
    float barH = max(0.0, (1.0 - (aspect / targetAspect)) / 2.0);

    if (uv.y < barH || uv.y > 1.0 - barH) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec2 centerUV = uv - 0.5;
    float distSq = dot(centerUV, centerUV);
    vec2 caOffset = centerUV * distSq * 0.0018; 

    vec3 col = fxaa(iChannel0, uv, ts).rgb;
    col.r = fxaa(iChannel0, uv - caOffset, ts).r;
    col.b = fxaa(iChannel0, uv + caOffset, ts).b;

    centerUV.x *= aspect;
    float dist = length(centerUV);
    float blurMask = smoothstep(0.50, 0.95, dist);

    if (blurMask > 0.0) {
        vec3 bokehCol = radialDOF(iChannel0, uv, blurMask * 0.014, aspect);
        col = mix(col, bokehCol, blurMask * 0.7);
    }

    vec3 bloom = bloomBrightPass(iChannel0, uv, ts, 1.4); 
    col += bloom * 0.16;

    vec3 streak = anamorphicStreak(iChannel0, uv, ts, 2.2); 
    col += streak * vec3(0.4, 0.8, 1.0) * 0.06;


    col *= 0.82;

    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);


    col = pow(max(col, 0.0), vec3(1.15));

    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, 1.12);
    col *= vec3(0.98, 1.00, 1.02);

    vec2 vUV = uv - 0.5;
    float vig = 1.0 - smoothstep(0.22, 1.30, length(vUV));
    col *= mix(1.0, vig, 0.42);

    col = pow(max(col, 0.0), vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
