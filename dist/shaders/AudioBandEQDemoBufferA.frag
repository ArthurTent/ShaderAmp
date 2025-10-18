#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

/**

    License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License

    Revisiting one of my audio shaders now that I have a better grasp of FFT and sampling
    audio in shaders

    this song take a second to start - if no audio, stop, rewind, play..

    Audio Band EQ Demo
    08/27/2025  @byt3_m3chanic

*/


#define R           iResolution
#define T           iTime
#define M           iMouse

#define PI          3.14159265
#define PI2         6.28318530

#define MIN_DIST 1e-3
#define MAX_DIST 40.

#define fftSize     64.

//globals
vec3 s_hit, g_hit;
vec2 s_id, g_id;
float s_fc, g_fc;


//scales for all things
const float scale = 1./4.;
const float scale_h = scale*.5;
const vec2 s = vec2(scale)*2.;

//positions and rotations
const vec2 pos = vec2(.5,-.5);
const vec2[4] ps4 = vec2[4](pos.yx,pos.xx,pos.xy,pos.yy);

float hash21(vec2 p) {
    return fract(sin(dot(p,vec2(26.37,45.93)))*4374.23);
}

mat2 rot(float a){
    return mat2(cos(a),sin(a),-sin(a),cos(a));
}

vec3 hue(float t) {
    return .45 + .35*cos(PI2*t*(vec3(1.,.85,.75)+vec3(.9,.7,.2)));
}


float cap( vec3 p, float h, float r ) {
  vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(r,h);
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float getFFT(float bin) {
  float x = bin / fftSize;
  return texture(iAudioData, vec2(x, 0.0)).r;
}

float getEQ(int eqId) {
  int bandSize = int(fftSize) / 32;
  int startBin = eqId * bandSize;

  float sum = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i < bandSize) {
      sum += getFFT(float(startBin + i));
    }
  }
  return sum / float(bandSize);
}

// block map -v4 tap technique from @Shane
vec2 map(vec3 q3){
    vec2 res = vec2(1e5,0.);
    vec2 p,ip,id = vec2(0),ct = vec2(0);

    float t=1e5, y=1e5, m=1.;

    for(int i =0; i<4; i++) {

        ct = ps4[i]/2. -  ps4[0]/2.;
        p = q3.xz - ct*s;
        ip = floor(p/s) + .5;
        p -= (ip)*s;
        vec2 idi = (ip + ct)*s;

        vec3 q = vec3(p.x,q3.y,p.y);

        float id = length(idi)*5.;
        float fc = getEQ(int(id));

        float tw = fc;
        float b = cap(q-vec3(0,tw,0),tw,scale*.4)-.005;

        if(b<t ) {
            t = b;
            m = 1.;
            s_id = idi;
            s_fc = fc;
            s_hit = q+(idi.xyx*vec3(.25)+float(i));
        }
    }

	if(t<res.x) res = vec2(t,m);

    float f = q3.y+.25;
    if (f<res.x) {
        res = vec2(f,2.);
        s_hit = q3;
    }

    return res;
}

vec3 normal(vec3 p, float t) {
    float e = MIN_DIST*t;
    vec2 h =vec2(1,-1)*.5773;
    vec3 n = h.xyy * map(p+h.xyy*e).x+
             h.yyx * map(p+h.yyx*e).x+
             h.yxy * map(p+h.yxy*e).x+
             h.xxx * map(p+h.xxx*e).x;
    return normalize(n);
}


void mainImage( out vec4 fragColor, in vec2 F )
{

    vec2 uv = (2.*F.xy-R.xy)/max(R.x,R.y);

    vec3 ro = vec3(0,0,7.+2.5*sin(T*.2));
    vec3 rd = normalize(vec3(uv, -1));
    float rtl = floor(mod(T,20.)) > 10. ? -1.32 : -.82;
    // mouse //
    /*
    float x = M.xy==vec2(0) || M.z<0. ? 0. : -(M.y/R.y*.2-.1)*PI;
    float y = M.xy==vec2(0) || M.z<0. ? 0. : -(M.x/R.x*1.-.5)*PI;

    mat2 rx =rot(rtl-x), ry =rot(-(T*.07)-y);
    */
    mat2 rx =rot(rtl), ry =rot(-(T*.07));

    ro.zy*=rx, ro.xz*=ry;
    rd.zy*=rx, rd.xz*=ry;

    vec3 C = vec3(0), ref = vec3(0), fil = vec3(1);

    float d = 0.,m = 0.;
    vec3 p = ro;

    for(int i=0;i<128;i++) {
        p = ro + rd * d;
        vec2 ray = map(p);
        if(ray.x<MIN_DIST*d||d>MAX_DIST)break;
        d += i<32?ray.x*.25:ray.x;
        m  = ray.y;
    }

    g_id=s_id;
    g_fc=s_fc;

    if(d<MAX_DIST)
    {
        vec3 n = normal(p,d);
        vec3 lpos =  vec3(5,10,-5);
        vec3 l = normalize(lpos-p);

        float diff = clamp(dot(n,l),0.,1.);

        float shdw = 1.;
        for( float t=.01;t<10.; ) {
            float h = map(p + l*t).x;
            if( h<MIN_DIST ) { shdw = 0.; break; }
            shdw = min(shdw, 32.*h/t);
            t += h;
            if( shdw<MIN_DIST || t>16. ) break;
        }

        diff = mix(diff,diff*shdw,.75);

        float spec = .75 * pow(max(dot(normalize(p-ro),reflect(normalize(lpos),n)),0.),24.);
        vec3 h = vec3(.001);
        if(m==1.) {
           float hs= hash21(g_id+floor(T*g_fc))*.1;
            h = hue(1.-(g_fc+hs));
            ref = h;
        }

        C = h * diff+spec;

        ro = p+n*.001;
        rd = reflect(rd,n);
    }

    C = mix(vec3(.025),C,  exp(-.0015*d*d*d));
    //C = pow(C, vec3(.4545));
    fragColor = vec4(C,1);
}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
