// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var FluidicSpace_frag =
"// https://www.shadertoy.com/view/tdS3DD\n"+
"// Created by EnigmaCurry\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"// Fluidic Space - EnigmaCurry\n"+
"// Adapted from Simplicity by JoshP\n"+
"// https://www.shadertoy.com/view/lslGWr\n"+
"// http://www.fractalforums.com/new-theories-and-research/very-simple-formula-for-fractal-patterns/\n"+
"float field(in vec3 p) {\n"+
"float strength = 4. + .03 * log(1.e-6 + fract(sin(iGlobalTime) * 4373.11));\n"+
"float accum = 0.;\n"+
"float prev = 0.;\n"+
"float tw = 1.11;\n"+
"for (int i = 0; i < 32; ++i) {\n"+
"float mag = dot(p/1.3, p/1.3);\n"+
"p = abs(p) / mag + vec3(-.5, -.4, -1.5);\n"+
"float w = exp(-float(i) / 777.);\n"+
"accum += w * exp(-strength * pow(abs(mag - prev), 1.9));\n"+
"tw += w;\n"+
"prev = mag;\n"+
"}\n"+
"return max(0., 4. * accum / tw - .5);\n"+
"}\n"+
"\n"+
"vec4 simplicity(vec2 fragCoord, float fft) {\n"+
"//vec2 uv = 2. * fragCoord.xy / iResolution.xy - 1.;\n"+
"vec2 uv = fragCoord - 0.45;\n"+
"//vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);\n"+
"vec2 uvs = uv;// * iResolution.xy / max(iResolution.x, iResolution.y);\n"+
"vec3 p = vec3(uvs / 3., 0) + vec3(1., 1.01, 0.);\n"+
"p += 2. * vec3(sin(iGlobalTime / 39.), cos(iGlobalTime / 2100.)-2.,  sin(iGlobalTime / 18.)-8.);\n"+
"float t = field(p);\n"+
"float v = (1. - exp((abs(uv.x) - 1.) * 6.)) * (1. - exp((abs(uv.y) - 1.) * 6.));\n"+
"return mix(.4, 1., v) * vec4(1.8 * t * t * t, 1.4 * t * t, t, 1.0) * fft;\n"+
"}\n"+
"\n"+
"vec4 simplicity2(vec2 fragCoord, float fft) {\n"+
"float fmod = tan(fft/21222.);\n"+
"//vec2 uv = 2. * fragCoord.xy / iResolution.xy - 1.;\n"+
"vec2 uv = fragCoord - 0.45;\n"+
"vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);\n"+
"vec3 p = vec3(uvs / 333., 0) + vec3(1., 0.1, 0.);\n"+
"p += tan(fmod) * vec3(cos(iGlobalTime / 39.), tan(iGlobalTime / 2100.)-2.,  sin(iGlobalTime / 18.)-8.);\n"+
"float t = field(p);\n"+
"float v = (1. - exp((abs(uv.x) - 1.) * 6.)) * (1. - exp((abs(uv.y) - 1.) * 6.));\n"+
"return mix(.4, 1., v) * vec4(1.8 * t * t * t, 1.4 * t * t, t, 1.0) * fft;\n"+
"}\n"+
"\n"+
"vec4 simplicity3(vec2 fragCoord, float fft) {\n"+
"float fmod = cos(fft*13.);\n"+
"//vec2 uv = 2. * fragCoord.xy / iResolution.xy - 1.;\n"+
"vec2 uv = fragCoord - 0.45;\n"+
"\n"+
"vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);\n"+
"vec3 p = vec3(uvs / 1., 0) + vec3(1., 0.01, 0.);\n"+
"p += 2.19 * vec3(cos(iGlobalTime / 3900.), tan(iGlobalTime / 2100.)-2.,  sin(iGlobalTime / 18.)-8.);\n"+
"float t = field(p);\n"+
"float v = (1. - exp((abs(uv.x) - 1.) * 6.)) * (1. - exp((abs(uv.y) - 1.) * 6.));\n"+
"return mix(sin(fmod)+8.8, 1., v) * vec4(0.8 * t * p.x * t, 0.9 * t, t, 1.0) * fft;\n"+
"}\n"+
"\n"+
"\n"+
"void main() {\n"+
"float fft = clamp(texture( iAudioData, vec2(0.1,0.1) ).x * 12., 0.2, 99999.);\n"+
"vec2 fragCoord =  -1.0 + 2.0 *vUv +.5;\n"+
"gl_FragColor += sqrt(simplicity(fragCoord, fft));\n"+
"gl_FragColor += sqrt(simplicity2(fragCoord, fft));\n"+
"gl_FragColor += sqrt(simplicity3(fragCoord, fft));\n"+
"}\n"