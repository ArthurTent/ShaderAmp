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
uniform sampler2D iChannel0; // Buffer A (Previous Frame State)
uniform sampler2D iChannel1; // Buffer B
uniform sampler2D iChannel2; // Keyboard Input  
uniform sampler2D iChannel3; // Buffer D (Mouse Ray)
uniform sampler2D iChannelK; // Keyboard (Alias)
uniform vec3 iChannelResolution[4];
varying vec2 vUv;

#define KEY_FORWARDS 87
#define KEY_BACKWARDS 83
#define KEY_LEFT 65
#define KEY_RIGHT 68
#define KEY_JUMP 32
#define KEY_SNEAK 16
#define KEY_PLACE 81
#define KEY_DESTROY 69
#define KEY_SHAPE 82
#define KEY_ROTATE_Z 70
#define KEY_ROTATE_Y 71
#define KEY_MULTISELECT 67
#define KEY_DECREASE_ZOOM 33
#define KEY_INCREASE_ZOOM 34
#define KEY_DECREASE_PIXELSIZE 75
#define KEY_INCREASE_PIXELSIZE 76
#define KEY_INCREASE_TIME_SCALE 80
#define KEY_DECREASE_TIME_SCALE 79
#define KEY_STATS 114
#define KEY_DUMP1 115
#define KEY_DUMP2 116
#define KEY_TORCH 118
#define KEY_FLOW 119
#define KEY_TELEPORT 84
#define KEY_INCREASE_PERFORMANCE 117
#define KEY_WORLD 89
#define KEY_MAP 77
#define KEY_INVENTORY 73

// ==========================================================
// COMMON BLOCK DEFINITIONS
// ==========================================================
#define MAX_PICK_DISTANCE 10.
#define FAST_NOISE
#define OCCLUSION
#define SUBVOXEL
#define TREE_DETAIL
#define TREE_SIZE 3.
#define GRASS_DETAIL
#define SHADOW 1.
#define MAP
#define HIGHLIGHT 0.
#define SURFACE_CACHE 2
#define STRUCTURES 2
#define WATER_LEVEL 12.
#define WATER_LEVEL2 45.
#define WATER_FLOW 250.
#define BUILD_DISTANCE 160.
#define FIREFLIES

//SHARED VARIABLES
#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
#define load( coord)  texture(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[0].xy))
#define getTexture( id,  c) texture(iChannel0, 16. * (clamp(c,0.001,.999) + vec2(mod(id, 8.), floor(id / 8.)+2.)) / iChannelResolution[0].xy, 0.0)

// Row 0 variables (Player State)
var(_pos, 0, varRow);
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange_B, 4, varRow);
var(_loadRange_C, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);
var(_pickTimer, 8, varRow);
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
var(_old, 0, 1);

const int  BUFFER_B = 1;
const vec2 packedChunkSize_B = vec2(13,7);
const float heightLimit_B = packedChunkSize_B.x * packedChunkSize_B.y;

#if SURFACE_CACHE==1
const int  BUFFER_C = 2;
const float SURFACE_C=45.;
const vec2 packedChunkSize_C = vec2(7,4);
const float heightLimit_C = packedChunkSize_C.x * packedChunkSize_C.y ;
#elif SURFACE_CACHE==2
const int  BUFFER_C = 2;
const float SURFACE_C=0.;
const vec2 packedChunkSize_C = vec2(1,1);
const float heightLimit_C = packedChunkSize_C.x * packedChunkSize_C.y ;
#else
const float SURFACE_C = 0.;
#endif

const float NUM_ITEMS=8.;
const float NUM_ITEM_ROWS=2.;
const float N_SUBVOXEL=5.;
const float MAX_GROUND=45.;
const float PI = 3.14159265359;

struct voxel {
	float id; int value; vec2 light; float life; int shape;
    float rotation; float ground; float surface; int buffer;
};

float gb(float c, float start, float bits){return mod(floor(c/pow(2.,start)),pow(2.,bits));}
#define sb(f,s,b,v) f+=(clamp(floor(v+.5),0.,pow(2.,b)-1.)-gb(f,s,b))*pow(2.,s)

voxel decodeVoxel(vec4 t) {
	voxel o;
    o.id        = gb(t.r,0., 6.); o.value     = int(gb(t.r,6., 2.));
    o.light.s   = gb(t.g,0., 4.) ; o.light.t   = gb(t.g,4., 4.);
    o.life      = gb(t.g,8., 8.);
    o.shape     = int(gb(t.b,0., 4.)); o.rotation  = gb(t.b,4., 4.);
    o.ground    = gb(t.a,0., 8.); o.surface   = gb(t.a,8., 8.);
    return o;
}

vec4 encodeVoxel(voxel v) {
	vec4 t=vec4(0.);
    sb(t.r,0.,6.,v.id); sb(t.r,6.,2.,float(v.value));
    sb(t.g,0.,4.,v.light.s); sb(t.g,4.,4.,v.light.t);
    sb(t.g,8.,8.,v.life);
    sb(t.b,0.,4.,float(v.shape)); sb(t.b,4.,4.,v.rotation);
    sb(t.a,0.,8.,v.ground); sb(t.a,8.,8.,v.surface);
    return t;
}

vec2 unswizzleChunkCoord(vec2 storageCoord) {
 	vec2 s = floor(storageCoord); float dist = max(s.x, s.y);
    float offset = floor(dist / 2.); float neg = step(0.5, mod(dist, 2.)) * 2. - 1.;
    return neg * (s - offset);
}

vec2 swizzleChunkCoord(vec2 chunkCoord) {
    vec2 c = chunkCoord; float dist = max(abs(c.x), abs(c.y));
    vec2 c2 = floor(abs(c - 0.5)); float offset = max(c2.x, c2.y);
    float neg = step(c.x + c.y, 0.) * -2. + 1.;
    return (neg * c) + offset;
}

vec3 texToVoxCoord(vec2 textelCoord, vec3 offset,int bufferId) {
    vec2 packedChunkSize = (bufferId==1) ? packedChunkSize_B : packedChunkSize_C;
	vec3 voxelCoord = offset;
    voxelCoord.xy += unswizzleChunkCoord(textelCoord / packedChunkSize);
    voxelCoord.z += mod(textelCoord.x, packedChunkSize.x) + packedChunkSize.x * mod(textelCoord.y, packedChunkSize.y);
    return voxelCoord;
}

vec2 voxToTexCoord(vec3 voxCoord,int bufferId) {
    vec2 packedChunkSize = (bufferId==1) ? packedChunkSize_B : packedChunkSize_C;
    vec3 p = floor(voxCoord);
    return swizzleChunkCoord(p.xy) * packedChunkSize + vec2(mod(p.z, packedChunkSize.x), floor(p.z / packedChunkSize.x));
}

float lightDefault(float z){
	if(z>55.) return 15.; else if(z>45.) return 14.;
    else if(z>35.) return 11.; else if(z>10.) return 8.;
    else return 5.;
}

voxel newVox(float z){
    voxel vox;
    vox.life=0.; vox.rotation=0.; vox.value=0; vox.shape=0;
    vox.ground=200.; vox.surface=0.; vox.id=0.;
    vox.light.t = z>10.? 0.:12.; vox.light.s = lightDefault(z);
 	vox.id=0.; vox.buffer=0;
    return vox;
}

vec4 readMapTex(vec2 pos, sampler2D iChannel, vec3 resolution) {
    return texture(iChannel, (floor(pos) + 0.5) /  (floor (resolution.xy)), 0.0);
}

voxel getCachedVoxel(vec3 p, sampler2D iChannel, vec3 resolution, int bufferId) {
    if(p.z>heightLimit_B || p.z<0.){voxel vox; vox.id=0.; return vox;}
    voxel vox= decodeVoxel(readMapTex(voxToTexCoord(p, bufferId), iChannel, resolution));
    vox.buffer=bufferId;
    return vox;
}

float isSolidVoxel(voxel vox) {
    return (vox.id==0. || vox.id==12. ||vox.id==26.)?0.:1.;
}

// Alias for getCVoxel
#define getCVoxel(p,v,t) getVoxel(p,v,t)

float hash( float n ) { return fract(sin(n)*43758.5453); }
float hash2(in vec2 p) { return hash(dot(p, vec2(8.5135, 4.3853))); }

float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(in float p) {
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);
}

vec2 hash22( vec2 p ) 
{
	p  = fract(p * vec2(.1031, .1030));
    p += dot(p, p.yx+33.33);
    return fract((p.xx+p.yx)*p.xy);
}

vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 3.0);}
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x, 3.0);}

float snoise(vec3 p)
{
    vec3 i = floor(p); vec3 f = fract(p); vec3 g = step(f.yzx, f.xyz);
    vec3 l = 1.0 - g; vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 i3 = floor(p) + i1; vec3 i4 = floor(p) + i2; vec3 i5 = floor(p) + 1.0;
    vec3  p0 = f, p1 = f - i1, p2 = f - i2, p3 = f - 1.0;
    vec4 pi = permute( permute( permute(
                vec4(i.x, i3.x, i4.x, i5.x)) + vec4(i.y, i3.y, i4.y, i5.y)) + vec4(i.z, i3.z, i4.z, i5.z) );
    vec4  z = 2.0*fract(pi/49.0)-1.0;
    vec4 w = sqrt( 1.0-z*z );

    vec3 h_vec3;
    h_vec3.x = max(0.0, 1.0 - dot(p0,p0));
    h_vec3.y = max(0.0, 1.0 - dot(p1,p1));
    h_vec3.z = max(0.0, 1.0 - dot(p2,p2));

    vec4 d = vec4(dot(p0, w.xyz), dot(p1, w.yzw), dot(p2, w.zwx), dot(p3, w.wzx));

    vec4 h_vec4 = vec4(h_vec3, max(0.0, 1.0 - dot(p3,p3)));
    return dot(z*z*z*z*h_vec4, d);
}

float calcLoadDist_B(vec2 iResolutionxy) {
    return sqrt(iResolutionxy.x * iResolutionxy.y / packedChunkSize_B.x / packedChunkSize_B.y / 3.14159);
}

vec4 calcLoadRange_B(vec2 pos,vec2 iResolutionxy, float border) {
    float loadDist = calcLoadDist_B(iResolutionxy);
    return vec4(floor(pos - loadDist - border), ceil(pos + loadDist + border));
}

float calcLoadDist_C(vec2 iResolutionxy) {
    return sqrt(iResolutionxy.x * iResolutionxy.y / packedChunkSize_C.x / packedChunkSize_C.y / 3.14159);
}

vec4 calcLoadRange_C(vec2 pos,vec2 iResolutionxy, float border) {
    float loadDist = calcLoadDist_C(iResolutionxy);
    return vec4(floor(pos - loadDist - border), ceil(pos + loadDist + border));
}

void getVoxel(vec3 p, inout voxel v, int rayType) {
    p = floor(p);
    v = newVox(p.z);

    vec4 rangeB = load(_loadRange_B);
    if ((all(lessThan(p.xy, rangeB.zw)) && all(greaterThanEqual(p.xy, rangeB.xy)))) {
        v = getCachedVoxel(p, iChannel1, iChannelResolution[1], BUFFER_B);
    }

    #if SURFACE_CACHE > 0
    vec4 rangeC = load(_loadRange_C);
    if ((v.id == 0.) && (all(lessThan(p.xy, rangeC.zw)) && all(greaterThanEqual(p.xy, rangeC.xy)))
        && (rayType==1 || rayType==2)
        ) {
        v = getCachedVoxel(p, iChannel1, iChannelResolution[1], BUFFER_C);
    }
    #endif

    if (v.id == 0. && v.value == 0) {
        float h = snoise(vec3(p.xy * 0.005, 0.)) * 20. + 30.;
        if (p.z <= h) v.id = 1.;
    }
}

// ==========================================================
// BUFFER A - STATE STORAGE & INPUT HANDLING
// ==========================================================

//ACTIONS 



bool inBox(vec2 coord, vec4 bounds) {
    return coord.x >= bounds.x && coord.y >= bounds.y && coord.x < (bounds.x + bounds.z) && coord.y < (bounds.y + bounds.w);
}
vec2 currentCoord;
vec4 outValue;
bool store4(vec2 coord, vec4 value) {
    if (inBox(currentCoord, vec4(coord, 1., 1.))) {
        outValue = value;
        return true;
    }
    else return false;
}
bool store3(vec2 coord, vec3 value) { return store4(coord, vec4(value, 1)); }
bool store2(vec2 coord, vec2 value) { return store4(coord, vec4(value, 0, 1)); }
bool store1(vec2 coord, float value) { return store4(coord, vec4(value, 0, 0, 1)); }

float keyDown(int keyCode) {
    return texture(iChannel2, vec2((float(keyCode) + 0.5) / 256., .5/3.), 0.0).r;   
}

float keyPress(int keyCode) {
    return texture(iChannel2, vec2((float(keyCode) + 0.5) / 256., 1.5/3.), 0.0).r;   
}

float keySinglePress(int keycode) {
    bool now = bool(keyDown(keycode));
    bool previous = bool(texture(iChannel0, vec2(256. + float(keycode) + 0.5, 0.5) / iResolution.xy, 0.0).r);
    return float(now && !previous);
}


float keyToggled(int keyCode) {
    return texture(iChannel2, vec2((float(keyCode) + 0.5) / 256., 2.5/3.), 0.0).r;   
}

float rectangleCollide(vec2 p1, vec2 p2, vec2 s) {
    return float(all(lessThan(abs(p1 - p2), s)));   
}

float horizontalPlayerCollide(vec2 p1, vec2 p2, float h) {
    vec2 s = (vec2(1) + vec2(.6, h)) / 2.;
    p2.y += h / 2.;
    return rectangleCollide(p1, p2, s);
}


/*
voxel getCachedVoxel(vec3 p) {
    return getCachedVoxel(p,iChannel1,iChannelResolution[1],BUFFER_B);
}*/

float isSolidVoxel(bool slope,vec3 p) {
    voxel t;
    getCVoxel(p,t,0);
    return isSolidVoxel(t) * (!slope || t.shape!=6?1.:0.);
}

struct rayCastResults {
    bool hit;
    vec3 mapPos;
    vec3 normal;
};

rayCastResults  getMouseRay(){
       
   vec4 mouseRay=  texture(iChannel3, vec2(0.));
   rayCastResults res;
   res.hit = mouseRay.a!=0.;
   res.mapPos = mouseRay.rgb;
    
   float eN = mouseRay.a -1.;
   res.normal=vec3(mod(eN,3.),floor(mod(eN,9.)/3.),floor(eN/9.))- vec3(1.);  
   return res;
}

float mouseSelect(vec2 c,float h) {
	float scale = floor(iResolution.y / 128.);
    c /= scale;
    vec2 r = iResolution.xy / scale;
    float xStart = (r.x - 16. * NUM_ITEMS) / 2.;
    c.x -= xStart;
    if (c.x <NUM_ITEMS * 16. && c.x >= 0. && c.y < 16.*h) {
        float slot = floor(c.x / 16.) + NUM_ITEMS*floor(c.y / 16.);
    	return slot;
    }

    return -1.;
}

bool mouseDoubleClick(){
    
    if(iMouse.z <1. ) {
   
        int changeCount=0;
        for(int i=0;i<20;i++){

            int mouseChange=          
               (load(_old *vec2(i) + _mouse ).z>0.?0:1)
              +(load( _old * vec2(i+1) +_mouse ).z>0.?0:1);


            if(mouseChange==1)changeCount++;
            if(load(_mouseBusy).r>0.) {store1(_mouseBusy,float(1.));return false;}
                               
            if(changeCount>2){
                //if(load(_time).r - load(_old*vec2(i) +_time).r<1.) return false;
                if(length(load(_mouse).xy -load(_old * vec2(i+1) +_mouse).xy)>.05) return false;
                store1(_mouseBusy,float(1.));
                return true;

            }         
        }
    }
    store1(_mouseBusy,float(0.));
    return false; 
}



#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)
#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)


float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}


//From https://www.shadertoy.com/view/4djGRh
float tileableWorley(in vec2 p, in float numCells)
{
	p *= numCells;
	float d = 1.0e10;
	for (int xo = -1; xo <= 1; xo++)
	{
		for (int yo = -1; yo <= 1; yo++)
		{
			vec2 tp = floor(p) + vec2(xo, yo);
			tp = p - tp - hash22(256. * mod(tp, numCells));
			d = min(d, dot(tp, tp));
		}
	}
	return sqrt(d);
	//return 1.0 - d;// ...Bubbles.
}

float crackingAnimation(vec2 p, float t) {
    t = ceil(t * 8.) / 8.;
	float d = 1.0e10;
    //t *= ;
    for (float i = 0.; i < 25.; i++) {
    	vec2 tp = hash22(p )-.5; //texture(iChannel1, vec2(4, i) / 256.).xy - 0.5;
        tp *= max(0., (length(tp) + clamp(t, 0., 1.) - 1.) / length(tp));
        d = min(d, length(tp + 0.5 - p));
    }
    return pow(mix(clamp(1. - d * 3., 0., 1.), 1., smoothstep(t - 0.3, t + 0.3, max(abs(p.x - 0.5), abs(p.y - 0.5)) * 2.)), .6) * 1.8 - 0.8;
}

float brickPattern(vec2 c) {
	float o = 1.;
    if (mod(c.y, 4.) < 1.) o = 0.;
    if (mod(c.x - 4. * step(4., mod(c.y, 8.)), 8.) > 7.) o = 0.;
    return o;
}
float woodPattern(vec2 c) {
	float o = 1.;
    if (mod(c.y, 4.) < 1.) o = 0.;
    if (mod(c.x + 2. - 6. * step(4., mod(c.y, 8.)), 16.) > 15.) o = 0.;
    return o;
}




//textures from https://www.shadertoy.com/view/4ds3WS by Reinder
void setTexture( out vec4 o, in vec2 fragCoord )
{
    
 	if(fragCoord.x>8.*16. || fragCoord.y >10.*16.) discard;
    vec2 gridPos = floor((fragCoord -vec2(0.,32.))/ 16.) ;
    vec2 c = mod(fragCoord, 16.);
    int id = int(gridPos.x + gridPos.y * 8.);
 
   
    vec2 uv = floor( c );	
    float h = hash12(uv +vec2(float(id)));
    float br = 1. - h * (96./255.);		
	float xm1 = mod((uv.x * uv.x * 3. + uv.x * 81.) / 4., 4.);

    if (iFrame > 10 && iChannelResolution[0].x > 0. && id!=32  ) discard;
    o.a = 1.;
    if (id == 0) { //NO TEXTURE
    	o = vec4(1,0,1,1);
    }
    if (id == 1) { //STONE
       
        o.rgb =  vec3( 127./255., 127./255., 127./255.) *br;        
    }
    if (id == 2) { //DIRT
        
        o.rgb =  vec3( 150./255., 108./255.,  74./255.) *br;
    }
    if (id == 3) { //GRASS LATERAL
        
        o.rgb =  vec3( 150./255., 108./255.,  74./255.) *br;
        if (c.y  + hash( c.x*2.) *3.  > 14. ) 
         o.rgb =  vec3( 96./255., 157./255.,  59./255.)*br;
    }
    if (id == 4) { //GRASS UP
   		
        o.rgb = vec3( 96./255., 157./255.,  59./255.)*br;
    }
    if (id == 5) { //ROCK
       
        o.rgb = vec3( 106./255., 170./255.,  64./255.)*br;
        o.rgb = vec3(clamp(pow(1. - tileableWorley(c / 16., 4.), 2.), 0.2, 0.6) + 0.2 * tileableWorley(c / 16., 5.));
 
    }
    if (id == 6 || id == 26) {//LIGHT OR FIREFLY
        float w = 1. - tileableWorley(c / 16., 4.);
        float l = clamp(0.7 * pow(w, 4.) + 0.5 * w, 0., 1.);
        o.rgb = mix(vec3(.3, .1, .05), vec3(1,1,.6), l);
        if (w < 0.2) o.rgb = vec3(0.3, 0.25, 0.05);
    }
    if (id == 7) { //BRICK
        o.rgb = vec3( 181./255.,  58./255.,  21./255.)*br; 
		if ( mod(uv.x + (floor(uv.y / 4.) * 5.), 8.) == 0. || mod( uv.y, 4.) == 0.) {
			o.rgb = vec3( 188./255., 175./255., 165./255.); 
		}
        
    	//o.rgb = -0.1 * hash12(c) + mix(vec3(.6,.3,.2) + 0.1 * (1. - brickPattern(c + vec2(-1,1)) * brickPattern(c)), vec3(0.8), 1. - brickPattern(c));
    }
    if (id == 8) {//GOLD
    	o.rgb = mix(vec3(1,1,.2), vec3(1,.8,.1), sin((c.x - c.y) / 3.) * .5 + .5);
        if (any(greaterThan(abs(c - 8.), vec2(7)))) o.rgb = vec3(1,.8,.1);
    }
    if (id == 9) { //WOOD
        
         o.rgb= vec3(0.5,0.4,0.25)*(0.5 + 0.5 * woodPattern(c))*br;        
    }    
    if (id == 10) {//TREE
		
        if ( h < 0.5 ) {
			br = br * (1.5 - mod(uv.x, 2.));
		}
        o.rgb = vec3( 103./255., 82./255.,  49./255.)*br; 				
	}	
    if (id == 11) {//LEAF
	        o.rgb=  vec3(  40./255., 117./255.,  38./255.)*br;		
	}
    if (id == 12) {//WATER		
        o.rgb=vec3(  64./255.,  64./255., 255./255.)*br;		
	}	
    if (id == 13) {//SAND
		//getMaterialColor(10,c,o.rgb);
		o.rgb= vec3(0.74,0.78,0.65);
	}	
    if (id == 14) {//RED APPLE	- MIRROR	
		o.rgb= vec3(.95,0.,0.05);
       
	}
    if (id == 15) {//PINK MARBLE	
        o.rgb= vec3(.95,0.5,.5)*br;
    	//o.rgb = mix(vec3(.2,1,1), vec3(1,.8,.1), sin((c.x - c.y) / 3.) * .5 + .5);
       // if (any(greaterThan(abs(c - 8.), vec2(7)))) o.rgb = vec3(.1,.8,1);
       
	}
    if (id == 16) { //BEDROcK
        
    
        o.rgb =   .2*vec3( 127./255., 127./255., 127./255.) *br;   
    }
    if (id == 17) {//DIAMOND	
       
    	o.rgb = mix(vec3(.2,1,1), vec3(.1,.8,1), sin((c.x - c.y) / 3.) * .5 + .5);
       if (any(greaterThan(abs(c - 8.), vec2(7)))) o.rgb = vec3(.1,.8,1);
       
	}
 /*   
    
    if (id == 18) {//	
        o.rgb= vec3(0.04, 0.14, 0.42)*br;
       
	}
    if (id == 19) {//	
        o.rgb=  vec3(0.05, 0.50, 0.95)*br;
       
	}
    if (id == 20) {//	
        o.rgb= vec3(0.36, 0.72, 0.68)*br;
       
	}
    if (id == 21) {//	
        o.rgb= vec3(0.48, 0.46, 0.28)*br;
       
	}
    if (id == 22) {//	
        o.rgb= vec3(0.69, 0.58, 0.27)*br;
       
	}
    if (id == 23) {//	
        o.rgb= vec3(0.42, 0.51, 0.20)*br;
       
	}    
    if (id == 24) {//	
        o.rgb= vec3(0.23, 0.53, 0.16)*br;
       
	}
    if (id == 25) {//	
        o.rgb= vec3(0.06, 0.20, 0.07)*br;
       
	}
    if (id == 26) {//	
        o.rgb= vec3(0.32, 0.33, 0.27)*br;
       
	}
    if (id == 27) {//	
        o.rgb= vec3(0.25, 0.37, 0.41)*br;
       
	}
    if (id == 28) {//	
        o.rgb= vec3(0.44, 0.67, 0.74)*br;
       
	}  
    if (id == 29) {//	
        o.rgb= vec3(0.73, 0.86, 0.91)*br;
       
	}  
*/  

    if (id == 32) { //DESTROYING BLOCK ANIMATION
    	o.rgb = vec3(crackingAnimation(c / 16., load(_pickTimer).r));
    }
    if (id == 48) { 
    	o = vec4(vec3(0.2), 0.7);
        vec2 p = c - 8.;
        float d = max(abs(p.x), abs(p.y));
        if (d > 6.) {
            o.rgb = vec3(0.7);
            o.rgb += 0.05 * hash12(c);
            o.a = 1.;
            if ((d < 7. && p.x < 6.)|| (p.x > 7. && abs(p.y) < 7.)) o.rgb -= 0.3;
        }
        o.rgb += 0.05 * hash12(c);
        
    }
    
}

/*--------------------

x=0 && y<256: global variables
x=0 &&  256<=y<512: keyboard state for each ascii code with millisecs since laste change
1<=x<16 y<512: previous values fo variables and keys
x<= 128 && 16<=y< 140 : textures 


*///-------------------
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    currentCoord = fragCoord;
    if(fragCoord.x>512. || fragCoord.y >160.) discard;
    vec2 texCoord = floor(fragCoord);
    if (texCoord.x < 512. && texCoord.y<30.) {
        if (texCoord.y == varRow) {
            if (texCoord.x >= 256.) {
                fragColor.r = texture(iChannel2, (fragCoord - 256.) / vec2(256,3)).r;
                vec4 old = texture(iChannel0, (_old + fragCoord) / iChannelResolution[0].xy);
                if (fragColor.r != old.r) old.a = 0.;
                fragColor.a = old.a + iTimeDelta;
            }
            else {
                vec3 pos = load(_pos).xyz;
                vec3 oldPos = pos;
                vec3 offset = vec3(floor(pos.xy), 0.);
                vec2 angle = load(_angle).xy;
                vec4 oldMouse = load(_mouse);
                vec3 vel = load(_vel).xyz;
                vec4 mouse = iMouse / length(iResolution.xy);
                float renderScale = load(_renderScale).r;
                vec2 time = load(_time).rg;
                vec2 flightMode = load(_flightMode).rg;
                vec2 sprintMode = load(_sprintMode).rg;
                float selected = load(_selectedInventory).r;
                float dt = min(iTimeDelta, .05);
                float rayDistMax = max(load(_rayDistMax).r,50.);
				
                float pixelSize =load(_pixelSize).r;
                float inventory =load(_inventory).r;
                float demo =load(_demo).r;
				float map=load(_map).r;;

                    
                if (iFrame <2  ) {
#ifdef FAST_NOISE  
                    pos = vec3(2952.8,10140.8,89.);
                    offset = vec3(floor(pos.xy), 0.);
                    oldPos = pos;
                    angle = vec2(-0.6,1.8  );                   
#else
                    pos = vec3(3265.5,9654.5,50.);                   
                    angle = vec2(-2.,1.6  );
#endif                    
                    demo=1.;
                    oldMouse = vec4(-1);
                    vel = vec3(0);
                    renderScale = -2.;
                    time = vec2(0.,4);
                    selected = 0.;
                    inventory=0.;
                    rayDistMax=250.;
                    map=1.;
                    pixelSize=2.;
                }
                if(demo>0. && 
                   (keyDown(KEY_JUMP)>.0||keyDown(KEY_FORWARDS)>0. || iMouse.z>0. ))
                {
                    inventory=1.;
                    map=1.;
                    demo=0.;
                }
                
                if ( bool(keyDown(KEY_TELEPORT))) {
					
                    if(hash(iTime) <.5) pos=vec3(3221.5,10159.5,70.);
                    else pos =vec3(hash33(pos).xy *10000.,72.); 
                       
                    offset = vec3(floor(pos.xy), 0.);
                    oldPos = pos;
                    time.r=hash13(pos)*1200.;
                    oldMouse = vec4(-1);
                    vel = vec3(0);
                    renderScale = -2.;                  
                    selected = 0.;
                    rayDistMax=250.;
                }
                if (oldMouse.z > 0. && iMouse.z > 0. && map<1.5)
                    if(1==1){
                        float zoom = pow(10., load(_renderScale).r/10.);
                        angle += 5.*(mouse.xy - oldMouse.xy) * vec2(-1,-1)/zoom;
                        angle.y = clamp(angle.y, 0.1, PI - 0.1);
                    }
                vec3 dir = vec3(sin(angle.y) * cos(angle.x), sin(angle.y) * sin(angle.x), cos(angle.y));
                vec3 dirU = vec3(normalize(vec2(dir.y, -dir.x)), 0);
                vec3 dirV = cross(dirU, dir);
                vec3 move = vec3(0);

                
                vec3 dirFwd = vec3(cos(angle.x), sin(angle.x), 0);;
                    vec3 dirRight = vec3(dirFwd.y, -dirFwd.x, 0);
                vec3 dirUp = vec3(0,0,1);
                
                float inBlock = 0.;      
                vec3  vColPos, hColPos;
                
                //z of closest  blocks below
                float minHeight = 0.; 
                
                //z of closest  blocks above
                float maxHeight = 1000.;
                
                //XY of closest lateral blocks
                float minX = pos.x - 1000.; 
                float maxX = pos.x + 1000.;
                float minY = pos.y - 1000.;
                float maxY = pos.y + 1000.;
#ifndef XRAY_MODE
                if(isSolidVoxel(false,pos-offset) >.5)  pos.z+=clamp(3./iTimeDelta,.3,1.);
                
                //DOWN
                for (float i = 0.; i < 4.; i++) {
                    vColPos = vec3(floor(pos.xy - 0.5), floor(pos.z - 1. - i));
                    float solid=0.;
                    for(int j=0;j<4;j++){
                        solid+=
                          isSolidVoxel(false,vColPos - offset + vec3(j/2,j%2,min(iFrame,0))) * rectangleCollide(vColPos.xy + vec2(0.5 +float(j/2),0.5+float(j%2)), pos.xy, vec2(.8));
                    }
                    if ( solid> .5) {
                        minHeight = vColPos.z + 1.001; 
                        inBlock = 1.;
                        break;
                    }
                }
				
                //UP
                vColPos = vec3(floor(pos.xy - 0.5), floor(pos.z + 1.8 + 1.));
                float solidUp=0.;
                for(int j=0;j<4;j++){
                 	solidUp+= isSolidVoxel(false,vColPos - offset + vec3(j/2,j%2,min(iFrame,0))) * rectangleCollide(vColPos.xy + vec2(0.5 +float(j/2),0.5+float(j%2)), pos.xy, vec2(.8));
                }
				if(  solidUp > .5) {
                    maxHeight = vColPos.z - 1.8 - .001; 
                    inBlock = 1.;     

                }
               
                //LATERAL
                float solidL[4];
                for(int i=0;i<4;i++){
                    vec2 posL;
                    vec2 hColPosL;
                    if(i==0) {hColPos = vec3(floor(pos.xy - vec2(.3, .5)) + vec2(-1,0), floor(pos.z)); hColPosL=hColPos.yz;posL=pos.yz;}
                    if(i==1) {hColPos = vec3(floor(pos.xy - vec2(-.3, .5)) + vec2(1,0), floor(pos.z));hColPosL=hColPos.yz;posL=pos.yz;}
                    if(i==2) {hColPos = vec3(floor(pos.xy - vec2(.5, .3)) + vec2(0,-1), floor(pos.z));hColPosL=hColPos.xz;posL=pos.xz;}
                    if(i==3) {hColPos = vec3(floor(pos.xy - vec2(.5, -.3)) + vec2(0,1), floor(pos.z));hColPosL=hColPos.xz;posL=pos.xz;}
                    solidL[i]=0.;
                    for(int j=0;j<6;j++){
                        
       
                        solidL[i ] += isSolidVoxel(true,hColPos - offset + vec3((i/2)*(j%2),(1-i/2)*(j%2),(j/2)+min(iFrame,0))) 
                            * horizontalPlayerCollide(hColPosL + vec2(0.5+float(j%2), 0.5+float(j/2)), posL, 1.8);
                    }
                
                    if(i==0 && solidL[i]>.5) minX = hColPos.x + 1.301;
                    if(i==1 && solidL[i]>.5) maxX = hColPos.x - .301;
                    if(i==2 && solidL[i]>.5) minY = hColPos.y + 1.301;
                    if(i==3 && solidL[i]>.5) maxY = hColPos.y - .301;
                }
                

                
                if (abs(pos.z - minHeight) < 0.01) flightMode.r = 0.; 
#else
                flightMode.rg=vec2(.3,1.);
                if(iFrame==0) pos.z=65.;
#endif
                
                if (bool(keySinglePress(KEY_JUMP))) {
                    if (flightMode.g > 0.) {
                        flightMode.r = 1.- flightMode.r;
                        sprintMode.r = 0.;
                    }
                    flightMode.g = 0.3;
                }
                flightMode.g = max(flightMode.g - dt, 0.);

                if (bool(keySinglePress(KEY_FORWARDS))) {
                    if (sprintMode.g > 0.) sprintMode.r = 1.;
                    sprintMode.g = 0.3;
                }
                if (!bool(keyDown(KEY_FORWARDS))) {
                    if (sprintMode.g <= 0.) sprintMode.r = 0.;
                }
                sprintMode.g = max(sprintMode.g - dt, 0.);

                vec3 stats =vec3(
                    bool(keyToggled(KEY_STATS))?1.:0.,
                    bool(keyToggled(KEY_DUMP1))?1.:0.,
                    bool(keyToggled(KEY_DUMP2))?1.:0.
                );
                float torch = bool(keyToggled(KEY_TORCH))?1.:0.;
                float flow = bool(keyToggled(KEY_FLOW))?1.:0.;
                
                map = mod( map +keyPress(KEY_MAP),3.);
                inventory = floor(mod( inventory + keyPress(KEY_INVENTORY),3.));
                if(inventory<2.) selected=clamp(selected,0., NUM_ITEMS-1.);

                float loadDistLimit=80.;
                float rayLimit=500.; 
                if(bool(keyToggled(KEY_INCREASE_PERFORMANCE))){        
                    pixelSize=max(2.,pixelSize) ;
                    loadDistLimit=50.;
                    rayLimit=200.;
                }
                pixelSize=clamp( pixelSize  + keyPress(KEY_INCREASE_PIXELSIZE) - keyPress(KEY_DECREASE_PIXELSIZE)  ,1.,4.);


                if (bool(flightMode.r)) {
                    if (length(vel) > 0.) vel -= min(length(vel), 25. * dt) * normalize(vel);
                    vel += 50. * dt * dirFwd * sign(keyDown(KEY_FORWARDS)-keyDown(KEY_BACKWARDS)+keyDown(38)-keyDown(40));
                    vel += 50. * dt * dirRight * sign(keyDown(KEY_RIGHT)-keyDown(KEY_LEFT)+keyDown(39)-keyDown(37));
                    vel += 50. * dt * dirUp * sign(keyDown(KEY_JUMP) - keyDown(KEY_SNEAK));
                    if (length(vel) > 20.) vel = normalize(vel) * 20.;
                }
                else {
                    vel.xy *= max(0., (length(vel.xy) - 25. * dt) / length(vel.xy));
                    vel += 50. * dt * dirFwd * sign(keyDown(KEY_FORWARDS)-keyDown(KEY_BACKWARDS)+keyDown(38)-keyDown(40));
                    vel += 50. * dt * dirFwd * 0.4 * sprintMode.r;
                    vel += 50. * dt * dirRight * sign(keyDown(KEY_RIGHT)-keyDown(KEY_LEFT)+keyDown(39)-keyDown(37));
                    if (abs(pos.z - minHeight) < 0.01) {
                        vel.z = 9. * keyDown(32);
                    }
                    
                    else {
                        //voxel t;
                        //getCVoxel(pos -offset,t,0);
                        //bool isWater=(t.id ==12.);
                        vel.z -= 32. * dt;
                        vel.z = clamp(vel.z, -80., 30.);
                    }
					
                    if (length(vel.xy) > 4.317 * (1. + 0.4 * sprintMode.r)) vel.xy = normalize(vel.xy) * 4.317 * (1. + 0.4 * sprintMode.r);
                }


                pos += dt * vel; 
                if (pos.z < minHeight) {
                    pos.z = minHeight;
                    vel.z = 0.;
                }
                if (pos.z > maxHeight ) {
                    pos.z = maxHeight;
                    vel.z = 0.;
                }
                
                if (pos.x < minX) {
                    pos.x = minX;
                    vel.x = 0.;
                }
                if (pos.x > maxX) {
                    pos.x = maxX;
                    vel.x = 0.;
                }
                if (pos.y < minY) {
                    pos.y = minY;
                    vel.y = 0.;
                }
                if (pos.y > maxY) {
                    pos.y = maxY;
                    vel.y = 0.;
                }

                float timer = load(_old+_pickTimer).r;
                vec4 oldPick = load(_old+_pick);
                vec4 pick;
                float pickAction;
                           
                rayCastResults mousePointer = getMouseRay();
            
                bool dblClk =mouseDoubleClick();
                if(dblClk){
                    if (mousePointer.hit ) {
                        
                            pick.xyz = mousePointer.mapPos;
                            pick.a = 7.;
                  }                
                }
                
                if (iMouse.z > 0. ) {                    
                    
                    float h= (inventory>1.?NUM_ITEM_ROWS:1.);
                    float slot = mouseSelect(iMouse.xy,h);
                    if(slot>= 0. && inventory>0. ){
                        selected = slot;
                    }
                    else {	
                    
                    if (mousePointer.hit ) {
                        pick.xyz = mousePointer.mapPos;
                        if (bool(keyDown(KEY_DESTROY))) {
                            pick.a = 1.;
                            store1(_pick,pick.a);
                            timer += dt / 0.25;
                        }
                        else if (dblClk || bool(keySinglePress(KEY_PLACE))) {
                            pick.a = 2.;
                            pick.xyz += mousePointer.normal;                         
                        }
                        else if (bool(keySinglePress(KEY_SHAPE))) {
                            pick.a = 3.;
                        }
                        else if (bool(keySinglePress(KEY_ROTATE_Z))) {
                            pick.a = 4.;
                         }
                        else if (bool(keySinglePress(KEY_ROTATE_Y))) {
                            pick.a = 5.;
                        }
                         else if (bool(keyDown(KEY_MULTISELECT))) {
                            pick.a = 6.;
                             store1(_pick,pick.a);
                             timer += dt / 0.25;
                        }
                        if (oldPick != pick) timer = 0.;
                    }
                    else {
                        //pick = vec4(-1,-1,-1,0);
                        timer = 0.;
                    }
                }
                }
                else { 
                    
                    // NO MOUSE KEY PRESSED  
                    //pick = vec4(-1,-1,-1,0);
						if (bool(keyDown(KEY_DESTROY))) {
                            pick.a = 1.;
                            store1(_pick,pick.a);
                            timer += dt / 0.25;
                        }
                        else if (bool(keySinglePress(KEY_PLACE))) {
                            pick.a = 2.;
                        }
                        else if (bool(keySinglePress(KEY_SHAPE))) {
                            pick.a = 3.;
                         }
                        else if (bool(keySinglePress(KEY_ROTATE_Z))) {
                            pick.a = 4.;
                        }
                        else if (bool(keySinglePress(KEY_ROTATE_Y))) {
                            pick.a = 5.;
                        }
                        else if (bool(keyDown(KEY_MULTISELECT))) {
                            pick.a = 6.;
                             store1(_pick,pick.a);
                             timer += dt / 0.25;                   
                        }else timer = 0.;
                }


                renderScale = clamp(renderScale + keySinglePress(KEY_DECREASE_ZOOM) - keySinglePress(KEY_INCREASE_ZOOM), -5., 10.);
                time.g = clamp(time.g + keySinglePress(KEY_INCREASE_TIME_SCALE) - keyPress(KEY_DECREASE_TIME_SCALE), 0., 8.);
                time.r = mod(time.r + dt * sign(time.g) * pow(2., time.g - 1.), 1200.);

                bool still= length(pos-oldPos)<0.01 && length(angle -load(_angle).xy )<0.01  &&  iMouse.z<1.;
                rayDistMax= rayLimit;/*clamp(rayDistMax  
                                  +(still?10.:0.) 
                                  - ((iTimeDelta>0.03 && !still)?5.:0.)
                                  -((iTimeDelta>0.1)?1.:0.) 
                                  -((iTimeDelta>0.1  && !still)?50.:0.) 
                                  + ((iTimeDelta<0.03 && still)?20.:0.)
                                  ,loadDistLimit*2.5,rayLimit);*/


                store3(_pos, pos);
                store2(_angle, angle);
                store4(_loadRange_B,calcLoadRange_B(pos.xy,iChannelResolution[1].xy,0.));
#if SURFACE_CACHE>0
                store4(_loadRange_C,calcLoadRange_C(pos.xy,iChannelResolution[1].xy,0.));
#endif
                store4(_mouse, mouse);
                //store1(_inBlock, inBlock);
                store3(_vel, vel);
                store4(_pick, pick);
                store1(_pickTimer, timer);
                store1(_renderScale, renderScale);
                store1(_selectedInventory, selected);
                store2(_flightMode, flightMode);
                store2(_sprintMode, sprintMode);
                store2(_time, time);
                store3(_stats, stats);
                store1(_rayDistMax, rayDistMax);
                store1(_loadDistLimit, loadDistLimit);
                store1(_rayLimit, rayLimit);
                store1(_map,map);
                store1(_pixelSize,pixelSize);
                store1(_inventory,inventory);
                store1(_demo,demo);
                store1(_torch,torch);
                store1(_flow,flow);
               


                fragColor = outValue;
            }
        }  
        else fragColor = texture(iChannel0, (fragCoord - _old) / iChannelResolution[0].xy);
    }
#ifdef MC    
    else if (texCoord.x < 512. && texCoord.y<32.) {
            if(iFrame>3) discard;
            else if(texCoord.y<31.&& texCoord.x<256.)
            {
               int _edgeTable[256]= int[256](
                -1   , 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c, 0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00, 
                0x190, 0x099, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c, 0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90, 
                0x230, 0x339, 0x033, 0x13a, 0x636, 0x73f, 0x435, 0x53c, 0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30, 
                0x3a0, 0x2a9, 0x1a3, 0x0aa, 0x7a6, 0x6af, 0x5a5, 0x4ac, 0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0, 
                0x460, 0x569, 0x663, 0x76a, 0x066, 0x16f, 0x265, 0x36c, 0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60, 
                0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0x0ff, 0x3f5, 0x2fc, 0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0, 
                0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x055, 0x15c, 0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950, 
                0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0x0cc, 0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0, 
                0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc, 0x0cc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0, 
                0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c, 0x15c, 0x055, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650, 
                0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc, 0x2fc, 0x3f5, 0x0ff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0, 
                0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c, 0x36c, 0x265, 0x16f, 0x066, 0x76a, 0x663, 0x569, 0x460, 
                0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac, 0x4ac, 0x5a5, 0x6af, 0x7a6, 0x0aa, 0x1a3, 0x2a9, 0x3a0, 
                0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c, 0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x033, 0x339, 0x230, 
                0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c, 0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x099, 0x190, 
                0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c, 0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0
               );
               fragColor=vec4(_edgeTable[int(texCoord.x)]);
           }
           else if(texCoord.y<32.&& texCoord.x<256.){

            int  _triTableCompact[1024] = int[1024](
                65535,65535,65535,65535, 62336,65535,65535,65535, 63760,65535,65535,65535, 37761,65304,65535,65535, 64033,65535,65535,65535, 
                4992,65442,65535,65535, 2601,65426,65535,65535, 9090,39562,65528,65535, 62131,65535,65535,65535, 33456,65291,65535,65535, 
                8337,65459,65535,65535, 4785,35257,65531,65535, 45475,65338,65535,65535, 416 ,47272,65530,65535, 12435,43931,65529,65535, 
                43657,65464,65535,65535, 63604,65535,65535,65535, 28724,65347,65535,65535, 35088,65396,65535,65535, 18708,14103,65521,65535,
                35361,65396,65535,65535, 14147,8512,65530,65535, 39465,18464,65527,65535, 10658,29305,18803,65535, 14152,65323,65535,65535,
                46923,578 ,65524,65535, 33033,12916,65531,65535, 39796,47540,4754,65535, 12707,34731,65524,65535, 6833,436 ,19316,65535, 39028,
                47536,12474,65535, 19316,47515,65530,65535, 62553,65535,65535,65535, 1113,65336,65535,65535, 5200,65285,65535,65535, 33880,4947,
                65525,65535, 39457,65349,65535,65535, 6147,38050,65525,65535, 23077,1060,65522,65535, 13730,21330,33844,65535, 9305,65459,65535,
                65535, 688 ,38072,65525,65535, 1104,12881,65531,65535, 9490,33413,22603,65535, 43834,22833,65524,65535, 1428,43032,43905,65535,
                20549,46512,12474,65535, 22597,35496,65531,65535, 22649,65431,65535,65535, 36921,30005,65523,65535, 2160,20849,65527,65535, 13137,
                65397,65535,65535, 39033,6773,65522,65535, 37402,13573,14160,65535, 33288,22610,9639,65535, 9634,21301,65527,65535, 30103,45976,
                65522,65535, 38745,10535,46880,65535, 2866,29057,29976,65535, 45355,6001,65525,65535, 34905,6773,45987,65535, 20597,46992,40976,
                61611, 45227,23088,28800,61557, 30123,65371,65535,65535, 62826,65535,65535,65535, 21376,65386,65535,65535, 20745,65386,65535,65535,
                4993,42377,65526,65535, 9569,65302,65535,65535, 5473,866  ,65528,65535, 38249,8288,65526,65535, 22677,9512,33334,65535, 43826,65366,
                65535,65535, 47115,27138,65525,65535, 10512,42419,65526,65535, 5797,47401,47250,65535, 27446,5429,65523,65535, 2944,20571,27473,65535,
                1715,24675,38149,65535, 26966,39865,65528,65535, 18085,65415,65535,65535, 16436,22071,65530,65535, 20625,18538,65527,65535, 5482,
                29049,18803,65535, 25110,29717,65528,65535, 21793,866 ,29748,65535, 38728,24656,25093,65535, 31031,9033,26969,63842, 29363,27208,
                65525,65535, 18085,9255,46880,65535, 18704,12935,27227,65535, 37161,18731,19323,63141, 14152,21339,27473,65535, 23317,363 ,19323,
                64320, 2384,12374,14006,63304, 26966,29881,39801,65535, 26954,65444,65535,65535, 18084,32937,65523,65535, 41226,17926,65520,65535,
                33080,26721,41316,65535, 6465,25154,65524,65535, 6147,17042,17961,65535, 17440,65378,65535,65535, 33336,9282,65526,65535, 43338,
                11078,65523,65535, 8832,38072,27210,65535, 691 ,24673,41316,65535, 24902,33953,45345,61880, 37993,6499,14003,65535, 33208,27393,
                16785,61766, 14003,24582,65524,65535, 47174,65414,65535,65535, 30375,39080,65530,65535, 880,36986,42858,65535, 5994,29050,2072,
                65535, 42858,28951,65523,65535, 5665,33158,30345,65535, 10594,30233,14601,63799, 28807,1632,65522,65535, 25143,65319,65535,65535,
                43826,35462,30345,65535, 9986,37047,42855,63401, 4225,41351,42855,64306, 45355,27249,5985,65535, 34456,6518,14006,63025, 45456,
                65398,65535,65535, 28807,45920,1712,65535, 63159,65535,65535,65535, 64359,65535,65535,65535, 47107,65383,65535,65535, 47376,65383,
                65535,65535, 35096,31507,65526,65535, 25114,65403,65535,65535, 14881,46720,65527,65535, 8338,46746,65527,65535, 10166,35386,35235,
                65535, 25383,65394,65535,65535, 30727,9734,65520,65535, 9842,4211,65529,65535, 4705,37224,26504,65535, 42618,12657,65527,65535, 
                5754,33191,32791,65535, 1840,41127,31337,65535, 31335,43146,65529,65535, 46214,65384,65535,65535, 15203,16480,65526,65535, 35688,
                2404,65521,65535, 38473,14646,25521,65535, 25734,41611,65521,65535, 14881,24752,25611,65535, 18612,8374,39465,65535, 41882,18723,
                25523,62308, 33576,25636,65522,65535, 16960,65318,65535,65535, 8337,16963,33606,65535, 5265,16932,65526,65535, 33560,18454,6758,
                65535, 40986,1632,65524,65535, 17252,42627,37635,62362, 25754,65354,65535,65535, 30100,65462,65535,65535, 17280,31577,65526,65535,
                20741,26372,65531,65535, 34427,21315,20788,65535, 42073,26401,65531,65535, 6070,32930,22851,65535, 23399,9380,8266,65535, 14403,
                9029,9637,63099, 29479,17702,65529,65535, 1113,24680,30818,65535, 12899,20839,1104,65535, 26662,4728,22600,63569, 42073,29025,29462,
                65535, 6753,359 ,1927,62553, 18948,12378,31338,64115, 31335,17802,43082,65535, 26006,35739,65529,65535, 2915,20534,22790,65535, 
                2224,4277,46677,65535, 25526,13651,65521,65535, 39457,47541,26040,65535, 944 ,37046,38486,64033, 46475,2149,9637,62752, 25526,
                41555,13731,65535, 22917,25986,10290,65535, 38489,24582,65522,65535, 6225,25864,10296,63526, 9809,65377,65535,65535, 5681,33702,
                38486,63128, 40986,22880,1616,65535, 22576,65446,65535,65535, 63066,65535,65535,65535, 31323,65461,65535,65535, 47707,14423,65520,
                65535, 22453,37306,65520,65535, 42362,35195,4993,65535, 45595,22295,65521,65535, 4992,29042,45685,65535, 38265,2418,31522,65535, 
                29271,38322,33330,62089, 10834,29523,65525,65535, 32808,30757,21157,65535, 20745,13626,10807,65535, 37513,30738,21154,62039,
                13617,65367,65535,65535, 1920,28951,65525,65535, 37641,13651,65527,65535, 22409,65401,65535,65535, 21637,47754,65528,65535, 21509,
                42251,955 ,65535, 35088,43172,21675,65535, 42170,15188,5268,62483, 8530,45656,34120,65535, 2880,21563,6955,64277, 1312,45717,34117,
                62859, 9545,65339,65535,65535, 14930,17189,18485,65535, 21157,9282,65520,65535, 12963,33701,34117,63760, 21157,37186,9362,65535, 
                34120,21301,65521,65535, 5440,65360,65535,65535, 34120,2357,21253,65535, 62793,65535,65535,65535, 18356,43449,65531,65535, 17280,
                47481,47767,65535, 7073,16715,46192,65535, 13331,41348,46196,62650, 38836,10571,8603,65535, 38009,6523,6955,62336, 46203,16932,
                65520,65535, 46203,14372,16948,65535, 10898,12951,38007,65535, 38825,10823,1927,63234, 14963,18218,2586,64004, 33441,65351,65535,
                65535, 16788,6001,65523,65535, 16788,32881,6017,65535, 29444,65332,65535,65535, 63364,65535,65535,65535, 43177,65419,65535,65535,
                14595,39865,65530,65535, 2576,43146,65531,65535, 47635,65443,65535,65535, 6945,47515,65528,65535, 14595,8633,39721,65535, 35616,
                65456,65535,65535, 64291,65535,65535,65535, 10290,35496,65529,65535, 681 ,65321,65535,65535, 10290,4264,35352,65535, 62113,65535,
                65535,65535, 38961,65409,65535,65535, 61840,65535,65535,65535, 63536,65535,65535,65535, 65535,65535,65535,65535
            );

             int id= int(texCoord.x)*4;
             fragColor= vec4(_triTableCompact[id],_triTableCompact[id+1],_triTableCompact[id+2],_triTableCompact[id+3] );

         }
    }
#endif    
    else setTexture(fragColor,fragCoord);
}



void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
