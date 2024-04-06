// https://www.shadertoy.com/view/4sdXz7
// Created by frutbunn
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

#define MAX_STEPS 			60
#define MAX_DISTANCE 		8.5
#define MARCHING_STEP_INC 	.3
#define EPSILON 			.01

#define COLORS  4

#define PI 3.14159265358979323846
#define TIMER(sec, min, max) (((mod(iTime, (sec)) * ((max) - (min))) / (sec)) + (min))

float scol[7];
float b[4];
int mode = 0;

vec4 texSphere(sampler2D t, vec3 p, vec3 n, float k) {
    return texture(t, p.yz * k) * abs (n.x)
     + texture(t, p.xz * k) * abs (n.y)
     + texture(t, p.xy * k) * abs (n.z);
}

vec4 texCube(in sampler2D t, in vec3 p, in vec3 n, in float k ) {
	vec4 x = texture( t, p.yz );
	vec4 y = texture( t, p.zx );
	vec4 z = texture( t, p.xy );
    vec3 w = pow( abs(n), vec3(k) );
	return (x*w.x + y*w.y + z*w.z) / (w.x+w.y+w.z);
}

mat2 mm2(in float a) {
    float c = cos(a), s = sin(a);

    return mat2(c, s, -s, c);
}

float smin(in float a, in float bb ) {
    float k = max(2., b[0]*5.);
    float res = exp( -k*a ) + exp( -k*bb ); return -log( res )/k;
}

float sdTorus(in vec3 p, in vec2 t){vec2 q = vec2(length(p.xz)-t.x,p.y); return length(q)-t.y;}

float map(in vec3 p, out float o[COLORS]) {
    p*=1. + scol[0]*.1;

    o[0] = sdTorus(p, vec2(1.+scol[2], .15)) + cos(1.5*p.x)*cos(1.5*p.y)*sin(1.5*p.z);
    o[2] = sdTorus(p, vec2(1.+scol[4], .15)) + cos(1.5*p.x)*sin(1.5*p.y)*sin(1.5*p.z);

    p.xy*=mm2(PI*.5);

    o[1] = sdTorus(p, vec2(1.+scol[3], .15)) + cos(1.5*p.x)*cos(1.5*p.y)*cos(1.5*p.z);
    o[3] = sdTorus(p, vec2(1.+scol[5], .15)) + sin(1.5*p.x)*sin(1.5*p.y)*sin(1.5*p.z);

    return smin(o[0], smin(o[1], smin(o[2], o[3])));
}

float scene(in vec3 p, out float o[COLORS]) {
    return map(p, o);
}

float scene(in vec3 p) {
    float o[COLORS]; return map(p, o);
}

void colorize(in float d, in vec3 material_col, inout float z_depth, inout vec3 pixel_col) {
    const float max_displace = .25;
    const float max_col_bleed = 1.5;

    float nc = smoothstep(d-max_col_bleed, d+max_col_bleed, z_depth);
    float nzd = smoothstep(d-max_displace, d+max_displace, z_depth);

    z_depth = d*(nzd) + z_depth*(1.-nzd);
    pixel_col = (1.-nc)*pixel_col + (nc)*material_col;
}

float rayMarch(in vec3 origin, in vec3 ray, out vec3 col) {
    float o[COLORS];

    float t = 0.;
    for (int i=0; i < MAX_STEPS; i++) {
        float d = scene(origin + ray*t, o);

        if (d < EPSILON)
            break;

        t += d*MARCHING_STEP_INC;

        if (t > MAX_DISTANCE)
            break;
    }

    float z_depth = 1.;
    colorize(o[0], vec3(1.*scol[0], 1.*scol[6], 1.*scol[4]), z_depth, col );
    colorize(o[2], vec3(1.*scol[1], 1.*scol[5], 0.), z_depth, col );

    colorize(o[1], vec3(0., .5*scol[6], 1.*scol[2]), z_depth, col );
    colorize(o[3], vec3(1.*scol[2], 0., .5*scol[3]), z_depth, col );

    col = clamp(col, 0., 1.);

    return t;
}

float ambientOcculation(in vec3 origin, in vec3 ray) {
    const float delta = .1;
    const int samples = 6;
    float r = 0.;

    for (int i=1; i <= samples; i++) {
        float t = delta * float(i);
        float d = scene(origin + ray*t);
        float len = abs(t - d);
        r += len * pow(2.0, -float(i));
    }

    return r;
}

float shadowSample(in vec3 origin, in vec3 ray) {
    float r = 1.;
    float t = 1.;
    const int samples = 12;

    for (int i=0; i <= samples; i++) {
        float d = scene(origin + ray*t);
        r = min(r, 8.0*d/t);
        t += d;
    }

    return max(r, 0.);
}

vec3 getNormal(in vec3 p, in float ep) {
    float d0 = scene(p);
    float dX = scene(p - vec3(ep, 0.0, 0.0));
    float dY = scene(p - vec3(0.0, ep, 0.0));
    float dZ = scene(p - vec3(0.0, 0.0, ep));

    return normalize(vec3(dX-d0, dY-d0, dZ-d0));
}

vec3 starfield(in vec2 uv) {
    vec3 col = vec3(.0);
    vec3 ray = vec3(uv*.8, .7);
    ray.xy*=mm2(TIMER(10. ,0., -PI*2.));

    vec3 t = ray/max(abs(ray.x), abs(ray.y));
    vec3 p = 1.*t+.5;

    if(mode==1){
    	float dd = PI, c = cos(dd*p.y+dd), s = sin(dd*p.y+dd);
        p = vec3(mat2(c,-s,s,c)*p.xz,p.y);
    }


    for(int i=0; i<3; i++) {
        float n = .25;
        //float n = fract(sin(length((vec2(floor(p.xy*30.334)))+.5;
        float z = fract(cos(n)-sin(n)-iTime*.2);
        float d = 6.*z-p.z;

        if(b[0]>.5)
        d = b[0]*2.*z-p.z;

        float j = max(0., 1.5-2.*length(fract(p.xy)-.5));
        vec3 c = max(vec3(0), vec3(1.0-abs(d))*(1./t.z*2.));

        col += (1.-z)*c*j*1.2;
        p += t;
    }

    if(mode==1){
        col.b *= scol[1]*1.7;
        col *= length(uv*.12);
    }

    col = max(vec3(0.), min(vec3(1.), col));

    return col*5.;
}


float f1(in float x) {
    return sqrt(1.-(x-1.)*(x-1.));
}

vec3 interference(in vec2 uv, in vec3 s, in float d) {
    vec2 uv2= uv - d;

    s *= abs (.12/sin((uv2.y)) );
    return s;
}


void main() {
    //vec2 uv = (gl_FragCoord.xy / iResolution.xy) - vec2(.5);
    vec2 uv = -0.5 +vUv;
    vec2 uv_crt2 = uv;

    float curvature = length(uv*.5 * uv*.5);
    uv = uv*curvature + uv*.935;

    vec2 uv_crt = uv;

    uv.x *= iResolution.x/iResolution.y;

    #	define MM 5.1
    scol[0]=texture(iAudioData, vec2(0., 0.25) ).x;     scol[0]=f1(clamp(1.*scol[0]*scol[0], 0., 1.)); scol[0]*=MM*scol[0]*scol[0];
    scol[1]=texture(iAudioData, vec2(.17*1., 0.25) ).x; scol[1]=f1(clamp(1.*scol[1]*scol[1], 0., 1.)); scol[1]*=MM*scol[1]*scol[1];
    scol[2]=texture(iAudioData, vec2(.17*2., 0.25) ).x; scol[2]=f1(clamp(1.*scol[2]*scol[2], 0., 1.)); scol[2]*=MM*scol[2]*scol[2];
    scol[3]=texture(iAudioData, vec2(.17*3., 0.25) ).x; scol[3]=f1(clamp(1.*scol[3]*scol[3], 0., 1.)); scol[3]*=MM*scol[3]*scol[3];
    scol[4]=texture(iAudioData, vec2(.17*4., 0.25) ).x; scol[4]=f1(clamp(1.*scol[4]*scol[4], 0., 1.)); scol[4]*=MM*scol[4]*scol[4];
    scol[5]=texture(iAudioData, vec2(.17*5., 0.15) ).x; scol[5]=f1(clamp(1.*scol[5]*scol[5], 0., 1.)); scol[5]*=MM*scol[5]*scol[5];
    scol[6]=texture(iAudioData, vec2(.99, 0.25) ).x;    scol[6]=f1(clamp(1.*scol[6]*scol[6], 0., 1.)); scol[6]*=MM*scol[6]*scol[6];

    b[0] = (scol[1]+scol[1]+scol[0])* .25;
    b[1] = (scol[3]+scol[3]+scol[2])* .15;
    b[2] = (scol[4]+scol[5]+scol[4])* .3;
    b[3] = (scol[2]+scol[6]+scol[6])* .25;

    uv*=1.6;

    if(b[0]>1.5) mode = 1;
    if(b[2]>1.2) uv*=.6+b[2]*.25;

    vec2 uv2 = uv;

    if(b[2]>1.) uv*=.3+b[2]*.5;

    vec3 eye = vec3(0., 0., -5.);
    vec3 light = vec3(3., -1.5, -6.);
    vec3 ray = vec3(uv.x, uv.y, 1.);

    vec3 scene_color = vec3(0.);

    float rz = TIMER(10. ,0., PI*2.);
    float rx = TIMER(5. ,0., PI*2.);
    float ry = TIMER(4. ,0., PI*2.);

    if(b[1]>1.2) uv*=.3+b[0]*.5;
    if(b[2]>1.2) uv*=.3+b[0]*.4;

    eye.zx*=mm2(rx); eye.xy*=mm2(rz); eye.zy*=mm2(ry);
    light.zx*=mm2(rx); light.xy*=mm2(rz); light.zy*=mm2(ry);
    ray.zx*=mm2(rx); ray.xy*=mm2(rz); ray.zy*=mm2(ry);

    float depth = rayMarch(eye, ray, scene_color);
    if (depth < MAX_DISTANCE) {
        vec3 p = (eye + ray*depth);

        float d_ep=length(p - depth);
        vec3 p_normal = getNormal(p, d_ep*d_ep*EPSILON*.1);

        vec3 light_dir = -normalize(light-p);
        vec3 reflected_light_dir = reflect(-light_dir, -p_normal);

        const float j=.004;
        float shadow = shadowSample(p, -light_dir);
        float attenuation = 1./(1. + j*pow( length(light-p), 2.0));
        attenuation*=max(1., 1.+shadow);

        float ambient = 1.0 - ambientOcculation(p, -ray);
        ambient = pow(max(ambient, 0.), 8.);

        float diffuse = max(0., dot(light_dir, p_normal));

		float lighting = max(0., (diffuse*.3 + ambient*.7)*attenuation);
        vec3 reflectioncolor = vec3(texture(iChannel1, vec2(reflected_light_dir.x,reflected_light_dir.y)).x);

        vec3 texcol = texCube(iAudioData, .4*p, p_normal, 1.0 ).rgb*lighting;

        scene_color*=.6;

        scene_color = (clamp(mix(scene_color+vec3(.0), reflectioncolor*2.1, max(0., 1.+(dot(-p_normal, ray)))), 0., 1.)+scene_color*.7)*lighting;
        scene_color = scene_color + texcol*.1;

        scene_color *= max(dot(p_normal,ray),0.5);
    } else {
        if (iTime>24.)
        scene_color=starfield(uv2);
		else
        scene_color=vec3(0.2,.2, .2);
    }

    if (mode == 1)
    	scene_color = scene_color + interference(uv_crt, scene_color, b[0]*1.6);

    scene_color=min(vec3(1.), max(vec3(0.), scene_color));

    float mm = 15.5;
    float l = 1. - min(1., curvature*mm);
    scene_color *= l;

    float y = uv_crt2.y;
    float showScanlines = 1.;
    if (iResolution.y<280.) showScanlines = 0.;
    float s = 1. - smoothstep(360., 1440., iResolution.y) + 1.;
    float j = cos(y*iResolution.y*s)*.125;
    scene_color = abs(showScanlines-1.)*scene_color + showScanlines*(scene_color - scene_color*j);

    float cm = max(0.0, 1. - 2.*max(abs(uv_crt.x), abs(uv_crt.y) ) );
    cm = min(cm*200., 1.);
    scene_color *= cm;

    scene_color = max(vec3(0.), min(vec3(1.), scene_color));
    scene_color = clamp(scene_color, 0., 1.);

    gl_FragColor = vec4(pow(scene_color, vec3(1.15)), 1.);
}