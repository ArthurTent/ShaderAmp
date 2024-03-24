// https://www.shadertoy.com/view/wtyfzV
// Modified by ArthurTent - Removed the Radar because the Matrix background was so nice
// Created by willis
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
#define PI 3.141592
#define TAU 6.283184
#define S(a, b, t) smoothstep(a, b, t)
#define saturate2(a) clamp(a, 0., 1.)
#define BASECOLOR vec3(0.01, 0.98, 0.03)


float HASH21(vec2 p){
    float n = fract(sin(p.x * 67.972) * 457.11 * sin(p.y * 487.31) * 735.24);
    n += dot(p, p + 137.45);
    return fract(n);
}

vec2 HASH22(vec2 p){
    float n = HASH21(p);
    return vec2(n, HASH21(p+n));
}

void main()
{
        vec2 uv = (vUv - 0.5) * 2.0;
    vec2 oriUV = uv;
    
    float fft1 = texelFetch(iAudioData, ivec2(0., 1.), 0).x ;
    fft1 *= S(14.8, 15., iGlobalTime);
    
    uv *= (fft1 * 0.02 + 0.35) * 3.1;
    
    vec3 col = vec3(0);
    float t = iGlobalTime * -0.2;

    float d = length(uv);
    float a = atan(uv.x, uv.y);

    vec3 outline = S(0.01, .003, abs(d-0.5)) * BASECOLOR ;
    
    vec2 gv = fract(uv * 3.)-.5;
    vec2 id = floor(uv * 3.);
    
    vec2 n = (HASH22(id) - .5) * t  * 2.;
    vec2 p = (sin(n+t*2.) * 0.4) * 0.5 - gv;
    
    float sparkle = 0.01 / dot(p, p);
    sparkle *= sin(t * 10. + p.y) * .5 + .5;

    oriUV *= 32.;
    oriUV.y += HASH21(floor(oriUV)) * t * 10. * S(14.5, 15., iGlobalTime);;
    
    gv = fract(oriUV) / 16.;
    id = floor(oriUV) ;
    
    vec2 randGV = gv + floor(HASH22(id) * 16. + t)/16.;
    
    float fft2 = texelFetch(iAudioData, ivec2(0.7, 0.), 0).x ;
    
    float text = texture(iChannel0, randGV).r;
    
    text *= fft2;

    col +=  text * BASECOLOR; 

    gl_FragColor = vec4(col,1.0);
}