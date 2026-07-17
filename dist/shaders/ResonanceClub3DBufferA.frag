// https://www.shadertoy.com/view/sXV3zR
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: Resonance Club 3D (audio) - Buffer A
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

//1001
#define PI 3.14159265
#define RING_LAYOUT 0
#define AUTO_LEVEL 0.7
#define XFADE_LEN 0.5
#define NUM_SCENES 20
#define REFLECTION_BOUNCES 2
#define ENABLE_SHADOWS

#define MAT_ROOM   0
#define MAT_CENTER 1
#define MAT_RING   2

float vmax(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

float fBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

float hash11(float x) {
    return fract(sin(x*12.9898 + 78.233)*43758.5453);
}

vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

void rotateAxis(inout vec2 p, float a)
{
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

const float BAND_EDGE[9] = float[](0.0020, 0.0065, 0.0140, 0.0300, 0.0600, 0.1100, 0.2000, 0.3500, 0.6000);
const float BAND_TILT[8] = float[](0.00, 0.02, 0.07, 0.12, 0.18, 0.24, 0.30, 0.36);

float audio[8];
float gBass, gMid, gHigh;
float gEnergy, gCentroid;
float gCamSpeed;
float gBPMPulse;

float bandAvg(float lo, float hi)
{
    float s = 0.0;
    for (int k = 0; k < 4; k++)
        s += texture(iAudioData, vec2(mix(lo, hi, (float(k) + 0.5)/4.0), 0.25)).x;
    return s * 0.25;
}

void populateSoundArray()
{
    float a[8];
    float rawMean = 0.0;
    float tiltMean = 0.0;

    for (int i = 0; i < 8; i++)
    {
        float raw = bandAvg(BAND_EDGE[i], BAND_EDGE[i+1]);
        rawMean += raw;
        a[i] = clamp(raw + BAND_TILT[i], 0.0, 1.0);
        tiltMean += a[i];
    }
    rawMean  *= 0.125;
    tiltMean *= 0.125;

    float gate = smoothstep(0.01, 0.15, rawMean);
    float shift = (0.45 - tiltMean) * AUTO_LEVEL;

    float wSum = 0.0;
    float cSum = 0.0;
    for (int i = 0; i < 8; i++)
    {
        float v    = smoothstep(0.20, 0.90, a[i] + shift);
        float idle = 0.12 + 0.10 * sin(iTime*0.9 + float(i)*0.8);
        audio[i] = mix(idle, v, gate);
        wSum += audio[i];
        cSum += audio[i] * float(i);
    }

    gBass     = clamp(audio[0]*0.7 + audio[1]*0.3, 0.0, 1.0);
    gMid      = (audio[2] + audio[3] + audio[4]) / 3.0;
    gHigh     = (audio[5] + audio[6] + audio[7]) / 3.0;
    gEnergy   = gate * clamp((gBass + gMid + gHigh) * 0.5, 0.0, 1.0);
    gCentroid = clamp(cSum / (wSum + 1e-3) / 7.0, 0.0, 1.0);

    gCamSpeed = 0.5 + 0.9 * smoothstep(0.1, 0.8, gEnergy);

    float beatClock = iTime * 2.1;
    float beatPhase = fract(beatClock);
    gBPMPulse = exp(-4.0 * beatPhase) * smoothstep(0.2, 0.7, gBass);
}

vec3 gRingLow, gRingHigh, gAccent;

float ringBand(float cell, float count)
{
    float wi = mod(cell, count);
    float m = min(wi, count - wi) / (0.5*count);
    float f = m * 7.0;
    int i0 = int(f);
    int i1 = min(i0 + 1, 7);
    float val = mix(audio[i0], audio[i1], fract(f));
    
    return smoothstep(0.15, 0.85, val);
}

float ringMelodyBand(float cell, float count)
{
    float wi = mod(cell, count);
    float m = min(wi, count - wi) / (0.5 * count);
    
    float f = 2.0 + m * 5.0; 
    int i0 = int(f);
    int i1 = min(i0 + 1, 7);
    
    float melodyValue = mix(audio[i0], audio[i1], fract(f));
    melodyValue = smoothstep(0.35, 0.85, melodyValue);
    return pow(melodyValue, 2.0);
}

float ringBandAt(vec3 p)
{
    float count = (length(p.xz) > 4.0) ? 32.0 : 16.0;
    float angle = 2.0*PI/count;
    float c = floor((atan(p.z, p.x) + 0.5*angle) / angle);
    return ringBand(c, count);
}

float ringCubes(vec3 p, float radius, float count, vec3 cubeSize)
{
    float r  = length(p.xz);
    float lb = max(abs(r - radius) - 0.2, p.y - 3.4);
    if (lb > 0.9) return lb;

    float angle = 2.0*PI/count;
    float c = floor((atan(p.z, p.x) + 0.5*angle) / angle);

    float d = 1e5;
    float bassJump = pow(gBass, 3.0) * 0.8;

    for (int k = -1; k <= 1; k++)
    {
        float ci = c + float(k);
        float ang = ci * angle;
        float cs = cos(ang);
        float sn = sin(ang);
        vec2 q = vec2(cs*p.x + sn*p.z, -sn*p.x + cs*p.z);
        
        float h = 0.1 + 1.5 * ringBand(ci, count) + bassJump;
        d = min(d, fBox(vec3(q.x - radius, p.y - h, q.y), cubeSize + vec3(0.0, h, 0.0)));
    }
    return max(min(d, 0.9), lb);
}


float ringCubesMelody(vec3 p, float radius, float count, vec3 cubeSize)
{
    float r  = length(p.xz);
    float lb = max(abs(r - radius) - 0.2, p.y - 3.4);
    if (lb > 0.9) return lb;

    float angle = 2.0*PI/count;
    float c = floor((atan(p.z, p.x) + 0.5*angle) / angle);

    float d = 1e5;

    for (int k = -1; k <= 1; k++)
    {
        float ci = c + float(k);
        float ang = ci * angle;
        float cs = cos(ang);
        float sn = sin(ang);
        vec2 q = vec2(cs*p.x + sn*p.z, -sn*p.x + cs*p.z);
        
        float hitPower = ringMelodyBand(ci, count);
        float h = 0.7 - (0.6 * hitPower);
        
        d = min(d, fBox(vec3(q.x - radius, p.y - h, q.y), cubeSize + vec3(0.0, h, 0.0)));
    }
    return max(min(d, 0.9), lb);
}

float mapRoom(vec3 p)
{
    float roomScale = 1.0 + gBPMPulse * 0.015;
    float floorD   = p.y;
    float ceilingD = (12.0 * roomScale) - p.y;
    float wallsD   = (14.0 * roomScale) - max(abs(p.x), abs(p.z));
    return min(min(floorD, ceilingD), wallsD);
}

vec3 centerLocal(vec3 p)
{
    p.y -= 1.5;
    rotateAxis(p.yz, radians(45.0) + iTime*0.5 + gBass*0.3);
    rotateAxis(p.xy, PI/4.0 + iTime*0.3);
    return p;
}

vec3 centerHalfSize()
{
    return vec3(0.5) + vec3(0.2)*gBass + vec3(0.05)*gBPMPulse;
}

float mapCenter(vec3 p)
{
    return fBox(centerLocal(p), centerHalfSize());
}

float mapRings(vec3 p)
{
    vec3 cubeSize = vec3(0.15 + 0.02 * gBPMPulse);
    return min(ringCubes(p, 6.5, 32.0, cubeSize),
               ringCubesMelody(p, 2.8, 16.0, cubeSize));
}

float distFunc(vec3 p)
{
    return min(min(mapRoom(p), mapCenter(p)), mapRings(p));
}

vec3 getNormal( in vec3 pos )
{
    vec2 e = vec2(1.0, -1.0) * 0.5773 * 0.002;
    return normalize( e.xyy*distFunc( pos + e.xyy ) +
                      e.yyx*distFunc( pos + e.yyx ) +
                      e.yxy*distFunc( pos + e.yxy ) +
                      e.xxx*distFunc( pos + e.xxx ) );
}

int getMaterial(vec3 p)
{
    float dr = mapRoom(p);
    float dc = mapCenter(p);
    float dg = mapRings(p);
    if (dc < dg && dc < dr) return MAT_CENTER;
    if (dg < dr)            return MAT_RING;
    return MAT_ROOM;
}

bool isVideoWall(vec3 p)
{
    return p.z > 13.9 && p.z >= abs(p.x) && p.y > 0.05 && p.y < 11.95;
}

float reflectivity(vec3 p, int mat)
{
    if (mat == MAT_ROOM)   return isVideoWall(p) ? 0.02 : 0.45;
    if (mat == MAT_CENTER) return 0.55; 
    if (mat == MAT_RING)   return 0.1 + ringBandAt(p) * 0.4;
    return 0.1;
}

vec3 getMaterialColor(vec3 p, int mat)
{
    if (mat == MAT_ROOM) return vec3(0.02);

    if (mat == MAT_CENTER)
    {
        vec3 lp = centerLocal(p);
        float tPulse = iTime * 0.5;
        float dots = sin(lp.x*15.0 + tPulse) * sin(lp.y*15.0 - tPulse) * sin(lp.z*15.0 + tPulse);
        float pattern = smoothstep(0.7 - gBass*0.3, 0.95, dots);
        return vec3(0.002) + gAccent * (0.3 + 0.2*gBPMPulse) * pattern * gBass;
    }

    float isOuterRing = step(4.0, length(p.xz));
    float count = isOuterRing > 0.5 ? 32.0 : 16.0;
    float angle = 2.0*PI/count;
    float c = floor((atan(p.z, p.x) + 0.5*angle) / angle);

    float cellAudio = isOuterRing > 0.5 ? ringBand(c, count) 
                                        : ringMelodyBand(c, count);

    float cSize = 0.15 + 0.02 * gBPMPulse;
    
    float currentHeight;
    if (isOuterRing > 0.5) {
        float bassJump = pow(gBass, 3.0) * 0.8;
        currentHeight = 0.1 + 1.5 * cellAudio + bassJump;
    } else {
        currentHeight = 0.7 - (0.6 * cellAudio);
    }
    
    float topY = currentHeight * 2.0 + cSize;
    float distToTop = abs(p.y - topY);
    float isHat = smoothstep(0.12, 0.01, distToTop);

    vec3 ringBase = mix(gRingLow, gRingHigh, cellAudio) * 0.35;
    
    vec3 hatGlow = gAccent * isHat * (0.8 + 2.5 * cellAudio + 0.5 * gBPMPulse);

    float hiHatFreq = max(audio[6], audio[7]);
    float hiHatPunch = pow(hiHatFreq, 2.5); 
    vec3 sparkleCol = mix(vec3(0.9, 0.95, 1.0), gAccent, 0.3); 
    hatGlow += sparkleCol * isHat * hiHatPunch * 4.0; 

    float isBase = smoothstep(0.3, -0.15, p.y); 
    float bassPunch = pow(gBass, 2.5);
    vec3 baseGlow = (isOuterRing > 0.5) ? gRingLow * isBase * bassPunch * 2.5 : vec3(0.0);

    return ringBase + hatGlow + baseGlow;
}

float softshadow(const vec3 origin, in vec3 dir, in float mint, in float tmax, float k)
{
    float res = 1.0;
    float t = mint;
    for( int i=0; i<16; i++ )
    {
        float h = distFunc( origin + dir*t );
        res = min( res, k*h/t );
        t += clamp( h, 0.01, 0.10 );
        if( h<0.001 || t>tmax ) break;
    }
    return clamp( res, 0.0, 1.0 );
}

vec3 getLightPos(int i) {
    if (i == 3) {
        float tOuter = iTime * 0.3;
        return vec3(7.5 * cos(tOuter), 6.0 + 2.0 * sin(tOuter * 0.5), 7.5 * sin(tOuter));
    }

    float t = iTime * 0.5;
    float offset = float(i) * 2.094395; 
    float r = 4.2 + 1.5 * sin(t * 0.8 + offset);
    float y = 5.0 + 3.0 * cos(t * 1.2 + offset);
    return vec3(r * cos(t + offset), y, r * sin(t + offset));
}

vec3 getLightColor(int i) {
    if (i == 0) return vec3(1.0, 0.1, 0.2); 
    if (i == 1) return vec3(0.1, 1.0, 0.3); 
    if (i == 2) return vec3(0.1, 0.4, 1.0); 
    return vec3(0.9, 0.9, 0.9); 
}

const float lightAttenuation = 0.015;

void getLaserBeam(int idx, float time, out vec3 lOrigin, out vec3 lDir, out vec3 lCol, out float intensity, out float beamWidth)
{
    float numBeams = 4.0;
    float beamIdx = float(idx);
    float discreteAngle = (beamIdx + 0.5) * (2.0*PI) / numBeams - PI;

    lOrigin = vec3(10.0*cos(discreteAngle), 11.5, 10.0*sin(discreteAngle));
    
    float audioFreq = audio[int(mod(beamIdx * 2.0, 8.0))];
    float punch = pow(audioFreq, 3.0); 
    
    vec3 targetPoint = vec3(
        6.0 * sin(time * 2.0 + beamIdx * 2.0 + punch * 0.5),
        -2.0,
        6.0 * cos(time * 1.7 + beamIdx * 2.0 - punch * 0.5)
    );

    lDir = normalize(targetPoint - lOrigin);
    lCol = mix(gAccent, gRingHigh, audioFreq);
    
    intensity = punch * 3.5 + 0.01;
    beamWidth = 0.996 - punch * 0.008; 
}

vec3 getShadedColor( vec3 hitPosition, vec3 normal, vec3 viewPos )
{
    int  mat      = getMaterial(hitPosition);
    bool isRoom   = (mat == MAT_ROOM);
    bool isCenter = (mat == MAT_CENTER);
    bool isRing   = (mat == MAT_RING);
    bool isVideo  = isRoom && isVideoWall(hitPosition);

    vec3 surfaceToCamera = normalize(viewPos - hitPosition);
    vec3 surfaceColor = getMaterialColor(hitPosition, mat);
    vec3 emission = vec3(0.0);

    if (isVideo)
    {
        vec2 uv = vec2(0.5 - hitPosition.x / 28.0, hitPosition.y / 12.0);
        float gl = smoothstep(0.85, 1.0, max(gBass, gHigh)); 
        vec3 texCol;

        if (gl > 0.02)
        {
            float gridRes = 15.0;
            vec2 gridId = floor(uv * gridRes);
            float glitchHash = fract(sin(dot(gridId, vec2(12.9898, 78.233)) + floor(iTime*10.0)) * 43758.5453);

            if (glitchHash < gl * 0.1) 
            {
                uv.x += (fract(glitchHash*13.0) - 0.5) * 0.02;
                uv.y += (fract(glitchHash*17.0) - 0.5) * 0.02;
            }

            float r = texture(iChannel1, uv + vec2(0.005*gl, 0.0)).r;
            float g = texture(iChannel1, uv).g;
            float b = texture(iChannel1, uv - vec2(0.005*gl, 0.0)).b;
            texCol = vec3(r, g, b);
        }
        else
        {
            texCol = texture(iChannel1, uv).rgb;
        }
        surfaceColor = texCol * 0.65;
        emission     = texCol * 0.65;
    }

    if (isCenter)
    {
        vec3 lp = centerLocal(hitPosition);
        vec3 dEdge = abs(abs(lp) - centerHalfSize());
        float edgeThresh = 0.02;
        float edges = step(dEdge.x, edgeThresh)*step(dEdge.y, edgeThresh) +
                      step(dEdge.y, edgeThresh)*step(dEdge.z, edgeThresh) +
                      step(dEdge.z, edgeThresh)*step(dEdge.x, edgeThresh);

        float tPulse = iTime * 0.5;
        float dots = sin(lp.x*15.0 + tPulse) * sin(lp.y*15.0 - tPulse) * sin(lp.z*15.0 + tPulse);
        float pattern = smoothstep(0.7 - gBass*0.3, 0.95, dots);

        emission = gAccent * clamp(edges, 0.0, 1.0) * (1.2 + gBass*2.0 + gBPMPulse*1.0)
                 + gAccent * 0.6 * pattern * (0.5 + gBass*1.5);
    }

    vec3 globalLightPos = vec3(sin(iTime)*2.0, 8.0, cos(iTime)*2.0);
    vec3 globalLightDir = normalize(globalLightPos - hitPosition);
    vec3 globalLightCol = vec3(0.5 + 0.5 * gBass);

    float globalDiff = max(0.0, dot(normal, globalLightDir));
    float globalSpec = 0.0;

    if (globalDiff > 0.0 && !isVideo) {
        float shininess = 32.0;
        if (isRoom)        shininess = 80.0;
        else if (isCenter) shininess = 128.0;
        else               shininess = 16.0 + 64.0*ringBandAt(hitPosition);
        globalSpec = pow(max(0.0, dot(surfaceToCamera, reflect(-globalLightDir, normal))), shininess);
    }

    float globalShadow = 1.0;
    if (isRing) {
        globalShadow = max(0.2, softshadow(hitPosition + normal*0.01, globalLightDir, 0.02, 8.0, 8.0));
    }

    vec3 totalDiffuse = globalLightCol * globalDiff * globalShadow;
    vec3 totalSpecular = globalLightCol * globalSpec * globalShadow;

    for (int i = 0; i < 4; i++) 
    {
        vec3 lp = getLightPos(i);
        vec3 lc = getLightColor(i);
        vec3 surfaceToLight = normalize(lp - hitPosition);
        float dist = length(lp - hitPosition);
        float atten = 1.0 / (1.0 + lightAttenuation * dist * dist);

        float diff = max(0.0, dot(normal, surfaceToLight));
        float spec = 0.0;

        if (diff > 0.0 && !isVideo)
        {
            float shininess = 32.0;
            if (isRoom)        shininess = 80.0;
            else if (isCenter) shininess = 128.0;
            else               shininess = 16.0 + 64.0*ringBandAt(hitPosition);
            spec = pow(max(0.0, dot(surfaceToCamera, reflect(-surfaceToLight, normal))), shininess);
        }

        totalDiffuse += lc * diff * atten;
        totalSpecular += lc * spec * atten;
    }

    for (int j = 0; j < 4; j++) 
    {
        vec3 lOrigin, lDir, lCol;
        float intensity, beamWidth;
        getLaserBeam(j, iTime, lOrigin, lDir, lCol, intensity, beamWidth);
        
        vec3 surfaceToLight = normalize(lOrigin - hitPosition);
        float dist = length(lOrigin - hitPosition);
        
        float alignment = dot(normalize(hitPosition - lOrigin), lDir);
        float beam = smoothstep(beamWidth, 0.999, alignment);
        
        if (beam > 0.0 && !isVideo) {
            float diff = max(0.0, dot(normal, surfaceToLight));
            float spec = 0.0;
            if (diff > 0.0) {
                float shininess = (isCenter) ? 128.0 : (isRoom ? 80.0 : 16.0 + 64.0*ringBandAt(hitPosition));
                spec = pow(max(0.0, dot(surfaceToCamera, reflect(-surfaceToLight, normal))), shininess);
            }
            
            float atten = exp(-dist * 0.06);
            vec3 beamImpact = lCol * beam * atten * intensity * 15.0; 
            
            totalDiffuse += beamImpact * diff;
            totalSpecular += beamImpact * spec * 2.0; 
        }
    }

    if (isRoom && !isVideo) totalSpecular *= 3.0;
    else if (isCenter)      totalSpecular *= 4.0;
    else if (isRing)        totalSpecular *= 2.0 + gHigh*2.0;

    totalDiffuse *= 0.65;
    totalSpecular *= 0.65;

    vec3 ambientColor = surfaceColor * vec3(0.1 + 0.2*gBass + 0.1*gBPMPulse) * ((isRoom && !isVideo) ? 0.3 : 0.6);

    vec3 combinedLight = ambientColor + totalDiffuse * surfaceColor + totalSpecular * vec3(1.0) + emission;
    return 1.0 - exp(-combinedLight * 1.1);
}

const int   MAX_STEPS  = 160;
const float MAX_T      = 40.0;
const float STEP_SCALE = 0.5;

float trace(vec3 ro, vec3 rd, out vec3 point, out bool objectHit)
{
    float t = 0.01;
    point = ro;
    for (int i = 0; i < MAX_STEPS; ++i)
    {
        point = ro + t*rd;
        float dist = distFunc(point);
        if (dist < 0.0006 + 0.0003*t)
        {
            objectHit = true;
            return t;
        }
        t += dist * STEP_SCALE;
        if (t > MAX_T) break;
    }
    objectHit = false;
    return MAX_T;
}

vec3 renderVolumetricLasers(vec3 ro, vec3 rd, float maxDist, float time, vec2 fragCoord)
{
    vec3 laserColor = vec3(0.0);
    const float stepSize = 0.5;
    
    float jitter = fract(sin(dot(fragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);

    for (float t = 2.0; t < 30.0; t += stepSize)
    {
        float d = t + jitter*stepSize;
        if (d > maxDist) break;

        vec3 p = ro + rd*d;
        float angle   = atan(p.z, p.x);
        float beamIdx = min(floor((angle + PI) / (2.0*PI) * 4.0), 3.0);
        
        vec3 lOrigin, lDir, lCol;
        float intensity, beamWidth;
        getLaserBeam(int(beamIdx), time, lOrigin, lDir, lCol, intensity, beamWidth);
        
        vec3 toPoint = p - lOrigin;
        float dist = length(toPoint);
        vec3 dir = toPoint / dist;

        float alignment = dot(dir, lDir);
        float beam = smoothstep(beamWidth, 0.999, alignment);

        float smoke = sin(p.x*2.5 + time*1.5) * sin(p.y*1.8 - time) * sin(p.z*2.2 + time*1.2);
        smoke = smoke*0.5 + 0.5;

        float distFade = exp(-dist*0.06); 
        laserColor += lCol * beam * distFade * intensity * (0.4 + smoke*0.4 + 0.3*gBPMPulse);
    }
    return laserColor;
}

vec3 renderFloorFog(vec3 ro, vec3 rd, float maxDist, float time)
{
    float fogHeightDecay = 0.8; 
    float dist = min(maxDist, 25.0);

    vec3 pMid = ro + rd * (dist * 0.5);

    float noise = sin(pMid.x * 0.4 + time * 0.8) * cos(pMid.z * 0.4 - time * 0.6)
                + sin(pMid.x * 0.8 - time) * sin(pMid.z * 0.8 + time * 1.2);
    noise = noise * 0.25 + 0.5;

    float heightFactor = exp(-max(0.0, pMid.y) * fogHeightDecay);
    float fogDensity = heightFactor * dist * 0.025 * (0.6 + 0.8 * gBass + 0.4 * gBPMPulse) * noise;

    vec3 fogColor = mix(gRingLow, vec3(0.05, 0.08, 0.15), 0.5) + gAccent * 0.2 * gBass;

    return fogColor * clamp(fogDensity, 0.0, 0.6);
}

void getSequenceState(float t, out float blockId, out float localTime) {
    float phraseLen = 16.0; 
    float macroBlock = floor(t / phraseLen);
    float local16 = mod(t, phraseLen);
    
    float pattern = hash11(macroBlock * 7.13);
    
    if (pattern < 0.6) {
        blockId = macroBlock * 10.0;
        localTime = local16;
    } else {
        float sub = floor(local16 / 8.0);
        blockId = macroBlock * 10.0 + sub + 1.0;
        localTime = mod(local16, 8.0);
    }
}

float sceneHue(float b)
{
    return 0.5 + 0.6 * hash11(b*3.7 + 1.3);
}

void getCameraShot(int id, float lt, float beat, float camClock, out vec3 off, out vec3 tgt, out float roll)
{
    float dirMult = (mod(float(id), 2.0) == 0.0) ? -1.0 : 1.0;

    off = vec3(4.0, 4.0, 4.0);

    if (id == 0) {
        float r = 7.5; 
        off = vec3(r * cos(dirMult * camClock * 0.2), 2.0, r * sin(dirMult * camClock * 0.2));
    } else if (id == 1) {
        float r = 2.5; 
        off = vec3(r * cos(dirMult * camClock * 0.3), 1.2, r * sin(dirMult * camClock * 0.3));
    } else if (id == 2) {
        float r = 12.0; 
        off = vec3(r * sin(dirMult * camClock * 0.15), 5.0, r * cos(dirMult * camClock * 0.15));
    } else if (id == 3) {
        float r = 4.0; 
        off = vec3(r * cos(-dirMult * camClock * 0.25), 0.8, r * sin(-dirMult * camClock * 0.25));
    } else if (id == 4) {
        float ang = camClock * 0.2;
        off = vec3(3.5 * cos(ang), 2.0, 3.5 * sin(ang));
    } else if (id == 5) {
        float r = 4.5; 
        off = vec3(r * cos(camClock * 0.25), 1.5 + 0.3 * sin(camClock * 0.3), r * sin(camClock * 0.25));
    } else if (id == 6) {
        float r = 8.0 - lt * 0.15; 
        off = vec3(r * cos(camClock * 0.15), max(2.0, 9.0 - lt * 0.3), r * sin(camClock * 0.15));          
    } else if (id == 7) {
        off = vec3(12.0 * cos(camClock * 0.1), 1.5, 12.0 * sin(camClock * 0.1));
    } else if (id == 8) {
        float r = 3.2; 
        off = vec3(r * cos(camClock * 0.25), 0.8, r * sin(camClock * 0.25));
    } else if (id == 9) {
        off = vec3(0.0, 1.2, max(6.0, 12.0 - lt * 0.4));                    
    } else if (id == 10) {
        float r = 5.0 + 2.0 * sin(camClock * 0.2); 
        float ang = camClock * 0.3; 
        off = vec3(r * cos(ang), 2.5 + sin(camClock * 0.15), r * sin(ang));
    } else if (id == 11) {
        off = vec3(7.5 * cos(camClock * 0.3), 0.8, 7.5 * sin(camClock * 0.3));
    } else if (id == 12) {
        off = vec3(-6.0, 3.5 + 1.0 * sin(camClock * 0.2), 6.0 + sin(camClock * 0.15) * 2.0);
    } else if (id == 13) {
        float r = 8.0; 
        off = vec3(r * cos(-camClock * 0.25), 6.0 + 1.5 * sin(camClock * 0.2), r * sin(-camClock * 0.25));
    } else if (id == 14) {
        off = vec3(sin(camClock * 0.2) * 8.0, 3.0, -8.0);
    } else if (id == 15) {
        float r = 1.8 + 0.4 * sin(camClock * 0.3);
        float ang = camClock * 0.25;
        off = vec3(r * cos(ang), 1.2 + 0.3 * cos(camClock * 0.2), r * sin(ang));
    } else if (id == 16) {
        off = vec3(13.5 * cos(camClock * 0.08), 9.0, 13.5 * sin(camClock * 0.08));
    } else if (id == 17) {
        off = vec3(0.0, 2.0, -5.0 - lt * 0.4);
    } else if (id == 18) {
        float r = 4.2; 
        off = vec3(r * sin(camClock * 0.3), 1.2, r * cos(camClock * 0.3));
    } else if (id == 19) {
        float drift = camClock * 0.15;
        float r = 1.8; 
        off = vec3(r * cos(drift), 1.5 + 0.2 * sin(drift * 1.2), r * sin(drift));
    }

    vec3 defaultTarget = vec3(0.0, 1.5, 0.0);
    vec3 dynamicTarget = vec3(1.5 * cos(iTime * 0.4), 1.5 + 0.5 * sin(iTime * 0.3), 1.5 * sin(iTime * 0.4));
    float focusMix = smoothstep(0.2, 0.8, sin(iTime * 0.15) * 0.5 + 0.5);
    tgt = mix(defaultTarget, dynamicTarget, focusMix);

    if (id == 6)      tgt = vec3(0.0, 1.0, 0.0);
    else if (id == 9) tgt = vec3(0.0, 1.5, -10.0);
    else if (id == 15) {
        tgt = vec3(0.3 * cos(iTime * 0.3), 1.5 + 0.2 * sin(iTime * 0.2), 0.3 * sin(iTime * 0.4));
    }
    else if (id == 19) {
        tgt = vec3(0.2 * cos(iTime * 0.3), 1.5 + 0.2 * sin(iTime * 0.2), 0.2 * sin(iTime * 0.3));
    }

    roll = (id == 11 || id == 18) ? sin(camClock * 0.6) * 0.15 : 0.0;
}

mat3 setCameraMatrix(int sceneId, int prevSceneId, float lt, float prevLt, float k, float blk, float beat, float camClock, out vec3 camPos)
{
    vec3 camOff, target; float camRoll;
    getCameraShot(sceneId, lt, beat, camClock, camOff, target, camRoll);

    if (lt < XFADE_LEN)
    {
        vec3 o2, t2; float r2;
        getCameraShot(prevSceneId, prevLt + lt, beat, camClock, o2, t2, r2);
        camOff  = mix(o2, camOff, k);
        target  = mix(t2, target, k);
        camRoll = mix(r2, camRoll, k);

        float whip = sin(k * PI); 
        float whipDir = sign(hash11(blk) - 0.5);
        camRoll += whip * 0.8 * whipDir;
        target += vec3(whip * 15.0 * whipDir, whip * 5.0, whip * -5.0); 
        camOff += vec3(0.0, whip * 2.0, 0.0); 
    }

    camPos = camOff;

    vec3 cw = normalize(target - camPos);
    vec3 cp = vec3(sin(camRoll), cos(camRoll), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    populateSoundArray();

    float blk, lt;
    getSequenceState(iTime, blk, lt);

    float prevBlk, prevLt;
    getSequenceState(iTime - lt - 0.05, prevBlk, prevLt);

    int prevSceneId = int(mod(hash11(prevBlk * 13.7) * 100.0, float(NUM_SCENES)));
    int sceneId = int(mod(hash11(blk * 13.7) * 100.0, float(NUM_SCENES)));

    if (sceneId == prevSceneId) sceneId = (sceneId + 1) % NUM_SCENES;

    float k = smoothstep(0.0, 1.0, clamp(lt / XFADE_LEN, 0.0, 1.0));

    float hue = mix(sceneHue(prevBlk), sceneHue(blk), k) + (gCentroid - 0.5)*0.15;
    gRingLow  = hsv2rgb(vec3(fract(hue + 0.04), 1.0,  0.45));
    gRingHigh = hsv2rgb(vec3(fract(hue - 0.04), 0.85, 1.0));
    gAccent   = hsv2rgb(vec3(fract(hue + 0.50), 0.90, 1.0));

    float beat = smoothstep(0.3, 0.8, gBass) * 0.6;


    float camClock = iTime * gCamSpeed;

    vec3 camP;
    mat3 cameraMatrix = setCameraMatrix(sceneId, prevSceneId, lt, prevLt, k, blk, beat, camClock, camP);

    vec2 p = (-iResolution.xy + 2.0*fragCoord.xy) / iResolution.y;
    vec3 rd0 = cameraMatrix * normalize(vec3(p.xy, 1.8));   

    vec3 point;
    bool objectHit;
    vec3 color = vec3(0.0);

    float t = trace(camP, rd0, point, objectHit);

    if (objectHit)
    {
        vec3 normal = getNormal(point);
        color = getShadedColor(point, normal, camP);

        float refStrength = reflectivity(point, getMaterial(point));
        vec3 rd  = rd0;
        vec3 pos = point;
        vec3 nor = normal;

        for (int i = 0; i < REFLECTION_BOUNCES; i++)
        {
            if (refStrength <= 0.001) break;

            rd = reflect(rd, nor);
            vec3 ro = pos + nor*0.01;
            vec3 pr;
            bool hr;
            trace(ro, rd, pr, hr);
            if (!hr) break;

            vec3 nr = getNormal(pr);
            color += refStrength * getShadedColor(pr, nr, ro);

            pos = pr;
            nor = nr;
            refStrength *= 0.4;
        }
    }
    else
    {
        t = MAX_T;
    }

    for (int i = 0; i < 4; i++) {
        vec3 lp = getLightPos(i);
        vec3 lc = getLightColor(i);

        float tL = dot(lp - camP, rd0);
        tL = clamp(tL, 0.0, t); 

        vec3 pOnRay = camP + rd0 * tL;
        float distToRay = length(lp - pOnRay);

        float audioReact = (i==0) ? gBass : ((i==1) ? gMid : ((i==2) ? gHigh : gEnergy));

        float core = 0.015 / (distToRay * distToRay + 0.02);
        float halo = 0.05 / (distToRay + 0.15);
        float glow = (core + halo) * (0.4 + 1.1 * audioReact);

        if (i == 3) glow *= 0.4;

        color += lc * glow * exp(-tL * 0.05); 
    }

    vec3 fogColor = vec3(0.02, 0.025, 0.04);
    float fogFactor = clamp(exp(-t * (0.004 + 0.006*gEnergy)), 0.0, 1.0);
    color = mix(fogColor, color, fogFactor);

    color += renderFloorFog(camP, rd0, t, iTime);
    color += renderVolumetricLasers(camP, rd0, t, iTime, fragCoord);

    fragColor = vec4(color, clamp((t - 6.0)/15.0, 0.0, 1.0));
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
