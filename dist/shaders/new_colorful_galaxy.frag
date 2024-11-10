// https://www.shadertoy.com/view/lcjfzW
// Modified by ArthurTent
// Created by nayk 
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)


#define iterations 13
#define formuparam 0.53

#define volsteps 20
#define stepsize 0.1

#define zoom   0.800
#define tile   0.850
#define speed  0.010 

#define brightness 0.0015
#define darkmatter 0.300
#define distfading 0.730
#define saturation 0.850

#define time iAmplifiedTime

#define PI 3.141592
#define TWOPI 6.283184

#define R2D 180.0/PI*
#define D2R PI/180.0* 

mat2 rotMat(in float r){float c = cos(r);float s = sin(r);return mat2(c,-s,s,c);}

//fract -> -0.5 -> ABS  : coordinate absolute Looping
float abs1d(in float x){return abs(fract(x)-0.5);}
vec2 abs2d(in vec2 v){return abs(fract(v)-0.5);}
float cos1d(float p){ return cos(p*TWOPI)*0.25+0.25;}
float sin1d(float p){ return sin(p*TWOPI)*0.25+0.25;}

#define OC 15.0
vec3 Oilnoise(in vec2 pos, in vec3 RGB)
{
    vec2 q = vec2(0.0);
    float result = 0.0;
    
    float s = 2.2;
    float gain = 0.44;
    vec2 aPos = abs2d(pos)*0.5;//add pos

    for(float i = 0.0; i < OC; i++)
    {
        pos *= rotMat(D2R 30.);
        float time = (sin(iAmplifiedTime)*0.5+0.5)*0.2+iAmplifiedTime*0.8;
        q =  pos * s + time;
        q =  pos * s + aPos + time;
        q = vec2(cos(q));

        result += sin1d(dot(q, vec2(0.3))) * gain;

        s *= 1.07;
        aPos += cos(smoothstep(0.0,0.15,q));
        aPos*= rotMat(D2R 5.0);
        aPos*= 1.232; 
    }
    
    result = pow(result,4.504);
    return clamp( RGB / abs1d(dot(q, vec2(-0.240,0.000)))*.5 / result, vec3(0.0), vec3(1.0));
}


float easeFade(float x)
{
    return 1.-(2.*x-1.)*(2.*x-1.)*(2.*x-1.)*(2.*x-1.);
}
float holeFade(float t, float life, float lo)//lifeOffset
{
    return easeFade(mod(t-lo,life)/life);
}
vec2 getPos(float t, float life, float offset, float lo)
{
    return vec2(cos(offset+floor((t-lo)/life)*life)*iResolution.x/2.,
    sin(2.*offset+floor((t-lo)/life)*life)*iResolution.y/2.);

}

void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 ro, in vec3 rd )
{
	//get coords and direction
	vec3 dir=rd;
	vec3 from=ro;
	
	//volumetric rendering
	float s=0.1,fade=1.;
	vec3 v=vec3(0.);
	for (int r=0; r<volsteps; r++) {
		vec3 p=from+s*dir*.5;
		p = abs(vec3(tile)-mod(p,vec3(tile*2.))); // tiling fold
		float pa,a=pa=0.;
		for (int i=0; i<iterations; i++) { 
			p=abs(p)/dot(p,p)-formuparam; 
            p.xy*=mat2(cos(iAmplifiedTime*0.01),sin(iAmplifiedTime*0.01),-sin(iAmplifiedTime*0.01),cos(iAmplifiedTime*0.01) );// the magic formula
			a+=abs(length(p)-pa); // absolute sum of average change
			pa=length(p);
		}
		float dm=max(0.,darkmatter-a*a*.001); //dark matter
		a*=a*a; // add contrast
		if (r>6) fade*=1.3-dm; // dark matter, don't render near
		//v+=vec3(dm,dm*.5,0.);
		v+=fade;
		v+=vec3(s,s*s,s*s*s*s)*a*brightness*fade; // coloring based on distance
		fade*=distfading; // distance fading
		s+=stepsize;
	}
	v=mix(vec3(length(v)),v,saturation); //color adjust
	fragColor = vec4(v*.01,1.);	
}
float happy_star(vec2 uv, float anim)
{
    uv = abs(uv);
    vec2 pos = min(uv.xy/uv.yx, anim);
    float p = (2.0 - pos.x - pos.y);
    return (2.0+p*(p*p-1.5)) / (uv.x+uv.y);      
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec4 o =fragColor;
    vec2 u =fragCoord;
	vec2 uv=fragCoord.xy/iResolution.xy-.5;
    
     vec2 st = (fragCoord/iResolution.xy);
            st.x = ((st.x - 0.5) *(iResolution.x / iResolution.y)) + 0.5;
    float stMask = step(0.0, st.x * (1.0-st.x));


    //st-=.5; //st move centor. Oil noise sampling base to 0.0 coordinate
    st*=3.;
    
    vec3 rgb = vec3(0.30, .8, 1.200);
    
    
    //berelium, 2024-06-07 - anti-aliasing
    float AA = 1.0;
    vec2 pix = 1.0 / iResolution.xy;
    vec2 aaST = vec2(0.0);
    vec3 col;
    for(float i = 0.0; i < AA; i++) 
    {
        for(float j = 0.0; j < AA; j++) 
        {
            aaST = st + pix * vec2( (i+0.5)/AA, (j+0.5)/AA );
            col += Oilnoise(aaST, rgb);
        }
    
    }
    
    col /= AA * AA;
	uv.y*=iResolution.y/iResolution.x;
    vec2 v = iResolution.xy, 
         w,
         k = u = .2*(u+u-v)/v.y;    
         
    o = vec4(1,2,3,0);
     
    for (float a = .5, t = iAmplifiedTime*0.21, i; 
         ++i < 19.; 
         o += (1.+ cos(vec4(0,1,3,0)+t)) 
           / length((1.+i*dot(v,v)) * sin(w*3.-9.*u.yx+t))
         )  
        v = cos(++t - 7.*u*pow(a += .03, i)) - 5.*u,         
        u *= mat2(cos(i+t*.02 - vec4(0,11,33,0))),
        u += .005 * tanh(40.*dot(u,u)*cos(1e2*u.yx+t))
           + .2 * a * u
           + .003 * cos(t+4.*exp(-.01*dot(o,o))),      
        w = u / (1. -2.*dot(u,u));
              
    o = pow(o = 1.-sqrt(exp(-o*o*o/2e2)), .3*o/o) 
      - dot(k-=u,k) / 250.;
	vec3 dir=vec3(uv*zoom,1.);

vec2  resolution = iResolution.xy;
	
    // Initialize color and texture accumulators
    vec4 color = vec4(1.0, 2.0, 3.0, 0.0);
    vec4 baseColor = color;
    
    // Initialize time and amplitude variables

    float amplitude = 0.5;
  vec2 coord = fragCoord * 2. - iResolution.xy;
    // Normalized pixel coordinates (from 0 to 1)
 
    
    
    float holeSize = iResolution.y/10.;
    float holeLife = 2.;
    
    
    vec3 final;
	float audio_avg = 0.;
    for (int i = 0; i<45; i++) {
		audio_avg +=FFT((1.+float(i)*2.));
		float audio = FFT((1.+float(i)*2.)) * 7.;
        vec3 col = 0.5 + 0.5*cos(iAmplifiedTime+uv.xyx+vec3(float(i),2.*float(i)+4.,4.*float(i)+16.));// * audio;

        float s = holeSize;
        float lifeOffset = float(i)/2.;

        vec2 pos = getPos(iAmplifiedTime, holeLife, float(i)*4.5,lifeOffset);

        float d = distance(coord,pos)/s;
        d = 1./d-.1;
        
        final += mix(vec3(0),col, d)*holeFade(iAmplifiedTime,holeLife,lifeOffset)*audio;
    }
	audio_avg/=45.;
	
	//if(FFT(25) >.2) {
	/*
	if(audio_avg >.2) {
		//final = 1.0 - final.rgb+final*audio_avg*10.;
		//final = 1.0 - final.rgb+final*audio_avg*14.;
		//final = 1.0 - final.rgb+final*audio_avg*14.*(vec3(FFT(0), FFT(25), FFT(50))*.5);
		//final = 1.0 - final.rgb+final*audio_avg*14.*(vec3(FFT(0)*.5, FFT(25)*.75, FFT(50)*2.)*2.5);
		final = 1.0 - final.rgb+final*audio_avg*14.*(vec3(FFT(0)*.75, FFT(25), FFT(50)*1.5*audio_avg)*1.2);
	}*/
     
    vec2 uv2 = tanh(uv);
     uv2*=10.;
   
    // Final color adjustment for visual output
    
	vec3 from=vec3(1.,.5,0.5);
	
	mainVR(fragColor, fragCoord, from, dir);
    
  fragColor*=vec4(final*vec3(0.4,1.,1.)+o.xyz,1.);
     
}

void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}

