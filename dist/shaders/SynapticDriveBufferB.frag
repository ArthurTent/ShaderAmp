// https://www.shadertoy.com/view/NXcSDf
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Synaptic Drive ( audio) - Buffer B
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


vec3 cam_default(float s) {
    float r = 3.6 + sin(s * 1.5) * 1.1;
    float x = sin(s) * r;
    float z = cos(s) * r;
    float y = sin(s * 0.7) * 1.8 + cos(s * 1.3) * 0.6;
    return vec3(x, y, z);
}

vec3 cam_coreTunnel(float s) {
    float x = sin(s * 1.4) * 0.65;
    float z = cos(s * 1.1) * 0.65;
    float y = sin(s * 0.8) * 2.8; 
    return vec3(x, y, z);
}

vec3 cam_crevasseWeave(float s) {
    float r = 1.30 + sin(s * 2.1) * 0.32; 
    float x = sin(s * 1.3) * r;
    float z = cos(s * 1.3) * r;
    float y = cos(s * 0.95) * 1.5;
    return vec3(x, y, z);
}

vec3 cam_trenchSkim(float s) {
    float r = 3.2 + sin(s * 1.4) * 0.6;
    float x = sin(s * 1.0) * r;
    float z = cos(s * 1.0) * r;
    float y = -2.4 + sin(s * 1.6) * 0.4;
    return vec3(x, y, z);
}

vec3 cam_weaver(float s) {
    float r = 4.2 + cos(s * 1.8) * 1.2;
    float x = cos(s * 1.2) * r;
    float z = sin(s * 1.2) * r;
    float y = cos(s * 1.5) * 1.6;
    return vec3(x, y, z);
}

vec3 cam_reverseChase(float s) {
    float x = sin(s * 0.8) * 4.0;
    float z = cos(s * 1.6) * 3.2;
    float y = sin(s * 1.6) * 1.6;
    return vec3(x, y, z);
}

vec3 evalCam(int id, float s) {
    if (id == 0) return cam_default(s);
    if (id == 1) return cam_coreTunnel(s);
    if (id == 2) return cam_crevasseWeave(s);
    if (id == 3) return cam_trenchSkim(s);
    if (id == 4) return cam_weaver(s);
    return cam_reverseChase(s);
}


void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    ivec2 coord = ivec2(fragCoord);
    if (coord.y != 0 || coord.x > 2) {
        discard;
    }

    vec4 prevAudio = texelFetch(iChannel1, ivec2(2, 0), 0);
    float prevBass   = prevAudio.x;
    float prevMid    = prevAudio.y;
    float prevTreble = prevAudio.z;
    float prevKick   = prevAudio.w;

    float b0 = texture(iAudioData, vec2(0.003, 0.25)).x; 
    float b1 = texture(iAudioData, vec2(0.008, 0.25)).x; 
    float b2 = texture(iAudioData, vec2(0.016, 0.25)).x; 
    float rawBass = max(b0 * 0.35 + b1 * 0.50 + b2 * 0.25, b1);

    float m0 = texture(iAudioData, vec2(0.035, 0.25)).x; 
    float m1 = texture(iAudioData, vec2(0.075, 0.25)).x; 
    float m2 = texture(iAudioData, vec2(0.120, 0.25)).x; 
    float m3 = texture(iAudioData, vec2(0.180, 0.25)).x; 
    float rawMid = (m0 * 0.25 + m1 * 0.35 + m2 * 0.25 + m3 * 0.15);

    float t0 = texture(iAudioData, vec2(0.22, 0.25)).x; 
    float t1 = texture(iAudioData, vec2(0.32, 0.25)).x; 
    float t2 = texture(iAudioData, vec2(0.44, 0.25)).x; 
    float t3 = texture(iAudioData, vec2(0.58, 0.25)).x; 
    float rawTreble = (t0 * 0.35 + t1 * 0.35 + t2 * 0.20 + t3 * 0.10);

    float targetKick = pow(smoothstep(0.20, 0.82, rawBass), 1.5);
    float kickEnv = (targetKick > prevKick)
        ? mix(prevKick, targetKick, 0.85)
        : mix(prevKick, targetKick, 0.16);

    float targetMid = pow(smoothstep(0.12, 0.75, rawMid), 1.3);
    float midEnv = (targetMid > prevMid)
        ? mix(prevMid, targetMid, 0.80)
        : mix(prevMid, targetMid, 0.22);

    float targetTreble = pow(smoothstep(0.08, 0.65, rawTreble), 1.2);
    float trebleEnv = (targetTreble > prevTreble)
        ? mix(prevTreble, targetTreble, 0.92)
        : mix(prevTreble, targetTreble, 0.26);

    float bassOut   = mix(prevBass, rawBass, 0.30);
    float midOut    = max(rawMid, midEnv * 1.25);
    float trebleOut = max(rawTreble, trebleEnv * 1.35);

    float driveTime = iTime * 0.35;

    float shotLength = 8.5;
    int shotIndex = int(floor(iTime / shotLength));
    float shotTime = mod(iTime, shotLength);

    const int playlist[12] = int[](0, 1, 3, 2, 0, 5, 1, 4, 2, 0, 3, 1);
    int camId = playlist[shotIndex % 12];

    vec3 baseRo = evalCam(camId, driveTime);

    float shockwave = kickEnv * 0.25;
    vec3 ro = baseRo * (1.0 + shockwave * 0.1);

    vec3 forwardPoint = evalCam(camId, driveTime + 0.45);
    vec3 coreTarget = vec3(sin(iTime * 0.2) * 0.4, cos(iTime * 0.25) * 0.3, 0.0);
    
    vec3 ta;
    if (camId == 0) {
        ta = mix(forwardPoint, coreTarget, 0.45);
    } else if (camId == 1) {
        ta = forwardPoint;
    } else if (camId == 2) {
        ta = mix(forwardPoint, coreTarget, 0.35);
    } else if (camId == 3) {
        ta = forwardPoint + vec3(0.0, 0.6, 0.0);
    } else if (camId == 5) {
        ta = coreTarget;
    } else {
        ta = mix(forwardPoint, coreTarget, 0.50);
    }

    vec3 d1 = evalCam(camId, driveTime + 0.1) - evalCam(camId, driveTime - 0.1);
    vec3 d2 = evalCam(camId, driveTime + 0.1) - 2.0 * baseRo + evalCam(camId, driveTime - 0.1);
    float lateralG = (d1.x * d2.z - d1.z * d2.x);
    float targetRoll = clamp(lateralG * 1.2, -0.6, 0.6);

    float prevRoll = texelFetch(iChannel1, ivec2(0, 0), 0).w;
    float roll = (shotTime < 0.10) ? targetRoll : mix(prevRoll, targetRoll, 0.20);

    float fov = 1.30 - (kickEnv * 0.08) - (trebleOut * 0.02);

    if (coord.x == 0) {
        fragColor = vec4(ro, roll);
    } else if (coord.x == 1) {
        fragColor = vec4(ta, fov);
    } else if (coord.x == 2) {
        fragColor = vec4(bassOut, midOut, trebleOut, kickEnv);
    }
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
