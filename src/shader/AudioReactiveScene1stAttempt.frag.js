// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var AudioReactiveScene1stAttempt_frag =
"// https://www.shadertoy.com/view/cslSRr\n"+
"// Audio-reactive scene 1st attempt by kishimisu\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"/* @kishimisu - 2022\n"+
"\n"+
"First attempt at raymarching scenes\n"+
"that react to audio input !\n"+
"\n"+
"I realized that it's really hard\n"+
"to isolate the notes in order to\n"+
"have different parts of the scene\n"+
"react to different sounds without\n"+
"manual fine-tuning. I'll try to\n"+
"improve on it, any reference on\n"+
"this subject is welcome !\n"+
"*/\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"\n"+
"varying vec2 vUv;\n"+
"// Set to 1 if you have a really good PC\n"+
"#define HIGH_PERF 0\n"+
"\n"+
"#if HIGH_PERF\n"+
"#define iterations           50.\n"+
"#define max_dist            500.\n"+
"// numbers of neighbor lights to check, very expensive so default to 0.\n"+
"#define light_neighbors_check 1.\n"+
"#else\n"+
"#define iterations           30.\n"+
"#define max_dist            100.\n"+
"#define light_neighbors_check 0.\n"+
"#endif\n"+
"\n"+
"float lightRep = 12.;    // lights spacing\n"+
"float attenuation = 20.; // light attenuation\n"+
"\n"+
"#define rot(a) mat2(cos(a), -sin(a), sin(a), cos(a))\n"+
"#define rep(p,r) (mod(p+r/2.,r)-r/2.)\n"+
"#define rid(p,r) floor((p+r/2.)/r)\n"+
"#define hash33(p) fract(sin( (p) * mat3( 127.1,311.7,74.7 , 269.5,183.3,246.1 , 113.5,271.9,124.6) ) *43758.5453123)\n"+
"\n"+
"float hash11(float p) {\n"+
"p = fract(p * .1031);\n"+
"p *= p + 33.33;\n"+
"return fract(2.*p*p);\n"+
"}\n"+
"\n"+
"vec3 getLight(float d, vec3 color) {\n"+
"return max(vec3(0.), color / (1. + pow(abs(d * attenuation), 1.3)) - .001*0.);\n"+
"}\n"+
"\n"+
"float getLevel(float x) {\n"+
"return texelFetch(iAudioData, ivec2(int(x*512.), 0), 0).r;\n"+
"}\n"+
"\n"+
"// The next functions are borrowed from https://www.shadertoy.com/view/7lVBRw\n"+
"// because they seem to better retrieve the musical aspects from the FFT\n"+
"float getPitch(float freq, int octave){\n"+
"return getLevel(pow(2.0, float(octave)) * freq / 12000.0);\n"+
"}\n"+
"float logX(float x, float a, float c){\n"+
"return 1.0 / (exp(-a*(x-c)) + 1.0);\n"+
"}\n"+
"float logisticAmp(float amp){\n"+
"float c = 1.0 - (0.25);\n"+
"float a = 20.0 * (1.0 - iMouse.y / iResolution.y);\n"+
"a = 20.;\n"+
"return (logX(amp, a, c) - logX(0.0, a, c)) / (logX(1.0, a, c) - logX(0.0, a, c));\n"+
"}\n"+
"float getAudioIntensityAt(float x) {\n"+
"x = abs(fract(x));\n"+
"float freq = pow(2., x*3.) * 261.;\n"+
"//return iGlobalTime <= 0. ? : logisticAmp(getPitch(freq, 1));\n"+
"return hash11(x) ;\n"+
"}\n"+
"\n"+
"float map(vec3 p, inout vec3 col) {\n"+
"//p.z = abs(p.z);\n"+
"p.y = abs(p.y) - 13. - getAudioIntensityAt(0.)*1.2;\n"+
"\n"+
"vec2 id = rid(p.xz, 2.);\n"+
"p.y += sin( length(sin(id/5.23 - iGlobalTime) * cos(id/10.45 + iGlobalTime))  ) * 8.;\n"+
"\n"+
"vec3 fp = rep(p, lightRep);\n"+
"fp.y = p.y;\n"+
"\n"+
"const float r = light_neighbors_check;\n"+
"for (float j = -r; j <= r; j++)\n"+
"for (float i = -r; i <= r; i++) {\n"+
"vec3 off = vec3(i, 0., j) * lightRep;\n"+
"vec3 nid = rid(p - off, lightRep);\n"+
"float d = length( fp + off )-1.;\n"+
"\n"+
"// assign more red to lower frequencies, more green to middle and more blue to upper frequencies\n"+
"vec3 c = hash33(nid);\n"+
"vec3 light = vec3(getAudioIntensityAt(c.r*.33), getAudioIntensityAt(c.g*.33+.33), 4.*getAudioIntensityAt(c.b*.33+.67));\n"+
"// make the intensity vary depending on a random frequency (always the same for each light)\n"+
"light *= getAudioIntensityAt(c.r+c.b+c.g)+(c.r+c.b+c.g);\n"+
"col += getLight(d, light);\n"+
"}\n"+
"\n"+
"p.xz = rep(p.xz, 2.);\n"+
"return length(p) - 1.;\n"+
"}\n"+
"\n"+
"void initRayOriginAndDirection(vec2 uv, inout vec3 ro, inout vec3 rd) {\n"+
"vec2 m = iMouse.xy/iResolution.xy*2.-1.;\n"+
"ro = vec3(iGlobalTime*8. -6., 0., 0.);\n"+
"\n"+
"float t = -iGlobalTime*.15*0.;\n"+
"vec3 f = normalize(vec3(cos(t),0,sin(t)));\n"+
"vec3 r = normalize(cross(vec3(0,1,0), f));\n"+
"rd = normalize(f + uv.x*r + uv.y*cross(f, r));\n"+
"}\n"+
"\n"+
"void main() {\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"vec3 p, ro, rd, col;\n"+
"\n"+
"initRayOriginAndDirection(uv, ro, rd);\n"+
"\n"+
"float t = 0.;\n"+
"\n"+
"for (float i = 0.; i < iterations; i++) {\n"+
"p = ro + t*rd;\n"+
"//p.yz *= rot(-t*mix(-.01, .01, sin(iGlobalTime*.1)*.5+.5));\n"+
"t += map(p, col);\n"+
"if (t > max_dist) break;\n"+
"}\n"+
"\n"+
"col = pow(col, vec3(.45));\n"+
"gl_FragColor = vec4(col, 1.0);\n"+
"}\n"