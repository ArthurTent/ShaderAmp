// https://www.shadertoy.com/view/sdKBRc
// Modified by ArthurTent
// Created by jarble
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// copied from QuantumSuper <3
#define getDat(addr) texelFetch( iAudioData, ivec2(addr,0), 0).x
vec4 fft, ffts;
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

vec2 triangle_wave(vec2 a){
    return abs(fract((a+vec2(1.,0.5))*1.5)-.5);
}

void main()
{
    compressFft();
    gl_FragColor = vec4(0.0);
    vec3 col = vec3(0.);
    float t1 = 4.*1.5;
    //vec2 uv = (fragCoord)/iResolution.y/t1/2.0 + vec2(iTime/2.0,iTime/3.0)/t1/16.0;
    vec2 uv = vUv+ vec2(iGlobalTime/2.0,iGlobalTime/3.0)/t1/16.0;
    vec2 t2 = vec2(0.);
    for(int k = 0; k < 9; k++){
        float p1 = sign(uv.x);
        t2 *= (1.+p1)/2.;
        uv = (uv+t2)/1.5;
        //t2 = -p1*triangle_wave(uv-.5)*0.8;
        //t2 = -p1*triangle_wave(uv-.5)*getDat(p1)*0.08;
        //t2 = -p1*triangle_wave(uv-.5)*(getDat(p1)+(sin(iGlobalTime*0.1)-0.2));
        //t2 = -p1*triangle_wave(uv-.5)*(fft.w+(sin(iGlobalTime*0.05)+.001/2.0));
        t2 = -p1*triangle_wave(uv-.5)*(fft.x);
        uv = t2-p1*triangle_wave(uv.yx);
        //vec2 uv1 = uv+triangle_wave(uv.yx+iGlobalTime/4.)/4.;
        vec2 uv1 = uv+triangle_wave(uv.yx+iGlobalTime/4.)/4.;
        col.x = min(p1*(uv1.y-uv1.x),col.x)+col.x * getDat(uv1.y)*2.1;
        col = abs(col.yzx-vec3(col.x)/(3.));
    }
    gl_FragColor = vec4(col*3.,1.0);
}
