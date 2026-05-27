#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;


/*
    "Waveform" by @XorDev

    I wish Soundcloud worked on ShaderToy again
*/
void mainImage(out vec4 O, vec2 I)
{
    //Raymarch iterator, step distance, depth and reflection
    float i, d, z, r;
    //Clear fragcolor and raymarch 90 steps
    for(O*= i; i++<9e1;
    //Pick color and attenuate
    O += (cos(z*.5+iTime+vec4(0,2,4,3))+1.3)/d/z)
    {
        //Raymarch sample point
        vec3 R = iResolution.xyy,
         p = z * normalize(vec3(I+I,0) - R);
        //Shift camera and get reflection coordinates
        r = max(-++p, 0.).y;
        //Mirror and music
        p.y += r+r-4.*texture(iChannel0, vec2((p.x+6.5)/15.,(-p.z-3.)*5e1/R.y)).r;
        //Step forward (reflections are softer)
        z += d = .1*(.1*r+abs(p.y)/(1.+r+r+r*r) + max(d=p.z+3.,-d*.1));
    }
    //Tanh tonemapping
    O = tanh(O/9e2);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
