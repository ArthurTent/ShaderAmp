// https://www.shadertoy.com/view/mslfR2
// Modified by ArthurTent
// Created by mranage
// License: Creative Commons Zero (CC0)
// https://creativecommons.org/public-domain/cc0/
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

// CC0: More "cubes" for the cube lovers
//  Tinkering around with glow effects and one bounce reflections
//  Produced a few interesting "cubes" that some might enjoy.

// Song : Rush Connection - Culture Shock

// Try different approximations of "cubes" by changing between DF0-DF7
#define DF5
// Some "cubes" can be more or less boxy
//  define or comment out
// #define BOXY
// Some "cubes" have flair variants
//  define or comment out
#define FLAIR

#define TIME        iAmplifiedTime
#define RESOLUTION  iResolution
#define PI          3.141592654
#define TAU         (2.0*PI)
#define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))

#define LAYERS            5.0
#define TTIME             (TAU*TIME)

#define TOLERANCE           0.0001
#define MAX_RAY_LENGTH      120.0
#define MAX_RAY_MARCHES_LO  30
#define MAX_RAY_MARCHES_HI  70
#define NORM_OFF            0.005

const vec4 roadDim = vec4(normalize(vec3(0.0, 1.0, 0.15)), 20.0);

// License: WTFPL, author: sam hocevar, found: https://stackoverflow.com/a/17897228/418488
const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))

const float hoff      = -0.025;
const vec3 glowCol1   = HSV2RGB(vec3(hoff+0.65, 0.75, 0.2));
const vec3 sunCol1    = HSV2RGB(vec3(hoff+0.75, 0.50, 0.5));
const vec3 diffCol    = HSV2RGB(vec3(hoff+0.40, 0.75, 0.125));
const vec3 sunDir1    = normalize(vec3(3., 3.0, -7.0));

// License: Unknown, author: Matt Taylor (https://github.com/64), found: https://64.github.io/tonemapping/
vec3 aces_approx(vec3 v) {
  v = max(v, 0.0);
  v *= 0.6f;
  float a = 2.51f;
  float b = 0.03f;
  float c = 2.43f;
  float d = 0.59f;
  float e = 0.14f;
  return clamp((v*(a*v+b))/(v*(c*v+d)+e), 0.0f, 1.0f);
}

// License: Unknown, author: Unknown, found: don't remember
float hash(float co) {
  return fract(sin(co*12.9898) * 13758.5453);
}


// License: Unknown, author: Unknown, found: don't remember
vec2 hash2(vec2 p) {
  p = vec2(dot (p, vec2 (127.1, 311.7)), dot (p, vec2 (269.5, 183.3)));
  return fract(sin(p)*43758.5453123);
}

// License: CC BY-NC-SA 3.0, author: Stephane Cuillerdier - Aiekick/2015 (twitter:@aiekick), found: https://www.shadertoy.com/view/Mt3GW2
vec3 blackbody(float Temp) {
  vec3 col = vec3(255.);
  col.x = 56100000. * pow(Temp,(-3. / 2.)) + 148.;
  col.y = 100.04 * log(Temp) - 623.6;
  if (Temp > 6500.) col.y = 35200000. * pow(Temp,(-3. / 2.)) + 184.;
  col.z = 194.18 * log(Temp) - 1448.6;
  col = clamp(col, 0., 255.)/255.;
  if (Temp < 1000.) col *= Temp/1000.;
  return col*col;
}

// License: Unknown, author: Unknown, found: don't remember
float tanh_approx(float x) {
//  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/smin
float pmin(float a, float b, float k) {
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/smin
vec3 pmin(vec3 a, vec3 b, float k) {
    vec3 h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}

vec3 pabs(vec3 a, float k) {
  return -pmin(a, -a, k);
}

// License: MIT OR CC-BY-NC-4.0, author: mercury, found: https://mercury.sexy/hg_sdf/
float mod1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize, size) - halfsize;
  return c;
}

// License: MIT OR CC-BY-NC-4.0, author: mercury, found: https://mercury.sexy/hg_sdf/
vec2 mod2(inout vec2 p, vec2 size) {
  vec2 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/intersectors
float rayPlane(vec3 ro, vec3 rd, vec4 p) {
  return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

// License: MIT, author: Inigo Quilez, found: www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
float torus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

// License: MIT OR CC-BY-NC-4.0, author: mercury, found: https://mercury.sexy/hg_sdf/
vec3 mod3(inout vec3 p, vec3 size) {
  vec3 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}

// License: MIT, author: Inigo Quilez, found: www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
float box(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

// License: MIT, author: Inigo Quilez, found: www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
float boxf(vec3 p, vec3 b, float e) {
       p = abs(p  )-b;
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

// Intentionally bounded, not exact
float bbox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return (max(q.x,max(q.y,q.z)));
}

float segmentx(vec2 p) {
  float d0 = abs(p.y);
  float d1 = length(p);
  return p.x > 0.0 ? d0 : d1;
}

float segmentx(vec2 p, float l) {
  float hl = 0.5*l;
  p.x = abs(p.x);
  float d0 = abs(p.y);
  float d1 = length(p-vec2(hl, 0.0));
  return p.x > hl ? d1 : d0;
}

float sphere(vec3 p, float r) {
  return length(p) - r;
}

float sphere4(vec3 p, float r) {
  p *= p;
  return pow(dot(p, p), 0.25) - r;
}

float sphere8(vec3 p, float r) {
  p *= p;
  p *= p;
  return pow(dot(p, p), 0.125) - r;
}

vec3 toSpherical(vec3 p) {
  float r   = length(p);
  float t   = acos(p.z/r);
  float ph  = atan(p.y, p.x);
  return vec3(r, t, ph);
}

float sun(vec2 p) {
  const float ch = 0.0125;
  vec2 sp = p;
  float d0 = circle(sp, 0.5);
  float d = d0;
  return d;
}

float synth(vec2 p, float aa, out float h, out float db) {
  const float z = 75.0;
  p.y -= -70.0;
  const float st = 0.04;
  p.x = abs(p.x);
  p.x -= 20.0-3.5;
  p.x += st*20.0;
  p /= z;
  float n = mod1(p.x, st);
  float dib = 1E6;
  const int around = 0;
  for (int i = -around; i <=around ;++i) {
    float fft = texture(iAudioData, vec2((n+float(i))*st, 0.25)).x;
    fft *= fft;
    if (i == 0) h = fft;
    float dibb = segmentx((p-vec2(st*float(i), 0.0)).yx, fft+0.05)-st*0.4;
    dib = min(dib, dibb);
  }

  float d = dib;
  db = abs(p.y)*z;
  return smoothstep(aa, -aa, d*z);
}

vec3 road(vec3 ro, vec3 rd, vec3 nrd, float glare, out float pt) {
  const float szoom   = 0.5;
  const float bsz     = 25.0;
  const float sm      = 1.0;
  float off = abs(roadDim.w);
  float t = rayPlane(ro, rd, roadDim);
  pt = t;

  vec3 p  = ro+rd*t;
  vec3 np = ro+nrd*t;

  vec2 pp   = p.xz;
  vec2 npp  = np.xz;
  vec2 opp  = pp;

  float aa  = length(npp-pp)*sqrt(0.5);
  pp.y += -60.0*TIME;

  vec3 gcol = vec3(0.0);

  float dr = abs(pp.x)-off;
  vec2 cp = pp;
  mod1(cp.y, 6.0*off);
  vec2 sp = pp;
  sp.x = abs(sp.x);
  mod1(sp.y, off);
  float dcl = segmentx(cp.yx, 1.5*off);
  float dsl = segmentx((sp-vec2(0.95*off, 0.0)).yx, off*0.5);

  vec2 mp = pp;
  mod2(mp, vec2(off*0.5));

  vec2 dp = abs(mp);
  float d = dp.x;
  d = pmin(d, dp.y, sm);
  d = max(d, -dr);
  d = min(d, dcl);
  d = min(d, dsl);
  vec2 s2 = sin(TIME+2.0*p.xz/off);
  float m = mix(0.75, 0.9, tanh_approx(s2.x+s2.y));
  m *= m;
  m *= m;
  m *= m;
  vec3 hsv = vec3(0.4+mix(0.5, 0.0, m), tanh_approx(0.15*mix(30.0, 10.0, m)*d), 1.0);
  float fo = exp(-0.04*max(abs(t)-off*2., 0.0));
  vec3 bcol = hsv2rgb(hsv);
  gcol += 2.0*bcol*exp(-0.1*mix(30.0, 10.0, m)*d)*fo;

  float sh;
  float sdb;
  float sd = synth(opp, 4.0*aa, sh, sdb)*smoothstep(aa, -aa, -0.5*dr);
  sh = tanh_approx(sh);
  sdb *= 0.075;
  sdb *= sdb;
  sdb += 0.05;
  vec3 scol = sd*(sdb)*pow(tanh(vec3(0.1)+bcol), mix(vec3(1.0), vec3(1.5, 0.5, 0.5), smoothstep(0.4, 0.5, sh)));
  gcol += scol;


  gcol = t > 0.0 ? gcol : vec3(0.0);
  return gcol+scol;
}

vec3 stars(vec2 sp, float hh) {
  vec3 col = vec3(0.0);

  const float m = LAYERS;
  hh = tanh_approx(20.0*hh);

  for (float i = 0.0; i < m; ++i) {
    vec2 pp = sp+0.5*i;
    float s = i/(m-1.0);
    vec2 dim  = vec2(mix(0.05, 0.003, s)*PI);
    vec2 np = mod2(pp, dim);
    vec2 h = hash2(np+127.0+i);
    vec2 o = -1.0+2.0*h;
    float y = sin(sp.x);
    pp += o*dim*0.5;
    pp.y *= y;
    float l = length(pp);

    float h1 = fract(h.x*1667.0);
    float h2 = fract(h.x*1887.0);
    float h3 = fract(h.x*2997.0);

    vec3 scol = mix(8.0*h2, 0.25*h2*h2, s)*blackbody(mix(3000.0, 20000.0, h1*h1));

    vec3 ccol = col + exp(-(mix(6000.0, 2000.0, hh)/mix(2.0, 0.25, s))*max(l-0.001, 0.0))*scol;
    ccol *= mix(0.125, 1.0, smoothstep(1.0, 0.99, sin(0.33*TIME+TAU*h.y)));
    col = h3 < y ? ccol : col;
  }

  return col;
}

vec3 meteorite(vec2 sp) {
  const float period = 3.0;
  float mtime = mod(TIME, period);
  float ntime = floor(TIME/period);
  float h0 = hash(ntime+123.4);
  float h1 = fract(1667.0*h0);
  float h2 = fract(9967.0*h0);
  vec2 mp = sp;
  mp.x += -1.0;
  mp.y += -0.5*h1;
  mp.y += PI*0.5;
  mp *= ROT(PI+mix(-PI/4.0, PI/4.0, h0));
  float m = mtime/period;
  mp.x += mix(-1.0, 2.0, m);

  float d0 = length(mp);
  float d1 = segmentx(mp);

  vec3 col = vec3(0.0);

  col += 0.5*exp(-4.0*max(d0, 0.0))*exp(-1000.0*max(d1, 0.0));
  col *= 2.0*HSV2RGB(vec3(0.8, 0.5, 1.0));
  float fl = smoothstep(-0.5, 0.5, sin(12.0*TTIME));
  col += mix(1.0, 0.5, fl)*exp(-mix(100.0, 150.0, fl)*max(d0, 0.0));

  col = h2 > 0.8 ? col: vec3(0.0);
  return col;
}

vec3 skyGrid(vec2 sp) {
  const float m = 1.0;

  const vec2 dim = vec2(1.0/12.0*PI);
  float y = sin(sp.x);
  vec2 pp = sp;
  vec2 np = mod2(pp, dim*vec2(1.0/floor(1.0/y), 1.0));

  vec3 col = vec3(0.0);

  float d = min(abs(pp.x), abs(pp.y*y));

  float aa = 2.0/RESOLUTION.y;

  col += 0.25*vec3(0.5, 0.5, 1.0)*exp(-2000.0*max(d-0.00025, 0.0));

  return col;
}

vec3 sunset(vec2 sp, vec2 nsp) {
  const float szoom   = 0.5;
  float aa = length(nsp-sp)*sqrt(0.5);
  sp -= vec2(vec2(0.5, -0.5)*PI);
  sp /= szoom;
  sp = sp.yx;
  sp.y += 0.22;
  sp.y = -sp.y;
  float ds = sun(sp)*szoom;

  vec3 bscol = hsv2rgb(vec3(fract(0.7-0.25*(sp.y)), 1.0, 1.0));
  vec3 gscol = 0.75*sqrt(bscol)*exp(-50.0*max(ds, 0.0));
  vec3 scol = mix(gscol, bscol, smoothstep(aa, -aa, ds));
  return scol;
}

vec3 glow(vec3 ro, vec3 rd, vec2 sp, vec3 lp) {
  float ld = max(dot(normalize(lp-ro), rd),0.0);
  float y = -0.5+sp.x/PI;
  y = max(abs(y)-0.02, 0.0)+0.1*smoothstep(0.5, PI, abs(sp.y));
  float ci = pow(ld, 10.0)*2.0*exp(-25.0*y);
  float h = 0.65;
  vec3 col = hsv2rgb(vec3(h, 0.75, 0.35*exp(-15.0*y)))+HSV2RGB(vec3(0.8, 0.75, 0.5))*ci;
  return col;
}

vec3 neonSky(vec3 ro, vec3 rd, vec3 nrd, out float gl) {
  const vec3 lp       = 500.0*vec3(0.0, 0.25, -1.0);
  const vec3 skyCol   = HSV2RGB(vec3(0.8, 0.75, 0.05));


  float glare = pow(abs(dot(rd, normalize(lp))), 20.0);

  vec2 sp   = toSpherical(rd.xzy).yz;
  vec2 nsp  = toSpherical(nrd.xzy).yz;
  vec3 grd  = rd;
  grd.xy *= ROT(0.025*TIME);
  vec2 spp = toSpherical(grd).yz;

  float gm = 1.0/abs(rd.y)*mix(0.005, 2.0, glare);
  vec3 col = skyCol*gm;
  float ig = 1.0-glare;
  col += glow(ro, rd, sp, lp);
  if (rd.y > 0.0) {
    col += sunset(sp, nsp);
    col += stars(sp, 0.0)*ig;
    col += skyGrid(spp)*ig;
    col += meteorite(sp)*ig;
  }
  gl = glare;
  return col;
}

vec3 render0(vec3 ro, vec3 rd, vec3 nrd) {
  float glare;
  vec3 col = neonSky(ro, rd, nrd, glare);
  if (rd.y < 0.0) {
    float t;
    col += road(ro, rd, nrd, glare, t);
  }
  return col;
}


float g_gd;
mat3 g_rot = mat3(1.0);

#if defined(DF0)

#if !defined(BOXY)
#define BACKSTEP
#endif


float dfeffect(vec3 p, out float ogd) {
  const float sz = 20.0;
#if defined(BOXY)
  float d0 = box(p, vec3(sz));
  float d1 = boxf(p, vec3(sz+0.01), 0.0)-0.01;
#else
  float d0 = sphere8(p, (sz));
#endif
  vec3 p2 = p;
#if defined(FLAIR)
  const float bsz = 2.0*sz/(3.-1.0);
#else
  const float bsz = 2.0*sz/(24.0-1.0);
#endif
  mod3(p2, vec3(bsz));
  float d2 = box(p2, vec3(0.80*bsz*0.5))-0.15*bsz*0.5;

  float d4 = sphere4(p, sz+-0.005);

  float d = d2;
  d = max(d, d0);
#if defined(BOXY)
  d = min(d, d1);
#endif
  d = min(d, d4);

  float gd = d4;
#if defined(BOXY)
  gd = min(gd, d1);
#endif
  ogd = gd;

  return d;

}
#elif defined(DF1)
#if !defined(BOXY)
#define BACKSTEP
#endif

#define ZOOM        (0.166)
#define FWD(x)      exp2((x)*ZOOM)
#define REV(x)      (log2(x)/ZOOM)

float dfeffect(vec3 p, out float ogd) {
  const float sz = 20.0;
#if defined(BOXY)

  float d0 = box(p, vec3(sz));
  float d1 = boxf(p, vec3(sz+0.01), 0.0)-0.01;
#else
  float d0 = sphere8(p, (sz));
#endif
  float d3 = sphere4(p, sz);
  float d4 = min(min(abs(p.x), abs(p.y)), abs(p.z))-0.015;
#if defined(FLAIR)
  float d5 = max(d0, d4);
#endif
  vec3 p2 = p;

  p2 = abs(p2);
  p2 -= 20.0;

  vec3 fp2 = FWD(abs(p2));

  float n = floor(max(max(fp2.x, fp2.y), fp2.z));

  float x0 = REV(n);
  float x1 = REV(n+1.0);

  float m = (x0+x1)*0.5;
  float w = x1-x0;

  float d2 = abs(bbox(p2, vec3(m)))-(w*0.5)+0.125;

  d0 = max(d0, d2);

  float d = d0;
  d = min(d, d3);
#if defined(FLAIR)
  d = min(d, d5);
#endif
#if defined(BOXY)
  d = min(d, d1);
#endif

  float gd = d3;
#if defined(FLAIR)
  gd = min(gd, d5);
#endif
#if defined(BOXY)
  gd = min(gd, d1);
#endif
  ogd = gd;

  return d;

}
#elif defined(DF2)
#define BACKSTEP
#define BOUNCE_ONCE

float dfeffect(vec3 p, out float ogd) {
  const float sz = (20.0);
  vec3 p0 = p;
  vec3 p1 = p;
  p1 *= (g_rot);
  p1 = pabs(p1, 10.0);
  p1 -= 12.0;
  p1 *= (g_rot);
  float d0 = sphere8(p0, 20.0);
  float d1 = torus(p1, 10.0*vec2(1.0, 0.0125));

  float d = d0;
  d = pmax(d, -(d1-2.0), 5.0);
  d = min(d, d1);
  ogd = d1;

  return d;
}
#elif defined(DF3)
#define BACKSTEP
#define BOUNCE_ONCE
float dfeffect(vec3 p, out float ogd) {
  const float sz = (20.0);
  vec3 p0 = p;
  vec3 p1 = p;
  float d0 = sphere8(p0, 20.0);
  float d1 = sphere(p1, 15.0);

  float d = d0;
  d = pmax(d, -(d1-5.0), 6.0);
  d = min(d, d1);
  ogd = d1;

  return d;
}
#elif defined(DF4)
//#define BACKSTEP
#if !defined(FLAIR)
#define BOUNCE_ONCE
#endif

const float fixed_radius2 = 1.9;
const float min_radius2 = 0.1;
const float folding_limit = 1.0;
const float scale = -2.4;

void sphere_fold(inout vec3 z, inout float dz) {
  float r2 = dot(z, z);
  if(r2 < min_radius2) {
    float temp = (fixed_radius2 / min_radius2);
    z *= temp;
    dz *= temp;
  } else if(r2 < fixed_radius2) {
    float temp = (fixed_radius2 / r2);
    z *= temp;
    dz *= temp;
  }
}

void box_fold(inout vec3 z, inout float dz) {
  z = clamp(z, -folding_limit, folding_limit) * 2.0 - z;
}
float mb(vec3 z, out float ddd) {
  vec3 offset = z;
  float dr = 1.0;
#if defined(FLAIR)
  float d2 = 1E3;
#else
  float d2 = ((sphere4(z,2.0)));
#endif

  for(int n = 0; n < 5; ++n) {
    box_fold(z, dr);
    sphere_fold(z, dr);

    z = scale * z + offset;
    dr = dr * abs(scale) + 1.5;
#if defined(FLAIR)
    if (n < 2) {
      float d = (length(z))/abs(dr)-0.06;
      d2 = min(d, d2);
    }
#endif
  }

  float d = (length(z))/abs(dr)-0.04;
#if !defined(FLAIR)
  d2 = pmax(d2, -d, 0.5);
#endif
  d = min(d, d2);

  ddd = d2;

  return d;
}


float dfeffect(vec3 p, out float ogd) {
  const float z = 10.0;
  vec3 p0 = p/z;
  float d2;
  float d0 = mb(p0, d2);
  d0 *= z;
  float d1 = d2*z;

  ogd = d1;

  float d = d0;
  d = min(d, d1);
  return d0;

}
#elif defined(DF5)
#define BACKSTEP
#define BOUNCE_ONCE

float dfeffect(vec3 p, out float ogd) {
  const float sz = (22.0);
  float d = 1E3;
  ogd = 1E3;
  mat3 rot = g_rot;
  vec3 pp = p;
  const float zzz = 0.33;
  float zz = 1.0;
  const float MaxI = 5.0;
  for (float i = 0.0; i < MaxI; ++i) {
    pp = abs(pp);
    vec3 p0 = pp;
#if defined(BOXY)
    float d0 = (sphere4(p0, sz));
    float d1 = torus(p0, sz*vec2(1.1, 0.0033/(zz)));
#else
    float d0 = (sphere(p0, sz));
    float d1 = torus(p0, sz*vec2(1.01, 0.0033/(zz)));
#endif
    float dd = d0;
    dd = pmax(dd, -(d1), 3.0);
    dd = min(dd, d1);
    ogd = min(ogd, d1);
    dd *= zz;
    d = pmax(d, -(dd-2.0*zz), 5.0*zz);
    d = min(d, dd);
#if defined(BOXY)
    pp -= sz*(14.0/25.0);
#else
    pp -= sz*(11.0/25.0);
#endif
    pp /= zzz;
    zz *= zzz;
    pp *= rot;
    rot = transpose(rot);
  }

  return d;
}
#elif defined(DF6)
#define BACKSTEP
#define BOUNCE_ONCE
float dfeffect(vec3 p, out float ogd) {
  vec3 p0 = p;
  float d0 = sphere4(p0, 25.0);
  vec3 p2 = p;
  p2 *= transpose(g_rot);
  float d2 = sphere4(p2, 22.0);
  d0 = pmax(d0, -d2, 4.0);
  float d3 = pmax(d0, d2-2.0, .5);
  d0 = min(d0, d2);

  float d = d0;
  ogd = d3;
  return d;
}
#else
float dfeffect(vec3 p, out float ogd) {
  const float sz = (20.0);
  vec3 p0 = p;
  float d0 = box(p0, vec3(sz));
  vec3 p1 = p;
  float d1 = boxf(p1, vec3(sz+0.01), 0.)-0.01;

  float d = d0;
  d = min(d, d1);

  ogd = d1;

  return d;
}
#endif

float df(vec3 p) {
  float d0 = dot(roadDim.xyz, p)+roadDim.w;
  p.y += -20.0*1.30;
  p.z += 66.0;
  p *= g_rot;
  float gd1;
  float d1 = dfeffect(p, gd1);

  float d = max(d1, -d0);
  float gd = gd1;
  g_gd = min(g_gd, gd);

  return d;
}

vec3 normal(vec3 pos) {
  vec2  eps = vec2(NORM_OFF,0.0);
  vec3 nor;
  nor.x = df(pos+eps.xyy) - df(pos-eps.xyy);
  nor.y = df(pos+eps.yxy) - df(pos-eps.yxy);
  nor.z = df(pos+eps.yyx) - df(pos-eps.yyx);
  return normalize(nor);
}

float rayMarchLo(vec3 ro, vec3 rd, float tinit, out int iter) {
  float t = tinit;
  const float tol = TOLERANCE;
  int i = 0;
  for (i = 0; i < MAX_RAY_MARCHES_LO; ++i) {
    float d = df(ro + rd*t);
    if (d < TOLERANCE || t > MAX_RAY_LENGTH) {
      break;
    }
    t += d;
  }
  iter = i;
  return t;
}

float rayMarchHi(vec3 ro, vec3 rd, float tinit, out int iter) {
  float t = tinit;
  const float tol = TOLERANCE;
#if defined(BACKSTEP)
  vec2 dti = vec2(1e10,0.0);
#endif
  int i = 0;
  for (i = 0; i < MAX_RAY_MARCHES_HI; ++i) {
    float d = df(ro + rd*t);
#if defined(BACKSTEP)
    if (d<dti.x) { dti=vec2(d,t); }
#endif
    if (d < TOLERANCE || t > MAX_RAY_LENGTH) {
      break;
    }
    t += d;
  }
#if defined(BACKSTEP)
  if(i==MAX_RAY_MARCHES_HI) { t=dti.y; };
#endif
  iter = i;
  return t;
}

// License: CC0, author: Mårten Rånge, found: https://github.com/mrange/glsl-snippets
mat3 rotX(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(
    1.0 , 0.0 , 0.0
  , 0.0 , +c  , +s
  , 0.0 , -s  , +c
  );
}

// License: CC0, author: Mårten Rånge, found: https://github.com/mrange/glsl-snippets
mat3 rotY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(
    +c  , 0.0 , +s
  , 0.0 , 1.0 , 0.0
  , -s  , 0.0 , +c
  );
}

// License: CC0, author: Mårten Rånge, found: https://github.com/mrange/glsl-snippets
mat3 rotZ(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(
    +c  , +s  , 0.0
  , -s  , +c  , 0.0
  , 0.0 , 0.0 , 1.0
  );
}

vec3 render1(vec3 col, vec3 m, vec3 ro, vec3 rd, vec3 nrd) {
  //float tm = TIME*0.5;
  float tm = TIME*1.5;
  g_rot = rotX(0.333*tm)*rotZ(0.5*tm)*rotY(0.23*tm);

  int iter;
  g_gd = 1E3;
  float t = rayMarchHi(ro, rd, 0.0, iter);
  float gd = g_gd;
  vec3 ggcol = (glowCol1)*inversesqrt(max(gd, 0.00025));
  if (t < MAX_RAY_LENGTH) {
    vec3 p = ro+rd*t;
    vec3 n = normal(p);
    vec3 r = reflect(rd, n);
    vec3 nr = reflect(nrd, n);
    float fre0 = 1.0+dot(rd, n);
    float fre = fre0;
    fre *= fre;

    float ao = 1.0-float(iter)/float(MAX_RAY_MARCHES_HI);
    float fo = mix(0.2, 1.0, ao);
    vec3 rf = m*mix(0.33, 1.0, fre)*fo*0.75;

    const vec3 fre1 = HSV2RGB(vec3(0.8, 0.5, 1.0));
#if defined(BOUNCE_ONCE)
    g_gd = 1E3;
    int riter;
    float rt = rayMarchLo(p, r, 1.0, riter);
    float rgd = g_gd;
    vec3 rggcol = (glowCol1)*inversesqrt(max(rgd, 0.00025));

    vec3 rcol = clamp(rggcol, 0.0, 4.0);
    if (rt < MAX_RAY_LENGTH) {
      rcol += diffCol*0.2;
    } else {
      rcol += render0(p, r, nr);
    }
#else
    vec3 rcol = render0(p, r, nr);
#endif
    float dif = dot(sunDir1, n);
    col *= (1.0-m);
    col += m*sunCol1*dif*dif*diffCol*fo;
    col += rf*rcol*fre1;
  }

  col += clamp(m*ggcol, 0.0, 4.0);
  return col;
}

vec3 render2(vec3 ro, vec3 rd, vec3 nrd) {
  vec3 col = render0(ro, rd, nrd);

  float t   = rayPlane(ro, rd, roadDim);
  vec3 p    = ro+rd*t;
  vec3 n    = roadDim.xyz;
  vec3 r    = reflect(rd, n);
  vec3 nr   = reflect(nrd, n);
  float fre = 1.0+dot(n, rd);
  fre *= fre;

  vec3 ro0 = ro;
  vec3 rd0 = rd;
  vec3 nrd0= nrd;
  vec3 m0 = vec3(1.0);

  if (rd.y < -0.12) {
    ro0 = p;
    rd0 = r;
    nrd0 = nr;
    const vec3 fre0 = HSV2RGB(vec3(0.8, 0.9, 0.1));
    const vec3 fre1 = HSV2RGB(vec3(0.8, 0.3, 0.9));
    m0 = mix(fre0, fre1, fre);
  }

  col = render1(col, m0, ro0, rd0, nrd0);
  return col;
}

vec3 effect(vec2 p, vec2 pp) {
  float aa = 2.0/RESOLUTION.y;
  const vec3 ro = vec3(0.0, 0.0, 10.0);
  const vec3 la = vec3(0.0, 2.0, 0.0);
  const vec3 up = vec3(0.0, 1.0, 0.0);

  const vec3 ww = normalize(la - ro);
  const vec3 uu = normalize(cross(up, ww ));
  const vec3 vv = (cross(ww,uu));
  const float fov = tan(TAU/6.0);
  vec2 np = p + vec2(aa);
  vec3 rd = normalize(-p.x*uu + p.y*vv + fov*ww);
  vec3 nrd = normalize(-np.x*uu + np.y*vv + fov*ww);

  vec3 col = render2(ro, rd, nrd);
  col -= 0.0125*vec3(1.0, 2.0, 3.0)*(length(pp)+0.25);
  col *= smoothstep(1.75, 0.5, length(pp));
  col = aces_approx(col);
  col = sqrt(col);
  return col;
}


void main() {
    float time = TIME;
    vec2 q = vUv;
    vec2 p = -1.0 + 2.0*q;
    vec2 pp = p;
    p.x *= RESOLUTION.x/RESOLUTION.y;
    vec3 col = effect(p, pp);
    gl_FragColor = vec4(col, 1.0);
}
