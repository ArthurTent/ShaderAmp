// https://www.shadertoy.com/view/md3GDl
// Modified by ArthurTent
// Created by QuantumSuper
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// Dancing Color Rings v0.7.230305
// auto-vj ellipsoid illusion made of circles
//
// - use with music in iAudioData -

vec4 fft, ffts; //compressed frequency amplitudes

void compressFft(){ //compress sound in iAudioData to simple frequency-range amplitude estimations
    fft = vec4(0), ffts = vec4(0);

	// Sound (assume sound texture with 44.1kHz in 512 texels, cf. shadertoy.com/view/Xds3Rr)
    for (int n=1;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 86-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(2,8,7,4); ffts /= vec4(2,3,3,21); //normalize
    fft.x = smoothstep(.8,.9,fft.x); //weaken weaker sounds, semi hard limit
}

float fitPoly2(float x, vec3 y){ //simple polynom2 fit: expects y at x = {0, .5, 1.}
    return y.r+(4.*y.g-3.*y.r-y.b)*x+(2.*y.r-4.*y.g+2.*y.b)*x*x;
}

vec3 getCol(float id, float s){ //color definitions
    vec3 setCol = vec3(255);

	if (id==0.) setCol = vec3( //vaporwave blue shift
        fitPoly2(s, vec3(9,30,0)), //r
        fitPoly2(s, vec3(0,29,250)), //g
        fitPoly2(s, vec3(66,215,253))); //b
    else if (id==1.) setCol = vec3( //vaporwave red shift
        fitPoly2(s, vec3(132,244,255)),
        fitPoly2(s, vec3(0,0,148)),
        fitPoly2(s, vec3(92,204,255)));
	else if (id==2.) setCol = vec3( //miami green shift
        fitPoly2(s, vec3(39,26,173)),
        fitPoly2(s, vec3(153,246,252)),
        fitPoly2(s, vec3(106,138,248)));
	else if (id==3.) setCol = vec3( //miami orange shift
        fitPoly2(s, vec3(250,252,236)),
        fitPoly2(s, vec3(47,157,212)),
        fitPoly2(s, vec3(11,0,80)));
	else if (id==4.) setCol = vec3( //arena red
        fitPoly2(s, vec3(53,231,237)),
        fitPoly2(s, vec3(17,15,114)),
        fitPoly2(s, vec3(18,20,41)));
	else if (id==5.) setCol = vec3( //arena blue
        fitPoly2(s, vec3(35,103,178)),
        fitPoly2(s, vec3(87,211,225)),
        fitPoly2(s, vec3(97,225,245)));

    return setCol/255.;
}

mat2 rotM(float rad){ //2D rotation matrix
    return mat2(cos(rad),-sin(rad),sin(rad),cos(rad));
}

float sdCircle(vec2 pos, float r){ //signed distance function for circle of radius r with center at (0,0)
    return length(pos)-r;
}

float ring(vec2 pos, float r){ //ring of radius r with fixed width
    return step( abs(sdCircle(pos, r)), .005);
}

void main(){
    float aTime = 2.133333*iTime;
    compressFft(); //initializes fft, ffts
    vec2 fragCoord = vUv * iResolution;
    vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); //long edge -1..1
    //vec3 background = .5*vec3(1.+sign(uv.y+.2)); //define background
    vec3 background = vec3(0.);

    // Generate ellipsoid illusion
    float r = .33*ffts.w+.03; //sphere radius
    float maxRing = ceil(10.*clamp(ffts.w,.2,1.)); //number of rings is 2*maxRing-1
    uv = (fract(aTime/4.)>.5) ? fract(2.5*(.27+mod(aTime/32.,2.)*mod(aTime/32.,2.))*uv+.5)-vec2(.5) : .9*uv; //pattern & single
    uv *= rotM(aTime/8.); //rotate xy
    vec3 myCol;
    vec3 col = vec3(0);

	for (float n=-maxRing+1.;n<maxRing;n++){ //draw rings
        myCol = getCol(mod(n+floor((float(ffts.x<ffts.y)+float(ffts.y<ffts.z)+float(ffts.z<ffts.x))), 6.),fft[1+int(mod(n,3.))]); //define color
        col += myCol*ring((uv-vec2((1.+.66*fft.x)*r*n/maxRing*sin(aTime/16.),.0))/vec2(cos(aTime/16.),1.),r*sqrt(1.-n/maxRing*n/maxRing));
    }

	// Finalizations
    col += background*(1.-max(col.x,max(col.y,col.z))); //draw background
    col = pow(col, vec3(.4545)); //gamma correction
    gl_FragColor = vec4(col,1.0); //output
}