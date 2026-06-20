// https://www.shadertoy.com/view/73fXW2
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: A Gift For You - Buffer A
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
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

// iAudioData: Audio/Music
// iChannel1: Buffer A (Self)
// iChannel2: Buffer B (Shape Layer)
// iChannel3: Buffer C (Credits Layer)

#define TIME iTime
#define RES iResolution.xy

#define GET_BASS(uv)   texture(iAudioData, vec2(0.05, uv)).r
#define GET_MID(uv)    texture(iAudioData, vec2(0.40, uv)).r
#define GET_TREBLE(uv) texture(iAudioData, vec2(0.80, uv)).r

mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

float dfLine(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float drawText(vec2 p) {
    float d = 1e5;
    float w = 0.0015; 
    float yOff = .8;
    
    // ... [Previous Text Logic Kept Identical] ...
    vec2 pS = p - vec2(-1.3, yOff);
    d = min(d, dfLine(pS, vec2(0.1, 0.15), vec2(-0.1, 0.15), w));
    d = min(d, dfLine(pS, vec2(-0.1, 0.15), vec2(-0.1, 0.0), w));
    d = min(d, dfLine(pS, vec2(-0.1, 0.0), vec2(0.1, 0.0), w));
    d = min(d, dfLine(pS, vec2(0.1, 0.0), vec2(0.1, -0.15), w));
    d = min(d, dfLine(pS, vec2(0.1, -0.15), vec2(-0.1, -0.15), w));
    
    vec2 pH = p - vec2(-1.05, yOff);
    d = min(d, dfLine(pH, vec2(-0.1, 0.15), vec2(-0.1, -0.15), w));
    d = min(d, dfLine(pH, vec2(0.1, 0.15), vec2(0.1, -0.15), w));
    d = min(d, dfLine(pH, vec2(-0.1, 0.0), vec2(0.1, 0.0), w));
    
    vec2 pA = p - vec2(-0.8, yOff);
    d = min(d, dfLine(pA, vec2(-0.1, -0.15), vec2(0.0, 0.15), w));
    d = min(d, dfLine(pA, vec2(0.0, 0.15), vec2(0.1, -0.15), w));
    d = min(d, dfLine(pA, vec2(-0.06, -0.02), vec2(0.06, -0.02), w));
    
    vec2 pD = p - vec2(-0.55, yOff);
    d = min(d, dfLine(pD, vec2(-0.1, -0.15), vec2(-0.1, 0.15), w));
    d = min(d, dfLine(pD, vec2(-0.1, 0.15), vec2(0.05, 0.15), w));
    d = min(d, dfLine(pD, vec2(0.05, 0.15), vec2(0.1, 0.0), w));
    d = min(d, dfLine(pD, vec2(0.1, 0.0), vec2(0.05, -0.15), w));
    d = min(d, dfLine(pD, vec2(0.05, -0.15), vec2(-0.1, -0.15), w));
    
    vec2 pE = p - vec2(-0.3, yOff);
    d = min(d, dfLine(pE, vec2(-0.1, -0.15), vec2(-0.1, 0.15), w));
    d = min(d, dfLine(pE, vec2(-0.1, 0.15), vec2(0.1, 0.15), w));
    d = min(d, dfLine(pE, vec2(-0.1, 0.0), vec2(0.05, 0.0), w));
    d = min(d, dfLine(pE, vec2(-0.1, -0.15), vec2(0.1, -0.15), w));
    
    vec2 pR = p - vec2(-0.05, yOff);
    d = min(d, dfLine(pR, vec2(-0.1, -0.15), vec2(-0.1, 0.15), w));
    d = min(d, dfLine(pR, vec2(-0.1, 0.15), vec2(0.1, 0.15), w));
    d = min(d, dfLine(pR, vec2(0.1, 0.15), vec2(0.1, 0.0), w));
    d = min(d, dfLine(pR, vec2(0.1, 0.0), vec2(-0.1, 0.0), w));
    d = min(d, dfLine(pR, vec2(0.0, 0.0), vec2(0.1, -0.15), w));
    
    vec2 pA2 = p - vec2(0.2, yOff);
    d = min(d, dfLine(pA2, vec2(-0.1, -0.15), vec2(0.0, 0.15), w));
    d = min(d, dfLine(pA2, vec2(0.0, 0.15), vec2(0.1, -0.15), w));
    d = min(d, dfLine(pA2, vec2(-0.06, -0.02), vec2(0.06, -0.02), w));
    
    vec2 pM = p - vec2(0.45, yOff);
    d = min(d, dfLine(pM, vec2(-0.1, -0.15), vec2(-0.1, 0.15), w));
    d = min(d, dfLine(pM, vec2(-0.1, 0.15), vec2(0.0, 0.0), w));
    d = min(d, dfLine(pM, vec2(0.0, 0.0), vec2(0.1, 0.15), w));
    d = min(d, dfLine(pM, vec2(0.1, 0.15), vec2(0.1, -0.15), w));
    
    vec2 pP = p - vec2(0.7, yOff);
    d = min(d, dfLine(pP, vec2(-0.1, -0.15), vec2(-0.1, 0.15), w));
    d = min(d, dfLine(pP, vec2(-0.1, 0.15), vec2(0.1, 0.15), w));
    d = min(d, dfLine(pP, vec2(0.1, 0.15), vec2(0.1, 0.0), w));
    d = min(d, dfLine(pP, vec2(0.1, 0.0), vec2(-0.1, 0.0), w));

    vec2 pTwo = p - vec2(1.05, yOff);
    d = min(d, dfLine(pTwo, vec2(-0.1, 0.15), vec2(0.1, 0.15), w));
    d = min(d, dfLine(pTwo, vec2(0.1, 0.15), vec2(0.1, 0.0), w));
    d = min(d, dfLine(pTwo, vec2(0.1, 0.0), vec2(-0.1, -0.15), w));
    d = min(d, dfLine(pTwo, vec2(-0.1, -0.15), vec2(0.1, -0.15), w));

    vec2 pDot = p - vec2(1.22, yOff);
    d = min(d, dfLine(pDot, vec2(0.0, -0.12), vec2(0.0, -0.15), w));

    vec2 pZero = p - vec2(1.4, yOff);
    d = min(d, dfLine(pZero, vec2(-0.1, -0.15), vec2(-0.1, 0.15), w));
    d = min(d, dfLine(pZero, vec2(-0.1, 0.15), vec2(0.1, 0.15), w));
    d = min(d, dfLine(pZero, vec2(0.1, 0.15), vec2(0.1, -0.15), w));
    d = min(d, dfLine(pZero, vec2(0.1, -0.15), vec2(-0.1, -0.15), w));

    return smoothstep(0.015, 0.0, d);
}

vec3 synthwaveGrid(vec2 uv, float bass) {
    float flippedY = max(-uv.y, -0.1); 
    float perspective = 1.0 / (flippedY + 0.15);
    vec2 gridUV = vec2(uv.x * perspective * 1.5, perspective * 2.0 + TIME * 1.5);
    
    vec2 gridLines = abs(fract(gridUV - 0.5) - 0.5) / fwidth(gridUV);
    float gridLine = min(gridLines.x, gridLines.y);
    float gridMask = 1.0 - smoothstep(0.0, 1.2, gridLine);
    
    gridMask *= smoothstep(-0.2, 0.5, -uv.y);
    vec3 baseNeon = vec3(0.1, 0.5, 0.9) * (1.0 + bass * 0.8);
    return baseNeon * gridMask * 0.4;
}

float drawBottomText(vec2 p) {
    float d = 1e5;
    float w = 0.010; 
    float yPos = -0.9;
    p.x-=0.18;
    // ... [Previous Bottom Text Logic Kept Identical] ...
    vec2 pM = p - vec2(-0.8, yPos);
    d = min(d, dfLine(pM, vec2(-0.06, -0.06), vec2(-0.06, 0.06), w));
    d = min(d, dfLine(pM, vec2(-0.06, 0.06), vec2(0.0, 0.0), w));
    d = min(d, dfLine(pM, vec2(0.0, 0.0), vec2(0.06, 0.06), w));
    d = min(d, dfLine(pM, vec2(0.06, 0.06), vec2(0.06, -0.06), w));
    vec2 pI = p - vec2(-0.65, yPos);
    d = min(d, dfLine(pI, vec2(0.0, -0.06), vec2(0.0, 0.06), w));
    vec2 pT = p - vec2(-0.52, yPos);
    d = min(d, dfLine(pT, vec2(-0.06, 0.06), vec2(0.06, 0.06), w));
    d = min(d, dfLine(pT, vec2(0.0, 0.06), vec2(0.0, -0.06), w));
    float xOff = -0.28; yPos-=0.01;
    vec2 pL = p - vec2(xOff + 0.0, yPos);
    d = min(d, dfLine(pL, vec2(-0.04, 0.06), vec2(-0.04, -0.06), w));
    d = min(d, dfLine(pL, vec2(-0.04, -0.06), vec2(0.04, -0.06), w));
    vec2 pi2 = p - vec2(xOff + 0.10, yPos+.02);
    d = min(d, dfLine(pi2, vec2(0.0, -0.06), vec2(0.0, 0.02), w));
    vec2 pc = p - vec2(xOff + 0.20, yPos);
    d = min(d, dfLine(pc, vec2(0.04, 0.04), vec2(-0.02, 0.04), w));
    d = min(d, dfLine(pc, vec2(-0.02, 0.04), vec2(-0.02, -0.04), w));
    d = min(d, dfLine(pc, vec2(-0.02, -0.04), vec2(0.04, -0.04), w));
    vec2 pe = p - vec2(xOff + 0.32, yPos);
    d = min(d, dfLine(pe, vec2(0.04, 0.04), vec2(-0.02, 0.04), w));
    d = min(d, dfLine(pe, vec2(-0.02, 0.04), vec2(-0.02, -0.04), w));
    d = min(d, dfLine(pe, vec2(-0.02, -0.04), vec2(0.04, -0.04), w));
    d = min(d, dfLine(pe, vec2(-0.02, 0.0), vec2(0.02, 0.0), w));
    vec2 pn = p - vec2(xOff + 0.44, yPos);
    d = min(d, dfLine(pn, vec2(-0.02, -0.06), vec2(-0.02, 0.04), w));
    d = min(d, dfLine(pn, vec2(-0.02, 0.04), vec2(0.04, -0.06), w));
    d = min(d, dfLine(pn, vec2(0.04, -0.06), vec2(0.04, 0.04), w));
    vec2 ps = p - vec2(xOff + 0.56, yPos);
    d = min(d, dfLine(ps, vec2(0.04, 0.04), vec2(-0.02, 0.04), w));
    d = min(d, dfLine(ps, vec2(-0.02, 0.04), vec2(-0.02, 0.0), w));
    d = min(d, dfLine(ps, vec2(-0.02, 0.0), vec2(0.04, 0.0), w));
    d = min(d, dfLine(ps, vec2(0.04, 0.0), vec2(0.04, -0.04), w));
    d = min(d, dfLine(ps, vec2(0.04, -0.04), vec2(-0.02, -0.04), w));
    vec2 pe2 = p - vec2(xOff + 0.68, yPos);
    d = min(d, dfLine(pe2, vec2(0.04, 0.04), vec2(-0.02, 0.04), w));
    d = min(d, dfLine(pe2, vec2(-0.02, 0.04), vec2(-0.02, -0.04), w));
    d = min(d, dfLine(pe2, vec2(-0.02, -0.04), vec2(0.04, -0.04), w));
    d = min(d, dfLine(pe2, vec2(-0.02, 0.0), vec2(0.02, 0.0), w));
    vec2 pd = p - vec2(xOff + 0.80, yPos);
    d = min(d, dfLine(pd, vec2(0.02, 0.06), vec2(0.02, -0.06), w));
    d = min(d, dfLine(pd, vec2(-0.02, -0.06), vec2(0.02, -0.06), w));
    d = min(d, dfLine(pd, vec2(-0.02, -0.06), vec2(-0.02, 0.0), w));
    d = min(d, dfLine(pd, vec2(-0.02, 0.0), vec2(0.02, 0.06), w));
    return smoothstep(0.01, 0.0, d);
}

float circularTunnel(vec2 uv, float bass, float mid) {
    float radius = length(uv);
    float angle = atan(uv.y, uv.x);
    float normAngle = (angle / 3.14159265) * 0.5 + 0.5;
    float symmetricalIndex = 1.0 - abs(normAngle * 2.0 - 1.0);
    float numBars = 60.0;
    float segment = floor(symmetricalIndex * numBars) / numBars;
    float audioSample = texture(iAudioData, vec2(segment, 0.25)).r;
    float threshold = 0.35 + audioSample * 0.40 + sin(TIME) * 0.05;
    float ring = smoothstep(0.025, 0.0, abs(radius - threshold));
    float dynamicPulsar = sin(angle * 12.0 + TIME * 3.0) * 0.05;
    float corePulse = smoothstep(0.015, 0.0, abs(radius - (0.7 + dynamicPulsar)));
    return ring * 0.7 + corePulse * (mid * 0.5);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 screenUV = fragCoord / RES;
    float bass    = GET_BASS(0.0);
    float mid     = GET_MID(0.0);
    float treble  = GET_TREBLE(0.0);
    
    screenUV.y -= 0.3;
    vec4 bData = texture(iChannel2, screenUV);
    screenUV.y += 0.3;
    vec2 glitchOffset = (bData.gb - 0.5) * 0.012 * (0.3 + bass); 
    vec2 uv = (fragCoord * 2.0 - RES) / RES.y;
    vec2 warpedUV = uv + glitchOffset; 
    warpedUV += vec2(sin(TIME * 40.0), cos(TIME * 40.0)) * (bass * 0.01);

    vec3 currentFrame = vec3(0.02, 0.01, 0.04); 
    currentFrame += vec3(0.15, 0.0, 0.25) * abs(warpedUV.y + 0.2) * 0.3; 
    currentFrame += synthwaveGrid(warpedUV, bass);
    
    vec2 coreUV = warpedUV - vec2(0.0, -0.1);
    float rings = circularTunnel(coreUV, bass, mid);
    vec3 ringColor = mix(vec3(0.9, 0.0, 0.4), vec3(0.0, 1.0, 0.8), sin(TIME + warpedUV.y) * 0.5 + 0.5);
    currentFrame += rings * ringColor * (0.8 + treble * 0.6);
    
    float cycleDuration = 41.6;
    float creditDuration = 1.0;
    float cycleTime = mod(TIME, cycleDuration);
    bool showingCredits = (iMouse.z > 0.0 || cycleTime < creditDuration);
    
    float symbolZoom = .5 + mid * 0.4 + bass * 0.2; 
    vec2 symbolLookupUV = (screenUV - 0.5) / symbolZoom + 0.5;
    
    float centerSymbolMask = 0.0;
    if (showingCredits) {
        vec2 smallTextUV = (symbolLookupUV - 0.5) / 1.24 + 0.5;
        centerSymbolMask = texture(iChannel3, (smallTextUV - 0.5) * 1.6 + 0.5).r + texture(iChannel2, symbolLookupUV).r;
        float fade = smoothstep(0.0, 1.0, cycleTime) * smoothstep(creditDuration, creditDuration - 1.0, cycleTime);
        centerSymbolMask += fade;
    } else {
        centerSymbolMask = texture(iChannel2, symbolLookupUV).r; 
    }
    
    centerSymbolMask *= smoothstep(0.4, 0.35, length(symbolLookupUV - 0.5));
    
    // READABILITY LOGIC: Subtract background brightness when bass is high to keep text sharp
    float contrastBoost = clamp(bass * 1.5, 0.0, 1.0);
    currentFrame *= (1.0 - centerSymbolMask * contrastBoost * 0.5); 
    
    // NEON CREDIT COLOR: Force constant vibrant colors
    vec3 creditNeon = mix(vec3(1.0, 0.0, 0.8), vec3(0.0, 1.0, 1.0), sin(TIME * 3.0) * 0.5 + 0.5);
    currentFrame = mix(currentFrame, creditNeon * 1.2, centerSymbolMask * 0.9);

    // Neon text color shift
    float textMask = drawText(uv);
    vec3 animatedNeon = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.0, 0.5), sin(TIME*2.0)*0.5+0.5);
    currentFrame = mix(currentFrame, vec3(0.0, 0.0, 0.05), textMask * 0.7); 
    currentFrame = mix(currentFrame, animatedNeon * 1.5, textMask);

    float footerMask = drawBottomText(uv);
    currentFrame = mix(currentFrame, vec3(0.5, 0.8, 1.0), footerMask * 0.8);

    vec3 oldFrame = texture(iChannel1, screenUV).rgb;
    float decayFactor = showingCredits ? 0.93 : 0.82;
    vec3 blendedColor = mix(currentFrame, oldFrame, decayFactor);
    
    blendedColor += currentFrame * 0.2;
    blendedColor += clamp(bData.r, 0.0, 1.0) * vec3(0.8, 0.2, 0.9) * 0.01;
    
    fragColor = vec4(clamp(blendedColor, 0.0, 1.0), 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
