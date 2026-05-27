// https://www.shadertoy.com/view/w3sGR7
// Modified by ArthurTent
// Created by bombblob
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define FC fragCoord
#define O fragColor
#define R iResolution
#define PI 3.14159
#define F(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)


mat2 rot(float t){return mat2(cos(t),-sin(t),sin(t),cos(t));}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv=(FC-.5*R.xy)/R.y;
	float t=iAmplifiedTime;
	vec2 sv=sin(uv*rot(t*.5+sin(t*.25)*.2)*PI*3.-PI/2.)+sin(t*.5)*.5+F(1);
	float a=atan(uv.x,uv.y);
	//vec3 col=vec3(1.-sv.x*sv.y,(sv.x+sv.y)/2.,1.-max(sv.x,sv.y))*sin(length(uv)*PI*40.-t*3.+sin(a*32.-t*5.)+a*4.)*(1.+F((sv.x+sv.y)/2.)*5.);
	vec3 col=vec3(1.-sv.x*sv.y,(sv.x+sv.y)/2.,1.-max(sv.x,sv.y))*sin(length(uv)*PI*40.-t*3.+sin(a*32.-t*5.)+a*4.)*(1.+F((sv.x+sv.y)/2.)*2.);
	float pat= cos(a*8.+sin(atan(sv.x,sv.y)*2.*F(atan(sv.x,sv.y)*20.))*(sin(t*.5)+1.)+t*4.+length(uv)*sin(a*8.)*15.);
	col*=pat;
	O=vec4(col,1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
