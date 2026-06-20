// https://www.shadertoy.com/view/73fXW2
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: A Gift For You - Buffer C
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform float iSampleRate;

varying vec2 vUv;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

// Credits

#define TIME iTime
#define RES iResolution.xy

float dfLine(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// --- CHARACTER SDF DEFINITIONS ---
// Standard letter bounds: X: [-0.07, 0.07], Y: [-0.12, 0.12]

float drawA(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(0.0, 0.12), w);
    d = min(d, dfLine(p, vec2(0.0, 0.12), vec2(0.07, -0.12), w));
    d = min(d, dfLine(p, vec2(-0.04, -0.02), vec2(0.04, -0.02), w));
    return d;
}
float drawB(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(0.03, 0.12), w));
    d = min(d, dfLine(p, vec2(0.03, 0.12), vec2(0.07, 0.06), w));
    d = min(d, dfLine(p, vec2(0.07, 0.06), vec2(0.03, 0.0), w));
    d = min(d, dfLine(p, vec2(0.03, 0.0), vec2(-0.07, 0.0), w));
    d = min(d, dfLine(p, vec2(0.03, 0.0), vec2(0.07, -0.06), w));
    d = min(d, dfLine(p, vec2(0.07, -0.06), vec2(0.03, -0.12), w));
    d = min(d, dfLine(p, vec2(0.03, -0.12), vec2(-0.07, -0.12), w));
    return d;
}
float drawC(vec2 p, float w) {
    float d = dfLine(p, vec2(0.07, 0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(-0.07, -0.12), w));
    d = min(d, dfLine(p, vec2(-0.07, -0.12), vec2(0.07, -0.12), w));
    return d;
}
float drawD(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(0.02, 0.12), w));
    d = min(d, dfLine(p, vec2(0.02, 0.12), vec2(0.07, 0.0), w));
    d = min(d, dfLine(p, vec2(0.07, 0.0), vec2(0.02, -0.12), w));
    d = min(d, dfLine(p, vec2(0.02, -0.12), vec2(-0.07, -0.12), w));
    return d;
}
float drawE(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(0.07, 0.12), w));
    d = min(d, dfLine(p, vec2(-0.07, 0.0), vec2(0.04, 0.0), w));
    d = min(d, dfLine(p, vec2(-0.07, -0.12), vec2(0.07, -0.12), w));
    return d;
}
float drawF(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(0.07, 0.12), w));
    d = min(d, dfLine(p, vec2(-0.07, 0.0), vec2(0.04, 0.0), w));
    return d;
}
float drawH(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(0.07, -0.12), vec2(0.07, 0.12), w));
    d = min(d, dfLine(p, vec2(-0.07, 0.0), vec2(0.07, 0.0), w));
    return d;
}
float drawI(vec2 p, float w) {
    float d = dfLine(p, vec2(0.0, -0.12), vec2(0.0, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.04, 0.12), vec2(0.04, 0.12), w));
    d = min(d, dfLine(p, vec2(-0.04, -0.12), vec2(0.04, -0.12), w));
    return d;
}
float drawJ(vec2 p, float w) {
    float d = dfLine(p, vec2(0.04, 0.12), vec2(0.04, -0.06), w);
    d = min(d, dfLine(p, vec2(0.04, -0.06), vec2(-0.02, -0.12), w));
    d = min(d, dfLine(p, vec2(-0.02, -0.12), vec2(-0.07, -0.06), w));
    return d;
}
float drawK(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(0.07, 0.12), vec2(-0.07, 0.0), w));
    d = min(d, dfLine(p, vec2(-0.07, 0.0), vec2(0.07, -0.12), w));
    return d;
}
float drawL(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, 0.12), vec2(-0.07, -0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, -0.12), vec2(0.06, -0.12), w));
    return d;
}
float drawM(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.08, -0.12), vec2(-0.08, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.08, 0.12), vec2(0.0, 0.0), w));
    d = min(d, dfLine(p, vec2(0.0, 0.0), vec2(0.08, 0.12), w));
    d = min(d, dfLine(p, vec2(0.08, 0.12), vec2(0.08, -0.12), w));
    return d;
}
float drawN(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(0.07, -0.12), w));
    d = min(d, dfLine(p, vec2(0.07, -0.12), vec2(0.07, 0.12), w));
    return d;
}
float drawO(vec2 p, float w) {
    float box = max(abs(p.x) - 0.07, abs(p.y) - 0.08);
    return abs(box) - w * 0.5;
}
float drawP(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(0.07, 0.12), w));
    d = min(d, dfLine(p, vec2(0.07, 0.12), vec2(0.07, 0.0), w));
    d = min(d, dfLine(p, vec2(0.07, 0.0), vec2(-0.07, 0.0), w));
    return d;
}
float drawQ(vec2 p, float w) {
    float d = drawO(p, w);
    d = min(d, dfLine(p, vec2(0.02, -0.02), vec2(0.08, -0.12), w));
    return d;
}
float drawR(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, -0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(0.06, 0.12), w));
    d = min(d, dfLine(p, vec2(0.06, 0.12), vec2(0.06, 0.0), w));
    d = min(d, dfLine(p, vec2(0.06, 0.0), vec2(-0.07, 0.0), w));
    d = min(d, dfLine(p, vec2(0.0, 0.0), vec2(0.07, -0.12), w));
    return d;
}
float drawS(vec2 p, float w) {
    float d = dfLine(p, vec2(0.07, 0.12), vec2(-0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.07, 0.12), vec2(-0.07, 0.0), w));
    d = min(d, dfLine(p, vec2(-0.07, 0.0), vec2(0.07, 0.0), w));
    d = min(d, dfLine(p, vec2(0.07, 0.0), vec2(0.07, -0.12), w));
    d = min(d, dfLine(p, vec2(0.07, -0.12), vec2(-0.07, -0.12), w));
    return d;
}
float drawT(vec2 p, float w) {
    float d = dfLine(p, vec2(0.0, -0.12), vec2(0.0, 0.12), w);
    d = min(d, dfLine(p, vec2(-0.08, 0.12), vec2(0.08, 0.12), w));
    return d;
}
float drawU(vec2 p, float w) {
    float leftStem  = dfLine(p, vec2(-0.07, 0.12), vec2(-0.07, -0.05), w);
    float rightStem = dfLine(p, vec2(0.07, 0.12), vec2(0.07, -0.05), w);
    float bottom    = dfLine(p, vec2(-0.07, -0.05), vec2(0.07, -0.05), w);
    return min(min(leftStem, rightStem), bottom);
}
float drawV(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, 0.12), vec2(0.0, -0.12), w);
    d = min(d, dfLine(p, vec2(0.0, -0.12), vec2(0.07, 0.12), w));
    return d;
}
float drawW(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.08, 0.12), vec2(-0.05, -0.12), w);
    d = min(d, dfLine(p, vec2(-0.05, -0.12), vec2(0.0, 0.0), w));
    d = min(d, dfLine(p, vec2(0.0, 0.0), vec2(0.05, -0.12), w));
    d = min(d, dfLine(p, vec2(0.05, -0.12), vec2(0.08, 0.12), w));
    return d;
}
float drawY(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, 0.12), vec2(0.0, 0.0), w);
    d = min(d, dfLine(p, vec2(0.07, 0.12), vec2(0.0, 0.0), w));
    d = min(d, dfLine(p, vec2(0.0, 0.0), vec2(0.0, -0.12), w));
    return d;
}
float drawZ(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.07, 0.12), vec2(0.07, 0.12), w);
    d = min(d, dfLine(p, vec2(0.07, 0.12), vec2(-0.07, -0.12), w));
    d = min(d, dfLine(p, vec2(-0.07, -0.12), vec2(0.07, -0.12), w));
    return d;
}

// --- SPECIAL CHARACTERS & SYMBOLS ---
float drawHyphen(vec2 p, float w) {
    return dfLine(p, vec2(-0.05, 0.0), vec2(0.05, 0.0), w);
}
float drawPeriod(vec2 p, float w) {
    return dfLine(p, vec2(0.0, -0.10), vec2(0.0, -0.12), w);
}
float drawPlus(vec2 p, float w) {
    float d = dfLine(p, vec2(-0.06, 0.0), vec2(0.06, 0.0), w);
    return min(d, dfLine(p, vec2(0.0, -0.06), vec2(0.0, 0.06), w));
}
float drawUmlaut(vec2 p, float w) {
    float u = drawU(p, w);
    float dot1 = length(p - vec2(-0.03, 0.16)) - w;
    float dot2 = length(p - vec2(0.03, 0.16)) - w;
    return min(u, min(dot1, dot2));
}

// Vectorized geometric smooth heart SDF
float drawHeart(vec2 p, float w) {
    p.y -= 0.02; // Center offset calibration
    float x = p.x;
    // Left/Right symmetric lobe processing
    float d = dfLine(p, vec2(0.0, -0.12), vec2(0.07, -0.02), w);
    d = min(d, dfLine(p, vec2(0.0, -0.12), vec2(-0.07, -0.02), w));
    d = min(d, dfLine(p, vec2(0.07, -0.02), vec2(0.07, 0.04), w));
    d = min(d, dfLine(p, vec2(-0.07, -0.02), vec2(-0.07, 0.04), w));
    d = min(d, dfLine(p, vec2(0.07, 0.04), vec2(0.03, 0.11), w));
    d = min(d, dfLine(p, vec2(-0.07, 0.04), vec2(-0.03, 0.11), w));
    d = min(d, dfLine(p, vec2(0.03, 0.11), vec2(0.0, 0.05), w));
    d = min(d, dfLine(p, vec2(-0.03, 0.11), vec2(0.0, 0.05), w));
    return d;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord * 2.0 - RES) / RES.y;
    uv.y -= 0.05; 
    
    float d = 1e5;
    float w = 0.009; 
    float spacing = 0.23; 
    
    int cycle = int(mod(TIME, 41.6) / 3.2);
    
    if (cycle == 0) {
        // --- "c-base" ---
        vec2 pText = uv - vec2(- (5.0 * spacing) * 0.5, 0.0);
        d = min(d, drawC(pText - vec2(0.0 * spacing, 0.0), w));
        d = min(d, drawHyphen(pText - vec2(1.0 * spacing, 0.0), w));
        d = min(d, drawB(pText - vec2(2.0 * spacing, 0.0), w));
        d = min(d, drawA(pText - vec2(3.0 * spacing, 0.0), w));
        d = min(d, drawS(pText - vec2(4.0 * spacing, 0.0), w));
        d = min(d, drawE(pText - vec2(5.0 * spacing, 0.0), w));
    } 
    else if (cycle == 1) {
        // --- "Eamon Woortman" ---
        float s = 0.20;
        vec2 pText = uv - vec2(- (13.0 * s) * 0.5, 0.0);
        d = min(d, drawE(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawM(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(3.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(4.0 * s, 0.0), w));
        // Space
        d = min(d, drawW(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(7.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(8.0 * s, 0.0), w));
        d = min(d, drawR(pText - vec2(9.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(10.0* s, 0.0), w));
        d = min(d, drawM(pText - vec2(11.0* s, 0.0), w));
        d = min(d, drawA(pText - vec2(12.0* s, 0.0), w));
        d = min(d, drawN(pText - vec2(13.0* s, 0.0), w));
    } 
    else if (cycle == 2) {
        // --- "Philipp Kühn" ---
        float s = 0.21;
        vec2 pText = uv - vec2(- (11.0 * s) * 0.5, 0.0);
        d = min(d, drawP(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawI(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawL(pText - vec2(3.0 * s, 0.0), w));
        d = min(d, drawI(pText - vec2(4.0 * s, 0.0), w));
        d = min(d, drawP(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawP(pText - vec2(6.0 * s, 0.0), w));
        // Space
        d = min(d, drawK(pText - vec2(8.0 * s, 0.0), w));
        d = min(d, drawUmlaut(pText - vec2(9.0 * s, 0.0), w)); 
        d = min(d, drawH(pText - vec2(10.0* s, 0.0), w));
        d = min(d, drawN(pText - vec2(11.0* s, 0.0), w));
    } 
    else if (cycle == 3) {
        // --- "Kai Rathmann" ---
        float s = 0.22;
        vec2 pText = uv - vec2(- (11.0 * s) * 0.5, 0.0);
        d = min(d, drawK(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawI(pText - vec2(2.0 * s, 0.0), w));
        // Space
        d = min(d, drawR(pText - vec2(4.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(7.0 * s, 0.0), w));
        d = min(d, drawM(pText - vec2(8.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(9.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(10.0* s, 0.0), w));
        d = min(d, drawN(pText - vec2(11.0* s, 0.0), w));
    } 
    else if (cycle == 4) {
        // --- "Jonathan R. Warden" ---
        float s = 0.16;
        vec2 pText = uv - vec2(- (17.0 * s) * 0.5, 0.0);
        d = min(d, drawJ(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(3.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(4.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(7.0 * s, 0.0), w));
        // Space
        d = min(d, drawR(pText - vec2(9.0 * s, 0.0), w));
        d = min(d, drawPeriod(pText - vec2(10.0 * s, 0.0), w));
        // Space
        d = min(d, drawW(pText - vec2(12.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(13.0 * s, 0.0), w));
        d = min(d, drawR(pText - vec2(14.0 * s, 0.0), w));
        d = min(d, drawD(pText - vec2(15.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(16.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(17.0 * s, 0.0), w));
    } 
    else if (cycle == 5) {
        // --- "ArthurTent" ---
        vec2 pText = uv - vec2(- (9.0 * spacing) * 0.5, 0.0);
        d = min(d, drawA(pText - vec2(0.0 * spacing, 0.0), w));
        d = min(d, drawR(pText - vec2(1.0 * spacing, 0.0), w));
        d = min(d, drawT(pText - vec2(2.0 * spacing, 0.0), w));
        d = min(d, drawH(pText - vec2(3.0 * spacing, 0.0), w));
        d = min(d, drawU(pText - vec2(4.0 * spacing, 0.0), w)); 
        d = min(d, drawR(pText - vec2(5.0 * spacing, 0.0), w));
        d = min(d, drawT(pText - vec2(6.0 * spacing, 0.0), w));
        d = min(d, drawE(pText - vec2(7.0 * spacing, 0.0), w));
        d = min(d, drawN(pText - vec2(8.0 * spacing, 0.0), w));
        d = min(d, drawT(pText - vec2(9.0 * spacing, 0.0), w));
    } 
    else if (cycle == 6) {
        // --- "Franz" ---
        vec2 pText = uv - vec2(- (4.0 * spacing) * 0.5, 0.0);
        d = min(d, drawF(pText - vec2(0.0 * spacing, 0.0), w));
        d = min(d, drawR(pText - vec2(1.0 * spacing, 0.0), w));
        d = min(d, drawA(pText - vec2(2.0 * spacing, 0.0), w));
        d = min(d, drawN(pText - vec2(3.0 * spacing, 0.0), w));
        d = min(d, drawZ(pText - vec2(4.0 * spacing, 0.0), w));
    } 
    else if (cycle == 7) {
        // --- "Leen Abdul Wahed" ---
        float s = 0.17;
        vec2 pText = uv - vec2(- (15.0 * s) * 0.5, 0.0);
        d = min(d, drawL(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(3.0 * s, 0.0), w));
        // Space
        d = min(d, drawA(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawB(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawD(pText - vec2(7.0 * s, 0.0), w));
        d = min(d, drawU(pText - vec2(8.0 * s, 0.0), w));
        d = min(d, drawL(pText - vec2(9.0 * s, 0.0), w));
        // Space
        d = min(d, drawW(pText - vec2(11.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(12.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(13.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(14.0 * s, 0.0), w));
        d = min(d, drawD(pText - vec2(15.0 * s, 0.0), w));
    } 
    else if (cycle == 8) {
        // --- "M. Maher Mhalhal" ---
        float s = 0.17;
        vec2 pText = uv - vec2(- (15.0 * s) * 0.5, 0.0);
        d = min(d, drawM(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawPeriod(pText - vec2(1.0 * s, 0.0), w));
        // Space
        d = min(d, drawM(pText - vec2(3.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(4.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawR(pText - vec2(7.0 * s, 0.0), w));
        // Space
        d = min(d, drawM(pText - vec2(9.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(10.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(11.0 * s, 0.0), w));
        d = min(d, drawL(pText - vec2(12.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(13.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(14.0 * s, 0.0), w));
        d = min(d, drawL(pText - vec2(15.0 * s, 0.0), w));
    }
    else if (cycle == 9) {
        // --- "<3 to shadertoy.com" ---
        float s = 0.16;
        vec2 pText = uv - vec2(- (17.0 * s) * 0.5, 0.0);
        d = min(d, drawHeart(pText - vec2(0.0 * s, 0.0), w));
        // Space
        d = min(d, drawT(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(3.0 * s, 0.0), w));
        // Space
        d = min(d, drawS(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(7.0 * s, 0.0), w));
        d = min(d, drawD(pText - vec2(8.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(9.0 * s, 0.0), w));
        d = min(d, drawR(pText - vec2(10.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(11.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(12.0 * s, 0.0), w));
        d = min(d, drawY(pText - vec2(13.0 * s, 0.0), w));
        d = min(d, drawPeriod(pText - vec2(14.0 * s, 0.0), w));
        d = min(d, drawC(pText - vec2(15.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(16.0 * s, 0.0), w));
        d = min(d, drawM(pText - vec2(17.0 * s, 0.0), w));
    }
    else if (cycle == 10) {
        // --- "shadertoy community" ---
        float s = 0.165; 
        vec2 pText = uv - vec2(- (18.0 * s) * 0.5, 0.0);
        d = min(d, drawS(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawD(pText - vec2(3.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(4.0 * s, 0.0), w));
        d = min(d, drawR(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(7.0 * s, 0.0), w));
        d = min(d, drawY(pText - vec2(8.0 * s, 0.0), w));
        // Space
        d = min(d, drawC(pText - vec2(10.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(11.0 * s, 0.0), w));
        d = min(d, drawM(pText - vec2(12.0 * s, 0.0), w));
        d = min(d, drawM(pText - vec2(13.0 * s, 0.0), w));
        d = min(d, drawU(pText - vec2(14.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(15.0 * s, 0.0), w));
        d = min(d, drawI(pText - vec2(16.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(17.0 * s, 0.0), w));
        d = min(d, drawY(pText - vec2(18.0 * s, 0.0), w));
    }
    else if (cycle == 11) {
        // --- "special thanks to iq + pol" ---
        float s = 0.125; // Scaled down from 0.155 to fit cleanly within safe-zone boundaries
        vec2 pText = uv - vec2(- (25.0 * s) * 0.5, 0.0);
        d = min(d, drawS(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawP(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawC(pText - vec2(3.0 * s, 0.0), w));
        d = min(d, drawI(pText - vec2(4.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(5.0 * s, 0.0), w));
        d = min(d, drawL(pText - vec2(6.0 * s, 0.0), w));
        // Space
        d = min(d, drawT(pText - vec2(8.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(9.0 * s, 0.0), w));
        d = min(d, drawA(pText - vec2(10.0 * s, 0.0), w));
        d = min(d, drawN(pText - vec2(11.0 * s, 0.0), w));
        d = min(d, drawK(pText - vec2(12.0 * s, 0.0), w));
        d = min(d, drawS(pText - vec2(13.0 * s, 0.0), w));
        // Space
        d = min(d, drawT(pText - vec2(15.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(16.0 * s, 0.0), w));
        // Space
        d = min(d, drawI(pText - vec2(18.0 * s, 0.0), w));
        d = min(d, drawQ(pText - vec2(19.0 * s, 0.0), w));
        // Space
        d = min(d, drawPlus(pText - vec2(21.0 * s, 0.0), w));
        // Space
        d = min(d, drawP(pText - vec2(23.0 * s, 0.0), w));
        d = min(d, drawO(pText - vec2(24.0 * s, 0.0), w));
        d = min(d, drawL(pText - vec2(25.0 * s, 0.0), w));
    }
    else {
        // --- "built with THREE.js" ---
        float s = 0.16;
        vec2 pText = uv - vec2(- (20.0 * s) * 0.5, 0.0);
        d = min(d, drawB(pText - vec2(0.0 * s, 0.0), w));
        d = min(d, drawU(pText - vec2(1.0 * s, 0.0), w));
        d = min(d, drawI(pText - vec2(2.0 * s, 0.0), w));
        d = min(d, drawL(pText - vec2(3.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(4.0 * s, 0.0), w));
        // Space
        d = min(d, drawW(pText - vec2(6.0 * s, 0.0), w));
        d = min(d, drawI(pText - vec2(7.0 * s, 0.0), w));
        d = min(d, drawT(pText - vec2(8.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(9.0 * s, 0.0), w));
        // Space
        d = min(d, drawT(pText - vec2(11.0 * s, 0.0), w));
        d = min(d, drawH(pText - vec2(12.0 * s, 0.0), w));
        d = min(d, drawR(pText - vec2(13.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(14.0 * s, 0.0), w));
        d = min(d, drawE(pText - vec2(15.0 * s, 0.0), w)); 
        d = min(d, drawE(pText - vec2(16.0 * s, 0.0), w)); 
        d = min(d, drawPeriod(pText - vec2(17.0 * s, 0.0), w));
        d = min(d, drawJ(pText - vec2(18.0 * s, 0.0), w));
        d = min(d, drawS(pText - vec2(19.0 * s, 0.0), w));
    }
    
    float mask = smoothstep(0.015, 0.0, d);
    fragColor = vec4(mask, 0.0, 0.0, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
