// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var Warpspeed_frag =
"// https://www.shadertoy.com/view/Msl3WH\n"+
"// 'Warp Speed' by David Hoskins 2013.\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"// I tried to find gaps and variation in the star cloud for a feeling of structure.\n"+
"// Inspired by Kali: https://www.shadertoy.com/view/ltl3WS\n"+
"\n"+
"varying vec2 vUv;\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iVideo;\n"+
"\n"+
"float getLevel(float x) {\n"+
"return texelFetch(iAudioData, ivec2(int(x*512.), 0), 0).r;\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"float time = (iGlobalTime+29.) * 60.0;\n"+
"\n"+
"float s = 0.0, v = 0.0;\n"+
"//vec2 uv = (-iResolution.xy + 2.0 * fragCoord ) / iResolution.y;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"float t = time*0.005;\n"+
"uv.x += sin(t) * .3;\n"+
"float level =  0.;\n"+
"float si = sin(t*(1.5+getLevel(10.))); // ...Squiffy rotation matrix!\n"+
"float co = cos(t);\n"+
"uv *= mat2(co, si, -si, co);\n"+
"vec3 col = vec3(0.0);\n"+
"vec3 p = vec3(0.0);\n"+
"vec3 init = vec3(0.25, 0.25 + sin(time * 0.001) * .1, time * 0.0008);\n"+
"for (int r = 0; r < 100; r++)\n"+
"{\n"+
"//p = init + s * vec3(uv, 0.143)+getLevel(float(r));\n"+
"p = init + s * vec3(uv, 0.143);\n"+
"\n"+
"level = getLevel(float(r))*10000.;\n"+
"/*\n"+
"level =  mod(float(r),10.);\n"+
"if( level >= 0. ){\n"+
"level = getLevel(float(r));\n"+
"p = init + s * vec3(uv, 0.143)*level*100.;\n"+
"}\n"+
"else{\n"+
"p = init + s * vec3(uv, 0.143);\n"+
"}\n"+
"*/\n"+
"\n"+
"p.z = mod(p.z, 2.0);\n"+
"for (int i=0; i < 10; i++)	p = abs(p * 2.04) / dot(p, p) - 0.75;\n"+
"//for (int i=0; i < 10; i++)	p = abs((getLevel(float(r))*p) * 2.04) / dot(p, p) - 0.75;\n"+
"v += length(p * p) * smoothstep(0.0, 0.5, 0.9 - s) * .002;\n"+
"// Get a purple and cyan effect by biasing the RGB in different ways...\n"+
"col +=  vec3(v * 0.8+level/10., 1.1 - s * 0.5+level/30., .7 + v * 0.5+level/4.) * v * 0.013;\n"+
"s += .01;\n"+
"}\n"+
"gl_FragColor = vec4(col, 1.0);\n"+
"}\n"