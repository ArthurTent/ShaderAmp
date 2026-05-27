// https://www.shadertoy.com/view/4ldGz4
// Modified by ArthurTent
// Created by knarkowicz
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
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


// Scene traycing

//#define DEBUG_CAMERA
//#define DEBUG_LIGHTING
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

const float MATH_PI = float( 3.14159265359 );

float gMaterial     		= 0.0;
float gTime         		= 0.0;
float gCarOffset    		= 0.0;
float gStreetLampDist		= 100000.0;
float gCarLampDist			= 100000.0;
float gReflStreetLampDist	= 100000.0;
float gFogDensity			= 0.1;
float gFogHeightFalloff		= 0.1;

const float MTRL_ROAD           = 1.0;
const float MTRL_BUILDING       = 2.0;
const float MTRL_CAR            = 3.0;
const float MTRL_STREETLAMPS    = 4.0;
const float MTRL_TUNNEL			= 5.0;
const float INTERIOR_START      = 59.0;
const float INTERIOR_END        = 67.0;

float Saturate( float x )
{
    return clamp( x, 0.0, 1.0 );
}

float Cylinder( vec3 p, float r, float height ) 
{
    float d = length( p.xz ) - r;
    d = max( d, abs( p.y ) - height );
    return d;
}

float Torus( vec3 p, float r, float h )
{
    vec2 q = vec2( length( p.yz ) - h, p.x );
    return length( q ) - r;
}

float Plane( vec3 p, vec4 plane ) 
{
    return dot( p, plane.xyz ) + plane.w;
}

float Sphere( vec3 p, float s )
{
    return length( p ) - s;
}

float Box( vec3 p, vec3 b )
{
    vec3 d = abs( p ) - b;
    return min( max( d.x, max( d.y, d.z ) ), 0.0 ) + length( max( d, 0.0 ) );
}

float HexPrism( vec3 p, float h, float r )
{
    vec3 q = abs( p );
    return max( q.z - r, max( ( q.x * 0.866025 + q.y * 0.5 ), q.y ) - h );
}

float Rectangle( vec2 p, vec2 b )
{
    vec2 d = abs( p ) - b;
    return min( max( d.x, d.y ), 0.0 ) + length( max( d, 0.0 ) );
}

float RepeatAngle( inout vec2 p, float n ) 
{
	float angle = 2.0 * MATH_PI / n;
	float a = atan( p.y, p.x ) + angle / 2.0;
	float r = length( p );
	float c = floor( a / angle );
	a = mod( a, angle ) - angle / 2.;
	p = vec2( cos( a ), sin( a ) ) * r;
	return c;
}

float Circle( vec2 p, float s )
{
    return length( p ) - s;
}

float Intersect( float a, float b )
{
    return max( a, b );
}

float Substract( float a, float b )
{
    return max( a, -b );
}

float SubstractRound( float a, float b, float r ) 
{
    vec2 u = max( vec2( r + a, r - b ), vec2( 0.0, 0.0 ) );
    return min( -r, max( a, -b ) ) + length( u );
}

float SubstractChamfer( float a, float b, float r ) 
{
    return max( max( a, -b ), ( a + r - b ) * 0.70711 );
}

float Union( float a, float b )
{
    return min( a, b );
}

float UnionRound( float a, float b, float r ) 
{
    vec2 u = max( vec2( r - a, r - b ), vec2( 0.0, 0.0 ) );
    return max( r, min( a, b ) ) - length( u );
}

void Rotate( inout vec2 p, float a ) 
{
    p = cos( a ) * p + sin( a ) * vec2( p.y, -p.x );
}

float Rand( vec2 co )
{
    return fract( sin( dot( co.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

float StreetLamps( vec3 p )
{
    p = abs( p );
    
    float rx = 50.0;
    p.x = mod( p.x, rx ) - 0.5 * rx;
    p.z -= 15.0;
    
    float a = Box( p, vec3( 0.3, 12.0, 0.3 ) );
    
    p += vec3( 0.0, -12.7, 3.5 );
    Rotate( p.yz, -0.4 * MATH_PI );
    float b = Box( p, vec3( 0.5, 4.0, 0.3 ) );
    
    float bloom = Box( p + vec3( 0.0, -0.5, 0.6 ), vec3( 0.5, 3.0, 0.1 ) );
    gStreetLampDist = min( gStreetLampDist, bloom );
    
    return Union( a, b );
}

float Pyramid( vec3 p, float h ) 
{
    vec3 q = abs( p );
    return max( -p.y, ( q.x + q.y + q.z - h ) / 3.0 );
}

float Pyramids( vec3 p )
{    
    p += vec3( -1220.0, 0.0, 0.0 );    
    vec3 t = p;

    float rx = 200.0;
    float rz = 150.0;
    t.x = t.x > 0.0 ? mod( t.x, rx ) - 0.5 * rx : t.x;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    
    Rotate( t.xz, 0.5 );        
    float a = Pyramid( t, 30.0 );
    
    t = p;

    rx = 400.0;
    rz = 300.0;
    t.x = t.x > 0.0 ? mod( t.x, rx ) - 0.5 * rx : t.x;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    
    Rotate( t.xz, 0.5 );        
    float b = Pyramid( t, 80.0 );    
    
    return Union( a, b );
}

float Obelisks( vec3 p )
{    
    p += vec3( -1220.0, -50.0, 0.0 );       
    
    float rx = 200.0;
    float rz = 150.0;
    p.x = mod( p.x, rx ) - 0.5 * rx;
    p.z = mod( p.z, rz ) - 0.5 * rz;
    
    Rotate( p.xz, 0.5 + gTime * 1.5 );
    float a = Pyramid( p, 30.0 );
    Rotate( p.xz, -1.0 - gTime * 3.0 );
    
    p.y += 7.0;
    
    Rotate( p.yx, -MATH_PI );
    float b = Pyramid( p, 20.0 );    
    
    return Union( a, b );
}

float Buildings( vec3 p )
{        
    vec3 t = p;
    float rx = 200.0;
    float rz = 100.0;
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    float a = HexPrism( t.xzy, 18.0, 40.0 );
    float at = HexPrism( t.xzy, 12.0, 50.0 );
    a = Substract( a, at );    
    
    t = p + vec3( 100.0, 0.0, 0.0 );
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    float b = Box( t, vec3( 20.0, 66.0, 20.0 ) );
    float bt = Box( t + vec3( 0.0, -66.0, 0.0 ), vec3( 15.0, 6.1, 15.0 ) );
    b = Substract( b, bt );
    
    rz = 200.0;
    t = p + vec3( 150.0, 0.0, 0.0 );
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    float c = Box( t, vec3( 20.0, 99.0, 20.0 ) );
    
    rz = 200.0;
    t = p + vec3( 50.0, 0.0, 0.0 );
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    float d = Cylinder( t, 20.0, 4.0 * 33.0 );
    
    return Union( Union( Union( a, b ), c ), d );
}

float Car( vec3 p )
{        
    p.x = -p.x;     
    p.y -= 0.3;
    
    float a = Box( p, vec3( 4.2, 0.9, 1.8 ) );   
    
    vec3 t = p + vec3( -6.0, 0.0, 0.0 );
    Rotate( t.yx, 0.2 );
    float b = Plane( t, vec4( 0.0, -1.0, 0.0, 0.0 ) );
    
    t = p + vec3( -5.0, 0.0, 0.0 );
    Rotate( t.yx, -0.4 );
    float c = Plane( t, vec4( 0.0, 1.0, 0.0, 0.0 ) );    
    
    t = p + vec3( 2.0, -0.2, 0.0 );
    Rotate( t.yx, -0.4 );
    float d = Plane( t, vec4( 0.0, -1.0, 0.0, 0.0 ) );   
    
    t = p + vec3( 2.0, -0.3, 0.0 );
    Rotate( t.yx, -0.05 );
    float e = Plane( t, vec4( 0.0, -1.0, 0.0, 0.0 ) );       
    
    t = p + vec3( 2.0, 1.0, 0.0 );
    Rotate( t.yx, 0.2 );
    float f = Plane( t, vec4( 0.0, 1.0, 0.0, 0.0 ) );     
    
    t = p;
    t.z = abs( t.z );
    t += vec3( -3.9, -0.6, 0.0 );
    float spoiler = Box( t, vec3( 0.2, 0.05, 1.7 ) );
    spoiler = Union( spoiler, Box( t - vec3( 0.0, -0.25, 1.4 ), vec3( 0.2, 0.3, 0.15 ) ) );
    
    float bloom = Box( t + vec3( -0.5, 0.7, 0.0 ), vec3( 0.1, 0.3, 1.5 ) );
    gCarLampDist = min( gCarLampDist, bloom );
    
    t = p + vec3( 1.0, -0.6, 0.0 );
    Rotate( t.yx, -0.4 );
    float frontWindow = Box( t, vec3( 0.6, 0.05, 1.6 ) );
    
    t = p + vec3( -2.5, -0.7, 0.0 );
    Rotate( t.yx, 0.2 );
    float backWindow = Box( t, vec3( 1.0, 0.05, 1.6 ) );
    
    float body = Union( Substract( a, Union( Union( Union( b, c ), Intersect( d, e ) ), f ) ), spoiler );
    
    t = p;
    t.z = -abs( t.z );
    t += vec3( 0.0, -0.8, 1.2 );
    Rotate( t.yz, -0.9 );
    float sideCutPlanes = Plane( t, vec4( 0.0, -1.0, 0.0, 0.0 ) );      
    
    body = SubstractChamfer( body, Union( backWindow, frontWindow ), 0.1 );
    body = SubstractChamfer( body, sideCutPlanes, 0.05 );
    
    p.x += 0.1;
    p.xz = abs( p.xz );
    t = p.xzy - vec3( 2.4, 1.5, -0.7 );
    float wheel = Cylinder( t, 0.7, 1.0 );
    body = Substract( body, wheel );
    
    wheel = Substract( Cylinder( t, 0.55, 0.3 ), Sphere( t + vec3( 0.0, -0.15, 0.0 ), 0.35 ) );
    
    body = Union( body, wheel );
    
    return body;
}

float Curb( vec3 p )
{
    float y = p.y - 0.5;
    float z = -abs( p.z ) + 14.0;    
    return max( y, z );   
}

float Tunnel( vec3 p )
{
    vec3 t = p;
    t += vec3( -2510.0, 0.0, 0.0 );
    float a = Box( t, vec3( 200.0, 16.0, 50.0 ) );
    float b = Box( t, vec3( 201.0, 14.0, 16.0 ) );    
    a = Substract( a, b );
        
    t = p;
    t += vec3( -7870.0, 0.0, 0.0 );
    float c = Box( t, vec3( 200.0, 16.0, 50.0 ) );
    float d = Box( t, vec3( 201.0, 14.0, 16.0 ) );    
    c = Substract( c, d );
    
    float rx = 12.0;
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = abs( t.z );
    b = Box( t + vec3( 0.0, 0.0, -16.0 ), vec3( 4.0, 12.0, 2.0 ) );   
    
    return Substract( Union( a, c ), b );
}

float CarInterior( vec3 p )
{
    p.y -= 3.0;
    
    vec3 t = p;
    Rotate( t.xy, -0.7 );
    float wheel     = Torus( t + vec3( 0.0, 3.2, 2.0 ), 0.24, 2.4 );
    vec3 s = t + vec3( 0.0, sin( 0.3 * t.z - 1.7 ) * 0.3 + 0.1, 0.0 );
    float dashboard = Box( s + vec3( -1.6, 2.0, 0.0 ), vec3( 0.8, 2.0, 10.0 ) );
    Rotate( t.xy, 0.3 );
    float d         = Box( t + vec3( -0.1, 2.2, 0.8 ), vec3( 1.0, 1.2, 7.0 ) );
    dashboard = SubstractRound( dashboard, d, 0.4 );
    
    return Union( wheel, dashboard );
}

float TerrainAO( vec3 p )
{
    float ret = 1.0;
    
    vec3 t = p + vec3( -gCarOffset, -1.0, -3.0 );
    float car = Box( t, vec3( 2.8, 5.0, 1.6 ) );
    ret = min( ret, smoothstep( 0.0, 1.0, car * 0.9 ) );
  
    t = abs( p );
    float rx = 50.0;
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.y -= 2.0;
    t.z -= 15.0;
    float streetLamps = Cylinder( t, 0.2, 2.0 );
    ret = min( ret, smoothstep( 0.0, 1.0, streetLamps * 0.1 ) );
    
    t = p;
    rx = 200.0;
    float rz = 100.0;
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    float buildings = HexPrism( t.xzy, 18.0, 40.0 );        
    
    t = p + vec3( 100.0, 0.0, 0.0 );
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    buildings = Union( buildings, Box( t, vec3( 20.0, 66.0, 20.0 ) ) );
    
    rz = 200.0;
    t = p + vec3( 150.0, 0.0, 0.0 );
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    buildings = Union( buildings, Box( t, vec3( 20.0, 99.0, 20.0 ) ) );
    
    rz = 200.0;
    t = p + vec3( 50.0, 0.0, 0.0 );
    t.x = mod( t.x, rx ) - 0.5 * rx;
    t.z = mod( t.z, rz ) - 0.5 * rz;
    buildings = Union( buildings, Cylinder( t, 20.0, 4.0 * 33.0 ) );
    
    ret = min( ret, smoothstep( 0.0, 1.0, buildings * 0.05 ) );
    return mix( ret, 1.0, 0.5 );
}

float Scene( vec3 p )
{    
    float terrain   = Union( Plane( p, vec4( 0.0, 1.0, 0.0, 0.0 ) ), Curb( p ) );
    float tunnel    = Tunnel( p );
    
    if ( gTime >= 77.0 )
    {
        vec3 t = p;
        t.z = abs( p.z );
        terrain = Substract( terrain, Plane( t, vec4( 0.0, 0.0, -1.0, 18.0 ) ) );
        terrain = Union( terrain, Box( t + vec3( -7700.0, 0.0, -20.0 ), vec3( 10000.0, 3.0, 2.0 ) ) );
    }

    float buildings = gTime <= 25.0 ? Pyramids( p ) : ( gTime < 77.0 ? Buildings( p ) : Obelisks( p ) );
    float streetLamps = StreetLamps( p );
    
    p += vec3( -gCarOffset, -1.0, -3.0 );
    float car = gTime > INTERIOR_START && gTime < INTERIOR_END ? CarInterior( p ) : Car( p );
                        
    float ret = Union( Union( Union( Union( terrain, buildings ), streetLamps ), car ), tunnel );

    gMaterial = MTRL_TUNNEL;    
	gMaterial = terrain 	<= ret ? MTRL_ROAD 			: gMaterial;
    gMaterial = buildings 	<= ret ? MTRL_BUILDING		: gMaterial;
    gMaterial = car 		<= ret ? MTRL_CAR 			: gMaterial;
    gMaterial = streetLamps <= ret ? MTRL_STREETLAMPS 	: gMaterial;
 
    return ret;
}

float CastRay( in vec3 ro, in vec3 rd )
{
    const float maxd = 500.0;
    
    float h = 0.5;
    float t = 0.0;
   
    for ( int i = 0; i < 64; ++i )
    {
        if ( h < 0.01 || t > maxd ) 
        {
            break;
        }
        
        h = Scene( ro + rd * t );
        t += h;
    }

    if ( t > maxd )
    {
        t = -1.0;
    }

    return t;
}

vec3 SceneNormal( in vec3 pos )
{
    vec3 eps = vec3( 0.01, 0.0, 0.0 );
    vec3 nor = vec3(
        Scene( pos + eps.xyy ) - Scene( pos - eps.xyy ),
        Scene( pos + eps.yxy ) - Scene( pos - eps.yxy ),
        Scene( pos + eps.yyx ) - Scene( pos - eps.yyx ) );
    return normalize( -nor );
}

float SpeedMeterY( vec2 p )
{
    p -= vec2( 4.0, 3.8 );
    float d = Circle( p, 0.02 );
    
	vec2 t = p;
    RepeatAngle( t, 8.0 );
    d = min( d, Rectangle( t + vec2( -0.7, 0.0 ), vec2( 0.08, 0.01 ) ) );
    
    t = p;
    Rotate( t.xy, 0.4 );
    RepeatAngle( t, 8.0 );
    d = min( d, Rectangle( t + vec2( -0.7, 0.0 ), vec2( 0.03, 0.01 ) ) );
    d = max( d, -Circle( p + vec2( 0.0, 0.71 ), 0.51 ) );
    
    return d;
}

float SpeedMeterR( vec2 p, float t )
{
    p -= vec2( 4.0, 3.8 );

    Rotate( p.xy, t + 0.5 + 0.5 * sin( t + 2.0 * gTime ) );
    float d = Rectangle( p + vec2( -0.32, 0.0 ), vec2( 0.18, 0.01 ) );
    
    return d;
}

vec3 Dashboard( vec3 p3 )
{
    p3.x -= gCarOffset;
    
    vec2 p;
    p.x = p3.z;
    p.y = p3.y * 1.3 + 1.8;

	vec3 color 	= vec3( 0.0 );
    vec3 yellow = vec3( 0.9, 0.7, 0.1 );
    vec3 red 	= vec3( 1.0, 0.1, 0.4 );
    vec3 purple	= vec3( 0.54, 0.42, 0.78 );
    
    float dy = min( SpeedMeterY( p ), SpeedMeterY( p + vec2( 2.0, 0.0 ) ) );
    
    float horBarsY = 100000.0;
    // yellow horizontal bars
    for ( int i = 0; i < 4; ++i )
    {
        float ampl	= texture( iAudioData, vec2( ( 2.0 * float( i ) + 1.5 ) / 8.0, 0.25 ) ).x;
        float sizeX = 0.7 * floor( Saturate( 1.4 * sqrt( ampl ) ) * 6.0 ) / 6.0;
        horBarsY = min( horBarsY, Rectangle( p - vec2( 7.3 + sizeX, 3.05 + float( i ) * 0.4 ), vec2( sizeX, 0.03 ) ) );
    }
    
    float dr = 100000.0;
    // vertical bars
    for ( int i = 0; i < 3; ++i )
    {
        float sy = 0.45 + floor( ( 0.1 * ( 3.0 * sin( 14.0 * gTime ) + sin( 7.0 * gTime ) ) ) / 0.2 ) * 0.2;
		sy *= i == 1 ? 1.0 : 0.39;
		dr = min( dr, Rectangle( p - vec2( 5.6 + float( i ) * 0.4, 3.8 ), vec2( 0.1, sy ) ) );
    }
    
    vec2 t = p;
    t.y = mod( t.y, 0.2 ) - 0.5 * 0.2;
	float di = Rectangle( t, vec2( 100.0, 0.06 ) );
    dr = max( dr, -di );
    
    dr = min( dr, min( SpeedMeterR( p, 0.0 ), SpeedMeterR( p + vec2( 2.0, 0.0 ), 1.0 ) ) );

    // red horizontal bars
    float horBarsR = 100000.0;
    for ( int i = 0; i < 4; ++i )
    {
        float ampl	= texture( iAudioData, vec2( ( 2.0 * float( i ) + 0.5 ) / 8.0, 0.25 ) ).x;
        float sizeX = 0.7 * floor( Saturate( 1.4 * sqrt( ampl ) ) * 6.0 ) / 6.0;
        sizeX = 0.7 * floor( sizeX * 6.0 ) / 6.0;
        horBarsR = min( horBarsR, Rectangle( p - vec2( 7.3 + sizeX, 3.225 + float( i ) * 0.4 ), vec2( sizeX, 0.03 ) ) );
    }    
    
    // horizontal bar segments
    t = p;
    t.x += 0.2;
    t.x = mod( t.x, 0.26 ) - 0.5 * 0.26;
	di = Rectangle( t, vec2( 0.06, 100.0 ) );
    dr = min( dr, max( horBarsR, -di ) );
    dy = min( dy, max( horBarsY, -di ) );
    
    float dp = 100000.0;
    p.x = mod( p.x, 2.0 ) - 1.0;
    dp = min( dp, Rectangle( p - vec2( 0.0, 3.8 ), vec2( 0.01, 1.2 ) ) );
    
    color += 2.0 * yellow 	* Saturate( exp( -dy * 40.0 ) );
    color += 1.5 * red 		* Saturate( exp( -dr * 40.0 ) );
    color += 1.0 * purple	* Saturate( exp( -dp * 40.0 ) );
    return p3.x - p3.y * 0.3 > -0.7 ? color : vec3( 0.0 );
}

mat3 CameraLookAt( vec3 ro, vec3 ta, float cr )
{
    vec3 cw = normalize( ta - ro);
    vec3 cp = vec3( sin( cr ), cos( cr ), 0.0 );
    vec3 cu = normalize( cross( cw, cp ) );
    vec3 cv = normalize( cross( cu, cw ) );
    return mat3( cu, cv, cw );
}

vec3 Sky( vec3 rayDir )
{
    // sky and sun
    vec3 skyPos     = rayDir;
    vec2 skyAngle   = vec2( atan( skyPos.z, skyPos.x ), acos( skyPos.y ) );

    float sun = 1.0 - clamp( 6.0 * length( skyAngle - vec2( 0.0, 1.5 ) ) - 1.0, 0.0, 1.0 );
    float sky = clamp( 1.0 - 1.5 * skyPos.y, 0.0, 1.0 );

    float sunLines = 1.0 - clamp( sin( skyPos.y * skyPos.y * 500.0 ), 0.0, 1.0 )*(FFT(1)+FFT(25)+FFT(50))/1.25;
    vec3 sunColor = mix( vec3( 1.0, 0.2, 0.5 ), vec3( 1.0, 0.2, 0.0 ) * 4.0, clamp( skyPos.y * 6.0, 0.0, 1.0 ) );
    sun *= gTime > 0.3 ? 3.0 - 2.0 * smoothstep( 0.0, 1.0, ( gTime - 0.3 ) * 0.5 ) : 1.0;
    vec3 color = vec3( 0.54, 0.42, 0.78 ) * 0.2 * sky * 4.0 + sunColor * sun * sunLines;

    // stars
    vec2 starTile   = floor( skyAngle.xy * 20.0 );
    vec2 starPos    = fract( skyAngle.xy * 20.0 ) * 2.0 - 1.0;
    float starRand  = Rand( starTile + vec2( 0.1, 0.3 ) );
    starRand = starRand > 0.9 ? starRand-FFT(25) : 0.0;
    color += vec3( 2.0 ) * starRand * clamp( 1.0 - ( 6.0 + 3.0 * sin( gTime * 2.0 + 20.0 * skyAngle.y ) ) * length( starPos ), 0.0, 1.0 ) * ( sun > 0.0 ? 0.0 : 1.0 );
    return color;
}

float SceneRefl( vec3 p )
{
    p = abs( p );
    
    float rx = 50.0;
    p.x = mod( p.x, rx ) - 0.5 * rx;
    p.z -= 15.0;
    
    float a = Box( p, vec3( 0.3, 12.0, 0.3 ) );
    
    p += vec3( 0.0, -12.7, 3.5 );
    Rotate( p.yz, -0.4 * MATH_PI );
    float b = Box( p, vec3( 0.5, 4.0, 0.3 ) );
    
    float bloom = Box( p + vec3( 0.0, -0.5, 0.6 ), vec3( 0.5, 3.0, 0.1 ) );
    gReflStreetLampDist = min( gReflStreetLampDist, bloom );
    
    return Union( a, b );
}

float CastReflectionRay( in vec3 ro, in vec3 rd )
{
    const float maxd = 100.0;
    
    float h = 0.5;
    float t = 0.0;
   
    for ( int i = 0; i < 16; ++i )
    {
        if ( h < 0.01 || t > maxd ) 
        {
            break;
        }
        
        h = SceneRefl( ro + rd * t );
        t += h;
    }

    if ( t > maxd )
    {
        t = -1.0;
    }
    
    return t;
}

vec3 SceneReflection( vec3 pos, vec3 normal, vec3 rayDir )
{
	vec3 reflDir = reflect( rayDir, normal );
    float t = CastReflectionRay( pos + 0.5 * reflDir, reflDir );
    float w = abs( normal.x - 1.0 ) < 0.5 ? 0.3 : 1.0;    
    
    vec3 color = Sky( reflDir ) * mix( 1.0, 0.7, w * float( t >= 0.0 ) );
    color += w * vec3( 0.54, 0.42, 0.78 ) * 2.0 * vec3( Saturate( exp( -gReflStreetLampDist * 0.6 ) ) );
    return color;
}

vec3 SceneBloom( vec3 rayOrigin, vec3 rayDir )
{
    vec3 color = vec3( 0.0 );

    vec3 center = vec3( 25.0, 14.0, 16.0 );
    vec3 left   = vec3( 0.0, 0.0, 1.0 );
    center += left * clamp( dot( rayOrigin - center, left ), -7.0, 7.0 );   
    
	color += vec3( 0.54, 0.42, 0.78 ) * 0.5 * vec3( Saturate( exp( -gStreetLampDist * 0.6 ) ) );
    color += vec3( 1.2, 0.1, 0.2 ) * 0.3 * vec3( Saturate( exp( -gCarLampDist * 2.0 ) ) );

    return color;
}

float SmoothNoise( vec3 v )
{
	vec3 i = floor( v );
	vec3 f = fract( v );

	f = f * f * ( -2.0 * f + 3.0 );

	vec2 uv		= ( i.xy + vec2( 7.0, 17.0 ) * i.z ) + f.xy;
	float lowz	= textureLod( iChannel0, ( uv.xy + 0.5 ) / 64.0, 0.0 ).x;

	uv			= ( i.xy + vec2( 7.0, 17.0 ) * ( i.z + 1.0 ) ) + f.xy;
	float highz = textureLod( iChannel0, ( uv.xy + 0.5 ) / 64.0, 0.0 ).x;
	float r		= mix( lowz, highz, f.z );

	return 2.0 * r - 1.0;
}

float DensityNoise( vec3 pos, vec3 noisePosScale, vec3 noisePosScaleBias, float noiseScale, float noiseBias )
{
	pos = pos * noisePosScale + noisePosScaleBias;

	float noise = SmoothNoise( pos ) + 0.5 * SmoothNoise( pos * 3.07 );
	noise = Saturate( noise * noiseScale + noiseBias );

	return noise;
}

void VolumetricFog( inout vec3 color, vec3 rayOrigin, vec3 rayDir, float sceneT, vec2 fragCoord )
{
    sceneT = sceneT <= 0.0 ? 200.0 : sceneT;
    
    vec3 seed = vec3( 0.06711056, 0.00583715, 52.9829189 );
    float dither = fract( seed.z * fract( dot( fragCoord.xy, seed.xy ) ) );
    
    float fogAlpha = 0.0;
    for ( int i = 0; i < 32; ++i )
    {
        float t = ( float( i ) + 0.5 + dither ) * 5.0;
        if ( t <= sceneT )
        {
        	vec3 p = rayOrigin + t * rayDir;
        	float s = DensityNoise( p, vec3( 0.3 ), vec3( 0.0, 0.0, 0.0 ), 1.0, 0.0 ) * exp( -p.y * gFogHeightFalloff );
            fogAlpha += gFogDensity * t * exp( -gFogDensity * t ) * s;
        }
    }
    fogAlpha = 1.0 - Saturate( fogAlpha );
    color = color * fogAlpha + vec3( 1.0 ) * ( 1.0 - fogAlpha );
}

vec4 mainImageBufferA(vec2 fragCoord )
{
    //gTime       = iChannelTime[ 3 ];
    //gTime = iTime;
    gTime = mod(iAmplifiedTime, 110.);
    gCarOffset  = 100.0 * gTime;
    
    vec2 screenUV = fragCoord.xy / iResolution.xy;
    vec2 p = -1.0 + 2.0 * screenUV;
    p.x *= iResolution.x / iResolution.y;

    vec2 mo = iMouse.xy / iResolution.xy;
    
    float mbStrength	= 1.0;
    float fov			= 1.2;
    float cameraOffset  = gCarOffset;
    float theta         = clamp( 10.0 * mo.y, 0.01, 0.55 * MATH_PI );
    float phi           = 6.0 * mo.x;
    vec3 target         = vec3( gCarOffset + 1.0, 3.0, 3.0 );    
    float zoom          = 15.0;

    // center game camera
	gFogDensity			= 0.1;
	gFogHeightFalloff	= mix( 0.1, 0.3, Saturate( ( gTime - 13.0 ) * 0.25 ) );
    mbStrength			= 1.0;
    zoom            	= 10.0 + 1.2 * sin( gTime );
    cameraOffset    	= gCarOffset;
    target          	= vec3( gCarOffset + 2.0, 5.0, 3.0 );
    phi             	= 2.8 + 6.0 * mo.x;
    theta           	= 1.267 ;

    if ( gTime > 18.8 )
    {
        // right side near camera
		gFogDensity			= 0.1;
		gFogHeightFalloff	= 0.3;        
        mbStrength			= 1.0;
        float camWeight 	= smoothstep( 0.0, 1.0, Saturate( ( gTime - 18.8 ) * 0.25 ) );
        zoom            	= mix( zoom, 8.0 + sin( gTime ), camWeight );
        cameraOffset    	= gCarOffset;
        target          	= vec3( gCarOffset + 2.0, 5.0, 3.0 );    
        phi             	= mix( phi, 2.35, camWeight );
        theta          		= mix( theta, 1.27, camWeight );
    }
    if ( gTime > 33.0 )
    {
        // top chase camera     
		gFogDensity			= 0.1;
		gFogHeightFalloff	= 0.01;        
        mbStrength			= 0.0;        
        zoom            	= 130.0;
        cameraOffset    	= gCarOffset - ( gTime - 38.0 ) * 80.0;
        target          	= vec3( cameraOffset + 2.0, 5.0, 0.0 );
        phi             	= 2.3;
        theta           	= 0.4;
    }
    if ( gTime > 43.0 )
    {
        // building camera
		gFogDensity			= 0.1;
		gFogHeightFalloff	= 10.0;        
        mbStrength			= 0.0;
        fov					= 2.0;
        cameraOffset    	= gCarOffset - 10.0;
        target         	 	= vec3( gCarOffset + 2.0, 15.0, -16.0 );    
        zoom            	= 1.0;    
        phi             	= 0.0;
        theta           	= 0.0;
    }
    if ( gTime > 53.5 )
    {
        // left side near low camera  
		gFogDensity			= 0.1;
		gFogHeightFalloff	= 0.3;                
        mbStrength			= 1.0;
        fov					= min( 1.2 + ( gTime - 53.5 ) * 0.2, 0.8 );
        zoom            	= 8.0 + 3.0 * cos( gTime );
        cameraOffset    	= gCarOffset;
        target          	= vec3( gCarOffset + 2.0, 5.0, -1.0 );
        phi             	= 3.14;
        theta           	= 1.4;
    }
    if ( gTime > INTERIOR_START )
    {
        // interior camera
        mbStrength		= 1.0;
        fov				= 2.0;
        zoom            = 7.0;    
        cameraOffset    = gCarOffset;
        target          = vec3( gCarOffset + 1.0, 2.8, 5.5 );        
        phi             = 2.46;
        theta           = 1.17;  
    }
    if ( gTime > INTERIOR_END )
    {        
        // center game camera and left side near camera     
        mbStrength		= 1.0;
        fov				= 1.2;
		float camWeight = gTime < 95.0 ? smoothstep( 0.0, 1.0, Saturate( ( gTime - 80.0 ) * 0.25 ) ) : smoothstep( 1.0, 0.0, Saturate( ( gTime - 95.0 ) * 0.25 ) );
        zoom            = mix( 10.0, 6.0, camWeight ) + 1.3 * sin( gTime );
        cameraOffset    = gCarOffset;
        target          = vec3( gCarOffset + 2.0, 5.0, mix( 3.0, -1.0, camWeight ) );
        phi             = mix( 2.8, 3.5, camWeight );
        theta           = mix( 1.267, 0.8, camWeight );
    }
    if ( gTime > 99.5 )
    {
        fov	= max( 1.2 - ( gTime - 99.5 ) * 0.5, 0.5 );
    }
    if ( gTime > 100.0 )
    {
        gCarOffset += ( gTime - 100.0 ) * 10.0;
    }
    if ( gTime > 105.0 )
    {
        gCarOffset = 0.;
    }
    
    
#ifdef DEBUG_CAMERA
    // orbiting debug camera
    cameraOffset  = gCarOffset;
    theta         = clamp( 10.0 * mo.y, 0.01, 0.55 * MATH_PI );
    phi           = 6.0 * mo.x;
    target        = vec3( gCarOffset + 1.0, 3.0, 3.0 );    
    zoom          = 5.0;
#endif
    
    vec3 rayOrigin;    
    rayOrigin.x = zoom * sin( theta ) * cos( phi ) + cameraOffset;
    rayOrigin.y = zoom * cos( theta );
    rayOrigin.z = zoom * sin( theta ) * sin( phi );

    mat3 worldToCamera = CameraLookAt( rayOrigin, target, 0.0 );
    
    // ray direction
    vec3 rayDir = worldToCamera * normalize( vec3(p.xy,fov) );  
    vec3 color = vec3( 0.0 );
    
    float t = CastRay( rayOrigin, rayDir );
    if ( t > 0.0 )
    {
        vec3 pos = rayOrigin + t * rayDir;
        vec3 normal = SceneNormal( pos );
        vec3 sunDir = normalize( vec3( -300., -200.0, 0.0 ) ); // sun pos
        vec3 sunColor = vec3( 1.0, 0.2, 0.0 ) * 0.5;
        
        vec3 posLS  = pos * 0.1;        
        vec3 nrmLS  = normal;
        vec3 absNrm = abs( nrmLS );

        float maxAbsNrm = max( max( absNrm.x, absNrm.y ), absNrm.z );
        vec2 uvXZ   = absNrm.x >= maxAbsNrm ? posLS.zy : posLS.xy; 
        vec2 uvXYZ  = absNrm.y >= maxAbsNrm ? posLS.xz : uvXZ;
      
        vec3 diffuseColor = vec3( 1.0 );
        vec3 specularColor = vec3( 0.04 );
        vec3 emissive = vec3( 0.0 );
        
        // road
        diffuseColor = vec3( pos.y > 20.0 ? 0.3 : 0.5 );
        if ( gMaterial == MTRL_ROAD && abs( pos.z ) < 14.0 )
        {
            diffuseColor = vec3( 0.5 );
            if ( abs( pos.z ) < 0.2 )
            {
                diffuseColor = vec3( 1.0 );
            }

			if ( ( abs( pos.z + 7.0 ) < 0.2 || abs( pos.z - 7.0 ) < 0.2 ) )
            {
                diffuseColor = vec3( 0.5 + 0.5 * exp( -4.0 * abs( 2.0 * fract( pos.x * 0.1 ) - 1.0 ) ) );
            }
            
            // red trail
            float trailX = pos.x - gCarOffset;
            emissive = 1.2 * vec3( 1.1, 0.0, 0.0 ) 
                * Saturate( exp( -0.4 * abs( pos.z - 3.0 ) ) )
                * Saturate( 1.0 + trailX * 0.002 )
                * Saturate( -0.5 - trailX * 0.5 );
        }
        
        // lamp
        if ( gMaterial == MTRL_STREETLAMPS )
        {
            emissive = pos.y > 11.5 && normal.y > 0.5 ? vec3( 1.0 ) : vec3( 0.0 );
        }        
        
        if ( gMaterial == MTRL_BUILDING && abs( normal.y ) < 0.1 )
        {
            diffuseColor = vec3( 0.7 );
                
            vec2 tilePos    = fract( uvXZ * 4.0 );
            vec2 tileId     = uvXZ * 4.0 - tilePos;
            vec2 edge       = min( clamp( ( tilePos - 0.2 ) * 5.0, 0.0, 1.0 ), clamp( ( 1.0 - tilePos ) * 5.0, 0.0, 1.0 ) );       
            float bump      = edge.x * edge.y;

            float tileRand = Rand( tileId );
            vec3 tileColor = vec3( 0.3 );
            tileColor = tileRand > 0.5 ? vec3( 1.0, 0.3, 0.5 ) * 1.2 : tileColor;
            tileColor = tileRand > 0.7 ? vec3( 1.0, 0.5, 0.0 ) * 1.2 : tileColor;
            tileColor = tileRand > 0.9 ? vec3( 1.0, 0.5, 0.9 ) * 1.2 : tileColor;
            emissive = 1.0 * bump * tileRand * tileColor;
            
            emissive *= clamp( 4.0 * abs( tilePos.x - 0.5 ) + 0.5, 0.0, 1.0 );
            emissive *= clamp( 4.0 * abs( tilePos.y - 0.5 ) + 0.5, 0.0, 1.0 );
        }
        
        if ( gMaterial == MTRL_BUILDING )
        {
            float buildingLine = abs( 2.0 * fract( uvXZ.y * 2.0 - 0.05 ) - 1.0 );
            emissive += 2.0 * vec3( 0.54, 0.42, 0.78 ) * ( exp2( -buildingLine * 4.0 ) );
            if ( pos.y < 5.0 )
            {
                emissive = vec3( 0.0 );
            }    
            
            if ( abs( -normal.y - 1.0 ) < 0.1 )
            {
                diffuseColor 	= vec3( 0.3 );
                emissive 		= vec3( 0.0 );
            }
        }
        
        if ( gMaterial == MTRL_TUNNEL )
        {
            diffuseColor = vec3( 0.8 );
        }        
        
        // car 
        if ( gMaterial == MTRL_CAR )
        {
            diffuseColor = vec3( 0.1 );
            specularColor = vec3( 0.6 );
            
            // car lamp emissive
            vec2 pl = pos.zy;
            pl.x = abs( pl.x - 3.0 );
            float dl = Rectangle( pl + vec2( -1.0, -1.3 ), vec2( 0.4, 0.06 ) );
            float es = Saturate( exp( -dl * 20.0 ) );
            emissive = 1.5 * vec3( 1.2, 0.1, 0.3 ) * es;
            specularColor *= 1.0 - es;
        }
        
        // car interior
        if ( gMaterial == MTRL_CAR && gTime > INTERIOR_START && gTime < INTERIOR_END )
        {
            diffuseColor    = vec3( 0.2 );
            specularColor   = vec3( 0.04 );
            emissive        = Dashboard( pos );
        }
        if(gTime>105.){
            diffuseColor    = vec3( 0.2 );
            specularColor   = vec3( 0.04 );
            emissive        = Dashboard( pos );
        }
        
        float wrap = 0.5;
        vec3 diffuse = diffuseColor * sunColor * Saturate( ( dot( normal, sunDir ) + wrap ) / ( 1.0 + wrap ) );
        color = diffuse;
        
        vec3 halfVec2       = normalize( sunDir + rayDir );
        float NdotH2        = dot( normal, halfVec2 );
        color += sunColor * specularColor * Saturate( dot( normal, sunDir ) ) * pow( clamp( NdotH2, 0.0, 1.0 ), 32.0 );        
        
        // local lights
        vec3 pos2       = pos;
        pos2.x = mod( pos2.x, 50.0 );                

        vec3 tubeColor  = vec3( 0.54, 0.42, 0.78 ) * 300.0;
        vec3 tubePos    = vec3( 25.0, -10.0, 0.0 );
        vec3 tubeLeft   = vec3( 0.0, 0.0, 1.0 );        
        tubePos += tubeLeft * clamp( dot( pos2 - tubePos, tubeLeft ), -7.0, 7.0 );        
        
        vec3 tubeDir = normalize( tubePos - pos2 );
        float tubeAtt = 1.0 / pow( length( tubePos - pos2 ), 2.0 );
        color += diffuseColor * tubeColor * tubeAtt * Saturate( dot( normal, tubeDir ) );
        
        // car lights
        vec3 spotColor  = vec3( 0.54, 0.42, 0.78 ) * 300.0;
        vec3 spotPos    = vec3( 3.1 + gCarOffset, -1.5, 3.0 );
        vec3 spotDir    = normalize( spotPos - pos );
        float spotAtt = 1.0 / pow( length( spotPos - pos ), 2.0 );
        spotAtt *= Saturate( -spotDir.x * 6.0 - 4.0 );
        color += diffuseColor * spotColor * spotAtt * Saturate( dot( normal, spotDir ) );                

        // ambient
        color += 0.1 * vec3( 0.54, 0.42, 0.78 ) * clamp( -normal.y + 0.5, 0.0, 1.0 );        
        color *= gMaterial == MTRL_ROAD   ? TerrainAO( pos ) : 1.0;
        
        // emissive
        color += emissive;
                
        // reflection
        float fresnel = Saturate( pow( 1.0 + dot( rayDir, -normal ), 5.0 ) );
        specularColor = mix( specularColor, vec3( 1.0 ), fresnel );
        specularColor = gMaterial == MTRL_ROAD || gMaterial == MTRL_TUNNEL? specularColor * 0.05 : specularColor;        
        color += specularColor * 0.5 * SceneReflection( pos, normal, rayDir );
        
        // back plane
        color *= 1.0 - clamp( ( t - 200.0 ) * 0.01, 0.0, 1.0 ) * 0.8;
        
        // wireframe
        vec2 tilePos = mod( uvXYZ * vec2( gMaterial == MTRL_BUILDING ? 2.0 : 0.5, 2.0 ), 1.0 );
        tilePos = abs( 2.0 * tilePos - 1.0 );
        float wireframe = ( exp2( -tilePos.x * 6.0 ) + exp2( -tilePos.y * 6.0 ) );         
        float wireframeAlpha = gTime > 50.0 ? Saturate( ( pos.x - 7080.0 ) * 0.05 ) * Saturate( ( 8080.0 - pos.x ) * 0.05 ) : Saturate( 1.0 - ( gTime - 13.5 ) / 4.0 );
        wireframeAlpha = gMaterial == MTRL_CAR ? 0.0 : wireframeAlpha;
        
        color = mix( color, Sky( rayDir ) + wireframe * vec3( 0.54, 0.42, 0.78 ) * 1.2, wireframeAlpha );
        mbStrength *= 1.0 - wireframeAlpha;
        
#ifdef DEBUG_LIGHTING
		color = mix( vec3( 1.0, 0.5, 0.0 ), vec3( 0.0, 0.0, 1.0 ), 0.5 * normal.y + 0.5 );
#endif
    }
    else
    {
        color 		= Sky( rayDir );
        mbStrength 	= 0.0;
    }
    
    VolumetricFog( color, rayOrigin, rayDir, t, fragCoord );
	color += SceneBloom( rayOrigin, rayDir );
    //color *= Saturate( ( 107.0 - gTime ) / 5.0 );
    color *= Saturate( ( 109.0 - gTime ) / 5.0 );
    
    return vec4( color, mbStrength );
}


// Post processing
vec4 mainImageBufferB( vec2 fragCoord )
{
 	vec2 screenUV = fragCoord.xy / iResolution.xy;
    
    // radial blur
    //vec4 mainSample = texture( iChannel0, screenUV );    
    vec4 mainSample = mainImageBufferA(screenUV);
    vec2 blurOffset = ( screenUV - vec2( 0.5 ) ) * 0.002 * mainSample.w;
    vec3 color = mainSample.xyz;
    //color += texture( iChannel0, screenUV - blurOffset * float( 3 ) ).xyz;
    color += mainImageBufferA(screenUV - blurOffset * float( 3 ) ).xyz;
    
    /*
    for ( int iSample = 1; iSample < 16; ++iSample )
	{
		color += texture( iChannel0, screenUV - blurOffset * float( iSample ) ).xyz;
	}    
    color /= 16.0;
    */
    color /= 3.0;
    // vignette
    float vignette = screenUV.x * screenUV.y * ( 1.0 - screenUV.x ) * ( 1.0 - screenUV.y );
    vignette = clamp( pow( 16.0 * vignette, 0.3 ), 0.0, 1.0 );
    color *= vignette;
    
    float scanline   = clamp( 0.95 + 0.05 * cos( 3.14 * ( screenUV.y + 0.008 * iTime ) * 240.0 * 1.0 ), 0.0, 1.0 );
    float grille  	= 0.85 + 0.15 * clamp( 1.5 * cos( 3.14 * screenUV.x * 640.0 * 1.0 ), 0.0, 1.0 );
    color *= scanline * grille * 1.2;    
        
    return vec4( color, 1.0 );
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
 	//vec2 screenUV = fragCoord.xy / iResolution.xy;
    vec2 screenUV = fragCoord;
    // chromatic abberation
    float caStrength	= 0.005;
    vec2 caOffset 		= screenUV - 0.5;
	vec2 caUVG			= screenUV + caOffset * caStrength;
	vec2 caUVB			= screenUV + caOffset * caStrength * 2.0;

    vec3 color;
    color.x = mainImageBufferA(screenUV ).x;
    color.y = mainImageBufferA(caUVG ).y;
    color.z = mainImageBufferA(caUVB ).z;    
    //color = mainImageBufferA(fragCoord ).xyz; 
    fragColor = vec4( color, 1.0 );
}
void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
