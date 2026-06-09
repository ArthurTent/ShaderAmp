// https://www.shadertoy.com/view/NXXSWH
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: Audiophile campfire at night
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;

varying vec2 vUv;


// === Common Code ===

//////////////////////////////////////////////////////////////
//															//
// SDF functions from mercury : http://mercury.sexy/hg_sdf/ //
//															//
//////////////////////////////////////////////////////////////

// Using ShaderAmp's built-in saturate
#define PI 3.14159265359


float vmax(vec3 v)
{
    return max(max(v.x, v.y), v.z);
}

float fSphere(vec3 p, float r)
{
    return length(p) - r;
}

// Cheap Box: distance to corners is overestimated
float fBoxCheap(vec3 p, vec3 b)
{  // cheap box
    return vmax(abs(p) - b);
}

// Cylinder standing upright on the xz plane
float fCylinder(vec3 p, float r, float height)
{
    float d = length(p.xz) - r;
    d       = max(d, abs(p.y) - height);
    return d;
}

// Capsule: A Cylinder with round caps on both sides
float fCapsule(vec3 p, float r, float c)
{
    return mix(length(p.xz) - r, length(vec3(p.x, abs(p.y) - c, p.z)) - r, step(c, abs(p.y)));
}

// Distance to line segment between <a> and <b>, used for fCapsule() version 2below
float fLineSegment(vec3 p, vec3 a, vec3 b)
{
    vec3  ab = b - a;
    float t  = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length((ab * t + a) - p);
}

// Capsule version 2: between two end points <a> and <b> with radius r
float fCapsule(vec3 p, vec3 a, vec3 b, float r)
{
    return fLineSegment(p, a, b) - r;
}

// Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.
// Read like this: R(p.xz, a) rotates "x towards z".
// This is fast if <a> is a compile-time constant and slower (but still practical) if not.
void pR(inout vec2 p, float a)
{
    p = cos(a) * p + sin(a) * vec2(p.y, -p.x);
}

// Repeat around the origin by a fixed angle.
// For easier use, num of repetitions is use to specify the angle.
float pModPolar(inout vec2 p, float repetitions)
{
    float angle = 2.0 * PI / repetitions;
    float a     = atan(p.y, p.x) + angle / 2.;
    float r     = length(p);
    float c     = floor(a / angle);
    a           = mod(a, angle) - angle / 2.;
    p           = vec2(cos(a), sin(a)) * r;
    // For an odd number of repetitions, fix cell index of the cell in -x direction
    // (cell index would be e.g. -5 and 5 in the two halves of the cell):
    if(abs(c) >= (repetitions / 2.0))
        c = abs(c);
    return c;
}

// Repeat in two dimensions
vec2 pMod2(inout vec2 p, vec2 size)
{
    vec2 c = floor((p + size * 0.5) / size);
    p      = mod(p + size * 0.5, size) - size * 0.5;
    return c;
}

// Repeat in three dimensions
vec3 pMod3(inout vec3 p, vec3 size)
{
    vec3 c = floor((p + size * 0.5) / size);
    p      = mod(p + size * 0.5, size) - size * 0.5;
    return c;
}


////////////////////////////////////////////////////////////
//////////////// Intersectors/SDFs from IQ /////////////////


// plane degined by p (p.xyz must be normalized)
float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

float sdEllipsoid( in vec3 p, in vec3 r )
{
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/k1;
}

float sdEllipsoidY( in vec3 p, in vec2 r )
{
    return (length( p/r.xyx ) - 1.0) * r.x;
}

// https://iquilezles.org/articles/smin
float smin( float a, float b, float k )
{
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*0.25/k;
}

// https://iquilezles.org/articles/smin
float smax( float a, float b, float k )
{
    float h = max(k-abs(a-b),0.0);
    return max(a, b) + h*h*0.25/k;
}


////////////////////////////////////////////////////////////////////////
////////////////// Hashes from Dave Hoskins ////////////////////////////

// Hash without Sine
// Creative Commons Attribution-ShareAlike 4.0 International Public License
// Created by David Hoskins.

//----------------------------------------------------------------------------------------
//  1 out, 1 in...
float hash11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

//----------------------------------------------------------------------------------------
//  1 out, 2 in...
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

//----------------------------------------------------------------------------------------
///  2 out, 2 in...
vec2 hash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);

}

//----------------------------------------------------------------------------------------
///  2 out, 3 in...
vec2 hash23(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);
}




//Black body radiation function from Fabrice Neyret
//https://www.shadertoy.com/view/4tdGWM
vec3 blackBodyToRGB(float temp, float brightness)
{
    vec3 res;
    
    for (float i = 0.0; i < 3.0; i++) // +=.1 if you want to better sample the spectrum.
    {
        float f = 1.0 + 0.5 * i; 
        res[int(i)] += brightness * (f*f*f) / (exp((19E3 * f / temp)) - 1.0);  // Planck law
    }
    
    return res;
}


/////////////////////////////////////////////////////////////////////

////////////////////////// Shared Code //////////////////////////////

/////////////////////////////////////////////////////////////////////



#define NON_CONST_ZERO (min(iFrame,0)) 
#define NON_CONST_ZERO_U uint(min(iFrame,0)) 

const vec2 oz = vec2(1.0, 0.0);

const float kGoldenRatio = 1.618;
const float kGoldenRatioConjugate = 0.618;

const float kPI         = 3.14159265359;
const float kTwoPI      = 2.0 * kPI;


const float kMaxDist = 200.;
const float kTimeScale = 1.0;

vec3 roughFresnel(vec3 f0, float cosA, float roughness)
{
    // Schlick approximation
    return f0 + (oz.xxx - f0) * (pow(1.0 - cosA, 5.0)) * (1.0 - roughness);
}

vec3 fresnel(vec3 f0, float cosA)
{
    return roughFresnel(f0, cosA, 0.0);
}

float linearstep(float start, float end, float x)
{
    float range = end - start;
    return clamp((x - start) / range, 0.0, 1.0);
}

float luminance(vec3 rgb)
{
    return (rgb.r * 0.3) + (rgb.g * 0.59) + (rgb.b * 0.11);
}

vec3 fixNormalBackFacingness(vec3 rayDirWS, vec3 normalWS)
{
    normalWS -= max(0.0, dot(normalWS, rayDirWS)) * rayDirWS;
    return normalWS;
}

vec2 computeParaboloidUv(vec3 dir)
{
    dir.xz /= abs(dir.y) + 1.0;
    dir.xz = dir.xz * 0.5 + 0.5 * oz.xx;
    
    return dir.xz;
}

float tonemapOp(float v)
{
    v = pow(v, 2.0);
    v = v / (1.0 + v);
    return pow(v, 1.0/2.0) * 1.02;
}

vec3 tonemap(vec3 colour)
{
    float luminance = max(0.0001, luminance(colour));
    vec3 normalisedColour = colour / luminance;
    
    vec3 tonemapColour;
    tonemapColour.r = tonemapOp(colour.r);
    tonemapColour.g = tonemapOp(colour.g);
    tonemapColour.b = tonemapOp(colour.b);
    float tonemappedLuminance = tonemapOp(luminance);
    
    return mix(tonemappedLuminance * normalisedColour, tonemapColour, min(1.0, 0.5*luminance));
}

///////////////////////////////////////////////////////
//////////Lighting and scene specific thing////////////
///////////////////////////////////////////////////////


//Ugly globals.
float s_globalFireLife = 1.0;
float s_time = 0.0;
float s_pixelRand = 0.0;

struct CampireLog
{
    vec3 centerWS;
    vec3 burnDirWS;
    
    float rotationY;
    float rotationZ;
    
    float logRadius;
    float logLength;
};

const uint kNumLogs = 7u;
CampireLog s_campfireLogs[kNumLogs];

const vec3 kCampfireCenterWS = vec3(0.05, 0.0, 0.02);

const vec4 kFireStartSphere = vec4(0.15, 0.25, 0.15, 0.2);
const vec4 kFireEndSphere = vec4(0.1, 0.8, 0.1, 0.05);
const vec3 kFireLightColour = vec3(1.0, 0.18, 0.035) * 0.5 
    / (kFireStartSphere.a*kFireStartSphere.a * 0.5);

const vec3 kSkyColour = vec3(0.2, 0.5, 1.0) * (0.005);



// Area lights
// Definitively not correct, but convincing enough.
float diskLight(vec3 coneDirWS, vec3 dirToLightWS,
           float cosAngularRadius, float roughness)
{
    float brdfDiskSolidAngle = 2.0*kPI*(1.0 - (cosAngularRadius-roughness*1.0));
    float diskSolidAngle = 2.0*kPI*(1.0 - cosAngularRadius);
    float brightness = (max(0.00001, diskSolidAngle)/max(0.00001, brdfDiskSolidAngle));
    
    float sharpness = 1.0 - roughness;

    float vDotL = dot(coneDirWS, dirToLightWS);

    float brdfPower = 7.0 - 6.0*sqrt(roughness);
    
    //Angle space visibility instead of cosine space
    //Not sure if this is more correct, the nDotL term is lost
    //But would it even apply to area lighting ?
    brdfDiskSolidAngle = 2.0*kPI*(1.0 - cos(acos(cosAngularRadius)+roughness*0.5*kPI));
    diskSolidAngle = 2.0*kPI*(1.0 - cosAngularRadius);
    brightness = (max(0.00001, diskSolidAngle)/max(0.00001, brdfDiskSolidAngle));
    
    float diskVisibility = max(0.0, linearstep(
        acos(cosAngularRadius) + 0.01 + roughness*kPI*0.5, 
        acos(cosAngularRadius) - 0.01 - roughness*kPI*0.5,
    	acos(vDotL)))*2.0;

    brdfPower = 7.0 - 6.0*(roughness);

    diskVisibility = pow(diskVisibility, brdfPower);

    //Integral S = (x^n dx) is F = x^(n+1) * 1/(n+1)
    //Integral over range [A, B] is F(B) - F(A)
    float powIntegral = 1.0/(brdfPower + 1.0);
	float normalisationFactor = powIntegral;
    //Renormalize
    diskVisibility /= max(0.00001, normalisationFactor);
    diskVisibility = min(1.0, diskVisibility * brightness);

    return diskVisibility;
}

vec3 computeSphereLighting(vec3 posWS, vec3 coneDirWS, float roughness, vec4 lightSphere, vec3 colour,
                      out float visibility)
{
    vec3 posToSphereWS = lightSphere.xyz - posWS;
    float distToSphereCenter = length(posToSphereWS);
    float sqDistToSphere = distToSphereCenter * distToSphereCenter;
    float sqSphereRadius = lightSphere.a * lightSphere.a;
    
    float distToDisk = (1.0/max(0.001, distToSphereCenter)) * max(0.001, sqDistToSphere - sqSphereRadius);
    float diskRadius = (lightSphere.a/distToSphereCenter)*sqrt(max(0.001, sqDistToSphere - sqSphereRadius));
    
    float cosSphereAngularRadius = clamp(distToDisk/sqrt(distToDisk*distToDisk + 
                                        diskRadius*diskRadius), -1.0, 1.0);
    vec3 posToSphereDirWS = posToSphereWS/distToSphereCenter;
    
    float sphereLighting = diskLight(coneDirWS, posToSphereDirWS, 
                                     cosSphereAngularRadius, roughness);
    
    //The point to light can be inside the sphere, blend to 1.0 at the center
    if(distToSphereCenter < lightSphere.a)
    {
        sphereLighting = mix(1.0, sphereLighting, distToSphereCenter/lightSphere.a);
    }
    
	visibility = sphereLighting;
    
    return colour * sphereLighting;
}

vec3 computeTubeLighting(vec3 posWS, vec3 coneDirWS, float roughness, 
                     vec4 startSphere, vec4 endSphere, vec3 colour,
                     out float visibility)
{
    
    vec3 startToEnd = endSphere.xyz - startSphere.xyz;

    vec3 startToEndDir = normalize(startToEnd);
    //Construct a plane going through the line and perpenticular with coneDirWS
    vec3 planeTangent = normalize(cross(startToEndDir, -coneDirWS));
    vec3 planeNormal = normalize(cross(planeTangent, startToEndDir));
    vec4 plane = vec4(-planeNormal, dot(startSphere.xyz, planeNormal));
    //Intersect the direction with that plane
    float closestPointDistAlongRay = plaIntersect(posWS, coneDirWS, plane);
    vec3 closesPointToTube = posWS + coneDirWS * closestPointDistAlongRay;
    //Project the closest point on the tube to find the progress
    vec3 startToClosest = closesPointToTube - startSphere.xyz;
    
    float closestDirProgress = clamp(dot(startToClosest, startToEnd)/dot(startToEnd, startToEnd), 0.0, 1.0);

    //Closest pos on tube to lighting pos
	vec3 startToPos = posWS - startSphere.xyz;
    float closestPointProgress = clamp(dot(startToPos, startToEnd) / dot(startToEnd, startToEnd), 0.0, 1.0);
    
    float progress = mix(closestDirProgress, closestPointProgress, roughness*roughness);

    return computeSphereLighting(posWS, coneDirWS, roughness, 
                             mix(startSphere, endSphere, progress), colour, visibility);
}


vec3 computeLighting(vec3 posWS, vec3 rayDirWS, vec3 normalWS, float roughness, float ambientVis, float shadow)
{
    vec3 coneDirWS = normalize(mix(rayDirWS, normalWS, roughness*roughness*0.75));
    
    vec3 coalsDiskCenter = kCampfireCenterWS - oz.yxy * 0.1;
    
    vec3 coneIntersectedWithGround = posWS + coneDirWS * 
        -(posWS.y - coalsDiskCenter.y)/(coneDirWS.y == 0.0 ? 0.0001 : coneDirWS.y);
    
    float coalsDiskRadiusWS = 0.73;
    
    vec3 campfireToGroundPosWS = coneIntersectedWithGround - coalsDiskCenter;
    vec3 campfireToConeGroundDirWS = normalize(campfireToGroundPosWS);
    vec3 farDiskPointOnGroundWS = coalsDiskCenter + campfireToConeGroundDirWS * coalsDiskRadiusWS;

    vec3 posToCoalsDiskCenterDirWS =  normalize(coalsDiskCenter - posWS);
    float coalsDiskAngularRadius = (dot(normalize(farDiskPointOnGroundWS - posWS), 
                                       posToCoalsDiskCenterDirWS));
    
    vec3 sky = kSkyColour / (1.0 + 0.03*dot(posWS, posWS));

    vec3 ambient = sky;
    //Bounced light from the fire
    vec3 groundAlbedo = vec3(0.2, 0.15, 0.05);
    vec3 groundColour = groundAlbedo * (clamp(s_globalFireLife + 0.05, 0.0, 1.0)) * 0.05 *
        ((kFireLightColour)/(roughness + 1.0 + dot(campfireToGroundPosWS, campfireToGroundPosWS)));
    
    ambient = mix(ambient, groundColour, 
                  smoothstep(0.001+roughness*1.5, -0.001-roughness*1.5, coneDirWS.y));
	
    //Glow from the coals
    ambient += shadow * 0.1 * vec3(1.0, 0.075, 0.01) * clamp(10.0 * (s_globalFireLife*0.75 + 0.25), 0.0, 1.0) * 
        diskLight(coneDirWS, posToCoalsDiskCenterDirWS, coalsDiskAngularRadius, roughness);
    
    
    ambient *= ambientVis;
    
    for(uint i = 0u; i < kNumLogs; ++i)
    {
		float logLength = s_campfireLogs[i].logLength;
        float logRadius = s_campfireLogs[i].logLength;
        vec3 logCenterWS = s_campfireLogs[i].centerWS;
        vec3 burnDirWS = s_campfireLogs[i].burnDirWS;
        
        float rand = kGoldenRatio * float(i);
        float fireLife = s_globalFireLife - hash11(rand * 657.9759)*0.2;
        
        vec3 flameCenterWS = logCenterWS + burnDirWS*(clamp(fireLife, 0.0, 1.0)*2.0 - 1.0)*logLength;
        
        float sqrtFireLife = sqrt(max(0.0001, fireLife));
        float flameHeight = max(0.15, 0.2 + fireLife*1.2);
        flameHeight *= 0.65;
        float flameRadius = (0.1 + sqrtFireLife)*0.2;
        flameRadius *= 0.75;
        //Prevent the light from going through the ground
        flameCenterWS.y = max(flameCenterWS.y, flameRadius + 0.05);

        vec4 fireBottomLight = vec4(flameCenterWS, max(0.075, flameRadius));
        vec4 fireTopLight = vec4(flameCenterWS + oz.yxy * flameHeight, 0.01);
        
        float lightVisibility;
        vec3 fireLight = computeTubeLighting(posWS, coneDirWS, roughness, fireBottomLight, fireTopLight, 
                                             kFireLightColour, lightVisibility);
        
        float lightIntensity = sqrt(clamp(fireLife + 0.1, 0.0, 1.0));
        ambient += shadow * fireLight * lightIntensity
            *(1.0 + sin(rand*2.0 - 10.0*s_time) * 0.35 + sin(rand*4.0 - 15.0*s_time)*0.25);
        
    }
    
    return ambient;
}

vec3 computeLighting(vec3 posWS, vec3 rayDirWS, vec3 normalWS, float roughness)
{
    return computeLighting(posWS, rayDirWS, normalWS, roughness, 1.0, 1.0);
}


/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
//////////////////////////// Cameras ////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////

const float kCameraPlaneDist = 4.0;

float kPixelConeWithAtUnitLength = 0.00;

vec2 getScreenspaceUvFromRayDirectionWS(
    vec3 rayDirectionWS,
	vec3 cameraForwardWS,
	vec3 cameraUpWS,
	vec3 cameraRightWS,
	float aspectRatio)
{
    vec3 eyeToCameraPlaneCenterWS = cameraForwardWS * kCameraPlaneDist;
    // project rayDirectionWs onto camera forward
    float projDist                 = dot(rayDirectionWS, cameraForwardWS);
    vec3  eyeToPosOnCameraPlaneWS = (rayDirectionWS / projDist) * kCameraPlaneDist;
    vec3  vecFromPlaneCenterWS       = eyeToPosOnCameraPlaneWS - eyeToCameraPlaneCenterWS;

    float xDist = dot(vecFromPlaneCenterWS, cameraRightWS);
    float yDist = dot(vecFromPlaneCenterWS, cameraUpWS);
    
    xDist /= aspectRatio;
    xDist = xDist * 0.5 + 0.5;
    yDist = yDist * 0.5 + 0.5;

    return vec2(xDist, yDist);
}

void computeCamera(float time, vec2 mouseSNorm, vec4 iMouse, vec2 iResolution,
                   out vec3 rayOriginWS,
                   out vec3 cameraForwardWS,
                   out vec3 cameraUpWS,
                   out vec3 cameraRightWS
                  )
{
    
	kPixelConeWithAtUnitLength = (1.0 / iResolution.y) / kCameraPlaneDist;
    
    //Reset to 'neutral' position if the iMouse position is 0.0
	if(length(iMouse.xy) < 30.0 && iMouse.z < 1.0) 
    {
        mouseSNorm = oz.yy;
    }
    
    float camMove = 0.0;
    
    float rotation = mouseSNorm.x * kPI * 2.;
    rotation += time * 2.0 * kPI * 0.01;   
    
    rayOriginWS = vec3(-sin(rotation), 0.0, -cos(rotation))*1.;
    rayOriginWS.y = max(0.45, 0.45 + (mouseSNorm.y + 1.0) * 0.35 + sin(time * 2.0 * kPI * 0.015)*0.1);
    
	vec3 target = vec3( 0.0, 0.5, 0.0);
    
    cameraForwardWS = normalize(target - rayOriginWS);

    cameraRightWS = normalize(cross(oz.yxy, cameraForwardWS));
    cameraUpWS = normalize(cross(cameraForwardWS, cameraRightWS));
    
    rayOriginWS -= cameraForwardWS*kCameraPlaneDist;    
}

// === End Common Code ===


///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
////////////////////////// Campfire scene /////////////////////////////
/////////////////////////// by Maurogik ///////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

//
// Animated fire scene
// If ran on a laptop, automatically turns it into a nice hand warmer ;)
// The whole fire burns out in about 80 seconds
//
// The fire itself is a deformed SDF rendered as an emissive volumetric effect.
// Several area lights are used for lighting the scene.
// 

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
      
	vec4 colour = textureLod(iChannel0, uv, 0.0);
    
    //Shadertoy very conveniently provides us with Mips of the input buffers !
    //Let's do bloom !
    
    float totalWeight = 0.0;
    
    vec3 bloom = oz.yyy;
    
    vec2 subPixelJitter = fract(hash22(fragCoord)
                                + float(iFrame%256) * kGoldenRatio * oz.xx) - 0.5*oz.xx;
    
    float range = 1.0;
    //Super sample low mips to get less blocky bloom
    for(float xo = -range; xo < range + 0.1; xo += 0.5)
    {
        for(float yo = -range; yo < range + 0.1; yo += 0.5)
        {
            vec2 vo = vec2(xo, yo);
            float weight = (range*range*2.0) - dot(vo, vo);
            vo += 0.5 * (subPixelJitter);
            vec2 off = vo*(0.5/range)/iResolution.xy;
            
            if(weight > 0.0)
            {
                bloom += 0.4  * weight * textureLod(iChannel0, uv + off*exp2(4.0), 4.0).rgb;
                bloom += 0.4  * weight * textureLod(iChannel0, uv + off*exp2(5.0), 5.0).rgb;
                bloom += 0.4  * weight * textureLod(iChannel0, uv + off*exp2(6.0), 6.0).rgb;
            }
            totalWeight += weight;
        }
    }

    bloom.rgb /= totalWeight;
    
    colour.rgb += 0.025 * pow(bloom, oz.xxx*2.0);
    
    //Vignette
    colour.rgb *= linearstep(0.8, 0.3, length(uv - 0.5*oz.xx));
        
    colour.rgb = tonemap(colour.rgb);
    
    colour = pow(colour, vec4(1.0/2.2));
    
    //Colour banding removal
    float dithering = hash12(fragCoord) - 0.5;
    fragColor = colour + oz.xxxx * dithering / 255.0;
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
