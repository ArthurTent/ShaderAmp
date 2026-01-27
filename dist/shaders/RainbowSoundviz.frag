// https://www.shadertoy.com/view/ttfGzH
// Created by avin
// Modified by Arthur Tent
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;

#define PI2 6.2831852
#define S(a,b,t) smoothstep(a,b,t)
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

#define hue(h)clamp(abs(fract(h + vec4(3, 2, 1, 0) / 3.0) * 6.0 - 3.0) - 1.0 , 0.0, 1.0)

void main()
 {
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    vec2 cam_uv = -1.0 + 2.0 *vUv;
    
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(cam_uv,-1.5));
    mat3 t3 = mat3(1.0);
	camera(cam_uv, ro, rd, t3);
    //vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
     vec2 uv = -1.0 + 2.0 *vUv;

    float CIRCLES = 20.0;
    float cS = 0.375;

    float sm = 1.0 / iResolution.y * 2.0; // smooth
    float ps = 1.0 / iResolution.y * sqrt(iResolution.y) * 0.225; // circle thin

    float d = length(uv);

    float a = atan(uv.y, uv.x);
    a = a < 0.0 ? PI + (PI - abs(a)) : a;

    float lPos = a /PI2;

    float m = 0.0;
    float partSize = 1.0 / CIRCLES;
    vec3 col;
    for(float i = CIRCLES; i > 1.0; i -= 1.0) {

        float ilPos = fract(lPos + i*0.1 + iTime * 0.1);
        float cPos = partSize * i + ilPos * partSize;
        float invPos = partSize * (i + 1.0) - ilPos * partSize;
        float nzF = (1.0 - ilPos);
        float mP0 = texture(iAudioData, vec2(partSize * i, 0.0)).x;
        float mP = texture(iAudioData, vec2(cPos, 0.0)).x;
        float mPInv = texture(iAudioData, vec2(invPos, 0.0)).x;

        mP = (mP + mPInv) / 2.0;

        float rDiff = i*(1.0 / CIRCLES * 0.35);
        float r = mP * (1.0 / CIRCLES * 3.0) - rDiff;

        float subm = smoothstep(cS - ps + r, cS - ps + sm + r, d) * smoothstep(cS + r, cS - sm + r, d);

        if (subm > 0.0) {
            col = hue(i / CIRCLES * 0.5 + iTime * 0.05 + mP0 * 0.84).rgb;
        }

        m += subm;
    }

    m = clamp(m, 0.0, 1.0);

    float r = (sin(iTime * 0.5) * 0.5 + 0.5);
    float b = (cos(iTime * 0.5) * 0.5 + 0.5);
    vec3 backCol = vec3(r, 0.0, b) * length(uv * 0.75) * 0.5;

    col = mix(backCol, col, m);

    gl_FragColor = vec4(col, 1.0);
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
