// https://www.shadertoy.com/view/43dGDn
// Modified by ArthurTent
// Created by ArthurTent
// License: MIT
// https://opensource.org/license/mit

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
// The MIT License
// Copyright © 2024 by ArthurTent

// Based on Heart - distance 2D from Inigo Quilez https://www.shadertoy.com/view/3tyBzV

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// Distance to 45 degree heart shape, with only two square roots
// (or 1, if the GPU supports actual branching)

// List of some other 2D distances: https://www.shadertoy.com/playlist/MXdSRf
//
// and iquilezles.org/articles/distfunctions2d


float dot2( in vec2 v ) { return dot(v,v); }
float v = 0.;


float sdHeart( in vec2 p )
{
    p.x = abs(p.x);

    if( p.y+p.x>1.0 )
        return sqrt(dot2(p-vec2(0.25,0.75))) - sqrt(2.0)/4.0;
    float result = sqrt(min(dot2(p-vec2(0.00,1.00)),
                    dot2(p-0.5*max(p.x+p.y,0.0)))) * sign(p.x-p.y);
    return result;
}

float circlef(in vec2 p, vec2 center, float radius)
{
    p.x = abs(p.x);
    return distance(p, center)-radius;
}

void main( )
{
    vec2 fragCoord = vUv * iResolution;
    // normalized pixel coordinates
    vec2 p = (fragCoord*2.0-iResolution.xy)/iResolution.y;
    v  = texture( iAudioData, vec2(1/510,0.25) ).x;
    /*
    float red  = texture( iAudioData, vec2(1/510,0.25) ).x;
    float grn  = texture( iAudioData, vec2(0.5,0.5) ).x;
    float blu  = texture( iAudioData, vec2(0.75,0.5) ).x;
    */
    p.y += 0.45;

    p*= (.5+v*1.5);
    float d = sdHeart(p)*(.005+v);

    float theta = atan(p.y, p.x);

    vec3 col = (d>0.0) ? vec3(0.9,0.6-v,0.3) : vec3(0.65,0.85-v,1.0);

    vec2 circCenter = vec2(0.0, -0.55);
    float circRadius = 0.15*(1.-v);

    p/= (.5+v*1.5);

    p.y -=0.25;

    float circ = circlef(p, circCenter, circRadius);
    col *= 1.0 - exp(-6.0*abs(circ));
	col *= 1.0 + 0.2*cos(128.0*abs(circ));
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.01,abs(circ)) );

    col *= 1.0 - exp(-6.0*abs(d));
	col *= 1.0 + 0.2*cos(128.0*abs(d));
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.01,abs(d)) );

   // output
	gl_FragColor = vec4(col, 1.0);
}