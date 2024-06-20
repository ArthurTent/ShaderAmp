// https://www.shadertoy.com/view/XdsyW4
// Modified by ArthurTent
// Created by Passion
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define NUM_STEPS 32
#define EPS 0.001
#define FAR_CLIP 15.0
#define LEVELS_SCALAR 1.0

#define time iTime

// reference: https://www.shadertoy.com/view/4lGSzy
// 2017 passion

float noise3D(vec3 p)
{
	return fract(sin(dot(p ,vec3(12.9898,78.233,12.7378))) * 43758.5453)*2.0-1.0;
}

vec3 mixc(vec3 col1, vec3 col2, float v)
{
    v = clamp(v,0.0,1.0);
    return col1+v*(col2-col1);
}

// polynomial smooth min (k = 0.1);
float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

mat3 lookAt(vec3 origin, vec3 target, float roll) {
  vec3 rr = vec3(sin(roll), cos(roll), 0.0);
  vec3 ww = normalize(target - origin);
  vec3 uu = normalize(cross(ww, rr));
  vec3 vv = normalize(cross(uu, ww));

  return mat3(uu, vv, ww);
}

float map(vec3 p){
    float c = length(p) - 0.5;

    float c1 = length(p) - 0.20;
    p.x += .75*sin(time*1.4);
    p.y -= .75*cos(time/2.);
    p.z += .75*cos(time+sin(time));

    float c2 = length(p) - 0.33;
    p.x -= .75*sin(time/.4);
    p.y += .75*cos(time/2.);
    p.z -= .75*cos(time+sin(time*3.));

    float c3 = length(p) - 0.30;
    p.x += .75*cos(time/2.4);
    p.y -= .75*cos(time*1.2);
    p.z += .75*sin(time+sin(time));

    float c4 = length(p) - 0.175;
    p.x -= .75*sin(time*1.8);
    p.y += .75*sin(time/2.);
    p.z -= .75*cos(time+sin(time));

    float f = smin(c, c2, .3);
    f = smin(f, c1, .2);
    f = smin(f, c3, .33);
    return smin(f, c4, .4);
}


float trace(vec3 r, vec3 o){
    float t = 0.0;
    for(int i = 0; i < NUM_STEPS; i++){
        vec3 p = o+r * t;
        float d = map(p);
        if(abs(d) < EPS || t > FAR_CLIP)
            break;
        t += d;// * 0.75;
    }
    return t;
}

vec3 getNormal(vec3 p){
    vec2 e = vec2(0.0, EPS);
	return normalize((vec3(map(p + e.yxx),
                           map(p + e.xyx),
                           map(p + e.xxy)) - map(p)) / e.y);
}

void main()
{
	//vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    gl_FragColor = vec4(0.0);

    //float time = iTime;

    vec3 l = normalize(vec3(0.3, 0.8, 0.2));
    vec3 ray = normalize(vec3(uv, 1.0 - dot(uv, uv) * .25));
    vec3 o = vec3(2.0*cos(time), -.5*.75+sin(time/2.)*.75,
                  2.0*sin(time));
    mat3 camMat = lookAt(o, vec3(0.0), sin(time*.13)*.25);

    ray = camMat * ray;

    vec3 col = vec3(0.0);
    vec3 ref = vec3(0.0);

    // https://www.shadertoy.com/view/4lGSzy
    float nBands = 32.0;
    float i = floor(ray.x*nBands);
    float f = fract(ray.x*nBands);
    float band = i/nBands;
    band *= band*band;
    band = band*0.995;
    band += 0.005;
    float s = texture( iAudioData, vec2(band,0.25) ).x;

    /* Gradient colors and amount here */
    const int nColors = 4;
    vec3 colors[nColors];
    colors[0] = vec3(0.0,0.0,1.0);
    colors[1] = vec3(0.0,1.0,1.0);
    colors[2] = vec3(1.0,1.0,0.0);
    colors[3] = vec3(1.0,0.0,0.0);

    vec3 gradCol = colors[0];
    float nc = float(nColors)-1.0;
    for(int i = 1; i < nColors; i++)
    {
		gradCol = mixc(gradCol,colors[i],(s-float(i-1)/nc)*nc);
    }

    col += vec3(1.0-smoothstep(0.0,0.01,ray.y-s*LEVELS_SCALAR));
    col *= gradCol;

    ref += vec3(1.0-smoothstep(0.0,-0.01,ray.y+s*LEVELS_SCALAR));
    ref*= gradCol*smoothstep(-0.5,0.5,ray.y);

    col = mix(ref,col,smoothstep(-0.01,0.01,ray.y));

    col *= smoothstep(0.125,0.375,f);
    col *= smoothstep(0.875,0.625,f);

    col = clamp(col, 0.0, 1.0);

    float dither = noise3D(vec3(ray.zy,time))*15.0/256.0;
    col += dither;


    float hit = trace(ray, o);
    vec3 sp = o+ray * hit;
    float d = map(sp);
    vec3 n = getNormal(sp);


    float diff = clamp(dot(n, l), 0.15, 1.0);

    if(abs(d) < 0.05)
        gl_FragColor = vec4(s*.15, 0.5-s, s, 0.1);
    else
        gl_FragColor = vec4(col*s, 1.0);

}