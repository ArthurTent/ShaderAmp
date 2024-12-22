// https://www.shadertoy.com/view/MdtXDf
// Modified by ArthurTent
// Created by s23b
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
#define TAU 6.28318530718
#define saturate2(x) clamp(x, 0., 1.)
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

float hash(vec2 uv) {
    float f = fract(cos(sin(dot(uv, vec2(.009123898, .00231233))) * 48.512353) * 1111.5452313);
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

float fbm(vec2 uv) {
    float f = 0.;
    float r = 1.;
    for (int i = 0; i < 8; ++i) {
        f += noise((uv += .25) * r) / (r *= 2.);
    }
    return f / (1. - 1. / r);
}

vec4 blend(vec4 c1, vec4 c2)
{
    return vec4(mix(c1.rgb, c2.rgb, c2.a), max(c1.a, c2.a));
}

float mask(vec2 uv) {
    uv *= .9 - fbm(-uv * 2. + vec2(0, -iAmplifiedTime)) * (texture(iAudioData, vec2(.25, .25)).x) * .5;
    return length(uv) - .55;
}

vec4 spiral(vec2 uv) {
    if (mask(uv) > 0.) return vec4(0);
    float angel = atan(uv.x, uv.y) / TAU + .5 - iAmplifiedTime / 10. - texture(iAudioData, vec2(.1, .25)).x * .1;
    angel -= (uv.y + uv.x) / 20.;
    float dist = length(uv);
    float _smooth = dist * 15.;
    float alpha = saturate2(sin(angel * 17. * TAU + sin(dist * 6. + 2.) * 2.) * _smooth);
    float base = .64 - texture(iAudioData, vec2(.9, .25)).x / 5.;
    float scratch = smoothstep(base, base + .01, fbm((uv - vec2(0, -iAmplifiedTime * .2)) * vec2(30., 2.)));
    alpha = saturate2(alpha - scratch);
    alpha = saturate2(alpha - smoothstep(-.1, .0, -dist));
    vec3 color = vec3(.04, .27, .86) + noise(uv * 4.) * .3;
	return vec4(color, alpha);
}

vec4 circle(vec2 uv) {
    float width = .05;
    float m = mask(uv);
    float alpha = smoothstep(-width, -width + .005, m)* smoothstep(-width - .005, -width, -m);
    vec3 color = vec3(.16, .21, .5) + (noise(uv * 03.) - .65) * .1;
    return vec4(color, alpha);
}

void main()
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
	//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
    vec2 uv = vUv * 2. -1.;
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(uv,-1.5));
    mat3 t = mat3(1.0);
	camera(uv, ro, rd, t);
    uv.x *= iResolution.x / iResolution.y;
	//gl_FragColor = blend(vec4(.86, .86, .79, 1.), spiral(uv));
    gl_FragColor = blend(vec4(0., .0, .0, 1.), spiral(uv));
    gl_FragColor = blend(gl_FragColor, circle(uv));
    uv *= 1000.;
    float amount = .1;
    gl_FragColor.r += (hash(uv) - .5) * amount;
    uv += 100.;
    gl_FragColor.g += (hash(uv) - .5) * amount;
    uv += 100.;
    gl_FragColor.b += (hash(uv) - .5) * amount;
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
