// https://www.shadertoy.com/view/MdtXDf
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
#define TAU 6.28318530718
#define saturate2(x) clamp(x, 0., 1.)

float hash(vec2 uv) {
    float f = fract(cos(sin(dot(uv, vec2(.009123898, .00231233))) * 48.512353) * 1111.5452313);
    return f;
}

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

float fbm(vec2 uv) {
    float f = 0.;
    float r = 1.;
    for (int i = 0; i < 8; ++i) {
        f += noise((uv += .25) * r) / (r *= 2.);
    }
    return f / (1. - 1. / r);
}

vec4 blend(vec4 c1, vec4 c2)
{
    return vec4(mix(c1.rgb, c2.rgb, c2.a), max(c1.a, c2.a));
}

float mask(vec2 uv) {
    uv *= .9 - fbm(-uv * 2. + vec2(0, -iAmplifiedTime)) * (texture(iAudioData, vec2(.25, .25)).x) * .5;
    return length(uv) - .55;
}

vec4 spiral(vec2 uv) {
    if (mask(uv) > 0.) return vec4(0);
    float angel = atan(uv.x, uv.y) / TAU + .5 - iAmplifiedTime / 10. - texture(iAudioData, vec2(.1, .25)).x * .1;
    angel -= (uv.y + uv.x) / 20.;
    float dist = length(uv);
    float _smooth = dist * 15.;
    float alpha = saturate2(sin(angel * 17. * TAU + sin(dist * 6. + 2.) * 2.) * _smooth);
    float base = .64 - texture(iAudioData, vec2(.9, .25)).x / 5.;
    float scratch = smoothstep(base, base + .01, fbm((uv - vec2(0, -iAmplifiedTime * .2)) * vec2(30., 2.)));
    alpha = saturate2(alpha - scratch);
    alpha = saturate2(alpha - smoothstep(-.1, .0, -dist));
    vec3 color = vec3(.04, .27, .86) + noise(uv * 4.) * .3;
	return vec4(color, alpha);
}

vec4 circle(vec2 uv) {
    float width = .05;
    float m = mask(uv);
    float alpha = smoothstep(-width, -width + .005, m)* smoothstep(-width - .005, -width, -m);
    vec3 color = vec3(.16, .21, .5) + (noise(uv * 03.) - .65) * .1;
    return vec4(color, alpha);
}

void main()
{
	//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
    vec2 uv = vUv * 2. -1.;
    uv.x *= iResolution.x / iResolution.y;
	//gl_FragColor = blend(vec4(.86, .86, .79, 1.), spiral(uv));
    gl_FragColor = blend(vec4(0., .0, .0, 1.), spiral(uv));
    gl_FragColor = blend(gl_FragColor, circle(uv));
    uv *= 1000.;
    float amount = .1;
    gl_FragColor.r += (hash(uv) - .5) * amount;
    uv += 100.;
    gl_FragColor.g += (hash(uv) - .5) * amount;
    uv += 100.;
    gl_FragColor.b += (hash(uv) - .5) * amount;
}