// https://www.shadertoy.com/view/McsXz8
// Modified by ArthurTent
// Created by ChunderFPV
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

float MAX = 0.5;
// wireframe code from FabriceNeyret2: https://www.shadertoy.com/view/XfS3DK
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
#define O(x,a,b) smoothstep(0., 1., cos(x*6.2832)*.5+.5)*(a-b)+b  // oscillate between a & b
#define A(v) mat2(cos((v*3.1416) + vec4(0, -1.5708, 1.5708, 0)))  // rotate
#define s(p1, p2) c += .02/abs(L( u, K(p1, v, h), K(p2, v, h) )+.01)*k;  // segment
float snd = 0.;
float snd2 = 0.;
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
// line
float L(vec2 p, vec3 A, vec3 B)
{
    vec2 a = A.xy, 
         b = B.xy - a;
         p -= a;
    float h = clamp(dot(p, b) / dot(b, b), 0., 1.);
    if(snd2>MAX)snd2=MAX;
    return length(p - b*h)*(0.9-snd2*1.9) + .01*mix(A.z, B.z, h)*(1.+snd2);
    //return length(p - b*h)*(0.8-snd2*1.9+FFT(25)+(FFT(1))) + .01*mix(A.z, B.z, h)*(1.+snd2);
}


// colormap
vec3 palette(float t) {
    if(t <1.)t+=1.;
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.);
    //vec3 d = vec3(0.563,0.416,0.457 + .2);
    vec3 d = vec3(0.563,0.416,0.257 + .2);
    
    //return a + b*cos( 6.28 * c * (t+d)); // A + B * cos ( 2pi * (Cx + D) )
    return a + b*cos( 6.28 * c * (t+d)); // A + B * cos ( 2pi * (Cx + D) )
}
// cam
vec3 K(vec3 p, mat2 v, mat2 h)
{
    p.zy *= v; // pitch
    p.zx *= h; // yaw
    if (texelFetch(iChannel0, ivec2(80, 2), 0).x < 1.) // P key
        p *= 6. / (p.z+6.); // perspective view
    return p;
}

void mainImage( out vec4 C, in vec2 U )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
        //snd +=FFT(i);
    }
    snd /=float(max_freq*20);
    //snd /=float(max_freq);
    //snd*=2.8;
    //snd*=1.8;
    //snd*=1.6;
    snd2 = snd*1.3;
    //snd*=2.;
    vec2 cam_uv = -1.0 + 2.0 *vUv;
    
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(cam_uv,-1.5));
    mat3 t3 = mat3(1.0);
	camera(cam_uv, ro, rd, t3);
 
    vec2 R = iResolution.xy,
         u = (U+U-R)/R.y*2.,
         m = (iMouse.xy*2.-R)/R.y;
    
    float t = iTime/60.,
          o = t*6.,
          //o = t*3.*snd2,
          j = (u.x > 0.) ? 1.: -1.; // screen side
    /*
    if (iMouse.z < 1.) // not clicking
        m = vec2(sin(t*6.2832)*2., sin(t*6.2832*2.)); // fig-8 movement
    */
    mat2 v = A(m.y), // pitch
         h = A(m.x); // yaw
    
    vec3 c = vec3(0), p, 
         k = vec3(2,1,4)/40. + .05;
    
    //u.x -= j + j*.7; // split screen
    u.x+=sin(iTime/4.)/10.;
    u.y+=sin(iTime/4.)/10.;
    //u*=.5+(sin(iTime/10.))/2.;
    u*=1.-(sin(iTime/10.))/2.;
    snd2*=1.1;
    {
        //p = vec3(0, .618, 1);  // stellated dodecahedron
        //p = vec3(0, 1, -.618); // icosahedron
        
        // stella dodeca to icosa
        p = vec3(0, O(o, .618, 1.), O(o, 1., -.618));
        //p.z+=(1.+FFT(1));
        p.x+=sin(iTime);
	s( vec3(-p.y+FFT(1),  p.z+snd2,    0), vec3(   0, -p.y+FFT(1), -p.z) )
        s( vec3(-p.y+FFT(1),  p.z+snd2,    0), vec3(   0, -p.y+FFT(1),  p.z+snd2) )
        s( vec3(-p.y+FFT(1),  p.z+snd2,    0), vec3( p.z+snd2,    0, -p.y+FFT(1)) )
        s( vec3(-p.y+FFT(1),  p.z+snd2,    0), vec3( p.z+snd2,    0,  p.y*snd2) )
        s( vec3( p.y*snd2,  p.z+snd2,    0), vec3( p.y*snd2, -p.z,    0) )
        s( vec3( p.y*snd2,  p.z+snd2,    0), vec3(   0, -p.y+FFT(1), -p.z) )
        s( vec3( p.y*snd2,  p.z+snd2,    0), vec3(   0, -p.y+FFT(1),  p.z+snd2) )
        s( vec3( p.y*snd2,  p.z+snd2,    0), vec3(-p.z,    0, -p.y+FFT(1)) )
        s( vec3( p.y*snd2,  p.z+snd2,    0), vec3(-p.z,    0,  p.y*snd2) )
        s( vec3(-p.y+FFT(1), -p.z,    0), vec3(-p.y+FFT(1),  p.z+snd2,    0) )
        s( vec3(-p.y+FFT(1), -p.z,    0), vec3(   0,  p.y*snd2, -p.z) )
        s( vec3(-p.y+FFT(1), -p.z,    0), vec3(   0,  p.y*snd2,  p.z+snd2) )
        s( vec3(-p.y+FFT(1), -p.z,    0), vec3( p.z+snd2,    0, -p.y+FFT(1)) )
        s( vec3(-p.y+FFT(1), -p.z,    0), vec3( p.z+snd2,    0,  p.y*snd2) )
        s( vec3( p.y*snd2, -p.z,    0), vec3(   0,  p.y*snd2, -p.z) )
        s( vec3( p.y*snd2, -p.z,    0), vec3(   0,  p.y*snd2,  p.z+snd2) )
        s( vec3( p.y*snd2, -p.z,    0), vec3(-p.z,    0, -p.y+FFT(1)) )
        s( vec3( p.y*snd2, -p.z,    0), vec3(-p.z,    0,  p.y*snd2) )
        s( vec3(   0,  p.y*snd2, -p.z), vec3(   0,  p.y*snd2,  p.z+snd2) )
        s( vec3(   0,  p.y*snd2, -p.z), vec3( p.z+snd2,    0,  p.y*snd2) )
        s( vec3(   0,  p.y*snd2, -p.z), vec3(-p.z,    0,  p.y*snd2) )
        s( vec3(   0, -p.y+FFT(1), -p.z), vec3(   0, -p.y+FFT(1),  p.z+snd2) )
        s( vec3(   0, -p.y+FFT(1), -p.z), vec3( p.z+snd2,    0,  p.y*snd2) )
        s( vec3(   0, -p.y+FFT(1), -p.z), vec3(-p.z,    0,  p.y*snd2) )
        s( vec3(-p.z,    0, -p.y+FFT(1)), vec3( p.z+snd2,    0, -p.y+FFT(1)) )
        s( vec3(-p.z,    0,  p.y*snd), vec3( p.z+snd2,    0,  p.y*snd2) )
        s( vec3(-p.z,    0, -p.y+FFT(1)), vec3(   0,  p.y*snd2,  p.z+snd2) )
        s( vec3(-p.z,    0, -p.y+FFT(1)), vec3(   0, -p.y+FFT(1),  p.z+snd2) )
        s( vec3( p.z+snd2,    0, -p.y+FFT(1)), vec3(   0,  p.y*snd2,  p.z+snd2) )
        s( vec3( p.z+snd2,    0, -p.y+FFT(1)), vec3(   0, -p.y+FFT(1),  p.z+snd2) )
    }
    snd2/=1.1;
    //c*=palette(snd*2.);
    c*=palette(snd2*1.5+(sin(iAmplifiedTime)));
	C = vec4(c, 1.);    

    rd.x+=sin(iTime/1000.);
    vec3 bg = stars(rd);//*(1.+30.*snd);
    C+=vec4(bg,1.);
    
    //C = vec4(c + c*c, 1);
}

void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}

