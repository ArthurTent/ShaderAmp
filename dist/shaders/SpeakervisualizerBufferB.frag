// https://www.shadertoy.com/view/wsdXDN
// Modified by ShaderAmp Converter
// Created by jaszunio15
// Original Shader Name: Speaker visualizer - Buffer B
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;

varying vec2 vUv;


// === Common Code ===

#define PI 3.14
#define TIME (iTime * 0.2)
#define RAYMARCH_ITERATIONS 50
#define FAR_PLANE 10.0
#define LIGHT_DIRECTION normalize(vec3(0.3, 0.3, (sin(TIME) + 1.0) * 0.1 + 0.03))
#define AMBIENT_LIGHT 0.05

//uncoment to disable denoising
#define DENOISE
#define DENOISE_STRENGTH 0.4

float hash13(vec3 x)
{
 	return fract(sin(dot(x, vec3(131.4211, 152.3422, 162.9441))) * 231.421);   
}

// === End Common Code ===


#define FREQ_STEP (1.0 / 512.0)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    
    float freq = 0.0;
    for (float bandOffset = -FREQ_STEP * 3.0; bandOffset < FREQ_STEP * 3.1; bandOffset += FREQ_STEP)
    {
        freq += texture(iChannel0, vec2(bandOffset + uv.x, 0.0)).x;
    }
    freq /= 7.0;
    freq = freq;
    
    freq = freq * 0.5 + texture(iChannel1, vec2(uv.x, 0.0)).x * 0.5;
    
    float line = smoothstep(0.005, 0.0, abs((uv.y - mod(uv.y, FREQ_STEP)) - freq));
    
    fragColor = vec4(1.0, 0.0, 0.0, 0.0) * freq + vec4(0.0, 1.0, 0.0, 0.0) * line;
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
