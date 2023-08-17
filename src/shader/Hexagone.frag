// https://www.shadertoy.com/view/wsl3WB
// Hexagone by Martijn Steinrucken aka BigWings - 2019
// countfrolic@gmail.com
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// 
// This started as an idea to do the effect below, but with hexagons:
// https://www.shadertoy.com/view/wdlGRM
//
// Turns out that really doesn't look very nice so I just made it
// into a dance party instead ;)
//
// Music: https://soundcloud.com/buku/front-to-back

uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define R3 1.732051

vec4 HexCoords(vec2 uv) {
    vec2 s = vec2(1, R3);
    vec2 h = .5*s;

    vec2 gv = s*uv;
    
    vec2 a = mod(gv, s)-h;
    vec2 b = mod(gv+h, s)-h;
    
    vec2 ab = dot(a,a)<dot(b,b) ? a : b;
    vec2 st = ab;
    vec2 id = gv-ab;
    
   // ab = abs(ab);
    //st.x = .5-max(dot(ab, normalize(s)), ab.x);
	st = ab;
    return vec4(st, id);
}

float GetSize(vec2 id, float seed) {
    float d = length(id);
    float t = iGlobalTime*.5;
    float a = sin(d*seed+t)+sin(d*seed*seed*10.+t*2.);
    return a/2. +.5;
}

mat2 Rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

float Hexagon(vec2 uv, float r, vec2 offs) {
    
    uv *= Rot(mix(0., 3.1415, r));
    
    r /= 1./sqrt(2.);
    uv = vec2(-uv.y, uv.x);
    uv.x *= R3;
    uv = abs(uv);
    
    vec2 n = normalize(vec2(1,1));
    float d = dot(uv, n)-r;
    d = max(d, uv.y-r*.707);
    
    d = smoothstep(.06, .02, abs(d));
    
    d += smoothstep(.1, .09, abs(r-.5))*sin(iGlobalTime);
    return d;
}

float Xor(float a, float b) {
	return a+b;
    //return a*(1.-b) + b*(1.-a);
}

float Layer(vec2 uv, float s) {
    vec4 hu = HexCoords(uv*2.);

    float d = Hexagon(hu.xy, GetSize(hu.zw, s), vec2(0));
    vec2 offs = vec2(1,0);
    d = Xor(d, Hexagon(hu.xy-offs, GetSize(hu.zw+offs, s), offs));
    d = Xor(d, Hexagon(hu.xy+offs, GetSize(hu.zw-offs, s), -offs));
    offs = vec2(.5,.8725);
    d = Xor(d, Hexagon(hu.xy-offs, GetSize(hu.zw+offs, s), offs));
    d = Xor(d, Hexagon(hu.xy+offs, GetSize(hu.zw-offs, s), -offs));
    offs = vec2(-.5,.8725);
    d = Xor(d, Hexagon(hu.xy-offs, GetSize(hu.zw+offs, s), offs));
    d = Xor(d, Hexagon(hu.xy+offs, GetSize(hu.zw-offs, s), -offs));
    
    return d;
}

float N(float p) {
    return fract(sin(p*123.34)*345.456);
}

vec3 Col(float p, float offs) {
    float n = N(p)*1234.34;
    
    return sin(n*vec3(12.23,45.23,56.2)+offs*3.)*.5+.5;
}

vec3 GetRayDir(vec2 uv, vec3 p, vec3 lookat, float zoom) {
    vec3 f = normalize(lookat-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f, r),
        c = p+f*zoom,
        i = c + uv.x*r + uv.y*u,
        d = normalize(i-p);
    return d;
}

void main() 
{
    //vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
	vec2 uv = -1.0 + 2.0 *vUv -.5;
    //vec2 UV = fragCoord.xy/iResolution.xy-.5;
    vec2 UV = vUv.xy-.5;
    float duv= dot(UV, UV);
    vec2 m = uv.xy/iResolution.xy-.5;
    
    float t = iGlobalTime*.2+m.x*10.+5.;
    
    float y = sin(t*.5);//+sin(1.5*t)/3.;
    vec3 ro = vec3(0, 20.*y, -5);
    vec3 lookat = vec3(0,0,-10);
    vec3 rd = GetRayDir(uv, ro, lookat, 1.);
    
    vec3 col = vec3(0);
    
    vec3 p = ro+rd*(ro.y/rd.y);
    float dp = length(p.xz);
    
    if((ro.y/rd.y)>0.)
    	col *= 0.;
    else {
        uv = p.xz*.1;

        uv *= mix(1., 5., sin(t*.5)*.5+.5);

        uv *= Rot(t);
        m *= Rot(t);

        uv.x *= R3;
        

        for(float i=0.; i<1.; i+=1./3.) {
            float id = floor(i+t);
            float t = fract(i+t);
            float z = mix(5., .1, t);
            float fade = smoothstep(0., .3, t)*smoothstep(1., .7, t);

            col += fade*t*Layer(uv*z, N(i+id))*Col(id,duv);
        }
    }
    col *= 2.;
    
    if(ro.y<0.) col = 1.-col;
    
    col *= smoothstep(18., 5., dp);
    col *= 1.-duv*2.;
    gl_FragColor = vec4(col,1.0);
}