#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iChannel1; // expects BufferB output

uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

/**

    License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License

    Revisiting one of my audio shaders now that I have a better grasp of FFT and sampling
    audio in shaders

    Audio Band EQ Demo
    08/27/2025  @byt3_m3chanic

*/

#define R iResolution
#define COLOR(COORD) texture(iChannel1,(COORD))

void mainImage( out vec4 O, in vec2 F )
{

	vec2 uv = F.xy/R.xy;
    vec3 color = COLOR(uv).rgb;

    // effect sammple offset
    vec3 fgclr = vec3(0);
    float f = length(uv  - 1.4);
    fgclr.x = COLOR(uv - vec2(f*0.003,.001)).x;
    fgclr.y = COLOR(uv + vec2(f*0.001,-.002)).y;
    fgclr.z = COLOR(uv + vec2(f*0.003,.001)).z;

    // mask for effect
    float dt = distance(uv.xy,vec2(.495))*1.75;
    dt = smoothstep(.75,0.,dt);
    vec3 C = mix(fgclr,color,dt);

    // output & gamma
    O = vec4(pow(C, vec3(.4545)),1.);

}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
