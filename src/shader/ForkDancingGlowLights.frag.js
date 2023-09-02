// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var ForkDancingGlowLights_frag =
"// https://www.shadertoy.com/view/DtsBWH\n"+
"// Created by QuantumSuper\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"uniform float iGlobalTime;\n"+
"uniform float iTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"uniform vec2 iFrame;\n"+
"varying vec2 vUv;\n"+
"\n"+
"// Fork: Dancing Glow Lights 0.1.230824 by QuantumSuper\n"+
"// Forked from Glow Lights 0.5.230821 by QuantumSuper\n"+
"// auto-vj of a 2.5d arrangement of lights & particles circling an invisible sphere\n"+
"//\n"+
"// - use with music in iAudioData -\n"+
"\n"+
"#define PI 3.14159265359\n"+
"#define aTime 2.5*iGlobalTime\n"+
"vec4 fft, ffts; //compressed frequency amplitudes\n"+
"\n"+
"mat2 rotM(float r){float c = cos(r), s = sin(r); return mat2(c,s,-s,c);} //2D rotation matrix\n"+
"float hash21(vec2 p){p = fract(p*vec2(13.81,741.76)); p += dot(p, p+42.23); return fract(p.x*p.y);} //pseudorandom generator, cf. The Art of Code on youtu.be/rvDo9LvfoVE\n"+
"\n"+
"void compressFft(){ //v1.2, compress sound in iAudioData to simplified amplitude estimations by frequency-range\n"+
"fft = vec4(0), ffts = vec4(0);\n"+
"\n"+
"// Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)\n"+
"for (int n=0;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 0-258Hz\n"+
"for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz\n"+
"for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz\n"+
"for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz\n"+
"for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample\n"+
"for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample\n"+
"fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz\n"+
"ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness\n"+
"fft /= vec4(3,8,8,5); ffts /= vec4(2,3,3,23); //normalize\n"+
"\n"+
"//for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //limiter? workaround attempt for VirtualDJ\n"+
"}\n"+
"\n"+
"float particle(vec2 p){ //single particle shape\n"+
"return smoothstep( .1, .0, length(p)) * smoothstep( .1, .06, length(p-vec2(0.,.02)));\n"+
"}\n"+
"\n"+
"float particleLayer(vec2 p){ //pseudo-random 2d particle plane\n"+
"float id = hash21(floor(p));\n"+
"return smoothstep(0.,1.,id) *\n"+
"particle((fract(p)-vec2(.5+.4*cos(id*iGlobalTime),.5+.4*sin(.8*id*iGlobalTime))) * rotM((id-fft.x)*2.*PI)/vec2(cos(.5*id*iTime),1));\n"+
"}\n"+
"\n"+
"void main() {\n"+
"\n"+
"// General initializations\n"+
"compressFft(); //initializes fft, ffts\n"+
"//vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); //long edge -1 to 1, square aspect ratio\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"vec3 col = vec3(0);\n"+
"\n"+
"// Center orbs\n"+
"vec3 p, camPos = vec3(0,0,-1.3+(.3*sin(aTime/16.))); //vec3 camDir = vec3(0,0,1);\n"+
"float v1, v2, a = 11.;\n"+
"for (float n=1.;n<a;n++){\n"+
"v1 = aTime + n/a*PI*4. - fft.x*n/a*1.;\n"+
"v2 = iGlobalTime + n/a*PI + fft.y*mod(1.-n*2./a,2.)*1.;\n"+
"p = vec3( cos(v1)*cos(v2), sin(v1)*cos(v2), sin(v2)) * .5*max(ffts.w,fft.x); //parametric sphere\n"+
"p.yz *= rotM(n); //vary orientation\n"+
"col += 1./((p.z-camPos.z)*(p.z-camPos.z)+dot(p.xy,p.xy)) * //vary brightness with distance\n"+
".001*(.8+1.*fft.x*fft.x) / max( .001, length(uv-camPos.xy-p.xy/(p.z-camPos.z)) - .02/(p.z-camPos.z)) * //orb shape, vary size with distance\n"+
"(.5 + clamp( .01/max( .001, length(uv-camPos.xy-p.xy/(p.z-camPos.z)+.005*normalize(p.xy))), .0, .9)) * //light spot\n"+
"(vec3(mod(n+.5,2.),mod(n,2.),mod(n*PI,2.))*ffts.xyz*.5 + .5*vec3(ffts.x<=ffts.y,ffts.y<=ffts.z,ffts.z<=ffts.x)); //color\n"+
"}\n"+
"\n"+
"// Particle layers\n"+
"uv *= rotM(iGlobalTime*.1-.5*length(uv)); //rotate inner faster\n"+
"float aFrac, amp = 0.;\n"+
"for (float n=0.;n<4.;n++){\n"+
"aFrac = fract(-.05*iGlobalTime+.25*n)-.02*fft.w*fft.w*fft.w;\n"+
"amp += 1.4*(.2+.8*fft.z)*particleLayer( (uv*mix(1.,length(uv),ffts.w)+n*vec2(.1,.05))*25.*aFrac) * smoothstep(1.,.33,aFrac) * (.1+.9*smoothstep(.33,.66,aFrac));\n"+
"\n"+
"}\n"+
"col *= (1. + amp*40.*(1.+.5*fft.x*fft.x*fft.x/abs(length(uv)-fract(aTime)*1.15))); //expanding particle flash rings\n"+
"col += .05*step(.95, fft.x)*hash21(vec2(aTime,iFrame))*mod(float(iFrame),2.)/abs(length(uv)-fract(aTime+.1)*1.15); //expanding large flash rings\n"+
"\n"+
"// Finalizations\n"+
"col *= .3*hash21(uv*iGlobalTime) + .7; //noise\n"+
"col -= length(uv) * .005; //vignette\n"+
"col = pow(col, vec3(.4545)); //gamma correction\n"+
"gl_FragColor = vec4(col,1.);\n"+
"}\n"+
"\n"+
"\n"+
"\n"