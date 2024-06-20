// https://www.shadertoy.com/view/Dt33RS
// Modified by ArthurTent
// Created by kishimisu
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
/* "Disco Godrays" by @kishimisu (2023) - https://www.shadertoy.com/view/Dt33RS
   [68 chars shorter thanks to the amazing shadertoy community!]

   These are "fake" godrays made without tracing any additional ray.
   The maximum raymarching step size is set to 0.1 in order to sample the scene
   frequently (very inneficient) and some blue noise is added to reduce artefacts.
*/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// copied from QuantumSuper
#define getDat(addr) texelFetch( iAudioData, ivec2(addr,0), 0).x


#define M(p) p *= mat2(cos(round((atan(p.x,p.y)+k)/.3)*.3-k + vec4(0,33,11,0)));//
#define S cos( k - t + vec4(0,.5,1,0)) * smoothstep( 1., 0.//
#define L length(p

void main() {
    //vec2 F = gl_FragCoord.xy;
    vec2 uv = vUv;
    vec2 F = uv * iResolution;
    float i = .0, t = i, d=.3, k = iTime*d, l;
    for ( gl_FragColor *= i;
          i++ < 60. && d > .01;
          t -= d = min(max(l,-d), .1 + texture(iChannel0, F/1024.).r*.06) )
    {
        vec3 R = vec3(iResolution,1.),
        p = R-vec3(F+F,R.y);
        p = t/L)*p-2./R;
        M(p.zx) M(p.yx)
        gl_FragColor +=  S, (d = L.yz) -.05) / .02)
            * S,  l = L)    - 1.*getDat(i)       ) + .002;
    }
    gl_FragColor *= exp(t*.1);
}

/* Original version [483 chars]

#define r(p) mat2(cos(round((atan(p.y,p.x)+k)/f)*f-k + vec4(0,33,11,0)))

void mainImage(out vec4 O, vec2 F) {
    float i = 0., f = .2856, d = f, k = iTime*f, t;
    vec4  p, a = O *= t = i;

    for (vec2 R = iResolution.xy; i++ < 6e1 && d > .01;
        p = t*normalize(vec4((F+F-R)/R.y, 1, 0))) {
        p.z -= 2.;
        p.zx *= r(p.xz);
        p.yx *= r(p.xy);

        a += smoothstep(.02, .0, length(p.yz) - .05) *
             smoothstep( 1., .0, length(p)    -  1.) *
             (1. + cos(k+k + t+t + vec4(0,1,2,0)));

        t += d = min(max(length(p) - 1., .05 - length(p.yz)),
                 .1 + texture(iChannel0, F/1024.).r*.06);
    }

    O = .5*mix(O+.3, a, exp(-t*.1));
}*/