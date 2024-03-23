// https://www.shadertoy.com/view/msjXzR
// Modified by ArthurTent
// Created by kishimisu
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

/* "Neon Bridge" by @kishimisu (2022) - https://www.shadertoy.com/view/msjXzR

   Playing around with neon lights and raymarching in 2022 chars =)

   The light is accumulated at each step of the raymarching
   and uses this intensity falloff : 1. / (1. + pow(abs(d*att), n))
   that allow to produce such shiny and glowing colors.

   The drawback is that I need a fixed number in the raymarching
   loop as breaking early when hitting a surface don't produce nice
   results.
   Fortunately, with 40 steps it already looks really good and doesn't
   require a top-tier graphic card.

   I could optimize it more but I currently have exams and not much
   time so I'm happy with this result !
*/

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// copied from QuantumSuper <3
#define getDat(addr) texelFetch( iAudioData, ivec2(addr,0), 0).x
vec4 fft, ffts; //compressed frequency amplitudes
void compressFft(){ //v1.2, compress sound in iChannel0 to simplified amplitude estimations by frequency-range
    fft = vec4(0), ffts = vec4(0);

	// Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)
    for (int n=0;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 0-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(3,8,8,5); ffts /= vec4(2,3,3,23); //normalize

	//if (isVdj) for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //limiter? workaround attempt for VirtualDJ
}

vec3 getCol(float id){ //color definitions, for triplets
    vec3 setCol = vec3(0);
    id = mod(id,15.);
         if (id< 1.) setCol = vec3(244,  0,204); //vw2 pink
    else if (id< 2.) setCol = vec3(  0,250,253); //vw2 light blue
    else if (id< 3.) setCol = vec3( 30, 29,215); //vw2 blue
    else if (id< 4.) setCol = vec3(252,157,  0); //miami orange
    else if (id< 5.) setCol = vec3( 26,246,138); //miami green
    else if (id< 6.) setCol = vec3(131, 58,187); //nordic violet
    else if (id< 7.) setCol = vec3(231, 15, 20); //arena red
    else if (id< 8.) setCol = vec3( 35, 87, 97); //arena dark blue
    else if (id< 9.) setCol = vec3(103,211,225); //arena blue
    else if (id<10.) setCol = vec3(241,204,  9); //bambus2 yellow
    else if (id<11.) setCol = vec3( 22,242,124); //bambus2 green
    else if (id<12.) setCol = vec3( 30,248,236); //magic turquoise
    else if (id<13.) setCol = vec3(173,  0, 27); //matrix red
    else if (id<14.) setCol = vec3( 28,142, 77); //matrix green
    else if (id<15.) setCol = vec3( 66,120, 91); //matrix green 2
    return setCol/256.;
}

// If you find color values that look better for
// this scene don't hesitate to share them!
#define bridgeCol      vec3(.1,1,.8)
#define bridgePillars  vec3(1,.7,.4)
#define pillarsCol     vec3(1,.1,.1)
#define patternsCol    vec3(.8,.6,.3)

float box( vec3 p, vec3 b ) {
  vec3 q = abs(p) - b;
  return length(max(q,0.)) + min(max(q.x,max(q.y,q.z)),0.);
}

float rect( vec2 p, vec2 b ) {
    vec2 d = abs(p)-b;
    return length(max(d,0.)) + min(max(d.x,d.y),0.);
}

#define rot(a) mat2(cos(a), -sin(a), sin(a), cos(a))
#define rep(p,r) (mod(p+r/2.,r)-r/2.)
#define lrep(p,c,l) (p-c*clamp(round(p/c),-l,l))
#define rid(p,r) floor((p+r/2.)/r)

float light(float d, float att, float n) {
    return 1. / (1. + pow(abs(d*att), n));
}

float map(vec3 p, float t, inout vec3 lgt) {
    float d, b1, b2, lb2, b3, b4, r;
    vec2 id0, id1;
    vec3 id3, q, c = cos(p)*.25+.75;

    // Bridge
    d = rect(p.xy + vec2(0,2), vec2(1.4, 1));

    // Floor & Ceiling
    d = min(d, abs(abs(p.y) - 4.));

    if (abs(p.x) < 1.5) {
        // Bridge steps
        q   = p;
        q.z = lrep(q.z, .7, floor(iGlobalTime*8. - 14.));
        b1  = box(q - vec3(0, -1.1 ,0), vec3(1., .1, .08));
        d   = min(d, b1);
        lgt += c*bridgeCol *(fft.y+0.02) * light(b1, 60., 2.);

        // Bridge pillars
        q = p;
        q.x = abs(q.x);
        q.z = rep(q.z, 1.5);
        id3 = rid(p, 1.5);
        b2  = rect(q.xz - vec2(1.2,0), vec2(.1));
        q.z = lrep(p.z, 1.5, floor(iGlobalTime*8.));
        //lb2 = box(q - vec3(1.2,2. + sin(iGlobalTime + id3.z)*.5,0), vec3(.1,.3,.1));
        lb2 = box(q - vec3(1.2,2. + sin(iGlobalTime + id3.z)*.5,0), vec3(.1,.9*fft.x,.1));
        d   = min(d, b2);
        lgt += c*bridgePillars * light(lb2, 80., 2.)*t*.5;
        //lgt += c*bridgePillars * light(lb2, 80., 2.)*t*.5*fft.x;
    }

    // Ground/Ceiling pattern
    if (abs(p.y) > 2.) {
        const float br = 1.5;
        q     = p;
        id1   = rid(p.xz, br);
        r     = fract(dot(sin(id1), (id1+41.21)*24.77));
        q.xz  = rep(p.xz, br);
        q.y   = abs(q.y)-4.;
        q.xz *= rot(1.570796*(.5 + floor(r*2.)));
        q.x   = abs(q.x)-br*.35;
        b3    = box(q, vec3(.01,.2,br*.4));
        d     = min(d, b3);
        //lgt  += c*patternsCol * light(b3, 20., 2.) * exp(-t*.1 - (cos(max(0., iGlobalTime - 8.)*.5)*.5+.5)*10.);
        lgt  += c*patternsCol * light(b3, 20., 2.) * exp(-t*.1 - (cos(max(0., iGlobalTime - 8.)+fft.x)*.5+.5)*10.);
    }

    // Distant pillars
    q    = p;
    id0  = rid(p.xz, 7.);
    q.xz = rep(p.xz, 7.);
    b3   = rect(q.xz, vec2(.5));
    b3   = max(b3, -abs(p.x) +2.);
    q.y  = rep(q.y, .5);
    b4   = box(q, vec3(.5,.04,.5));
    b4   = max(b4, -abs(p.x) +2.);
    d    = min(d, b3);
    if (fract((id0.x+41.11)*sin(id0.y*44.7)) < smoothstep(5., 8., iGlobalTime)){
        //lgt += c*pillarsCol * light(b4, 40., 2.) * (sin(iGlobalTime+p.y*(2.*fract(id0.x*id0.y*47.44))+id0.x*id0.y)*.5+.5);
        //lgt += c*getCol(10.*(fft.z+fft.x+fft.y+fft.w)) * light(b4, 40., 2.) * (sin(iGlobalTime+p.y*(2.*fract(id0.x*id0.y*47.44))+id0.x*id0.y)*.5+.5);
        //lgt += c*getCol(10.*fft.z*fft.x) * light(b4, 40., 2.) * (sin(iGlobalTime+p.y*(2.*fract(id0.x*id0.y*47.44))+id0.x*id0.y)*.5+.5);
        lgt += c*getCol(10.*fft.z*fft.x+sin(iGlobalTime)) * light(b4, 40., 2.) * (sin(iGlobalTime+p.y*(2.*fract(id0.x*id0.y*47.44))+id0.x*id0.y)*.5+.5);

    }
    return d;
}

void main() {
    compressFft();
    vec3 r3 = vec3(getDat(0),getDat(1),getDat(2));

    //vec2 uv = (2.*F - iResolution.xy)/iResolution.y;
    vec2 uv = -1.0 + 2.0* vUv;
    vec3 lgt = vec3(0);
    vec3 ro = vec3(0,0,iGlobalTime);
    vec3 rd = normalize(vec3(uv, 1.));
    float t = 0.;

    for (int i = 0; i < 40; i++) {
        vec3 p = ro + t*rd;
        float d = map(p, t, lgt);
        t += d;
    }

    gl_FragColor = vec4(pow(lgt, vec3(.45)), 1.0);
}