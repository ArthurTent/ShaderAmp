// https://www.shadertoy.com/view/MsVSWK
// Modified by ArthurTent
// Created by Nimajamin
// License: MIT
// https://opensource.org/license/mit
// -------------------------------------------------------------
//
// "Ictalurus Forest" by Nimajamin 24 June 2016
//
// -------------------------------------------------------------
//
// 3 Pass re-implementation of Star Nest by Pablo RomÃ¡n Andrioli
//
// Originally implemented by Shadertoy member: Kali
//
// - https://www.shadertoy.com/view/XlfGRj
//
// This content is under the MIT License.
//
// -------------------------------------------------------------
//
// Noise fix implemented by: huwb
//
// - https://www.shadertoy.com/view/XllGzN
//
// -------------------------------------------------------------
//
// Audio visualisation sampling code by: chronos
//
// - https://www.shadertoy.com/view/lsdGR8
//
// -------------------------------------------------------------
//
// Soundtrack - "Ictalurus Forest" Nimajamin 2016 [ ngc4244 ]
//
// -------------------------------------------------------------
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// 1st Pass - Nebula..

#define iterations1 27
#define formuparam1 0.45

#define volsteps1 20
#define stepsize1 0.1

#define zoom1   0.800
#define tile1   0.850
#define speed1  0.0003330

#define brightness1 0.0015
#define darkmatter1 0.9300
#define distfading1 0.730
#define saturation1 0.850

#define kContrast1 1.0
#define kBrightness1 -0.2
#define kSaturation1 0.70

// 2nd Pass - Large Stars..

#define iterations2 7
#define formuparam2 0.33

#define volsteps2 20
#define stepsize2 0.1

#define zoom2   0.400
#define tile2   0.850
#define speed2  0.010

#define brightness2 0.0015
#define darkmatter2 0.300
#define distfading2 0.730
#define saturation2 0.850

#define kContrast2 1.0
#define kBrightness2 0.0
#define kSaturation2 0.0

// 3rd Pass - Black Holes..

#define iterations3 7
#define formuparam3 0.83

#define volsteps3 20
#define stepsize3 0.1

#define zoom3   0.800
#define tile3   0.850
#define speed3  0.010

#define brightness3 0.0015
#define darkmatter3 0.300
#define distfading3 0.730
#define saturation3 0.850

#define kContrast3 1.0
#define kBrightness3 0.0
#define kSaturation3 0.0

// RGB Eye response..

const vec3 deSatConst = vec3( 0.299, 0.587, 0.114 );

// Audio sampling helper..

float audio_freq( in sampler2D channel, in float f) { return texture( channel, vec2(f, 0.25) ).x; }
float audio_ampl( in sampler2D channel, in float t) { return texture( channel, vec2(t, 0.75) ).x; }

// Returns 3 B-spline functions of degree 2..

vec3 B2_spline(vec3 x)
{
    vec3 t = 3.0 * x;
    vec3 b0 = step(0.0, t)     * step(0.0, 1.0-t);
	vec3 b1 = step(0.0, t-1.0) * step(0.0, 2.0-t);
	vec3 b2 = step(0.0, t-2.0) * step(0.0, 3.0-t);
	return 0.5 * (
    	b0 * pow(t, vec3(2.0)) +
    	b1 * (-2.0*pow(t, vec3(2.0)) + 6.0*t - 3.0) +
    	b2 * pow(3.0-t,vec3(2.0))
    );
}

//

void main()
{
    //
	// Get coords and direction..
    //
	//vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv; //-1. + 2. * vUv;
	float time = iGlobalTime * speed1 + 0.25;

    vec2 centered = 2.0 * uv - 1.0;
    centered.x *= iResolution.x / iResolution.y;

    float dist2 = dot(centered, centered);
    float clamped_dist = smoothstep(0.0, 1.0, dist2);
    float arclength    = abs(atan(centered.y, centered.x) / radians(360.0))+0.01;

    //
    // Audio visualisation..
    //
	// - Modified version of the Soundcloud example by: chronos
	// - https://www.shadertoy.com/view/lsdGR8
    //
    float t = iGlobalTime / 100.0;
    float polychrome = (1.0 + sin(t*10.0))/2.0; // 0 -> uniform color, 1 -> full spectrum
    vec3 spline_args = fract(vec3(polychrome*uv.x-t) + vec3(0.0, -1.0/3.0, -2.0/3.0));
    vec3 spline = B2_spline(spline_args);

    float f = abs(centered.y);
    vec3 base_color  = vec3(1.0, 1.0, 1.0) - f*spline;
    vec3 flame_color = pow(base_color, vec3(3.0));
    vec3 disc_color  = 0.20 * base_color;
    vec3 wave_color  = 0.10 * base_color;
    vec3 flash_color = 0.05 * base_color;

    vec2 fft = uv.xy;
    fft -= 0.5;
    fft *= 1.75;
    fft.x *= iResolution.x / iResolution.y;
    float sample1 = audio_freq(iAudioData, abs(2.0 * sqrt(dot(fft,fft)) - 1.0) + 0.01);

    float sample2 = audio_ampl(iAudioData, clamped_dist);
    float sample3 = audio_ampl(iAudioData, arclength);

    float disp_dist = smoothstep(-0.2, -0.1, sample3-dist2);
    disp_dist *= (1.0 - disp_dist);

    vec3 color = vec3(0.0);

    // Spline debug..
//  vec3 s = smoothstep(-0.01, 0.01, spline-uv.y); color += (1.0-s) * s;

    float v = abs(uv.y - 0.5);
    vec3 flame = flame_color * smoothstep(v, v*8.0, sample1);
    color += flame;
    color += disc_color  * smoothstep(0.5, 1.0, sample2) * (1.0 - clamped_dist);
    color += flash_color * smoothstep(0.5, 1.0, sample3) * clamped_dist;
    color += wave_color  * disp_dist;
    color = pow(color, vec3(0.4545));
	vec3 sonicColor = color;

    //
    // Fix aspect for volumetric passes..
    //
    uv.x *= iResolution.x / iResolution.y;
	vec3 dir = vec3( uv * zoom1, 1.0 );

    //
	// Mouse rotation..
    //
	float a1 = 0.15 + iMouse.x / iResolution.x * 2.0;
	float a2 = 0.8 + iMouse.y / iResolution.y * 2.0;
	mat2 rot1 = mat2( cos(a1), sin(a1), -sin(a1), cos(a1));
	mat2 rot2 = mat2( cos(a2), sin(a2), -sin(a2), cos(a2));
	dir.xz *= rot1;
	dir.xy *= rot2;
	vec3 from = vec3( 1.0, 0.5, 0.5 );

    //
    // ! !! !!! - Time Warp the camera position using the audio freuency data..! :))
    //
    //time += sample1 * 0.001; // we already do that outside of "ze" shader

	from += vec3( time * -200.0, time * 8.0, time * 0.0) * 0.1;
	from.xz*=rot1;
	from.xy*=rot2;

    //
	// Volumetric rendering 2nd pass - Larger Stars..
	//
	float s2 = 0.1;
	float fade2 = 1.0;
	vec3 v2 = vec3(0.0);
	for ( int r = 0; r < volsteps2; r++ )
    {
		vec3 p = from + s2 * dir * 0.5;
		p = abs( vec3( tile2 ) - mod( p, vec3( tile2 * 2.0 ) ) ); // tiling fold
		float pa = 0.0;
		float a = 0.0;

		for (int i=0; i<iterations2; i++)
        {
			p=abs(p)/dot(p,p)-formuparam2; 	// the magic formula
			a+=abs(length(p)-pa); 			// absolute sum of average change
			pa=length(p);
		}

        float dm = max(0.0,darkmatter2-a*a*0.001); 	// dark matter
		a*= a * a; 									// add contrast
		if (r>6) fade2 *= 1.0 - dm; 				// dark matter, don't render near
        v2 += fade2;
		v2 += vec3( s2, s2*s2, s2*s2*s2*s2 ) * a * brightness2 * fade2; // colouring based on distance
        fade2 *= distfading2; 						// distance fading
        s2 += stepsize2;
	}

    v2 = mix(vec3(length(v2)),v2,saturation2) * 0.01; // colour adjust

    float deSat2 = dot( v2.xyz, deSatConst );
   	vec3 saturateRGB2 = mix( vec3( deSat2, deSat2, deSat2 ), v2.xyz, kSaturation2 );
    vec3 brightnessRGB2 = clamp( saturateRGB2 + kBrightness2, 0.0, 1.0 );
    vec3 contrastRGB2 = clamp( pow( brightnessRGB2 * 2.0, vec3( kContrast2, kContrast2, kContrast2 ) ) * 0.5, 0.0, 1.0 );

    //
	// Volumetric rendering 3rd pass (first) - Black Holes..
	//
	float s3 = 0.1;
	float fade3 = 1.0;
	vec3 v3 = vec3(0.0);
	for ( int r = 0; r < volsteps3; r++ )
    {
		vec3 p = from + s3 * dir * 0.5;
		p = abs( vec3( tile3 ) - mod( p, vec3( tile3 * 2.0 ) ) ); // tiling fold
		float pa = 0.0;
		float a = 0.0;

		for (int i=0; i<iterations3; i++)
        {
			p=abs(p)/dot(p,p)-formuparam3; 	// the magic formula
			a+=abs(length(p)-pa); 			// absolute sum of average change
			pa=length(p);
		}

        float dm = max(0.0,darkmatter3-a*a*0.001); 	// dark matter
		a*= a * a; 									// add contrast
		if (r>6) fade3 *= 1.0 - dm; 				// dark matter, don't render near
        v3 += fade3;
		v3 += vec3( s3, s3*s3, s3*s3*s3*s3 ) * a * brightness3 * fade3; // colouring based on distance
        fade3 *= distfading3; 						// distance fading
        s3 += stepsize3;
	}

    // ! !! !!! - Time Warp the camera position using the audio freuency data..! :))
    //
    //time += sample1 * 0.0005; // we already do that outside of "ze" shader
    time += pow( length(v3) * 0.005, 0.001 );

    from = vec3( 1.0, 0.5, 0.5 );
    from += vec3( time * -200.0, time * 8.0, time * 0.0) * 0.1;
	from.xz*=rot1;
	from.xy*=rot2;

    //
	// Volumetric rendering 1st pass - Deep In The Galactic Nebula..
	//
	float s1 = 0.1;
	float fade1 = 1.0;
	vec3 v1 = vec3(0.0);
	for ( int r = 0; r < volsteps1; r++ )
    {
		vec3 p = from + s1 * dir * 0.5;
		p = abs( vec3( tile1 ) - mod( p, vec3( tile1 * 2.0 ) ) ); // tiling fold
		float pa = 0.0;
		float a = 0.0;

		for (int i=0; i<iterations1; i++)
        {
            p=abs(p)/dot(p,p)-formuparam1; 	// the magic formula
            float D = abs(length(p)-pa); 	// absolute sum of average change
            a += i > 10 ? min( 12., D) : D;	// INTEGER NOISE LIMTER (large num = more noise)
			pa=length(p);
		}

        float dm = max(0.,darkmatter1-a*a*0.001); 	// dark matter
		a*= a * a; 									// add contrast
		if (r>6) fade1 *= 1.0 - dm; 				// dark matter, don't render near
        v1 += fade1;
		v1 += vec3( s1, s1*s1, s1*s1*s1*s1 ) * a * brightness1 * fade1; // colouring based on distance
        fade1 *= distfading1; 						// distance fading
        s1 += stepsize1;
	}

    v1 = mix(vec3(length(v1)),v1,saturation1) * 0.01; // colour adjust

    float deSat1 = dot( v1.xyz, deSatConst );
   	vec3 saturateRGB1 = mix( vec3( deSat1, deSat1, deSat1 ), v1.xyz, kSaturation1 );
    vec3 brightnessRGB1 = clamp( saturateRGB1 + kBrightness1, 0.0, 1.0 );
    vec3 contrastRGB1 = clamp( pow( brightnessRGB1 * 2.0, vec3( kContrast1, kContrast1, kContrast1 ) ) * 0.5, 0.0, 1.0 );

	//vec3 v3 = vec3(0.0);

    //
    // Brightness, Contrst & Saturation..
    //
    float deSat3 = dot( v3.xyz, deSatConst );
   	vec3 saturateRGB3 = mix( vec3( deSat3, deSat3, deSat3 ), v3.xyz, kSaturation3 );
    vec3 brightnessRGB3 = clamp( saturateRGB3 + kBrightness3, 0.0, 1.0 );
    vec3 contrastRGB3 = clamp( pow( brightnessRGB3 * 2.0, vec3( kContrast3, kContrast3, kContrast3 ) ) * 0.5, 0.0, 1.0 );

    //
    // Final combine..
    //
	gl_FragColor  = vec4((  saturateRGB1 * 0.333
                       + saturateRGB1 * 0.666
                       * saturateRGB2 * 1.900
                       - pow( length(v3) * 0.005, 3.0 ) * 0.000222
                     ) * (0.5 + (1.2 * sonicColor.xyz)) + sonicColor.xyz * 0.444, 1.0);
}
