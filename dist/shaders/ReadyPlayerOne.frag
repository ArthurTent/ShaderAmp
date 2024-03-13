// https://www.shadertoy.com/view/Xd2fD1
// Modified by ArthurTent
// Created by Nestor Vina
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/


uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

void main()
{
    vec4 p = vec4( 10., -.9 + sin(iGlobalTime), -iGlobalTime, 0 );
    vec4 t=gl_FragColor-=gl_FragColor;
    vec2 f = -1.0 + 2.0 *vUv +.35;// +0.35;
    for( int i = 0; i++ < 99; t=texture( iChannel1, p.xz * 0.0525 ) )
        p += vec4( f / vUv.x - 1.01, .5, 0 ) * ( p.y + 2. )*0.5, //* 2.2,
        t.b > 1.525 - texture(iAudioData, vec2( .04 * t.r * t.r * 30., 2.25*float(i) )).r  ? gl_FragColor += t*.015 : gl_FragColor;//+=sin(iGlobalTime)/10.;
    
    gl_FragColor *= gl_FragColor * vec4( .9, .8, 1.5*sin(iGlobalTime), .5 );
    gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * .5;
}

