// https://www.shadertoy.com/view/lldyWn
// Modified by ArthurTent
// Created by BigWings
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
#define S(a,b,t) smoothstep(a,b,t)

// https://iquilezles.org/articles/smin
float smin( float a, float b, float k ) {
    float h = clamp( 0.5+0.5*(b-a)/k, 0., 1. );
    return mix( b, a, h ) - k*h*(1.0-h);
}

float N2(vec2 p) {	// Dave Hoskins - https://www.shadertoy.com/view/4djSRW
	vec3 p3  = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}
float N2(float x, float y) { return N2(vec2(x, y)); }

vec3 N23(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
}
vec3 N23(float x, float y) {return N23(vec2(x, y));}



float SmoothNoise(vec2 uv) {
    // noise function I came up with
    // ... doesn't look exactly the same as what i've seen elswhere
    // .. seems to work though :)
    vec2 id = floor(uv);
    vec2 m = fract(uv);
    m = 3.*m*m - 2.*m*m*m;

    float top = mix(N2(id.x, id.y), N2(id.x+1., id.y), m.x);
    float bot = mix(N2(id.x, id.y+1.), N2(id.x+1., id.y+1.), m.x);

    return mix(top, bot, m.y);
}

float LayerNoise(vec2 uv) {
    float c = SmoothNoise(uv*4.);
    c += SmoothNoise(uv*8.)*.5;
    c += SmoothNoise(uv*16.)*.25;
    c += SmoothNoise(uv*32.)*.125;
    c += SmoothNoise(uv*65.)*.0625;

    return c / 2.;
}

vec3 SmoothNoise3(vec2 uv) {
    // noise function I came up with
    // ... doesn't look exactly the same as what i've seen elswhere
    // .. seems to work though :)
    vec2 id = floor(uv);
    vec2 m = fract(uv);
    m = 3.*m*m - 2.*m*m*m;

    vec3 top = mix(N23(id.x, id.y), N23(id.x+1., id.y), m.x);
    vec3 bot = mix(N23(id.x, id.y+1.), N23(id.x+1., id.y+1.), m.x);

    return mix(top, bot, m.y);
}

vec3 LayerNoise3(vec2 uv) {
    vec3 c = SmoothNoise3(uv*4.);
    c += SmoothNoise3(uv*8.)*.5;
    c += SmoothNoise3(uv*16.)*.25;
    c += SmoothNoise3(uv*32.)*.125;
    c += SmoothNoise3(uv*65.)*.0625;

    return c / 2.;
}


/*
float dEllipsoid(vec3 p, vec3 a, vec3 b, float r) {
	float d1 = length(p-a);
    float d2 = length(p-b);
    float d3 = length(a-b);
    return mix(d1, d2, .5)-.5*d3-r;
}*/


// [SH18] BabyToy - by Martijn Steinrucken aka BigWings 2018
// Email:countfrolic@gmail.com Twitter:@The_ArtOfCode
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//
// Takes a while to compile and needs a powerful graphics card to get a decent framerate.
// mouse.x = rotate, mouse.y=light
//
// I did a rough sketch in Blender, using only spheres, to lay down the basics.
//
// I hacked in some decent translucency of the feet and hands that show a hint of the bones
// at the cost of only one extra map call. Make sure you move the light down and have the
// angle right to see it.
//
// Code is a bit of a mess and could probably be optimized more but it will never be perfect
// and at some point you just gotta ship it. Hope you like!
//
// Music Mountain and Cloud - Thy Veils
// https://soundcloud.com/thyveils/mountain-and-cloud
// Heartbeat sound:
// https://soundcloud.com/elderalcantara/heartbeat-sound
//
// Video of the effect can be found here:
// https://youtu.be/czO9fTwVSYg

// shows the baby without bubble deformation etc
//#define DEVELOPER

// I'm using bounding volumes for the head hands and feet so it doesn't
// have to evaluate all the toes, nails wrinkles etc, if its still far away
// should be faster..
#define USE_BOUNDING_VOLUMES

// turns on my hacky sub surface scattering implementation on the feet and hands
#define USE_SSS


// raymarch settings
#define MIN_DIST .1
#define MAX_DIST 8.
#define MAX_STEPS 200.
#define SURF_DIST .005

float Map(vec3 p);


// started out with this struct, not really using most of it so for this shader the
// castray function could probably just return a vec4
struct de {
    vec3 p;
    vec3 rp;
    float dm; 		// minimum passing distance
    float mat;
    float i;		// number of iters before break
};


// https://iquilezles.org/articles/distfunctions
float sdTorus( vec3 p, vec2 t )
{
    return length( vec2(length(p.xz)-t.x,p.y) )-t.y;
}

float sdCylinder( vec3 p, vec2 h )
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
{
	vec3 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h ) - r;
}


// like sdCapsule but this can vary width and smoothing along the length of it
float Capsule( vec3 p, vec3 a, vec3 b, float r1, float r2, float s1, float s2, float d )
{
	vec3 pa = p-a, ba = b-a;
    float t = dot(pa,ba)/dot(ba,ba);
	float h = clamp( t, 0.0, 1.0 );
	d = smin(d, length( pa - ba*h ) - mix(r1, r2, S(0.,1.,h)), mix(s1, s2, h))*.98;

    return d;
}

// I was trying to get more toe definition so I added an additional tweakable notch
// Turns out that for the toes it didn't really work but it gave nice wrinkles at the
// bottom of the foot. Lucky accident!
float ToeCaps(vec3 p, vec3 a, vec3 b, float r1, float r2, float s1, float s2, float d, float x, float y, float k )
{
	vec3 pa = p-a, ba = b-a;
    float t = dot(pa,ba)/dot(ba,ba);
	float h = clamp( t, 0.0, 1.0 );
	d = smin(d, length( pa - ba*h ) - mix(r1, r2, S(0.,1.,h)), mix(s1, s2, h))*.98;

    float g = 1.-min(1., abs(h-x)*k);
    d -= g*g*g*g*y;
    return d;
}

vec3 GetRay(vec2 uv, vec3 p, vec3 lookat, vec3 up, float zoom) {
    vec3 f = normalize(lookat-p),
         r = normalize(cross(up, f)),
         u = cross(f, r),
         c = p+f*zoom,
         i = c + r*uv.x + u*uv.y;

    return normalize(i-p);
}

/*
vec3 GetNormal( vec3 p ) {
	vec3 eps = vec3( 0.01, 0.0, 0.0 );
	vec3 nor = vec3(
	    Map(p+eps.xyy) - Map(p-eps.xyy),
	    Map(p+eps.yxy) - Map(p-eps.yxy),
	    Map(p+eps.yyx) - Map(p-eps.yyx) );
	return normalize(nor);
}*/
#define ZERO 0
// Faster compilation by preventing inlining of Map function
// Thanks IQ!
vec3 GetNormal( vec3 p )
{
    const float eps = 0.01;
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*Map(p+eps*e);
    }
    return normalize(n);
}




float dHand(vec3 p, vec3 pWrist) {
    #ifdef USE_BOUNDING_VOLUMES
    float handDist = length(p-(pWrist+vec3(.1,.35,.4)));
    if(handDist>.95) return handDist-.65;
    #endif

    vec3 pThumb = pWrist+vec3(-.34, 0.43,.4);
    vec3 piFinger = pWrist+vec3(-.13, .72,.64);
    vec3 pmFinger = pWrist+vec3(.09, .74,.62);
    vec3 prFinger = pWrist+vec3(.3, .68,.52);
    vec3 pPinky = pWrist+vec3(.49, .54,.36);

    pWrist -= vec3(0,-.1,.05);
    float s1 = .05;
    float s2 = .1;

    float d = MAX_DIST;

    d = Capsule(p, pWrist+vec3(0,0,0), pThumb, .2, .13, s1, s2, d);
    d = Capsule(p, pThumb, pThumb+vec3(0,0,.2), .13, .12, .06, .01, d);
    d = smin(d, length(pThumb+vec3(0.05,-.1,.2)-p)-.08, .1);

    d = Capsule(p, pWrist+vec3(0,.0,0), piFinger, .2, .12, s1, s2, d);
    d = Capsule(p, piFinger, piFinger+vec3(0,0,.2), .12, .11, .03, .01, d);
    d = smin(d, length(piFinger+vec3(0.,-.1,.2)-p)-.08, .1);

    d = Capsule(p, pWrist+vec3(0,.0,0), pmFinger, .2, .13, s1, s2, d);
    d = Capsule(p, pmFinger, pmFinger+vec3(.025,0,.2), .12, .11, .03, .01, d);
    d = smin(d, length(pmFinger+vec3(0.075,-.1,.2)-p)-.08, .1);

    d = Capsule(p, pWrist+vec3(0,.0,0), prFinger, .2, .13, s1, s2, d);
    d = Capsule(p, prFinger, prFinger+vec3(.05,0,.2), .12, .11, .03, .01, d);
    d = smin(d, length(prFinger+vec3(0.075,-.1,.28)-p)-.08, .1);
    d = min(d,  length(prFinger+vec3(0.08,-.08,.285)-p)-.08);

    d = Capsule(p, pWrist+vec3(0,.0,0), pPinky, .2, .13, s1, s2, d);
    d = Capsule(p, pPinky, pPinky+vec3(0.075,0,.2), .12, .11, .03, .01, d);
    d = smin(d, length(pPinky+vec3(0.075,-.1,.28)-p)-.08, .1);
     d = min(d, length(pPinky+vec3(0.08,-.08,.285)-p)-.08);

    return d;
}

float dFoot(vec3 p, vec3 pAnkle) {
    #ifdef USE_BOUNDING_VOLUMES
    float footDist = length(p-(pAnkle+vec3(-.1,.6,.1)));
    if(footDist>1.) return footDist-.75;
    #endif

    vec3 g = p;
    p -= pAnkle;
    vec3 pToe1 = vec3(-.6, 1.02,.21);
    vec3 pToe2 = vec3(-.42, 1.15,.07);
    vec3 pToe3 = vec3(-.24, 1.17,-.01);
    vec3 pToe4 = vec3(-.05, 1.13,-.13);
    vec3 pToe5 = vec3(.15, 1.02,-.24);

    float d = ToeCaps(p, vec3(0), pToe1, .2, .13, .25, .05, MAX_DIST, .85, -.01, 8.);
    d = ToeCaps(p, vec3(0), pToe2, .2, .1, .25, .05, d, .5, -.02, 8.);
    d = ToeCaps(p, vec3(0), pToe3, .2, .1, .25, .05, d, .35, -.01, 6.);
    d = ToeCaps(p, vec3(0), pToe4, .2, .1, .25, .04, d, .25, -.01, 6.);
    d = Capsule(p, vec3(.2,.1,0), pToe5, .18, .09, .25, .07, d);

    vec3 h = vec3(.05, .02, .0);

    d = smin(d, length(p-(pToe5+vec3(.02, .02, .02)))-.08, .05);


    float toeNails = length(pToe1-p-vec3(.05,0,.1)*.5)-.09;
    toeNails = min(toeNails, length(pToe2-p-vec3(.05,0,.1)*.4)-.07);
    toeNails = min(toeNails, length(pToe3-p-vec3(.05,0,.1)*.35)-.07);
    toeNails = min(toeNails, length(pToe4-p-vec3(.05,0,.1)*.35)-.07);

    d = smin(d, toeNails, .01);

    return d;
}

float dHead(vec3 p) {
    #ifdef USE_BOUNDING_VOLUMES
    float headDist = length(p-vec3(-2.3,1.36,0));
    if(headDist > 2.) return (headDist-1.6);
    #endif

    // head
    vec3 hp = p-vec3(-2.71,1.36,0);
    float d = length((hp)*vec3(1,1,1.2))-1.2;				// back of head
    d = smin(d, length(p-vec3(-2.06,1.71,0))-.94, .5);		// forehead
    d = smin(d, length(p-vec3(-1.83,1.02,0))-.94,.1);		// jaws etc

     // ears
    vec3 tp = p-vec3(-2.27, .73, -.95);
    tp.z -= tp.x*.4;
    tp.z -= S(.9, .0, p.y)*.1;
    tp.x += -.25*S(.3, -.4, tp.y+.1);
    float dEar = length(tp.xy-vec2(.1, 0));
    float ear = sdCylinder(tp.xzy-vec3(0,.18,0), vec2(.25, .15));
    ear += cos(dEar*30.-3.)*.01;
    ear = smin(ear, sdTorus(tp.xzy, vec2(.25, .043)), .05);
    d = smin(d, ear*.8, .05);


    d = smin(d, .12-length(p-vec3(-2.05, .7, -.94)), -.07);
   // d = smin(d, .08-length(p-vec3(-2.0, .7, -.75)), -.04);


    // eyes
    vec3 ep = p-vec3(-1.37,1.46,-.4);
    float ed = length(ep)-.3;
    float slitFade = S(-.79, -.5, p.z);
    slitFade *= S(-.1, -.5, p.z);
    ed += S(.05*slitFade, 0., abs(ep.y-abs(ep.x*.6)))*.02*slitFade;
    d = smin(d, ed, .1);

    // mouth
    float md = length((p-vec3(-.78,.9,0))*vec3(1,1,.4))-.09;
    float noseGutter = cos(p.z*30.)*.2*S(.3, .0, -p.z)*.15*S(.85, 1.3, p.y);
    md = smin(-md, length(p-vec3(-1.25,.98,0))-.56+noseGutter, -.075);
    d = smin(d, md,.1+pow(abs(cos(iTime*.25)), 10.)*.175);

    // nose
    d = Capsule(p, vec3(-.9,1.37,0), vec3(-1.26,1.59,0), .2, .15, .1, .3, d);
    float nd = length(p-vec3(-.83, 1.27, -.12))-.05;
    d = smin(d, length(p-vec3(-.9,1.3,-.16))-.12,.1);
    d = smin(-nd, d, -.14);

    d = smin(d, length(p-vec3(-1.17,.611,0))-.348,.05);		// chin

    return d;
}

float dCord(vec3 p) {
    #ifdef USE_BOUNDING_VOLUMES
    float cordDist = sdCapsule(p, vec3(1, -1, 0), vec3(1, 5., 0),.01);
    if(cordDist>.5 && p.y<4.) return (cordDist-.35);
    #endif

    vec3 up = p-vec3(1, -1, 0);
    float g = p.y * 2.;
    float r = .13+S(4., 6., p.y)*2.5;
    up = p+vec3(sin(g), 0, cos(g))*.2;
    float d = sdCapsule(up, vec3(1, -1, 0), vec3(1, 5., 0), r);
    float a = atan(up.x-1., up.z);
    d += sin(a*3.+p.y*7.)*.03;

    return d*.8;
}

float dBody(vec3 p) {
    #ifdef USE_BOUNDING_VOLUMES
	if(p.y>0.7) return p.y+.2;
    if(abs(p.z)>1.5) return abs(p.z)-1.1;
    #endif

    float d = length(p-vec3(-2.16,.2,0))-.758;		// neck
    d -= abs(sin(p.x*-4.+p.y*20.))*.0075*S(0., 1., p.y+.25);

    d = smin(d, length(p-vec3(-1.49,-.63,0))-.947,.25);		// chest
    d = smin(d, length(p-vec3(-.52,-1.09,0))-1.063,.35);	// chest/body
    d = smin(d, length(p-vec3(.41,-1.37,0))-1.09,.35);		// belly
     d -= abs(sin(p.x*8.+p.z*-2.))*.03*S(1., 0., abs(p.x+.2));
    return d;
}

float Map(vec3 p) {
    float d;
    float m = iMouse.y/iResolution.y - .5;
    float side = step(p.z, 0.)-.5;
    vec3 offs = vec3(side, side*.2, -0.5);
    float t= iTime;
    float j = sin(t+sin(t));
    offs.xy *= .5*j;

    vec3 pm = vec3(p.x, p.y, -abs(p.z));

    d = dHead(pm);
    d = smin(d, dBody(pm), .1);
    d = smin(d, dCord(p), .1);

    // arm
    vec3 pShoulder = vec3(-1.79,-.75,-1)+vec3(.2,.1,0);
    vec3 pElbow = vec3(-.37, -1.05,-1.39);
    vec3 pWrist = vec3(-.02, .33,-.92)+offs;
    d = Capsule(pm, pShoulder, pElbow, .57, .45, .4, .1, d);
    d = Capsule(pm, pElbow, pWrist, .43, .31, .05, .05, d);
    d = smin(d, dHand(pm, pWrist), .1);

    // leg
    vec3 pHip = vec3(1.05, -1.87,-.35);
    vec3 pKnee = vec3(.82, -0.87,-1.39);
    vec3 pAnkle = vec3(1.86, -0.03,-.42)+offs;
    d = Capsule(pm, pHip, pKnee, .69, .43, .05, .01, d);
    d = Capsule(pm, pKnee, pAnkle, .43, .34, .05, .05, d);
    d = smin(d, dFoot(pm, pAnkle), .1);

    // genitals
    d = smin(d, length(vec3(1.5, -1.52, 0)-p)-.22, .075);
    d = smin(d, length(vec3(1.62, -1.25, 0)-p)-.07, .1);

    return d;
}

float calcAO( in vec3 pos, in vec3 nor ) {
	float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
        float hr = 0.01 + 0.12*float(i)/4.0;
        vec3 aopos =  nor * hr + pos;
        float dd = Map( aopos );
        occ += -(dd-hr)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );
}



de CastRay(vec3 ro, vec3 rd) {
    vec3 p = ro + MIN_DIST*rd;
    float dS;
    float dC = 0.;
    float mat = 0.;
    float dM = MAX_DIST;

    float m = iMouse.y/iResolution.y -.5;


    dC = MIN_DIST;
    for(float i=0.;i<MAX_STEPS; i++) {
    	p = ro + dC * rd;

        dS = Map(p);

        if(dS<SURF_DIST || dC>MAX_DIST)
            break;

        dM = min(dM, dS);
        dC += dS;
    }

    if(dS<SURF_DIST)
        mat = 1.;

    de o;
    o.p = p;
    o.dm = dM;
    o.mat = mat;
    //o.i = i;

    return o;
}

vec3 Background(vec2 uv, vec3 ro, vec3 rd) {
	float d = length(uv-vec2(0., .2));

    vec3 col = vec3(1., .4, .3);
    //col *= S(.8, .0, d)*1.5;//(1.5+sin(iTime)*.5);
    col *= S(.8, .0, d)*1.5*(FFT(50)*.5+.5);//*(1.5+sin(iTime)*.5)*(FFT(50)*.5+.5);

    //col *= FFT(25)*.5+.5;
    return col;
}

vec2 RaySphere(vec3 ro, vec3 rd, vec3 s, float r) {
    float t = dot(s-ro, rd);
    vec3 p = ro+rd*t;
    float y = length(s-p);
    if(y<r) {
        float x = sqrt(r*r-y*y);
        return vec2(t-x, t+x);
    }
    return vec2(-1, -1);
}

vec3 Render(vec2 uv, vec3 ro, vec3 rd) {

    ro.x += sin(rd.x*5.+iTime)*.1;				// bend rays to get some waviness
    ro.y += sin(rd.y*6.+iTime)*.1;

    vec3 bg = Background(uv, ro, rd);
    vec3 col = bg;

    vec3 pBubble = vec3(.13, 1.42, .0);
    vec2 s = RaySphere(ro, rd, pBubble, 4.075);	// get intersection with the bubble
    if(s.x==-1.) {								// if there is no intersection, then just render background
        col = col.bgr*(1.+sin(iTime)*.2);
        col *= 1.-FFT(50);
        //col *= 1.-texture(iChannel0, (uv+.5)*.7).x*.4;
        return col;								// .. and we are done!
    }


    vec2 m = iMouse.xy/iResolution.xy;

    #ifdef DEVELOPER
    vec3 nb = vec3(0);
    #else

    ro = ro+s.x*rd;								// forward ray to boundary of bubble
    vec3 nb = normalize(ro-pBubble);			// bubble normal
	float fresnel = 1.-max(0., -dot(nb, rd));	// falloff on sides of bubble
    #endif

    de result = CastRay(ro, normalize(rd-nb*.5)); // bend ray inwards a bit to get refraction effect

    if(result.mat>0.) {

        vec3 n = GetNormal(result.p);


        vec3 light = normalize(vec3(1,1,1));

        #ifdef DEVELOPER
        return vec3(dot(n, light));
        #endif
        float lh = m.x<.03||m.x>.97?(-cos(iTime*.2)*.5+.5):m.y;
        light = vec3(1., 6.*lh, 0.)-result.p;
        float l = min(1., 5./dot(light, light));

        float dif = max(0., dot(n, normalize(light)));


        float ao = calcAO(result.p, n);		 // IQs ambient occlusion
        dif = max(dif, .2)*ao*2.*l;
        float bfresnel = max(0., -dot(n, rd)); // get fresnel falloff of baby


        vec3 baseCol = vec3(1., .4, .2);
        // modeling the earhole looked problematic due to fresnel, so I just render a dark spot there
        float earHole = length(vec3(result.p.x,result.p.y,abs(result.p.z))-vec3(-2.03, .7, .8));
        earHole = S(.05, .1, earHole);
        baseCol *= mix(.3, 1., earHole);

        col = mix(col, dif * baseCol, bfresnel);


        float d = length(result.p-ro);	// distance from front of bubble along eye ray
        d = S(2., 7., d);				// add some distance fade
        col = mix(col, bg, d);
        col = mix(col, bg, S(3., 6., result.p.y)); // fade bottom of bubble black

        // cheap sub surface scattering
		#ifdef USE_SSS
        float sss = 1.-Map(result.p+rd*.1)/-.1;		// advance ray a bit past hit point

        float sssMask = S(2.7,.0,length(light));	// only show sss when close to light
        float angleFade = abs(nb.b);				// mask unflattering angle
        col.r += max(0.,sss)*sssMask*angleFade;		// add sss only in red channel
		#endif


    }

    #ifndef DEVELOPER


    vec3 rimCol = pow(fresnel, 3.)*S(1., .9, fresnel)*vec3(1., .55, .5);
    rimCol *= S(.6, .0, -rd.y);
    col += rimCol;


    #endif

    return col;
}

void main()
{
    //vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
    vec2 uv = -1.+2.*vUv;
	float t = iTime*2.;

    vec2 m = iMouse.xy/iResolution.xy;

	t *= m.x<.03||m.x>.97 ? .2 : 0.;
    vec3 cPos = vec3(sin(m.x*6.283+t), .2, cos(m.x*6.283+t))*6.;
    vec3 cLookat = vec3(0);
    //cLookat= vec3(-.9, 1.37, 0);
    //cLookat = vec3(-1.37,1.46,-.4);
    cLookat = vec3(-0,1.42,0);

    #ifdef DEVELOPER
    float zoom = 1.;
    #else
    float zoom = .5;
    #endif

    vec3 up = vec3(0, 1, 0);
    vec3 eyeRay = GetRay(uv, cPos, cLookat, up, zoom);

    vec3 col = Render(uv, cPos, eyeRay);
    col += -0.25+FFT(50);

    gl_FragColor = vec4(col,1.0);
}
