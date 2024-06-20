// https://www.shadertoy.com/view/sdj3Wc
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
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform sampler2D iVideo;
varying vec2 vUv;

#define sat(a) clamp(a, 0., 1.)
#define FFT(f) texelFetch(iAudioData, ivec2(f, 0),0).x

mat2 r2d(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 getTexture(vec2 p){
	vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}

vec3 gradient(float f)
{
    vec3 cols[3];

    cols[0] = vec3(0.169,0.086,0.816);
    cols[1] = vec3(0.835,0.216,0.843);
    cols[2] = vec3(1.,1.,1.);

    float cnt = 2.;
    float cur = f*cnt;
    float curIdx = floor(cur);
    return mix(cols[int(curIdx)], cols[int(min(curIdx+1., cnt))], sat(fract(cur)));
}

float lenny(vec2 v)
{
    /*
    v.x *=FFT(50)*5.25;
    v.y *=FFT(50)*5.25;
    */
    return abs(v.x)+abs(v.y);
}

float _loz(vec2 p, float r)
{
    return lenny(p)-r;
}

float _cir(vec2 p, float r)
{
    return length(p)-r;
}
float _sqr(vec2 p, vec2 s)
{
    vec2 l = abs(p)-s;
    return max(l.x, l.y);
}

float _boat(vec2 p)
{
    vec2 op = p;
    p.y = abs(p.y)-.08;
    p.y+=sin(iTime*3.)*.005;
    p.x = mod(p.x-iTime*.05, 2.)-1.;
    vec2 c = vec2(0.,-.1);
    p-=c;
    p *= r2d(sin(iTime*2.)*.1);
    p+=c;
    float base = max(_cir(p, .1),p.y+.05);
    base = min(base, _sqr(p, vec2(0.005,.1)));
    base = min(base, max(_loz(p*vec2(3.,.75)+vec2(p.y*.75-.12,0.025),.1), -p.y-.04));
    if (op.y < 0.)
    base = max(max(base, sin(p.y*500.)+.8), abs(p.x)-0.05-sin(p.y*150.-iTime*2.)*.025);
    return base;
}

float _fence(vec2 p)
{
    p -= vec2(-0.1,-.3);
    vec2 op = p;
    p.y = abs(p.y)-.05;

    p.x = min(p.x,0.15);

    float rep = .1;
    p.x = mod(p.x+.5*rep, rep)-.5*rep;
    float bar = _sqr(p, vec2(.01,.05));

    float top = _sqr(p-vec2(0.,.05), vec2(.4,.015));

    float base = min(bar, top);
    base = max(base, op.x-.05);
    if (op.y < 0.)
        base = max(max(base, sin(op.y*500.)+.8), abs(p.x)-0.01-sin(p.y*150.-iTime*2.)*.01);
    return base;
}



vec3 rdr(vec2 uv, vec2 fragCoord)
{
    float stp = 0.005;// mix(0.005,0.1, sat(.5+.5*asin(sin(iTime*.5))/1.57));
    uv = floor(uv/stp)*stp;
    vec3 col;

    col = gradient(sat(-uv.y*3.+.75));

    vec2 sPos = uv*vec2(1.,sign(uv.y))-vec2(0.,.1+sin(iTime*.25)*.1);

    float sun = _cir(sPos, .15+FFT(10)*.05);

    if (uv.y < 0.)
    {
        float sunborder = abs(sPos.x)-.1-.05*sin(sPos.y*150.+iTime);
        sun = max(max(sun, (sin(uv.y*500.)+.8)), sunborder);
    }

    col = mix(col, vec3(0.055,0.408,0.867), sat(-uv.y*400.));
    col += pow(texture(iChannel0, uv).x, 25.);

    col += 2.*pow(1.-sat(lenny((uv-vec2(.55,.25))*.25)*5.),15.)*vec3(1.)*pow(sat(FFT(25)), .75);
    col += pow(1.-sat(lenny((uv-vec2(.35,.15))*.25)*15.),15.)*vec3(1.)*pow(sat(FFT(50)+.25), .75);
    col += pow(1.-sat(lenny((uv-vec2(.35,.15))*.25)*15.),15.)*vec3(1.)*pow(sat(FFT(100)+.25), .75);
    col += pow(1.-sat(lenny((uv-vec2(-.35,.25))*.25)*15.),15.)*vec3(1.)*pow(sat(FFT(150)+.25), .75);


    col = mix(col, mix(vec3(1.000,0.784,0.000), vec3(1.,0.,0.), 1.-sat(sPos.y*16.+1.75)), 1.-sat(sun*400.));

    float boat = _boat(uv-vec2(0.4,-0.05));
    col = mix(col, vec3(0.), 1.-sat(boat*400.));

    float fence = _fence(uv);
    col = mix(col, vec3(0.), 1.-sat(fence*400.));



    col += (texture(iChannel0, uv*2.).x-.5)*.1;
    vec2 uvv = uv; // vignette
    uvv.x = mod(uvv.x-iTime*.05-.4, 2.)-1.;
    col *= pow(sat(1.-sat(length((uvv)*2.)-.5)+.35),.5)*max(pow(FFT(10)*2.5,.25),.5);
    col += vec3(1.000,0.784,0.000)*1.5*col*pow(1.-sat(lenny(2.*sPos*vec2(1.,1.))-.35), 1.);

    //uncomment to add c-base
    //vec2 base_pos = uv.xy*4.;
    //base_pos.y -=1.3;
    //base_pos.x += 1.75;

    //vec3 cbase = getTexture(base_pos);
    // this is for "flashing" the scene by beat
    ////cbase +=FFT(50)*.25;
    //col+=cbase;
    return col;
}

void main()
{
    //vec2 uv = (fragCoord-vec2(.5)*iResolution.xy)/iResolution.xx;
    //vec2 uv = vUv*.7-.35;
    vec2 uv = vUv*.8-.45;
    vec3 col = rdr(uv*1.5-vec2(-0.2,-.05), -1.+2.*vUv);
    gl_FragColor = vec4(col,1.0);
}