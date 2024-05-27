// https://www.shadertoy.com/view/4dSyDm
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
#define saturate2(x) clamp(x, 0., 1.)

// width of the blur when rendering SDFs
float _blur = .01;

// distortion matrix for FBM function
const mat2 mat = mat2(.8, -.6, .6, .8);

// simple 2D hash
float hash(vec2 uv) {
    return fract(sin(dot(uv, vec2(.009123898, .00231233))) * 1e5);
}

// 2D noise (lerp between grid point noise values
float noise(vec2 uv) {
    vec2 fuv = floor(uv);
    vec4 cell = vec4(
        hash(fuv + vec2(0, 0)),
        hash(fuv + vec2(0, 1)),
        hash(fuv + vec2(1, 0)),
        hash(fuv + vec2(1, 1))
    );
    vec2 axis = mix(cell.xz, cell.yw, fract(uv.y));
    return mix(axis.x, axis.y, fract(uv.x));
}

// 2D fractional Brownian motion
float fbm(vec2 uv) {
    float f = 0.;
    float r = 1.;
    for (int i = 0; i < 4; ++i) {
        uv *= mat;
        f += noise((uv += 10.) * r) / (r *= 2.);
    }
    return f / (1. - 1. / r);
}

// function that tries going up and down with a tangent of 1,
// but the gaps and the bumps grow exponentially
float logSaw(float x) {
    return (abs(fract(log(x + 1.) * 4.) - .5) - .25) * (x + 1.) / 4.;
}

// rectangle distance function (used for the nose
float sdRect(vec2 p, vec2 r) {
    p = abs(p) - r;
	return min(max(p.x, p.y), 0.) + length(max(p, 0.));
}

// render an array of shaking distorted concentric circles
float shakyCircles(vec2 uv, float offset, float time) {
    float l = length(uv);
    uv += (vec2(fbm(vec2(uv.x * .5, time)), fbm(vec2(uv.y * .5, time + 10.))) - .5) * 1. * (.05 + l);
    l = length(uv);
    float d = abs(logSaw(l + offset * l));
    d += (l - .75) * .15;

    return smoothstep(_blur, -_blur, d);
}

// layer shaky circles on top of each other
float hole(vec2 uv, float time) {
    float f = 0.;
    for (float i = .0; i <= .5; i += .25) {
    	f += shakyCircles(uv, i, time * 2. + i * 55.) / 3.;
    }
    return saturate2(1.- f);
}

// same as above, only this time we use rounded rectangles, and only render the bottom half
float shakyHalfCircles(vec2 uv, float offset, float time) {
    float l = sdRect(uv, vec2(.05, .3));
    uv += (vec2(fbm(vec2(uv.x * .5, time)), fbm(vec2(uv.y * .5, time + 10.))) - .5) * 1. * (.05 + l);
    l = sdRect(uv, vec2(.05, .3));
    float d = abs(logSaw(l + offset * l));
    d += ((abs(l - .3) - .3) + smoothstep(-.6, 2., uv.y)) * .15;

    return smoothstep(_blur, -_blur, d);
}

// render a nose, just like a hole, but layering t
float nose(vec2 uv, float time) {
    float f = 0.;
    for (float i = .0; i <= .5; i += .25) {
    	f += shakyHalfCircles(uv, i, time * 2. + i * 55.) / 3.;
    }
    return saturate2(1.- f);
}

// render a circle with radius r
float circle(vec2 uv, float r) {
    float d = length(uv) - r;
    return smoothstep(_blur, -_blur, d);
}

void main()
{
	//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
    vec2 uv = vUv * 2. - 1.;
    uv.x *= iResolution.x / iResolution.y;
    uv *= 2.3;

    // get some frequencies from the fft
    float speed = texture(iAudioData, vec2(.1, .25)).x * .1;
    float bgspeed = texture(iAudioData, vec2(.3, .25)).x;
    float mouthSize = texture(iAudioData, vec2(.7, .25)).x;

    // add a distortion (blur + zoom)
    // that comes in waves and reacts to high frequencies
    float s = sin(uv.y * .8 + uv.x * .4 + iAmplifiedTime * 2.);
    s = texture(iAudioData, vec2(.8, .25)).x * saturate2(4. - length(uv)) * s * s * s * s;
    _blur = .01 + .1 * s;
    uv /= 1. + s * .1;

    vec3 color = vec3(0);
    float f = 1.;

    float time = iAmplifiedTime;

    // uv for head shape/stars/pupils
    vec2 puv = uv + (vec2(fbm(vec2(uv.x * 2., time)), fbm(vec2(uv.y * 2., time + 10.))) - .5) * .1;

    // shade on head
    f += hole(uv / 3. + vec2(0, .1), time * .1 + bgspeed) * .6;
    f -= hole(uv * 1.5 + vec2(0, .3), time * .1 + bgspeed) * .4;
    // head
    f *= circle(puv, 2.);
    // shade behind
    f  = max(f,.25- hole(uv / 4. + vec2(0, .1), time * .01) * .25);
    // mouth
    vec2 muv = (uv + vec2(0, 1.2)) * vec2(1.2 - mouthSize * .2, 1.2 - mouthSize * .8);
    f *= hole(muv, time * (1. + speed * 2.));
    // nose
    f *= nose(uv + vec2(0, -.1), iAmplifiedTime * (1. + speed * 2.));
    // eyes
    f *= hole(uv - vec2(-.9, .2), iAmplifiedTime * (1. + speed * 5.)) * hole(uv - vec2(.9, .2), iAmplifiedTime * (1. + speed * 5.) + 3.);
    // pupils
    f += circle(puv - vec2(-.9, .2), .18) + circle(uv - vec2(.9, .2), .15);

    // render some stars with hard coded dimensions
    f += circle(puv - vec2(-3., 1.4), .1) + circle(puv - vec2(3, 1), .13)
       + circle(puv - vec2(2.5, -1), .05) + circle(puv - vec2(-3.6, -1.5), .05)
       + circle(puv - vec2(3.6, -1.7), .06) + circle(puv - vec2(-2.2, .2), .05)
       + circle(puv - vec2(3.4, 1.7), .07) + circle(puv - vec2(-2.2, -1.6), .1);

    // add some noise
    f = saturate2(f * .8 + (fbm(uv * 4.) - .5) * .2);
    color = mix(vec3(.08, .1, .06), vec3(.95, .85, .75), f);

	gl_FragColor = vec4(color,1.0);
}