// https://www.shadertoy.com/view/W3SfRy
// Modified by ArthurTent
// Created by orblivius
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float iBPS;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

const float TAU = 6.28318;
//const float BPS = 145.0/60.0;

// https://www.shadertoy.com/view/XdGfRR
vec2 hash21(uint q) { uvec2 n = q * uvec2(1597334673U, 3812015801U); n = (n.x ^ n.y) * uvec2(1597334673U, 3812015801U); return vec2(n) * 2.328306437080797e-10; }
vec2 hash22(vec2 p) {     vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));     p3 += dot(p3, p3.yzx+33.33);     return fract((p3.xx+p3.yz)*p3.zy); }
// https://www.shadertoy.com/view/4djSRW
vec2 hash23(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy);}
//	Simplex 3D Noise by Ian McEwan, Stefan Gustavson (https://github.com/stegu/webgl-noise)
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}float snoise(vec3 v){const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);vec3 i  = floor(v + dot(v, C.yyy) );vec3 x0 =   v - i + dot(i, C.xxx) ;vec3 g = step(x0.yzx, x0.xyz);vec3 l = 1.0 - g;vec3 i1 = min( g.xyz, l.zxy );vec3 i2 = max( g.xyz, l.zxy );vec3 x1 = x0 - i1 + 1.0 * C.xxx;vec3 x2 = x0 - i2 + 2.0 * C.xxx;vec3 x3 = x0 - 1. + 3.0 * C.xxx;i = mod(i, 289.0 );vec4 p = permute( permute( permute(i.z + vec4(0.0, i1.z, i2.z, 1.0 ))+ i.y + vec4(0.0, i1.y, i2.y, 1.0 ))+ i.x + vec4(0.0, i1.x, i2.x, 1.0 ));float n_ = 1.0/7.0;vec3  ns = n_ * D.wyz - D.xzx;vec4 j = p - 49.0 * floor(p * ns.z *ns.z);vec4 x_ = floor(j * ns.z);vec4 y_ = floor(j - 7.0 * x_ );vec4 x = x_ *ns.x + ns.yyyy;vec4 y = y_ *ns.x + ns.yyyy;vec4 h = 1.0 - abs(x) - abs(y);vec4 b0 = vec4( x.xy, y.xy );vec4 b1 = vec4( x.zw, y.zw );vec4 s0 = floor(b0)*2.0 + 1.0;vec4 s1 = floor(b1)*2.0 + 1.0;vec4 sh = -step(h, vec4(0.0));vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;vec3 p0 = vec3(a0.xy,h.x);vec3 p1 = vec3(a0.zw,h.y);vec3 p2 = vec3(a1.xy,h.z);vec3 p3 = vec3(a1.zw,h.w);vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));p0 *= norm.x;p1 *= norm.y;p2 *= norm.z;p3 *= norm.w;vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);m = m * m;return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),dot(p2,x2), dot(p3,x3) ) );}

float section(float time) {
    return mod(time*iBPS/16.0, 32.0);
}


vec4 sampleTex(vec2 pos) {
    vec2 bounds = vec2(iResolution.x/iResolution.y, 1);
    if (pos == clamp(pos, vec2(-bounds), vec2(bounds))) {
        return texture(iChannel0, pos*0.5*vec2(iResolution.y/iResolution.x, 1.0)+0.5);
    } else {
        return vec4(0.0);
    }
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (fragCoord.xy-iResolution.xy/2.0)/(iResolution.y/2.0);
    vec2 bounds = vec2(iResolution.x/iResolution.y, 1);
    float time = iTime;
    vec3 col = vec3(0);
  
    float back = max((mod(time*iBPS/8.0, 1.0)-7.0/8.0)/(1.0-7.0/8.0), 0.0);
    float timew = time - pow(0.5-back, 2.0)*1.0;
    
    float section = section(time);
    
    float scale = (1.0+pow(back, 2.0)*4.0*float(section>0.5));
    float step = mix(0.1, 0.15-pow(mod(timew*iBPS, 1.0), 1.2)*0.05, float(section>0.5));
    for (float t=0.0; t<1.0; t+=step) {
        float to = step*mod(timew*iBPS, 1.0)+t;
        float tt = to*32.0;
        float n = 4.*(1.-t)*texture(iAudioData, vec2(mod(cos(p.y-to*.5)+2.,1.),1.)).r * 
                  4.*(1.-t)*texture(iAudioData, vec2(mod(sin(p.x-to*.5)+2.,1.),1.)).r; //snoise(vec3(normalize(p+0.001)*scale+vec2(0, time*0.5), time+to*2.0));
        float offset = tt*0.05;
        n *= 0.01+tt*0.01;
        col += smoothstep(0.2, 0.2 - 1.0, abs(length(p)-n-offset))*smoothstep(1.0, 0.5, to);
        col += smoothstep(-0.005, 0.0, -abs(length(p)-n-offset))*smoothstep(1.0, 0.5, to);
    }
  
    vec2 wind = normalize(p)*-1.0;
    float u = mod(time*iBPS*.5, 1.0);
    vec2 uv = p + wind*0.02;
    float brightness = mix(0.33, 0.4, float(section>1.0));
    for (int dx=-1; dx<=1; dx++) {
        vec2 suv = uv + vec2(dx, 0.0)*0.005;
        col += sampleTex(suv).rgb*vec3(float(dx)*0.4+0.8, (-u*0.3+0.9), float(-dx)*0.4+0.8)*brightness;
    }
  
    col = pow(min(col, vec3(1)), vec3(1.3, 1, 0.9));
  
    col *= mix(hash23(vec3(p*100.0, time)).x*0.3+0.7, 0.8, float(mod(time*iBPS, 2.0)<1.0));
  
    fragColor = vec4(col, 1);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
