#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iChannel1; // overlay texture
uniform sampler2D iChannel2; // overlay texture

varying vec2 vUv;
// Sirenian Dawn by nimitz (twitter: @stormoid)
// https://www.shadertoy.com/view/XsyGWV
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// Contact the author for other licensing options

/*
	See: https://en.wikipedia.org/wiki/Terra_Sirenum

	Things of interest in this shader:
		-A technique I call "relaxation marching", see march() function
		-A buffer based technique for anti-alisaing
		-Cheap and smooth procedural starfield
		-Non-constant fog from iq
		-Completely faked atmosphere :)
		-Terrain based on noise derivatives
*/

/*
	More about the antialiasing:
		The fragments with high enough iteration count/distance ratio 
		get blended with the past frame, I tried a few different 
		input for the blend trigger: distance delta, color delta, 
		normal delta, scene curvature.  But none of them provides 
		good enough info about the problem areas to allow for proper
		antialiasing without making the whole scene blurry.
		
		On the other hand iteration count (modulated by a power
		of distance) does a pretty good job without requiring to
		store past frame info in the alpha channel (which can then
		be used for something else, nothing in this case)

*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	fragColor = vec4(texture(iChannel0, fragCoord.xy/iResolution.xy).rgb, 1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
