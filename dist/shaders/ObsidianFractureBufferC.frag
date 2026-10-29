// https://www.shadertoy.com/view/sXtXzS
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Obsidian Fracture (audio) - Buffer C
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

// 1015
vec2 getTunnelCenter(float z, float t) {
    return vec2(-sin(z * 0.8 + t * 0.4) * 0.3, -cos(z * 0.9 + t * 0.3) * 0.3);
}
mat3 setCamera(in vec3 ro, in vec3 ta, float cr) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(cr), cos(cr), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = cross(cu, cw);
    return mat3(cu, cv, cw);
}

// === End Common Code ===


// 1015
vec3 RGBtoYCoCg(vec3 c) { return mat3(.25, .5, -.25, .5, 0, .5, .25, -.5, -.25) * c; }
vec3 YCoCgToRGB(vec3 c) { return mat3(1, 1, 1, 1, 0, -1, -1, 1, -1) * c; }

float max3(vec3 c) { return max(max(c.x, c.y), c.z); }

vec3 tonemap(vec3 c) {
    return c / (1.0 + max3(c));
}

vec3 inverseTonemap(vec3 c) {
    return c / clamp(1.0 - max3(c), 1e-5, 1.0);
}

vec2 getJitter(int frame) {
    const vec2[16] halton = vec2[](
        vec2(0.5, 0.333333), vec2(0.25, 0.666667), vec2(0.75, 0.111111), vec2(0.125, 0.444444),
        vec2(0.625, 0.777778), vec2(0.375, 0.222222), vec2(0.875, 0.555556), vec2(0.0625, 0.888889),
        vec2(0.5625, 0.037037), vec2(0.3125, 0.370370), vec2(0.8125, 0.703704), vec2(0.1875, 0.148148),
        vec2(0.6875, 0.481481), vec2(0.4375, 0.814815), vec2(0.9375, 0.259259), vec2(0.03125, 0.592593)
    );
    return halton[frame % 16] - 0.5;
}

vec4 SampleTextureCatmullRom(sampler2D tex, vec2 texSize, vec2 uv) {
    vec2 samplePos = uv * texSize;
    vec2 texPos1 = floor(samplePos - 0.5) + 0.5;
    vec2 f = samplePos - texPos1;
    vec2 w0 = f * ( -0.5 + f * (1.0 - 0.5*f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5*f);
    vec2 w2 = f * ( 0.5 + f * (2.0 - 1.5*f) );
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 offset12 = w2 / w12;
    vec2 texPos0 = (texPos1 - vec2(1.0)) / texSize;
    vec2 texPos3 = (texPos1 + vec2(2.0)) / texSize;
    vec2 texPos12 = (texPos1 + offset12) / texSize;

    vec4 result = vec4(0.0);
    result += texture(tex, vec2(texPos0.x,  texPos0.y)) * w0.x * w0.y;
    result += texture(tex, vec2(texPos12.x, texPos0.y)) * w12.x * w0.y;
    result += texture(tex, vec2(texPos3.x,  texPos0.y)) * w3.x * w0.y;
    result += texture(tex, vec2(texPos0.x,  texPos12.y)) * w0.x * w12.y;
    result += texture(tex, vec2(texPos12.x, texPos12.y)) * w12.x * w12.y;
    result += texture(tex, vec2(texPos3.x,  texPos12.y)) * w3.x * w12.y;
    result += texture(tex, vec2(texPos0.x,  texPos3.y)) * w0.x * w3.y;
    result += texture(tex, vec2(texPos12.x, texPos3.y)) * w12.x * w3.y;
    result += texture(tex, vec2(texPos3.x,  texPos3.y)) * w3.x * w3.y;
    return result;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 o = getJitter(iFrame);
    
    vec4 curr = textureLod(iChannel0, (fragCoord - o) / res, 0.0);
    float depth = curr.a;
    
    if (depth >= 19.9) {
        fragColor = curr;
        return;
    }

    vec4 cd0 = texelFetch(iAudioData, ivec2(0,0), 0);
    vec4 cd1 = texelFetch(iAudioData, ivec2(1,0), 0);
    vec4 cd2 = texelFetch(iAudioData, ivec2(2,0), 0);
    vec4 cd3 = texelFetch(iAudioData, ivec2(3,0), 0);

    vec3 ro = cd0.xyz; float fl = cd0.w;
    vec3 ta = cd1.xyz; float roll = cd1.w;
    
    vec3 pro = cd2.xyz; float pfl = cd2.w;
    vec3 pta = cd3.xyz; float proll = cd3.w;

    mat3 cmat = setCamera(ro, ta, roll);
    mat3 pmat = setCamera(pro, pta, proll);
    
    vec2 pv = (fragCoord - 0.5 * res) / res.y; 
    vec3 rd = normalize(cmat * vec3(pv, fl));
    vec3 p = ro + rd * depth; 

    vec3 cp = transpose(pmat) * (p - pro);
    vec2 np = cp.xy / (cp.z / pfl);
    vec2 puv = (np * res.y + 0.5 * res) / res;
    vec3 prd = normalize(pmat * vec3(np, pfl));

    vec4 hist = SampleTextureCatmullRom(iChannel1, res, puv);
    vec3 pp = pro + prd * hist.a; 

    float a = 0.1; 
    
    if (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) a = 1.0; 
    if (distance(p, pp) > 0.1 * depth) a = 1.0; 
    if (distance(ro, pro) > 0.5) a = 1.0;

    // Apply Karis tonemapping BEFORE YCoCg conversion and clamping
    vec3 newCol = RGBtoYCoCg(tonemap(curr.rgb));
    vec3 oldCol = RGBtoYCoCg(tonemap(hist.rgb));
    
    vec3 cMin = newCol;
    vec3 cMax = newCol;
    
    for(int y = -1; y <= 1; ++y) {
        for(int x = -1; x <= 1; ++x) {
            if(x == 0 && y == 0) continue;

            vec3 neighborRaw = textureLod(iChannel0, (fragCoord - o + vec2(x, y)) / res, 0.0).rgb;
            vec3 neighbor = RGBtoYCoCg(tonemap(neighborRaw));
            cMin = min(cMin, neighbor);
            cMax = max(cMax, neighbor);
        }
    }
    
    oldCol = clamp(oldCol, cMin, cMax);

    vec3 finalColLDR = (iFrame != 0) ? mix(oldCol, newCol, a) : newCol;
    

    vec3 finalColHDR = inverseTonemap(YCoCgToRGB(finalColLDR));

    fragColor = vec4(finalColHDR, depth);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
