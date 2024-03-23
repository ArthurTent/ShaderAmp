// https://www.shadertoy.com/view/Xtd3W7
// Modified by ArthurTent
// Created by gam0022
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// copied from QuantumSuper <3
#define getDat(addr) texelFetch( iAudioData, ivec2(addr,0), 0).x

void main()
{
    //vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv;
    vec2 uv2 = -1.0 + 2.0 *vUv;
    vec4 color =  texture(iVideo, uv);
    float gray = length(color.rgb);
    gl_FragColor = vec4(vec3(step(0.06, length(vec2(dFdx(gray), dFdy(gray))))), 1.0);
    gl_FragColor += vec4(getDat(gray* 5.), getDat(gray* 2.5), getDat(gray*1.05), 0.5) ;

    // copied from db0x90 "ShitJustGotReal"
    vec3 resultColor  = mix(vec3(0.),vec3(gl_FragColor.x, gl_FragColor.y, gl_FragColor.z),pow(max(0.,1.5-length(uv2*uv2*uv2*vec2(2.0,2.0))),.3));
    gl_FragColor = vec4(resultColor,1.0);
}