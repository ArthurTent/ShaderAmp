// https://www.shadertoy.com/view/sXtXzS
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Obsidian Fracture (audio) - Buffer B
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
vec3 pal(in float t, float blend) {
    vec3 a = mix(vec3(0.015, 0.015, 0.02), vec3(0.65, 0.15, 0.35), blend); 
    vec3 b = mix(vec3(0.01, 0.01, 0.02), vec3(0.45, 0.25, 0.35), blend); 
    vec3 c = vec3(1.0); 
    vec3 d = mix(vec3(0.0, 0.05, 0.10), vec3(0.0, 0.15, 0.25), blend); 
    return a + b * cos(6.28318 * (c * t + d));
}

vec3 getAuroraColor(float pz, float angle, float t, float blend) {
    float phase = sin(pz * 0.22 + angle * 0.6 + t * 0.25) * 0.5 + 0.5;
    vec3 darkGreen     = vec3(0.003, 0.14, 0.06);
    vec3 electricGreen = vec3(0.03, 0.55, 0.24);
    vec3 cyanTeal      = vec3(0.02, 0.38, 0.52);
    
    vec3 edgeColor     = mix(vec3(0.05, 0.15, 0.65), vec3(0.35, 0.06, 0.42), blend);
    
    vec3 col = mix(darkGreen, electricGreen, smoothstep(0.15, 0.55, phase));
    col = mix(col, cyanTeal, smoothstep(0.50, 0.85, phase));
    
    
    // diatribes fix ?
    float rawSin = sin(pz * 0.14 - t * 0.35 + angle);
    float fringe = pow(clamp(rawSin, 0.0, 1.0) + 1e-5, 4.0);    

    col = mix(col, edgeColor, fringe * 0.35);
    return col;
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec4 orbitTrap = vec4(1000.0);

vec4 qSqr(vec4 q) {
    return vec4(q.x*q.x - q.y*q.y - q.z*q.z - q.w*q.w,
                2.0 * q.x * q.y,
                2.0 * q.x * q.z,
                2.0 * q.x * q.w);
}

vec2 opU(vec2 d1, vec2 d2) {
    return (d1.x < d2.x) ? d1 : d2;
}

float sdMenger(vec3 p) {
    float d = max(abs(p.x), max(abs(p.y), abs(p.z))) - 1.0;
    float s = 1.0;
    for(int m = 0; m < 3; m++) {
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= 3.0;
        vec3 r = abs(1.0 - 3.0 * abs(a));
        float da = max(r.x, r.y);
        float db = max(r.y, r.z);
        float dc = max(r.z, r.x);
        float c = (min(da, min(db, dc)) - 1.0) / s;
        d = max(d, c);
    }
    return d;
}

float mapDist(vec3 p) {
    p.x += sin(p.z * 0.8 + iTime * 0.4) * 0.3;
    p.y += cos(p.z * 0.9 + iTime * 0.3) * 0.3;
    
    vec2 tubePos = p.xy; 
    
    p.xy *= rot(p.z * 0.8 + iTime * 0.2);
    p.z = mod(p.z, 2.0) - 1.0;
    
    vec4 z = vec4(p, 0.0);
    vec4 c = vec4(0.38, 0.22, 0.15, 0.1) + 0.06 * sin(iTime * vec4(0.4, 0.3, 0.5, 0.2));
    
    float dz = 1.0;
    orbitTrap = vec4(1000.0);
    
    for(int i = 0; i < 8; i++) {
        float r2 = dot(z, z);
        if(r2 > 4.0) break;
        
        dz = 2.0 * sqrt(r2) * dz;
        z = qSqr(z) + c;
        
        orbitTrap.x = min(orbitTrap.x, abs(z.x));
        orbitTrap.y = min(orbitTrap.y, dot(z.xz, z.xz)); 
        orbitTrap.z = min(orbitTrap.z, dot(z.xyz, z.xyz));
    }
    
    float fractalDist = 0.25 * log(dot(z,z)) * sqrt(dot(z,z)) / dz;
    float cylinderDist = length(tubePos) - 0.6; 
    float finalDist = max(fractalDist, -cylinderDist);
    
    return finalDist * 0.6;
}

vec2 map(vec3 p) {
    vec3 p0 = p;
    float dFractal = mapDist(p); 
    
    vec3 pMenger = p0;
    pMenger.xy -= getTunnelCenter(pMenger.z, iTime);
    pMenger.xy *= rot(-iTime * 0.35); 
    pMenger.z = mod(pMenger.z + iTime * 8.0, 20.0) - 10.0; 
    
    float mAngle = atan(pMenger.y, pMenger.x);
    float mSector = 6.28318 / 5.0; 
    mAngle = mod(mAngle + mSector*0.5, mSector) - mSector*0.5;
    
    float mRadius = 4.2 + 2.5 * sin(iTime * 0.5 + p0.z * 0.1); 
    vec3 mBoxP = vec3(length(pMenger.xy) - mRadius, mAngle * mRadius, pMenger.z);
    
    float holeDist = length(mBoxP) - 1.4; 
    dFractal = max(dFractal, -holeDist);
    
    vec2 res = vec2(dFractal, 0.0); 

    float sphereSpeed = 6.0;
    float sphereSpacing = 5.0;
    float sz = p0.z - iTime * sphereSpeed;
    float id = floor(sz / sphereSpacing);
    float sWorldZ = (id + 0.5) * sphereSpacing + iTime * sphereSpeed;
    float sLocalZ = p0.z - sWorldZ; 
    vec2 tubePos = p0.xy + vec2(sin(p0.z * 0.8 + iTime * 0.4) * 0.3, cos(p0.z * 0.9 + iTime * 0.3) * 0.3);
    float sDist = length(vec3(tubePos, sLocalZ)) - 0.25;
    res = opU(res, vec2(sDist * 0.8, 1.0)); 
    
    vec3 mRenderP = mBoxP;
    mRenderP.xz *= rot(iTime * 1.5);
    mRenderP.xy *= rot(iTime * 1.2);
    float mScale = 1.8;
    float mengerDist = sdMenger(mRenderP * mScale) / mScale;
    res = opU(res, vec2(mengerDist * 0.7, 3.0)); 

    return res;
}

float bumpPattern(vec3 p) {
    float freq = 45.0;
    float ribs = sin(p.z * freq) * sin(atan(p.y, p.x) * 20.0);
    return ribs * 0.003; 
}

vec3 calcNormal(vec3 p, float matID) {
    vec2 e = vec2(0.002, 0.0);
    vec3 n = normalize(vec3(
        map(p + e.xyy).x - map(p - e.xyy).x,
        map(p + e.yxy).x - map(p - e.yxy).x,
        map(p + e.yyx).x - map(p - e.yyx).x
    ));
    
    if (matID == 0.0) {
        vec3 grad = vec3(
            bumpPattern(p + e.xyy) - bumpPattern(p - e.xyy),
            bumpPattern(p + e.yxy) - bumpPattern(p - e.yxy),
            bumpPattern(p + e.yyx) - bumpPattern(p - e.yyx)
        ) / (2.0 * e.x);
        
        n = normalize(n - grad * 0.4);
    }
    
    return n;
}

float softshadow(in vec3 ro, in vec3 rd, in float mint, in float tmax, in float k) {
    float res = 1.0;
    float t = mint;
    for(int i = 0; i < 16; i++) {
        float h = map(ro + rd * t).x;
        res = min(res, k * h / t);
        t += clamp(h, 0.02, 0.2);
        if(res < 0.001 || t > tmax) break;
    }
    return clamp(res, 0.0, 1.0);
}

float calcAO(in vec3 pos, in vec3 nor) {
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = map(pos + h * nor).x;
        occ += (h - d) * sca;
        sca *= 0.95;
        if(occ > 0.35) break;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    vec4 data0 = texelFetch(iChannel0, ivec2(0, 0), 0);
    vec4 data1 = texelFetch(iChannel0, ivec2(1, 0), 0);

    vec3 ro = data0.xyz;
    float fov = data0.w;
    vec3 ta = data1.xyz;
    float roll = data1.w;

    vec4 audioData = texelFetch(iAudioData, ivec2(0, 0), 0);
    float volPump = audioData.a;

    mat3 ca = setCamera(ro, ta, roll);
    vec3 rd = ca * normalize(vec3(uv, fov)); 
    
    float camCoreDist = length(ro.xy - getTunnelCenter(ro.z, iTime));
    float envBlend = smoothstep(0.5, 2.0, camCoreDist);

    vec3 mainLightDir = normalize(vec3(cos(iTime * 0.4), sin(iTime * 0.3) + 0.5, 0.8));

    float t = 0.0;
    float maxDist = 45.0; 
    vec2 res = vec2(0.0);
    
    for(int i = 0; i < 180; i++) { 
        vec3 p = ro + rd * t;
        res = map(p);
        if(res.x < 0.001 || t > maxDist) break;
        t += res.x;
    }

    vec3 godrays = vec3(0.0);
    vec3 tunnelFog = vec3(0.0);
    
    float rayLength = min(t, 18.0);
    float marchStep = rayLength / 10.0; 
    
    for(int k = 1; k <= 10; k++) {
        float sampleT = float(k) * marchStep;
        vec3 sampleP = ro + rd * sampleT;
        
        vec3 relP = sampleP - vec3(0.0, 0.0, ro.z);
        float beamAngle = atan(relP.y, relP.x);
        
     
        float swirlSpeed = iTime * 0.5 + volPump * 2.0;
        float beamNoise = sin(beamAngle * 6.0 + swirlSpeed + sampleP.z * 0.8) * 0.5 + 0.5;
        beamNoise = pow(beamNoise, 16.0); 
        float phase = pow(max(dot(rd, mainLightDir), 0.0), 2.5) * 0.7 + 0.3;
        
        if(beamNoise > 0.015) {
            float shadow = softshadow(sampleP, mainLightDir, 0.05, 3.0, 5.0);
            vec3 shaftCol = getAuroraColor(sampleP.z, beamAngle, iTime, envBlend) * 1.35;
            float rayIntensity = mix(0.008, 0.045, envBlend) + (volPump * 0.025);
            godrays += shaftCol * shadow * beamNoise * phase * rayIntensity;
        }
        
        vec2 tc = getTunnelCenter(sampleP.z, iTime);
        float coreDist = length(sampleP.xy - tc);
        
        if (coreDist < 1.4) {
            float driftZ = sampleP.z + iTime * 5.0 + volPump * 4.0; 
            float waveX = sin(sampleP.x * 4.0 + iTime * 1.5 + cos(sampleP.z * 2.0));
            float waveY = cos(sampleP.y * 4.0 - iTime * 1.2 + sin(sampleP.z * 1.8));
            float n = waveX * waveY * sin(driftZ * 1.2);
            
            n = smoothstep(0.7, 1.0, n * 0.5 + 0.5); 
            float fogMask = smoothstep(1.4, 0.2, coreDist) * smoothstep(0.0, 0.4, coreDist);
            
            float depthFade = smoothstep(2.0, 10.0, sampleT); 
            
            vec3 fogCol = mix(mix(vec3(0.1, 0.6, 0.9), vec3(0.1, 0.3, 0.8), sin(sampleP.z * 0.6 + iTime) * 0.5 + 0.5),
                              mix(vec3(0.1, 0.6, 0.9), vec3(0.5, 0.1, 0.8), sin(sampleP.z * 0.6 + iTime) * 0.5 + 0.5), envBlend);
                              
            tunnelFog += fogCol * n * fogMask * depthFade * marchStep * mix(0.12, 0.45, envBlend);
        }
    }

    vec3 bgNebula = vec3(0.004, 0.002, 0.008) + 0.006 * sin(rd.x * 5.0 + iTime * 0.5) * cos(rd.y * 4.0 - iTime * 0.3);
    vec3 col = bgNebula;

    if(t < maxDist) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p, res.y);
        vec3 viewDir = normalize(ro - p);
        float ao = calcAO(p, n);
        
        vec3 baseCol = vec3(0.0);
        float specPow = 64.0; 
        float specMulti = 2.0; 
        float diffMulti = 0.8;
        vec3 emissive = vec3(0.0);
        
        vec3 refDir = reflect(rd, n);
        vec3 envNebula = vec3(0.008, 0.004, 0.015) + 0.01 * sin(refDir.x * 5.0 + iTime * 0.5) * cos(refDir.y * 4.0 - iTime * 0.3);
        float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        
        if (res.y == 0.0) {
            baseCol = pal(orbitTrap.y * 1.5 + orbitTrap.z * 0.5 - iTime * 0.2, envBlend) * mix(0.05, 0.45, envBlend);
            emissive += envNebula * fresnel * 0.6 * ao;
            
            float coreDist = length(p.xy - getTunnelCenter(p.z, iTime));
            float outerMask = smoothstep(0.68, 1.05, coreDist);
            float refBeamAngle = atan(refDir.y, refDir.x);
            float refBeamNoise = sin(refBeamAngle * 6.0 + iTime * 0.5 + (p.z + refDir.z * 2.5) * 0.8) * 0.5 + 0.5;
            refBeamNoise = pow(refBeamNoise, 12.0);
            float refPhase = pow(max(dot(refDir, mainLightDir), 0.0), 2.0) * 0.6 + 0.4;
            vec3 refAurora = getAuroraColor(p.z + refDir.z * 2.5, refBeamAngle, iTime, envBlend) * refBeamNoise * refPhase * 2.2;
            
            emissive += refAurora * (fresnel * 0.75 + 0.25) * outerMask * ao * mix(0.0, 1.0, envBlend);
            
        } else if (res.y == 1.0 || res.y == 3.0) {
            baseCol = vec3(0.005); 
            specPow = 256.0; 
            specMulti = 3.5; 
            diffMulti = 0.05; 
            
            vec3 fractalReflection = pal(refDir.y * 2.0 - iTime * 0.2, envBlend) * 0.4;
            
            float refBeamAngle = atan(refDir.y, refDir.x);
            float refBeamNoise = sin(refBeamAngle * 6.0 + iTime * 0.5 + (p.z + refDir.z * 2.5) * 0.8) * 0.5 + 0.5;
            refBeamNoise = pow(refBeamNoise, 10.0);
            vec3 beamReflection = getAuroraColor(p.z + refDir.z * 2.5, refBeamAngle, iTime, envBlend) * refBeamNoise * 1.5;
            
            emissive += (fractalReflection + beamReflection) * fresnel * 2.5 * ao; 
        }
        
        float mainDiff = max(dot(n, mainLightDir), 0.0);
        float mainShadow = softshadow(p, mainLightDir, 0.02, 5.0, 16.0);
        vec3 mainHalf = normalize(mainLightDir + viewDir);
        float mainSpec = pow(max(dot(n, mainHalf), 0.0), specPow);
        
        vec3 ptLightPos = ta + vec3(0.0, 1.0, 1.0);
        vec3 ptLightDir = normalize(ptLightPos - p);
        float ptLightDist = length(ptLightPos - p);
        float ptAtten = 1.0 / (1.0 + 0.25 * ptLightDist * ptLightDist);
        float ptDiff = max(dot(n, ptLightDir), 0.0);
        vec3 ptHalf = normalize(ptLightDir + viewDir);
        float ptSpec = pow(max(dot(n, ptHalf), 0.0), specPow * 1.5);
        vec3 ptColor = vec3(0.15, 0.45, 0.85) * mix(0.3, 1.0, envBlend); 
        
        float rimPow = 1.0 - max(dot(n, viewDir), 0.0);
        float rim = smoothstep(0.3, 1.0, rimPow) * ao; 
        rim *= exp(-t * 0.1) * mix(0.2, 1.0, envBlend); 
        
        vec3 rimColor = mix(vec3(0.05, 0.15, 0.25), vec3(0.85, 0.25, 0.55), envBlend);
        
        vec3 ambient = vec3(0.008, 0.004, 0.012) * ao; 
        vec3 diffuseLight = (mainDiff * mainShadow * vec3(0.9, 0.8, 0.7)) + (ptDiff * ptAtten * ptColor);
        vec3 specularLight = (mainSpec * mainShadow * vec3(1.0)) + (ptSpec * ptAtten * ptColor * 1.4);
        
        col = baseCol * diffuseLight * diffMulti + ambient;
        col += specularLight * specMulti;
        col += rim * rimColor * 0.75;
        col += emissive;
        
        float fog = 1.0 - exp(-t * 0.04);
        col = mix(col, bgNebula, fog);
    }
    
    col += godrays;
    col += tunnelFog; 

    fragColor = vec4(col, t);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
