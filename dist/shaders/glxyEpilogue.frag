// https://www.shadertoy.com/view/MtdfRM
// Modified by ArthurTent
// Created by vadevaman
// License Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.
// Created by genis sole - 2017
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

const vec3 wireColor1 = vec3(0.7,0.8,0.6);
const vec3 wireColor2 = vec3(0.1,0.2,0.7);
const float contrast = 0.5;
const float PI = 3.1415926;


//David Hoskins' hash from https://www.shadertoy.com/view/4djSRW
float hash(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) *  443.8975);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p)
{
    vec2 i = floor(p);
	vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0));

    float c1 = b - a;
    float c2 = c - a;
    float c3 = d - c - b + a;

    vec2 u = f * f * (3.0 - 2.0 * f);

   	return a + u.x*c1 + u.y*c2 + u.x*u.y*c3;
}


float fbm(vec2 p)
{
    vec4 s = vec4(texture(iAudioData, vec2(0.0, 0.0)).r,
    			  texture(iAudioData, vec2(0.25, 0.0)).r,
    			  texture(iAudioData, vec2(0.50, 0.0)).r,
    			  texture(iAudioData, vec2(0.75, 0.0)).r);
    p += vec2(s.x - s.w, s.z - s.y);

	float h = vnoise(p) * s.x;
    h += vnoise(p * 2.0) * s.y * 0.5;
    h += vnoise(p * 4.0) * s.z * 0.3;
    h += vnoise(p * 8.0) * s.w * 0.2 ;

    return h;
}

//From https://iquilezles.org/articles/palettes
vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 color(vec2 p)
{
    return pal(0.3+hash(p)*0.3,
               wireColor1, vec3(contrast), vec3(1.0),
               wireColor2);
}

float map( vec2 p )
{
	return clamp(fbm((p+100.+iTime)*0.2)*8.0 - 4.0 + hash(p + 10.0)*1.0, -5.0, 5.0);
}

vec3 traverse_mesh( vec3 ro, vec3 re, vec3 rd)
{

    float maxd = length(re.xz - ro.xz);
    float td = maxd;

    float rs = rd.y / length(rd.xz);
    vec2 d = normalize(rd.xz);
    vec2 id = 1.0/d;
    vec2 o = ro.xz;

    float d1 = 0.0, d2 = 0.0;
    vec3 n1 = vec3(0.0), n2 = vec3(0.0);
    vec3 p1 = vec3(0.0), p2 = vec3(0.0);
    vec2 i = vec2(0.0);

    float r1 = 0.0, r2 = 0.0;
    vec3 a = vec3(0.0);
    for( int s = 0; s < 20; ++s ){
        i = floor(o);

		vec2 m = (i - o) * id;
    	vec2 t = max(m, m + id);
        float dist = min(t.x, t.y);
    	o += d*(dist + 0.001);

        vec3 t1 = vec3(i, map(i)).xzy;
        vec3 t2 = vec3(i + vec2(1.0, 0.0), map(i + vec2(1.0, 0.0))).xzy;
        vec3 t3 = vec3(i + vec2(0.0, 1.0), map(i + vec2(0.0, 1.0))).xzy;
        vec3 t4 = vec3(i + vec2(1.0), map(i + vec2(1.0))).xzy;

        vec3 v21 = normalize(t2 - t1);
        vec3 v41 = normalize(t4 - t1);
        vec3 v31 = normalize(t3 - t1);
        vec3 v43 = normalize(t4 - t3);
        vec3 v42 = normalize(t4 - t2);

     	n1 = normalize(cross(v21, v41));
        n2 = normalize(cross(v41, v31));

        r1 = dot(t1 - ro, n1) / (dot(rd, n1));
        r2 = dot(t1 - ro, n2) / (dot(rd, n2));

        p1 = ro + rd*r1;
        p2 = ro + rd*r2;

        float a1 = dot(p1 - t1, cross(v41, n1));
        float b1 = dot(p1 - t1, cross(n1, v21));
    	float c1 = dot(p1 - t2, cross(n1, v42));

        float a2 = dot(p2 - t1, cross(n2, v41));
        float b2 = dot(p2 - t1, cross(v31, n2));
    	float c2 = dot(p2 - t3, cross(v43, n2));

        d1 = min(min(a1, b1), c1);
        d2 = min(min(a2, b2), c2);

        vec3 col1 = color(i) + 0.1;
        vec3 col2 = color(i + 1.0) + 0.1;
        float con = ro.y + (maxd-td)*rs;

        a += exp(-abs((t3.y + t2.y)*0.5 - con)) * 0.08 * (col1 + col2)*0.85;

        a += pow(max(0.5, (1.0 - d1)*step(0.0, d1)), 16.0) * col1;
        a += pow(max(0.5, (1.0 - d2)*step(0.0, d2)), 16.0) * col2;

        //if (d1 > 0.0 || d2 > 0.0) break;
        if ((td -= dist) < 0.01) break;
    }


    return vec3(clamp(a*1.5 + 0.09, 0.0, 1.0));

    /*
    if( maxd < 0.01) return vec3(0.1);

    float m = 1.0;
    if (d1 > 0.0 && d2 > 0.0) m = step(r2, r1);
    else if (d1 > 0.0) m = 0.0;
 	*/
}

void camera(vec2 fragCoord, out vec3 ro, out vec3 rd, out mat3 t)
{
    float a = 1.0/max(iResolution.x, iResolution.y);
    //rd = normalize(vec3((fragCoord - iResolution.xy*0.5)*a, 0.5));
    rd = normalize(vec3(fragCoord, 1.0));

    ro = vec3(0.0, 0.0, -15.);

    float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y));
    vec2 m = PI*ff + vec2(((iMouse.xy + 0.1) / iResolution.xy) * (PI*2.0));
    //m.y = -m.y;
    m.y = sin(m.y*0.5)*0.3 + 0.5;

    vec2 sm = sin(m), cm = cos(m);
    mat3 rotX = mat3(1.0, 0.0, 0.0, 0.0, cm.y, sm.y, 0.0, -sm.y, cm.y);
    mat3 rotY = mat3(cm.x, 0.0, -sm.x, 0.0, 1.0, 0.0, sm.x, 0.0, cm.x);

    t = rotY * rotX;

    ro = t * ro;
    rd = t * rd;

    rd = normalize(rd);
}

bool iRayAABox(in vec3 ro, in vec3 rd, in vec3 invrd, in vec3 b,
               out vec3 p0, out vec3 p1, out vec3 n) {
    vec3 t0 = (-b - ro) * invrd;
    vec3 t1 = (b - ro) * invrd;

    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float fmin = max(max(tmin.x, tmin.y), tmin.z);
    float fmax = min(min(tmax.x, tmax.y), tmax.z);

    p0 = ro + rd*fmin;
    p1 = ro + rd*fmax;
    n = -sign(rd)*step(tmin.yzx, tmin.xyz)*step(tmin.zxy, tmin.xyz);

    return fmax >= fmin;
}

void main()
{
    vec3 ro = vec3(0.0), rd = vec3( 0.0 );
    mat3 t = mat3(1.0);
    vec2 uv = -1. +2.*vUv;
    camera(uv, ro, rd, t);

    vec3 p0 = vec3(0.0), p1 = vec3(0.0), n = vec3(0.0);
    vec3 c = vec3(0.1);
    if( iRayAABox(ro, rd, 1.0/rd, vec3(5.0), p0, p1, n) ) {
    	c = traverse_mesh(p0 + rd*0.01, p1 - rd*0.01, rd);
    }

    gl_FragColor = vec4(pow(c, vec3(0.94545)),1.0);
}