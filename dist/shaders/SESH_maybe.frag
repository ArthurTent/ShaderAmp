// https://www.shadertoy.com/view/ftSGWy
// Modified by ArthurTent
// Created by MeDope
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
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

//Each sdf below by IQ
float dot2(vec2 x)
{
    return dot(x,x);
}

float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C)
{
    vec2 a = B - A;
    vec2 b = A - 2.0*B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;
    float kk = 1.0/dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
    float kz = kk * dot(d,a);
    float res = 0.0;
    float p = ky - kx*kx;
    float p3 = p*p*p;
    float q = kx*(2.0*kx*kx-3.0*ky) + kz;
    float h = q*q + 4.0*p3;
    if( h >= 0.0)
    {
        h = sqrt(h);
        vec2 x = (vec2(h,-h)-q)/2.0;
        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        float t = clamp( uv.x+uv.y-kx, 0.0, 1.0 );
        res = dot2(d + (c + b*t)*t);
    }
    else
    {
        float z = sqrt(-p);
        float v = acos( q/(p*z*2.0) ) / 3.0;
        float m = cos(v);
        float n = sin(v)*1.732050808;
        vec3  t = clamp(vec3(m+m,-n-m,n-m)*z-kx,0.0,1.0);
        res = min( dot2(d+(c+b*t.x)*t.x),
                   dot2(d+(c+b*t.y)*t.y) );
        // the third root cannot be the closest
        // res = min(res,dot2(d+(c+b*t.z)*t.z));
    }
    return sqrt( res );
}

float sdSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

float sdBox(vec2 p, vec2 o)
{
    p = abs(p) - o;
    return length(max(p, 0.0)) + min(0.0, max(p.x, p.y));
}

float hash21(vec2 p)
{
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 47758.5453);
}

float valuenoise2D(vec2 p, float seed)
{
    vec2 id = floor(p) + seed;
    p = fract(p);
    p = p * p * (3.0 - 2.0 * p);
    float n00 = hash21(id);
    float n01 = hash21(id + vec2(0.0, 1.0));
    float n10 = hash21(id + vec2(1.0, 0.0));
    float n11 = hash21(id + vec2(1.0, 1.0));
    return mix(mix(n00, n10, p.x), mix(n01, n11, p.x), p.y);
}

float st0(float d)
{
    return clamp(d / fwidth(d) + 0.5, 0.0, 1.0);
}

float sD(vec2 p)
{
    p *= 1.0 + (valuenoise2D(p * 50.0, 5.97)*2.0-1.0)*0.1;
    return min(
    sdBezier(p, vec2(0.03, 0.0), vec2(0.07, -0.04), vec2(0.01, -0.1)),
    sdBezier(p, vec2(0.04, 0.1), vec2(-0.01, 0.04), vec2(0.03, 0.0)));
}

float getd(vec2 uv)
{
    vec2 ouv = uv;
    uv.y += texture(iAudioData, uv*2.0-vec2(-0.2,0.0)).r*0.02;
    uv *= 1.0 + (valuenoise2D(uv * 50.0, 0.95)*2.0-1.0)*0.05;

    float d = 1e5;
    d = min(d, sdSegment(uv, vec2(0.17,0.0), vec2(0.17,0.2)));
    d = min(d, sdSegment(uv, vec2(0.11,0.1), vec2(0.17,0.09)));
    d = min(d, sdSegment(uv, vec2(0.11,0.02), vec2(0.11,0.22)));

    d = min(d, sdSegment(uv, vec2(-0.06,0.06), vec2(-0.06,0.23)));
    d = min(d, sdSegment(uv, vec2(-0.06,0.06), vec2(-0.02,0.08)));
    d = min(d, sdSegment(uv, vec2(-0.06,0.14), vec2(-0.025,0.156)));
    d = min(d, sdSegment(uv, vec2(-0.06,0.23), vec2(-0.02,0.237)));

    uv = ouv;
    uv.y += texture(iAudioData, uv * 0.1 + vec2(0.0)).r*0.01;
    d = min(d, sD(uv - vec2(0.02,0.15)));
    d = min(d, sD(uv - vec2(-0.16,0.1)))-0.013;

    uv = ouv - vec2(0,-0.02);
    uv *= 1.0 + (valuenoise2D(uv * 60.0, 1.54)*2.0-1.0)*0.05;
    uv.y -= uv.x*0.2;
    d = min(d, sdBox(uv-vec2(0,-0.06), vec2(0.013))-0.07);
    d = min(d, length(uv-vec2(0,-0.12))-0.06);
    d = min(d, length(uv-vec2(0,-0.16))-0.038);
    d = min(d, length(uv-vec2(0,-0.194))-0.011);
    uv = ouv;
    uv.y -= uv.x*0.3;
    uv.y += texture(iAudioData, abs(uv*0.1)).r*0.01;
    uv.y += (valuenoise2D(uv.xx * 140.0, 1.47)*2.0-1.0)*0.009;
    d = max(d, -sdSegment(uv, vec2(-0.5, -0.17), vec2(0.5, -0.17))+0.01);
    uv = ouv;
    uv.y -= uv.x*0.2;
    uv *= 1.0 + (valuenoise2D(uv * 140.0, 54.0) * 2.0 - 1.0) * 0.15 * abs(uv.x*10.0);
    d = max(d, -sdBox(uv-vec2(0.03,-0.08), vec2(0.01, 0.0))+0.016);
    d = max(d, -sdBox(uv-vec2(-0.03,-0.08), vec2(0.01, 0.0))+0.016);
    uv = ouv;
    uv *= 1.0 + (valuenoise2D(uv * 150.0, 5.0)*2.0-1.0)*0.05;
    d = max(d, -sdBox(uv-vec2(0.003, -0.115), vec2(0.0, 0.0))+0.012);
    d = max(d, -sdBox(uv-vec2(0.003, -0.1), vec2(0.0, 0.0))+0.007);
    return d;
}

void main()
{
    vec2 fragCoord = vUv * iResolution;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.x, ouv = uv;
    vec3 col = vec3(0.2,0.2,0.2);

    float d = getd(uv);
    col = mix(col, vec3(0), st0(-d));
    d = getd(uv+vec2(0.0075,-0.0075));
    col = mix(col, vec3(1), st0(-d));
    col += vec3(0.1,0.2,3.0)*pow(0.001/abs(d), 0.45)*pow(texture(iAudioData, vec2(0.001,0.0)).r, 3.0);

    col = pow(col, vec3(1.2));
    uv.y -= (texture(iAudioData, fragCoord.xx/iResolution.xx).r*2.0-1.0)*0.01;
    col += vec3(0.1,0.2,3.0)*0.001/clamp(uv.y+0.28, 0.0, 1.0);

    gl_FragColor = vec4(col,1);
}