#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform sampler2D iChannel0;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
varying vec2 vUv;

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
void main() {
  vec2 uv = vUv;
  // Simple animated gradient mixed with optional texture
  vec3 tex = texture2D(iChannel0, uv).rgb;
  float a = 0.5 + 0.5 + sin(iTime + uv.x * 6.28318530718);
  vec3 col = mix(vec3(0.1+FFT(1), 0.2+FFT(25), 0.6+FFT(50)), vec3(0.9, 0.5, 0.2), 1.);
  col/=1.+FFT(uv.x);
  gl_FragColor = vec4(col * (0.6 + 0.4 * tex), 1.0);
}
