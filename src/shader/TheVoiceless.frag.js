// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var TheVoiceless_frag =
"// https://www.shadertoy.com/view/ls3cWM\n"+
"// Created by python273\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"uniform float iGlobalTime;\n"+
"uniform float iTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"uniform vec2 iFrame;\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define PI 3.1415926535897932384626433832795\n"+
"#define half_PI 1.570796326794896619231321692\n"+
"\n"+
"float max_dist_image = distance(vec2(0.0), vec2(0.5));\n"+
"float max_dist_vr = distance(vec2(0.0), vec2(0.25));\n"+
"float c0;\n"+
"\n"+
"vec4 render(vec2 uv, float max_dist) {\n"+
"float dist = distance(uv, vec2(0.0, 0.0)) / max_dist;\n"+
"float a = (atan(uv.y, abs(uv.x)) + half_PI) / PI;\n"+
"\n"+
"c0 = texture(iAudioData, vec2(a, 0.25)).x;\n"+
"\n"+
"return vec4(1.0, 1.0 - dist, c0, 1.0) * (c0 / dist);\n"+
"}\n"+
"\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 uv = (fragCoord - .5*iResolution.xy) / min(iResolution.x, iResolution.y);\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"gl_FragColor = render(uv, max_dist_image);\n"+
"}\n"+
"\n"+
"/*\n"+
"void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )\n"+
"{\n"+
"vec2 uv = fragRayDir.xy / 2.0;\n"+
"fragColor = render(uv, max_dist_vr);\n"+
"}\n"+
"*/\n"