#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform sampler2D iChannel0; // expects BufferA output
uniform sampler2D iAudioData;

varying vec2 vUv;

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

void main() {
  vec2 uv = vUv;
  vec2 px = 1.0 / iResolution.xy;
  vec3 c = texture2D(iChannel0, uv).rgb * 0.4+FFT(px.y);
  c += texture2D(iChannel0, uv + vec2(px.x, 0.0)).rgb * 0.15;
  c += texture2D(iChannel0, uv + vec2(-px.x, 0.0)).rgb * 0.15;
  c += texture2D(iChannel0, uv + vec2(0.0, px.y)).rgb * 0.15;
  c += texture2D(iChannel0, uv + vec2(0.0, -px.y)).rgb * 0.15;
  gl_FragColor = vec4(c, 1.0);
}
