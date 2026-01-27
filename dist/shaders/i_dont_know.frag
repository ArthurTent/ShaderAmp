// https://www.shadertoy.com/view/43KBRK
// Created by xbvuno
// Modified by Arthur Tent
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


/*  This is the coordinate system i use :D

           ^ 0.5
           |
           |      0.5
   --------+------->
   -0.5    |      
           |     
      -0.5 v        
    
*/
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float iSampleRate=48000.;
vec2 setup_st(in vec2 coord, in vec2 res){
    vec2 st = coord / res - 0.5;
    st.x *= res.x / res.y;
    return st;
}

void draw_axis(vec2 st, vec3 color) {
    const float WEIGHT = 0.002;
    if (abs(st.x) < WEIGHT || abs(st.y) < WEIGHT) {
        color = (0.5 - color);
    }
    
}

float sample_audio(in sampler2D audio, vec2 st) {
    const float INNER_MARGIN = - 0.01; // to hide the gap in the center
    const float SCALE = 0.2; // the lower the closer the high freq will be near the center

    return texture(audio, vec2(abs(st.x) * (1.0 - SCALE) - INNER_MARGIN, 0.0)).x;
}

vec3 plot(vec2 st, vec3 color, vec2 fn) {
    //const vec3 LINE_COLOR = vec3(1.000,0.817,0.000);
    vec3 LINE_COLOR = vec3(.5+FFT(50)*2.,FFT(1)*2.,FFT(25)*2.);
    //vec3 LINE_COLOR = vec3(1.);
    const float LINE_WEIGHT = 0.02;
    
    float dist = 1.0 - distance(fn, st);
    float line = step(1.0 - LINE_WEIGHT, dist);
    return color * (1.0 - line) + line * LINE_COLOR;
}

float fn(float x,float freq, float amp, vec2 offset) {
    return cos(x * freq + offset.x) * amp + offset.y;
}


float draw_mouse(vec2 st, vec2 ms) {
    float dist = 1.0 - distance(st, ms);
    return step(0.99, dist);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord ) {
    vec2 st = setup_st(fragCoord, iResolution.xy);
    
    vec2 ms = setup_st(iMouse.xy, iResolution.xy);
    //vec2 ms = setup_st(iResolution.xy*2., iResolution.xy);
    
    float freq = ms.y * 2. * iSampleRate;
    float amp = sample_audio(iAudioData, st * (1. -  ms.x)) * 0.4;
    vec2 offset = vec2(iTime ,0.);
    
    float y = fn(st.x, freq, amp, offset);
    
    
    vec3 color = vec3(0.);
    color = plot(st, color, vec2(st.x, y));
    //color += draw_mouse(st, ms);
    //draw_axis(st, color);
    fragColor = vec4(color,1.0);
}
void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}

