// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var VinylVisualizer_frag =
"// https://www.shadertoy.com/view/XlcXDX\n"+
"// Vinyl Visualizer by s23b\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define BARS 12.\n"+
"\n"+
"#define PI 3.14159265359\n"+
"\n"+
"// rotation transform\n"+
"void tRotate(inout vec2 p, float angel) {\n"+
"float s = sin(angel), c = cos(angel);\n"+
"p *= mat2(c, -s, s, c);\n"+
"}\n"+
"\n"+
"// circle distance\n"+
"float sdCircle(vec2 p, float r) {\n"+
"return length(p) - r;\n"+
"}\n"+
"\n"+
"// union\n"+
"float opU(float a, float b) {\n"+
"return min(a, b);\n"+
"}\n"+
"\n"+
"// substraction\n"+
"float opS(float a, float b) {\n"+
"return max(a, -b);\n"+
"}\n"+
"\n"+
"// distance function of half of an ark\n"+
"// parameters: inner radius, outer radius, angle\n"+
"float sdArk(vec2 p, float ir, float or, float a) {\n"+
"\n"+
"// add outer circle\n"+
"float d = sdCircle(p, or);\n"+
"\n"+
"// substract inner circle\n"+
"d = opS(d, sdCircle(p, ir));\n"+
"\n"+
"// rotate with angle\n"+
"tRotate(p, -a * PI / 2.);\n"+
"\n"+
"// clip the top\n"+
"d = opS(d, -p.y);\n"+
"\n"+
"// add circle to the top\n"+
"d = opU(d, sdCircle(p - vec2((or + ir) / 2., 0.), (or - ir) / 2.));\n"+
"return d;\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 uv = fragCoord.xy / iResolution.xy * 2. - 1.;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"\n"+
"// I wanted it to look good on my phone vertically :P\n"+
"//if (iResolution.x > iResolution.y) uv.x *= iResolution.x / iResolution.y; else uv.y *= iResolution.y / iResolution.x;\n"+
"\n"+
"// little white padding\n"+
"uv *= 1.05;\n"+
"\n"+
"// add circles\n"+
"float d = sdCircle(uv, 1.);\n"+
"d = opS(d, sdCircle(uv, .34));\n"+
"d = opU(d, sdCircle(uv, .04));\n"+
"\n"+
"// calculate position of the bars\n"+
"float barsStart = .37;\n"+
"float barsEnd = .94;\n"+
"float barId = floor((length(uv) -barsStart) / (barsEnd - barsStart) * BARS);\n"+
"\n"+
"// only go forward if we're in a bar\n"+
"if (barId >= 0. && barId < BARS) {\n"+
"\n"+
"float barWidth = (barsEnd - barsStart) / BARS;\n"+
"float barStart = barsStart + barWidth * (barId + .25);\n"+
"float barAngel = texture(iAudioData, vec2(1. - barId / BARS, .25)).x * .5;\n"+
"\n"+
"// add a little rotation to completely ruin the beautiful symmetry\n"+
"tRotate(uv, -barAngel * .2 * sin(barId + iGlobalTime));\n"+
"\n"+
"// mirror everything\n"+
"uv = abs(uv);\n"+
"\n"+
"// add the bars\n"+
"d = opS(d, sdArk(uv, barStart, barStart + barWidth / 2., barAngel));\n"+
"}\n"+
"\n"+
"// use the slope to render the distance with antialiasing\n"+
"float w = min(fwidth(d), .01);\n"+
"gl_FragColor = vec4(vec3(smoothstep(-w, w, d)),1.0);\n"+
"}\n"