// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var NeonOctagonalAudioVisualizer_frag =
"// https://www.shadertoy.com/view/Wd23Rw\n"+
"// Neon Octagonal Audio Visualizer by Emiel\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"// line antialiasing using smoothstep technique by FabriceNeyret2 (https://www.shadertoy.com/view/4dcfW8)\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"\n"+
"#define freq(f) texture(iAudioData, vec2(f, 0.25)).x * 0.8\n"+
"#define wave(f) texture(iAudioData, vec2(f, 0.75)).x\n"+
"\n"+
"float rand(float n){return fract(sin(n) * 43758.5453123);}\n"+
"\n"+
"float sdLine( in vec2 p, in vec2 a, in vec2 b )\n"+
"{\n"+
"vec2 pa = p-a, ba = b-a;\n"+
"float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );\n"+
"return length( pa - ba*h );\n"+
"}\n"+
"\n"+
"vec3 hsl(float h, float s, float l) {\n"+
"vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);\n"+
"return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));\n"+
"}\n"+
"\n"+
"float avgFreq(float start, float end, float step) {\n"+
"float div = 0.0;\n"+
"float total = 0.0;\n"+
"for (float pos = start; pos < end; pos += step) {\n"+
"div += 1.0;\n"+
"total += freq(pos);\n"+
"}\n"+
"return total / div;\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"vec2 R = iResolution.xy;\n"+
"//vec2 uv = fragCoord / iResolution.xy - 0.5;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"uv *= vec2(1.0, iResolution.y / iResolution.x);\n"+
"\n"+
"vec3 col = vec3(0.0);\n"+
"\n"+
"float bassFreq = pow(avgFreq(0.0, 0.1, 0.01), 0.85);\n"+
"float medFreq = pow(avgFreq(0.1, 0.6, 0.01), 0.85);\n"+
"float topFreq = pow(avgFreq(0.6, 1.0, 0.01), 0.85);\n"+
"float ccnt = 8.0;\n"+
"\n"+
"float hue = iGlobalTime;\n"+
"float speed = iGlobalTime * 0.5 + topFreq * 0.1;\n"+
"\n"+
"bool first = false;\n"+
"\n"+
"for (int j = 0; j < int(ccnt); j++) {\n"+
"float i = float(j);\n"+
"float spos = speed + i * 3.14 * 2. / ccnt;\n"+
"\n"+
"if (rand(i * 100.0 + floor(iGlobalTime * 15.0) * 50.0) < bassFreq * 0.1) continue;\n"+
"\n"+
"vec2 cpos = vec2(cos(spos), sin(spos)) * (bassFreq * 0.15 + 0.005);\n"+
"\n"+
"float csize = (0.02 + medFreq * 0.08 + bassFreq * 0.002);\n"+
"float cdist = length(uv - cpos) - csize;\n"+
"\n"+
"if (cdist < 0.0) {\n"+
"bool draw = true;\n"+
"if (j == 0) first = true;\n"+
"\n"+
"if (j == int(ccnt) - 1) {\n"+
"draw = !first;\n"+
"}\n"+
"\n"+
"if (draw) {\n"+
"//col = hsl(hue, bassFreq * 0.1, topFreq * 2.0) * ((10.0* csize) - cdist * 5.0);\n"+
"col = hsl(hue, bassFreq * 0.1, topFreq*1.25) * ((bassFreq*8.0* csize) - cdist * 5.0);\n"+
"}\n"+
"}\n"+
"}\n"+
"\n"+
"\n"+
"if (length(col) < 0.001) {\n"+
"col = hsl(hue, bassFreq * 0.1, medFreq * 0.5) * length(uv);\n"+
"}\n"+
"\n"+
"for (int j = 0; j < int(ccnt); j++) {\n"+
"for (int k= 0; k < int(ccnt); k++) {\n"+
"float i = float(j);\n"+
"float l = float(k);\n"+
"//float spos = .525 *bassFreq * speed + i * 3.14 * 2. / ccnt;\n"+
"//float spos2 = .525 * bassFreq * speed + l * 3.14 * 2. / ccnt;\n"+
"float spos = speed + i * 3.14 * 2. / ccnt;\n"+
"float spos2 = speed + l * 3.14 * 2. / ccnt;\n"+
"\n"+
"if (rand(i * 100.0 + l + floor(iGlobalTime * 50.0) * 50.0) > bassFreq * 0.8) continue;\n"+
"\n"+
"//vec2 cpos = vec2(sin(spos), cos(spos)) * (bassFreq * 0.15 + 0.005) * 2.0;\n"+
"vec2 cpos = vec2(sin(spos), cos(spos)) * (bassFreq * 0.25 + 0.005) * 2.0;\n"+
"//vec2 cpos2 = vec2(sin(spos2), cos(spos2)) * (bassFreq * 0.15 + 0.005) * 2.0;\n"+
"vec2 cpos2 = vec2(sin(spos2), cos(spos2)) * (bassFreq * 0.25 + 0.005) * 2.0;\n"+
"\n"+
"float lineDist = sdLine(uv, cpos, cpos2);\n"+
"float width = 1.1*  1.0 / iResolution.x*bassFreq*30.*topFreq*bassFreq;\n"+
"//col += hsl(hue, bassFreq * 0.1 + 0.5, 0.1 + bassFreq * 1.4)\n"+
"col += hsl(hue, bassFreq * 0.1 + 0.5, 0.1 + bassFreq * .4)\n"+
"* smoothstep(width, 0., lineDist);\n"+
"}\n"+
"\n"+
"}\n"+
"\n"+
"gl_FragColor = vec4(col,1.0);\n"+
"gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * 5.5*topFreq;\n"+
"}\n"