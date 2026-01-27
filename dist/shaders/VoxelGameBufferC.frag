precision highp float;
precision highp int;
precision highp sampler2D;

// SHADERAMP / GLSL STANDARD UNIFORMS
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform sampler2D iChannel0; // Buffer A (State)
uniform sampler2D iChannel1; // Buffer B
uniform sampler2D iChannel2; // Buffer C (Previous Frame Cache)
uniform sampler2D iChannel3; // Buffer D
uniform sampler2D iChannelK;
uniform vec3 iChannelResolution[4];
varying vec2 vUv;

/* ----------------------------------------------------------
	CONFIGURABLE SETTINGS
//----------------------------------------------------------*/
//  MAX_PICK_DISTANCE: distance for block selection with mouse (default = 10)
#define MAX_PICK_DISTANCE 10.
//  FAST_NOISE: use cheaper noise function 
#define FAST_NOISE
//	OCCLUSION: enable voxel occlusion
#define OCCLUSION
//  SUBVOXEL: enable shapes actions with keys R,F,G
#define SUBVOXEL
//	SUBTEXTURE: apply texture scaled on subvoxels (more detailed but aliased)
//#define SUBTEXTURE
//	TREE_DETAIL: if enabled, tree blocks are detailed with subvoxels 
#define TREE_DETAIL
//	TREE SIZE: height of the trees 
#define TREE_SIZE 3.
//  GRASS_DETAIL: enable grass
#define GRASS_DETAIL
//  SHADOW 0.=disabled else shadow intensity
#define SHADOW 1.
//  CLOUDS 0.=disabled else cloud density (*)
//#define CLOUDS 1.5
//  FALLING_SAND: sand blocks fall if unstable 
//#define FALLING_SAND
//  MAP: map rendering
#define MAP
//	HIGHLIGHT 0.=disabled else higlight of  unconnected blocks, sand with 4+ horizontal steps, cascading diamonds connected to gold
#define HIGHLIGHT 0.
//	SURFACE_CACHE:  secondary cache mode with buffer C (1=surface blocks,2=heightmap,0=disabled)
#define SURFACE_CACHE 2
//	STRUCTURES: build pyramids & towers; values 0=none, 1=basic, 2=detailed
#define STRUCTURES 2 
//  STATS: display debug info if F3,F4,F5 keys pressed 
//#define STATS
//	FLAT: flat world
//#define FLAT
//  XRAY_MODE: fly mode, with no collisions and transparent blocks (*)
//#define XRAY_MODE
// 	EXCLUDE_CACHE:view only mode, with disabled buffer B 
//#define EXCLUDE_CACHE
//	WATER_LEVEL: level of water (10.=caves, 55.= islands); 50% of the areas use WATER_LEVEL2
#define WATER_LEVEL 12.
#define WATER_LEVEL2 45.
//	WATER_FLOW: enable water flow (value= levelling distance)
#define WATER_FLOW 250.
//  BUILD_DISTANCE average distance between costructions
#define BUILD_DISTANCE 160.

//use 124 bits per texel (it's warking but not necessary yet)
//#define ENCODE124
// flickering light from fireflies at night
#define FIREFLIES

//WIP MARCHING CUBES
//#define MC
//------------------------------------------------------

//SHARED VARIABLES
#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
#define load( coord)  texture(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[0].xy)) 
#define getTexture( id,  c) texture(iChannel0, 16. * (clamp(c,0.001,.999) + vec2(mod(id, 8.), floor(id / 8.)+2.)) / iChannelResolution[0].xy, 0.0)

//shared variables are stored in buffer A where  y=0
var(_pos, 0, varRow);//_old _pos
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange_B, 4, varRow);
var(_loadRange_C, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);//_old _pick
var(_pickTimer, 8, varRow);  //_old _pickTimer
var(_renderScale, 9, varRow);
var(_selectedInventory, 10, varRow);
var(_flightMode, 11, varRow);
var(_sprintMode, 12, varRow);
var(_time, 13, varRow);
var(_stats, 14, varRow);
var(_rayDistMax,15,varRow);
var(_loadDistLimit,16,varRow);
var(_rayLimit,17,varRow);
var(_map,18,varRow);
var(_pixelSize,19,varRow);
var(_inventory,20,varRow);
var(_demo,21,varRow);
var(_mouseBusy,22,varRow);
var(_torch,23,varRow);
var(_flow,24,varRow);
//old value are stored in rows with y=n where n is the iFrame difference
var(_old, 0, 1); 

//BUFFER B
const int  BUFFER_B = 1;
const vec2 packedChunkSize_B = vec2(13,7);
const float heightLimit_B = packedChunkSize_B.x * packedChunkSize_B.y;

//BUFFER C
#if SURFACE_CACHE==1
const int  BUFFER_C = 2;
const float SURFACE_C=45.;
const vec2 packedChunkSize_C = vec2(7,4);
const float heightLimit_C = packedChunkSize_C.x * packedChunkSize_C.y ;
#elif SURFACE_CACHE==2
const int  BUFFER_C = 2;
const vec2 packedChunkSize_C = vec2(1,1);
const float heightLimit_C = packedChunkSize_C.x * packedChunkSize_C.y ;
#endif


//INVENTORY ITEMS FOR EACH ROW
const float NUM_ITEMS=8.;
//INVENTORY ROWS
const float NUM_ITEM_ROWS=2.;
//
const float N_SUBVOXEL=5.;
// USED BY FALLING SANDS
const float MAX_GROUND=45.;

   
// VOXEL CACHE FUNCTION
vec2 unswizzleChunkCoord(vec2 storageCoord) {
 	vec2 s = floor(storageCoord);
    float dist = max(s.x, s.y);
    float offset = floor(dist / 2.);
    float neg = step(0.5, mod(dist, 2.)) * 2. - 1.;
    return neg * (s - offset);
}

vec2 swizzleChunkCoord(vec2 chunkCoord) {
    vec2 c = chunkCoord;
    float dist = max(abs(c.x), abs(c.y));
    vec2 c2 = floor(abs(c - 0.5));
    float offset = max(c2.x, c2.y);
    float neg = step(c.x + c.y, 0.) * -2. + 1.;
    return (neg * c) + offset;
}


float calcLoadDist_B(vec2 iResolutionxy) {
    vec2  chunks = floor(iResolutionxy / packedChunkSize_B); 
    float gridSize = min(chunks.x, chunks.y);    
    return floor((gridSize - 1.) / 2.);
}

vec4 calcLoadRange_B(vec2 pos,vec2 iResolutionxy, float border) {
	vec2 d = (calcLoadDist_B(iResolutionxy) - border)* vec2(-1,1);
    return floor(pos).xxyy + d.xyxy;
}

#if SURFACE_CACHE>0
float calcLoadDist_C(vec2 iResolutionxy) {
    vec2  chunks = floor(iResolutionxy / packedChunkSize_C); 
    float gridSize = min(chunks.x, chunks.y);    
    return floor((gridSize - 1.) / 2.);
}

vec4 calcLoadRange_C(vec2 pos,vec2 iResolutionxy, float border) {
	vec2 d = (calcLoadDist_C(iResolutionxy) - border)* vec2(-1,1);
    return floor(pos).xxyy + d.xyxy;
}
#endif 

vec3 texToVoxCoord(vec2 textelCoord, vec3 offset,int bufferId) {
#if SURFACE_CACHE>0
    vec2 packedChunkSize= bufferId==1?packedChunkSize_B:packedChunkSize_C;
#else
    vec2 packedChunkSize= packedChunkSize_B;
#endif
	vec3 voxelCoord = offset;
    voxelCoord.xy += unswizzleChunkCoord(textelCoord / packedChunkSize);
    voxelCoord.z += mod(textelCoord.x, packedChunkSize.x) + packedChunkSize.x * mod(textelCoord.y, packedChunkSize.y);
    return voxelCoord;
}

vec2 voxToTexCoord(vec3 voxCoord,int bufferId) {
#if SURFACE_CACHE>0
    vec2 packedChunkSize= bufferId==1?packedChunkSize_B:packedChunkSize_C;
#else
    vec2 packedChunkSize= packedChunkSize_B;
#endif
    vec3 p = floor(voxCoord);
    return swizzleChunkCoord(p.xy) * packedChunkSize + vec2(mod(p.z, packedChunkSize.x), floor(p.z / packedChunkSize.x));
}


struct voxel {
	float id;
    int value; //1=modified,2=selected,3=falling
    vec2 light;
    float life;
    int shape;
    float rotation;
    float ground;
    float surface;
    int buffer;
   
     
};
#ifndef ENCODE124
//from https://www.shadertoy.com/view/wsBfzW
float gb(float c, float start, float bits){return mod(floor(c/pow(2.,start)),pow(2.,bits));}//get bits

//lazy version:
//#define sb(f,s,b,v) f+=(v-gb(f,s,b))*pow(2.,s)
//strict version (use in case of strange behaviours):
#define sb(f,s,b,v) f+=(clamp(floor(v+.5),0.,pow(2.,b)-1.)-gb(f,s,b))*pow(2.,s)
//experimenting  124bit encode/decode functions from https://www.shadertoy.com/view/tsGBWy

voxel decodeVoxel(vec4 t) {
	voxel o;
    o.id        = gb(t.r,0., 6.);
    o.value     = int(gb(t.r,6., 2.));
    
    o.light.s   = gb(t.g,0., 4.) ;
    o.light.t   = gb(t.g,4., 4.);
    o.life      = gb(t.g,8., 8.);
    
    o.shape     = int(gb(t.b,0., 4.));
    o.rotation  = gb(t.b,4., 4.);
    
    o.ground    = gb(t.a,0., 8.);
    o.surface   = gb(t.a,8., 8.);
    return o;
}

vec4 encodeVoxel(voxel v) {
	vec4 t=vec4(0.);
    sb(t.r,0.,6.,v.id);
    sb(t.r,6.,2.,float(v.value));
    
    sb(t.g,0.,4.,v.light.s);
    sb(t.g,4.,4.,v.light.t);
    sb(t.g,8.,8.,v.life); 
    
    sb(t.b,0.,4.,float(v.shape));
    sb(t.b,4.,4.,v.rotation);
    
    sb(t.a,0.,8.,v.ground);
    sb(t.a,8.,8.,v.surface);
    return t;
}
#else
#define BITS 32.
#define MAXUINT  0xFFFFFFFFu 


// pixel is a 128 bit mask (0-31 -> x, 32-63 -> y, 64-95 -> z, 96-127 -> w)
uint getBit(inout uvec4 bm, uint i)
{
    uint bv = i/uint(BITS),  bi= i%uint(BITS);
       
    return  (bm[bv]  &  (1u<<bi) )>0u?1u:0u;
}

//works only if n<=32u 
uint getBits(inout uvec4 bm, uint k, uint n){
   
    
    uint bv = k/uint(BITS),  bi= k%uint(BITS);
    if(n+bi<=32u){
        //inside vec4 dimension
        uint m = (1u<<n)-1u; 
        return (bm[bv] & (m<<bi) )>>bi;
    }
    else
    {
        //cross dimension
        uint n1= 32u-bi, n2 = bi+n-32u;
        uint m1 =(1u<<n1)-1u, m2= (1u<<n2)-1u;
        return ((bm[bv] & (m1<<bi) )>>bi) 
             + ((bm[bv+1u] & m2 )<<n1);
    }
}

// set bit value in a 128 bit mask 
void setBit(inout uvec4 bm, uint i, uint val){
    uint bv = i/uint(BITS),  bi= i%uint(BITS);
    bm[bv]  &= ( MAXUINT - (1u<<bi) );
    if(val>0u)  bm[bv]  +=(1u<<bi);
}

void setBits(inout uvec4 bm, uint i, uint n, uint val){
    val =clamp( val, 0u, (1u<<n)-1u) ;

    //TODO REPLACE WITH A SINGLE EXPRESSION WITHOUT CYCLING
    uint bv = i/uint(BITS),  bi= i%uint(BITS);
    if(n+bi<=32u){
        bm[bv]  &= ( MAXUINT - (((1u<<n)-1u ) <<bi) );
        bm[bv]  +=(val<<bi);
    }
    else
    {
        for(uint j=0u; j<n;j++) 
        {
            uint b = (val  &  (1u<<j) )>0u?1u:0u;
            setBit(bm, i+j, b);
        }
    }
}

voxel decodeVoxel(vec4 t) {
	voxel o;
    uvec4 iv =  floatBitsToUint(t);
    o.id        = float(getBits(iv,0u,6u)); 
    o.value     = int(getBits(iv,6u,2u));   
    o.light.s   = float(getBits(iv,8u, 4u) );
    o.light.t   = float(getBits(iv,12u, 4u));
    o.life      = float(getBits(iv,16u, 9u));
    
    o.shape     = int(getBits(iv,64u, 4u));
    o.rotation  = float(getBits(iv,68u, 4u));
    
    o.ground    = float(getBits(iv,72u, 8u));
    o.surface   = float(getBits(iv,80u, 8u));
    return o;
}

vec4 encodeVoxel(voxel v) {
	uvec4 iv = uvec4(MAXUINT);
    setBits(iv, 0u,6u,uint(v.id));
    setBits(iv, 6u,2u,uint(v.value));    
    setBits(iv,8u,4u,uint(v.light.s));
    setBits(iv,12u,4u,uint(v.light.t));
    setBits(iv,16u,9u,uint(v.life)); 
    iv.y=1u; //unused
    setBits(iv,64u,4u,uint(v.shape));
    setBits(iv,68u,4u,uint(v.rotation));
    setBits(iv,72u,8u,uint(v.ground));
    setBits(iv,80u,8u,uint(v.surface));
    iv.w=1u; //unused
    
    uvec4 c = uvec4( getBits(iv,24u,7u),getBits(iv,56u,7u),getBits(iv,88u,7u),getBits(iv,120u,7u));
    setBit(iv,31u,c.x==0u?1u:0u);setBit(iv,63u,c.y==0u?1u:0u);setBit(iv,95u,c.z==0u?1u:0u);setBit(iv,127u,c.w==0u?1u:0u);
    
    return uintBitsToFloat(iv);
}
#endif

float lightDefault(float z){
	if(z>55.) return 15.;
    else if(z>45.) return 14.; 
    else if(z>35.) return 11.; 
    else if(z>10.) return 8.;
    else return 5.;
}

voxel newVox(float z){
    voxel vox;
    vox.life=0.;
    vox.rotation=0.;
    vox.value=0;
    vox.shape=0;
    vox.ground=200.;
    vox.surface=0.;
	vox.id=0.;
    vox.light.t = z>10.? 0.:12.;
    vox.light.s = lightDefault(z);
 	vox.id=0.;
    vox.buffer=0;
    return vox;
}

vec4 readMapTex(vec2 pos, sampler2D iChannel,vec3 resolution) {
    return texture(iChannel, (floor(pos) + 0.5) /  (floor (resolution.xy)), 0.0);   
 
}


voxel getCachedVoxel(vec3 p,sampler2D iChannel,vec3 resolution,int bufferId) {
    if(p.z>heightLimit_B || p.z<0.){voxel vox; vox.id=0.; return vox;}
    voxel vox= decodeVoxel(readMapTex(voxToTexCoord(p, bufferId),iChannel,resolution));
    vox.buffer=bufferId;
    return vox;
}


float isSolidVoxel(voxel vox) {
    
    return (vox.id==0. || vox.id==12. ||vox.id==26.)?0.:1.;
}

float getInventory(float slot) {
	return slot + 1. + step(2.5, slot);  
}



// WORLD GENERATION 
#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)
#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)

const float PI = 3.14159265359;


float hash( float n ) {
    return fract(sin(n)*43758.5453);
}


float hash13(vec3 p3)
{
	p3  = fract(p3 * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

    
float hash2(in vec2 p) { return hash(dot(p, vec2(87.1, 313.7))); }

vec2 hash22(in float p) {
	float x = hash(p);
	return vec2(x, hash(p+x));
}
//vec2 hash22(in vec2 p) { return hash2(dot(p, vec2(87.1, 313.7))); }


vec2 hash22( vec2 p ) 
{
	p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

vec4 hash44(vec4 p4)
{
	p4 = fract(p4  * HASHSCALE4);
    p4 += dot(p4, p4.wzxy+19.19);
    return fract(vec4((p4.x + p4.y)*p4.z, (p4.x + p4.z)*p4.y, (p4.y + p4.z)*p4.w, (p4.z + p4.w)*p4.x));
}


// Fork of "Optimized Ashima SimplexNoise3D" by Makio64. https://shadertoy.com/view/Xd3GRf
// 2020-04-23 14:52:01

// Optimized AshimaSimplexNoise by @makio64 https://www.shadertoy.com/view/Xd3GRf
// Original : https://github.com/ashima/webgl-noise/blob/master/src/noise3D.glsl

#ifndef FAST_NOISE
lowp vec4 permute(in lowp vec4 x){return mod(x*x*34.+x,289.);}
lowp float snoise(in mediump vec3 v){
  const lowp vec2 C = vec2(0.16666666666,0.33333333333);
  const lowp vec4 D = vec4(0,.5,1,2);
  lowp vec3 i  = floor(C.y*(v.x+v.y+v.z) + v);
  lowp vec3 x0 = C.x*(i.x+i.y+i.z) + (v - i);
  lowp vec3 g = step(x0.yzx, x0);
  lowp vec3 l = (1. - g).zxy;
  lowp vec3 i1 = min( g, l );
  lowp vec3 i2 = max( g, l );
  lowp vec3 x1 = x0 - i1 + C.x;
  lowp vec3 x2 = x0 - i2 + C.y;
  lowp vec3 x3 = x0 - D.yyy;
  i = mod(i,289.);
  lowp vec4 p = permute( permute( permute(
	  i.z + vec4(0., i1.z, i2.z, 1.))
	+ i.y + vec4(0., i1.y, i2.y, 1.))
	+ i.x + vec4(0., i1.x, i2.x, 1.));
  lowp vec3 ns = .142857142857 * D.wyz - D.xzx;
  lowp vec4 j = -49. * floor(p * ns.z * ns.z) + p;
  lowp vec4 x_ = floor(j * ns.z);
  lowp vec4 x = x_ * ns.x + ns.yyyy;
  lowp vec4 y = floor(j - 7. * x_ ) * ns.x + ns.yyyy;
  lowp vec4 h = 1. - abs(x) - abs(y);
  lowp vec4 b0 = vec4( x.xy, y.xy );
  lowp vec4 b1 = vec4( x.zw, y.zw );
  lowp vec4 sh = -step(h, vec4(0));
  lowp vec4 a0 = b0.xzyw + (floor(b0)*2.+ 1.).xzyw*sh.xxyy;
  lowp vec4 a1 = b1.xzyw + (floor(b1)*2.+ 1.).xzyw*sh.zzww;
  lowp vec3 p0 = vec3(a0.xy,h.x);
  lowp vec3 p1 = vec3(a0.zw,h.y);
  lowp vec3 p2 = vec3(a1.xy,h.z);
  lowp vec3 p3 = vec3(a1.zw,h.w);
  lowp vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  lowp vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  return -0.334 +.5 + 12. * dot( m * m * m, vec4( dot(p0,x0), dot(p1,x1),dot(p2,x2), dot(p3,x3) ) );
}
// Optimized Ashima Simplex noise2D by @makio64 https://www.shadertoy.com/view/4sdGD8
// Original shader : https://github.com/ashima/webgl-noise/blob/master/src/noise2D.glsl
// snoise return a value between 0 & 1

lowp vec3 permute(in lowp vec3 x) { return mod( x*x*34.+x, 289.); }
lowp float snoise(in lowp vec2 v) {
  lowp vec2 i = floor((v.x+v.y)*.36602540378443 + v),
      x0 = (i.x+i.y)*.211324865405187 + v - i;
  lowp float s = step(x0.x,x0.y);
  lowp vec2 j = vec2(1.0-s,s),
      x1 = x0 - j + .211324865405187, 
      x3 = x0 - .577350269189626; 
  i = mod(i,289.);
  lowp vec3 p = permute( permute( i.y + vec3(0, j.y, 1 ))+ i.x + vec3(0, j.x, 1 )   ),
       m = max( .5 - vec3(dot(x0,x0), dot(x1,x1), dot(x3,x3)), 0.),
       x = fract(p * .024390243902439) * 2. - 1.,
       h = abs(x) - .5,
      a0 = x - floor(x + .5);
  return -0.278 + .5 + 65. * dot( pow(m,vec3(4.))*(- 0.85373472095314*( a0*a0 + h*h )+1.79284291400159 ), a0 * vec3(x0.x,x1.x,x3.x) + h * vec3(x0.y,x1.y,x3.y));
}
#endif

#ifdef FAST_NOISE
float snoise( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2  i = floor( p + (p.x+p.y)*K1 );
    vec2  a = p - i + (i.x+i.y)*K2;
    float m = step(a.y,a.x); 
    vec2  o = vec2(m,1.0-m);
    vec2  b = a - o + K2;
	vec2  c = a - 1.0 + 2.0*K2;
    vec3  h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
	vec3  n = h*h*h*h*vec3( dot(a,hash22(i+0.0)), dot(b,hash22(i+o)), dot(c,hash22(i+1.0)));
    
    return dot( n, vec3(70.0) );
}

float noise3D(vec3 p)
{
	return fract(sin(dot(p ,vec3(12.9898,78.233,128.852))) * 43758.5453)*2.0-1.0;
}
float snoise(vec3 p)
{
 	
	float f3 = 1.0/3.0;
	float s = (p.x+p.y+p.z)*f3;
	int i = int(floor(p.x+s));
	int j = int(floor(p.y+s));
	int k = int(floor(p.z+s));
	
	float g3 = 1.0/6.0;
	float t = float((i+j+k))*g3;
	float x0 = float(i)-t;
	float y0 = float(j)-t;
	float z0 = float(k)-t;
	x0 = p.x-x0;
	y0 = p.y-y0;
	z0 = p.z-z0;
	
	int i1,j1,k1;
	int i2,j2,k2;
	
	if(x0>=y0)
	{
		if(y0>=z0){ i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; } // X Y Z order
		else if(x0>=z0){ i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; } // X Z Y order
		else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }  // Z X Z order
	}
	else 
	{ 
		if(y0<z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; } // Z Y X order
		else if(x0<z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; } // Y Z X order
		else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; } // Y X Z order
	}
	
	float x1 = x0 - float(i1) + g3; 
	float y1 = y0 - float(j1) + g3;
	float z1 = z0 - float(k1) + g3;
	float x2 = x0 - float(i2) + 2.0*g3; 
	float y2 = y0 - float(j2) + 2.0*g3;
	float z2 = z0 - float(k2) + 2.0*g3;
	float x3 = x0 - 1.0 + 3.0*g3; 
	float y3 = y0 - 1.0 + 3.0*g3;
	float z3 = z0 - 1.0 + 3.0*g3;	
				 
	vec3 ijk0 = vec3(i,j,k);
	vec3 ijk1 = vec3(i+i1,j+j1,k+k1);	
	vec3 ijk2 = vec3(i+i2,j+j2,k+k2);
	vec3 ijk3 = vec3(i+1,j+1,k+1);	
            
	vec3 gr0 = normalize(vec3(noise3D(ijk0),noise3D(ijk0*2.01),noise3D(ijk0*2.02)));
	vec3 gr1 = normalize(vec3(noise3D(ijk1),noise3D(ijk1*2.01),noise3D(ijk1*2.02)));
	vec3 gr2 = normalize(vec3(noise3D(ijk2),noise3D(ijk2*2.01),noise3D(ijk2*2.02)));
	vec3 gr3 = normalize(vec3(noise3D(ijk3),noise3D(ijk3*2.01),noise3D(ijk3*2.02)));
	
	float n0 = 0.0;
	float n1 = 0.0;
	float n2 = 0.0;
	float n3 = 0.0;

	float t0 = 0.5 - x0*x0 - y0*y0 - z0*z0;
	if(t0>=0.0)
	{
		t0*=t0;
		n0 = t0 * t0 * dot(gr0, vec3(x0, y0, z0));
	}
	float t1 = 0.5 - x1*x1 - y1*y1 - z1*z1;
	if(t1>=0.0)
	{
		t1*=t1;
		n1 = t1 * t1 * dot(gr1, vec3(x1, y1, z1));
	}
	float t2 = 0.5 - x2*x2 - y2*y2 - z2*z2;
	if(t2>=0.0)
	{
		t2 *= t2;
		n2 = t2 * t2 * dot(gr2, vec3(x2, y2, z2));
	}
	float t3 = 0.5 - x3*x3 - y3*y3 - z3*z3;
	if(t3>=0.0)
	{
		t3 *= t3;
		n3 = t3 * t3 * dot(gr3, vec3(x3, y3, z3));
	}
	return 96.0*(n0+n1+n2+n3);
	
}

#endif

bool overworld(vec3 p) {
	float density = 48. - p.z;
    density += mix(0., 40., pow(.5 + .5 * snoise(p.xy /557. + vec2(0.576, .492)), 2.)) * snoise(p / 31.51 + vec3(0.981, .245, .497));

    return density > 0.;
}

//https://iquilezles.org/articles/distfunctions
float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdOctahedron( vec3 p, float s)
{
  p = abs(p);
  return (p.x+p.y+p.z-s)*0.57735027;
}

float sdCross( vec3 p, vec3 b )
{
  float d1 = length(max( abs(p) - b,0.));
  float d2 = length(max( abs(p) - b.zyx,0.));
  float d3 = length(max( abs(p) - b.xzy,0.));
  return min(d1, min(d2,d3));
}


voxel getGeneratedVoxel(vec3 voxelCoord,bool caves,int frame){

    	voxel vox=newVox(voxelCoord.z);
#ifdef FLAT
    	vox.id=(voxelCoord.z>=50.?0.:3.);
#else 
    
    	bool layer[4];
    	for (int i =0; i <=3 ; i++) {
            float h;
            if(i==1) h=1.; 
            else if(i==2) h=3.; 
            else if(i==3)  h=-1.; 
            else h=0.;
            
            layer[i+min(frame,0)]=overworld(voxelCoord+ vec3(0,0,h));
            if(!layer[0]) break;
        }
         
    	bool solid = layer[0];
    
   
        if (solid) {
            //GRASS
            vox.id = 3.;
            
                             
            //DIRT
            if (layer[1]) vox.id = 2.; 
            //ROCK
            if (layer[2]) vox.id = 1.; 
            //TORCH
            if (hash13(voxelCoord) > 0.98 && !layer[3]) {vox.id = 6.;vox.light.t = 15.;}
 
            //TREE BASE
            if (hash13(voxelCoord) > 0.98 && !layer[1]) {vox.id = 10.;vox.life = 2.+ TREE_SIZE; vox.shape=9;}

             // CAVE
            if(caves){
                caves=snoise(voxelCoord / 27.99 + vec3(0.981, .245, .497).yzx * 17.) > 1. - (smoothstep(0., 5., voxelCoord.z) - 0.7 * smoothstep(32., 48., voxelCoord.z));
	        	if (caves) {vox.id = 0.;}
            }
        } 
 	    
    	//WATER
    	if(vox.id == 0. && voxelCoord.z < WATER_LEVEL) {
            vox.id=12.; 
            if(voxelCoord.z > WATER_LEVEL -2.) vox.shape=3;
#ifdef WATER_FLOW
            vox.life=WATER_FLOW;    
#endif                
         }
        //GEMS
        if (hash13(voxelCoord) > 0.995 && voxelCoord.z < 20.  &&  vox.id!=12. && vox.id!=0. ) {if(hash13(voxelCoord +vec3(1.))>.5) vox.id = 6.; else vox.id=8.;}    
        //BEDROCK
        if (voxelCoord.z < 1.) vox.id = 16.; 
    
#if STRUCTURES>0    
    	// STRUCTURES REPEATED EVERY BUILD_DISTANCE SQUARE
    	vec3  buildCoord = vec3(floor((voxelCoord.xy -vec2(3260. -40.,9650. -40.))/BUILD_DISTANCE)*BUILD_DISTANCE,0.)   +vec3(3260.,9650.,50.);
 		//RANDOM POSITION INSIDE THE 80x80 SQUARE	 buildCoord += hash33(buildCoord)
    	if(length(voxelCoord.xy -vec2(3260, 9650.))>50.) buildCoord += floor(hash33(buildCoord) *vec3(50.,50, .10)) -vec3(25.,25, 5.);
   
    	float type =hash13(buildCoord);
    	float type2 =hash13(buildCoord+vec3(1.));
        if(type2>.5 && vox.id == 0. && voxelCoord.z < WATER_LEVEL2) {
            vox.id=12.; 
#ifdef WATER_FLOW
            vox.life=WATER_FLOW;
            
            
            if(voxelCoord.z > WATER_LEVEL2-2.) vox.shape=3; else vox.shape=0;
#endif                
         }
    	if(type<.2) {
            //PYRAMID          
            if(sdOctahedron(voxelCoord -  buildCoord -vec3(-2.,-3.,2.),30.)<=0.) vox.id=13.;

        }
    	else{

            //TOWER
             if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-3.))<2.  && voxelCoord.z <75.)  {vox.id=1.;  vox.light.t=8.;}
            if(length(voxelCoord - buildCoord  - vec3(-2.,-3.,30.))<1.5)  {vox.id=6.;  vox.light.t=15.;}
        }
#endif
    
#endif
        
  	
        return vox;
		
}



// MIX PROCEDURAL AND MEMORY VOXEL
bool inRange(vec2 p, vec4 r) {
	return (p.x > r.x && p.x < r.y && p.y > r.z && p.y < r.w);
}



voxel getVoxelData( vec3 voxelCoord,
                    sampler2D iChannel_B, 
                    sampler2D iChannel_C, 
                    int frame, 
                    vec3 resolution_B, 
                    vec3 resolution_C,
                    vec4 range_B,
                    vec4 range_C,
                    vec3 offset,
                    bool caves,
                    int caller){
  
#ifdef EXCLUDE_CACHE
    return getGeneratedVoxel(voxelCoord,true,frame); 
#else    
    
 
    if (inRange(voxelCoord.xy,range_B) && frame > 0 && voxelCoord.z <heightLimit_B  
        && (caller!=2)  //comment this line to enable persistence between cache (doesn't handle resolution change)
       ) {
        return getCachedVoxel(voxelCoord  - offset,iChannel_B,resolution_B,BUFFER_B); 
        
    }
#if SURFACE_CACHE==1     
     if (inRange(voxelCoord.xy,range_C) && frame > 0  
               &&  voxelCoord.z >= SURFACE_C
         		&& voxelCoord.z <heightLimit_C +SURFACE_C
              //&& (caller!=1) //
              
             ) {
        return getCachedVoxel(voxelCoord - vec3(0.,0.,SURFACE_C) - offset,iChannel_C,resolution_C,BUFFER_C); 
         
    }
#elif SURFACE_CACHE==2
    if (inRange(voxelCoord.xy,range_C) && frame > 0){
         if ( voxelCoord.z >= 0.&& voxelCoord.z <heightLimit_C  && (caller==2) ) {
            // BUFFER C previous frame
        	return getCachedVoxel(voxelCoord - offset,iChannel_C,resolution_C,BUFFER_C); 
         }
        if(caller!=2){
        	voxel vo= getCachedVoxel(vec3(voxelCoord.xy,0.) - offset,iChannel_C,resolution_C,BUFFER_C);
         	if(vo.ground>0. && vo.ground< heightLimit_B  ){
                //Above max height of BUFFER C --> air
                float h=voxelCoord.z-vo.ground;
                if(h==0. ) {  return vo;}
                
                voxel vox=newVox(voxelCoord.z);
             	if(h>0. && caller==3) { 
                   	//GRASS
                    if(h==1. &&vo.id==3.) { vox.life=1.;}
                    
                    //TREE TRUNK
                    if(h<TREE_SIZE+2. && vo.id==10. && vo.ground >= WATER_LEVEL-1.) {vox.id=10.; vox.life=2.+TREE_SIZE-h; ; vox.shape=9;}                   
                    return vox;
                }
             	
                if(h>-3. && h<0. && vo.id==11. && caller==3) {
                    //TREE LEAFS
                    vox.id=11.; 
                    vox.shape=8;
                    vox.life=0.;
                    return vox;
                }
					
         	}
         }
    }    
#endif
  
    return getGeneratedVoxel(voxelCoord,caves,frame);
#endif
}

#define getCVoxel(p,v,id)           \
	{vec2 frame=(id!=3&&id!=0?_old:vec2(0.) );\
    vec4 range_B = load(frame+_loadRange_B);  \
    vec4 range_C = load(frame+_loadRange_C);  \
    vec3 offset =(id==0?vec3(0.): floor(vec3(load(frame+_pos).xy, 0.)));   \
    if(id==2)  v= getCachedVoxel(p-offset,iChannel2,iChannelResolution[2],2); \
    else v= getCachedVoxel(p-offset,iChannel1,iChannelResolution[1],1);}


#define getVoxel(p,v,id)           \
	{vec2 frame=(id!=3&&id!=0?_old:vec2(0.) );\
    vec4 range_B = load(frame+_loadRange_B);  \
    vec4 range_C = load(frame+_loadRange_C);  \
    vec3 offset =(id==0?vec3(0.): floor(vec3(load(frame+_pos).xy, 0.)));   \
    v= getVoxelData(p,iChannel1,iChannel2,iFrame,iChannelResolution[1],iChannelResolution[2],range_B,range_C,offset,true,id);}



void structures(vec3 voxelCoord, inout voxel vox, vec3 oldOffset, int iFrame, float iTime){

    // STRUCTURES REPEATED EVERY 80x80 SQUARE  
    vec3  buildCoord = vec3(floor((oldOffset.xy -vec2(3260. -40.,9650. -40.))/BUILD_DISTANCE)*BUILD_DISTANCE,0.)   +vec3(3260.,9650.,50.);
    //vec3  buildCoord= +vec3(3260.,9650.,50.);


    //RANDOM POSITION INSIDE THE 80x80 SQUARE
    if(length(oldOffset.xy -vec2(3260, 9650.))>50.) buildCoord += floor(hash33(buildCoord) *vec3(50.,50, .10)) -vec3(25.,25, 5.);
    
    //REBUILD EVERY 30 FRAMES

    if(iFrame==0 || (mod(float(iFrame),30.)==0.)  && vox.value<1){

   float type =hash13(buildCoord);
#if STRUCTURES==2
         
    	if(type<.2) {
            //PYRAMID          

            if(abs(sdOctahedron(voxelCoord -  buildCoord -vec3(-2.,-3.,2.),31.))<.5
              && abs(voxelCoord.x-buildCoord.x+2.)<.5 && voxelCoord.y-buildCoord.y>-2.
               && voxelCoord.z>48.
              ) {vox.id=1.; vox.shape=6;}

   		 }
#endif
    
        //TOWER
        if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-3.))<2.  && voxelCoord.z <75.)  {vox.id=1.;vox.shape=0;}
        if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-3.))<1.  && voxelCoord.z <75.)  {vox.id=14.;vox.shape=0;}
        if(WATER_LEVEL<35. ){
            
             //CAVE IF UNDER TERRAIN LEVEL
            if(sdBox(voxelCoord-  buildCoord - vec3(0.,0.,-4.), vec3(10.,9.,4.)) <.5){ vox.id=1.;vox.shape=0;}
       		 if(sdBox(voxelCoord-  buildCoord - vec3(0.,0.,-4.), vec3(8.,7.,2.)) <.5) vox.id=0.;
            //HOUSE
            float house=sdBox(voxelCoord- buildCoord - vec3(-0.5,5.,-4.5), vec3(2.5,3.,2.5));
            if( abs(house) <.5 ) {vox.id=7.;vox.shape=0; }

            if(sdBox(voxelCoord- buildCoord- vec3(.5,1.,-7.), vec3(6.,8.,0.5)) <.5) {vox.id=9.;vox.shape=0;}
            if(sdBox(voxelCoord- buildCoord- vec3(2.,4.,-5.), vec3(.1,.1,1.5)) <.5) vox.id=0.;
            if(sdBox(voxelCoord- buildCoord- vec3(2.,6.,-5.), vec3(.1,.1,1.5)) <.5) {vox.id=14.;vox.shape=0;}

            if(length(voxelCoord - buildCoord - vec3(3.,5.,-2.))<0.5)  {vox.id=6.; vox.shape=0; vox.light.t=15.;}
            if(length(voxelCoord - buildCoord- vec3(3.,3.,-2.))<0.5)  {vox.id=6.; vox.shape=0; vox.light.t=15.;}
            if(length(voxelCoord - buildCoord- vec3(-2.,7.,-4.))<0.5)  {vox.id=6.; vox.shape=0; vox.light.t=15.;}


            //WATER SOURCE
            if(length(voxelCoord - buildCoord- vec3(+22.,4.,-8.))<0.5)  {vox.id=15.; vox.shape=0; }

            //POOL
            //if(sdBox(voxelCoord-  buildCoord - vec3(7.,10.,-9.), vec3(2.,2.,2.)) <.5) vox.id=12.;
            if(sdBox(voxelCoord- buildCoord- vec3(8.,1.,-9.), vec3(3.,3.,1.5)) <.5) {vox.id=9.;vox.shape=0;}
            if(sdBox(voxelCoord- buildCoord- vec3(8.,1.,-8.), vec3(2.,2.,1.5)) <.5) {vox.id=12.; vox.life=255.;vox.value=1;vox.shape=0;}

       
        }
 
        //ELEVATOR PLATFORMS (3 LEVELS)
        if(type>.2){
            if(sdBox(voxelCoord-buildCoord- vec3(-1.5,-3.,23.), vec3(4.,5.,0.5)) <.5) {vox.id=9.;vox.shape=0;}
            if(abs(sdBox(voxelCoord-buildCoord- vec3(-1.5,-3.,24.), vec3(4.,5.,0.5))) <.5) {vox.id=9.; vox.shape=4; vox.rotation=1.;}
            if(abs(sdBox(voxelCoord-buildCoord- vec3(-1.5,-3.5,24.), vec3(3.5,5.,0.5))) <.5) {vox.id=9.; vox.shape=4;}


            if(sdBox(voxelCoord- buildCoord-vec3(-1.5,-3.,-26.), vec3(4.,4.,0.5)) <.5) {vox.id=9.; vox.shape=0;}

            if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-5.))<2. && abs(voxelCoord.z -buildCoord.z -1.)<27. && voxelCoord.z>WATER_LEVEL)  {vox.id=0.;}
            if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-1.))<2. && abs(voxelCoord.z- buildCoord.z -1.)<27. && voxelCoord.z>WATER_LEVEL)  {vox.id=0.;}


            // LIGHTs
            //if(length(voxelCoord - buildCoord  - vec3(-2.,-3.,30.))<2.5)  {vox.id=6.;  vox.light.t=15.;}
            if(length(voxelCoord - buildCoord - vec3(-2.,-3.,-26.))<2.5)  {vox.id=6.;  vox.light.t=15.;vox.shape=0;}
        }
    }


    // ELEVATOR- UP
    if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-5.))<2. && abs(voxelCoord.z -buildCoord.z +26.-abs(mod((iTime-1.),100.)-50.) )<.5 )  {vox.id=0.;}
    if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-5.))<2. && abs(voxelCoord.z -buildCoord.z +26.-abs(mod((iTime),100.)-50.) )<.5 )  {vox.id=9.;vox.shape=0;}


    //ELEVATOR DOWN
    if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-1.))<2. && abs(voxelCoord.z -buildCoord.z -24.+abs(mod((iTime-1.),100.)-50.) )<.5 )  {vox.id=0.;}
    if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-1.))<2. && abs(voxelCoord.z -buildCoord.z -24. +abs(mod((iTime),100.)-50.) )<.5 )  {vox.id=9.;vox.shape=0;}


}



/*
VOXEL MEMORY 2 - SURFACE 
  mode = 1 it's just a copy of buffer B, working in a limited z range
  mode = 2 stores onlythe surface block with the height, for a wider area
*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
#ifdef EXCLUDE_CACHE
    discard;
#endif
    
#ifndef SURFACE_CACHE
    discard;
#elif SURFACE_CACHE==2
    vec2 textelCoord = floor(fragCoord);
    vec3 offset = floor(vec3(load(_pos).xy, 0.));
    vec3 voxelCoord = texToVoxCoord(textelCoord, offset,BUFFER_C); 

    vec4 newRange_C= calcLoadRange_C(offset.xy,iChannelResolution[1].xy,0.);

    if(!inRange(voxelCoord.xy, newRange_C)) {
        discard;
     
    }
    voxel vox;  
    getVoxel( voxelCoord,vox,2);

    if(voxelCoord.z==0. && vox.ground >100.){
    	voxel temp;
        float h= vox.ground-100.;
        getVoxel(vec3(voxelCoord.xy,h),temp,2);
        float id = temp.id;
        if(id !=0.){
            vox=temp;
            vox.ground=h;
        }
        else vox.ground--;           
    } 	
 
    //NEIGHBOURS
    if(voxelCoord.z==0. && vox.ground<100.){
       vec3 s = vec3(1.,0.,0. );
       vec3 t = vec3(0.,1.,0. );    
       voxel v[9];    
       for (int i =-1; i <=1; i++) {
            for (int j =-1; j <=1  ; j++) {
               
                getVoxel(voxelCoord + s* float(i)+t*float(j),v[4+ i+3*j +min(iFrame,0) ] ,2 ); 
                
                voxel temp = v[4+ i+3*j ];
                if(i+3*j !=0 && temp.id==10. && temp.ground <100. && temp.ground> vox.ground -TREE_SIZE -1.) {
                	vox.id=11.; vox.shape=8;vox.ground=temp.ground+TREE_SIZE+2.;vox.life=0.;
                }
            }
        }
    }
    
    fragColor = encodeVoxel(vox);

#elif SURFACE_CACHE==1
    vec2 textelCoord = floor(fragCoord);
    vec3 offset = floor(vec3(load(_pos).xy, 0.));
    vec3 voxelCoord = texToVoxCoord(textelCoord, offset,BUFFER_C); 

    voxelCoord.z+=SURFACE_C;
	//vec4 newrange_B = calcLoadRange_B(offset.xy,iChannelResolution[1].xy,1.);
    vec4 newRange_C= calcLoadRange_C(offset.xy,iChannelResolution[1].xy,0.);
    //if (inRange(voxelCoord.xy,newrange_B)  ||    
    if(!inRange(voxelCoord.xy, newRange_C)) {
        discard;       
    }

    voxel vox;    
    getVoxel( voxelCoord,vox,2);

   	// SUN LIGHT SOURCES  
    if (voxelCoord.z >= heightLimit_C- 2.) {
        vox.light.s = 15.;   
    } else  {
        //vox.light.s=0.; //correct but initial value is better oon surface
        vox.light.s = lightDefault(voxelCoord.z);       
    }
    
    // TORCH LIGHT SOURCES
    if(vox.id==12.) vox.light.t=max(2.,vox.light.t);
    else if(vox.id==6.) vox.light.t=15.;
    if(length( load(_pos).xyz + vec3(0,0,3.)- voxelCoord.xyz) <2.) vox.light.t=max( 12.,vox.light.t);
    
    
        
	//LIGHT DIFFUSE
    voxel temp;
    float air=0.;
    //int border=0;    
    
   
    //NEIGHBOURS 2=ABOVE 5=BELOW, 0-1-3-4= SIDES
    float iE=0.;
       
    float g=MAX_GROUND;
    
    voxel next[6];
    for(int j=0;j<=1;j++){
        for(int i=0;i<3;i++){
            vec3 n= vec3(i==0?1.:0. ,i==1?1.:0.,i==2?1.:0.) * vec3((j==0?1.:-1.));
      
            if(voxelCoord.z >= heightLimit_C +SURFACE_C-1.) break;
            if( voxelCoord.z <SURFACE_C +1.) break;
            voxel temp;
            getVoxel(voxelCoord + n,temp,2);//- vec3(0.,0.,SURFACE_C));
            
    		next[i+3*j]= temp;
            
            if(voxelCoord.z> heightLimit_C +SURFACE_C) vox.light.s=15.;
                else lightDiffusion(vox,temp,n);
            
            //ELECTRICITY DIFFUSION
            if(vox.id==17.){
            	if(temp.id==8.) iE=10.;
                if(temp.id==17. && temp.life>1.) iE=max(iE,temp.life-1.);
            }

            
           if(temp.id==0.) air += pow(2., float(j*3+i));
            
            //LEAFS:
           if(temp.id==11.  && temp.life>0. &&vox.id==0.) {vox.id=11.;  vox.life=temp.life-1.; }
     
        }
    }
    
    
    vec3 pos = load(_pos).xyz;
    
    //ELECTRICITIY
    if(vox.id==17.){
        vox.life=max(iE,vox.life-1.);
        //if(iE>0.) vox.light.t=15.; else vox.light.t=0.;
    }
        
	if(sdBox(pos-voxelCoord -vec3(0.,0.,1.),vec3(.5,.5,.5))<=.01 &&vox.id==3.) vox.id=2.;
    
    
    //ABOVE    
    if(next[2].id==0.  &&  vox.id==2.) {if(hash13(voxelCoord +iTime ) >.95 && hash(iTime)>.99) vox.id=3.;vox.life=0.;}
    if(next[2].id==0.  &&  vox.id==3.) {if(hash13(voxelCoord +iTime+30.) >.95 && hash(iTime +30.)>.99) vox.life=clamp(vox.life+1.,0.,3.);}
    if(next[2].id==3.  &&  vox.id==3.) {vox.id=2.;}
    if(next[2].id==12. && vox.id==0.) {vox.id=12.;}
    if(next[2].value==3 && (vox.id==0.|| vox.id==12.)) {vox.id=next[2].id;} 
    
    //BELOW
    if(next[5].id==10.  && next[5].life>0. && vox.id==0.) {vox.id=10.;  vox.life=next[5].life-1.; vox.ground=0.;}
    if(next[5].id==10.  && next[5].life<1.) {vox.id=11.;  vox.life=TREE_SIZE;}
    if((next[5].id!=3.|| next[5].shape!=0)  &&  vox.id==0.) {vox.life=0.;}
    if((next[5].id!=0.|| next[5].id==12.)  &&  vox.value==3) {vox.id=0.; vox.value=0;vox.life=0.;}
    if(next[5].id==3.  &&  vox.id==0.) {vox.life=1.;}
    
#ifdef TREE_DETAIL	
    if(vox.id==11.) vox.shape=8;
    if(vox.id==10.) {vox.shape=9;};
#endif


    // FIREFLIES 
    //if(vox.id==26.){vox.id=0.;  vox.light.t=15.;}
    if(vox.id==26.){if(vox.light.t>1.) vox.light.t--; else vox.id=0.;vox.light.s=15.; }
    
    if(voxelCoord.z<35. || abs(load(_time).r-750.)<250.)
        if( air>=62. && (voxelCoord.z < heightLimit_C +SURFACE_C - 1.)){
            if(vox.id==0.  && hash13(voxelCoord +vec3(iTime))>0.9999  ) {vox.id=26.;  vox.light.t=15.;}

        } 

#ifdef STRUCTURES
    vec3 oldOffset = floor(vec3(load(_old+_pos).xy, 0.));
	structures( voxelCoord,   vox,  oldOffset,  iFrame,  iTime);
#endif
    
    fragColor = encodeVoxel(vox);
#endif
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
