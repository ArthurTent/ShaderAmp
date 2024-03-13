// https://www.shadertoy.com/view/7ldyzN
// Modified by ArthurTent
// Created by gurudevbk
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// Forked from "Pretty Hip" by Hadyn https://www.shadertoy.com/view/XsBfRW

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define freq(f) texture(iAudioData, vec2(f, 0.25)).x * 0.8


float avgFreq(float start, float end, float step) {
    float div = 0.0;
    float total = 0.0;
    for (float pos = start; pos < end; pos += step) {
        div += 1.0;
        total += freq(pos);
    }
    return total / div;
}

void main( )
{

    float bassFreq = pow(avgFreq(0.0, 0.1, 0.01), 0.85);
    float medFreq = pow(avgFreq(0.1, 0.6, 0.01), 0.85);
    float topFreq = pow(avgFreq(0.6, 1.0, 0.01), 0.85);

    float aspect = (iResolution.y/iResolution.x);
    float value;
	//vec2 uv = fragCoord.xy / iResolution.x;
    vec2 uv = vUv;
    uv -= vec2(0.5, 0.5*aspect);
    uv *= -0.01*iTime;

    float rot = radians(45.0); // radians(45.0*sin(medFreq*iTime));
    mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
   	uv  = m * uv;
    uv += vec2(0.5, 0.5*aspect);
    uv.y+=0.5*(1.0-aspect);
    vec2 pos = 10.0*uv;
    vec2 rep = fract(pos);
    float dist = 2.0*min(min(rep.x, 1.0-rep.x), min(rep.y, 1.0-rep.y));
    float squareDist = length((floor(pos)+vec2(0.5)) - vec2(5.0) );

    float edge = sin(medFreq+iTime-squareDist*0.5)*0.5+0.5;

    edge = (bassFreq+medFreq+sin(iTime)-squareDist*iTime*0.5)*0.3;
    edge += .2*medFreq;
    edge = 2.0*fract(edge*0.5);
    //value = 2.0*abs(dist-0.5);
    //value = pow(dist, 2.0);
    value = fract (dist*2.0);
    value = mix(value, 1.0-value, step(1.0, edge));
    //value *= 1.0-0.5*edge;
    edge = pow(abs(1.0-edge), 2.0);

    //edge = abs(1.0-edge);
    value = smoothstep( edge-0.05, edge, 0.95*value);


    value += squareDist*.1;
    gl_FragColor = vec4(value);
    gl_FragColor = mix(vec4(1.0,1.0,1.0,1.0),
                    vec4(0.5*value*topFreq,
                         0.5*medFreq,
                         .5*value*bassFreq,1.0),
                         value);
    //fragColor.a = 0.25*clamp(value, 0.0, 1.0);
}