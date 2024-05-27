// https://www.shadertoy.com/view/4dK3zD
// Modified by ArthurTent
// Created by hunter
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

float heartRadius(float theta)
{
    return 2. - 2.*sin(theta) + sqrt(abs(cos(theta)))*sin(theta)/(1.4 + sin(theta));
}

void main()
{
    vec2 uv = -1.0 + 2.0 *vUv;
    float v  = texture( iAudioData, vec2(1/510,0.25) ).x;

    float red  = texture( iAudioData, vec2(1/510,0.25) ).x;
    float grn  = texture( iAudioData, vec2(0.5,0.5) ).x;
    float blu  = texture( iAudioData, vec2(0.75,0.5) ).x;

    vec4 heartColor = vec4(red,grn,blu,1.0);
    vec4 bgColor = vec4(0.0,0.0,0.0,1.0);
    vec2 originalPos = uv;
    vec2 pos = originalPos;
    pos.y -= .5;

    float theta = atan(pos.y, pos.x);
    float r = heartRadius(theta);

    gl_FragColor = mix(bgColor, heartColor,
                    smoothstep(0.0, length(pos) * 0.5, r * v * 0.125 ));
    gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * 5.;

}