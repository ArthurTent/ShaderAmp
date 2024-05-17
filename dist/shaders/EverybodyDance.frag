// https://www.shadertoy.com/view/XsySDW
// Modified by ArthurTent
// Created by s23b
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
#define PI 3.14159265359
#define SPHERES 6
#define REFLECTIONS 2

#define saturate2(x) clamp(x, 0., 1.)
#define rot(x) mat2(cos(x), -sin(x), sin(x), cos(x))

float fft[SPHERES];

vec3 hsv2rgb (in vec3 hsv) {
    return hsv.z * (1.0 + 0.5 * hsv.y * (cos (2.0 * PI * (hsv.x + vec3 (0.0, 0.6667, 0.3333))) - 1.0));
}

float sphere(vec3 p, vec3 o) {
    return length(p - o) - 1.;
}

float plane(vec3 p) {
    return p.y + .25;
}

// distance function
float map(vec3 p) {
    float d = plane(p);
    for (int i = 0; i < SPHERES; ++i) {
        float a = PI * 2. * float(i) / float(SPHERES);
        d = min(d, sphere(p, 5. * vec3(sin(a), fft[i] + .25, cos(a))));
    }
    return d;
}

// raymarching function
float trace(vec3 o, vec3 r, int steps) {

    float t = 0.;

    for (int i = 0; i < 100; ++i) {
        float d = map(o + r * t);
        t += d;
        if (d < .01 || i > steps) break;
    }

    return t;
}

// rendering function: o - ray origin, r - ray vector, dist - distance traveled, steps - raymarching iterations
vec3 render(inout vec3 o, inout vec3 r, inout float dist, in int steps) {

    // march to first object
    float f = trace(o, r, steps);

    // get intersection point
    vec3 p = o + f * r;

    // get normal vector
    vec2 eps = vec2(0, .0001);
    vec3 normal = normalize(vec3(
    	map(p + eps.yxx) - map(p - eps.yxx),
    	map(p + eps.xyx) - map(p - eps.xyx),
    	map(p + eps.xxy) - map(p - eps.xxy)
	));

    // light source
    vec3 light = vec3(0, 3, 2);
    light = normalize(light - p);

    // reflection point
    vec3 ref = reflect(r,normal);

    vec3 color = vec3(0);

    // add ambient light (hue from angle)
    if (p.y > .0) {
        // color the balls
    	color += hsv2rgb(vec3(atan(p.x, p.z)/ PI / 2., 1, .1));
    } else {
        // create patter for the floor
        color += saturate2(sin(p.x) * sin(p.z) * 50. + sin(iAmplifiedTime) * 10. + .5);
    }

    // add diffuse light
    color += vec3(dot(normal, light));

    // add specular light
    color += saturate2(vec3(pow(saturate(dot(light, ref)), 15.)) / 2.);

    // new origin becomes the point hit
    o = p;

    // new ray vector becomes the reflection vector
    r = normalize(ref);

    // go a bit further on the ray, so we don't hit the same surface
    o += r * .1;

    // add marched distance to distance traveled
    f = max(0., f);
    dist += f;

    // return divided by the fog
    return saturate2(color / (1. + dist * dist * .01));
}

void main()
{
    // transform viewport coordinates
	//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
    vec2 uv = vUv * 2. - 1.;
    uv.x *= iResolution.x / iResolution.y;

    // store the fft data so we don't bother texture with every distance calculation
    for (int i = 0; i < SPHERES; ++i) {
        fft[i] = texture(iAudioData, vec2(float(i) / float(SPHERES), .25)).x;
    }

    // ray from screen coordinates
    vec3 r = normalize(vec3(uv, 3.));

    // eye for origin
    vec3 o = vec3(0, 2, -13);

    // transform mouse coordinates
    vec2 mouse = iMouse.xy / iResolution.xy * 2. - 1.;
    if (iMouse.x == 0. && iMouse.y == 0.) mouse = vec2(0);

    mouse *= 2. * PI;

    // rotate camera around the center
    float a = clamp(-mouse.y + .4, PI / 20., PI / 20. * 16.);
    o.yz *= rot(a);
    r.yz *= rot(a);
    a = -mouse.x + iAmplifiedTime * .5;
    o.xz *= rot(a);
    r.xz *= rot(a);

    float f = 0.;
    int steps = 50;

    // render scene
    vec3 c = render(o, r, f, steps);

    // render reflections
    for (int i = 0; i < REFLECTIONS; ++i) {
        steps /= 2;
    	c += c * render(o, r, f, steps);
    }

	gl_FragColor = vec4(c, 1.0);
}