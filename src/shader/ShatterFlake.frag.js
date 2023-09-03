// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var ShatterFlake_frag =
"// https://www.shadertoy.com/view/ctBSWt\n"+
"// Created by QuantumSuper\n"+
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
"// ShatterFlake 0.62.230218\n"+
"// auto-vj with snowflake symmetry\n"+
"//\n"+
"// - use with music in iAudioData -\n"+
"\n"+
"#define PI 3.14159265359\n"+
"vec4 fft, ffts;\n"+
"\n"+
"void compressFft(){ //compress sound in iAudioData to simple frequency-range amplitude estimations\n"+
"fft = vec4(0), ffts = vec4(0);\n"+
"\n"+
"// Sound (assume sound texture with 44.1kHz in 512 texels, cf. shadertoy.com/view/Xds3Rr)\n"+
"for (int n=1;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 86-258Hz\n"+
"for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz\n"+
"for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz\n"+
"for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz\n"+
"for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample\n"+
"for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample\n"+
"fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz\n"+
"ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness\n"+
"fft /= vec4(2,8,7,4); ffts /= vec4(2,3,3,21); //normalize\n"+
"fft.x = step(.9,fft.x); //weaken weaker sounds, hard limit\n"+
"}\n"+
"\n"+
"mat2 rotM(float rad){ // rotation matrix in 2D\n"+
"return mat2(cos(rad),-sin(rad),sin(rad),cos(rad));\n"+
"}\n"+
"\n"+
"float hash21(vec2 p){ //pseudorandom generator, see The Art of Code on youtu.be/rvDo9LvfoVE\n"+
"p = fract(p*vec2(13.81, 741.76));\n"+
"p += dot(p, p+42.23);\n"+
"return fract(p.x*p.y);\n"+
"}\n"+
"\n"+
"float line(vec2 p, vec2 a, vec2 b){ //a line between a and b in domain of p\n"+
"vec2 ab = b-a;\n"+
"return .005/length(a+(ab)*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.)-p);\n"+
"}\n"+
"\n"+
"float rect(vec2 c, vec2 dim){ //c at center of rectangle dim\n"+
"vec2 dv = abs(c/dim)-.5; //dist per axis\n"+
"return 1./max(.0,max(dv.x+dv.y,max(dv.x,dv.y)));\n"+
"}\n"+
"\n"+
"float flakeLine(vec2 p, vec2 a, vec2 b){ //hexagonal prism geometry for line\n"+
"return line(abs(p), a, b) + line(abs(p*rotM(PI/3.)), a, b) + line(abs(p*rotM(-PI/3.)), a, b);\n"+
"}\n"+
"\n"+
"float flakeRect(vec2 p, vec2 c, vec2 d){ //hexagonal prism geometry for rectangle\n"+
"return rect(abs(p)-c, d) + rect(abs(p*rotM(PI/3.))-c, d) + rect(abs(p*rotM(-PI/3.))-c, d);\n"+
"}\n"+
"\n"+
"void main() {\n"+
"// General initializations\n"+
"// vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); // viewport max -1..1\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"float aTime = 1.066667*iGlobalTime;\n"+
"compressFft(); //initializes fft, ffts\n"+
"\n"+
"// View manipulation\n"+
"float amp = .2*fft.w*hash21(floor(300.12*uv+42.)*cos(aTime)); //noise\n"+
"if (abs(uv.y)<.2*fft.z) uv*=.5+.5*fft.z*10.; //horizontal bar\n"+
"uv *= rotM(sin(aTime/8.))*(1.+.2*sin(aTime/4.)); //rotate & zoom\n"+
"uv = 2.*fract(.5*uv+.5)-1.; //edge repeat\n"+
"\n"+
"// Generate pattern parameters\n"+
"vec2 r = vec2(42.23*floor(aTime), floor(aTime));\n"+
"vec2 r2 = vec2(42.23*ceil(aTime), ceil(aTime));\n"+
"vec2 a1 = vec2(hash21(r),hash21(r*2.345));\n"+
"vec2 a2 = vec2(hash21(r2),hash21(r2*2.345));\n"+
"vec2 a = smoothstep(a1,a2,a1+(-a1+a2)*fract(aTime)); //smoothstepped linear outwards movement\n"+
"vec2 b = .5*fft.xw;\n"+
"if(length(b)<.5) b = vec2(hash21(sin(r)),hash21(r*r))*(.7+.3*fft.w); //default on \"calm\" b in case of low volume\n"+
"\n"+
"// Draw lines\n"+
"amp += flakeLine(2.5*uv*rotM(-aTime/4.),a,b)+flakeLine(1.25*uv*rotM(-aTime/4.),a,b);\n"+
"vec3 col = vec3(amp*amp); //light falloff correction\n"+
"col *= vec3(ffts.x<=ffts.y,ffts.y<=ffts.z,ffts.z<=ffts.x); //colors;\n"+
"\n"+
"// Draw rectangles\n"+
"amp = fft.x*smoothstep(0.,100., flakeRect(uv, vec2(sin(a1.x),cos(a1.y)), vec2(.1)+a2*(.66+.33*fract(aTime))));\n"+
"col += vec3(amp);\n"+
"\n"+
"// Output\n"+
"col = pow(col, vec3(.4545)); //gamma correction\n"+
"gl_FragColor = vec4(col,1.0);\n"+
"gl_FragColor += pow(max(gl_FragColor - .4, 0.15), vec4(1.4))*vec4(vec3(0.5-(cos(iGlobalTime)+sin(iGlobalTime)), sin(iGlobalTime)*.5, cos(iGlobalTime)*5.),1.);\n"+
"\n"+
"}\n"