// https://www.shadertoy.com/view/4XKGRw
// Modified by ArthurTent
// Created by ArthurTent
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform vec2 iResolution;
varying vec2 vUv;

// Fork of LTT Logo by ChutneyPot: https://www.shadertoy.com/view/WsKfDz
// mixed with Radiant Music Visualiser by TekF: https://www.shadertoy.com/view/4sVBWy

// LTT Logo, December 2020
// by ChutneyPot
// https://www.shadertoy.com/view/WsKfDz
// reference: https://upload.wikimedia.org/wikipedia/commons/7/77/2018_Linus_Tech_Tips_logo.svg
//--------------------------------------------------------------------------
#define BLUR 5.0 / iResolution.y
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
#define PI            3.141592654
#define ROT(a)        mat2(cos(a), sin(a), -sin(a), cos(a))
#define TIME          iTime
#define RESOLUTION    iResolution

// https://stackoverflow.com/questions/15095909/from-rgb-to-hsv-in-opengl-glsl
const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}
// Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))


const vec3  grid_color    = HSV2RGB(vec3(0.6, 0.3, 1.0));
const vec3  light0_color  = 16.0*HSV2RGB(vec3(0.6, 0.5, 1.0));
const vec3  light1_color  = 8.0*HSV2RGB(vec3(0.9, 0.25, 1.0));
const vec3  sky0_color    = HSV2RGB(vec3(0.05, 0.65, -0.25));
const vec3  sky1_color    = HSV2RGB(vec3(0.6, 0.5, 0.25));
const vec3  light0_pos    = vec3(1.0, 5.0, 4.0);
const vec3  light1_pos    = vec3(3.0, -1.0, -8.0);
const vec3  light0_dir    = normalize(light0_pos);
const vec3  light1_dir    = normalize(light1_pos);
const vec4  planet_sph    = vec4(50.0*normalize(light1_dir+vec3(0.025, -0.025, 0.0)), 10.0);

// fft + ffts by QuantumSuper
vec4 fft, ffts; //compressed frequency amplitudes
void compressFft(){ //v1.2, compress sound in iAudioData to simplified amplitude estimations by frequency-range
    fft = vec4(0), ffts = vec4(0);

    // Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)
    for (int n=0;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 0-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(3,8,8,5); ffts /= vec4(2,3,3,23); //normalize
    //for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //workaround for VirtualDJ, ?any hints for reverting audio limiters appreciated
}


vec3 RGB(vec2 uv)
{
    //vec3 result = 0.5 + 0.5 * cos(iTime*4. + uv.xyx + vec3(0,2,4));
    //vec3 result = 0.5 + 0.5 * cos(iTime*4. + uv.xyy + vec3(0,2,4));
    //vec3 result = 0.5 + 0.5 * cos(iTime*4. + uv.xyy * vec3(ffts.x, 2.*ffts.w, 4.*fft.y));
    vec3 result = 0.5 + 0.5  + uv.xyy * vec3(ffts.x, 2.*ffts.w, 4.*fft.y);
    result.x*=fft.x;
    result.y*=fft.y;
    result.z*=fft.z;
    return result;
    //return 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0,2,4));
}

vec2 rotate(vec2 uv, float deg)
{
    float angle = radians(deg);
    vec2 rot = uv * mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
    return rot;
}

float rect(vec2 uv, vec2 leftBot, vec2 rightTop)
{
    vec2 lb = smoothstep(leftBot, leftBot - BLUR, uv);
    vec2 rt = smoothstep(rightTop, rightTop - BLUR, uv);
    vec2 dim = rt - lb;

    return (min(dim.x, dim.y));
}

void main()
{
    compressFft();
    vec2 fragCoord = vUv * iResolution;
  	vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    //uv =rotate(uv,sin(iTime*10.));
    //uv =rotate(uv,iTime*50.);

    float circle = length(uv);
   	float outer = smoothstep(1.0, 1.0 - BLUR, circle);
    float inner = smoothstep(0.9, 0.9 - BLUR, circle);
    float ring =  outer - inner;

   	float l1 = rect(uv, vec2(-0.65, -0.9), vec2(-0.4, 0.83));
    float l2 = rect(rotate(uv, 20.0), vec2(-0.66, -0.63), vec2(0.2, -0.38));
    float l3 = rect(uv, vec2(-0.5, -0.82), vec2(0.32, -0.29));
    float l = max(l1, min(l2, l3));

    float t11 = rect(uv, vec2(-0.14, -0.38), vec2(0.11, 0.48));
    float t12 = rect(rotate(uv, 20.0), vec2(-0.3, 0.4), vec2(0.82, 0.65));
    float t13 = rect(uv, vec2(-0.32, 0.3), vec2(0.7, 0.86));
    float t14 = rect(rotate(uv, 20.0), vec2(-0.26, -0.3), vec2(0.28, 0.6));
    float t1 = max(min(t11, t14), min(t12, t13));

    float t21 = rect(uv, vec2(0.39, -0.82), vec2(0.64, 0.15));
    float t22 = rect(rotate(uv, 20.0), vec2(0.15, -0.12), vec2(0.91, 0.13));
    float t23 = rect(uv, vec2(0.193, -0.23), vec2(0.9, 0.45));
	float t2 = max(t21, min(t22, t23));

    float lt = max(l, t1);
    float ltt = max(lt, t2);

    vec3 col = vec3(max(min(outer, ltt), ring));


    //float bg = mix(0.0, 1.0, (sin(iTime * 0.5) + 1.0) / 2.0);
    float bg = 0.;
    col = mix(vec3(bg), RGB(uv), col);


    l = length(uv)/length(iResolution.xy/iResolution.y);
    float a = atan(uv.x,uv.y)+iTime;
    float s = texture(iAudioData,vec2(abs(fract(5.*a/6.283)*2.-1.),.75)).r;

    float A = .4;
    float B = .45;
    /*
    if ( iMouse.z > 0. )
    {
        A = iMouse.x / iResolution.x; // strength of chromatic dispersion
        B = iMouse.y / iResolution.y; // strength of waveform
    }
    */
    A *= A; // apply a curve so mouse movements feel better
    B *= B;

    gl_FragColor.r = texture(iAudioData,vec2(pow(mix(mix(l,.0,A),    s ,B),2.),.25)).r;
    gl_FragColor.g = texture(iAudioData,vec2(pow(mix(mix(l,.5,A),(1.-s),B),2.),.25)).r;
    gl_FragColor.b = texture(iAudioData,vec2(pow(mix(mix(l,1.,A),    s ,B),2.),.25)).r;

    // tweak the contrast
    gl_FragColor.rgb = smoothstep(.05,1.,gl_FragColor.rgb+.2*l);
    gl_FragColor.rgb = pow( gl_FragColor.rgb, vec3(2) );

    gl_FragColor.a = 1.;


    gl_FragColor *= vec4(col, 1.0);
}