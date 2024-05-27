// https://www.shadertoy.com/view/MXSXDt
// Modified by ArthurTent
// Created by Friend
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
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


#define R       iResolution
#define t       iTime
#define d(p,s)  (2. * p.xy - R.xy) / R.y * s
#define mod3_   vec3(.1031, .11369, .13787)

float hash3_1(vec3 p3) {
	p3  = fract(p3 * mod3_);
    p3 += dot(p3, p3.yzx + 19.19);
    return -1. + 2. * fract((p3.x + p3.y) * p3.z);
}

float vn3(vec3 p) {
    vec3 pi = floor(p);
    vec3 pf = p - pi;

    vec3 w = pf * pf * (3. - 2. * pf);

    return 	mix(
    	mix(
        	mix(hash3_1(pi + vec3(0, 0, 0)), hash3_1(pi + vec3(1, 0, 0)), w.x),
            mix(hash3_1(pi + vec3(0, 0, 1)), hash3_1(pi + vec3(1, 0, 1)), w.x),
  	    w.z),
        mix(
            mix(hash3_1(pi + vec3(0, 1, 0)), hash3_1(pi + vec3(1, 1, 0)), w.x),
            mix(hash3_1(pi + vec3(0, 1, 1)), hash3_1(pi + vec3(1, 1, 1)), w.x),
      	w.z),
	w.y);
}



vec3 gfb(vec2 ndc) {
    float bass   = 0.0;
    float mid    = 0.0;
    float treble = 0.0;

    // Loop over a set range of indices for each band to average their magnitudes
    int spb = 10;
    for (int i = 0; i < spb; i++) {
        bass += texelFetch(iAudioData, ivec2(i, 0), 0).x;          // Bass band (low frequencies)
        mid += texelFetch(iAudioData, ivec2(170 + i, 0), 0).x;     // Mid band (middle frequencies)
        treble += texelFetch(iAudioData, ivec2(340 + i, 0), 0).x;  // Treble band (high frequencies)
    }

    // Average the magnitudes for each band
    bass /= float(spb);
    mid /= float(spb);
    treble /= float(spb);

    return vec3(bass, mid, treble);
}

void main() {
    //vec2 p = d(vUv, 5.5);
    vec2 p = -6.0 + 2. *vUv * 6.;
    //vec2 ndc = i.xy / R.xy;
    vec2 ndc =vUv;
    vec3 bands = gfb(ndc);

    float vn1  = vn3(vec3(p-vec2(t), t));
    float vn2  = vn3(vec3(p*2., t*2.));
    float vn3_ = vn3(vec3(p*4., t*4.));
    float vn4  = vn3(vec3(-p*16., -t*16.));
    float vn   = .8*vn1 + .3*vn2 + .2*vn3_ + .1*vn4;

    float cd = abs(length(p) - (.5+3.*bands.x) + .5*vn);
    cd = smoothstep(0.55+bands.z, 0.01, cd);

    vec3 col = vec3(0.388,0.388,0.992);
    col += vn3(vec3(log(cd), vn, vn)) / length(p*.45);
    col.r += 3.*bands.y*log(vn+1.)*vn2;

    gl_FragColor = vec4(col, 1.);
}

