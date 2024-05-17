// https://www.shadertoy.com/view/MsBSzw
// Modified by ArthurTent
// Created by Passion
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
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
    //vec2 p = (fragCoord.xy-.5*iResolution.xy)/min(iResolution.x,iResolution.y);
    //vec2 p =  vUv - .5;
    vec2 p =  vUv-0.5;

    vec3 c = vec3(0.0);
    //vec2 uv = fragCoord.xy / iResolution.xy;
    //vec2 uv = gl_FragCoord.xy / iResolution.xy;
    //vec2 uv =  -1. + 2.* vUv;
    vec2 uv =  vUv;
    float wave = texture( iAudioData, vec2(uv.x,0.75) ).x;

    for(int i = 1; i<20; i++)
    {
        float time = 2.*3.14*float(i)/20.* (iTime*.9);
        float x = sin(time)*1.8*smoothstep( 0.0, 0.15, abs(wave - uv.y));
        float y = sin(.5*time) *smoothstep( 0.0, 0.15, abs(wave - uv.y));
        y*=.5;
        vec2 o = .4*vec2(x*cos(iTime*.5),y*sin(iTime*.3));
        float red = fract(time);
        float green = 1.-red;
        c+=0.016/(length(p-o))*vec3(red,green,sin(iTime));
    }
    gl_FragColor = vec4(c,1.0);
}
//2014 - Passion
//References  - https://www.shadertoy.com/view/Xds3Rr
//            - tokyodemofest.jp/2014/7lines/index.html

