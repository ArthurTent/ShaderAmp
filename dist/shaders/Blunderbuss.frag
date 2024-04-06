// https://www.shadertoy.com/view/3lBfzz
// Modified by ArthurTent
// Created by z0rg
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

// This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0
// Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-sa/3.0/
// or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// =========================================================================================================

float snd = 0.;
mat2 r2d(float a){float cosa = cos(a);float sina = sin(a);return mat2(cosa,sina,-sina,cosa);}

float sat(float a)
{
    return clamp(a, 0.,1.);
}

float lenny(vec2 v)
{
    vec2 a = abs(v);
    return a.x+a.y;
}


// Thanks iq :) Box - exact   (https://www.youtube.com/watch?v=62-pRVZuS5c)
float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float cir(vec2 p, float r)
{
    float an = atan(p.y, p.x);
    float rad =

        sin(an*5.)*.5;
    return length(p)-r;
}
float loz(vec2 p, float r)
{
    return lenny(p)-r;
}

float add(float a, float b)
{
    return min(a, b);
}
float sub(float a, float b)
{
    return max(a, -b);
}
const float PI = 3.141592653;
float spd = 12.;
float chara(vec2 uv)
{
    //float spd = 15.;
    uv -= vec2(0.,.1715);
    vec2 uvB = (uv)*r2d(sin(iTime*spd*2.)*.02);
    float body = sdBox(uvB, vec2(.008,.01));
    vec2 lLeg = vec2(0.002+0.002*sin(-iTime*spd),-.01-((cos(-iTime*spd)))*0.001);
    float leftLeg = sdBox(uv-lLeg, vec2(.001,.01));
    leftLeg = add(leftLeg, sdBox(uv- lLeg-vec2(0.001,-.01), vec2(.002, 0.001)));

    vec2 rLeg = vec2(0.002+0.002*sin(-iTime*spd+PI),-.01-((cos(-iTime*spd+PI)))*0.001)-vec2(0.003,0.);
    float rightLeg = sdBox(uv-rLeg, vec2(.001,.01));
    rightLeg = add(rightLeg, sdBox(uv- rLeg-vec2(0.001,-.01), vec2(.002, 0.001)));
    uvB -= vec2(0.,.01);
    float ears = loz(vec2(abs(uvB.x)*3.-.0145, uvB.y), 0.01);

    return add(add(body, ears), add(leftLeg, rightLeg));
}

float tree(vec2 uv, float n)
{
    uv -= vec2(0.,.27);
    float t = sub(loz(uv,.03), uv.y);
    uv += vec2(0.,.03+0.005*sin(n));
    t = add(t, sub(loz(uv, .04), uv.y));
    uv += vec2(0.,.035+0.005*sin(n*2.+1.2));
    t = add(t, sub(loz(uv, .05), uv.y));
    uv += vec2(0.,.03);
    t = add(t, sub(loz(uv, .06+0.005*sin(n+.3)), uv.y));
    t = add(t, sdBox(uv, vec2(0.01, 0.05)));
    return t;
}


vec3 lerp4(vec3 grad[4], float i)
{
    float idx = sat(i)*3.0;
    int prevIdx = int(idx);
    int nextIdx = min(prevIdx+1, 3);
    vec3 prev = grad[prevIdx];
    vec3 next = grad[nextIdx];
    float lrp = idx - float(prevIdx);
    return mix(prev, next, smoothstep(0.,1.,lrp));
}



vec3 rdrWind(vec2 uv)
{
    float halo = abs(uv.y-.2-sin(uv.x*4.)*.02);
	return .3*(sin(uv.x*2.-iTime)*.5+.5)*texture(iChannel0, vec2(-iTime*.01, 0.)+uv*vec2(.05,20.)).xxx*(1.-sat(halo*25.));
}


vec3 rdr(vec2 uv)
{
    vec2 uvSky = uv*r2d(iTime*.1);
    float sharp = iResolution.x*2.;
    vec3 gradient[4];
    gradient[0] = vec3(9,5,75)/255.;
    gradient[1] = vec3(182,97,17)/255.;
    gradient[2] = vec3(91,217,222)/255.;
    gradient[3] = vec3(0,164,255)/255.;

    float an = abs(atan(uvSky.y*snd, uvSky.x*snd))-.2;
    vec3 col = pow(lerp4(gradient, an*.4+.1*distance(vec2(0.,1.), uv)), vec3(1./1.))*smoothstep(0.,1.,1.-sat(cir(uv, .2)*5.));

    float stars = (texture(iChannel0, uvSky*8.).x+texture(iChannel0, uvSky*8.*r2d(.1)).x)/2.;
    float rate = .80;
	col += vec3(texture(iChannel0, uv*5.).x*.5+.5,.8,.9)*sat(sat(stars - rate)/(1.-rate)-.1);

    col = mix(col, vec3(0.), 1.-sat(cir(uv, .15)*sharp));

    col = mix(col, vec3(0.), 1.-sat(chara(uv)*sharp));
    vec2 eyeP = uv-vec2(0.002,.175);
    mat2 rot = r2d(sin(iTime*spd*2.)*.05);
    float eyes = add(cir((eyeP*rot-vec2(0.005,0.)), 0.001), cir((eyeP*rot)-vec2(0.0025,0.), 0.001));
    col = mix(col, vec3(255,188,0)/255., 1.-sat(eyes*sharp));

    float tre = tree((uvSky-vec2(0.,.08))*2., 5.);
    col = mix(col, col*.2, 1.-sat(tre*sharp));
    float tree2 = tree((uvSky*r2d(1.)-vec2(0.,.08))*2., 1.);
    col = mix(col, col*.2, 1.-sat(tree2*sharp));
        float tree3 = tree((uvSky*r2d(5.)-vec2(0.,.1))*3., 5.);
    col = mix(col, col*.2, 1.-sat(tree3*sharp));


    float fog = sin(10.*an+iTime+length(uv))*.2+(sin(iTime-length(uv)*25.)*.2+.1)+.3;
    col = mix(col, col*.2, fog);
    col += (vec3(255,245,130)/255.)*smoothstep(0.,1.,1.-sat(cir(uvSky-vec2(-.5,0.), .1)*2.));

    col += rdrWind(vec2(an, length(uv)));
    col += mix(vec3(1.),.5+0.5*cos(iTime+uv.xyx+vec3(0,2,4)), snd)*.5*sat(abs(uv.x)*5.);
    return col;
}

void main()
{
    snd = texture(iAudioData, vec2(0.01, 0.25)).x*5.;
    vec2 fragCoord = vUv * iResolution;
    vec2 uv = (fragCoord-vec2(.5)*iResolution.xy)/iResolution.xx;
	uv *= .3;
    uv -= vec2(0.,-.2);

    vec3 col = rdr(uv);

  	col *= sat(iTime/2.);
    //col = pow(col, vec3(1./2.2));
    gl_FragColor = vec4(col,1.0);
}