#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iChannel1; // overlay texture
uniform sampler2D iChannel2; // overlay texture
varying vec2 vUv;

// Large Hedron Collider visualizer by Orblivius
// Email: orblivius@protonmail.com
//
// Sources: https://www.shadertoy.com/view/w3fcRN
// XoR good work and I take it to the next level =)


/****************
*
*God Rays
*
****************/

#define WEB

//uniforms
#define DECAY     0.999
#define DENSITY   0.2
#define WEIGHT    0.5
#define EXPOSURE  0.8
#define SAMPLES_COUNT   40

#define LIGHT_SOURCE_TEXTURE iChannel0

#ifdef WEB
#define iBeat 0.0
#define iStationTitleLen 0
#define iSongTitleLen 0
int iStationTitle[2];
int iSongTitle[2];
#endif

#define PI 3.141596
#define S smoothstep

#define DEVICE
const float EPSILON = 1e-6;

const float textSize = 0.13;


#ifndef DEVICE

int   iSongTitle[ 128 ];               // song title
int   iSongTitleLen = 0;                    // song title length
int   iStationTitle[ 128 ];               // song title
int   iStationTitleLen = 0;                    // song title length
#define iBeatAvg 1.0
#define iBeatDet 0.0
#else
#define T iBeat
#endif


#define TIME        iTime
#define RESOLUTION  iResolution
#define TAU         (2.0*PI)


int _iSongTitleLen = 0;
int _iSongTitle[128];


uvec3 pcg3d(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y*v.z;
    v.y += v.z*v.x;
    v.z += v.x*v.y;
    v ^= v >> 16u;
    v.x += v.y*v.z;
    v.y += v.z*v.x;
    v.z += v.x*v.y;
    return v;
}

uvec3 uround(vec3 pos) {
   return uvec3(abs(ivec3(floor(pos))+64000));
}

vec3 fround(uvec3 x) {
    return fract(vec3(x)*(1.0/64000.0)) * 2.0 - 1.0;
}

vec3 pcg3dfn(vec3 pos) {
    return fround(pcg3d(uround(pos)));
}

vec3 smix(vec3 a, vec3 b, float f) {
    return mix(a,b,f);
    return mix(a,b,smoothstep(0.0, 1.0, f));
}

vec3 pcg3dfl(vec3 pos) {
    uvec3 pu = uround(pos);
    vec3 p000 = fround(pcg3d(pu + uvec3(0,0,0)));
    vec3 p100 = fround(pcg3d(pu + uvec3(1,0,0)));
    vec3 p010 = fround(pcg3d(pu + uvec3(0,1,0)));
    vec3 p110 = fround(pcg3d(pu + uvec3(1,1,0)));
    vec3 p001 = fround(pcg3d(pu + uvec3(0,0,1)));
    vec3 p101 = fround(pcg3d(pu + uvec3(1,0,1)));
    vec3 p011 = fround(pcg3d(pu + uvec3(0,1,1)));
    vec3 p111 = fround(pcg3d(pu + uvec3(1,1,1)));
    vec3 f = fract(pos);
    vec3 p00 = smix(p000, p100, f.x);
    vec3 p10 = smix(p010, p110, f.x);
    vec3 p01 = smix(p001, p101, f.x);
    vec3 p11 = smix(p011, p111, f.x);
    vec3 p0 = smix(p00, p10, f.y);
    vec3 p1 = smix(p01, p11, f.y);
    return mix(p0,p1,f.z);
}

vec3 perlin(vec3 pos, int n) {
     vec3 r = vec3(0.0);
     float s = 1.0;
     for ( int i=0; i<n; i++ ) {
         vec3 rp = pcg3dfl(pos);
         r += rp * s;
         //pos += rp * s;
         pos *= 2.0;
         s *= .5;
     }
     return r;
}
vec4 texChar(int char, vec2 uv) {
    vec2 uvc = clamp(uv, vec2(0.0), vec2(1.0));
    uvc.x += float(char&15);
    uvc.y += float(15-(char>>4));
    return textureLod(iChannel2, uvc * 1.0/16.0, 0.0);
}



float sdBox( vec3 p, vec3 b ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdTextBox ( vec3 p, vec3 b, int char ) {
    float l = sdBox(p,b);
    if ( abs(l) > .5 ) return l;
    vec2 pn = (p.xy / b.xy) * .5 + .5;
    float lt = (texChar(char, pn*vec2(0.5,0.75)+vec2(0.25,0.125)).w - .5)*.35;
    return max(lt,l);
}

float sd ( vec3 p ) {
    float pnx = p.x *.5 + .5;
    p.x = fract(pnx)*2.0 - 1.0;
    int ch = _iSongTitle[int(abs(pnx)) % _iSongTitleLen];

    return sdTextBox(p, vec3(1.,1.,.06), ch);
}

vec3 normal ( vec3 p ) {
    float eps = 0.04;
    vec3 n;
    n.x = sd(vec3(p.x-eps, p.y, p.z)) - sd(vec3(p.x+eps, p.y, p.z));
    n.y = sd(vec3(p.x, p.y-eps, p.z)) - sd(vec3(p.x, p.y+eps, p.z));
    n.z = sd(vec3(p.x, p.y, p.z-eps)) - sd(vec3(p.x, p.y, p.z+eps));
    return normalize(n);
}

float raymarch ( vec3 org, vec3 dir, float tmax ) {
    int maxsteps = 40;
    float eps = 0.005;
    float t = eps;
    for ( int i=0; i<maxsteps; i++ ) {
        float d = sd(org+dir*t);
        if ( abs(d) < eps )
            return t;
        t += d;
        if ( t < 0.0 || t > tmax)
            break;
    }
    return -1.0;
}

vec2 mirror(vec2 p) {
    return abs(fract(p*.5)*2.0-1.0);
}


// License: WTFPL, author: sam hocevar, found: https://stackoverflow.com/a/17897228/418488
const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}
// License: WTFPL, author: sam hocevar, found: https://stackoverflow.com/a/17897228/418488
//  Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))


// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/noacos/
mat3 rot(vec3 d, vec3 z) {
  vec3  v = cross( z, d );
  float c = dot( z, d );
  float k = 1.0/(1.0+c);

  return mat3( v.x*v.x*k + c,     v.y*v.x*k - v.z,    v.z*v.x*k + v.y,
               v.x*v.y*k + v.z,   v.y*v.y*k + c,      v.z*v.y*k - v.x,
               v.x*v.z*k - v.y,   v.y*v.z*k + v.x,    v.z*v.z*k + c    );
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/intersectors/
vec2 box(vec3 ro, vec3 rd, vec3 boxSize, out vec3 outNormal) {
    vec3 m = 1.0/rd; // can precompute if traversing a set of aligned boxes
    vec3 n = m*ro;   // can precompute if traversing a set of aligned boxes
    vec3 k = abs(m)*boxSize;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    float tN = max( max( t1.x, t1.y ), t1.z );
    float tF = min( min( t2.x, t2.y ), t2.z );
    if( tN>tF || tF<0.0) return vec2(-1.0); // no intersection
    outNormal = (tN>0.0) ? step(vec3(tN),t1) : // ro ouside the box
                           step(t2,vec3(tF)) ;  // ro inside the box
    outNormal *= -sign(rd);
    return vec2( tN, tF );
}

// License: MIT OR CC-BY-NC-4.0, author: mercury, found: https://mercury.sexy/hg_sdf/
vec3 mod3(inout vec3 p, vec3 size) {
  vec3 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}


float steps(float a, float b) {
  float x = a/b;
  float y = floor(x);
  float z = fract(x);
  return (y+z*z)*b;
}

float luma(in vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}


mat2 rotate(float a){
  float s = sin(a);
  float c = cos(a);
  return mat2(c,-s,s,c);
}

float sdRoundBox( vec3 p, vec3 b, float r )
{
  vec3 q = abs(p) - b + r;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

float fbm(vec3 p){
  float amp = 1.;
  float fre = 1.;
  float n = 0.;
  for(float i =0.;i<4.;i++){
    n += abs(dot(cos(p), vec3(.1)));
    amp *= .5;
    fre *= 2.;
  }
  return n;
}

float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

bool everyXseconds(float x) {
    float timeStep = floor(iTime / x);  // 0, 1, 2, 3, 4...
    return mod(timeStep, 2.0) == 0.0;      // true for even, false for odd
}

float hash11(float v){
    return abs(cos(v*2.+sin(v*4.)/4.)/2.);
}

bool random01(float v) {
    return hash11(v) > 0.5 ? true : false;
}

mat3 rotmat(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat3(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c);
}

vec3 hueShift(vec3 col, float shift){
    vec3 m = vec3(cos(shift), -sin(shift) * .57735, 0);
    m = vec3(m.xy, -m.y) + (1. - m.x) * .33333;
    return mat3(m, m.zxy, m.yzx) * col;
}

/**
reflect and union obj:  https://www.shadertoy.com/view/W3cXDl
Separation AA function: https://www.shadertoy.com/view/tcjXDW
3D glow :               https://www.shadertoy.com/view/7stGWj
iq's sdf                https://iquilezles.org/articles/distfunctions/
*/


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //normalized
    vec2 uv = fragCoord/iResolution.xy;

    vec3 col;

    vec2 ligthPos = vec2(0.5);
    //(iMouse.xy == vec2(0.))? vec2(0.5) : iMouse.xy/iResolution.xy;
    vec2 delta = uv - ligthPos;
    delta *= 1.0 /  float(SAMPLES_COUNT) * DENSITY;

    float illuminationDecay = 1.0;

    for(int i = 0; i < SAMPLES_COUNT; i++)
    {
        uv -= delta;
		vec4 samp = texture(LIGHT_SOURCE_TEXTURE , uv)*0.4;
		samp *= illuminationDecay * WEIGHT;
		col += samp.rgb;
		illuminationDecay *= DECAY;
    }

    col *= EXPOSURE;


  vec2 RR = iResolution.xy;
  vec2 uv2 = (fragCoord*2.-RR)/RR.y;
     float bass = .8*texture(iChannel1, vec2(0.1,0.0)).r;
uv *= rotate(iTime*(.25+.5*bass));uv *= (1.-.5*bass);
 // O.rgb *= 0.;




   for (int i=0; i<iStationTitleLen; i++) {
         _iSongTitle[i] = iStationTitle[i];
     }
     // Set the total length (just Dave1 for now)
     _iSongTitleLen = iStationTitleLen+iSongTitleLen;

  for (int i=0; i<iSongTitleLen; i++) {
         _iSongTitle[i+iStationTitleLen] = iSongTitle[i];
  }


  fragColor.rgb = col.rgb; //tanh(col.rgb*(1.-col2.a) + col2.rgb*col2.rgb);
  fragColor.rgb += max(luma(fragColor.rgb) - 1.0, 0.0);

}



void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
