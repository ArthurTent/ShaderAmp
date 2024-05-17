// https://www.shadertoy.com/view/XlcXDX
// Modified by ArthurTent
// Created by s23b
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// Vinyl Visualizer by s23b
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;

varying vec2 vUv;

#define BARS 12.

#define PI 3.14159265359

// rotation transform
void tRotate(inout vec2 p, float angel) {
    float s = sin(angel), c = cos(angel);
	p *= mat2(c, -s, s, c);
}

// circle distance
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// union
float opU(float a, float b) {
    return min(a, b);
}

// substraction
float opS(float a, float b) {
    return max(a, -b);
}

// distance function of half of an ark
// parameters: inner radius, outer radius, angle
float sdArk(vec2 p, float ir, float or, float a) {
    
    // add outer circle
    float d = sdCircle(p, or);
        
    // substract inner circle
    d = opS(d, sdCircle(p, ir));
    
    // rotate with angle
    tRotate(p, -a * PI / 2.);
    
    // clip the top
    d = opS(d, -p.y);
    
    // add circle to the top
    d = opU(d, sdCircle(p - vec2((or + ir) / 2., 0.), (or - ir) / 2.));
    return d;
}

void main()
{
	//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;
    vec2 uv = -1.0 + 2.0 *vUv;
    
    // I wanted it to look good on my phone vertically :P
    //if (iResolution.x > iResolution.y) uv.x *= iResolution.x / iResolution.y; else uv.y *= iResolution.y / iResolution.x;
    
    // little white padding
    uv *= 1.05;
    
    // add circles
    float d = sdCircle(uv, 1.);
    d = opS(d, sdCircle(uv, .34));
    d = opU(d, sdCircle(uv, .04));
    
    // calculate position of the bars
    float barsStart = .37;
    float barsEnd = .94;
    float barId = floor((length(uv) -barsStart) / (barsEnd - barsStart) * BARS);
    
    // only go forward if we're in a bar
    if (barId >= 0. && barId < BARS) {
        
        float barWidth = (barsEnd - barsStart) / BARS;
        float barStart = barsStart + barWidth * (barId + .25);
        float barAngel = texture(iAudioData, vec2(1. - barId / BARS, .25)).x * .5;

        // add a little rotation to completely ruin the beautiful symmetry
        tRotate(uv, -barAngel * .2 * sin(barId + iAmplifiedTime));
        
        // mirror everything
    	uv = abs(uv);
        
        // add the bars
        d = opS(d, sdArk(uv, barStart, barStart + barWidth / 2., barAngel));
    }
    
    // use the slope to render the distance with antialiasing
    float w = min(fwidth(d), .01);
	gl_FragColor = vec4(vec3(smoothstep(-w, w, d)),1.0);
}
