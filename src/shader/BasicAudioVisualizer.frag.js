// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var BasicAudioVisualizer_frag =
"// https://www.shadertoy.com/view/lsdGR8\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"/* Simple audio visualizer by chronos\n"+
"// Feel free to use any part of the code and/or improve it further\n"+
"// Drop a link in the comments! :)\n"+
"//\n"+
"// Recommended tracks:\n"+
"// https://soundcloud.com/kubbi/pathfinder\n"+
"// https://soundcloud.com/wearecastor/rad\n"+
"// https://soundcloud.com/jco-de/coronoid-soundtrack\n"+
"//\n"+
"*/\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define WIDTH 1.0\n"+
"\n"+
"float audio_freq( in sampler2D channel, in float f) { return texture( channel, vec2(f, 0.25) ).x; }\n"+
"float audio_ampl( in sampler2D channel, in float t) { return texture( channel, vec2(t, 0.75) ).x; }\n"+
"\n"+
"vec3 B2_spline(vec3 x) { // returns 3 B-spline functions of degree 2\n"+
"vec3 t = 3.0 * x;\n"+
"vec3 b0 = step(0.0, t)     * step(0.0, 1.0-t);\n"+
"vec3 b1 = step(0.0, t-1.0) * step(0.0, 2.0-t);\n"+
"vec3 b2 = step(0.0, t-2.0) * step(0.0, 3.0-t);\n"+
"return 0.5 * (\n"+
"b0 * pow(t, vec3(2.0)) +\n"+
"b1 * (-2.0*pow(t, vec3(2.0)) + 6.0*t - 3.0) +\n"+
"b2 * pow(3.0-t,vec3(2.0))\n"+
");\n"+
"}\n"+
"\n"+
"void main() {\n"+
"\n"+
"//vec2 uv = -1.0 + 2.0 *vUv -.5;\n"+
"vec2 uv =  -1. + 2. * vUv+.5;\n"+
"//vec2 centered = 2.0 * uv - 1.0;\n"+
"\n"+
"vec2 centered = 2.*uv-1.;\n"+
"//centered.x *= iResolution.x / iResolution.y;\n"+
"\n"+
"float dist2 = dot(centered, centered);\n"+
"float clamped_dist = smoothstep(0.0, 1.0, dist2);\n"+
"float arclength    = abs(atan(centered.y, centered.x) / radians(360.0))+0.01;\n"+
"\n"+
"// Color variation functions\n"+
"float t = iGlobalTime / 100.0;\n"+
"float polychrome = (1.0 + sin(t*10.0))/2.0; // 0 -> uniform color, 1 -> full spectrum\n"+
"vec3 spline_args = fract(vec3(polychrome*uv.x-t) + vec3(0.0, -1.0/3.0, -2.0/3.0));\n"+
"vec3 spline = B2_spline(spline_args);\n"+
"\n"+
"float f = abs(centered.y);\n"+
"vec3 base_color  = vec3(1.0, 1.0, 1.0) - f*spline;\n"+
"vec3 flame_color = pow(base_color, vec3(3.0));\n"+
"vec3 disc_color  = 0.20 * base_color;\n"+
"vec3 wave_color  = 0.10 * base_color;\n"+
"vec3 flash_color = 0.05 * base_color;\n"+
"\n"+
"float sample1 = audio_freq(iAudioData, abs((uv.x - .5) / WIDTH) + 0.01);\n"+
"float sample2 = audio_ampl(iAudioData, clamped_dist);\n"+
"float sample3 = audio_ampl(iAudioData, arclength);\n"+
"\n"+
"float disp_dist = smoothstep(-0.2, -0.1, sample3-dist2);\n"+
"disp_dist *= (1.0 - disp_dist);\n"+
"\n"+
"vec3 color = vec3(0.0);\n"+
"\n"+
"// spline debug\n"+
"// vec3 s = smoothstep(-0.01, 0.01, spline-uv.y); color += (1.0-s) * s;\n"+
"\n"+
"float v = abs(uv.y - 0.5);\n"+
"color += flame_color * smoothstep(v, v*8.0, sample1);\n"+
"color += disc_color  * smoothstep(0.5, 1.0, sample2) * (1.0 - clamped_dist);\n"+
"color += flash_color * smoothstep(0.5, 1.0, sample3) * clamped_dist;\n"+
"color += wave_color  * disp_dist;\n"+
"color = pow(color, vec3(0.4545));\n"+
"//pow(max(Color - .2, 0.0), vec4(1.4)) * .5;\n"+
"gl_FragColor = vec4(color, 1.0);\n"+
"}\n"