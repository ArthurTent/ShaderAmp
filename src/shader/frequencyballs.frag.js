// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var frequencyballs_frag =
"// https://www.shadertoy.com/view/4scGW2\n"+
"// frequency balls by nshelton\n"+
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
"\n"+
"float sphere(vec3 c, float r, vec3 p) {\n"+
"return length(p-c) - r;\n"+
"}\n"+
"\n"+
"float DE(vec3 p) {\n"+
"vec4 n1 = texture(iChannel0, vec2(0.2));\n"+
"vec4 n2 = texture(iChannel0, vec2(0.3));\n"+
"\n"+
"float min_d = 100.;\n"+
"\n"+
"for ( int i = 0 ; i < 20; i ++ ) {\n"+
"float t = float(i)/20. ;\n"+
"float freq = pow(texture(iAudioData, vec2(t, 0.)).r, 3.0) * 2.;\n"+
"\n"+
"float t_tex =  t + iGlobalTime/100.;\n"+
"vec4 n0 = texture(iChannel0, vec2(cos(t_tex), sin(t_tex)));\n"+
"n0= n0 * 3. - 1.5;\n"+
"n0.y *=2.;\n"+
"vec3 c = vec3(t * 10. - 5. , 0., 0.) + n0.xyz;\n"+
"min_d = min ( min_d, sphere(c, freq, p));\n"+
"\n"+
"}\n"+
"return min_d;\n"+
"}\n"+
"\n"+
"vec3 grad(vec3 p) {\n"+
"vec2 eps = vec2(0.01, 0.0);\n"+
"\n"+
"return normalize(vec3(\n"+
"DE(p + eps.xyy) -  DE(p - eps.xyy),\n"+
"DE(p + eps.yxy) -  DE(p - eps.yxy),\n"+
"DE(p + eps.yyx) -  DE(p - eps.yyx)));\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 uv = fragCoord.xy / iResolution.xy ;\n"+
"//vec2 uv = -1.0 + 2.0 *vUv -.5;\n"+
"vec2 uv = -1.0 + 2.0 *vUv +.35;\n"+
"uv = uv *2. - 1.;\n"+
"uv.x *= iResolution.x/iResolution.y;\n"+
"\n"+
"vec3 ray = normalize(vec3(uv, 1.));\n"+
"//vec3 camera = vec3(0.0, 0.0, sin(iGlobalTime)-4.);\n"+
"vec3 camera = vec3(sin(iGlobalTime)*.4,cos(iGlobalTime), sin(iGlobalTime)-4.);\n"+
"\n"+
"float iter = 0.;\n"+
"float t = 0.;\n"+
"vec3 point;\n"+
"bool hit = false;\n"+
"for ( int i = 0; i < 10; i ++) {\n"+
"point = camera + ray * t;\n"+
"\n"+
"float d = DE(point);\n"+
"\n"+
"if (DE(point) < 0.1){\n"+
"hit = true;\n"+
"break;\n"+
"}\n"+
"\n"+
"iter += 0.1;\n"+
"t += d;\n"+
"}\n"+
"vec3 color = vec3(0., 0., 0.);\n"+
"if ( hit) {\n"+
"color = vec3(dot(ray, -grad(point))) * vec3(1.-(cos(iGlobalTime)+sin(iGlobalTime)), sin(iGlobalTime), cos(iGlobalTime)) ;\n"+
"color *= 1. - iter;\n"+
"}\n"+
"\n"+
"gl_FragColor = vec4(color, 1.0);\n"+
"\n"+
"}\n"