// https://www.shadertoy.com/view/wsdXDN
// Modified by ShaderAmp Converter
// Created by jaszunio15
// Original Shader Name: Speaker visualizer
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


// Shader License: CC BY 3.0
// Author: Jan Mróz (jaszunio15) 

/*
	Thanks to Inigo Quilez, I leant a lot about SDF's from his articles:
	https://iquilezles.org/articles/distfunctions
	https://iquilezles.org/articles/smin
*/


float colorBrightness(vec3 col)
{
	return col.r + col.b + col.g;
}

vec2 uvFromCoord(vec2 coord)
{
	return coord / iResolution.xy;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
#ifdef DENOISE
    vec4 colors[9];
    int operationIndex = 0;
    float operationBrightness = 0.0;
    int beginIndex = 0;
    int endIndex = 8;
    
    float minBrightness = 10.0;
    int minIndex = 0;
    float maxBrightness = 0.0;
    int maxIndex = -1;
    
    for (float y = -1.0; y <= 1.0; y++)
    {
     	for (float x = -1.0; x <= 1.0; x++)
        {
            colors[operationIndex].xyz = texture(iChannel0, uvFromCoord(fragCoord + vec2(x,y))).xyz;
            colors[operationIndex].w = colorBrightness(colors[operationIndex].xyz);
            operationIndex++;
        }
    }
    
    for (int i = 0; i < 4; i++)
    {
        minBrightness = 10.0;
    	maxBrightness = 0.0;
        minIndex = -1;
        maxIndex = -1;
    	for (int j = i; j < 9-i; j++)
        {
			vec4 col = colors[j];
            if (col.w < minBrightness)
            {
             	minBrightness = col.w;
                minIndex = j;
            }
            
            if (col.w > maxBrightness)
            {
             	maxBrightness = col.w;
                maxIndex = j;
            }
        }
        
        vec4 p = colors[beginIndex];
        colors[beginIndex] = colors[minIndex];
        colors[minIndex] = p;
        
        p = colors[endIndex];
        colors[endIndex] = colors[maxIndex];
        colors[maxIndex] = p;
        
        beginIndex++;
        endIndex--;
    }

    vec4 col = (colors[4] * DENOISE_STRENGTH + texture(iChannel0, uv) * (1.0 - DENOISE_STRENGTH));
#else
    vec4 col = texture(iChannel0, uv);
#endif
    col = smoothstep(-0.05, 0.8, sqrt(col));
    fragColor = col;
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
