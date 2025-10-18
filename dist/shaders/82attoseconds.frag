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

#define T texture(iChannel0, uv
#define W vec2

#define BLOOM

#define time iTime
    float alpha;
#define res iResolution
vec4
     bloom = vec4(0),
     blur = vec4(0);

#define GA 2.399
mat2 rot = mat2(cos(GA),sin(GA),-sin(GA),cos(GA));
vec3 pixel=vec3(.001*8./6.,.001, 0) * .05;


float intensity(vec4 col) {
	return dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
}

// 	simplyfied version of Dave Hoskins blur
void dof(sampler2D tex, vec2 uv, float rad, vec4 org)
{
	vec2 angle=vec2(0,rad);
    rad=1.;
    float bc = 1.;
	for (int j=0;j<60;j++)
    {
        rad += 1./rad;
	    angle*=rot;

        vec4 col=texture(tex,uv+pixel.xy*(rad-1.)*angle);
        if (intensity(col) > .8) {
			bloom += col;
            //bc++;
        }
        blur += col;
	}
	blur /= 96.;
    //bloom /= bc;
}

//-------------------------------------------------------------------------------------------
void mainImage(out vec4 fragColor,in vec2 fragCoord)
{
	vec2 uv = gl_FragCoord.xy / res.xy;

    vec4 orgColor = (
        texture(iChannel0,uv)
    	+ (texture(iChannel0,uv + pixel.xz)
        	+ texture(iChannel0,uv + pixel.zx)
        	+ texture(iChannel0,uv - pixel.xz)
        	+ texture(iChannel0,uv - pixel.zx)
         ) * .25
    ) / 2.,

    oo = orgColor;

    alpha = texture(iChannel0,uv).a;

    dof(iChannel0,uv, 40., orgColor);

    #ifdef BLOOM

    orgColor += bloom * 0.03;
    #endif


    orgColor = mix(
        orgColor,
        blur,
        clamp(
        	min(1., 1. - pow(abs(alpha - .6) * 2., 2.)),
            0.,
            1.
        )
    );


    orgColor = mix(
        orgColor,
        blur.bgra,
        clamp(
        	min(1., pow(length(uv -.5) * 1.4, 2.)),
            0.,
            1.
        )
    );

 	//fragColor = oo;
    fragColor = orgColor;
}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
