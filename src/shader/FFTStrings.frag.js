// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var FFTStrings_frag =
"// https://www.shadertoy.com/view/4lyBR3\n"+
"// Created by RaduBT\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform float iTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"// lots of inspiration from IQ and hg_sdf\n"+
"\n"+
"const float PI = 3.14159265359;\n"+
"const int MAX_MARCHING_STEPS = 50;\n"+
"const float EPSILON = 0.0001;\n"+
"\n"+
"vec2 rotate2d(vec2 v, float a) {\n"+
"return vec2(v.x * cos(a) - v.y * sin(a), v.y * cos(a) + v.x * sin(a));\n"+
"}\n"+
"\n"+
"// Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.\n"+
"// Read like this: R(p.xz, a) rotates 'x towards z'.\n"+
"void pR(inout vec2 p, float a) {\n"+
"p = cos(a)*p + sin(a)*vec2(p.y, -p.x);\n"+
"}\n"+
"\n"+
"float sdTorus( vec3 p, vec2 t ) {\n"+
"vec2 q = vec2(length(p.xz)-t.x,p.y);\n"+
"return length(q)-t.y;\n"+
"}\n"+
"\n"+
"float opTwist( vec3 p, float fftValue, float time ) {\n"+
"float c = cos((fftValue*1.5) *p.y);\n"+
"float s = sin((fftValue+0.5)*p.y);\n"+
"mat2  m = mat2(c,-s,s,c);\n"+
"vec3  q = vec3(m * p.xz, p.y);\n"+
"\n"+
"return sdTorus(q, vec2(abs(sin(iTime*0.1))+0.5*(fftValue*0.2), fftValue*0.0001));\n"+
"\n"+
"}\n"+
"\n"+
"float opRep( vec3 p, vec3 c ) {\n"+
"\n"+
"float idx = mod((floor((p.x)/c.x)), 32.0);\n"+
"float idy = mod((floor((p.y)/c.y)), 32.0);\n"+
"float idz = mod((floor((p.z)/c.z)), 32.0);\n"+
"\n"+
"float id = length(vec3(idx, idy, idz));\n"+
"\n"+
"float fftValue = (((texture( iAudioData, vec2(id+1.0, 0.0) ).x)) * 10.0);\n"+
"\n"+
"vec3 q = mod(p, c) - 0.5 * c;\n"+
"\n"+
"vec3 r = q;\n"+
"\n"+
"float rotationAmount = (id * 5.0) + (iGlobalTime * 2.0);\n"+
"\n"+
"bool xmod2 = mod(idx, 2.0) == 0.0;\n"+
"\n"+
"// offset even rows\n"+
"if (xmod2) {\n"+
"q.y += 1.5;\n"+
"r.y -= 1.5;\n"+
"}\n"+
"\n"+
"pR(q.xy, rotationAmount);\n"+
"pR(q.xz, rotationAmount * 0.1);\n"+
"\n"+
"float shape1 = opTwist(q, fftValue, iGlobalTime);\n"+
"\n"+
"if (xmod2) {\n"+
"\n"+
"pR(r.xy, rotationAmount);\n"+
"pR(r.xz, rotationAmount * 0.1);\n"+
"\n"+
"float shape2 = opTwist(r, fftValue, iGlobalTime);\n"+
"\n"+
"return min(shape1, shape2);\n"+
"\n"+
"} else {\n"+
"\n"+
"return shape1;\n"+
"\n"+
"}\n"+
"}\n"+
"\n"+
"\n"+
"float sceneSDF(vec3 samplePoint) {\n"+
"return opRep(samplePoint, vec3(3.0, 3.0, 3.0));\n"+
"}\n"+
"\n"+
"vec3 castRay(vec3 pos, vec3 dir) {\n"+
"for (int i = 0; i < MAX_MARCHING_STEPS; i++) {\n"+
"float dist = sceneSDF(pos);\n"+
"if (dist < EPSILON) {\n"+
"return pos;\n"+
"}\n"+
"pos += dist * dir;\n"+
"}\n"+
"return pos;\n"+
"}\n"+
"\n"+
"\n"+
"float lightPointDiffuse(vec3 pos, vec3 lightPos) {\n"+
"float lightDist = length(lightPos - pos);\n"+
"float color = 3.0 / (lightDist * lightDist);\n"+
"return max(0.0, color);\n"+
"}\n"+
"\n"+
"void main() {\n"+
"vec2 uv =  -1.0 + 2.0 *vUv;//+.75;\n"+
"float fft = ( iAudioData, vec2(uv.x,uv.y) ).x;\n"+
"fft = 0.9*fft;\n"+
"\n"+
"//vec4 mousePos = (iMouse / iResolution.xyxy) * 2.0 - 1.0;\n"+
"/*\n"+
"\n"+
"vec4 mousePos = vec2(PI / 2.0, PI / 2.0).xyxy;\n"+
"\n"+
"if (iMouse.zw == vec2(0.0)) {\n"+
"mousePos.xy = vec2(0.5, -0.2);\n"+
"}\n"+
"*/\n"+
"//vec2 screenPos = (vUv.xy / iResolution.xy) * 2.0 - 1.0;\n"+
"vec2 screenPos =uv;// vUv.xy * 2.0 - 1.0;\n"+
"\n"+
"vec3 cameraPos = vec3(0.0, 0.0, -8.0);\n"+
"\n"+
"vec3 cameraDir = vec3(0.0, 0.0, 1.0);\n"+
"vec3 planeU = vec3(2.0, 0.0, 0.0);\n"+
"vec3 planeV = vec3(0.0, iResolution.y / iResolution.x * 2.0, 0.0);\n"+
"vec3 rayDir = normalize(cameraDir + screenPos.x * planeU + screenPos.y * planeV);\n"+
"\n"+
"cameraPos.yz = rotate2d(cameraPos.yz, iGlobalTime);\n"+
"cameraPos.xz = rotate2d(cameraPos.xz, iGlobalTime);\n"+
"//rayDir.yz = rotate2d(rayDir.yz,iGlobalTime*fft);\n"+
"\n"+
"//cameraPos.xz = rotate2d(cameraPos.xz, iGlobalTime*fft);\n"+
"//rayDir.xz = rotate2d(rayDir.xz, iGlobalTime*fft);\n"+
"\n"+
"//cameraPos.zy += iTime;\n"+
"\n"+
"/*\n"+
"cameraPos.yz = rotate2d(cameraPos.yz, mousePos.y);\n"+
"rayDir.yz = rotate2d(rayDir.yz, mousePos.y);\n"+
"\n"+
"cameraPos.xz = rotate2d(cameraPos.xz, mousePos.x);\n"+
"rayDir.xz = rotate2d(rayDir.xz, mousePos.x);\n"+
"\n"+
"cameraPos.zy += iTime;\n"+
"*/\n"+
"vec3 rayPos = castRay(cameraPos, rayDir);\n"+
"\n"+
"// base color\n"+
"vec3 color = vec3(0.01, 0.23, 0.43);\n"+
"\n"+
"color += (rayDir*0.02);\n"+
"\n"+
"vec3 lightPos = cameraPos;\n"+
"\n"+
"color *= 10.0 * lightPointDiffuse(rayPos, lightPos) * 10.0;\n"+
"\n"+
"color = pow(color, vec3(0.4));\n"+
"\n"+
"gl_FragColor = vec4(color, 1.0);\n"+
"//gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * (20.+fft);\n"+
"//gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * vec4(vec3(255.*fft*(1.- sin(iTime)),50.*fft*sin(iTime),20.*fft*cos(iTime)),1.);\n"+
"//gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * vec4(vec3(150.*(1.5-(cos(50.*iTime*fft)*sin(100.*iTime/fft))), 75.*(1.- sin(iGlobalTime)), cos(iGlobalTime)*100.*fft),1.);\n"+
"}\n"