// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var SolumObject_frag =
"// https://www.shadertoy.com/view/mtKGRW\n"+
"// Solum Object 0.52.230509 by QuantumSuper\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"// auto-vj with circles & triangles, shattered particles, and visual tweaks\n"+
"//\n"+
"// - use with music in iChannel0 -\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform sampler2D iVideo;\n"+
"\n"+
"varying vec2 vUv;\n"+
"\n"+
"\n"+
"\n"+
"#define PI 3.14159265359\n"+
"#define aTime 128./60.*iGlobalTime\n"+
"vec4 fft, ffts; //compressed frequency amplitudes\n"+
"\n"+
"\n"+
"void compressFft(){ //v1.2, compress sound in iChannel0 to simplified amplitude estimations by frequency-range\n"+
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
"//for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //workaround for VirtualDJ, ?any hints for reverting audio limiters appreciated\n"+
"}\n"+
"\n"+
"vec3 getCol(float id){ //color definitions, for triplets\n"+
"vec3 setCol = vec3(0);\n"+
"if (id< 1.) setCol = vec3(244,  0,204); //vw2 pink\n"+
"else if (id< 2.) setCol = vec3(  0,250,253); //vw2 light blue\n"+
"else if (id< 3.) setCol = vec3( 30, 29,215); //vw2 blue\n"+
"else if (id< 4.) setCol = vec3(252,157,  0); //miami orange\n"+
"else if (id< 5.) setCol = vec3( 26,246,138); //miami green\n"+
"else if (id< 6.) setCol = vec3(131, 58,187); //nordic violet\n"+
"else if (id< 7.) setCol = vec3(231, 15, 20); //arena red\n"+
"else if (id< 8.) setCol = vec3( 35, 87, 97); //arena dark blue\n"+
"else if (id< 9.) setCol = vec3(103,211,225); //arena blue\n"+
"else if (id<10.) setCol = vec3(241,204,  9); //bambus2 yellow\n"+
"else if (id<11.) setCol = vec3( 22,242,124); //bambus2 green\n"+
"else if (id<12.) setCol = vec3( 30,248,236); //magic turquoise\n"+
"return setCol/256.;\n"+
"}\n"+
"\n"+
"mat2 rotM(float r){float c = cos(r), s = sin(r); return mat2(c,s,-s,c);} //2D rotation matrix\n"+
"\n"+
"float hash21(vec2 p){ //pseudo random generator\n"+
"p = fract(p*vec2(13.81, 741.76));\n"+
"p += dot(p, p+42.23);\n"+
"return fract(p.x*p.y);\n"+
"}\n"+
"\n"+
"float sdEquilateralTriangle(vec2 p){ //source: https://iquilezles.org/articles/distfunctions2d/\n"+
"const float k = sqrt(3.);\n"+
"p.x = abs(p.x) - 1.;\n"+
"p.y = p.y + 1./k;\n"+
"if (p.x+k*p.y > 0.) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.;\n"+
"p.x -= clamp( p.x, -2., 0.);\n"+
"return -length(p)*sign(p.y);\n"+
"}\n"+
"\n"+
"float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2){ //source: https://iquilezles.org/articles/distfunctions2d/\n"+
"vec2 e0 = p1-p0, e1 = p2-p1, e2 = p0-p2;\n"+
"vec2 v0 = p -p0, v1 = p -p1, v2 = p -p2;\n"+
"vec2 pq0 = v0 - e0*clamp( dot(v0,e0)/dot(e0,e0), 0., 1.);\n"+
"vec2 pq1 = v1 - e1*clamp( dot(v1,e1)/dot(e1,e1), 0., 1.);\n"+
"vec2 pq2 = v2 - e2*clamp( dot(v2,e2)/dot(e2,e2), 0., 1.);\n"+
"float s = sign(e0.x*e2.y - e0.y*e2.x);\n"+
"vec2 d = min(min(vec2( dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)),\n"+
"vec2( dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))),\n"+
"vec2( dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));\n"+
"return -sqrt(d.x)*sign(d.y);\n"+
"}\n"+
"\n"+
"float getParticle(vec2 p, vec2 p1, vec2 p2){ //background particle\n"+
"float d = mix(\n"+
"length(p*(.5+.5*sin(p1)))-p2.y+.2, //ellipse\n"+
"sdTriangle(p,p1,p2,vec2(0)), //triangle\n"+
"clamp(16.+16.*sin(aTime/4.),.0,1.)); //shapeshift\n"+
"return smoothstep( min(.01,fwidth(d)), .0, abs(d));\n"+
"}\n"+
"\n"+
"float getTria(vec2 p, float r){ //triangle scaled by r about 0,0\n"+
"return clamp( .02/abs(sdEquilateralTriangle(p/(r+.001))), .0, 1.);\n"+
"}\n"+
"\n"+
"float getRing(vec2 p, float r){ //ring with radius r about 0,0\n"+
"return clamp( .01/abs(length(p)-r), .0, 1.);\n"+
"}\n"+
"\n"+
"float getShape(vec2 p, float r){ //shape combination scaling with r about 0,0\n"+
"return (fract(aTime/16.)<.5)? getRing(p,r)+.2*(1.-fft.z)*getTria(p/3.,r) : getTria(p,r)+.2*(1.-fft.z)*getRing(p/3.,r);\n"+
"}\n"+
"\n"+
"float shatterLayer(vec2 p){ //background layers\n"+
"float id = hash21(floor(p));\n"+
"return getParticle(\n"+
"(fract(p)-.5)*rotM(2.*PI*id+aTime)-.2*vec2(cos(id*aTime),sin(.8*id*aTime)) * vec2( 2.*cos(id*aTime), 1.), //multiple rotating shifting origins\n"+
".25*vec2(sin(id*aTime),cos(id*aTime)), //moving corner per id\n"+
"vec2(.05+.3*id)) //fixed corner per id\n"+
"* (step(id,.8)+clamp(sin(aTime),.0,1.)*step(id,.05)); //different brightness\n"+
"}\n"+
"\n"+
"void main(  ){\n"+
"compressFft(); //initializes fft, ffts\n"+
"\n"+
"// View definition\n"+
"//vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); //long edge -1 to 1, square aspect ratio\n"+
"//vec2 uv = -1.0 + 2.0 *vUv;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"//vec2 uv = gl_FragCoord.xy / iResolution.y;\n"+
"float fTime = fract(iGlobalTime/64.);\n"+
"if (fract(aTime/32.)<.75); //break, standard view\n"+
"else if (fTime<.33) uv = fract(uv*2.*abs(sin(aTime/8.))+.5)-.5; //scaling multiples\n"+
"else if (fTime<.66) uv *= 1.5*rotM(sign(fract(aTime/32.)-.5)*aTime/8.); //rotation\n"+
"else uv = sin( PI*uv + vec2( sign(fract(aTime/32.)-.5) * aTime/4., 0)); //moving warp multiples\n"+
"\n"+
"// Draw color shapes\n"+
"vec3 col = vec3(\n"+
"getShape( uv*3., fft.y),\n"+
"getShape( uv, fft.z),\n"+
"getShape( uv, fft.w));\n"+
"\n"+
"// Overlay brightness with sound texture\n"+
"float rho = atan(-abs(uv.x),uv.y)/PI+1.; //polar angle, flipped & mirrored\n"+
"col = mix( col, col*smoothstep(.2,.8,vec3(\n"+
"texelFetch( iAudioData, ivec2( 6.+17.*rho, 0), 0).x, //speech\n"+
"texelFetch( iAudioData, ivec2( 24.+70.*rho, 0), 0).x, //presence\n"+
"texelFetch( iAudioData, ivec2( 95.+416.*rho, 0), 0).x)), smoothstep(.66,1.,length(col))); //brilliance\n"+
"col.r = mix(col.r,pow(col.r,9.),col.r); //heighten contrast of thin shape\n"+
"\n"+
"// Remap colors\n"+
"float colId = 3. * floor(mod(aTime/8.,4.));\n"+
"col = mat3(getCol(colId),getCol(colId+1.),getCol(colId+2.)) * col;\n"+
"\n"+
"// Draw white shape\n"+
"rho = atan(uv.x,uv.y)/2./PI+.5; //polar angle, flipped\n"+
"float shape = getShape( uv, .1/(fft.x*fft.x));\n"+
"col += shape * mix( 1., smoothstep(.6,.9,texelFetch(iAudioData,ivec2(5.*rho,0),0).x), .75*smoothstep(.66,1.,shape));\n"+
"\n"+
"// Shatter background layers\n"+
"uv *= 1. + .5*cos(uv)/length(2.*uv); //warp view\n"+
"float aFrac,amp =0.;\n"+
"for (float n=0.;n<4.;n++){\n"+
"aFrac = fract(-.05*aTime+.25*n)-1.*.1*fft.w*fft.w*fft.w;\n"+
"amp += (1.-.5*fft.z) * shatterLayer((uv*2.*rotM(sin(aTime/32.))+n*vec2(.1,.05))*20.*aFrac) * smoothstep(1.,.33,aFrac);\n"+
"}\n"+
"amp *= .1 + .9*length(uv)*length(uv)*length(uv); //anti-vignette\n"+
"col += 2. * amp * col/length(col); //merge with foreground\n"+
"\n"+
"// Final adjustments\n"+
"col = pow(col, vec3(.4545)); //gamma correction\n"+
"gl_FragColor = vec4(col,1.);\n"+
"}\n"