// https://www.shadertoy.com/view/4dcSRj
// Modified by ArthurTent
// Created by s23b
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iVideo;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

void main( )
{
	//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
	vec2 uv = -1.0 + 2.0* vUv;
    uv.x *= iResolution.x / iResolution.y;

    // mirror everything across x and y axex
    uv = abs(uv);

    // init to black
    gl_FragColor = vec4(vec3(0), 1);

    // add horizontal and vertical scrolling sine waves
    gl_FragColor.rgb += smoothstep(.2, .24, sin(uv.x + iAmplifiedTime * vec3(1, 2, 4)) + .5 - uv.y);
    gl_FragColor.rgb += smoothstep(.2, .24, sin(uv.y * 2. + iAmplifiedTime * vec3(1, 2, 4)) / 2. + 1. - uv.x);

    // flip colors that are out of bounds
    gl_FragColor.rgb = abs(1. - gl_FragColor.rgb);

    // rotate space around the center
    float angel = iAmplifiedTime * .2,
        s = sin(angel),
        c = cos(angel);
    uv *= mat2(c, -s, s, c);

    // multiply by camera pixels
    gl_FragColor *= texture(iVideo, abs(.5 - fract(uv)) * 2.);

    // offset space according to spikes in fft data
    uv *= 10. + texture(iAudioData, vec2(.3, .25)).x * 5.;

    // add morphing sine grid
    gl_FragColor *= clamp(sin(uv.x) * sin(uv.y) * 20. + sin(iAmplifiedTime) * 5., 0., 1.) + .5;

}