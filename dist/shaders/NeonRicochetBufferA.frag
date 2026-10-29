// https://www.shadertoy.com/view/N3VXzR
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Neon Ricochet (audio) - Buffer A
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


//1023 15:45
#define ZERO (min(iFrame, 0))
#define CAMBUF iChannel0
#define AUDIO  iChannel1
#define MAX_DIST 180.0
#define VOL_DIST 40.0

const float LIGHT_POWER = 4.0;

const float BEAM_GAIN = 0.4;    

mat3  gColRot;
vec3  gBall;
float gPress;
vec3  gImp;
float gWaveR;
float gWaveAmp;
float gLightDip;
float gFocal = 1.0;
float gTime;
float gBass, gMid, gHigh, gTotal;

vec2 hash22(vec2 p) {
    mat2 m = mat2(13.85, 47.77, 99.41, 88.48);
    return fract(sin(m * p) * 46738.29);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

float line1(float x, float w, float fw) {
    fw += 1e-4;
    float dd = 0.5 - abs(fract(x) - 0.5);
    float a = smoothstep(w - fw, w + fw, dd);
    return mix(a, 1.0 - 2.0 * w, clamp(fw / w * 0.5, 0.0, 1.0));
}
float lineMask(vec2 uv, float w, float fw) {
    return line1(uv.x, w, fw) * line1(uv.y, w, fw);
}

float voronoi(vec2 p) {
    vec2 g = floor(p);
    vec2 f = fract(p);
    float dist = 1.0;
    for (int y = ZERO - 1; y <= 1; y++) {
        for (int x = ZERO - 1; x <= 1; x++) {
            vec2 lattice = vec2(x, y);
            float d = distance(lattice + hash22(g + lattice), f);
            dist = min(dist, d);
        }
    }
    return dist;
}

vec3 getVoronoi2D(vec2 uv, float t) {
    vec2 scaledUV = uv * 2.0 - 1.0;

    float offset = 0.0, r = 0.0;
    for (int k = ZERO; k < 2; k++) {
        float v = voronoi(k == 0 ? uv * 8.0 + vec2(t * 0.5) : uv * 4.0);
        if (k == 0) offset = v; else r = v * 10.0;
    }

    float distDenom = abs(((scaledUV.x + sin(scaledUV.y + t)) + offset) * 30.0);
    float t_val = 1.0 / max(distDenom, 0.002);
    vec3 finalColor = vec3(10.0 * scaledUV.y, 2.0, 1.0 * r) * t_val;
    return abs(gColRot * finalColor);
}

vec3 getTriplanarVoronoi(vec3 lp, float t, bool full) {
    vec3 w = abs(normalize(lp));
    w *= w;
    w /= (w.x + w.y + w.z);

    if (!full) w = step(vec3(max(w.x, max(w.y, w.z))), w);

    vec3 c = vec3(0.0);
    float ws = 0.0;
    for (int i = ZERO; i < 3; i++) {
        float wi = (i == 0) ? w.x : ((i == 1) ? w.y : w.z);
        if (wi > 0.03) {
            vec2 uvA = (i == 0) ? lp.yz : ((i == 1) ? lp.xz : lp.xy);
            c += getVoronoi2D(uvA, t) * wi;
            ws += wi;
        }
    }
    return c / ws;
}

vec3 lightCol(float idx, float t) {
    vec3 baseCol = hash13(idx * 123.4) * 0.8 + 0.2;
    float glitchProb = hash11(idx * 87.1);
    float intensity = 1.0;
    if (glitchProb > 0.6) {
        intensity  = step(0.5, fract(sin(t * 30.0 + idx + gHigh * 60.0) * 43758.5453));
        intensity *= max(0.2, sin(t * 10.0 + idx * 5.0));
    }
    float beat = 0.7 + AUDIO_AMOUNT * gBass * (0.45 + 0.35 * sin(idx * 1.3 - t * 6.0));
    baseCol = mix(baseCol, baseCol.zxy, clamp(gMid * AUDIO_AMOUNT, 0.0, 1.0) * 0.5);
    return baseCol * intensity * beat * gLightDip;
}

float sphSoftShadow(vec3 ro, vec3 rd, vec4 sph, float k) {
    vec3 oc = ro - sph.xyz;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - sph.w * sph.w;
    float h = b * b - c;
    float d = sqrt(max(0.0, sph.w * sph.w - h)) - sph.w;
    float t = -b - sqrt(max(h, 0.0));
    return (t < 0.0) ? 1.0 : smoothstep(0.0, 1.0, 2.5 * k * d / t);
}

      

vec3 beamApex(float idx) {
    return vec3(0.0, ROOM_H - 0.2, idx * LS + LS * 0.5);
}


vec3 beamDir(float idx, float t) {
    float ph  = hash11(idx * 17.3) * 6.2831;
    float spd = 0.5 + hash11(idx * 3.7) * 0.7;
    float mag = 0.22 + 0.22 * gMid * AUDIO_AMOUNT;
    vec2 sw = vec2(sin(t * spd + ph), cos(t * spd * 0.8 + ph * 1.7)) * mag;
    return normalize(vec3(sw.x, -1.0, sw.y));
}

float beamProfile(vec3 p, vec3 A, vec3 D, float tanH) {
    vec3 v = p - A;
    float along = dot(v, D);
    float perp = length(v - D * along);
    float r = max(along, 0.0) * tanH + 0.05;
    float prof = 1.0 - smoothstep(0.35 * r, r, perp);
    return along > 0.0 ? prof : 0.0;
}

void gatherLight(vec3 p, vec3 n, vec3 rd, float shin, float t, vec4 sph,
                 bool shadows, out vec3 diff, out vec3 spec) {
    diff = vec3(0.0);
    spec = vec3(0.0);
    float cell = floor(p.z / LS);
    float nb = cell + (fract(p.z / LS) > 0.5 ? 1.0 : -1.0);
    float tanH = 0.22 * (1.0 + 0.4 * AUDIO_AMOUNT * gBass);
    for (int i = ZERO; i < 2; i++) {
        float idx = (i == 0) ? cell : nb;
        vec3 lp = beamApex(idx);
        vec3 L = lp - p;
        float d2 = dot(L, L);
        L *= inversesqrt(d2);
        float att = 1.0 / (1.0 + 0.08 * d2);

        float spot = beamProfile(p, lp, beamDir(idx, t), tanH);
        float pool = 0.5 + 1.2 * spot;

        vec3 lc = lightCol(idx, t) * att * LIGHT_POWER * pool;
        float sh = shadows ? sphSoftShadow(p + n * 0.01, L, sph, 8.0) : 1.0;
        vec3 h = normalize(L - rd);
        diff += lc * max(dot(n, L), 0.0) * sh;
        spec += lc * pow(max(dot(n, h), 0.0), shin) * sh;
    }
}
vec3 getLocalSpherePos(vec3 p, vec3 center) {
    vec3 localP = p - center;
    float rollAngle = -center.z;
    mat2 rotX = mat2(cos(rollAngle), -sin(rollAngle), sin(rollAngle), cos(rollAngle));
    localP.yz *= rotX;
    return localP;
}

void setupFrame(float t) {
    float cs = cos(t), sn = sin(t);
    float k = (1.0 - cs) / 3.0, r = sn * 0.57735027;
    gColRot = mat3(cs + k, k - r, k + r,
                   k + r, cs + k, k - r,
                   k - r, k + r, cs + k);

    gTime = t;
    gBall = getSpherePos(t);
    float bh = abs(sin(t * 3.5)) * 1.5;
    gPress = 1.0 - smoothstep(0.0, 0.45, bh);

    float ti = mod(t * 3.5, PI) / 3.5;
    gImp = vec3(0.0, 0.0, gBall.z - 4.0 * ti);
    gWaveR = 7.0 * ti;
    gWaveAmp = 0.35 * exp(-ti * 2.5);
    gLightDip = 1.0 - 0.35 * exp(-ti * 12.0);
}

float deformD(vec3 q, float kind) {
    float K, fo, A;
    if (kind < 0.5)      { K = 0.17; fo = 0.30; A = 1.0; }
    else if (kind < 1.5) { K = 0.22; fo = 0.09; A = 0.9; }
    else                 { K = 0.10; fo = 0.06; A = 0.4; }

    vec3 db = q - gBall;
    float w = -gPress * K * exp(-dot(db, db) * fo);

    float r = length(q - gImp);
    float x = r - gWaveR;
    float wave = sin(x * 2.6) * exp(-x * x * 0.5) * gWaveAmp / (1.0 + 0.25 * r);
    float vib = AUDIO_AMOUNT * gBass * 0.05 * sin(length(db) * 2.5 - gTime * 12.0)
              * exp(-dot(db, db) * 0.04);
    return w + (wave + vib) * A;
}


bool planeHit(vec3 ro, vec3 rd, vec3 N0, float c, vec3 T1, vec3 T2, float kind,
              out float s, out vec3 n) {
    float den = dot(rd, N0);
    s = (c - dot(ro, N0)) / den;
    n = N0;
    vec3 q = ro + rd * s;
    
    if (abs(q.z - gImp.z) < 11.0) {
  
        const float EPS = 0.02; 
        for (int it = ZERO; it < 3; it++) {
            vec3 p = ro + rd * s;
            float hgt = dot(p, N0) - c;
            vec3 pp = p - N0 * hgt;

            float D0 = deformD(pp, kind);
            float D1 = deformD(pp + T1 * EPS, kind);
            float D2 = deformD(pp + T2 * EPS, kind);
            
            float g1 = (D1 - D0) / EPS;
            float g2 = (D2 - D0) / EPS;

            float fp = den - (g1 * dot(rd, T1) + g2 * dot(rd, T2));
            fp = (fp < 0.0 ? -1.0 : 1.0) * max(abs(fp), 0.08); 
            s -= 0.75 * (hgt - D0) / fp; 
        }
        
        vec3 pFinal = ro + rd * s;
        float hgtFinal = dot(pFinal, N0) - c;
        vec3 ppFinal = pFinal - N0 * hgtFinal;
        
        const float N_EPS = 0.01;
        float dx = deformD(ppFinal + T1 * N_EPS, kind) - deformD(ppFinal - T1 * N_EPS, kind);
        float dy = deformD(ppFinal + T2 * N_EPS, kind) - deformD(ppFinal - T2 * N_EPS, kind);
        
        n = normalize(N0 - (dx / (2.0 * N_EPS)) * T1 - (dy / (2.0 * N_EPS)) * T2);
    }
    return s > 1e-3;
}

vec2 trace(vec3 ro, vec3 rd, vec4 sph, out vec3 n) {
    float tmin = MAX_DIST;
    float mat = 0.0;
    n = vec3(0.0, 1.0, 0.0);

    vec3 oc = ro - sph.xyz;
    float b = dot(oc, rd);
    float cc = dot(oc, oc) - sph.w * sph.w;
    float h = b * b - cc;
    if (h > 0.0) {
        float ss = -b - sqrt(h);
        if (ss > 1e-3) { tmin = ss; mat = 1.0; n = (oc + rd * ss) / sph.w; }
    }

    for (int i = ZERO; i < 2; i++) {
        vec3 N0, T1;
        float c, kind;
        bool ok, neg;
        if (i == 0) {
            ok = abs(rd.y) > 1e-4;
            neg = rd.y < 0.0;
            N0 = neg ? vec3(0, 1, 0) : vec3(0, -1, 0);
            c = neg ? 0.0 : -ROOM_H;
            T1 = vec3(1, 0, 0);
            kind = neg ? 0.0 : 2.0;
        } else {
            ok = abs(rd.x) > 1e-4;
            neg = rd.x < 0.0;
            N0 = neg ? vec3(1, 0, 0) : vec3(-1, 0, 0);
            c = -ROOM_W;
            T1 = vec3(0, 1, 0);
            kind = 1.0;
        }
        if (ok) {
            float s; vec3 nn;
            if (planeHit(ro, rd, N0, c, T1, vec3(0, 0, 1), kind, s, nn) && s < tmin) {
                tmin = s;
                n = nn;
                if (i == 0) {
                    if (neg) mat = 2.0;
                    else {
                        vec3 q = ro + rd * s;
                        float lz = mod(q.z, LS) - LS * 0.5;
                        mat = (abs(q.x) < 0.5 && abs(lz) < 0.5) ? 6.0 : 3.0;
                    }
                } else {
                    mat = neg ? 4.0 : 5.0;
                }
            }
        }
    }
    return vec2(tmin, mat);
}

float footprint(float d, vec3 n, vec3 rd) {
    return clamp(1.25 * d / (iResolution.y * gFocal * max(abs(dot(n, rd)), 0.08)), 0.0, 0.5);
}

vec3 calcVolumetrics(vec3 ro, vec3 rd, float maxD, float t, float dither) {
    const int STEPS = 45; 
    float dist = min(maxD, VOL_DIST);
    
    vec3 acc = vec3(0.0);
    float lastCell = -1e9;
    vec3 lc = vec3(0.0);
    vec3 D = vec3(0.0, -1.0, 0.0);
    vec3 A = vec3(0.0);
    float tanH = 0.14 * (1.0 + 0.4 * AUDIO_AMOUNT * gBass);

    float s = 0.2 * dither; 

    for (int i = ZERO; i < STEPS; i++) {
        if (s > dist) break;
        
        float stepSize = 0.2 + s * 0.04; 
        if (s + stepSize > dist) stepSize = dist - s; 

        vec3 p = ro + rd * s;
        float cell = floor(p.z / LS);
        if (cell != lastCell) {
            lc = lightCol(cell, t);
            D = beamDir(cell, t);
            A = beamApex(cell);
            lastCell = cell;
        }

        
        float fogNoise = vnoise(vec2(p.x * 0.35 + sin(t * 0.2), p.z * 0.15 - t * 0.18));
        float fogDensity = 0.022 + 0.016 * fogNoise;

       vec3 fogTint = mix(vec3(0.04, 0.16, 0.22), vec3(0.22, 0.04, 0.15),
                           smoothstep(-ROOM_W, ROOM_W, p.x));
                           
       fogTint += lc * 0.08;

   
        fogDensity *= 1.0 + 0.25 * AUDIO_AMOUNT * gBass;

        acc += fogTint * fogDensity * stepSize;

      
        vec3 v = p - A;
        float along = dot(v, D);
        
        if (along > 0.0 && p.y <= A.y) {
            float perp = length(v - D * along);
            float r = along * tanH + 0.04;
            
            float prof = smoothstep(r + 0.15, r * 0.4, perp);
            
            if (prof > 0.0) {
                float dust = 0.65 + 0.7 * vnoise(vec2(p.x * 1.3 + p.y * 0.9, p.z * 1.1 - p.y * 0.7) + t * 0.4);
                float fall = 1.0 / (1.0 + 0.03 * along * along);
                
                acc += lc * prof * dust * fall * stepSize;
            }
        }
        s += stepSize;
    }
    return acc * BEAM_GAIN;
}



vec3 renderSurface(vec3 p, inout vec3 n, vec3 rd, float mat, float t, float px,
                   vec4 sph, bool full, out float refl) {
    refl = 0.0;

   
    if (mat > 5.5) {
        vec3 lc = lightCol(floor(p.z / LS), t);
        vec2 q = abs(vec2(p.x, mod(p.z, LS) - LS * 0.5));
        float edge = 1.0 - smoothstep(0.30, 0.50, max(q.x, q.y));
        return lc * (1.2 + 1.8 * edge); 
    }

    bool isSph = mat < 1.5;
    vec3 albedo = vec3(0.1);
    vec3 emis = vec3(0.0);
    vec3 vor = vec3(0.0);
    float shin = 40.0;
    float specAmt = 0.5;
    float ao = 1.0;
    float nf = 1.0 / (1.0 + px * 60.0);

    vec3 sc = 0.5 + 0.5 * cos(t * 0.8 + vec3(0.0, 2.0, 4.0));
    float xr = length(p - gImp) - gWaveR;
    float ring = exp(-xr * xr * 1.2) * gWaveAmp * 2.5;

    if (isSph) {
        vor = getTriplanarVoronoi(getLocalSpherePos(p, sph.xyz), t, full);
        shin = 32.0;
    }

    else if (mat < 2.5) {
        vec2 uv = p.xz;
        vec2 fr = fract(uv);
        vec2 e = 0.5 - abs(fr - 0.5);

        float big   = lineMask(uv, 0.014, px);
        float small = lineMask(uv * 4.0, 0.03, px * 4.0);
        float rnd   = hash12(floor(uv));

        vec2 bev = 1.0 - smoothstep(vec2(0.0), vec2(0.04), e);
        n.xz += sign(fr - 0.5) * bev * 0.55 * nf;
        float grain = vnoise(uv * vec2(60.0, 14.0)) - 0.5;
        n.xz += vec2(grain * 0.05, grain * 0.02) * nf;
        n = normalize(n);

        albedo = mix(vec3(0.07, 0.08, 0.095), vec3(0.13, 0.14, 0.16), rnd);
        albedo *= mix(0.6, 1.0, small);
        albedo *= big;
        albedo *= 0.8 + 0.4 * vnoise(uv * 3.0);

        vec3 neon = (p.x < 0.0) ? vec3(0.1, 0.9, 1.0) : vec3(1.0, 0.15, 0.65);
        float strip = 1.0 - smoothstep(0.02, 0.03 + px, abs(abs(p.x) - 2.65));
        float pulse = (0.55 + 0.45 * sin(p.z * 0.8 - t * 3.0)) * (0.7 + 1.6 * AUDIO_AMOUNT * gMid);
        emis += neon * strip * (pulse + ring * 2.0) * 2.0;
        emis += neon * exp(-abs(abs(p.x) - 2.65) * 7.0) * 0.06 * pulse;
        emis += sc * ring * 0.5;

        ao = 0.6 + 0.4 * smoothstep(0.0, 1.2, ROOM_W - abs(p.x));
        shin = 90.0;
        specAmt = 1.2 * (0.6 + 0.8 * vnoise(uv * 8.0));
        refl = 0.22;
    }
    else if (mat < 3.5) {
    
        /* Kind of prefer this roof material ? 
        vec2 uv = p.xz * 0.5;
        albedo = vec3(0.05, 0.055, 0.065) * lineMask(uv, 0.015, px * 0.5);
        float lz = mod(p.z, LS) - LS * 0.5;
        float frame = 1.0 - smoothstep(0.55, 0.62, max(abs(p.x), abs(lz)));
        albedo = mix(albedo, vec3(0.02), frame);
        shin = 60.0;
        specAmt = 0.4;
        ao = 0.8;
        */
        
        /* The Voronoi patten in the roof  
        vec2 uv = p.xz * 0.5;
        float mask = lineMask(uv, 0.015, px * 0.5);
        albedo = vec3(0.05, 0.055, 0.065) * mask;
        
        float lz = mod(p.z, LS) - LS * 0.5;
        float frame = 1.0 - smoothstep(0.55, 0.62, max(abs(p.x), abs(lz)));
        albedo = mix(albedo, vec3(0.02), frame);

      
        vec2 vorUV = p.xz * 0.12;
        vec3 roofVor = getVoronoi2D(vorUV, t * 0.4);


        float vorIntensity = 0.025 + 0.025 * AUDIO_AMOUNT * gMid;
        emis += roofVor * vorIntensity * (1.0 - frame);

        shin = 60.0;
        specAmt = 0.4;
        ao = 0.8;
        
        */
     
        vec2 uv = p.xz * 0.5;
        float mask = lineMask(uv, 0.015, px * 0.5);
        albedo = vec3(0.035, 0.04, 0.045) * mask;
        
        float lz = mod(p.z, LS) - LS * 0.5;
        float frame = 1.0 - smoothstep(0.55, 0.62, max(abs(p.x), abs(lz)));
        albedo = mix(albedo, vec3(0.02), frame);

        vec2 suv = p.xz * 0.16;
        vec2 drift = vec2(sin(t * 0.35 + p.z * 0.15) * 0.3, t * 0.22);
        
        float s1 = vnoise(suv + drift);
        float s2 = vnoise(suv * 2.3 - drift * 0.5 + s1 * 0.65);
        float smoke = smoothstep(0.28, 0.80, s1 * 0.55 + s2 * 0.45);

         vec3 lc = lightCol(floor(p.z / LS), t);
        vec3 hazeBase = vec3(0.05, 0.07, 0.09);
        vec3 smokeLit = mix(hazeBase, lc * 0.4, 0.5);
        vec3 smokeCol = mix(vec3(0.0), smokeLit, smoke);

        float smokeGain = 0.45 + 0.20 * AUDIO_AMOUNT * gBass;
        emis += smokeCol * smokeGain * (1.0 - frame * 0.6);

        shin = mix(60.0, 25.0, smoke);
        specAmt = mix(0.4, 0.15, smoke);
        ao = 0.85;
        
        
    }
    else {
        bool teal = mat < 4.5;
        vec3 tone = teal ? vec3(0.04, 0.12, 0.15) : vec3(0.14, 0.05, 0.11);
        vec3 neon = teal ? vec3(0.1, 0.9, 1.0)    : vec3(1.0, 0.15, 0.65);

        vec2 wuv = vec2(p.z * 0.5, p.y * 0.8);
        vec2 f = fract(wuv);
        vec2 cid = floor(wuv);
        float rnd = hash12(cid + (teal ? 0.0 : 17.0));
        float fwu = px * 0.8;

        float panel = lineMask(wuv, 0.015, fwu);

        vec2 e = 0.5 - abs(f - 0.5);
        vec2 bev = 1.0 - smoothstep(vec2(0.0), vec2(0.05), e);
        vec2 sg = sign(f - 0.5);
        n.z += sg.x * bev.x * 0.5 * nf;
        n.y += sg.y * bev.y * 0.5 * nf;
        n = normalize(n);

        albedo = tone * (0.7 + 0.6 * rnd) * panel;
        albedo *= 0.85 + 0.3 * vnoise(vec2(p.z * 3.0, p.y * 40.0)) * nf + 0.15 * (1.0 - nf);

        float lower = 1.0 - smoothstep(0.95, 1.05, p.y);
        float ribs = line1(p.z * 4.0, 0.12, px * 4.0);
        albedo = mix(albedo, albedo * 0.45 * mix(1.0, ribs, 0.8), lower);

        if (rnd > 0.78) {
            float inside = smoothstep(0.12, 0.12 + fwu + 0.02, min(f.x, 1.0 - f.x))
                         * smoothstep(0.20, 0.20 + fwu + 0.02, min(f.y, 1.0 - f.y));
            float slat = line1(wuv.y * 7.0, 0.18, fwu * 7.0);
            albedo *= mix(1.0, slat * 0.8 + 0.2, inside);
        }

        if (rnd < 0.15) {
            vec2 q = abs(f - vec2(0.5, 0.75));
            float led = 1.0 - smoothstep(0.05, 0.05 + px, max(q.x * 2.0, q.y * 1.25));
            vec3 lcol = mix(vec3(1.0, 0.5, 0.1), vec3(0.2, 1.0, 0.4), step(0.07, rnd));
            float blink = step(0.5, fract(t * 0.5 + rnd * 10.0));
            float hb = smoothstep(0.05, 0.25, AUDIO_AMOUNT * gHigh * (0.5 + 6.0 * rnd));
            emis += lcol * led * (0.3 + 2.7 * max(blink, hb));
        }

        float pulse = (0.55 + 0.45 * sin(p.z * 0.9 - t * 3.0)) * (0.7 + 1.6 * AUDIO_AMOUNT * gMid);
        float band = 1.0 - smoothstep(0.03, 0.05 + px, abs(p.y - 3.6));
        float low = 1.0 - smoothstep(0.02, 0.04 + px, abs(p.y - 0.15));
        emis += neon * band * (pulse + ring * 2.0) * 2.2;
        emis += neon * low * (0.8 + ring * 2.0 + 3.0 * AUDIO_AMOUNT * gBass);
        emis += neon * exp(-abs(p.y - 3.6) * 6.0) * 0.07 * pulse;
        emis += sc * ring * 0.4;

        ao = (0.55 + 0.45 * smoothstep(0.0, 1.0, p.y))
           * (0.6 + 0.4 * smoothstep(0.0, 0.8, ROOM_H - p.y));
        shin = 50.0;
        specAmt = 0.6;
        refl = 0.14;
    }


    vec3 di = sph.xyz - p;
    float l = length(di);
    if (!isSph) {
        float occ = clamp(max(dot(n, di) / l, 0.0) / (l * l), 0.0, 1.0);
        ao *= 1.0 - 0.85 * occ;
    }

   
    vec3 dl, sl;
    gatherLight(p, n, rd, shin, t, sph, full && !isSph, dl, sl);

     if (isSph) {
        float amb = 0.15 + 0.85 * clamp(0.5 + 0.5 * n.y, 0.0, 1.0);
        float lit = clamp(dot(dl, vec3(0.3333)), 0.0, 1.0);
        refl = 0.16;

      
        float fres = 1.0 - max(dot(n, -rd), 0.0);
        float rim = pow(fres, 3.2);

   
        vec3 vorRim = (vor + 0.15 * sc) * rim * (0.35 + 0.75 * AUDIO_AMOUNT * gBass);

   
        float pump = 1.0 + AUDIO_AMOUNT * (0.35 * gBass + 0.2 * gMid);
        vec3 sphereCol = vor * (0.6 * amb + 0.4 * lit) + sl * 0.5;

        return sphereCol * pump + vorRim;
    }


    float sd2 = dot(di, di);
    dl += sc * (0.5 + 0.5 * dot(n, di / l)) * 1.2 / (1.0 + sd2 * 0.5) * 0.5;

    vec3 ambCol = mix(vec3(0.15, 0.45, 0.55), vec3(0.55, 0.2, 0.45),
                      smoothstep(-ROOM_W, ROOM_W, p.x))
                * (0.12 + 0.12 * (0.5 + 0.5 * n.y)) * (1.0 + 0.8 * AUDIO_AMOUNT * gMid);

    vec3 col = albedo * (dl * (0.4 + 0.6 * ao) + ambCol * ao);
    col += sl * specAmt * ao;
    col += emis;
    return col;
}

vec3 renderScene(vec2 fragCoord, float tt, vec3 ro, vec3 ta, float focal, float seed) {
    setupFrame(tt);

    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    vec4 sph = vec4(gBall, 1.0);
    gFocal = focal;

    mat3 cam = setCamera(ro, ta);
    vec3 rd = cam * normalize(vec3(uv, focal));

    float dither = fract(52.9829189 * fract(dot(fragCoord + seed * 17.0,
                                                vec2(0.06711056, 0.00583715))));
    vec3 fogCol = vec3(0.012, 0.014, 0.024);

    vec3 acc = vec3(0.0);
    float w = 1.0;
    vec3 o = ro, dir = rd;
    float dist = 0.0;
    float d0 = MAX_DIST;
    bool hit0 = false;

    for (int b = ZERO; b < 2; b++) {
        vec3 n;
        vec2 hit = trace(o, dir, sph, n);
        vec3 c;
        float kR = 0.0;

        if (hit.y > 0.5) {
            vec3 p = o + dir * hit.x;
            float px = footprint(dist + hit.x, n, dir) * (b == 0 ? 1.0 : 1.5);
            float refl;
            c = renderSurface(p, n, dir, hit.y, tt, px, sph, b == 0, refl);

            if (b == 0) {
                d0 = hit.x;
                hit0 = true;
                float fres = pow(1.0 - max(dot(n, -dir), 0.0), 4.0);
                kR = (refl > 0.0) ? mix(refl, 0.5, fres) : 0.0;
            } else {
                c = mix(c, fogCol, 1.0 - exp(-0.0008 * hit.x * hit.x));
            }
            o = p + n * 0.003;
            dir = reflect(dir, n);
            dist += hit.x;
        } else {
            c = (b == 0) ? fogCol : vec3(0.01, 0.012, 0.02);
        }

        acc += w * c * (1.0 - 0.6 * kR);
        w *= kR;
        if (w <= 0.0) break;
    }

    if (hit0) acc = mix(acc, fogCol, 1.0 - exp(-0.0008 * d0 * d0));

    acc += calcVolumetrics(ro, rd, d0, tt, dither);
    return acc;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec4 au = texelFetch(AUDIO, ivec2(0, 0), 0);
    gBass  = pow(clamp(au.x, 0.0, 1.0), 3.0);
    gMid   = pow(clamp(au.y, 0.0, 1.0), 2.0);
    gHigh  = pow(clamp(au.z, 0.0, 1.0), 2.5);
    gTotal = clamp(au.w, 0.0, 1.0);

    int N = int(texelFetch(CAMBUF, ivec2(0, 0), 0).x + 0.5);


    if (N < 1) {
        float t = iTime;
        vec3 ball = getSpherePos(t);
        vec3 ro = ball + vec3(0.0, 1.5, -6.5);   
        vec3 ta = ball + vec3(0.0, -0.2, 4.0);   
        float focal = 1.1;

        vec3 col = renderScene(fragCoord, t, ro, ta, focal, 0.0);
        fragColor = vec4(col, 1.0);
        return;
    }

    
    vec3 acc = vec3(0.0);
    for (int j = ZERO; j < MAX_SAMPLES; j++) {
        if (j >= N) break;
        vec4 a = texelFetch(CAMBUF, ivec2(1 + 2 * j, 0), 0);
        vec4 b = texelFetch(CAMBUF, ivec2(2 + 2 * j, 0), 0);
        acc += renderScene(fragCoord, b.w, a.xyz, b.xyz, a.w, float(j));
    }
    
    fragColor = vec4(acc / float(N), 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
