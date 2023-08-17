// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var MusicalHeart_frag =
"// https://www.shadertoy.com/view/4dK3zD\n"+
"// Created by hunter\n"+
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
"// Based on: https://www.shadertoy.com/view/4scGDs\n"+
"//\n"+
"// formula SRC: http://mathworld.wolfram.com/HeartCurve.html\n"+
"\n"+
"float heartRadius(float theta)\n"+
"{\n"+
"//return 2. - 2.*sin(theta) + sqrt(abs(cos(theta)))*sin(theta)/(1.4 + sin(theta));\n"+
"return 2. - 2.*sin(theta) + sqrt(abs(cos(theta)))*sin(theta)/(1.4 + sin(theta));\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"\n"+
"//vec2 uv = fragCoord.xy / iResolution.xy;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"float v  = texture( iAudioData, vec2(1/510,0.25) ).x;\n"+
"\n"+
"float red  = texture( iAudioData, vec2(1/510,0.25) ).x;\n"+
"float grn  = texture( iAudioData, vec2(0.5,0.5) ).x;\n"+
"float blu  = texture( iAudioData, vec2(0.75,0.5) ).x;\n"+
"\n"+
"vec4 heartColor = vec4(red,grn,blu,1.0);\n"+
"vec4 bgColor = vec4(0.0,0.0,0.0,1.0);\n"+
"vec2 originalPos = uv;//(2.0 * vUv - iResolution.xy)/iResolution.yy;\n"+
"vec2 pos = originalPos;\n"+
"pos.y -= .5;\n"+
"\n"+
"float theta = atan(pos.y, pos.x);\n"+
"float r = heartRadius(theta);\n"+
"\n"+
"gl_FragColor = mix(bgColor, heartColor,\n"+
"//smoothstep(0.0, length(pos) * 0.5, r * v * 0.25 ));\n"+
"smoothstep(0.0, length(pos) * 0.5, r * v * 0.125 ));\n"+
"gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * 5.;\n"+
"\n"+
"}\n"