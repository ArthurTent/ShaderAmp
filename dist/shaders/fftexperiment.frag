// https://www.shadertoy.com/view/4tK3zG
// Modified by ArthurTent
// Created by nshelton
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// based on :
// https://www.shadertoy.com/view/XtSGDK#
// Created by inigo quilez - iq/2015
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;

varying vec2 vUv;


float thresh = 10.0;


float udBox( vec3 p, vec3 b )
{
  return length(max(abs(p)-b,0.0));
}

float manhattan(vec3 p) {
 	return max(max(p.x, p.y), p.z);   
}

float shape( vec3 p, float t)
{
    
    
    float fftSpace = manhattan(abs(p) /20.) ;
    
    float fft = texture(iAudioData, vec2(fftSpace, 0.25)).r;
    
    vec3 dim = vec3(pow(fft, 4.0)) / 2.;// vec3(p0,p1,p2);

	dim.x = 2.0 ;

    vec3 c = vec3(2.);
	vec3 q = mod(p,c)-0.5*c;

    float d1 = udBox(q,dim.xyz);
    float d2 = udBox(q,dim.zyx);
    float d3 = udBox(q,dim.zxy);

    return min( min(d1,d2), d3);
}

float map( vec3 p, float t )
{
    float s = 1.1;
    //p = deform( p, t, s );
    return shape( p, t ) * s;
}

vec3 shade( in vec3 ro, in vec3 rd, in float t, float time)
{

    vec3 p = rd;
    
    float contour = abs(sin(length(p))  ) < 0.1 ? 1.0 : 0.0;

    float fftSpace = length(rd /10.) + 0.2 ;
    float fft = texture(iAudioData, vec2(fftSpace, 0.25)).r;

    return vec3(1. - t) * abs(rd);
}

const int ITER = 50;

float intersect( in vec3 ro, in vec3 rd, const float maxdist, float time)
{

    float t = 0.2;
    float iter = 0.0;
    for( int i=0; i<ITER; i++ )
    {
        vec3 p = ro + t*rd;
        float h = map( p, time);

        if( h<exp(-thresh) || t>maxdist ) break;
        
        t += h * 0.9 ;
        iter++;
    }
	return iter / float(ITER);
}

vec3 render( in vec3 ro, in vec3 rd, float time )
{
    vec3 col = vec3(0.0);
    
    const float maxdist = 43.0;
    float t = intersect( ro, rd, maxdist, time );
    if( t < maxdist )
    {
        col = shade( ro, rd, t, time );
    }
    return pow( col, vec3(0.5) );
    //return pow( col, vec3(cos(col.x),cos(col.z),0.5) );
}

mat3 setCamera( in vec3 ro, in vec3 rt, in float cr )
{
	vec3 cw = normalize(rt-ro);
	vec3 cp = vec3(cr,cr,0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, -cw );
}

mat3 calcLookAtMatrix(vec3 origin, vec3 target, float roll) {
  vec3 rr = vec3(sin(roll), cos(roll), 0.0);
  vec3 ww = normalize(target - origin);
  vec3 uu = normalize(cross(ww, rr));
  vec3 vv = normalize(cross(uu, ww));

  return mat3(uu, vv, ww);
}

void main() 
{
    //vec2 p = (-iResolution.xy+2.0*(fragCoord.xy))/iResolution.y;
    vec2 p = -1.0 + 2.0 *vUv -.5;
    
    float time = iGlobalTime * 0.05;

    float rad = 5.;

    //vec3 ro = vec3(0.5,0.0,0.5) + 2.0*vec3(cos(an),1.0,sin(an));
	vec3 ro = vec3(rad * cos(time), rad * sin(time), 2. * sin(time/10.0)); 
    //mat3 ca = setCamera( vec3(0.0), ta, 0.1 );
    
    mat3 rot = calcLookAtMatrix(ro, vec3(0.0), 0.0);
    vec3 rd = rot * normalize(vec3(p, 1.0));

    vec3 col = render( ro, rd, time );
	gl_FragColor = vec4( col, 1.0 );
}

