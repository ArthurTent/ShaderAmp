// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var DDDAudioVisualizer_frag =
"// https://www.shadertoy.com/view/dtl3Dr\n"+
"// '3D Audio Visualizer' by kishimisu\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"/* '3D Audio Visualizer' by @kishimisu - 2022 (https://www.shadertoy.com/view/dtl3Dr)\n"+
"Wait for the drop!\n"+
"\n"+
"The lights of this scene react live to the audio input.\n"+
"I'm trying to find interesting ways to extract audio\n"+
"features from the audio's FFT to animate my scenes.\n"+
"\n"+
"Each light is associated to a random frequency range,\n"+
"ranging from bass (distant lights) to high (close lights)\n"+
"\n"+
"Really happy with this result!\n"+
"*/\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define st(t1, t2, v1, v2) mix(v1, v2, smoothstep(t1, t2, iGlobalTime))\n"+
"#define light(d, att) 1. / (1.+pow(abs(d*att), 1.3))\n"+
"\n"+
"/* Audio-related functions */\n"+
"#define getLevel(x) (texelFetch(iAudioData, ivec2(int(x*512.), 0), 0).r)\n"+
"#define logX(x,a,c) (1./(exp(-a*(x-c))+1.))\n"+
"\n"+
"float logisticAmp(float amp){\n"+
"float c = st(0., 10., .8, 1.), a = 20.;\n"+
"return (logX(amp, a, c) - logX(0.0, a, c)) / (logX(1.0, a, c) - logX(0.0, a, c));\n"+
"}\n"+
"float getPitch(float freq, float octave){\n"+
"freq = pow(2., freq)   * 261.;\n"+
"freq = pow(2., octave) * freq / 12000.;\n"+
"return logisticAmp(getLevel(freq));\n"+
"}\n"+
"float getVol(float samples) {\n"+
"float avg = 0.;\n"+
"for (float i = 0.; i < samples; i++) avg += getLevel(i/samples);\n"+
"return avg / samples;\n"+
"}\n"+
"/* ----------------------- */\n"+
"\n"+
"float sdBox( vec3 p, vec3 b ) {\n"+
"vec3 q = abs(p) - b;\n"+
"return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);\n"+
"}\n"+
"float hash13(vec3 p3) {\n"+
"p3  = fract(p3 * .1031);\n"+
"p3 += dot(p3, p3.zyx + 31.32);\n"+
"return fract((p3.x + p3.y) * p3.z);\n"+
"}\n"+
"\n"+
"void main() {\n"+
"//vec2 uv   = (2.*fragCoord-iResolution.xy)/iResolution.y;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"\n"+
"vec3 col  = vec3(0.);\n"+
"float vol = getVol(8.);\n"+
"\n"+
"float hasSound = 1.; // Used only to avoid a black preview image\n"+
"if (iGlobalTime <= 0.) hasSound = .0;\n"+
"\n"+
"for (float i = 0., t = 0.; i < 30.; i++) {\n"+
"vec3 p  = t*normalize(vec3(uv, 1.));\n"+
"\n"+
"vec3 id = floor(abs(p));\n"+
"vec3 q  = fract(p)-.5;\n"+
"\n"+
"float boxRep = sdBox(q, vec3(.3));\n"+
"float boxCtn = sdBox(p, vec3(7.5, 6.5, 16.5));\n"+
"\n"+
"float dst = max(boxRep, abs(boxCtn) - vol*.2);\n"+
"float freq = smoothstep(16., 0., id.z)*3.*hasSound + hash13(id)*1.5;\n"+
"\n"+
"col += vec3(.8,.6,1) * (cos(id*.4 + vec3(0,1,2) + iGlobalTime) + 2.)\n"+
"* light(dst, 10. - vol)\n"+
"* getPitch(freq, 1.);\n"+
"\n"+
"t += dst;\n"+
"}\n"+
"\n"+
"gl_FragColor = vec4(col,1.0);\n"+
"}\n"