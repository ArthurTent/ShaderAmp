// https://www.shadertoy.com/view/cst3zl
// Modified by ArthurTent
// Created by QuantumSuper
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// Fork: Dive Into Music 1.03.230301
// Forked from "Dive into geometry" by Deep4, https://shadertoy.com/view/Ddc3zs
// Now with added auto-vj capabilities, dust particles & light ring
//
// - use with music in iChannel0 -

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;

varying vec2 vUv;


#define PI 3.14159265359

float animTime;
vec4 fft, ffts;

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
    fft.x = step(.91,fft.x); //weaken weaker sounds, hard limit
}

float hash21(vec2 p){ //pseudorandom generator, cf. The Art of Code on youtu.be/rvDo9LvfoVE
    p = fract(p*vec2(13.81, 741.76));
    p += dot(p, p+42.23);
    return fract(p.x*p.y);
}

mat2 rotM(float deg){
    deg /= 180./PI;
    return mat2(cos(deg),-sin(deg),sin(deg),cos(deg));
}

float particle(vec2 p){
    return smoothstep(.1,.0,length(p)) * smoothstep(.1,.06,length(p-vec2(0.,.02)));
}

float dustLayer(vec2 p){
    float id = hash21(floor(p));
    return smoothstep(0.,1.,id)*particle((fract(p)-vec2(.5+.4*cos(id*animTime),.5+.4*sin(.8*id*animTime)))*rotM(id*360.)/vec2(cos(.5*id*animTime),1)); //...is there performance gain in doing this rather than via sub steps?
}

vec3 Field(vec3 Pos) //forked
 {
	Pos *= 0.1;
	float f = 0.1;

	for (int i = 0; i < 5; ++i)
	{
		Pos = (Pos.yzx * mat3(0.8, 0.6, 0, -0.6, 0.8, 0.0, 0.0, 0.0, 1.0)) + vec3(0.123, 0.456, 0.789) * float(i);
		Pos = (abs(fract(Pos) - 0.5)) * 2.0;
		f *= 2.0;
	}

	Pos *= Pos;
	return sqrt(Pos + Pos.yzx) / f + 0.0001;
}

void main(){
    //vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); // viewport max -1..1
    vec2 uv = vUv * 2.0 - 1.0;
    float d2 = uv.x*uv.x+uv.y*uv.y; //polar distance squared
    animTime = 2.133333*iGlobalTime; // maybe stay with iTime?
	vec3 col;
    float aFrac, amp = 0.;
    compressFft(); //initializes fft, ffts
    vec3 Position = vec3(0.5, 0.8, .5*animTime+.4*fft.w*fft.w*fft.w);
    vec3 Direction = vec3((1.-.5*cos(animTime/16.))*uv,1.);

    // Dust layers
    for (float n=0.;n<4.;n++){
        aFrac = fract(-.05*animTime+.25*n)-.03*fft.w*fft.w*fft.w;
        amp += 1.4*(.2+.8*fft.z)*dustLayer((uv+n*vec2(.1,.05))*25.*aFrac)*smoothstep(1.,.33,aFrac);
    }
    amp *= (.7+.5*length(uv)); //anti-vignette

    // Original geometry field, forked
	for (int i = 0; i < 50; ++i){
		vec3 f2 = Field(Position);
		Position += Direction * min(min(f2.x, f2.y), f2.z);
		col += float(50 - i) / (f2 + 0.005);
	}
	col = vec3(1.0 - 1.0 / (1.0 + col * (-0.06 / 2500.0)));
	col *= col;

    // Misc
    col = (.5*amp+3.*col.r)*vec3(ffts.x<=ffts.y,ffts.y<=ffts.z,ffts.z<=ffts.x); //colors
    col += .1*vec3(clamp(.015/abs(d2-.04*(.5+ffts.w))*(.1+.9*fft.x),0.,1.))/(length(col)); //center eye
    gl_FragColor = vec4(col,1.0);
}