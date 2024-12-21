// https://www.shadertoy.com/view/XtGGW3
// Modified by ArthurTent
// Created by s23b
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define GLOW 1
#define NEGATIVE 1
#define GAMMA_CORRECT 0
#define MASK_ONLY 0
#define ADD_NOISE 1

#define saturate2(x) clamp(x, 0., 1.)
#define rot(a) mat2(cos(a), -sin(a), sin(a), cos(a))
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

float spikes(float x, float t) {
    x = abs(fract(x) - .5) * 1. - .5 + t;
    return x < 0. ? 0. : smoothstep(0., t, x);
}

float circle(vec2 p, float r) {
    return length(p) - r;
}

float rect(vec2 p, vec2 s) {
    vec2 a = abs(p) - s;
    return a.x < 0. || a.y < 0. ? max(a.x, a.y) : length(a);
}

float opU(float a, float b) {
    return min(a, b);
}

float opS(float a, float b) {
    return max(a, -b);
}

float bear(vec2 p) {
    float d = circle(p, 1.);

    // draw ears
    float earSize = .6;
    vec2 earPos = vec2(.7);
    float ear = circle(p - earPos, earSize);
    float inEar = circle(p - earPos, earSize- .1);
    inEar = opS(inEar, circle(p - earPos, earSize- .2));
    ear = opS(ear, inEar);
    ear = opS(ear, circle(p - earPos, earSize- .3));
    d = opU(d, ear);

    // substract face
    d = opS(d, circle(p, .9));

    // substract inside of ears on the top
    d = opS(d, opS(inEar, p.y - earPos.y));

    // draw eyes
    float eyeSize = .49;
    vec2 eyePos = vec2(.45, .2);
    d = opU(d, circle(p - eyePos, eyeSize));
    d = opS(d, circle(p - eyePos, eyeSize - .1));

    // draw pupil
    float pupilAngle = PI / 2. * (.9 - spikes(iAmplifiedTime / 6.4, .02) * .8);
    d = opU(d, rect(p - eyePos, vec2(cos(pupilAngle), sin(pupilAngle)) * (eyeSize)));

    // draw mouth
    float mouthPos = eyePos.y - eyeSize + .04;
    vec2 mouthSize = vec2(1.2, .05);
    d = opU(d, rect(p - mouthPos, mouthSize));

    // draw teeth
    d = opU(d, rect(p * rot(.3) - vec2(.28, -.54), vec2(.05, .4)));
    d = opU(d, rect(p * rot(-.3) - vec2(.13, -.62), vec2(.05, .35)));
    d = opU(d, rect(p * rot(.3) - vec2(.63, -.38), vec2(.05, .35)));
    d = opU(d, rect(p * rot(-.5) - vec2(.39, -.68), vec2(.05, .21)));

    return d;
}

// interpolates between two closest fft samples with given resolution
float fft(float t, float resolution) {
    return mix(
        texture(iAudioData, vec2(floor(t * resolution) / resolution, .25)).x,
        texture(iAudioData, vec2(floor(t * resolution + 1.) / resolution, .25)).x,
        fract(t * resolution));
}

float hash(vec2 uv) {
    float f = fract(cos(sin(dot(uv, vec2(.009123898, .00231233))) * 480.512353) * 11111.5452313);
    return f;
}

float noise(vec2 uv) {
    vec2 fuv = floor(uv);
    vec4 cell = vec4(
        hash(fuv + vec2(0, 0)),
        hash(fuv + vec2(0, 1)),
        hash(fuv + vec2(1, 0)),
        hash(fuv + vec2(1, 1))
    );
    vec2 axis = mix(cell.xz, cell.yw, fract(uv.y));
    return mix(axis.x, axis.y, fract(uv.x));
}

// noise that flows arpind the center
float fbm(vec2 uv) {
    float f = 0.;
    float r = 1.;
    for (int i = 0; i < 8; ++i) {
        uv *= rot(iAmplifiedTime / 10.);
        f += noise((uv + float(i) / 10.) * r) / (r *= 2.);
    }
    return f / (1. - 1. / r);
}

void main()
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
	//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
    vec2 uv = -1.0 + 2.0 *vUv;
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(uv,-1.5));
    mat3 t = mat3(1.0);
	camera(uv, ro, rd, t);
    uv.x *= iResolution.x / iResolution.y;

    vec2 p = vec2(abs(uv.x), uv.y + .13) * 1.3;

	float d = bear(p);

    // add distortion
    #if ADD_NOISE
    d += (.5 - fbm(uv * 10.)) * .05;
    d -= (fft(atan(p.x,p.y) / PI, 10.) - .2) * .05 * smoothstep(0., 1., length(p));
    #endif

    // create outline
    float w = fwidth(d);
    float mask = smoothstep(-w, w, d);

    // add glow
    #if GLOW
    //float glow = pow(100., -d) * (.05 + smoothstep(.0, .5, texture(iAudioData, vec2(.6, .25)).x) * .25);
    float glow = pow(100., -d) * (0.15 + smoothstep(.5, 1.5, texture(iAudioData, vec2(.1, .25)).x) * 1.25);
	mask = saturate2(mask - glow);
    #endif

    #if MASK_ONLY
    gl_FragColor = vec4(mask);

    #else
    // create background flow
    uv *= 2.;
    // original flow
    //vec4 flow = vec4(fbm(uv), fbm(uv * rot(1.)), fbm(uv * rot(2.)), 1);
    //vec4 flow = vec4(fbm(uv)+(d/(sin(iAmplifiedTime/8.)+(d/10.))), fbm(uv * rot(1.))*(d+1./d), fbm(uv * rot(2.)*d), 1);
    vec4 flow = vec4(fbm(uv)+(d/(sin(iTime/4.)+(d/10.))), fbm(uv * rot(1.))*(d+1./d), fbm(uv * rot(2.)*d), 1);
    flow = floor(flow * 16.) / 16.;


    // apply mask
    gl_FragColor = mix(flow, vec4(1), mask);

    #if NEGATIVE
    gl_FragColor = 1. - gl_FragColor;
    #endif

    #if GAMMA_CORRECT
    gl_FragColor = pow(gl_FragColor, vec4(.4545));
    #endif
    #endif
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);

}
