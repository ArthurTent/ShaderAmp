// https://www.shadertoy.com/view/3lyBRt
// Modified by ArthurTent
// Created by mrange
// License CC0
// https://creativecommons.org/public-domain/cc0/

// License CC0: Tribute to my old Atari
//  That's where it started for me
//  Music: Rob Hubbard - Goldrunner - Piano performed by LightSide
#define TIME        iTime
#define RESOLUTION  iResolution
#define PI          3.141592654
#define TAU         (2.0*PI)
#define L2(x)       dot(x, x)
#define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))
#define TTIME       (TAU*TIME)
#define PSIN(x)     (0.5+0.5*sin(x))
#define freq(f)         texture(iAudioData, vec2(f, 0.25)).x * 0.8
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
vec4 fft, ffts; //compressed frequency amplitudes
// by QuantumSuper
void compressFft(){ //v1.2, compress sound in iChannel0 to simplified amplitude estimations by frequency-range
    fft = vec4(0), ffts = vec4(0);

    // Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)
    for (int n=0;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 0-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(3,8,8,5); ffts /= vec4(2,3,3,23); //normalize
    //for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //workaround for VirtualDJ, ?any hints for reverting audio limiters appreciated
}
// by QuantumSuper
vec3 getCol(float id){ //color definitions, for triplets
    vec3 setCol = vec3(0);
        if (id< 1.) setCol = vec3(244,  0,204); //vw2 pink
    else if (id< 2.) setCol = vec3(  0,250,253); //vw2 light blue
    else if (id< 3.) setCol = vec3( 30, 29,215); //vw2 blue
    else if (id< 4.) setCol = vec3(252,157,  0); //miami orange
    else if (id< 5.) setCol = vec3( 26,246,138); //miami green
    else if (id< 6.) setCol = vec3(131, 58,187); //nordic violet
    else if (id< 7.) setCol = vec3(231, 15, 20); //arena red
    else if (id< 8.) setCol = vec3( 35, 87, 97); //arena dark blue
    else if (id< 9.) setCol = vec3(103,211,225); //arena blue
    else if (id<10.) setCol = vec3(241,204,  9); //bambus2 yellow
    else if (id<11.) setCol = vec3( 22,242,124); //bambus2 green
    else if (id<12.) setCol = vec3( 30,248,236); //magic turquoise
    return setCol/256.;
}

float hash(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898,58.233))) * 13758.5453);
}

vec2 hextile(inout vec2 p) {
  // See Art of Code: Hexagonal Tiling Explained!
  // https://www.youtube.com/watch?v=VmrIDyYiJBA

  const vec2 sz       = vec2(1.0, sqrt(3.0));
  const vec2 hsz      = 0.5*sz;

  vec2 p1 = mod(p, sz)-hsz;
  vec2 p2 = mod(p - hsz, sz)-hsz;
  vec2 p3 = mix(p2, p1, vec2(dot(p1, p1) < dot(p2, p2)));
  vec2 n = ((p3 - p + hsz)/sz);
  p = p3;

  // Rounding to make hextile 0,0 well behaved
  return round(n*2.0)/2.0;
}

float tanh_approx(float x) {
//  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

// IQ's polynomial min
float pmin(float a, float b, float k) {
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}

float pabs(float a, float k) {
  return pmax(a, -a, k);
}

// IQ's box
float box(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

// IQ's isosceles triangle
float isosceles(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q*clamp( dot(p,q)/dot(q,q), 0.0, 1.0 );
  vec2 b = p - q*vec2( clamp( p.x/q.x, 0.0, 1.0 ), 1.0 );
  float s = -sign( q.y );
  vec2 d = min( vec2( dot(a,a), s*(p.x*q.y-p.y*q.x) ),
                vec2( dot(b,b), s*(p.y-q.y)  ));
  return -sqrt(d.x)*sign(d.y);
}

// IQ's horseshoe
float horseshoe(vec2 p, vec2 c, float r, vec2 w) {
  p.x = abs(p.x);
  float l = length(p);
  p = mat2(-c.x, c.y,
            c.y, c.x)*p;
  p = vec2((p.y>0.0)?p.x:l*sign(-c.x),
           (p.x>0.0)?p.y:l );
  p = vec2(p.x,abs(p.y-r))-w;
  return length(max(p,0.0)) + min(0.0,max(p.x,p.y));
}

// IQ's segment
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p-a, ba = b-a;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return length( pa - ba*h );
}

// IQ's segment
float parabola(vec2 pos, float k) {
  pos.x = abs(pos.x);
  float ik = 1.0/k;
  float p = ik*(pos.y - 0.5*ik)/3.0;
  float q = 0.25*ik*ik*pos.x;
  float h = q*q - p*p*p;
  float r = sqrt(abs(h));
  float x = (h>0.0) ?
        pow(q+r,1.0/3.0) - pow(abs(q-r),1.0/3.0)*sign(r-q) :
        2.0*cos(atan(r,q)/3.0)*sqrt(p);
  return length(pos-vec2(x,k*x*x)) * sign(pos.x-x);
}

float atari(vec2 p) {
  p.x = abs(p.x);
  float db = box(p, vec2(0.36, 0.32));

  float dp0 = -parabola(p-vec2(0.4, -0.235), 4.0);
  float dy0 = p.x-0.115;
  float d0 = mix(dp0, dy0, smoothstep(-0.25, 0.125, p.y)); // Very hacky

  float dp1 = -parabola(p-vec2(0.4, -0.32), 3.0);
  float dy1 = p.x-0.07;
  float d1 = mix(dp1, dy1, smoothstep(-0.39, 0.085, p.y)); // Very hacky

  float d2 = p.x-0.035;
  const float sm = 0.025;
  float d = 1E6;
  d = min(d, max(d0, -d1));;
  d = pmin(d, d2, sm);
  d = pmax(d, db, sm);

  return d;
}

float atari_a(inout vec2 p, vec2 off) {
  p -= vec2(0.275, 0.0);

  float d0 = isosceles(p*vec2(1.0, -1.0)-vec2(0.0, -0.225), vec2(0.20, 0.65))-0.1;
  float d1 = isosceles(p*vec2(1.0, -1.0)-vec2(0.0, -0.18), vec2(0.13, 0.55))-0.005;
  float d2 = box(p-vec2(0.0, -0.135), vec2(0.15, 0.06));
  float d3 = p.y+0.325;

  float d = d0;
  d = max(d, -d1);
  d = pmin(d, d2, 0.0125);
  d = pmax(d, -d3, 0.0125);

  p -= vec2(0.275, 0.0) + off;

  return d;
}

float atari_i(inout vec2 p, vec2 off) {
  p -= vec2(0.07, 0.0);

  float d0 = box(p, vec2(0.07, 0.325)-0.0125)-0.0125;

  float d = d0;

  p -= vec2(0.07, 0.0) + off;
  return d;
}

float atari_r(inout vec2 p, vec2 off) {
  p -= vec2(0.22, 0.0);

  float d0 = p.y+0.325;
  float d1 = circle(p - vec2(-0.12, 0.225), 0.1);
  const float a = PI/2.0;
  const vec2 c = vec2(cos(a), sin(a));
  vec2 hp = p;
  hp -= vec2(0.0, 0.14);
  hp.xy = -hp.yx;
  float d2 = horseshoe(hp, c, 0.125, 0.2175*vec2(0.12,0.275));
  float d3 = segment(p-vec2(-0.015, 0.005), vec2(0.0), vec2(0.22, -0.4))-0.07;
  float d5 = p.y - 0.205;
  float d6 = box(p - vec2(-0.155, -0.075), vec2(0.065, 0.30));
  float d7 = box(p - vec2(-0.055, 0.225), vec2(0.06, 0.1));

  float d = d1;
  d = min(d, d7);
  d = max(d, -d5);
  d = min(d, d2);
  d = min(d, d6);
  d = min(d, d3);
  d = pmax(d, -d0, 0.0125);
  p -= vec2(0.25, 0.0)+off;

  return d;
}

float atari_t(inout vec2 p, vec2 off) {
  p -= vec2(0.195, 0.0);

  float d0 = box(p - vec2(0.0, 0.265), vec2(0.195, 0.06)-0.0125)-0.0125;
  float d1 = box(p - vec2(0.0, -0.03), vec2(0.07, 0.295)-0.0125)-0.0125;

  float d = d0;
  d = pmin(d, d1, 0.0125);

  p -= vec2(0.195, 0.0) + off;

  return d;
}

float atari_text(vec2 p) {
  p -= vec2(-0.33, 0.0);
  float d = 1E6;
  vec2 rp = p;
  rp.x = abs(rp.x);
  rp.x -= -0.195;
  d = min(d, atari_t(rp, vec2(-0.055, 0.0)));
  d = min(d, atari_a(rp, vec2(-0.055, 0.0)));
  p.x -= 0.72;
  d = min(d, atari_r(p, vec2(0.02, 0.0)));
  d = min(d, atari_i(p, vec2(0.0, 0.0)));
  return d;
}

float height_(vec2 p) {
  p *= 0.2;
  vec2 p0 = p;
  vec2 n0 = hextile(p0);
  p0 *= ROT(TAU*hash(n0));
  const float ss = 0.95;
  float d0 = atari(p0/ss)*ss;
  float d = d0;
  return 0.25*tanh_approx(smoothstep(0.0125, -0.0125, d)*exp(2.0*-d));
//  return 0.25*smoothstep(0.0125, -0.0125, d);
}


float height(vec2 p) {
  const mat2 rot1 = ROT(1.23);
  float tm = 123.0+TTIME/320.0;
  p += 5.0*vec2(cos(tm), sin(tm*sqrt(0.5)));
  const float aa = -0.45;
  const mat2  pp = (1.0/aa)*rot1;
  float h = 0.0;
  float a = 1.0;
  float d = 0.0;
  for (int i = 0; i < 6; ++i) {
    h += a*height_(p);
    d += a;
    a *= aa;
    p *= pp;
  }
  const float hf = -0.125;
  return hf*(h/d)+hf;
}

vec3 normal(vec2 p) {
  vec2 v;
  vec2 w;
  vec2 e = vec2(4.0/RESOLUTION.y, 0);

  vec3 n;
  n.x = height(p + e.xy) - height(p - e.xy);
  n.y = 2.0*e.x;
  n.z = height(p + e.yx) - height(p - e.yx);

  return normalize(n);
}

float mod1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize, size) - halfsize;
  return c;
}

float synth(vec2 p) {
  const float z = 4.0;
  const float st = 0.02;
  float dob = box(p, vec2(1.4, 0.5));
  p.x = abs(p.x);
  p.x += st*20.0;
  p /= z;
  float n = mod1(p.x, st);
  float dib = 1E6;
  const int around = 1;
  for (int i = -around; i <=around ;++i) {
    float fft = texture(iAudioData, vec2((n+float(i))*st, 0.25)).x;
    fft = sqrt(fft);
    float dibb = box(p-vec2(st*float(i), 0.0), vec2(st*0.25, 0.05*fft+0.001));
    dib = min(dib, dibb);
  }

  float dl = p.y;
  dl = abs(dl) - 0.005;
  dl = abs(dl) - 0.0025;
  dl = abs(dl) - 0.00125;
  float d = dib;
  d = max(d, -dl);
  d = pmax(d, dob, 0.025);
  return d*z;
}

vec3 color(vec2 p) {
  vec2 ppp = p;
  const float s = 1.0;
  const vec3 lp1 = vec3(1.0, 1.25, 1.0)*vec3(s, 1.0, s);
  const vec3 lp2 = vec3(-1.0, 1.25, 1.0)*vec3(s, 1.0, s);

  float aa = 2.0/RESOLUTION.y;

  float h = height(p);
  vec3  n = normal(p);

  vec3 ro = vec3(0.0, -10.0, 0.0);
  vec3 pp = vec3(p.x, 0.0, p.y);

  vec3 po = vec3(p.x, h, p.y);
  vec3 rd = normalize(ro - po);

  vec3 ld1 = normalize(lp1 - po);
  vec3 ld2 = normalize(lp2 - po);

  float diff1 = max(dot(n, ld1), 0.0);
  float diff2 = max(dot(n, ld2), 0.0);

  vec3  rn    = n;
  vec3  ref   = reflect(rd, rn);
  float ref1  = max(dot(ref, ld1), 0.0);
  float ref2  = max(dot(ref, ld2), 0.0);

  vec3 lcol1 = vec3(1.25, 1.35, 2.0);
  vec3 lcol2 = vec3(2.0, 1.55, 1.25);
  vec3 lpow1 = 0.15*lcol1/L2(ld1);
  vec3 lpow2 = 0.25*lcol2/L2(ld2);
  vec3 dm = vec3(1.0)*tanh_approx(-h*10.0+0.125);
  vec3 col = vec3(0.0);
  col += dm*pow(diff1, 4.0)*lpow1;
  col += dm*pow(diff2, 4.0)*lpow2;
  vec3 rm = vec3(1.0)*mix(0.25, 1.0, tanh_approx(-h*1000.0));
  col += rm*pow(ref1, 20.0)*lcol1;
  col += rm*pow(ref2, 20.0)*lcol2;

  float ds = synth(ppp-vec2(0.0, -0.75));

  const float zp = 1.35;
  float di = atari_text(ppp/zp)*zp;
  float dio = di;
  dio = abs(dio-0.015) - 0.0075;

  di = min(di, dio);
  float dg = di;
  di = min(di, ds);

  col += -lcol2*0.125*(exp(-5.0*max(di, 0.0)));

  col = mix(col, vec3(0.85), smoothstep(-aa, aa, -di));
  dg = abs(dg-0.025);
  dg = abs(dg-0.0125);
  //float glow = exp(-20.0*max(dg+0., 0.0));
  float glow = exp(-40.0*ds*max(dg+0., 0.0));
  vec3 glowCol = mix(lcol2.zyx*lcol2.zyx/6.0, lcol2.zyx, glow*glow);
  col += glowCol*glow*pow(PSIN(-0.8+0.5*p.x-p.y-TTIME/16.0), 14.0);

  return col;
}

// Post processing I found somewhere on shadertoy years ago
vec3 postProcess(vec3 col, vec2 q) {
  col = clamp(col, 0.0, 1.0);
  col = pow(col, 1.0/vec3(2.2));
  col = col*0.6+0.4*col*col*(3.0-2.0*col);
  col = mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  col *=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
  return col;
}
// https://iquilezles.org/articles/palettes/
vec3 palette2( float t ) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(2.0, 1.0, 0.0);
    vec3 d = vec3(0.5, 0.2, 0.25);

    return a + b*cos( 6.28318*(c*t+d) );
}
void main() {
  //vec2 q = fragCoord/RESOLUTION.xy;
  vec2 q = vUv;
  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x/RESOLUTION.y;
  vec3 col = color(p);
  col = clamp(col, 0.0, 1.0);
  col *= smoothstep(0.0, 8.0, TIME);
  col = postProcess(col, q);
  // sound
  float snd = freq(col.x);
  col *= palette2(col.x*snd);
  //col = mat3(getCol(fft.x),getCol(fft.y+1.),getCol(fft.z)) * col;

  gl_FragColor = vec4(col, 1.0);
}