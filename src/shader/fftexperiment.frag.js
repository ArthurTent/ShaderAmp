// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var fftexperiment_frag =
"// https://www.shadertoy.com/view/4tK3zG\n"+
"// fft experiment by nshelton\n"+
"\n"+
"// based on :\n"+
"// https://www.shadertoy.com/view/XtSGDK#\n"+
"// Created by inigo quilez - iq/2015\n"+
"// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0\n"+
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
"\n"+
"float thresh = 10.0;\n"+
"\n"+
"\n"+
"float udBox( vec3 p, vec3 b )\n"+
"{\n"+
"return length(max(abs(p)-b,0.0));\n"+
"}\n"+
"\n"+
"float manhattan(vec3 p) {\n"+
"return max(max(p.x, p.y), p.z);\n"+
"}\n"+
"\n"+
"float shape( vec3 p, float t)\n"+
"{\n"+
"\n"+
"\n"+
"float fftSpace = manhattan(abs(p) /20.) ;\n"+
"\n"+
"float fft = texture(iAudioData, vec2(fftSpace, 0.25)).r;\n"+
"\n"+
"vec3 dim = vec3(pow(fft, 4.0)) / 2.;// vec3(p0,p1,p2);\n"+
"\n"+
"dim.x = 2.0 ;\n"+
"\n"+
"vec3 c = vec3(2.);\n"+
"vec3 q = mod(p,c)-0.5*c;\n"+
"\n"+
"float d1 = udBox(q,dim.xyz);\n"+
"float d2 = udBox(q,dim.zyx);\n"+
"float d3 = udBox(q,dim.zxy);\n"+
"\n"+
"return min( min(d1,d2), d3);\n"+
"}\n"+
"\n"+
"float map( vec3 p, float t )\n"+
"{\n"+
"float s = 1.1;\n"+
"//p = deform( p, t, s );\n"+
"return shape( p, t ) * s;\n"+
"}\n"+
"\n"+
"vec3 shade( in vec3 ro, in vec3 rd, in float t, float time)\n"+
"{\n"+
"\n"+
"vec3 p = rd;\n"+
"\n"+
"float contour = abs(sin(length(p))  ) < 0.1 ? 1.0 : 0.0;\n"+
"\n"+
"float fftSpace = length(rd /10.) + 0.2 ;\n"+
"float fft = texture(iAudioData, vec2(fftSpace, 0.25)).r;\n"+
"\n"+
"return vec3(1. - t) * abs(rd);\n"+
"}\n"+
"\n"+
"const int ITER = 50;\n"+
"\n"+
"float intersect( in vec3 ro, in vec3 rd, const float maxdist, float time)\n"+
"{\n"+
"\n"+
"float t = 0.2;\n"+
"float iter = 0.0;\n"+
"for( int i=0; i<ITER; i++ )\n"+
"{\n"+
"vec3 p = ro + t*rd;\n"+
"float h = map( p, time);\n"+
"\n"+
"if( h<exp(-thresh) || t>maxdist ) break;\n"+
"\n"+
"t += h * 0.9 ;\n"+
"iter++;\n"+
"}\n"+
"return iter / float(ITER);\n"+
"}\n"+
"\n"+
"vec3 render( in vec3 ro, in vec3 rd, float time )\n"+
"{\n"+
"vec3 col = vec3(0.0);\n"+
"\n"+
"const float maxdist = 43.0;\n"+
"float t = intersect( ro, rd, maxdist, time );\n"+
"if( t < maxdist )\n"+
"{\n"+
"col = shade( ro, rd, t, time );\n"+
"}\n"+
"return pow( col, vec3(0.5) );\n"+
"//return pow( col, vec3(cos(col.x),cos(col.z),0.5) );\n"+
"}\n"+
"\n"+
"mat3 setCamera( in vec3 ro, in vec3 rt, in float cr )\n"+
"{\n"+
"vec3 cw = normalize(rt-ro);\n"+
"vec3 cp = vec3(cr,cr,0.0);\n"+
"vec3 cu = normalize( cross(cw,cp) );\n"+
"vec3 cv = normalize( cross(cu,cw) );\n"+
"return mat3( cu, cv, -cw );\n"+
"}\n"+
"\n"+
"mat3 calcLookAtMatrix(vec3 origin, vec3 target, float roll) {\n"+
"vec3 rr = vec3(sin(roll), cos(roll), 0.0);\n"+
"vec3 ww = normalize(target - origin);\n"+
"vec3 uu = normalize(cross(ww, rr));\n"+
"vec3 vv = normalize(cross(uu, ww));\n"+
"\n"+
"return mat3(uu, vv, ww);\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 p = (-iResolution.xy+2.0*(fragCoord.xy))/iResolution.y;\n"+
"vec2 p = -1.0 + 2.0 *vUv -.5;\n"+
"\n"+
"float time = iGlobalTime * 0.05;\n"+
"\n"+
"float rad = 5.;\n"+
"\n"+
"//vec3 ro = vec3(0.5,0.0,0.5) + 2.0*vec3(cos(an),1.0,sin(an));\n"+
"vec3 ro = vec3(rad * cos(time), rad * sin(time), 2. * sin(time/10.0));\n"+
"//mat3 ca = setCamera( vec3(0.0), ta, 0.1 );\n"+
"\n"+
"mat3 rot = calcLookAtMatrix(ro, vec3(0.0), 0.0);\n"+
"vec3 rd = rot * normalize(vec3(p, 1.0));\n"+
"\n"+
"vec3 col = render( ro, rd, time );\n"+
"gl_FragColor = vec4( col, 1.0 );\n"+
"}\n"+
"\n"