// https://www.shadertoy.com/view/csfyzS
// Modified by ArthurTent
// Modified by Pink
// License: CC0
// https://creativecommons.org/public-domain/cc0/

//Hack on https://www.shadertoy.com/view/ddfyD7 to add sound reactivity and, in the spirit, complicate things further.


// CC0: Complicating things even further
//  That is what I do.
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
#define TIME        iAmplifiedTime
#define RESOLUTION  iResolution
#define PI          3.141592654
#define PI_2        (0.5*PI)
#define TAU         (2.0*PI)
#define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))
#define BPM         (143.0*0.5)
#define PCOS(a)     0.5*(cos(a)+1.0)

const float planeDist = 1.0-0.75;
const int   furthest  = 12;
const int   fadeFrom  = max(furthest-4, 0);
const float fadeDist  = planeDist*float(furthest - fadeFrom);


//License:Unknown, author akufishi, found https://www.shadertoy.com/view/DtGXR3
float gaussian(float t)
{
    return exp(-(5.0 * pow(t - 0.5, 2.0)));
}

float audio_sample(float t)
{
    int tx = int(t * 512.0);

    float fft  = texelFetch( iAudioData, ivec2(tx, 0), 0 ).x;

    return fft * gaussian(t) + 0.01 + (sin((iAmplifiedTime / 2. + t) * 5.) / 2. + 1.) / 50.;
}

// License: Unknown, author: Unknown, found: don't remember
vec4 alphaBlend(vec4 back, vec4 front) {
  float w = front.w + back.w*(1.0-front.w);
  vec3 xyz = (front.xyz*front.w + back.xyz*back.w*(1.0-front.w))/w;
  return w > 0.0 ? vec4(xyz, w) : vec4(0.0);
}

// License: Unknown, author: Unknown, found: don't remember
vec3 alphaBlend(vec3 back, vec4 front) {
  return mix(back, front.xyz, front.w);
}

// License: Unknown, author: Unknown, found: don't remember
float tanh_approx(float x) {
  //  Found this somewhere on the interwebs
  //  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

vec3 offset(float z) {
  float a = z*0.5;
  vec2 p = -0.25*(vec2(cos(a), sin(a*sqrt(2.0))) + vec2(cos(a*sqrt(0.75)), sin(a*sqrt(0.6))));
  return vec3(p, z);
}

vec3 doffset(float z) {
  const float eps = 0.05;
  return (offset(z + eps) - offset(z - eps))/(2.0*eps);
}

vec3 ddoffset(float z) {
  const float eps = 0.05;
  return (doffset(z + eps) - doffset(z - eps))/(2.0*eps);
}

vec3 skyColor(vec3 ro, vec3 rd) {
  return vec3(0.0);
}

// License: MIT, author: Pascal Gilcher, found: https://www.shadertoy.com/view/flSXRV
float atan_approx(float y, float x) {
  float cosatan2 = x / (abs(x) + abs(y));
  float t = PI_2 - cosatan2 * PI_2;
  return y < 0.0 ? -t : t;
}

vec2 toPolar(vec2 p) {
  return vec2(length(p), atan_approx(p.y, p.x));
}

vec2 toRect(vec2 p) {
  return vec2(p.x*cos(p.y), p.x*sin(p.y));
}

// License: MIT OR CC-BY-NC-4.0, author: mercury, found: https://mercury.sexy/hg_sdf/
float modMirror1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize,size) - halfsize;
  p *= mod(c, 2.0)*2.0 - 1.0;
  return c;
}

// License: MIT, author: Inigo Quilez, found: https://www.iquilezles.org/www/articles/smin/smin.htm
float pmin(float a, float b, float k) {
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float pabs(float a, float k) {
  return -pmin(a, -a, k);
}

float smoothKaleidoscope(inout vec2 p, float sm, float rep) {
  /*vec2 hp = p;

  vec2 hpp = toPolar(hp);
  float rn = modMirror1(hpp.y, TAU/rep);

  float sa = PI/rep - pabs(PI/rep - abs(hpp.y), sm);
  hpp.y = sign(hpp.y)*(sa);

  hp = toRect(hpp);

  p = hp;

  return rn;
  /**/

  vec2 hp = p;
  float snd = audio_sample(sm);
  vec2 hpp = toPolar(hp);
  float rn = modMirror1(hpp.y, TAU/(rep+snd));

  float sa = PI/rep - pabs(PI/rep*snd - abs(hpp.y), sm*snd);
  hpp.y = sign(hpp.y)*(sa);

  hp = toRect(hpp);

  p = hp;

  return rn;
}

vec3 palette( float t ) {
  return (1.0+cos(1.0*vec3(0.0, 1.0, 2.0)+TAU*t))*0.5;
}

// License: Unknown, author: kishimisu, found: https://www.shadertoy.com/view/mtyGWy
vec3 kishimisu(vec3 col, vec2 p, float tm, float n) {
  vec2 p0 = p;
  vec3 finalColor = vec3(0.0);

  //Tweaked by Pink. The original author can probably find better places to insert changes to make it react better.
  float vol = 4.0*audio_sample(mod(p.x*0.5*tm,1.0));

  vec2 p1 = p;
  for (float i = 0.0; i < 2.0 + vol; i++) {

    p1 = fract(p1 * 2.0+0.0125*tm) - 0.5;

    //float d = length(p1) * exp(-length(p0)) + vol*0.0125;
    float d = length(p1) * exp(-length(p0)) + vol*0.5125;

    vec3 cc = palette(length(p0) + i*.2 * vol + tm*.2);

    d = sin(d*8. + tm)/8.;
    d = abs(d);

    d -= 0.0025;
    d = max(d, 0.005);
    d = (0.0125 / d);
    d *= d;

    col += cc * d*vol*2.;
  }

  return 0.5*(col);
}

vec3 effect(vec2 p, float tm, float n) {
  vec3 col = vec3(0.0);
  vec2 kp = p;
  float kl = dot(kp, kp);
  float nn = 2.0*floor(mix(3.0, 16.0, 0.5+0.5*sin(0.1*n)));
  float kn = smoothKaleidoscope(kp, 0.1, nn);
  kp += 0.5*sin(vec2(1.0, sqrt(0.5))*tm*0.21);
  col = kishimisu(col, kp, tm, n);
  col -= 0.75*vec3(0.0, 1.0, 2.0).zyx*dot(p,p);
  col = clamp(col, 0.0, 4.0);
  return col;
}

vec4 plane(vec3 ro, vec3 rd, vec3 pp, vec3 off, float aa, float n) {
  float vol =  texture(iAudioData, vec2(0., 0.14)).x;
  vec2 p = (pp-off*vec3(1.0, 1.0, 0.0)).xy;
  float l = length(p);
  p *= mix(0.5, 0.75, 0.5+0.5*sin(n*0.071));
  p *= ROT(-.033*n);
  float fade = smoothstep(0.1, 0.15, l);
  if (fade < 0.05) return vec4(0.0);
  vec4 col = vec4(vol);

  float tm = 0.5*0.125*TIME+0.125*n;
  col.xyz = effect(p, tm, n);
  float i = max(max(col.x, col.y), col.z)*0.75*vol;
  col.w = (tanh_approx(0.5+l+max((i), 0.0))*fade);
  return col;
}

vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {
  float vol =  texture(iAudioData, vec2(0., 0.14)).x;
  float lp = length(p);
  vec2 np = p + 1.0/RESOLUTION.xy;
  const float rdd_per   = 10.0;
  float rdd =  (1.75+0.75*pow(lp,1.5)*tanh_approx(lp+0.9*PCOS(rdd_per*p.x)*PCOS(rdd_per*p.y)));
//  float rdd = 2.0;

  vec3 rd = normalize(p.x*uu + p.y*vv + rdd*ww);
  vec3 nrd = normalize(np.x*uu + np.y*vv + rdd*ww);

  float nz = floor(ro.z / planeDist);

  vec3 skyCol = skyColor(ro, rd);


  vec4 acol = vec4(0.0);
  const float cutOff = 0.975;
  bool cutOut = false;

  float maxpd = 0.0;

  // Steps from nearest to furthest plane and accumulates the color
  for (int i = 1; i <= furthest; ++i) {
    //float vol =  texture(iAudioData, vec2(i, 0.25)).x;
    float vol =  texture(iAudioData, vec2(i, 0.0)).x;
    float pz = planeDist*nz + planeDist*float(i);

    float pd = (pz - ro.z)/rd.z;

    if (pd > 0.0 && acol.w < cutOff) {
      vec3 pp = ro + rd*pd;
      maxpd = pd;
      vec3 npp = ro + nrd*pd;

      float aa = 3.0*length(pp - npp);

      vec3 off = offset(pp.z);

      vec4 pcol = plane(ro, rd, pp, off, aa, nz+float(i));

      float nz = pp.z-ro.z;
      float fadeIn = smoothstep(planeDist*float(furthest), planeDist*float(fadeFrom), nz);
      float fadeOut = smoothstep(0.0, planeDist*0.1, nz)*vol+0.025;
      pcol.w *= fadeOut*fadeIn;
      //pcol = clamp(pcol, 0., vol);
      pcol = clamp(pcol, 0., 1.);

      acol = alphaBlend(pcol, acol);
    } else {
      cutOut = true;
      acol.w = acol.w > cutOff ? 1.0 : acol.w;
      break;
    }

  }

  vec3 col = alphaBlend(skyCol, acol);
// To debug cutouts due to transparency
//  col += cutOut ? vec3(1.0, -1.0, 0.0) : vec3(0.0);
  return col;
}

vec3 effect(vec2 p, vec2 pp) {
  float tm  = planeDist*TIME*BPM/60.0;
  vec3 ro   = offset(tm);
  vec3 dro  = doffset(tm);
  vec3 ddro = ddoffset(tm);

  vec3 ww = normalize(dro);
  vec3 uu = normalize(cross(normalize(vec3(0.0,1.0,0.0)+ddro), ww));
  vec3 vv = cross(ww, uu);

  vec3 col = color(ww, uu, vv, ro, p);
  col *= smoothstep(1.0, 10.0, TIME);
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

  vec3 col = effect(p, pp);

  gl_FragColor = vec4(col, 1.0);
}

