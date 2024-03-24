// https://www.shadertoy.com/view/XXBGzw
// Modified by ArthurTent
// Created by orblivius
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

// Fork of "Fractal 77_gaz" by gaz. https://shadertoy.com/view/fdy3WG
// 2024-02-18 19:18:54

#define R(p,a,r)mix(a*dot(p,a),p,cos(r))+sin(r)*cross(p,a)
#define H(h)(cos((h)*6.3+vec3(0,23,21))*.5+.5)
vec3 pow3(vec3 x, int y) {
    while (y>0) {
        x*=x;
        y=y-1;
    }
    return x;
}
float fft(float x) {
    return texelFetch( iAudioData, ivec2(128.*x,0), 0 ).x;
 }

void main()
{
    gl_FragColor=vec4(0);

    float bass  = texelFetch( iAudioData, ivec2(1,0), 0 ).x;
    bass = clamp((bass-0.5)*2.0,0.0,1.0);

    vec3 p,r=vec3(iResolution.x,iResolution.y,1);
    vec2 uv = -1. + 2. * vUv;
    vec3 d = normalize(vec3((bass*2.+uv*r.xy)/r.y,1));
    for(
        float i=0.,g=0.,e,s;
        ++i<99.;
        gl_FragColor.rgb+=mix(vec3(r/r) ,H(log(s)),.7)*.08*exp(-i*i*e))
    {

        p=g*d;
        p.z-=.6;
        p=R(p,normalize(vec3(1,2,3)),iTime*.3);
        s=4.;
        for(int j=0;j++<8;)
            p=abs(p),p=p.x<p.y?p.zxy:p.zyx,
            s*=e=1.8/min(dot(p,p),1.3),
            p=p*e-vec3(12,3,3)+2.*fft((e)/99.);
        g+=e=length(p.xz)/s;

    }
    //O=vec4(pow3(O.rgb,2),1.);
 }