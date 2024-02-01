//https://www.shadertoy.com/view/lcBSWR
// Created by ramansinghdhiman
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define AA 1.5/iResolution.y

float ss(float e, float v)
{
    return smoothstep(e - AA, e + AA, v);
}

float ss(float e, float v, float m)
{
    float a = m * AA;
    return smoothstep(e - a, e + a, v);
}

void main()
{
    vec2 uv =  -1.0 + 2.0 *vUv;
    uv = (-uv * 2.0);

    float barCount = 50.0;

    float r = atan(uv.x, uv.y) / 3.14159;
    r = (r + 1.0) / 2.0;

    float ir = floor(r * barCount) / barCount;

    float s = 0.3;

    float vs = 20.0;

    float w = texture(iAudioData, vec2(ir, 0.0)).r;
    w = mix(s, 1.0, w);
    w = floor(w * vs) / vs;

    float d = length(uv);

    float b = fract(r * barCount);
    b = ss(0.15, b, barCount) - ss(0.85, b, barCount / 2.0);

    b *= ss(0.4, abs(sin(d * vs * 3.14159)), vs * 3.14159);

    vec3 col = vec3(0.0);

    col = mix(col, mix(vec3(0.0, 0.7, 0.3), vec3(0.0, 1.0, 1.0), d),
        ss(d, w) * b * ss(s + 0.01, d));

    gl_FragColor = vec4(col,1.0);
}