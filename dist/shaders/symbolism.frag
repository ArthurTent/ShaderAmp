// https://www.shadertoy.com/view/DsVXz1
// Modified by ArthurTent
// Created by QuantumSuper
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// Symbolism 0.74.230405 by QuantumSuper
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// auto-vj with glyphs, colors, and relations
// inspired by alro's Neon Love: https://www.shadertoy.com/view/WdK3Dz
//
// - use with music in iChannel0 -
// 

#define aTime 2.133333*iAmplifiedTime
vec4 fft, ffts; //compressed frequency amplitudes

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData; // nice hint for loading tAudio --> https://threejs.org/examples/webaudio_visualizer
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform sampler2D iVideo; 
varying vec2 vUv;

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;
const float PI = 3.1415926;

// MIT Licensed hash From Dave_Hoskins (https://www.shadertoy.com/view/4djSRW)
vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

vec3 stars(in vec3 p)
{
    vec3 c = vec3(0.);
    float res = iResolution.x*0.8;
    
	for (float i=0.;i<4.;i++)
    {
        vec3 q = fract(p*(.15*res))-0.5;
        //q*= snd/10.;
        vec3 id = floor(p*(.15*res));
        vec2 rn = hash33(id).xy;
        float c2 = 1.-smoothstep(0.,.6,length(q));
        c2 *= step(rn.x,.0005+i*i*0.001);
        c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.25+0.75);
        p *= 1.4;
    }
    return c*c*.65;
}
void camera(vec2 fragCoord, out vec3 ro, out vec3 rd, out mat3 t)
{
    float a = 1.0/max(iResolution.x, iResolution.y);
    //rd = normalize(vec3((fragCoord - iResolution.xy*0.5)*a, 0.5));
    rd = normalize(vec3(fragCoord, 1.0));

    ro = vec3(0.0, 0.0, -15.);

    //float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y));
    float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y))+sin(iTime/20.);
    vec2 m = PI*ff + vec2(((iMouse.xy + 0.1) / iResolution.xy) * (PI*2.0));
    //m.y = -m.y;
    m.y = sin(m.y*0.5)*0.3 + 0.5;

    //vec2 sm = sin(m)*sin(iTime), cm = cos(m)*(1.+sin(iTime));
    vec2 sm = sin(m)*(1.+sin(iTime/10.)/2.), cm = cos(m);
    mat3 rotX = mat3(1.0, 0.0, 0.0, 0.0, cm.y, sm.y, 0.0, -sm.y, cm.y);
    mat3 rotY = mat3(cm.x, 0.0, -sm.x, 0.0, 1.0, 0.0, sm.x, 0.0, cm.x);

    t = rotY * rotX;

    ro = t * ro;
    rd = t * rd;

    rd = normalize(rd);
}

void compressFft(){ //compress sound in iChannel0 to simplified amplitude estimations by frequency-range
	fft = vec4(0), ffts = vec4(0);

	// Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)
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
				//fft.yzw*=1.3;ffts*=1.3; //debug factor for VirtualDJ (?limiter related?)
}

mat2 rotM(float a){float c = cos(a), s = sin(a); return mat2(c,s,-s,c);}

float hash21(vec2 p){ //pseudorandom generator, see The Art of Code on youtu.be/rvDo9LvfoVE
	p = fract(p*vec2(13.81, 741.76));
	p += dot(p, p+42.23);
	return fract(p.x*p.y);
}

vec2 getHeart(float t){ //source: https://mathworld.wolfram.com/HeartCurve.html
	return vec2( 16.*sin(t)*sin(t)*sin(t), //x
			13.*cos(t) - 5.*cos(2.*t) - 2.*cos(3.*t) - cos(4.*t)+1.) //y + shift
		/50.; //scale factor
}

vec2 getEight(float t){ //source: https://mathworld.wolfram.com/Lemniscate.html
	return .5*cos(t)/(1.+sin(t)*sin(t))*vec2(1.,sin(t))/1.2;
}

vec2 getHArrow(float t){ //three lines resembling half an arrow
	t = mod(t,PI); //one way
	return (t<.15*PI)? vec2(-.6,.67-sin(t-.15*PI))/3.5 : (t<.8*PI)? vec2(-cos(t),cos(t))/3.5 : vec2(sin(t)+.2,-.8)/3.5;
}

vec2 getCurve(float t){ //a curving line segment
	t = fract(sin(t));
	t = (t<.01||t>.99)? 42.:t; //fix edge cases
	return vec2(.7*t,t*t)/4.;
}

float getRing(vec2 p){ //simple ring with radius 1 about 0,0
	return abs(length(p)-1.); 
}

float getLine(vec2 p, vec2 a, vec2 b){ //source: https://iquilezles.org/articles/distfunctions2d/
	vec2 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0., 1.);
	return 4.*length( pa - ba*h ); //factor 4 for visual style
}

float lightUp(float dist){ //light around dist=0
	return 6.*smoothstep(.025, .0, dist)+clamp(.00008/dist/dist,.0,1.)+(1.+fft.w)*.0001/dist; //combined semi-hard shape with semi-soft & soft glow
}

vec3 getCol(float id){ //color definitions
	vec3 col = vec3(1.);
	id *= (id<1.)? 16. : 1.; //indirect overload 

	if (id<1. ){ //random for id==0.
		id = hash21(42.123+iResolution.xy*.1*ceil(aTime/4.+1.));
		col = vec3(id,fract(id*10.),fract(id*100.))*255.;}
	else if (id<2. ) col = vec3(252,157,  0); //miami orange
	else if (id<3. ) col = vec3( 26,246,138); //miami green
	else if (id<4. ) col = vec3(244,  0,204); //vw pink2
	else if (id<5. ) col = vec3( 30, 29,215); //vw blue2
	else if (id<6. ) col = vec3(231, 15, 20); //arena red
	else if (id<7. ) col = vec3(103,211,225); //arena blue
	else if (id<8. ) col = vec3( 54, 52, 80); //light lilac
	else if (id<9. ) col = vec3(254,159,167); //light rose
	else if (id<10.) col = vec3( 30,248,236); //magic turquoise
	else if (id<11.) col = vec3(155, 11, 15); //splatter red
	else if (id<12.) col = vec3( 11, 45,100); //king blue
	else if (id<13.) col = vec3(141,245,180); //nordic green
	else if (id<14.) col = vec3(131, 58,187); //nordic violet
	else if (id<15.) col = vec3(241,214,109); //bambus yellow
	else if (id<16.) col = vec3(  0,142,124); //bambus green

	return clamp(col/255.+min(ffts.x,min(ffts.y,ffts.z))-ffts.xyz,.0,1.); //alter color by ffts.xyz
}

vec3 makeSym(vec2 p, float id){ //glyph definitions (lots of redundant code but individually tweakable), reference: https://seechangehappen.co.uk/gender-identity-pride-flags-glyphs-symbols-and-icons/
	vec3 col = vec3(0);
	id *= (abs(id)<1.)? (id<.0)? 8.:20. : 1.; //indirect overload 
	float cid1 = hash21(vec2(.123*ceil(aTime/8.), id+id)); //color 1
	float cid2 = (id<.0)? hash21(vec2(.456*ceil(aTime/8.), id*id)) : 0.; //color 2
	float t = aTime;

	if (id<-3.){ //heart, animated
		for (float n=0.;n<33.;n++){ //apperance is framerate dependent, adjust loop length, t increment, and intensity respectively
			t -= .05;  
			col += getCol(cid1)*lightUp(length(p-getHeart(t)));
			col += getCol(cid2)*lightUp(length(p-getHeart(t+PI)));
		}
	}
	else if (id<-2.){ //polyheart, animated
		float cid3 = hash21(vec2(.789*ceil(aTime/8.), id*id*id)); //color 3
		for (float n=0.;n<33.;n++){
			t -= .05;  
			col += getCol(cid1)*lightUp(length(p-getHeart(t)));
			col += getCol(cid2)*lightUp(length(p-getHeart(t+PI)));
			col += getCol(cid3)*lightUp(length(p+vec2(.0,.03)-getEight(t)));
		}
	}
	else if (id<-1.){ //arrow, animated
		for (float n=0.;n<33.;n++){
			t -= .03; 
			col += getCol(cid1)*lightUp(length(p-getHArrow(t)));
			col += getCol(cid2)*lightUp(length(-p.yx-getHArrow(t+PI/4.)));
		}
	}
	else if (id<0.){ //ace, animated
		p.y -= .08;
		for (float n=0.;n<33.;n++){ 
			t -= .05; 
			col += getCol(cid1)*lightUp(length(-p-getHeart(t)));
			col += getCol(cid2)*lightUp(length(-p-getHeart(t+PI)));
			col += getCol(cid1)*lightUp(length(p+vec2(.2,.45)-getCurve(t)));
			col += getCol(cid2)*lightUp(length(vec2(-p.x+.2,p.y+.45)-getCurve(t+PI)));
		}
	}
	else if (id<1.){ //female
		p.y -= .12;
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) ));
	}
	else if (id<2.){ //male
		p.y += .08;
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.17), vec2(.37)) )+
				lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+
				lightUp( getLine( p, vec2(.38,.22), vec2(.38)) ));
	}
	else if (id<3.){ //androgyne
		p.y += .1;
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(-.1,.33), vec2(.1,.33)) )+
				lightUp( getLine( p, vec2(-.1,.42), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(.1,.42), vec2(.0,.5)) ));
	}
	else if (id<4.){ //agender
		p.y += .1;
		col = getCol(cid1)*1e2*(
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(-.23,.0), vec2(.23,.0)) ));
	}
	else if (id<5.){ //neutrois
		p.y += .1;
		col = getCol(cid1)*1e2*(
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) ));
	}
	else if (id<6.){ //intergender
		p.y -= .12;
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.2,-.14), vec2(.38,-.32)) )+
				lightUp( getLine( p, vec2(.14,-.2), vec2(.32,-.38)) )+
				lightUp( getLine( p, vec2(.24,-.3), vec2(.16,-.38)) )+
				lightUp( getLine( p, vec2(.38,-.18), vec2(.38,-.32)) ));
	}
	else if (id<7.){ //transgender
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+
				lightUp( getLine( p, vec2(.17), vec2(.37)) )+
				lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+
				lightUp( getLine( p, vec2(.38,.22), vec2(.38)) )+
				lightUp( getLine( p, vec2(-.17,.17), vec2(-.37,.37)) )+
				lightUp( getLine( p, vec2(-.22,.38), vec2(-.38,.38)) )+
				lightUp( getLine( p, vec2(-.38,.22), vec2(-.38,.38)) )+
				lightUp( getLine( p, vec2(-.3,.18), vec2(-.18,.3)) ));
	}
	else if (id<8.){ //genderflux
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+
				lightUp( getLine( p, vec2(.17), vec2(.37)) )+
				lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+
				lightUp( getLine( p, vec2(.38,.22), vec2(.38)) )+
				lightUp( getLine( p, vec2(-.17,.17), vec2(-.35,.35)) )+
				lightUp( getLine( p, vec2(-.38,.25), vec2(-.17,.3)) )+
				lightUp( getLine( p, vec2(-.3,.17), vec2(-.25,.38)) ));
	}
	else if (id<9.){ //third gender
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(-.25,.0), vec2(-.35,.0)) )+
				lightUp( getLine( p, vec2(-.5,.1), vec2(-.5,-.1)) )+
				lightUp( getLine( p, vec2(-.5,.1), vec2(-.35,.0)) )+
				lightUp( getLine( p, vec2(-.35,.0), vec2(-.5,-.1)) ));
	}
	else if (id<10.){ //genderqueer
		p.y += .08;
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.49)) )+
				lightUp( getLine( p, vec2(.1,.31), vec2(-.1,.43)) )+
				lightUp( getLine( p, vec2(.1,.43), vec2(-.1,.31)) ));
	}
	else if (id<11.){ //pangender
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.49)) )+
				lightUp( getLine( p, vec2(.1,.31), vec2(-.1,.43)) )+
				lightUp( getLine( p, vec2(.1,.43), vec2(-.1,.31)) )+
				lightUp( getLine( p, vec2(-.23,.0), vec2(.23,.0)) )+    
				lightUp( getLine( p, vec2(.0,-.24), vec2(.0,-.5)) )+
				lightUp( getLine( p, vec2(-.1,-.33), vec2(.1,-.33)) )+
				lightUp( getLine( p, vec2(-.1,-.42), vec2(.0,-.5)) )+
				lightUp( getLine( p, vec2(.1,-.42), vec2(.0,-.5)) ));
	}
	else if (id<12.){ //epicene
		col = getCol(cid1)*1e2*(
				lightUp( getRing( 4.2*p) )+
				lightUp( length(2.*p) )+
				lightUp( getLine( p, vec2(-.235,.05), vec2(-.35,-.1)) )+
				lightUp( getLine( p, vec2(.235,-.05), vec2(.35,.1)) ));
	}
	else if (id<13.){ //demimale
		p.y += .08;
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.17), vec2(.38)) )+
				lightUp( getLine( p, vec2(.22,.38), vec2(.38)) ));
	}
	else if (id<14.){ //demifemale
		p.y -= .12;
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(-.01,-.36)) ));
	}
	else if (id<15.){ //bigender female male
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(0.,-.25), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+
				lightUp( getLine( p, vec2(.17), vec2(.37)) )+
				lightUp( getLine( p, vec2(.22,.38), vec2(.38)) )+
				lightUp( getLine( p, vec2(.38,.22), vec2(.38)) ));
	}
	else if (id<16.){ //bigender androgyne neutrois
		p.y += .1;
		col = getCol(cid1)*1e2*(
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(.17,-.17), vec2(.37,-.37)) )+
				lightUp( getLine( p, vec2(.22,-.38), vec2(.38,-.38)) )+
				lightUp( getLine( p, vec2(.38,-.22), vec2(.38,-.38)) )+
				lightUp( getLine( p, vec2(.3,-.18), vec2(.18,-.3)) ));
	}
	else if (id<17.){ //bigender third gender demimale
		col = getCol(cid1)*1e2*( 
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(-.25,.0), vec2(-.35,.0)) )+
				lightUp( getLine( p, vec2(-.5,.1), vec2(-.5,-.1)) )+
				lightUp( getLine( p, vec2(-.5,.1), vec2(-.35,.0)) )+
				lightUp( getLine( p, vec2(-.35,.0), vec2(-.5,-.1)) )+
				lightUp( getLine( p, vec2(.17), vec2(.38)) )+
				lightUp( getLine( p, vec2(.22,.38), vec2(.38)) ));
	}
	else if (id<18.){ //bigender agender demifemale
		col = getCol(cid1)*1e2*(
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(-.23,.0), vec2(.23,.0)) )+
				lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(-.01,-.36)) ));
	}
	else if (id<19.){ //genderfluid male female
		p *= rotM(PI/6.);
		col = getCol(cid1)*1e2*(
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(-.235,.05), vec2(-.35,-.1)) )+
				lightUp( getLine( p, vec2(.235,-.05), vec2(.35,.1)) )+
				lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(-.1,.42), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(.1,.42), vec2(.0,.5)) ));
	}
	else if (id<20.){ //genderfluid androgyne female
		p *= rotM(PI/6.);
		col = getCol(cid1)*1e2*(
				lightUp( getRing( 4.2*p) )+
				lightUp( getLine( p, vec2(-.235,.05), vec2(-.35,-.1)) )+
				lightUp( getLine( p, vec2(.235,-.05), vec2(.35,.1)) )+
				lightUp( getLine( p, vec2(0.,-.24), vec2(.0,-.49)) )+
				lightUp( getLine( p, vec2(-.12,-.36), vec2(.12,-.36)) )+
				lightUp( getLine( p, vec2(.0,.24), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(-.1,.33), vec2(.1,.33)) )+
				lightUp( getLine( p, vec2(-.1,.42), vec2(.0,.5)) )+
				lightUp( getLine( p, vec2(.1,.42), vec2(.0,.5)) ));
	} //incomplete list of course

	return col;
}

void main( ){
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
	compressFft(); //initializes fft, ffts
		       //vec2 uv = (2.*fragCoord-iResolution.xy) / max(iResolution.x, iResolution.y); //long edge -1 to 1
		       //vec2 uv = vUv.xy / iResolution.xy;
	vec2 uv = -1.0 + 2.0 *vUv;
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(uv,-1.5));
    mat3 t = mat3(1.0);
	camera(uv, ro, rd, t);
	vec3 vid = texture(iVideo, vUv).rgb;

	// Symbol
	float symId = hash21(vec2(ceil(iAmplifiedTime/8.))); //randomize symbol choice
	symId *= (fract(iAmplifiedTime/8.)<.75)? -1. : 1.; //define ratio between animated and static symbols
							//vec3 col = (.4*ffts.w+fft.x) * makeSym(uv/(.7+.4*ffts.w),symId);   
	vec3 col = (.4*ffts.w+fft.x) * makeSym(uv/(.7+.4*ffts.w),symId);   

	// Background
	float vBar,
	      //spect = 6.*clamp(texelFetch(iChannel0,ivec2(int(511.*abs(fragCoord.y/iResolution.y-1.)),0),0).x-2.*abs(fragCoord.x/iResolution.x-.5),0.,1.); //audio spectrum pattern 
	      //spect = 6.*clamp(texelFetch(iChannel0,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv),0.,1.); //audio spectrum pattern 
	      //spect = 6.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(fragCoord.y/iResolution.y-1.)),0),0).x-2.*abs(fragCoord.x/iResolution.x-.5),0.,1.); //audio spectrum pattern 
	      //spect = 6.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(fragCoord.y/iResolution.y-1.)),0),0).x-2.*abs(fragCoord.x/iResolution.x-.5),0.,1.); //audio spectrum pattern 
	      //spect = 6.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv-.5),0.,1.).y; //audio spectrum pattern 
	      //spect = 120.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv-.5),0.,1.).y; //audio spectrum pattern 
	      spect = 120.*clamp(texelFetch(iAudioData,ivec2(int(511.*abs(uv)),0),0).x-2.*abs(uv-.5),0.,1.).y; //audio spectrum pattern 
	uv = abs(10.*sin(iAmplifiedTime/64.)*uv); //zoom motion   
	for (float n=.0;n<3.;n++){ 
		vBar = abs(fract(uv.x)-(.1+.7*hash21(n*ceil(uv.xx)+floor(4.*aTime))))-.05*n; //vertical bars
		col += smoothstep(fwidth(vBar), .0, vBar) * smoothstep(.8, 0., length(col)) * spect * fft.z * col;
	}

	col = pow(col, vec3(.4545)); //gamma correction
				     //gl_FragColor = vec4(col*vid.rgb,1.0);
				     //gl_FragColor = vec4(col*(0.7+(sin(iAmplifiedTime))*vid.rgb),1.0);
				     //gl_FragColor = vec4(col*(2.35*vid.rgb),1.0);
				     //gl_FragColor = vec4(col*(2.*vid.rgb),1.0);
	gl_FragColor = vec4(col,1.0);
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
