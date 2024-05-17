// https://www.shadertoy.com/view/Msl3WH
// Modified by ArthurTent
// Created by Dave_Hoskins
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// 'Warp Speed' by David Hoskins 2013.
// I tried to find gaps and variation in the star cloud for a feeling of structure.
// Inspired by Kali: https://www.shadertoy.com/view/ltl3WS

varying vec2 vUv;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform sampler2D iAudioData; 
uniform sampler2D iVideo; 

float getLevel(float x) {
    return texelFetch(iAudioData, ivec2(int(x*512.), 0), 0).r;
}

void main()
{
    float time = (iAmplifiedTime+29.) * 60.0;
	
    float s = 0.0, v = 0.0;
    //vec2 uv = (-iResolution.xy + 2.0 * fragCoord ) / iResolution.y;
	vec2 uv = -1.0 + 2.0 *vUv;
	float t = time*0.005;
	uv.x += sin(t) * .3;
	float level =  0.;
	float si = sin(t*(1.5+getLevel(10.))); // ...Squiffy rotation matrix!
	float co = cos(t);
	uv *= mat2(co, si, -si, co);
	vec3 col = vec3(0.0);
	vec3 p = vec3(0.0);
	vec3 init = vec3(0.25, 0.25 + sin(time * 0.001) * .1, time * 0.0008);
	for (int r = 0; r < 100; r++) 
	{
		//p = init + s * vec3(uv, 0.143)+getLevel(float(r));
		p = init + s * vec3(uv, 0.143);

		level = getLevel(float(r))*10000.;
		/*
		level =  mod(float(r),10.);
		if( level >= 0. ){
			level = getLevel(float(r));
			p = init + s * vec3(uv, 0.143)*level*100.;
		}
		else{
			p = init + s * vec3(uv, 0.143);
		}
		*/
		
		p.z = mod(p.z, 2.0);
		for (int i=0; i < 10; i++)	p = abs(p * 2.04) / dot(p, p) - 0.75;
		//for (int i=0; i < 10; i++)	p = abs((getLevel(float(r))*p) * 2.04) / dot(p, p) - 0.75;
		v += length(p * p) * smoothstep(0.0, 0.5, 0.9 - s) * .002;
		// Get a purple and cyan effect by biasing the RGB in different ways...
		col +=  vec3(v * 0.8+level/10., 1.1 - s * 0.5+level/30., .7 + v * 0.5+level/4.) * v * 0.013;
		s += .01;
	}
	gl_FragColor = vec4(col, 1.0);
}
