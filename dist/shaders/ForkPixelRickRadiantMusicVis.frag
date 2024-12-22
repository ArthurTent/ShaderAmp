// https://www.shadertoy.com/view/MXdGz4
// Modified by ArthurTent
// Merged Pixel Rick with Radiant Music Visualiser
// https://www.shadertoy.com/view/4sVBWy
// Radiant Music Visualiser
// by Hazel Quantock 2018
// https://www.shadertoy.com/view/tssyWB
// Pixel Rick
// by leviathwaite
// This work is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License. http://creativecommons.org/licenses/by-nc-sa/4.0/


uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
#define TWO_PI 6.28
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

// This work is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License. http://creativecommons.org/licenses/by-nc-sa/4.0/
// Merged Pixel Rick with Radiant Music Visualiser
// https://www.shadertoy.com/view/4sVBWy
// Radiant Music Visualiser
// by Hazel Quantock 2018

// https://www.shadertoy.com/view/tssyWB
// Pixel Rick
// by leviathwaite

// Common

// Distance Estimation
// https://iquilezles.org/articles/distance

// Rotate
mat2 Rotate2D(float _angle)
{
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
}

// 2D distance functions
// https://iquilezles.org/articles/distfunctions2d
// https://www.shadertoy.com/view/3ltSW2

float SpikeyCircle(vec2 p, float points)
{
   vec2 st = vec2(atan(p.x, p.y + 0.1), length(p));

  // float t = mod(st.x, 0.05);
  // float t = st.x + st.y * 5.0;
  float t = 1.0 - st.y * 0.2;

  st = vec2(st.x / 6.2831 + 0.5 * t, st.y);

  float x = st.x * points;
  float m = min(fract(x), fract(1.0 - x));
  float spikeLength = 0.7 - st.y;
  float centerRadius = 0.25;
  float c = smoothstep(0.0, 0.02, m * spikeLength + centerRadius - st.y);


  return c;

}

// Circle
float sdCircle( vec2 p, float r )
{
  return smoothstep(0.01, 0.02, length(p) - r);
}

/*
float RotatedRectangle(vec2 st, vec2 size, float angle)
{
  st = Rotate2D(angle) * st;
  return Rectangle (st, size.x, size.y);

*/

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float sdUnevenCapsule( vec2 p, float r1, float r2, float h )
{
    p.x = abs(p.x);
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(p,vec2(-b,a));
    if( k < 0.0 ) return smoothstep(0.01, 0.02,length(p) - r1);
    if( k > a*h ) return smoothstep(0.01, 0.02,length(p-vec2(0.0,h)) - r2);
    return smoothstep(0.01, 0.02,dot(p, vec2(a,b) ) - r1);
}

// Segment

// Segment - exact   (https://www.shadertoy.com/view/3tdSDj and https://www.youtube.com/watch?v=PMltMdi1Wzg)

float sdSegment( in vec2 p, in vec2 a, in vec2 b, float thickness )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    // return length( pa - ba*h );
    return smoothstep(thickness - 0.003, thickness + 0.003,length( pa - ba*h ));
}

float sdLineSegmentRounded(vec2 uv, vec2 a, vec2 b, float lineWidth)
{
   uv *= 10.0;
    vec2 pa = uv-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    // return length( pa - ba*h ) - lineWidth*0.5;
    float line = length( pa - ba*h ) - lineWidth*0.5;
    line = smoothstep(line, line - lineWidth, 0.1);

    return line;
}

// sca is the sin/cos of the orientation
// scb is the sin/cos of the aperture
float sdArc( in vec2 p, in vec2 sca, in vec2 scb, in float ra, in float rb )
{
    p *= mat2(sca.x,sca.y,-sca.y,sca.x);
    p.x = abs(p.x);
    float k = (scb.y*p.x>scb.x*p.y) ? dot(p.xy,scb) : length(p.xy);
    return smoothstep(0.01, 0.015,sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb);
}


// boolean operations
// https://iquilezles.org/articles/distfunctions


float opUnion( float d1, float d2 ) {  return min(d1,d2); }

float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

float opIntersection( float d1, float d2 ) { return max(d1,d2); }


// colors
#define colorBackground vec3(253.0 / 255.0, 253.0 / 255.0, 93.0 / 255.0)
#define colorBlack vec3(0.0)
#define colorHair vec3(0.659, 0.894, 1.0)
#define colorSkin vec3(227.0 / 255.0, 211.0 / 255.0, 195.0 / 255.0)
#define colorShirt vec3(0.659, 0.94, 1.0)
#define colorWhite vec3(1.0)
#define colorVomit vec3(0.788, 0.914, 0.729) // rgb(78.8%,91.4%,72.9%)
#define colorVomitBorder vec3(0.69, 0.855, 0.678)// 69% red, 85.5% green and 67.8% blue.

/////////////////////////////// References ///////////////////////////////////////
// The Amazing World of Gumball - Created by emmasteimann
// https://www.shadertoy.com/view/WtfGWn

// The art of code youtube series by Bigwings
// https://www.youtube.com/channel/UCcAlTqd9zID6aNX3TzwxJXg
// Smiley
// https://www.shadertoy.com/view/lsXcWn

// Inigo Quilez's youtube
// https://youtu.be/0ifChJ0nJfM
// and site
// https://iquilezles.org/articles/distfunctions2d



// https://mortoray.com/2015/06/19/antialiasing-with-a-signed-distance-field/

/*
float DrawHair(vec2 uv)
{
    // uv *= -1.0;
    // translate
    uv.y -= 0.15;
    // scale larger at top than bottom
    uv.x *= uv.y - 0.99;
  	return SpikeyCircle(uv, 11.0);
}
*/
/*
float shape(vec2 p) {
  float r = length (p - vec2(0,.005) ) * 2.5 - .4,
        a = atan(p.y + .07, p.x),
        f = 1. - sin(mod(a * 6., 4.*.855) + a*.1) * .45,
        w = .05;// w = fwidth(f);
  return smoothstep( -w, w, r - p.y*.5 - f );
}

vec3 drawHair(vec3 color, vec2 p)
{
...
  // best hair
  color = mix(colorBlack, color, shape(p)) ;         // outline
  return  mix(colorHair , color, shape(p*1.035) );   // fill
}
*/

// better hair, but messy and needs to be higher on the y direction to look right
vec3 drawHair(vec3 color, vec2 p)
{
  // translate
  p.x -= 0.02;
  // scale
  p *= 0.8;
  // scale height
  p.y *= 0.8;

  float r = length(vec2(p.x, p.y - 0.005)) * 2.5 - 0.4;
  float a = atan(p.y + 0.07, p.x);

  // best hair
  // outline
  // float f = (1.0 - sin(mod(a * 6.0, 4.0 * (0.855)) + a * 0.1) * 0.45);
  float f = (1.0 - sin(mod(a * 6.0, 4.0 * (0.855))) * 0.45);

  f = smoothstep(f, f + 0.05, r - (p.y * 0.5));

  color = mix(colorBlack, color, f);

  // fill
  p *= 1.035;
  r = length(vec2(p.x, p.y - 0.005)) * 2.5 - 0.4;
  a = atan(p.y + 0.07, p.x);
  f = (1.0 - sin(mod(a * 6.0, 4.0 * (0.85)) + a * 0.1) * 0.45);

  f = smoothstep(f, f + 0.05, r - (p.y * 0.5));
  color = mix(color, colorHair, 1.0 - f);

  return color;
}

vec3 ears(vec3 color, vec2 p)
{
    p = vec2(p.x - 0.35, p.y + 0.15);
    float size = 0.1;

    // Ears
	float d = sdCircle(p, size);
    color = mix(colorBlack, color, d);

    d = sdCircle(p * 1.09, size);
   	color = mix(colorSkin, color, d);

    // Ears
    p = vec2(p.x + 0.7, p.y);

	d = sdCircle(p, size);
    color = mix(colorBlack, color, d);

    d = sdCircle(p * 1.09, size);
   	color = mix(colorSkin, color, d);
    return color;
}

vec3 head(vec3 color, vec2 p)
{
    // Head
	float d = sdCircle(p,0.5);
    color = mix(colorBlack, color, d);

    d = sdCircle(p * 1.03,0.5);
   	color = mix(colorSkin, color, d);
    return color;
}

// TODO consolidate arc methods
float eyeOutline(vec2 p, float radius, float thickness)
{
    // Arc
    float ta = -PI * 0.5; // 3.14*(0.5+0.5*cos(iTime*0.52+2.0));
    float tb = 2.5; // 3.14*(0.5+0.5*cos(iTime*0.31+2.0));
    float rb = thickness; //0.15*(0.5+0.5*cos(iTime*0.41+3.0));

    // distance
    float len = sdArc(p,vec2(sin(ta),cos(ta)),vec2(sin(tb),cos(tb)), radius, rb);

    return len;
}

// TODO consolidate arc methods
float eyeLid(vec2 p, float radius, float thickness)
{
    // translate
    p.y += 0.98;
    // Arc
    float ta = 3.14*(0.5+0.5*0.0);
    float tb = 0.14; // 3.14*(0.5+0.5*cos(iTime*0.31+2.0));
    float rb = thickness; //0.15*(0.5+0.5*cos(iTime*0.41+3.0));

    // distance
    float len = sdArc(p,vec2(sin(ta),cos(ta)),vec2(sin(tb),cos(tb)), radius, rb);

    return len;
}

vec3 eyes(vec3 color, vec2 p)
{
    // Right Eyes
    p = vec2(p.x - 0.18, p.y);
    float size = 0.13;
    float outlineOffset = 0.01;

    float d = sdCircle(p * 1.05, size);

    float d1 = sdCircle(vec2(p.x, p.y + 1.0), 1.0);
    d = opIntersection(d, d1);
   	color = mix(colorWhite, color, d);

    // eye outline
    d = eyeOutline(p, size + outlineOffset, -0.007);
    color = mix(colorBlack, color, d);

    // pupil
    d = 0.2 + 0.1 * cos(atan(p.y, p.x)* 10.0)-texture(iAudioData,vec2(abs(fract(5.*size/6.283)*2.-1.),.75)).r/2.;
    d = smoothstep(d * 0.03 + 0.01, d * 0.03 + 0.02, length(p));
    color = mix(colorBlack, color, d);

    // eyeLid
    d = eyeLid(p, 1.0, -0.007);
    color = mix(colorBlack, color, d);

    // Left Eyes
    p = vec2(p.x + 0.36, p.y);

    d = sdCircle(p * 1.05, size);
    d1 = sdCircle(vec2(p.x, p.y + 1.0), 1.0);
    d = opIntersection(d, d1);
   	color = mix(colorWhite, color, d);

    // eye outline
    d = eyeOutline(p, size + outlineOffset, -0.007);
    color = mix(colorBlack, color, d);

    // pupil
    d = 0.2 + 0.1 * cos(atan(p.y, p.x)* 10.0)-texture(iAudioData,vec2(abs(fract(5.*size/6.283)*2.-1.),.75)).r/2.;
    d = smoothstep(d * 0.03 + 0.01, d * 0.03 + 0.02, length(p));
    color = mix(colorBlack, color, d);

    // eyeLid
    d = eyeLid(p, 1.0, -0.007);
    color = mix(colorBlack, color, d);

    return color;
}

// TODO consolidate arc methods
float bagsArc(vec2 p, float radius, float thickness)
{
    // Arc
    float ta = 3.14*(0.5+0.5*10.0);
    float tb = 0.3; // 3.14*(0.5+0.5*cos(iTime*0.31+2.0));
    float rb = thickness; //0.15*(0.5+0.5*cos(iTime*0.41+3.0));

    // distance
    float len = sdArc(p,vec2(sin(ta),cos(ta)),vec2(sin(tb),cos(tb)), radius, rb);

    return len;
}

vec3 bags(vec3 color, vec2 p)
{
    p.y += 0.825;
    vec2 centerP = p;

    // p.y *= 0.9;

    // edge
    p = vec2(p.x - 0.22, p.y - 0.95);
    float d = bagsArc(p, 0.2, -0.007);
    color = mix(colorBlack, color, d);

    // edge
    p.x += 0.44;
    p.y -= 0.115;
    p.x *= 1.0;
    d = bagsArc(vec2(p.x, p.y), 0.3, -0.007);
    color = mix(colorBlack, color, d);

    return color;

}

vec3 nose(vec3 color, vec2 p)
{
  p.y += 0.05;
  p.y = -p.y;
  float r1 = 0.05+0.1*0.01;
  float r2 = 0.03+0.1*0.1;
  float h = 0.15;

  float nose = sdUnevenCapsule( p, r1, r2, h );

  color = mix(colorBlack, color, nose);

  // Fill
  p.y += 0.021;
  r1 = 0.04+0.1*0.01;
  r2 = 0.027+0.1*0.1;
  h = 0.156;

  nose = sdUnevenCapsule( p, r1, r2, h );

  color = mix(colorSkin, color, nose);

  return color;
}

// TODO consolidate arc methods
float mouthLine(vec2 p, float radius, float thickness)
{
    // translate
    p.y += 0.98;
    // Arc
    float ta = 3.14*(0.5+0.5*0.0); // * 0.0 change starting point
    float tb = 0.3; // 3.14*(0.5+0.5*cos(iTime*0.31+2.0)); // length
    float rb = thickness; //0.15*(0.5+0.5*cos(iTime*0.41+3.0));
    //float rb = 0.15*(0.025+0.025*cos(iAmplifiedTime*0.41+3.0));

    // distance
    float len = sdArc(p,vec2(sin(ta),cos(ta)),vec2(sin(tb),cos(tb)), radius, rb);

    return len;
}

// TODO consolidate arc methods
float mouthEdge(vec2 p, float radius, float thickness)
{
    // translate
    p.y += 0.98;
    // Arc
    float ta = 3.14*(0.5+0.5*1.2);
    float tb = 1.5; // 3.14*(0.5+0.5*cos(iTime*0.31+2.0));
    float rb = thickness; //0.15*(0.5+0.5*cos(iTime*0.41+3.0));

    // distance
    float len = sdArc(p,vec2(sin(ta),cos(ta)),vec2(sin(tb),cos(tb)), radius, rb);

    return len;
}

/*
float DrawMouth(vec2 uv)
{
  // position
  uv.x -= 0.0;
  uv.y += 0.06;
  // curve
  uv.y -= uv.x * uv.x * 1.5;
  // end points
  vec2 a = vec2(1.4, 0.85);
  vec2 b = vec2(-1.4, 0.7);
  // line width
  float lWidth = 0.001;
  float rLine = sdLineSegmentRounded(uv * 1.8, a, b, lWidth);
  return rLine;
}
*/

vec3 mouth(vec3 color, vec2 p)
{
    p.y += 0.3;
    vec2 centerP = p;

    p.y *= 0.9;

    // edge
    p = vec2(p.x - 0.22, p.y - 0.95);
    float d = mouthEdge(p, 0.06, -0.007);
    color = mix(colorBlack, color, d);

    // edge
    p.x += 0.44;
    d = mouthEdge(vec2(-p.x, p.y), 0.06, -0.007);
    color = mix(colorBlack, color, d);

    // mouth
    centerP.y -= 0.23;
    d = mouthLine(centerP, 0.75, -0.007);
    color = mix(colorBlack, color, d);
    return color;
}

vec3 brow(vec3 color, vec2 p)
{
    // brow
    p.y -= 0.81;

	vec2 v1 = vec2(-0.22, -0.5);
    vec2 v2 = vec2(0.22, -0.5);

    // outline
    float thickness = 0.04;
	float d = sdSegment( p, v1, v2, thickness);

    color = mix(colorBlack, color, d);

    // fill
    thickness = 0.04;
	d = sdSegment( p, v1, v2, thickness - 0.01);

    color = mix(colorHair, color, d);
    return color;
}


void main()
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    vec2 cam_uv = -1.0 + 2.0 *vUv;
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(cam_uv,-1.5));
    mat3 t = mat3(1.0);
	camera(cam_uv, ro, rd, t);
    vec2 fragCoordFromUV = vUv * iResolution;
	vec2 uv = (2.0*fragCoordFromUV-iResolution.xy)/iResolution.y;
	uv.y+=.25;
    // TODO shared rotated uv
    vec2 uvRot = Rotate2D(-0.15) * uv;

    vec3 col = vec3(0.);

    // Hair Outline
 	// color = mix(color, vec3(0.0), DrawHair(uvRot * 0.99));
  	// Hair
  	// color = mix(color, colorHair, DrawHair(uvRot));
    uv.y -=0.25;
    float l = length(uv)/length(iResolution.xy/iResolution.y);
    float a = atan(uv.x,uv.y)+iTime;
    float s = texture(iAudioData,vec2(abs(fract(5.*a/6.283)*2.-1.),.75)).r;

    float A = .4;
    float B = .45;

    A *= A; // apply a curve so mouse movements feel better
    B *= B;
    vec3 col2 = vec3(0.);
    col2.r = texture(iAudioData,vec2(pow(mix(mix(l,.0,A),    s ,B),2.),.25)).r;
    col2.g = texture(iAudioData,vec2(pow(mix(mix(l,.5,A),(1.-s),B),2.),.25)).r;
    col2.b = texture(iAudioData,vec2(pow(mix(mix(l,1.,A),    s ,B),2.),.25)).r;

    // tweak the contrast
    col2.rgb = smoothstep(.05,1.,col2.rgb+.2*l);
    col2.rgb = pow( col2.rgb, vec3(2) );
    uv.y +=0.25;
    // Hair Outline2
    if(iTime>33.5){
  		// going to full screen with the hair
		//col = drawHair(col, vec2(-uvRot.x, uvRot.y)*(.5+sin(iAmplifiedTime)/2.));
		// or not
        col = drawHair(col, vec2(-uvRot.x, uvRot.y));
    }else{
        col = drawHair(col, vec2(-uvRot.x, uvRot.y));
    }
    col *=col2;

    col = ears(col, vec2(uv.x, uv.y));
    col = head(col, vec2(uv.x * 1.35, uv.y * 0.825));
    col = eyes(col, vec2(uv.x, uv.y - 0.125));
    col = nose(col, Rotate2D(-0.15) * uv);
    col = mouth(col, uv);
    col = brow(col, uv);
    col = bags(col, uv);

    // col = mix(vec3(0.0), col, DrawEyeBrow(uvRot * 0.98));
    // col = mix(colorHair, col, DrawEyeBrow(uvRot));

    /*
	// coloring
    vec3 col = vec3(1.0) - sign(d)*vec3(0.1,0.4,0.7);
    col *= 1.0 - exp(-3.0*abs(d));
	col *= 0.8 + 0.2*cos(150.0*d);
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.01,abs(d)) );
	*/


    //col2.a = 1.;

	gl_FragColor += vec4(col,1.0);
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
