// https://www.shadertoy.com/view/NtXSzl
// Modified by ArthurTent
// Created by mrange
// License CC0
// https://creativecommons.org/public-domain/cc0/
// License CC0: Moving without travelling
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define PI              3.141592654
#define TAU             (2.0*PI)
#define TIME            iAmplifiedTime*1.2
#define TTIME           (TAU*TIME)
#define RESOLUTION      iResolution
#define ROT(a)          mat2(cos(a), sin(a), -sin(a), cos(a))
#define BPERIOD         5.6
#define PCOS(x)         (0.5+ 0.5*cos(x))
#define BPM             150.0
#define FFT(A) pow(texelFetch(iAudioData, ivec2(A, 0), 0).x, 5.)*.5

const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}
// Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))

const vec3 std_gamma        = vec3(2.2);

float g_th = 0.0;
float g_hf = 0.0;

vec2 g_vx = vec2(0.0);
vec2 g_vy = vec2(0.0);

vec2 g_wx = vec2(0.0);
vec2 g_wy = vec2(0.0);

// https://iquilezles.org/articles/smin
float pmin(float a, float b, float k) {
  float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
  return mix( b, a, h ) - k*h*(1.0-h);
}

float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}

float pabs(float a, float k) {
  return -pmin(-a, a, k);
}

float hash(float co) {
  return fract(sin(co*12.9898) * 13758.5453);
}

vec4 alphaBlend(vec4 back, vec4 front) {
  float w = front.w + back.w*(1.0-front.w);
  vec3 xyz = (front.xyz*front.w + back.xyz*back.w*(1.0-front.w))/w;
  return w > 0.0 ? vec4(xyz, w) : vec4(0.0);
}

vec3 alphaBlend(vec3 back, vec4 front) {
  return mix(back, front.xyz, front.w);
}

float tanh_approx(float x) {
//  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

// https://mercury.sexy/hg_sdf/
float mod1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize, size) - halfsize;
  return c;
}

vec2 toPolar(vec2 p) {
  return vec2(length(p), atan(p.y, p.x));
}

vec2 toRect(vec2 p) {
  return vec2(p.x*cos(p.y), p.x*sin(p.y));
}

float modMirror1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize,size) - halfsize;
  p *= mod(c, 2.0)*2.0 - 1.0;
  return c;
}

float smoothKaleidoscope(inout vec2 p, float sm, float rep) {
  vec2 hp = p;

  vec2 hpp = toPolar(hp);
  float rn = modMirror1(hpp.y, TAU/rep);

  float sa = PI/rep - pabs(PI/rep - abs(hpp.y), sm);
  hpp.y = sign(hpp.y)*(sa);

  hp = toRect(hpp);

  p = hp;

  return rn;
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

// Based on: https://iquilezles.org/articles/distfunctions2d
float vesica(vec2 p, vec2 sz) {
  if (sz.x < sz.y) {
    sz = sz.yx;
  } else {
    p  = p.yx; 
  }
  vec2 sz2 = sz*sz;
  float d  = (sz2.x-sz2.y)/(2.0*sz.y);
  float r  = sqrt(sz2.x+d*d);
  float b  = sz.x;
  p = abs(p);
  return ((p.y-b)*d>p.x*b) ? length(p-vec2(0.0,b))
                           : length(p-vec2(-d,0.0))-r;
}

float outerEye(vec2 p, float th) {
  float a  = mix(0.0, 1.0, smoothstep(0.995, 1.0, cos(th+TTIME/BPERIOD)));
  const float w = 1.14;
  float h = mix(0.48, 0.05, a);
  float d0 =  vesica(p, vec2(w, h));
  return d0;
}

const vec2 iris_center = vec2(0.0, 0.28);
vec4 completeEye(vec2 p, float th) {
  const float iris_outer = 0.622;
  const float iris_inner = 0.285;
  
  float t0 = abs(0.9*p.x);
  t0 *= t0;
  t0 *= t0;
  t0 *= t0;
  t0 = clamp(t0, 0.0, 1.0);
  float dt0 = mix(0.0125, -0.0025, t0);

  vec2 p0 = p;
  float d0 = outerEye(p, th);
  float d5 = d0;

  vec2 p1 = p;
  p1 -= iris_center;
  float d1 = circle(p1, iris_outer);
  d1 = max(d1,d0+dt0);
  float d6 = d1;

  vec2 p2 = p;
  p2 -= vec2(0.155, 0.35);
  float d2 = circle(p2, 0.065);

  vec2 p3 = p;
  p3 -= iris_center;
  p3 = toPolar(p3);
  float n3 = mod1(p3.x, 0.05);
  float d3 = abs(p3.x)-0.0125*(1.0-1.0*length(p1));

  vec2 p4 = p;
  p4 -= iris_center;
  float d4 = circle(p4, iris_inner);

  d3 = max(d3,-d4);

  d1 = pmax(d1,-d2, 0.0125);
  d1 = max(d1,-d3);

  d0 = abs(d0)-dt0;

  float d = d0;
  d = pmin(d, d1, 0.0125);
  return vec4(d, d6, d5, max(d4, d6));
}


// The path function
vec3 offset(float z) {
  float a = z;
  vec2 p = -0.1*(vec2(cos(a), sin(a*sqrt(2.0))) + vec2(cos(a*sqrt(0.75)), sin(a*sqrt(0.5))));
  return vec3(p, z);
}

// The derivate of the path function
//  Used to generate where we are looking
vec3 doffset(float z) {
  float eps = 0.1;
  return 0.5*(offset(z + eps) - offset(z - eps))/eps;
}

// The second derivate of the path function
//  Used to generate tilt
vec3 ddoffset(float z) {
  float eps = 0.1;
  return 0.125*(doffset(z + eps) - doffset(z - eps))/eps;
}

float noise(vec2 p) {
  float a = sin(p.x);
  float b = sin(p.y);
  float c = 0.5 + 0.5*cos(p.x + p.y);
  float d = mix(a, b, c);
  return d;
}

// https://iquilezles.org/articles/fbm
float fbm(vec2 p, float aa) {
  const mat2 frot = mat2(0.80, 0.60, -0.60, 0.80);

  float f = 0.0;
  float a = 1.0;
  float s = 0.0;
  float m = 2.0;
  for (int x = 0; x < 4; ++x) {
    f += a*noise(p); 
    p = frot*p*m;
    m += 0.01;
    s += a;
    a *= aa;
  }
  return f/s;
}

// https://iquilezles.org/articles/warp
float warp(vec2 p, out vec2 v, out vec2 w) {
  const float r  = 0.5;
  const float rr = 0.25;
  float l2 = length(p);
  float f  = 1.0;

  f = smoothstep(-0.1, 0.15, completeEye(p, g_th).x);
  const float rep = 50.0;
  const float sm = 0.125*0.5*60.0/rep;
  float  n = smoothKaleidoscope(p, sm, rep);
  p.y += TIME*0.125+1.5*g_th;

  g_hf = f;
  vec2 pp = p;

  vec2 vx = g_vx;
  vec2 vy = g_vy;

  vec2 wx = g_wx;
  vec2 wy = g_wy;


  //float aa = mix(0.95, 0.25, tanh_approx(pp.x));
  float aa = 0.5;

  v = vec2(fbm(p + vx, aa), fbm(p + vy, aa))*f;
  w = vec2(fbm(p + 3.0*v + wx, aa), fbm(p + 3.0*v + wy, aa))*f;
  
  return -tanh_approx(fbm(p + 2.25*w, aa)*f);
}

vec3 normal(vec2 p) {
  vec2 v;
  vec2 w;
  vec2 e = vec2(4.0/RESOLUTION.y, 0);
  
  vec3 n;
  n.x = warp(p + e.xy, v, w) - warp(p - e.xy, v, w);
  n.y = 2.0*e.x;
  n.z = warp(p + e.yx, v, w) - warp(p - e.yx, v, w);
  
  return normalize(n);
}

void compute_globals() {

  vec2 vx = vec2(0.0, 0.0);
  vec2 vy = vec2(3.2, 1.3);

  vec2 wx = vec2(1.7, 9.2);
  vec2 wy = vec2(8.3, 2.8);

  vx *= ROT(TTIME/1000.0);
  vy *= ROT(TTIME/900.0);

  wx *= ROT(TTIME/800.0);
  wy *= ROT(TTIME/700.0);
  
  g_vx = vx;
  g_vy = vy;
  
  g_wx = wx;
  g_wy = wy;
}

vec3 weird(vec2 p) {
  const vec3 up  = vec3(0.0, 1.0, 0.0);
  const vec3 lp1 = 1.0*vec3(1.0, 1.25, 1.0);
  const vec3 lp2 = 1.0*vec3(-1.0, 2.5, 1.0);

  vec3 ro = vec3(0.0, 10.0, 0.0);
  vec3 pp = vec3(p.x, 0.0, p.y);

  vec2 v;
  vec2 w;
 
  float h  = warp(p, v, w);
  float hf = g_hf;
  vec3  n  = normal(p);

  //vec3 lcol1 = hsv2rgb(vec3(0.7, 0.5, 1.0))*FFT(100)*100.;
  //vec3 lcol2 = hsv2rgb(vec3(0.4, 0.5, 1.0))*FFT(50)*10.;
  vec3 lcol1 = hsv2rgb(vec3(0.7*FFT(1), FFT(100)+.5*FFT(25), 1.0*FFT(100)));
  vec3 lcol2 = hsv2rgb(vec3(0.4*FFT(1), 0.5*FFT(25), 1.0))*FFT(50)*10.;

  vec3 po  = vec3(p.x, 0.0, p.y)*FFT(100)*10.;
  vec3 rd  = normalize(po - ro)*FFT(15);
  
  vec3 ld1 = normalize(lp1 - po);
  vec3 ld2 = normalize(lp2 - po);
 
  float diff1 = max(dot(n, ld1), 0.0);
  float diff2 = max(dot(n, ld2), 0.0);

  vec3  ref   = reflect(rd, n);
  float ref1  = max(dot(ref, ld1), 0.0);
  float ref2  = max(dot(ref, ld2), 0.0);

  vec3 col1 = vec3(0.1, 0.7, 0.8).xzy*FFT(25)*10.;
  vec3 col2 = vec3(0.7, 0.3, 0.5).zyx*FFT(50)*10.;
  
  float a = length(p);
  vec3 col = vec3(0.0);
//  col -= 0.5*hsv2rgb(vec3(fract(0.3*TIME+0.25*a+0.5*v.x), 0.85, abs(tanh_approx(v.y))));
//  col -= 0.5*hsv2rgb(vec3(fract(-0.5*TIME+0.25*a+0.125*w.x), 0.85, abs(tanh_approx(w.y))));
  col += hsv2rgb(vec3(fract(-0.1*TIME+0.125*a+0.5*v.x+0.125*w.x), abs(0.5+tanh_approx(v.y*w.y)), tanh_approx(0.1+abs(v.y-w.y))));
  col -= 0.5*(length(v)*col1 + length(w)*col2*1.0);

  col += 0.25*diff1*FFT(25);
  col += 0.25*diff2*FFT(50);
  /**/
  col += 0.5*lcol1*pow(ref1, 20.0);
  col += 0.5*lcol2*pow(ref2, 10.0);
  col *= hf;
  col *= FFT(25)*10.;
  return col;
}

vec4 plane3(vec3 ro, vec3 rd, vec3 pp, vec3 off, float aa, float n) {
  float h = hash(n+1234.4);
  float th = TAU*h;
  g_th = th;
  float s = 1.*mix(0.2, 0.3, h);

  vec3 hn;
  vec2 p = (pp-off*vec3(1.0, 1.0, 0.0)).xy;
  p *= ROT(0.2*mix(-1.0, 1.0, h));
  p /= s;
  float lp = length(p); 
  p -= -iris_center;
  const float lw = 0.005;
  vec4 de = completeEye(p, th)*s;
  float ax = smoothstep(-aa, aa, de.x);
  float ay = smoothstep(-aa, aa, de.y);
  float az = smoothstep(-aa, aa, -de.z);
  float aw = smoothstep(-aa, aa, 0.0125*(de.w+0.025));

  float df = 1.0-tanh_approx(0.5*lp);
  vec3 acol = vec3(df);
  vec3 icol = weird(p);
  vec3 ecol = mix(vec3(0.0), vec3(1.0), ax);
  //vec3 ecol = mix(vec3(0.0), vec3(1.0), ax*FFT(25)*10.);
  vec3 bcol = mix(icol, ecol, az*0.5*df);
  vec4 col = vec4(bcol, aw);

  return col;
}

vec4 plane(vec3 ro, vec3 rd, vec3 pp, vec3 off, float aa, float n) {
  return plane3(ro, rd, pp, off, aa, n);
}


vec3 skyColor(vec3 ro, vec3 rd) {
  return vec3(0.);
  float ld = max(dot(rd, vec3(0.0, 0.0, 1.0)), 0.0);
  vec3 baseCol = 1.0*vec3(2.0, 1.0, 3.0)*(pow(ld, 100.0));
  return vec3(baseCol);
}

vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {
  float lp = length(p);
  vec2 np = p + 1.0/RESOLUTION.xy;
  const float per = 10.0;
  float rdd = (1.0+0.5*lp*tanh_approx(lp+0.9*PCOS(per*p.x)*PCOS(per*p.y)));
  vec3 rd = normalize(p.x*uu + p.y*vv + rdd*ww);
  vec3 nrd = normalize(np.x*uu + np.y*vv + rdd*ww);

  const float planeDist = 1.0-0.0;
  const int furthest = 4;
  const int fadeFrom = max(furthest-3, 0);
  const float fadeDist = planeDist*float(furthest - fadeFrom);
  float nz = floor(ro.z / planeDist);

  vec3 skyCol = skyColor(ro, rd);

  // Steps from nearest to furthest plane and accumulates the color

  vec4 acol = vec4(0.0);
  const float cutOff = 0.95;
  bool cutOut = false;
  
  for (int i = 1; i <= furthest; ++i) {
    float pz = planeDist*nz + planeDist*float(i);

    float pd = (pz - ro.z)/rd.z;

    if (pd > 0.0 && acol.w < cutOff) {
      vec3 pp = ro + rd*pd;
      vec3 npp = ro + nrd*pd;

      float aa = 3.0*length(pp - npp);

      vec3 off = offset(pp.z);

      vec4 pcol = plane(ro, rd, pp, off, aa, nz+float(i));

      float nz = pp.z-ro.z;
      float fadeIn = exp(-2.5*max((nz - planeDist*float(fadeFrom))/fadeDist, 0.0));
      float fadeOut = smoothstep(0.0, planeDist*0.1, nz);
      pcol.xyz = mix(skyCol, pcol.xyz, (fadeIn));
      pcol.w *= fadeOut;

      pcol = clamp(pcol, 0.0, 1.0);

      acol = alphaBlend(pcol, acol);
    } else {
      cutOut = true;
      break;
    }

  }

  vec3 col = alphaBlend(skyCol, acol);
// To debug cutouts due to transparency  
//  col += cutOut ? vec3(1.0, -1.0, 0.0) : vec3(0.0);
  return col;
}

// Classic post processing
vec3 postProcess(vec3 col, vec2 q) {
  col = clamp(col, 0.0, 1.0);
  col = pow(col, 1.0/std_gamma);
  col = col*0.6+0.4*col*col*(3.0-2.0*col);
  col = mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  col *=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
  return col;
}

vec3 effect(vec2 p, vec2 q) {
  compute_globals();
  
  float tm  = TIME*0.5*BPM/60.0;
  vec3 ro   = offset(tm);
  vec3 dro  = doffset(tm);
  vec3 ddro = ddoffset(tm);

  vec3 ww = normalize(dro);
  vec3 uu = normalize(cross(normalize(vec3(0.0,1.0,0.0)+ddro), ww));
  vec3 vv = normalize(cross(ww, uu));

  vec3 col = color(ww, uu, vv, ro, p);
  return col;
}

void main() {
  //vec2 q = fragCoord/RESOLUTION.xy;
  vec2 q = -1.0 + 2.0 *vUv +.5;
  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x/RESOLUTION.y;

  vec3 col = effect(p, q);
  col += smoothstep(3.0, 0.0, TIME);
  //col = postProcess(col, q);

  gl_FragColor = vec4(col, 1.0);

  //gl_FragColor *= pow(max(gl_FragColor - .2, 0.0), vec4(2.4)) * 8.5;
}

