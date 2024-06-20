// Murakami Galaxy by Philippe Desgranges
// Email: Philippe.desgranges@gmail.com
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//
//
// To follow up on my current obsession with Takashi Murakami (see: Infinite Murakami)
// I wanted to give a tribute to his spherical flower patterns (put exemple here)
// but instead of single compositions give it a infinite galaxy scale with a central flower/sun.
// This idea ended up being quite challenging in many aspects and I learned a lot in the process of
// bringing it to a reality, especially :
//
// Sphere parametrization : The first thing I did was to modify the fower pattern I did for Infinite
// Murakami to map it onto a sphere. Of course, some pretty bad distortion around the poles due to
// spherical texture mapping so I had to find a way to compensate for that by reparametrizing polar
// coordinates. I wrapped my head around the problem for a couple of days (no pun intended) and ended
// up finding a tiling scheme consising of mappin the sphere with meridian bands with variying number
// of flowers to compensate for the horizontal stretch and some taper compensation.
//
// Fast Ray casting : The approach I first used was a classic SDF ray casting. My SDF was evaluating
// 27 (3*3*3) adjacent cells (containing zero or one planet each). Empty space had to be traversed with
// a lot of caution and it was full of hooks and crannies so it ended up being super slow, especially on
// my laptop (6fps tops). I realized that because my geometry was qhite simple (a bunch of sphere in a grid)
// I could just traverse the grid using a bresenham-like traching and just evaluate ray/sphere intersection
// analytically along the way in crossed cells. It gave me 10X speedup which brough me an immense satisfaction.
//
// Anti-aliasing was also a challenge and, although the preview looks decent it is much better looking
// in fullscreen.
//
// I think I'll move on from the Murakami theme for my next entries. I'm done for now :D
//

//#define MSAA // WANING: on some architecture this leads to long compile times

uniform float iAmplifiedTime;
uniform float iTime;
uniform vec2 iFrame;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

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

	//for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //limiter? workaround attempt for VirtualDJ
}
vec3 getCol(float id){ //v0.92, color definitions, for triplets
    vec3 setCol = vec3(0);
    id = mod(id,18.);
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
    else if (id<13.) setCol = vec3(123, 23,250); //cneon pink
    else if (id<14.) setCol = vec3( 23,123,250); //cneon blue
    else if (id<15.) setCol = vec3( 73, 73,250); //cneon white
	else if (id<16.) setCol = vec3(173,  0, 27); //matrix red
    else if (id<17.) setCol = vec3( 28,142, 77); //matrix green
    else if (id<18.) setCol = vec3( 66,120, 91); //matrix green 2
    return setCol/256.;
}
//#define MSAA // WANING: on some architecture this leads to long compile times

#define MAX_DST 50.0
#define sat(a) clamp(a,0.0,1.0)

const float pi = 3.1415926;
const float halfPi = pi * 0.5;
const float pi2 = pi * 2.0;

const float quadrant = pi / 6.0;

const float blackLevel = 0.3; // True black is too aggressive
mat4 rotationX( in float angle ) {

    float c = cos(angle);
    float s = sin(angle);

	return mat4(1.0, 0,	 0,	0,
			 	0, 	 c,	-s,	0,
				0, 	 s,	 c,	0,
				0, 	 0,  0,	1);
}

mat4 rotationY( in float angle ) {

    float c = cos(angle);
    float s = sin(angle);

	return mat4( c, 0,	 s,	0,
			 	 0,	1.0, 0,	0,
				-s,	0,	 c,	0,
				 0, 0,	 0,	1);
}

mat4 rotationZ( in float angle ) {
    float c = cos(angle);
    float s = sin(angle);

	return mat4(c, -s,	0,	0,
			 	s,	c,	0,	0,
				0,	0,	1,	0,
				0,	0,	0,	1);
}

#define S(a,b,t) smoothstep(a,b,t)

// Some hash function 2->1
float N2(vec2 p)
{	// Dave Hoskins - https://www.shadertoy.com/view/4djSRW
    p = mod(p, vec2(500.0));
	vec3 p3  = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// A 2d Noise used for the sun rays
float Noise(vec2 uv)
{
    vec2 corner = floor(uv);
	float c00 = N2(corner + vec2(0.0, 0.0));
	float c01 = N2(corner + vec2(0.0, 1.0));
	float c11 = N2(corner + vec2(1.0, 1.0));
	float c10 = N2(corner + vec2(1.0, 0.0));

    vec2 diff = fract(uv);

    diff = diff * diff * (vec2(3) - vec2(2) * diff);

    return mix(mix(c00, c10, diff.x), mix(c01, c11, diff.x), diff.y);
}

// An ellipse signed distance function by iq
// https://iquilezles.org/articles/ellipsedist
float sdEllipse( in vec2 z, in vec2 ab )
{
    vec2 p = vec2(abs(z));

    if( p.x > p.y ){ p=p.yx; ab=ab.yx; }

    float l = ab.y*ab.y - ab.x*ab.x;
    float m = ab.x*p.x/l; float m2 = m*m;
    float n = ab.y*p.y/l; float n2 = n*n;
    float c = (m2 + n2 - 1.0)/3.0; float c3 = c*c*c;
    float q = c3 + m2*n2*2.0;
    float d = c3 + m2*n2;
    float g = m + m*n2;


    float co;

    if( d<0.0 )
    {
        float p = acos(q/c3)/3.0;
        float s = cos(p);
        float t = sin(p)*sqrt(3.0);
        float rx = sqrt( -c*(s + t + 2.0) + m2 );
        float ry = sqrt( -c*(s - t + 2.0) + m2 );
        co = ( ry + sign(l)*rx + abs(g)/(rx*ry) - m)/2.0;
    }
    else
    {
        float h = 2.0*m*n*sqrt( d );
        float s = sign(q+h)*pow( abs(q+h), 1.0/3.0 );
        float u = sign(q-h)*pow( abs(q-h), 1.0/3.0 );
        float rx = -s - u - c*4.0 + 2.0*m2;
        float ry = (s - u)*sqrt(3.0);
        float rm = sqrt( rx*rx + ry*ry );
        float p = ry/sqrt(rm-rx);
        co = (p + 2.0*g/rm - m)/2.0;
    }

    float si = sqrt( 1.0 - co*co );

    vec2 closestPoint = vec2( ab.x*co, ab.y*si );

    return length(closestPoint - p ) * sign(p.y-closestPoint.y);
}


// rotates pos to align the up vector towards up
vec2 rotUp(vec2 pos, vec2 up)
{
    vec2 left = vec2(-up.y, up.x);
    return left * pos.x + up * pos.y;
}

// The mouth is the intersection of two ellipses, I traced them in photoshop to
// compute the right radii and offsets
float mouthDst(vec2 uv)
{
    return max(sdEllipse(uv - vec2(0.0, -0.17), vec2(0.30, 0.2055)),
               sdEllipse(uv - vec2(0.0,  0.07), vec2(0.14, 0.2055)));
}

// For the eye, I use simpler circle distance maths in a scales and rotated space
// as I don't need an accurate distance function to create an outline
vec4 eye(vec2 uv, vec2 up, vec2 spot1, vec2 spot2, float aa)
{
    uv = rotUp(uv, up);
    uv.x *= 1.5;

    float len = length(uv);
    float len2 = length(uv + spot1);// vec2(0.010, 0.025));
    float len3 = length(uv + spot2);// vec2(-0.005, -0.017));

    vec4 eye;

    eye.a = S(0.04 + aa, 0.04 - aa, len);

    eye.rgb = vec3(S(0.014 + aa, 0.014 - aa, len2) + S(0.02 + aa, 0.02 - aa, len3) + blackLevel);

    return eye;
}

const float cRatio = 1.0 / 255.0;

// I wanted the color palette to be true to the 16 hue rainbow used
// by Murakami but I didn't manage to reproduce the orange-yellow-green part
// using simple maths so I defaulted to a palette. Then I realized I couldn't target
// Webgl < 3.0 (Wich was one of my objectives) with array constructor so I decided
// to build a function selecting the right color with a dichotomic approch in hope
// that the compiler will make a decent job of optimizing all those branches.
vec3 palette(float id)
{
	if (id < 6.0)
    {
        //[0 - 5]
        if (id < 3.0)
        {   //[0 - 2]
            if (id < 1.0) return vec3(181.0, 23.0, 118.0) * cRatio;
            else if (id < 2.0) return vec3(225.0, 27.0, 104.0) * cRatio;
            else return vec3(230.0, 40.0, 24.0) * cRatio;
        }
        else
        {   //[3 - 5]
            if (id < 4.0) return vec3(240.0, 110.0, 14.0) * cRatio;
            else if (id < 5.0) return vec3(253.0, 195.0, 2.0) * cRatio;
            else return vec3(253.0, 241.0, 121.0) * cRatio;
        }
    }
    else
    {   //[6 - 11]
        if (id < 9.0)
        {   //[6 - 8]
            if (id < 7.0) return vec3(167.0, 202.0, 56.0) * cRatio;
            else if (id < 8.0) return  vec3(0.0, 152.0, 69.0) * cRatio;
            else return vec3(2.0, 170.0, 179.0) * cRatio;
        }
        else
        {   //[9 - 11] The darker color are at the end to be avoided by mod
            if (id < 10.0) return vec3(25.0, 186.0, 240.0) * cRatio;
            else if (id < 11.0) return  vec3(0.0, 98.0, 171.0) * cRatio;
            else return vec3(40.0, 49.0, 118.0) * cRatio;
        }
    }
}


// Adapted from BigWIngs
vec4 N24(vec2 t) {
    float n = mod(t.x * 458.0 + t.y * 127.3, 100.0);
	return fract(sin(n*vec4(123., 1024., 1456., 264.))*vec4(6547., 345., 8799., 1564.));
}

// Drawing a Murakami flower from a random seed (how poetic)
vec4 flower(vec2 uv, vec4 rnd, float scale, float aaScale, float petalAngle, out vec3 col, float eyesAA)
{

    float rdScale = 1.0;

    scale *= rdScale; // The border thickness & AA is scale-independant

    uv.xy *= rdScale;

    float aa2 = aaScale * 5.0 / iResolution.x; // increase AA over disatnce and facing ratio

    float centerDst = length(uv);

    float edge; // Mask for the outline edge

    vec4 color = vec4(1.0, 1.0, 1.0, 1.0); // Underlying color


    float thick = 0.002 * scale;

    float col1Id = mod((rnd.x + rnd.y) * 345.456, 10.0);
    col = palette(col1Id); // return the 'main' color of the petals
    col *= ffts.w; // apply the 'presence' frequency to the color

    if (centerDst < 0.2)
    {
        //Face part

        float thres = 0.2 - thick;

        // inner part of edge circle surrounding the head
        edge =  S(thres + aa2, thres - aa2, centerDst);

        float mouth = mouthDst(uv);

        // edge of the mouth
        edge *= S(thick - aa2, thick + aa2, abs(mouth));

        // face color
        float faceRnd = fract(rnd.x * 45.0 + rnd.y * 23.45);
        if (faceRnd < 0.5)
        {
            // Flowers with classic yellow / red faces
        	color.rgb = (mouth < 0.0) ? vec3(1.0, 0.0, 0.0) : vec3(1.0, 1.0, 0.0);
        }
        else
        {
            // Flowers with white face / random color mouth
            float colId = mod(faceRnd * 545.456, 11.0);
            color.rgb = (mouth < 0.0) ? palette(colId) : vec3(1.0);
        }

        // Eyes
        vec4 eyeImg;
        if (uv.x > 0.0)
        {
           eyeImg = eye(uv - vec2(0.075, 0.095), vec2(-0.7, 1.2),
                       vec2(0.007, 0.025), vec2(-0.004, -0.019), aa2 * eyesAA);
        }
        else
        {
           eyeImg = eye(uv - vec2(-0.075, 0.095), vec2(0.7, 1.2),
                       vec2(0.024, 0.010), vec2(-0.016, -0.009), aa2 * eyesAA);
        }

        color.rgb = mix(color.rgb, eyeImg.rgb, eyeImg.a);

    }
    else
    {
        float rot = petalAngle;
        float angle = fract((atan(uv.x, uv.y) + rot) / pi2);

        float section = angle * 12.0;
        float sectionId = floor(section);

        if (rnd.z < 0.1 && rnd.w < 0.1)
        {
           // Rainbow flower
           color.rgb = palette(sectionId);//mod(sectionId + (rnd.x + rnd.y) * 345.456, 12.0));
        }
        else if (rnd.y > 0.05)
        {

            //Alternating flower
            if (mod(sectionId, 2.0) == 0.0)
            {
                // Color 1
                color.rgb = col;
            }
            else if (rnd.x > 0.75)
            {
                // Color 2
                float colId = mod((rnd.w + rnd.z) * 545.456, 11.0);
                color.rgb = palette(colId);
            }
            // else, Color2 is white by default
        }
		// else, fully white petals

        if (centerDst < 0.36)
        {
            //intermediate part, concentric bars

            float sectionX = fract(section);
            float edgeDist = 0.5 - abs(sectionX - 0.5);

            edgeDist *= centerDst; // Untaper bar space so bars have constant thickness

            float aa = aaScale * 10.0 / iResolution.x;
            float bar = thick * 1.7;
            edge = S(bar - aa, bar + aa, edgeDist);

            // outer part of edge circle surrounding the head
            float thres = 0.2 + thick;
            float head = S(thres - aa2, thres + aa2, centerDst);
            edge *= head;
        }
        else
        {
            // Petal tips are actually ellipses, they could have been approximated them with
            // circles but I didn't because I have OCD and I needed the ellipse SDF
            // for the mouth anyways ;)

            // Angle to the center of the quadrant
            float quadAngle = (sectionId + 0.5) * quadrant - rot + pi;

            // Center of the ellipse
            vec2 petalUp = vec2(-sin(quadAngle), -cos(quadAngle));
            vec2 petalCenter = petalUp * 0.36;

            // Rotation of the ellipse basis
            vec2 petalSpace = rotUp(uv - petalCenter, petalUp);

            // Signed distance function of the ellipse
            float petalDst = sdEllipse(petalSpace, vec2(0.0944, 0.09));

            //border edge and alpha mask
            float borderIn = S(thick + aa2, thick - aa2, petalDst);
            float borderOut = S(-thick + aa2, -thick - aa2, petalDst);

            edge = (borderOut);

            color.a = borderIn;
        }
    }

    color.rgb = mix(vec3(blackLevel), color.rgb,edge);

    return color;
}

struct planet
{
    vec3 center;
    float radius;
};

// randomizes planet position & radius for a sector
void GetPlanet(vec3 sector, out planet res)
{
   	vec4 rnd = N24(vec2(sector.x + sector.z * 1.35, sector.y));
    float rad = mix(0.0, 0.4, rnd.x * rnd.w);
    res.radius = rad;
    res.center = vec3(rad) + rnd.yzw * vec3(1.0 - 2.0 * rad); // the smaller the planet is, the more off center it can get without crossing border
}


float remap(float val, float min, float max)
{
    return sat((val - min) / (max - min));
}

// breaks down a band of UV coordinates on a sphere to a repetition of square-ish cells with minimal distortion
vec2 ringUv(vec2 latLon, float angle, float centerLat)
{
    // latlon : latitude / longitude
    // angle: horizontal angle covered by one rep of the pattern over the equator / angular height of the band
    // centerLat : center latitude of the band


    // Compute y coords by remapping latitude
    float halfAngle = angle * 0.5;
    float y = remap(latLon.y, centerLat - halfAngle,  centerLat + halfAngle);

    float centerRatio = cos(centerLat); // stretch of the horizontal arc of the pattern at the center of the
   										// band relative to the equator

    float centerAngle = angle / centerRatio; // local longitudianl angle to compensate for stretching at the center of the band.

    float nbSpots = floor(pi2 / centerAngle); // with new angle, how many pattern can we fit in the band?
    float spotWidth = pi2 / nbSpots;          // and what angle would they cover (including spacing padding)?

    float cellX = fract(latLon.x / spotWidth); // what would be the u in the current cell then?


    float x = (0.5 - cellX) * (spotWidth / centerAngle); // compensate for taper
    x *= (cos(latLon.y) / centerRatio) * 0.5 + 0.5;

    vec2 uvs = vec2(x + 0.5, y);
    return uvs;
}


// Computes the texture of the planet
vec3 sphereColor(vec3 worldPos, float nDotV, float dist, float worldAngle)
{
    // which planet are we talnikg about already?
    // This is done way to much for final rendering, could be optimized out
    planet p;
	vec3 sector = floor(worldPos);
    GetPlanet(sector, p);

    // Scale AA accourding to disatnce and facing ratio
   	float aaScale = 4.0 - nDotV * 3.8 + min(4.0, dist * dist * 0.025);

    // Find local position on the sphere
    vec3 localPos = worldPos - (sector + p.center);

    // Random seed that will be used for the two flower layers
    vec4 rnd = N24(vec2(sector.x, sector.y + sector.z * 23.4));
    vec4 rnd2 = N24(rnd.xy * 5.0);

    // compensate for the world Z rotation so planets stay upright
    localPos = (rotationZ(-worldAngle) * vec4(localPos, 0.0)).xyz;
    // Planet rotation at random speed
    localPos = (rotationY(iAmplifiedTime * (rnd.w - 0.5)) * vec4(localPos, 0.0)).xyz;


    // Compute polar coordinates on the sphere
    float lon = (atan(localPos.z, localPos.x)) + pi;  // 0.0 - 2 * pi
    float lat  = (atan(length(localPos.xz), localPos.y)) - halfPi; //-halfPi <-> halfPi

    // Compute the number of flowers at the equator according to the size of the planet
    float numAtEquator = floor(3.0 + p.radius * 15.0);
    float angle = pi2 / numAtEquator; // an the angle they cover ath the equator

    vec3 col1;
    vec3 col2;

    float petalAngle = rnd.w * 45.35 + iAmplifiedTime * 0.1;

    // Compute on layer of flower by dividing the sphere in horizontal bands of 'angle' height
    float eq = (floor(lat / angle + 0.5)) * angle;
    vec2 uvs = ringUv(vec2(lon + eq * rnd.y * 45.0, lat), angle, eq);
    vec4 flPattern1 = flower((vec2(0.5) - uvs) * 0.95, rnd, 2.0, aaScale, petalAngle, col1, 0.8);


    // Compute a second layer of flowers with bands offset by half angle
    float eq2 = (floor(lat / angle) + 0.5) * angle;
    vec2 uvs2 = ringUv(vec2(lon + eq2 * rnd.x * 33.0, lat), angle, eq2);
    vec4 flPattern2 = flower((vec2(0.5) - uvs2) * 0.95, rnd2, 2.0, aaScale, petalAngle, col2, 0.8);


    // Compute flower with planar mapping on xz to cover the poles.
    vec4 flPattern3 = flower(localPos.xz / p.radius, rnd2, 2.0, aaScale, petalAngle, col2, 0.8);

    float bg = (1.0 - nDotV);
    vec3 bgCol = rnd2.y > 0.5 ? col1 : col2; // sphere background is the color of one of the layers

    vec3 col = bgCol;
    // mix the 3 layers of flowers together
    //col = mix(col, flPattern1.rgb*fft.x, flPattern1.a);
    //col = mix(col, flPattern2.rgb*fft.w, flPattern2.a);
    //col = mix(col, flPattern3.rgb*fft.z, flPattern3.a);
    // Remap colors
    float colId = 3. * floor(mod(iAmplifiedTime/8.,4.));
    col = mat3(getCol(colId),getCol(colId+1.),getCol(colId+2.)) * col;

    col = mix(col, flPattern1.rgb, flPattern1.a*fft.x);
    col = mix(col, flPattern2.rgb, flPattern2.a*fft.w);
    col = mix(col, flPattern3.rgb, flPattern3.a*fft.z);

    // add some bogus colored shading

    //Front lighting
    //col *= mix(vec3(1.0), bgCol * 0.3, (bg * bg) * 0.8);

    return col;
}


// Analytical nomral compoutation
// Much faster and acuurate than SDF in my situation
vec3 calcNormal( vec3 pos )
{
    // computes planet in sector
    planet p;
    vec3 sector = floor(pos);
    GetPlanet(sector, p);

    // return vector
    return normalize(pos - (sector + p.center));
}


// Lifted from Rye Terrell at https://gist.github.com/wwwtyro/beecc31d65d1004f5a9d
// modified to compute coverage
float raySphereIntersect(vec3 r0, vec3 rd, vec3 s0, float sr, out float coverage) {
    // - r0: ray origin
    // - rd: normalized ray direction
    // - s0: sphere center
    // - sr: sphere radius
    // - Returns distance from r0 to first intersecion with sphere,
    //   or MAX_DST if no intersection.
    float a = dot(rd, rd);
    vec3 s0_r0 = r0 - s0;
    float b = 2.0 * dot(rd, s0_r0);
    float c = dot(s0_r0, s0_r0) - (sr * sr);

    float inside = b*b - 4.0*a*c;

    if (inside < 0.0) {
        return MAX_DST;
    }

    float dst = (-b - sqrt((b*b) - 4.0*a*c))/(2.0*a);

    // This is a fallof around the edge used for AO
    // chnage the magic value for a smoother border
    coverage = S(inside, 0.0, 0.65 * sr * dst / iResolution.x);

    return dst;
}

// Computes the RGBA of a planet according to intersection result
vec4 RenderPlanet(vec3 pos, float d, vec3 rayDir, float worldAngle, float coverage)
{
	vec3 n = calcNormal(pos);

    float nDotV = abs(dot(n, rayDir));

    float fog = sat((MAX_DST - d) * 0.1);


    // compute some rim lighting to kind of blend everything together
    vec3 burn  = sat(mix(vec3(2.0, 2.0, 1.5), vec3(1.0, 0.4, 0.2), sat((MAX_DST - d) * 0.05) + nDotV) * 0.5);

    // Compute the flowery 'texture' on the planet
    vec3 flowers = sphereColor(pos, nDotV, d, worldAngle);


    // bogus lighting from the sun
    vec3 lightPos = pos + vec3(-15.0, -20.0, 60.0);
    float nDotL = sat(dot(n, normalize(lightPos - pos)) * 0.5 + 0.5);
    flowers *= nDotL * 0.8 + 0.5;

    // fades the planets at the horizon
    vec4 col;
    col.rgb = flowers + burn;


    col.a = fog * coverage;

    // Uncomment to debug coverage AA
    //col.rgb = mix(vec3(0,1,0), col.rgb, coverage);
    //col.a = fog;

    return col;
}

// Blends two colors front to back
vec4 BlendFTB(vec4 frontPremul, vec4 backRGBA)
{
    vec4 res;

    res.rgb = backRGBA.rgb * (backRGBA.a * (1.0 - frontPremul.a)) + frontPremul.rgb;
    res.a = 1.0 - ((1.0 - backRGBA.a) * (1.0 - frontPremul.a));

    return res;
}

// Finds the intersection of a ray with a planet in a given sector
// The coverage is an small alpha falllof at the edge for AA
// thanks iq for the recommendation
float castPlanet(vec3 cell, vec3 pos, vec3 dir, out float coverage)
{
	vec2 pp = cell.xy + cell.xy;
    if (dot(pp.xy, pp.xy) < 1.5) return MAX_DST; // we leave a 'tunnel' empty along the z axis

 	planet p;

    GetPlanet(cell, p);
    if (p.radius < 0.06) return MAX_DST; // cull planets that are too small

    // ray sphere intersection from the start position

    return raySphereIntersect(pos, dir,  cell + p.center, p.radius, coverage);
}

// Traverses the cells grid in a bresenham fashion and test ray/sphere intersection along the way
// This appoach ended up being much faster than SDF for that 'simple' yet dense geometry
//
// Edit: now, this function also performs the accumulation of planet colors according to coverage
// The colors are coputed with the RenderPlanet function, the ray is stopped when full opacity is
// reached
vec4 castRay(vec3 pos, vec3 dir, float maxDst, float worldAngle)
{
    // we assume we are traversing space facing Z

    vec3 dirZ = dir / dir.z; // direction vector that adavance a full cell along Z

    vec3 cell = floor(pos); // starting cell

    vec3 start = pos; // saves the start of the ray
    pos -= fract(pos.z) * dirZ; // pulls back pos on the closes cell boundary behind


    float d = 0.0;
    float dst;

    vec2 layers[20];
    int num = 0;

    float coverage;
    float opacity = 1.0;

    while (d < MAX_DST)
    {
		// Check current cell
        dst = castPlanet(cell, start, dir, coverage);
        if (dst < MAX_DST)
        {
            // Blends the hit planet behind the previous ones according to coverage
            //ColorFTB = BlendFTB(ColorFTB, RenderPlanet(start + dst * dir, dst, dir, worldAngle, coverage));
            layers[num++] = vec2(dst, coverage);
            opacity *= (1.0 - coverage);
            if (opacity < 0.01) break;
        }

        // Advances a step
        pos += dirZ;

        //Compute next cell on y
        vec3 newCell = floor(pos);

        bool a = false;
        bool b = false;
        float cornerDst = MAX_DST;


        if (cell.x != newCell.x) // have we crossed a cell diagonally on X ?
        {
            vec3 stepCell = vec3(newCell.x, cell.yz);

            dst = castPlanet(stepCell, start, dir, coverage);
        	if (dst < cornerDst) cornerDst = dst;
            a == true;
        }

        if (cell.y != newCell.y)  // have we crossed a cell diagonally on Y ?
        {
            vec3 stepCell = vec3(cell.x, newCell.y, cell.z);

            dst = castPlanet(stepCell, start, dir, coverage);
        	if (dst < cornerDst) cornerDst = dst;
            b == true;
        }

        if (a && b)  // have we crossed a cell diagonally on both X & Y?
        {
            vec3 stepCell = vec3(cell.xy, cell.z);

            dst = castPlanet(stepCell, start, dir, coverage);
        	if (dst < cornerDst) cornerDst = dst;
        }

        if (cornerDst < MAX_DST) // We have hit a planet in a corner intersection
        {
            // Blends the hit planet behind the previous ones according to coverage
            //ColorFTB = BlendFTB(ColorFTB, RenderPlanet(start + cornerDst * dir, cornerDst, dir, worldAngle, coverage));
            //if (ColorFTB.a > 0.99) return ColorFTB;

            layers[num++] = vec2(cornerDst, coverage);
            opacity *= (1.0 - coverage);
            if (opacity < 0.01) break;
        }


       	// rinse / repeat
        cell = newCell;
        d += 1.0;
    }


    vec4 ColorFTB = vec4(0.0);

    for (int i = 0; i < num; i++)
    {
        vec2 layer = layers[i];
        ColorFTB = BlendFTB(ColorFTB, RenderPlanet(start + layer.x * dir, layer.x, dir, worldAngle, layer.y));
    }

    return ColorFTB;
}


vec3 render(vec3 camPos, vec3 rayDir, vec2 uv)
{
    vec3 col;

    // rotates the galaxy around the Z axis,
    // this rotation will be compensated for when computing planet color so they stay upright
    float worldAngle = iAmplifiedTime * 0.1;
    rayDir = normalize((rotationZ(worldAngle) * vec4(rayDir, 0.0)).xyz);

    float coverage;

    // cast a ray in the planet field
    vec4 planetCol = castRay(camPos, rayDir, MAX_DST, worldAngle);


    // Compute the central rainbow flower and solar god rays by samplin a 2D noise in polar coordinates
	vec3 dummyCol;
    vec4 fl = flower(uv * 1.5, vec4(0.0, 0.0, 0.0, 0.0), 2.0, 0.5, iAmplifiedTime * 0.1, dummyCol, 2.0);
   	col = fl.rgb;

    float a = atan(uv.x, uv.y);
    float cdist = length(uv);
    vec2 raysUvs = vec2(a * 20.0 + iAmplifiedTime * 0.5, cdist * 5.0 - iAmplifiedTime + a * 3.0);
    //vec3 rays = mix(vec3(2.0, 2.0, 1.5), vec3(1.0, 0.4, 0.2), cdist + Noise(raysUvs) * 0.3);
    //vec3 rays = mix(vec3(2.0, 2.0, 1.5*fft.w), vec3(1.0, 0.4, 0.2), cdist + Noise(raysUvs) * fft.x);
    //vec3 rays = mix(vec3(2.0, 2.0, 1.5*ffts.w), vec3(1.0, 0.4, 0.2), cdist + Noise(raysUvs) * fft.x);
    //vec3 rays = mix(vec3(2.0, 2.0, 1.5*ffts.w), vec3(1.0, 0.4, 0.2), cdist + Noise(raysUvs) * (fft.z + fft.x)/2.);
    vec3 rays = mix(vec3(2.0, 2.0, 1.5*ffts.w), vec3(1.0, 0.4, 0.2), cdist + Noise(raysUvs) * ffts.w);

    col = mix(rays, col, fl.a);

    col = col * (1.0 - planetCol.a*ffts.w) + planetCol.rgb;
    //col = col * (1.0 - planetCol.a*fft.y) + planetCol.rgb;

    return col;
}


void main()
{
    compressFft(); //initializes fft, ffts

    // Normalized pixel coordinates (from 0 to 1)
    //vec2 uv =(fragCoord - .5 * iResolution.xy) / iResolution.y;
    vec2 uv = -1. + 2. * vUv;
    uv *= 1.2;

    // compute camera ray
    vec3 camPos = vec3(0.5, 0.5, iAmplifiedTime * 0.5);
    vec3 camDir = vec3(0.0, 0.0,  1.0);
    vec3 rayDir = camDir + vec3(uv * 0.13, 0.0);

	//vec3 nrmDir = normalize(rayDir);

    vec3 res = render(camPos, rayDir, uv).rgb;

    #ifdef MSAA
    if (iResolution.x < 850.0) // Added AA for the thumbnail
    {
        vec3 offset = vec3(0.05, 0.12, 0.0)  / iResolution.x;

        for (int i = 0; i < 4 + min(0,iFrame); i++)
        {
            res += render(camPos, rayDir + offset, uv).rgb;
            offset.xy = vec2(-offset.y, offset.x);
        }
        res /= 5.0;
    }
    #endif

    // Output to screen
    gl_FragColor = vec4(res.rgb,1.0);
}