// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var inFX_frag =
"// https://www.shadertoy.com/view/ldd3Dr\n"+
"// inFX.1b by patu\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"// S h a d e r T o y - - - C h r o m e   E x t e n s i o n\n"+
"\n"+
"// https://chrome.google.com/webstore/detail/shadertoy-unofficial-plug/ohicbclhdmkhoabobgppffepcopomhgl\n"+
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
"const vec3 e = vec3(0.0, 0.0, 0.1);\n"+
"const float maxd = 70.0;\n"+
"const vec3 c = vec3(1.0);\n"+
"const float PI = 3.14159265;\n"+
"\n"+
"vec2 d = vec2(0.1, 0.0);\n"+
"vec3 p;\n"+
"\n"+
"vec4 Color = vec4(0.0);\n"+
"float vol = 0.;\n"+
"\n"+
"vec3 spherical_texturing(in vec3 normal, in sampler2D tex, float delta) {\n"+
"float u = atan(normal.z, normal.x) / PI * 2.0 + delta;\n"+
"float v = asin(normal.y) / PI * 2.0;\n"+
"return texture(tex, vec2(u, v)).xyz;\n"+
"}\n"+
"\n"+
"mat3 xrotate( float t ) {\n"+
"return mat3(\n"+
"1.0, 0.0, 0.0,\n"+
"0.0, cos(t), -sin(t),\n"+
"0.0, sin(t), cos(t)\n"+
");\n"+
"}\n"+
"\n"+
"mat3 yrotate( float t ) {\n"+
"return mat3(\n"+
"cos(t), 0.0, -sin(t),\n"+
"0.0, 1.0, 0.0,\n"+
"sin(t), 0.0, cos(t)\n"+
");\n"+
"}\n"+
"\n"+
"mat3 zrotate( float t ) {\n"+
"return mat3(\n"+
"cos(t), -sin(t), 0.0,\n"+
"sin(t), cos(t), 0.0,\n"+
"0.0, 0.0, 1.0\n"+
");\n"+
"}\n"+
"\n"+
"mat3 fullRotate( vec3 r ) {\n"+
"return xrotate(r.x) * yrotate(r.y) * zrotate(r.z);\n"+
"}\n"+
"\n"+
"vec3 opRep( vec3 p, vec3 c ) {\n"+
"return mod(p,c)-0.5*c;\n"+
"}\n"+
"\n"+
"float smin( float a, float b, float k ){\n"+
"float res = exp( -k*a ) + exp( -k*b );\n"+
"return -log( res )/k;\n"+
"}\n"+
"\n"+
"float opBlend( float d1, float d2 ) {\n"+
"return smin( d1 , d2 , 0.3);\n"+
"}\n"+
"\n"+
"float opS( float d1, float d2 ) {\n"+
"return max(-d2,d1);\n"+
"}\n"+
"\n"+
"float sdBox( vec3 p, vec3 b ) {\n"+
"vec3 d = abs(p) - b;\n"+
"return min(max(d.x,max(d.y,d.z)),0.0) +\n"+
"length(max(d,0.0));\n"+
"}\n"+
"\n"+
"float sdCross( in vec3 p, float w ) {\n"+
"float inf = 30.;\n"+
"float da = sdBox(p.xyz,vec3(inf, w, w));\n"+
"float db = sdBox(p.yzx,vec3(w, inf, w));\n"+
"float dc = sdBox(p.zxy,vec3(w, w ,inf));\n"+
"return min(da,min(db,dc));\n"+
"}\n"+
"\n"+
"vec2 distance_to_obj( in vec3 p ) {\n"+
"float t = iGlobalTime;\n"+
"\n"+
"float w = 1.7 - length(p) / (20. + vol * 20.);\n"+
"float x = 0.;\n"+
"\n"+
"if (	(t > -1. && t < 21.3) ||\n"+
"(t > 42.4 && t < 54.3)) {\n"+
"w -= 4.;\n"+
"} else {\n"+
"x = t;\n"+
"w += (distance(p, vec3(0.)) / 20.) * vol;\n"+
"}\n"+
"\n"+
"w *= 2. + sin(x) * 2. - 2. * vol + abs(sin(x));\n"+
"float map =\n"+
"opBlend(\n"+
"sdCross(p * fullRotate(vec3(t * 2., 0., t)), w),\n"+
"sdCross(p * fullRotate(\n"+
"vec3(\n"+
"-PI / 4. + t * 2., 0., PI / 4. + t\n"+
")),\n"+
"w\n"+
")\n"+
");\n"+
"\n"+
"return vec2(map, 1.);\n"+
"}\n"+
"\n"+
"vec3 opTwist( vec3 p, float r ) {\n"+
"float  c = cos(r * p.y + r);\n"+
"float  s = sin(r * p.y + r);\n"+
"mat2   m = mat2(c,-s,s,c);\n"+
"return vec3(m*p.xz,p.y);\n"+
"}\n"+
"\n"+
"\n"+
"float shadow( in vec3 ro, in vec3 rd, in float maxt )\n"+
"{\n"+
"float res = 5.0;\n"+
"float dt = 0.04;\n"+
"float t = .02;\n"+
"for( int i=0; i < 12; i++ )\n"+
"{\n"+
"float h = distance_to_obj(ro + rd * t).x;\n"+
"if( h < 0.001 ) return 0.1;\n"+
"res = min( res, maxt * h / t );\n"+
"t += h;\n"+
"}\n"+
"return res;\n"+
"}\n"+
"\n"+
"vec4 bg ( in vec3 ePos, in vec3 eDir ) {\n"+
"vec4 bgColor = vec4(0.1);\n"+
"\n"+
"bgColor.r -= mod(iGlobalTime, 5.45 / 8.) * vol * 4.;\n"+
"bgColor.rgb += spherical_texturing(ePos, iChannel0, .001).rgb;//(eDir.xy + eDir.zy + eDir.zx) / 4.).r * 0.8;\n"+
"return bgColor * vec4(1., sin(vol), 0.8, 1.0);\n"+
"}\n"+
"\n"+
"void main() {\n"+
"\n"+
"//vec2 vPos = fragCoord.xy / iResolution.xy - 0.5;\n"+
"//vec2 vPos = -1.0 + 2.0 *vUv -.5;\n"+
"//vec2 vPos = -1.0 + 2.0 *vUv ;\n"+
"vec2 vPos = -1. + 2. * vUv;\n"+
"//vPos.x += sin(iGlobalTime);\n"+
"//vPos.y += cos(iGlobalTime/2.);\n"+
"\n"+
"float k = iGlobalTime / 1.6;\n"+
"float sk = sin(k), ck = cos(k);\n"+
"\n"+
"vol = texture(iAudioData, vec2(.2, .25)).r;\n"+
"\n"+
"// Camera setup.\n"+
"vec3 vuv = vec3(0, sk, ck); // up\n"+
"//vec3 vuv = vec3(0, vUv.x, vUv.y); // up\n"+
"//vec3 vuv = vec3(0, vUv.x-.5, vUv.y-.5);\n"+
"vec3 prp = vec3(sk * 60., 1. , ck * -34.); // pos\n"+
"vec3 vrp = vec3(10., sk * 10., 0.); // lookat\n"+
"\n"+
"vec3 vpn = normalize(vrp - prp) ;\n"+
"vec3 u = normalize(cross(vuv, vpn));\n"+
"vec3 v = cross(vpn, u);\n"+
"vec3 vcv = (prp + vpn);\n"+
"vec3 scrCoord = (vcv + vPos.x * u * iResolution.x/iResolution.y + vPos.y * v);\n"+
"//vec3 scrCoord = (vcv + vPos.x * u * vUv.x/vUv.y + vPos.y * v);\n"+
"vec3 scp = normalize(scrCoord - prp);\n"+
"\n"+
"float glow = 0.;\n"+
"float minDist= 100.;\n"+
"\n"+
"float f = 2.0;\n"+
"\n"+
"for (float i = 0.; i < 32.; i++) {\n"+
"if ((abs(d.x) < .001) || (f > maxd)) break;\n"+
"\n"+
"f += d.x;\n"+
"\n"+
"p = prp + scp * f;\n"+
"p = opTwist(p, 0.08 * sk) * fullRotate(vec3(k * 1.2));\n"+
"\n"+
"//d = distance_to_obj(p);\n"+
"d = distance_to_obj(p); // fixes glitches\n"+
"\n"+
"minDist = min(minDist, d.x * 1.5);\n"+
"glow = pow( 1. / minDist, 1.35);\n"+
"}\n"+
"\n"+
"if (f < maxd) {\n"+
"//Color = texture(iChannel0, p) / 2. + texture(iChannel0, -reflect(p, scp)) / 2.;\n"+
"float len = length(vPos);\n"+
"float r1 = 0.3 / len + iGlobalTime * 0.5;\n"+
"vec4 tex1 = texture2D(iChannel1, p.xy);\n"+
"vec4 tex2 = texture2D(iChannel1, vec2(-reflect(p, scp))) / 2.;\n"+
"\n"+
"Color = tex1 + tex2;\n"+
"Color *= shadow(p, scp, 24.);\n"+
"//Color = vec4(Color.g);\n"+
"//Color = vec4(Color.b);\n"+
"\n"+
"} else {\n"+
"//background\n"+
"Color = bg(-normalize(scp), scp) + pow(glow, vol*0.9)* vec4(3., 2., 1., 1.0) * 0.75;\n"+
"\n"+
"}\n"+
"/*\n"+
"if (iGlobalTime > 19.0 && iGlobalTime < 31.45) {\n"+
"Color -= 1. - (21.45 - iGlobalTime) / 2.;\n"+
"}\n"+
"\n"+
"*/\n"+
"\n"+
"if(vol>0.3) {\n"+
"Color -= 1. - (1. - sin(iGlobalTime)) / 2.;\n"+
"}\n"+
"\n"+
"// iq vinegre\n"+
"vec2 q = vPos + .5;\n"+
"// black squares? :-/\n"+
"//Color *= 0.4 + 0.6*pow( 32.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1 );\n"+
"\n"+
"// Cheap 'bloom emulation' from backscatter;\n"+
"Color += pow(max(Color - .2, 0.0), vec4(1.4)) * .5;\n"+
"//gl_FragColor = Color;// * sin(length(vPos) - 1.5) * -1.2;\n"+
"gl_FragColor = Color* sin(length(vPos) - 1.5) * -1.2;\n"+
"}\n"+
"\n"