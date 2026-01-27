// https://www.shadertoy.com/view/dtSBR1
// Modified by ArthurTent
// Created by FaustianBargainForTop
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;

uniform vec2 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;



const int Steps = 750;
const float Epsilon = 0.005; // Marching epsilon
const float T=0.5;

const float rA=10.0; // Maximum ray marching or sphere tracing distance from origin
const float rB=40.0; // Minimum

// Matrix for fractal noise
const mat3 m3 = mat3( 0.00,  0.80,  0.60,
                     -0.80,  0.36, -0.48,
                     -0.60, -0.48,  0.64 );

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;

// Transforms
vec3 rotateX(vec3 p, float a)
{
  float sa = sin(a);
  float ca = cos(a);
  return vec3(p.x, ca*p.y - sa*p.z, sa*p.y + ca*p.z);
}

vec3 rotateY(vec3 p, float a)
{
  float sa = sin(a);
  float ca = cos(a);
  return vec3(ca*p.x + sa*p.z, p.y, -sa*p.x + ca*p.z);
}

vec3 rotateZ(vec3 p, float a)
{
  float sa = sin(a);
  float ca = cos(a);
  return vec3(ca*p.x + sa*p.y, -sa*p.x + ca*p.y, p.z);
}

//Usefull for asteroid belt rotations
vec3 rotateU(vec3 p, vec3 u, float a)
{	
  	float sa = sin(a);
  	float ca = cos(a);
    float f1 = u.x*u.y*(1.0-ca); 
    float f2 = u.x*u.z*(1.0-ca);
    float f3 = u.y*u.z*(1.0-ca);
    float nx = (ca+u.x*u.x*(1.0-ca))*p.x + 
        (f1-u.z*sa)*p.y +
        (f2+u.y*sa)*p.z;
    
    float ny = (f1+u.z*sa)*p.x + 
        (ca+u.y*u.y*(1.0-ca))*p.y +
        (f3-u.x*sa)*p.z;
    
    float nz = (f2-u.y*sa)*p.x +
        (f3+u.x*sa)*p.y +
        (ca+u.z*u.z*(1.0-ca))*p.z;
    
    return vec3(nx, ny, nz);
}

//2D Noise function from user iq
float hash(vec2 p)
{
    p  = 45.0*fract( p*0.3183099 + vec2(0.71,0.113));
    return -1.0+2.0*fract( p.x*p.y*(p.x+p.y) );
}

float noise( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
	
	vec2 u = f*f*(3.0-2.0*f);

    return mix( mix( hash( i + vec2(0.0,0.0) ), 
                     hash( i + vec2(1.0,0.0) ), u.x),
                mix( hash( i + vec2(0.0,1.0) ), 
                     hash( i + vec2(1.0,1.0) ), u.x), u.y);
}

//3D Noise function from user iq
float hash(vec3 p)
{
    p  = fract( p*0.3183099+.1 );
	p *= 17.0;
    return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
}

float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
	
    return mix(mix(mix( hash(p+vec3(0,0,0)), 
                         hash(p+vec3(1,0,0)),f.x),
                    mix( hash(p+vec3(0,1,0)), 
                         hash(p+vec3(1,1,0)),f.x),f.y),
                mix(mix( hash(p+vec3(0,0,1)), 
                         hash(p+vec3(1,0,1)),f.x),
                    mix( hash(p+vec3(0,1,1)), 
                         hash(p+vec3(1,1,1)),f.x),f.y),f.z);
}

// Smooth falloff function
// r : small radius
// R : Large radius
float falloff( float r, float R )
{
  float x = clamp(r/R,0.0,1.0);
  float y = (1.0-x*x);
  return y*y*y;
}

// Value of the lambda aka Liptschitz constant
// e : energy associated to the primitive
// R : radius associated to the primitive
float lambda(float e, float R){
    // maximum of the falloff function derivative
    const float lambda_zero = 96. / (25. * sqrt(5.));
    
    return e * lambda_zero / R;
}

// Primitive functions

// Point skeleton
// p : point
// c : center of skeleton
// e : energy associated to skeleton
// R : large radius
// lam : pseudo-calculated lambda
float point(vec3 p, vec3 c, 
            float e,float R, out float lam)
{
  lam = lambda(e, R)/dot(p-c, p-c);
  return e*falloff(length(p-c),R);
}

// Calculate the distance of a point to a segment
// p : point
// a : starting point of the segment
// b : ending point of the segment
float distSegment(vec3 p, vec3 a, vec3 b)
{
    vec3 ab = b-a;
    vec3 ap = p-a;
    float L = length(ab);
    float d = dot(ap, ab)/(dot(ab,ab));
    if (d < 0.0)
    {
        return length(p-a);
    }
    if (d > 1.0)
    {
        return length(p-b);
    }
    else
    {
        vec3 pp = a + d*ab;
    	return length(p-pp);
    } 
}

// Segment
// p : point
// a : starting point of the segment
// b : ending point of the segment
// e : energy associated to skeleton
// R : large radius
// lam : pseudo-calculated lambda
float Segment(vec3 p, vec3 a, vec3 b, 
              float e, float R, out float lam)
{
    float dist = distSegment(p, a, b);
    lam = lambda(e, R)/dist;
    return e*falloff(dist, R);
}

// Circle
// p : point
// c : center of the circle
// r : radius of the circle
// n : orientation of the circle
// e : energy associated to skeleton
// R : large radius
// lam : pseudo-calculated lambda
float Circle(vec3 p, vec3 c, float r, vec3 n, 
             float e, float R, out float lam)
{	
    vec3 cp = c-p;
    float l = dot(n, cp);
    float h = sqrt(dot(cp, cp) - l*l);
    float hcr = h-r;
    float dist = sqrt(hcr*hcr+l*l);
    lam = lambda(e, R)/dist;
    return e*falloff(dist, R);
}

// Non regular circle
// p : point
// c : center of the circle
// r : radius of the circle
// n : orientation of the circle
// f : flatening agent
// e : energy associated to skeleton
// R : large radius
// lam : pseudo-calculated lambda
float FlatCircle(vec3 p, vec3 c, float r, vec3 n, float f, 
                 float e, float R, out float lam)
{	
    vec3 cp = p-c;
    float l = dot(n, cp);
    float h = sqrt(dot(cp, cp) - l*l);
    float hcr = h-r;
    float d = sqrt(hcr*hcr+l*l*f*f);
    float la = lambda(e, R);
    
    //For death ray
    //lam = la*f/h;
    //Normal lambda calculation
    //lam = la*f/d;
    //Optimized optimisation
    lam = 0.5*la*f/d;
    return e*falloff(d, R);
}
 
// Asteroids : fractal noise
// tp  : point
// d   : density of the field
// len : distance of the point to the field
// R   : large radius
float Asteroids(vec3 tp, float d, float len, float R)
{
    float noi = 0.0;
    //If we are close nough to care about the asteroïds
    if(len < R){
    	vec3 q = 3.0*tp;//vec3(x, y, z);
    	noi  = 0.5000*noise( q ); q = m3*q*2.01;
    	noi += 0.2500*noise( q ); q = m3*q*2.02;
    	noi += 0.1250*noise( q ); q = m3*q*2.03;
        
        //Second noise calculation : clumpy uneven results
        /*
        q = vec3(noi*tp.x, noi*tp.y, noi*tp.z);
    	noi  = 1.0000*noise( q ); q = m3*q*2.01;
    	noi += 0.25000*noise( q ); q = m3*q*2.02;
    	//*/
    }
    
    //density factor
    float sc = 1.0/d;
    //distance to the asteroids
    return sc*noi;
}

// Asteroid field
// p : point
// c : center of field
// r : radius of the field
// d : density of the field
// e : energy associated to skeleton
// R : large radius
// lam : pseudo-calculated lambda
float Asterofield(vec3 p, vec3 c, float r, float d, 
                  float e,float R, out float lam)
{
    // Distance to the center
    vec3 cp = p-c;
    // Distance to the shell
    float len = length(cp)-r;
    
    // The distance calculated for the asteroids (distances are squared)
    float afact = Asteroids(cp, d, len*len, R*R);
    
    // General distance
    // "Proper" way, disturbing the distance with a noise
    //float dist = sqrt(len*len)+afact;
    // "Wtf way, disturbing the distance calculation in itself
    float dist = sqrt(len*len+afact*afact);
    
    // If we are near the asteroids we need more precisions
    float l = lambda(e, R);
    if (afact > 0.0)
        // Very specific, dangerous
        //lam = 4.0*l/(dist*dist);
        //Usual
        lam = 4.0*l/dist;
    else
        lam = l/dist;
    return e*falloff(dist, R);
}

// Asteroid belt - (Added rot_factor)
// p : point
// c : center of belt
// r : radius of the belt
// n : orientation of the belt
// d : density of the belt
// f : flatness of the belt
// e : energy associated to skeleton
// R : large radius
// rot_factor: audio-driven rotation factor
// lam : pseudo-calculated lambda
float Asteroidbelt(vec3 p, vec3 c, float r, vec3 n, float d, float f, 
                    float e, float R, float rot_factor, out float lam)
{
    // Distance to the center of the circle
    vec3 cp = p-c;
    
    // Audio-Reactive Rotation: Use rot_factor (audio_low) to modify rotation speed
    float rotation_speed = 0.5 * iTime + rot_factor * 5.0; // 5.0 is a sensitivity multiplier
    cp = rotateU(cp, n, rotation_speed);
    
    // Distance to the circle 
    float l = dot(n, cp);
    float h = sqrt(dot(cp, cp) - l*l);
    float hcr = h-r;
    
    // The distance calculated for the asteroids (distances are squared)
    float afact = Asteroids(cp, d, hcr*hcr+l*l, R*R);
    
    //General distance
    // "Proper" way, disturbing the distance with a noise
    //float dist = sqrt(hcr*hcr+l*l*f*f)+afact;
    // Better results if afact is added in the square root
    float dist = sqrt(hcr*hcr+l*l*f*f+afact*afact);
    float la = lambda(e, R);
    
    // If we are near the asteroids we need more precisions
    if (afact > 0.0)
        // Very specific, dangerous
        //lam = 5.0*la*f/(dist*dist);
        // usual
        lam = 4.0*la*f/dist;
    else
        lam = la*f/dist;
    
    return e*falloff(dist, R);
}

// Blending
// a : field function of left sub-tree
// b : field function of right sub-tree
float Blend(float a,float b)
{
    return a+b;
}

// Union
// a : field function of left sub-tree
// b : field function of right sub-tree
float Union(float a,float b)
{
    return max(a,b);
}

// Intersection
// a : field function of left sub-tree
// b : field function of right sub-tree
float Intersection(float a,float b)
{
    return min(a,b);
}

// Substraction
// a : field function of left sub-tree
// b : field function of right sub-tree
float Substraction(float a,float b)
{
    return min(a, 2.0*T-b);
}

// Audio-reactive color for the central object
vec3 AsteroStarColor(vec3 p)
{
    // 1. Calculate the distance from the center (where AsteroStar is located)
    float dist = length(p);
    
    // 2. Base FFT for color
    float fft_low = FFT(4);
    float fft_mid = FFT(20);
    float fft_high = FFT(60);
    
    // 3. Create a dynamic, pulsating color (e.g., orange-red-yellow)
    vec3 audio_color = vec3(
        0.5 + fft_low * 2.0,   // Red Channel: Strong reaction to low frequencies
        0.3 + fft_mid * 1.5,   // Green Channel: Moderate reaction to mid frequencies (yellow-shift)
        0.1 + fft_high * 1.5   // Blue Channel: Weak reaction
    );

    // 4. Create a falloff (the core is brightest)
    // The color fades as we move away from the center (0.0, 0.0, 0.0)
    float falloff_factor = 1.0 - smoothstep(0.0, 5.0, dist); // Fades out fully by distance 5.0
    
    return audio_color * falloff_factor * 1.5; // Multiply by 1.5 for a strong emission effect
}

//OBJECTS
//AsteroStar - (Added audio_amp)
float AsteroStar(vec3 p, float audio_amp, out float lam)
{
    float lam2 = 0.0;
    // Use audio_amp to drive the radius of the Asterofield
    float astero_rad = 3.0 + 1.0 * audio_amp; // Base radius 3.0, grows with audio
    float v = Asterofield(p, vec3( 0.0, 0.0, 0.0), astero_rad, 0.4, 
                          1.0, 1.3, lam);
    
    // Use audio_amp to drive the energy (size) of the center point
    float point_energy = 1.0 + 1.0 * audio_amp; // Base energy 1.0, grows with audio
    v = Blend(v, point(p,vec3(0.0, -0.8521+audio_amp,0.0), point_energy, 3.5, lam2));
    
    lam = max(lam, lam2);
    return v;
}

//MegaBelt - (Added audio_low)
float MegaBelt(vec3 p, float audio_low, out float lam)
{
    float lam2 = 0.0;
    // Pass audio_low as the rotation factor
    float v = Asteroidbelt(p, vec3(0.0, 0.0, 0.0), 5.5, normalize(vec3(0.0, .71, .71)), 
                            0.3, 3.0, 1.0, 2.0, audio_low, lam);
    v = Blend(v, point(p,vec3(5.0, -2.0,2.0),1.0,1.5, lam2));
    lam = max(lam, lam2);
    return v;
}

//Saturn -  (Added audio_mid)
float Saturn(vec3 p, float audio_mid, out float lam)
{
    float lam2 = 0.0;
    float v = point(p,vec3(-7.0, 2.0,2.0),1.0,2.5, lam);
    
    // Use audio_mid to drive the flatness factor of the ring
    float flatness = 17.5 + 5.0 * audio_mid; // Base 17.5, grows with audio_mid
    v = Blend(v, FlatCircle(p, vec3(-7.0, 2.0,2.0), 2.0, normalize(vec3(1.0, 0.8, 0.0)), 
                            flatness, 1.0, 0.8, lam2));
    
    lam = max(lam, lam2);
    return v;
}

//Loner
float Loner(vec3 p, out float lam)
{
    float lam2;
    float v = point(p,vec3(5.0,-2.5,-10.0),1.0,1.5, lam);
    v = Blend(v, Asteroidbelt(p, vec3(5.0,-2.5,-10.0), 1.5, normalize(vec3(0.71, 0.71, 0.0)), 
                              0.3, 1.0, 1.0, 1.3, 0.0, lam2)); // No audio reaction here
    lam = max(lam, lam2);
    return v;
}

//Binary planets
float Binary(vec3 p, out float lam)
{
    float lam2 = 0.0;
    float v = point(p,vec3(7.0, 0.0,6.0),1.0,1.5, lam);
    v = Blend(v,point(p,vec3(7.0, 1.0,4.0),1.0,1.5, lam2));
    lam = max(lam, lam2);
    v = Blend(v,Asteroidbelt(p, vec3(7.0, 1.0, 4.0), 1.5, normalize(vec3(-0.19, .98, 0.0)), 
                              0.4, 1.0, 1.0, 1.3, 0.0, lam2)); // No audio reaction here
    lam = max(lam, lam2); 
    return v;
}

//Blob
float Blob(vec3 p, out float lam)
{
    float lam2 = 0.0;
    float v = point(p,vec3(0.0, 5.0,-1.0),1.0,1.5, lam);
    v = Blend(v, point(p,vec3(0.0, 5.5,-1.0),0.8,0.5, lam2));
    lam = max(lam, lam2);
    v = Blend(v, point(p,vec3(0.0, 5.2,-2.0),0.8,0.5, lam2));
    lam = max(lam, lam2);
    return v;
}

//Scene - (Updated signature)
float Scene(vec3 p, float audio_amp, float audio_mid, float audio_low, out float lam)
{
    float lam2;
	float v_astar = AsteroStar(p, audio_amp, lam);
    float v_abelt = MegaBelt(p, audio_low, lam2); // Pass audio_low
    lam = max(lam, lam2);
    float v_saturn = Saturn(p, audio_mid, lam2); // Pass audio_mid
    lam = max(lam, lam2);
    float v_loner = Loner(p, lam2);
    lam = max(lam, lam2);
    float v_binary = Binary(p, lam2);
    lam = max(lam, lam2);
    float v_blob = Blob(p, lam2);
    lam = max(lam, lam2);
    
    float v = Union(v_astar, v_abelt);
    v = Union(v, v_saturn);
    v = Union(v, v_loner);
    v = Union(v, v_binary);
    v = Union(v, v_blob);
    return v;
}

// Potential field of the object - (Added Audio Calculation)
// p : point
// lam : pseudo-calculated lambda
float object(vec3 p, out float lam)
{
    p.z=-p.z;
    lam = 1.0;

    // --- Audio Calculation ---
    // 1. Low Frequencies (Used for Star pulse and Belt rotation speed)
    float audio_low = (FFT(1) + FFT(4) + FFT(8) + FFT(12)) * 0.25;
    audio_low = clamp(audio_low, 0.0, 1.0);
    // audio_amp is the base + pulse range for sizing/energy
    float audio_amp = 0.5 + audio_low * 1.5; // Range: [0.5, 2.0]
    
    // 2. Mid Frequency (Used for Saturn ring flatness)
    float audio_mid = FFT(20) * 10.0;
    audio_mid = clamp(audio_mid, 0.5, 5.0); // Range: [0.5, 5.0]
    // -------------------------

    // Call Scene with audio variables
	float v = Scene(p, audio_amp, audio_mid, audio_low, lam);
    return v-T;
}

// Calculate object normal
// p : point
vec3 ObjectNormal(in vec3 p )
{
  float eps = 0.001;
  vec3 n;
  float l;
  float v = object(p, l);
  n.x = object( vec3(p.x+eps, p.y, p.z), l ) - v;
  n.y = object( vec3(p.x, p.y+eps, p.z), l ) - v;
  n.z = object( vec3(p.x, p.y, p.z+eps), l ) - v;
  return normalize(n);
}

// Trace ray using ray marching
// o : ray origin
// u : ray direction
// h : hit
// s : Number of steps
float Trace(vec3 o, vec3 u, out bool h,out int s)
{
  h = false;
    // Don't start at the origin, instead move a little bit forward
    float t=rA;
    float l;

  for(int i=0; i<Steps; i++)
  {
    s=i;
    vec3 p = o+t*u;
    float v = object(p, l);
    // Hit object
      if (v > 0.0)
      {
          s=i;
          h = true;
          break;
      }
      // Move along ray
      t += Epsilon;
      // Escape marched far away
      if (t>rB)
      {
          break;
      }
  }
  return t;
}

// Trace ray using ray marching
// o : ray origin
// u : ray direction
// h : hit
// s : Number of steps
float SphereTrace(vec3 o, vec3 u, out bool h,out int s, out float lam)
{
  h = false;
	lam = 1.0;
    // Don't start at the origin, instead move a little bit forward
    float t=rA;
	float l;
    
  for(int i=0; i<Steps; i++)
  {
    s=i;
    vec3 p = o+t*u;
    float v = object(p, l);
    // Hit object
      if (v > 0.0)
      {
          s=i;
          h = true;
          lam = l;
          break;
      }
      // Move along ray
      //t += max(Epsilon,abs(v)/4.0);
      // Move along the ray but faster
      t += max(Epsilon,abs(v)/l);
      // Escape marched far away
      if (t>rB)
      {
          break;
      }
  }
  return t;
}

// Background color
vec3 background(vec3 rd)
{
    //return vec3(0, 0, 0);
  return mix(vec3(0.4, 0.3, 0.0), vec3(0.7, 0.8, 1.0), rd.y*0.5+0.5);
}

// Shading and lighting
// p : point,
// n : normal at point
vec3 Shade(vec3 p, vec3 n)
{
  // point light
  //const vec3 lightPos = vec3(5.0, 5.0, 5.0);
  const vec3 lightPos = vec3(0.0, 0.0, 0.0);
  const vec3 lightColor = vec3(0.5, 0.5, 0.5);

  vec3 c = 0.25*background(-n);
  vec3 l = normalize(lightPos - p);

  // Not even Phong shading, use weighted cosine instead for smooth transitions
  float diff = 0.5*(1.0+dot(-n, l));

  c += diff*lightColor;
  
  return c;
}

// cosine based palette, 4 vec3 params
vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.283185*(c*t+d) );
}

// Shading with number of steps
vec3 ShadeSteps(int n)
{
   float t=float(n)/(float(Steps-1));
   t+=.3; //shift the base color
   t+=snd/1.015;
   return palette(t,
                   vec3(0.4, 0.4, 0.6), // a: Base/Average color (shifted slightly blue/magenta)
                   vec3(0.6, 0.45, 0.7), // b: Amplitude (Reduced Green from 0.9 to 0.45)
                   vec3(0.6, 0.8, 0.7),  // c: Frequency
                   vec3(0.5, 0.1, 0.0)   // d: Phase shift
                 )*0.75;

}


float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    snd*=1.6;
  vec2 pixel = (gl_FragCoord.xy / iResolution.xy)*2.0-1.0;
	//pixel*=2.0;
  // compute ray origin and direction
  float asp = iResolution.x / iResolution.y;
  vec3 rd = normalize(vec3(asp*pixel.x, pixel.y, -4.0));
  vec3 ro = vec3(0.0, 0.0, 25.0);

  // vec2 mouse = iMouse.xy / iResolution.xy;
  float a=3.14;
  // Uncomment to have the scene rotation
  a=iTime*0.25;
  ro = rotateY(ro, a);
  rd = rotateY(rd, a);

  // Trace ray
  bool hit;

  // Number of steps
  int s;
  float lam;
  float t = SphereTrace(ro, rd, hit,s, lam);
  vec3 pos=ro+t*rd;
  // Shade background
  vec3 rgb = background(rd);

  if (hit)
  {
    // Compute normal
    vec3 n = ObjectNormal(pos);

    // Shade object with light
    rgb = Shade(pos, n);
    if (length(pos) < 6.0) // Nur wenn der Treffer innerhalb des AsteroStar-Radius liegt (~6.0)
    {
        rgb += AsteroStarColor(pos);
    }
    // Shade object with "lambda"
    // rgb = vec3(1.0/lam, 1.0/lam, 1.0/lam);
  }
  else
  {
    float audio_high = (FFT(100) + FFT(120) + FFT(140)) / 3.0;
      audio_high = clamp(audio_high, 0.0, 1.0);
      float density_shift = 0.005 * audio_high;
      float star_threshold = 0.9985 - density_shift;
      float star = rand(pixel);  
      
      if(star > star_threshold) 
          rgb = vec3(1, 1, 1);
      else
          rgb = vec3(0, 0, 0);
  }

  // Add step shading to have a cool dusty effect
  rgb += ShadeSteps(s);
  //rgb*=palette(asp+FFT(25));
  fragColor=vec4(rgb, 1.0);
}
void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}