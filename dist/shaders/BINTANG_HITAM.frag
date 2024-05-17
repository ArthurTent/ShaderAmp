// https://www.shadertoy.com/view/DtlBW7
// Modified by ArthurTent
// Created by zhonkvision
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// Code by Flopine | Edited version by Zhonk Vision
// AN AUDIO REACTIVE SHADER, play the sound in iChannel0

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


#define ITER 64.
#define PI 3.141592
#define megabass (texture(iAudioData, vec2(0.001,0.25)).x)

// Parameters to control the bintang shape
uniform float shipLength; // Length of the bintang
uniform float shipWidth;  // Width of the bintang

vec3 getTexture(vec2 p){
	vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}

float hash21 (vec2 x)
{return fract(sin(dot(x,vec2(12.4,14.1)))*1245.4);}
// Modify a 2D vector by rotating its components around the origin
vec2 moda(vec2 p, float per)
{
    float a = atan(p.y, p.x);
    float l = length(p);
    a = mod(a-per/2., per)-per/4.;
    return vec2(cos(a),sin(a))*l;
}

// Generate a 2x2 rotation matrix based on an angle
mat2 rot (float a)
{return mat2(cos(a),sin(a),-sin(a),cos(a));}

float smin( float a, float b, float k )
{
    float res = exp( -k*a ) + exp( -k*b );
    return -log( res )/k;
}

// Define a sphere shape centered at the origin
float sphe (vec3 p, float r)
{return length(p)-r;}

// Define a cylinder shape centered at the origin along the x-y plane
float cyl (vec2 p, float r)
{return length(p)-r;}

// Create a complex structure resembling needles or spikes
float needles(vec3 p)
{
    vec3 pp = p;
    float l_needle = 0.8 - clamp(megabass,0.,0.75);

    p.xz = moda(p.xz, 2.*PI/7.);
    float n1 = cyl(p.yz,0.1-p.x*l_needle);

    p = pp;
    p.y = abs(p.y);
    p.y -= 0.1;
    p.xz = moda(p.xz, 2.*PI/7.);
    p.xy *= rot(PI/4.5);

    float n2 = cyl(p.yz,0.1-p.x*l_needle);

    p = pp;
    float n3 = cyl(p.xz, 0.1-abs(p.y)*l_needle);

    // Adjust the bintang shape here
    float alienShip = sphe(p, shipLength) - shipWidth;

    return min(n3, min(n2, min(n1, alienShip)));
}
// Create a combined shape with a spiky ball and needles
float spikyball (vec3 p)
{
    p.y -= iAmplifiedTime;
    p.xz *= rot(iAmplifiedTime);
    p.yz *= rot(iAmplifiedTime*0.5);
    float s = sphe(p,.1);
    return smin(s, needles(p), 2.);
}

// Define a complex room-like environment using trigonometric functions
float room(vec3 p)
{
    p += sin(p.yzx - cos(p.zxy));
    p += sin(p.yzx/0.5 + cos(p.zxy)/200.)*.5;
    return -length(p.xz) + 5.;
}

// Combine the spiky ball and room shapes using the minimum function
float SDF (vec3 p)
{
    return min(spikyball(p),room(p));
}

// Main rendering function to calculate pixel color and shading
void main( )
{
    // Normalize pixel coordinates
    //vec2 uv = (2.*fragCoord-iResolution.xy)/iResolution.y;
    vec2 uv = -1.0 + 2.0* vUv;

    vec3 col_greenscreen = 0.3+ getTexture(vUv);

    // Generate a dither value based on pixel coordinates
    float dither = hash21(uv);

    // Define the camera ray origin and direction
    vec3 ro = vec3(0.001,0.001+iAmplifiedTime,-3.);
    vec3 p = ro;
    vec3 dir = normalize(vec3(uv, 1.));

    // Initialize shading intensity
    float shad = 0.;

    // Raymarching loop
    for (float i = 0.; i<ITER; i++)
    {
        // Calculate signed distance to the scene
        float d = SDF(p);
        // Break loop if very close to the surface
        if(d<0.001)
        {
        	shad = i/ITER;
            break;
        }
        // Adjust distance with dither for randomness
        d *= 0.9+dither*0.1;
        // Move along the ray
        p+=d*dir;
    }

    // Calculate shading color
    vec3 c = vec3 (shad);

    // Apply gamma correction and assign color to pixel
    gl_FragColor = vec4(pow(c,vec3(1.5)),1.0);
    gl_FragColor *= vec4(col_greenscreen,1.0);
}