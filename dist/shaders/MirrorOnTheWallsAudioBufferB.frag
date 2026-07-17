// https://www.shadertoy.com/view/fXc3zB
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: MirrorOnTheWalls?audio:mirror 2 - Buffer B
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

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(0.0,0.0,1.0,1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
