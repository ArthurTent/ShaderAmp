// https://www.shadertoy.com/view/X32SWc
// Modified by ArthurTent
// Created by s23b
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
#define SPEED .1
#define FOV 3.

#define MAX_STEPS 80
#define EPS .001
#define RENDER_DIST 5.
#define AO_SAMPLES 4.
#define AO_RANGE 100.

#define PI 3.14159265359
#define saturate2(x) clamp(x, 0., 1.)

// precomputed globals
float _house = 0.;
float _boat = 0.;
float _spaceship = 0.;
float _atmosphere = 0.;
mat3 _kifsRot = mat3(1, 0, 0, 0, 1, 0, 0, 0, 1);
float _kifsOffset = 0.;

// rotate 2d space with given angle
void tRotate(inout vec2 p, float angel) {
    float s = sin(angel), c = cos(angel);
	p *= mat2(c, -s, s, c);
}

// divide 2d space into s chunks around the center
void tFan(inout vec2 p, float s) {
    float k = s / PI / 2.;
    tRotate(p, -floor((atan(p.y, p.x)) * k + .5) / k);
}

// rectangle distance
float sdRect(vec2 p, vec2 r) {
    p = abs(p) - r;
	return min(max(p.x, p.y), 0.) + length(max(p, 0.));
}

// box distance
float sdBox(vec3 p, vec3 r) {
    p = abs(p) - r;
	return min(max(p.x, max(p.y, p.z)), 0.) + length(max(p, 0.));
}

// sphere distance
float sdSphere(vec3 p, float r) {
	return length(p) - r;
}

// 3d cross distance
float sdCross(vec3 p, vec3 r) {
    p =abs(p) - r;
    p.xy = p.x < p.y ? p.xy : p.yx;
    p.yz = p.y < p.z ? p.yz : p.zy;
    p.xy = p.x < p.y ? p.xy : p.yx;
    return length(min(p.yz, 0.)) - max(p.y, 0.);
}

// union
float opU(float a, float b) {
    return min(a, b);
}

// intersection
float opI(float a, float b) {
    return max(a, b);
}

// substraction
float opS(float a, float b) {
    return max(a, -b);
}

// smooth union
float opSU(float a, float b, float k)
{
    float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
    return mix(b, a, h) - k * h * (1. - h);
}

// house distance
float sdHouse(vec3 p) {
    p.y += .075;
    vec3 boxDim = vec3(.2, .15, .2);

    // add the walls
    float d = sdBox(p, boxDim);

    // add the windows
    vec3 q = abs(p);
    vec3 windSize = vec3(.04, .04, .06);
    q -= windSize + vec3(.005);
    d = opI(d, opU(sdCross(q, windSize), .11 - abs(p.y)));

    // add the roof
    q = p;
    q.y -= .38;
    tFan(q.xz, 4.);
    tRotate(q.xy, PI/4.);
    d = opU(d, sdBox(q, vec3(.35, .01, .35)));

    // make it hollow
    d = opS(d, sdBox(p, boxDim - vec3(.02)));
    return d;
}

// boat distance
float sdBoat(vec3 p) {

    // add the mast (a word I learned today :P)
    float d = sdBox(p + vec3(0, .05, 0), vec3(.01, .2, .01));

    // add the sail
    vec3 q = p + vec3(0, -.05, .12);
    float a = sdSphere(q, .2);
	a = opS(a, sdSphere(q, .195));
    q.x = abs(q.x);
    tRotate(q.yx, .1);
    a = opI(a, sdBox(q - vec3(0, 0, .1), vec3(.1)));
    d = opU(d, a);

    // add the body of the boat
    p.x = abs(p.x);
    p.x += .1;
    a = sdSphere(p, .3);
    a = opS(a, sdSphere(p, .29));
    a = opI(a, p.y + .15);
    d = opU(d,a);
    return d;
}

// spaceship distance
float sdSpaceship(vec3 p) {
    tFan(p.xz, 6.);
    p.x += .3;

    // add the cap
    float d = sdSphere(p, .4);
    d = opS(d, p.y - .12);

    // add the body
    d = opU(d, sdSphere(p, .39));

    // add the fins (another word I learned, thanks google :P)
    d = opU(d, opI(sdSphere(p + vec3(0, .24, 0), .41), sdRect(p.zx, vec2(.005, .5))));
    d = opS(d, sdSphere(p + vec3(0, .3, 0), .37));
    d = opS(d, p.y + .25);
    return d;
}

// atmosphere distance
float sdAtmosphere(vec3 p) {
    float time = iTime;
    tRotate(p.yz, time);
    vec3 q = p;
    tFan(q.xz, 12.);
    float d = sdBox(q - vec3(.3, 0, 0), vec3(.01));
    tRotate(p.yx, time);
    q = p;
    tFan(q.yz, 12.);
    d = opU(d, sdBox(q - vec3(0, .23, 0), vec3(.01)));
    tRotate(p.xz, time);
    q = p;
    tFan(q.yx, 12.);
    d = opU(d, sdBox(q - vec3(0, .16, 0), vec3(.01)));

    return d;
}

// distance estimation of everything together
float map(vec3 p) {
    float d = _house <= 0. ? 5. : sdHouse(p) + .1  - _house * .1;
    if (_boat > 0.) d = opU(d, sdBoat(p) + .1  - _boat * .1);
    if (_spaceship > 0.) d = opU(d, sdSpaceship(p) + .1  - _spaceship * .1);
    if (_atmosphere > 0.) d = opU(d, sdAtmosphere(p) + .1 - _atmosphere * .1);

    //return d;
    float s = 1.;
    for (int i = 0; i < 4; ++i) {
        tFan(p.xz, 10.);
        p = abs(p);
        p -= _kifsOffset;

        p *= _kifsRot;
        s *= 2.;
    }

    return opSU(d, sdBox(p * s, vec3(s / 17.)) / s, .1);
}

// trace the scene from ro (origin) to rd (direction, normalized)
// until hit or reached maxDist, outputs distance traveled, the number of steps
// and the closest distance achieved during marching (used of cheap edge detection)
float trace(vec3 ro, vec3 rd, float maxDist, out float steps, out float nt) {
    float total = 0.;
    steps = 0.;
    nt = 100.;

    for (int i = 0; i < MAX_STEPS; ++i) {
        ++steps;
        float d = map(ro + rd * total);
        nt = min(d, nt);
        total += d;
        if (d < EPS || maxDist < total) break;
    }

    return total;
}

// calculate the normal vector
vec3 getNormal(vec3 p) {
    vec2 e = vec2(.0001, 0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
	));
}

// ambient occlusion
float calculateAO(vec3 p, vec3 n) {

    float r = 0., w = 1., d;

    for (float i = 1.; i <= AO_SAMPLES; i++){
        d = i / AO_SAMPLES / AO_RANGE;
        r += w * (d - map(p + n * d));
        w *= .5;
    }

    return 1.-saturate2(r * AO_RANGE);
}

// a lovely function that goes up and down periodically between 0 and 1, pausing at the extremes
float pausingWave(float x, float a, float b) { //    ___          ___          ___
    x = abs(fract(x) - .5) * 1. - .5 + a;      //   /   \        /   \        /   \
    //return 0.01;
    return smoothstep(0., a - b, x)+0.01;
}											   // basically like this :P

void main() {
    // transform screen coordinates
	//vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv;
    uv = uv * 2. - 1.;
    uv.x *= iResolution.x / iResolution.y;

    // transform mouse coordinates
	vec2 mouse = iMouse.xy / iResolution.xy * 2. - 1.;
    mouse.x *= iResolution.x / iResolution.y;
    mouse *= 2.;

    // set time dependent constants
    float speed = .25 / 10.5;
    float time = mod(iTime, 290.);
    time -= 10.5;
    if (time > 167.) time -= 167.; else
    if (time > 63.) time -= 63.;
    time -= 5.25;
	time *= speed;

    // these determine which object to show
    _house = pausingWave(time, .15, .125);
    _boat = pausingWave(time - .125 / .1, .15, .125);
    _spaceship = pausingWave(time - .25 / .1, .15, .125);
    _atmosphere = pausingWave(time - .375 / .1, .15, .125) * step(10., iTime);

    // set up kifs rotation matrix
    //float a = -texture(iAudioData, vec2(.5, .25)).x + sin(iTime) * .2 + .9;
    float a = -texture(iAudioData, vec2(.5, .25)).x + sin(iTime) * .2 + .9;
    float s = sin(a), c = cos(a);
    _kifsRot *= mat3(c, -s, 0, s, c, 0, 0, 0, 1);
    _kifsRot *= mat3(1, 0, 0, 0, c, -s, 0, s, c);
    _kifsRot *= mat3(c, 0, s, 0, 1, 0, -s, 0, c);

    // set up kifs offset
    _kifsOffset = .07 + texture(iAudioData, vec2(.1, .25)).x * .06;

    // set up camera position
    vec3 rd =  normalize(vec3(uv, FOV));
    vec3 ro = vec3(0, 0, -2);

    // light is relative to the camera
    vec3 light = vec3(-1., .5, 0);

    vec2 rot = vec2(0);
    //if (iMouse.z > 0. && iMouse.x > 0. && iMouse.y > 0.) {
    	// rotate the scene using the mouse
    //    rot = -mouse;
    //} else {
        // otherwise rotate constantly as time passes
        rot = vec2(
            iAmplifiedTime * SPEED * PI,//had to slightly modify \/ this value due to an issue reported by Fabrice
            mix(sin(iAmplifiedTime * SPEED) * PI / 8., PI / 2. - 1e-5, saturate2(exp(-iAmplifiedTime + 10.5))));
    //}

    tRotate(rd.yz, rot.y);
    tRotate(rd.xz, rot.x);
    tRotate(light.xz, rot.x);
    tRotate(ro.yz, rot.y);
    tRotate(ro.xz, rot.x);

    // march
    float steps, outline, dist = trace(ro, rd, RENDER_DIST, steps, outline);

    // calculate hit point coordinates
    vec3 p = ro + rd * dist;

    // calculate normal
    vec3 normal = getNormal(p);

    // light direction
    vec3 l = normalize(light - p);

    // ambient light
    float ambient = .1;

    // diffuse light
    float diffuse = max(0., dot(l, normal));

    // specular light
    float specular = pow(max(0., dot(reflect(-l, normal), -rd)), 4.);

    // "ambient occlusion"
    float ao = calculateAO(p, normal);

    // create the background grid
    //vec2 gridUv = fragCoord.xy - iResolution.xy / 2.;
    //vec2 gridUv = uv;
    //float grid = dot(step(mod(gridUv.xyxy, vec4(20, 20, 100, 100)), vec4(1)), vec4(.1, .1, .2, .2));

    // create blue background
    //vec3 bg = vec3(0, .1, .3) * saturate2(1.5 - length(uv) * .5);
    vec3 bg = vec3(0, .0, .0) * saturate2(1.5 - length(uv) * .5);

    // find the edges in the geometry
    float edgeWidth = .0015;
    float edge = smoothstep(1., .0, dot(normal, getNormal(p - normal * edgeWidth))) * step(length(p), 1.);

    // get the outline of the shapes
    outline = smoothstep(.005, .0, outline) * step(1., length(p));

    // diagonal strokes used for shading
    vec2 strokes = sin(vec2(uv.x + uv.y, uv.x - uv.y) * iResolution.y * PI / 4.) * .5 - .5;

    // first part of the shading: ao + marching steps
    float highlights = (steps / float(MAX_STEPS) + sqrt(1. - ao)) * step(length(p), 1.) * .5;
    highlights = floor(highlights * 5.) / 10.;

    // second part of the shading: ambient + diffuse + specular light
    float fog = saturate2(length(ro) - dist * dist * .25);
    float lightValue = (ambient + diffuse + specular) * fog;
    lightValue = floor(lightValue * 5.) / 10.;

    /*
    gl_FragColor.rgb = mix(bg, vec3(1., .9, .7),
                        max(max(max(saturate2(highlights + strokes.x), saturate2(lightValue + strokes.y)) * fog,
                                (edge + outline) * 2. + strokes.y), grid));
    */
    gl_FragColor.rgb = mix(bg, vec3(1., .9, .7),
                        max(max(saturate2(highlights + strokes.x), saturate2(lightValue + strokes.y)) * fog,
                                (edge + outline) * 2. + strokes.y));


    // gamma correction
    gl_FragColor = pow(saturate2(gl_FragColor), vec4(1. / 2.2)) * step(abs(uv.y), 1.);
}