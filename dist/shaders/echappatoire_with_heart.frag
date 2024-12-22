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
vec3 getTexture(vec2 p){
	p.x*=.5;
    p.x+=.25;
	p.y+=sin(iTime/10.)/100.;
    p.x+=sin(iTime/10.)/100.;
    vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}

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

    f += 0.250000*noise( p ); p = rot2*p*2.03;
    f += 0.125000*noise( p + 0.1 * sin(iAmplifiedTime) + 0.2 * iAmplifiedTime ); p = rot2*p*2.01;
    f += 0.062500*noise( p + 0.3 * sin(iAmplifiedTime) ); p = rot2*p*2.04;
    f += 0.015625*noise( p *(1.+snd*2.));
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
// test pattern
float heartRadius(float theta)
{
    //return 2. - 2.*sin(theta) + sqrt(abs(cos(theta)))*sin(theta)/(1.4 + sin(theta));
    return 2. - 2.*sin(theta) + sqrt(abs(cos(theta)))*sin(theta)/(1.4 + sin(theta));
}
#define TWO_PI 2.*PI
#define penta_or_heartgon(uv) polygon(uv, 5.)

mat2 r2d(float a) {
	float c = cos(a), s = sin(a);
	return mat2(c, s, -s, c);
}

// from: https://thndl.com/square-shaped-shaders.html
float polygon(vec2 uv, float n) {
	float a = atan(uv.x, uv.y) + PI;
	float r = TWO_PI / n;
	return cos(floor(.5 + a / r) * r - a) * length(uv);
}

float inner(float dist, float radius, float size) {
	return abs(dist - radius) * size;
}
float testPattern(vec2 p) {
    p/=(1.+snd);
	p*=2.5;
    p*= r2d(sin(iAmplifiedTime));
    float pen1 = penta_or_heartgon(p * vec2(1, -1));
	float pen2 = penta_or_heartgon(p);
	float d = inner((pen1 - pen2 * .619) * 4.2, .3, .8);

	// circle
	d = min(d, inner(length(p), .35, 2.));

	// penta_or_heartgon
	d = min(d, inner(pen2, .123, 2.5));
    return smoothstep(.1,.11,d);
}
/*
vec2 path(float t) {
    float a = sin(t*.2+1.5),b=sin(t*.2);
    return vec2(a*2., a*b);
}
mat2 r2d(float a) {
    float c=cos(a),s=sin(a);
    return mat2(c, s, -s, c);
}

void mo(inout vec2 p, vec2 d) {
    p.x = abs(p.x) - d.x;
    p.y = abs(p.y) - d.y;
    if(p.y>p.x)p=p.yx;
}
float g=0.;
float de(vec3 p) {
   
    vec3 q = p;
    q.x += q.z*.1;
    q.z += iTime*.1;
    q = mod(q-1., 2.)-1.;
    float s = length(q) - .001 + sin(iTime*30.)*.005;
    
    p.xy -= path(p.z);
    
    p.xy *= r2d(p.z*.9);
    mo(p.xy, vec2(.6, .12));
    mo(p.xy, vec2(.9, .2));
    
    p.xy *= r2d(p.z*.5);
    
    mo(p.zy, vec2(.1, .2));
    p.x = abs(p.x) - .4;
    float d = length(p.xy) - .02 - (.5+.5*sin(p.z))*.05;
    
    d = min(d, s);
    
    
    g+=.01/(.01+d*d);
    return d*snd;
}
float testPattern( vec2 p ) {
	float dt = iAmplifiedTime * 6.;
    vec3 ro = vec3(0,0, -3. + dt);
    vec3 ta = vec3(0, 0, dt);
    
    ro.xy += path(ro.z);
    ta.xy += path(ta.z);
    
    vec3 fwd = normalize(ta -ro);
    vec3 left = cross(vec3(0,1,0),fwd);
    vec3 up = cross(fwd, left);
    
    vec3 rd = normalize(fwd + left*p.x+up*p.y);

    vec3 p3;
    float ri,t=0.;
    for(float i=0.;i<1.;i+=.01) {
    	ri = i;
        p3=ro+rd*t;
        float d = de(p3);
        if(d<.001) break;
        t+=d*.2;
    }
	return ri+t;
}
*/
float theta = 0.;
float h_lenght=0.;
float penta_or_heart = 0.;
// end of test pattern
// nested fBM
float pattern( vec2 p ) {
    float bla = penta_or_heart+fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))*(1.+snd*2.)) ) )*snd*10.; 
    //float bla = fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))) ) );//*snd*10.; 
	//penta_or_heart = testPattern(p);
	penta_or_heart = heartRadius(theta);
    if(penta_or_heart>0.){
		//return bla * smoothstep(0.0, h_lenght, 1.5*penta_or_heart*.0125)*4.*(1.+snd*5.);
		return 2.*(1.+snd)*bla * smoothstep(0.0, h_lenght, 1.5*penta_or_heart*.0125)*10.;
	}
	
	return 0.;
	/*
  	//return fbm(p)+testPattern(p);
    //float theta = atan(p.y, p.x);
    //p.x+=sin(iTime/10.)/20.;
    //p.y+=sin(iTime/10.)/20.; 
	//float penta_or_heart = testPattern(p);
    //float penta_or_heart = heartRadius(theta);
    //float bla = testPattern(p)+fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))) ) )*snd*10.; 
    //float bla = penta_or_heart+fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))) ) )*snd*10.; 
    //float bla = penta_or_heart+fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))) ) );//*snd*10.; 
    float bla = penta_or_heart+fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))) ) );//*snd*10.; 
    //if(penta_or_heart==0.){
    //if(mod(iAmplifiedTime, 5.)>2.){
    	float whichroom = step(.5,fract(roomId/2.));
		if(mod(iAmplifiedTime, 4.) >2.) {
				penta_or_heart = testPattern(p);
				if(penta_or_heart==0.){
					return fbm(p)+penta_or_heart;
				}else{
					return 0.;
				}
		}else{
		}
	//}
    if(penta_or_heart>0.){
		//return smoothstep(0.0, length(p)*.5, .5*penta_or_heart*.0125);
		//return smoothstep(0.0, h_lenght, .5*penta_or_heart*.0125*(1.+snd*10.));
		//return bla * smoothstep(0.0, h_lenght, 1.5*penta_or_heart*.0125*(1.+snd*10.));
		return bla * smoothstep(0.0, h_lenght, 1.5*penta_or_heart*.0125)*(1.+snd*2.);
		return bla;
	}
	
	return 0.;
	*/
    //return fbm( p*snd*2. + fbm( p + fbm(p*(.5+sin(iAmplifiedTime))) ) )*snd*10.;
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
    
    vec2 uv = -1.0 + 2.0 *vUv;
	uv.y-=.5;
    vec2 st = (fragCoord.xy - iResolution.xy*.5)/iResolution.x;
    theta = atan(uv.y, uv.x);
	h_lenght = length(uv);
    penta_or_heart = heartRadius(theta);
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
	//c2*=palette(pattern(st*2.5+.5));
	//c2*=palette(pattern(st*.5+.5));
    
    vec3 rd = normalize(vec3(st,-1.5));
    vec3 bg = stars(rd)*(1.+30.*snd);
    //c2+=bg;
    
    if(whichroom>0.5){
   	c2+=bg; 
    }else{
    	//c2+=getTexture(st*1.5+.5);
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
                } else{
                    color = c2/palette(pattern(st));//*palette(snd*2.);
				}
            } else color = c1;//*palette(snd*2.);
        }
    
    float l = length(st);
    fragColor = vec4(color - l*l*.5,1.0);
}


void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}
