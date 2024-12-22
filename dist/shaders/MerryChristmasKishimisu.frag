// https://www.shadertoy.com/view/4fs3WS
// Modified by ArthurTent
// Created by kishimisu
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

/*    
       Merry Christmas!     by @kishimisu (2023)
*/
#define s smoothstep(.3, 1., M.y

void mainImage( out vec4 E, vec2 F ) {
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

    vec2   X         = iResolution.xy;
    vec2     M       = (F+F-X) / X.y / .45, 
               A     ; float
                 S   = length(M),
            
           T         = iTime * .5,
             R       ;
    for (      E     *= R, M.x = abs(M.x); R++ < 8.;
                 E   += .004/abs(sin(length( A = fract((M-vec2(0,1))*(1.5 + R*.1)
                     * mat2(cos(vec4(0,33,11,0) - T*.05))) -.5 ) 
                     * exp(length(A)*1.5 - S) * 7. + sin(T)*.05) / 8. 
                     - .3 * s*.6 + M.x + 1.4 + sin(M.y*13.+3.)*.1 - 2.*s + 2.2)))
                     //* (1. + cos(R*.5 + S*5. -T*4. + vec4(0,1,2,0)))*(.2+(FFT(25)+FFT(1)+FFT(50))*2.));
                     * (1. + cos(R*.5 + S*5. -T*4. + vec4(0,1,2,0)))*(snd*2.));
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	E+=vec4(bg, 1.);
}

void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}
