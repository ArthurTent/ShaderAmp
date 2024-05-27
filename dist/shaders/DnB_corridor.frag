// https://www.shadertoy.com/view/NldSW7
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
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define sat(a) clamp(a, 0., 1.)
mat2 r2d(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

float _time;
vec2 _min(vec2 a, vec2 b)
{
    if (a.x < b.x)
        return a;
    return b;
}
vec2 _max(vec2 a, vec2 b)
{
    if (a.x > b.x)
        return a;
    return b;
}

float _cube(vec3 p, vec3 s)
{
    vec3 l = abs(p)-s;
    return max(l.x, max(l.y, l.z));
}


vec2 map(vec3 p)
{
float ttunnel = _time*55.;
vec3 po = p;
    p.zy += vec2(_time*.5,0.);
//return vec2(length(p)-.5, 0.);
    vec2 acc = vec2(1000., -1.);
    acc = _min(acc, vec2(-p.y
    +sin(p.x+p.z-_time)*.1+0.025*sin((p.x-p.z*.5)*3.-_time*4.5)
    +0.015*sin((p.x+p.z)*12.3+_time)
    +0.01*sin((p.x-p.z)*9.+_time)*sin(p.x*5.)
    , 0.));
    p.zy += vec2(ttunnel*.5,0.);
    float offWall = .2*(1.-sat(pow(texture(iChannel1, p.zy*.1).z, 5.)));
    acc = _min(acc, vec2(-(abs(p.x)-1.-offWall), 1.));
    acc = _max(acc, vec2(abs(po.z)-20., 0.));

    vec3 cpos = po-vec3(0,-1.+sin(_time),-5.);
    cpos.zy*=r2d(_time);
    cpos.xz*= r2d(_time*.5);
    acc = _min(acc, vec2(_cube(cpos, vec3(.5)), 2.));

    return acc;
}

vec3 _norm(float d, vec3 p)
{
    return normalize(-cross(dFdx(p), dFdy(p)));
    vec2 e = vec2(0.01,0.);
    return normalize(vec3(d)-vec3(map(p-e.xyy).x, map(p-e.yxy).x, map(p-e.yyx).x));
}

vec3 trace(vec3 ro, vec3 rd, int steps)
{
    vec3 p = ro;
    for (int i = 0; i < steps; ++i)
    {
        vec2 res = map(p);
        if (res.x<0.001)
            return vec3(res.x, distance(ro, p), res.y);
        p+= rd * res.x;
    }
    return vec3(-1.);
}

vec3 getCam(vec3 rd, vec2 uv)
{
    float fov = 2.5;
    if (mod(iTime, 5.) < 2.)
        fov += 5.5;
    if (mod(iTime, 10.) < 5.)
        fov *= .2;
    fov -= FFT(10)*.5;
    vec3 r = normalize(cross(rd, vec3(0.,1.,0.)));
    vec3 u = normalize(cross(rd, r));
    return normalize(rd+fov*(r*uv.x+u*uv.y));
}

float lenny(vec2 v)
{
    return abs(v.x)+abs(v.y);
}

vec3 rdr(vec2 uv)
{
    vec3 col = vec3(1.);

    float dist = mix(-20., -15., mod(_time, 5.)/5.+FFT(10));
    vec3 ro = vec3(sin(iTime+3.1415),-6.+sin(_time)*5.,dist);
    vec3 ta = vec3(0.,0.,0.);
    vec3 rd = normalize(ta-ro);

    rd = getCam(rd, uv);
    rd.xy *= r2d(sin(_time+FFT(15)*5.)*.25);
    vec3 res = trace(ro, rd, 256);
    if (res.y > 0.)
    {
        vec3 p = ro+rd * res.y;
        vec3 n = _norm(res.x, p);

        //col = n*.5+.5;

        if (res.z == 0.)
        {
            col = vec3(.05);
            n.xz += 0.2*texture(iChannel0, p.xz*.1+_time*.025*vec2(1.,-1.)).x+.1*sin((p.x+p.z*.3)*8.+_time)+.1*sin(p.z*8.33-pow(abs(p.x)-.2, 5.)*10.)+.25*sin(_time+length((p.xz-vec2(0.,20.))*2.));
            n = normalize(n);
            col += pow(sat(-dot(normalize(vec3(0.,1.,1.)-rd), n)), 250.05)*vec3(.5)*length(uv*5.);
        }
        if (res.z == 1.)
        {
            col = vec3(.05);
            col *= texture(iChannel0, p.zy*vec2(.01,2.)).xxx;
            col += mix(vec3(0.), .15*texture(iChannel1, p.zy*.1*vec2(5.,1.)-vec2(-_time*.2, 0.)+sin((n.x+p.y+p.x)*3.+_time*.3)).xxx,
            texture(iChannel0, p.zy*vec2(.1,1.)*.5).x);
            col +=.1*texture(iChannel1, p.zy*vec2(1.,1.)*.5-vec2(-_time*.25,0.)).xyz;

        }
        if (res.z == 2.)
        {
            col = vec3(0.0);

            col += (n*.5+.5)*pow(1.-sat(-dot(n, rd)), 5.);
            //col = n*.5+.5;
        }
       col += vec3(.5)*pow(1.-sat(-dot(rd, n)), 5.);
       col = sat(col);
       col += pow(1.-sat(lenny(uv-vec2(0.,.15))), 3.)*1.2;
       if (res.z == 1.)
       {
           col *= sat(pow(sat(-p.y*.25), .5)+.4);
       }
    }

    float waves = sin((uv.x+uv.y)*55.);

     float flicker = 0.1;
     col = mix(col, 1.-col, sat(waves*400.)*pow(FFT(50),.25)*sat(length(uv*.25)));
    return col;
}

vec3 rdr2(vec2 uv)
{
    vec2 dir = normalize(vec2(1.,1.));
    float strength = 0.03*FFT(20);
    vec3 col;
    col.r = rdr(uv+dir*strength).r;
    col.g = rdr(uv).g;
    col.b = rdr(uv-dir*strength).b;
    col *= mix(vec3(1.), vec3(0.180,1.000,0.863), sat(length(uv)*1.5-.3)*sat((sin(-iTime*5.+(uv.y-uv.x)*50.)-.9)*400.));
    return col;
}


void main( )
{

    //_time = iTime;//+texture(iChannel3, fragCoord/8.).x*.1;
    _time = iTime;//+texture(iAudio, vUv/8.).x*.1;

    vec2 uv = -1.0 + 2.0 * vUv;

    vec3 col = rdr2(uv);
    col *= mix(vec3(0.5), vec3(1.), 1.-sat(lenny(uv*1.5)));
    col = pow(col, vec3(1.2));
    float flicker = 1./12.;
    float flickperiod = 2.;
    col = mix(col, 1.-col, FFT(125)*float(mod(iTime, flickperiod)<.5)*sat(mod(iTime, flicker)/flicker));
    col = mix(fwidth(col)*10., col, sat((sin(iTime*.5)+.8)*400.));

    col = mix(col, col.zxy*vec3(.1,.1,.3)*8., sat(sin(iTime*.25)*400.));
    col = col * 2.*vec3(sat((sin(iTime*.25)*.5+.5)+.5)*.5,texture(iChannel0, vec2(iTime*.05)).x, .5);
    col *= sat(pow(FFT(10)+.3,5.)+.5)*2.;
    gl_FragColor = vec4(2.*mix(col, col.xxx, .5)*mix(vec3(.1,.45,.23), vec3(0.541,1.000,0.992), sat(length(uv))),1.0);
}