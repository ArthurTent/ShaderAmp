// https://www.shadertoy.com/view/ttXczX
// Modified by ArthurTent
// Created by coposuke
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;

#define PI (3.14159265357989)
#define TAU (PI * 2.0)


vec3 hsv2rgb(vec3 c)
{
	return c.b * ((clamp( abs( fract(c.r + vec3(0,2,1) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0) - 1.0) * c.g + 1.0);
}

void mainImage(  vec4 fragColor,  vec2 fragCoord )
{
    vec2 uvSound = fragCoord.xy / iResolution.xy;
	vec2 uv = (fragCoord.xy * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);
    //uv = -2.+4.*vUv;

    vec2 uvCircle = vec2(
    	(atan(-uv.y, -uv.x) + PI) / TAU,
    	length(uv) * 1.5
    );

    const float CircleOffset = -0.5;
    const float CircleLevel = 5.5;
    float circleType = floor(uvCircle.y * CircleLevel + CircleOffset);

    int colorType = 0;
    float colorDepth = 0.0;

    if (circleType < 20.0)
    {
        for(float i=0.0; i<6.0; i++)
        {
            if(circleType - i < 9.0)
            {
                // Map the full circle to lower frequencies (0-0.5) since higher frequencies are usually quiet
                // Use modulo to create a mirrored pattern: 0->0.5->0 as we go around the circle
                float freq = abs(uvCircle.x * 2.0 - 1.0) * 0.5;
                vec2 fftUV = vec2(freq, 0.0);
                float fft1 = texture( iAudioData, fftUV ).x;
                float fft2 = texture( iAudioData, vec2(0.5 - freq, 0.0) ).x;
                float fft = fract(uvCircle.y * CircleLevel + CircleOffset);
                if( fft + i < fft1 * fft2 * mix(1.0, 50.0, (circleType - i) / 20.0) )
                {
                    colorType = int(circleType) - int(i);
                    colorDepth = smoothstep(0.0, 1.0, fft + i);
                }
            }
        }
    }


	vec3 col = vec3(0);

    float t = PI * float(colorType) / 20.0 + fract(iTime * 0.1);
    col += float(1 < colorType && colorType < 10) * hsv2rgb(vec3(fract(t), 1.75 - colorDepth, colorDepth));

    if(uvCircle.y < 0.5)
    {
    	col = mix(col, vec3(0.2, 0.16, 0.15), smoothstep(0.3, 0.45, uvCircle.y) * smoothstep(0.5, 0.45, uvCircle.y));
    }

    float wave = texture( iAudioData, vec2(uvSound.x * 0.5, 0.0) ).x;
	col += smoothstep(0.002, 0.001, abs(uvSound.y - wave)) * vec3(1.0, 1.0, 0.0);

	gl_FragColor = vec4( col, 1.0 );
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
