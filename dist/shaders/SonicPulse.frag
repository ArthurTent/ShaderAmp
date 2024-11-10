// https://www.shadertoy.com/view/4dcyD2
// Modified by ArthurTent
// Created by WillKirkby
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

float circle(vec2 p, float r){
	return r-length(p);
}

float scene(vec2 p){
    vec2 p1=p;
    if(abs(p.x)<.85&&abs(p.y)<.35)
        p1=mod(p+.05,.1)-.05;  
    
    //p-=mod(p+.05,.1)-.05;
    float r = texture(iAudioData, vec2(length(p)*.5,0)).r;
    return circle(p1,.06*r*r);
}

void main( )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
	const float cinematicAspect = 2.35;
	float currAspect = iResolution.x/iResolution.y;
    
    //vec2 uv = fragCoord/iResolution.xy-.5;
    vec2 uv = -1.0 + 2.0 *vUv;
    
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(uv,-1.5));
    mat3 t = mat3(1.0);
	camera(uv, ro, rd, t);

	vec4 wave = texture(iAudioData,uv/256.);
    uv.x *= currAspect;
    
    float d = scene(uv);
    
    gl_FragColor = 1.-clamp(vec4(d*iResolution.y*.5),0.,1.);
    gl_FragColor.rgb = mix(
    	//vec3(11,231,184)/255.,
        vec3(int(sin(wave.r)*200.),75+int(sin(wave.r)*10.),75+int(cos(wave.r)*50.))/255.,
        vec3(30,57,77)/255.,
        gl_FragColor.rgb
    );
    
    if (abs(uv.y) > .75*(currAspect/cinematicAspect))
    {
		gl_FragColor *= 0.;
	}
    else
    {
        //gl_FragColor = gl_FragColor * (length(uv)*-.5+1.) + texture(iChannel0,uv/256.)*.004;
        //                      ^ vignette           ^ noise to hide banding
        gl_FragColor = gl_FragColor * (length(uv)*-.5+1.);
        gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * (wave.r*100.);
	}
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
