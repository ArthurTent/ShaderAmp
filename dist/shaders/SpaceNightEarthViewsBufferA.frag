// https://www.shadertoy.com/view/7ffyR2
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: Space Night - Earth Views b - Buffer A
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

// Buffer A: drag-to-rotate camera state only (3 pixels, fits any buffer size).
// The Earth map data lives in Cube A.

// ---- Drag-to-rotate camera state ------------------------------------------------------
// Needs Buffer A's iChannel0 = Buffer A (feedback). Pixel (0,0) = yaw, pitch, velocity;
// pixel (1,0) = last mouse xy, button-was-down, user-has-interacted;
// pixel (2,0) = marker 1000 + "feedback works" flag for the Image pass.
const float DRAG_SPEED = 1.0;   // 1 = dragging across the full canvas height turns the globe 180 deg
const float INERTIA    = 0.92;  // spin-out after releasing (0 = stop at once, 0.98 = long glide)

vec4 cameraState(ivec2 c) {
    vec4 cam  = texelFetch(iChannel0, ivec2(0, 0), 0);     // yaw, pitch, yawVel, pitchVel
    vec4 last = texelFetch(iChannel0, ivec2(1, 0), 0);     // mouse xy, wasDown, interacted
    bool down = iMouse.z > 0.0;
    float interacted = (iFrame == 0) ? 0.0 : last.w;
    if (iFrame == 0) cam = vec4(0.0);

    if (interacted < 0.5 && !down) {
        // idle: slow automatic drift until the first drag
        cam = vec4(iTime * 0.05, 0.25 * sin(iTime * 0.07), 0.0, 0.0);
    } else if (down && last.z > 0.5) {
        // dragging: the surface follows the cursor
        vec2 d = (iMouse.xy - last.xy) * (DRAG_SPEED * 3.14159265 / iResolution.y);
        vec2 v = vec2(-d.x, d.y);
        cam.zw = mix(cam.zw, v, 0.5);          // smoothed velocity for the release spin
        cam.xy += v;
    } else if (!down) {
        // released: glide out (frame-rate independent decay, 60 fps reference)
        cam.xy += cam.zw;
        cam.zw *= pow(INERTIA, iTimeDelta * 60.0);
    } else {
        cam.zw = vec2(0.0);                     // first frame of a new drag
    }
    cam.x = mod(cam.x, 6.28318531);
    if (abs(cam.y) >= 1.4) cam.w = 0.0;      // stop the tilt momentum at the limit
    cam.y = clamp(cam.y, -1.4, 1.4);

    if (c.x == 0) return cam;
    return vec4(iMouse.xy, down ? 1.0 : 0.0, (down || interacted > 0.5) ? 1.0 : 0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    ivec2 c = ivec2(fragCoord);
    if (c.y != 0 || c.x > 2) {
        fragColor = vec4(0.0);
        return;
    }
    if (c.x == 2) {
        bool fed = iFrame > 0 && abs(texelFetch(iChannel0, ivec2(2, 0), 0).x - 1000.0) < 0.5;
        fragColor = vec4(1000.0, fed ? 1.0 : 0.0, 0.0, 0.0);
        return;
    }
    fragColor = cameraState(c);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
