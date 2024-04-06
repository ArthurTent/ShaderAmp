// https://www.shadertoy.com/view/MsVBDd
// Created by Firzen_
// Modified by Arthur Tent
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
#define aTime 150./20.*iAmplifiedTime

const float circleScale = 20.;

vec2 Inversion(vec2 uv)
{
    return vec2(uv.x, -uv.y)/((uv.x*uv.x)+(uv.y*uv.y));
}

vec2 toCircle(vec2 uv)
{
    return floor(uv*circleScale+vec2(0.5));
}

float inCircle(vec2 uv)
{
    return smoothstep(0.5,0.42,length(uv));
}

vec3 circleColor(vec2 uv)
{
    float f = (uv.x+uv.y*2.)/(10.*circleScale);
    return 0.7*vec3(
        	texture(iAudioData, vec2(f+0.0005, 0)).r/2.,
        	texture(iAudioData, vec2(f-0.15, 0)).r/2.,
        	texture(iAudioData, vec2(f+0.15, 0)).r/2.
        );
}

vec4 color(vec2 uv)
{
    float f = texture(iAudioData, vec2(0.0005, 0)).r;
    float f2 = texture(iAudioData, vec2(0.002, 0)).r;

    uv.y += sin(iTime+f+uv.x*30.)*f*0.02*cos(10.*uv.y+iTime+f);

    uv = Inversion(uv);

    vec2 circle = toCircle(uv);

    uv.x += sin(29.3*circle.y)*(iTime+f2)*0.1;
    uv.x = mod(uv.x+0.5/circleScale, 20./circleScale) + 0.5/circleScale;

    circle = toCircle(uv);

    vec3 col = circleColor(circle);

    float scale = sin(iTime+f+3.*smoothstep(0.2,1.,length(col)));

    return vec4(col,1.0) * inCircle(vec2(1./scale,1.)*(uv*circleScale-circle));
}

float centerCircleBlend(vec2 uv)
{
    return 1.-pow(length(uv)*3., 1.5);
}

void main()
{
    float f = texture(iAudioData, vec2(0.1, 0)).r;
    //vec2 uv = fragCoord/iResolution.xy;
    vec2 uv = vUv;
    uv -= vec2(0.5,0.5);
    uv /= vec2(iResolution.y / iResolution.x, 1);
    //uv -= iMouse.xy/iResolution.xy;
	vec3 c = mix(color(uv).rgb, vec3(0), centerCircleBlend(uv));
    //vec2 marvin_pos = -.5+1.3*uv*.76;
    vec2 marvin_pos = -.5+1.*uv*.76;
    //marvin_pos.y -= 0.0125;
    vec4 v = vec4(0.);
    if (fract(aTime/240.)>.0 &&fract(aTime/240.)<.365){
        v = texture2D(iChannel0, marvin_pos);
    } else if (fract(aTime/240.)>.365 && fract(aTime/240.)<.55){
        v = texture2D(iChannel1, marvin_pos);
    } else  {
        v = texture2D(iChannel1, marvin_pos);
    }
    v.x -=0.1;
    v.a*=f*5.;
    v.x *= f * sin(-.3+iAmplifiedTime/3.)/.3;
    v.y *= f * 2.*sin(iAmplifiedTime/2.);
    v.z *= f * 4.*sin(iAmplifiedTime*f);
    c += v.xyz*v.w;


    /*
    vec3 snd = texture(iAudioData, marvin_pos).rgb;
    vec3 vid = texture(iChannel0, marvin_pos-(snd.x*.05)).rgb;
    if (fract(aTime/240.)>.0 &&fract(aTime/240.)<.365){
        vid = texture(iChannel0, marvin_pos).rgb;
    } else if (fract(aTime/240.)>.365 && fract(aTime/240.)<.55){
        vid = texture(iChannel1, marvin_pos).rgb;
    } else  {
        vid = texture(iChannel2, marvin_pos).rgb;
    }
    vid.x -=0.1;
    //vid.a*=f*5.;
    vid.x *= f * sin(-.3+iAmplifiedTime/3.);
    vid.y *= f * 2.*sin(iAmplifiedTime/2.);
    vid.z *= f * 4.*sin(iAmplifiedTime*f);
    c += vid.xyz;
    c.rb += vid.rg*.4;
    */
    gl_FragColor = vec4(c,1.);
}