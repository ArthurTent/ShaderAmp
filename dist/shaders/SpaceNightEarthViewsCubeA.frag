// https://www.shadertoy.com/view/7ffyR2
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: Space Night - Earth Views b - Cube A
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
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

// Cube A: the Earth map data (coastline distance field, colour map, elevation).
// A cube pass is always 1024x1024 per face, independent of canvas size and of ShaderAmp's
// render scale, so the map never gets cut off (the "wedge" artifact when Buffer A was too small).
// Only the +Z face is used; pixel (x,y) of the layout <-> direction ((x+.5)/512-1, (y+.5)/512-1, 1).
// Layout: coast 384x192 at (0,0), colours 128x64 at (384,0), elevation 195x98 at (0,192).

// The map data (formerly ~6000 const uint array entries, which the Windows/ANGLE D3D shader
// compiler cannot handle) is read from a lossless 256x48 PNG in iChannel0 (nearest, no flip).
// Every 32-bit word w occupies texels 2w (low 16 bits) and 2w+1 (high 16 bits): R = low byte, G = high byte.
uint dataWord(int w) {
    ivec2 p = ivec2((2 * w) & 255, (2 * w) >> 8);
    uvec2 lo = uvec2(texelFetch(iChannel0, p, 0).rg * 255.0 + 0.5);
    uvec2 hi = uvec2(texelFetch(iChannel0, p + ivec2(1, 0), 0).rg * 255.0 + 0.5);
    return lo.x | (lo.y << 8) | (hi.x << 16) | (hi.y << 24);
}
#define COLOR(i) dataWord(0 + (i))
#define ROWS(i) dataWord(1024 + (i))
#define COAST(i) dataWord(1217 + (i))
#define HEIGHT(i) dataWord(2404 + (i))

const vec3 PAL[16] = vec3[16](
  vec3(0.953, 0.963, 0.971),
  vec3(0.117, 0.189, 0.101),
  vec3(0.589, 0.504, 0.358),
  vec3(0.183, 0.307, 0.208),
  vec3(0.684, 0.706, 0.759),
  vec3(0.835, 0.746, 0.580),
  vec3(0.275, 0.311, 0.118),
  vec3(0.437, 0.456, 0.432),
  vec3(0.710, 0.620, 0.466),
  vec3(0.208, 0.283, 0.101),
  vec3(0.438, 0.418, 0.276),
  vec3(0.799, 0.814, 0.850),
  vec3(0.968, 0.877, 0.652),
  vec3(0.161, 0.249, 0.049),
  vec3(0.549, 0.574, 0.614),
  vec3(0.338, 0.352, 0.201)
);




// Source: NOAA ETOPO1 (ice surface, public domain), resampled onto the COAST map grid.
// Land masks agree at IoU 0.96 below 60 deg lat (the polar sea ice / ice shelves are land
// in COAST but sea level in ETOPO, so they stay flat). Rows are smoothed toward the
// poles so every cell covers roughly the same ground distance.
// 192x96 land elevation, 6 bit sqrt-encoded, 5 cells per uint (0 = sea, 63 = 6500 m).

int shore(int n) { return int((COAST(n / 3) >> uint((n % 3) * 10)) & 1023u); }

uint rowInfo(int y) { return (ROWS(y >> 1) >> uint((y & 1) * 16)) & 0xFFFFu; }

float rowDist(int y, float x) {
    y = clamp(y, 0, 383);
    uint a = rowInfo(y), b = rowInfo(y + 1);
    int start = int(a & 0x7FFFu), end = int(b & 0x7FFFu);
    int lo = start, hi = end;
    for (int i = min(iFrame, 0); i < 7; i++) {
        if (lo < hi) {
            int mid = (lo + hi) >> 1;
            if (float(shore(mid)) <= x) lo = mid + 1; else hi = mid;
        }
    }
    float d = 8.0;
    if (lo > start) d = min(d, x - float(shore(lo - 1)));
    if (lo < end)   d = min(d, float(shore(lo)) - x);
    bool land = (((a >> 15) ^ uint(lo - start)) & 1u) == 1u;
    return land ? d : -d;
}

void mainCubemap(out vec4 fragColor, in vec2 fragCoord, in vec3 rayOri, in vec3 rayDir) {
    if (rayDir.z <= max(abs(rayDir.x), abs(rayDir.y))) {   // not the +Z face
        fragColor = vec4(0.0);
        return;
    }
    ivec2 c = ivec2(floor((rayDir.xy / rayDir.z * 0.5 + 0.5) * 1024.0));

    if (c.x < 384 && c.y < 192) {
        int y = 2 * c.y;
        float x = float(2 * c.x);
        vec4 v = vec4(0.0);
        for (int k = min(iFrame, 0); k < 4; k++) v[k] = rowDist(y + (k >> 1), x + float(k & 1));
        fragColor = v;
    } else if (c.x >= 384 && c.x < 512 && c.y < 64) {
        int i = c.y * 128 + (c.x - 384);
        fragColor = vec4(PAL[int((COLOR(i >> 3) >> uint((i & 7) * 4)) & 15u)], 1.0);
    } else if (c.x < 195 && c.y >= 192 && c.y < 290) {
        // Elevation, 192x96 cells with a wrap-around border (1 column left, 2 right, 1 row
        // top/bottom) so the Image pass can sample it with hardware bilinear/bicubic filtering.
        int hx = (c.x + 191) % 192;
        int hy = clamp(c.y - 193, 0, 95);
        int i = hy * 192 + hx;
        float v = float((HEIGHT(i / 5) >> uint((i % 5) * 6)) & 63u) / 63.0;
        fragColor = vec4(v * v);   // 0..1 = 0..6500 m
    } else {
        fragColor = vec4(0.0);
    }
}

uniform int iCubeFace;
void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec2 st = vUv * 2.0 - 1.0;
    vec3 rayDir;
    if      (iCubeFace == 0) rayDir = vec3( 1.0, -st.y, -st.x);
    else if (iCubeFace == 1) rayDir = vec3(-1.0, -st.y,  st.x);
    else if (iCubeFace == 2) rayDir = vec3( st.x,  1.0,  st.y);
    else if (iCubeFace == 3) rayDir = vec3( st.x, -1.0, -st.y);
    else if (iCubeFace == 4) rayDir = vec3( st.x, -st.y,  1.0);
    else                     rayDir = vec3(-st.x, -st.y, -1.0);
    mainCubemap(gl_FragColor, fragCoord, vec3(0.0), normalize(rayDir));
}
