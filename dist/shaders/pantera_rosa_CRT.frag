// https://www.shadertoy.com/view/l3GGRW
// Modified by ArthurTent
// Created by jorge2017a2
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
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


// Common

//iq
float dot2( in vec2 v ) { return dot(v,v); }
float dot2( in vec3 v ) { return dot(v,v); }
float ndot( in vec2 a, in vec2 b ) { return a.x*b.x - a.y*b.y; }

// from arminkz in Mario World 1-1 shader
vec2 CRTCurveUV( vec2 uv )
{
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs( uv.yx ) / vec2( 6.0, 4.0 );
    uv = uv + uv * offset * offset;
    uv = uv * 0.5 + 0.5;
    return uv;
}

void DrawVignette( inout vec3 color, vec2 uv )
{    
    float vignette = uv.x * uv.y * ( 1.0 - uv.x ) * ( 1.0 - uv.y );
    vignette = clamp( pow( 16.0 * vignette, 0.3 ), 0.0, 1.0 );
    color *= vignette;
}

void DrawScanline( inout vec3 color, vec2 uv )
{
    float scanline 	= clamp( 0.95 + 0.05 * cos( 3.14 * ( uv.y + 0.008 * iAmplifiedTime ) * 240.0 * 1.0 ), 0.0, 1.0 );
    float grille 	= 0.85 + 0.15 * clamp( 1.5 * cos( 3.14 * uv.x * 640.0 * 1.0 ), 0.0, 1.0 );    
    color *= scanline * grille * 1.2;
}

float sdEllipse( in vec2 p, in vec2 ab )
{
    p = abs(p); if( p.x > p.y ) {p=p.yx;ab=ab.yx;}
    float l = ab.y*ab.y - ab.x*ab.x;
    float m = ab.x*p.x/l;      float m2 = m*m; 
    float n = ab.y*p.y/l;      float n2 = n*n; 
    float c = (m2+n2-1.0)/3.0; float c3 = c*c*c;
    float q = c3 + m2*n2*2.0;
    float d = c3 + m2*n2;
    float g = m + m*n2;
    float co;
    if( d<0.0 )
    {
        float h = acos(q/c3)/3.0;
        float s = cos(h);
        float t = sin(h)*sqrt(3.0);
        float rx = sqrt( -c*(s + t + 2.0) + m2 );
        float ry = sqrt( -c*(s - t + 2.0) + m2 );
        co = (ry+sign(l)*rx+abs(g)/(rx*ry)- m)/2.0;
    }
    else
    {
        float h = 2.0*m*n*sqrt( d );
        float s = sign(q+h)*pow(abs(q+h), 1.0/3.0);
        float u = sign(q-h)*pow(abs(q-h), 1.0/3.0);
        float rx = -s - u - c*4.0 + 2.0*m2;
        float ry = (s - u)*sqrt(3.0);
        float rm = sqrt( rx*rx + ry*ry );
        co = (ry/sqrt(rm-rx)+2.0*g/rm-m)/2.0;
    }
    vec2 r = ab * vec2(co, sqrt(1.0-co*co));
    return length(r-p) * sign(p.y-r.y);
}





//Quadratic Bezier - exact   (https://www.shadertoy.com/view/MlKcDD)

float sdBezier( in vec2 pos, in vec2 A, in vec2 B, in vec2 C )
{    
    vec2 a = B - A;
    vec2 b = A - 2.0*B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;
    float kk = 1.0/dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
    float kz = kk * dot(d,a);      
    float res = 0.0;
    float p = ky - kx*kx;
    float p3 = p*p*p;
    float q = kx*(2.0*kx*kx-3.0*ky) + kz;
    float h = q*q + 4.0*p3;
    if( h >= 0.0) 
    { 
        h = sqrt(h);
        vec2 x = (vec2(h,-h)-q)/2.0;
        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        float t = clamp( uv.x+uv.y-kx, 0.0, 1.0 );
        res = dot2(d + (c + b*t)*t);
    }
    else
    {
        float z = sqrt(-p);
        float v = acos( q/(p*z*2.0) ) / 3.0;
        float m = cos(v);
        float n = sin(v)*1.732050808;
        vec3  t = clamp(vec3(m+m,-n-m,n-m)*z-kx,0.0,1.0);
        res = min( dot2(d+(c+b*t.x)*t.x),
                   dot2(d+(c+b*t.y)*t.y) );
        // the third root cannot be the closest
        // res = min(res,dot2(d+(c+b*t.z)*t.z));
    }
    return sqrt( res );
}

// Image

// Fork of "pantera rosa" by jorge2017a2. https://shadertoy.com/view/l3GGRW
// 2024-08-05 11:06:26

//por jorge2017a2
//pantera rosa
//referencia
//https://iquilezles.org/articles/distfunctions2d
///2-jun-2024-
#define antialiasing(n) n/min(iResolution.y,iResolution.x)

#define S(d,b) smoothstep(antialiasing(1.5),0. , d - (b) )
#define S2(d,b) smoothstep(8.0*antialiasing(1.5),0.,d - (b) )
#define S3(d,b) smoothstep(1.0/antialiasing(0.5),0. , d - (b) )

#define PI     3.14159265
#define TWO_PI 6.28318530
float Sdf_I(float distA, float distB)
	{ return max(distA, distB);}
float Sdf_U(float distA, float distB)
	{ return min(distA, distB);}
float Sdf_D(float distA, float distB)
	{ return max(distA, -distB);}



vec3 DFB(vec3 pColObj, vec3 colOut, float distObj )
{ colOut = mix(colOut,pColObj ,S3( distObj,0.0));
  colOut = mix(colOut,vec3(0.0),S3(abs( distObj)-0.005,0.0));
  return colOut;
}


///oneshade    
vec2 Rotate(in vec2 p, in vec2 o, in float r) 
{   float c = cos(r), s = sin(r);
    return (p - o) * mat2(c, -s, s, c) + o;
}


float sdBox( in vec2 p, in vec2 b )
{ vec2 d = abs(p)-b;  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);  }

float sdCircle( vec2 p, float r )
{ return length(p) - r;}

float divf(float a, float b)
{
    //evita crash por 1/0.0 =Infinito=error, en compilar
    if(b==0.0)
    {b=0.00001;}
    return a/b;
}


float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{  vec2 pa = p-a, ba = b-a;
    float h = clamp( divf( dot(pa,ba),dot(ba,ba)), 0.0, 1.0 );
    return length( pa - ba*h );
}

// signed distance to an equilateral triangle
float sdEquilateralTriangle(  in vec2 p, in float r )
{
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r/k;
    if( p.x+k*p.y>0.0 ) p=vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
    p.x -= clamp( p.x, -2.0*r, 0.0 );
    return -length(p)*sign(p.y);
}


float sdUnevenCapsule( vec2 p, float r1, float r2, float h )
{
    p.x = abs(p.x);
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(p,vec2(-b,a));
    if( k < 0.0 ) return length(p) - r1;
    if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
    return dot(p, vec2(a,b) ) - r1;
}


vec3 pantera(vec2 p, vec3 colout)
{

vec2 A,B, med,pr;
float dfin;
float  r1 ;

A=vec2(0.52098,0.56294);
med=vec2(0.4021,0.19231);
float d1=sdEllipse(p-A,med);

A=vec2(0.52098,0.52448);
med=vec2(0.41958,0.15734);
float d2=sdEllipse(p-A,med);

A=vec2(0.98601,0.65231);
med=vec2(0.08741,0.12238);
float ang=50.000 * PI / 180.0;
 pr = Rotate(p-A, med/2.0, ang);
float d3=sdEllipse(pr,med);

A=vec2(0.08392,0.752);
med=vec2(0.08741,0.12238);
 ang=-50.000 * PI / 180.0;
 pr = Rotate(p-A, med/2.0, ang);
float d4=sdEllipse(pr,med);
    
    dfin=999.9;
    dfin=d1;
    dfin=Sdf_U(dfin,d2);
    dfin=Sdf_U(dfin,d3); //oreja der
    dfin=Sdf_U(dfin,d4); //oreja izq
    vec3 colc=vec3(0.97,0.61,0.7);
    colout= DFB(colc, colout, dfin);
    return colout;

}

vec3 ojos(vec2 p, vec3 colout)
{

	float audio = texture(iAudioData,vec2(p.y, 0.)).r/2.;

	p.y-=.67;
	p.x-=.56;
	float l = length(p)/length(iResolution.xy/iResolution.y);
	float a = atan(p.x,p.y)+iTime;
	float s = texture(iAudioData,vec2(abs(fract(5.*a/6.283)*2.-1.),.75)).r;
	float A_ =.4;
	float B_ =.45;
	p.y+=.67;
	p.x+=.56;
	A_*=A_;
	B_*=B_;


	vec2 A,B, med,pr;
	float dfin;
	float  r1 ;

	vec3 colc=vec3(0.99,0.93,0.07);

	//der
	A=vec2(0.63636,0.6958);
	A=vec2(0.60636,0.6958);
	med=vec2(0.08741,0.10839);
	float ang=-40.000 * PI / 180.0;
	 pr = Rotate(p-A, med/2.0, ang);
	// right outlines
	float d1=sdEllipse(pr,med);

	//izq
	A=vec2(0.45105,0.67832);
	A=vec2(0.5105,0.67832);
	med=vec2(0.09091,0.10839);
	 ang=40.000 * PI / 180.0;
	 pr = Rotate(p-A, med/2.0, ang);
	// outlines from the left eye
	float d2=sdEllipse(pr,med);

	dfin=Sdf_U(d1,d2);
	//colc *=audio;

	if(l>d2*20. || l>d1*20.){

		colc.r = 1.-texture(iAudioData,vec2(pow(mix(mix(l,.0,A_),    s ,B_),2.),.25)).r/1.25;
		colc.g = 1.-texture(iAudioData,vec2(pow(mix(mix(l,.5,A_),(1.-s),B_),2.),.25)).r/1.35;
		colc.b = 1.-texture(iAudioData,vec2(pow(mix(mix(l,1.,A_),    s ,B_),2.),.25)).r/1.5;

		colc.rgb = smoothstep(.05,1., colc.rgb+.2*l);
		colc.rgb = pow(colc.rgb, vec3(s));
		//colc.rgb =colc.rgb*0.5;	
	}
	colout= DFB(colc, colout,dfin);


	//pupila
        //p.x+=(sin(iTime)/10.)-0.005;	
        p.x-=-0.01+smoothstep(0.005, 0.02, (sin(iAmplifiedTime/2.)/2.)-0.005)/20.-0.005;	
	A=vec2(0.47203,0.66783);
	r1=0.02448;
	float d3=sdCircle(p-A,r1)*(1.+audio*4.);
	//d3+=nivel*2.0;
	vec3 pupil_inner = vec3(0.);
	//pupil_inner.r = texture(iAudioData,vec2(pow(mix(mix(l,.0,A_),    s ,B_),2.),.25)).r/1.25;
	//pupil_inner.g = texture(iAudioData,vec2(pow(mix(mix(l,.5,A_),    s ,B_),2.),.25)).r/1.25;
	//pupil_inner.b = 1.- texture(iAudioData,vec2(pow(mix(mix(l,1.0,A_),    s ,B_),2.),.25)).r/1.25;
	//colout= DFB(vec3(0.0), colout, d3);
	colout= DFB(pupil_inner, colout, d3);

	//pupila
	A=vec2(0.61888,0.67483);
	r1=0.02448;

	float d4=sdCircle(p-A,r1)*(1.+audio*4.);
	//colout= DFB(vec3(0.0), colout, d4);
	colout= DFB(pupil_inner, colout, d4);
        //p.x-=(sin(iTime)/20.)-0.05;	
        p.x+=-0.01+smoothstep(0.005, 0.02, (sin(iTime)/10.)-0.005)/20.-0.005;	
	    return colout;
}


vec3 nariz(vec2 p, vec3 colout)
{

vec2 A,B, med,pr;
float dfin;
float  r1,ang ;

vec3 colc=vec3(0.96,0.6,0.82);  //rosa
vec3 colb=vec3(0.99,0.51,0.7);

A=vec2(0.55245,0.57552);
med=vec2(0.0744,0.05944);
float d1=sdEquilateralTriangle(p-A,med.x);
colout= DFB(colc, colout, d1);

A=vec2(0.55245,0.6042);
med=vec2(0.0744,0.05944);
float d2=sdEquilateralTriangle(vec2(p.x, -p.y+1.09)-A,med.x);
colout= DFB(colb, colout, d2);
return colout;
}


vec3 boca(vec2 p, vec3 colout)
{
vec2 A,B, med,pr;
float dfin;
float  r1 ;

vec3 colc=vec3(0.97,0.76,0.82);

A=vec2(0.55944,0.3951);
med=vec2(0.24126,0.16084);
float ang=-5.000 * PI / 180.0;
 pr = Rotate(p-A, med/2.0, ang);
float d1=sdEllipse(pr,med);

A=vec2(0.55245,0.20979);
med=vec2(0.24126,0.16084);
 ang=-5.000 * PI / 180.0;
 pr = Rotate(p-A, med/2.0, ang);
float d2=sdEllipse(pr,med);

A=vec2(0.55545,0.32867);
med=vec2(0.15385,0.16084);
 ang=15.000 * PI / 180.0;
 pr = Rotate(p-A, med/2.0, ang);
float d3=sdEllipse(pr,med);

colout= DFB(colc, colout, d3);
    
    dfin=Sdf_D(d1,d2);
    colout= DFB(colc, colout, dfin);
    
    return colout;
}

vec3 cuello(vec2 p, vec3 colout)
{
vec2 A,B, med,pr;
float dfin;
float  r1 ;

vec3 colc=vec3(0.97,0.61,0.7);

A=vec2(0.53147,0.14336);
med=vec2(0.06643,0.15734);
float d1=sdBox(p-A,med);
colout= DFB(colc, colout, d1);
    return colout;
}

//skin ?
vec3 pestana(vec2 p, vec3 colout)
{

vec2 A,B, med,pr;
float dfin;
float  r1 ;
p.x+=0.7;
p.y+=0.6;

A=vec2(0.48657,0.78469);
med=vec2(0.03147,0.08741);
float ang=15.000 * PI / 180.0;
 pr = Rotate(p-A, med/2.0, ang);
float d1=sdBox(pr-A,med);
colout= DFB(vec3(0.0), colout, d1);

A=vec2(0.75734,0.62517);
med=vec2(0.03147,0.06993);
 ang=-15.000 * PI / 180.0;
 pr = Rotate(p-A, med/2.0, ang);
float d2=sdBox(pr-A,med);
colout= DFB(vec3(0.0), colout, d2);
    return colout;
}

vec3 Lineaboca(vec2 p, vec3 colout)
{

vec2 A,B, med,pr;
float dfin;
float  r1 ;

A=vec2(0.54196,0.37063);
B=vec2(0.54196,0.41259);
float d1=sdSegment(p,A,B);
colout= DFB(vec3(0.0), colout, d1);
return colout;
}

vec3 figOreja(vec2 p, vec3 colout)
{

vec2 A,B, med,pr;
float dfin;
float  r1 ;


vec3 colc=vec3(0.97,0.76,0.82);  //rosa

A=vec2(0.14042,0.7182);
r1=0.02098;
float d1=sdUnevenCapsule(vec2(p.x,-p.y+1.45)-A,r1,r1-0.05,0.1);
colout= DFB(colc, colout, d1);

A=vec2(0.97902,0.70483);
r1=0.02098;
float d2=sdUnevenCapsule(vec2(p.x, -p.y+1.45)-A,r1,r1-0.05,0.1);
colout= DFB(colc, colout, d2);
    return colout;
}


vec3 figrostro(vec2 p, vec3 colout)
{
vec2 A,B, med,pr;
float dfin;
float  r1 ;

A=vec2(0.38811,0.55944);
B=vec2(0.44056,0.56993);
float d1=sdSegment(p,A,B);
colout= DFB(vec3(0.0), colout, d1);

A=vec2(0.32168,0.57343);
B=vec2(0.38112,0.55944);
float d2=sdSegment(p,A,B);
colout= DFB(vec3(0.0), colout, d2);

A=vec2(0.67832,0.57692);
B=vec2(0.61888,0.6014);
float d3=sdSegment(p,A,B);
colout= DFB(vec3(0.0), colout, d3);

A=vec2(0.67832,0.57692);
B=vec2(0.73776,0.58741);
float d4=sdSegment(p,A,B);
colout= DFB(vec3(0.0), colout, d4);
    return colout;
}

vec3 bigote(vec2 uv, vec3 col)
{
//float audio = texture(iAudioData,vec2(uv.y, 0.)).r/2.;
//float audio = texture(iAudioData,uv).r/2.;
float audio = texture(iAudioData,vec2(sin(iTime),0.)).r/2.;

uv.x-=0.05;
vec2 pc1p1=vec2(.634,.434);
vec2 pc1p2=vec2(.820,.406);
vec2 pc1p3=vec2(.969,.329);

vec2 pc2p1=vec2(.634,.392);
vec2 pc2p2=vec2(.814,.325);
vec2 pc2p3=vec2(.963,.206);

vec2 pc3p1=vec2(.016,.297);
vec2 pc3p2=vec2(.199,.406);
vec2 pc3p3=vec2(.363,.413);

vec2 pc4p1=vec2(.022,.168);
vec2 pc4p2=vec2(.193,.336);
vec2 pc4p3=vec2(.376,.381);


float d1= sdBezier(uv,pc1p1,pc1p2,pc1p3*(1.+audio/10.));
float d2= sdBezier(uv,pc2p1,pc2p2,pc2p3*(1.+audio/10.));
float d3= sdBezier(uv,pc3p1*(1.+audio/5.),pc3p2,pc3p3);
float d4= sdBezier(uv,pc4p1*(1.+audio/5.),pc4p2,pc4p3);

vec3 C1=vec3(0.0);
col=DFB(C1,col,d1);
col=DFB(C1,col,d2);
col=DFB(C1,col,d3);
col=DFB(C1,col,d4);
//if( audio>d1 && audio >d2 && audio>d3 && audio > d4){
//	col*=audio;
//}
    return col;
}

// cosine based palette, 4 vec3 params
vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.283185*(c*t+d) );
}
// colormap
vec3 palette(float t) {
    if(t <1.)t+=1.;
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.);
    //vec3 d = vec3(0.563,0.416,0.457 + .2);
    vec3 d = vec3(0.,0.3,0.67);

    /*
    vec3 a = vec3(.5);
    vec3 b = vec3(.5);
    vec3 c = vec3(2.0, 1.0, 0.0);
    vec3 d = vec3(0.50, 0.20, 0.25);
	*/
    //return a + b*cos( 6.28 * c * (t+d)); // A + B * cos ( 2pi * (Cx + D) )
    //return palette(t, a,b,c,d); 
    return palette(t, vec3(0.8,0.5,0.4),vec3(0.2,0.4,0.2),vec3(2.0,1.0,1.0),vec3(0.0,0.25,0.25) );
}


vec3 tdo_pantera(vec2 p, vec3 colout)
{
	//float audio = texture(iAudioData,vec2(abs(fract(5.*length(p)/6.283)*2.-1.),.75)).r/2.;
	//float audio = texture(iAudioData,vec2(abs(fract(length(p)/length(p.x))),.75)).r/2.;
	//float audio = texture(iAudioData,p/2.).r/2.;
	float audio = texture(iAudioData,p).r/2.;
	float audio2 = texture(iAudioData,vec2(p.y, 0.)).r/2.;
	//vec3(0.97,0.61,0.7)
	//colout = vec3(audio, audio2/2., (audio+audio2)/2.+.1 ); 
	//colout = vec3(audio, audio2/2., (audio+audio2)/2.+.1 )*(.4+palette(sin(iTime))); 
	//colout = vec3(audio, audio2/2., (audio+audio2)/2.+.1 )*(.4+palette(p.x+sin(iTime))); 
	//colout = vec3(audio, audio2/2., (audio+audio2)/2.+.1 )*(.3+palette((p.x+p.y)/2.)+sin(iTime)); 
	//colout = vec3(audio, audio2/2., (audio+audio2)/2.+.1 )*(.3+palette((p.x+p.y)/2.)); 
	//colout = vec3(audio, audio2, (audio+audio2)/2.+.1 )*(.3+palette((p.x+p.y+sin(iTime*audio))/2.)); 
	colout = vec3(audio, audio2, (audio+audio2)/2.+.1 )*(.3+palette((p.y))*1.5); 
    colout=cuello(p,colout); // nacken
    colout=pantera(p, colout);
    colout=pestana(p,colout); // wimper
    colout=ojos(p, colout); // augen
    colout=boca(p,colout);
    colout= nariz(p,colout);
    colout= Lineaboca(p,colout); // *audio;
    colout=figOreja(p,colout);
    colout=figrostro(p,colout);
    colout=bigote(p,colout);
    
    return colout;
}

void main()
{
    vec2 fragCoord = vUv * iResolution;
    vec2 uv = ( 2. * fragCoord - iResolution.xy ) / iResolution.y;
    uv-=vec2(-1.,-1.);
    float esc=0.6;
    uv*=esc;
    //uv.x+=0.3;
    //uv+=vec2(0.25*cos(-iTime), 0.25*sin(-iTime));
    vec2 uv0=uv;
    vec3 col = vec3(0.5,0.1,1.0);
    //vec3 col=vec3(0.5,0.1,1.0)-uv.y*0.5;    
    //col= tdo_pantera(uv*0.5,col);
	
	float rnd = 0.5 + 0.2*sin(iTime*0.25);
	float multiplier = 0.9 + 0.2 * rnd;
	uv *= multiplier;


	col= tdo_pantera(uv,col);
    //col= tdo_pantera(uv*2.0+vec2(0.25,0.5),col);
    //col= tdo_pantera(uv*2.0+vec2(-1.20,0.5),col);
    col=pow(col,  vec3(0.54545));
	
    uv    = fragCoord.xy / iResolution.xy;
    vec2 crtUV = CRTCurveUV(uv);
    if ( crtUV.x < 0.0 || crtUV.x > 1.0 || crtUV.y < 0.0 || crtUV.y > 1.0 )
    {
        col = vec3( 0.0, 0.0, 0.0 );
    }
    DrawVignette( col, crtUV );
    DrawScanline( col, uv );

    gl_FragColor = vec4(col,1.0);
}



