// https://www.shadertoy.com/view/4d33Dj
// Modified by ArthurTent
// Created by phi16
// Original Shader Name: A Popular Game
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

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    fragColor = vec4(texture(iChannel0,fragCoord/iResolution.xy));
}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
