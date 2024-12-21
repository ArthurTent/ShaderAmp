// https://www.shadertoy.com/view/lcBSWR
// Modified by ArthurTent
// Created by ramansinghdhiman
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
#define AA 1.5/iResolution.y
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


float ss(float e, float v)
{
    return smoothstep(e - AA, e + AA, v);
}

float ss(float e, float v, float m)
{
    float a = m * AA;
    return smoothstep(e - a, e + a, v);
}

void main()
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    vec2 uv =  -1.0 + 2.0 *vUv;
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(uv,-1.5));
    mat3 t = mat3(1.0);
	camera(uv, ro, rd, t);
    uv = (-uv * 2.0);

    float barCount = 50.0;

    float r = atan(uv.x, uv.y) / 3.14159;
    r = (r + 1.0) / 2.0;

    float ir = floor(r * barCount) / barCount;

    float s = 0.3;

    float vs = 20.0;

    float w = texture(iAudioData, vec2(ir, 0.0)).r;
    w = mix(s, 1.0, w);
    w = floor(w * vs) / vs;

    float d = length(uv);

    float b = fract(r * barCount);
    b = ss(0.15, b, barCount) - ss(0.85, b, barCount / 2.0);

    b *= ss(0.4, abs(sin(d * vs * 3.14159)), vs * 3.14159);

    vec3 col = vec3(0.0);

    col = mix(col, mix(vec3(0.0, 0.7, 0.3), vec3(0.0, 1.0, 1.0), d),
        ss(d, w) * b * ss(s + 0.01, d));

    gl_FragColor = vec4(col,1.0);
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
