// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var AbstractMusic_frag =
"// https://www.shadertoy.com/view/4stSRs\n"+
"// Abstract Music by MatHack\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"//Fast Code, No Optim and clean ;) !\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"float freqs[16];\n"+
"\n"+
"\n"+
"mat2 rotate2d(float angle){\n"+
"return mat2(cos(angle),-sin(angle),\n"+
"sin(angle),cos(angle));\n"+
"}\n"+
"\n"+
"float Hash2d(vec2 uv)\n"+
"{\n"+
"float f = uv.x + uv.y * 47.0;\n"+
"return fract(cos(f*3.333)*100003.9);\n"+
"}\n"+
"float Hash3d(vec3 uv)\n"+
"{\n"+
"float f = uv.x + uv.y * 37.0 + uv.z * 521.0;\n"+
"return fract(cos(f*3.333)*100003.9);\n"+
"}\n"+
"float mixP(float f0, float f1, float a)\n"+
"{\n"+
"return mix(f0, f1, a*a*(3.0-2.0*a));\n"+
"}\n"+
"const vec2 zeroOne = vec2(0.0, 1.0);\n"+
"float noise2d(vec2 uv)\n"+
"{\n"+
"vec2 fr = fract(uv.xy);\n"+
"vec2 fl = floor(uv.xy);\n"+
"float h00 = Hash2d(fl);\n"+
"float h10 = Hash2d(fl + zeroOne.yx);\n"+
"float h01 = Hash2d(fl + zeroOne);\n"+
"float h11 = Hash2d(fl + zeroOne.yy);\n"+
"return mixP(mixP(h00, h10, fr.x), mixP(h01, h11, fr.x), fr.y);\n"+
"}\n"+
"float noise(vec3 uv)\n"+
"{\n"+
"vec3 fr = fract(uv.xyz);\n"+
"vec3 fl = floor(uv.xyz);\n"+
"float h000 = Hash3d(fl);\n"+
"float h100 = Hash3d(fl + zeroOne.yxx);\n"+
"float h010 = Hash3d(fl + zeroOne.xyx);\n"+
"float h110 = Hash3d(fl + zeroOne.yyx);\n"+
"float h001 = Hash3d(fl + zeroOne.xxy);\n"+
"float h101 = Hash3d(fl + zeroOne.yxy);\n"+
"float h011 = Hash3d(fl + zeroOne.xyy);\n"+
"float h111 = Hash3d(fl + zeroOne.yyy);\n"+
"return mixP(\n"+
"mixP(mixP(h000, h100, fr.x), mixP(h010, h110, fr.x), fr.y),\n"+
"mixP(mixP(h001, h101, fr.x), mixP(h011, h111, fr.x), fr.y)\n"+
", fr.z);\n"+
"}\n"+
"\n"+
"\n"+
"float PI=3.14159265;\n"+
"\n"+
"void main()\n"+
"{\n"+
"//vec2 uv = fragCoord.xy / iResolution.xx;\n"+
"vec2 uv = vUv;\n"+
"//vec2 mouse = iMouse.xy / iResolution.xy;\n"+
"vec2 uv2 =  -1.0 + 2.0 * uv;\n"+
"//uv2.y += 0.45;\n"+
"//uv2.xy -= (mouse*4.0) - 2.0;\n"+
"uv2.xy *= 4.5;\n"+
"\n"+
"float time = iGlobalTime + (2.0*freqs[0]);\n"+
"\n"+
"vec3 color = vec3(0.0);\n"+
"vec3 color2 = vec3(0.0);\n"+
"\n"+
"float nbPointX = 128.0;\n"+
"float nbPointY = 128.0;\n"+
"float resX =  (iResolution.x/nbPointX)/iResolution.x;\n"+
"float resY =  (iResolution.y/nbPointY)/iResolution.y;\n"+
"\n"+
"\n"+
"for( int i=0; i<16; i++ ){\n"+
"freqs[i] = clamp( 1.9*pow( texture( iAudioData, vec2( 0.05 + 0.5*float(i)/16.0, 0.25 ) ).x, 3.0 ), 0.0, 1.0 );\n"+
"\n"+
"float wave = sqrt(sin( (-(freqs[i]*noise2d(uv*10.0+ vec2(rotate2d(iGlobalTime)).xy ) )*3.1416) + ((uv2.x*uv2.x) + (uv2.y*uv2.y)) ) );\n"+
"\n"+
"vec2 v = rotate2d(iGlobalTime) * (uv * 2.0);\n"+
"\n"+
"wave = smoothstep(0.8, 1.0, wave);\n"+
"color2 += wave * (vec3(v.x, v.y, 1.7-v.y*v.x)*0.08) * freqs[i];\n"+
"\n"+
"float endPixelX = (1.0/iResolution.x)*(wave*1.0);\n"+
"float endPixelY = (1.0/iResolution.x)*(wave*1.0);\n"+
"//Grid 1\n"+
"if(mod(uv.x, resX) >= 0.0 && mod(uv.x, resX) <= endPixelX && mod(uv.y, resY) >= 0.0 && mod(uv.y, resY) <= endPixelY){\n"+
"color2 += (vec3(v.x, v.y, 1.7-v.y*v.x)*0.08) ;\n"+
"}\n"+
"\n"+
"\n"+
"wave = smoothstep(0.99999, 1.0, wave);\n"+
"color2 += wave * vec3(0.2) ;\n"+
"\n"+
"\n"+
"}\n"+
"gl_FragColor =  vec4(color2, 1.0);\n"+
"gl_FragColor *= pow(max(gl_FragColor - .2, 0.0), vec4(1.4)) * .5;\n"+
"\n"+
"\n"+
"\n"+
"}\n"+
"\n"