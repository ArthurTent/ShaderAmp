// https://www.shadertoy.com/view/ds23zd
// Modified by ArthurTent
// Created by uratowel12
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
//CBS
//Parallax scrolling fractal galaxy.
//Inspired by JoshP's Simplicity shader: https://www.shadertoy.com/view/lslGWr
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

float freqs[4];

// http://www.fractalforums.com/new-theories-and-research/very-simple-formula-for-fractal-patterns/
float field(in vec3 p,float s) {
	float strength = 7. + .03 * log(1.e-6 + s*fract(sin(iAmplifiedTime) * 4373.11));
	float accum = s/4.;
	float prev = 0.;
	float tw = freqs[1];
	for (int i = 0; i < 26; ++i) {
		float mag = dot(p, p);
		p = abs(p) / mag + vec3(-.5, -.4, -1.5);
		float w = exp(-float(i)*freqs[0]/ 7.);
		accum += w * exp(-strength * pow(abs(mag - prev), 2.2))*(.35+freqs[0]*1.25);
		tw += w;
		prev = mag;
	}
	return max(0., 5. * accum / tw - .7);
}

// Less iterations for second layer
float field2(in vec3 p, float s) {
	float strength = 7. + .03 * log(1.e-6 + s*fract(sin(iAmplifiedTime) * 4373.11));
	float accum = s/4.;
	float prev = 0.;
	float tw = freqs[0];
	for (int i = 0; i < 24; ++i) {
		float mag = dot(p, p);
		p = abs(p) / mag + vec3(-.5, -.4, -1.5);
		float w = exp(-float(i)*freqs[1] / 7.);
		accum += w * exp(-strength * pow(abs(mag - prev), 2.2));
		tw += w;
		prev = mag;
	}
	return max(0., 5. * accum / tw - .7);
}

// Less iterations for third layer
float field3(in vec3 p, float s) {
	float strength = 7. + .03 * log(1.e-6 + s*fract(sin(iAmplifiedTime) * 4373.11));
	float accum = s/4.*freqs[3];
	float prev = 0.;
	float tw = freqs[3];
	for (int i = 0; i < 16; ++i) {
		float mag = dot(p, p);
		p = abs(p) / mag + vec3(-.25, -.4, -1.5);
		float w = exp(-float(i)*freqs[2] / 7.)*freqs[3]*10.;
		accum += w * exp(-strength * pow(abs(mag - prev), 2.2));
		tw += w;
		prev = mag;
	}
	return max(0., 5. * accum / tw - .7);
}

vec3 nrand3( vec2 co )
{
	vec3 a = fract( cos( co.x*8.3e-3 + co.y )*vec3(1.3e5, 4.7e5, 2.9e5) );
	vec3 b = fract( sin( co.x*0.3e-3 + co.y )*vec3(8.1e5, 1.0e5, 0.1e5) );
	vec3 c = mix(a, b, 0.5);
	return c;
}


void main( ) {
    //vec2 uv = 2. * fragCoord.xy / iResolution.xy - 1.;
    vec2 uv = vUv;
	vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);
	vec3 p = vec3(uvs / 4., 0) + vec3(1., -1.3, 0.);
	p += .2 * vec3(sin(iTime / 16.), sin(iTime / 12.),  sin(iTime / 128.));


	//Sound
	freqs[0] = texture( iAudioData, vec2( 0.01, 0.25 ) ).x;
	freqs[1] = texture( iAudioData, vec2( 0.07, 0.25 ) ).x;
	freqs[2] = texture( iAudioData, vec2( 0.15, 0.25 ) ).x;
	freqs[3] = texture( iAudioData, vec2( 0.30, 0.25 ) ).x;

	float t = field(p,freqs[2]);
	float v = (1. - exp((abs(uv.x) - 1.) * 6.)) * (1. - exp((abs(uv.y) - 1.) * 6.))*freqs[3];

    //Second Layer
	vec3 p2 = vec3(uvs / (4.+sin(iTime*0.11)*0.2+0.2+sin(iTime*0.15)*0.3+0.4), 1.5) + vec3(2., -1.3, -1.);
	p2 += 0.25 * vec3(sin(iTime / 16.), sin(iTime / 12.),  sin(iTime / 128.));
	float t2 = field2(p2,freqs[3]);
	vec4 c2 = mix(.4, 1., v) * vec4(1.3 * t2 * t2 * t2 * freqs[0],1.8  * t2 * t2 * freqs[1], t2* freqs[0], t2);

	//Third Layer
	vec3 p3 = vec3(uvs / (4.+sin(iTime*0.11)*0.2+0.2+sin(iTime*0.15)*0.3+0.4), 1.5) + vec3(2., -1.3, -1.);
	p3 += 0.25 * vec3(sin(iTime / 16.), sin(iTime / 12.),  sin(iTime / 128.));
	float t3 = field3(p3,freqs[2]);
	vec4 c3 = mix(.4, 1., v) * vec4(1.3 * t3 * t3 * t3 * freqs[2],1.8  * t3 * t3*freqs[3] ,t3* freqs[0], t2);


	//Let's add some stars
	//Thanks to http://glsl.heroku.com/e#6904.0
	vec2 seed = p.xy * 2.0;
	seed = floor(seed * iResolution.x);
	vec3 rnd = nrand3( seed );
	vec4 starcolor = vec4(pow(rnd.y,40.0));

	//Second Layer
	vec2 seed2 = p2.xy * 2.0;
	seed2 = floor(seed2 * iResolution.x);
	vec3 rnd2 = nrand3( seed2 );
	starcolor += vec4(pow(rnd2.y,40.0));


	//Third Layer
	vec2 seed3 = p3.xy * 2.0;
	seed3 = floor(seed3 * iResolution.x);
	vec3 rnd3 = nrand3( seed3 );
	//starcolor += vec4(pow(rnd3.y,40.0));

	//gl_FragColor = mix(freqs[3]-.3, 1., v) * vec4(1.5*freqs[2] * t * t* t , 1.2*freqs[1] * t * t, freqs[3]*t, 1.0)+c2+starcolor+c3;
	gl_FragColor = mix(freqs[3]-.3, 1., v*(1.25+sin(iAmplifiedTime)*freqs[3])) * vec4(1.5*freqs[2] * t * t* t , 1.2*freqs[1] * t * t, freqs[3]*t, 1.0)+c2+c3+starcolor;
}