// https://www.shadertoy.com/view/Wt2cWR
// Modified by ArthurTent
// Created by isaacchurchill
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

//#define XOR_COLORING

#define PI 3.14159265

vec3 palette(float f)
{
#ifdef XOR_COLORING
    return vec3(mod(f, 2.0));
#else
    f *= 0.09 * PI * 2.0;
    return clamp(
        vec3(sin(f + 2.0), sin(f + 1.0), sin(f + 0.0)),
        0.0, 1.0);
#endif
}

void main()
{
    vec2 fragCoord = vUv * iResolution;
    vec2 uv = fragCoord/iResolution.xy * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    float circle_radii = abs(texture(iAudioData, vec2(iTime,0.0)).x) * 0.7;
    const float ring_spread = 0.35;
	const float circle_spread = 0.2;

    int intersections = 0;
    float closest_dist = 999.9;

    const int num_rings = 4;
    const int circles_per_ring = 16;
    for (int j = 0; j < num_rings; j++) {
        float theta = (float(j) / float(num_rings)) * PI * 2.0;
        theta += iTime;
        vec2 ring_center = uv + vec2(sin(theta), cos(theta)) * ring_spread;

        for (int i = 0; i < circles_per_ring; i++) {
            float theta2 = (float(i) / float(circles_per_ring)) * PI * 2.0;
	        theta2 -= iTime * 0.2;
            vec2 circle_pos = ring_center + vec2(sin(theta2), cos(theta2)) * circle_spread;

            float dist = length(circle_pos) - circle_radii;
            closest_dist = min(abs(dist), closest_dist);
            if (dist < 0.0) {
				intersections++;
            }
        }
    }

    vec3 col = vec3(0.25);
    if (intersections > 2) {
	    col = palette(float(intersections + 2));
        col /= log(closest_dist * 120.0 + exp(0.8));
    } else {
        col /= log(closest_dist * 15.0 + exp(0.8));
        col.z += (sin(closest_dist * 130.0) + 1.0)
               * 0.07 / (closest_dist * 15.0 + 1.0);
    }
    col = clamp(col, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
}