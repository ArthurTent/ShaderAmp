// https://www.shadertoy.com/view/wttXz8
// Modified by ArthurTent
// Created by liamegan
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
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

const int octaves = 6;



vec2 random2(vec2 st){
  vec2 t = vec2(texture(iAudioData, st/1023.).x, texture(iAudioData, st/1023.+.5).x);
  return t*t*4.;
}

// Value Noise by Inigo Quilez - iq/2013
// https://www.shadertoy.com/view/lsf3WH
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    vec2 u = f*f*(3.0-2.0*f);

    return mix( mix( dot( random2(i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random2(i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random2(i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random2(i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}

float fbm1(in vec2 _st) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  // Rotate to reduce axial bias
  mat2 rot = mat2(cos(0.5), sin(0.5),
                  -sin(0.5), cos(0.50));
  for (int i = 0; i < octaves; ++i) {
      v += a * noise(_st);
      _st = rot * _st * 2.0 + shift;
      a *= 0.4;
  }
  return v;
}

float pattern(vec2 uv, float time, inout vec2 q, inout vec2 r) {

  q = vec2( fbm1( uv * .1 + vec2(0.0,0.0) ),
                 fbm1( uv + vec2(5.2,1.3) ) );

  r = vec2( fbm1( uv * .1 + 4.0*q + vec2(1.7 - time / 2.,9.2) ),
                 fbm1( uv + 4.0*q + vec2(8.3 - time / 2.,2.8) ) );

  vec2 s = vec2( fbm1( uv + 5.0*r + vec2(21.7 - time / 2.,90.2) ),
                 fbm1( uv * .05 + 5.0*r + vec2(80.3 - time / 2.,20.8) ) ) * .25;

  return fbm1( uv * .05 + 4.0 * s );
}


vec2 getScreenSpace() {
    //vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.y, iResolution.x);
    return vUv;

}
void main(  )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = getScreenSpace();


      float time = iAmplifiedTime / 10.;

      mat2 rot = mat2(cos(time / 10.), sin(time / 10.),
                      -sin(time / 10.), cos(time / 10.));

      uv = rot * uv;
      uv *= 0.9 * (sin(time)) + 3.;
      uv.x -= time / 5.;

      vec2 q = vec2(0.,0.);
      vec2 r = vec2(0.,0.);

      float _pattern = 0.;


    _pattern = pattern(uv, time, q, r);

      vec3 colour = vec3(_pattern) * 2.;
      colour.r -= dot(q, r) * 15.;
      colour = mix(colour, vec3(pattern(r, time, q, r), dot(q, r) * 15., -0.1), .5);
      colour -= q.y * 1.5;
      colour = mix(colour, vec3(.2, .2, .2), (clamp(q.x, -1., 0.)) * 3.);

      gl_FragColor = vec4(-colour + (abs(colour) * 2.), 1./length(q));
}

/** SHADERDATA
{
	"title": "Domain Warped FBM noise",
	"description": "",
	"model": "person"
}
*/
