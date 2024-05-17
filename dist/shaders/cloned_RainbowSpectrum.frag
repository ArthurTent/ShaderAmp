// https://www.shadertoy.com/view/ldX3D8
// Modified by ArthurTent
// Created by hornet
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

float bump(float x) {
	return abs(x) > 1.0 ? 0.0 : 1.0 - x * x;
}

void main( )
{
	//vec2 uv = (fragCoord.xy / iResolution.xy);
    vec2 uv = -1.0 + 3.0* vUv;// + vec2(0.0, sin(iAmplifiedTime * 0.1)*0.04); //besser als ganz ok...
    vec4 soundWave =  texture( iAudioData, vec2(abs(0.5-uv.x)+0.005, uv.y) ).rrrr;

	float c = 3.0;
	vec3 color = vec3(1.0);
	color.x = bump(c * (uv.x - 0.75));
	color.y = bump(c * (uv.x - 0.5));
	color.z = bump(c * (uv.x - 0.25));

	float line = abs(0.01 / abs(0.5-uv.y) );
	uv.y = abs( uv.y - 0.5 );

	color *= line * (1.0 - 2.0 * abs( 0.5 - uv.xxx ) + pow( soundWave.y, 10.0 ) * 30.0 );

	gl_FragColor = vec4(color, 0.0);
}