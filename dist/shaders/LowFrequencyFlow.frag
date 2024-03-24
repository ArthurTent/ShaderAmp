// https://www.shadertoy.com/view/MtKSRc
// Modified by ArthurTent
// Created by patu
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

// Low Frequency Flow

//#define t (iChannelTime[0] - .1)
#define t (iGlobalTime - .1)

const float patternTime = 175. * 4. / 64.; // BPM * BEAT_LENGTH_(ROWS) / PATTERN_LENGTH_(ROWS)

float
    patternNumber = 0.,//floor(t / patternTime),
    vol,
    t_min = .001,
	MAX_DIST = 30.;

const int MAX_ITERATIONS = 260; // :(

vec4 hash(vec4 h) {
    return fract(sin(h) * 43758.5);
}

// IQ
float noise(vec3 p) {
	vec3 ip = floor(p);
    p -= ip;
    vec3 s = vec3(7, 157, 113);
    vec4 h = vec4(0, s.yz, s.y + s.z) + dot(ip, s);
    p *= p * (3.-2.*p);
    h = mix(hash(h), hash(h + s.x), p.x);
    h.xy = mix(h.xz, h.yw, p.y);
    return mix(h.x, h.y, p.z);
}

// http://mercury.sexy/hg_sdf/
void pR(inout vec2 p, float a) {
	p = cos(a) * p + sin(a) * vec2(p.y, -p.x);
}

float vmax(vec3 v) {
	return max(max(v.x, v.y), v.z);
}

// http://mercury.sexy/hg_sdf/
float fBox(vec3 p, vec3 b) {
	vec3 d = abs(p) - b;
	return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

vec3 dF(vec3 p) {
    vec2 c = floor(p.xz - .5) - .5;

    p.y += noise(c.xxy * 10.5) * 4. + sin(c.x * .5) + sin(c.y * .5 + t) * 1. + 2.;

    p.xz = mod(p.xz - .5, vec2(1.)) - .5;

    pR(p.xz, c.x + t * 2. - c.y);
    pR(p.yx, c.x + t * 2.2);

    return vec3(
        fBox(p / 2., vec3(0.03) + hash(c.xyxy).r * .14),
        c
    );
}

// http://erleuchtet.org/~cupe/permanent/enhanced_sphere_tracing.pdf
vec3 trace(vec3 o, vec3 d) {
    float omega = 1.;
    float ts = t_min;
    float candidate_error = 1e2;
    float candidate_t = t_min;
    float previousRadius = 0.;
    float stepLength = 0.;
    float pixelRadius = .002;
    float functionSign = dF(o).x < 0. ? -1. : 1.;
    vec3 mp;

    for (int i = 0; i < MAX_ITERATIONS; ++i) {
        mp = dF(d * ts + o);
        float signedRadius = functionSign * mp.x;
        float radius = abs(signedRadius);
        bool sorFail = omega > 1. &&
        	(radius + previousRadius) < stepLength;

        if (sorFail) {
            omega = 1.;
            stepLength -= omega * stepLength;
        } else {
        	stepLength = signedRadius * omega;
        }
        previousRadius = radius;
        float error = radius / ts;
        if (!sorFail && error < candidate_error) {
            candidate_t = ts;
            candidate_error = error;
        }
        if (!sorFail && error < pixelRadius || ts > MAX_DIST) break;
        ts += stepLength * .4;
   	}
    if (
        (ts > MAX_DIST || candidate_error > pixelRadius)
    	) return vec3(1e32, 0., 0.);

    return vec3(candidate_t, mp.yz);
}

// IQ
#define delta vec3(.001, 0., 0.)
vec3 getNormal(vec3 pos) {
   vec3 n;
   n.x = dF( pos + delta.xyy ).x - dF( pos - delta.xyy ).x;
   n.y = dF( pos + delta.yxy ).x - dF( pos - delta.yxy ).x;
   n.z = dF( pos + delta.yyx ).x - dF( pos - delta.yyx ).x;

   return normalize(n);
}

// IQ
float getAO(in vec3 hitp, in vec3 normal) {
    float dist = 4.;
    return clamp(dF(hitp + normal * dist).x / dist, .2, 1.);
}

vec3 getObjectColor(vec3 p, vec3 n, inout vec2 mat) {
    vec3 col = vec3(0, 4.5, 9);

    if (noise(mat.xyx) < .35 + abs(sin(t * .3) * .2)) {
     	col += vec3(1, .5, 0) * ceil(noise(mat.yxx * 29.)) * pow(
            texture(iAudioData, vec2(mat.x / 32. + t * .01, .25)).r * 4., 4.);
    }

    return col * 2.;
}

// Shane, https://www.shadertoy.com/view/4dt3zn
vec3 doColor( in vec3 sp, in vec3 rd, in vec3 sn, in vec3 lp, inout vec2 mat) {
	vec3 col = vec3(0);

    vec3 ld = lp - sp;
    float lDist = max(length(ld), .001);

    ld /= lDist;

    float atten = 2.5 / (1. + lDist * .525 + lDist * lDist * .05);
    float diff = max(dot(sn, ld), .1);
    float spec = pow(max(dot(reflect(-ld, sn), -rd), .1), .6);

    col = getObjectColor(sp, sn, mat) * (diff + .1) * spec * .2 * atten;
    return col * 2.;

}

void main() {
    patternNumber = floor(t / patternTime);
    vec2
		//ouv = fragCoord.xy / iResolution.xy,
        ouv = vUv,
        uv = ouv - .5;

    uv *= tan(.5 * radians(min(150., max(45., noise(patternNumber * vec3(.8)) * 150.))));

    float
        sk = sin(t * .1 + patternNumber) * 12.,
        ck = cos(t * .04) * 2.,
    	camZ = t * 1.4 + 1.6;

    vec3
        light = vec3(0, 3, 0),
    	sceneColor = vec3(0),

        vuv = vec3(0, 1, 0) + noise(patternNumber * vec3(-1, .2, -.4)),
    	ro = vec3(0, ck, camZ) + noise(patternNumber * vec3(2)) * vec3(10, 2, 100),
    	vpn = normalize(vec3(
            sk,
            -2,
            ck + 3.
        )),
    	u = normalize(cross(vuv, vpn)),
    	v = cross(vpn, u),
    	vcv = (ro + vpn),
    	scrCoord = (vcv + uv.x * u * iResolution.x/iResolution.y + uv.y * v),
    	rd = normalize(scrCoord - ro),

        sky = noise(rd * 2. + rd.yxz * 1.4 + t * .2) * .19 * vec3(0, .5, 1),
        lp = light + ro,

        tr = trace(ro, rd),
        sn;

    vol = texture(iAudioData, vec2(.4, .25)).r * 2.;

    if (tr.x < MAX_DIST) {
        ro += rd * tr.x;
        sn = getNormal(ro);
        sceneColor += doColor(ro, rd, sn, lp, tr.yz);
        sceneColor *= getAO(ro, sn);
        //sceneColor = mix(sceneColor, sky, tr.x / MAX_DIST);
    } else
     	sceneColor = sky;

    gl_FragColor.rgb = sceneColor * 2. * min(t * .35, 1.);

	// stubbe, https://www.shadertoy.com/view/XtdGR7
    gl_FragColor.rgb *= ouv.x * (1.-ouv.x) * ouv.y * (1.-ouv.y) * 32. * .75 + .25;

}
// patu, http://bit.ly/shadertoy-plugin
