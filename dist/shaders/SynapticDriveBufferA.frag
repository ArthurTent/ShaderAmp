// https://www.shadertoy.com/view/NXcSDf
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Synaptic Drive ( audio) - Buffer A
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

struct CameraState {
    vec3 ro;
    vec3 ta;
    float roll;
    float fov;
    float bass;
    float mid;
    float treble;
    float kickEnv;
};


CameraState loadCameraState(sampler2D stateTex) {
    vec4 p0 = texelFetch(stateTex, ivec2(0, 0), 0);
    vec4 p1 = texelFetch(stateTex, ivec2(1, 0), 0);
    vec4 p2 = texelFetch(stateTex, ivec2(2, 0), 0);

    CameraState c;
    c.ro      = p0.xyz;
    c.roll    = p0.w;
    c.ta      = p1.xyz;
    c.fov     = p1.w;
    c.bass    = p2.x;
    c.mid     = p2.y;
    c.treble  = p2.z;
    c.kickEnv = p2.w;
    return c;
}

// === End Common Code ===


vec4 trap = vec4(1e20);
vec3 g_ro; 
float g_bass;
float g_mid;
float g_treble;
float g_kickEnv;

vec3 getNeonColor(float t) {
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.0);
    vec3 d = vec3(0.0, 0.33, 0.67);
    return a + b * cos(6.28318 * (c * t + d));
}

vec4 fold1(vec4 z) {
    vec3 p = z.xyz;
    p = p - 2.0 * clamp(p, -1.0, 1.0);
    return vec4(p, z.w);
}

vec4 fold2(vec4 z) {
    vec3 p = z.xyz;
    p = p - 2.0 * clamp(p, -1.0, 1.0);
    return vec4(p * 2.0, 2.0 * z.w);
}

vec4 invertRadius(vec4 z, float radius2, float limit) {
    float r2 = dot(z.xyz, z.xyz);
    float f = clamp(radius2 / r2, 1.0, limit);
    return z * f;
}

vec4 affine(vec4 z, float factor, vec3 offset) {
    z.xyz *= factor;
    z.xyz += offset;
    z.w *= abs(factor);
    return z;
}

vec4 rotateXY(vec4 z, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat2 m = mat2(c, s, -s, c);
    return vec4(m * z.xy, z.zw);
}

vec4 rotateXZ(vec4 z, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat2 m = mat2(c, s, -s, c);
    vec2 r = m * z.xz;
    return vec4(r.x, z.y, r.y, z.w);
}

float smax(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0);
    return max(a, b) + h * h * 0.25 / k;
}

vec3 de(vec3 p) {
    vec4 z = vec4(p, 1.0);
    
    float t = 68.8 + iTime * 0.2 + (g_mid * 0.2) + g_kickEnv * 0.05; 
    trap = vec4(1e20);

    vec3 vo1 = vec3(sin(t * .5), cos(t * .48), sin(t * .08)) * (1.1 + g_bass * 0.12);
    vec3 vo3 = vec3(sin(t * .15), sin(t * .22), cos(t * 1.0)) * (1.0 + g_kickEnv * 0.06 + g_treble * 0.04);
    
    
    z = invertRadius(z, 10.0, 1.5);
    z = rotateXY(z, t);
    z = fold1(z);
    trap = min(trap, vec4(abs(z.xyz), dot(z.xyz, z.xyz)));

    z = rotateXZ(z, t * 1.112);
    z.xyz += vo3;
    z = fold2(z);
    z.xyz += vo1;
    z = affine(z, -1.8, p);
    trap = min(trap, vec4(abs(z.xyz), dot(z.xyz, z.xyz)));

    z = rotateXY(z, t * .881);
    z = fold1(z);
    z = affine(z, -1.5, p); 
    z = invertRadius(z, 10.0 * 10.0, 3.0);
    trap = min(trap, vec4(abs(z.xyz), dot(z.xyz, z.xyz)));

    vec3 box = abs(z.xyz);
    float mainShape = max(box.x - 3.0, max(box.y - 3.0, box.z - 3.0));
    
    float holeSize = 1.8 + sin(iTime * 2.0) * 0.2 + (g_mid * 0.4); 
    float holes = min(max(box.x, box.y), min(max(box.x, box.z), max(box.y, box.z))) - holeSize;

    float d1 = smax(mainShape, -holes, 0.2) / z.w;
    float d2 = (max(box.x - 20.0, max(box.y - .5, box.z - .5))) / z.w;
    float orig_d = min(d1, d2);

    float shieldRadius = 1.2 + (g_kickEnv * 0.35); 
    float camRepulsion = -(length(p - g_ro) - shieldRadius); 
    float shieldSmoothness = 0.5; 
    float glowWidth = 0.16;        

    d1 = smax(d1, camRepulsion, shieldSmoothness);
    d2 = smax(d2, camRepulsion, shieldSmoothness);

    float final_d = min(d1, d2);
    float h = max(glowWidth - abs(orig_d - camRepulsion), 0.0);
    float glowMask = pow(h / glowWidth, 32.0); 

    float matID = (d2 < d1) ? 2.0 : 1.0;
    return vec3(final_d, matID, glowMask);
}

vec3 calcNormal(in vec3 p, in float t) {
    float e = max(0.0001, 0.0005 * t); 
    const vec2 k = vec2(1, -1);
    return normalize(k.xyy * de(p + k.xyy * e).x + 
                     k.yyx * de(p + k.yyx * e).x + 
                     k.yxy * de(p + k.yxy * e).x + 
                     k.xxx * de(p + k.xxx * e).x);
}

float calcShadow(in vec3 ro, in vec3 rd, in float mint, in float tmax, in float k) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 32; i++) {
        float h = de(ro + rd * t).x;
        res = min(res, k * h / t);
        t += clamp(h, 0.02, 0.20);
        if (h < 0.001 || t > tmax) break;
    }
    return clamp(res, 0.0, 1.0);
}

mat3 calcViewMatrix(vec3 ro, vec3 ta, float roll) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(roll), cos(roll), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
}

vec3 getNebula(vec3 rd) {
    float slowTime = iTime * 0.02 + g_bass * 0.015;
    vec3 q = rd * 2.4 + vec3(slowTime * 0.2, slowTime * 0.15, slowTime * 0.3);
    
    float n = 0.0;
    float amp = 0.55;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 3; i++) {
        n += amp * (0.5 + 0.5 * sin(q.x * 2.2 + sin(q.y * 1.9 + q.z * 1.6)));
        q.xy = rot * q.xy * 2.04;
        q.yz = rot * q.yz * 1.96;
        amp *= 0.5;
    }
    
    vec3 charcoal   = vec3(0.004, 0.003, 0.006);
    vec3 darkPurple = vec3(0.022, 0.010, 0.038);
    vec3 plumMist   = vec3(0.045, 0.020, 0.065);
    
    vec3 nebula = mix(charcoal, darkPurple, smoothstep(0.2, 0.75, n));
    nebula = mix(nebula, plumMist, pow(n, 2.6) * 0.55);
    
    float breathe = 1.0 + (g_bass * 0.25) + (g_mid * 0.15);
    return nebula * breathe;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    CameraState cam = loadCameraState(iChannel0);
    g_ro      = cam.ro;
    g_bass    = cam.bass;
    g_mid     = cam.mid;
    g_treble  = cam.treble;
    g_kickEnv = cam.kickEnv;

    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    mat3 camMat = calcViewMatrix(cam.ro, cam.ta, cam.roll);
    vec3 rd = normalize(camMat * vec3(uv.x, uv.y, cam.fov)); 

    float t = 0.0;
    float tmax = 50.0; 
    vec3 p = cam.ro;
    float m = -1.0;
    float hitGlow = 0.0;

    vec3 fillColor = vec3(0.001, 0.001, 0.002); 
    vec3 sunDir = normalize(vec3(0.4, 0.85, 0.35)); 

    vec3 godrayAccum = vec3(0.0);
    vec3 neonShieldColorAccum = vec3(0.0); 

    float rayAlignment = max(dot(rd, sunDir), 0.0);
    float godrayMask = pow(rayAlignment, 128.0);
    float audioFogIntensity = g_kickEnv * 0.015;

    vec3 whiteCyanGlow = vec3(0.45, 0.95, 1.0);

    for (int i = 0; i < 150; i++) { 
        vec3 res = de(p);
        float d = res.x;
        m = res.y;
        hitGlow = res.z;

        if (d < 0.0005 || t > tmax) break; 

        float stepSize = d * 0.65;
        t += stepSize; 
        p = cam.ro + t * rd;

        float colorOffset = iTime * 0.1 + length(p) * 0.1 + g_bass * 0.08;
        vec3 volColor = getNeonColor(colorOffset);

        godrayAccum += volColor * stepSize * godrayMask * exp(-t * 0.25) * audioFogIntensity;

        float distFromCam = length(p - g_ro);
        float radialWave = sin(distFromCam * 20.0 - iTime * 18.0);
        float oldWave = sin(p.x * 8.0 + p.y * 10.0 + p.z * 8.0 - iTime * 15.0);
        float blendedWave = radialWave * (0.85 + 0.15 * oldWave);
        float energyBulb = pow(0.5 + 0.5 * blendedWave, 16.0);

        float pulseMultiplier = 1.0 + energyBulb * 4.0 + g_kickEnv * 4.0 + g_bass * 1.5;
        neonShieldColorAccum += whiteCyanGlow * res.z * pulseMultiplier * exp(-d * 30.0) * stepSize;
    }

    vec3 col = vec3(0.0);

    if (t < tmax) {
        vec3 n = calcNormal(p, t); 
        vec3 v = normalize(cam.ro - p); 

        vec3 albedo; 
        float roughness, metallic;
        vec3 emission = vec3(0.0);

        vec3 surfaceRainbow = getNeonColor(iTime * 0.1 + length(p) * 0.15 + g_bass * 0.1);

        if (m == 1.0) {
            albedo = vec3(0.016, 0.018, 0.024); 
            roughness = 0.05 + g_treble * 0.04; 
            metallic = 0.08; 
        } else {
            vec3 trapColor = clamp(trap.yzw * 0.8, 0.0, 1.0);
            albedo = vec3(0.012, 0.012, 0.015) + trapColor * surfaceRainbow * 0.03; 
            roughness = 0.18; 
            metallic = 0.85;

            float bassWave = sin(p.y * 3.2 - iTime * 4.0) * (g_kickEnv * 0.85 + g_bass * 0.40);
            float midWave  = cos(p.x * 4.2 + iTime * 3.0) * (g_mid * 0.65);
            float trebleShimmer = sin(p.z * 11.0 - iTime * 14.0) * (g_treble * 0.35);

            float twistAngle = bassWave + midWave + trebleShimmer;
            mat2 rotTwist = mat2(cos(twistAngle), sin(twistAngle), -sin(twistAngle), cos(twistAngle));

            vec2 twistedTrap = rotTwist * (trap.xy - 0.5) + 0.5;
            twistedTrap.x += sin(twistedTrap.y * 10.0 + bassWave * 3.0) * (0.03 + g_kickEnv * 0.07);
            twistedTrap.y += cos(twistedTrap.x * 10.0 - midWave * 3.0)  * (0.03 + g_mid * 0.07);

            float edgeVal = clamp((twistedTrap.y * 1.3 + twistedTrap.x * 0.7) - 0.35, 0.0, 1.0) / 0.65;
            float edgeLine = pow(edgeVal, 4.0);

            float vuPulse = 0.5 + 0.5 * sin(length(p) * 6.0 - iTime * 7.0 + twistAngle * 2.0);
            float meterDynamic = 1.0 + vuPulse * (g_kickEnv * 0.6 + g_treble * 0.4);

            vec3 bassCol   = getNeonColor(iTime * 0.08 + (p.y + bassWave) * 0.15);         
            vec3 midCol    = getNeonColor(iTime * 0.08 + (p.x + midWave) * 0.15 + 0.35);  
            vec3 trebleCol = getNeonColor(iTime * 0.08 + (p.z + trebleShimmer) * 0.18 + 0.70);  

            float bWeight = smoothstep(0.28, 0.78, twistedTrap.x);
            float mWeight = smoothstep(0.28, 0.78, twistedTrap.y);
            float tWeight = smoothstep(0.28, 0.78, trap.z + trebleShimmer * 0.3);
            float totW = max(bWeight + mWeight + tWeight, 0.001);

            vec3 routedColor = (bassCol * bWeight + midCol * mWeight + trebleCol * tWeight) / totW;

            float audioBoost = 1.0 + (bWeight * g_kickEnv * 3.2) + 
                                     (mWeight * g_mid * 2.4) + 
                                     (tWeight * g_treble * 2.8);

            emission = routedColor * edgeLine * 0.85 * audioBoost * meterDynamic;

            emission += whiteCyanGlow * hitGlow * 1.2 * (1.0 + g_kickEnv * 1.5);
        }

        float shadow = calcShadow(p, sunDir, 0.05, 20.0, 16.0);
        float diffSun = max(dot(n, sunDir), 0.0) * shadow; 

        float ao = clamp(de(p + n * 0.1).x * 8.0, 0.0, 1.0); 
        ao = pow(ao, 1.8); 

        float distToCam = length(cam.ro - p);
        float attenuation = exp(-distToCam * 0.22);
        
  
        float headlightPump = 1.0 + pow(g_kickEnv, 1.8) * 1.5;
        
        float diffHeadlight = max(dot(n, v), 0.0) * attenuation;
        float specHeadlight = pow(max(dot(n, v), 0.0), mix(64.0, 512.0, 1.0 - roughness)) * attenuation;
        vec3 headlightColor = mix(vec3(0.85, 0.95, 1.0), surfaceRainbow, 0.35) * headlightPump;

        vec3 hDir = normalize(sunDir + v);
        float specPower = mix(16.0, 2048.0, 1.0 - roughness); 
        float specSun = pow(max(dot(n, hDir), 0.0), specPower) * shadow;
        vec3 specColor = mix(vec3(1.0), albedo, metallic); 

        float rim = pow(1.0 - max(dot(n, v), 0.0), (m == 1.0) ? 3.8 : 5.0) * ao;
        vec3 rimColor = (m == 1.0) ? mix(vec3(0.35, 0.65, 0.9), surfaceRainbow, 0.35) * rim * 0.75 
                                   : surfaceRainbow * rim * 0.4 * shadow;

        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 obsidianGlint = (m == 1.0) ? mix(vec3(0.08, 0.12, 0.16), surfaceRainbow * 0.25, 0.5) * fresnel * (1.0 - roughness) * ao : vec3(0.0);

        col = albedo * (fillColor + diffSun * surfaceRainbow) * ao;
        col += specSun * specColor * surfaceRainbow * (1.0 - roughness) * 10.0 * ao; 
        col += specColor * specHeadlight * headlightColor * 4.0 * ao;
        col += albedo * diffHeadlight * headlightColor * 2.5 * ao;
        col += rimColor;
        col += obsidianGlint;
        col += emission * ao; 
    } else {
        vec3 nebula = getNebula(rd);
        vec3 sunDot = vec3(1.0) * pow(rayAlignment, 4000.0) * 2.0; 
        col = nebula + sunDot;
    }

    col += godrayAccum; 

    col += neonShieldColorAccum * (1.1 + g_kickEnv * 4.5 + g_bass * 1.2);

    fragColor = vec4(col, t);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
