// https://www.shadertoy.com/view/MdXSzS
// Modified by ArthurTent
// Created by Dave_Hoskins
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// https://www.shadertoy.com/view/MdXSzS
// The Big Bang - just a small explosion somewhere in a massive Galaxy of Universes.
// Outside of this there's a massive galaxy of 'Galaxy of Universes'... etc etc. :D

// To fake a perspective it takes advantage of the screen being wider than it is tall.

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

float sample_at(float f)
{
    return texture(iAudioData, vec2(f / 10.0, 0.25)).x;
}
float sm(float f)
{
    float delta = .1;
    return 0.2 * (sample_at(f - 2. * delta) + sample_at(f - delta) + sample_at(f) + sample_at(f + delta) + sample_at(f + 2. * delta));
	//return sample_at(1.) * (sample_at(f - 2. * delta) + sample_at(f - delta) + sample_at(f) + sample_at(f + delta) + sample_at(f + 2. * delta));
	return (sample_at(0.1)+0.1) * (sample_at(f - 2. * delta) + sample_at(f - delta) + sample_at(f) + sample_at(f + delta) + sample_at(f + 2. * delta));
}
void main()
{
	//vec2 uv = (fragCoord.xy / iResolution.xy) - .5;
	vec2 uv = vUv - .5;
    //uv *= smoothstep(1.7, .0, sample_at(5.))*2.5;
	uv *= 2.;
    float t = iAmplifiedTime * .1 + ((.25 + .05 * sin(iAmplifiedTime * .1))/(length(uv.xy) + .07)) * 2.2;
	float si = sin(t);
	float co = cos(t);
	mat2 ma = mat2(co, si, -si, co);

	float v1, v2, v3;
	v1 = v2 = v3 = 0.0;

	float s = 0.0;
    float sample_a = 0.0;
	for (int i = 0; i < 90; i++)
	{
		vec3 p = s * vec3(uv, 0.0);
		p.xy *= ma;
		p += vec3(.22, .3, s - 1.5 - sin(iAmplifiedTime * .13) * .1);


        sample_a =sample_at(s);
		for (int i = 0; i < 8; i++){
            p = abs(p) / dot(p,p) - 0.659;
            //p+=sample_at(s);
            //p+=sample_a;
		}
        v1 += dot(p,p) * .0015 * (1.8 + sin(length(uv.xy * 13.0) + .5  - iAmplifiedTime * .2));
		v2 += dot(p,p) * .0013 * (1.5 + sin(length(uv.xy * 14.5) + 1.2 - iAmplifiedTime * .3));
		v3 += length(p.xy*10.) * .0003;
		s  += .035;
	}

	float len = length(uv);
	v1 *= smoothstep(.7, .0, len);
	v2 *= smoothstep(.5, .0, len);
	v3 *= smoothstep(.9, .0, len);

	vec3 col = vec3( v3 * (1.5 + sin(iAmplifiedTime * .2) * .4*sample_at(0.51)),
					(v1 + v3) * .3*sample_at(0.1),
					 v2*sample_at(10.1)) + smoothstep(0.2, .0, len) * .85 + smoothstep(.0, .6, v3) * .3;


	gl_FragColor=vec4(min(pow(abs(col), vec3(1.2)), 1.0), 1.0);
	gl_FragColor*=sm(sin(iAmplifiedTime));
}