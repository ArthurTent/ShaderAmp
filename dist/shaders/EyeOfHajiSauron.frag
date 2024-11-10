// https://www.shadertoy.com/view/X3jcWR
// Modified by ArthurTent
// Created by arminkz 
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

// one beat to rule them all
#define MULTI_COLOR
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
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

// colormap
vec3 palette(float t) {
    if(t <1.)t+=1.;
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.);
    vec3 d = vec3(0.563,0.416,0.457 + .2);
    
    return a + b*cos( 6.28 * c * (t+d)); // A + B * cos ( 2pi * (Cx + D) )
}

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

// used to rotate domain of noise function
const mat2 rot = mat2( 0.80,  0.60, -0.60,  0.80 );

// fast implementation of fBM
float fbm( vec2 p )
{
    float f = 0.0;
    f += 0.500000*noise( p + 0.1 * sin(iTime ) + 0.2 * iTime); p = rot*p*2.02;
    f += 0.031250*noise( p  ); p = rot*p*2.01;
    f += 0.250000*noise( p ); p = rot*p*2.03;
    f += 0.125000*noise( p + 0.1 * sin(iTime) + 0.2 * iTime ); p = rot*p*2.01;
    f += 0.062500*noise( p + 0.3 * sin(iTime) ); p = rot*p*2.04;
    f += 0.015625*noise( p );
    return f/0.96875;
}

float fbm2( vec2 p )
{
    float f = 0.0;
    f += 0.500000*noise( p ); p = rot*p*2.02;
    f += 0.031250*noise( p ); p = rot*p*2.01;
    f += 0.250000*noise( p ); p = rot*p*2.03;
    f += 0.125000*noise( p ); p = rot*p*2.01;
    f += 0.062500*noise( p ); p = rot*p*2.04;
    f += 0.015625*noise( p );
    return f/0.96875;
}

float fbm3(vec2 uv)
{
	float f;
	mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
	f  = 0.5000*noise( uv ); uv = m*uv;
	f += 0.2500*noise( uv ); uv = m*uv;
	f += 0.1250*noise( uv ); uv = m*uv;
	f += 0.0625*noise( uv ); uv = m*uv;
	f = 0.5 + 0.5*f;
	return f*(.8+snd*5.);
}


// nested fBM
float pattern( vec2 p ) {
    return fbm( p + fbm( p + fbm(p) ) )*snd*10.;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    /*
	//snd = (FFT(1)+FFT(25)+FFT(50)+FFT(75))/4.;
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    //snd*=2.8;
    //snd*=1.8;
    snd*=1.6;
	*/
    vec2 cam_uv = -1.0 + 2.0 *vUv;
    
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(cam_uv,-1.5));
    mat3 t3 = mat3(1.0);
	camera(cam_uv, ro, rd, t3);
    
    vec2 uv = (fragCoord - .5*iResolution.xy)/iResolution.y;
    /*
    float scale = 2.;
    uv = (uv-0.5)*scale+1.;
    */

    vec2 uv2 = uv;
    uv2.x *= 2.0;
    uv.x = abs(uv.x);

	float smooth_view = 0.5;
	
		
		
		
    float d1 = length(uv2-vec2(-0.5,0.));
    float d2 = length(uv2-vec2(0.5,0.));
	
	//float smoothd2 = .4+clamp((sin(iTime) - 0.45)/ (0.55 - 0.45), 0.0, 1.0);
	
    float dc = length(uv);
   
    
    float r = sqrt(dot(uv,uv));
    float a = atan(uv.y,uv.x);

    
	if(smooth_view >0.){
	}else{
	}
    vec3 around_eye = smoothstep(0.1,-0.1,abs(max(d1,d2)-0.5) - 0.2)*(.8+5.*snd) * vec3(0.99, 0.81, 0.27);
    //vec3 around_eye = smoothstep(0.1,-0.1,abs(max(d1+.2,d2)-0.5) - 0.2)*(.8+5.*snd) * vec3(0.99, 0.81, 0.27);
    #ifdef MULTI_COLOR
        around_eye *= 0.5+ palette(snd*2.);
        //around_eye = smoothstep(0.1,-0.1,abs(max(d1+.2,d2)-0.5) - 0.2)*(.8+5.*snd) * vec3(0.99, 0.81, 0.27);
        //around_eye*=10.;
    #endif

    vec3 strs = normalize(vec3(uv2,-1.5));
    vec3 col = vec3(0.);
    //vec3 rd = normalize(vec3(uv2,-1.5));
    vec3 p1 = mix(vec3(1.,.25,0.1),vec3(0.2,0.2,0.3), fbm(3.*uv));
    #ifdef MULTI_COLOR
        //p2=vec3(1.5*flame*(1.+FFT(25)*1.5), 2.*pow(flame*(1.+FFT(50)*1.5),3.), pow(flame*(1.+snd*1.5),6.) );
        p1 *= 0.5+ palette(snd*2.);
        //p1 *=palette(snd*20.);
    #endif
    
    float sa = abs(fract(a/6.)-0.5);
    float n = fbm2(2. * vec2(r - 0.5*iTime, sa));
    float n2 = fbm3(7. * vec2(r - 0.7*iTime, a));
    
    float flame = (0.5*n + 0.8*n2) * (1. - 1.5*r);
    //flame*=snd*1.;
	if(smooth_view >0.){
        
    }else{
	}

    vec3 p2 = vec3(1.5*flame, 2.*pow(flame,3.), pow(flame,6.) );
    
    #ifdef MULTI_COLOR
        //p2=vec3(1.5*flame*(1.+FFT(25)*1.5), 2.*pow(flame*(1.+FFT(50)*1.5),3.), pow(flame*(1.+snd*1.5),6.) );
        p2 *= 0.5+ palette(snd*2.);
    #endif

    vec3 p3 = mix(around_eye, p2, max(d1,d2)*(.5+smooth_view));
    #ifdef MULTI_COLOR
        //p2=vec3(1.5*flame*(1.+FFT(25)*1.5), 2.*pow(flame*(1.+FFT(50)*1.5),3.), pow(flame*(1.+snd*1.5),6.) );
        p3 *= 0.5+ palette(snd*2.);
    #endif
    //p3 *= mix(p3,vec3(0.75),r);
    //p3*=FFT(25);
    
    //if(dc > 0.45) {
    //    col = mix(p1,p3,r);
    //}
    //else{
    //    
    //}
    
    col = p3;
    col *= smoothstep(0.6,0.65,max(d1,d2));
    
    // eye
    col += smoothstep(0.03,-0.1,abs(max(d1,d2)-0.6) - 0.05) * vec3(0.99, 0.81, 0.27)*snd;
    #ifdef MULTI_COLOR
        col*=0.5+palette(snd*2.);
    #endif
    
    
    // the ring
    //col += smoothstep(0.01,-0.1,abs(dc-0.45) - 0.05)*(.8+5.*snd)  * vec3(0.99, 0.81, 0.27);
    #ifndef MULTI_COLOR
        col += smoothstep(0.01,-0.1,abs(dc-0.45) - 0.05)*(.8+5.*snd)  * vec3(0.99, 0.81, 0.27) *palette(snd*2.);
    #endif
    #ifdef MULTI_COLOR
        //p2=vec3(1.5*flame*(1.+FFT(25)*1.5), 2.*pow(flame*(1.+FFT(50)*1.5),3.), pow(flame*(1.+snd*1.5),6.) );
        col += smoothstep(0.01,-0.1,abs(dc-0.45) - 0.05)*(.8+5.*snd)  * vec3(0.99, 0.81, 0.27) *palette(snd*2.);
    #endif
    
	//where does all the blue color come from :-/
    //col.b=0.;
    //col.b/=snd*2.;
	//if(max(d1,d2) < 0.6) {
    //   col = vec3(0.);
    //}
    rd.x+=sin(iTime/1000.)*2.;
    vec3 bg = stars(rd)*(1.+30.*snd);
    //col = mix(bg, col, step(0.01, length(col))); 
    col+=bg;
    fragColor = vec4(col,1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}
