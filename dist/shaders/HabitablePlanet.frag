// https://www.shadertoy.com/view/WdScRW
// Modified by ArthurTent
// Created by Kali
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// this song doesn't have the right volume. try it with another song to see VARIANT + VARIANT2
// planet flash + extra rotation
#define VARIANT
//background flash (by inverting whole screen when snare>0.71)
#define VARIANT2 
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
    
#ifdef VARIANT
    //p.xz*=rot(iAmplifiedTime *.4);
    p.xz*=rot(iAmplifiedTime *.12);
#endif 
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
#ifdef VARIANT
        if(snareLevel>0.71){
            //c = FFT(25)*.85*vec3(.5,.8,.7+snd) - c*(2.-snd*2.);
            //c = FFT(25)*.85*vec3(0.,1.3-sin(iAmplifiedTime*16.),1.3-(sin(iAmplifiedTime*20.)+snd)) - c*(2.-snd*2.);
            c = vec3(0.+snd,1.-sin(iAmplifiedTime*4.)/1.5,1.-(sin(iAmplifiedTime*7.)+snd)/3.) - c*(2.-snd*2.);
	    c/=(3.3+snd*2.);
	    c*=-1.;
	    
        }
#endif 
    }
    else
    {
        //bg
        vec3 bg = stars(rd)*(1.+30.*snd);
        c+=bg;

#ifdef VARIANT2
	if(snareLevel>0.71){
		c=1.-c;
	}
#endif 

    }
    g /= 60.;
    g*=snd*10.;
    return c + (pow(g, 1.3) + pow(g,1.7) * .5) * atmo_color * .5;
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

    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = (fragCoord - iResolution.xy * .5) / iResolution.y;

    uv = getPlane(uv);
    
    //camera + rd for stars
    vec2 cam_uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	rd = normalize(vec3(cam_uv,-1.5));
    mat3 t3 = mat3(1.0);
	camera(uv, ro, rd, t3);
    
	float a, b;
    float timediff = 5.;
    //vec3 from = vec3(0., a, -10.);
    vec3 from = vec3(0., a, -10.);
    //vec3 dir = normalize(vec3(uv, min(1.1, iTime * .5)));
    vec3 dir = normalize(vec3(uv, min(1.1+sin(iTime*.125)/4., iTime * .5)));
    if(iTime<timediff) dir = vec3(0.);//normalize(vec3(uv, min(1.1, .5)));
    else {

	uv/=(1.+FFT(1)/4.);
	dir = normalize(vec3(uv, min(1.1+sin((iTime-timediff)*.125)/5., (iTime-timediff) * .5)));
    
    }
    vec3 col = march(from, dir);
    
    // Output to screen
#ifdef VARIANT2
    // make whole screen flash
    if(snareLevel>0.71) fragColor = vec4(1.0 - col.rgb, 1.);
    else fragColor = vec4(col*.85,1.0);
#else
    fragColor = vec4(col*.85,1.0);
#endif 
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
