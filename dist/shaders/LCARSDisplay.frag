// https://www.shadertoy.com/view/std3RH 
// Modified by ArthurTent
// Created by Xibanya
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float iPlanetFlash;
uniform float iExtraRotation;
uniform float iVariant2;
uniform float iFlashThreshold;
varying vec2 vUv;
/*
Merged two shaders:
LCARS Display by Xibanya https://www.shadertoy.com/view/std3RH
and
Habitable Planet by Kali https://www.shadertoy.com/view/WdScRW

Plane change adapted from QuantumSuper's "Solum Object" shader https://www.shadertoy.com/view/mtKGRW

*/

// habitable planet
// planet flash + extra rotation
//background flash (by inverting whole screen when snare>0.71)
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
#define aTime 128./60.*iAmplifiedTime
mat2 rotM(float r){float c = cos(r), s = sin(r); return mat2(c,s,-s,c);} //2D rotation matrix
float snd = 0.;
float snareLevel=0.;
//float iAmplifiedTime=0.; // I usually use this var from ShaderAmp. it doesn't work the same on shadertoy.com as on ShaderAmp
const float PI = 3.1415926;
vec3 rd;
const float det = .001;
vec3 ldir = vec3(2., .5, -.5);
float objid, objcol, coast;
const vec3 water_color = vec3(0., .4, .8);
const vec3 land_color1 = vec3(.6, 1., .5);
const vec3 land_color2 = vec3(.6, .2, .0);
const vec3 atmo_color = vec3(.4, .65, .9);
const vec3 cloud_color = vec3(1.3);

// adapted from QuantumSuper's "Solum Object" shader
vec2 getPlane(vec2 p){
    if(iTime<10.) return p; // intro
    if(snd<.3){ p*=-1.5*rotM(sign(snd*10.)*aTime/8.);}
    float fTime = fract(iAmplifiedTime/64.);
    if (fract(aTime/32.)<.75) return p; //break, standard view
    else if (fTime<.33) {p = 2.5*fract(p*2.*abs(sin(aTime/8.))+.5)-.5; p.y-=.5;} //scaling multiples
    else if (fTime<.66) p *= 1.5*rotM(sign(fract(aTime/32.)-.5)*aTime/8.); //rotation
    //else p = snd*sin( PI*p + vec2( sign(fract(aTime/32.)-.5) * aTime/4., 0)); //moving warp multiples
    if(snd<.3){ p*=1.5*rotM(sign(snd*10.)*aTime/4.);}
    else{p*=(.1+snd*3.);}
    return p;
}

// MIT Licensed hash From Dave_Hoskins (https://www.shadertoy.com/view/4djSRW)
vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

// Not certain about the origin. Kali?
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

// Not certain about the origin
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

mat2 rot(float a) {
	float s = sin(a), c = cos(a);
    return mat2(c, s, -s, c);
}

float kset(int it, vec3 p, vec3 q, float sc, float c) {

    //p.xz *= rot(iAmplifiedTime * .12);
    p.xz *= rot(iAmplifiedTime * .4);

    if(iExtraRotation > 0.5){
        //p.xz*=rot(iAmplifiedTime *.4);
        p.xz*=rot(iAmplifiedTime *.12);
    }
    p += q;
    p *= sc;
    float l = 0., l2;
    for (int i = 0; i < it; i++) {
    	p = abs(p) / dot(p, p) - c;
		l += exp(-1. * abs(length(p) - l2));
	    l2 = length(p);
    }
    return l * .08;
}

float clouds(vec3 p2, vec3 dir) {
		p2 -= .1 * dir;
    	p2.y *= 3.;
    	float cl1 = 0., cl2 = 0.;
        for (int i = 0; i < 15; i++) {
			p2 -= .05 * dir;
            cl1 += kset(20, p2, vec3(1.7, 3., .54), .3, .95);
            cl2 += kset(18, p2, vec3(1.2, 1.7, 1.4), .2, .85);
        }
        cl1 = pow(cl1 * .045, 10.);
        cl2 = pow(cl2 * .055, 15.);
		return cl1 - cl2;
}

float de(vec3 p) {
    float surf1 = kset(6, p, vec3(.523, 1.547, .754), .2, .9);
    float surf2 = kset(8, p, vec3(.723, 1.247, .354), .2, .8) * .7;
    float surf3 = kset(10, p, vec3(1.723, .347, .754), .3, .6) * .5;
    objcol = pow(surf1 + surf2 + surf3, 5.);
	float land = length(p) - 3. - surf1 * .8 - surf2 * .1;
    float water = length(p) - 3.31;
    float d = min(land, water);
	objid = step(water, d) + step(land, d) * 2.;
	coast = max(0., .03 - abs(land - water)) / .03;
    return d * .8;
}

float de_clouds(vec3 p, vec3 dir) {
    return length(p)-clouds(p, dir)*.05;
}


vec3 normal(vec3 p) {
    vec3 eps = vec3(0., det, 0.);
	return normalize(vec3(de(p + eps.yxx), de(p + eps.xyx), de(p + eps.xxy)) - de(p));
}

vec3 normal_clouds(vec3 p, vec3 dir) {
    vec3 eps = vec3(0., .05, 0.);
	vec3 n = normalize(vec3(de_clouds(p + eps.yxx, dir), de_clouds(p + eps.xyx, dir), de_clouds(p + eps.xxy, dir)) - de_clouds(p, dir));
	return n;
}

float shadow(vec3 desde) {
    ldir=normalize(ldir);
    float td=.1,sh=1.,d;
    for (int i=0; i<10; i++) {
		vec3 p=desde+ldir*td;
        d=de(p);
        td+=d;
		sh=min(sh,20.*d/td);
		if (sh<.001) break;
    }
    return clamp(sh,0.,1.);
}

vec3 color(float id, vec3 p) {
	vec3 c = vec3(0.);
    float k = smoothstep(.0, .7, kset(9, p, vec3(.63, .7, .54), .1, .8));
    vec3 land = mix(land_color1, land_color2, k);
    vec3 water = water_color * (objcol + .5) + coast * .7;
	float polar = pow(min(1.,abs(p.y * .4 + k * .3 - .1)),10.);
    land = mix(land, vec3(1.), polar);
	water = mix(water, vec3(1.5), polar);
    c += water * step(abs(id - 1.), .1);
    c += land * step(abs(id - 2.), .1) * objcol * 3.;
    return c;
}


vec3 shade(vec3 p, vec3 dir, vec3 n, vec3 col, float id) {
	ldir = normalize(ldir);
    float amb = .05;
    float sh = shadow(p);
    float dif = max(0., dot(ldir, n)) * .7 * sh;
    vec3 ref = reflect(ldir, n) * sh;
    float spe = pow(max(0., dot(ref, dir)), 10.) * .5 * (.3+step(abs(id - 1.), .1));
    return (amb + dif) * col + spe;
}

vec3 march(vec3 from, vec3 dir) {
	float td, d, g = 0.;
    vec3 c = vec3(0.), p;
    for (int i = 0; i < 60; i++) {
    	p = from + dir * td;
        d = de(p);
        td += d;
        if (td > 50. || d < det) break;
		g += smoothstep(-4.,1.,p.x);
    }
    if (d < det) {
    	p -= det * dir * 2.;
        vec3 col = color(objid, p);
        vec3 n = normal(p);
        c = shade(p, dir, n, col, objid);
        //cl1 = clamp(cl1, 0., 1.);
        float cl1 = clouds(p, dir);
		vec3 nc = normal_clouds(p, dir);
        c = mix(c, .1 + cloud_color * max(0., dot(normalize(ldir), nc)), clamp(cl1,0.,1.));
        if(iPlanetFlash > 0.5){
        if(snareLevel>0.71){
            //c = FFT(25)*.85*vec3(.5,.8,.7+snd) - c*(2.-snd*2.);
            //c = FFT(25)*.85*vec3(0.,1.3-sin(iAmplifiedTime*16.),1.3-(sin(iAmplifiedTime*20.)+snd)) - c*(2.-snd*2.);
            c = vec3(0.+snd,1.-sin(iAmplifiedTime*4.)/1.5,1.-(sin(iAmplifiedTime*7.)+snd)/3.) - c*(2.-snd*2.);
	    c/=(3.3+snd*2.);
	    c*=-1.;

        }
        }
    }
    else
    {
        //bg
        vec3 bg = stars(rd)*(1.+30.*snd);
        c+=bg;

        if(iVariant2 > 0.5){
	if(snareLevel>iFlashThreshold){
		c=1.-c;
	}
	}

    }
    g /= 60.;
    g*=snd*10.;
    return c + (pow(g, 1.3) + pow(g,1.7) * .5) * atmo_color * .5;
}
//end of habitable planet


#define ORANGE vec4(1.0, 0.6, 0.0, 0.0)
#define LILAC vec4(0.6, 0.6, 1.0, 0.0)
#define CORAL vec4(0.8, 0.4, 0.4, 0.0)
#define PEACH vec4(1.0, 0.6, 0.4, 0.0)
#define CREAM vec4(1.0, 0.8, 0.6, 0.0)
#define PINK vec4(0.8, 0.6, 0.8, 0.0)
#define BLACK vec4(0.0)

//https://www.shadertoy.com/view/XtfyRS
float GlyphSDF(vec2 p, float char)
{
    // Convert glyph to appropriate char index in the char texture and compute distance to it
	p = abs(p.x - .5) > .5 || abs(p.y - .5) > .5 ? vec2(0.) : p;
	return 2. * (texture(iChannel0, p / 16. + fract(vec2(char, 15. - floor(char / 16.)) / 16.)).w - 127. / 255.);
}
#define INIT_TEXT float glyphRatio = 2.0; \
    vec2 glyphScale = 6. * vec2(1., glyphRatio); \
    vec2 t = floor(p / glyphScale + 1e-6); \
    uint v = 0u
#define WRITE_TEXT float char = float((v >> uint(8. * t.x)) & 255u); \
    vec2 posInCell = (p - t * glyphScale) / glyphScale; \
    posInCell.x = (posInCell.x - .5) / glyphRatio + .5; \
    float sdf = GlyphSDF(posInCell, char) - 0.03; \
    if (char != 0.) color = mix(textColor, color, smoothstep(-.02, +.03, sdf))


void TextSHADERAMP(inout vec3 color, vec3 textColor, vec2 p)
{
    INIT_TEXT;
    v = t.y == 0. ? (
        t.x < 4.  ? 1145129043u :
        (t.x < 8. ? 1296126533u :
        (t.x < 12.? 842276944u  :
        0u))
    ) : v;
    v = t.x >= 0. && t.x < 16. ? v : 0u;
    WRITE_TEXT;
}
void Text42(inout vec3 color, vec3 textColor, vec2 p)
{
    INIT_TEXT;
    // encodes "42" (digit 4 then digit 2)
    v = t.y == 0. ? ( t.x < 4. ? 925709360u : ( t.x < 8. ? 892548146u : 0u ) ) : v;
    v = t.x >= 0. && t.x < 8. ? v : 0u;
    WRITE_TEXT;
}
void TextLCARSACCESS(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
    v = t.y == 0. ? ( t.x < 4. ? 1380008780u : ( t.x < 8. ? 1128341587u : ( t.x < 12. ? 1397966147u : 825504800u ) ) ) : v;
	v = t.x >= 0. && t.x < 16. ? v : 0u;
    WRITE_TEXT;
}
void TextCBase(inout vec3 color, vec3 textColor, vec2 p)
{
    INIT_TEXT;
    v = t.y == 0. ? ( t.x < 4. ? 1633824099u : ( t.x < 6. ? 25971u : 0u ) ) : v;
    v = t.x >= 0. && t.x < 6. ? v : 0u;
    WRITE_TEXT;
}
void TextLCARS4(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
	v = t.y == 0. ? ( t.x < 4. ? 1380008780u : ( t.x < 8. ? 808722515u : 3422002u ) ) : v;
	v = t.x >= 0. && t.x < 12. ? v : 0u;
    WRITE_TEXT;
}
void Text3(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
	v = t.y == 0. ? ( t.x < 4. ? 959263536u : ( t.x < 8. ? 943076663u : 51u ) ) : v;
	v = t.x >= 0. && t.x < 12. ? v : 0u;
    WRITE_TEXT;
}
void Text4(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
	v = t.y == 0. ? ( t.x < 4. ? 925709360u : ( t.x < 8. ? 909391158u : 54u ) ) : v;
	v = t.x >= 0. && t.x < 12. ? v : 0u;
    WRITE_TEXT;
}
void Text5(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
    v = t.y == 0. ? ( t.x < 4. ? 841823536u : ( t.x < 8. ? 892548146u : 51u ) ) : v;
	v = t.x >= 0. && t.x < 12. ? v : 0u;
    WRITE_TEXT;
}
void Text6(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
    v = t.y == 0. ? ( t.x < 4. ? 892155440u : ( t.x < 8. ? 909456951u : 53u ) ) : v;
	v = t.x >= 0. && t.x < 12. ? v : 0u;
    WRITE_TEXT;
}
void TextB(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
	v = t.y == 2. ? ( t.x < 4. ? 909654073u : ( t.x < 8. ? 875770413u : ( t.x < 12. ? 538976288u : ( t.x < 16. ? 538976288u : ( t.x < 20. ? 538976288u : ( t.x < 24. ? 538976288u : ( t.x < 28. ? 942813488u : 959852589u ) ) ) ) ) ) ) : v;
	v = t.y == 1. ? 0u : v;
	v = t.y == 0. ? ( t.x < 4. ? 875638833u : ( t.x < 8. ? 959526957u : ( t.x < 12. ? 538976288u : ( t.x < 16. ? 538976288u : ( t.x < 20. ? 538976288u : ( t.x < 24. ? 538976288u : ( t.x < 28. ? 842215991u : 942880813u ) ) ) ) ) ) ) : v;
	v = t.x >= 0. && t.x < 32. ? v : 0u;
    WRITE_TEXT;
}
void TextNumbers(inout vec3 color, vec3 textColor, vec2 p)
{
	INIT_TEXT;
    v = t.y == 4. ? ( t.x < 4. ? 892875570u : ( t.x < 8. ? 941629472u : ( t.x < 12. ? 842544949u : ( t.x < 16. ? 958411315u : ( t.x < 20. ? 943207200u : ( t.x < 24. ? 943005746u : ( t.x < 28. ? 958411577u : 3487800u ) ) ) ) ) ) ) : v;
	v = t.y == 3. ? ( t.x < 4. ? 875966514u : ( t.x < 8. ? 840966176u : ( t.x < 12. ? 959723056u : ( t.x < 16. ? 924856886u : ( t.x < 20. ? 926365984u : ( t.x < 24. ? 908075062u : ( t.x < 28. ? 824194610u : 3290679u ) ) ) ) ) ) ) : v;
	v = t.y == 2. ? ( t.x < 4. ? 875765792u : ( t.x < 8. ? 538976288u : ( t.x < 12. ? 840966176u : ( t.x < 16. ? 538982711u : ( t.x < 20. ? 941629472u : ( t.x < 24. ? 892739641u : ( t.x < 28. ? 908081464u : 3617845u ) ) ) ) ) ) ) : v;
	v = t.y == 1. ? ( t.x < 4. ? 943077172u : ( t.x < 8. ? 941629472u : ( t.x < 12. ? 842479161u : ( t.x < 16. ? 924858420u : ( t.x < 20. ? 959920416u : ( t.x < 24. ? 959979576u : ( t.x < 28. ? 538982710u : 3553076u ) ) ) ) ) ) ) : v;
	v = t.y == 0. ? ( t.x < 4. ? 892876320u : ( t.x < 8. ? 538976288u : ( t.x < 12. ? 875765792u : ( t.x < 16. ? 941635639u : ( t.x < 20. ? 909647904u : ( t.x < 24. ? 857743415u : ( t.x < 28. ? 538981940u : 3420960u ) ) ) ) ) ) ) : v;
	v = t.x >= 0. && t.x < 32. ? v : 0u;
    WRITE_TEXT;
}

// all sdf functions from iq
// https://iquilezles.org/articles/distfunctions
vec2 opRepLim( in vec2 p, in vec2 s, in vec2 lima, in vec2 limb )
{
    return p-s*clamp(round(p/s),lima,limb);
}
float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}
float sdRoundBox( in vec2 p, in vec2 b, in vec4 r )
{
    r.xy = (p.x>0.0)?r.xy : r.zw;
    r.x  = (p.y>0.0)?r.x  : r.y;
    vec2 q = abs(p)-b+r.x;
    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}
float sinc( float x, float k )
{
    float a = 3.14 * (k * x - 1.0);
    return sin(a)/a;
}

//// LCARS Functions
float MStep(float d)
{
    return 1. - smoothstep(-0.005, 0.0, d);
}
float Margin(float sdf)
{
    return clamp(1. - smoothstep(0.01, 0.015, abs(sdf)), 0.0, 1.0);
}
float MarginSm(float sdf)
{
    return clamp(1. - smoothstep(0.005, 0.01, abs(sdf)), 0.0, 1.0);
}
void Outline(float d, inout vec4 col, vec4 mixCol)
{
    vec4 c = mix(mixCol, BLACK, Margin(d));
    col = mix(col, c, MStep(d));
}
float Panel(vec2 uv, vec2 f, out vec4 boxCol)
{
    const vec4 RED = vec4(1., 0., 0., 0.);
    const vec4 GREEN = vec4(0.0, 1.0, 0.0, 0.0);
    const vec4 BLUE = vec4(0.0, 0.0, 1.0, 0.0);
    const vec4 ALPHA = vec4(0.0, 0.0, 0.0, 1.0);
    vec2 boxSize = vec2(1.5, 1.);
    float box = sdRoundBox(uv, boxSize, vec4(0.35));
    boxCol = RED;
    float seg = sdBox(uv + vec2(.1, -0.35) * f, vec2(1.7, 0.3));
    Outline(seg, boxCol, RED);

    boxCol = mix(boxCol, GREEN, step(uv.y, 0.15 * f.y));
    seg = sdBox(uv + vec2(0., -.15) * f, vec2(1.5, 0.1));
    Outline(seg, boxCol, BLUE);

    seg = sdBox(uv + vec2(-0.1, 0.) * sign(f), vec2(0.075, 2.));
    Outline(seg, boxCol, ALPHA);

    uv += vec2(-0.4, 0.075) * sign(f);
    float innerBox = sdRoundBox(uv, boxSize, vec4(0.1));
    box = max(box, -innerBox);
    boxCol = mix(boxCol, BLACK, Margin(box));
    return box;
}
void DoText(vec2 p, inout vec4 col)
{
    vec2 tUV = p * vec2(100., 50.) - vec2(0., 32.);
    if(mod(iTime, 20.) > 10.)
    TextSHADERAMP(col.rgb, ORANGE.rgb, tUV);
    else TextLCARSACCESS(col.rgb, ORANGE.rgb, tUV);

    // Move slightly right for the number "42"
    //tUV = p * vec2(275., 150.) - vec2(-245., 110.);
    //Text42(col.rgb, ORANGE.rgb, tUV);

    tUV = p * vec2(275., 150.) - vec2(-245., 110.);
    TextCBase(col.rgb, BLACK.rgb, tUV);
    //TextSHADERAMP(col.rgb, BLACK.rgb, tUV);
    //TextLCARS4(col.rgb, BLACK.rgb, tUV);

    tUV.y += 125.;
    Text3(col.rgb, BLACK.rgb, tUV);
    tUV.y += 59.;
    Text4(col.rgb, BLACK.rgb, tUV);
    tUV.y += 29.;
    Text5(col.rgb, BLACK.rgb, tUV);
    tUV.y += 15.;
    Text6(col.rgb, BLACK.rgb, tUV);
    tUV = p * vec2(270., 140.) - vec2(90., 50.);
    TextB(col.rgb, BLACK.rgb, tUV);
    tUV *= 1.3;
    tUV += vec2(290., 5.);
    TextNumbers(col.rgb, ORANGE.rgb, tUV);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    //iAmplifiedTime = 1.5*iTime+snd; // this is a poor adaption of ShaderAmp's iAmplifiedTime
    for (int i = 4; i <= 10; i++) {
        snareLevel += FFT(i);
    }
    snareLevel /= 7.0;

	vec2 p = (1.3 * fragCoord-iResolution.xy)/iResolution.y;
    // this looked different when I was previewing it in my IDE
    // adjusting aspect here to look good on shadertoy
    p += vec2(0.7, 0.4);
    p.y *= 1.3;
    vec2 boxPos = p + vec2(-0.5, .75);
    vec4 boxCol = CORAL;
    vec2 f = vec2(1.);
    // main panel
    float box = Panel(boxPos, f, boxCol);
    vec4 col1 = boxCol.r * CORAL + boxCol.g * PEACH +
        boxCol.b * ORANGE + boxCol.a * CREAM;
    vec4 col = mix(BLACK, col1, MStep(box));
    // mirror flipped panel
    boxPos = p - vec2(0.5, 1.25);
    f = vec2(1., -2.);
    box = Panel(boxPos, f, boxCol);
    vec4 col2 = boxCol.r * ORANGE + boxCol.g * LILAC +
        boxCol.b * PINK + boxCol.a * ORANGE;
    col = mix(col, col2, MStep(box));

    // pills
    vec2 q = p * 9.0 - vec2(8.0, 2.2);
    vec2 r = opRepLim(q, vec2(4.75, 1.6), vec2(-1, 1.), vec2(1,2));
    float d = sdBox( r, vec2(1.5, 0.0001) ) -  0.65;
    vec4 pillCol = LILAC;
    float peach = min(step(0.625, p.x), step(0.51, p.y));
    pillCol = mix(pillCol, PEACH, peach);
    float orange = min(step(p.x, 0.625), step(p.y, 0.51));
    pillCol = mix(pillCol, ORANGE, orange);
    col = mix(col, pillCol, 1. - smoothstep(-0.05, .0, d));

    // center diagram
    vec4 mCol = PEACH;
    vec2 mPos = p + vec2(-0.25, 0.3);
    vec2 mSize = vec2(0.6, 0.4);
    float midBox = sdRoundBox(mPos, mSize, vec4(0.1));
    float subMid = sdRoundBox(mPos, mSize * vec2(0.9, 0.925), vec4(0.05));
    subMid = min(subMid,
        sdBox(mPos, mSize * vec2(0.8, 1.5)));
    midBox = max(midBox, -subMid);
    float cB1 = sdBox(mPos + vec2(0., 0.), vec2(1.5, 0.2));
    vec4 cB1Col = mix(CORAL, BLACK, MarginSm(cB1));
    mCol = mix(mCol, cB1Col, MStep(cB1));
    float mAccent = sdBox(mPos + vec2(-0.4, 0.05), vec2(0.25, .1));
    vec4 aCol = mix(CREAM, BLACK, MarginSm(mAccent));
    mCol = mix(mCol, aCol, MStep(mAccent));
    col = mix(col, mCol, MStep(midBox));

    // y axis ruler things
    vec2 rulerOffset = vec2(0.6, 0.0);
    float ruler = sdBox(mPos + rulerOffset, vec2(0.03, 0.3));
    rulerOffset.x = abs(rulerOffset.x);
    rulerOffset.x -= 1.2;
    ruler = min(ruler, sdBox(mPos + rulerOffset, vec2(0.03, 0.3)));
    vec2 rUV = p * 9.0 - vec2(6.8, -5.1);
    rUV = opRepLim(rUV, vec2(1., .4), vec2(1., .0), vec2(1., 12.));
    float lines = sdBox(rUV, vec2(.2, .15));
    rUV = p * 9.0 - vec2(-4.3, -5.1);
    rUV = opRepLim(rUV, vec2(1., .4), vec2(1., .0), vec2(1., 12.));
    lines = min(lines, sdBox(rUV, vec2(.2, .15)));
    lines = max(lines, -midBox);
    vec4 rulerCol = mix(ORANGE, BLACK, MarginSm(ruler));
    // subtract the ruler lines after doing the outline so that they don't
    // get included in the outline and mess up the edge being flush
    // with the larger box
    ruler = max(ruler, -lines);
    col = mix(col, rulerCol, MStep(ruler));

    // the bobbing marker things
    float minY = 7.;
    float maxY = -7.;
    float mY = mix(minY, maxY,
        sinc(sin(iTime + 0.001 + iMouse.y * 0.01), 1.) * 0.5 + 0.25);
    //vec2 offset = vec2(14., mY);
    vec2 offset = vec2(14., 4.-snd*10.);
    float marker = sdRoundBox(mPos * 30. + offset,
        vec2(2., 0.75), vec4(2.));
    mY = mix(minY, maxY,
        sinc(sin(iTime * 1.2 + 0.5 + iMouse.x * 0.01), 1.1) * 0.5 + 0.25);
    //offset = vec2(-14., mY);
    offset = vec2(-14., 4.3-snareLevel*10.);
    marker = min(marker, sdRoundBox(mPos * 30. + offset,
        vec2(2., 0.75), vec4(2.)));
    col = mix(col, CREAM * 1.25, 1. - smoothstep(-0.005, 0., marker));

    DoText(p, col);

    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = p;
    // define bounds in normalized screen space (relative to center)
    /*
    vec2 boundsMin = vec2(-0.15, -.7);
    vec2 boundsMax = vec2( 0.65,  .05);
    */
    vec2 boundsMin = vec2(-0.55, -.8);
    vec2 boundsMax = vec2( 1.65,  .16);
    // check if inside
    if (uv.x < boundsMin.x || uv.x > boundsMax.x ||
        uv.y < boundsMin.y || uv.y > boundsMax.y) {
        //discard; // stop drawing this pixel
    }else{
        uv*=2.;
        uv.y+=.65;
        uv.x-=.45;
        uv = getPlane(uv);
        float a, b;
        vec3 from = vec3(0., a, -10.);
        vec3 dir = normalize(vec3(uv, min(1.1, iTime * .5)));
        col.rgb += march(from, dir);
    }


	fragColor = vec4(col.rgb, 1.0);
}
void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}
