// https://www.shadertoy.com/view/MfGBWm
// Modified by ArthurTent
// Created by vanshika
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// Modified source on shadertoy.com: https://www.shadertoy.com/view/4cVBDw

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define EYES 80.
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


float Eye(vec2 p, vec2 offs, float s1, float s2, float size){
    float c1 = smoothstep(s1, s1-.01, length(size*p));
    float c2 = smoothstep(s2, s2-.01, length(size*p-offs));
    c1 += .003/length(p);  // for brightness
    c1/=(0.2+snd);
    return c1-c2;
}

mat2 Rot(float a){
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);

    vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
    vec3 cam = normalize(vec3(1.5,uv));
    vec2 cam_uv = (fragCoord-.5*iResolution.xy)/iResolution.y;

    //camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(cam_uv,-1.5));
    mat3 t3 = mat3(1.0);
	camera(uv, ro, rd, t3);
    vec3 bg = stars(rd)*(1.+30.*snd);

    uv *= 5.5;
    uv *= Rot(3.1415/2.);
    //vec3 col = vec3(0);
    vec3 col = bg;
    float f = atan(uv.y, uv.x+2.3)/6.28318;


    float a = smoothstep(.37, .36, length(uv))-smoothstep(.28, .27, length(uv-vec2(.1, -.05)));
    float fade = sin(uv.x+.5)*.5+.5;

    for(float i=0.; i<1.; i+=1./EYES){
        vec2 coord = uv-vec2(4.*i-2.2, i*sin(iAmplifiedTime*i)+i*cos(iAmplifiedTime*i));
        float t = smoothstep(i, 0., abs(length(coord)));
        col += t*.15*vec3(.1, .4, .3);
        float eye = Eye(coord, vec2(-.3*sin(iAmplifiedTime),.3*cos(iAmplifiedTime)), .6, .45, 5./i)*FFT(i*2.);
        vec3 color = sin(.2*iAmplifiedTime*vec3(3., 5., 2.)*i)*.5+.5;
        color.z *= .3;
        col += eye * color;
    }

    fragColor = vec4(col,1.0);
}
void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}

