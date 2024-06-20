// https://www.shadertoy.com/view/4dXBR8
// Modified by ArthurTent
// Created by slerpy
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

void main()
{
    vec2 fragCoord = vUv * iResolution;
    gl_FragColor = vec4(0);
	vec2 uv = fragCoord.xy/iResolution.xy;
    float yoff = texture(iAudioData,vec2(uv.x/8.,1)).r/20.;
    gl_FragColor += texture(iVideo,fract(uv-vec2(0,yoff))).r-abs(.5-uv.y);
    if(abs(3.*(uv.y-.5))>pow(max(.2,texture(iAudioData,vec2(uv.x,0)).r),3.))gl_FragColor+=1.;
}