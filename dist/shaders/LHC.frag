#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iChannel1; // overlay texture

varying vec2 vUv;

// Large Hedron Collider visualizer by Orblivius
// Email: orblivius@protonmail.com
//
// Sources: https://www.shadertoy.com/view/w3fcRN
// XoR good work and I take it to the next level =)

const mat4 bayerMatrix = mat4(
    0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
    12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
    3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
    15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
);
void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
     vec3 c = texture(iChannel0, fragCoord.xy/iResolution.xy).rgb;

    vec2 texelSize = 1.0 / iResolution.xy;

    // Mix stronger with blur

    int x = int(mod(fragCoord.x, 4.0));
    int y = int(mod(fragCoord.y, 4.0));
    float dither = bayerMatrix[x][y] / 16.0 - 0.5;

    // Apply dithering scaled appropriately
   c += vec3(dither * 0.05);


    vec3 blur = c;
    float total = 0.0;

    for(float i = -2.; i <= 2.; i++) {
        for(float j = -2.; j <= 2.; j++) {
            float weight = exp(-(i*i + j*j) * 0.25);
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            blur += texture(iChannel0, fragCoord/iResolution.xy + offset).rgb * weight;
            total += weight;
        }
    }
    blur /= total;
    c = (c + blur) * 0.5; //mix(c, blur, 0.5); // Increase blend amount

	fragColor = vec4(c, 1.);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
