// https://www.shadertoy.com/view/73fXW2
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: A Gift For You - Buffer B
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

// adapted from "QubeX" by Engineerisaac: https://www.shadertoy.com/view/s3fSRX
// adapted stand-alone version: https://www.shadertoy.com/view/N3lSzl

#define PI  3.14159265359
#define TAU 6.28318530718

// Used for blur effect
#define SENSITIVITY .68 

// UTILITIES & MATH
float audioBand(float x) {
    return texture(iAudioData, vec2(x, 0.25)).x;
}

float getBand(float start, float end) {
    float total = 0.0;
    for(float i = start; i < end; i++) {
        total += texture(iAudioData, vec2(i/512.0, 0.25)).x;
    }
    return total / (end - start);
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float sdPoly(vec2 p, float r, int n) {
    float a = atan(p.x, p.y) + PI;
    float r_poly = TAU / float(n);
    float d = cos(floor(0.5 + a / r_poly) * r_poly - a) * length(p);
    return d - r;
}

float strokeFromDistance(float d, float w) {
    float aa = 0.003;
    return 1.0 - smoothstep(w, w + aa, abs(d));
}

// AUDIO EXTRACTION
float getBass() {
    float a = 0.0;
    a += audioBand(0.005);
    a += audioBand(0.010);
    a += audioBand(0.020);
    a += audioBand(0.035);
    return clamp(a / 4.0, 0.0, 1.0);
}

float getMid() {
    float a = 0.0;
    a += audioBand(0.12);
    a += audioBand(0.20);
    a += audioBand(0.30);
    a += audioBand(0.45);
    return clamp(a / 4.0, 0.0, 1.0);
}

float getTreble() {
    float a = 0.0;
    a += audioBand(0.55);
    a += audioBand(0.70);
    a += audioBand(0.85);
    return clamp(a / 3.0, 0.0, 1.0);
}

// AUDIO-REACTIVE LAYER GENERATION
float reactiveCore(vec2 p, float t, float bass, float mid, float treble) {
    float m = 0.0;
    int sides = 3 + int(mid * 5.0); 
    float rotSpeed = t * 0.4 + (treble * 1.5);
    
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float dir = mod(fi, 2.0) * 2.0 - 1.0;
        vec2 q = rot(rotSpeed * (1.0 + fi * 0.15) * dir) * p;
        
        float radius = 0.05 + fi * 0.055 + (bass * 0.09 * sin(t * 3.0 + fi));
        radius += sin(t * 25.0 + fi) * 0.006 * treble;
        
        float lineW = 0.0012 + (bass * bass) * 0.006;
        float glowA = 0.008 + bass * 0.11;
        
        float d = sdPoly(q, radius, sides);
        
        if (bass > 0.65) {
            d = abs(d) - (0.01 * bass);
        }
        
        m += strokeFromDistance(d, lineW) * (1.1 - fi * 0.15);
        m += exp(-abs(d) * (32.0 - fi * 2.0)) * glowA;
    }
    
    return m;
}

float audioWaveRing(vec2 p, float t, float bass, float mid, float treble) {
    float m = 0.0;
    int count = 40; 
    float angleStep = TAU / float(count);
    float swirl = t * 0.15 + (treble * 0.2);
    
    for (int i = 0; i < count; i++) {
        float fi = float(i);
        float currentAngle = fi * angleStep;
        float angleDelta = abs(mod(currentAngle - swirl + PI, TAU) - PI);
        float samplePos = angleDelta / PI; 
        
        float localAudio = audioBand(samplePos * 0.65); 
        float radius = 0.33 + (mid * 0.05) + (localAudio * 0.15);
        
        vec2 nodePos = vec2(cos(currentAngle), sin(currentAngle)) * radius;
        vec2 q = p - nodePos;
        
        float dotSize = 0.003 + localAudio * 0.018;
        float d = length(q) - dotSize;
        
        float flare = exp(-abs(d) * (52.0 - localAudio * 22.0)) * (0.004 + bass * 0.08);
        
        m += strokeFromDistance(d, 0.001) * (0.25 + localAudio * 0.75);
        m += flare;
    }
    
    return m;
}

float perimeterEqualizer(vec2 p, float t, float bass, float treble) {
    float r = length(p);
    float a = atan(p.x, p.y);
    float normalizedAngle = abs(a) / PI;
    
    float freqSample = audioBand(0.2 + normalizedAngle * 0.6);
    
    float sectorCount = 50.0;
    float radialMask = smoothstep(0.1, 0.4, sin(a * sectorCount));
    
    float innerBound = 0.54 + bass * 0.04;
    float outerBound = innerBound + (freqSample * 0.20) + (treble * 0.04);
    
    float eqBars = smoothstep(innerBound, innerBound + 0.01, r) * smoothstep(outerBound, outerBound - 0.01, r);
    eqBars *= radialMask;
    
    return eqBars * (0.15 + freqSample * 0.85);
}

// Generates the base 2D shape layers
float scene(vec2 p, float t, float bass, float mid, float treble) {
    float m = 0.0;
    m += reactiveCore(p, t, bass, mid, treble);
    m += audioWaveRing(p, t, bass, mid, treble);
    m += perimeterEqualizer(p, t, bass, treble);
    return m;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime/2.;
    
    float bass   = getBass();
    float mid    = getMid();
    float treble = getTreble();
    float sb     = getBand(0., 10.);
    
    float bassPulse   = pow(bass, 2.5);
    float midPulse    = pow(mid, 2.0);
    float treblePulse = pow(treble, 1.8);
    
    // Scale coordinate space slightly based on music intensity
    p *= 1.0 - (bassPulse * 0.10) + (treblePulse * 0.04);
    
    // POLAR DISTORTION GLITCH
    float pr = length(p);
    float pa = atan(p.x, p.y);
    float glitchChance = 0.95 - (bassPulse * 0.04);
    float glitchTrigger = step(glitchChance, hash12(vec2(floor(t * 15.0), 12.34)));
    if(glitchTrigger > 0.0) {
        pa += (hash12(vec2(floor(pr * 25.0), t)) - 0.5) * (0.08 + midPulse * 0.22) * glitchTrigger;
        p = vec2(sin(pa), cos(pa)) * pr;
    }
    
    // CHROMATIC SPLIT RENDER
    float aberrIntensity = 0.002 + (bassPulse * 0.022) + (treblePulse * 0.006);
    vec2 splitDir = normalize(p) * pr;
    
    float rr = scene(p + splitDir * aberrIntensity, t, bassPulse, midPulse, treblePulse);
    float gg = scene(p, t, bassPulse, midPulse, treblePulse);
    float bb = scene(p - splitDir * aberrIntensity, t, bassPulse, midPulse, treblePulse);
    
    vec3 col = vec3(rr, gg, bb);
    
    // SPECTRAL COLOR MODULATION (Current Frame base glow)
    float baseData = gg;
    vec3 colorLow  = vec3(0.02, 0.45, 0.98); 
    vec3 colorMid  = vec3(0.95, 0.05, 0.52); 
    vec3 colorHigh = vec3(0.05, 0.98, 0.62); 
    
    vec3 dynamicTheme = mix(colorLow, colorMid, bassPulse);
    dynamicTheme = mix(dynamicTheme, colorHigh, treblePulse * 0.5);
    
    col += dynamicTheme * baseData * baseData * (0.3 + bassPulse * 3.5);
    
    // SHADER 1 ADAPTATION: MUSHED BACK-BUFFER BLUR TRAILS
    float zoom = 1.005 + (sb * 0.01);
    vec2 uv_zoomed = (fragCoord / iResolution.xy - 0.5) / zoom + 0.5;
    
    // Grab historical frame state from iChannel1
    vec3 backCol = texture(iChannel1, uv_zoomed).rgb;
    
    // 1. Map screen space angle directly to the audio texture spectrum
    float angleSpectrumSample = (pa + PI) / TAU; 
    float localFreq = audioBand(angleSpectrumSample * 0.85);
    
    // 2. Slow shifting background base palette
    float slowTimeWheel = t * 0.5; 
    float rainbowPhase = slowTimeWheel + pr * 3.0 + pa * 1.5 + (localFreq * 3.0);
    vec3 rainbowTint = vec3(0.5) + vec3(0.5) * cos(vec3(0.0, 2.0, 4.0) + rainbowPhase);
    
    // 3. AGGRESSIVE CHANNEL ROTATION: 
    // We get rid of the baseline 0.5 minimum. We bundle the audio inputs into a vector 
    // and multiply them against a cyclic phase offset vector. 
    vec3 audioPack = vec3(bassPulse, midPulse, treblePulse) * 2.2;
    
    // This dynamically changes which color channel handles which frequency completely over time.
    vec3 freqMultiplier = vec3(
        dot(audioPack, vec3(sin(slowTimeWheel)*0.5+0.5, cos(slowTimeWheel)*0.5+0.5, sin(slowTimeWheel+1.0)*0.5+0.5)),
        dot(audioPack, vec3(cos(slowTimeWheel+2.0)*0.5+0.5, sin(slowTimeWheel+2.0)*0.5+0.5, cos(slowTimeWheel+3.0)*0.5+0.5)),
        dot(audioPack, vec3(sin(slowTimeWheel+4.0)*0.5+0.5, cos(slowTimeWheel+4.0)*0.5+0.5, sin(slowTimeWheel+5.0)*0.5+0.5))
    );
    
    // Combine the base spectrum wheel with the highly dynamic audio routing matrix
    rainbowTint = clamp(rainbowTint * freqMultiplier, 0.001, 1.0);
    
    // Inject the shifting matrix values into the history trails
    backCol *= rainbowTint;
    
    // Feedback trail decay
    backCol = clamp(backCol * (0.85 + midPulse * 0.08), 0.0, 1.0);
    
    // FIXED BLENDING
    col = max(backCol * SENSITIVITY, col) + backCol * 0.035;
    
    // POST PROCESSING FILTER
    float vignette = 1.0 - smoothstep(0.40, 1.35, length(p * vec2(0.95, 1.05)));
    float scanline = 0.92 + 0.08 * sin(fragCoord.y * 3.2 + t * (10.0 + treblePulse * 40.0));
    float flicker  = 0.95 + 0.05 * sin(t * 60.0) * hash12(vec2(t));
    
    float masterBrightness = 0.4 + bassPulse * 1.4;
    col *= vignette * scanline * flicker * masterBrightness;
    
    float grainVal = hash12(fragCoord + vec2(t * 90.0)) - 0.5;
    col += grainVal * (0.015 + (1.0 - mid) * 0.025);
    
    col = pow(max(col, 0.0), vec3(0.85));
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
