// https://www.shadertoy.com/view/tfjXWK
// Modified by ArthurTent
// Created by Cotterzz
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iTime;
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// Fork of "Glasshawk" by igneus https://www.shadertoy.com/view/3fsXWS
// Fork of "Turbulent Flame" by Xor. https://shadertoy.com/view/wffXDr
// Inspired by "Phoenix Ascending" by igneus https://www.shadertoy.com/view/WclSWl
// 2025-03-19 21:26:09

/*
    "Turbulent Flame" by @XorDev
    
    For my tutorial on Turbulence:
    https://mini.gmshaders.com/p/turbulence
    
    Simulating proper fluid dynamics can be complicated, limited, and requires a multi-pass setup.

    Sometimes you just want some smoke, fire, or fluid, and you don't want to go through all that trouble.

    This method is very simple! Start with pixel coordinates and scale them down as desired,
    then loop through adding waves, rotating the wave direction and increasing the frequency.
    To animate it, you can add a time offset to the sine wave.
    It also helps to shift each iteration with the iterator "i" to break up visible patterns.

    The resulting coordinates will appear turbulent, and you can use these coordinates in a coloring function.
    
    Smooth, continious equations look best!
    
    To complete the flame look, we need to scroll the waves and expand the coordinate space upwards 
*/

//Fire ring radius
#define RADIUS 0.2
//Falloff gradient
#define GRADIENT 0.05
//Scroll speed
#define SCROLL 2.6
//Flicker intensity
#define FLICKER 0.2
//Flicker animation speed
#define FLICKER_SPEED 6.0

//Number of turbulence waves
#define TURB_NUM 10.0
//Turbulence wave amplitude
#define TURB_AMP 0.4
//Turbulence wave speed
#define TURB_SPEED 3.0
//Turbulence frequency (inverse of scale)
#define TURB_FREQ 13.0
//Turbulence frequency multiplier
#define TURB_EXP 1.2

#define f(a) texture(iAudioData, vec2(a, 0)).x
float snd = 0.;
vec3 palette(float t) {
    if(t <1.)t+=1.;
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.);
    vec3 d = vec3(0.563,0.416,0.457 + .2);
    
    return a + b*cos( 6.28 * c * (t+d)); // A + B * cos ( 2pi * (Cx + D) )
}
vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

// Not certain about the origin. Kali?
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

// *******************************************************************************************************
//    Math functions
// *******************************************************************************************************

#define kPi                    3.14159265359
#define kInvPi                 (1.0 / 3.14159265359)
#define kTwoPi                 (2.0 * kPi)
#define kFourPi                (4.0 * kPi)
#define kHalfPi                (0.5 * kPi)
#define kRootPi                1.77245385091
#define kRoot2                 1.41421356237
#define kLog10                 2.30258509299
#define kFltMax                3.402823466e+38
#define kLog2                  0.6931471805
#define kOneThird              (1.0 / 3.0)
#define kIntMax                0x7fffffff
#define kOne                   vec3(1.)
#define kZero                  vec3(0.)
#define kRed                   vec3(1., 0., 0.)
#define kYellow                vec3(1., 1., 0.)
#define kGreen                 vec3(0., 1., 0.)
#define kBlue                  vec3(0., 0., 1.)
#define kPink                  vec3(1., 0., 0.2) 
#define kPackedZero            max(0., iAmplifiedTime - 1e15)
#define Timecode               vec3

float cubrt(float a)           { return sign(a) * pow(abs(a), 1.0 / 3.0); }
float toRad(float deg)         { return kTwoPi * deg / 360.0; }
float toDeg(float rad)         { return 360.0 * rad / kTwoPi; }
float sqr(float a)             { return a * a; }
vec2 sqr(vec2 a)               { return a * a; }
vec3 sqr(vec3 a)               { return a * a; }
vec4 sqr(vec4 a)               { return a * a; }
int sqr(int a)                 { return a * a; }
int cub(int a)                 { return a * a * a; }
float cub(float a)             { return a * a * a; }
float pow4(float a)            { a *= a; return a * a; }
int mod2(int a, int b)         { return ((a % b) + b) % b; }
float mod2(float a, float b)   { return mod(mod(a, b) + b, b); }
vec3 mod2(vec3 a, vec3 b)      { return mod(mod(a, b) + b, b); }
float length2(vec2 v)          { return dot(v, v); }
float length2(vec3 v)          { return dot(v, v); }
int sum(ivec2 a)               { return a.x + a.y; }
float sum(vec2 v)              { return v.x + v.y; }
float sum(vec3 v)              { return v.x + v.y + v.z; }
float sum(vec4 v)              { return v.x + v.y + v.z + v.w; }
float luminance(vec3 v)        { return v.x * 0.17691 + v.y * 0.8124 + v.z * 0.01063; }
float mean(vec3 v)             { return v.x / 3.0 + v.y / 3.0 + v.z / 3.0; }
vec4 mul4(vec3 a, mat4 m)      { return vec4(a, 1.0) * m; }
vec3 mul3(vec3 a, mat4 m)      { return (vec4(a, 1.0) * m).xyz; }
float sin01(float a)           { return 0.5 * sin(a) + 0.5; }
float cos01(float a)           { return 0.5 * cos(a) + 0.5; }
//#define saturate(a)            clamp(a, 0.0, 1.0)
float cwiseMax(vec3 v)         { return (v.x > v.y) ? ((v.x > v.z) ? v.x : v.z) : ((v.y > v.z) ? v.y : v.z); }
float cwiseMax(vec2 v)         { return (v.x > v.y) ? v.x : v.y; }
int cwiseMax(ivec2 v)          { return (v.x > v.y) ? v.x : v.y; }
float cwiseMin(vec3 v)         { return (v.x < v.y) ? ((v.x < v.z) ? v.x : v.z) : ((v.y < v.z) ? v.y : v.z); }
int cwiseMin(ivec3 v)          { return (v.x < v.y) ? ((v.x < v.z) ? v.x : v.z) : ((v.y < v.z) ? v.y : v.z); }
float cwiseMin(vec2 v)         { return (v.x < v.y) ? v.x : v.y; }
float max3(float a, float b, float c) { return (a > b) ? ((a > c) ? a : c) : ((b > c) ? b : c); }
float min3(float a, float b, float c) { return (a < b) ? ((a < c) ? a : c) : ((b < c) ? b : c); }
void sort(inout float a, inout float b) { if(a > b) { float s = a; a = b; b = s; } }
void swap(inout float a, inout float b) { float s = a; a = b; b = s; }
void swap(inout int a, inout int b) { int s = a; a = b; b = s; }

float Smoothstep(float x) { return smoothstep(0., 1., x); }
float Smoothstep(float a, float b, float x) { return mix(a, b, smoothstep(0., 1., x)); }
float Smootherstep(float x) { return x * x * x * (x * (6. * x - 15.) + 10.); }
float Smootherstep(float a, float b, float x) { return mix(0., 1., x * x * x * (x * (6. * x - 15.) + 10.)); }

float atan2(float y, float x)
{
    float phi = atan(y, x);
    return (phi < 0.) ? (kTwoPi + phi) : phi;
}

float saw(float a)             
{ 
    a = mod(a / kPi, 2.);
    return (1. - (2. * abs(fract(a) - 0.5))) * -(floor(a) * 2. - 1.);
}

float cosaw(float a) { return saw(a + kHalfPi); }

float saw01(float a) { return saw(a) * 0.5 + 0.5; }
float cosaw01(float a) { return saw(a + kHalfPi) * 0.5 + 0.5; }

vec3 safeAtan(vec3 a, vec3 b)
{
    vec3 r;
    #define kAtanEpsilon 1e-10
    r.x = (abs(a.x) < kAtanEpsilon && abs(b.x) < kAtanEpsilon) ? 0.0 : atan(a.x, b.x); 
    r.y = (abs(a.y) < kAtanEpsilon && abs(b.y) < kAtanEpsilon) ? 0.0 : atan(a.y, b.y); 
    r.z = (abs(a.z) < kAtanEpsilon && abs(b.z) < kAtanEpsilon) ? 0.0 : atan(a.z, b.z); 
    return r;
}

vec3 SafeNormalize(vec3 v, vec3 n)
{
    float len = length(v);
    return (len > 1e-10) ? (v / len) : n;
}

vec2 SafeNormalize(vec2 v) { return v / (1e-10 + length(v)); }
vec3 SafeNormalize(vec3 v) { return v / (1e-10 + length(v)); }
vec4 SafeNormalize(vec4 v) { return v / (1e-10 + length(v)); }

vec3 SafeNormaliseTexel(vec4 t)
{
    return t.xyz / max(1e-15, t.w);
}

vec4 Sign(vec4 v)
{
    return step(vec4(0.0), v) * 2.0 - 1.0;
}

float Sign(float v)
{
    return step(0.0, v) * 2.0 - 1.0;
}

bool IsNan( float val )
{
    return ( val < 0.0 || 0.0 < val || val == 0.0 ) ? false : true;
}

bvec3 IsNan( vec3 val )
{
    return bvec3( ( val.x < 0.0 || 0.0 < val.x || val.x == 0.0 ) ? false : true, 
                  ( val.y < 0.0 || 0.0 < val.y || val.y == 0.0 ) ? false : true, 
                  ( val.z < 0.0 || 0.0 < val.z || val.z == 0.0 ) ? false : true);
}

bvec4 IsNan( vec4 val )
{
    return bvec4( ( val.x < 0.0 || 0.0 < val.x || val.x == 0.0 ) ? false : true, 
                  ( val.y < 0.0 || 0.0 < val.y || val.y == 0.0 ) ? false : true, 
                  ( val.z < 0.0 || 0.0 < val.z || val.z == 0.0 ) ? false : true,
                  ( val.w < 0.0 || 0.0 < val.w || val.w == 0.0 ) ? false : true);
}


#define SignedGamma(v, gamma) (sign(v) * pow(abs(v), gamma))

bool QuadraticSolve(float a, float b, float c, out float t0, out float t1)
{
    float b2ac4 = b * b - 4.0 * a * c;
    if(b2ac4 < 0.0) { return false; } 

    float sqrtb2ac4 = sqrt(b2ac4);
    t0 = (-b + sqrtb2ac4) / (2.0 * a);
    t1 = (-b - sqrtb2ac4) / (2.0 * a);    
    return true;
}

// Closed-form approxiation of the error function.
// See 'Uniform Approximations for Transcendental Functions', Winitzki 2003, https://doi.org/10.1007/3-540-44839-X_82
float ErfApprox(float x)
{    
     float a = 8.0 * (kPi - 3.0) / (3.0 * kPi * (4.0 - kPi));
     return sign(x) * sqrt(1.0 - exp(-(x * x) * (4.0 / kPi + a * x * x) / (1.0 + a * x * x)));
}

float UintToFloat01(uint i)
{
    return float(i) / float(0xffffffffu);
}

float UintToFloat01(uint i, int  bits)
{
    return float(i & ((1u << bits) - 1u)) / float(((1u << bits) - 1u));
}

float Sigmoid(float x)
{
    return 1. / (1. + exp(-x));
}

vec2 ScreenToNormalisedScreen(vec2 p, vec2 iRes)
{   
    return 2. * (p - vec2(iRes) * 0.5) / float(iRes.y); 
}

#define PackVec2(v) uintBitsToFloat(packHalf2x16(v))
#define PackFloat2(a, b) uintBitsToFloat(packHalf2x16(vec2(a, b)))
#define PackInt2(a, b) uintBitsToFloat((uint(a) & 0xffffu) | (uint(b) << 16))
#define PackIVec2(v) uintBitsToFloat((uint(v.x) & 0xffffu) | (uint(v.y) << 16))
#define UnpackVec2(f) unpackHalf2x16(floatBitsToUint(f))

ivec2 UnpackIVec2(float f)
{
    uint bits = floatBitsToUint(f);
    return ivec2(int(bits & 0xffffu), int(bits >> 16));
}

vec4 EvaluateCatmullRom(vec2 v0, vec2 v1, vec2 v2, vec2 v3, float t)
{
    // Finite-difference derivatives at control points v1 and v2
    vec2 dv1dt = (v2 - v0) * 0.5;
    vec2 dv2dt = (v3 - v1) * 0.5;

    // Evaluate the position on the spline in Hermiteian form and the 1st derivative in standard form
    vec4 p;
    p.xy = v1 * (1. + t * t * (2. * t - 3.)) + dv1dt * (t * (1. + t * (t - 2.))) + v2 * (t * t * (3. - 2. * t)) + dv2dt * (t * t * (t - 1.));
    p.zw = (v1*2. + dv1dt - v2*2. + dv2dt) * t*t*3. + (v2*3. - v1*3. - dv1dt*2. - dv2dt) * t*2.;
    return p;
}

// *******************************************************************************************************
//    Hash functions
// *******************************************************************************************************

// Constants for the Fowler-Noll-Vo hash function
// https://en.wikipedia.org/wiki/Fowler-Noll-Vo_hash_function
#define kFNVPrime              0x01000193u
#define kFNVOffset             0x811c9dc5u
#define kDimsPerBounce         4

// Mix and combine two hashes
uint HashCombine(uint a, uint b)
{
    return (((a << (31u - (b & 31u))) | (a >> (b & 31u)))) ^
            ((b << (a & 31u)) | (b >> (31u - (a & 31u))));
}

// Compute a 32-bit Fowler-Noll-Vo hash for the given input
uint HashOf(uint i)
{
    uint h = (kFNVOffset ^ (i & 0xffu)) * kFNVPrime;
    h = (h ^ ((i >> 8u) & 0xffu)) * kFNVPrime;
    h = (h ^ ((i >> 16u) & 0xffu)) * kFNVPrime;
    h = (h ^ ((i >> 24u) & 0xffu)) * kFNVPrime;
    return h;
}

uint HashOf(int a) { return HashOf(uint(a)); }
uint HashOf(uint a, uint b) { return HashCombine(HashOf(a), HashOf(b)); }
uint HashOf(uint a, uint b, uint c) { return HashCombine(HashCombine(HashOf(a), HashOf(b)), HashOf(c)); }
uint HashOf(uint a, uint b, uint c, uint d) { return HashCombine(HashCombine(HashOf(a), HashOf(b)), HashCombine(HashOf(c), HashOf(d))); }
uint HashOf(vec2 v) { return HashCombine(HashOf(uint(v.x)), HashOf(uint(v.y))); }
uint HashOf(ivec2 v) { return HashCombine(HashOf(uint(v.x)), HashOf(uint(v.y))); }

float HashOfAsFloat(uint i)
{    
    return float(HashOf(i)) / float(0xffffffffu);
}

float HashOfAsFloat(uint i, int bits)
{    
    return float(HashOf(i) & ((1u << bits) - 1u)) / float(((1u << bits) - 1u));
}

uvec2 Uvec2FromFloat(float f)
{
    uint u = floatBitsToUint(f);
    return uvec2(u & 0xffffu, u >> 16);
}

float FloatFromUvec2(uvec2 v)
{
    return uintBitsToFloat((v.x & 0xffffu) | ((v.y & 0xffffu) << 16));
}

#define kUseHalfPrecisionIntrinsics

#ifdef kUseHalfPrecisionIntrinsics

    #define _unpackHalf2x16 unpackHalf2x16
    #define _packHalf2x16 packHalf2x16
    
#else

    uint FloatToHalfBits(float f)
    {
        uint u = floatBitsToUint(f);
        
        // Handle zero as special case
        if(u == 0u) 
        { 
            return 0u; 
        } 
        else
        {
            uint expo = (u >> 23) & 0xffu;
            if(expo < 127u - 15u) { expo = 0u; } // Underflow
            else if(expo > 127u + 16u) { expo = 31u; } // Overflow
            else { expo = ((u >> 23) & 0xffu) + 15u - 127u; } // Biased exponent

            // Composite
            return ((u >> 16) & (1u << 15)) |  // Sign bit
                   ((u & ((1u << 23) - 1u)) >> 13) | // Fraction
                   ((expo & ((1u << 5) - 1u)) << 10); // Exponent
        }
    }

    float HalfBitsToFloat(uint u)
    {
        if(u == 0u) { return 0.; }

        uint v = ((u & (1u << 15)) << 16) | // Sign bit 
                 ((u & ((1u << 10u) - 1u)) << 13) | // Fraction
                 ((((u >> 10) & ((1u << 5) - 1u)) + 127u - 15u) << 23); // Exponent

        return uintBitsToFloat(v);
    }

    vec2 _unpackHalf2x16Impl(uint u)
    {
        return vec2(HalfBitsToFloat(u & 0xffffu), HalfBitsToFloat(u >> 16));
    }

    uint _packHalf2x16Impl(vec2 v)
    {
        return (FloatToHalfBits(v.x) & 0xffffu) | (FloatToHalfBits(v.y) << 16);
    }

    #define _unpackHalf2x16 _unpackHalf2x16Impl
    #define _packHalf2x16 _packHalf2x16Impl

#endif



vec3 BilinearHalf(sampler2D sampler, vec2 uv, int idx)
{
    uv *= vec2(textureSize(sampler, 0));
    
    vec4 t00 = texelFetch(sampler, ivec2(uv), 0);
    vec4 t10 = texelFetch(sampler, ivec2(uv) + ivec2(1, 0), 0);
    vec4 t01 = texelFetch(sampler, ivec2(uv) + ivec2(0, 1), 0);
    vec4 t11 = texelFetch(sampler, ivec2(uv) + ivec2(1, 1), 0);
    
    idx = (idx & 1) << 1;
    return mix(mix(vec3(_unpackHalf2x16(floatBitsToUint(t00[idx])), t00[idx+1]), vec3(_unpackHalf2x16(floatBitsToUint(t10[idx])), t10[idx+1]), fract(uv.x)), 
                mix(vec3(_unpackHalf2x16(floatBitsToUint(t01[idx])), t01[idx+1]), vec3(_unpackHalf2x16(floatBitsToUint(t11[idx])), t11[idx+1]), fract(uv.x)),
                fract(uv.y));
}

float UnpackNormalise(sampler2D sampler, ivec2 xy, int chnl)
{
    vec2 p = _unpackHalf2x16(floatBitsToUint(texelFetch(sampler, ivec2(xy), 0)[chnl]));
    return p.x / max(1., p.y);
}

float BilinearUnpackNormalise(sampler2D sampler, vec2 uv, int chnl)
{
    uv *= vec2(textureSize(sampler, 0));
    
    float t00 = UnpackNormalise(sampler, ivec2(uv), chnl);
    float t10 = UnpackNormalise(sampler, ivec2(uv) + ivec2(1, 0), chnl);
    float t01 = UnpackNormalise(sampler, ivec2(uv) + ivec2(0, 1), chnl);
    float t11 = UnpackNormalise(sampler, ivec2(uv) + ivec2(1, 1), chnl);
    
    return mix(mix(t00, t10, fract(uv.x)), mix(t01, t11, fract(uv.x)), fract(uv.y));
}

///////


// *******************************************************************************************************
//    Random number generation
// *******************************************************************************************************

// Permuted congruential generator from "Hash Functions for GPU Rendering" (Jarzynski and Olano)
// http://jcgt.org/published/0009/03/02/paper.pdf

#define RNGCtx uvec4

uvec4 PCGAdvance(inout RNGCtx rngSeed)
{
    rngSeed = rngSeed * 1664525u + 1013904223u;
    
    rngSeed.x += rngSeed.y*rngSeed.w; 
    rngSeed.y += rngSeed.z*rngSeed.x; 
    rngSeed.z += rngSeed.x*rngSeed.y; 
    rngSeed.w += rngSeed.y*rngSeed.z;
    
    rngSeed ^= rngSeed >> 16u;
    
    rngSeed.x += rngSeed.y*rngSeed.w; 
    rngSeed.y += rngSeed.z*rngSeed.x; 
    rngSeed.z += rngSeed.x*rngSeed.y; 
    rngSeed.w += rngSeed.y*rngSeed.z;
    
    return rngSeed;
}

// Generates a tuple of canonical random number and uses them to sample an input texture
vec4 Rand4(inout RNGCtx ctx, ivec2 xy, sampler2D sampler)
{
    return texelFetch(sampler, (xy + ivec2(PCGAdvance(ctx) >> 16)) % 1024, 0);
}

// Generates a tuple of canonical random numbers in the range [0, 1]
vec4 Rand4(inout RNGCtx ctx)
{
    return vec4(PCGAdvance(ctx)) / float(0xffffffffu);
}

// Generates a tuple of canonical random numbers in the range [0, 1]
float[5] Rand5(inout RNGCtx ctx)
{
    vec4 v1 = vec4(PCGAdvance(ctx)) / float(0xffffffffu);
    vec4 v2 = vec4(PCGAdvance(ctx)) / float(0xffffffffu);
    return float[5](v1.x, v1.y, v1.z, v1.w, v2.x);
}

// Generates a tuple of canonical random numbers
ivec4 IRand4(inout RNGCtx ctx) { return ivec4(PCGAdvance(ctx)); }

// Seed the PCG hash function with the current frame multipled by a prime
RNGCtx PCGInitialise(uint frame)
{    
    return uvec4(20219u, 7243u, 12547u, 28573u) * frame;
}

// Reverse the bits of 32-bit inteter
uint RadicalInverse(uint i)
{
    i = ((i & 0xffffu) << 16u) | (i >> 16u);
    i = ((i & 0x00ff00ffu) << 8u) | ((i & 0xff00ff00u) >> 8u);
    i = ((i & 0x0f0f0f0fu) << 4u) | ((i & 0xf0f0f0f0u) >> 4u);
    i = ((i & 0x33333333u) << 2u) | ((i & 0xccccccccu) >> 2u);    
    i = ((i & 0x55555555u) << 1u) | ((i & 0xaaaaaaaau) >> 1u);        
    return i;
}

// Samples the radix-2 Halton sequence from seed value, i
float HaltonBase2(uint i)
{    
    return float(RadicalInverse(i)) / float(0xffffffffu);
}

const mat4 kOrderedDither = mat4(vec4(0.0, 8.0, 2.0, 10.), vec4(12., 4., 14., 6.), vec4(3., 11., 1., 9.), vec4(15., 7., 13., 5.));
float OrderedDither(ivec2 xyScreen)
{    
    return (kOrderedDither[xyScreen.x & 3][xyScreen.y & 3] + 0.5) / 16.0;
}

float Noise(vec2 xy)
{
    uvec2 ij = uvec2(xy);
    vec2 d = fract(xy);    
    return Smoothstep(Smoothstep(HaltonBase2(HashOf(ij.x, ij.y)), HaltonBase2(HashOf(ij.x + 1u, ij.y)), d.x), 
                      Smoothstep(HaltonBase2(HashOf(ij.x, ij.y + 1u)), HaltonBase2(HashOf(ij.x + 1u, ij.y + 1u)), d.x), d.y);
}

// *******************************************************************************************************
//    Bloom filter
// *******************************************************************************************************

#define kApplyBloom true 
#define kBloomDownsample 6

#define kBloomBurnIn              (2. * vec3(0.22, 0.2, 0.18))
#define kBloomBurnOut             vec3(kFltMax)

void Gaussian(in int k, in int radius, in vec3 rgbK, in vec3 kernelShape, inout vec3 sigmaL, inout vec3 sigmaWeights)
{
    float d = float(abs(k)) / float(radius);
    vec3 weight = pow(max(vec3(0.), (exp(-sqr(vec3(d) * 2.0)) - 0.0183156) / 0.981684), kernelShape);         

    sigmaL += rgbK * weight;
    sigmaWeights += weight;
}

void Epanechnikov(in int k, in int radius, in vec3 rgbK, in vec3 kernelShape, inout vec3 sigmaL, inout vec3 sigmaWeights)
{
    float d = float(abs(k)) / float(radius);
    float weight = 1. - d*d;

    sigmaL += rgbK * weight;
    sigmaWeights += weight;
}

#define BlurKernel Gaussian
//#define BlurKernel Epanechnikov

vec3 SeparableBlurDown(ivec2 xy, ivec2 res, vec2 kernelSize, vec3 kernelShape, sampler2D sampler)
{
    if(xy.y == 0 || xy.x >= res.x / kBloomDownsample || xy.y >= res.y / kBloomDownsample)
    {
        return kZero;
    }
    else
    {
        int radius = int(0.5 + float(res.x)  * kernelSize.x / float(kBloomDownsample));    
        vec3 sigmaL = kZero, sigmaWeights = kZero;
        for(int k = -radius; k <= radius; ++k)
        {
            ivec2 ij = (xy + ivec2(k, 0)) * kBloomDownsample;
            vec4 texel = texture(sampler, vec2(ij) / vec2(res.xy), 0.);
            //texel.xyz /= max(1., texel.w);
            texel.xyz = max(kZero, texel.xyz - kBloomBurnIn);
            BlurKernel(k, radius, texel.xyz, kernelShape, sigmaL, sigmaWeights);
        }

        return sigmaL / max(kOne, sigmaWeights);
    }
}

vec3 SeparableBlurUp(vec2 xy, ivec2 res, vec2 kernelSize, vec3 kernelShape, int layerIdx, sampler2D sampler)
{   
    int radius = int(0.5 + float(res.x) * kernelSize.y / float(kBloomDownsample));    
    vec3 sigmaL = kZero, sigmaWeights = kZero;
    for(int k = -radius; k <= radius; ++k)
    {        
        vec2 uv = (0.5 + xy + vec2(0, k * kBloomDownsample));
        
        //uv.x = clamp(uv.x, 0., float(res.x - kBloomDownsample));
               
        uv /= (vec2(res) * float(kBloomDownsample) + vec2(kBloomDownsample, 0.));
        uv.y = saturate(uv.y);

        vec3 texel = BilinearHalf(sampler, uv, layerIdx);
        
        BlurKernel(k, radius, texel, kernelShape, sigmaL, sigmaWeights);
    }

    return sigmaL / max(kOne, sigmaWeights);
}

mat2 RotMat2(float theta)
{
    float cosTheta = cos(theta), sinTheta = sin(theta);
    return mat2(cosTheta, sinTheta, -sinTheta, cosTheta);
}





vec3 Cartesian2DToBarycentric(vec2 p)
{    
    return vec3(p, 0.0) * mat3(vec3(0.0, 1.0 / 0.8660254037844387, 0.0),
                          vec3(1.0, 0.5773502691896257, 0.0),
                          vec3(-1.0, 0.5773502691896257, 0.0));    
}

vec2 BarycentricToCartesian2D(vec3 b)
{    
    return vec2(b.y * 0.5 - b.z * 0.5, b.x * 0.8660254037844387);    
}

// Maps an input uv position to periodic hexagonal tiling
//     inout vec2 uv: The mapped uv coordinate
//     out vec3 bary: The Barycentric coordinates at the point on the hexagon
//     out ivec2 ij: The coordinate of the tile
vec2 Cartesian2DToHexagonalTiling(in vec2 uv, out vec3 bary, out ivec2 ij)
{    
    #define kHexRatio vec2(1.5, 0.8660254037844387)
    vec2 uvClip = mod(uv + kHexRatio, 2.0 * kHexRatio) - kHexRatio;
    
    ij = ivec2((uv + kHexRatio) / (2.0 * kHexRatio)) * 2;
    if(uv.x + kHexRatio.x <= 0.0) ij.x -= 2;
    if(uv.y + kHexRatio.y <= 0.0) ij.y -= 2;
    
    bary = Cartesian2DToBarycentric(uvClip);
    if(bary.x > 0.0)
    {
        if(bary.z > 1.0) { bary += vec3(-1.0, 1.0, -2.0); ij += ivec2(-1, 1); }
        else if(bary.y > 1.0) { bary += vec3(-1.0, -2.0, 1.0); ij += ivec2(1, 1); }
    }
    else
    {
        if(bary.y < -1.0) { bary += vec3(1.0, 2.0, -1.0); ij += ivec2(-1, -1); }
        else if(bary.z < -1.0) { bary += vec3(1.0, -1.0, 2.0); ij += ivec2(1, -1); }
    }

    return vec2(bary.y * 0.5773502691896257 - bary.z * 0.5773502691896257, bary.x);
}

bool InverseSternograph(inout vec2 uv, float zoom)
{
    float theta = length(uv) * kPi * zoom;
    if(theta >= kPi - 1e-1) { return false; }
    
    float phi = atan(-uv.y, -uv.x) + kPi;
    
    vec3 sph = vec3(cos(phi) * sin(theta), sin(phi) * sin(theta), -cos(theta));
    
    uv = vec2(sph.x / (1.0 - sph.z), sph.y / (1.0 - sph.z));
    return true;
}



// *******************************************************************************************************
//    2D SVG
// *******************************************************************************************************

float SDFLine(vec2 p, vec2 v0, vec2 v1, float thickness, float dPdXY)
{
    v1 -= v0;
    float t = saturate((dot(p, v1) - dot(v0, v1)) / dot(v1, v1));
    vec2 perp = v0 + t * v1;
    return saturate((thickness - length(p - perp)) / dPdXY);
}


float SDFDashedLine(vec2 p, vec2 v0, vec2 v1, float thickness, float hashFreq, float hashDensity, float dPdXY)
{
    v1 -= v0;
    hashFreq *= length(v1) / dPdXY;
    float t = saturate((dot(p, v1) - dot(v0, v1)) / dot(v1, v1)) * hashFreq;
    float f = fract(t);   
    if(f > hashDensity)
    {
        if(f > 1. - ((1. - hashDensity) * 0.5)) t += 1. - f;
        else t -= f - hashDensity;
    }

    vec2 perp = v0 + (t / hashFreq) * v1;
    return saturate((thickness - length(p - perp)) / dPdXY);
}

float SDFQuad(vec2 p, vec2 v[4], float thickness, float dPdXY)
{
    float c = 0.0;
    for(int i = 0; i < 4; i++)
    {
        c = max(c, SDFLine(p, v[i], v[(i+1)%4], thickness, dPdXY)); 
    }
 
    return c;
}

float SDFCircle(vec2 p, vec2 o, float r, float dPdXY)
{
    return saturate((1. - length(p - o) / r) * (r / dPdXY));
}

float SDFTorus(vec2 p, vec2 o, float r1, float r2, float dPdXY)
{
    return saturate((1. - abs((length(p - o) - r1)) / r2) * (r2 / dPdXY));
}

float SDFPolygon(vec2 p, vec2 o, float r1, float r2, float phase, int numFaces, float dPdXY)
{
    p -= o;
    float pTheta = kTwoPi * (0.5 + floor(float(numFaces) * (atan(p.y, p.x) + kPi - phase) / kTwoPi)) / float(numFaces) - kPi + phase;  
    
    vec2 x = vec2(cos(pTheta), sin(pTheta)) * r1;   
    float perp = length(x * (1.  - dot(p, x) / dot(x, x)));    
    return saturate((1. - abs(perp) / r2) * (r2 / (dPdXY)));
}

float SDFKaleidoscope(vec2 p, vec2 o1, vec2 o2, float r1, float r2, float phase, int numFaces, float dPdXY)
{
    p -= o1;
    float phi = atan(o2.y, o2.x);
    float m = length(o2) / r1;
    float pTheta = kTwoPi * (0.5 + floor(float(numFaces) * (atan(p.y, p.x) + kPi - phase) / kTwoPi)) / float(numFaces) - kPi + phase;
    
    vec2 x = vec2(cos(pTheta), sin(pTheta)) * r1;    
    vec2 d = vec2(cos(pTheta + phi), sin(pTheta + phi));
    float tPerp = (dot(d, p) - dot(d, x)) / dot(d, d);
    float dist = length(x + d * tPerp - p);
    return saturate((1. - abs(dist) / r2) * (r2 / dPdXY));
}

float SDFCircleSegment(vec2 p, vec2 o, float r, vec2 range, float thickness, float dXYdP)
{
    p -= o;
    if(length2(p) > sqr(r + thickness)) { return 0.; }  
    
    float phi = atan(p.y, p.x) + kPi;    
    if((range.x < range.y && (phi < range.x || phi > range.y)) || 
       (range.x > range.y && (phi > range.x || phi < range.y)))
    {
        phi = (min(abs(range.x - phi), abs(range.x - kTwoPi * sign(range.x - kPi) - phi)) < 
               min(abs(range.y - phi), abs(range.y - kTwoPi * sign(range.y - kPi) - phi))) ? range.x : range.y;                   
    }
   
    vec2 pPerp = r * vec2(-cos(phi), sin(-phi));     
    return saturate((thickness - length(p - pPerp)) / dXYdP);
}

float SDFEllipse(vec2 p, vec2 o, vec2 scale, float theta, float dPdXY)
{
    p -= o;
    mat2 M = RotMat2(theta);    
    vec2 dx = (M * vec2(dPdXY, 0.)) / scale;
    vec2 dy = (M * vec2(0., dPdXY)) / scale;
    p = (M * p) / scale;

    float len = max(1e-10, length(p));
    return saturate((1. - (len - 1.)) / (2. * max(abs(dot(p, dx)), abs(dot(p, dy))) / len));
}

#define kKernelGamma 1.

bool IsValidPixel(ivec2 p, vec3 iResolution)
{
    return p.x >= 0 && p.x < int(iResolution.x) && p.y >= 0 && p.y < int(iResolution.y);
}

// *******************************************************************************************************
//    Colour functions
// *******************************************************************************************************

vec3 Hue(float phi)
{
    float phiColour = 6.0 * phi;
    int i = int(phiColour);
    vec3 c0 = vec3(((i + 4) / 3) & 1, ((i + 2) / 3) & 1, ((i + 0) / 3) & 1);
    vec3 c1 = vec3(((i + 5) / 3) & 1, ((i + 3) / 3) & 1, ((i + 1) / 3) & 1);             
    return mix(c0, c1, phiColour - float(i));
}

vec3 SignedColourMap(vec3 colourA, vec3 colourB, float f)
{
    return ((f > 0.) ? colourA : colourB) * abs(f);
}

// A Gaussian function that we use to sample the XYZ standard observer 
float CIEXYZGauss(float lambda, float alpha, float mu, float sigma1, float sigma2)
{
   return alpha * exp(sqr(lambda - mu) / (-2.0 * sqr(lambda < mu ? sigma1 : sigma2)));
}

vec3 HSVToRGB(vec3 hsv)
{
    return mix(vec3(0.0), mix(vec3(1.0), Hue(hsv.x), hsv.y), hsv.z);
}

vec3 RGBToHSV( vec3 rgb)
{
    // Value
    vec3 hsv;
    hsv.z = cwiseMax(rgb);

    // Saturation
    float chroma = hsv.z - cwiseMin(rgb);
    hsv.y = (hsv.z < 1e-10) ? 0.0 : (chroma / hsv.z);

    // Hue
    if (chroma < 1e-10)        { hsv.x = 0.0; }
    else if (hsv.z == rgb.x)    { hsv.x = (1.0 / 6.0) * (rgb.y - rgb.z) / chroma; }
    else if (hsv.z == rgb.y)    { hsv.x = (1.0 / 6.0) * (2.0 + (rgb.z - rgb.x) / chroma); }
    else                        { hsv.x = (1.0 / 6.0) * (4.0 + (rgb.x - rgb.y) / chroma); }
    hsv.x = fract(hsv.x + 1.0);

    return hsv;
}

vec3 SampleSpectrum(float lambda)
{
	// Here we use a set of fitted Gaussian curves to approximate the CIE XYZ standard observer.
	// See https://en.wikipedia.org/wiki/CIE_1931_color_space for detals on the formula
	// This allows us to map the sampled wavelength to usable RGB values. This code needs cleaning 
	// up because we do an unnecessary normalisation steps as we map from lambda to XYZ to RGB.

	#define kRNorm (7000.0 - 3800.0) / 1143.07
	#define kGNorm (7000.0 - 3800.0) / 1068.7
	#define kBNorm (7000.0 - 3800.0) / 1068.25

	// Sample the Gaussian approximations
	vec3 xyz;
	xyz.x = (CIEXYZGauss(lambda, 1.056, 5998.0, 379.0, 310.0) +
             CIEXYZGauss(lambda, 0.362, 4420.0, 160.0, 267.0) +
             CIEXYZGauss(lambda, 0.065, 5011.0, 204.0, 262.0)) * kRNorm;
	xyz.y = (CIEXYZGauss(lambda, 0.821, 5688.0, 469.0, 405.0) +
             CIEXYZGauss(lambda, 0.286, 5309.0, 163.0, 311.0)) * kGNorm;
	xyz.z = (CIEXYZGauss(lambda, 1.217, 4370.0, 118.0, 360.0) +
             CIEXYZGauss(lambda, 0.681, 4590.0, 260.0, 138.0)) * kBNorm;

	// XYZ to RGB linear transform
	vec3 rgb;
	rgb.r = (2.04159 * xyz.x - 0.5650 * xyz.y - 0.34473 * xyz.z) / (2.0 * 0.565);
	rgb.g = (-0.96924 * xyz.x + 1.87596 * xyz.y + 0.04155 * xyz.z) / (2.0 * 0.472);
	rgb.b = (0.01344 * xyz.x - 0.11863 * xyz.y + 1.01517 * xyz.z) / (2.0 * 0.452);

	return rgb;
}

vec4 Blend(vec4 rgba1, vec3 rgb2, float w2)
{
    // Assume that RGB values are premultiplied so that when alpha-composited, they don't need to be renormalised
    return vec4(mix(rgba1.xyz * rgba1.w, rgb2, w2) / max(1e-15, rgba1.w + (1. - rgba1.w) * w2),
                    rgba1.w + (1. - rgba1.w) * w2);
}

vec4 Blend(vec4 rgba1, vec4 rgba2)
{               
    // Assume that RGB values are premultiplied so that when alpha-composited, they don't need to be renormalised
    return vec4(mix(rgba1.xyz * rgba1.w, rgba2.xyz, rgba2.w) / max(1e-15, rgba1.w + (1. - rgba1.w) * rgba2.w),
                    rgba1.w + (1. - rgba1.w) * rgba2.w);
}

vec3 ApplyRedGrade(vec3 inputColor) 
{
    inputColor = saturate(inputColor.zyx);
 
    // Named constants up front
    const float ZERO  = 0.0;
    const float PAD   = 0.0;  // used for padding only
    const float HALF  = 0.5;
    const float ONE   = 1.0;
    const float TWO   = 2.0;
    const float GELU_C1 = 0.7978845608;
    const float GELU_C2 = 0.044715;

   const mat4 layer0_chunk0_W0 = mat4(0.237038, 0.002839, -0.613395, 0.023955, 2.190638, 0.681709, -2.263870, -0.567830, 0.501725, 1.600221, -0.383257, 0.890942, PAD, PAD, PAD, PAD);
   const vec4 layer0_chunk0_bias = vec4(-0.287044, 0.280783, 0.290978, 0.598706);

   const mat4 layer0_chunk1_W0 = mat4(-0.137439, -0.103585, -0.010283, -1.756933, -0.938134, 1.964871, -0.696499, 1.249109, 1.416610, -0.654387, -0.856150, 1.315522, PAD, PAD, PAD, PAD);
   const vec4 layer0_chunk1_bias = vec4(-0.027628, 0.506725, 0.573981, 0.743510);

   const mat4 layer2_chunk0_W0 = mat4(3.334981, 0.692745, -2.249792, -1.533133, 0.759040, -0.884428, 0.228476, 1.654801, -1.449445, 0.674627, 1.597890, 0.084069, 1.227800, 0.103707, 2.272768, -3.488576);
   const mat4 layer2_chunk0_W1 = mat4(-3.658784, 0.920236, 2.443871, 1.958547, 1.074470, -0.660618, 1.283018, 0.921886, 1.856311, -0.596886, -2.903828, 1.161765, 0.368526, -0.286363, -0.506707, -0.171955);
   const vec4 layer2_chunk0_bias = vec4(1.218964, 0.054669, 0.264244, 0.295188);

   const mat4 layer2_chunk1_W0 = mat4(-0.191983, -0.747375, 0.912338, -1.968686, 0.272265, -0.705990, 0.595160, 1.205564, -0.024412, -0.238474, -0.449195, 0.163486, -1.953892, 1.715119, -0.194429, -2.550383);
   const mat4 layer2_chunk1_W1 = mat4(1.502533, -2.311996, -1.078473, 1.977682, -0.300410, 1.483174, 0.281399, 1.433337, -2.760890, -0.152508, -0.236289, 0.070996, 0.006024, -0.143973, 0.195464, -0.261372);
   const vec4 layer2_chunk1_bias = vec4(1.241102, 0.342907, 0.901451, 0.191256);

   const mat4 layer4_chunk0_W0 = mat4(0.208272, -0.118866, 0.661599, PAD, -1.598513, -2.092330, -0.095411, PAD, 0.630788, -0.224832, 0.052688, PAD, -3.094599, -0.439651, -0.093030, PAD);
   const mat4 layer4_chunk0_W1 = mat4(3.054257, 0.375831, -0.121975, PAD, 0.069616, 0.252565, 0.532385, PAD, -0.114408, 0.896074, -0.793594, PAD, 3.216065, 0.745465, -0.031920, PAD);
   const vec4 layer4_chunk0_bias = vec4(0.230162, -0.046474, -1.497791, PAD);

    // Scale inputColor from [0,1] to [-1,1]
    vec3 scaledColor = inputColor * TWO - ONE;

    vec4 layer0_chunk0_out = layer0_chunk0_W0 * vec4(scaledColor, ZERO) + layer0_chunk0_bias;

    vec4 layer0_chunk1_out = layer0_chunk1_W0 * vec4(scaledColor, ZERO) + layer0_chunk1_bias;

    layer0_chunk0_out = layer0_chunk0_out * (ONE + tanh(GELU_C1 * (layer0_chunk0_out + GELU_C2 * layer0_chunk0_out*layer0_chunk0_out*layer0_chunk0_out))) * HALF;
    layer0_chunk1_out = layer0_chunk1_out * (ONE + tanh(GELU_C1 * (layer0_chunk1_out + GELU_C2 * layer0_chunk1_out*layer0_chunk1_out*layer0_chunk1_out))) * HALF;

    vec4 layer2_chunk0_out = layer2_chunk0_W0 * layer0_chunk0_out + layer2_chunk0_W1 * layer0_chunk1_out + layer2_chunk0_bias;

    vec4 layer2_chunk1_out = layer2_chunk1_W0 * layer0_chunk0_out + layer2_chunk1_W1 * layer0_chunk1_out + layer2_chunk1_bias;

    layer2_chunk0_out = layer2_chunk0_out * (ONE + tanh(GELU_C1 * (layer2_chunk0_out + GELU_C2 * layer2_chunk0_out*layer2_chunk0_out*layer2_chunk0_out))) * HALF;
    layer2_chunk1_out = layer2_chunk1_out * (ONE + tanh(GELU_C1 * (layer2_chunk1_out + GELU_C2 * layer2_chunk1_out*layer2_chunk1_out*layer2_chunk1_out))) * HALF;

    vec4 layer4_chunk0_out = layer4_chunk0_W0 * layer2_chunk0_out + layer4_chunk0_W1 * layer2_chunk1_out + layer4_chunk0_bias;

    layer4_chunk0_out = ONE / (ONE + exp(-layer4_chunk0_out));

    return saturate(layer4_chunk0_out.xyz);
}

// *******************************************************************************************************
//    Solver parameters
// *******************************************************************************************************

// The number of grid cells in the y dimension
#define kLGAGridDensity 300
#define kLGAGridCellSize (1. / float(kLGAGridDensity))
#define kLGAParticleRadiusGain 1.
#define kLGAParticleRadius (kLGAParticleRadiusGain * 0.5 * kRoot2 / float(kLGAGridDensity))
#define kLGAParticleRadiusSqr (kLGAParticleRadius*kLGAParticleRadius)

#define kTimeStep 1.
#define kTime (iAmplifiedTime * kTimeStep)
//#define kTime (iAmplifiedTime * kTimeStep)
//#define kTime (float(iFrame) / 60. * kTimeStep)
//#define kTime (float(iFrame) / 60. * kTimeStep)
            
// Defines a boundary cell
#define kParticleBoundary -1. 
// Defines a dormant cell with no mass inside it
#define kParticleDormant 0.
// Defines a cell whose mass is outside its boundary and needs transferring to an adjacent cell
#define kParticleMigrating 1.
// Defines a cell whose mass resides with its boundary
#define kParticleActive 2.

#define IsBoundary(state) (state.w == kParticleBoundary)
#define IsDormant(state) (state.w == kParticleDormant)
#define IsMigrating(state) (state.w == kParticleMigrating)
#define IsActive(state) (state.w == kParticleActive)

#define MakeBoundary(state) state.w = kParticleBoundary
#define MakeDormant(state) state.w = kParticleDormant
#define MakeMigrating(state) state.w = kParticleMigrating
#define MakeActive(state) state.w = kParticleActive

void PackLGAState(vec2 p, vec2 v, float m, vec2 cellPos, inout vec4 state)
{
    state.x = PackVec2((p - cellPos) / kLGAGridCellSize);
    state.y = PackVec2(v / kLGAGridCellSize);
    state.z = m;
}

void PackNormalisedLGAState(vec2 p, vec2 v, float m, inout vec4 state)
{
    state.x = uintBitsToFloat(packHalf2x16(p));
    state.y = uintBitsToFloat(packHalf2x16(v));
    state.z = m;
}

void UnpackLGAState(in vec4 state, vec2 cellPos, out vec2 p, out vec2 v, out float m)
{
    p = unpackHalf2x16(floatBitsToUint(state.x)) * kLGAGridCellSize + cellPos;
    v = unpackHalf2x16(floatBitsToUint(state.y)) * kLGAGridCellSize;
    m = state.z;
}

ivec2 GetLGAGridDims(vec2 res)
{
    return ivec2(ceil((res.x / res.y) * float(kLGAGridDensity)), kLGAGridDensity);
}

vec2 ViewToLGAGridPos(vec2 xyView, ivec2 dims, vec2 res)
{    
    // Remap to UV coodinates in the range [0, 1]
    xyView = (xyView * vec2(res.y / res.x, 1.)) * 0.5 + 0.5;
    // Map to the position on the grid
    return xyView * vec2(dims);
}

bool IsValidLGAGridIdx(ivec2 ij, ivec2 dims)
{
    return ij.x >= 0 && ij.x < dims.x && ij.y >= 0 && ij.y < dims.y;
}

vec2 LGAGridIdxToView(ivec2 ij, ivec2 dims, vec2 res)
{
    vec2 xyView = vec2(ij) / vec2(dims);
    return (xyView * 2. - 1.) * vec2(res.x / res.y, 1.);
}

bool LGACellContains(in vec2 p, in vec2 cellPos)
{
    return p.x >= cellPos.x && p.x < cellPos.x + kLGAGridCellSize && p.y >= cellPos.y && p.y < cellPos.y + kLGAGridCellSize;
}

// *******************************************************************************************************
//    Hawk parameters
// *******************************************************************************************************

#define kHawkScale 1.
#define kHawkWingSpeed 1.5
#define kHawkAdvection 0.001
#define kHawkViewPos vec2(0.0, 0.5)
#define kHawkGlide false
#define kHawkGlideProbability 0.2

vec2 ViewToHawkUV(vec2 xyView, vec2 res)
{
    return (xyView - kHawkViewPos + vec2(res.x / res.y, 1.) * kHawkScale) * 0.5 * vec2(res.y / res.x, 1.);
}

vec4 SampleHawk(vec2 xyView, vec2 res, sampler2D sampler)
{
    return texture(sampler, ViewToHawkUV(xyView, res), 0.);
}


vec4 SampleHawkUnsharpMask(vec2 xyView, vec2 res, float dFdXY, float magnitude, sampler2D sampler)
{
    vec4 lowPass = vec4(0.);
    float sumW = 0.;
    #define kUnsharpRadius 1
    for(int v = -kUnsharpRadius; v <= kUnsharpRadius; ++v)
    {
        for(int u = -kUnsharpRadius; u <= kUnsharpRadius; ++u)
        {
            float w = 1.0 - max(0., float(u*u + v*v) - 0.5) / float(kUnsharpRadius*kUnsharpRadius);
            if(w > 0.)
            {
                lowPass += w * SampleHawk(xyView + vec2(u, v) * dFdXY, res, sampler); 
                sumW += w;
            }
        }
    }

    vec4 thisPixel = SampleHawk(xyView, res, sampler); 
    vec4 highPass = thisPixel - saturate(lowPass / sumW);
    
    return thisPixel + highPass * magnitude;
}


vec4 GetHawkHoverCtx(float time)
{
    vec4 ctx = vec4(0.);
    
    ctx.x = time * kHawkWingSpeed;
    uint interval = uint(ctx.x);
    ctx.y = float(interval);
    ctx.z = ctx.w = fract(ctx.x);    
    
    if(!kHawkGlide) { return ctx; }
   
    float p0 = HaltonBase2(HashOf(interval - 1u));
    float p1 = HaltonBase2(HashOf(interval));
    float p2 = HaltonBase2(HashOf(interval + 1u));
        
    ctx.z = 0.;
    if(p1 > kHawkGlideProbability)
    {
        float ramp = Smootherstep(ctx.w);
        ctx.z = ctx.w;
        if(p0 < kHawkGlideProbability) { ctx.z = mix(ramp, ctx.z, ctx.w); }
        if(p2 < kHawkGlideProbability) { ctx.z = mix(ctx.z, ramp, ctx.w); }
    } 

    ctx.z += (mix(p1, p2, ctx.w)) * 0.02;
   
        
    return ctx;
}


// *******************************************************************************************************
//   Hovering hawk encoded as MLP
// *******************************************************************************************************
// BEGIN HERE OF BUFFER A
#define z4 vec4(0)
#define m4 mat4
#define v4 vec4
#define kNNInputWidth 12
#define kNNInputBlocks ((kNNInputWidth + 3) / 4)
#define kNNOutputWidth 1
#define kNumHarmonics 2
#define kInputDimensions 3
#define kW (2 * kInputDimensions * kNumHarmonics)

vec4[kNNInputBlocks] FourierEncode(in vec3 p, in vec3 weights)
{
    vec4[kNNInputBlocks] v;
    for (int harmonic = 0; harmonic < kNumHarmonics; ++harmonic)
    {
        for (int d = 0; d < 2 * kInputDimensions; ++d)
        {
            int i = 2 * kInputDimensions * harmonic + d;
            v[i>>2][i&3] = sin( kPi * float(1 + harmonic) * p[d >> 1] + kHalfPi * float(d & 1)) * weights[d >> 1];
        }
    }
    return v;
}  

float Sigmoid(vec4 v)
{
    return dot(vec4(1), 1. / (1. + exp(-(v * 50.))));
}

vec2 EvaluateMLP(vec3 uvt)
{
   uvt.z = mix(-1., 1., uvt.z);
   vec4[3] I = FourierEncode(uvt, vec3(1., 1., 0.5));   
   
   v4[3] A0; v4[3] A1; v4[3] A2; float A3, code = 0.;
   
   A0[0] = m4(0.332,0.179,0.157,-0.519,0.064,-0.557,0.012,-0.304,0.252,0.358,0.302,0.248,0.373,-0.461,0.661,0.027) * I[0] + 
   m4(0.312,0.108,-0.527,0.767,0.243,-0.187,-1.250,-0.514,0.181,-0.336,-0.023,0.332,0.004,0.025,-0.192,0.103) * I[1] + 
   m4(-0.041,0.282,-0.766,-0.095,0.084,-0.109,0.074,-0.109,0.150,-0.250,0.069,-0.168,-0.048,-0.303,0.499,0.039) * I[2] + v4(0.569,-0.328,0.322,0.101);code += Sigmoid( A0[0]);
 A0[0] *= mix(v4(1e-2), v4(1), step(v4(0),  A0[0]));
   A0[1] = m4(-0.244,-0.572,0.317,0.422,0.569,0.175,0.138,0.356,0.752,-0.380,0.695,-0.504,0.188,0.562,-0.297,-0.242) * I[0] + 
   m4(0.638,-0.614,0.097,-0.042,1.271,-0.882,0.946,0.625,0.150,0.161,-0.009,-0.179,-0.382,-0.260,-0.090,-0.001) * I[1] + 
   m4(-0.347,-0.122,0.058,0.118,-0.028,-0.043,0.159,-0.410,0.211,0.026,0.025,-0.209,0.072,-0.341,0.034,0.546) * I[2] + v4(0.012,-0.130,-0.490,0.140);code += Sigmoid( A0[1]);
 A0[1] *= mix(v4(1e-2), v4(1), step(v4(0),  A0[1]));
   A0[2] = m4(-0.763,0.156,0.266,0.812,-0.017,0.165,-0.340,-0.629,-0.371,-0.071,-0.155,-0.687,-0.611,0.360,0.179,0.084) * I[0] + 
   m4(-0.303,0.380,0.287,-0.276,0.189,0.093,-0.212,-0.205,0.182,-0.278,-0.160,0.056,0.141,-0.047,0.609,0.459) * I[1] + 
   m4(0.440,0.246,-0.029,0.285,-0.180,-0.318,0.108,0.028,-0.253,-0.273,-0.112,0.065,0.255,0.245,-0.044,-0.074) * I[2] + v4(0.215,0.612,-0.817,-0.591);code += Sigmoid( A0[2]);
 A0[2] *= mix(v4(1e-2), v4(1), step(v4(0),  A0[2]));
   A1[0] = m4(-0.602,0.111,-0.229,-0.184,-0.077,0.177,-0.389,0.192,-0.380,-0.010,0.058,-0.031,-1.074,0.431,0.339,-0.108) * A0[0] + 
   m4(-0.780,-0.047,-0.223,0.533,-0.128,0.352,0.748,-0.238,-1.078,-0.409,0.426,0.721,-0.055,0.472,0.338,-0.158) * A0[1] + 
   m4(-0.236,0.335,-0.088,-0.243,-0.161,-0.661,-0.356,0.315,0.877,-0.632,-0.408,-0.712,0.374,-0.328,-0.168,-1.506) * A0[2] + v4(0.080,0.493,0.601,-0.400);code += Sigmoid( A1[0]);
 A1[0] *= mix(v4(1e-2), v4(1), step(v4(0),  A1[0]));
   A1[1] = m4(0.165,-0.108,0.423,0.358,-0.177,0.491,0.215,-0.097,0.686,0.671,-0.097,0.158,-0.256,0.235,-0.062,0.152) * A0[0] + 
   m4(-0.565,0.016,0.199,0.785,0.014,-0.649,-0.467,-0.604,0.903,1.419,0.425,-0.995,0.050,0.184,0.475,0.287) * A0[1] + 
   m4(-0.141,0.706,0.431,-0.219,0.260,-0.155,0.146,-0.064,0.626,-0.389,0.399,-0.317,0.361,0.185,-0.628,-0.223) * A0[2] + v4(-0.300,-0.259,-0.017,-0.170);code += Sigmoid( A1[1]);
 A1[1] *= mix(v4(1e-2), v4(1), step(v4(0),  A1[1]));
   A1[2] = m4(-0.917,-0.322,0.473,0.343,0.056,0.087,-0.367,-0.565,-0.396,-0.243,-0.374,0.259,0.642,0.047,-0.144,0.039) * A0[0] + 
   m4(0.166,-0.142,0.286,-0.365,0.187,0.516,0.284,-0.571,-0.287,0.099,-0.985,-0.600,-2.283,0.317,-0.417,-0.094) * A0[1] + 
   m4(-0.089,-0.077,-0.138,-0.739,-0.111,-0.310,0.378,0.091,1.814,-0.207,0.600,0.752,-0.070,0.937,0.073,0.335) * A0[2] + v4(-0.680,0.415,0.336,0.504);code += Sigmoid( A1[2]);
 A1[2] *= mix(v4(1e-2), v4(1), step(v4(0),  A1[2]));
   A2[0] = m4(-0.188,-0.070,0.745,0.810,-0.195,-0.802,0.328,0.080,-0.372,-0.035,0.638,0.110,-0.606,0.269,1.047,0.887) * A1[0] + 
   m4(0.269,0.213,-1.139,-0.505,-0.728,-0.508,0.316,0.428,-0.609,0.512,0.009,0.218,0.582,-0.346,-1.039,-0.728) * A1[1] + 
   m4(0.726,-0.603,-0.777,0.820,-0.450,0.546,-0.746,-0.411,-0.032,-0.245,-0.713,-0.341,-0.250,0.621,0.525,0.181) * A1[2] + v4(0.579,-0.154,0.475,0.530);code += Sigmoid( A2[0]);
 A2[0] *= mix(v4(1e-2), v4(1), step(v4(0),  A2[0]));
   A2[1] = m4(-0.392,0.342,0.009,-0.525,-0.594,-0.885,0.272,-0.480,-0.616,0.014,0.032,-0.075,-0.280,0.287,0.887,-0.135) * A1[0] + 
   m4(0.144,0.480,-0.106,-0.037,-0.294,0.051,0.470,0.571,0.015,-0.062,-0.188,0.391,0.753,-0.308,-0.802,0.609) * A1[1] + 
   m4(1.073,0.212,3.231,-0.080,0.434,-0.521,-0.246,0.289,0.448,-0.102,0.352,-0.088,-0.025,-0.380,0.037,0.062) * A1[2] + v4(-0.169,-0.083,-0.241,0.554);code += Sigmoid( A2[1]);
 A2[1] *= mix(v4(1e-2), v4(1), step(v4(0),  A2[1]));
   A2[2] = m4(-0.483,0.117,0.097,0.205,-0.461,-0.377,0.071,0.091,-0.584,-0.551,-0.509,0.512,-0.909,0.300,0.309,0.610) * A1[0] + 
   m4(0.244,0.261,-0.146,-0.794,0.016,0.207,-0.684,0.449,0.234,-0.090,0.500,0.003,0.399,-0.321,0.327,-0.447) * A1[1] + 
   m4(0.149,-0.362,-0.190,0.316,0.411,0.219,-0.459,-0.340,0.405,0.362,-0.011,-0.376,-0.046,0.335,-0.416,0.441) * A1[2] + v4(0.003,-0.081,-0.560,0.403);code += Sigmoid( A2[2]);
 A2[2] *= mix(v4(1e-2), v4(1), step(v4(0),  A2[2]));
   A3 =dot(v4(-0.756,-0.544,-0.686,0.495), A2[0]) + dot(v4(-0.366,0.757,-0.237,-0.367), A2[1]) + dot(v4(-0.334,-0.315,0.700,0.722), A2[2]) + 0.918;
   
   return vec2(A3, code);
}
#undef z4
#undef m4
#undef v4
#undef kNNInputWidth
#undef kNNOutputWidth

float EvaluateHead(vec2 p, float time)
{
    vec2 v0 = vec2(0., mix(0.075, 0.085, sin01(kTwoPi * time)));
    vec2 v1 = vec2(0., -0.25);    
    v1 -= v0;
    float t = saturate((dot(p, v1) - dot(v0, v1)) / dot(v1, v1));
    vec2 perp = v0 + t * v1;
    return (length(p - perp) - 0.065) / 0.15;
}

vec3 EvaluateBody(vec2 uv, float time)
{
    float head = EvaluateHead(uv, time);
    
    uv.x = mix(-1., 1., 1. - abs(uv.x) - 0.015) * 0.9;
    uv.y *= 2. * 0.9;
    
    //if(cwiseMax(abs(uv)) > 0.9) { return vec3(1); }
    
    #define kDeltaT 1e-3
    vec3 f;
    f.xy = EvaluateMLP(vec3(uv, time));
    f.z = (EvaluateMLP(vec3(uv, time + kDeltaT)).x - f.x) / kDeltaT;
    
    // x: field value, y: accumulated activations, z: temporal differential dF/dt
    return vec3(min(head, f.x), f.yz);
}

vec4 mainImageBufferA( vec2 xyFrag )
{        
    xyFrag /= kHawkScale;
    vec4 rgbaFrag = vec4(0.);
    rgbaFrag *= 0.;
    
    vec2 xyView = ScreenToNormalisedScreen(xyFrag, iResolution.xy);
        
    #define kGlidePose 0.45
    vec4 hawkCtx = GetHawkHoverCtx(kTime);
    vec3 f = EvaluateBody(xyView, fract(hawkCtx.z + kGlidePose));
    
    float outline = saturate(1. - abs(f.x) * 20.);
    float mask = max(outline, 1. - step(0., f.x));
    
    float features = 0.;   
    
    // Eyes
    xyView.x = abs(xyView.x);
    float headBob = 0.01 * sin01(kPi * 0.1 + kTwoPi * hawkCtx.z);
    float blink = saturate(sin01(kTime * 2.) * 50.);
    features = mix(features, 1., SDFEllipse(xyView, vec2(0.032, 0.065 + headBob), vec2(0.6 * blink, 1.) * 0.007, 0.9, 1.5 / iResolution.y));
    
    // Beak
    xyView.y = xyView.y - headBob - 0.017;
    features = mix(features, 0.7, saturate(1. - sqr(xyView.y / 0.015)) * SDFLine(xyView, vec2(0.005, 0.015), vec2(0.0, 0.), 0.003, 1. / iResolution.y));
   
    rgbaFrag.x = sin(2. * f.y) * mask;
    rgbaFrag.y = 0.5 * f.z * mask;
    rgbaFrag.z = features* mask;
    rgbaFrag.w = (f.x+features);
    
    float mx = smoothstep(0.9, 1.0, abs(xyView.x));
    rgbaFrag = mix(rgbaFrag, vec4(0,0,0,1), mx);
    float my = smoothstep(0.5, 0.6, abs(xyView.y));
    rgbaFrag = mix(rgbaFrag, vec4(0,0,0,1), my);

    return rgbaFrag;    
}

// END HERE OF BUFFER A


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=f(i);//*float(i);
    }
    snd /=float(max_freq);
    
    //Screen coordinates, centered and aspect corrected
    vec2 p = (fragCoord.xy*2.0-iResolution.xy) / iResolution.y;
    vec2 uv = p;
    p*=2.3;
    p.y+=0.7;
    if(p.y<0.){p.y*=1.+abs(p.y);}
    vec2 screen = p;
    screen *=0.6;
    screen.x *= 2.2;
    screen.y-=1.;
    //Expand vertically
    float xstretch = 2.0 - 1.5*smoothstep(-2.0,2.0,p.y);
    //Decelerate horizontally
    float ystretch = 1.0 - 0.5 / (1.0+p.x*p.x);
    //Combine
    vec2 stretch = vec2(xstretch, ystretch);
    //Stretch coordinates
    p *= stretch;
    
    //Scroll upward
    float scroll = SCROLL*iAmplifiedTime;
    p.y -= scroll;
    
    //Turbulence starting scale
    float freq = TURB_FREQ;
    
    //Turbulence rotation matrix
    mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
    
    //Loop through turbulence octaves
    for(float i=0.0; i<TURB_NUM; i++)
    {
        //Scroll along the rotated y coordinate
        float phase = freq * (p * rot).y + TURB_SPEED*iAmplifiedTime + i;
        //Add a perpendicular sine wave offset
        p += TURB_AMP * rot[0] * sin(phase) / freq;
        
        //Rotate for the next octave
        rot *= mat2(0.6, -0.8, 0.8, 0.6);
        //Scale down for the next octave
        freq *= TURB_EXP;
    }
    //Reverse the scrolling offset
    p.y += scroll;
   
	//p.y+=.25; 
    p*=1.2; 
	vec2 buv = fragCoord.xy;
	//buv.y+=5.;
    //vec4 bird = mainImageBufferA(fragCoord.xy);//texelFetch(iChannel1, ivec2(fragCoord), 0);
    vec4 bird = mainImageBufferA(buv);//texelFetch(iChannel1, ivec2(fragCoord), 0);
    //vec3 rd = normalize(vec3(uv,-1.5));
    //vec3 bg = stars(rd)*(1.+10.*snd);
    
    //bird +=vec4(bg,1.);
    //Distance to fireball
	p.y+=.25;
    float dist = length(min(p,p/vec2(1,stretch.y))) - bird.a;
	dist-=snd;
    //Attenuate outward and fade vertically
    float light = 0.6/pow(dist*dist+GRADIENT*max(p.y+.5,0.0),2.1);
    //Coordinates relative to the source
    vec2 source = p + 2.0*vec2(0,1) * stretch;//*(1.+snd);
    //RGB falloff gradient
    vec3 grad = 0.1 / (1.0 + 8.0*length(source) / vec3(9, 2, 1));
    //Flicker animation time
    float ft = FLICKER_SPEED * iAmplifiedTime;
    //Flicker brightness
    float flicker = 1.0+FLICKER*cos(ft+sin(ft*1.618-p.y));
    //Ambient lighting
    vec3 amb = 32.0*flicker/(1.0+dot(screen,screen))*grad;
    amb.r*=0.4;
    //Scrolling texture uvs
    //vec2 uv = (p - SCROLL*vec2(0,iAmplifiedTime)) / 1e2 * TURB_FREQ;
    //Sample texture for fire
    vec3 tex = vec3(bird.r/3.+bird.g/2.,bird.r/7.+bird.g/6.,0);
    //Combine ambient light and fire
    vec3 col = max(tex,amb +light*grad);
    //col += bg;
    //Exponential tonemap
    //https://mini.gmshaders.com/p/tonemaps
    //col = 1.0 - exp(-col);
	
   	//col += texture(iChannel0,-1.+2.* (fragCoord.xy/iResolution.xy)).rgb; 
   	//col += texture(iChannel0,-1.+2.* (fragCoord.xy/iResolution.y)).rgb; 
   	//col += texture(iChannel0,-1.+2./ uv).rgb; 
	//vec2 finalP = (fragCoord.xy/iResolution.xy)/0.5;
	vec2 finalP = (fragCoord.xy/iResolution.xy);
	/*
	vec2 tmp = (fragCoord.xy/iResolution.xy);
    vec2 centeredP = tmp * 2.0 - 1.0; 
    float scale = 0.75;
	vec2 scaledP = centeredP / scale;
	vec2 finalP = (scaledP + 1.0) * 0.5;
	finalP.y-=.25;
   	*/
	col *=palette(sin(iAmplifiedTime/2.5)+snd*2.);
	//col += texture(iChannel1,finalP).rgb; 
    fragColor = vec4(col,1);
}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
