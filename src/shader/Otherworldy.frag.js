// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var Otherworldy_frag =
"// https://www.shadertoy.com/view/MlySWd\n"+
"// Otherworldy by lherm\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData; // nice hint for loading tAudio --> https://threejs.org/examples/webaudio_visualizer\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform sampler2D iVideo;\n"+
"\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define T iGlobalTime\n"+
"\n"+
"#define PSD (abs(texture(iAudioData, vec2(.5)).r)*abs(texture(iAudioData, vec2(.5)).r))\n"+
"\n"+
"// HG_SDF rotate function\n"+
"#define r(p, a) {p = cos(a)*p + sin(a)*vec2(p.y,-p.x);}\n"+
"\n"+
"// Cabbibo's HSV\n"+
"vec3 hsv(float h, float s, float v) {return mix( vec3( 1.0 ), clamp( ( abs( fract(h + vec3( 3.0, 2.0, 1.0 ) / 3.0 ) * 6.0 - 3.0 ) - 1.0 ), 0.0, 1.0 ), s ) * v;}\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 u = (-iResolution.xy+2.*w.xy) / iResolution.y;\n"+
"vec2 u = -.458 + 2.0 *vUv*.456;\n"+
"\n"+
"vec3 ro = vec3(u, 1.), rd = normalize(vec3(u, -1.)), p; // Camera and ray dir\n"+
"float d = 0., m; // Distance for march\n"+
"for (float i = 1.; i > 0.; i-=0.02)\n"+
"{\n"+
"p = ro + rd * d;\n"+
"r(p.zy, T);\n"+
"r(p.zx, T);\n"+
"m = length(cos(abs(p)+sin(abs(p))+T))-(PSD + .5); // Distance function\n"+
"d += m;\n"+
"gl_FragColor = vec4(hsv(T, 1.,1.)*i*i, 1.);\n"+
"if (m < 0.02) break;\n"+
"}\n"+
"\n"+
"}\n"