// https://www.shadertoy.com/view/XtlfWX
// Modified by ArthurTent
// Created by patu
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

#define getNormal getNormalHex

#define FAR 570.
#define INFINITY 1e32
#define t iAmplifiedTime

#define FOV 70.0
#define FOG .06

#define PI 3.14159265
#define TAU (2*PI)
#define PHI (1.618033988749895)

float vol = 0.;
float hash(vec2 x){
	return fract(572.612*sin(1413.7613*sin(t*41.12)+1175.2126*fract(dot(x, 1114.41256*vec2(56.0,1.37)))));
}

vec3 fromRGB(int r, int g, int b) {
 	return vec3(float(r), float(g), float(b)) / 255.;
}

vec3 lightColor = (vec3(0.));

vec3 saturate2(vec3 a) { return clamp(a, 0.0, 1.0); }
vec2 saturate2(vec2 a) { return clamp(a, 0.0, 1.0); }
float saturate2(float a) { return clamp(a, 0.0, 1.0); }



vec3 opRep( vec3 p, vec3 c )
{
    return mod(p,c)-0.5*c;
}

// Repeat only a few times: from indices <start> to <stop> (similar to above, but more flexible)
float pModInterval1(inout float p, float size, float start, float stop) {
	float halfsize = size*0.5;
	float c = floor((p + halfsize)/size);
	p = mod(p+halfsize, size) - halfsize;
	if (c > stop) { //yes, this might not be the best thing numerically.
		p += size*(c - stop);
		c = stop;
	}
	if (c <start) {
		p += size*(c - start);
		c = start;
	}
	return c;
}

// Same, but mirror every second cell so all boundaries match
vec2 pModMirror2(inout vec2 p, vec2 size) {
	vec2 halfsize = size*0.5;
	vec2 c = floor((p + halfsize)/size);
	p = mod(p + halfsize, size) - halfsize;
	p *= mod(c,vec2(2.))*2. - vec2(1.);
	return c;
}

void pR(inout vec2 p, float a) {
	p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

float opU2( float d1, float d2 ) {
    if (d1 < d2) return d1;
    return d2;
}

vec3 opU2( vec3 d1, vec3 d2 ) {
    if (d1.x < d2.x) return d1;
    return d2;
}

struct geometry {
    float dist;
    vec3 space;
    vec3 hit;
    vec3 sn;
    vec2 material;
    int iterations;
    float glow;
};

geometry geoU(geometry g1, geometry g2) {
    if (g1.dist < g2.dist) return g1;
    return g2;
}

geometry geoI(geometry g1, geometry g2) {
    if (g1.dist > g2.dist) return g1;
    return g2;
}

// from Mercury's sdf framework.

// Maximum/minumum elements of a vector
float vmax(vec2 v) {
	return max(v.x, v.y);
}

float vmax(vec3 v) {
	return max(max(v.x, v.y), v.z);
}

float vmax(vec4 v) {
	return max(max(v.x, v.y), max(v.z, v.w));
}

// Sign function that doesn't return 0
float sgn(float x) {
	return (x<0.)?-1.:1.;
}

vec2 sgn(vec2 v) {
	return vec2((v.x<0.)?-1.:1., (v.y<0.)?-1.:1.);
}

// Repeat space along one axis. Use like this to repeat along the x axis:
// <float cell = pMod1(p.x,5);> - using the return value is optional.
float pMod1(inout float p, float size) {
	float halfsize = size*0.5;
	float c = floor((p + halfsize)/size);
	p = mod(p + halfsize, size) - halfsize;
	return c;
}

// Repeat in two dimensions
vec2 pMod2(inout vec2 p, vec2 size) {
	vec2 c = floor((p + size*0.5)/size);
	p = mod(p + size*0.5,size) - size*0.5;
	return c;
}
// Repeat around the origin by a fixed angle.
// For easier use, num of repetitions is use to specify the angle.
float pModPolar(inout vec2 p, float repetitions) {
	float angle = 2.*PI/repetitions;
	float a = atan(p.y, p.x) + angle/2.;
	float r = length(p);
	float c = floor(a/angle);
	a = mod(a,angle) - angle/2.;
	p = vec2(cos(a), sin(a))*r;
	// For an odd number of repetitions, fix cell index of the cell in -x direction
	// (cell index would be e.g. -5 and 5 in the two halves of the cell):
	if (abs(c) >= (repetitions/2.)) c = abs(c);
	return c;
}

// Mirror at an axis-aligned plane which is at a specified distance <dist> from the origin.
float pMirror (inout float p, float dist) {
	float s = sgn(p);
	p = abs(p)-dist;
	return s;
}

vec2 pMirrorOctant (inout vec2 p, vec2 dist) {
	vec2 s = sgn(p);
	pMirror(p.x, dist.x);
	pMirror(p.y, dist.y);
	if (p.y > p.x)
		p.xy = p.yx;
	return s;
}

float fBox(vec3 p, vec3 b) {
	vec3 d = abs(p) - b;
	return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

geometry DE(vec3 p, vec3 modifier) {
 	const float scale = 6.5;
	const float offset = 15.0;
    const int FRACTALITERATIONS = 18;
    vec3 op = p;
	for(int n=0; n< FRACTALITERATIONS; n++)
	{
        p = abs(p);
        //pR(p.xz, -.03);
        p.zy = (p.y - p.z < 0.0) ? p.yz : p.zy;
		p.xz = (p.x - p.z < 0.0) ? p.zx : p.xz;

		p.y -= 2.;
        p.z += 3.;
        p.x += 2. ;//+ cos(-op.y * .08) * 10. + 5.;

        p.xyz = scale * p.xyz - offset*(scale-1.0) * modifier.xyz;
	}

 	geometry obj;
    obj.dist = length(p.xz) * (pow(scale, -float(FRACTALITERATIONS))) - 0.05;
	obj.space = p;
    return obj;
}

geometry map(vec3 p) {
    vec3 bp = p;
    vec3 floor_p = p;

    p = p.xzy;
	p.z = mod(p.z, 150.) - 75.;

    pR(p.xy, ceil(p.z / 80.) * (1. + sin(t / 2.)));
    pR(p.yx, ceil(p.z / 60.));

    float pM = pModPolar(p.xy, 6.);

    vec3 sp = p;

	pMirrorOctant(p.zy, vec2(2., -30.));
    pMirrorOctant(p.xy, vec2(-30., 20.));

    p.x += cos(p.z / 4. + t) ;
    p.z -= 15. + p.y - p.x + t;
    p.yx += - sin(t / 10. + p.y / 20.) * 1.;

    geometry obj, obj2, obj3;

    obj = DE(p, vec3(3.9 ,.1, .5));
    obj.material = vec2(1., 0.);

    obj2.dist = length(bp.xz) - .5;
    obj2.material = vec2(5., 0.);

    obj = geoU(obj, obj2);


    pMod1(bp.y, 150.);
    //obj = obj3;
    obj3 = obj2;
    obj3.dist = max(fBox(bp, vec3(40., 1., 40.)), -fBox(bp, vec3(38., 4., 38.)));

    obj = geoU(obj, obj3);
    return obj;
}

float t_min = 0.001;
float t_max = FAR;
const int MAX_ITERATIONS = 300;

geometry trace(vec3 o, vec3 d) {
    float omega = 1.3;
    float t1 = t_min;
    float candidate_error = INFINITY;
    float candidate_t = t_min;
    float previousRadius = 0.;
    float stepLength = 0.;
    float pixelRadius = 1./ 180.;

    geometry mp = map(o);
    mp.glow = 0.;

    float functionSign = mp.dist < 0. ? -1. : +1.;
    float minDist = INFINITY;

    for (int i = 0; i < MAX_ITERATIONS; ++i) {

        mp = map(d * t1 + o);

        minDist = min(minDist, mp.dist * .8);
        mp.glow = pow(1. / minDist, .8);

        float signedRadius = functionSign * mp.dist;
        float radius = abs(signedRadius);
        bool sorFail = omega > 1. &&
        (radius + previousRadius) < stepLength;
        if (sorFail) {
            stepLength -= omega * stepLength;
            omega = 1.;
        } else {
        stepLength = signedRadius * omega * .3;
        }
        previousRadius = radius;
        float error = radius / t1;
        if (!sorFail && error < candidate_error) {
            candidate_t = t1;
            candidate_error = error;
        }
        if (!sorFail && error < pixelRadius || t1 > t_max) break;
        t1 += stepLength;
   	}

    mp.dist = candidate_t;

    if (
        (t > t_max || candidate_error > pixelRadius)
    	) mp.dist = INFINITY;

    return mp;
}

float softShadow(vec3 ro, vec3 lp, float k) {
    const int maxIterationsShad = 18;
    vec3 rd = (lp - ro);

    float shade = 1.;
    float dist = 4.0;
    float end = max(length(rd), 0.01);
    float stepDist = end / float(maxIterationsShad);

    rd /= end;
    for (int i = 0; i < maxIterationsShad; i++) {
        float h = map(ro + rd * dist).dist;
        shade = min(shade, k*h/dist);
        //shade = min(shade, smoothstep(0.0, 1.0, k * h / dist));
        dist += min(h, stepDist * 2.);
        if (h < 0.001 || dist > end) break;
    }
    return min(max(shade, 0.05), 1.0);
}

#define EPSILON .001
vec3 getNormalHex(vec3 pos)
{
	float d=map(pos).dist;
	return normalize(
        vec3(
            map(
                pos+vec3(EPSILON,0,0)).dist-d,
                map(pos+vec3(0,EPSILON,0)).dist-d,
                map(pos+vec3(0,0,EPSILON)).dist-d
        	)
    	);
}

float getAO(vec3 hitp, vec3 normal, float dist)
{
    vec3 spos = hitp + normal * dist;
    float sdist = map(spos).dist;
    return clamp(sdist / dist, 0.3, 1.0);
}

vec3 getObjectColor(vec3 p, vec3 n, inout geometry obj) {
    vec3 col = vec3(1.0);
    obj.glow = 0.;

    return col;
}

vec3 doColor( in vec3 sp, in vec3 rd, in vec3 sn, in vec3 lp, inout geometry obj) {
	vec3 sceneCol = vec3(0.0);
    lp = sp + lp;
    vec3 ld = lp - sp;
    float lDist = max(length(ld / 2.), 0.001);
    ld /= lDist;

    float diff = max(dot(sn, ld), 1.);
    float spec = pow(max(dot(reflect(-ld, sn), -rd), 1.), .2);
    vec3 objCol = getObjectColor(sp, sn, obj);
    sceneCol += (objCol * (diff + .15) + spec * .5 );

    return sceneCol;
}

vec4 pixelColor() {
    vec4 fragColor = vec4(0.);
    //vec2 ouv = fragCoord.xy / iResolution.xy;
    vec2 ouv = vUv;
    vec2 uv = ouv - .5;

    vol = texture(iAudioData, vec2(.8, .25)).r;
    vol = pow(vol * 2., 10.);

    uv *= tan(radians (FOV) / 2.0) * 1.1;

    float t2 = t - 35.;
    float
        sk = sin(-t2 * .4) * 166.0,
        ck = cos(-t2 * .4) * 162.0,

        mat = 0.;

    uv.x += pow(
        ceil(hash(uv) * floor(vol) / 10. * 14.) / 12. * abs(ceil(2. * uv.y + hash(uv.yx))),
        4.
    );

    if (iAmplifiedTime > 45. && vol > 0.9 && hash(uv) > .6) uv = ceil(uv * 32.) / (32. + hash(uv)) ;

    vec3
        vuv = vec3(0., 1., 0.),
    	ca = vec3(ck, 0., sk);

    vec3 cameraPos = vec3(30., 0. - t * 20., -20.);

	float focus = -78. - uv.x * 50. + 20.;

    vec3 ro = cameraPos;

    vec3
        vrp =  vec3(-30., 53. + ck / 5., 4.+ ck / 20.) + ro,
    	vpn = normalize(vrp - ro),
    	u = normalize(cross(vuv, vpn)),
    	v = cross(vpn, u),
    	vcv = (ro + vpn),
    	scrCoord = (vcv + uv.x * u * iResolution.x/iResolution.y + uv.y * v),
    	rd = normalize(scrCoord - ro);

    rd = normalize(rd);

	cameraPos -= rd * focus;
    ro = cameraPos;

    vec3 sceneColor = vec3(0.);
 	vec3 light ;

    geometry tr = trace(ro, rd);

    tr.hit = ro + rd * tr.dist;

    tr.sn = getNormal(tr.hit);
	light = tr.hit;
    light.xy *= 0.;

    if (tr.dist < FAR) {
        float sh = softShadow(tr.hit, ro + light, 1.2);

        float
            ao = getAO(tr.hit, tr.sn, 1.9);

        vec3 col = (doColor(tr.hit, rd, tr.sn, light, tr) * .5);
        sceneColor = col;

        sceneColor *= ao;
        sceneColor *= sh;
    } else {
        sceneColor = vec3(.06) * length(rd.xy);
        sceneColor = mix(
            sceneColor,
            saturate2(vec3(.5 * vol, sk, ck) * cos(uv.y * 2.) * 10.),
            abs(float(tr.glow) / 4. * vol)
        );
    }

    sceneColor += float(tr.glow) / 10. * vec3(0. , 0., 1.);
    fragColor = vec4(clamp(sceneColor * (1.5 - length(uv) / .5), 0.0, 1.0), 1.0);

    return fragColor;
}

void main() {
    gl_FragColor = pixelColor();
    gl_FragColor = pow(gl_FragColor, 1./ vec4(2.));
}

