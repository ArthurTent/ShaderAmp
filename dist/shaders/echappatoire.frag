// https://www.shadertoy.com/view/7lBXRG
// Modified by ArthurTent
// Created by sukupaper 
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
varying vec2 vUv;

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;

#define P 6.283185307
#define PI              3.141592654
#define TAU             (2.0*PI)
const float div = 4.9, spiralspeed = P/35.;
vec3 c, map;
float t, roomId;
int matid=0, doorpart=0;

mat2 rot(in float a) { return mat2(cos(a),sin(a),-sin(a),cos(a)); }

float box(in vec3 p, in vec3 s, in float r) { return length(max(abs(p) - s,0.)) - r; }
float box(in vec2 p, in vec2 s) { p = abs(p) - s; return max(p.x,p.y); }
float cyl(in vec3 p, in float h, in float r) {
  vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(h,r);
  return min(max(d.x,d.y),0.) + length(max(d,0.));
}
// colormap
vec3 palette(float t) {
    if(t <1.)t+=1.;
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.);
    vec3 d = vec3(0.563,0.416,0.457 + .2);
    
    return a + b*cos( 6.28 * c * (t+d)); // A + B * cos ( 2pi * (Cx + D) )
}
// used to rotate domain of noise function
const mat2 rot2 = mat2( 0.80,  0.60, -0.60,  0.80 );

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}
float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);

    float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
   return res*res;
}
// fast implementation of fBM
float fbm( vec2 p )
{
    float iter = mod(iAmplifiedTime, 3.); 
    float f = 0.0;
    f += 0.500000*noise( p + 0.1 * sin(iAmplifiedTime ) + 0.2 * iAmplifiedTime); p = rot2*p*2.02;
    f += 0.031250*noise( p  ); p = rot2*p*2.01;

    float whichroom = step(.5,fract(roomId/2.));
    //f += 0.28*noise(p);p=rot2*p*whichroom;

    f += 0.250000*noise( p ); p = rot2*p*2.03;
    f += 0.125000*noise( p + 0.1 * sin(iAmplifiedTime) + 0.2 * iAmplifiedTime ); p = rot2*p*2.01;
    f += 0.062500*noise( p + 0.3 * sin(iAmplifiedTime) ); p = rot2*p*2.04;
    f += 0.015625*noise( p );
    return f/0.96875;
}

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

// nested fBM
float pattern( vec2 p ) {
    if(step(.5, fract(roomId/2.))<1.){
    } 
    return fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))) ) )*snd*10.;
}


float door(in vec3 p, in vec3 s, in float opened) {
    p.x -= s.x; p.xz *= rot(opened); p.x += s.x;
    float ddbis = -max(box(vec3(p.x, mod(abs(p.y + .2) - .2, 1.285) - .6425, abs(p.z) - .03), s*vec3(1.,.5,1.), .01), box(p, s*vec3(.725,.85,1.), .02));
    float dd = box(p, s, .01);
    p.z = abs(p.z); p.x += .435;
    float ddd = min(length(max(abs(vec2(length(p.xy) - .012, p.z - .075)) - vec2(.01,.0),0.)) - .015, length(max(abs(vec2(length(p.xy) - .01, p.z - .012)) - vec2(.02,.0),0.)) - .015);
    ddd = min(ddd, cyl(p.yzx, .015, .075));
    float d = min(max(dd, ddbis), ddd);
    doorpart = d == dd ? 1 : 0;
    return d;
}

float df(in vec3 p) {
    p.xy *= rot(cos(p.z*spiralspeed)*1.75);
    
    float pz = p.z;
    float Pz = floor(p.z/div + .4)*div;
    roomId = floor(p.z/div + .5);
    p.z = mod(pz, div) - div*.5;
    
    float pz2 = pz/(div*2.) + 0.24  ;
    p.xy = mix(p.xy,p.yx,mod(floor(pz2),2.))*sign(mod(floor(pz2 + .5),2.) - .5);
    map = p;
    
    const vec3 doorSize = vec3(.5, 1.125, .01);
    float wall = box(p.xy, vec2(1.5));
    p.y += doorSize.y/3.;
    
    float dap = abs(Pz - c.z + div/2.);
    float door = door(p, doorSize, P*.35*(cos(clamp( (dap*dap*dap)*.0125 ,-3.14,3.14))*.5 + .5));
    
    float endwall = abs(p.z) - .01;

    float plaintesFond = max(endwall, p.y + 1.05) - .025;
    float doorShape = box(p.xy, doorSize.xy);
    float doorShapeExtr = max(doorShape - .05, abs(p.z) - .035);
    float walls = min(abs(wall) - .01, max(max(wall, min(min(endwall, doorShapeExtr), plaintesFond)),  -doorShape));
        
    float plaintes = max(-wall, p.y + 1.02) - .025;
    
    float d = min(min(walls, door), plaintes);
    
    matid = d == plaintesFond || d == doorShapeExtr ? 3 : d == door ? 1 : d == walls  ? 2 : 3;
    
    return d;
}

#define LIM .001
#define MAX_D 20.
#define MAX_IT 50
struct rmRes { vec3 pos; int it; bool hit; };
rmRes rm(in vec3 c, in vec3 r) {
    vec3 p = c;
    int it;
    bool hit = false;
    for(int i = 0; i < MAX_IT; i++) {
        float d = df(p);
        if(d < LIM) { hit = true; break; }
        if(distance(c,p) > MAX_D) break;
        p += d*r;
        it = i;
    }
    rmRes res;
    res.pos = p;
    res.it = it;
    res.hit = hit;
    return res;
}

vec3 plane2sphere(in vec2 p) {
    float t = -4./(dot(p,p) + 4.);
    return vec3(-p*t, 1. + 2.*t);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    snd*=1.6;
    
    vec2 st = (fragCoord.xy - iResolution.xy*.5)/iResolution.x;
    t = iAmplifiedTime < 0.01 ? 98. : iAmplifiedTime*5. ;
        
    c = vec3(0.,0.,t);
    vec3 r = -plane2sphere(st*5.);
    r.xz *= rot(cos(t*spiralspeed/3.)*.75);
    r.xy *= rot(-cos(t*spiralspeed)*1.75);

    rmRes res = rm(c,r);
    
    vec3 n = vec3(0.), b = vec3(.88);
    float whichroom = step(.5,fract(roomId/2.));
    vec3 c1 = mix(n,b,whichroom), c2 = mix(b,n,whichroom);
    c2*=palette(pattern(st));
    
    vec3 rd = normalize(vec3(st,-1.5));
    vec3 bg = stars(rd)*(1.+30.*snd);
    //c2+=bg;
    
    if(whichroom>0.5){
   	c2+=bg; 
    }else{
    }  
 
    vec3 color = c2;
    if(res.hit)
        if(matid == 1) color = doorpart == 1 ? c2/palette(pattern(st)) : c1;
        else if(matid == 2) color = c2;
        else {
            if(map.y < -1.45) {
                if(map.z > .1 || map.z < 0.) {
                    map.xz *= rot(3.14*.25);
                    map.xz *= 10.;
                    color = mix(c1,c2/palette(pattern(st)),step(0.,cos(map.x)*cos(map.z)));//*palette(snd*2.);                    
                } else
                    color = c2/palette(pattern(st));//*palette(snd*2.);
            } else color = c1;//*palette(snd*2.);
        }
    
    float l = length(st);
    fragColor = vec4(color - l*l*.5,1.0);
}


void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}
