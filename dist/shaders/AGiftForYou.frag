// https://www.shadertoy.com/view/73fXW2
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: A Gift For You
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

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

// ShaderAmp 2.0 is now feature-complete!
//
// GitHub:                https://github.com/ArthurTent/ShaderAmp
// Chrome Web Store:      https://chromewebstore.google.com/detail/shaderamp/pbgkhemojiabmajgkcgjelgpnpoddcgl
// Mozzilla Addon Market: https://addons.mozilla.org/en-GB/firefox/addon/shaderamp/
// Example on YT: https://www.youtube.com/watch?v=8LG-zpwgQBI

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    vec3 color = texture(iChannel1, uv).rgb;
    
    // Post Processing Layer: High-End Analog Vignette
    vec2 vignUV = uv * (1.0 - uv.yx);
    float vignette = vignUV.x * vignUV.y * 15.0;
    vignette = clamp(pow(vignette, 0.25), 0.0, 1.0);
    color *= vignette;
    
    // Native Gamma correction for rich color output mapping
    color = pow(color, vec3(0.85));
    
    fragColor = vec4(color, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
