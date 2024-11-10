// https://www.shadertoy.com/view/XtVSDt
// Modified by ArthurTent
// Created by Ruzzyr
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

mat3 rotateYmat(float ang)
{
    return mat3(cos(ang), 0.0, sin(ang),
                0.0, 1.0, 0.0,
                -sin(ang), 0.0, cos(ang));
}
mat3 rotateXmat(float ang)
{
    return mat3(1.0, -0.0, 0.0,
                0.0, cos(ang), -sin(ang),
                0.0, sin(ang), cos(ang));
}

mat3 rotateZmat(float ang)
{
    return mat3(cos(ang), -sin(ang), 0.0,
                sin(ang), cos(ang), 0.0,
                0.0, 0.0, 1.0);
}

float map( vec3 p, vec3 origin, float s )
{
    vec3 offset = vec3(sin(p.x*2. + iTime*2.),cos(p.z*10. + iTime*2.),1.0)*0.1;
	float d = length(p + offset - origin)- s;
	offset = vec3(sin(p.x*3. + iTime*2.),cos(p.z*2. + iTime*2.),1.0)*0.2;
    for(int i = 0; i < 3; i++)
    {

        float prism2 = length(p + offset*float(i) - origin)- s;
        d = max(d, -prism2);
    }
  	return d;
}
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
    //vec2 uv = fragCoord.xy/iResolution.xy;
    vec2 uv = vUv;
    uv = uv*2.0-1.0;
    uv.x *= iResolution.x/iResolution.y;

    mat3 rotation = //mat3(1.0);
      rotateXmat(iTime*0.4)*rotateYmat(iTime*0.5);
    vec3 direction = normalize(vec3(uv.x,uv.y, 1.0)*rotation);




    float t = 0.0;
	vec3 p;
    vec3 finalColor;

    vec3 origin = vec3(0.,0.,-4.)*rotation;
    vec3 offset;
    vec3 sphereOrigin = vec3(0., 0., 0.0);

    vec4 sound = texture (iAudioData,vec2(uv.x/iResolution.x, 0.75));
    float soundColor = texture (iAudioData,vec2(0.5, 0.75)).x;

    vec3 color = vec3(.5 + sin(uv.x+iTime +soundColor*50.)*.4,.5 +cos(uv.y+iTime + soundColor*5.)*.5,.5);
    for (int k = 0; k <15; k++)
    {
        p = origin + t*direction;
        float d = map(p,sphereOrigin, 2.0);

        {
            vec3 directionalOffset = -normalize(p)*sound.x*normalize(vec3(uv, 1.0));
            vec3 position = p + directionalOffset;
            float radius = 0.1+float(k)*.5;
            float lineThickness = 0.02 + float(k)*0.01;
            //position.y += position.y*abs(uv.x);
            float distanceFromCenter = length(position);
            float condition = step( distanceFromCenter, radius)
                - step(distanceFromCenter, radius - lineThickness);
            finalColor += color*condition;
        }

        t += d;
    }
    float fog = 1.0/(1.0+t*t*0.1);
    gl_FragColor = vec4(finalColor+color*vec3(fog), fog);
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);

}
