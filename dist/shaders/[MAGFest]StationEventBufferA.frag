#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

#define getNormal getNormalHex

#define FAR 500.
#define INFINITY 1e32
#define time mTime
#define mt mTime
#define FOV 130.0
#define FOG 1.

#define PI 3.14159265
#define TAU (2*PI)
#define PHI (1.618033988749895)

vec3 h;
float part2Time;
float mTime;

// int hash
#define kk 1103515245U
vec3 hash( uvec3 x )
{
    x = ((x>>8U)^x.yzx)*kk;
    x = ((x>>8U)^x.yzx)*kk;
    x = ((x>>8U)^x.yzx)*kk;

    return vec3(x)*(1.0/float(0xffffffffU));
}

float vol = 0.;

const vec3 light = vec3(20., 1., -10.);
const vec3 lightColour = normalize(vec3(1.8, 1.0, 0.3));

vec3 saturate(vec3 a) { return clamp(a, 0.0, 1.0); }
vec2 saturate(vec2 a) { return clamp(a, 0.0, 1.0); }
float saturate(float a) { return clamp(a, 0.0, 1.0); }

vec3 opRep( vec3 p, vec3 c )
{
    return mod(p,c)-0.5*c;
}

float pModInterval1(inout float p, float size, float start, float stop) {
	float halfsize = size*0.5;
	float c = floor((p + halfsize)/size);
	p = mod(p+halfsize, size) - halfsize;
	if (c > stop) {
		p += size*(c - stop);
		c = stop;
	}
	if (c <start) {
		p += size*(c - start);
		c = start;
	}
	return c;
}

void pR(inout vec2 p, float a) {
	p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

vec3 opU2( vec3 d1, vec3 d2 ) {
    if (d1.x < d2.x) return d1;
    return d2;
}

vec3 opS2( vec3 d1, vec3 d2 )
{
    if (-d2.x > d1.x) return -d2;
    return d1;
}

vec3 opI2( vec3 d1, vec3 d2 ) {
 	if (d1.x > d2.x) return d1;
    return d2;
}

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

// Box: correct distance to corners
float fBox(vec3 p, vec3 b) {
	vec3 d = abs(p) - b;
	return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

// Same as above, but in two dimensions (an endless box)
float fBox2Cheap(vec2 p, vec2 b) {
	return vmax(abs(p)-b);
}

float fSphere(vec3 p, float r) {
	return length(p) - r;
}

vec3 blob(vec3 bp) {
    vec3 p = bp;

    bp.xzy *= 0.1;

    pR(bp.xz, mTime);
    pR(bp.yx, mTime * .8 + vol * .0);

    bp.xyz += sin(  2.0*bp.yzx + vec2(0., mTime + vol).xxy);
    bp.xyz -= sin(  4.0*bp.yzx + vec2(0., mTime + vol).yxx) * .5;

    return vec3(
        mix(fBox(p, vec3(10.)), fSphere(bp, 1. + vol * .1), min(1., pow(vol, 1.2) * .3)),// + sin(p.x / 14. + p.z / 13. + t * 4.) * 2. ),
        3.,
        0.
    );
}

vec3 map(vec3 o) {

    vec3 p = o;

    vec3 obj_blob = length(p) < 30. ? blob(p) : vec3(3., 0., 0.);

    vec3
        obj = vec3(FAR, -1.0, 0.0),
        obj2 = obj,
        stat;

    float mat = 2.;

    pModPolar(p.zx, 16.);

    pMirrorOctant(p.zy, vec2(32., 12.));
    pMirrorOctant(p.xz, vec2(16., 22.));

    pR(p.zy, 1.57 );

    p.x += 3.8;

    pModPolar(p.xz, 9.);
	pMirrorOctant(p.zy, vec2(6.4, .5));
    pMirrorOctant(p.xy, vec2(6.1, 4.));

    p.yx += 2.;

    obj = vec3(
        fBox2Cheap(p.xy, vec2(4.4, 1.5)),
        mat,
        0.
    );

    p.z -= 12.;

    obj2 = vec3(
        fBox(p, vec3(6., 2., .1)),
        1.,
        0.
    );

    stat = opU2(obj, obj2);
    obj = opU2(stat, obj_blob);

    return obj;
}


float t_min = 0.001;
float t_max = FAR;
const int MAX_ITERATIONS = 100;

vec3 trace(vec3 o, vec3 d) {
    float omega = 1.3;
    float t = t_min;
    float candidate_error = INFINITY;
    float candidate_t = t_min;
    float previousRadius = 0.;
    float stepLength = 0.;
    float pixelRadius = 0.003;
    float functionSign = map(o).x < 0. ? -1. : +1.;
    vec3 mp;

    for (int i = 0; i < MAX_ITERATIONS; ++i) {
        mp = map(d * t + o);
        float signedRadius = functionSign * mp.x;
        float radius = abs(signedRadius);
        bool sorFail = omega > 1. &&
        (radius + previousRadius) < stepLength;
        if (sorFail) {
            stepLength -= omega * stepLength;
            omega = 1.;
        } else {
        stepLength = signedRadius * omega;
        }
        previousRadius = radius;
        float error = radius / t;
        if (!sorFail && error < candidate_error) {
            candidate_t = t;
            candidate_error = error;
        }
        if (!sorFail && error < pixelRadius || t > t_max) break;
        t += stepLength;
   	}
    if (
        (t > t_max || candidate_error > pixelRadius)
    	) return vec3(INFINITY, 0., 0.);

    return vec3(candidate_t, mp.yz);
}


float softShadow(vec3 ro, vec3 lp, float k) {
    const int maxIterationsShad = 28;
    vec3 rd = (lp - ro); // Unnormalized direction ray.

    float shade = .9;
    float dist = 0.25;
    float end = max(length(rd), 0.001);
    float stepDist = end / float(maxIterationsShad);

    rd /= end;
    for (int i = 0; i < maxIterationsShad; i++) {
        float h = map(ro + rd * dist).x;
        shade = min(shade, k*h/dist);
        dist += min(h, stepDist * 2.);
        if (h < 0.001 || dist > end) break;
    }
    return min(max(shade, 0.7), 1.0);
}

#define EPSILON .001
vec3 getNormalHex(vec3 pos)
{
	float d=map(pos).x;
	return normalize(
        vec3(
            map(
                pos+vec3(EPSILON,0,0)).x-d,
                map(pos+vec3(0,EPSILON,0)).x-d,
                map(pos+vec3(0,0,EPSILON)).x-d
        	)
    	);
}

float getAO(vec3 hitp, vec3 normal, float dist)
{
    vec3 spos = hitp + normal * dist;
    float sdist = map(spos).x;
    return clamp(sdist / dist, 0.1, 1.0);
}

float tri( in vec2 p )
{
    return 0.5*(cos(6.2831*p.x) + cos(6.2831*p.y));
}

vec3 Sky(in vec3 rd, bool showSun, vec3 lightDir)
{

   float sunSize = 12.5;
   float sunAmount = max(dot(rd, lightDir), 0.4);
   float v = pow(abs(1.2 - max(rd.y, 0.0)), 5.1);
   vec3 sky = mix(vec3(.1, .2, .3), vec3(.32, .32, .32) * 1.2, v);
   if (showSun == false) sunSize = .1;
   sky += lightColour * sunAmount * sunAmount * 1. + lightColour * min(pow(sunAmount, 442.0)* sunSize, 0.2 * sunSize);
   return clamp(sky, 0.0, 1.0);
}

vec3 getObjectColor(vec3 p, vec3 n, vec3 obj) {
    vec3 col = vec3(.0);

    if (obj.y == 1.0) return vec3(1.);
    if (obj.y == 2.0) return vec3(1., .7, 0.4);
    if (obj.y == 3.0) return vec3(12., 12., 12.);

    return col;
}

vec3 doColor( in vec3 sp, in vec3 rd, in vec3 sn, in vec3 lp, vec3 obj) {
	vec3 sceneCol = vec3(0.0);

    vec3 ld = lp - sp;
    float lDist = max(length(ld / 2.), 0.001);
    ld /= lDist;

    float atten = 1.0 / (1.0 + lDist * 0.025 + lDist * lDist * 0.02);
    float diff = max(dot(sn, ld), .1);
    float spec = pow(max(dot(reflect(-ld, sn), -rd), 1.2), 2.0);

    vec3 objCol = getObjectColor(sp, sn, obj);
    sceneCol += (objCol * (diff + .15) * spec * .5) * atten;

    return sceneCol;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {

    vec2 uv = fragCoord.xy / iResolution.xy - .5;
    mTime = mod(iTime, 108.);

    if (abs(uv.y) > .0 + min(.35, time * .065)) {
     	fragColor *= 0.;
        return;
    }

    part2Time = (max(79., time) - 79.);

    uv *= tan(radians (FOV) / 2.0) * 1.1;

    uv.y *= 1.2;
    vol = texture(iAudioData, vec2(.2, .25)).r  * 4.;

    h = hash(uvec3((max(31., time + .1) - 31.) / 87. * 60. - 1.2)) * 2. + 3.;

    float
        sk = sin(-time * .1 + h.b  + 1.) * 42.0,
        ck = cos(-time * .1 + h.r ) * 42.0;

    vec3
        vuv = vec3(0., 1., 0.),
    	ro = vec3(ck, -2. + part2Time  * h.z * .25, sk),
        vrp =  vec3(0., 15., 0.);

    vrp -= tri(vec2(ro.xz * .2));
    vuv.x += tri(vrp.xy * .2) * .03;

    vec3
    	vpn = normalize(vrp - ro),
    	u = normalize(cross(vuv, vpn)),
    	v = cross(vpn, u),
    	vcv = (ro + vpn),
    	scrCoord = (vcv + uv.x * u * iResolution.x/iResolution.y + uv.y * v),
    	rd = normalize(scrCoord - ro);

    ro.yx += tri(vec2(time * .2));

    rd = normalize(rd);

    vec3 tr = trace(ro, rd);

    ro += rd * tr.x;

    vec3 oro = ro;

    vec3 sky = Sky(rd, true, normalize(light)) * 1.;
    vec3 skyns = Sky(rd, false, normalize(light)) * 1.;
    vec3 otr = tr;
    vec3 osn;
    vec3 sn;

    vec3 sceneColor = sky;

    float dof = 0.;

    if (tr.x < FAR) {

        sn = getNormal(ro);
        osn = sn;

        sceneColor = saturate(doColor(ro, rd, sn, light, tr));

        dof = tr.x / FAR;

        if (tr.y == 3.) {
            rd = reflect(rd, sn);
            ro += rd * .01;
            tr = trace(ro, rd);
            ro += rd * tr.x;

            if (tr.x > FAR) {
                sceneColor += Sky(rd, false, normalize(light)) * .75;
            }
        } else {
            vec3 p2 = ro;

            pR(ro.yz, mTime * 3.);
            sceneColor += max(0., 1. - blob(ro).x * .25) * 2. * vol * vec3(1., .5, .25) * .25;
            ro = p2;
        }

        sceneColor *= saturate(getAO(ro, sn, 6.0));
        sceneColor = mix(sceneColor, skyns, saturate(otr.x * 4.7 / FAR));
    }

    fragColor = vec4(clamp(sceneColor * (1. - length(uv) / 2.5), 0.0, 1.0), dof) * clamp((107. - time) * .3, 0., 1.) ;
}



void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
