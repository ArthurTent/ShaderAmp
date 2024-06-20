// https://www.shadertoy.com/view/llXGRX
// Modified by ArthurTent
// Created by dnnkeeper
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

float v  = 0.;
float red  = 0.;
float grn  = 0.;
float blu  = 0.;


const int _VolumeSteps = 40;
const float _StepSize = 0.08;
const float _Density = 0.1;

const float _SphereRadius = 1.75;
const float _NoiseFreq = 1.0;
const float _NoiseAmp = 3.0;
const float _PulseAmp = 0.05;
const float _PulseFreq = 3.0;
const float _WaveLength = 0.8;
const float _WaveStr = 0.5;
const vec3 _NoiseAnim = vec3(-0.50, -1.0, 0.0);

// iq's nice integer-less noise function

// matrix to rotate the noise octaves
mat3 m = mat3( 0.00,  0.80,  0.60,
              -0.80,  0.36, -0.48,
              -0.60, -0.48,  0.64 );

float hash( float n )
{
    return fract(sin(n)*43758.5453);
}


float sqlen(in vec3 p)
{
    return (p.x*p.x+p.y*p.y+p.z*p.z);
}

float Heart(in vec3 p)
{
    p = vec3(p.z,p.y,p.x)*(0.5+v);
    float h=p.x*p.x+p.y*p.y+2.0*p.z*p.z-1.0,pyyy=p.y*p.y*p.y;
    //float v=h*h*h-(p.x*p.x-0.1*p.z*p.z)*pyyy;//the messed up bit
    float v=h*h*h-(p.x*p.x)*pyyy;//the messed up bit

    vec3 g=vec3(6.0*p.x*h*h-2.0*p.x*pyyy,
                    6.0*p.y*h*h-3.0*p.x*p.x*p.y*p.y-0.3*p.z*p.z*p.y*p.y,
                    12.0*p.z*h*h-0.2*p.z*pyyy);


    /*float pulse = (sin(iTime*_PulseFreq)-1.0)*4.0;
	pulse = pow(8.0,pulse);

    return 5.0*(v/length(g)+pulse*_PulseAmp);
    */
    return 5.*(v/length(g));
}

float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);

    f = f*f*(3.0-2.0*f);

    float n = p.x + p.y*57.0 + 113.0*p.z;

    float res = mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
                        mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
                    mix(mix( hash(n+113.0), hash(n+114.0),f.x),
                        mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
    return res;
}

float fbm( vec3 p )
{
    float f;
    f = 0.5000*noise( p ); p = m*p*2.02;
    f += 0.2500*noise( p ); p = m*p*2.03;
    f += 0.1250*noise( p ); p = m*p*2.01;
    f += 0.0625*noise( p );
    //p = m*p*2.02; f += 0.03125*abs(noise( p ));
    return f;
}

// returns signed distance to surface
float distanceFunc(vec3 p)
{
	float d = sqlen(p) - _SphereRadius;	// distance to sphere
    d = min(d, sin(d*_WaveLength-iTime*_PulseFreq)+_WaveStr);
	//d += min(d,Heart(p));
	// offset distance with pyroclastic noise
	//p = normalize(p) * _SphereRadius;	// project noise point to sphere surface
	d += fbm(p*_NoiseFreq + _NoiseAnim*iTime) * _NoiseAmp;
    d = min(d,Heart(p));
	return d;
}

// color gradient
// this should be in a 1D texture really
vec4 gradient(float x)
{
	// no constant array initializers allowed in GLES SL!
	const vec4 c0 = vec4(2, 2, 1, 1);	// yellow
	const vec4 c1 = vec4(1, 0, 0, 1);	// red
	const vec4 c2 = vec4(0, 0, 0, 0); 	// black
	const vec4 c3 = vec4(0, 0.5, 1, 0.5); 	// blue
	const vec4 c4 = vec4(0, 0, 0, 0); 	// black

	x = clamp(x, 0.0, 0.999);
	float t = fract(x*4.0);
	vec4 c;
	if (x < 0.25) {
		c =  mix(c0, c1, t);
	} else if (x < 0.5) {
		c = mix(c1, c2, t);
	} else if (x < 0.75) {
		c = mix(c2, c3, t);
	} else {
		c = mix(c3, c4, t);
	}
	//return vec4(x);
	//return vec4(t);
	return c;
}

// shade a point based on distance
vec4 shade(float d)
{
	// lookup in color gradient
	return gradient(d);
	//return mix(vec4(1, 1, 1, 1), vec4(0, 0, 0, 0), smoothstep(1.0, 1.1, d));
}

// procedural volume
// maps position to color
vec4 volumeFunc(vec3 p)
{
	float d = distanceFunc(p)*v;
	return shade(d);
}

// ray march volume from front to back
// returns color
vec4 rayMarch(vec3 rayOrigin, vec3 rayStep, out vec3 pos)
{
	vec4 sum = vec4(0, 0, 0, 0);
	pos = rayOrigin;
	for(int i=0; i<_VolumeSteps; i++) {
		vec4 col = volumeFunc(pos);
        col.r *= red;
        col.g *= grn;
        col.b *= blu;
		col.a *= _Density;
		//col.a = min(col.a, 1.0);

		// pre-multiply alpha
		col.rgb *= col.a;
		sum = sum + col*(1.0 - sum.a);
#if 0
		// exit early if opaque
        	if (sum.a > 1.0)
            		break;
#endif
		pos += rayStep;
	}
	return sum;
}

void main()
{
    v  = texture( iAudioData, vec2(1/510,0.25) ).x;
    red  = texture( iAudioData, vec2(1/510,0.25) ).x;
    grn  = texture( iAudioData, vec2(0.5,0.5) ).x;
    blu  = texture( iAudioData, vec2(0.75,0.5) ).x;

    vec2 fragCoord = vUv * iResolution;
    vec2 p = (fragCoord.xy / iResolution.xy)*2.0-1.0;
    p.x *= iResolution.x/ iResolution.y;

    //float rotx = ( iMouse.y / iResolution.y)*4.0;
    //float roty = -(iMouse.x / iResolution.x)*4.0;
    float rotx = 0.;
    float roty = 0.;
    float zoom = 4.0;

    // camera
    vec3 ro = zoom*normalize(vec3(cos(roty), cos(rotx), sin(roty)));
    vec3 ww = normalize(vec3(0.0,0.0,0.0) - ro);
    vec3 uu = normalize(cross( vec3(0.0,1.0,0.0), ww ));
    vec3 vv = normalize(cross(ww,uu));
    vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );

    ro += rd*2.0;

    // volume render
    vec3 hitPos;
    vec4 col = rayMarch(ro, rd*_StepSize, hitPos);
    //vec4 col = gradient(p.x);

    gl_FragColor = col;
}
