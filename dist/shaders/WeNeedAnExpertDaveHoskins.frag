// https://www.shadertoy.com/view/dsc3RS
// Modified by ArthurTent
// Created by mrange
// License: Creative Commons Zero (CC0)
// https://creativecommons.org/public-domain/cc0/

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// CC0: We need an expert.. Dave Hoskins
//  Thanks Dave_Hoskins for fixing the shader
//
//  Took the previous shader and put some music to it. Music can sometimes be a bit finicky to get playing
//  Usually it's the browser that prevents because the user hasn't interacted with the play controls
//  So fiddling with stop and start usually works for me.

//  Inspired by this tweet: https://twitter.com/lainmell/status/1629414269019357184?s=20
//  Very different from how I usually do stuff so wanted to make a try for something
//  that looked like it.


#define TIME        iGlobalTime
#define RESOLUTION  iResolution
#define PI          3.141592654
#define TAU         (2.0*PI)
#define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))

const vec3 LightDir0  = normalize(vec3(2.0, 2.0, 1.0));
const int   MaxIter   = 40;
const float Bottom    = 0.0;
const float MinHeight = 0.25;
const float MaxHeight = 7.0;
const float sz        = 0.475;
const float eps       = 1E-3;

// License: Unknown, author: Claude Brezinski, found: https://mathr.co.uk/blog/2017-09-06_approximating_hyperbolic_tangent.html
float tanh_approx(float x) {
  //  Found this somewhere on the interwebs
  //  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

// License: MIT, author: Inigo Quilez, found: https://www.iquilezles.org/www/articles/spherefunctions/spherefunctions.htm
vec2 rayBox(vec3 ro, vec3 rd, vec3 boxSize, out vec3 outNormal )  {
    vec3 m = 1.0/rd; // can precompute if traversing a set of aligned boxes
    vec3 n = m*ro;   // can precompute if traversing a set of aligned boxes
    vec3 k = abs(m)*boxSize;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    float tN = max( max( t1.x, t1.y ), t1.z );
    float tF = min( min( t2.x, t2.y ), t2.z );
    if( tN>tF || tF<0.0) return vec2(-1.0); // no intersection
    outNormal = (tN>0.0) ? step(vec3(tN),t1) : // ro ouside the box
                           step(t2,vec3(tF));  // ro inside the box
    outNormal *= -sign(rd);
    return vec2( tN, tF );
}

float select(vec2 p) {
  p *= 0.00125;
  float h = texture(iChannel1, p).x;
  h -= 0.5;
  h *= 2.0;
  return h;
}

vec3 baseCol(vec2 p) {
  float h = select(p);
  vec3 sc = h > 0.0 ? vec3(0.1) : vec3(1.0, 0.0, 0.0);
  return mix(vec3(1.0), sc, smoothstep(0.33, 0.66, abs(h)));
}

float height(vec2 p) {
  float s = select(p);
//  p += TIME*0.5;

  float w = sin(0.1*(p.x+p.y)+0.3*TIME);
//  w = 1.0;
  p *= 0.001;
  float h = texture(iChannel1, p).x;
//  h += 0.5*texture(iChannel1, 2.0*p).x;
  h *= h;
  h *= smoothstep(-2.0, 0.9, w);
  h = smoothstep(0.0, 0.75, h);
  float fs = smoothstep(0.33, 0.66, abs(s));
  vec2 fp = 20.0*p;
  float fft = texture(iAudioData, vec2(0.1+0.8*fract(fp.x+0.25*fp.y+0.25*sign(s)), 0.25)).x;
  fft -= 0.3;
  fft = max(fft, 0.0);
  fft *= fft;
//  fft *= fft;
  fft = 1.25*smoothstep(0.0, 0.28, fft);
  h = mix(h, fft, 0.8*fs);
  h = clamp(h, 0.0, 1.0);
  return mix(MinHeight, MaxHeight, h)*0.5;
}

float cellTrace(
    vec3      ro
  , vec3      rd
  , float     near
  , float     far
  , out int   iter
  , out vec2  cell
  , out vec2  boxi
  , out vec3  boxn
  ) {
  vec2 rd2  = rd.xz;
  vec2 ird2 = 1.0/rd.xz;
  vec2 stp  = step(vec2(0.0), rd2);

  float ct = near;
  iter = MaxIter;
  vec2 bi = vec2(-1.0);
  vec3 bn = vec3(0.0);
  vec2 np2 = vec2(0.0);
  float ft = far;

  for (int i = 0; i < MaxIter; ++i) {
    vec3 cp = ro+rd*ct;
    np2 = floor(cp.xz);
    float h = height(np2);
    vec3 bdim = vec3(sz, h, sz);
    vec3 coff = vec3(np2.x+0.5, h, np2.y+0.5);
    vec3 bro = ro-coff;
    bi = rayBox(bro, rd, bdim, bn);

    if (bi.x> 0.0) {
      float bt = bi.x;
      if (bt >= far) {
        break;
      }
      ft = bt;
      iter = i;
      break;
    }

    // Step to next cell
    vec2 dif = np2 - cp.xz;
    dif += stp;
    dif *= ird2;
    float dt = min(dif.x, dif.y);
    ct += dt+eps;

    if (ct >= far) {
      break;
    }
  }
  cell = np2;
  boxi = bi;
  boxn = bn;
  return ft;
}

vec3 render(vec3 ro, vec3 rd) {
  vec3 sky = vec3(1.0);

  float skyt = 1E3;
  float bottom  = -(ro.y-Bottom)/rd.y;
  float near    = -(ro.y-(MaxHeight))/rd.y;
  float far     = bottom >= 0.0 ? bottom : skyt;

  int iter;
  vec2 cell;
  vec2 boxi;
  vec3 boxn;
  float ct = cellTrace(ro, rd, near, far, iter, cell, boxi, boxn);
  if (ct == skyt) {
    return sky;
  }

  vec3 p = ro + ct*rd;

  int siter;
  vec2 scell;
  vec2 sboxi;
  vec3 sboxn;
  float sfar  = -(p.y-MaxHeight)/LightDir0.y;
  float sct   = cellTrace((p-2.0*eps*rd), LightDir0, eps, sfar, siter, scell, sboxi, sboxn);

  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 bcol = vec3(0.5);

  if (iter < MaxIter) {
    n = boxn;
    bcol = baseCol(cell);
    bcol *= smoothstep(0.0, 0.1, boxi.y-boxi.x);
  }
  float dif0 = max(dot(n, LightDir0), 0.0);
  dif0 = sqrt(dif0);
  float sf = siter < MaxIter ? tanh_approx(0.066*sct) : 1.0;
  bcol *= mix(0.3, 1.0, dif0*sf);

  vec3 col = bcol;
  col = mix(col, sky, 1.0-exp(-0.125*max(ct-50.0, 0.0)));

  return col;
}

vec3 effect(vec2 p, vec2 pp) {
  const float fov = tan(TAU/6.0);

  vec3 ro = 4.0*vec3(0.0, 4.0, -4.);
  float off = 2.0*TIME;
  ro.z += off;
  const vec3 up = vec3(0.0, 1.0, 0.0);
  const vec3 ww = normalize(vec3(0.5,-1., 1.0));
  vec3 uu = normalize(cross(up, ww));
  vec3 vv = cross(ww,uu);
  vec3 rd = normalize(-p.x*uu + p.y*vv + fov*ww);

  float fft = texture(iAudioData, vec2(0.1+0.8*fract(off+0.25*sin(fov)), 0.25)).x;
  vec3 col = render(ro, rd);
  col -= 0.1;
  col *= 1.1;
  col = clamp(col, 0.0, 1.0);
  col = sqrt(col);
  return col;
}

void main() {
  //vec2 q = fragCoord/RESOLUTION.xy;
  vec2 q = vUv;
  vec2 p = -1. + 2. * q;
  vec2 pp = p;
  p.x *= RESOLUTION.x/RESOLUTION.y;
  vec3 col = effect(p, pp);;
  gl_FragColor = vec4(col, 1.0);
}
