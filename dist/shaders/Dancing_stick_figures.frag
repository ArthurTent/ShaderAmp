// https://www.shadertoy.com/view/XdByzy
// Modified by ArthurTent
// Created by Eybor
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define PI 3.141592

float head(vec2 pos, vec2 uv)
{
    vec2 v = pos-uv;
    float d = dot(v, v) *10.-1.;
    return smoothstep(0., 0.03, d*d);
}

float body(vec2 pos, vec2 uv)
{
    vec2 v = pos - uv;
    float dx = v.x*v.x;
    float d = dot(v, v);
    return clamp(smoothstep(0., .1, dx*100.)+smoothstep(.5, .6, d), 0., 1.);
}

vec2 rotation(vec2 p, float angle)
{
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle))*p;
}

float leg(vec2 pos, vec2 uv, float angle)
{
    vec2 v = rotation(pos - uv, angle) - vec2(0., .5);
    float dx = v.x*v.x;
    float d = dot(v, v);
    return clamp(smoothstep(0., .1, dx*100.)+smoothstep(.2, .3, d), 0., 1.);
}

float arm(vec2 pos, vec2 uv, float angle1, float angle2)
{
    vec2 v = rotation(pos - uv, angle1) - vec2(0., .35);
    float dx = v.x*v.x;
    float d = dot(v, v);
    vec2 v2 = rotation(v - vec2(0., .35), angle2) - vec2(0., .35);
    float dx2 = v2.x*v2.x;
    float d2 = dot(v2, v2);
    return clamp(smoothstep(0., .1, dx*100.)+smoothstep(.1, .15, d), 0., 1.)*
        clamp(smoothstep(0., .1, dx2*100.)+smoothstep(.1, .15, d2), 0., 1.);
}

float stickman(vec2 pos, vec2 uv, float bass, float angle1, float angle2)
{
    vec2 v = uv-pos;
    float d = head(vec2(0., .8), v*1.5);
    d *= body(vec2(0., -.1), v*2.);
    d *= leg(vec2(0., -.8), v*2., angle1);
    d *= leg(vec2(0., -.8), v*2., -angle1);
    d *= arm(vec2(0., .65), v*2., angle2+bass, iGlobalTime+bass*2.);
    d *= arm(vec2(0., .65), v*2., -(angle2+bass), -iGlobalTime+bass*2.);
   	return d;
}

vec3 getTexture(vec2 p){
	vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}

void main(  )
{
    vec3 col_greenscreen = getTexture(vUv);
    vec2 uv = -1.5 + 3.0 * vUv;
	//vec2 uv = (-1.+2.*fragCoord.xy/iResolution.xy)*vec2(iResolution.x/iResolution.y, 1.);

    float bass = 0.;

    for(float f = 0.; f <= .25; f += 1./100.)
    {
        bass += texture(iAudioData, vec2(f, .25)).x;
    }

    bass = -1.+2.*bass;

    vec3 co = vec3(1.);

    co *= stickman(vec2(0., 0.), uv, bass, PI/8., PI/4.);
    co *= stickman(vec2(-1., 0.), uv, bass, PI/8., PI);
    co *= stickman(vec2(1., 0.), uv, bass, PI/3., PI/3.);

    co *= vec3(sin(uv.x), cos(uv.x), sin(uv.x*uv.y));

    gl_FragColor = vec4(co, 1.0);
    gl_FragColor += vec4(col_greenscreen,1.0);
}