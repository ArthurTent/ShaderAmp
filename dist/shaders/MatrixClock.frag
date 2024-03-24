// https://www.shadertoy.com/view/mllyz4
// Modified by ArthurTent
// Created by DantesPlan
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform vec4 iDate;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
//#define SHADERTOY
#define resolution iResolution
/*
#ifdef SHADERTOY
#define resolution iResolution
#define time iTime
#define date iDate
#endif

#ifndef SHADERTOY
#define iResolution resolution
#define iTime time
#define iDate date
uniform vec2 resolution;
uniform float time;
uniform vec4 date;
#endif
*/
uniform float battery;
uniform vec3 daytime;
float snd = 0.0;
#define PI 3.14159265358

#define BLACK vec4(vec3(0.0),1.0)
#define WHITE vec4(1.0)
#define CLEAR vec4(0.0)

float rand11(float co) { return fract(sin(co*(91.3458)) * 47453.5453); }

float rand12(in vec2 uv)
{
	return fract(sin(dot(floor(uv),vec2(12.9898,78.233)))*45.6789);
}

vec2 barrelDistortion(vec2 st, float density)
{
	float r = (st.x*st.x) + (st.y*st.y);
	st *= 3.141592 * density * r + density * r * r;
	return st;
}

vec4 grid(vec2 uv,float tiles,float thickness,float density)
{
	vec4 layer = CLEAR;
	float tileSize = (iResolution.y/tiles);
	vec2 gl = step(fract(uv.xy/vec2(tileSize))*vec2(tileSize),vec2(thickness))*0.3;
	gl = max(gl,step(fract(uv.xy/vec2(tileSize*5.0))*vec2(tileSize*4.0),vec2(thickness)));
	float gridLine = max(gl.x, gl.y)*density;
	layer = abs(uv.x-0.5)<=(thickness)?vec4(vec3(1.0,0.0,0.0),1.0):abs(uv.y-0.5)<(thickness)?vec4(vec3(0.0,1.0,0.0),1.0):vec4(vec3(1.0),gridLine);
	// Center dot
	vec2 cd = step(abs(uv-0.5),vec2(tileSize*0.25));
	layer = mix(layer, vec4(vec3(0.0,0.0,1.0),1.0), min(cd.x,cd.y));
	return layer;
}

float sdRect(vec2 st,vec2 pos,vec2 size)
{
	return max(abs(st.x-pos.x)-size.x,abs(st.y-pos.y)-size.y);
}

float digitFunc(vec2 uv,vec2 pos,vec2 size,float blur,int num)
{
	float d=1.0;

	uv -= pos;
	uv /= size;

	if(num==0)
	{
		d = max(sdRect(uv,vec2(0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(0.0),vec2(1.0,3.0)));
	}
	if(num==1)
	{
		d = sdRect(uv,vec2(2.0,0.0),vec2(1.0,5.0));
	}
	if(num==2)
	{
		d = max(sdRect(uv,vec2(0.0,0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(-1.0,2.0),vec2(2.0,1.0)));
		d = max(d,-sdRect(uv,vec2(1.0,-2.0),vec2(2.0,1.0)));
	}
	if(num==3)
	{
		d = max(sdRect(uv,vec2(0.0,0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(-1.0,2.0),vec2(2.0,1.0)));
		d = max(d,-sdRect(uv,vec2(-1.0,-2.0),vec2(2.0,1.0)));
	}
	if(num==4)
	{
		d = max(sdRect(uv,vec2(0.0,0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(0.0,3.0),vec2(1.0,2.0)));
		d = max(d,-sdRect(uv,vec2(-1.0,-3.0),vec2(2.0,2.0)));
	}
	if(num==5)
	{
		d = max(sdRect(uv,vec2(0.0,0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(1.0,2.0),vec2(2.0,1.0)));
		d = max(d,-sdRect(uv,vec2(-1.0,-2.0),vec2(2.0,1.0)));
	}
	if(num==6)
	{
		d = max(sdRect(uv,vec2(0.0,0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(1.0,2.0),vec2(2.0,1.0)));
		d = max(d,-sdRect(uv,vec2(0.0,-2.0),vec2(1.0,1.0)));
	}
	if(num==7)
	{
		d = max(sdRect(uv,vec2(0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(-1.0,-1.0),vec2(2.0,4.0)));
	}
	if(num==8)
	{
		d = max(sdRect(uv,vec2(0.0,0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(0.0,2.0),vec2(1.0,1.0)));
		d = max(d,-sdRect(uv,vec2(0.0,-2.0),vec2(1.0,1.0)));
	}
	if(num==9)
	{
		d = max(sdRect(uv,vec2(0.0,0.0),vec2(3.0,5.0)),-sdRect(uv,vec2(0.0,2.0),vec2(1.0,1.0)));
		d = max(d,-sdRect(uv,vec2(-1.0,-3.0),vec2(2.0,2.0)));
	}
	return step(d,0.0);
}

vec4 drawDigits(vec2 st, vec2 pos, vec2 size, int maxDigits, float value)
{
	vec4 layer=CLEAR;
	float d=1.0;

	st -= pos;
	st /= size;

	bool ifNeg = (value < 0.0); value = abs(value);

	if(maxDigits==1)
	{
		d = digitFunc(st,vec2(0.0),vec2(1.0),0.0001,int(mod(value,10.0)));
	}
	if(maxDigits==2)
	{
		d = digitFunc(st,vec2(-4.0,0.0),vec2(1.0),0.0001,int(mod(value/10.0,10.0)));
		d = max(d,digitFunc(st,vec2(4.0,0.0),vec2(1.0),0.0001,int(mod(value,10.0))));
	}
	if(maxDigits==3)
	{
		d = digitFunc(st,vec2(-8.0,0.0),vec2(1.0),0.0001,int(mod(value/100.0,10.0)));
		d = max(d,digitFunc(st,vec2(0.0,0.0),vec2(1.0),0.0001,int(mod(value/10.0,10.0))));
		d = max(d,digitFunc(st,vec2(8.0,0.0),vec2(1.0),0.0001,int(mod(value,10.0))));
	}
	if(maxDigits==4)
	{
		d = digitFunc(st,vec2(-12.0,0.0),vec2(1.0),0.0001,int(mod(value/1000.0,10.0)));
		d = max(d,digitFunc(st,vec2(-4.0,0.0),vec2(1.0),0.0001,int(mod(value/100.0,10.0))));
		d = max(d,digitFunc(st,vec2(4.0,0.0),vec2(1.0),0.0001,int(mod(value/10.0,10.0))));
		d = max(d,digitFunc(st,vec2(12.0,0.0),vec2(1.0),0.0001,int(mod(value,10.0))));
	}

	if(ifNeg)
		d = max(d,smoothstep(0.0001,0.0,sdRect(st,vec2(0.0-(float(maxDigits)*5.0),0.0),vec2(2.0,1.0))) );

	layer = ifNeg ? vec4(vec3(1.0,0.0,0.0),step(0.0,d)) : vec4(vec3(1.0),1.0-step(d,0.0));

	return layer;
}

vec4 collon(vec2 uv,vec2 pos,float blur)
{
	float c = min(sdRect(uv-pos,vec2(0.0,0.02),vec2(0.008)),sdRect(uv-pos,vec2(0.0,-0.02),vec2(0.008)));
	return vec4(1.0-step(0.0,c));
}

vec4 rndDigitsTexture(vec2 uv,float rows)
{
	vec2 ipos = floor(uv*rows);
	vec2 fpos = fract(uv*rows)-0.5;

	ipos += vec2(0.0,floor(iGlobalTime*2.0*rand12(vec2(ipos.x+1.0,0.0))));

	float pct = rand12(ipos);//*(iGlobalTime*0.1);
	float chr = drawDigits(fpos, vec2(0.0)*ipos, vec2(0.08), 1, pct*10.0).a;

    return vec4(step(1.0,chr));
}

vec4 digitTime(vec2 uv,vec2 pos,float blur)
{
	vec4 layer = CLEAR;
	float mils,secs,mins,hrs;

	uv -= pos;
	uv *= 0.6;

	if(abs(uv.x)>0.3 || abs(uv.y)>0.065) return CLEAR;


	mils = fract(iDate.w);
	secs = mod(floor(iDate.w),60.0);
	secs = secs<60.0?secs:0.0;
	mins = mod(floor(iDate.w/60.0),60.0);
	hrs = mod(floor(iDate.w/3600.0),24.0);


	vec4 hours = drawDigits(uv, vec2(-0.21,0.0), vec2(0.0125), 2, hrs);
	vec4 minutes = drawDigits(uv, vec2(0.0), vec2(0.0125), 2, mins);
	vec4 seconds = drawDigits(uv, vec2(0.21,0.0), vec2(0.0125), 2, secs);
	vec4 colonLayer = max(collon(uv,vec2(-0.105,0.0),blur),collon(uv,vec2(0.105,0.0),blur));
	colonLayer.rgb *= (mod(floor(iDate.w), 2.0)<1.0) ? 0.5 : 1.0;

	vec4 staticNum = drawDigits(uv, vec2(-0.21,0.0), vec2(0.0125), 2, 88.0);
	staticNum = max(staticNum,drawDigits(uv, vec2(0.0), vec2(0.0125), 2, 88.0));
	staticNum = max(staticNum,drawDigits(uv, vec2(0.21,0.0), vec2(0.0125), 2, 88.0));
	staticNum = max(staticNum,colonLayer);
	staticNum = vec4(staticNum.rgb*0.2,staticNum.a);

	layer = mix(staticNum, hours, hours.a);
	layer = mix(layer,minutes,minutes.a);
	layer = mix(layer,seconds,seconds.a);

	layer = mix(layer,colonLayer,colonLayer.a);

	return layer;
}

vec4 digitDate(vec2 uv,vec2 pos,float blur)
{
	vec4 layer = CLEAR;

	uv-=pos;
	uv*=0.85;

	if(abs(uv.x)>0.41 || abs(uv.y)>0.065) return CLEAR;

	float day = mod(iDate.z,31.0);
	if(day<=0.0) day=1.0;
	float month = mod(iDate.y,12.0)+1.0;
	if(month-1.0<=0.0) month=01.0;
	float year = mod(iDate.x,9999.0);
	if(year<=0.0) year=1900.0;

	vec4 dayLayer = drawDigits(uv, vec2(-0.31,0.0), vec2(0.0125), 2, day);
	vec4 monthLayer = drawDigits(uv, vec2(-0.09,0.0), vec2(0.0125), 2, month);
	vec4 yearLayer = drawDigits(uv, vec2(0.225,0.0), vec2(0.0125), 4, year);

	vec4 staticNum = drawDigits(uv, vec2(-0.31,0.0), vec2(0.0125), 2, 88.0);
	staticNum = max(staticNum,drawDigits(uv, vec2(-0.09,0.0), vec2(0.0125), 2, 88.0));
	staticNum = max(staticNum,drawDigits(uv, vec2(0.225,0.0), vec2(0.0125), 4, 8888.0));
	staticNum = vec4(staticNum.rgb*0.2,staticNum.a);

	layer = mix(staticNum,dayLayer,dayLayer.a);
	layer = mix(layer,monthLayer,monthLayer.a);
	layer = mix(layer,yearLayer,yearLayer.a);

	float point=1.0;
	point = sdRect(uv,vec2(0.017,-0.055),vec2(0.008));
	point = min(point,sdRect(uv,vec2(-0.2,-0.055),vec2(0.008)));
	vec4 pointLayer = vec4(vec3(1.0),step(point,0.0));

	layer = mix(layer,pointLayer,pointLayer.a);

	return layer;
}

vec4 digitTimeDate(vec2 uv,vec2 pos,vec2 res,float blur, vec4 color)
{
	vec4 layer=CLEAR;

	vec4 digitTime = digitTime(uv,pos+vec2(0.0,0.135),blur)*color;
	vec4 digitDate = digitDate(uv,pos-vec2(0.0,0.1),blur)*color;

	layer = mix(vec4(0.0),digitTime,digitTime.a);
	layer = mix(layer,digitDate,digitDate.a);

	return layer;
}

vec4 progressbar(vec2 uv,vec2 pos,vec2 size)
{
	vec4 layer = CLEAR;
	vec2 uv2=uv-pos;

	uv-=pos;
	uv*=size;

	if(abs(uv.x)>size.x/(size.x*1.99) || abs(uv.y)>size.y/(size.y*19.0)) return CLEAR;

	float rc=0.0,px;
	vec4 empty = vec4(1.0,0.0,0.0,1.0);
	vec4 full = vec4(0.0,1.0,0.0,1.0);

	float steps=11.0,space=0.05,width,height;

	width = 1.0/steps;
	height = 0.05;

	for(float i=-steps*0.5;i<steps*0.5;i+=1.0)
	{
		px = (width*0.5)+i*width;
		rc = min(rc, sdRect(uv,vec2(px, 0.0), vec2(width-space,height)));
	}
	rc = 1.0-step(0.0,rc);

	float val = (battery<=0.0) ? sin(iGlobalTime)*0.5+0.5 : battery;
	float progressBlend = (uv.x-val) <= -0.5 ? 1.0 : 0.0;
	layer = mix(empty*rc,full*rc,progressBlend);

	vec4 percent = drawDigits(uv2, vec2(0.0), vec2(0.01025), 3, val*100.1);

	return mix(layer,vec4(vec3(0.1),1.0),percent.a);
}

vec4 digitalRain(vec2 uv,vec2 res,float rows)
{
	vec4 layer = CLEAR;
	float density = 0.7;
	float t = iGlobalTime*0.5;

	float tailLen = 5.0;
	vec2 pCells = floor(uv * rows);

	float offset = sin(pCells.x * 15.0);
	float speed =  cos(pCells.x * 3.0) * 0.2 + 0.4;
	float line = fract(uv.y +  speed * t + offset);
	float c = clamp(0.9 / pow(line * tailLen, 1.0), 0.0, 1.0);

	float glow = 1.0-(length(fract(uv*rows)-0.5)/0.75);
	float dt = clamp(rndDigitsTexture(uv,rows).r, 0.0, 1.0)*c;
	dt = mix(dt,glow,dt);

	if(line < 0.01) dt = dt*5.0;

	layer = vec4(vec3(0.0,dt,0.0),c*density);

	return layer;
}

void main( )
{
	snd = texture(iAudioData, vec2(0.0)).r;
	//vec2 uv = (fragCoord.xy-0.5*resolution.xy)/min(resolution.x,resolution.y)+0.5;
	// vec2 uv = vUv; // big clock
	vec2 uv =-1.0 + 3.0 *vUv;
	vec2 sluv = uv;

	gl_FragColor = CLEAR;

	float scaleFactor = 1.0,tpy = 0.0;
	bool showGrid = false, android = false;

	if(resolution.x < resolution.y)
	{
		scaleFactor = 2.0;
		tpy = 0.0;
	}
	else
	{
		scaleFactor = 1.0;
		tpy = android ? 0.625 : 0.73;
	}

	uv += barrelDistortion(uv-0.5,0.03);

	// add glitches
	//vec2 glitchOffset = (mod(rand11(iGlobalTime)*0.5+1.5, 1.91) >= 1.9) ? vec2(0.0,sin(iGlobalTime + uv.y*3.141592)) : vec2(0.0);

	//uv += glitchOffset;

	float vely = 0.25;//(sluv.y>1.0) ? rand12(sluv)*0.5+0.5 : sluv.y;
	sluv.y += 1.5*fract((sluv.y*0.5)+iGlobalTime*vely)-1.5;
    //sluv.y += 1.0*sin(iGlobalTime*0.75)-0.5;
	float sLine = smoothstep(0.05,-0.05,abs(sluv.y)-0.0001);
	uv = mix(uv,vec2(0.5),(sLine*0.1)*uv.x);

	float tvPixel = smoothstep(1.5, -1.5, length(fract((sluv*160.0))-0.5)-0.25);
	tvPixel = pow(tvPixel,2.0);
	tvPixel += 0.1 * sin(iGlobalTime*160.0);

	//vec4 gridLayer = (showGrid) ? grid(fragCoord-(resolution.xy*0.5),30.0*scaleFactor,1.5,0.5) : vec4(0.0);
	vec4 gridLayer = vec4(0.0);
	vec4 rainLayer = digitalRain(uv,resolution.xy,20.0);
	vec4 progressbarLayer = android ? progressbar(uv,vec2(0.5,0.9-tpy),vec2(1.1,0.6)) : CLEAR;
	vec4 digitTimeDateLayer = digitTimeDate(uv,vec2(0.5,1.2-tpy),resolution.xy,0.1,vec4(vec3(0.2,1.0,0.2),1.0));

	gl_FragColor = mix(gl_FragColor,gridLayer,gridLayer.a);
	gl_FragColor = mix(gl_FragColor,rainLayer,rainLayer.a);
	gl_FragColor = mix(gl_FragColor,progressbarLayer,progressbarLayer.a);
	gl_FragColor = mix(gl_FragColor,digitTimeDateLayer,digitTimeDateLayer.a);
	gl_FragColor = mix(gl_FragColor,gridLayer,gridLayer.a);

	gl_FragColor = mix(gl_FragColor, vec4(0.0,1.0,0.0,1.0), tvPixel);
	gl_FragColor = mix(gl_FragColor, vec4(0.0,1.0,0.0,1.0), (sLine*0.5));
	gl_FragColor = gl_FragColor* (0.15+snd);

	// Vignette
	//vec2 uv2 = (fragCoord/iResolution.xy) - 0.5;
	//vec2 uv2 = vUv/iResolution.xy - 0.5;
	vec2 uv2 = -1.0 + 2.0 *vUv;
	//float dist = length(uv2) * 2.0;
	float dist = length(uv) ;
	float vig = 1.0/(dist*dist + 1.0);
	gl_FragColor = mix(gl_FragColor, vec4(0.0,0.0,0.0,1.0), 1.0-vig);
}
