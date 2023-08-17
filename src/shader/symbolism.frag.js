// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var symbolism_frag =
"// https://www.shadertoy.com/view/DsVXz1\n"+
"// Symbolism 0.74.230405 by QuantumSuper\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"// auto-vj with glyphs, colors, and relations\n"+
"// inspired by alro's Neon Love: https://www.shadertoy.com/view/WdK3Dz\n"+
"//\n"+
"// - use with music in iChannel0 -\n"+
"//\n"+
"\n"+
"#define PI 3.14159265359\n"+
"#define aTime 2.133333*iGlobalTime\n"+
"vec4 fft, ffts; //compressed frequency amplitudes\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData; // nice hint for loading tAudio --> https://threejs.org/examples/webaudio_visualizer\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform sampler2D iVideo;\n"+
"\n"+
"varying vec2 vUv;\n"+
"\n"+
"\n"+
"void compressFft(){ //compress sound in iChannel0 to simplified amplitude estimations by frequency-range\n"+
"fft = vec4(0), ffts = vec4(0);\n"+
"\n"+
"// Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)\n"+
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
"//fft.yzw*=1.3;ffts*=1.3; //debug factor for VirtualDJ (?limiter related?)\n"+
"}\n"+
"\n"+
"mat2 rotM(float a){float c = cos(a), s = sin(a); return mat2(c,s,-s,c);}\n"+
"\n"+
"float hash21(vec2 p){ //pseudorandom generator, see The Art of Code on youtu.be/rvDo9LvfoVE\n"+
"p = fract(p*vec2(13.81, 741.76));\n"+
"p += dot(p, p+42.23);\n"+
"return fract(p.x*p.y);\n"+
"}\n"+
"\n"+
"vec2 getHeart(float t){ //source: https://mathworld.wolfram.com/HeartCurve.html\n"+
"return vec2( 16.*sin(t)*sin(t)*sin(t), //x\n"+
"13.*cos(t) - 5.*cos(2.*t) - 2.*cos(3.*t) - cos(4.*t)+1.) //y + shift\n"+
"/50.; //scale factor\n"+
"}\n"+
"\n"+
"vec2 getEight(float t){ //source: https://mathworld.wolfram.com/Lemniscate.html\n"+
"return .5*cos(t)/(1.+sin(t)*sin(t))*vec2(1.,sin(t))/1.2;\n"+
"}\n"+
"\n"+
"vec2 getHArrow(float t){ //three lines resembling half an arrow\n"+
"t = mod(t,PI); //one way\n"+
"return (t<.15*PI)? vec2(-.6,.67-sin(t-.15*PI))/3.5 : (t<.8*PI)? vec2(-cos(t),cos(t))/3.5 : vec2(sin(t)+.2,-.8)/3.5;\n"+
"}\n"+
"\n"+
"vec2 getCurve(float t){ //a curving line segment\n"+
"t = fract(sin(t));\n"+
"t = (t<.01||t>.99)? 42.:t; //fix edge cases\n"+
"return vec2(.7*t,t*t)/4.;\n"+
"}\n"+
"\n"+
"float getRing(vec2 p){ //simple ring with radius 1 about 0,0\n"+
"return abs(length(p)-1.);\n"+
"}\n"+
"\n"+
"float getLine(vec2 p, vec2 a, vec2 b){ //source: https://iquilezles.org/articles/distfunctions2d/\n"+
"vec2 pa = p-a, ba = b-a;\n"+
"float h = clamp( dot(pa,ba)/dot(ba,ba), 0., 1.);\n"+
"return 4.*length( pa - ba*h ); //factor 4 for visual style\n"+
"}\n"+
"\n"+
"float lightUp(float dist){ //light around dist=0\n"+
"return 6.*smoothstep(.025, .0, dist)+clamp(.00008/dist/dist,.0,1.)+(1.+fft.w)*.0001/dist; //combined semi-hard shape with semi-soft & soft glow\n"+
"}\n"+
"\n"+
"vec3 getCol(float id){ //color definitions\n"+
"vec3 col = vec3(1.);\n"+
"id *= (id<1.)? 16. : 1.; //indirect overload\n"+
"\n"+
"if (id<1. ){ //random for id==0.\n"+
"id = hash21(42.123+iResolution.xy*.1*ceil(aTime/4.+1.));\n"+
"col = vec3(id,fract(id*10.),fract(id*100.))*255.;}\n"+
"else if (id<2. ) col = vec3(252,157,  0); //miami orange\n"+
"else if (id<3. ) col = vec3( 26,246,138); //miami green\n"+
"else if (id<4. ) col = vec3(244,  0,204); //vw pink2\n"+
"else if (id<5. ) col = vec3( 30, 29,215); //vw blue2\n"+
"else if (id<6. ) col = vec3(231, 15, 20); //arena red\n"+
"else if (id<7. ) col = vec3(103,211,225); //arena blue\n"+
"else if (id<8. ) col = vec3( 54, 52, 80); //light lilac\n"+
"else if (id<9. ) col = vec3(254,159,167); //light rose\n"+
"else if (id<10.) col = vec3( 30,248,236); //magic turquoise\n"+
"else if (id<11.) col = vec3(155, 11, 15); //splatter red\n"+
"else if (id<12.) col = vec3( 11, 45,100); //king blue\n"+
"else if (id<13.) col = vec3(141,245,180); //nordic green\n"+
"else if (id<14.) col = vec3(131, 58,187); //nordic violet\n"+
"else if (id<15.) col = vec3(241,214,109); //bambus yellow\n"+
"else if (id<16.) col = vec3(  0,142,124); //bambus green\n"+
"\n"+
"return clamp(col/255.+min(ffts.x,min(ffts.y,ffts.z))-ffts.xyz,.0,1.); //alter color by ffts.xyz\n"+
"}\n"+
"\n"+
"vec3 makeSym(vec2 p, float id){ //glyph definitions (lots of redundant code but individually tweakable), reference: https://seechangehappen.co.uk/gender-identity-pride-flags-glyphs-symbols-and-icons/\n"+
"vec3 col = vec3(0);\n"+
"id *= (abs(id)<1.)? (id<.0)? 8.:20. : 1.; //indirect overload\n"+
"float cid1 = hash21(vec2(.123*ceil(aTime/8.), id+id)); //color 1\n"+
"float cid2 = (id<.0)? hash21(vec2(.456*ceil(aTime/8.), id*id)) : 0.; //color 2\n"+
"float t = aTime;\n"+
"\n"+
"if (id<-3.){ //heart, animated\n"+
"for (float n=0.;n<33.;n++){ //apperance is framerate dependent, adjust loop length, t increment, and intensity respectively\n"+
"t -= .05;\n"+
"col += getCol(cid1)*lightUp(length(p-getHeart(t)));\n"+
"col += getCol(cid2)*lightUp(length(p-getHeart(t+PI)));\n"+
"}\n"+
"}\n"+
"else if (id<-2.){ //polyheart, animated\n"+
"float cid3 = hash21(vec2(.789*ceil(aTime/8.), id*id*id)); //color 3\n"+
"for (float n=0.;n<33.;n++){\n"+
"t -= .05;\n"+
"col += getCol(cid1)*lightUp(length(p-getHeart(t)));\n"+
"col += getCol(cid2)*lightUp(length(p-getHeart(t+PI)));\n"+
"col += getCol(cid3)*lightUp(length(p+vec2(.0,.03)-getEight(t)));\n"+
"}\n"+
"}\n"+
"else if (id<-1.){ //arrow, animated\n"+
"for (float n=0.;n<33.;n++){\n"+
"t -= .03;\n"+
"col += getCol(cid1)*lightUp(length(p-getHArrow(t)));\n"+
"col += getCol(cid2)*lightUp(length(-p.yx-getHArrow(t+PI/4.)));\n"+
"}\n"+
"}\n"+
"else if (id<0.){ //ace, animated\n"+
"p.y -= .08;\n"+
"for (float n=0.;n<33.;n++){\n"+
"t -= .05;\n"+
"col += getCol(cid1)*lightUp(length(-p-getHeart(t)));\n"+
"col += getCol(cid2)*lightUp(length(-p-getHeart(t+PI)));\n"+
"col += getCol(cid1)*lightUp(length(p+vec2(.2,.45)-getCurve(t)));\n"+
"col += getCol(cid2)*lightUp(length(vec2(-p.x+.2,p.y+.45)-getCurve(t+PI)));\n"+
"}\n"+
"}\n"+
"else if (id<1.){ //female\n"+
"p.y -= .12;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) ));\n"+
"}\n"+
"else if (id<2.){ //male\n"+
"p.y += .08;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.17), vec2(.37)) )+\n"+
"lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(.38,.22), vec2(.38)) ));\n"+
"}\n"+
"else if (id<3.){ //androgyne\n"+
"p.y += .1;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(-.1,.33), vec2(.1,.33)) )+\n"+
"lightUp( getLine( p, vec2(-.1,.42), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(.1,.42), vec2(.0,.5)) ));\n"+
"}\n"+
"else if (id<4.){ //agender\n"+
"p.y += .1;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(-.23,.0), vec2(.23,.0)) ));\n"+
"}\n"+
"else if (id<5.){ //neutrois\n"+
"p.y += .1;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) ));\n"+
"}\n"+
"else if (id<6.){ //intergender\n"+
"p.y -= .12;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.2,-.14), vec2(.38,-.32)) )+\n"+
"lightUp( getLine( p, vec2(.14,-.2), vec2(.32,-.38)) )+\n"+
"lightUp( getLine( p, vec2(.24,-.3), vec2(.16,-.38)) )+\n"+
"lightUp( getLine( p, vec2(.38,-.18), vec2(.38,-.32)) ));\n"+
"}\n"+
"else if (id<7.){ //transgender\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+\n"+
"lightUp( getLine( p, vec2(.17), vec2(.37)) )+\n"+
"lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(.38,.22), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(-.17,.17), vec2(-.37,.37)) )+\n"+
"lightUp( getLine( p, vec2(-.22,.38), vec2(-.38,.38)) )+\n"+
"lightUp( getLine( p, vec2(-.38,.22), vec2(-.38,.38)) )+\n"+
"lightUp( getLine( p, vec2(-.3,.18), vec2(-.18,.3)) ));\n"+
"}\n"+
"else if (id<8.){ //genderflux\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+\n"+
"lightUp( getLine( p, vec2(.17), vec2(.37)) )+\n"+
"lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(.38,.22), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(-.17,.17), vec2(-.35,.35)) )+\n"+
"lightUp( getLine( p, vec2(-.38,.25), vec2(-.17,.3)) )+\n"+
"lightUp( getLine( p, vec2(-.3,.17), vec2(-.25,.38)) ));\n"+
"}\n"+
"else if (id<9.){ //third gender\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(-.25,.0), vec2(-.35,.0)) )+\n"+
"lightUp( getLine( p, vec2(-.5,.1), vec2(-.5,-.1)) )+\n"+
"lightUp( getLine( p, vec2(-.5,.1), vec2(-.35,.0)) )+\n"+
"lightUp( getLine( p, vec2(-.35,.0), vec2(-.5,-.1)) ));\n"+
"}\n"+
"else if (id<10.){ //genderqueer\n"+
"p.y += .08;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.49)) )+\n"+
"lightUp( getLine( p, vec2(.1,.31), vec2(-.1,.43)) )+\n"+
"lightUp( getLine( p, vec2(.1,.43), vec2(-.1,.31)) ));\n"+
"}\n"+
"else if (id<11.){ //pangender\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.49)) )+\n"+
"lightUp( getLine( p, vec2(.1,.31), vec2(-.1,.43)) )+\n"+
"lightUp( getLine( p, vec2(.1,.43), vec2(-.1,.31)) )+\n"+
"lightUp( getLine( p, vec2(-.23,.0), vec2(.23,.0)) )+\n"+
"lightUp( getLine( p, vec2(.0,-.24), vec2(.0,-.5)) )+\n"+
"lightUp( getLine( p, vec2(-.1,-.33), vec2(.1,-.33)) )+\n"+
"lightUp( getLine( p, vec2(-.1,-.42), vec2(.0,-.5)) )+\n"+
"lightUp( getLine( p, vec2(.1,-.42), vec2(.0,-.5)) ));\n"+
"}\n"+
"else if (id<12.){ //epicene\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( length(2.*p) )+\n"+
"lightUp( getLine( p, vec2(-.235,.05), vec2(-.35,-.1)) )+\n"+
"lightUp( getLine( p, vec2(.235,-.05), vec2(.35,.1)) ));\n"+
"}\n"+
"else if (id<13.){ //demimale\n"+
"p.y += .08;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.17), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(.22,.38), vec2(.38)) ));\n"+
"}\n"+
"else if (id<14.){ //demifemale\n"+
"p.y -= .12;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(-.01,-.36)) ));\n"+
"}\n"+
"else if (id<15.){ //bigender female male\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+\n"+
"lightUp( getLine( p, vec2(.17), vec2(.37)) )+\n"+
"lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(.38,.22), vec2(.38)) ));\n"+
"}\n"+
"else if (id<16.){ //bigender androgyne neutrois\n"+
"p.y += .1;\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(.17,-.17), vec2(.37,-.37)) )+\n"+
"lightUp( getLine( p, vec2(.22,-.38), vec2(.38,-.38)) )+\n"+
"lightUp( getLine( p, vec2(.38,-.22), vec2(.38,-.38)) )+\n"+
"lightUp( getLine( p, vec2(.3,-.18), vec2(.18,-.3)) ));\n"+
"}\n"+
"else if (id<17.){ //bigender third gender demimale\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(-.25,.0), vec2(-.35,.0)) )+\n"+
"lightUp( getLine( p, vec2(-.5,.1), vec2(-.5,-.1)) )+\n"+
"lightUp( getLine( p, vec2(-.5,.1), vec2(-.35,.0)) )+\n"+
"lightUp( getLine( p, vec2(-.35,.0), vec2(-.5,-.1)) )+\n"+
"lightUp( getLine( p, vec2(.17), vec2(.38)) )+\n"+
"lightUp( getLine( p, vec2(.22,.38), vec2(.38)) ));\n"+
"}\n"+
"else if (id<18.){ //bigender agender demifemale\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(-.23,.0), vec2(.23,.0)) )+\n"+
"lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(-.01,-.36)) ));\n"+
"}\n"+
"else if (id<19.){ //genderfluid male female\n"+
"p *= rotM(PI/6.);\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(-.235,.05), vec2(-.35,-.1)) )+\n"+
"lightUp( getLine( p, vec2(.235,-.05), vec2(.35,.1)) )+\n"+
"lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(-.1,.42), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(.1,.42), vec2(.0,.5)) ));\n"+
"}\n"+
"else if (id<20.){ //genderfluid androgyne female\n"+
"p *= rotM(PI/6.);\n"+
"col = getCol(cid1)*1e2*(\n"+
"lightUp( getRing( 4.2*p) )+\n"+
"lightUp( getLine( p, vec2(-.235,.05), vec2(-.35,-.1)) )+\n"+
"lightUp( getLine( p, vec2(.235,-.05), vec2(.35,.1)) )+\n"+
"lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+\n"+
"lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+\n"+
"lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(-.1,.33), vec2(.1,.33)) )+\n"+
"lightUp( getLine( p, vec2(-.1,.42), vec2(.0,.5)) )+\n"+
"lightUp( getLine( p, vec2(.1,.42), vec2(.0,.5)) ));\n"+
"} //incomplete list of course\n"+
"\n"+
"return col;\n"+
"}\n"+
"\n"+
"void main( ){\n"+
"compressFft(); //initializes fft, ffts\n"+
"//vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); //long edge -1 to 1\n"+
"//vec2 uv = vUv.xy / iResolution.xy;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"vec3 vid = texture(iVideo, vUv).rgb;\n"+
"\n"+
"// Symbol\n"+
"float symId = hash21(vec2(ceil(iGlobalTime/8.))); //randomize symbol choice\n"+
"symId *= (fract(iGlobalTime/8.)<.75)? -1. : 1.; //define ratio between animated and static symbols\n"+
"//vec3 col = (.4*ffts.w+fft.x) * makeSym(uv/(.7+.4*ffts.w),symId);\n"+
"vec3 col = (.4*ffts.w+fft.x) * makeSym(uv/(.7+.4*ffts.w),symId);\n"+
"\n"+
"// Background\n"+
"float vBar,\n"+
"//spect = 6.*clamp(texelFetch(iChannel0,ivec2(int(511.*abs(fragCoord.y/iResolution.y-1.)),0),0).x-2.*abs(fragCoord.x/iResolution.x-.5),0.,1.); //audio spectrum pattern\n"+
"//spect = 6.*clamp(texelFetch(iChannel0,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv),0.,1.); //audio spectrum pattern\n"+
"//spect = 6.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(fragCoord.y/iResolution.y-1.)),0),0).x-2.*abs(fragCoord.x/iResolution.x-.5),0.,1.); //audio spectrum pattern\n"+
"//spect = 6.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(fragCoord.y/iResolution.y-1.)),0),0).x-2.*abs(fragCoord.x/iResolution.x-.5),0.,1.); //audio spectrum pattern\n"+
"//spect = 6.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv-.5),0.,1.).y; //audio spectrum pattern\n"+
"//spect = 120.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv-.5),0.,1.).y; //audio spectrum pattern\n"+
"spect = 120.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv-.5),0.,1.).y; //audio spectrum pattern\n"+
"uv = abs(10.*sin(iGlobalTime/64.)*uv); //zoom motion\n"+
"for (float n=.0;n<3.;n++){\n"+
"vBar = abs(fract(uv.x)-(.1+.7*hash21(n*ceil(uv.xx)+floor(4.*aTime))))-.05*n; //vertical bars\n"+
"col += smoothstep(fwidth(vBar), .0, vBar) * smoothstep(.8, 0., length(col)) * spect * fft.z * col;\n"+
"}\n"+
"\n"+
"col = pow(col, vec3(.4545)); //gamma correction\n"+
"//gl_FragColor = vec4(col*vid.rgb,1.0);\n"+
"//gl_FragColor = vec4(col*(0.7+(sin(iGlobalTime))*vid.rgb),1.0);\n"+
"//gl_FragColor = vec4(col*(2.35*vid.rgb),1.0);\n"+
"//gl_FragColor = vec4(col*(2.*vid.rgb),1.0);\n"+
"gl_FragColor = vec4(col,1.0);\n"+
"}\n"