// https://www.shadertoy.com/view/W3SfRy
// Modified by ArthurTent
// Created by orblivius
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// A Huge Ever Growing Pulsating Brain That Rules
// from the Centre of the Ultraworld  
//     by Orblivius
//  
// Clone of "pulsating waves" by Azorlogh
// Sources: https://shadertoy.com/view/t3BBWR

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = texture(iChannel0, fragCoord/iResolution.xy);
    
}

void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}
