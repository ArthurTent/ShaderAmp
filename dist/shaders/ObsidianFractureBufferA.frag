// https://www.shadertoy.com/view/sXtXzS
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Obsidian Fracture (audio) - Buffer A
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
void getCamData(float time, out vec3 ro, out vec3 ta, out float fov, out float roll) {
    float camTime = time * 0.3;
    float globalZ = time * 0.8; 
    
    int camIndex = int(floor(mod(time / 10.0, 12.0)));    
    
    fov = 1.5; roll = 0.0;

    if (camIndex == 0) {
        float localTime = mod(time, 10.0);
        float dist = mix(8.0, 3.5, smoothstep(0.0, 10.0, localTime));
        ro = vec3(dist * cos(time * 0.4), dist * sin(time * 0.5), globalZ - 2.0 + localTime * 0.5);
        ta = vec3(0.0, 0.0, globalZ + 4.0);
        fov = 1.4; roll = time * 0.1;
    } else if (camIndex == 1) {
        ro = vec3(4.5 * cos(camTime), 3.0 * sin(camTime * 0.7), globalZ + 2.0 * sin(camTime));
        ta = vec3(0.0, 0.0, globalZ);
        fov = 1.2; 
    } else if (camIndex == 2) {
        vec2 centerPos = getTunnelCenter(globalZ, time);
        vec2 lookPos = getTunnelCenter(globalZ + 2.5, time);
        ro = vec3(centerPos.x, centerPos.y, globalZ);
        ta = vec3(lookPos.x, lookPos.y, globalZ + 2.5);
        fov = 2.0; roll = sin(time * 0.5) * 0.3; 
    } else if (camIndex == 3) {
        float z3 = globalZ - time * 0.4; 
        ro = vec3(2.0 * cos(time * 0.6), 1.5 * sin(time * 0.4), z3);
        ta = vec3(0.0, 0.0, z3 + 3.0);
        fov = 1.2; roll = -0.2;
    } else if (camIndex == 4) {
        float z4 = globalZ + time * 2.0;
        vec2 centerPos4 = getTunnelCenter(z4, time);
        vec2 spiral = vec2(cos(time * 2.5), sin(time * 2.5)) * 0.25;
        ro = vec3(centerPos4 + spiral, z4);
        vec2 lookPos4 = getTunnelCenter(z4 + 2.0, time);
        ta = vec3(lookPos4, z4 + 2.0);
        fov = 2.1; roll = time * 0.8;
    } else if (camIndex == 5) {
        float z5 = globalZ + time * 1.5;
        float mRadius = 4.8 + 2.0 * sin(time * 0.5 + z5 * 0.1); 
        vec2 mOffset = vec2(cos(-time * 0.35), sin(-time * 0.35)) * mRadius; 
        ro = vec3(getTunnelCenter(z5, time) + mOffset, z5);
        ta = vec3(getTunnelCenter(z5 + 3.0, time), z5 + 3.0);
        fov = 1.7; roll = -time * 0.35; 
    } else if (camIndex == 6) {
        float z6 = globalZ + time * 1.8;
        vec2 centerPos6 = getTunnelCenter(z6, time);
        ro = vec3(centerPos6, z6);
        vec2 lookPos6 = getTunnelCenter(z6 - 2.0, time); 
        ta = vec3(lookPos6, z6 - 2.0);
        fov = 2.0; roll = sin(time * 0.4) * 0.25;
    } else if (camIndex == 7) {
        float z7 = globalZ + time * 1.1;
        vec2 extOffset = vec2(cos(time * 0.85), sin(time * 0.85)) * 2.25;
        ro = vec3(getTunnelCenter(z7, time) + extOffset, z7);
        ta = vec3(getTunnelCenter(z7 + 0.9, time), z7 + 0.9);
        fov = 1.65; roll = sin(time * 0.5) * 0.2;
    } else if (camIndex == 8) {
        float z8 = globalZ + time * 1.4;
        vec2 centerPos8 = getTunnelCenter(z8, time);
        vec2 wallOffset = vec2(sin(time * 1.2), cos(time * 1.2)) * 0.35; 
        ro = vec3(centerPos8 + wallOffset, z8);
        vec2 lookPos8 = getTunnelCenter(z8 + 1.8, time);
        ta = vec3(lookPos8, z8 + 1.8);
        fov = 1.85; roll = time * 0.5;
    } else if (camIndex == 9) {
        ro = vec3(2.8, 1.5, globalZ + camTime * 3.0);
        ta = vec3(0.0, 0.0, globalZ + camTime * 3.0 - 2.0); 
        fov = 1.0; roll = -0.15;
    } else if (camIndex == 10) {
        float z10 = globalZ + time * 0.9; 
        vec2 centerPos10 = getTunnelCenter(z10, time);
        ro = vec3(centerPos10.x, centerPos10.y, z10);
        vec2 lookPos10 = getTunnelCenter(z10 + 3.0, time);
        ta = vec3(lookPos10.x, lookPos10.y, z10 + 3.0);
        fov = 1.0 + 0.6 * sin(time * 1.5);
        roll = sin(time * 0.3) * 0.4;
    } else {
        ro = vec3(3.0 * cos(camTime * 2.0), 3.0 * sin(camTime * 2.0), globalZ - 3.0);
        ta = vec3(0.0, 0.0, globalZ + 2.0);
        fov = 1.6; roll = camTime; 
    }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    if (fragCoord.y > 1.0 || fragCoord.x > 4.0) { fragColor = vec4(0.0); return; }

    vec3 ro, ta; float fov, roll;    
    
    if (fragCoord.x < 2.0) {
        getCamData(iTime, ro, ta, fov, roll);
        fragColor = (fragCoord.x < 1.0) ? vec4(ro, fov) : vec4(ta, roll);
    } 
    else {
        getCamData(iTime - iTimeDelta, ro, ta, fov, roll);
        fragColor = (fragCoord.x < 3.0) ? vec4(ro, fov) : vec4(ta, roll);
    }
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
