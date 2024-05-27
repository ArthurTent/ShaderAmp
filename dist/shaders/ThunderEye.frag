// https://www.shadertoy.com/view/Dsy3WD
// Modified by ArthurTent
// Created by QuantumSuper
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// Thunder Eye 0.93.230311 by QuantumSuper
// auto-vj from 2d-spheres and lines
//
// - use with music in iChannel0 & noise texture in iChannel1 -

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define PI 3.14159265359
vec4 fft, ffts; //compressed frequency amplitudes

mat2 rotM(float a){float c = cos(a), s = sin(a); return mat2(c,s,-s,c);} //2D rotation matrix from angle in radians
float rand(float a, float b){return texture(iChannel1,vec2(a,b),0.).x;} //pseudo random from texture

float sphere(vec2 pos, float r){ //inverse inner circle distance
    float lPos = length(pos)/r;
    return (lPos<1.) ? (1.-lPos) : 0.;
}

float line(vec2 p, vec2 a, vec2 b){ //a line between a and b in domain of p
	vec2 c = b-a;
	return clamp(.001/length(a+(c)*clamp(dot(p-a,c)/dot(c,c),0.,1.)-p),.0,1.);
}

void compressFft(){ //compress sound in iChannel0 to simple frequency-range amplitude estimations
    fft = vec4(0), ffts = vec4(0);

	// Sound (assume sound texture with 44.1kHz in 512 texels, cf. shadertoy.com/view/Xds3Rr)
    for (int n=1;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 86-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz, each sample
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz, second sample
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz, fourth sample
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(2,8,7,4); ffts /= vec4(2,3,3,21); //normalize
    //fft.x = step(.7,fft.x); //weaken weaker sounds, hard limit
}

void main(){
    // General initializations
    compressFft(); //initializes fft, ffts
    //vec2 uv = .5+2.*(fragCoord-.5*iResolution.xy) / max(iResolution.x, iResolution.y); //long edge -.5 to 1.5
    vec2 uv = -1. + vUv*3.;
    //float aTime = 2.133333*iTime;
    float aTime = 2.133333*iAmplifiedTime;
    float sTime = .001*iTime;

    // Background preparation
    float isBack =  1.-smoothstep(.01,.0,length(uv-.5)-.5/(.95+.2*sin(aTime/16.)*fft.x));
    uv = (step(.7,fft.x)<.5) ? uv : mix(2.*fract((4.*fract(.15-sTime)+1.)*uv*rotM(sTime))-.5, uv, 1.-isBack); //eye repetition

    // Fog
    float amp = 0.;
    float aFrac;
    //for (float n=0.;n<1.;n+=.05){
    for (float n=0.;n<1.;n+=.25){
        aFrac = fract(.005*aTime+n);
        amp += sphere(uv-vec2(rand(n,.456*sTime),rand(.254*sTime,n)),.1+rand(.5*n,.5*sTime)*aFrac)*smoothstep(1.,.33,aFrac)*smoothstep(.0,.66,aFrac);
    }
    //vec3 col = vec3(.1*fft.z*amp); //add fog
	vec3 col = vec3(.1*fft.z*amp*.2); // add scaled fog

    // Lightning
    float lightn = 0.;
    vec4 lPos;
    uv = uv-vec2(.5); //set 0,0 at screen center
    uv *= .95+.2*sin(aTime/16.)*fft.x; //eye zoom
    vec2 irisPos = (.1-.2*vec2(rand(.123*ceil(sTime),.456*ceil(aTime/2.)),rand(.123*floor(aTime/2.),.456*floor(sTime)))+.01*fft.w);
    float irisRad = .2*(.9+.2*ffts.w);
    mat2 myRotM = rotM(.2*PI); //m times equals full rotation
    for (float m=.0;m<10.;m++){ //?I guess here is a lot of room for parallel computation optimization?
        uv *= myRotM;
        irisPos *= myRotM;
        lPos = vec4(.5*irisRad)+irisPos.xyxy; //start pos
        for (float n=.1;n<1.;n+=.1){
            lPos.zw += .1*vec2(rand(n,.123*m*ceil(aTime))-.4*n,rand(.1*m+.456*ceil(aTime),n*n)-.3*n*fft.y);
            lightn += line(uv, lPos.xy, lPos.zw);
            lPos.xy = lPos.zw*1.014; //fast fix against overlap
        }
    }
    lightn *= .6*ffts.w*(smoothstep(.0,1.,.1/sphere(uv-irisPos,irisRad))-smoothstep(1.,0.,sphere(uv,.5))); //inner & outer "vignette"
    lightn -= clamp(10.*sphere(uv-irisPos,irisRad),.0,1.-.8*clamp(amp,.0,1.)); //center iris
    lightn /= amp*amp*amp; //dampen lightning by fog
    col += lightn*mix( (vec3(fft.y>=fft.z,fft.z>=fft.w,fft.w>=fft.y)+vec3(ffts.y<=ffts.z,ffts.z<=ffts.x,ffts.x<=ffts.z))*vec3(sin(aTime),cos(aTime),.33), vec3(1), smoothstep(.0,-.03,length(uv-irisPos)-irisRad)); //add colored lightning
    col += .5/clamp(amp*amp*amp,.5,5.)*ffts.w*sphere(((uv-.8*irisPos)*rotM(.8-isBack*sTime)-vec2(1.45*irisRad,.0))*vec2(.65,3.),.09); //highlight

    // Background finalization
    uv = -1. + vUv*3.;// .5+2.*(vUv-.5*iResolution.xy) / max(iResolution.x, iResolution.y); //reset uv, long edge -.5 to 1.5
    col = (step(.7,fft.x)<.5) ? col : mix(.66*clamp(col,.0,1.),col,1.-isBack); //set visibility

    // Output
	col = pow(col, vec3(.4545)); //gamma correction
    gl_FragColor = vec4(col,1.0);
}
