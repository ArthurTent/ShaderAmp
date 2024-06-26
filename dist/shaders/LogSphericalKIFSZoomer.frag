// https://www.shadertoy.com/view/ctcGRf
// Modified by ArthurTent
// Created by derSchamane
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

//              = Log Spherical KIFS "Zoomer" =
//              by Maximilian Knape   ·∑>| 2023
// -----------------------------------------------------------
// This work is licensed under a Creative Commons Attribution-
//        NonCommercial-ShareAlike 3.0 Unported License

#define GAMMA 2.2

#define MAX_STEPS 90
#define MAX_DIST 100.
#define MIN_DIST 10.

#define GLOW_INT 1.
#define PP_ACES 1.0
#define PP_CONT 0.5
#define PP_VIGN 1.3
#define AO_OCC .5
#define AO_SCA .3

#define PI 3.14159265
#define TAU 6.28318531
#define S(x,y,t) smoothstep(x,y,t)
#define sin3(x) sin(x)*sin(x)*sin(x)
#define Rot2D(p, a) p=cos(a)*p+sin(a)*vec2(p.y,-p.x)
float bass = 0.0;
float hi = 0.0;

// Quantumsuper
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

	//for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //limiter? workaround attempt for VirtualDJ
}
vec3 getCol(float id){ //v0.92, color definitions, for triplets
    vec3 setCol = vec3(0);
    id = mod(id,18.);
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
    else if (id<13.) setCol = vec3(123, 23,250); //cneon pink
    else if (id<14.) setCol = vec3( 23,123,250); //cneon blue
    else if (id<15.) setCol = vec3( 73, 73,250); //cneon white
	else if (id<16.) setCol = vec3(173,  0, 27); //matrix red
    else if (id<17.) setCol = vec3( 28,142, 77); //matrix green
    else if (id<18.) setCol = vec3( 66,120, 91); //matrix green 2
    return setCol/256.;
}

// https://iquilezles.org/articles/palettes/
vec3 palette2( float t ) {
    vec3 a = vec3(0.5*bass, 0.5*hi, 0.5*(bass+hi/2.));
    vec3 b = vec3(0.5*hi, 0.1, 0.3);
    vec3 c = vec3(1.0, 0.0, 1.0*hi);
    vec3 d = vec3(1.25, 0.5*hi, 0.35);

    return a + b*cos( 6.28318*(c*t+d) );
}

float avgFrq(float from, float to)
{
    float st = (to - from) / 3.0;
    float s = texture(iAudioData, vec2(from, 0.25)).x +
                  texture(iAudioData, vec2(from + st, 0.25)).x +
                  texture(iAudioData, vec2(from + st * 2.0, 0.25)).x +
                  texture(iAudioData, vec2(from + st * 3.0, 0.25)).x;
    return s * 0.25;
}
vec3 Rot(in vec3 p, in vec3 r) //las
{
    Rot2D(p.xz, r.y);
    Rot2D(p.yx, r.z);
    Rot2D(p.zy, r.x);
    return p;
}

float sdKMC( in vec3 p,    //KIFS Menger Style
             in int iters,
             in vec3 fTra,
             in vec3 fRot,
             in vec4 para )
{
    int i;
    float col = 0.;
    float x1, y1;
    float r = p.x*p.x + p.y*p.y + p.z*p.z;

    for(i = 0; i < iters && r < 1e6; i++)
    {
        if (i > 0)
        {
            p -= fTra;
            p = Rot(p, fRot);
        }

        p = abs(p);

        if (p.x-p.y < 0.) { x1=p.y; p.y=p.x; p.x=x1;}
        if (p.x-p.z < 0.) { x1=p.z; p.z=p.x; p.x=x1;}
        if (p.y-p.z < 0.) { y1=p.z; p.z=p.y; p.y=y1;}

        p.z -= .5 * para.x * (para.y - 1.) / para.y;
        p.z = -abs(p.z);
        p.z += .5 * para.x * (para.y - 1.) / para.y;

        p.x = para.y * p.x - para.z * (para.y - 1.);
        p.y = para.y * p.y - para.w * (para.y - 1.);
        p.z = para.y * p.z;

        r = p.x*p.x + p.y*p.y + p.z*p.z;
    }

    return length(p) * pow(para.y, float(-i));
}

vec2 SDF(vec3 p, float depth)
{
    float d = MAX_DIST, col = 0.;

    p = abs(Rot(p, vec3(10.5 - depth)));
    //p += palette2(depth*1.5)*1.5*bass;
    //p += fft.x*.8352;
    p *=  ffts.w;
    float sphere = length(p - vec3(1.8 + sin(iAmplifiedTime/3. + depth)*.6, 0, 0)) - .1;
    col = mix(col, 1.7, step(sphere, d));
    d = min(sphere, d);

    float torus = length( vec2(length(p.yz) - 1.2, p.x)) - .01;
    col = mix(col, 1.3, step(torus, d));
    d = min(torus, d);

    //float menger = sdKMC(p*2.9, 8, vec3(sin(iAmplifiedTime/53.))*.4, vec3(sin3(iAmplifiedTime/64.)*PI), vec4(2., 3.5, 4.5, 5.5)) / 2.9;
    float menger = sdKMC(p*2.9, 8, vec3(sin(iAmplifiedTime/53.))*.4, vec3(sin3(iAmplifiedTime/64.)*PI), vec4(2., 3.5, 4.5, 5.5)) / 2.9;
    col = mix(col, floor(mod(length(p)*1.5, 4.))+.5, step(menger, d));
    d = min(menger, d);
    return vec2(d, col);
}


float dens = .9;
vec2 Map(in vec3 p) //Thanks dracusa, nice aticle <3
{
    vec3 pos = p;

    //forward log-spherical map
    float r = length(p);
    p = vec3(log(r), acos(p.z / r), atan(p.y, p.x));

    float t = iAmplifiedTime/7. + iMouse.x/iResolution.x*3.;
    p.x -= t;
    float scale = floor(p.x*dens) + t*dens;
    p.x = mod(p.x, 1. / dens);

    //inverse log-spherical map
    float erho = exp(p.x);
    float sintheta = sin(p.y);
    p = vec3(
        erho * sintheta * cos(p.z),
        erho * sintheta * sin(p.z),
        erho * cos(p.y)
    );

    vec2 sdf = SDF(p, scale);
    sdf.x *= exp(scale/dens);

    return sdf;
}

vec3 Normal(in vec3 p, in float depth)
{
    float h = depth / iResolution.y;
    vec2 k = vec2(1, -1);

    return normalize(   k.xyy * Map(p + k.xyy * h).x +
                        k.yyx * Map(p + k.yyx * h).x +
                        k.yxy * Map(p + k.yxy * h).x +
                        k.xxx * Map(p + k.xxx * h).x );
}

vec3 RayMarch(vec3 ro, vec3 rd)
{
    float col = 0.;
	float dO = mix(MIN_DIST, MAX_DIST/2., S(.9, 1., sin(iAmplifiedTime/24.)*.5+.5));
    int steps = 0;

    for(int i = 0; i < MAX_STEPS; i++)
    {
        steps = i;

    	vec3 p = ro + rd*dO;
        vec2 dS = Map(p);
        col = dS.y;
        dO += min(dS.x, length(p)/12.);

        if (dO > MAX_DIST || dS.x < dO / iResolution.y) break;
    }

    return vec3(steps == 0 ? MIN_DIST : dO, steps, col);
}

float CalcAO(const in vec3 p, const in vec3 n) //IQ
{
    float occ = AO_OCC;
    float sca = AO_SCA;

    for( int i = 0; i < 5 ; i++ )
    {
        float h = .001 + .150 * float(i) / 4.;
        float d = Map(p + h * n).x;
        occ += (h - d) * sca;
        sca *= .95;
    }
    return S(0., 1. , 1. - 1.5 * occ);
}


const vec3 ambCol = vec3(.03,.05,.1) * 5.5;
const vec3 sunCol = vec3(1., .7, .4) * 1.2;
const vec3 skyCol = vec3(.3, .5, 1.) * .04;
const float specExp = 4.;

vec3 Shade(vec3 col, float mat, vec3 p, vec3 n, vec3 rd, vec3 lp)
{

    vec3    lidi = normalize(lp - p);
    float   amoc = CalcAO(p, n),
            diff = max(dot(n, lidi), 0.),
            spec = pow(diff, max(1., specExp * mat)),
            refl = pow(max(0., dot(lidi, reflect(rd, n))), max(1., specExp * 3. * mat));

    return  col * (amoc * ambCol +                                          //ambient
                   (1. - mat) * diff * sunCol +                             //diffuse
                   mat * (spec + refl) * sunCol);                           //specular

}

vec3 hsv2rgb_smooth(in vec3 c) //IQ
{
    vec3 rgb = clamp( abs(mod(c.x*6.+vec3(0.,4.,2.),6.)-3.)-1., 0., 1.);
	rgb = rgb*rgb*(3.-2.*rgb);
    rgb *= hi;
	return c.z * mix( vec3(1.), rgb, c.y);
}

vec3 Palette(int index)
{
    switch (index)
    {

        case 0: return vec3(1., 1., 1.);
        case 1: return vec3(1., .8, .6);
        case 2: return vec3(.6, .8, 1.);
        /*
        case 0: return vec3(1., 0., hi);
        case 1: return vec3(1.,0., bass);
        case 2: return vec3(.6, 0., 1.);
 		*/
        case 3: return hsv2rgb_smooth(vec3(fract(iAmplifiedTime/21.), .65, .8));
    }
    return vec3(0.);
}

vec3 Ray(in vec2 uv, in vec3 p, in vec3 l)
{

    vec3   f = normalize(l - p),
           r = normalize(cross(vec3(0,1,0), f)),
           u = cross(f,r),
           c = p + f,
           i = c + uv.x*r + uv.y*u;

    return normalize(i - p);
}

vec4 PP(vec3 col, vec2 uv)
{
    col = mix(col, (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14), PP_ACES);
    col = mix(col, S(vec3(0), vec3(1), col), PP_CONT);
    col *= S(PP_VIGN,-PP_VIGN/5., dot(uv,uv));
    col = pow(col, vec3(1) / GAMMA);

    return vec4(col, 1.);
}


void main()
{
    compressFft();
    //vec2 uv = (fragCoord-.5 * iResolution.xy) / iResolution.y;
    vec2 uv = -1.0 + 2.0 *vUv;
    bass = avgFrq(0.0,0.008);
    hi = avgFrq(0.7,1.);
	vec2 m = iMouse.xy / iResolution.xy;
    if (length(m) <= .1) m = vec2(.5);

    vec3 ro = vec3(0, 0, -MAX_DIST/2.);
    ro.yz = Rot2D(ro.yz, -m.y * PI + PI*.5*sin(iAmplifiedTime/10.));
    //ro.yz = Rot2D(ro.yz, -m.y * PI + PI*.5*iAmplifiedTime/10.*fft.x/4000.);
    ro.xz = Rot2D(ro.xz, -m.x * PI*2. - PI*.5*sin(iAmplifiedTime/10.));
    //ro.xz = Rot2D(ro.xz, -m.x * PI*2. - PI*.5*iAmplifiedTime/5.*fft.x/4000.);
    vec3 rd = Ray(uv, ro, vec3(0));

    vec3 bg = skyCol;
    vec3 col = bg;
    vec3 p = vec3(0);
    vec3 rmd = RayMarch(ro, rd);

    if (rmd.x <= MIN_DIST) col = Palette(int(floor(rmd.z)))/8.;
    else if (rmd.x < MAX_DIST)
    {
        p = ro + rd * rmd.x;
        vec3 n = Normal(p, rmd.x);

        float shine = fract(rmd.z);
        col = Palette(int(floor(abs(rmd.z))));
        //col = Shade(col, shine, p, n, rd, vec3(0))*bass*hi*10.*palette2((bass+hi)/2.);
        //col = Shade(col, shine, p, n, rd, vec3(0))*bass*hi*10.*palette2((bass+hi)/2.);
        //col = Shade(col, shine, p, n, rd, vec3(0))*bass*hi*20.*palette2((bass+hi));
        col = Shade(col, shine, p, n, rd, vec3(bass*2., hi*2., hi+bass))*bass*hi*20.*palette2((bass+hi));
    }

    float disFac = S(0.0, 1.0, pow(rmd.x / MAX_DIST, 2.));

    col = mix(col, bg, disFac);
    col += pow(rmd.y / float(MAX_STEPS), 2.5) * normalize(ambCol) *
            (GLOW_INT + (rmd.x < MAX_DIST ? 3.*S(.995, 1., sin(iAmplifiedTime/2. - length(p)/20.)) : 0.)); //glow wave
    //float colId = 2. * floor(mod(iAmplifiedTime/4.+fft.x*2.,4.));
    float colId = 2. * floor(mod(iAmplifiedTime/8.,4.));

    col = mat3(getCol(colId),getCol(colId+1.),getCol(colId+2.)) * col;

    gl_FragColor = PP(col, uv);
}
