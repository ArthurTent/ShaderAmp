// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var SoundOscilloscopeFromSpectrum_frag =
"// https://www.shadertoy.com/view/Ws2GWD\n"+
"// Sound Oscilloscope from spectrum by jaszunio15\n"+
"//Shader License: CC BY 3.0\n"+
"//Author: Jan Mróz (jaszunio15)\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform float iTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define LINE_WIDTH 10.6\n"+
"\n"+
"//Precision of one band from 0 to 1\n"+
"//#define PRECISION 0.25\n"+
"#define PRECISION 0.35\n"+
"\n"+
"//Number of bands\n"+
"#define BANDS_COUNT 64.0\n"+
"\n"+
"//From 0 to 1\n"+
"#define HIGH_FREQ_APPERANCE 0.7\n"+
"\n"+
"#define AMPLITUDE 4.0\n"+
"\n"+
"float hash(in float v)\n"+
"{\n"+
"return fract(sin(v * 124.14518) * 2123.14121) - 0.5;\n"+
"}\n"+
"\n"+
"float getBand(in float freq)\n"+
"{\n"+
"return pow(texture(iAudioData, vec2(freq, 0.0)).r, (2.0 - HIGH_FREQ_APPERANCE));\n"+
"}\n"+
"\n"+
"\n"+
"float getSmoothBand(float band, float iterations, float bandStep)\n"+
"{\n"+
"float sum = 0.0;\n"+
"for(float i = 0.0; i < iterations; i++)\n"+
"{\n"+
"sum += getBand(band + i * bandStep);\n"+
"}\n"+
"sum = smoothstep(0.2, 1.0, sum / iterations);\n"+
"return sum * sum;\n"+
"}\n"+
"\n"+
"float getOsc(float x)\n"+
"{\n"+
"x *= 1000.0;\n"+
"float osc = 0.0;\n"+
"for (float i = 1.0; i <= BANDS_COUNT; i++)\n"+
"{\n"+
"float freq = i / BANDS_COUNT;\n"+
"freq *= freq;\n"+
"float h = hash(i);\n"+
"osc += getSmoothBand(freq, (512.0 / BANDS_COUNT) * PRECISION, ((1.0 / PRECISION) / 512.0))\n"+
"* sin( freq * (x + iTime * 500.0 * h));\n"+
"}\n"+
"osc /= float(BANDS_COUNT);\n"+
"\n"+
"return osc;\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 res = iResolution.xy;\n"+
"vec2 res = iResolution.xy;\n"+
"//vec2 uv = (2.0 * fragCoord - res) / res.x;\n"+
"vec2 uv = -1.0 + 2.0 *vUv +.5;\n"+
"uv.y -= 0.5;\n"+
"uv.x += iGlobalTime * 0.5;// + 1.5 * hash(iGlobalTime);\n"+
"\n"+
"//float ps = 1.0 / min(res.x, res.y);\n"+
"float ps = 1.0 / min(iResolution.x, iResolution.y);\n"+
"\n"+
"\n"+
"float osc1 = getOsc(uv.x) * AMPLITUDE;\n"+
"\n"+
"float tgAlpha = clamp(fwidth(osc1) * res.x * 0.5, 0.0, 8.0);\n"+
"float verticalThickness = abs(uv.y - osc1) / sqrt(tgAlpha * tgAlpha + 2.0);\n"+
"\n"+
"float line = 1.0 - smoothstep(0.0, ps * LINE_WIDTH, verticalThickness);\n"+
"line = smoothstep(0.0, 0.5, line);\n"+
"\n"+
"float blur = (1.0 - smoothstep(0.0, ps * LINE_WIDTH * 32.0, verticalThickness * 4.0)) * 0.2;\n"+
"\n"+
"gl_FragColor = vec4(line + blur);\n"+
"//gl_FragColor += pow(max(gl_FragColor - .2, 0.0), vec4(1.4))*vec4(sin(iGlobalTime), cos(iGlobalTime), 1., 1.);\n"+
"gl_FragColor += pow(max(gl_FragColor - .4, 0.15), vec4(1.4))*vec4(vec3(0.5-(cos(iGlobalTime)+sin(iGlobalTime)), sin(iGlobalTime)*.5, cos(iGlobalTime)*5.),1.);\n"+
"}\n"