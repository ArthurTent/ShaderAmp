// https://www.shadertoy.com/view/ttBGRD
// Modified by ArthurTent
// Created by kosua20
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
/*
	ShaderWave - A recreation of a 80's nostalgia-fueled meme image.
	Simon Rodriguez, 2019.
	Feel free to reuse this code for any non-commercial purpose.
*/

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// Helpers from QuantumSuper
#define PI 3.14159265359
#define aTime 128./60.*iAmplifiedTime
vec4 fft, ffts; //compressed frequency amplitudes
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
    //for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //workaround for VirtualDJ, ?any hints for reverting audio limiters appreciated
}

vec3 getCol(float id){ //color definitions, for triplets
    vec3 setCol = vec3(0);
        if (id< 1.) setCol = vec3(244,  0,204); //vw2 pink
    else if (id< 2.) setCol = vec3(  0,250,253); //vw2 light blue
    else if (id< 3.) setCol = vec3( 30, 29,215); //vw2 blue
    else if (id< 4.) setCol = vec3(252,157,  0); //miami orange
    else if (id< 5.) setCol = vec3( 26,246,138); //miami green
    else if (id< 6.) setCol = vec3(131, 58,187); //nordic violet
    else if (id< 7.) setCol = vec3(231, 15, 20); //arena red
    else if (id< 8.) setCol = vec3( 35, 87, 97); //arena dark blue
    else if (id< 9.) setCol = vec3(103,211,225); //arena blue
    else if (id<10.) setCol = vec3(241,204,  9); //bambus2 yellow
    else if (id<11.) setCol = vec3( 22,242,124); //bambus2 green
    else if (id<12.) setCol = vec3( 30,248,236); //magic turquoise
    return setCol/256.;
}
mat2 rotM(float r){float c = cos(r), s = sin(r); return mat2(c,s,-s,c);} //2D rotation matrix

float hash21(vec2 p){p = fract(p*vec2(13.81,741.76)); p += dot(p, p+42.23); return fract(p.x*p.y);} //pseudorandom generator, cf. The Art of Code on youtu.be/rvDo9LvfoVE
float particle(vec2 p){ //single particle shape
    return smoothstep( .1, .0, length(p)) * smoothstep( .1, .06, length(p-vec2(0.,.02)));
}
float particleLayer(vec2 p){ //pseudo-random 2d particle plane
    float id = hash21(floor(p));
    return smoothstep(0.,1.,id) *
        particle((fract(p)-vec2(.5+.4*cos(id*iAmplifiedTime),.5+.4*sin(.8*id*iAmplifiedTime))) * rotM((id-fft.x)*2.*PI)/vec2(cos(.5*id*iAmplifiedTime),1));
}

// Video helpers
/*
#define s(x) smoothstep(0.15, 0.3, x * 1.1 - 0.1)
vec3 chromaKey(vec3 x, vec3 y){
	vec2 c = s(vec2(x.g - x.r * x.y, x.g));

    return mix(x, y, c.x * c.y);
}
vec3 getTexture(vec2 p){
	vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}
*/

/// Noise helpers.

// 1-D noise.
float noise(float p){
	float fl = floor(p);
	float fc = fract(p);
	float rand0 = fract(sin(fl) * 43758.5453123);
	float rand1 = fract(sin(fl+1.0) * 43758.5453123);
	return mix(rand0, rand1, fc);
}

// 4 channels 1-D noise.
vec4 noise(vec4 p){
	vec4 fl = floor(p);
	vec4 fc = fract(p);
	vec4 rand0 = fract(sin(fl) * 43758.5453123);
	vec4 rand1 = fract(sin(fl+1.0) * 43758.5453123);
	return mix(rand0, rand1, fc);
}

// 2D to 1D hash, by Dave Hoskins (https://www.shadertoy.com/view/4djSRW)
float hash(vec2 p){
	vec3 p3  = fract(vec3(p.xyx) * 0.2831);
	p3 += dot(p3, p3.yzx + 19.19);
	return fract((p3.x + p3.y) * p3.z);
}


/// Background utilities.

// Generate starfield.
float stars(vec2 localUV, float starsDens, float starsDist){
	// Cenetr and scale UVs.
	vec2 p = (localUV-0.5) * starsDist;
	float blub =  particleLayer(p*fft.x);
	// Use thresholded high-frequency noise.
	float brigthness = smoothstep(1.0 - starsDens, 1.0, hash(floor(p)))* blub*10.;
	// Apply soft transition between the stars and the background.
	const float startsTh = 0.5 ;
	return smoothstep(startsTh, 0.0, length(fract(p) - 0.5)) * brigthness* blub*10.*ffts.w ;
}

// Distance from point to line segment.
float segmentDistance(vec2 p, vec2 a, vec2 b){
	// Project the point on the segment.
	vec2 dir = b - a;
	float len2 = dot(dir, dir);
	float t = clamp(dot(p-a, dir)/len2,0.0,1.0);
	vec2 proj = a + t * dir;
	// Distance between the point and its projection.
	return distance(p, proj);
}

// Distance from point to triangle edges.
float triangleDistance(vec2 p, vec4 tri, float width){
	// Point at the bottom center, shared by all triangles.
	vec2 point0 = vec2(0.5, 0.37);
	// Distance to each segment.
	float minDist = 	   segmentDistance(p, point0, tri.xy) ;
	minDist = min(minDist, segmentDistance(p, tri.xy, tri.zw));
	minDist = min(minDist, segmentDistance(p, tri.zw, point0));
	// Smooth result for transition.
	return 1.0-smoothstep(0.0, width, minDist);
}

/// Text utilities.

float getLetter(int lid, vec2 uv){
	// If outside, return arbitrarily high distance.
	if(uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0){
		return 1000.0;
	}
	// The font texture is 16x16 glyphs.
	int vlid = lid/16;
	int hlid = lid - 16*vlid;
	vec2 fontUV = (vec2(hlid, vlid) + uv)/16.0;
	// Fetch in a 3x3 neighborhood to box blur
	float accum = 0.0;
	for(int i = -1; i < 2; ++i){
		for(int j = -1; j < 2; ++j){
			vec2 offset = vec2(i,j)/1024.0;
			accum += texture(iChannel0, fontUV+offset, 0.0).a;
		}
	}
	return accum/9.0;
}

vec3 textGradient(float interior, float top, vec2 alphas){
	// Use squared blend for the interior gradients.
	vec2 alphas2 = alphas*alphas;
	// Generate the four possible gradients (interior/edge x upper/lower)
	vec3 bottomInterior = mix(vec3(0.987,0.746,0.993), vec3(0.033,0.011,0.057), alphas2.x);
	vec3 bottomExterior = mix(vec3(0.633,0.145,0.693), vec3(0.977,1.000,1.000),  alphas.x);
	vec3 topInterior 	= mix(vec3(0.024,0.811,0.924), vec3(0.600,0.960,1.080), alphas2.y);
	vec3 topExterior 	= mix(vec3(0.494,0.828,0.977), vec3(0.968,0.987,0.999),  alphas.y);
	// Blend based on current location.
	vec3 gradInterior 	= mix(bottomInterior, topInterior, top);
	vec3 gradExterior 	= mix(bottomExterior, topExterior, top);
	return mix(gradExterior, gradInterior, interior);
}

/// Main render.

void main()
{
	compressFft();
	float colId = 3. * floor(mod(aTime/8.,4.));
	// Normalized pixel coordinates.
	//vec2 uv = fragCoord/iResolution.xy;
	vec2 uv = vUv;
	vec2 uvCenter = 2.0 * uv - 1.0;

	/// Background.
	// Color gradient.
	vec3 finalColor = 1.5*mix(vec3(0.308,0.066,0.327), vec3(0.131,0.204,0.458), uv.x);

	const float gridHeight = 0.3;
	if(uv.y < gridHeight){

		/// Bottom grid.
		// Compute local cflipped oordinates for the grid.
		vec2 localUV = uv*vec2(2.0, -1.0/gridHeight) + vec2(-1.0, 1.0);
		// Perspective division, scaling, foreshortening and alignment.
        localUV.x = localUV.x/(localUV.y+0.8);
		localUV *= vec2(10.0, 20.0);
		localUV.y = sqrt(localUV.y);
		localUV.x += 0.5;
		// Generate grid smooth lines (translate along time).
		vec2 unitUV = fract(localUV-vec2(0.0, 0.3*iAmplifiedTime));
		vec2 gridAxes = smoothstep(0.02, 0.07, unitUV) * (1.0 - smoothstep(0.93, 0.98, unitUV));
		float gridAlpha = 1.0-clamp(gridAxes.x*gridAxes.y, 0.0, 1.0);

		/// Fixed star halos.
		// Loop UVs.
		vec2 cyclicUV = mod(localUV-vec2(0.0, 0.3*iAmplifiedTime), vec2(9.0, 5.0));
		// Distance to some fixed grid vertices.
		const float haloTh = 0.6;
		float isBright1 = 1.0-min(distance(cyclicUV, vec2(6.0,3.0)), haloTh)/haloTh;
		float isBright2 = 1.0-min(distance(cyclicUV, vec2(1.0,2.0)), haloTh)/haloTh;
		float isBright3 = 1.0-min(distance(cyclicUV, vec2(3.0,4.0)), haloTh)/haloTh;
		float isBright4 = 1.0-min(distance(cyclicUV, vec2(2.0,1.0)), haloTh)/haloTh;
		// Halos brightness.
		float spotLight = isBright1+isBright2+isBright3+isBright4;
		spotLight *= spotLight;
		// Composite grid lines and halos.
		finalColor += 0.15*gridAlpha*(1.0+5.0*spotLight);

	} else {
		/// Starfield.
		// Compensate aspect ratio for circular stars.
		vec2 ratioUVs = uv*vec2(1.0, iResolution.y / iResolution.x);
		// Decrease density towards the bottom of the screen.
		float baseDens = clamp(uv.y-0.3, 0.0, 1.0);
		// Three layers of stars with varying density, cyclic animation.
        float deltaDens = 20.0*(sin(0.05*iAmplifiedTime-1.5)+1.0);
		finalColor += 0.50*stars(ratioUVs, fft.x*0.10*baseDens, 150.0-deltaDens);
		finalColor += 0.75*stars(ratioUVs, 0.05*baseDens,  80.0-deltaDens);
		finalColor += 1.00*stars(ratioUVs, 0.01*baseDens,  30.0-deltaDens);
		finalColor = mat3(getCol(colId),getCol(colId+1.),getCol(colId+2.)) * finalColor;
	}

	/// Triangles.
	// Triangles upper points.
	vec4 points1 = vec4(0.30,0.85,0.70,0.85);
	vec4 points2 = vec4(0.33,0.83,0.73,0.88);
	vec4 points3 = vec4(0.35,0.80,0.66,0.82);
	vec4 points4 = vec4(0.38,0.91,0.66,0.87);
	vec4 points5 = vec4(0.31,0.89,0.72,0.83);
	// Randomly perturb based on time.
	points2 += 0.04*noise(10.0*points2+0.4*iAmplifiedTime);
	points3 += 0.04*noise(10.0*points3+0.4*iAmplifiedTime);
	points4 += 0.04*noise(10.0*points4+0.4*iAmplifiedTime);
	points5 += 0.04*noise(10.0*points5+0.4*iAmplifiedTime);
	// Intensity of the triangle edges.
	float tri1 = triangleDistance(uv, points1, 0.010);
	float tri2 = triangleDistance(uv, points2, 0.005);
	float tri3 = triangleDistance(uv, points3, 0.030);
	float tri4 = triangleDistance(uv, points4, 0.005);
	float tri5 = triangleDistance(uv, points5, 0.003);
	float intensityTri = 0.9*tri1+0.5*tri2+0.2*tri3+0.6*tri4+0.5*tri5;
	// Triangles color gradient, from left to right.
	float alphaTriangles = clamp((uv.x-0.3)/0.4, 0.0, 1.0);
	vec3 baseTriColor = mix(vec3(0.957,0.440,0.883), vec3(0.473,0.548,0.919), alphaTriangles);
	// Additive blending.
	finalColor += intensityTri*baseTriColor;

	/// Horizon gradient.
	const float horizonHeight = 0.025;
	float horizonIntensity = 1.0-min(abs(uv.y - gridHeight), horizonHeight)/horizonHeight;
	// Modulate base on distance to screen edges.
	horizonIntensity *= (1.0 - 0.7*abs(uvCenter.x)+0.5);
	finalColor += 2.0*horizonIntensity*baseTriColor;

	/// Letters.
	// Centered UVs for text box.
	vec2 textUV = uvCenter*2.2-vec2(0.0, 0.5);
	if(abs(textUV.x) < 1.0 && abs(textUV.y) < 1.0){
		// Rescale UVs.
		textUV = textUV*0.5+0.5;
		//textUV.x *= 3.5;
        textUV.x *= 4.5;
		// Per-sign UV, manual shifts for kerning.
		const vec2 letterScaling = vec2(1.47,0.93);
		vec2 uvLetter1 = (textUV - vec2(0.60,0.50)) * letterScaling + 0.5;
		vec2 uvLetter2 = (textUV - vec2(1.50,0.50)) * letterScaling + 0.5;
		vec2 uvLetter3 = (textUV - vec2(2.15,0.50)) * letterScaling * 1.2 + 0.5;
		vec2 uvLetter4 = (textUV - vec2(2.70,0.50)) * letterScaling + 0.5;
        vec2 uvLetter5 = (textUV - vec2(3.35,0.50)) * letterScaling + 0.5;
        vec2 uvLetter6 = (textUV - vec2(4.0,0.50)) * letterScaling + 0.5;

		// Get letters distance to edge, merge.

        float let1 = getLetter(179, uvLetter1);
		float let2 = getLetter(221, uvLetter2);
		float let3 = getLetter(178, uvLetter3);
		float let4 = getLetter(177, uvLetter4);
        float let5 = getLetter(163,uvLetter5);
        float let6 = getLetter(181,uvLetter6);

		// Merge and threshold.
        float finalDist = 0.52 - min(let1, min(let2, min(let3, min(let4, min(let5,let6)))));

		// Split between top and bottom gradients (landscape in the reflection).
		float localTh = 0.49+0.03*noise(70.0*uv.x+iAmplifiedTime);
		float isTop = smoothstep(localTh-0.01, localTh+0.01, textUV.y);
		// Split between interior and edge gradients.
		float isInt = smoothstep(0.018, 0.022, finalDist*fft.x*fft.y );
		// Compute relative heights along the color gradients (both bottom and up (shifted)), rescale.
		vec2 localUBYs = vec2(1.8*(textUV.y-0.5)+0.5);
		localUBYs.y -= isTop*0.5;
		vec2 gradientBlend = localUBYs / localTh;
		// Evaluate final mixed color gradient.
		vec3 textColor = textGradient(isInt, isTop, gradientBlend);
		// Add sharp reflection along a flat diagonal.
		if(textUV.x-20.0*textUV.y < -14.0 || textUV.x-20.0*textUV.y > -2.5){
			textColor += 0.1; // Add audio code here
			textColor +=fft.x;
		}
		// Soft letter edges.
		float finalDistSmooth = smoothstep(-0.0025, 0.0025,finalDist);
		finalColor = mix(finalColor, textColor, finalDistSmooth);
	}

	/// Vignetting.
	const float radiusMin = 0.8;
	const float radiusMax = 1.8;
	float vignetteIntensity = (length(uvCenter)-radiusMin)/(radiusMax-radiusMin);
	finalColor *= clamp(1.0-vignetteIntensity, 0.0, 1.0);

	/// Exposure tweak, output.
	gl_FragColor = vec4(pow(finalColor, vec3(1.2)),1.0);
	vec3 resultColorWithBorder = mix(vec3(0.),vec3(gl_FragColor.x, gl_FragColor.y, gl_FragColor.z),pow(max(0.,1.5-length(uvCenter*uvCenter*uvCenter*vec2(2.0,2.0))),.3));
    gl_FragColor = vec4(resultColorWithBorder, 1.0);
}