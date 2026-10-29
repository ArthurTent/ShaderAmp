// https://www.shadertoy.com/view/N3VXzR
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Neon Ricochet (audio) - Buffer C
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


// Buffer C: CAMERA DIRECTOR
// iChannel0 = Buffer B (audio)

#define ZERO (min(iFrame, 0))

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = vec4(0.0);
    int x = int(fragCoord.x);
    if (int(fragCoord.y) != 0 || x > 2 * MAX_SAMPLES) return;

    float t = iTime;
    float P = HOLD + TRANS;
    float cyc = floor(t / P);
    float local = t - cyc * P;
    int camA = camIndex(cyc);
    int camB = camIndex(cyc + 1.0);

    float u = clamp((local - HOLD) / TRANS, 0.0, 1.0);
    float spread = 0.5 * sin(PI * u);
    int N = (local > HOLD) ? MAX_SAMPLES : 1;

    if (x == 0) {
        fragColor = vec4(float(N), sin(PI * u), u, float(camA));
        return;
    }

    int j = (x - 1) / 2;
    if (j >= N) return;

    float off = (N > 1) ? float(j) / float(N - 1) - 0.5 : 0.0;
    float uj = clamp(u + off * spread, 0.0, 1.0);
    float m = uj * uj * (3.0 - 2.0 * uj);
    float tj = t + off * spread * TRANS * 0.5;

    float bass = clamp(texelFetch(iChannel0, ivec2(0, 0), 0).x, 0.0, 1.0) * AUDIO_AMOUNT;

    vec3 ro, ta; float focal;
    getCameraPose(ZERO,camA, camB, m, tj, bass, ro, ta, focal);

    bool second = ((x - 1) - 2 * j) == 1;
    fragColor = second ? vec4(ta, tj) : vec4(ro, focal);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
