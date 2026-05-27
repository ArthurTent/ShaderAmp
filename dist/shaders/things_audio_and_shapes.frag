// Things (Audio + Shapes)
// Adapted from Shadertoy: https://www.shadertoy.com/view/7cfSWs
// Inspired by "owly" by prattitude -> https://www.shadertoy.com/view/7fXXRf

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;

// Custom uniforms for shape toggles
uniform float iUseCubemap;      // 0: Off, 1: On
uniform float iUseWeed;         // 0: Off, 1: On
uniform float iUseMush;         // 0: Off, 1: On
uniform float iUseHeart;        // 0: Off, 1: On
uniform float iUsePhallus;      // 0: Off, 1: On
uniform float iUsePeace;        // 0: Off, 1: On
uniform float iUseDancer;       // 0: Off, 1: On
uniform float iUseSmiley;       // 0: Off, 1: On
uniform float iUseCoffee;       // 0: Off, 1: On
uniform float iUseBeer;         // 0: Off, 1: On
uniform float iUseBunny;        // 0: Off, 1: On
uniform float iUseButterfly;    // 0: Off, 1: On
uniform float iUseFlower;       // 0: Off, 1: On
uniform float iUseBike;         // 0: Off, 1: On
uniform float iUseMoon;         // 0: Off, 1: On
uniform float iUseBalloon;      // 0: Off, 1: On
uniform float iUseBalloons;     // 0: Off, 1: On
uniform float iUseSperm;        // 0: Off, 1: On
uniform float iUseSperms;       // 0: Off, 1: On
uniform float iUseSpermsFollow; // 0: Off, 1: On
uniform float iUseCandle;       // 0: Off, 1: On
uniform float iUseShaderamp;    // 0: Off, 1: On
uniform float iUseEmoji1;       // 0: Off, 1: On
uniform float iUseEmoji2;       // 0: Off, 1: On
uniform float iUseBee;          // 0: Off, 1: On
uniform float iUseBees;         // 0: Off, 1: On
uniform float iRingCount;       // Number of rings (1.0 to 8.0)

#define PI 3.14159265359
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

// a little less than the song duration to morph into beginning shape at end of song
#define CYCLE_TIME 215.0

float time;
float snd = 0.;

struct Shape {
    float d;
    vec3 c1;
    vec3 c2;
    float glow;
    float shapeMask; 
};

// The MIT License
// Copyright © 2021 Inigo Quilez
// https://www.shadertoy.com/view/WtdBRS
float sdMoon(vec2 p, float d, float ra, float rb )
{
    p.y = abs(p.y);
    d=0.3; // fix
    float a = (ra*ra - rb*rb + d*d)/(2.0*d);
    float b = sqrt(max(ra*ra-a*a,0.0));
    if( d*(p.x*b-p.y*a) > d*d*max(b-p.y,0.0) )
    {
        return length(p-vec2(a,b));
    }
    return max( (length(p          )-ra),
               -(length(p-vec2(d,0))-rb));
}

float smin( float a, float b, float k ) {
    float h = clamp( 0.5 + 0.5 * (b - a) / k, 0.0, 1.0 );
    return mix( b, a, h ) - k * h * (1.0 - h);
}

float sdLine(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}


float sdSmiley(vec2 p) {
    p *= 1.4; p.y += 0.2;
    float head = length(p) - 0.8;
    vec2 ep = vec2(abs(p.x) - 0.3, p.y - 0.2);
    float eyes = length(ep * vec2(1.0, 0.85)) - 0.12;
    vec2 mp = p; mp.y += 0.15;
    float mouth = max(abs(length(mp) - 0.45) - 0.035, p.y + 0.15);
    return max(max(head, -eyes), -mouth);
}

float Wobble(float t, float seed) { return sin(t + seed) * cos(t * 0.5 + seed * 1.3); }

// "Dancing icons " from https://www.shadertoy.com/view/wdBGDh by otaviogood
float sdDancer(vec2 uv, float time) {
    uv *= 0.25; uv.y += 0.1;
    float legLen = 0.18, armLen = 0.15;
    vec2 hipA = vec2(0.07, -0.17), hipB = vec2(-0.07, -0.17);
    vec2 kneeA = normalize(vec2(0.15 + Wobble(time, 7.6) * 0.1, -0.3) - hipA) * legLen + hipA;
    vec2 footA = normalize(vec2(0.1 + Wobble(time, 237.6) * 0.1, -0.5) - kneeA) * legLen + kneeA;
    vec2 kneeB = normalize(vec2(-0.15 + Wobble(time, 437.6) * 0.1, -0.3) - hipB) * legLen + hipB;
    vec2 footB = normalize(vec2(-0.1 + Wobble(time, 383.6) * 0.1, -0.5) - kneeB) * legLen + kneeB;
    vec2 shA = vec2(0.12, 0.17), shB = vec2(-0.12, 0.17);
    vec2 elA = normalize(vec2(0.3, -0.07 + Wobble(time, 7.6) * 0.3) - shA) * armLen + shA;
    vec2 hdA = elA + vec2(0.14, Wobble(time, 73.6) * 0.5); 
    elA = normalize(elA - shA) * armLen + shA;
    hdA = normalize(hdA - elA) * armLen + elA;
    vec2 elB = normalize(vec2(-0.3, -0.07 + Wobble(time, 17.6) * 0.3) - shB) * armLen + shB;
    vec2 hdB = elB + vec2(-0.14, Wobble(time, 173.6) * 0.5);
    elB = normalize(elB - shB) * armLen + shB;
    hdB = normalize(hdB - elB) * armLen + elB;
    vec2 headPos = vec2(Wobble(time, 573.6) * 0.03, 0.33 + sin(time * 2.0) * 0.01);
    float d = sdLine(uv, vec2(0, -0.05), vec2(0, 0.1));
    d = min(d, sdLine(uv, hipA, kneeA)); d = min(d, sdLine(uv, kneeA, footA));
    d = min(d, sdLine(uv, hipB, kneeB)); d = min(d, sdLine(uv, kneeB, footB));
    d = min(d, sdLine(uv, shA, elA)); d = min(d, sdLine(uv, elA, hdA));
    d = min(d, sdLine(uv, shB, elB)); d = min(d, sdLine(uv, elB, hdB));
    return min(d, length(uv - headPos) - 0.05) - 0.02;
}

float sdCoffee(vec2 p) {
    p.y += 0.2; float body = max(abs(p.x) - 0.4 + p.y * 0.2, abs(p.y) - 0.4);
    body = max(body, -p.y - 0.35); vec2 hP = p - vec2(0.45, -0.05);
    float handle = max(abs(length(hP) - 0.15) - 0.04, -hP.x); 
    vec2 sP = p - vec2(0.0, 0.6); sP.x += sin(sP.y * 10.0 + time * 5.0) * 0.05; 
    float steam = sdLine(sP, vec2(0.0, -0.1), vec2(0.0, 0.2)) - 0.02;
    float steam2 = sdLine(sP + vec2(0.15, 0.1), vec2(0.0, -0.1), vec2(0.0, 0.1)) - 0.02;
    return min(min(body, handle), min(steam, steam2));
}

float sdBeerBottle(vec2 p) {
    p *= 1.8; p.y += 0.5; float x = abs(p.x), y = p.y, d = 1e10;
    d = min(d, sdLine(vec2(x, y), vec2(0.4, -1.5), vec2(0.4, 0.2)));
    d = min(d, sdLine(vec2(x, y), vec2(0.4, -1.5), vec2(0.0, -1.5)));
    if (y > 0.2 && y < 0.6) d = min(d, x - mix(0.4, 0.2, smoothstep(0.0, 1.0, (y-0.2)/0.4)));
    d = min(d, sdLine(vec2(x, y), vec2(0.2, 0.6), vec2(0.15, 1.3)));
    d = min(d, sdLine(vec2(x, y), vec2(0.15, 1.3), vec2(0.17, 1.36)));
    d = min(d, sdLine(vec2(x, y), vec2(0.17, 1.36), vec2(0.15, 1.55)));
    return min(d, sdLine(vec2(x, y), vec2(0.15, 1.55), vec2(0.0, 1.55))) - 0.05;
}

float sdBunny(vec2 p) {
    p.y += 0.4; float x = abs(p.x);
    float body = length(p * vec2(1.0, 1.2) - vec2(0.0, -0.2)) - 0.5;
    float head = length(p - vec2(0.0, 0.35)) - 0.3;
    vec2 earP = vec2(x - 0.15, p.y - 0.7);
    earP *= mat2(cos(0.2), -sin(0.2), sin(0.2), cos(0.2));
    return smin(smin(body, head, 0.1), length(earP * vec2(2.5, 0.7)) - 0.3, 0.05);
}


// based on https://www.shadertoy.com/view/ld23z3
float sdButterfly(vec2 p) {
    p.y += 0.1; float x = abs(p.x);
    float body = sdLine(p, vec2(0.0, -0.4), vec2(0.0, 0.4)) - 0.03;
    body = min(body, sdLine(vec2(x, p.y), vec2(0.0, 0.3), vec2(0.15, 0.6)) - 0.01);
    vec2 pU = (vec2(x - 0.35, p.y - 0.25)) * mat2(cos(-0.4), -sin(-0.4), sin(-0.4), cos(-0.4));
    vec2 pL = (vec2(x - 0.25, p.y + 0.2)) * mat2(cos(0.5), -sin(0.5), sin(0.5), cos(0.5));
    return smin(body, smin(length(pU * vec2(0.8, 1.2)) - 0.45, length(pL * vec2(1.2, 0.8)) - 0.35, 0.1) + x * sin(time * 10.0) * 0.1, 0.05);
}

Shape sdSunflowerShape(vec2 p, vec3 c1, vec3 c2) {
    vec2 stemP = p + vec2(0.0, 0.25);
    float stem = sdLine(stemP, vec2(0.0, -0.2), vec2(0.0, -2.0)) - 0.04;
    float leaves = 1e10;
    for(float i = 0.0; i < 2.0; i++) {
        float side = (i == 0.0) ? 1.0 : -1.0;
        vec2 leafP = p + vec2(0.0, 0.6 + i * 0.2); 
        vec2 dir = normalize(vec2(side * 0.8, 0.2));
        float vUv = dot(dir, leafP);
        float leafShape = length(leafP - dir * clamp(vUv, 0.0, 0.6)) - (0.12 * smoothstep(0.6, 0.0, vUv) * smoothstep(0.0, 0.2, vUv));
        leaves = min(leaves, leafShape);
    }
    float leafStem = smin(stem, leaves, 0.05);
    vec2 headP = p * 1.8;
    float r = length(headP), ang = atan(headP.y, headP.x);
    float petalDist = r - (0.7 + 0.3 * abs(fract(ang * 14.0 / (2.0 * PI)) - 0.5) * 2.0);
    petalDist = max(petalDist, -(r - 0.45)); 
    float r1 = abs(r - 0.3) - 0.001, r2 = abs(r - 0.15) - 0.001, r3 = abs(r - 0.05) - 0.001;
    float rings = min(r1, min(r2, r3));
    float flowerHead = min(petalDist, rings);
    float finalD = smin(leafStem, flowerHead / 1.8, 0.02);
    float colorMask = (flowerHead / 1.8 < leafStem) ? 0.0 : 1.0;
    return Shape(finalD, c1, c2, 2.8, colorMask);
}


// illusory Cycling by altunenes
// https://www.shadertoy.com/view/wfySWm
float sdBicycle(vec2 uv, float time) {
    uv *= 1.6; 
    uv.y += 0.1;
    float d = 1e10;
    
    // Key Points
    vec2 L = vec2(-0.8, -0.3);      // Rear Wheel
    vec2 R_p = vec2(0.8, -0.3);    // Front Wheel
    vec2 B_p = vec2(-0.1, -0.3);   // Bottom Bracket (Pedals)
    vec2 S = vec2(-0.5, 0.4);      // Seat Post Top
    vec2 H_p = vec2(0.45, 0.55);   // Handlebar Stem Base
    
    // Wheels
    for(int k=0; k<2; k++) {
        vec2 W = (k == 0) ? L : R_p;
        float distToWheel = length(uv - W);
        if (distToWheel < 0.6) {
            // DIRECTION FIX: Changed rot to negative for forward-looking spin
            float rot = -time * 5.0; 
            mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
            vec2 rUV = m * (uv - W);
            
            for(float t=0.0; t<6.28; t+=0.785) { // 8 spokes/dots
                vec2 p1 = vec2(cos(t), sin(t)) * 0.45;
                d = min(d, length(rUV - p1) - 0.035);
            }
        }
        d = min(d, abs(length(uv - W) - 0.45) - 0.02); // Rim
    }
    
    // Main Frame Triangle
    d = min(d, sdLine(uv, B_p, S));
    d = min(d, sdLine(uv, S, H_p));
    d = min(d, sdLine(uv, H_p, B_p));
    
    // Rear Stays
    d = min(d, sdLine(uv, L, S));
    d = min(d, sdLine(uv, L, B_p));
    
    // Front Fork & Handlebars (CONNECTION FIX)
    vec2 handleTop = H_p + vec2(0.15, 0.25);
    d = min(d, sdLine(uv, R_p, handleTop)); // Fork to Handlebar
    d = min(d, sdLine(uv, handleTop + vec2(-0.2, 0.0), handleTop + vec2(0.1, 0.05))); // Handlebar grip
    
    // Seat
    d = min(d, sdLine(uv, S + vec2(-0.15, 0.05), S + vec2(0.1, 0.05))); 
    
    return d - 0.025; // Slight rounding/thickness
}

float sdBalloon(vec2 p, float offset) {
    p.y -= 0.2;
    // Swaying motion
    p.x += sin(time * 2.0 + offset) * 0.1;
    
    float d = length(p / vec2(1.0, 1.2)) - 0.45;
    float knot = length((p + vec2(0.0, 0.52)) * vec2(1.0, 2.0)) - 0.05;
    d = smin(d, knot, 0.05); 
    float string = sdLine(p + vec2(0.0, 0.55), vec2(0.0, 0.0), vec2(sin(p.y * 10.0 + time * 5.0 + offset) * 0.05, -0.8));
    return min(d, string - 0.01);
}

float sdBalloons(vec2 p) {
    float d = 1e10;
    p.y+=0.1;
    for(float i = 0.0; i < 6.0; i++) {
        // Position each balloon in a cluster or floating around
        vec2 pos = vec2(
            sin(time * 0.3 + i * 1.2) * 0.5, 
            cos(time * 0.2 + i * 1.5) * 0.3 + (i * 0.1)
        );
        
        // Vary size slightly
        float scale = 1.5 + sin(i) * 0.2;
        vec2 q = p - pos;
        
        d = min(d, sdBalloon(q * scale, i) / scale);
    }
    return d;
}

float sdSperm(vec2 p) {
    float t = time + 0.;
    p.y -= 0.2;
    p.y += 0.3;
    float d = length(p / vec2(1.0, 1.2)) - 0.15;
    p.y -= 0.3;
    float knot = length((p + vec2(0.0, 0.52)) * vec2(1.0, 2.0)) - 0.05;
    d = smin(d, knot, 0.05);
    // Use the offset to make the tail wagging unique for each one
    float string = sdLine(p + vec2(0.0, 0.55), vec2(0.0, 0.0), vec2(sin(p.y * 10.0 + t * 8.0) * 0.05, -0.8));
    return min(d, string - 0.01);
}

float sdSperms(vec2 p) {
    float d = 1e10;
    for(float i = 0.0; i < 8.0; i++) {
        // Create a unique movement path for each one
        vec2 pos = vec2(
            sin(time * 0.5 + i * 1.5) * 0.6, 
            cos(time * 0.3 + i * 2.0) * 0.4
        );
        // Add a slight rotation so they face their travel direction
        float ang = atan(pos.y, pos.x) + 1.5;
        mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        
        vec2 q = (p - pos) * rot;
        //d = min(d, sdSperm(q * 2.0, i * 1.2) / 2.0);
        d = min(d, sdSperm(q * 2.0) / 2.0);
    }
    return d;
}


vec2 getLeaderPath(float t) {
    // A slightly more "swimming" path with varying speeds
    float x = sin(t * 0.8) * 0.6 + cos(t * 0.4) * 0.2;
    float y = cos(t * 0.7) * 0.4 + sin(t * 0.3) * 0.3;
    return vec2(x, y);
}

// Distance along the path for the arc-length logic
float getPathLength(float t_end) {
    float len = 0.0;
    const int steps = 40;
    for(int i = 1; i < steps; i++) {
        float t1 = (float(i-1) / float(steps-1)) * t_end;
        float t2 = (float(i) / float(steps-1)) * t_end;
        len += distance(getLeaderPath(t1), getLeaderPath(t2));
    }
    return len;
}

float sdSpermsFollows(vec2 p) {
    float d = 1e10;
    const float numSperms = 8.0;
    const float followerSpacing = 0.25; 
    
    // Total distance traveled by the leader
    float totalDist = getPathLength(time);
    
    for(float i = 0.0; i < numSperms; i++) {
        float targetDist = totalDist - (i * followerSpacing);
        if (targetDist < 0.0) continue; 

        // Inverse lookup: find 't' for our target distance
        float t = 0.0;
        float currentLen = 0.0;
        float stepSize = time / 60.0;
        for(int j = 0; j < 60; j++) {
            float nextT = t + stepSize;
            float stepDist = distance(getLeaderPath(t), getLeaderPath(nextT));
            if(currentLen + stepDist >= targetDist) {
                t = mix(t, nextT, (targetDist - currentLen) / stepDist);
                break;
            }
            currentLen += stepDist;
            t = nextT;
        }
        
        vec2 pos = getLeaderPath(t);
        
        // 1. Get the direction of travel (Tangent)
        vec2 tan = normalize(getLeaderPath(t + 0.001) - pos);
        
        // 2. We need the shape's vertical axis to be the tangent.
        mat2 rot = mat2(tan.y, tan.x, -tan.x, tan.y);
        
        // 3. Apply transformation
        vec2 q = (p + pos) * rot;
        
        float sizeScale = 3.0; 
        float s = sdSperm(q*sizeScale);
        d = min(d, s);
    }
    return d;
}

// meh
Shape sdCandleShape(vec2 p, vec3 c1, vec3 c2, float mid, float high) {
    // Flame
    vec2 fP = p;
    float flameWobble = sin(time * 20.0 + p.y * 20.0) * 0.01 * (0.5 + high);
    fP.x += flameWobble;
    fP.y -= 0.5 + 0.05 * mid; // Move flame up based on mid frequency
    
    float flameHead = length(fP / vec2(0.15 + 0.05*mid, 0.25 + 0.1*high)) - 0.1;
    float flameBody = length(fP - vec2(0.0, -0.1)) - 0.15 - 0.05*mid;
    float flameDist = smin(flameHead, flameBody, 0.1);
    
    // Wick
    vec2 wP = p;
    wP.y -= 0.35;
    float wick = sdLine(wP, vec2(0.0, -0.05), vec2(0.0, 0.05)) - 0.01;
    
    // Body
    vec2 bP = p;
    bP.y += 0.3;
    float body = max(abs(bP.x) - 0.15, abs(bP.y) - 0.6);
    
    // Melted wax detail
    vec2 mP = bP;
    mP.y -= 0.6;
    float wax = length(mP - vec2(0.15*sign(bP.x), 0.0)) - 0.03 - 0.01*mid;
    body = smin(body, wax, 0.05);

    // Combine shapes
    float finalD = smin(smin(wick, body, 0.02), flameDist, 0.01);
    
    // Color masking: 1 for flame/wick region, 0 for body
    // Flame is above y=0.25 (roughly), plus some buffer for the smin
    //float colorMask = smoothstep(0.2, 0.3, p.y + flameWobble); 
    float colorMask = smoothstep(0.2, 0.3, p.y+flameWobble); 
    
    return Shape(finalD, c1, c2, 12.0 * colorMask + 1.0, 0.); 
}

float sdLetter(vec2 p, int n) {
    p *= 4.0; 
    float d = 1e10;
    float thickness = 0.02; // Global stroke thickness adjustment
    
    if (n == 83) { // S
        d = min(d, sdLine(p, vec2(0.15, 0.4), vec2(-0.15, 0.4)));
        d = min(d, sdLine(p, vec2(-0.15, 0.4), vec2(-0.15, 0.0)));
        d = min(d, sdLine(p, vec2(-0.15, 0.0), vec2(0.15, 0.0)));
        d = min(d, sdLine(p, vec2(0.15, 0.0), vec2(0.15, -0.4)));
        d = min(d, sdLine(p, vec2(0.15, -0.4), vec2(-0.15, -0.4)));
    } else if (n == 104) { // h
        d = min(d, sdLine(p, vec2(-0.15, 0.5), vec2(-0.15, -0.4)));
        d = min(d, sdLine(p, vec2(-0.15, 0.0), vec2(0.1, 0.0)));
        d = min(d, sdLine(p, vec2(0.1, 0.0), vec2(0.15, -0.1)));
        d = min(d, sdLine(p, vec2(0.15, -0.1), vec2(0.15, -0.4)));
    } else if (n == 97) { // a
        float belly = abs(length(p - vec2(-0.02, -0.2)) - 0.2); 
        float back = sdLine(p, vec2(0.18, 0.0), vec2(0.18, -0.4));
        d = min(belly, back);
    } else if (n == 100) { // d
        d = min(d, sdLine(p, vec2(0.15, 0.5), vec2(0.15, -0.4)));
        d = min(d, abs(length(p - vec2(-0.05, -0.2)) - 0.2)); 
    } else if (n == 101) { // e 
        vec2 center = vec2(0.0, -0.2);
        float radius = 0.2;
        d = min(d, sdLine(p, center, center + vec2(0.2, 0.0)));
        float circle = abs(length(p - center) - radius);
        bool isGap = (p.x > 0.1 && p.y < center.y && p.y > center.y - 0.15);
        d = min(d, isGap ? 1e10 : circle);
    } else if (n == 114) { // r
        d = min(d, sdLine(p, vec2(-0.15, 0.1), vec2(-0.15, -0.4)));
        d = min(d, sdLine(p, vec2(-0.15, 0.0), vec2(0.1, 0.1)));
    } else if (n == 65) { // A
        d = min(d, sdLine(p, vec2(0.0, 0.4), vec2(-0.2, -0.4)));
        d = min(d, sdLine(p, vec2(0.0, 0.4), vec2(0.2, -0.4)));
        d = min(d, sdLine(p, vec2(-0.1, 0.0), vec2(0.1, 0.0)));
    } else if (n == 109) { // m
        d = min(d, sdLine(p, vec2(-0.2, 0.1), vec2(-0.2, -0.4)));
        d = min(d, sdLine(p, vec2(-0.2, 0.1), vec2(0.0, 0.1)));
        d = min(d, sdLine(p, vec2(0.0, 0.1), vec2(0.0, -0.4)));
        d = min(d, sdLine(p, vec2(0.0, 0.1), vec2(0.2, 0.1)));
        d = min(d, sdLine(p, vec2(0.2, 0.1), vec2(0.2, -0.4)));
    } else if (n == 112) { // p
        d = min(d, sdLine(p, vec2(-0.15, 0.1), vec2(-0.15, -0.6)));
        d = min(d, abs(length(p - vec2(0.05, -0.1)) - 0.2));
    }
    return d - thickness;
}


float getShaderAmpText(vec2 uv) {
    float d = 1e10;
    int chars[9] = int[](83, 104, 97, 100, 101, 114, 65, 109, 112);
    vec2 offset = vec2(-1.2, -1.8); // Position bottom left
    uv *=.25;
    uv.y-=1.65;
    for(int i=0; i<9; i++) {
        d = min(d, sdLetter(uv - offset - vec2(float(i)*0.3, 0.0), chars[i]));
    }
    return d;
}

// https://www.shadertoy.com/view/dsKyDz
// adapted from "random emotes animated" by misol101
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec2((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y));
}
vec2 cInv(vec2 p, vec2 o, float r) {
    return (p - o) * r * r / dot(p - o, p - o) + o;
}
float sdArc(in vec2 p, float w, in vec2 o) {
    vec2 pW = cInv(p, vec2(0.), 1.);
    pW = cInv(pW, vec2(0., o.y), 1.);
    pW.y -= o.y;
    return length(vec2(max(0., abs(pW.x - o.x) - w), pW.y));
}
float sdEmoji2(vec2 p, float time) {
    // Seeded by cycle
    float cycle = floor(time / CYCLE_TIME);
    vec2 h = hash22(vec2(cycle, 1.234));
    
    p *= 1.4; 
    float d = 1e10;
    float t = time * (0.8 + (h.x * h.y)); 
    
    // LOOK LOGIC: -0.5 to 0.5 range
    vec2 lk = (0.75 + sin(t * (min(1.4, 0.5 + h.y * 0.66 + h.x * 1.33))) * 0.5) * (h - 0.5);
    
    bool eyeb = fract(4.932 * h.x) < 0.65;
    if (!eyeb) lk *= sin(time * h.x + h.y * 4.0); 
    else if (sin(h.x * h.y) < 0.5) lk = -lk;

    // 1. HEAD (Stationary center)
    float head = abs(length(p) - 1.0) - 0.075;
    d = min(d, head);

    // 2. EYES (Now strictly tracking lk relative to head)
    float blinktime = 0.45;
    float blx = 1.0, bly = 1.0;
    float blt = (mod(time, 8.0) - (h.x * h.y) * 8.0);
    if (blt > 0.0 && blt < blinktime) {
        bly = 1.0 + sin((blt / blinktime) * 3.141) * 1.5;
        blx = 1.0 - sin((blt / blinktime) * 3.141) * 0.4;
    }
    
    // Original perspective logic: uses lk.x to shift eyes
    float pX = lk.x + h.x * 0.15 + 0.3;
    float perspective = 0.25 * sign(pX) * pow(abs(pX), 0.9 + h.y);
    
    // Use (p - lk*0.1) for the features so they stay roughly inside the head circle
    vec2 q = p - lk * 0.2; 
    
    vec2 eyeP = vec2((abs(q.x) - 0.36) * blx + perspective, (q.y - 0.27) * bly);
    d = min(d, length(eyeP) - 0.15);

    // 3. EYEBROWS
    if (eyeb) {
        float eb = 1e10;
        vec2 o = vec2(0., 1.);
        // Symmetrical/Asymmetrical logic using the shifted 'q'
        if (fract(3.447 * h.x) < 0.5) {
            eb = sdArc(vec2(abs(q.x) - 0.35, q.y - 0.5 * fract(1.46 * lk.y) - 0.35), 0.2, 2.0 * fract(h * 2.31) * h.y * o - 0.5 * o);
        } else {
            eb = min(
                sdArc(vec2(q.x - 0.35, q.y - 0.25 * fract(2.31 * lk.y) - 0.4), 0.2, 2.0 * fract(h * 2.31) * h.y * o - 0.5 * o),
                sdArc(vec2(-q.x - 0.35, q.y - 0.25 * fract(-1.81 * lk.y) - 0.4), 0.2, 2.0 * fract(-h * 1.92) * h.y * o - 0.5 * o)
            );
        }
        d = min(d, eb - 0.065);
    }

    // 4. MOUTH
    float mouth;
    if (fract(1.932 * h.x) < 0.10) { 
        float sOsc = sin(0.2 + t * (2.0 * h.x + h.y)) * (0.005 + h.y * 0.08);
        vec2 mP = vec2((q.x - 0.11) * (1.0 - h.y * 0.2), (q.y + 0.27) * 1.1);
        mouth = length(mP) - (0.2 + sOsc);
    } else { 
        float mw = 0.4 * pow(max(0.0, h.x + sin(t * h.y) + 0.8), 0.5);
        mouth = sdArc(q + vec2(0.0, 0.35), mw, vec2(0.35, 1.0) * (fract(2.772 * h) - 0.5)) - 0.08;
    }
    d = min(d, mouth);

    return d / 1.4;
}
float sdEmoji1(vec2 p, float time) {
    // Seeded by cycle so it changes every time it morphs back
    vec2 h = hash22(vec2(floor(time / CYCLE_TIME), 99.0));
    
    p *= 1.4; // Scale
    float d = 1e10;
    float t = time * (0.8 + (h.x * h.y)); // Original speed logic
    
    // Look Logic Parity
    vec2 lk = (0.75 + sin(t * (min(1.4, 0.5 + h.y * 0.66 + h.x * 1.33))) * 0.5) * (0.5 * (h - 0.5));
    bool hasEyebrows = fract(4.932 * h.x) < 0.65;
    
    // The specific "No Eyebrow" look animation
    if (!hasEyebrows) lk *= sin(time * h.x + h.y * 4.0); 
    else if (sin(h.x * h.y) < 0.5) lk = -lk;

    p -= lk * 0.1;

    // Head
    d = min(d, abs(length(p) - 1.0) - 0.075);

    // Eyes (Blink logic + perspective)
    float blinktime = 0.45;
    float blx = 1.0, bly = 1.0;
    float blt = (mod(time, 8.0) - (h.x * h.y) * 8.0);
    if (blt > 0.0 && blt < blinktime) {
        bly = 1.0 + sin((blt / blinktime) * PI) * 1.5;
        blx = 1.0 - sin((blt / blinktime) * PI) * 0.4;
    }
    vec2 eyeP = vec2((abs(p.x - lk.x) - 0.36) * blx + 0.25 * pow(abs(lk.x + h.x * 0.15 + 0.3), 0.9 + h.y), (p.y - 0.27 - lk.y) * bly);
    d = min(d, length(eyeP) - 0.15);

    // Eyebrows (Restoring the asymmetrical logic)
    if (hasEyebrows) {
        float eb = 1e10;
        if (fract(3.447 * h.x) < 0.5) {
            eb = sdArc(vec2(abs(p.x - lk.x) - 0.35, p.y - lk.y - 0.5 * fract(1.46 * lk.y) - 0.35), 0.2, 2.0 * fract(h * 2.31) * h.y * vec2(0,1) - 0.5 * vec2(0,1));
        } else {
            eb = min(
                sdArc(vec2(p.x - lk.x - 0.35, p.y - lk.y - 0.25 * fract(2.31 * lk.y) - 0.4), 0.2, 2.0 * fract(h * 2.31) * h.y * vec2(0,1) - 0.5 * vec2(0,1)),
                sdArc(vec2(-p.x + lk.x - 0.35, p.y - lk.y - 0.25 * fract(-1.81 * lk.y) - 0.4), 0.2, 2.0 * fract(-h * 1.92) * h.y * vec2(0,1) - 0.5 * vec2(0,1))
            );
        }
        d = min(d, eb - 0.065); // Forced thickness
    }

    // Mouth (Parity for all types)
    float mouth;
    if (fract(1.932 * h.x) < 0.10) { // Surprised
        float sOsc = sin(0.2 + t * (2.0 * h.x + h.y)) * (0.005 + h.y * 0.08);
        mouth = length(vec2(((p.x - lk.x) - 0.11) * (1.0 - h.y * 0.2), (p.y + 0.27 - lk.y) * 1.1)) - (0.2 + sOsc);
    } else { // Expression Arcs
        float mw = 0.4 * pow(max(0.0, h.x + sin(t * h.y) + 0.8), 0.5);
        mouth = sdArc(p + vec2(0.0, 0.35) - 0.5 * lk, mw, vec2(0.35, 1.0) * (fract(2.772 * h) - 0.5)) - 0.08;
    }
    d = min(d, mouth);

    return d / 1.4;
}

// Helper for the Bee wing texture since iChannel0 is used for FFT in your shader
float beeWingsTex(vec2 p) {
    return 0.3 + 0.5 * sin(p.x * 20.0) * cos(p.y * 20.0); // Procedural wing pattern
}

vec2 rot(vec2 p, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float sdBee(vec2 p, float t) {
    p *= 1.5;
    float d = 1e10;
    
    // Animation
    float flap = sin(t * 30.0);
    float hover = sin(t * 5.0) * 0.1;
    p.y += hover; 

    // 1. ABDOMEN (The back part with stripes)
    vec2 pAbdo = p - vec2(0.15, 0.0);
    float abdomenShape = length(pAbdo * vec2(0.8, 1.1)) - 0.45;
    
    // Masked Stripes: Only calculate stripes inside the abdomen
    float stripePattern = sin(pAbdo.x * 20.0); // Vertical stripes along the length
    float stripedAbdomen = max(abdomenShape, stripePattern * 0.05); 

    // 2. HEAD & THORAX
    vec2 pHead = p - vec2(-0.35, 0.1);
    float head = length(pHead) - 0.25;
    
    // Body Union
    float body = smin(stripedAbdomen, head, 0.15);

    // 3. WINGS (Fixed Pivot Hinge)
    vec2 lPivot = vec2(-0.1, 0.25);
    vec2 pLW = p - lPivot;
    pLW = rot(pLW, 0.5 + flap * 0.5); // Pivot rotation
    float lWing = length((pLW - vec2(0.0, 0.3)) * vec2(2.5, 1.0)) - 0.3;

    vec2 rPivot = vec2(0.1, 0.2);
    vec2 pRW = p - rPivot;
    pRW = rot(pRW, -0.5 - flap * 0.5); // Pivot rotation
    float rWing = length((pRW - vec2(0.0, 0.3)) * vec2(2.5, 1.0)) - 0.3;

    d = min(body, min(lWing, rWing));

    // 4. ACCESSORIES
    float ant = sdLine(p, vec2(-0.5, 0.25), vec2(-0.7, 0.45)) - 0.01;
    float sting = sdLine(p, vec2(0.5, -0.2), vec2(0.7, -0.35)) - 0.015;

    return min(min(d, ant), sting) / 1.5;
}
float sdBees(vec2 p, float t) {
    float d = 1e10;
    for(int i = 0; i < 5; i++) {
        float fi = float(i);
        
        // Calculate position
        vec2 offset = vec2(
            sin(t * 1.2 + fi * 1.5) * 0.8, 
            cos(t * 0.9 + fi * 2.1) * 0.5
        );
        
        vec2 pBee = p - offset;
        
        // --- DIRECTION LOGIC ---
        // If the bee is on the left (offset.x < 0), we want it facing right.
        // Since your sdBee() is naturally facing left (head at -0.35), 
        // we flip the X axis when offset.x is negative.
        float look = (offset.x < 0.0) ? -1.0 : 1.0;
        pBee.x *= look;
        // -----------------------

        pBee = rot(pBee, sin(t + fi) * 0.2);
        
        d = min(d, sdBee(pBee * 1.6, t + fi)); 
    }
    return d;
}


void main() {
    time = iAmplifiedTime;
    float bass = texture(iAudioData, vec2(0.05, 0.0)).r * 0.7;
    float mid  = texture(iAudioData, vec2(0.25, 0.0)).r * 0.99;
    float high = texture(iAudioData, vec2(0.75, 0.0)).r * 0.6;
    snd = 0.; for(int i=1; i < 100; i++){ snd += FFT(i) * float(i); }
    snd /= 2000.0;

    float zoom = 5. - snd * 2.0, pixel = 1. / iResolution.y;
    vec2 uv = zoom * (2.0 * vUv - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
    
    vec3 col = vec3(0.);
    
    float ringsCount = iRingCount + 4. * (high + bass); 
    
    vec2 mouse;
    if(iMouse.z > 0.0) {
        mouse = (iMouse.xy / iResolution.xy) * 2.0 - 1.0;
    } else {
        mouse = vec2(sin(time * 0.3), cos(time * 0.2) * 0.4);
    }
    
    float yaw = mouse.x * PI, pitch = mouse.y * PI * 0.5;
    vec3 rayDir = normalize(vec3(uv, 2.0)); 
    float cp = cos(pitch), sp = sin(pitch);
    rayDir.yz *= mat2(cp, -sp, sp, cp);
    float cy = cos(yaw), sy = sin(yaw); 
    rayDir.xz *= mat2(cy, -sy, sy, cy);
     // Optional Cubemap Fetch - using equirectangular mapping for 2D texture
    vec3 cubeMap = vec3(0.0);
    if (iUseCubemap > 0.5) {
        // Convert ray direction to equirectangular UV coordinates
        vec2 cubeUV;
        cubeUV.x = atan(rayDir.z, rayDir.x) / (2.0 * PI) + 0.5;
        cubeUV.y = asin(clamp(rayDir.y, -1.0, 1.0)) / PI + 0.5;
        cubeMap = texture(iChannel1, cubeUV).rgb;
    }
    float step_size = (mid + bass) * PI / ringsCount, damp = 1.0;
    Shape s[19];
    for (int i=0; i<int(ringsCount); i++) {
        float angle = time - float(i) * step_size;
        vec2 sUV = (uv - vec2(cos(angle * 2.0), sin(angle * 2.0)) * 0.15 * (bass + mid)) * 0.22;
        float c2_factor = float(i) / ringsCount;
        
         int count = 0;
        if (iUseWeed > 0.5) {
        vec2 wUV = sUV*1.5; wUV.y += 0.85; float theta = atan(wUV.y, wUV.x);
        float wR = (0.2+high*0.5)*(1.+sin(theta))*(1.+0.9*cos(8.*theta))*(1.+0.1*cos(24.*theta))*(0.9+0.05*cos(200.*theta));
        s[count++] = Shape(length(wUV)-wR, vec3(mid*0.1, bass+0.1, high+0.1)*max(0.1, bass/10.), vec3(0,mid/7.,high/2.)*c2_factor*2., 45., 0.);
        }
        if (iUseMush > 0.5) {
        vec2 mP = sUV; mP.y += 0.2; float head = max(length(mP * vec2(1.0, 1.5)) - 0.3, -(mP.y - 0.02));
        float foot = max(max(abs(mP.x) - (0.04 + pow(max(0.0, -mP.y + 0.1), 2.0) * 0.5), mP.y - 0.05), -mP.y - 0.4);
        s[count++] = Shape(min(head, foot) * 1.4, vec3(0.05, high * 0.4, mid * 0.6 + 0.2), vec3(0.0, 0.05, high * 0.3) * c2_factor, 18.0, 0.);
        }
        if (iUseHeart > 0.5) {
        vec2 hP = sUV*1.8+vec2(0,0.7); float k = 1.2*hP.y-sqrt(abs(hP.x)+0.3);
        s[count++] = Shape(hP.x*hP.x+k*k-1.0, vec3(0.8,0.05,0.15)*(1.+high), vec3(0.4,0.,0.1)*c2_factor, 40., 0.);
        }
        if (iUsePhallus > 0.5) {
        vec2 phP = sUV * 0.4; phP.y += 0.21; float sW = 0.06 + bass * 0.04, bS = 0.09 + mid * 0.04;
        vec2 sPos = phP; sPos.y -= clamp(sPos.y, 0.0, 0.28);
        s[count++] = Shape(min(min(length(sPos) - sW, length(phP - vec2(0.0, 0.3)) - (sW * 1.25)), min(length(phP - vec2(-bS, -0.02)) - bS, length(phP - vec2( bS, -0.02)) - bS)), vec3(0.4, 0.2, 0.25), vec3(high * 0.3, 0.0, mid * 0.2) * c2_factor, 4.0, 0.);
        }
        if (iUsePeace > 0.5) {
        vec2 pcP = sUV+vec2(0,0.2); vec2 pcD = vec2(abs(pcP.x), pcP.y)*mat2(0.707,-0.707,0.707,0.707);
        s[count++] = Shape(min(abs(length(pcP)-0.5)-0.025, min(max(abs(pcP.x)-0.025, abs(pcP.y)-0.5), max(abs(pcD.y)-0.025, abs(pcD.x-0.25)-0.25))), vec3(0.1,0.7,0.9)*(1.+mid), vec3(0,0.2,0.5)*c2_factor, 3., 0.);
        }
        if (iUseDancer > 0.5) {
        s[count++] = Shape(sdDancer(sUV * 3.0, time * 4.0), vec3(1.,0.8,0.2)*(1.+high), vec3(0.5,0.4,0.)*c2_factor, 1.55, 0.);
        }
        if (iUseSmiley > 0.5) {
        s[count++] = Shape(sdSmiley(sUV), vec3(1.,0.9,0.)*(1.+high), vec3(0.5,0.35,0.)*c2_factor, 1.5, 0.);
        }
        if (iUseCoffee > 0.5) {
        s[count++] = Shape(sdCoffee(sUV*1.5), vec3(0.4,0.2,0.1)*(1.+mid), vec3(0.2,0.1,0.05)*c2_factor, 1.5, 0.);
        }
        if (iUseBeer > 0.5) {
        s[count++] = Shape(sdBeerBottle(sUV*1.4), vec3(1.,0.6,0.)*(1.+bass), vec3(1.,0.9,0.5)*c2_factor, 1.44, 0.);
        }
        if (iUseBunny > 0.5) {
        s[count++] = Shape(sdBunny(sUV*1.5), vec3(1.,0.8,0.9)*(1.+mid), vec3(0.5,0.2,0.3)*c2_factor, 1.5, 0.);
        }
        if (iUseButterfly > 0.5) {
        s[count++] = Shape(sdButterfly(sUV*1.4), vec3(1.0, 0.4, 0.1)*(1.0 + high), vec3(0.4, 0.1, 0.0)*c2_factor, 2.1, 0.);
        }
        if (iUseFlower > 0.5) {
        s[count++] = sdSunflowerShape(sUV, vec3(0.97,0.84,0.0)*(1.+high), vec3(0.5,0.3,0.1)*c2_factor);
        }
        if (iUseBike > 0.5) {
        s[count++] = Shape(sdBicycle(sUV, time), vec3(0.6, 0.7, 0.9) * (1.0 + mid), vec3(0.2, 0.3, 0.5) * c2_factor, 2.0, 0.0);
        }
        if (iUseMoon > 0.5) {
        float di = 0.5 * cos(time);
        s[count++] = Shape(sdMoon(sUV * 2.5, di, 1.0, 0.8), vec3(0.9, 0.8, 1.0) * (1.0 + high), vec3(0.4, 0.4, 0.6) * c2_factor, 1.8, 0.0);
        }
        if (iUseBalloon > 0.5) {
        s[count++] = Shape(sdBalloon(sUV * 1.5, 0.0), vec3(0.88, 0.18, 0.18) * (1.0 + mid), vec3(0.4, 0.0, 0.0) * c2_factor, 2.0, 0.0);
        }
        if (iUseBalloons > 0.5) {
        s[count++] = Shape(sdBalloons(sUV), vec3(0.2, 0.6, 0.9) * (1.0 + mid), vec3(0.1, 0.1, 0.5) * c2_factor, 2.0, 0.0);
        }
        if (iUseSperm > 0.5) {
        s[count++] = Shape(sdSperm(sUV * 1.5), vec3(0.961,0.902,0.902) * (1.0 + mid), vec3(0.4, 0.0, 0.0) * c2_factor, 2.0, 0.0);
        }
        if (iUseSperms > 0.5) {
        s[count++] = Shape(sdSperms(sUV), vec3(0.9, 0.9, 1.0) * (1.0 + high), vec3(0.4, 0.4, 0.5) * c2_factor, 1.8, 0.0);
        }
        if (iUseSpermsFollow > 0.5) {
        s[count++] = Shape(sdSpermsFollows(sUV), vec3(0.9, 0.9, 1.0) * (1.0 + high), vec3(0.4, 0.4, 0.5) * c2_factor, 1.8, 0.0);
        }
        if (iUseCandle > 0.5) {
        s[count++] = sdCandleShape(sUV*1.5, vec3(1.000,0.667,0.000) * (1.0 + high), vec3(1.000,0.451,0.000) * c2_factor, mid, high); 
        }
         
        if (iUseShaderamp > 0.5) {
        s[count++] = Shape(getShaderAmpText(uv),vec3(1.,0.,0.),vec3(1.000,0.451,0.000) * c2_factor, 5.+snd, high); 
        }
        
        if (iUseEmoji1 > 0.5) {
        s[count++] = Shape(sdEmoji1(sUV, time), vec3(1.0, 0.8, 0.0) * (1.0 + high), vec3(0.5, 0.2, 0.0) * c2_factor, 2.0, 0.0);
        }
        if (iUseEmoji2 > 0.5) {
        s[count++] = Shape(sdEmoji2(sUV, time), vec3(1.0, 0.8, 0.0) * (1.0 + high), vec3(0.5, 0.2, 0.0) * c2_factor, 2.0, 0.0);
        }
        
        if (iUseBee > 0.5) {
        s[count++] = Shape(sdBee(sUV, time), vec3(1.0, 0.8, 0.0) * (1.0 + high), vec3(0.3, 0.2, 0.0) * c2_factor, 2.5, 0.0);
        }
        
        if (iUseBees > 0.5) {
        s[count++] = Shape(sdBees(sUV, time), vec3(1.0, 0.8, 0.0) * (1.0 + high), vec3(0.3, 0.2, 0.0) * c2_factor, 2.5, 0.0);
        }
        
        float ph = fract(time / CYCLE_TIME) * float(count);
        int i1 = int(ph), i2 = (i1 + 1) % count;
        float b = smoothstep(0.7, 1.0, fract(ph));
        float fD = mix(s[i1].d, s[i2].d, b);
        vec3 grn = vec3(0.1, 0.65, 0.0) * (1.0 + mid);
        vec3 c1 = mix(s[i1].c1 + s[i1].c2, grn, s[i1].shapeMask);
        vec3 c2 = mix(s[i2].c1 + s[i2].c2, grn, s[i2].shapeMask);
        col += damp * mix(c1, c2, b) * (0.1 + snd) * tanh(zoom * pixel / abs(fD)) * mix(s[i1].glow, s[i2].glow, b);
        damp *= 0.85;
    }
        
    if (iUseCubemap > 0.5) {
        col += cubeMap * 0.15;
    }
    gl_FragColor = vec4(tanh(col), 1.0);
}
