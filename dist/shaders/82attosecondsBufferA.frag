#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;


#define V vec3
#define W vec2
#define F float

const float BMP = 124.;
float BEAT_COUNT ;
float BEATN ;

float hash12(vec2 p) {
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
}

float scene;

#define FAR 570.
#define INFINITY 1e32
#define t iTime
#define mt iChannelTime[1]
#define FOV 100.0
#define FOG .06

#define PI 3.14159265
#define TAU (2*PI)
#define PHI (1.618033988749895)

float vol = 0.;
F
    Z = 0.,
    J = 1.;

float B(vec3 p)
{
	vec3 ip=floor(p);
    p-=ip;
    vec3 s=vec3(7,157,113);
    vec4 h=vec4(0.,s.yz,s.y+s.z)+dot(ip,s);
    p=p*p*(3.-2.*p);
    h=mix(fract(sin(h)*43758.5),fract(sin(h+s.x)*43758.5),p.x);
    h.xy=mix(h.xz,h.yw,p.y);
    return mix(h.x,h.y,p.z);
}

vec3 fromRGB(int r, int g, int b) {
 	return vec3(float(r), float(g), float(b)) / 255.;
}

vec3
    light = vec3(0.0),
    p = vec3(0.),
    p2 = vec3(0.),
	lightDir = vec3(0.);


vec3 lightColour = normalize(vec3(1.8, 1.0, 0.3));

vec3 saturate(vec3 a) { return clamp(a, 0.0, 1.0); }
vec2 saturate(vec2 a) { return clamp(a, 0.0, 1.0); }
float saturate(float a) { return clamp(a, 0.0, 1.0); }


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


vec4 fold1(vec4 z) {
    vec3 p = z.xyz;
    p = p - 2.0 * clamp(p, -1.0, 1.0);
    return vec4(p, z.w);
}

vec4 fold2(vec4 z) {
    vec3 p = z.xyz;
    p = p - 2.0 * clamp(p, -1.0, 1.0);
    return vec4(p * 2.0, 2.0 * z.w);
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
    int material;
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

float opS2( float d1, float d2 )
{
    if (-d2 > d1) return -d2;
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

float fCylinder(vec3 p, float r, float height) {
	float d = length(p.xz) - r;
	d = max(d, abs(p.y) - height);
	return d;
}
float fBox(vec3 p, vec3 b) {
	vec3 d = abs(p) - b;
	return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

float fBox2Cheap(vec2 p, vec2 b) { return vmax(abs(p)-b); }

float fCross(vec3 p, vec3 size) {
    float obj = fBox(p, size);
    obj = opU2(obj, fBox(p, size.zxy));
    obj = opU2(obj, fBox(p, size.yzx));
    return obj;
}


float fSphere(vec3 p, float r) { return length(p) - r; }

geometry DE(vec3 p)
{
 	float scale = 4.5;
	const float offset = 14.;
    const int FRACTALITERATIONS = 5;
    vec3 modifier = vec3(4., 1.5, .4 );

    for(int n=0; n< FRACTALITERATIONS; n++)
	{

	p = abs(p);

		p.xy = (p.x - p.y < 0.0) ? p.yx : p.xy;
		//p.xz = (p.x - p.z < 0.0) ? p.zx : p.xz;
		p.zy = (p.y - p.z < 0.0) ? p.yz : p.zy;


		p.y -= 9.9;

        p.y += 2.;
        p.x -= 14.;
        p.xy = scale* p.xy - offset*(scale-1.4) * modifier.xy;

	}
 	geometry obj;
    obj.dist = length(p.xz) * (pow(scale, -float(FRACTALITERATIONS))) - .5;
	obj.space = p;
    return obj;
}
float smin( float a, float b, float k ){

    float res = exp( -k*a ) + exp( -k*b );
    return -log( res )/k;

}
float ring(vec3 p, float w, float h) {
    return opS2(
        fCylinder(p, w, h),
        fCylinder(p, w - 2., h + 1.)
        );
}
geometry map(vec3 p) {
    float t = pow(iTime * 0.1, 2.);
    vec3 bbp = p;
    p.xz /= 1. + vol * 0.4;
    p += sin(vol * 4.+ t);
    pR(p.zy, t * .4 + vol * .1);

    vec3 bp = p;

    vec3 h = vec2(0., pow(B(vec2(0, -iTime * 5.).xxy + p * .5) * 3., 4.)).yyy * 0.007;



    geometry obj, obj2;

    //pR(p.xy, t * 2.);
    obj.dist = ring(p, 20., 1.);

    pModPolar(p.yx, 1. + ceil(t * .1 + vol));
    //obj.dist = opU2(obj.dist, fBox(p, vec3(20., 1.0, 1.) ));
    //obj.dist = opU2(obj.dist, fBox(p, vec3(1., 10., 20.)));
    pR(p.xy, .3 + t);
    obj.dist = opU2(obj.dist, ring(p, 22., 3.));
    pR(p.zy, .4 + 3. * t);
    obj.dist = opU2(obj.dist, ring(p, 24., 4.));
    p = bp;
    pR(p.zy, .5 + t * 2.4);
    obj.dist = opU2(obj.dist, ring(p, 26., 5.));

    pR(p.zy, .5 + t * 2.4);
    obj.dist = opU2(obj.dist, ring(p, 46., 10.));


    obj.material = 1;
    obj.space = p;

    pR(bp.zx,  + B(vec3(t)) * 13.);
    pModPolar(bp.zx, 3.);

    pR(bp.zx, 2. * PI / 3. / 2.);
    pModPolar(bp.xy, 5.);


    obj2.dist = fBox(bp, vec3(20., .1, .1) + h * 9.);
    obj2.material = 2;
    obj2.space = bp;

    obj.dist = opU2(obj.dist, fSphere(bp, 5.));

    obj = geoU(obj, obj2);

    return obj;
}


float t_min = 0.1;
float t_max = FAR;
const int MAX_ITERATIONS = 80;

geometry trace(vec3 o, vec3 d) {
    float omega = 1.3;
    float t = t_min;
    float candidate_error = INFINITY;
    float candidate_t = t_min;
    float previousRadius = 0.;
    float stepLength = 0.;
    float pixelRadius = 0.003;

    geometry mp = map(o);
    mp.glow = 0.;

    float functionSign = mp.dist < 0. ? -1. : +1.;
    float minDist = 1e32;

    for (int i = 0; i < MAX_ITERATIONS; ++i) {

        mp = map(d * t + o);
		//mp.iterations = i;
        //if (mp.material == 2) {
			//minDist = min(minDist, mp.dist * 3.);
		//	mp.glow = pow( 1. / minDist, .5);
        //}
        float signedRadius = functionSign * mp.dist;
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

    mp.dist = candidate_t;
    //if (mp.material != 2) mp.glow = 0.;

    if (
        (t > t_max || candidate_error > pixelRadius)
    	) mp.dist = INFINITY;


    return mp;
}


float softShadow(vec3 ro, vec3 lp, float k) {
    const int maxIterationsShad = 8;
    vec3 rd = (lp - ro);
    float shade = .3;
    float dist = 4.5;
    float end = max(length(rd), 0.01);
    float stepDist = end / float(maxIterationsShad);

    rd /= end;
    for (int i = 0; i < maxIterationsShad; i++) {
        float h = map(ro + rd * dist).dist;
        //shade = min(shade, k*h/dist);
        shade = min(shade, smoothstep(0.0, 1.0, k * h / dist));
        dist += min(h, stepDist * 2.);
        if (h < 0.001 || dist > end) break;
    }
    return min(max(shade, 0.15), 1.0);
}

vec3 applyFog( in vec3  rgb,      // original color of the pixel
               in float distance, // camera to point distance
               in vec3  rayOri,   // camera position
               in vec3  rayDir, vec3 fc )  // camera to point vector
{
    float c = .5;
    float b = .06;

    float fogAmount = c * exp(-rayOri.y*b) * (1.0-exp( -distance*rayDir.y*b ))/rayDir.y;
    //vec3  fogColor  = vec3(1.,0.5, 0.);
    return mix( rgb, fc, saturate(fogAmount) );
}

vec3 normal(vec3 pos) {
    F eps=0.0001, d=map(pos).dist;
	return normalize(vec3(map(pos+vec3(eps,0,0)).dist-d,map(pos+vec3(0,eps,0)).dist-d,map(pos+vec3(0,0,eps)).dist-d));
}


float getAO(vec3 hitp, vec3 normal, float dist)
{
    vec3 spos = hitp + normal * dist;
    float sdist = map(spos).dist;
    return clamp(sdist / dist, 0.0, 1.0);
}




vec3 getObjectColor(vec3 p, vec3 n, geometry obj) {
    vec3 col = vec3(.0);

    if (obj.material == 1) {
        col = fromRGB(128,128,128) * 3. + pow(vol, 4.) * .2;
            //boxmap(iChannel1, obj.space / 10., 1.).rgb;
    }

    if (obj.material == 2) {
        col = vec3(1.) * 3. - length(obj.space) * .2;// - B(obj.space* .1 - vec3(0., 0., t * 10.));

    };

    return col ;

}

vec3 doColor( in vec3 sp, in vec3 rd, in vec3 sn, in vec3 lp, geometry obj) {
	vec3 sceneCol = vec3(0.0);
    lp = sp + lp;
    vec3 ld = lp - sp; // Light direction vector.
    float lDist = max(length(ld / 4.), 0.1); // Light to surface distance.
    ld /= lDist; // Normalizing the light vector.

    // Attenuating the light, based on distance.
    float atten = 1. / (1.0 + lDist * 0.025 + lDist * lDist * 0.2);

    // Standard diffuse term.
    float diff = max(dot(sn, ld), 2.);
    // Standard specualr term.
    float spec = pow(max(dot(reflect(-ld, sn), rd), .7), 3.);

    // Coloring the object. You could set it to a single color, to
    // make things simpler, if you wanted.
    vec3 objCol = getObjectColor(sp, sn, obj);

    // Combining the above terms to produce the final scene color.
    sceneCol += (objCol * (diff + .15) * spec * .2);// * atten;

    // Return the color. Done once every pass... of which there are
    // only two, in this particular instance.

    return sceneCol;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    BEAT_COUNT = iTime /  60. * BMP / 8.;
    BEATN = fract(BEAT_COUNT);
    scene = mod(floor(BEAT_COUNT / 2.), 4.);
    vec2 ouv = fragCoord.xy / iResolution.xy;

    vec2 uv = ouv - .5;
	float n = hash12(ceil(uv.yy * 8.));
    vol = pow((texture(iAudioData, vec2(.42, .25)).r) * 2., 2.);

//uv.x += n * .02;
    //uv *= tan(radians (FOV) / 2.0) * 1.1;

  //uv += hash12(uv / 20.) * 0.01;
    float t2 = 140. - 35.;
	float t = iTime;
    float
        sk = sin(-t * 3.2) * 24.0,
        ck = cos(-t * 1.2) * 24.0,

        mat = 0.;

    light = vec3(0., 170., 150.);
    lightDir = light;



    vec3
        vuv = vec3(0., 1., 0.), // up
    	ro = vec3(10, 50, 0);// + vec3(iMouse.x / 20.,iMouse.y / 10. - 1., 10.); // pos

    //scene = floor(scene + fract(ouv.y - BEATN) * 2.);

    /*if (scene == 0.) ro.y = 55.;
    if (scene == 1.) ro.z = 528.;
    if (scene == 2.) ro.z = 228.;
    if (scene == 3.) {
        ro.x = 34.; ro.z = 490.;
    }
    */



    vec3
        vrp =  vec3(0., 0., 0.) , // lookat    */

    	vpn = normalize(vrp - ro),
    	u = normalize(cross(vuv, vpn)),
    	v = cross(vpn, u),
    	vcv = (ro + vpn),
    	scrCoord = (vcv + uv.x * u * iResolution.x/iResolution.y + uv.y * v),
    	rd = normalize(scrCoord - ro);

    vec3 sceneColor = vec3(0.),
         fogCol = vec3(1., .3, 0.);

    vec3 oro = ro, ord = rd;

    geometry tr = trace(ro, rd);

    tr.hit = ro + rd * tr.dist;

    tr.sn = normal(tr.hit);

    float
        sh = softShadow(tr.hit, tr.hit + light, 10.),
    	ao = getAO(tr.hit, tr.sn, 1.),
        a = 0.;

    vec3 sky = (
        vec3(
            pow(B(rd * 5. + t * .2) * 1., 3.) * 2. + .5
        //    + ceil(fract(-rd.x * 3. + rd.z * 4. - t * 2.1 ) - .5) * .04
        ) * vec3(1., .5, .0)) * .5;

    if (tr.dist < FAR) {

        sceneColor = doColor(tr.hit, rd, tr.sn, light, tr);
        sceneColor *= 1. + vec3(length(
            max(
                vec2(0.),
                1. * max(
                    0.,
                    length(normalize(light.z) * max(0., tr.sn.z))
                )
            )
        ));
        if (tr.material == 1) sceneColor *= ao;
        sceneColor *= sh;

        sceneColor = applyFog(sceneColor, tr.dist, oro, ord, fogCol);
        a = tr.dist / FAR;
    } else {

    	sceneColor = sky;
    }
	//sceneColor += tr.glow;// * B(tr.space);
    //a += (sceneColor.r + sceneColor.g + sceneColor.b) / 190.;
    fragColor = vec4(clamp(sceneColor * (1.4 - length(uv) / 1.), 0.0, 1.0), a);
    fragColor.rgb = pow(fragColor.rgb, vec3(1.4));

   // fragColor += scene;

}



void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
