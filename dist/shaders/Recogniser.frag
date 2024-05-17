// https://www.shadertoy.com/view/MdX3Dn
// Modified by ArthurTent
// Created by fizzer
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform sampler2D iVideo;
uniform vec2 iMouse;
varying vec2 vUv;

// from QuantumSuper
vec4 fft, ffts;
void compressFft(){ //v1.2, compress sound in iChannel0 to simplified amplitude estimations by frequency-range
    fft = vec4(0), ffts = vec4(0);

	// Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)
    for (int n=0;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 0-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(3,8,8,5); ffts /= vec4(2,3,3,23); //normalize

	//for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //limiter? workaround attempt for VirtualDJ
}

#define EPS vec2(1e-3, 0.0)

float time;

vec3 rotateX(float a, vec3 v)
{
	return vec3(v.x, cos(a) * v.y + sin(a) * v.z,
				cos(a) * v.z - sin(a) * v.y);
}

vec3 rotateY(float a, vec3 v)
{
	return vec3(cos(a) * v.x + sin(a) * v.z,
				v.y, cos(a) * v.z - sin(a) * v.x);
}

float square(vec2 p, vec2 s)
{
	return length(max(vec2(0.0), abs(p) - s)) - 1e-3;
}

float edge(vec2 p, vec2 d)
{
	return dot(p, normalize(d.yx) * vec2(1.0, -1.0));
}

float trapezium(vec2 p, float y0, float y1, vec2 x0, vec2 x1)
{
	float c0 = p.y - y1, c1 = -(p.y - y0);
	float e0 = -edge(p - vec2(x0.x, y0), vec2(x1.x, y1) - vec2(x0.x, y0));
	float e1 = edge(p - vec2(x0.y, y0), vec2(x1.y, y1) - vec2(x0.y, y0));

	c0 = max(0.0, c0);
	c1 = max(0.0, c1);
	e0 = max(0.0, e0);
	e1 = max(0.0, e1);

	return sqrt(c0 * c0 + c1 * c1 + e0 * e0 + e1 * e1);
}

float leg(vec2 p)
{
	float s0 = square(p - vec2(0.86, -0.38), vec2(0.071, 0.44));
	float s1 = square(p - vec2(0.68, -0.72), vec2(0.2, 0.1));
	float e0 = edge(p - vec2(0.68, -0.72), vec2(-1.0, -0.6));
	return  min(s0, max(s1, e0));
}

float bodyParts0(vec2 p)
{
	float p0 = square(p - vec2(0.86, 0.31), vec2(0.07, 0.1));
	float p1 = square(p - vec2(0.67, 0.32), vec2(0.07, 0.03));
	float p2 = trapezium(p, 0.04, 0.09, vec2(0.0, 0.15), vec2(0., 0.2));
	return min(min(p0, p1), p2);
}

float bodyParts1(vec2 p)
{
	float p0 = trapezium(p, 0.35, 0.44, vec2(0.0, 0.2), vec2(0., 0.275));
	float p1 = square(p - vec2(0.2, 0.479), vec2(0.16, 0.02));
	float p2 = square(p - vec2(0.44, 0.14), vec2(0.495, 0.02));
	float p3 = trapezium(p, 0.27, 0.5, vec2(0.4 - 0.24, 0.4 + 0.05), vec2(0.4 - 0.05, 0.4 + 0.24));
	float p4 = square(p - vec2(0.0, 0.22), vec2(0.16, 0.02));
	float p5 = square(p - vec2(0.21, 0.3), vec2(0.17, 0.03));
	float p6 = square(p - vec2(0.8, 0.479), vec2(0.2, 0.02));
	return min(min(min(min(min(min(p0, p1), p2), p3), p4), p5), p6);
}

float bodyCrossSection0(vec2 p)
{
	p.x = abs(p.x);
	return bodyParts1(p);
}

float bodyCrossSection1(vec2 p)
{
	p.x = abs(p.x);
	float p0 = leg(p);
	float p1 = bodyParts0(p);
	return min(p0, p1);
}

float bodyProfile(vec2 p)
{
	p -= vec2(0.2, 0.25);
	return max(edge(p, vec2(0.3, 1.0)), edge(p, vec2(-0.3, 1.0)));
}

float headCrossSection(vec2 p)
{
	p.x = abs(p.x);
	float d0 = square(p - vec2(0.0, 0.77), vec2(0.06, 0.03));
	float d1 = trapezium(p, 0.54, 0.74, vec2(0.0, +0.5), vec2(0.0, +0.05));
	return min(d0, d1);
}

float headProfile(vec2 p)
{
	float d0 = -p.x - 0.1;
	float d1 = edge(p - vec2(0.0, 0.54), vec2(-0.6, 1.0)) - 0.1;
	return length(vec2(max(0.0, d0), max(0.0, d1)));
}

float body(vec3 p)
{
	float d0 = bodyCrossSection0(p.xy);
	float d1 = bodyProfile(p.zy);
	float d2 = abs(p.z) - 0.1;
	float d3 = bodyCrossSection1(p.xy);
	float d4 = -p.z - 0.1;

	return min(length(vec2(max(0.0, d2), max(0.0, d3))),
			   length(vec3(max(0.0, d4), max(0.0, d0), max(0.0, d1)))) - 0.001;
}

float head(vec3 p)
{
	float d0 = headCrossSection(p.xy);
	float d1 = headProfile(p.zy);
	return length(vec2(max(0.0, d0), max(0.0, d1)));
}

float recogniserDist(vec3 p)
{
	p.z -= sin(floor((p.x + 2.0) / 4.0) * 2.0);
	p.x = mod(p.x + 2.0, 4.0) - 2.0;
	return min(body(p), head(p)) - 0.01;
}

vec3 recogniserNorm(vec3 p)
{
	float d = recogniserDist(p);
	return normalize(vec3(recogniserDist(p + EPS.xyy) - d, recogniserDist(p + EPS.yxy) - d,
						  recogniserDist(p + EPS.yyx) - d));
}

float recogniserCurve(vec3 p)
{
	vec3 n0 = recogniserNorm(p);
	vec3 n1 = recogniserNorm(p + EPS.xyy);
	vec3 n2 = recogniserNorm(p + EPS.yxy);
	vec3 n3 = recogniserNorm(p + EPS.yyx);
	return length(n1 - n0) + length(n2 - n0) + length(n3 - n0);
}

float floorTexMask(vec2 p, float s)
{
	p = fract(p);
	return max(step(p.x, s), step(p.y, s));
}

vec3 floorTex(vec2 p)
{
	float m0 = floorTexMask(p, 0.02);
	float m1 = floorTexMask(p * 20.0, 0.04);
	vec2 p1 = p * 0.2 + vec2(time);
	float m2 = floorTexMask(p1, 0.01) * step(0.0, sin(floor(p1.x * 10.0) * 100.0 + floor(p1.y * 10.0) * 70.0));
	//return m0 * vec3(1.0, 0.0, 0.1) * 0.2 + m1 * vec3(1.0, 0.0, 0.1) * 0.1 +
	return m0 * vec3(1.0-fft.x, fft.x, fft.x) * 0.2 + m1 * vec3(1.0, fft.x, fft.x) * 0.1 +
			m2 * m0 * vec3(0.4);
}

float pyramid(float x)
{
	x = fract(x);
	return min(x * 2.0, 2.0 - x * 2.0);
}

float mountains(vec2 p)
{
	float x = p.x / 3.1415926 * 10.0;
	//float h = pyramid(x) * mix(0.0, 0.1, (0.5 + 0.5 * cos(floor(x) * 2.0) * cos(floor(x) * 0.01)));
	float h = pyramid(x) * mix(0.0, 0.1, (0.5 + 0.5 * cos(floor(x) * 2.0) * cos(floor(x) * fft.y)));
	return p.y - h;
}

vec3 backg(vec3 ro, vec3 rd)
{
	float t = (-1.0 - ro.y) / rd.y;
	vec3 rp = ro + rd * t;
	rp.z += time;

	//vec3 sc = mix(0.1, 1.0, rd.y) * vec3(1.0, 0.3, 0.1) * 0.3;
	vec3 sc = mix(0.1, 1.0, rd.y) * vec3(1.0, fft.x, ffts.x) * 0.3;
	vec3 fc = floorTex(rp.xz) * (1.0 - smoothstep(0.0, 10.0, t));

	float m0 = mountains(vec2(atan(rd.z, rd.x), rd.y));
	float m1 = mountains(vec2(atan(rd.z, rd.x) * 2.0, rd.y));

	sc = mix(vec3(0.0), mix(vec3(1.0, 0.32, 0.32) * 0.3, sc, step(0.001, m0)), step(0.0, m0));
	sc = mix(vec3(0.0), mix(vec3(1.0, 0.32, 0.32) * 0.3, sc, step(0.001, m1)), step(0.0, m1));
	sc *= fft.x;
	return mix(sc, fc, step(0.0, t));
}

vec3 xform(vec3 v)
{
	return rotateY(time * 0.3 + (sin(iAmplifiedTime) / iResolution.x - 0.5) * 4.0, rotateX(0.4 + (sin(iAmplifiedTime)/ iResolution.y - 0.5), v));
	//return rotateY(time * 0.3 + (iMouse.x / iResolution.x - 0.5) * 4.0, rotateX(0.4 + (iMouse.y / iResolution.y - 0.5), v));
}

void main()
{
	compressFft();
	time = iAmplifiedTime;
	//vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv;
	vec2 t = uv * 2.0 - vec2(1.0);
	t.x *= iResolution.x / iResolution.y;

	vec3 ro = xform(vec3(0.01, 0.0, 3.0)), rd = xform(normalize(vec3(t.xy, -2.1)));

	gl_FragColor.rgb = backg(ro, rd);

	float f = 0.0;

	for(int i = 0; i < 60; ++i)
	{
		float d = recogniserDist(ro + rd * f);

		if(abs(d) < 1e-4)
			break;

		f += d * 0.8;
	}

	vec3 rp = ro + rd * f;

	float c = smoothstep(0.0, 0.2, recogniserCurve(rp)) / (2.0 + length(rp) + 0.5 * cos(rp.y * -3.0 + time * 10.0));
	vec3 n = recogniserNorm(ro + rd * f);

	//gl_FragColor.rgb = mix(gl_FragColor.rgb, c * vec3(1.0, 0.0, 0.1), step(f, 10.0)) * 2.0;
	gl_FragColor.rgb = mix(gl_FragColor.rgb, c * vec3(1.0, fft.x, ffts.x), step(f, 10.0)) * 2.0;
}
