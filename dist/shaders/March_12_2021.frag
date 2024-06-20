// https://www.shadertoy.com/view/fsl3z4
// Modified by ArthurTent
// Created by TheNosiriN
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

//Made by: TheNosiriN
//Wanted to make this textureless but it didn't work out


#define TIME (iTime)
#define R (iResolution.xy)
#define sinm(x) (sin(x)*.5+.5)
#define mind(a, b) (a.x < b.x ? a:b)
#define maxd(a, b) (a.x > b.x ? a:b)
#define saturate2(x) clamp(x, 0.0, 1.0)
#define hash21(p) (fract(sin(dot(p, p+5373.836))*9272.8363) *2.0-1.0)

const vec3 light = normalize(vec3(0,0,1));
const mat2 M2 = mat2(0.8,-0.6,0.6,0.8);

float freq1 = 0.;

vec3 getSkyCol(vec3 dir){
    return mix(vec3(1.000,0.788,0.133), vec3(0.529,0.808,0.922), pow(dir.y, 0.4))*freq1;
}


vec3 window(vec3 eye, vec3 dir){

    float d, i; vec2 ind;
    for (; i<100. && d < 100.; i++){
       vec3 p = eye + dir * d;

       float c = max(abs(p.x)-3.5, abs(p.y)-2.5);
       ind.x = min(abs(p.z)-0.4, max(-p.x+5.0, -p.z));
       ind.x = min(ind.x, max(c-0.4, abs(p.z)-0.6 ));
       ind.x = min(ind.x, max(c-0.5, abs(p.z)-0.5 ));

       //light shaft bug
       ind.x = min(ind.x, c+mix(0.05, 0.3, saturate2(
           pow(abs(p.z)+sin(p.x*40.0-TIME)+sin(p.y*40.0+TIME)+sin(TIME*0.5)*4.0, 2.0)/50.0 )
       ));
       ind.x = max(ind.x, -c);
       //

       vec2 f = vec2(max(c, -c-0.2), 0);

       c = max(abs(p.x+1.75)-1.7, abs(p.y)-3.5);
       f.x = min(f.x, c);

       ind = mind(ind, maxd(f, vec2(abs(p.z)-0.1, 0)));
       c = max(c+0.2, abs(p.y)-2.2);
       ind.y = maxd(vec2(ind.x,1), vec2(c, 0)).y;
       //ind.x = max(ind.x, -c);

       //wires
       /*p.y -= 3.0;
       p.z += 20.0;
       p.y = mod(p.y+2.5/2.0, 2.5)-2.5/2.0;
       float cy = length(p.yz)-0.05;

       p.z += 30.0;
       p.y = mod(p.y+1.5, 3.0)-1.5;
       cy = min(cy, length(p.yz)-0.05);

       ind.x = min(ind.x, cy);*/


       if (abs(ind.x) < 0.0001)break;
       d += ind.x;
    }
    return vec3(d, ind.y, i/100.0);
}


float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*f*(6.0*f*f - 15.0*f + 10.0);
    return mix(
        mix(hash21(i+vec2(0.0,0.0)),hash21(i+vec2(1.0,0.0)),u.x),
        mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),u.x),
    u.y);
}
float fbm(vec2 p){
    float f;
    f  = 0.5000*noise(p); p = M2*p*2.02 + TIME*0.1;
    f += 0.2500*noise(p); p = M2*p*2.03 + TIME*0.1;
    f += 0.1250*noise(p);
    return f;
}
float skyshape(vec3 p)
{
    float tex = textureLod(iChannel0, sin(p.xz*0.05)*2.0 + p.zx*0.1+TIME*0.02, 1.0).r*0.5+0.5;
    float fn = fbm(p.xz*0.1+TIME*0.01);
    float shape = abs(p.y-20.0 + fn*2.0)-tex;
    shape += 0.8 - fn;

    return shape*0.5;

}

vec3 darkSky(vec2 uv, vec3 eye, vec3 dir, vec3 col){

    vec3 sum;
    float vol, i, d;
    for (; i<100.0 && d<130.0; i++){
        float dt = max(0.05,0.02*d/100.); //umm...

        vec3 p = eye + dir * d + hash21(uv)*0.02;

        float shape = skyshape(p);

        if (shape > 0.01){
            d += shape;
        }else{
            vol += min(-shape, 0.01);
            float diff = saturate2(shape - skyshape(p+light*0.3));
            sum += mix(vec3(0.529,0.808,0.922), vec3(1.000,0.788,0.133), diff*0.5+0.5) * vol;
            d += dt;
        }
        if (vol >= 1.0)break;
    }
    sum /= 50.;


    return mix(sum, col+sum, i/100.);
}

void main()
{

    freq1 = texture(iAudioData, vec2(0.01, 0)).r;
    vec2 fragCoord = vUv * iResolution;
    vec2 uv = (fragCoord.xy-R*0.5)/R.y;

    float l = sinm(TIME*0.5)*0.4;
    vec2 m = (iMouse.xy-R*0.5)/R.y * 0.2;
    vec3 eye = vec3(-7, -7, 20),
    f = normalize(vec3(1.2+m.x, 0.3 + l + m.y, 0) - eye),
    s = normalize(cross(f, vec3(0,1,0))),
    dir = (
        mat4(vec4(s,0), vec4(cross(s, f),0), vec4(-f,0), vec4(1)) *
        vec4(normalize(vec3(uv, -3.5)), 0)
    ).xyz;


    vec3 col;
    vec3 sky = getSkyCol(dir);

    vec3 dist = window(eye, dir);

    if (dist.x >= 100.0){
        col = darkSky(uv, eye, dir, sky);
    }else{
        if (dist.y == 1.0){ col = darkSky(uv, eye, dir, sky) * 0.8; }
        col += (1.0-dist.x/100.0) * 0.2;
        col = mix(col, pow(sky,vec3(0.5))*0.6, dist.z+hash21(dir.xy)*0.025);
    }


    uv = fragCoord.xy/R;
    col *= 0.3 + 0.8*pow(32.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y),0.2);

    col *= smoothstep(0.1, 1.0, col);
    // Output to screen
    gl_FragColor = vec4(sqrt(col),1.0);
}