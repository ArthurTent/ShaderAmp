// https://www.shadertoy.com/view/4l2GW1
// Modified by ArthurTent
// Created by Xor
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

/*
Here is a test of the sound functions.
I wanted a nice kind of spooky feel to this with the light buzz.
I also added alarms and blinking lights to add to the effect.

By Xor
*/
#define lcolor mix(vec3(1.0,0.5,0.2),vec3(1.2,0.2,0.1),clamp(iGlobalTime-10.0,0.0,1.0))
#define lights 16.0
#define crates 32.0
#define barrels 8.0
//#define alarm clamp(iGlobalTime-10.0,0.0,2.0)
#define alarm clamp(iGlobalTime-10.0,0.0,1.0)

#define SHADOWS
#define ENDLESS

float bassAmp = 0.0;
float bassDrum = 0.0;
vec2 uv = vec2(0.0,0.0);

float rand(vec3 p)
{
 	return fract(abs(cos(mod(dot(p,vec3(84.53,93.38,65.26)),8060.0))*46.35));
}
float srand(vec3 p)
{
 	vec3 f = floor(p);
    vec3 s = smoothstep(vec3(0.0),vec3(1.0),fract(p));

    return mix(mix(mix(rand(f),rand(f+vec3(1.0,0.0,0.0)),s.x),
           mix(rand(f+vec3(0.0,1.0,0.0)),rand(f+vec3(1.0,1.0,0.0)),s.x),s.y),
           mix(mix(rand(f+vec3(0.0,0.0,1.0)),rand(f+vec3(1.0,0.0,1.0)),s.x),
           mix(rand(f+vec3(0.0,1.0,1.0)),rand(f+vec3(1.0,1.0,1.0)),s.x),s.y),s.z);
}
vec3 srand3(vec3 p)
{
 	return vec3(srand(p.xyz),srand(p.yzx),srand(p.zxy));
}
float dcrate(vec3 p, vec3 c)
{
 	return length(max(abs(c)-vec3(0.6,0.6,0.6),0.0));
}
float dbarrel(vec3 p, vec3 b)
{
 	vec2 d = abs(vec2(length(p.xz-b.xz),p.y-b.y)) - vec2(0.4,0.6);
  	return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}
float model(vec3 p)
{
    vec3 P = vec3(mod(p.x,lights)-lights*0.5,p.y,abs(p.z));
    //float light = length(vec3(floor(p.x/lights)*lights+lights*0.5,2.0,0.0)-p)-0.2;
    vec3 cc = vec3(mod(p.x,crates)-rand(vec3(floor(p.x/crates),0.0,0.0))
              *(crates-1.0),p.y,p.z+3.0+rand(vec3(0.0,0.0,floor(p.x/crates)))*2.0);
    float crate = dcrate(p,cc-vec3(0.0,-1.7,2.4));

    vec3 bc = vec3(mod(p.x,barrels)-2.0-rand(vec3(floor(p.x/barrels)))
              *(barrels),p.y,p.z-rand(vec3(floor(p.x/barrels)))*1.0);
    float ceiling = floor(min(abs(p.z*2.0),max(sign(p.y),0.0)))*0.5;
    float barrel = dbarrel(bc,vec3(0.0,-1.7,1.0));
    float pillar = length(max(abs(P-vec3(0.0,0.0,2.6))-vec3(0.1,3.0,0.4),0.0));
 	return min(min(3.0-abs(p.z),2.0+ceiling-abs(p.y))*0.7,min(barrel,min(pillar,crate)));
}
vec3 background(vec3 d)
{
    //return vec3(bassAmp*2.,sin(bassDrum),cos(bassAmp));
    return vec3(bassAmp+2.*bassDrum,sin(bassDrum),cos(bassAmp+bassDrum));
}
float shadow(vec3 p, vec3 L)
{
    float l = 1.0;
    #ifdef SHADOWS
    float h = 1.0;
    float r = 1.0;
    vec3 d = (L-p)/8.0;
    for(int i = 0;i<80;i++)
    {
	    h = model( p+d*r);
        l = min(l,h/r*4.0);
        r = max(r-h,0.2);
        if (h < 0.0 || r < 0.2 ) break;
    }
    #endif
    return l;
}
vec3 color(vec3 p,vec3 norm, vec3 d)
{
    vec2 uv = (p.xz+vec2(srand3(p).xy+(srand3(p*2.0).zx))*0.1+p.y)*0.23;
    float s = (srand(p)*0.2+srand(p*6.0)*0.125+srand(p*16.0)*0.0625)*0.5+0.3;
    s *= clamp(1.0-min(3.0-abs(p.z),2.0-abs(p.y))*100.0,0.5,1.0);
    float t = 1.0-abs(norm.y-0.8)*0.5*(0.25-abs(0.5-fract(p.x))*abs(0.5-fract(p.z)));

    //vec3 light = vec3(floor(p.x/lights)*lights+lights*0.5,1.9,0.0);
    vec3 light = vec3(floor(p.x/lights)*lights+lights*0.5,1.9,0.0);
    vec3 l = (dot(norm,normalize(light-p))*0.5+0.5)*lcolor;
    //float S = pow(clamp(dot(reflect(norm,d),normalize(light-p)),0.0,1.0)*0.5+texture(iChannel0,uv).r*0.5,8.0);
    float S = pow(clamp(dot(reflect(norm,d),normalize(light-p)),0.0,1.0)*0.5,8.0);
    float f = 1.0-pow(srand(vec3(floor(p.x/lights))),4.0)*srand(vec3(iGlobalTime*8.0))-cos(iGlobalTime*8.0)*alarm*0.5;
    float a = max(1.0-length(light-p)/lights*2.0,0.0)*f;
    float b = shadow(p,light);
 	return vec3(b*s*t*mix(vec3(0.2),l,a*0.5+0.5)+S*lcolor*a+max(0.5-length(light-p),0.0)*f*lcolor*8.0);
}
float dist(vec3 p, vec3 d)
{
    float h = 1.0;
    float r = 1.0;
    float dis = -1.0;
    for(int i = 0;i<80;i++)
    {
	    h = model( p+d*r);
        r += h;
        if (h < 0.0 || r > 40.0 ) break;
    }
    if( r < 40.0 ) dis = r;
    return dis;
}
mat3 calcLookAtMatrix(vec3 ro, vec3 ta, float roll)//Function by Iq
{
    vec3 ww = normalize( ta - ro );
    vec3 uu = ( cross(ww,vec3(sin(roll),cos(roll),0.0) ) );
    vec3 vv = ( cross(uu,ww));
    return mat3( uu, vv, ww );
}

vec3 calcNormal(vec3 pos )//Also by Iq
{
    const float eps = 0.002;

    const vec3 v1 = vec3( 1.0,-1.0,-1.0);
    const vec3 v2 = vec3(-1.0,-1.0, 1.0);
    const vec3 v3 = vec3(-1.0, 1.0,-1.0);
    const vec3 v4 = vec3( 1.0, 1.0, 1.0);

	return normalize( v1*model( pos + v1*eps ) +
					  v2*model( pos + v2*eps ) +
					  v3*model( pos + v3*eps ) +
					  v4*model( pos + v4*eps ) );
}


void main()
{
    //vec2 uv = vUv;
    float bp = clamp( 1.0,0.1,0.8);
	bassAmp  = texture(iAudioData, vec2(bp, 0.02)).x;
	bp = clamp( 1.0,0.25,0.42);
    float xy = texture(iAudioData, vec2(bp, 0.1)).x;
    bassDrum =  smoothstep( 0.55, 1., xy);
    vec4 color3 = texture2D(iAudioData, uv);
    //vec2 f = (-iResolution.xy + 2.0*uv.xy)/iResolution.y;//2D Position
    vec2 f = -1.0 + 2.0 *vUv;
    vec3 m = vec3(1.0,0.0,0.0);//Motion direction
    vec3 p = vec3(2.+sin((iGlobalTime-10.0)) *(sin(iGlobalTime)+clamp(iGlobalTime-10.0,0.0,4.0)),
                  srand3(vec3(0.0,iGlobalTime*2.0,0.0)).xy*alarm*0.2-alarm*0.1);//3D Position

    mat3 cm = calcLookAtMatrix(p,m,0.0);//Camera matrix
    #ifdef ENDLESS
        p = vec3((iGlobalTime-10.0)*(2.0+clamp(iGlobalTime-10.0,0.0,4.0)),srand3(vec3(0.0,iGlobalTime*2.0,0.0)).xy*alarm*0.2-alarm*0.1);//3D Position
        cm = calcLookAtMatrix(p,p+m,0.0);
    #endif


    //mat3 cm = calcLookAtMatrix(p,p+m,0.0);//Camera matrix
    //mat3 cm = calcLookAtMatrix(p,m,0.0);//Camera matrix
    /*
    float dir = sin(iGlobalTime);
    mat3 cm;
    if(dir < 0.5) {
        cm = calcLookAtMatrix(p,p+m,0.0);//Camera matrix
    } else {
        cm = calcLookAtMatrix(p,p*dir,0.0);//Camera matrix
    }*/

    vec3 d = normalize( cm * vec3(f.xy,2.0) );//Ray direction
    float r = dist(p,d);//Ray distance
    vec3 c = background(d);//Background Color
    if (r>0.0)
    {
    	c = mix(color(p+d*r,calcNormal(p+d*r),d),c,pow(r/40.0,2.0));//Material color and fade
    }
	gl_FragColor = vec4(c,color3.x);
}