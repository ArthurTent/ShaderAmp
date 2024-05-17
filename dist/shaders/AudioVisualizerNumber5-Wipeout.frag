// https://www.shadertoy.com/view/ddXfzf
// Modified by ArthurTent
// Created by kishimisu
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
/* "Audio Visualizer #5 - Wipeout" by @kishimisu (2023) - https://www.shadertoy.com/view/ddXfzf

   Playing with both linear and radial repetition around the z-axis in
   a raymarched 3D scene

   Sountrack from the amazing Wipeout Fusion game (PS2)
*/

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define rot(a) mat2(cos(a + vec4(0,33,11,0)))
#define rep(p, r) mod(p+r, r+r) - r

float b(vec3 q, vec3 b) { // box sdf
    return length(max(q = abs(q) - b,0.)) + min(max(q.x,max(q.y,q.z)),0.);
}

float h(vec2 p) { // 2->1 noise
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

/* Audio-related functions */
#define level(x) (texelFetch(iAudioData, ivec2(int(x*512.), 0), 0).r)
#define pitch(f) logisticAmp(level(pow(2., f) * .02175))
#define logX(x,a,c) (1./(exp(-a*(x-c))+1.))
float logisticAmp(float amp){
   float c = 1.-smoothstep(6.,0.,iAmplifiedTime)*.3, a = 15.;
   return (logX(amp, a, c) - logX(0., a, c)) / (logX(1., a, c) - logX(0., a, c));
}
float getVol(float samples) {
    float avg = 25.;
    for (float i = 0.; i < samples; i++) avg += level(i/samples);
    return avg / samples;
}

void main() {
    vec2  R = iResolution.xy;
    vec2 F =  vUv;
    //vec2 R = -1.0 + 2.0* vUv;
    //vec2 u = (F+F-R)/R.y * rot(-iAmplifiedTime*.15);
    vec2 u = (-1.0 + 2.0*vUv) * rot(-iAmplifiedTime*.15);
    vec3  p, q, id;
    float i = 0., t = 0., d, f, v = getVol(8.);

    for (gl_FragColor *= i; max(i,t) < 60.; i++) {

        q = p = t * normalize(vec3(u*rot(t*sin(iAmplifiedTime*.15)*.04),1));
        p.z += iAmplifiedTime*3. + v;

        id.z = floor(p.z+.5);
        p.z  = rep(p.z, .5);

        p.yx *= rot(round(atan(p.y, p.x) / .393) * .393);

        id.x = floor((p.x+.2)/.2);
        p.x  = rep(p.x+.1, .1);

        t += d = max(b(p, vec3(.02 + length(q.xy)*.02)), 1.-length(q.xy));

        f = pitch(h(vec2(id.x + id.z*.05))*2.-1.);
        gl_FragColor += pow(f,1.5) * abs(v-id.x*.004) * .04 / (.8 + abs(d))
             * (1. + cos(f*1. + t*.25 + iAmplifiedTime + vec4(0,1,2,0)));
    }
}