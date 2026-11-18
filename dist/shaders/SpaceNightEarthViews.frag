// https://www.shadertoy.com/view/7ffyR2
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: Space Night - Earth Views b
// License: Please check the original shader's license at https://www.shadertoy.com/view/7ffyR2

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
uniform samplerCube iChannel0;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

// Merged multiple shaders
// Replaced "Habitable(?) Audio Planet"'s planet by ArthurTent (https://www.shadertoy.com/view/w3jGD3)
// with "The Blue Marble (earth)" by TheArchCoder (https://www.shadertoy.com/view/scfyWN)
// Original Habitable Audio Planet was based on 
// "Habitable Planet" by Kali https://www.shadertoy.com/view/WdScRW


const float PI = 3.14159265;

const float WAVE  = 0.70;
const float FINE  = 0.30;
const float GRAIN = 0.20;
const float SHARP = 0.60;
const float BEND  = 0.014;
const float SHORE = 3.0;
const float COAST = 1.2;
float objcol;

const float CLOUDS      = 0.70;
const float CLOUD_COVER = 0.1;
const float CLOUD_DENSE = 0.1;
const float CLOUD_SHARP = 0.30;
const float CLOUD_SWIRL = 1.00;
const float CLOUD_DRIFT = 0.015;

const float NIGHT      = 0.1;
const float GLINT      = 14.0;
const float GLINT_SIZE = 0.60;

const float SPIN = 0.12;

// Terrain: real elevation (ETOPO1, packed into Buffer A), sea level = the coastline map.
#define TERRAIN_SHADOW                 // comment out for a cheaper version without mountain shadows
const float RELIEF = 0.07;             // height of a 6500 m mountain in scene units (EARTH_R = 3.31) -> exaggerated
const float DETAIL = 0.5;              // ridge noise on top of the (low-res) elevation data, 0 = smooth
const int   TERRAIN_STEPS = 96;
const float FILM = 0.025;
const float FILM_RATE = 8.0;
const float SPACE = 0.70;
const vec3 cloud_color = vec3(1.3);

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// this song doesn't have the right volume. try it with another song to see VARIANT + VARIANT2
// planet flash + extra rotation
#define VARIANT
//background flash (by inverting whole screen when snare>0.71)
//#define VARIANT2 
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
#define aTime 128./60.*iAudioTime
mat2 rotM(float r){float c = cos(r), s = sin(r); return mat2(c,s,-s,c);} //2D rotation matrix
float snd = 0.;
float snareLevel=0.;
// this is a poor adaption of ShaderAmp's iAmplifiedTime
float iAudioTime=0.; // I usually use this var from ShaderAmp. it doesn't work the same on shadertoy.com as on ShaderAmp
vec3 rd;
const float det = .001;
vec3 ldir = vec3(2., .5, -.5);
const vec3 atmo_color = vec3(.4, .65, .9);

// adapted from QuantumSuper's "Solum Object" shader
vec2 getPlane(vec2 p){
    if(iTime<10.) return p; // intro
    if(snd<.3){ p*=-1.5*rotM(sign(snd*10.)*aTime/8.);}
    float fTime = fract(iAudioTime/64.);
    if (fract(aTime/32.)<.75) return p; //break, standard view
    else if (fTime<.33) {p = 2.5*fract(p*2.*abs(sin(aTime/8.))+.5)-.5; p.y-=.5;} //scaling multiples
    else if (fTime<.66) p *= 1.5*rotM(sign(fract(aTime/32.)-.5)*aTime/8.); //rotation
    //else p = snd*sin( PI*p + vec2( sign(fract(aTime/32.)-.5) * aTime/4., 0)); //moving warp multiples
    if(snd<.3){ p*=1.5*rotM(sign(snd*10.)*aTime/4.);}
    else{p*=(.1+snd*3.);}
    return p;
}

// MIT Licensed hash From Dave_Hoskins (https://www.shadertoy.com/view/4djSRW)
vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

// Not certain about the origin. Kali?
vec3 stars(in vec3 p)
{
    vec3 c = vec3(0.);
    float res = iResolution.x*0.8;
    
	for (float i=0.;i<4.;i++)
    {
        vec3 q = fract(p*(.15*res))-0.5;
        //q*= snd/10.;
        vec3 id = floor(p*(.15*res));
        vec2 rn = hash33(id).xy;
        float c2 = 1.-smoothstep(0.,.6,length(q));
        c2 *= step(rn.x,.0005+i*i*0.001);
        c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.25+0.75);
        p *= 1.4;
    }
    return c*c*.65;
}

// Orbit camera, drag to rotate (with a little spin-out). The yaw/pitch state lives in
// Buffer A (iChannel2) pixel (0,0); that needs Buffer A's iChannel0 bound to Buffer A itself. Without
// that binding it falls back to absolute mouse position. Before the first drag it drifts slowly.
// The same matrix rotates the camera, the planet rays, the star rays and the sun, so dragging
// orbits around the Earth while the day side stays facing you.
mat3 orbit() {
    float yaw, pitch;
    if (texelFetch(iChannel2, ivec2(2, 0), 0).y > 0.5) {
        vec4 st = texelFetch(iChannel2, ivec2(0, 0), 0);
        yaw = st.x;
        pitch = st.y;
    } else if (iMouse.x <= 0.0 && iMouse.y <= 0.0) {
        yaw = iTime * 0.05;
        pitch = 0.25 * sin(iTime * 0.07);
    } else {
        vec2 m = iMouse.xy / iResolution.xy;
        yaw = (m.x - 0.5) * 2.0 * PI;
        pitch = clamp((0.5 - m.y) * PI, -1.4, 1.4);   // drag up = look at the north
    }
    float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
    mat3 rY = mat3(cy, 0.0, -sy,  0.0, 1.0, 0.0,  sy, 0.0, cy);
    mat3 rX = mat3(1.0, 0.0, 0.0,  0.0, cp, sp,  0.0, -sp, cp);
    return rY * rX;
}

// Distance to the Earth sphere. The old procedural Kali-set terrain had its own
// continents, a different sea level (land up to r~3.8 vs water 3.31) and a different
// spin rate, so the audio glow marched against a "ghost" planet that never lined up
// with the texture-mapped Earth. Use the same sphere as hitSphere().
const float EARTH_R = 3.31;
float de(vec3 p) {
    return length(p) - EARTH_R;
}

float kset(int it, vec3 p, vec3 q, float sc, float c) {
    
    //p.xz *= rot(iAmplifiedTime * .12);
    p.xz *= rot(iAudioTime * .14);
    
#ifdef VARIANT
    //p.xz*=rot(iAmplifiedTime *.4);
    p.xz*=rot(iAudioTime *.4);
#endif 
    p += q;
    p *= sc;
    float l = 0., l2;
    for (int i = 0; i < it; i++) {
        p = abs(p) / dot(p, p) - c;
        l += exp(-1. * abs(length(p) - l2));
        l2 = length(p);
    }
    return l * .08;    
}

float clouds(vec3 p2, vec3 dir) {
        p2 -= .1 * dir;
        p2.y *= 3.;
        float cl1 = 0., cl2 = 0.;
        for (int i = 0; i < 15; i++) {
            p2 -= .05 * dir;
            cl1 += kset(20, p2, vec3(1.7, 3., .54), .3, .95);
            cl2 += kset(18, p2, vec3(1.2, 1.7, 1.4), .2, .85);
        }    
        cl1 = pow(cl1 * .045, 10.);
        cl2 = pow(cl2 * .055, 15.);
        return cl1 - cl2;
}


float de_clouds(vec3 p, vec3 dir) {
    return length(p)-clouds(p, dir)*.05;
}


vec3 normal(vec3 p) {
    vec3 eps = vec3(0., det, 0.);
    return normalize(vec3(de(p + eps.yxx), de(p + eps.xyx), de(p + eps.xxy)) - de(p));
}

vec3 normal_clouds(vec3 p, vec3 dir) {
    vec3 eps = vec3(0., .05, 0.);
    vec3 n = normalize(vec3(de_clouds(p + eps.yxx, dir), de_clouds(p + eps.xyx, dir), de_clouds(p + eps.xxy, dir)) - de_clouds(p, dir));
    return n;
}


float hash3(vec3 p) {
    p = fract(p * 0.483099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i),                 hash3(i + vec3(1, 0, 0)), f.x),
                   mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
                   mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm3(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = min(iFrame, 0); i < 5; i++) {
        v += a * noise3(p);
        p = p * 2.03 + vec3(7.1, 3.3, 5.7);
        a *= 0.5;
    }
    return v;
}

// Map data lives on the +Z face of Cube A (iChannel0), see the Cube A pass.
// Map pixel (x,y) -> cube direction; at texel centres the lookup is exact.
vec3 mapDir(vec2 p) { return vec3(p / 512.0 - 1.0, 1.0); }
vec4 mapTexel(ivec2 c) { return textureLod(iChannel0, mapDir(vec2(c) + 0.5), 0.0); }

float coastAt(ivec2 c) {
    c.x = ((c.x % 768) + 768) % 768;
    c.y = clamp(c.y, 0, 383);
    return mapTexel(c >> 1)[(c.x & 1) + 2 * (c.y & 1)];
}

float coastDist(vec2 uv) {
    vec2 s = uv * vec2(768.0, 384.0) - vec2(0.0, 0.5);
    ivec2 b = ivec2(floor(s));
    vec2 f = fract(s);
    return mix(mix(coastAt(b),               coastAt(b + ivec2(1, 0)), f.x),
               mix(coastAt(b + ivec2(0, 1)), coastAt(b + ivec2(1, 1)), f.x), f.y);
}

vec3 texel(ivec2 c) {
    c.x = c.x & 127;
    c.y = clamp(c.y, 0, 63);
    return mapTexel(ivec2(384, 0) + c).rgb;
}

vec3 landColor(vec2 uv) {
    vec2 st = uv * vec2(128.0, 64.0) - 0.5;
    ivec2 b = ivec2(floor(st));
    vec2 f = fract(st);
    return mix(mix(texel(b),               texel(b + ivec2(1, 0)), f.x),
               mix(texel(b + ivec2(0, 1)), texel(b + ivec2(1, 1)), f.x), f.y);
}

vec4 earthMap(vec2 uv, vec3 g, float aa, float px) {
    float d = coastDist(uv);

    float w1 = fbm3(g * 5.0);
    float w2 = fbm3(g * 5.0 + vec3(31.7, 4.2, 11.9));
    float wave = fbm3(g * 9.0 + 2.5 * vec3(w1, w2, w1)) - 0.48;
    vec3 gw = g + 0.05 * vec3(w1 - 0.48, w2 - 0.48, wave);
    float fine = (fbm3(gw * 30.0 + 3.0 * vec3(w2, wave, w1)) - 0.48) * smoothstep(1.2, 0.3, px * 120.0);
    float grain = (noise3(gw * 260.0) - 0.5) * smoothstep(1.2, 0.3, px * 260.0);

    vec3 rp = gw * 70.0 + 1.6 * vec3(wave, w1, w2) + 0.8 * fine;
    float sharp = 0.0;
    for (int i = min(iFrame, 0); i < 3; i++) {
        float fi = float(i);
        sharp += 0.57 * exp2(-fi) * abs(2.0 * noise3(rp * (1.0 + 1.1 * fi + 0.55 * fi * (fi - 1.0)) + 4.7 * fi) - 1.0);
    }
    sharp = (sharp - 0.27) * smoothstep(1.2, 0.3, px * 150.0);

    vec3 land = landColor(uv + BEND * (vec2(w1, w2) - 0.48));
    float k = mix(1.0, 0.25, smoothstep(0.75, 0.9, dot(land, vec3(0.3333))));
    land *= 1.0 + k * (WAVE * wave + FINE * fine + SHARP * sharp + GRAIN * grain);
    land = mix(land, land * vec3(1.08, 1.0, 0.85), k * smoothstep(0.45, 0.7, w1));

    float sw = fbm3(g * 4.0 + vec3(0.0, iTime * 0.03, 0.0));
    vec3 sea = vec3(0.0, 0.015, 0.21) * (0.7 + 0.65 * sw)
             + vec3(0.0, 0.035, 0.06) * smoothstep(0.5, 0.8, sw);
    sea *= 1.0 + 0.4 * FINE * fine + 0.25 * SHARP * sharp + 0.5 * GRAIN * grain;

    vec2 e = vec2(1.0 / 768.0, 1.0 / 384.0);
    float sl = length(vec2(coastDist(uv + vec2(e.x, 0.0)) - d, coastDist(uv + vec2(0.0, e.y)) - d));
    d /= max(sl, 1.0);
    float cn = 0.0;
    for (int i = min(iFrame, 0); i < 2; i++) {
        float fi = float(i);
        cn += (1.0 - 0.5 * fi) * abs(noise3(gw * (190.0 + 220.0 * fi) + 7.3 * fi) - 0.5);
    }
    d += COAST * (4.0 * cn - 0.75) * smoothstep(1.2, 0.3, px * 190.0);

    float sh = smoothstep(-SHORE, 0.0, d);
    sea = mix(sea, vec3(0.03, 0.15, 0.30), 0.6 * sh * sh);

    aa = clamp(aa, 0.8, 6.0);
    float lm = smoothstep(-aa, aa, d);
    return vec4(mix(sea, land, lm), 1.0 - lm);
}

// Near/far hit distances of a sphere around the origin, (-1,-1) on a miss.
vec2 sphereHits(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float h = b * b - dot(ro, ro) + r * r;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

float hitSphere(vec3 ro, vec3 rd, float r) { return sphereHits(ro, rd, r).x; }

// Planet direction -> map coordinates. Shared by colour and height so they always line up.
void earthCoords(vec3 n, out vec2 st, out vec3 g, out float lat) {
    vec3 q = n;
    q.yz = rot(0.25) * q.yz;     // pitch
    q.xy = rot(-0.20) * q.xy;    // tilt
    float lon = atan(-q.z, q.x) - (1.9 + SPIN * iAudioTime);
    lat = asin(clamp(q.y, -1.0, 1.0));
    st = vec2(fract(lon / (2.0 * PI) + 0.5), lat / PI + 0.5);
    g = vec3(cos(lat) * cos(lon), sin(lat), -cos(lat) * sin(lon));
}

// Elevation 0..1 (0..6500 m) from Buffer A, cubic B-spline filtered (4 bilinear taps).
// Region: cells 192x96 at pixel (1,193), wrapped border around it (see Cube A).
float elevAt(vec2 st) {
    vec2 s = st * vec2(192.0, 96.0) - 0.5;
    s.x = mod(s.x, 192.0);
    vec2 i = floor(s), f = s - i;
    vec2 f2 = f * f, f3 = f2 * f;
    vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
    vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
    vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
    vec2 w3 = f3 / 6.0;
    vec2 g0 = w0 + w1, g1 = w2 + w3;
    vec2 h0 = i - 1.0 + w1 / g0, h1 = i + 1.0 + w3 / g1;
    h0.y = clamp(h0.y, -1.0, 96.0);
    h1.y = clamp(h1.y, -1.0, 96.0);
    vec2 o = vec2(1.5, 193.5);
    float a = textureLod(iChannel0, mapDir(o + h0), 0.0).r;
    float b = textureLod(iChannel0, mapDir(o + vec2(h1.x, h0.y)), 0.0).r;
    float c = textureLod(iChannel0, mapDir(o + vec2(h0.x, h1.y)), 0.0).r;
    float d = textureLod(iChannel0, mapDir(o + h1), 0.0).r;
    return g0.y * (g0.x * a + g1.x * b) + g1.y * (g0.x * c + g1.x * d);
}

const float HMAX = 1.0 + 0.9 * DETAIL;   // upper bound of terrainH()

// Terrain height (in RELIEF units) for a planet direction.
float terrainH(vec3 n) {
    vec2 st; vec3 g; float lat;
    earthCoords(n, st, g, lat);
    float e = elevAt(st);
    if (e < 1e-4) return 0.0;
    // Pin sea level to the coastline map. The coast distance is measured along map rows,
    // so normalise it by its gradient (as earthMap() does) to get a true distance. earthMap()
    // shifts the coast by up to ~1 map pixel seaward with noise, so start the rise 1 pixel
    // inland: water is never lifted.
    float d = coastDist(st);
    vec2 cg = vec2(coastDist(st + vec2(1.0 / 768.0, 0.0)) - d, coastDist(st + vec2(0.0, 1.0 / 384.0)) - d);
    e *= smoothstep(1.0, 6.0, d / max(length(cg), 1.0));
    float r1 = 1.0 - abs(2.0 * noise3(g * 26.0) - 1.0);
    float r2 = 1.0 - abs(2.0 * noise3(g * 61.0 + 5.3) - 1.0);
    // Ridges only on mountains (plains stay flat), and not on ice sheets: Antarctica by latitude
    // (the colour map's columns pinch into stripes at the pole), Greenland/glaciers by colour.
    float ice = max(smoothstep(-1.08, -1.2, lat),
                    smoothstep(0.7, 0.85, dot(landColor(st), vec3(0.3333))) * smoothstep(-1.0, -0.9, lat));
    float rough = smoothstep(0.08, 0.45, e) * (1.0 - ice);
    return e * (1.0 + DETAIL * rough * (r1 * r1 + 0.5 * r2 * r2 - 0.6));
}

float surfDist(vec3 p) {
    float r = length(p);
    return r - EARTH_R - RELIEF * terrainH(p / r);
}

// Ray-march the displaced surface between the outer shell and the sea sphere.
float marchTerrain(vec3 ro, vec3 rd) {
    vec2 shell = sphereHits(ro, rd, EARTH_R + RELIEF * HMAX);
    if (shell.y <= 0.0) return -1.0;
    float tSea = hitSphere(ro, rd, EARTH_R);
    float tEnd = tSea > 0.0 ? tSea : shell.y;
    float t = max(shell.x, 0.0), tPrev = t;
    for (int i = min(iFrame, 0); i < TERRAIN_STEPS; i++) {
        float d = surfDist(ro + rd * t);
        if (d < 0.0004 * t) {
            if (d < 0.0 && t > tPrev) {          // overshot a slope: bisect back
                float a = tPrev, b = t;
                for (int k = min(iFrame, 0); k < 6; k++) {
                    float m = 0.5 * (a + b);
                    if (surfDist(ro + rd * m) < 0.0) b = m; else a = m;
                }
                t = 0.5 * (a + b);
            }
            return t;
        }
        if (t >= tEnd) break;
        tPrev = t;
        t = min(t + max(0.5 * d, 0.0015), tEnd);
    }
    return tSea;   // ran out of steps: fall back to sea level (or miss)
}

vec3 terrainNormal(vec3 n, float h0) {
    vec3 up = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tx = normalize(cross(up, n)), ty = cross(n, tx);
    const float e = 0.003;
    float hx = RELIEF * terrainH(normalize(n + tx * e));
    float hy = RELIEF * terrainH(normalize(n + ty * e));
    return normalize(n - tx * (hx - h0) / (e * EARTH_R) - ty * (hy - h0) / (e * EARTH_R));
}

float terrainShadow(vec3 p, vec3 L) {
    float s = 1.0, t = 0.01;
    for (int i = min(iFrame, 0); i < 16; i++) {
        vec3 q = p + L * t;
        float r = length(q);
        if (r > EARTH_R + RELIEF * HMAX) break;
        float d = r - EARTH_R - RELIEF * terrainH(q / r);
        s = min(s, 10.0 * d / t);
        if (s < 0.01) break;
        t += clamp(0.6 * d, 0.01, 0.15);
    }
    return clamp(s, 0.0, 1.0);
}

vec2 clouds(vec3 g, vec3 surf, float landAmt) {
    float lat = asin(clamp(g.y, -1.0, 1.0)), a = abs(lat), sgn = lat < 0.0 ? -1.0 : 1.0;

    float lon0 = atan(g.z, g.x);
    float wl = lat + 0.09 * sin(3.0 * lon0 + 1.3) + 0.05 * sin(7.0 * lon0 - 2.1 + 4.0 * lat);
    float wa = abs(wl);
    float itcz  = exp(-pow((wl - 0.10) / 0.24, 2.0));
    float dry   = exp(-pow((wa - 0.46) / 0.24, 2.0));
    float storm = smoothstep(0.50, 1.05, wa) * (lat < 0.0 ? 1.25 : 1.0);
    float cover = 0.47 + 0.20 * itcz - 0.24 * dry + 0.33 * storm;

    float sandy = smoothstep(0.05, 0.20, surf.r - surf.b) * smoothstep(0.35, 0.55, surf.r) * landAmt;
    float green = smoothstep(0.02, 0.10, surf.g - surf.r) * landAmt;
    cover += 0.18 * green - 0.12 * landAmt - 0.5 * sandy;

    g.xz = rot(iTime * CLOUD_DRIFT) * g.xz;

    float cell0 = floor(atan(g.z, g.x) / (PI / 3.0));
    for (int i = min(iFrame, 0) - 1; i <= 1; i++) {
        float cell = mod(cell0 + float(i), 6.0);
        vec3 id = vec3(cell, sgn, 7.0);
        float clon = (cell + 0.5 + 0.3 * (hash3(id) - 0.5)) * (PI / 3.0);
        float clat = sgn * (0.87 + 0.15 * (hash3(id + 3.7) - 0.5));
        vec3 c = vec3(cos(clat) * cos(clon), sin(clat), cos(clat) * sin(clon));
        float near = exp(-(1.0 - dot(g, c)) / 0.015);
        float tw = CLOUD_SWIRL * sgn * near * (1.0 - smoothstep(0.95, 1.30, a));
        g = g * cos(tw) + cross(c, g) * sin(tw) + c * dot(c, g) * (1.0 - cos(tw));
        cover += 0.3 * near;
    }

    vec3 w = vec3(noise3(g * 1.6 + vec3(0.0, iTime * 0.01, 0.0)),
                  noise3(g * 1.6 + vec3(17.3, 5.1, 9.4)), 0.5) - 0.5;
    w.z = w.x - w.y;
    vec3 gw = g + 0.45 * w;

    cover += 0.75 * (smoothstep(0.30, 0.75, noise3(gw * 1.9 + vec3(4.0, 8.0, 2.0))) - 0.5);

    float d = fbm3(gw * vec3(3.4, 6.0, 3.4));
    d += 0.22 * green * (noise3(g * 45.0) - 0.5);
    d += CLOUD_SHARP * (0.16 * (noise3(gw * 22.0) - 0.5) + 0.09 * (noise3(gw * 47.0) - 0.5));
    float wd = mix(0.28, 0.08, CLOUD_SHARP);
    float th = 0.70 - 0.40 * clamp(cover, 0.0, 1.0) - 0.3 * (CLOUD_COVER - 0.5);
    float thin = mix(1.0, 0.45, smoothstep(0.85, 1.45, a));
    vec2 cv = vec2(smoothstep(th, th + wd, d) + 4.0 * max(d - th - wd, 0.0),
                   smoothstep(th - 0.10, th + 0.12, d));
    return thin * (1.0 - exp(-3.0 * CLOUD_DENSE * cv));
}

float stars(vec3 rd, float scale, float amount) {
    vec3 p = rd * scale, c = floor(p);
    vec3 o = 0.5 + 0.3 * (vec3(hash3(c + 7.3), hash3(c + 13.1), hash3(c + 29.7)) - 0.5);
    float s = smoothstep(0.22, 0.0, length(p - c - o));
    return s * s * smoothstep(1.0 - amount, 1.0, hash3(c));
}

vec3 space(vec3 rd) {
    float n1 = fbm3(rd * 1.7 + vec3(3.1, 9.2, 4.4));
    float n2 = fbm3(rd * 3.1 + 2.0 * n1);
    vec3 col = vec3(0.003, 0.004, 0.009);
    col += vec3(0.030, 0.014, 0.050) * smoothstep(0.42, 0.75, n1) * n2;
    col += vec3(0.008, 0.022, 0.045) * smoothstep(0.45, 0.80, n2);
    col *= SPACE;
    vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash3(floor(rd * 90.0) + 3.0));
    for (int i = min(iFrame, 0); i < 2; i++) {
        float fi = float(i);
        col += tint * (0.9 - 0.55 * fi) * stars(rd, 90.0 + 100.0 * fi, 0.05 + 0.02 * fi);
    }
    return col;
}

vec3 originalAtmosphereGlow(vec3 from, vec3 dir) {
    float td = 0.0;
    float d = 0.0;
    float g = 0.0;
    vec3 p;

    for (int i = 0; i < 60; i++) {
        p = from + dir * td;
        d = de(p);
        td += d;
        if (td > 50.0 || d < det) break;
        g += smoothstep(-4.0, 1.0, p.x);
    }

    g /= 60.0;
    g *= snd * 10.0;
    return (pow(g, 1.3) + pow(g, 1.7) * 0.5) * atmo_color * 0.5;
}

vec3 renderEarth(vec3 from, vec3 dir, vec3 lightDir) {
    vec3 col = stars(rd) * (1.0 + 30.0 * snd);
    vec3 air = vec3(0.30, 0.55, 1.0);
    float t = marchTerrain(from, dir);
    if (t > 0.0) {
        vec3 p = from + dir * t;
        vec3 n = normalize(p);
        vec3 v = -dir;

        vec2 st; vec3 g; float lat;
        earthCoords(n, st, g, lat);

        float ndv = max(dot(n, v), 0.0);
        float res = min(iResolution.x, iResolution.y);
        float px = t / (1.4 * res) / max(ndv, 0.1);
        float aa = px * (768.0 / (2.0 * PI)) / max(cos(lat), 0.1);

        // iChannel0 (Cube A) supplies the packed coast, land-colour and elevation data.
        vec4 em = earthMap(st, g, aa, px);
        vec3 albedo = pow(max(em.rgb, 0.0), vec3(2.2));
        float ndl = dot(n, lightDir);               // sphere: day/night terminator

        // Terrain lighting: land uses the height-field normal, water stays flat.
        float h0 = RELIEF * terrainH(n);
        // Water stays flat; the last degrees around the poles too (map columns converge there).
        vec3 N = normalize(mix(terrainNormal(n, h0), n, max(em.a, smoothstep(1.32, 1.50, abs(lat)))));
        float sh = 1.0;
#ifdef TERRAIN_SHADOW
        if (ndl > -0.1) sh = terrainShadow(p + n * 0.003, lightDir);
#endif
        float diff = smoothstep(-0.06, 0.12, ndl) * max(dot(N, lightDir), 0.0) * sh
                   + 0.04 * smoothstep(-0.12, 0.1, ndl);
        vec3 sun = mix(vec3(1.0, 0.42, 0.18), vec3(1.0),
                       smoothstep(-0.05, 0.35, ndl));
        vec3 night = NIGHT * vec3(0.7, 0.85, 1.25);

        vec2 cv = clouds(g, em.rgb, 1.0 - em.a);
        float cl = cv.x * CLOUDS;
        float cloudShadow = 1.0 - 0.4 * CLOUDS * cv.y;
        col = albedo * (diff * sun * 1.15 * cloudShadow + night);

        // Ocean glints from the Earth shader.
        vec3 hv = normalize(lightDir + v);
        float ndh = max(dot(n, hv), 0.0);
        float nl = max(ndl, 0.0);
        float a2 = GLINT_SIZE * GLINT_SIZE * GLINT_SIZE * GLINT_SIZE;
        float dd = ndh * ndh * (a2 - 1.0) + 1.0;
        float kk = 0.5 * GLINT_SIZE * GLINT_SIZE;
        float vis = 1.0 / ((nl * (1.0 - kk) + kk) *
                           (ndv * (1.0 - kk) + kk));
        float fr = 0.02 + 0.98 * pow(1.0 - max(dot(v, hv), 0.0), 5.0);
        col += sun * em.a * GLINT * nl * fr * vis * a2 /
               (4.0 * PI * dd * dd) * cloudShadow * sh;

        vec3 cloudCol = vec3(mix(0.80, 0.95, cv.x)) *
                        (diff * sun * 1.15 + night);
        //col = mix(col, cloudCol, cl);

        // Atmospheric rim
        float fres = pow(1.0 - ndv, 3.0);
        //col = mix(col, air * smoothstep(-0.2, 0.35, ndl), 0.015 + 0.16 * fres);
        col = mix(col, air * smoothstep(-0.2, 0.35, ndl), 0.015 + 0.16 * fres);
        float cl1 = clouds(p, dir);
        vec3 nc = normal_clouds(p, dir);
        vec3 c = vec3(0.);
        col += mix(c, .1 + cloud_color * max(0., dot(normalize(ldir), nc)), clamp(cl1,0.,1.));

        // Audio-reactive planet flash 
#ifdef VARIANT
        if (snareLevel > 0.71) {
            col = vec3(
                0.0 + snd,
                1.0 - sin(iAudioTime * 4.0) / 1.5,
                1.0 - (sin(iAudioTime * 7.0) + snd) / 3.0
            ) - col * (2.0 - snd * 2.0);
            col /= (3.3 + snd * 2.0);
            col *= -1.0;
        }
#endif
    }
#ifdef VARIANT2
    else if (snareLevel > 0.71) {
        // Preserve the original march() background-only inversion.
        col = 1.0 - col;
    }
#endif

    // The original audio-reactive atmospheric glow is applied to both the
    // Earth silhouette and empty-space rays, just as march() did before.
    col += originalAtmosphereGlow(from, dir);
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    iAudioTime = 1.5*iTime+snd; // this is a poor adaption of ShaderAmp's iAmplifiedTime
    for (int i = 4; i <= 10; i++) {
        snareLevel += FFT(i);
    }
    snareLevel /= 7.0; 

    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = (fragCoord - iResolution.xy * .5) / iResolution.y;

    uv = getPlane(uv);
    
    // camera: one orbit matrix for planet rays, star rays and the sun.
    // Same convention as the original Blue Marble: eye on +z looking toward -z. The Habitable
    // Planet camera looked from -z toward +z, which showed the Earth map mirrored.
    mat3 cam = orbit();
    rd = cam * normalize(vec3(uv, -1.0));    // star direction
    vec3 lightDir = cam * normalize(vec3(0.7, 0.3, 0.7));

    float timediff = 5.75;
    vec3 from = cam * vec3(0., 0., 10.);
    //vec3 dir = normalize(vec3(uv, min(1.1, iTime * .5)));
    vec3 dir = normalize(vec3(uv, min(1.1+sin(iTime*.125)/4., iTime * .5)));
    if(iTime<timediff) dir = vec3(0.);//normalize(vec3(uv, min(1.1, .5)));
    else {

        uv/=(1.+FFT(1)/4.);
        dir = normalize(vec3(uv, min(1.1+sin((iTime-timediff)*.125)/5., (iTime-timediff) * .5)));
    }

    dir.z = -dir.z;                          // look toward -z (see above)
    dir = cam * dir;
    vec3 col = renderEarth(from, dir, lightDir);
    
    // Output to screen -- original full-screen flash behavior is unchanged.
#ifdef VARIANT2
    if(snareLevel>0.71) fragColor = vec4(1.0 - col.rgb, 1.);
    else fragColor = vec4(col*.85,1.0);
#else
    fragColor = vec4(col*1.985,1.0);
#endif 
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
    gl_FragColor.a = 1.0;
}
