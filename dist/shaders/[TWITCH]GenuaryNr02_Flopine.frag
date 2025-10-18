// https://www.shadertoy.com/view/MXyyzz
// Modified by ArthurTent
// Created by Flopine
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// Code by Flopine

// Thanks to wsmind, leon, XT95, lsdlive, lamogui, 
// Coyhot, Alkama,YX, NuSan, slerpy, wwrighter 
// BigWings, FabriceNeyret and Blackle for teaching me

// Thanks LJ for giving me the spark :3

// Thanks to the Cookie Collective, which build a cozy and safe environment for me 
// and other to sprout :)  
// https://twitter.com/CookieDemoparty

// Genuary #02 : Layers upon layers upon layers


#define hr vec2(1., sqrt(3.))
#define TAU (2.*acos(-1.))

#define rot(a) mat2(cos(a), sin(a), -sin(a), cos(a))

#define noi(u) textureLod(iChannel0, u, 0.).x
#define hash11(x) fract(sin(x)*2543.56)
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;


void moda (inout vec2 p, float rep)
{
    float per = TAU/rep;
    float a = mod(atan(p.x,p.y), per)-per*.5;
    p = vec2(cos(a), sin(a))*length(p);
}

float hexagon (vec2 uv, float s)
{
    uv = abs(uv);
    
    uv.x*=(1.+snd);
    uv.y*=(1.+snd);
    
    return max(uv.x, dot(uv, normalize(hr))) - s; 
}

vec4 hexgrid(vec2 uv)
{
    vec2 ga = mod(uv, hr)-hr*.5, gb = mod(uv-hr*.5, hr)-hr*.5, 
    guv = dot(ga,ga) < dot(gb,gb) ? ga : gb, gid = guv-uv;
    
    return vec4(guv, gid);
}

float pattern1 (vec2 uv)
{ return sin(hexagon(uv, 0.)*50.)/20.; }

float pattern2 (vec2 uv)
{
    float d = abs(hexagon(uv, .45));
    d = min(d, abs(length(uv)-.35));
    d = min(d, length(uv)-.15);
    
    return d;
}

float pattern3 (vec2 uv)
{
    float d = abs(hexagon(uv, 0.45));
    moda(uv, 3.);
    d = min(d, abs(uv.y));
    
    return d;
}

float grid (vec2 uv)
{
    vec4 hg = hexgrid(uv);
    float n = noi(hg.zw*.17);
    
    if (n < 0.33)
    {
        return pattern1(hg.xy);
    }
    else if (n < 0.66)
    {
        return pattern2(hg.xy);
    }
    else
    {
        return pattern3(hg.xy);
    }
}

float extrude (vec3 p, float d, float h)
{
    vec2 q = vec2(d, abs(p.z+snd));
    //vec2 q = vec2(d, abs(p.z));
    
    return min(0., max(q.x, q.y))+length(max(q,0.));
}

float id = 0.;
float SDF (vec3 p)
{
    float per = 1.;
    id = floor(p.z/per);
    p.xy *= rot(TAU/8.);
    p.xy += mod(id, 2.) < .5 ? vec2(iTime, 0.) : vec2(0.,-iTime); 
    p.z = mod(p.z,per)-per*.5;
    
    return extrude(p, grid(p.xy), 0.5) - 0.05;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    vec2 uv = (2.*fragCoord-iResolution.xy)/iResolution.y;
     
    vec3 ro = vec3(0.001,0.001, -1.2), rd=normalize(vec3(uv, 1.)),
    p=ro, col=vec3(0.);
    
    for(float i=0.; i<100.; i++)
    {
        float d = SDF(p);
        d = max(0.0002, abs(d)-.0001);
        p += d*rd*.9;
    }
    
    float t = length(p-ro);
    col = mix(col, vec3(hash11(id*.1)*.1, hash11(id*.4)*.9, 1.), 1.-exp(-0.03*t*t));

    // Output to screen
    fragColor = vec4(col,1.0);
}
void main() {
        vec2 fragCoord = vUv * iResolution;
        mainImage(gl_FragColor, fragCoord);
}