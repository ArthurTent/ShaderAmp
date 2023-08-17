// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var SonicPulse_frag =
"// https://www.shadertoy.com/view/4dcyD2\n"+
"// Sonic Pulse by WillKirkby\n"+
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
"float circle(vec2 p, float r){\n"+
"return r-length(p);\n"+
"}\n"+
"\n"+
"float scene(vec2 p){\n"+
"vec2 p1=p;\n"+
"if(abs(p.x)<.85&&abs(p.y)<.35)\n"+
"p1=mod(p+.05,.1)-.05;\n"+
"\n"+
"//p-=mod(p+.05,.1)-.05;\n"+
"float r = texture(iAudioData, vec2(length(p)*.5,0)).r;\n"+
"return circle(p1,.06*r*r);\n"+
"}\n"+
"\n"+
"void main( )\n"+
"{\n"+
"const float cinematicAspect = 2.35;\n"+
"float currAspect = iResolution.x/iResolution.y;\n"+
"\n"+
"//vec2 uv = fragCoord/iResolution.xy-.5;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"vec4 wave = texture(iAudioData,uv/256.);\n"+
"uv.x *= currAspect;\n"+
"\n"+
"float d = scene(uv);\n"+
"\n"+
"gl_FragColor = 1.-clamp(vec4(d*iResolution.y*.5),0.,1.);\n"+
"gl_FragColor.rgb = mix(\n"+
"//vec3(11,231,184)/255.,\n"+
"vec3(int(sin(wave.r)*200.),75+int(sin(wave.r)*10.),75+int(cos(wave.r)*50.))/255.,\n"+
"vec3(30,57,77)/255.,\n"+
"gl_FragColor.rgb\n"+
");\n"+
"\n"+
"if (abs(uv.y) > .75*(currAspect/cinematicAspect))\n"+
"{\n"+
"gl_FragColor *= 0.;\n"+
"}\n"+
"else\n"+
"{\n"+
"gl_FragColor = gl_FragColor * (length(uv)*-.5+1.) + texture(iChannel1,uv/256.)*.004;\n"+
"//                      ^ vignette           ^ noise to hide banding\n"+
"gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * (wave.r*100.);\n"+
"\n"+
"}\n"+
"}\n"