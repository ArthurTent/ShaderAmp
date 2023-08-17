// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var Hexagone_frag =
"// https://www.shadertoy.com/view/wsl3WB\n"+
"// Hexagone by Martijn Steinrucken aka BigWings - 2019\n"+
"// countfrolic@gmail.com\n"+
"// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"//\n"+
"// This started as an idea to do the effect below, but with hexagons:\n"+
"// https://www.shadertoy.com/view/wdlGRM\n"+
"//\n"+
"// Turns out that really doesn't look very nice so I just made it\n"+
"// into a dance party instead ;)\n"+
"//\n"+
"// Music: https://soundcloud.com/buku/front-to-back\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define R3 1.732051\n"+
"\n"+
"vec4 HexCoords(vec2 uv) {\n"+
"vec2 s = vec2(1, R3);\n"+
"vec2 h = .5*s;\n"+
"\n"+
"vec2 gv = s*uv;\n"+
"\n"+
"vec2 a = mod(gv, s)-h;\n"+
"vec2 b = mod(gv+h, s)-h;\n"+
"\n"+
"vec2 ab = dot(a,a)<dot(b,b) ? a : b;\n"+
"vec2 st = ab;\n"+
"vec2 id = gv-ab;\n"+
"\n"+
"// ab = abs(ab);\n"+
"//st.x = .5-max(dot(ab, normalize(s)), ab.x);\n"+
"st = ab;\n"+
"return vec4(st, id);\n"+
"}\n"+
"\n"+
"float GetSize(vec2 id, float seed) {\n"+
"float d = length(id);\n"+
"float t = iGlobalTime*.5;\n"+
"float a = sin(d*seed+t)+sin(d*seed*seed*10.+t*2.);\n"+
"return a/2. +.5;\n"+
"}\n"+
"\n"+
"mat2 Rot(float a) {\n"+
"float s = sin(a);\n"+
"float c = cos(a);\n"+
"return mat2(c, -s, s, c);\n"+
"}\n"+
"\n"+
"float Hexagon(vec2 uv, float r, vec2 offs) {\n"+
"\n"+
"uv *= Rot(mix(0., 3.1415, r));\n"+
"\n"+
"r /= 1./sqrt(2.);\n"+
"uv = vec2(-uv.y, uv.x);\n"+
"uv.x *= R3;\n"+
"uv = abs(uv);\n"+
"\n"+
"vec2 n = normalize(vec2(1,1));\n"+
"float d = dot(uv, n)-r;\n"+
"d = max(d, uv.y-r*.707);\n"+
"\n"+
"d = smoothstep(.06, .02, abs(d));\n"+
"\n"+
"d += smoothstep(.1, .09, abs(r-.5))*sin(iGlobalTime);\n"+
"return d;\n"+
"}\n"+
"\n"+
"float Xor(float a, float b) {\n"+
"return a+b;\n"+
"//return a*(1.-b) + b*(1.-a);\n"+
"}\n"+
"\n"+
"float Layer(vec2 uv, float s) {\n"+
"vec4 hu = HexCoords(uv*2.);\n"+
"\n"+
"float d = Hexagon(hu.xy, GetSize(hu.zw, s), vec2(0));\n"+
"vec2 offs = vec2(1,0);\n"+
"d = Xor(d, Hexagon(hu.xy-offs, GetSize(hu.zw+offs, s), offs));\n"+
"d = Xor(d, Hexagon(hu.xy+offs, GetSize(hu.zw-offs, s), -offs));\n"+
"offs = vec2(.5,.8725);\n"+
"d = Xor(d, Hexagon(hu.xy-offs, GetSize(hu.zw+offs, s), offs));\n"+
"d = Xor(d, Hexagon(hu.xy+offs, GetSize(hu.zw-offs, s), -offs));\n"+
"offs = vec2(-.5,.8725);\n"+
"d = Xor(d, Hexagon(hu.xy-offs, GetSize(hu.zw+offs, s), offs));\n"+
"d = Xor(d, Hexagon(hu.xy+offs, GetSize(hu.zw-offs, s), -offs));\n"+
"\n"+
"return d;\n"+
"}\n"+
"\n"+
"float N(float p) {\n"+
"return fract(sin(p*123.34)*345.456);\n"+
"}\n"+
"\n"+
"vec3 Col(float p, float offs) {\n"+
"float n = N(p)*1234.34;\n"+
"\n"+
"return sin(n*vec3(12.23,45.23,56.2)+offs*3.)*.5+.5;\n"+
"}\n"+
"\n"+
"vec3 GetRayDir(vec2 uv, vec3 p, vec3 lookat, float zoom) {\n"+
"vec3 f = normalize(lookat-p),\n"+
"r = normalize(cross(vec3(0,1,0), f)),\n"+
"u = cross(f, r),\n"+
"c = p+f*zoom,\n"+
"i = c + uv.x*r + uv.y*u,\n"+
"d = normalize(i-p);\n"+
"return d;\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;\n"+
"vec2 uv = -1.0 + 2.0 *vUv -.5;\n"+
"//vec2 UV = fragCoord.xy/iResolution.xy-.5;\n"+
"vec2 UV = vUv.xy-.5;\n"+
"float duv= dot(UV, UV);\n"+
"vec2 m = uv.xy/iResolution.xy-.5;\n"+
"\n"+
"float t = iGlobalTime*.2+m.x*10.+5.;\n"+
"\n"+
"float y = sin(t*.5);//+sin(1.5*t)/3.;\n"+
"vec3 ro = vec3(0, 20.*y, -5);\n"+
"vec3 lookat = vec3(0,0,-10);\n"+
"vec3 rd = GetRayDir(uv, ro, lookat, 1.);\n"+
"\n"+
"vec3 col = vec3(0);\n"+
"\n"+
"vec3 p = ro+rd*(ro.y/rd.y);\n"+
"float dp = length(p.xz);\n"+
"\n"+
"if((ro.y/rd.y)>0.)\n"+
"col *= 0.;\n"+
"else {\n"+
"uv = p.xz*.1;\n"+
"\n"+
"uv *= mix(1., 5., sin(t*.5)*.5+.5);\n"+
"\n"+
"uv *= Rot(t);\n"+
"m *= Rot(t);\n"+
"\n"+
"uv.x *= R3;\n"+
"\n"+
"\n"+
"for(float i=0.; i<1.; i+=1./3.) {\n"+
"float id = floor(i+t);\n"+
"float t = fract(i+t);\n"+
"float z = mix(5., .1, t);\n"+
"float fade = smoothstep(0., .3, t)*smoothstep(1., .7, t);\n"+
"\n"+
"col += fade*t*Layer(uv*z, N(i+id))*Col(id,duv);\n"+
"}\n"+
"}\n"+
"col *= 2.;\n"+
"\n"+
"if(ro.y<0.) col = 1.-col;\n"+
"\n"+
"col *= smoothstep(18., 5., dp);\n"+
"col *= 1.-duv*2.;\n"+
"gl_FragColor = vec4(col,1.0);\n"+
"}\n"