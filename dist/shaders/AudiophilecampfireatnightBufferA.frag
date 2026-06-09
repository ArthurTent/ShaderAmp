// https://www.shadertoy.com/view/NXXSWH
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: Audiophile campfire at night - Buffer A
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


/////////////////////////////////////////////////////

//Material Ids
const float kMatDefault = 0.0;
const float kMatFire = 1.0;
const float kMatWoodLog = 2.0;
const float kMatRock = 3.0;
const float kMatGround = 4.0;
const float kMatCoals = 5.0;


void fFireLog(vec3 centerToPosLS, vec3 posWS, vec3 flameCenterWS, vec3 burnDirWS,
              float logRadius, float logLength, float logRand, float fireLife,
              bool doVolumetric,
              out float logD, out float fireD,
              out vec4 logMaterial, out vec4 fireMaterial)
{    
    float logProgress = (centerToPosLS.y/logLength)*0.5 + 0.5;
    
    logD = fCylinder(centerToPosLS, logRadius, logLength);
    
    //Log material setup
    logMaterial.x = kMatWoodLog;
    vec2 uv = vec2(0.5 + atan(centerToPosLS.x/centerToPosLS.z)/(kPI), logLength + centerToPosLS.y);
    logMaterial.yz = uv + abs(logRand)*oz.xx;
    if(abs(centerToPosLS.y / logLength) > 0.99) //End caps
    {
        //Compute a different UV for the end caps to get rings in the log
        logMaterial.y = length(centerToPosLS.xz)/logRadius;
        logMaterial.z = -1.0; //-1.0 is used to tag this as an end cap
    }
    
    //Burn progress at this point on the log
    logMaterial.w = logProgress - fireLife;
    
    if(!doVolumetric)
    {
        fireD = kMaxDist;
        return;
    }
    
    //Move the flame along the log as it burns
    flameCenterWS += burnDirWS*(max(0.0, fireLife)*2.0 - 1.0)*logLength;
    //Push the flame below the ground once the log is done burning
    flameCenterWS -= oz.yxy * max(0.0, -fireLife);
    vec3 flameToPosWS = posWS - flameCenterWS;
    
    //Make the flame ellipsoid wave in the wind (but less so at the bottom)
    float flameRot = logRand*kPI + flameToPosWS.y * kPI * 2.0 - (10.0 + 3.0*hash11(logRand))*s_time;
    float flameRotSin = sin(flameRot);
	flameToPosWS.x += flameToPosWS.y * 0.1 * flameRotSin;
    flameToPosWS.z += flameToPosWS.y * 0.1 * cos(flameRot);
    
    float sqrtFireLife = sqrt(max(0.0, fireLife));
    float flameHeight = max(0.001, 0.2 + fireLife*1.2);
    float flameRadius = max(0.0001, 0.1 + sqrtFireLife)*0.2;
    fireD = sdEllipsoidY(flameToPosWS - oz.yxy * flameHeight * 0.5, vec2(flameRadius, flameHeight));
    
    //Remove flame beneath the logs
    fireD = smax(fireD, -centerToPosLS.x - logRadius, 0.2);
    
    float isAboveLog = (centerToPosLS.x/logRadius)*0.5 + 0.5;
    
    //Add some small flames around the burning log
    float localFlame = (1.0 - clamp(abs(fireLife - logProgress)*3.0, 0.0, 1.0))*max(0.0, 0.3 + fireLife*0.7);
    localFlame *= (max(0.0, isAboveLog) + 1.0);
    float localFlameD = logD - min(0.15, localFlame*(0.1 + flameRotSin*0.02));
    fireD = smin(fireD, localFlameD, 0.15);
    
    fireMaterial.y = isAboveLog;
}

void InitLogs(float time)
{
   
    float bass = textureLod(iChannel3, vec2(0.05, 0.0), 0.0).r;
    float mids = textureLod(iChannel3, vec2(0.40, 0.0), 0.0).r;
    
    float audioDrive = 0.35 + (bass * 0.55) + (mids * 0.3);
    s_globalFireLife = clamp(audioDrive, 0.0, 1.0);
    
    // Establish a baseline life so it doesn't look completely dead without sound,
    // then scale up dynamically based on the audio energy.
    
    // Clamp to valid structural bounds
    s_globalFireLife = clamp(audioDrive * 1.1, 0.0, 1.0); 
    
    vec3 burnDirWS;
    float rotY, rotZ;
    
    // 0
    rotY = kGoldenRatio*kPI;
    rotZ = 0.5*kPI;
    burnDirWS = oz.yxy;
    pR(burnDirWS.xy, -rotZ);
    pR(burnDirWS.xz, -rotY);
    s_campfireLogs[0] = CampireLog(vec3(0.2, 0.1, 0.0), burnDirWS, rotY, rotZ, 0.1, 0.4);
    
    // 1
    rotY = 2.0*kGoldenRatio*kPI;
    rotZ = 0.41*kPI;
    burnDirWS = oz.yxy;
    pR(burnDirWS.xy, -rotZ);
    pR(burnDirWS.xz, -rotY);
    s_campfireLogs[1] = CampireLog(vec3(0.0, 0.23, 0.0), burnDirWS, rotY, rotZ, 0.08, 0.6);
    
    // 2
    rotY = -kGoldenRatio*kPI;
    rotZ = 0.28*kPI;
    burnDirWS = oz.yxy;
    pR(burnDirWS.xy, -rotZ);
    pR(burnDirWS.xz, -rotY);
    s_campfireLogs[2] = CampireLog(vec3(0.25, 0.21, 0.1), burnDirWS, rotY, rotZ, 0.07, 0.25);
    
    // 3
    rotY = -4.05*kGoldenRatio*kPI;
    rotZ = 0.325*kPI;
    burnDirWS = oz.yxy;
    pR(burnDirWS.xy, -rotZ);
    pR(burnDirWS.xz, -rotY);
    s_campfireLogs[3] = CampireLog(vec3(0.0, 0.33, -0.1), burnDirWS, rotY, rotZ, 0.06, 0.55);
    
    // 4
    rotY = 0.0*kPI;
    rotZ = 0.2*kPI;
    burnDirWS = oz.yxy;
    pR(burnDirWS.xy, -rotZ);
    pR(burnDirWS.xz, -rotY);
    s_campfireLogs[4] = CampireLog(vec3(0.23, 0.43, 0.12), burnDirWS, rotY, rotZ, 0.06, 0.5);      
    
    // 5
    rotY = 0.5*kPI;
    rotZ = 0.2*kPI;
    burnDirWS = oz.yxy;
    pR(burnDirWS.xy, -rotZ);
    pR(burnDirWS.xz, -rotY);
    s_campfireLogs[5] = CampireLog(vec3(0.19, 0.43, 0.35), burnDirWS, rotY, rotZ, 0.08, 0.49); 
    
    // 6
    rotY = 0.8*kPI;
    rotZ = 0.15*kPI;
    burnDirWS = oz.yxy;
    pR(burnDirWS.xy, -rotZ);
    pR(burnDirWS.xz, -rotY);
    s_campfireLogs[6] = CampireLog(vec3(-0.05, 0.55, 0.26), burnDirWS, rotY, rotZ, 0.05, 0.61);     
}

//Carve some ellipsoid shaped holes in the fire SDF
float displacementFire(vec3 positionWs, float minDist, 
                       float displacementScale, float amount)
{
    float softenRadius = displacementScale * 0.5;

    //Repeat space and carve
    vec3 repSize = vec3(2.0, 4.0, 2.0) * displacementScale;
    vec3 dPos = positionWs;
    pMod3(dPos, repSize);
    float radius = 1.0 * displacementScale * abs(amount);
    float sphereDist = sdEllipsoidY(dPos, vec2(radius, radius*5.0));

    //Do the same again but offset by half the repetition step 
    dPos = positionWs;
    dPos += repSize * 0.5;
    pMod3(dPos, repSize);
    sphereDist = min(sphereDist, sdEllipsoidY(dPos, vec2(radius, radius*4.0)));

    return smax(minDist, sign(amount)*sphereDist, 
                         softenRadius);
}

float fCampfireLogs(vec3 posWS, bool doVolumetric, out vec4 material, out float minFireD)
{
    float minLogD = kMaxDist;
    minFireD = kMaxDist;
    
    vec4 minLogMaterial = oz.yyyy;
	vec4 minFireMaterial = oz.yyyy;
    
    //Early out of the whole thing (which is quite expensive)
    //based on the distance to the campfire
    vec3 campfireCenterToPosWS = posWS - kCampfireCenterWS;
    float distToCampfireXZ = length(campfireCenterToPosWS.xz) - 0.65;
    if(distToCampfireXZ > 0.25)
    {
        minLogD = distToCampfireXZ;
        minFireD = minLogD;
    }
    else
    {  
        for(uint i = 0u; i < kNumLogs; ++i)
        {
            vec3 logCenterWS = s_campfireLogs[i].centerWS;
            vec3 centerToPosLS = posWS - logCenterWS;
            pR(centerToPosLS.xz, s_campfireLogs[i].rotationY);
            pR(centerToPosLS.xy, s_campfireLogs[i].rotationZ);
            vec3 burnDirWS = s_campfireLogs[i].burnDirWS;

            float rand = kGoldenRatio * float(i);
            float fireLife = s_globalFireLife - hash11(rand * 657.9759)*0.2;

            vec4 logMaterial, fireMaterial;
            float logD, fireD;
            fFireLog(centerToPosLS, posWS, logCenterWS, burnDirWS, 
                     s_campfireLogs[i].logRadius, s_campfireLogs[i].logLength,
                     rand, fireLife,
                     doVolumetric, 
                     logD, fireD,
                     logMaterial, fireMaterial);

            if(logD < minLogD)
            {
                minLogD = logD;
                minLogMaterial = logMaterial;
            }

            if(fireD < minFireD)
            {
                minFireD = fireD;
                minFireMaterial = fireMaterial;
            }
        }
    }
    
    float logDispScale = 0.025;
    float logDispSoften = 0.15;
    
    
    //Sticks on the ground
    float stickScale = 0.25;
    
    vec3 stickPos = posWS + oz.xyx * 1.5;
    vec2 stickId = pMod2(stickPos.xz, oz.xx * 7.0 * stickScale);
    float stickRand = hash12(stickId * 39.6897);
    pR(stickPos.xz, stickRand * kPI);
    
    float stickRadius = (0.04 + stickRand * 0.015) * stickScale;
    float stickLength = (0.75 + stickRand * 0.4) * stickScale;
    stickPos.y -= stickRadius + min(0.0, dot(posWS, posWS) * 0.01 - 0.02);
    
    stickPos.xz += stickRand * oz.xx * 2.0 * stickScale;
    
    float stickD = fCylinder(stickPos.xzy, stickRadius, stickLength);
    if(stickD < minLogD)
    {
        minLogD = stickD;
        
        minLogMaterial.x = kMatWoodLog;
        vec2 uv = vec2(0.5 + atan(stickPos.x/stickPos.y)/(kPI), stickPos.z);
        minLogMaterial.yz = uv + stickRand*oz.xx;
        minLogMaterial.w = -1.0;
        
        logDispScale = 0.015;
        logDispSoften = 0.05;
    }
    
    //Logs & sticks displacement
    vec3 dispPos = posWS;
    pMod3(dispPos, oz.xxx * logDispScale * 11.0);
    float dispD = fSphere(dispPos, logDispScale);
    minLogD = smin(minLogD, smax(minLogD-logDispScale, dispD, logDispSoften), logDispSoften);
    
    if(doVolumetric)
    {
        minFireMaterial.x = kMatFire;
        
        //Fire displacement (only do it when we're close enough for it to matter)
        if(minFireD < 0.25)
        {
            float displacedFireD = minFireD;
            float dispAmount = min(1.0, 0.2 + (max(0.001, posWS.y))*0.45);
            vec3 windDisp = vec3(0.03, 1.0, -0.02) * 3.0 * s_time;
            vec3 dispPosWS = posWS - windDisp;

            float isUnderLog = minFireMaterial.y;

            displacedFireD = displacementFire(dispPosWS, displacedFireD, 0.2, -dispAmount);

            dispPosWS = posWS + oz.xxx * 16.6798 - windDisp * 0.5;

            displacedFireD = displacementFire(
                dispPosWS, displacedFireD, 0.07, 
                -(0.0001 + clamp(isUnderLog*1.0, 0.0, 1.0))*linearstep(-0.1, 0.0, minFireD));

            
            minFireMaterial.y = clamp(linearstep(0.05, 0.0, minLogD*minLogD), 0.0, 1.0)
                                         * (linearstep(-0.00, -0.05, displacedFireD));

            minFireD = displacedFireD;
        }
        
        //Sparks
        if(s_globalFireLife > 0.0)
        { 
            vec3 posSparks = posWS - kCampfireCenterWS - oz.yxy * (0.3 * s_globalFireLife + 0.1);

            float sparkId = pModPolar(posSparks.xz, 5.0);
            pR(posSparks.xy, kPI * 0.15);

            float sparkRand = hash11(sparkId*937.959);
            float sparksAnimDuration = 5.0;
            float sparkAnim = fract(s_time / sparksAnimDuration + sparkRand);
            float sparksSpeed = sparksAnimDuration * 4.0 * max(0.7, 2.0*s_globalFireLife);
            float sparkTravel = sparkAnim*sparksSpeed;

            //Compute start and end  pos and draw a capsule in between (for motion blur effect)
            vec3 posSparksStart = oz.xyy * sparkTravel;
            vec3 posSparksEnd = oz.xyy * sparkTravel;

            float rotationT = (sparkRand + sparkAnim)*sparksSpeed*2.5;
            posSparksStart.xz += vec2(sin(rotationT), cos(rotationT)) * 
                (0.15 + sparkAnim * 0.5);
            posSparksStart.y += cos(rotationT * 0.5) * (sparkAnim*0.3 + 0.2);

            float sparkAnimDelta = min(0.033, iTimeDelta*kTimeScale) / sparksAnimDuration;
            sparkAnim -= sparkAnimDelta;
            
            rotationT = (sparkRand + sparkAnim)*sparksSpeed*2.5;

            posSparksEnd.x -= sparkAnimDelta*sparksSpeed;
			posSparksEnd.xz += vec2(sin(rotationT), cos(rotationT)) * 
                (0.15 + sparkAnim * 0.5);
            posSparksEnd.y += cos(rotationT * 0.5) * (sparkAnim*0.3 + 0.2);

            float sparksD = fCapsule(posSparks, posSparksStart, posSparksEnd, 0.01);
            if(sparksD < minFireD)
            {
                minFireD = sparksD;
                float sparkStrength = 0.5 + sparkRand * 2.0;
                minFireMaterial.y = max(0.0, sparkStrength - 15.0*sparkAnim) * 
                    linearstep(0.0, -0.01, sparksD);
                //Make the sparks dimmer as the fire dies out
                minFireMaterial.y *= clamp(2.0*s_globalFireLife, 0.0, 1.0);
            }
        }
    }
    
    if(minLogD > 0.01 && minFireD < minLogD)
    {
        material = minFireMaterial;
        return minFireD;
    }
    else
    {
        material = minLogMaterial;
        return minLogD;
    }
}

//10 Rocks in a circle
float fCampfireRocks(vec3 posWS, out vec4 material)
{
    float minDist = kMaxDist;
    
    material.x = kMatRock;
    material.yzw = oz.yyy;
    
    //When far away, use a cheaper disk slab SDF
    vec3 campfireCenterToPosWS = posWS - kCampfireCenterWS;
    float distToCampfireXZ = length(campfireCenterToPosWS.xz) - 1.0;
    float distToCampfire = max(distToCampfireXZ, campfireCenterToPosWS.y - 0.25);
    if(distToCampfire > 0.25)
    {
        return distToCampfire;
    }
    vec3 campfireToPos = posWS - kCampfireCenterWS;
    
    //First 5 rocks
    vec3 rockToPos = campfireToPos;
    float id = pModPolar(rockToPos.xz, 5.0);
    float modRand = hash11(id * 97.5887);
    float modRandSNorm = modRand*2.0 - 1.0;
    
    vec3 rockDims = vec3(0.22 + modRandSNorm*0.05, 
                         0.13 - modRandSNorm*0.04, 
                         0.27);
    
    rockToPos.x -= 0.88;
    rockToPos.y -= rockDims.y*0.5;
    
    material.yz = 4.0 * computeParaboloidUv(normalize(rockToPos)) + modRand*oz.xx;
    minDist = sdEllipsoid(rockToPos, rockDims);

    //Another set of 5 rocks
    rockToPos = campfireToPos;
    pR(rockToPos.xz, 0.2 * kPI);
    id = pModPolar(rockToPos.xz, 5.0);
    modRand = hash11((2.0 + id) * 97.5887);
    modRandSNorm = modRand*2.0 - 1.0;
    
	rockDims = vec3(0.2 + modRandSNorm*0.05, 
                    0.14 - modRandSNorm*0.03, 
                    0.26 + modRandSNorm*0.03);
    
    rockToPos.x -= 0.75;
    rockToPos.y -= rockDims.y*0.5;
    
    float rockD = sdEllipsoid(rockToPos, rockDims);
    if(rockD < minDist)
    {
        material.yz = 4.0 * computeParaboloidUv(normalize(rockToPos)) + modRand*oz.xx;
        minDist = rockD;
    }
    
    //Rocks displacement
    vec3 dispPos = posWS;
    float dispScale = 0.1;
    pMod3(dispPos, oz.xxx * dispScale * 3.0);
    float dispD = fSphere(dispPos, dispScale);
    
    dispPos = posWS;
    dispScale = 0.125;
    pMod3(dispPos, oz.xxx * dispScale * 3.5);
    dispD = min(dispD, fBoxCheap(dispPos, oz.xxx*dispScale));
    
    minDist = smin(minDist+dispScale*0.5, smax(minDist - dispScale*0.25, -dispD, 0.15), 0.05);     
        
 	return minDist;   
}

float fCoals(vec3 posWS, out vec4 material)
{
    material.x = kMatCoals;
    material.yzw = oz.yyy;
    
    vec3 campfireToPosWS = posWS - kCampfireCenterWS;
    
    //When far away, use a cheaper disk slab SDF
    float distToCampfireXZ = length(campfireToPosWS.xz) - 0.65;
    float distToCampfire = max(distToCampfireXZ, campfireToPosWS.y - 0.1);
    if(distToCampfire > 0.25)
    {
        return distToCampfire;
    }
    
    //First set of coals
    vec3 pCoal = campfireToPosWS;
    //Push them underground as they get away from the center of the campfire
    pCoal.y += dot(campfireToPosWS, campfireToPosWS)*0.2 - 0.035;
    vec2 id = pMod2(pCoal.xz, oz.xx * 0.15) * 967.045;
    float coalRand = hash12(id);
    pR(pCoal.xz, coalRand * 2.0 * kPI);
    float coalD = fCapsule(pCoal.xzy, 0.03, 0.05);
    
    material.y = coalRand;
    material.zw = computeParaboloidUv(normalize(pCoal)) + coalRand*oz.xx;
    
    //Second set of coals, slightly smaller
    pCoal = campfireToPosWS;
    pCoal.y += dot(campfireToPosWS, campfireToPosWS)*0.25 - 0.035;
    pCoal.xz += oz.xx*0.16895;
    id = pMod2(pCoal.xz, oz.xx * 0.12) *  739.2397;
    coalRand = hash12(id);
    pR(pCoal.xz, coalRand * 1.0 * kPI);
    float coalAltD = fCapsule(pCoal.xzy, 0.025, 0.04);
    
    if(coalAltD < coalD)
    {
        coalD = coalAltD;
        material.y = coalRand;
        material.zw = computeParaboloidUv(normalize(pCoal)) + coalRand*oz.xx;
    }
    
    return coalD;
}

float fSDF(vec3 posWS, bool doVolumetric, out vec4 material)
{
    float minDist = kMaxDist;
    
    vec2 groundUv = posWS.xz + oz.xx*3.0;
    float groundNormalisedDisp = 0.0;
    if(posWS.y < 0.3)
    {
        groundNormalisedDisp = textureLod(iChannel2, groundUv * 0.05, 0.0).r;
    }
    
    float fireD;
    vec4 campfireLogsMaterial;
    float campfireLogsD = fCampfireLogs(posWS, doVolumetric, campfireLogsMaterial, fireD);
    if(campfireLogsD < minDist)
    {
        minDist = campfireLogsD;
        material = campfireLogsMaterial;
    }
    
    
    vec4 campfireRocksMaterial;
    float campfireRocksD = fCampfireRocks(posWS, campfireRocksMaterial);
    //Add some extra noise to the rocks distance
    campfireRocksD -= groundNormalisedDisp * 0.02;
    if(campfireRocksD < minDist)
    {
        minDist = campfireRocksD;
        material = campfireRocksMaterial;
    }
    
    vec4 coalsMaterial;
    float coalsD = fCoals(posWS, coalsMaterial);
    //Fatten the coals using the ground displacement texture to randomize their shape
    coalsD -= groundNormalisedDisp * 0.035; 
   	if(coalsD < minDist)
    {
        minDist = coalsD;
        material = coalsMaterial;
        material.y = fireD + (material.y  - 0.5)*0.5;
    }
    
    //Ground plane
    float groundDisp = groundNormalisedDisp * 0.05;
    float groundD = posWS.y - groundDisp;

    if(groundD < minDist)
    {
	    material.x = kMatGround;
    	material.yz = groundUv;
    	float ambientVis = 0.99 * linearstep(0.0, 0.1, campfireRocksD);
        
    	vec2 uv = material.yz;
        material.w = groundNormalisedDisp;
        
        //Pack the ambient and the material in W
        material.w = floor(material.w * 256.0) + ambientVis;
        minDist = groundD;
    }    
    
    return minDist;
}

float fSDF(vec3 posWS)
{
    vec4 mat;
    return fSDF(posWS, true, mat);
}


//Extra SDF 'Update' pass only call when we compute the normal to add additional details
float fMaterialSDF(float dist, vec4 material)
{
    if(abs(material.x - kMatWoodLog) < 0.1)
    {
        vec2 uv = material.yz;
        float bark = textureLod(iAudioData, uv * 0.05, 0.0).r;
        bark += 0.5 * textureLod(iAudioData, uv * 0.1, 0.0).r;
        float isBark = step(-0.5, uv.y);
        dist -= bark*(0.025*isBark + 0.005);
    }
    else if(abs(material.x - kMatRock) < 0.1)
    {
        vec2 uv = material.yz;
        float rock = textureLod(iAudioData, uv * 0.04, 0.0).r;
        dist -= rock*0.02;
    }
    else if(abs(material.x - kMatCoals) < 0.1)
    {
        vec2 uv = material.zw;
        float disp = textureLod(iAudioData, uv * 0.04, 0.0).r;
        dist -= disp*0.05;
    }
    else if(abs(material.x - kMatGround) < 0.1)
    {
        float groundMat = floor(material.w)/256.0;
    	vec2 uv = material.yz;
        float disp = 0.0;
        disp += 0.25*textureLod(iChannel2, uv * 0.25, 0.0).r;
        disp += 0.15*textureLod(iChannel2, uv * 0.45, 0.0).r;
        dist -= disp * 0.1 * (1.0 - groundMat);
        
        float rock = textureLod(iAudioData, uv * vec2(0.25, 0.1), 0.0).r;
        dist -= rock*0.025*groundMat;
    }
    
    return dist;
}

vec3 getNormalWS(vec3 p, float dt)
{
    vec3 normalWS = oz.yyy;
    for( int i = NON_CONST_ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        vec4 mat;
        float dist = fSDF(p + e * dt, false, mat);
        normalWS += e*fMaterialSDF(dist, mat);
    }
    return normalize(normalWS);    
}

float computeVolumetricTransmittance(vec4 material, float mediumD, float stepD)
{
    float density = max(0.001, -mediumD*40.0);
    return exp(-stepD * density * 1.0);
}

vec4 computeVolumetricLighting(vec4 material, float mediumD, float stepD, vec4 insTrans)
{
    vec3 emissiveColour = blackBodyToRGB(2500.0 + material.y * 2500.0, 3000.0);
    float stepTransmittance = computeVolumetricTransmittance(material, mediumD, stepD);
    insTrans.rgb += insTrans.a *
        (1.0 - stepTransmittance) * emissiveColour;
    insTrans.a *= stepTransmittance;
    
    return insTrans;
}

#define ITER 128
float march(vec3 ro, vec3 rd, out vec4 outMaterial, out vec4 outInscatterTransmittance)
{
    float t = 0.001;
 	float d = 0.0;
    
    outInscatterTransmittance = oz.yyyx;
    
    for(int i = NON_CONST_ZERO; i < ITER; ++i)
    {
        float coneWidth = kPixelConeWithAtUnitLength * t;
        
        vec3 posWS = ro + rd*t;
        d = fSDF(posWS, true, outMaterial);
        
        if(outMaterial.x == kMatFire && d < coneWidth)
        {
            float mediumD = d;
            d = max(0.01, abs(d))*(s_pixelRand*0.5 + 0.75) + coneWidth;
            
            outInscatterTransmittance = 
                computeVolumetricLighting(outMaterial, mediumD, d, outInscatterTransmittance);
        }
        
        t += d;
        
        if(i >= ITER - 1)
        {
            t = kMaxDist;
        }              
        

        if(d < coneWidth || t >= kMaxDist)
        {
            break;
        }
    }
      
    return t;
}

#define ITER_SHADOW 8

float marchShadow(vec3 ro, vec3 rd, float t, float mt, float tanSourceRadius)
{
 	float d;
    float minVisibility = 1.0;
    
    vec4 material;
    
    for(int i = NON_CONST_ZERO; i < ITER_SHADOW && t < mt; ++i)
    {
        float coneWidth = max(0.0001, tanSourceRadius * t);
        
        vec3 posWS = ro + rd*t;
        d = fSDF(posWS, false, material) + coneWidth*0.5;
        
        minVisibility = min(minVisibility, (d) / max(0.0001, coneWidth*1.0));
        t += d;
        
        if(i >= ITER_SHADOW - 1)
        {
            t = mt;
        }              
        
        if(minVisibility < 0.01)
        {
            minVisibility = 0.0;
        }
    }
      
    return smoothstep(0.0, 1.0, minVisibility);
}

float getFireShadow(vec3 posWS)
{
    float fireLife = max(0.0, s_globalFireLife);
    vec3 fireLightPosWS = vec3(0.0, 0.05 + fireLife*0.35, 0.0);
    
    float lightAnim = s_time * 15.0;
    float lightAnimAmpl = 0.02;
    fireLightPosWS.x += lightAnimAmpl * sin(lightAnim);
    fireLightPosWS.z += lightAnimAmpl * cos(lightAnim);
    
    float fireLightRadius = 0.7 - fireLife * 0.25;
    
    vec3 posToFireWS = fireLightPosWS - posWS;
    float posToFireLength = length(fireLightPosWS - posWS);
    vec3 posToFireDirWS = posToFireWS / max(0.0001, posToFireLength);
    
    float distToLight = posToFireLength-fireLightRadius;
    
    if(distToLight < 0.0)
    {
        return 1.0;
    }
    
    float lightTanAngularRadius = fireLightRadius / max(0.0001, posToFireLength);
    
    return marchShadow(posWS, posToFireDirWS, 0.001, 
                       max(0.0, posToFireLength-fireLightRadius), lightTanAngularRadius);
}

vec3 computeLighting(
    vec3 posWS,
    vec3 rayDirWS,
    vec3 normalWS,
    vec3 albedo,
    vec3 f0Reflectance,
    float roughness,
    vec4 emissive,
    float ambient
)
{
    if(emissive.a > 0.999)
    {
        return emissive.rgb;
    }
    
    float shadow = getFireShadow(posWS + normalWS * 0.02);
    vec3 reflectedRayDirWS = reflect(rayDirWS, normalWS);
    float rDotN = max(0.0001, dot(reflectedRayDirWS, normalWS));
    vec3 fresnelReflectance = roughFresnel(f0Reflectance, rDotN, roughness);

    vec3 diffuse = albedo * computeLighting(posWS, normalWS, normalWS, 1.0, ambient, shadow);
    vec3 specular = computeLighting(posWS, reflectedRayDirWS, normalWS, roughness, ambient, shadow);
    vec3 surfaceLighting = mix(diffuse, specular, fresnelReflectance);
    return surfaceLighting * (1.0 - emissive.a) + emissive.rgb;
}

vec3 computeSceneColour(vec3 endPointWS, vec3 rayDirectionWS, float marchedDist,
                       vec4 material)
{
    float normalDt = 0.001 + kPixelConeWithAtUnitLength * marchedDist;
    vec3 normalWS = getNormalWS(endPointWS, normalDt);
    normalWS = fixNormalBackFacingness(rayDirectionWS, normalWS);

    vec3 albedo = oz.xyx;
    vec3 f0Reflectance = oz.xxx * 0.04;
    float roughness = 0.6;
    vec4 emissive = oz.yyyy;
    float ambient = 1.0;

    const vec3 woodAlbedo = vec3(0.15, 0.07, 0.02);

    if(abs(material.x - kMatDefault) < 0.1)
    {
        roughness = material.y;
        float metallicness = material.z;

        albedo = 0.5 * oz.xxx;

        f0Reflectance = mix(0.04*oz.xxx, oz.xxx, metallicness);
        albedo *= 1.0 - metallicness;
    }
    else if(abs(material.x - kMatWoodLog) < 0.1)
    {
        vec2 matUv = material.yz;
        vec3 woodTex = textureLod(iAudioData, matUv * 0.05, 0.0).rgb;
        albedo = woodAlbedo;
        albedo *= woodTex;

        float barkNoise = textureLod(iAudioData, matUv * vec2(0.05, 0.25), 0.0).r;
        float cracks = linearstep(0.5, 0.75, barkNoise);
        float ash = linearstep(0.45, 0.55, 1.0 - barkNoise);
        float isOuterLayer = material.z < -0.999 ? material.y : 1.0;

        material.w += (woodTex.r - cracks*2.0) * 0.2;
        float burnFactor = clamp(material.w*5.0, 0.0, 1.0);
        float burntFactor = clamp(material.w*5.0 - 0.2, 0.0, 1.0);
        float emissiveStrength = (linearstep(1.0, 0.5, woodTex.r)) * 
            max(0.0, s_globalFireLife*0.75 + 0.25) * linearstep(0.3, 0.8, isOuterLayer);
        emissive = mix(oz.yyyy, vec4(vec3(1.5, 0.07, 0.005)*emissiveStrength, 1.0), burnFactor);

        emissive = mix(emissive, oz.yyyy, burntFactor);
        vec3 burntAlbedo = mix(oz.yyy, oz.xxx * 0.5, ash);
        albedo = mix(albedo, burntAlbedo, burnFactor);

        roughness = mix(0.8, 0.975, burnFactor);
    }
    else if(abs(material.x - kMatRock) < 0.1)
    {
        //Where the rock normal points down will be the contact with the ground
        //We're likely to get shadows/AO there, do reduce the ambient (sky and ground bounce)
        ambient = linearstep(-0.6, -0.0, normalWS.y);
        vec2 matUv = material.yz;
        vec3 rockTex = textureLod(iChannel2, matUv * 0.1, 0.0).rgb;
        albedo = rockTex*0.25;

        float soot = smoothstep(0.5, -0.1, dot(normalWS, normalize(oz.yxy*0.5 - endPointWS)));
        albedo *= (0.05 + 0.95*soot);
        roughness = 0.6 + soot*0.35;
    }
    else if (abs(material.x - kMatGround) < 0.1)
    {
        float groundMat = floor(material.w)/256.0;
        ambient = fract(material.w);

        vec2 matUv = material.yz;
        vec3 albedoTex = textureLod(iAudioData, matUv * 0.5, 0.0).rgb;
        float grass = linearstep(0.4, 0.7, albedoTex.r);
        albedo = mix(vec3(0.07, 0.035, 0.005), vec3(0.01, 0.05, 0.0005), grass);

        float rockBlend = linearstep(0.45, 0.5, groundMat);
        albedo = mix(albedo, albedoTex.rrr*oz.xxx*0.2, rockBlend);
        roughness = mix(0.85, 0.775, grass);
        roughness = mix(roughness, 0.6, rockBlend);
    }
    else if (abs(material.x - kMatCoals) < 0.1)
    {
        float noise = textureLod(iAudioData, endPointWS.xz, 0.0).r;
        noise *= noise;
        albedo = oz.yyy;
        roughness = 0.95;
        
        float randBurnStrength = material.y;
        //material W is the distance to the fire logs
        float isBurning = linearstep(0.075, -0.05, randBurnStrength);
        isBurning *= noise * linearstep(0.3, 0.8, normalWS.y);
        isBurning *= max(0.0, 1.0 - s_globalFireLife*dot(endPointWS, endPointWS)*8.0);
        float emissiveStrength = 1.5 * max(0.0, s_globalFireLife*0.75 + 0.25);
        emissive = vec4(vec3(1.5, 0.05, 0.005) * emissiveStrength, 1.0) * isBurning;
    }

    vec3 sceneColour = computeLighting(endPointWS, rayDirectionWS, normalWS, albedo, 
                                  f0Reflectance, roughness, emissive, ambient);
    
    return sceneColour;
}

#define TAA 1

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float framerateBasedTaaStrength = 1.0 - clamp((iTimeDelta - 0.066) / 0.033, 0.0, 1.0);
    
    vec2 subPixelJitter = fract(hash22(fragCoord)
                                + float(iFrame%256) * kGoldenRatio * oz.xx) - 0.5*oz.xx;
    s_time = iTime * kTimeScale;
    s_pixelRand = subPixelJitter.x;
    
    InitLogs(s_time);
    
    vec2 uv = fragCoord.xy / iResolution.xy;
    
    float jitterAmount = float(TAA) * (iMouse.z > 0.1 ? 0.0 : 1.0) * framerateBasedTaaStrength;
	vec2 uvJittered = (fragCoord.xy + jitterAmount * subPixelJitter) / iResolution.xy;
    
    float aspectRatio = iResolution.x/iResolution.y;
    vec2 uvNorm = uvJittered * 2.0 - vec2(1.0);
    uvNorm.x *= aspectRatio;
    
    vec2 mouseUNorm = iMouse.xy/iResolution.xy;
    vec2 mouseNorm = mouseUNorm*2.0 - vec2(1.0);
    
    vec3 rayOriginWS;
    
    // ---- Camera setup ---- //
    vec3 cameraForwardWS, cameraUpWS, cameraRightWS;
    computeCamera(s_time, mouseNorm, iMouse, iResolution.xy, 
                  /*outs*/rayOriginWS, cameraForwardWS, cameraUpWS, cameraRightWS);
    vec3  rayDirectionWS = normalize(uvNorm.x*cameraRightWS + uvNorm.y*cameraUpWS + 
                                     kCameraPlaneDist*cameraForwardWS);
    
    vec4 inscTrans;
    vec4 material;
    float marchedDist = march(rayOriginWS, rayDirectionWS, material, inscTrans);
    
    vec3 endPointWS = rayOriginWS + rayDirectionWS * marchedDist;

    // Procedural dark night sky gradient (No cubemap needed!)
    vec3 nightHorizon = vec3(0.02, 0.04, 0.08);
    vec3 nightZenith = vec3(0.002, 0.003, 0.005);
    vec3 skyColour = mix(nightHorizon, nightZenith, clamp(rayDirectionWS.y, 0.0, 1.0));
    /*
    vec3 cubemap = textureLod(iChannel3, rayDirectionWS, 0.0).rgb;
    vec3 skyColour = max(0.0, rayDirectionWS.y) * cubemap * kSkyColour;
    */
    vec3 sceneColour = skyColour;
    
    if(marchedDist < kMaxDist)
    {
        sceneColour = computeSceneColour(endPointWS, rayDirectionWS, marchedDist, material);
    }
    
    sceneColour = sceneColour * inscTrans.a + inscTrans.rgb;
    
    //Enable this to see how the lighting works
#if 0
    if(uv.x > 0.5 && iMouse.z > 0.1)
    {
        vec3 p = rayOriginWS;// + rayDirectionWS * marchedDist;
        sceneColour = computeLighting(p, rayDirectionWS, rayDirectionWS, sin(iTime)*0.5 + 0.5, 1.0, 1.0);
    }
#endif    

    // ---- TAA part ---- //
    float taaStrength = 1.0 - min(1.0, inscTrans.r*100.0);
    taaStrength *= framerateBasedTaaStrength;
    
    //Compuute the previous frame camera
    float prevTime = s_time - iTimeDelta*kTimeScale;
    vec3 prevCameraPosWS, prevCameraForwardWS, prevCameraUpWS, prevCameraRightWS;
    computeCamera(prevTime, mouseNorm, iMouse, iResolution.xy, prevCameraPosWS, 
                  prevCameraForwardWS, prevCameraUpWS, prevCameraRightWS);
    
    vec3 currentRefPosWS = endPointWS;
    vec3 prevCameraRayDirWS = normalize(currentRefPosWS - prevCameraPosWS);
    
    //Work back to get the previous frame uv
    vec2 prevFrameUv = getScreenspaceUvFromRayDirectionWS(prevCameraRayDirWS,
    	prevCameraForwardWS, prevCameraUpWS, prevCameraRightWS, aspectRatio);
	prevFrameUv = (prevFrameUv * iResolution.xy - jitterAmount * subPixelJitter) / iResolution.xy;
    
    
    if(any(greaterThan(abs(prevFrameUv - 0.5*oz.xx), 0.5*oz.xx)))
    {
        taaStrength = 0.0;;
    }
    
    if(iMouse.z > 0.01)
    {
        taaStrength = 0.25;
        prevFrameUv = uv;
    }
    
    vec4 prevData = textureLod(iChannel0, prevFrameUv, 0.0);
    
    float prevTaaStrength = fract(prevData.a);
    float prevQuantisedMarchedDist = (prevData.a);
    //Reduce the amount of TAA of the current and previous marched distances are significantly different
    //This prevents 'dissoclusion' trails
    taaStrength *= 1.0 - clamp(abs(marchedDist - prevQuantisedMarchedDist) - 1.0, 0.0, 1.0);
    
    float blendToCurrent = mix(1.0, 1.0/8.0, taaStrength);
    taaStrength = mix(prevTaaStrength, taaStrength, blendToCurrent);
    blendToCurrent = mix(1.0, 1.0/8.0, taaStrength);
    
    
#if !TAA    
    blendToCurrent = 1.0;
#endif
    
    
    sceneColour = max(oz.yyy, mix(prevData.rgb, sceneColour, blendToCurrent));
    //Prevent super bright highlights
    sceneColour = min(oz.xxx * 6.0, sceneColour);
    
    float quantisedDist = floor(marchedDist);
    
    fragColor = vec4(sceneColour, quantisedDist + 0.999*taaStrength);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}

