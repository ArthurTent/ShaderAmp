// https://www.shadertoy.com/view/ls3cWM
// Modified by ArthurTent
// Created by python273
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform vec2 iFrame;
varying vec2 vUv;

#define PI 3.1415926535897932384626433832795
#define half_PI 1.570796326794896619231321692

float max_dist_image = distance(vec2(0.0), vec2(0.5));
float max_dist_vr = distance(vec2(0.0), vec2(0.25));
float c0;

vec4 render(vec2 uv, float max_dist) {
    float dist = distance(uv, vec2(0.0, 0.0)) / max_dist;
    float a = (atan(uv.y, abs(uv.x)) + half_PI) / PI;

	c0 = texture(iAudioData, vec2(a, 0.25)).x;

    return vec4(1.0, 1.0 - dist, c0, 1.0) * (c0 / dist);
}


void main()
{
	//vec2 uv = (fragCoord - .5*iResolution.xy) / min(iResolution.x, iResolution.y);
    vec2 uv = -1.0 + 2.0 *vUv;  
    gl_FragColor = render(uv, max_dist_image);
}

/*
void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )
{
    vec2 uv = fragRayDir.xy / 2.0;
    fragColor = render(uv, max_dist_vr);
}
*/
