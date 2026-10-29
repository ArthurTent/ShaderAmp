// https://www.shadertoy.com/view/N3VXzR
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Neon Ricochet (audio)
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

#define PI 3.14159265359

const float ROOM_W = 3.0;
const float ROOM_H = 5.0;
const float LS     = 8.0;

const float AUDIO_AMOUNT = 1.0;

const int   NUM_CAMS = 8;
const float HOLD  = 7.0;
const float TRANS = 1.6;
const int   MAX_SAMPLES = 6;

float hash11(float p) {
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 hash13(float p) {
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 getSpherePos(float t) {
    float bh = abs(sin(t * 3.5)) * 1.5;
    float press = 1.0 - smoothstep(0.0, 0.45, bh);
    return vec3(0.0, 1.0 + bh - 0.14 * press, t * 4.0);
}

mat3 setCamera(in vec3 ro, in vec3 ta) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(0.0, 1.0, 0.0);
    vec3 cu = normalize(cross(cw, cp));
    return mat3(cu, normalize(cross(cu, cw)), cw);
}

int camIndex(float cyc) {
    return int(mod(cyc * 3.0, float(NUM_CAMS)));
}

void getCamera(int idx, float tt, out vec3 ro, out vec3 ta, out float focal) {
    vec3 sp = getSpherePos(tt);

    if (idx == 0) {
        vec3 tg = vec3(0.0, 1.0, sp.z);
        float o = tt * 0.5;
        ro = tg + vec3(sin(o) * 2.0, 1.5, -4.5 + cos(o) * 1.5);
        ta = tg;
        focal = 1.0;
    } else if (idx == 1) {
        ro = vec3(sin(tt * 0.4) * 1.3, 0.75, sp.z + 5.0 + sin(tt * 0.3) * 0.8);
        ta = vec3(0.0, sp.y * 0.7 + 0.3, sp.z);
        focal = 0.85;
    } else if (idx == 2) {
        ro = vec3(2.3, 2.6 + 0.4 * sin(tt * 0.5), sp.z - 2.0 + 3.5 * sin(tt * 0.3));
        ta = vec3(0.0, 1.2, sp.z + 0.5);
        focal = 1.0;
    } else if (idx == 3) {
        ro = vec3(0.6 * sin(tt * 0.3), 4.2, sp.z - 2.2);
        ta = vec3(0.0, 0.8, sp.z + 0.8);
        focal = 1.0;
    } else if (idx == 4) {
        ro = vec3(1.9, 0.7, sp.z + 2.5 + sin(tt * 0.5));
        ta = vec3(0.0, 0.9, sp.z - 1.0);
        focal = 0.8;
    } else if (idx == 5) {
        ro = vec3(sin(tt * 0.25) * 0.8, 4.3, sp.z + 7.0);
        ta = vec3(0.0, 1.2, sp.z);
        focal = 0.9;
    } else if (idx == 6) {
        ro = vec3(-2.4, 1.6 + 0.5 * sin(tt * 0.4), sp.z + 8.0 * sin(tt * 0.18));
        ta = vec3(0.0, 1.2, sp.z);
        focal = 1.1;
    } else {
        ro = vec3(0.8 * sin(tt * 0.2), 2.0, sp.z - 10.0);
        ta = vec3(0.0, 1.4, sp.z);
        focal = 1.6;
    }
}

void getCameraPose(int frame,int camA, int camB, float m, float tt, float bass,
                   out vec3 ro, out vec3 ta, out float focal) {
    ro = vec3(0.0); ta = vec3(0.0); focal = 1.0;
    for (int c = frame; c < 2; c++) {
        if (c == 1 && m <= 0.0) break;
        vec3 r, tg; float f;
        getCamera(c == 0 ? camA : camB, tt, r, tg, f);
        if (c == 0) { ro = r; ta = tg; focal = f; }
        else {
            ro = mix(ro, r, m);
            ta = mix(ta, tg, m);
            focal = mix(focal, f, m);
            ro.x += sin(PI * m) * 1.6;
        }
    }
    ro.x = clamp(ro.x, -2.6, 2.6);
    ro.y = clamp(ro.y, 0.6, 4.4);

    focal -= bass * 0.07;

    float bp = mod(tt * 3.5, PI);
    ro.y -= exp(-bp * 6.0) * sin(bp * 50.0) * 0.08;
    ro += bass * 0.025 * vec3(sin(tt * 91.0), sin(tt * 77.0), 0.0);
}

// === End Common Code ===


/*
 * ============================================================================
 * SHADER: Neon Ricochet
 * AUTHOR: dathor (https://www.shadertoy.com/user/dathor)
 * ----------------------------------------------------------------------------
 * INSPIRATION:
 * Heavily inspired by "Festive Path Tracer - Advent 2025" by my astute friend 
 * mrange (https://www.shadertoy.com/view/tfyczc).
 * 
 * Also make sure to check out his post (Day 8) in the 2025 calendar:
 * https://magnusthor.github.io/so-you-think-you-can-code-2025/
 * ----------------------------------------------------------------------------
 * BACKGROUND:
 * This originally started life as an unfinished WGSL implementation that sat 
 * on the back burner. I finally brought it over to GLSL and finished it here 
 * on Shadertoy!. (After a few punshed in my tools)
 * ----------------------------------------------------------------------------
 * AUDIO / PLAYBACK NOTE: 
 * Buffer B processes the spectrum. Any track with a punchy beat will drive 
 * the lighting and shockwaves nicely - i do belive, díd not test to much.
 * If audio doesn't start automatically, press the rewind/play button in Shadertoy.
 * ============================================================================
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
