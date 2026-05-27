// https://www.shadertoy.com/view/NtXSzl
// Modified by ArthurTent
// Created by mrange
// License CC0
// https://creativecommons.org/public-domain/cc0/
// License CC0: Moving without travelling
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// CC0: More glow experiments on a sunday
// More tinkering
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
#define aTime 128./60.*iAmplifiedTime
mat2 rotM(float r){float c = cos(r), s = sin(r); return mat2(c,s,-s,c);} //2D rotation matrix
float snd = 0.;

// Can't decide which I prefer
#define VARIANT

#define TIME        iAmplifiedTime
#define RESOLUTION  iResolution
#define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))

const float
    PI        = acos(-1.)
  , TAU       = 2.*PI
  ;


mat2 g_rot;
float g_scale;

// License: Unknown, author: Matt Taylor (https://github.com/64), found: https://64.github.io/tonemapping/
vec3 aces_approx(vec3 v) {
  v = max(v, 0.0);
  v *= 0.6*(.5+snd*2.);
  float a = 2.51;
  float b = 0.03+snd;
  float c = 2.43*snd;
  float d = 0.59+snd;
  float e = 0.14+snd;
  return clamp((v*(a*v+b))/(v*(c*v+d)+e), 0.0, 1.0);
}

vec3 offset(float t) {
  t*= 0.25;
  return 0.2*vec3(sin(TAU*t), sin(0.5*t*TAU), cos(TAU*t));
}

vec3 doffset(float t) {
  const float dt = 0.01;
  return (offset(t+dt)-offset(t-dt))/(2.*dt);
}

// License: MIT, author: Inigo Quilez, found: https://www.iquilezles.org/www/articles/smin/smin.htm
float pmin(float a, float b, float k) {
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}

vec3 palette(float a) {
  return 1.+sin(vec3(0,1,2)+a);
}

float apollonian(vec4 p, float s, float w, out float off) {
  float scale = 1.0;

  for(int i=0; i<6 ;i++) {
    p        = -1.0 + 2.0*fract(0.5*p+0.5);
    float r2 = dot(p,p);
    float k  = s/r2;
    p       *= k;
    scale   *= k;
  }
  vec4 sp = p/scale;
  vec4 ap = abs(sp)-w;
  float d = pmax(ap.w, ap.y, w*10.);
#ifdef VARIANT
  off = length(sp.xz);
#else
  d = min(d, pmax(ap.x, ap.z, w*10.));

  off = length(sp.xy);
#endif
    //d*=(.1+snd*4.);
    //d*=snd;
  return d;
}

float df(vec3 p, float w, out float off) {
  vec4 p4 = vec4(p, 0.1);
  p4.yw *= g_rot;
  p4.zw *= transpose(g_rot);
  return apollonian(p4, g_scale, w, off);
}

vec3 glowmarch(vec3 col, vec3 ro, vec3 rd, float tinit) {
  float t = tinit;
  for (int i = 0; i < 60; ++i) {
    vec3 p = ro + rd*t;
    float off;
    float d = df(p, 6E-5+t*t*2E-3, off);
    d*=(0.3+FFT(i));
    vec3 gcol = 1E-9*(palette((log(off)))+5E-2)/max(d*d, 1E-8);
    col += gcol*smoothstep(0.5, 0., t);
    t += 0.5*max(d, 1E-4);
    
    if (t > 0.5) break;
  }
  col.r*=(.1+snd*4.);
  return col;
}

// borrowed from QuantumSuper
vec2 getPlane(vec2 p){  
    if(snd<.3){ p*=-1.5*rotM(sign(snd*10.)*aTime/8.);}
    float fTime = fract(iAmplifiedTime/64.); 
    if (fract(aTime/32.)<.75) return p; //break, standard view
    else if (fTime<.33) {p = 2.5*fract(p*2.*abs(sin(aTime/8.))+.5)-.5; p.y-=.5;} //scaling multiples
    else if (fTime<.66) p *= 1.5*rotM(sign(fract(aTime/32.)-.5)*aTime/8.); //rotation
    else p = snd*sin( PI*p + vec2( sign(fract(aTime/32.)-.5) * aTime/4., 0)); //moving warp multiples
    if(snd<.3){ p*=1.5*rotM(sign(snd*10.)*aTime/4.);}
    else{p*=(.1+snd*3.);}
    return p;
}

vec3 render(vec3 col, vec3 ro, vec3 rd) {
  col = glowmarch(col, ro, rd, 1E-2);
  return col;
}


vec3 effect(vec2 p, vec2 pp, vec2 q) {
  float tm  = mod(TIME+50.,1600.0);
  g_scale = mix(1.85, 1.5, 0.5-0.5*cos(TAU*tm/1600.));
  g_rot = ROT(tm*TAU/800.0);
  tm *= 0.025;
  vec3 ro   = offset(tm);
  vec3 dro  = doffset(tm);
  vec3 ww = normalize(dro);
  vec3 uu = normalize(cross(vec3(0,1,0), ww));
  vec3 vv = cross(ww, uu);
  vec3 rd = normalize(-p.x*uu + p.y*vv + 2.*ww);

  vec3 col = vec3(0.0);
  col += 1E-1*palette(5.0+0.1*p.y)/max(1.125-q.y+0.1*p.x*p.x, 1E-1); 
  col = render(col, ro, rd); 
  col *= smoothstep(1.707, 0.707, length(pp))*(.1+snd);
  col -= vec3(2.0, 3.0, 1.0)*4E-2*(0.25+dot(pp,pp));
  col = aces_approx(col);
  col = sqrt(col);
  return col;
}
// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/www/index.htm
vec3 postProcess(vec3 col, vec2 q) {
  col = clamp(col, 0.0, 1.0);
  col = pow(col, vec3(1.0/2.2));
  col = col*0.6+0.4*col*col*(3.0-2.0*col);
  col = mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  col *=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
  return col;
}
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  int max_freq = 100;
  for(int i=1; i < max_freq; i++){
      snd +=FFT(i)*float(i); 
  }
  snd /=float(max_freq*20);

  vec2 q = fragCoord/RESOLUTION.xy;
  vec2 p = -1. + 2. * q;
  vec2 pp = p;
  p.x *= RESOLUTION.x/RESOLUTION.y;
  p = getPlane(p);
  vec3 col = effect(p, pp, q);
  //col = postProcess(col, q);
  fragColor = vec4(col,1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}