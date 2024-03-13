// https://www.shadertoy.com/view/Ws2Bzw
// Modified by ArthurTent
// Created by im_paul_hi
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
/*
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float mod1;
uniform float mod2;
uniform float mod3;
uniform float mod4;
uniform float mod5;
uniform float mod6;
uniform float mod7;
uniform float mod8;
uniform float mod9;
*/

/*
    -sdf functions from iq


*/

// https://www.shadertoy.com/view/MsjXRt
vec4 HueShift (in vec3 Color, in float Shift)
{
    vec3 P = vec3(0.55735)*dot(vec3(0.55735),Color);

    vec3 U = Color-P;

    vec3 V = cross(vec3(0.55735),U);

    Color = U*cos(Shift*6.2832) + V*sin(Shift*6.2832) + P;

    return vec4(Color,1.0);
}

//
// GLSL textureless classic 2D noise "cnoise",
// with an RSL-style periodic variant "pnoise".
// Author:  Stefan Gustavson (stefan.gustavson@liu.se)
// Version: 2011-08-22
//
// Many thanks to Ian McEwan of Ashima Arts for the
// ideas for permutation and gradient selection.
//
// Copyright (c) 2011 Stefan Gustavson. All rights reserved.
// Distributed under the MIT license. See LICENSE file.
// https://github.com/ashima/webgl-noise
//

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float cnoise(vec2 P)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

// https://www.shadertoy.com/view/4dsSzr
vec3 ansiGradient(float t) {
	return mod(floor(t * vec3(8.0, 4.0, 2.0)), 2.0);
}

// #define AA 0.005
#define PI 3.14159
#define TAU 2.0 * PI
#define gridThickness 0.05

vec3 headColor = vec3(0.45,0.21,0.67);
vec3 bgColor = vec3(0.95,0.92,0.99);
vec3 headGooColor = vec3(0.87,0.56,0.40);
vec3 blackOutlineColor = vec3(0.23,0.24,0.21);
vec3 gearCol1 = vec3(0.44,0.48,0.80);
vec3 gearCol2 = vec3(0.36,0.83,0.99);
vec3 col = vec3(0.95,0.92,0.99);
float blackOutlineWidth = 0.02;
vec3 mixedCol = vec3(0.0);
float AA = 0.005;

/*********************************************************
**********************************************************
**********************************************************
**********************************************************/

float linearStep(float begin, float end, float t) {
    return clamp((t - begin) / (end - begin), 0.0, 1.0);
}

float map(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

vec2 within(vec2 uv, vec4 rect) {
    vec2 val = (uv-rect.xy)/(rect.zw-rect.xy);
    // val.y = remap(val.y, 0.0, 1.0, 1.0, 0.0);
    val.y = -val.y + 1.0;
	return val;
}

float inside01(vec2 p) {
    return step(0.0, p.x) * (1.0 - step(1.0, p.x)) * step(0.0, p.y) * (1.0 - step(1.0, p.y));
}

float insideY(vec2 p) {
    return step(0.0, p.y) * (1.0 - step(1.0, p.y));
}

float insideX(vec2 p) {
    return step(0.0, p.x) * (1.0 - step(1.0, p.x));
}

void addGrid(vec2 p, inout vec3 col) {
    float all = inside01(p);
    vec3 gridOutlineCol = vec3(1.0, 0.0, 0.0);
    vec3 gridCol = vec3(0.0);

    // add outline
    float outline = step(p.x, gridThickness);
    outline += step(1.0 - gridThickness, p.x);
    outline += step(p.y, gridThickness);
    outline += step(1.0 - gridThickness, p.y);

    // p.y = -p.y;
    // p.y += 1.0;

    // float outline = step(0.0, p.y) * (1.0 - step(0.1, p.y));

    col = mix(col, gridOutlineCol, outline * all);
}

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

vec3 returnDottedCol(vec2 p, vec3 bgCol, vec3 dotCol) {
    vec3 dottedCol = vec3(0.0);

    p *= 28.0;
    p.x += 0.48;
    p.y *= 2.49;
    float yIndex = floor(p.y);
    float xIndex = floor(p.x);
    p = fract(p);

    // float circle = smoothstep(mod1, mod2, length(p - vec2(0.5)));
    // circle *= smoothstep(mod3, mod4, length(p - vec2(1.0, 0.0)));

    float circleBool = 0.0;

    float circle = smoothstep(0.3, 0.6, length(p - vec2(0.5)));

    if(mod(xIndex, 2.0) == 0.0 && mod(yIndex, 2.0) == 0.0) {
        circleBool = 0.0;
    } else if(mod(xIndex, 2.0) != 0.0 && mod(yIndex, 2.0) == 0.0) {
        circleBool = 1.0;
    } else if(mod(xIndex, 2.0) == 0.0 && mod(yIndex, 2.0) != 0.0) {
        circleBool = 1.0;
    }

    dottedCol = mix(bgCol, dotCol, (1.0 - circle) * circleBool);

    return dottedCol;
}

float gain(float x, float k)
{
    float a = 0.5*pow(2.0*((x<0.5)?x:1.0-x), k);
    return (x<0.5)?a:1.0-a;
}

float expImpulse( float x, float k )
{
    float h = k*x;
    return h*exp(1.0-h);
}

float customEase(float x, float k) {
    return pow(x, k);
}

float almostIdentity( float x, float m, float n )
{
    if( x>m ) return x;
    float a = 2.0*n - m;
    float b = 2.0*m - 3.0*n;
    float t = x/m;
    return (a*t + b)*t*t + n;
}

float undulateAngle(int index, float angle, float movementScale, float offsetScale, float timeScale) {
    float offset = float(index) * offsetScale;
    float m = angle + sin(iTime * timeScale + offset) * movementScale;
    return m;
}



/*********************************************************
**********************************************************
**********************************************************
**********************************************************/

float sdCircle( in vec2 p, in float r )
{
    return length(p)-r;
}

float sdCross( in vec2 p, in vec2 b, float r )
{
    p = abs(p); p = (p.y>p.x) ? p.yx : p.xy;
    vec2  q = p - b;
    float k = max(q.y,q.x);
    vec2  w = (k>0.0) ? q : vec2(b.y-p.x,-k);
    return sign(k)*length(max(w,0.0)) + r;
}



float returnTween4Dist(vec2 p, float t, float circleRadius) {
    // t = normalized time
    vec2 from = vec2(0.5, 0.66);
    vec2 to = vec2(0.5, 0.3);
    float radius = (from.y - to.y) / 2.0;
    float startAngle = (3.0 * PI) / 2.0;
    float endAngle = PI;
    float angle = map(t, 0.0, 1.0, startAngle, endAngle);
    float angleOffset = -PI * 2.0;
    // cycle through angle based on t
    vec2 pos = vec2(sin(angle + angleOffset) * radius, cos(angle + angleOffset) * radius);
    pos += 0.5;
    float d = sdCircle(p - pos, circleRadius);
    return d;
}

float returnTween5Dist(vec2 p, float t, float circleRadius) {
    // t = normalized time
    vec2 from = vec2(0.5, 0.32);
    vec2 to = vec2(0.5, -0.3);
    vec2 pos = mix(from, to, t);
    float d = sdCircle(p - pos, circleRadius);
    return d;
}

float returnTween1Dist(vec2 p, float t, float circleRadius) {
    // t = normalized time
    vec2 from = vec2(0.5, 1.0);
    vec2 to = vec2(0.5, 0.66);
    vec2 pos = mix(from, to, t);
    float d = sdCircle(p - pos, circleRadius);
    return d;
}

mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
}

void makeSecondSwoop(vec2 p, inout float d, float loopTime, inout vec3 col, float time) {
    p -= vec2(0.28, 0.02);
    // p -= vec2(0.58, 0.02);  // debug view

    for(int i = 0; i < 5; i++) {
        float d1 = 0.0;
        float margin = sin(float(i) + time) * 1.0;
        float modTime = fract((time + margin) / loopTime);
        float circleRadius = map(modTime, 0.0, 1.0, 0.0, 0.15);

        if(modTime < 0.5) {
            d1 = returnTween4Dist(p, linearStep(0.0, 0.5, modTime), circleRadius);
        } else {
            d1 = returnTween5Dist(p, linearStep(0.5, 1.0, modTime), circleRadius);
        }

        // d1 = smoothstep(0.0, AA, d1);
        // col = mix(col, vec3(1.0), 1.0 - d1);

        if(i != 0) {
            d = opSmoothUnion(d, d1, 0.04);
        }
    }
}

float returnTween2Dist(vec2 p, float t, float circleRadius) {
    // t = normalized time
    vec2 from = vec2(0.5, 0.66);
    vec2 to = vec2(0.5, 0.33);
    float radius = (from.y - to.y) / 2.0;
    float startAngle = PI / 2.0;
    float endAngle = (3.0 * PI) / 2.0;
    float angle = map(t, 0.0, 1.0, startAngle, endAngle);
    float angleOffset = -PI * 0.5;
    // cycle through angle based on t
    vec2 pos = vec2(sin(angle + angleOffset) * radius, cos(angle + angleOffset) * radius);
    pos += 0.5;
    float d = sdCircle(p - pos, circleRadius);
    return d;
}

float returnTween3Dist(vec2 p, float t, float circleRadius) {
    // t = normalized time
    vec2 from = vec2(0.5, 0.33);
    vec2 to = vec2(0.66, -0.1);
    vec2 pos = mix(from, to, t);
    float d = sdCircle(p - pos, circleRadius);
    return d;
}

float sdBox( in vec2 p, in vec2 b, float r)
{
    vec2 d = abs(p) - (b - r);
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0) - r;
}


float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
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



float opSmoothSubtraction( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h);
}

float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

float sdRoundBox( in vec2 p, in vec2 b, in vec4 r )
{
    r.xy = (p.x>0.0)?r.xy : r.zw;
    r.x  = (p.y>0.0)?r.x  : r.y;

    vec2 q = abs(p)-b+r.x;
    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}

float sdTriangle( in vec2 p, in vec2 p0, in vec2 p1, in vec2 p2 )
{
    vec2 e0 = p1-p0, e1 = p2-p1, e2 = p0-p2;
    vec2 v0 = p -p0, v1 = p -p1, v2 = p -p2;
    vec2 pq0 = v0 - e0*clamp( dot(v0,e0)/dot(e0,e0), 0.0, 1.0 );
    vec2 pq1 = v1 - e1*clamp( dot(v1,e1)/dot(e1,e1), 0.0, 1.0 );
    vec2 pq2 = v2 - e2*clamp( dot(v2,e2)/dot(e2,e2), 0.0, 1.0 );
    float s = sign( e0.x*e2.y - e0.y*e2.x );
    vec2 d = min(min(vec2(dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)),
                     vec2(dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))),
                     vec2(dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));
    return -sqrt(d.x)*sign(d.y);
}

float dot2(in vec2 v ) { return dot(v,v); }

// trapezoid / capped cone, specialized for Y alignment
float sdTrapezoid( in vec2 p, in float r1, float r2, float he )
{
    vec2 k1 = vec2(r2,he);
    vec2 k2 = vec2(r2-r1,2.0*he);

	p.x = abs(p.x);
    vec2 ca = vec2(max(0.0,p.x-((p.y<0.0)?r1:r2)), abs(p.y)-he);
    vec2 cb = p - k1 + k2*clamp( dot(k1-p,k2)/dot2(k2), 0.0, 1.0 );

    float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;

    return s*sqrt( min(dot2(ca),dot2(cb)) );
}

float sdArc( in vec2 p, in vec2 sca, in vec2 scb, in float ra, float rb )
{
    p *= mat2(sca.x,sca.y,-sca.y,sca.x);
    p.x = abs(p.x);
    float k = (scb.y*p.x>scb.x*p.y) ? dot(p.xy,scb) : length(p.xy);
    return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
}

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

/*********************************************************
**********************************************************
**********************************************************
**********************************************************/




void bg(vec2 p, inout vec3 col, vec2 origP) {
    // col = mix(col, vec3(0.90,0.76,0.34), map(origP.y, 0.39, 0.74, 0.0, 1.0));

    // col = mix(col, vec3(0.76,0.78,0.53), map(origP.y, -0.09, -0.59, 0.0, 1.0));
}

void cranium(vec2 p, inout vec3 col, vec2 origP) {
    float d = 0.0;
    float d1 = 0.0;
    float d2 = 0.0;
    float d3 = 0.0;
    float r = 0.0;
    vec2 modP = vec2(0.0);
    vec3 mixedCol = vec3(0.0);
    float modTime = 0.0;
    float loopTime = 0.0;
    float n = 0.0;
    float m = 0.0;

    // testing noise - looks great!
    // modP = vec2(origP.x, origP.y) * 0.6;
    // p = vec2(p.x, p.y);
    // n = cnoise(modP * 10.0) * 0.02;
    // modP.x += n;
    // modP.y -= n;
    // p.x += n;
    // p.y -= n;


    //////////////////
    // lower layers LEWWWWWWWP
    //////////////////
    for(int i = 0; i < 10; i++) {
        float loopTime = 2.0;
        float iVal = float(i);
        float totalI = 10.0;
        float maxScale = 4.0 + (sin(iTime + iVal) * 0.05);
        float minScale = 0.1 - (sin(iTime + iVal) * 0.05);
        //////////////////
        // outline
        //////////////////
        // cranium circle
        modP = vec2(origP.x, origP.y);
        modP = rotate2d(sin(iTime + iVal) * 0.05) * modP;
        float borderSize = (0.05 * (iVal / totalI)) * sin(iTime * 2.0 + iVal) + 0.05;
        modP /= map(iVal, 0.0, totalI, maxScale, minScale) + borderSize;
        d = sdCircle(modP - vec2(0.0, 0.1), 0.59);
        d1 = sdBox(modP - vec2(0.07, 0.96), vec2(0.41, 0.13), -0.07);
        d = opSmoothSubtraction(d1, d, 0.26);
        // mandible box
        d1 = sdBox(modP - vec2(0.0, -0.37), vec2(0.33, 0.33), 0.11);
        d = opSmoothUnion(d, d1, 0.22);
        // zygomatic indents
        modP = vec2(p.x, p.y);
        modP /= map(iVal, 0.0, totalI, maxScale, minScale) + borderSize;
        d1 = sdCircle(modP - vec2(0.74, -0.5), 0.39);
        d = opSmoothSubtraction(d1, d, 0.15);
        // eye socket protrusions
        d1 = sdRoundBox(modP - vec2(0.34, -0.22), vec2(0.22, 0.2), vec4(0.07, 0.11, 0.22, 0.22));
        d = opSmoothUnion(d, d1, 0.04);
        // zygomatic indents
        d1 = sdCircle(modP - vec2(0.41, -0.46), 0.04);
        d = opSmoothSubtraction(d1, d, 0.04);
        // temple indents
        d1 = sdCircle(modP - vec2(0.7, -0.17), 0.15);
        d = opSmoothSubtraction(d1, d, 0.02);
        d = smoothstep(0.0, AA, d);
        col = mix(col, blackOutlineColor, 1.0 - d);
        //////////////////
        // color
        //////////////////
        // cranium circle
        modP = vec2(origP.x, origP.y);
        modP /= map(iVal, 0.0, totalI, maxScale, minScale);
        d = sdCircle(modP - vec2(0.0, 0.1), 0.59);
        d1 = sdBox(modP - vec2(0.07, 0.96), vec2(0.41, 0.13), -0.07);
        d = opSmoothSubtraction(d1, d, 0.26);
        // mandible box
        d1 = sdBox(modP - vec2(0.0, -0.37), vec2(0.33, 0.33), 0.11);
        d = opSmoothUnion(d, d1, 0.22);
        // zygomatic indents
        modP = vec2(p.x, p.y);
        modP /= map(iVal, 0.0, totalI, maxScale, minScale);
        d1 = sdCircle(modP - vec2(0.74, -0.5), 0.39);
        d = opSmoothSubtraction(d1, d, 0.15);
        // eye socket protrusions
        d1 = sdRoundBox(modP - vec2(0.34, -0.22), vec2(0.22, 0.2), vec4(0.07, 0.11, 0.22, 0.22));
        d = opSmoothUnion(d, d1, 0.04);
        // zygomatic indents
        d1 = sdCircle(modP - vec2(0.41, -0.46), 0.04);
        d = opSmoothSubtraction(d1, d, 0.04);
        // temple indents
        d1 = sdCircle(modP - vec2(0.7, -0.17), 0.15);
        d = opSmoothSubtraction(d1, d, 0.02);
        d = smoothstep(0.0, AA, d);
        col = mix(col, ansiGradient(iVal / totalI), 1.0 - d);
    }




//////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////

    /////////////////
    // blackbottom
    ////////////////
    // cranium circle
    d = sdCircle(origP - vec2(0.0, 0.1), 0.59);
    d1 = sdBox(origP - vec2(0.07, 0.96), vec2(0.41, 0.13), -0.07);
    d = opSmoothSubtraction(d1, d, 0.26);
    // mandible box
    d1 = sdBox(origP - vec2(0.0, -0.37), vec2(0.33, 0.33), 0.11);
    d = opSmoothUnion(d, d1, 0.22);
    // zygomatic indents
    d1 = sdCircle(p - vec2(0.74, -0.5), 0.39);
    d = opSmoothSubtraction(d1, d, 0.15);
    // eye socket protrusions
    d1 = sdRoundBox(p - vec2(0.34, -0.22), vec2(0.22, 0.2), vec4(0.07, 0.11, 0.22, 0.22));
    d = opSmoothUnion(d, d1, 0.04);
    // zygomatic indents
    d1 = sdCircle(p - vec2(0.41, -0.46), 0.04);
    d = opSmoothSubtraction(d1, d, 0.04);
    // temple indents
    d1 = sdCircle(p - vec2(0.7, -0.17), 0.15);
    d = opSmoothSubtraction(d1, d, 0.02);
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);



    ////////////////
    // color
    ///////////////
    // cranium circle
    d = sdCircle(origP - vec2(0.0, 0.1), 0.57);
    d1 = sdBox(origP - vec2(0.07, 0.96), vec2(0.41, 0.13), -0.07);
    d = opSmoothSubtraction(d1, d, 0.26);
    // mandible box
    d1 = sdBox(origP - vec2(0.0, -0.37), vec2(0.3, 0.3), 0.11);
    d = opSmoothUnion(d, d1, 0.22);
    // zygomatic indents
    d1 = sdCircle(p - vec2(0.74, -0.5), 0.41);
    d = opSmoothSubtraction(d1, d, 0.15);
    // eye socket protrusions
    d1 = sdRoundBox(p - vec2(0.34, -0.22), vec2(0.20, 0.18), vec4(0.07, 0.11, 0.22, 0.22));
    d = opSmoothUnion(d, d1, 0.04);
    // zygomatic indents
    d1 = sdCircle(p - vec2(0.41, -0.46), 0.06);
    d = opSmoothSubtraction(d1, d, 0.04);
    // temple indents
    d1 = sdCircle(p - vec2(0.7, -0.17), 0.17);
    d = opSmoothSubtraction(d1, d, 0.02);
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.82,0.87,0.85), 1.0 - d);

    // eye socket black bottom
    d = sdCircle(p - vec2(0.26, -0.11), 0.2);
    // eye socket subtraction
    d1 = sdCircle(p - vec2(0.46, 0.26), 0.28);
    d = opSmoothSubtraction(d1, d, 0.10);
    d1 = sdCircle(p - vec2(0.26, -0.46), 0.17);
    d = opSmoothSubtraction(d1, d, 0.02);
    modP = vec2(p.x, p.y);
    modP = rotate2d(0.61 * TAU) * modP;
    d1 = sdBox(modP - vec2(0.28, 0.3), vec2(0.24, 0.26), 0.04);
    d = opSmoothSubtraction(d1, d, 0.02);
    modP = vec2(p.x, p.y);
    modP = rotate2d(0.5 * TAU) * modP;
    d1 = sdBox(modP - vec2(0.04, 0.8), vec2(0.09, 1.0), 0.26);
    d = opSmoothSubtraction(d1, d, 0.15);
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);

    // eye socket color
    d = sdCircle(p - vec2(0.26, -0.11), 0.18);
    // eye socket subtraction
    d1 = sdCircle(p - vec2(0.46, 0.26), 0.28);
    d = opSmoothSubtraction(d1, d, 0.10);
    d1 = sdCircle(p - vec2(0.26, -0.46), 0.17);
    d = opSmoothSubtraction(d1, d, 0.02);
    modP = vec2(p.x, p.y);
    modP = rotate2d(0.61 * TAU) * modP;
    d1 = sdBox(modP - vec2(0.28, 0.3), vec2(0.24, 0.26), 0.04);
    d = opSmoothSubtraction(d1, d, 0.04);
    modP = vec2(p.x, p.y);
    modP = rotate2d(0.5 * TAU) * modP;
    d1 = sdBox(modP - vec2(0.04, 0.8), vec2(0.09, 1.0), 0.26);
    d = opSmoothSubtraction(d1, d, 0.15);
    d1 = sdCircle(origP - vec2(0.13, -0.22), 0.07);
    d = opSmoothSubtraction(d1, d, 0.04);
    d1 = sdCircle(vec2(origP.x * -1.0, origP.y) - vec2(0.105, -0.22), 0.07);
    d = opSmoothSubtraction(d1, d, 0.04);
    d = smoothstep(0.0, AA, d);
    mixedCol = mix(blackOutlineColor, vec3(0.85,0.65,0.68), smoothstep(-0.17, 0.43, length(vec2(p.x, p.y + 0.3))));
    col = mix(col, mixedCol, 1.0 - d);



    // nose socket black
    d = sdSegment(p, vec2(0.0, -0.26), vec2(0.05, -0.39)) - 0.05;
    d1 = sdSegment(p, vec2(-0.02, -0.37 - 0.11), vec2(0.0, -0.7 - 0.11)) - 0.02;
    d = opSmoothSubtraction(d1, d, 0.13);
    // d1 = sdCircle(p - vec2(mod1, mod2), mod3);
    // d = opSmoothUnion(d1, d, mod4);
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);




    // teeth
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.0, -1.2 + 0.22), vec2(-0.09+0.0, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.0, -1.2 + 0.22), vec2(-0.09+0.0, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09 + 0.065, -1.2 + 0.22), vec2(-0.09 + 0.065, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09 + 0.065, -1.2 + 0.22), vec2(-0.09 + 0.065, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.15, -1.2 + 0.22), vec2(-0.09+0.15, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.15, -1.2 + 0.22), vec2(-0.09+0.15, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.22, -1.2 + 0.22), vec2(-0.09+0.22, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.22, -1.2 + 0.22), vec2(-0.09+0.22, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.28, -1.2 + 0.22), vec2(-0.09+0.28, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.28, -1.2 + 0.22), vec2(-0.09+0.28, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.41, -1.2+0.24), vec2(-0.09+0.41, -1.14+0.24)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.41, -1.2+0.24), vec2(-0.09+0.41, -1.14+0.24)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.48, -1.2 + 0.22 + 0.04), vec2(-0.09+0.48, -1.14 + 0.22 + 0.04)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.48, -1.2 + 0.22 + 0.04), vec2(-0.09+0.48, -1.14 + 0.22 + 0.04)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.35, -1.2 + 0.22), vec2(-0.09+0.35, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+0.35, -1.2 + 0.22), vec2(-0.09+0.35, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09-0.28, -1.2 + 0.29), vec2(-0.09-0.28, -1.14 + 0.29)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09-0.28, -1.2 + 0.29), vec2(-0.09-0.28, -1.14 + 0.29)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+-0.07, -1.2 + 0.22), vec2(-0.09+-0.07, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+-0.07, -1.2 + 0.22), vec2(-0.09+-0.07, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09-0.22, -1.2 + 0.25), vec2(-0.09-0.22, -1.14 + 0.25)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09-0.22, -1.2 + 0.25), vec2(-0.09-0.22, -1.14 + 0.25)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);
    //
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+-0.15, -1.2 + 0.22), vec2(-0.09+-0.15, -1.14 + 0.22)) - 0.04;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    modP = vec2(origP.x, origP.y) * 0.8;
    n = cnoise(modP * 10.0) * 0.02;
    modP.x += n;
    modP.y -= n;
    modP *= 1.7;
    d = sdSegment(modP, vec2(-0.09+-0.15, -1.2 + 0.22), vec2(-0.09+-0.15, -1.14 + 0.22)) - 0.03;
    d = smoothstep(0.0, AA, d);
    col = mix(col, vec3(0.99,0.94,0.81), 1.0 - d);



    // d = sdSegment(modP, vec2(-0.09, -0.65), vec2(-0.09, -0.74)) - 0.03;
    // d = smoothstep(0.0, AA, d);
    // col = mix(col, vec3(0.96,0.89,0.74), 1.0 - d);

}

void darkLines(vec2 p, inout vec3 col, vec2 origP) {
    float d = 0.0;
    float d1 = 0.0;
    float d2 = 0.0;
    float d3 = 0.0;
    float r = 0.0;
    vec2 modP = vec2(0.0);
    vec3 mixedCol = vec3(0.0);
    float modTime = 0.0;
    float loopTime = 0.0;
    float n = 0.0;
    float m = 0.0;
    float mask = 0.0;

    // testing noise - looks great!
    // modP = vec2(origP.x, origP.y) * 0.6;
    // p = vec2(p.x, p.y);
    // n = cnoise(modP * 10.0) * 0.02;
    // modP.x += n;
    // modP.y -= n;
    // p.x += n;
    // p.y -= n;

    // zygomatic (bottom)
    modP = vec2(p.x, p.y);
    m = sin(p.x + 4.4);
    modP.y += m;
    modP.y -= -0.262 * 4.0;
    modP.x += 0.05;
    modP = rotate2d(0.02 * TAU) * modP;
    d = sdSegment(modP, vec2(0.24, -0.41), vec2(0.35, -0.41)) - 0.01;
    d = smoothstep(0.0, AA, d);
    col = mix(col, blackOutlineColor, 1.0 - d);
    // zygomatic (side)
    modP = within(p - vec2(0.46, -0.04), vec4(0.29, 0.17, 0.74, -0.26));
    modP = rotate2d(PI * 0.5) * modP;
    m = sin((modP.x + 5.0) * 6.0) * 0.06;
    m += 0.5;
    d = length(modP - vec2(modP.x, m));
    mask = step(0.0, modP.x) * step(modP.x, 0.65);
    d = smoothstep(0.018, 0.028, d);
    col = mix(col, blackOutlineColor, (1.0 - d) * mask);

    // frontal (corner)
    modP = within(p - vec2(0.57, 0.09), vec4(0.13, 0.22, 0.39, -0.04));
    modP = rotate2d(0.39 * TAU) * modP;
    m = sin(modP.x * 6.0) * 0.08;
    m += 0.6;
    d = length(modP - vec2(modP.x, m));
    mask = step(0.55, modP.x) * step(modP.x, 0.75);
    d = smoothstep(0.005, 0.02, d);
    col = mix(col, blackOutlineColor, (1.0 - d) * mask);
    // addGrid(modP, col);
    // frontal right
    modP = within(origP, vec4(0.13, 0.22, 0.39, -0.04));
    modP = rotate2d(-0.01 * TAU) * modP;
    m = sin(modP.x * 6.0) * 0.03;
    m += 0.6;
    d = length(modP - vec2(modP.x, m));
    mask = step(0.25, modP.x) * step(modP.x, 0.75);
    d = smoothstep(0.005, 0.02, d);
    col = mix(col, blackOutlineColor, (1.0 - d) * mask);
    // front left
    modP = within(vec2(origP.x * -1.0, origP.y), vec4(0.13, 0.22, 0.48, -0.04));
    modP = rotate2d(0.000 * TAU) * modP;
    m = sin(modP.x * 6.0) * 0.03;
    m += 0.6;
    d = length(modP - vec2(modP.x, m));
    mask = step(0.25, modP.x) * step(modP.x, 0.75);
    d = smoothstep(0.005, 0.02, d);
    col = mix(col, blackOutlineColor, (1.0 - d) * mask);

    // upper maxilla
    modP = within(p - vec2(0.0, -0.22), vec4(0.13, 0.22, 0.39, -0.04));
    modP = rotate2d(-0.275 * TAU) * modP;
    m = sin(modP.x * 6.0) * 0.08;
    m += 0.6;
    d = length(modP - vec2(modP.x, m));
    mask = step(0.55, modP.x) * step(modP.x, 0.85);
    d = smoothstep(0.005, 0.02, d);
    col = mix(col, blackOutlineColor, (1.0 - d) * mask);
    // upper maxilla
    modP = within(p - vec2(0.035, -0.22), vec4(0.13, 0.22, 0.39, -0.04));
    modP = rotate2d(-0.275 * TAU) * modP;
    m = sin(modP.x * 6.0) * 0.08;
    m += 0.6;
    d = length(modP - vec2(modP.x, m));
    mask = step(0.55, modP.x) * step(modP.x, 0.65);
    d = smoothstep(0.005, 0.02, d);
    col = mix(col, blackOutlineColor, (1.0 - d) * mask);
    // maxilla
    modP = within(origP - vec2(-0.4, -0.25), vec4(0.13, 0.22, 0.39, -0.04));
    modP = rotate2d(0.76 * TAU) * modP;
    m = sin(modP.x * 6.0) * 0.08;
    m += 0.6;
    d = length(modP - vec2(modP.x, m));
    mask = step(0.55, modP.x) * step(modP.x, 0.85);
    d = smoothstep(0.005, 0.02, d);
    col = mix(col, blackOutlineColor, (1.0 - d) * mask);
    // addGrid(modP, col);

    // eye socket
    // d = sdBezier(p, vec2(0.1, -0.11), vec2(0.11, 0.03), vec2(0.26, 0.0)) - 0.0;
    // d = smoothstep(0.0, AA, d);
    // col = mix(col, blackOutlineColor, 1.0 - d);
    // d = sdBezier(p, vec2(mod1, mod2), vec2(mod3, mod4), vec2(mod5, mod6)) - mod7;
    // d = smoothstep(0.0, AA, d);
    // col = mix(col, blackOutlineColor, 1.0 - d);
}



void main()
//void main()
{
    //vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec2 p = -1. + 2. * vUv;
    //vec2 p = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    vec2 uv = vUv;
    // https://www.shadertoy.com/view/MsdGzn
    // first texture row is frequency data
	float fft  = texture( iAudioData, vec2(uv.x,0.25) ).x;
	// convert frequency to colors
	vec3 freqCol = vec3( fft, 4.0*fft*(1.0-fft), 1.0-fft ) * fft;

    // perturb coords - highs
    float highsMod = 2.0 * freqCol.r;
    float m = sin(iTime + (p.y * 20.0)) * highsMod;
    m *= smoothstep(-0.35, 0.0, p.y) - (smoothstep(0.0, 0.2, p.y));
    // m *= p.y * 4.0;
    p.x += m;

    // perturb coords - lows
    float lowsMod = 0.1 * freqCol.b;
    float noiseScale = 10.0;
    float n = cnoise(vec2(p.x, p.y + (iTime * 0.5)) * noiseScale) * lowsMod;
    p.x += n;
    p.y -= n;

    vec2 origP = vec2(p.x, p.y);


    // mirror coords
    p.x = abs(p.x);


    bg(p, col, origP);
    cranium(p, col, origP);
    darkLines(p, col, origP);

	gl_FragColor = vec4(col,1.0);
    //gl_FragColor = vec4(col, 1.0);
}
