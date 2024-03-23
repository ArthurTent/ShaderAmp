// https://www.shadertoy.com/view/dtl3Dr
// Modified by ArthurTent
// Created by kishimisu
// License Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.
// https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en
/* "3D Audio Visualizer" by @kishimisu - 2022 (https://www.shadertoy.com/view/dtl3Dr)

    This work is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en)

    Wait for the drop!

   The lights of this scene react live to the audio input.
   I'm trying to find interesting ways to extract audio
   features from the audio's FFT to animate my scenes.
   
   Each light is associated to a random frequency range,
   ranging from bass (distant lights) to high (close lights)   
   
   Really happy with this result!
*/
uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;

varying vec2 vUv;

#define st(t1, t2, v1, v2) mix(v1, v2, smoothstep(t1, t2, iGlobalTime))
#define light(d, att) 1. / (1.+pow(abs(d*att), 1.3))

/* Audio-related functions */
#define getLevel(x) (texelFetch(iAudioData, ivec2(int(x*512.), 0), 0).r)
#define logX(x,a,c) (1./(exp(-a*(x-c))+1.))

float logisticAmp(float amp){
   float c = st(0., 10., .8, 1.), a = 20.;  
   return (logX(amp, a, c) - logX(0.0, a, c)) / (logX(1.0, a, c) - logX(0.0, a, c));
}
float getPitch(float freq, float octave){
   freq = pow(2., freq)   * 261.;
   freq = pow(2., octave) * freq / 12000.;
   return logisticAmp(getLevel(freq));
}
float getVol(float samples) {
    float avg = 0.;
    for (float i = 0.; i < samples; i++) avg += getLevel(i/samples);
    return avg / samples;
}
/* ----------------------- */

float sdBox( vec3 p, vec3 b ) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}
float hash13(vec3 p3) {
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    //vec2 uv   = (2.*fragCoord-iResolution.xy)/iResolution.y;
    vec2 uv = -1.0 + 2.0 *vUv;

    vec3 col  = vec3(0.);
    float vol = getVol(8.);
    
    float hasSound = 1.; // Used only to avoid a black preview image
    if (iGlobalTime <= 0.) hasSound = .0;
 
    for (float i = 0., t = 0.; i < 30.; i++) {
        vec3 p  = t*normalize(vec3(uv, 1.));        
        
        vec3 id = floor(abs(p));
        vec3 q  = fract(p)-.5;
        
        float boxRep = sdBox(q, vec3(.3));
        float boxCtn = sdBox(p, vec3(7.5, 6.5, 16.5));

        float dst = max(boxRep, abs(boxCtn) - vol*.2);     
        float freq = smoothstep(16., 0., id.z)*3.*hasSound + hash13(id)*1.5;
       
        col += vec3(.8,.6,1) * (cos(id*.4 + vec3(0,1,2) + iGlobalTime) + 2.) 
             * light(dst, 10. - vol) 
             * getPitch(freq, 1.);
        
        t += dst;
    }
    
    gl_FragColor = vec4(col,1.0);   
}