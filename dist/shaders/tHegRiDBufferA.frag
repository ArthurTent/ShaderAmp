#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iAudioData;

varying vec2 vUv;

// Common
// This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0
// Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-sa/3.0/
// or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// =========================================================================================================

#define AA // Comment to deactivate antialiasing
#define sat(a) clamp(a, 0., 1.)
#define PI 3.141592653

mat2 r2d(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec2 _min(vec2 a, vec2 b)
{
    if (a.x < b.x)
        return a;
    return b;
}

// Stolen from 0b5vr here https://www.shadertoy.com/view/ss3SD8
float hash11(float p)
{
    return (fract(sin((p)*114.514)*1919.810));
}

// This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0
// Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-sa/3.0/
// or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// =========================================================================================================

#define FFT(a) (texture(iAudioData, vec2(a, 0.)).x-.25)

vec3 rdrCirc(vec2 uv, float t)
{
    vec3 col = vec3(0.);
    vec2 ouv = uv;
    float rep = .03;
    float id = floor((uv.y+rep*.5)/rep);
    uv.y = mod(uv.y+rep*.5,rep)-rep*.5;
    uv.x += id;
    float cl = .1;
    float h = clamp(asin(sin(uv.x*5.)), -cl, cl)/cl;
    float line = abs(uv.y-h*0.01)-.001;
    vec3 rgb = mix(vec3(.4,.3,.7), vec3(.4,.6,.9).zxy, sat(sin(id)));
    rgb *= 1.-sat((abs(ouv.x+(fract(id*.1)-.5)+mod(t*.75+.5*id,4.)-2.)-.2)*4.);
    col = mix(col, rgb,1.-sat(line*iResolution.x*.5));
        col += .5*rgb*(1.-sat(line*80.));
    return col;
}
vec3 rdrCircuit(vec2 uv)
{
    vec3 col = rdrCirc(uv, iTime);
    col += rdrCirc(uv+vec2(0.,.2), iTime*.7);
    col += .5*rdrCirc(2.*uv+vec2(0.,.1), iTime*.5).zxy;
    col += .15*rdrCirc(4.*uv+vec2(0.,.1), iTime*.25).yzx;
    return col;
}


float seed;
float rand()
{
    seed++;
    return hash11(seed);
}

vec2 map(vec3 p)
{
    vec2 acc = vec2(10000.,-1.);
    //acc = _min(acc, vec2(length(p)-2., 0.));
    float h = .2;
    acc = _min(acc, vec2(-p.y-.2*clamp(asin(sin(p.z*3.)),-h,h), 0.));
    return acc;
}

vec3 getEnv(vec3 rd)
{
    rd.xy *= r2d(.5);
    vec2 uv = vec2(atan(rd.z, rd.x)/PI, (acos(rd.y)/PI-.5)*2.);
    float gradf = 3.;
    vec3 up = mix(vec3(0.161,0.055,0.239),vec3(0.639,0.059,0.341), sat(uv.y*gradf));
    vec3 low = mix(vec3(0.161,0.055,0.239),vec3(0.157,0.345,0.337), sat(-uv.y*gradf));
    vec3 back = mix(low, up, float(uv.y > 0. ? low : up));

    float stars = pow(texture(iChannel2, uv*4.).x, 10.);

    uv.x *= 1.75;
    float an = iTime*.1+atan(uv.y+.1, uv.x+.1);
    back += .25*((.35*vec3(0.945,0.220,0.310)*sat(sin(an*12.)+.8))*(1.-sat(length(uv*2.)))+
    .5*vec3(0.945,0.263,0.216)*sat(sin(-iTime*.05+an*7.+1.)+.7)*(1.-sat(length(uv*1.5)))+
    .5*vec3(1.000,0.533,0.502)*sat(sin(an*5.)+.5)*(1.-sat(length(uv*1.)))).zxy;

        float rep = 0.05;
    vec2 uv2 = uv-vec2(0.,-0.35);
    uv2 *= 1.5;
    float id = floor((uv2.x+rep*.5)/rep);
    uv2.x = mod(uv2.x+rep*.5,rep)-rep*.5;
    float height = pow(FFT(abs(id*.01)),1.);
    float shape = max(abs(uv2.y)-height, abs(uv2.x)-0.001);
    vec3 rgbs = mix(vec3(0.208,0.675,0.431)*0., vec3(0.180+sin(id+iTime)*.5+.5,0.820,0.659+sin(-id+iTime)*.5+.5), sat((abs(uv2.y))*10.));
    back += rgbs*(1.-sat(shape*400.))*(1.-sat(abs(uv.x*2.)-.5));

    float psz = .25;
    uv += vec2(.2,-0.1);
    uv *= r2d(2.5);
    float planet = length(uv)-psz;
    vec3 col = back+stars*vec3(0.580,0.804,0.820)*.5;
    vec3 planetrgb = vec3(0.161,0.055,0.239)*.75
    +vec3(0.961,0.000,0.192)*pow(texture(iChannel1,vec2(-iTime*.02,0.)+uv*5.*length(uv)).x,3.)*sat(uv.y*5.);
    planetrgb += vec3(1.000,0.173,0.078)*(1.-sat((abs(planet)-.001)*50.))*sat(uv.y*5.);
    col = mix(col, planetrgb, 1.-sat(planet*400.));
    col += .8*vec3(1.000,0.173,0.078)*(1.-sat((abs(planet)-.01)*10.))*sat(uv.y*5.);
    col += vec3(1.000,0.314,0.141)*(1.-sat(planet*100.))*.15;

    col += .25*rgbs*(1.-sat(shape*10.))*(1.-sat(abs(uv.x*2.)-.5))*sat(planet*10.);
    uv.y *= 3.5-2.*uv.y;
    float anr = atan(uv.y, uv.x); // ring
    float ring = abs(length(uv)-.4)-.1;
    col += sat(uv.y+.15)*(1.-sat(ring*100.))*texture(iChannel2, vec2(length(uv), anr*.01)).xxx;
    return col;
}
float _cube(vec3 p, vec3 s)
{
    vec3 l = abs(p)-s;
    return max(l.x, max(l.y, l.z));
}
vec3 getCam(vec3 rd, vec2 uv)
{
    vec3 r = normalize(cross(rd, vec3(0.,1.,0.)));
    vec3 u = cross(rd, r);
    return normalize(rd+(r*uv.x+u*uv.y)*4.);
}

vec3 getNorm(vec3 p, float d)
{
    vec2 e = vec2(0.01,0.);
    return normalize(vec3(d)-vec3(
    map(p-e.xyy).x,
    map(p-e.yxy).x,
    map(p-e.yyx).x));
}

vec3 trace(vec3 ro, vec3 rd, int steps)
{
    vec3 p = ro;
    for (int i = 0; i < steps; ++i)
    {
        vec2 res = map(p);
        if (res.x < 0.01)
            return vec3(res.x, distance(p, ro), res.y);
        p+=rd*res.x;
    }
    return vec3(-1.);
}

vec3 getMat(vec3 res, vec3 rd, vec3 p, vec3 n)
{
    return vec3(.1);
}

vec3 rdr(vec2 uv)
{
    vec3 col = vec3(0.);

    float t = 4.68;
    vec3 ro = vec3(sin(t)*5.,-1.5+sin(iTime*.25)*.2,cos(t)*5.+sin(iTime*.25));
    vec3 ta = vec3(sin(iTime)*1.,-2.,0.);
    vec3 rd = normalize(ta-ro);

    rd = getCam(rd, uv);
    float d = 100.;
    vec3 res = trace(ro, rd, 64);

    if (res.y > 0.)
    {
    d = res.y;
        vec3 p = ro+rd*res.y;
        vec3 n = getNorm(p, res.x);
        col = getMat(res, rd, p, n);
        float move = p.x+iTime;
        float river = (abs(p.z-sin(move*1.)*.5-sin(move*.5)*2.)-1.5);
        float spec = 1.;//mix(.25,1.,1.-sat(river*400.));
        float gloss = .05;//mix(.5,.05, 1.-sat(river*400.));
        vec3 refl = normalize(reflect(rd, n)+gloss*(vec3(rand(), rand(), rand())-.5));
        vec3 resrefl = trace(p+n*0.01, refl, 32);
        vec3 reflec = vec3(0.);
        float gridrep = 1.;
        vec2 griduv = vec2(move, p.z);
        griduv = mod(griduv+gridrep*.5,gridrep)-gridrep*.5;
        float gridth = .001;
        float grid = min(abs(griduv.x)-gridth, abs(griduv.y)-gridth);
        //col += sat(river*400.)*vec3(0.220,0.800,0.412)*(1.-sat(grid*40.))*(1.-sat(res.y/10.));
        col += rdrCircuit(vec2(p.x, p.z)*.1);
        if (resrefl.y > 0.)
        {
            vec3 prefl = p+refl*resrefl.y;
            vec3 nrefl = getNorm(prefl, resrefl.x);

            reflec=getMat(resrefl, refl, prefl, nrefl);
        }
        else
            reflec=getEnv(refl);
        col += reflec*spec;
    }
    else
        col = getEnv(rd);
    col += vec3(0.816,0.541,1.000)*(1.-sat(exp(-d*0.2+.5)))*sat(rd.y*1.+.5);
    col += .5*vec3(1.000,0.314,0.141)*(1.-sat(exp(-d*0.2+1.5)))*sat(rd.y*3.+.5);

    col += vec3(0.302,0.698,1.000)*pow(1.-sat(abs((rd.y-.05)*15.)),2.)*(1.-sat(abs(rd.z)));
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord.xy-.5*iResolution.xy)/iResolution.xx;
    seed=texture(iChannel2,uv).x;
    seed+=fract(iTime);
    vec3 col = rdr(uv);
    vec2 off = vec2(1., -1.)/(iResolution.x*2.);
    #ifdef AA
    if (true)// Not so cheap antialiasing
    {
        vec3 acc = col;
        acc += rdr(uv+off.xx);
        acc += rdr(uv+off.xy);
        acc += rdr(uv+off.yy);
        acc += rdr(uv+off.yx);
        col = acc/5.;

    }
    #endif
    col *= 1.-sat(length(uv*1.5));
    col = pow(col, vec3(1.2));
   col *= sat(iTime-1.);
    col = mix(col, texture(iChannel0, fragCoord.xy/iResolution.xy).xyz,.5);
       col = pow(col, vec3(1.15));
    col = sat(col);

    fragColor = vec4(col.zxx,1.0);
}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
