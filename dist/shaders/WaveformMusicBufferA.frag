
#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform float iTimeDelta;
uniform sampler2D iChannel0; // expects BufferA output
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform vec4 iMouse;
//uniform vec2 iFrame;
varying vec2 vUv;
float snd = 0.;


void mainImage(out vec4 O, vec2 I)
{
    vec2 r = iResolution.xy;
    O = (I.y-=r.y/6e2)>1.?texture(iChannel0,I/r):texture(iAudioData,I/r);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
