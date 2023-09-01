// https://www.shadertoy.com/view/ctBSWt
// Created by QuantumSuper
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License. 

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// ShatterFlake 0.62.230218
// auto-vj with snowflake symmetry
//
// - use with music in iAudioData -

#define PI 3.14159265359 
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
    fft.x = step(.9,fft.x); //weaken weaker sounds, hard limit
}

mat2 rotM(float rad){ // rotation matrix in 2D
    return mat2(cos(rad),-sin(rad),sin(rad),cos(rad));
}

float hash21(vec2 p){ //pseudorandom generator, see The Art of Code on youtu.be/rvDo9LvfoVE
    p = fract(p*vec2(13.81, 741.76));
    p += dot(p, p+42.23);
    return fract(p.x*p.y);
}

float line(vec2 p, vec2 a, vec2 b){ //a line between a and b in domain of p
	vec2 ab = b-a;
	return .005/length(a+(ab)*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.)-p);
}

float rect(vec2 c, vec2 dim){ //c at center of rectangle dim
    vec2 dv = abs(c/dim)-.5; //dist per axis
    return 1./max(.0,max(dv.x+dv.y,max(dv.x,dv.y)));
}

float flakeLine(vec2 p, vec2 a, vec2 b){ //hexagonal prism geometry for line
    return line(abs(p), a, b) + line(abs(p*rotM(PI/3.)), a, b) + line(abs(p*rotM(-PI/3.)), a, b);
}

float flakeRect(vec2 p, vec2 c, vec2 d){ //hexagonal prism geometry for rectangle
    return rect(abs(p)-c, d) + rect(abs(p*rotM(PI/3.))-c, d) + rect(abs(p*rotM(-PI/3.))-c, d);
}

void main() {
    // General initializations
    // vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); // viewport max -1..1
    vec2 uv = -1.0 + 2.0 *vUv;  
    float aTime = 1.066667*iGlobalTime;
    compressFft(); //initializes fft, ffts

    // View manipulation
    float amp = .2*fft.w*hash21(floor(300.12*uv+42.)*cos(aTime)); //noise
    if (abs(uv.y)<.2*fft.z) uv*=.5+.5*fft.z*10.; //horizontal bar
    uv *= rotM(sin(aTime/8.))*(1.+.2*sin(aTime/4.)); //rotate & zoom 
    uv = 2.*fract(.5*uv+.5)-1.; //edge repeat
    
    // Generate pattern parameters
    vec2 r = vec2(42.23*floor(aTime), floor(aTime));
    vec2 r2 = vec2(42.23*ceil(aTime), ceil(aTime));
    vec2 a1 = vec2(hash21(r),hash21(r*2.345));
    vec2 a2 = vec2(hash21(r2),hash21(r2*2.345));
    vec2 a = smoothstep(a1,a2,a1+(-a1+a2)*fract(aTime)); //smoothstepped linear outwards movement
    vec2 b = .5*fft.xw;
    if(length(b)<.5) b = vec2(hash21(sin(r)),hash21(r*r))*(.7+.3*fft.w); //default on "calm" b in case of low volume  
    
    // Draw lines
    amp += flakeLine(2.5*uv*rotM(-aTime/4.),a,b)+flakeLine(1.25*uv*rotM(-aTime/4.),a,b);
    vec3 col = vec3(amp*amp); //light falloff correction
    col *= vec3(ffts.x<=ffts.y,ffts.y<=ffts.z,ffts.z<=ffts.x); //colors;
    
    // Draw rectangles
    amp = fft.x*smoothstep(0.,100., flakeRect(uv, vec2(sin(a1.x),cos(a1.y)), vec2(.1)+a2*(.66+.33*fract(aTime))));
    col += vec3(amp);
  
    // Output
	col = pow(col, vec3(.4545)); //gamma correction
    gl_FragColor = vec4(col,1.0);
    gl_FragColor += pow(max(gl_FragColor - .4, 0.15), vec4(1.4))*vec4(vec3(0.5-(cos(iGlobalTime)+sin(iGlobalTime)), sin(iGlobalTime)*.5, cos(iGlobalTime)*5.),1.);

}