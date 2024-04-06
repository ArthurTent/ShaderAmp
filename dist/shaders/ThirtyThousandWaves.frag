// https://www.shadertoy.com/view/7dl3Wn
// Modified by ArthurTent
// Created by z0rg
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

// This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0
// Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-sa/3.0/
// or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// =========================================================================================================
uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define sat(a) clamp(a, 0., 1.)
#define FFT(A) pow(texelFetch(iAudioData, ivec2(A, 0), 0).x, 5.)*.5
mat2 r2d(float a) { float c = cos(a), s = sin(a); return mat2(c,-s,s,c);}
float _time;

float _sph(vec3 p, float r)
{
    return length(p)-r;
}

vec3 getCam(vec3 rd, vec2 uv)
{
    vec3 r = normalize(cross(rd, vec3(0., 1., 0.)));
    vec3 u = normalize(cross(rd, r));
    float fov = mix(1., 10., sat(sin(_time*.25)*.5+.5));
    return normalize(rd+(uv.x*r+uv.y*u)*fov);
}

float _cyl(vec3 p, float r)
{
    float test = clamp(sin(p.z+_time*50.)*100., -1., 1.);
    r += sin(_time*50.+p.z*.5)*.1+FFT(p.z*.1);
    r += test*.07;
    return length(p.xy)-r;
}

float map(vec3 p)
{
    p.x = abs(p.x);
    vec3 cp = p-vec3(20., 0.02, 0.);

    float yrep = 10.;
    float idx = (cp.y+yrep*.5)/yrep;
    cp.y = mod(cp.y+yrep*.5, yrep)-yrep*.5;
    cp.x += sin(idx*.1+iAmplifiedTime*1.)*2.+FFT(idx)*10.;
    float cl = _cyl(cp, .1+abs(sin(iAmplifiedTime))*.25+FFT(10));

    //min(_sph(p, .5), _sph(p-vec3(1.+sin(_time), 0., 0.), .5));
    return cl;
}


vec3 rdr(vec2 uv)
{
    vec3 col;


    vec3 ro = vec3(0.,sin(_time),-5.);
    vec3 ta = vec3(sin(_time*.25)*5.,cos(_time*.5)*2.,0.);
    vec3 rd = normalize(ta-ro);

    rd = getCam(rd, uv);
    vec3 p = ro;
    vec3 acc = vec3(0.);
    float accth = 5.;
    for (int i = 0; i < 128; ++i)
    {
        float d = map(p);
        float ffti = FFT(i);
        vec3 grad = 0.5 + 0.5*cos(_time+uv.xyx+vec3(0,2,4)+2.*FFT(p.z+10.)*2.);
        if (d < 0.01)
        {
            col = grad*(ffti+.25);
            break;
        }
        if (d < accth)
        {
            acc += grad*(1.-sat(d/accth))*(1.-sat(distance(ro, p)/300.));
        }
        p += rd * d;
    }

    col += .25*sat(dot(rd, vec3(0.,0.,1.)))*(0.5 + 0.5*cos(_time+uv.yxy+vec3(0,2,4)+2.*FFT(p.z+10.)));
    return col+acc*.2*FFT(10.);
}

void main()
{
    _time = iAmplifiedTime+texture(iChannel0, vUv*2.-1./8.).x*iTimeDelta*2.;
    //vec2 uv = (fragCoord-vec2(.5)*iResolution.xy)/iResolution.xx;
    vec2 uv = vUv*2.-1.;

    uv *= r2d(_time*.1);
    vec3 col = rdr(uv);
    { // Not so cheap antialiasing SSAA x4

        vec2 off = vec2(1., -1.)/(iResolution.x*2.);
        vec3 acc = col;
        // To avoid too regular pattern yielding aliasing artifacts
        mat2 rot = r2d(uv.y*2.); // a bit of value tweaking, appears to be working well
        acc += rdr(uv-off.xx*rot);
        acc += rdr(uv-off.xy*rot);
        acc += rdr(uv-off.yy*rot);
        acc += rdr(uv-off.yx*rot);
        col = acc/5.;
    }

    //col = mix(col, vec3(0.), pow(sat(length(uv*1.7)), 1.5));
    col = pow(col, vec3(.45));

    gl_FragColor = vec4(col,1.0);
}