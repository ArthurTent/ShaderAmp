// https://www.shadertoy.com/view/4Xt3RX
// Created by timmaffett
// Based on Rigel Mystic Flower
// https://www.shadertoy.com/view/XsjBRt 
// Modified by Arthur Tent
// License Creative Commons Attribution-NonCommercial-ShareAlike 4.0 Unported License.
// https://creativecommons.org/licenses/by/4.0/
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
// Author: Rigel
// Shader: Mystic Flower
// licence: https://creativecommons.org/licenses/by/4.0/

#define PI 3.141592653589793
#define TWO_PI 6.283185307179586
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;

// radom number in 2d
float hash(vec2 p) {
  return fract(sin(dot(p,vec2(12.9898,78.2333)))*43758.5453123);
}

// noise in 2d
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix( mix( hash( i + vec2(0.0,0.0) ), hash( i + vec2(1.0,0.0) ), u.x),
                mix( hash( i + vec2(0.0,1.0) ), hash( i + vec2(1.0,1.0) ), u.x), u.y);
}

// fractal noise in 2d
float fbm ( vec2 p ) {
    const mat2 m = mat2(0.8,0.6,-0.6,0.8);
    float f = 0.0;
    f += 0.5000*noise ( p ); p*=m*2.02;
    f += 0.2500*noise ( p ); p*=m*2.04;
    f += 0.1250*noise ( p ); p*=m*2.03;
    f += 0.0650*noise ( p ); p*=m*2.01;

    // normalize f;
    f /= 0.9375;
    return f;
}

// generates a palette with a cosine
// from https://www.shadertoy.com/view/ll2GD3
vec3 pal(float domain, vec3 frequency, vec3 phase) {
  return vec3(0.5) + vec3(0.5) * cos(TWO_PI*(frequency*domain+phase));
}

void mainImage(out vec4 light, in vec2 space)	{
  // cordinate system from -2 to 2
  vec2 p = (-0.5 + (space.xy / iResolution.xy)) * vec2(4.0);
  int max_freq = 100;
  for(int i=1; i < max_freq; i++){
      snd +=FFT(i)*float(i);
  }
  snd /=float(max_freq*20);

  // aspect ratio
  p.x *= iResolution.x / iResolution.y;

  // angle and radius to center 0,0
  float a = atan( p.y, abs(p.x) );
  float r = length(p);
  r/=1.+snd/4.;

  float mouseX = (iMouse.x>0.) ? (iMouse.x-iResolution.x)/iResolution.x : 1.;  // add mouseX in as 0.5 - +0.5 term to allow interactivity
  //float mouseX = (iMouse.x>0.) ? iMouse.x/iResolution.x : 1.;  // add mouseX in as 0.0 - 1.0 term to allow interactivity
  //mouseX *=snd;
  mouseX+=sin(iAmplifiedTime/40.);
  // space distortion
  p += vec2(fbm(vec2(a*2.+mouseX*iAmplifiedTime*.1,r*.4-iAmplifiedTime*.3)))*5.0;
  // divide the space into cells and get cell index to seed the palette
  float cidx = (floor(p.x+2.0) + (floor(p.y+2.0)*4.0)) / 16.0;
  // color is from palette with cell index
  vec3 color = pal(fbm(p*.5)*(1.+snd), vec3(1.0), vec3(0.4+cidx,0.2+cidx,0.0));

  // draw a grid for the cells
  color *= smoothstep(0.49,0.44, abs(fract(p.x)-0.5));
  color *= smoothstep(0.49,0.44, abs(fract(p.y)-0.5));

  // angular distortion
  a += fbm(p*0.05);
  // flower white petals
  float f = abs(cos(a*9.)*sin(a*6.))*.7+.1;
  float ff = smoothstep(f,f+0.05,r);
  color = ff * color + (1.0-ff) * vec3(0.9,0.9,0.7) * (1.8-r);

  // flower center
  color = mix(color,vec3(1.,1.-r*3.,0.0),smoothstep(0.26,0.1+fbm(vec2(r+iAmplifiedTime,a-iAmplifiedTime))*0.06 ,r));
  /*
  color.r=1.-color.r;
  color.g=1.-color.g;
  color.b=1.-color.b;
  */
  light = vec4(color,1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
