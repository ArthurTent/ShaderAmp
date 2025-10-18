#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;
/*

 MAGFest 2018 remote entry.
 http://super.magfest.org/guest2018/demoscene-at-magfest-2018/

 music: https://soundcloud.com/noisia/noisia-raw-synth-demosong-exiled



 http://bit.ly/shadertoy-plugin
*/

const vec3 W = vec3(0.2125, 0.7154, 0.0721);

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord/iResolution.xy;

    vec4
        buff = texture(iChannel0, uv),
    	mipm = textureLod(iChannel0, uv, 4.);

    float dof = buff.a;

    // fake dof
	fragColor = mix(buff, mipm, min(1., dof * 18.));

    // fake bloom
    vec4 bm = dot(mipm.rgb, W) >
        dot(buff.rgb, W) ? mipm : buff;

    fragColor += pow(bm * dot(bm.rgb, W) * 3., vec4(1.2)) * .6;

    // contrast
    fragColor = pow(fragColor, vec4(1.15));
}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
