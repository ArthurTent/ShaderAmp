// https://www.shadertoy.com/view/wd3XzS
// Modified by ArthurTent
// Created by knarkowicz
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/deed.en
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

float sample_at(float f)
{
    return texture(iAudioData, vec2(f / 16.0, 0.)).x;
}

void main(  )
{
    //vec2 p = iResolution.xy;
    /*
    vec2 p = vUv;
    vec2 f = -1.0 + 2.0* vUv;
    */
    /*
    vec2 p = vUv * 2. - 1.
    vec2 f = vUv;

    //vec2 uv =  2.0*vec2(fragCoord.xy - 0.5*iResolution.xy)/iResolution.y;
	vec2 uv = -1.0 + 2.0* vUv;
    */
    vec2 p = vUv ;
    vec2 f = -1.0 + 2.0* vUv+ vec2(.25   ,0.25);

    float d = length( p = ( f + f - p ) / p.y ) / .9,
          l = ceil( d ),
          t = iGlobalTime / ( 1.5 - l ) * .3 + iMouse.x / 1e3;

    p = p * asin( d / l ) / d - 5.;

    p.x -= t;
	f = min( abs( fract( p *= 6. ) - .1 ) * 9., 1. );
    p = ceil( p ) / 6.;
    p.x += t;
    float bass = sample_at(0.1);
    gl_FragColor = texture( iChannel0, p * .1 )
        * f.x * f.y * bass
        //* ( l > 1. ? texture( iAudioData, p ).x : 1.5 );
        * ( l > 1. ? texture( iAudioData, vec2(t / 16.0, 0.) ).x : 1.5 );
}