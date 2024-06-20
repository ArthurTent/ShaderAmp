// https://www.shadertoy.com/view/wsSyDK
// Modified by ArthurTent
// Created by tornronim
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


const float epsilon = 0.001;
float fov = 90.0;

const vec3 ambientColour = vec3(0.15, 0.1, 0.2);
const vec3 lightPos = normalize(vec3(2, 1, -4));

float maxcomp(in vec3 p ) { return max(p.x,max(p.y,p.z));}
float sdBox( vec3 p, vec3 b )
{
  vec3  di = abs(p) - b;
  float mc = maxcomp(di);
  return min(mc,length(max(di,0.0)));
}

const mat3 ma = mat3( 0.60, 0.00,  0.80,
                      0.00, 1.00,  0.00,
                     -0.80, 0.00,  0.60 );


vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 palette(in float t) {
    return pal(t,
               vec3(0.2,0.4,0.5),
               vec3(0.5,0.5,0.5),
               vec3(1.0,0.7,0.4),
               vec3(0.0,0.15,0.20)
    );
}

float smootherSample(vec2 uv,float e)
{
	e*=3.0;
	return (
		 texture(iAudioData,uv-vec2(e*-0.5,0.0)).x
		+texture(iAudioData,uv-vec2(e*-0.4,0.0)).x
		+texture(iAudioData,uv-vec2(e*-0.3,0.0)).x
		+texture(iAudioData,uv-vec2(e*-0.2,0.0)).x
		+texture(iAudioData,uv-vec2(e*-0.1,0.0)).x
		+texture(iAudioData,uv-vec2(e*+0.0,0.0)).x
		+texture(iAudioData,uv-vec2(e*+0.1,0.0)).x
		+texture(iAudioData,uv-vec2(e*+0.2,0.0)).x
		+texture(iAudioData,uv-vec2(e*+0.3,0.0)).x
		+texture(iAudioData,uv-vec2(e*+0.4,0.0)).x
		+texture(iAudioData,uv-vec2(e*+0.5,0.0)).x
		)/11.0;
}

float getWaveformValue(float x, float mode,float e)
{
	return smootherSample(vec2(x,mode),e);
}

float getWaveformDeriv(float x, float mode, float e)
{
	return (smootherSample(vec2(x+e*0.5,mode),e)
		-smootherSample(vec2(x-e*0.5,mode),e))/e;
}

float getSmoothedWaveform(float t) {
    float a = getWaveformValue(t, 0.0, t);
    return a;
}


float fft(float u) {
    // first texture row is frequency data
    return texture( iAudioData, vec2(u,0.25) ).x;
}

float wave(float u) {
    // second texture row is the sound wave
	return texture( iAudioData, vec2(u,0.75) ).x;
}

vec3 opTwist( in vec3 p, in float k) {
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xy,p.z);
    return q;
}

vec3 repeatSpace(in vec3 p, out vec3 i) {
    vec3 c = vec3(4.0, 1.75, 4.0);
    vec3 t = mod(p+0.5*c, c)-0.5*c;
    i = abs(p+(0.5*c)) / c;
    return t;
}

vec3 shade(vec3 p, vec3 n)
{
    float shadow = 1.0;

    float t = 0.0;
    const int maxSteps = 128;


    return ambientColour + (shadow * vec3(max(0.0, dot(n, normalize(lightPos - p)))));
}

vec2 bounding_sphere( in vec4 sph, in vec3 ro, in vec3 rd ) {
    vec3 oc = ro - sph.xyz;

	float b = dot(oc,rd);
	float c = dot(oc,oc) - sph.w*sph.w;
    float h = b*b - c;

    if( h<0.0 ) return vec2(-1.0);

    h = sqrt( h );

    return -b + vec2(-h,h);
}

vec4 mandelbulb(in vec3 p) {
    vec3 w = p;
    float m = dot(w,w);

    vec3 i;
    repeatSpace(p, i);

    float trap = 1e10;
    float k = 1.0;
	float dz = 1.0;
    float power = 3.0 + mix(0.5, 6.0, getSmoothedWaveform(iTime * (length(i))));

	for(int i=0; i<64; i++) {
        dz = pow(sqrt(m), power-1.0) * (power-1.0) * dz + 1.0;

        float r = length(w);
        float b = power * acos( w.y/r);
        float a = power * atan( w.x, w.z );
        w = p + pow(r, power) * vec3( sin(b)*sin(a), cos(b), sin(b)*cos(a) );

        vec3 w2 = w;
        w2.y += (getSmoothedWaveform(iTime));
        trap = min(trap, dot(w2, w2) / (k * k));
        k *= 0.9;

        m = dot(w,w);
        if(m > 256.0) {
            break;
        }
    }

    return vec4(
        0.25*log(m)*sqrt(m)/dz,
        0.0,
        0.0,
        trap
    );
}

vec4 mandelbox(in vec3 p)
{
    float d = sdBox(p,vec3(1.0));
    vec4 res = vec4( d, 1.0, 0.0, 0.0 );

    float ani = smoothstep( -0.2, 0.2, -cos(0.5*iTime) );
	float off = 1.5*sin( 0.01*iTime );

    float s = 1.0;
    for(int m=0; m<4; m++ ) {
        p = mix( p, ma*(p+off), ani );

        vec3 a = mod( p*s, 2.0 )-1.0;
        s *= 3.0;
        vec3 r = abs(1.0 - 3.0*abs(a));
        float da = max(r.x,r.y);
        float db = max(r.y,r.z);
        float dc = max(r.z,r.x);
        float c = (min(da,min(db,dc))-1.0)/s;

        if( c>d )
        {
          d = c;
          res = vec4( d, min(res.y,0.2*da*db*dc), (1.0+float(m))/4.0, 0.0 );
        }
    }

    return res;
}

vec4 map(in vec3 p) {
    p = opTwist(p, 0.125);

    vec3 i;
    vec3 q = repeatSpace(p, i);

    return mandelbulb(q);
}

vec2 bounds(in vec3 ro, in vec3 rd) {
    return bounding_sphere(vec4(0.0,0.0,0.0,1.25), ro, rd);
}

float softshadow( in vec3 ro, in vec3 rd, float mint, float k ) {
    float res = 1.0;
    float t = mint;
	float h = 1.0;
    for( int i=0; i<32; i++ )
    {
        h = map(ro + rd*t).x;
        res = min( res, k*h/t );
		t += clamp( h, 0.005, 0.1 );
    }
    return clamp(res,0.0,1.0);
}

vec3 gradient(vec3 pos) {
    vec3  eps = vec3(.001,0.0,0.0);
    vec3 nor;
    nor.x = map(pos+eps.xyy).x - map(pos-eps.xyy).x;
    nor.y = map(pos+eps.yxy).x - map(pos-eps.yxy).x;
    nor.z = map(pos+eps.yyx).x - map(pos-eps.yyx).x;
    return normalize(nor);
}

vec4 intersect( in vec3 ro, in vec3 rd ) {
    float t = 0.0;
    const int maxSteps = 128;

    vec4 res = vec4(-1.0);

	vec4 hit = vec4(1.0);
    for(int i = 0; i < maxSteps; ++i)
    {
        vec3 p = ro + rd*t;

        if(hit.x<0.002 || t>10.0) {
            break;
        }

        hit = map(ro + rd*t);
        res = vec4(t, hit.yzw);
        t += hit.x;
    }
    if(t>10.0)
        res = vec4(-1.0);
    return res;
}

vec3 applyFog( in vec3  rgb,       // original color of the pixel
               in float distance,
               in vec3 rd) // camera to point distance
{
    float fogAmount = 1.0 - exp( -distance*0.25 );
    vec3  fogColor  = mix(ambientColour, palette(fft(rd.x)), 0.1);
    return mix( rgb, fogColor, fogAmount );
}

vec3 render( in vec3 ro, in vec3 rd ) {
    vec3 cd = vec3(0.0);
    vec3 pos = ro;

    vec4 tmat = intersect(ro, rd);
    if(tmat.x > 0.0) {
        pos = ro + tmat.x*rd;
        vec3 nor = gradient(pos);

        float occ = tmat.y;
		float sha = softshadow(pos, lightPos, 0.01, 64.0 );

        float diffuse = max(0.1 + 0.9*dot(nor, lightPos),0.0);
		float ambient = 0.5 + 0.5 * nor.y;
        float bac = max(0.4 + 0.6 * dot(nor, vec3(-lightPos.x, lightPos.y, -lightPos.z)),0.0);
        float trap = tmat.w;

        //vec3 lin = vec3(0.0);
        vec3 surface = vec3(0.0);
        //surface += vec3(1.00 * diffuse * sha);
        surface += 0.10 * ambient * occ;
        surface += 0.10 * bac * (0.5+0.5 * occ);

        vec3 emission = palette(1.0 - trap);

        cd = mix(surface, emission, abs(trap));
    }
    cd = applyFog(cd, distance(pos, vec3(0.0)), rd);

	return cd;
}

void main( ) {
    vec3 ro = 1.0 * vec3(
        2.5 * cos(0.25*iTime),
        1.0 + 1.0 * atan(iTime*.13),
        2.5 * sin(0.25*iTime)
    );
    //vec2 p = (2.0 * fragCoord-iResolution.xy)/iResolution.y;
    vec2 p = (2.0 * vUv - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
    vec3 ww = normalize(vec3(0.0) - ro);
    vec3 uu = normalize(cross( vec3(0.0,1.0,0.0), ww ));
    vec3 vv = normalize(cross(ww,uu));
    vec3 rd = normalize( p.x*uu + p.y*vv + 2.5*ww );
    vec3 col = render(ro, rd);

    //vec2 uv = fragCoord.xy / iResolution.xy;
    //float t = uv.x;
    //vec3 col = vec3(getWaveformValue(t, 0.0, t*0.1));

    gl_FragColor = vec4(col, 1.0);
}