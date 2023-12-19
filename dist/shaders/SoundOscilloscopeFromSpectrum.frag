// https://www.shadertoy.com/view/Ws2GWD
// Sound Oscilloscope from spectrum by jaszunio15
//Shader License: CC BY 3.0
//Author: Jan Mróz (jaszunio15)

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define LINE_WIDTH 10.6

//Precision of one band from 0 to 1
//#define PRECISION 0.25
#define PRECISION 0.35

//Number of bands
#define BANDS_COUNT 64.0

//From 0 to 1
#define HIGH_FREQ_APPERANCE 0.7

#define AMPLITUDE 4.0

float hash(in float v)
{
 	return fract(sin(v * 124.14518) * 2123.14121) - 0.5;
}

float getBand(in float freq)
{
 	return pow(texture(iAudioData, vec2(freq, 0.0)).r, (2.0 - HIGH_FREQ_APPERANCE));   
}


float getSmoothBand(float band, float iterations, float bandStep)
{
 	float sum = 0.0;
    for(float i = 0.0; i < iterations; i++)
    {
        sum += getBand(band + i * bandStep);
    }
    sum = smoothstep(0.2, 1.0, sum / iterations);
    return sum * sum;
}

float getOsc(float x)
{
    x *= 1000.0;
 	float osc = 0.0;
    for (float i = 1.0; i <= BANDS_COUNT; i++)
    {
     	float freq = i / BANDS_COUNT;
        freq *= freq;
        float h = hash(i);
        osc += getSmoothBand(freq, (512.0 / BANDS_COUNT) * PRECISION, ((1.0 / PRECISION) / 512.0)) 
            	* sin( freq * (x + iTime * 500.0 * h));
    }
    osc /= float(BANDS_COUNT);
    
    return osc;
}

void main() 
{
  	//vec2 res = iResolution.xy;
    vec2 res = iResolution.xy;
    //vec2 uv = (2.0 * fragCoord - res) / res.x;
    vec2 uv = -1.0 + 2.0 *vUv +.5;
    uv.y -= 0.5;
    uv.x += iGlobalTime * 0.5;// + 1.5 * hash(iGlobalTime);
    
    //float ps = 1.0 / min(res.x, res.y);
    float ps = 1.0 / min(iResolution.x, iResolution.y);
    
    
    float osc1 = getOsc(uv.x) * AMPLITUDE;
    
    float tgAlpha = clamp(fwidth(osc1) * res.x * 0.5, 0.0, 8.0);
    float verticalThickness = abs(uv.y - osc1) / sqrt(tgAlpha * tgAlpha + 2.0);
    
    float line = 1.0 - smoothstep(0.0, ps * LINE_WIDTH, verticalThickness);
    line = smoothstep(0.0, 0.5, line);
    
    float blur = (1.0 - smoothstep(0.0, ps * LINE_WIDTH * 32.0, verticalThickness * 4.0)) * 0.2;
    
    gl_FragColor = vec4(line + blur);
    //gl_FragColor += pow(max(gl_FragColor - .2, 0.0), vec4(1.4))*vec4(sin(iGlobalTime), cos(iGlobalTime), 1., 1.);
    gl_FragColor += pow(max(gl_FragColor - .4, 0.15), vec4(1.4))*vec4(vec3(0.5-(cos(iGlobalTime)+sin(iGlobalTime)), sin(iGlobalTime)*.5, cos(iGlobalTime)*5.),1.);
}