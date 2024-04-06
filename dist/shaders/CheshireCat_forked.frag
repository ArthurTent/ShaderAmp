// https://www.shadertoy.com/view/MdtSWr
// Modified by ArthurTent
// Created by teassy000

// https://www.shadertoy.com/view/wsf3RN
// cute little shader
// Created by julianlumia in 2019-12-04
// Modified by ArthurTent

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



// fork from: https://www.shadertoy.com/view/MdtSWr
#define PI 3.141592654
#define aTime 128./60.*iTime
#define ROT(a)        mat2(cos(a), sin(a), -sin(a), cos(a))
// Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))

// https://stackoverflow.com/questions/15095909/from-rgb-to-hsv-in-opengl-glsl
const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}

const vec3  grid_color    = HSV2RGB(vec3(0.6, 0.3, 1.0));
const vec3  light0_color  = 16.0*HSV2RGB(vec3(0.6, 0.5, 1.0));
const vec3  light1_color  = 8.0*HSV2RGB(vec3(0.9, 0.25, 1.0));
const vec3  sky0_color    = HSV2RGB(vec3(0.05, 0.65, -0.25));
const vec3  sky1_color    = HSV2RGB(vec3(0.6, 0.5, 0.25));
const vec3  light0_pos    = vec3(1.0, 5.0, 4.0);
const vec3  light1_pos    = vec3(3.0, -1.0, -8.0);
const vec3  light0_dir    = normalize(light0_pos);
const vec3  light1_dir    = normalize(light1_pos);
const vec4  planet_sph    = vec4(50.0*normalize(light1_dir+vec3(0.025, -0.025, 0.0)), 10.0);

// from QuantumSuper
vec4 fft, ffts;
float animTime;
void compressFft(){
	// Sound (see shadertoy.com/view/Xds3Rr, assume? sound texture with 44.1kHz in 512 texels)
    for (int n=1;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 86-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(2,8,7,4); ffts /= vec4(2,3,3,21); //normalize

    //fft.x *= fft.x; //weaken weaker sounds, soft limit
    //fft.x = smoothstep(.8,.9,fft.x); //weaken weaker sounds, semi hard limit
    fft.x = step(.9,fft.x); //weaken weaker sounds, hard limit
}

mat2 rotM(float r){float c = cos(r), s = sin(r); return mat2(c,s,-s,c);} //2D rotation matrix

// IQ's ray sphere intersect: https://iquilezles.org/articles/intersectors
vec2 raySphere(vec3 ro, vec3 rd, vec4 sph) {
  vec3 oc = ro - sph.xyz;
  float b = dot( oc, rd );
  float c = dot( oc, oc ) - sph.w*sph.w;
  float h = b*b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

// https://mercury.sexy/hg_sdf/
vec2 mod2(inout vec2 p, vec2 size) {
  vec2 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}

vec3 toSpherical(vec3 p) {
  float r   = length(p);
  float t   = acos(p.z/r);
  float ph  = atan(p.y, p.x);
  return vec3(r, t, ph);
}

float tanh_approx(float x) {
//  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

vec3 render_background(vec3 ro, vec3 rd, vec3 nrd) {
  rd.xy *= ROT(-PI/2.0+0.6);
  vec3 srd = toSpherical(rd.xzy);
  srd.z += 0.025*iTime;
  vec2 pg  = srd.yz;
  float f  = sin(pg.x);
  float lf2= ceil(log(f)/log(2.0)-0.505);
  float mf = pow(2.0, lf2);

  float aa = 0.005;
  const float count = 20.0;
  const vec2 sz = vec2(2.0*PI/count);
  vec2 ng = mod2(pg, vec2(mf, 1.0)*sz);

  float dg = min(abs(pg.y)*f, abs(pg.x))-aa*0.0;
  vec3 lines = grid_color*smoothstep(-aa, aa, -dg)*f*f;

  vec3 sky  = smoothstep(1.0, 0.0, rd.y)*sky1_color+smoothstep(0.5, 0.0, rd.y)*sky0_color;

  vec2 pi = raySphere(ro, rd, planet_sph);

  float lf1 = 1.0;
  if (pi.x > 0.0) {
    vec3 ppos = ro+rd*pi.x;
    float t = 1.0-tanh_approx(1.5*(pi.y - pi.x)/planet_sph.w);
    sky *= mix(0.5, 1.0, t);
    lf1 = t;
  } else {
    sky += lines;
  }

  sky += pow(max(dot(rd, light0_dir), 0.0), 800.0)*light0_color;
  sky += pow(max(dot(rd, light0_dir), 0.0), 80.0)*light1_color*0.1;
  sky += lf1*pow(max(dot(rd, light1_dir), 0.0), 150.0)*light1_color;
  sky += lf1*pow(max(dot(rd, light1_dir), 0.0), 50.0)*light0_color*0.1;


  return sky;
}

mat2 m = mat2(0.6, 0.8, -0.6, 0.8);

float hash(float n)
{
    return fract(sin(n)*43758.5453123);
}

float noise(in vec2 v)
{
    vec2 p = floor(v);
    vec2 f = fract(v);

    f = f*f*(3.0-2.0*f);

    float n = p.x + p.y*57.0;

    return mix( mix(hash(n), hash(n+1.0), f.x), mix(hash(n+57.0), hash(n+58.0), f.x), f.y);
}

float fbm(vec2 p)
{
    float f = 0.0;
    f += 0.5000*noise( p ); p*= m*2.02;
    f += 0.2500*noise( p ); p*= m*2.02;
    f += 0.1250*noise( p ); p*= m*2.01;
    f += 0.0625*noise( p );

    f /= 0.9375;
    return f;
}

vec4 uplip(vec2 q)
{

    vec4 col = vec4(0.0);
    float w = -0.15*abs(sin(q.x *4.0)) + 0.2;
    w *=(abs(exp(abs(q.x)*1.5)));

	q.y += 0.4;
    if(q.y < w && abs(q.x) < 0.8)
    {
        // up tooth
        float f= w+(-0.1*(abs(sin(q.x*60.0)))*(3.5-1.5*exp(abs(q.x))));

        if(q.y > f)
        {
            col = mix(col, vec4(1.0), 1.0);

        }
        col *= smoothstep(w, w-0.01, q.y);
        col *= smoothstep(f, f+0.03 , q.y);

    }

    return col;
}


vec4 downlip(vec2 q)
{
    vec4 col = vec4(0.0);
    float dlip = (1.0-abs(cos(q.x)))*exp(abs(q.x*0.9))-0.5;

    q.y += 0.0;
    if(q.y > dlip )
    {
        float fd = dlip+(0.1*(abs(sin(q.x*70.0))))*(1.5-2.0*abs(q.x));

        if(q.y < fd)
        {
            col = mix(col, vec4(1.0), 1.0);
        }
        col *= smoothstep(dlip, dlip+0.01, q.y);
        col *= smoothstep(fd, fd-0.02, q.y);
    }

    return col;
}

vec4 mixcol(vec4 a, vec4 b, float f)
{
	if(a.a == 0.0)
        return b;
    else if(b.a == 0.0)
        return a;
    else
        return mix(a, b, f);
}


void main()
{
    // from QuantumSuper
    compressFft();
    animTime = 2.133333*iTime;
    float aFrac, amp = 0.;


    //vec2 q = fragCoord.xy / iResolution.xy;
    vec2 q = vUv;
    vec2 p = -1.0 + 2.0*q;

    // cute little shader
    // https://www.shadertoy.com/view/wsf3RN
    // Created by julianlumia in 2019-12-04
    vec4 cls_col4 = vec4(fft.x/2., fft.y, fft.z*2.2, 1.0);
    vec2 cls = sin(p*5.);
    float r = max( 0.,  5. - length((cls)) );
    float t = (iTime*0.5);
    t = r * r * sin(r+t) * 2.;
    cls *= mat2( cos(t*ffts.w), sin(t*ffts.w*fft.x), cos(t*ffts.w), cos(t*ffts.w));
    vec3 cls_col = 0.1 + cos(cls.y *(cos(iTime)*0.5+0.5) +iTime) *sin(iTime+cls.yxy)*0.5;
    cls_col4 = mix(cls_col4, vec4(cls_col, 1.0), 0.5);
    // end of cute little shader


    // from QuantumSuper
    float fTime = fract(iTime/64.); //"randomize" view manipulation by using iTime instead of aTime
    //p = sin( PI*p*sin(aTime/32.) + vec2( sign(fract(aTime/32.)-.5) * aTime/14., 1.3)*aTime/64.);


    if (fract(aTime/32.)<.2); //"break", standard view
    //else if (fTime<.33) p = fract(p*2.*abs(sin(aTime/8.))+.5)-.5; //scaling multiples
    //else if (fTime<.33) p *= rotM(fract(p*2.*abs(sin(aTime/7.))+.5).x-.5); //scaling multiples
    else if (fTime<.33) p *= (1.5+sin(iTime))*rotM(sin(aTime/8.)*-p.x); //even bigger smiling
    else if (fTime<.66) p *= (1.5+sin(iTime))*1.5*rotM(sign(fract(aTime/32.)-.5)*aTime/8.); //rotation
    //else p = sin( PI*p*sin(aTime/3.) + vec2( sign(fract(aTime/32.)-.5) * aTime/4., 1.3)*aTime/64.); //moving warp multiples
    else p = .1+sin( PI*p*sin(aTime/32.) + vec2( sign(fract(aTime/32.)-.5) * aTime/4., 1.3)*aTime/64.); //moving warp multiples

    p = sin( PI*p*(sin(aTime/32.)+.1) + vec2( sign(fract(aTime/32.)-.5) * (sin(aTime/42.)+.1), 1.3)*aTime/32.); //moving warp multiples
    vec4 ucol = uplip(p);
    vec4 dcol = downlip(p);
	dcol = mixcol(dcol, ucol, 1.0);
    p.x *= iResolution.x/iResolution.y;
    //p.y -= 0.15;

    vec2 p1 = vec2(p.x+0.5, p.y-0.3);
    vec2 p2 = vec2(p.x-0.5, p.y-0.3);
    p1.x -=.125;
    p2.x +=.125;

    float r1 = sqrt(dot(p1, p1));
    float r2 = sqrt(dot(p2, p2));

    aFrac = fract(-.05*animTime+.25*r1)-.02*fft.w*fft.w*fft.w;


    vec4 col = vec4(0.0);

    //if(r1 < 0.25 || r2 < 0.25)
    if(r1 < 0.25 || r2 < 0.25)
    {
        //col =vec4(0.0, 0.8, 0.2, 1.0);
        col =vec4(fft.x*2., fft.y, fft.z*2.2, 1.0);
        float f = fbm(20.0*p1);
        col = mix(col, vec4(0.0, 0.3, 0.7, 1.0), f);

        float t = max(abs(sin(iTime))*0.8, 0.7);

        float e1 = -abs(cos(atan(p1.y, p1.x*2.0) + 0.0))*t*0.3 + 0.3;
        f = 1.0 - smoothstep(e1, e1+0.1, length(p1)*1.8);
        col = mix(col, vec4(fft.y, fft.z*0.8, 0.4, 1.0), f);

        float e2 = -abs(cos(atan(p2.y, p2.x*2.0) + 0.0))*t*0.3 + 0.3;
        f = 1.0 - smoothstep(e2, e2+0.1, length(p2)*1.8);
        col = mix(col, vec4(fft.y, fft.z*0.8, 0.4, 1.0), f);


        if(r1 < 0.25)
        {
            float a = atan(p1.y, p1.x);
            a += 0.05*fbm(20.0*p1);
            f = smoothstep(0.4, 1.0,fbm(vec2(r1*25.0, a*18.0)));
            col = mix(col, vec4(1.0), f);
            f = smoothstep(0.15, 0.25, r1);
            col *= 1.0 - f*fft.x;

        }
        else if(r2 < 0.25)
        {
            float a = atan(p2.y, p2.x);
            a += 0.15*fbm(12.0*p2);
            f = smoothstep(0.4, 1.0, fbm(vec2(r2*25.0, a*18.0)));
            col = mix(col, vec4(1.0), f);
            f = smoothstep(0.15, 0.25, r2);
            col *= 1.0 - f*fft.x;
        }

        col *= smoothstep(e1, e1+0.02, length(p1)*1.8);
        // left eye highlight
        f = 1.0-smoothstep(0.0, 0.1, length(p1 - vec2(0.1, 0.06)));
        col += vec4(f, f, f, 1.0);

        col *= smoothstep(e2, e2+0.02, length(p2)*1.8);
        // right eye highlight
        f = 1.0-smoothstep(0.0, 0.1, length(p2 - vec2(0.1, 0.06)));
        col += vec4(f, f, f, 1.0);

    }else{
        //col = vec4(fft.w, fft.x,fft.z, ffts.y);

        col =vec4(
                  //fft.w*1.5*sin(iTime*p.x*p.y*cos(p.x+p.y)*ffts.y),
                  fft.w*1.5*sin(iTime*p.x/7.*(p.y/12.*sin(iTime*4.*fft.x))*cos(p.x+p.y)*ffts.y),
                  fft.y*p.x*p.y/10.*sin(iTime*p.x*p.y*cos(p.x+p.y+fft.w)*ffts.y),
                  fft.z*sin(iTime*(p.x/6.)*(p.y/12.*sin(iTime*2.*fft.x))*ffts.y+fft.w)*ffts.y,
                  1.0);

    }

    col = mixcol(col, dcol, 1.0);

    col = mixcol(col, cls_col4, 0.5);

    //float anim = max(sin(iTime*0.3), 0.0);
    float anim = 0.3;
    col = mix(col, vec4(0.0), anim);
    //col += col*fft.w*fft.w*fft.w;
    gl_FragColor = vec4(col);
}