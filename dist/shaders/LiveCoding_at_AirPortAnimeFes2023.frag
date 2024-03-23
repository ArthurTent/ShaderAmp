// https://www.shadertoy.com/view/dldyz2
// Adjusted by ArthurTent
// Created by gam0022
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

// Original Bonzomatic Shader
// https://gist.github.com/gam0022/362ed76ec245c2f418e8450b612dd7b0

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


#define time iGlobalTime
#define PI acos(-1.)
#define TAU (2. * PI)
#define _saturate(x) clamp(x, 0., 1.)
#define VOL 0.0
#define SOL 2.0
#define phase(x) (floor(x) + .5 + .5 * cos(TAU * .5 * exp(-5. * fract(x))))

float beat, beatTau, beatPhase;
vec3 pos, light;

vec4 map(vec3 p);

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.)) + min(0., max(q.x, max(q.y, q.z)));
}

void U(inout vec4 m, float d, float a, float b, float c) {
  if (d < m.x) m = vec4(d, a, b, c);
}

void rot(inout vec2 p, float a) { p *= mat2(cos(a), sin(a), -sin(a), cos(a)); }

void pmod(inout vec2 p, float s) {
  float n = TAU / s;
  float a = PI / s - atan(p.x, p.y);
  a = floor(a / n) * n;
  rot(p, a);
}

float fft(float d) { return texture(iAudioData, vec2(fract(d), 0)).r; }

float minRadius2 = 0.5;
float fixedRadius2 = 1.0;
float foldingLimit = 1.0;

void sphereFold(inout vec3 z, inout float dz) {
  float r2 = dot(z, z);
  if (r2 < minRadius2) {
    float temp = (fixedRadius2 / minRadius2);
    z *= temp;
    dz *= temp;
  } else if (r2 < fixedRadius2) {
    float temp = fixedRadius2 / r2;
    z *= temp;
    dz *= temp;
  }
}

void boxFold(inout vec3 z, inout float dz) { z = clamp(z, -foldingLimit, foldingLimit) * 2.0 - z; }

vec3 normal(vec3 p) {
  vec2 e = vec2(0, .0005);
  return normalize(map(p).x - vec3(map(p - e.yxx).x, map(p - e.xyx).x, map(p - e.xxy).x));
}


vec3 pal(float h) {
  vec3 col = vec3(0.5) + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + h));
  return mix(col, vec3(1), 0.1 * floor(h));
}

#define FLT_EPS 5.960464478e-8
float roughnessToExponent(float roughness) {
  return clamp(2.0 * (1.0 / (roughness * roughness)) - 2.0, FLT_EPS, 1.0 / FLT_EPS);
}

vec3 evalLight(vec3 p, vec3 normal, vec3 view, vec3 baseColor, float metallic, float roughness) {
  vec3 ref = mix(vec3(0.04), baseColor, metallic);
  vec3 h = normalize(light + view);
  vec3 diffuse = mix(1.0 - ref, vec3(0.0), metallic) * baseColor / PI;
  float m = roughnessToExponent(roughness);
  vec3 specular = ref * pow(max(0.0, dot(normal, h)), m) * (m + 2.0) / (8.0 * PI);
  return (diffuse + specular) * max(0.0, dot(light, normal));
}

vec4 dMenger(vec3 z0, vec3 offset, float scale, int iteration) {
  vec4 z = vec4(z0, 1.0);
  for (int n = 0; n < iteration; n++) {
    z = abs(z);

    if (z.x < z.y) z.xy = z.yx;
    if (z.x < z.z) z.xz = z.zx;
    if (z.y < z.z) z.yz = z.zy;

    z *= scale;
    z.xyz -= offset * (scale - 1.0);

    if (z.z < -0.5 * offset.z * (scale - 1.0)) {
      z.z += offset.z * (scale - 1.0);
    }
  }

  float d1 = sdBox(z.zxy, vec3(1)) / z.w;
  float d2 = sdBox(z.zxy, vec3(0.1, 1.2, 0.8)) / z.w;
  vec4 m = vec4(d1, SOL, 1, 10);
  float hue = 2. + fract(pos.z * 2. + length(pos.xy) * 0.2);
  U(m, d2, VOL, _saturate(cos(pos.z / 4. * TAU + beatTau / 2.)), hue);
  return m;
}

float dMandel(vec3 z, float scale, int n) {
  vec3 offset = z;
  float dr = 1.0;
  for (int i = 0; i < n; i++) {
    boxFold(z, dr);
    sphereFold(z, dr);
    z = scale * z + offset;
    dr = dr * abs(scale) + 1.0;
  }
  float r = length(z);
  return r / abs(dr);
}

vec4 map(vec3 p) {
  pos = p;
  vec4 m = vec4(1, 1, 1, 1);
  float a = 3.3;

  if (beat < 16.) {
    a = 10.;
    p = pos;
    rot(p.xz, beatTau / 32.);
    rot(p.xy, beatTau / 64.);
    p -= 0.5 * a;
    p = mod(p, a) - 0.5 * a;
    return vec4(dMandel(p, -3.3 + 1.5 * fft(0.2), 10), SOL, 8., 5. + fract(length(p)));
  } else if (beat < 16. * 2.) {
    a = 20.;
    p = pos;
    rot(p.xz, beatTau / 32.);
    p -= 0.5 * a;
    p = mod(p, a) - 0.5 * a;
    return vec4(dMandel(p, 2.78 + 1.5 * fft(0.2), 10), SOL, 8., 4.7);
  } else if (beat < 16. * 3.) {
    a = 4.;
    p = pos;
    p -= 0.5 * a;
    p = mod(p, a) - 0.5 * a;
    pmod(p.xy, 8.);
    return dMenger(p, vec3(1.5, 2.2, 0.7 + 2.5 * (0.5 + 0.5 * cos(beatTau / 16.))), 2.2, 4);
  }

  p = mod(pos, a) - 0.5 * a;
  float s = 1.;
  for (int i = 0; i < 4; i++) {
    p = abs(p) - 0.5;
    rot(p.xy, -0.5);
    p = abs(p) - 0.4;
    rot(p.yz, -0.1);

    float b = 1.4;
    p *= b;
    s *= b;
  }

  U(m, sdBox(p, vec3(0.5, 0.05, 0.05)) / s, SOL, 1., 10.);
  U(m, sdBox(p, vec3(0.1 + 0.5 * cos(beatTau / 8.), 0.06, 0.05)) / s, VOL, 0.1, 1.9);
  U(m, sdBox(p, vec3(0.2, 0.1, 0.1)) / s, VOL, _saturate(cos(beatTau / 2. + TAU * pos.z / 8.)), 5.5);

  return m;
}

vec3 render(vec3 ro, vec3 rd) {
  vec3 col = vec3(0);
  float t = 0.;
  for (int i = 0; i < 100; i++) {
    vec3 p = ro + rd * t;
    vec4 m = map(p);
    float d = m.x;

    if (m.y == SOL) {
      t += d;
      if (d < t * 0.001) {
        vec3 n = normal(p);
        float diffuse = _saturate(dot(n, light));
        col += evalLight(p, n, -rd, vec3(1), 0.7, 0.5) * pal(m.w) * m.z;
        t += d;
        break;
      }
    } else {
      t += abs(d) * 0.5 + 0.01;
      col += _saturate(0.001 * pal(m.w) * m.z / abs(d));
    }
  }
  col = mix(vec3(0), col, exp(-0.01 * t));
  return col;
}

void main() {
  beat = (time * 140. / 60.);
  beat = mod(beat, 16. * 4.);
  beatTau = beat * TAU;
  beatPhase = phase(beat / 2.);

  //vec2 uv = fragCoord.xy / iResolution.xy;
  vec2 uv = vUv;
  uv -= 0.5;
  uv /= vec2(iResolution.y / iResolution.x, 1);

  vec3 ro = vec3(0, 0, 0.5 * time);
  if (beat < 16.)
    ro = vec3(0, 0, -8);
  else if (beat < 16. * 2.)
    ro = vec3(0, 0, -15);

  vec3 rd = vec3(uv, 1.1);
  rd = normalize(rd);
  light = normalize(vec3(1, 1, -1));
  vec3 col = render(ro, rd);
  // col += texture(texSessions, saturate(vec2(0.5 + uv.x, 0.5 - uv.y * 2))).rgb * 100 * fft(0.2);
  gl_FragColor = vec4(col, 1);
}