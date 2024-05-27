// https://www.shadertoy.com/view/md2GDD
// Modified by ArthurTent
// Created by leon
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
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


// Some bouncing made for Inercia Shader Royale 2022
// https://2022.inercia.pt/
// music by Diffty https://soundcloud.com/diffty

// globals
float fft, material, rnd;

// toolbox
#define time iTime
#define ss(a,b,t) smoothstep(a,b,t)
mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,s,-s,c); }
float gyroid (vec3 p) { return dot(sin(p), cos(p.yzx)); }
float random (vec2 p) { return fract(sin(dot(p,vec2(10.1324,5.654)))*46501.654); }
float fbm (vec3 p) {
  float result = 0., a = .5;
  for (float i = 0.; i < 3.; ++i) {
    result += abs(gyroid(p/a)*a);
    a /= 2.;
  }
  return result;
}
float box (vec3 p, vec3 s) {
  vec3 b = abs(p)-s;
  return max(b.x,max(b.y,b.z));
}

float map(vec3 p)
{
  float dist = 100.;

  // rotation angle
  float t = time*1.+p.z*.5;
  t = pow(fract(t), 10.) + floor(t);
  t += rnd;

  // translate offset
  float tt = time + p.z;
  tt = pow(fract(tt), 10.) + floor(tt);
  float r = .0*fft+.2+.1*sin(length(p)*3.-tt+p.z*5.);

  // kaleido
  float a = 1.;
  const float count = 12.;
  for (float i = 0.; i < count; ++i) {
    p.xz *= rot(t/a);
    p.yz *= rot(sin(t)/a);
    p.x = abs(p.x)-r*a;
    float shape = length(p)-.1*a;
    //if (mod(i, 2.) < .5) shape = box(p,vec3(1,1,.01)*.15*a);
    material = shape < dist ? i : material;
    dist = min(dist, shape);
    a /= 1.2;
  }

  // extra details surface
  float noise = fbm(p*60.);
  dist -= noise*.002;

  return dist*.3;
}

void main()
{
    // coordinates
    //vec2 uv = (2.*fragCoord.xy-iResolution.xy)/iResolution.y;
    vec2 uv = -2. + 4. * vUv;
    vec3 pos = vec3(0,0,2);
    vec3 ray = normalize(vec3(uv, -3));

    // noise
    float rng = random(uv);
    vec2 jitter = vec2(random(uv+.196),random(uv+4.1));

    // audio
    fft = texture(iAudioData, vec2(0.)).r;
    fft = pow(fft, .8);
    float aa = abs(atan(uv.y, uv.x))/10.+fft*3.;
    float lod = 100.;
    aa = floor(aa*lod)/lod;
    float fft2 = texture(iAudioData, vec2(fract(aa),0)).r;

    // timeline random (used in map to add extra rotation)
    float t = time*2.;
    float index = floor(t);
    float anim = fract(t);
    rnd = mix(random(vec2(index)), random(vec2(index+1.)), anim);

    // blur edge
    float luv = length(uv);
    ray.xy += jitter * smoothstep(.5, 2., luv)*.1;

    // glitch blur
    vec2 llod = 10.*vec2(random(vec2(floor(time*4.+.5))), random(vec2(floor(time*2.))));
    float blur = random(floor(uv*llod)+floor(time*4.));
    ray.xy += jitter*step(.95, blur)*.1;

    // raymarch
    const float count = 100.;
    float shade = 0.;
    float total = 0.;
    for (float index = count; index > 0.; --index) {
        float dist = map(pos);
        if (dist < .0001 * total || total > 10.) {
            shade = index/count;
            break;
        }
        // blur in distance
        ray.xy += jitter*total*.0005;
        dist *= .9+.1*rng;
        total += dist;
        pos += ray * dist;
    }

    // background
    vec3 color = vec3(0);
    color += ss(4.,.5, luv)*fft;

    // circle fft
    luv = length(uv);
    color += ss(.01,.0,abs(abs(luv-fft))-fft2*.2);

    // shading
    if (total < 10. && shade > .0) {
        color = vec3(0.2);
        vec2 unit = vec2(.001,0);
        vec3 normal = normalize(vec3(map(pos+unit.xyy)-map(pos-unit.xyy), map(pos+unit.yxy)-map(pos-unit.yxy), map(pos+unit.yyx)-map(pos-unit.yyx)));
        vec3 rf = reflect(ray, normal);
        color += .5+.5*cos(vec3(1,2,3)*5.+pos.z+blur);
        color *= mod(material, 2.);
        color += pow(dot(ray, normal)*.5+.5, 1.) * 2.;
        color += pow(dot(rf, vec3(0,1,0))*.5+.5, 10.);
        color *= shade;
    }

    gl_FragColor = vec4(color, 1);
}
