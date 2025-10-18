// https://www.shadertoy.com/view/stXcz8
// Modified by ArthurTent
// Created by MrHAX00
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

// Common
#define pi 3.14159


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
