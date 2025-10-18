#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iChannel1; // overlay texture

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 base = texture2D(iChannel0, uv).rgb;
  vec3 overlay = texture2D(iChannel1, uv).rgb;
  //vec3 tint = 0.9 + 0.1 * cos(vec3(0.0, 2.0, 4.0) + iTime);
  vec3 tint = 0.9 + 0.1 + cos(vec3(0.0, 2.0, 4.0) + iTime);
  vec3 col = base * tint * (0.8 + 0.2 * overlay);
  gl_FragColor = vec4(col, 1.0);
}
