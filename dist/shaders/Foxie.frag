// https://www.shadertoy.com/view/NdlGzs
// Modified by ArthurTent
// Created by z0rg
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0
// Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-sa/3.0/
// or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// =========================================================================================================
//
// You can make it your window terminal background following link here :
// https://github.com/seb776/WindowsTerminalShaders
//
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
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float beat = 0.0;
mat2 r2d(float a) { float c= cos(a), s = sin(a); return mat2(c,-s,s,c);}
float lenny(vec2 v) { return abs(v.x)+abs(v.y)*beat*.5; }

float snd = 0.;
const float PI = 3.1415926;
// MIT Licensed hash From Dave_Hoskins (https://www.shadertoy.com/view/4djSRW)
vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

vec3 stars(in vec3 p)
{
    vec3 c = vec3(0.);
    float res = iResolution.x*0.8;
    
	for (float i=0.;i<4.;i++)
    {
        vec3 q = fract(p*(.15*res))-0.5;
        //q*= snd/10.;
        vec3 id = floor(p*(.15*res));
        vec2 rn = hash33(id).xy;
        float c2 = 1.-smoothstep(0.,.6,length(q));
        c2 *= step(rn.x,.0005+i*i*0.001);
        c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.25+0.75);
        p *= 1.4;
    }
    return c*c*.65;
}
void camera(vec2 fragCoord, out vec3 ro, out vec3 rd, out mat3 t)
{
    float a = 1.0/max(iResolution.x, iResolution.y);
    //rd = normalize(vec3((fragCoord - iResolution.xy*0.5)*a, 0.5));
    rd = normalize(vec3(fragCoord, 1.0));

    ro = vec3(0.0, 0.0, -15.);

    //float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y));
    float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y))+sin(iTime/20.);
    vec2 m = PI*ff + vec2(((iMouse.xy + 0.1) / iResolution.xy) * (PI*2.0));
    //m.y = -m.y;
    m.y = sin(m.y*0.5)*0.3 + 0.5;

    //vec2 sm = sin(m)*sin(iTime), cm = cos(m)*(1.+sin(iTime));
    vec2 sm = sin(m)*(1.+sin(iTime/10.)/2.), cm = cos(m);
    mat3 rotX = mat3(1.0, 0.0, 0.0, 0.0, cm.y, sm.y, 0.0, -sm.y, cm.y);
    mat3 rotY = mat3(cm.x, 0.0, -sm.x, 0.0, 1.0, 0.0, sm.x, 0.0, cm.x);

    t = rotY * rotX;

    ro = t * ro;
    rd = t * rd;

    rd = normalize(rd);
}

float _cir(vec2 uv, float r)
{
    return length(uv)-r;
}

float _sqr(vec2 p, vec2 s)
{
    vec2 l = abs(p)-s;
    return max(l.x, l.y);
}

float _nimal(vec2 uv)
{

    uv.x+=sin(uv.y*25.+iTime*2.)*0.01*sat(uv.y*5.);
    vec2 tuv = (uv-vec2(0.11+0.01*sin(uv.y*30.-iTime*4.),-.05)) * r2d(PI/4.);

    tuv.x = abs(tuv.x);
    tuv = (tuv-vec2(-.07,0.));
    float tail = _cir(tuv, .1);
    uv -= vec2(0.05,-.03);
    float body = 10.;

    float anhears = 0.1;
    vec2 offhears = vec2(0.01,0.);
    body = min(body, _sqr((uv+offhears)*r2d(anhears), vec2(.025,.07)));
    body = min(body, _sqr((uv-offhears)*r2d(-anhears), vec2(.025,.07)));
    body = max(body, -_sqr((uv-vec2(0.,.08))*r2d(PI/4.), vec2(.03)));
    uv.x = abs(uv.x);
    body = min(body, _cir(uv*vec2(1.,.8)-vec2(.02,-0.04),.03));
    body = min(body, _cir(uv*vec2(1.,.8)-vec2(.048,-0.058),.005));
    body = min(body, tail);
    return body;
}

float _star(vec2 p, vec2 s)
{
    float a = _sqr(p, s.xy);
    float b = _sqr(p, s.yx);
    return min(a, b);
}

float _stars(vec2 uv, vec2 szu)
{
    uv *= r2d(PI/4.);
    vec2 ouv = uv;
    float th = 0.002;
    vec2 rep = vec2(0.1);

    vec2 idx = floor((uv+rep*.5)/rep);

    uv = mod(uv+rep*.5, rep)-rep*.5;
    float sz = sat(sin(idx.x*5.+idx.y+iTime))*sat(length(ouv*2.)-.5);
    return _star(uv, vec2(20.*th, th)*.5*sz*szu);
}

vec3 rdr(vec2 uv)
{
    float shp = 400.;
    vec3 background = vec3(0.431,0.114,0.647)*.2*beat;

    background = mix(background, vec3(1.000,0.761,0.239), 1.-sat(_stars(uv, vec2(1.))*shp));

    vec3 sunCol = vec3(1.000,0.761,0.239);
    vec3 foregroundBack = vec3(0.345,0.125,0.494);

    vec3 foreground;

    float sun = _cir(uv, .02);
    float sstp = 0.05;
    sun = floor(sun/sstp)*sstp;
    foreground = mix(foregroundBack, sunCol, 1.-sat(sun*4.))*beat*.5;

    float mount = uv.y-asin(sin(uv.x*25.))*.01+.1*beat/2.;
    foreground = mix(foreground, foreground*.3, 1.-sat(mount*shp*.5));

    float mount2 = uv.y-(sin(uv.x*25.+2.))*.05+.1;
    foreground = mix(foreground, foreground*.5, 1.-sat(mount2*shp*.1));


    float hill = _cir(uv-vec2(0.,-.9), .8);
    foreground = mix(foreground, vec3(0.), 1.-sat(hill*shp));

    float nanimal =_nimal(uv);
    foreground = mix(foreground, vec3(0.), 1.-sat(nanimal*shp));


    float mask = _cir(uv, .25);

    vec3 col = mix(background, foreground, 1.-sat(mask*shp));

    col += (1.-sat(length(uv*3.)))*sunCol*.7;
    float flicker = .1;
    col += pow(1.-sat(lenny(uv*vec2(1.,2.))),5.)*sunCol*.7
        *mix(.95,1., sat(sin(iTime*25.)*2.+sin(iTime*40.)));

    col = mix(col, vec3(1.000,0.761,0.239), sat(length(uv)-.1)*(1.-sat(_stars(uv*.8, vec2(5.))*shp*.3))*.7);
    return col;
}



void main()
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    vec2 cam_uv = -1.0 + 2.0 *vUv;
    
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(cam_uv,-1.5));
    mat3 t3 = mat3(1.0);
	camera(cam_uv, ro, rd, t3);
    beat = 0.7+FFT(25)*3.;
    //vec2 uv = (fragCoord-vec2(.5)*iResolution.xy)/iResolution.xx;
    vec2 uv = -1.+2.*vUv;

    vec3 col = rdr(uv);

    col *= mix(-1.,1.,1.-sat(lenny(uv*2.)-.5));
    col = sat(col);

    gl_FragColor = vec4(col,1.0);
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
