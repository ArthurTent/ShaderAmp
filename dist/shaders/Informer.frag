// https://www.shadertoy.com/view/XtKXDh
// Created by voz
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

//-----------------CONSTANTS MACROS-----------------

#define PI 3.14159265359
#define E 2.7182818284
#define GR 1.61803398875
#define MAX_DIM (max(iResolution.x,iResolution.y))
#define FAR (PI*2.0)

//-----------------UTILITY MACROS-----------------

#define time ((sin(float(__LINE__))/PI/GR+1.0)*iGlobalTime+1000.0+last_height)
#define sphereN(uv) (clamp(1.0-length(uv*2.0-1.0), 0.0, 1.0))
#define clip(x) (smoothstep(0.0, 1.0, x))
#define TIMES_DETAILED (1.0)
#define angle(uv) (atan(uv.y, uv.x))
#define angle_percent(uv) ((angle(uv)/PI+1.0)/2.0)
#define hash(p) (fract(sin(vec2( dot(p,vec2(127.5,313.7)),dot(p,vec2(239.5,185.3))))*43458.3453))

#define flux(x) (vec3(cos(x),cos(4.0*PI/3.0+x),cos(2.0*PI/3.0+x))*.5+.5)
#define rormal(x) (normalize(sin(vec3(time, time/GR, time*GR)+seedling)*.25+.5))
#define rotatePoint(p,n,theta) (p*cos(theta)+cross(n,p)*sin(theta)+n*dot(p,n) *(1.0-cos(theta)))
#define circle(x) (vec2(cos((x)*PI), sin((x)*PI)))
#define saw(x) fract( sign( 1.- mod( abs(x), 2.) ) * abs(x) )

float last_height = 0.0;
float beat = 0.0;
vec3 eye = vec3 (0.0);

mat2 rot(float x) {
    return mat2(cos(x), sin(x), -sin(x), cos(x));
}

float sdSphere(vec3 rp, vec3 rd, vec3 bp, float r) {
    //return length(bp - rp) - r;
    
    vec3 oc = eye - bp;
    float b = 2.0 * dot(rd, oc);
    float c = dot(oc, oc) - r*r;
    float disc = b * b - 4.0 * c;

    if (disc < 0.0)
        return FAR;

    // compute q as described above
    float q;
    if (b < 0.0)
        q = (-b - sqrt(disc))/2.0;
    else
        q = (-b + sqrt(disc))/2.0;

    float t0 = q;
    float t1 = c / q;

    // make sure t0 is smaller than t1
    if (t0 > t1) {
        // if t0 is bigger than t1 swap them around
        float temp = t0;
        t0 = t1;
        t1 = temp;
    }
    
    return length(bp - rp) - r;
}

float sdCapsule(vec3 rp, vec3 rd, vec3 a, vec3 b, float r) {
    vec3 pa = rp - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    
    vec3 ray = rd;
    vec3 ray2 = normalize(b-a);

    float a1 = dot(ray,ray);
    float b1 = dot(ray,ray2);
    float c = dot(ray2,ray2);
    float d = dot(ray,eye-a);
    float e = dot(eye-a,ray2);

    float t1 = (b1*e-c*d)/(a1*c-b1*b1);
    float t2 = (a1*e-b1*d)/(a1*c-b1*b1);

    float dist = length((eye+ray*t1)-(a+ray2*t2));
    return dist > r || t2 < r || t2 > length(a-b)+r? FAR : length(pa - ba * h) - r;
}


const int NUM_ANGLES = 5;
const int ELBOWS = 0;
const int WRISTS = 1;
const int FINGERS = 2;
const int KNEES = 3;
const int ANKLES = 4;
// stance structure:
//{
//	vec4(leftLegOmega, leftLegTheta, rightLegOmega, rightLegTheta)),
//	vec4(relativeLeftElbowOmega, relativeLeftElbowTheta, relativeRightElbowOmega, relativeRightElbowTheta)),
//	vec4(relativeLeftWristOmega, relativeLeftWristTheta, relativeRightWristOmega, relativeRightWristTheta)),
//	vec4(relativeLeftFingersOmega, relativeLeftFingersTheta, relativeRightFingersOmega, relativeRightFingersTheta)),
//	vec4(leftLegOmega, LeftLegTheta, rightLegOmega, rightLegTheta)),
//	vec4(relativeLeftKneeOmega, relativeLeftKneeTheta, relativeRightKneeOmega, relativeRightKneeTheta)),
//	vec4(relativeLeftAnkleOmega, relativeLeftAnkleTheta, relativeRightAnkleOmega, relativeRightAnkleTheta)),
//}
//
vec4  saved_stance[NUM_ANGLES];
vec4  stance[NUM_ANGLES];

float saved_shoulderRot = 0.0;
float shoulderRot = 0.0;

float saved_hipRot = 0.0;
float hipRot = 0.0;

float saved_lean = 0.0;
float lean = 0.0;

//body joints
vec3 head = vec3(0.0);

vec3 bSpine = vec3(0.0);
vec3 uSpine = vec3(0.0);

vec3 leftShoulder = vec3(0.0);
vec3 rightShoulder = vec3(0.0);

vec3 leftElbow = vec3(0.0);
vec3 rightElbow = vec3(0.0);

vec3 leftWrist = vec3(0.0);
vec3 rightWrist = vec3(0.0);

vec3 leftFinger = vec3(0.0);
vec3 rightFinger = vec3(0.0);

vec3 leftHip = vec3(0.0);
vec3 rightHip = vec3(0.0);

vec3 leftKnee = vec3(0.0);
vec3 leftAnkle = vec3(0.0);

vec3 rightKnee = vec3(0.0);
vec3 rightAnkle = vec3(0.0);

const vec3 downY = vec3(0.0, -1.0, 0.0);
float minY = 0.0;

void load_stance() {
    
   	for(int i = 0; i < NUM_ANGLES;i++)
    	stance[i] = saved_stance[i];
    
    shoulderRot = (saved_shoulderRot);
    hipRot = (saved_hipRot);
    lean = (saved_lean);
    
    head = vec3(0.0, GR/E, 0.0);
    
    ///////////////////////////////////////////////////////////////
    //Spine////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    bSpine = head/GR;
    uSpine = -bSpine;
    
    ///////////////////////////////////////////////////////////////
    //Shoulders////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    leftShoulder = bSpine+vec3(1.0, 0.0, 0.0)/E;
    rightShoulder = bSpine-vec3(1.0, 0.0, 0.0)/E;
    
    ///////////////////////////////////////////////////////////////
    //Elbows///////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    vec3 hangingLeftElbow = downY/GR;

    float leftArmOmega = stance[ELBOWS].x;
    float leftArmTheta = stance[ELBOWS].y;
    
    hangingLeftElbow = rotatePoint(rotatePoint(hangingLeftElbow, vec3(1.0, 0.0, 0.0), leftArmOmega), vec3(0.0, 0.0, 1.0), leftArmTheta);
    
    leftElbow = leftShoulder+hangingLeftElbow;
        
    vec3 hangingRightElbow = downY/GR;
    
    float rightArmOmega = stance[ELBOWS].z;
    float rightArmTheta = stance[ELBOWS].w;
    
    hangingRightElbow = rotatePoint(rotatePoint(hangingRightElbow, vec3(1.0, 0.0, 0.0), rightArmOmega), vec3(0.0, 0.0, -1.0), rightArmTheta);
    
    rightElbow = rightShoulder+hangingRightElbow;
    
    ///////////////////////////////////////////////////////////////
    //Wrists///////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    
    vec3 straightLeftWrist = downY/E;

    float leftForeArmOmega = leftArmOmega+stance[WRISTS].x;
    float leftForeArmTheta = leftArmTheta+stance[WRISTS].y;
    
    straightLeftWrist = rotatePoint(rotatePoint(straightLeftWrist, vec3(1.0, 0.0, 0.0), leftForeArmOmega), vec3(0.0, 0.0, 1.0), leftForeArmTheta);
    
    leftWrist = leftElbow+straightLeftWrist;
        
    vec3 straightRightWrist = downY/E;
    
    float rightForeArmOmega = rightArmOmega+stance[WRISTS].z;
    float rightForeArmTheta = rightArmTheta+stance[WRISTS].w;
    
    straightRightWrist = rotatePoint(rotatePoint(straightRightWrist, vec3(1.0, 0.0, 0.0), rightForeArmOmega), vec3(0.0, 0.0, -1.0), rightForeArmTheta);
    
    rightWrist = rightElbow+straightRightWrist;
    
    ///////////////////////////////////////////////////////////////
    //Fingers//////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    
    vec3 straightLeftFingers = downY/PI/E;

    float leftFingersOmega = leftForeArmOmega+stance[FINGERS].x;
    float leftFingersTheta = leftForeArmTheta+stance[FINGERS].y;
    
    straightLeftFingers = rotatePoint(rotatePoint(straightLeftFingers, vec3(1.0, 0.0, 0.0), leftFingersOmega), vec3(0.0, 0.0, 1.0), leftFingersTheta);
    
    leftFinger = leftWrist+straightLeftFingers;
        
    vec3 straightRightFingers = downY/PI/E;
    
    float rightFingersOmega = rightForeArmOmega+stance[FINGERS].z;
    float rightFingersTheta = rightForeArmTheta+stance[FINGERS].w;
    
    straightRightFingers = rotatePoint(rotatePoint(straightRightFingers, vec3(1.0, 0.0, 0.0), rightFingersOmega), vec3(0.0, 0.0, -1.0), rightFingersTheta);
    
    rightFinger = rightWrist+straightRightFingers;
    
    
    ///////////////////////////////////////////////////////////////
    //Hips/////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    leftHip = uSpine+vec3(circle(hipRot), 0.0).xzy/E/GR;
    rightHip = uSpine-vec3(circle(hipRot), 0.0).xzy/E/GR;
    ///////////////////////////////////////////////////////////////
    //Knees////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    vec3 hangingLeftKnee = downY/GR;

    float leftKneeOmega = stance[KNEES].x;
    float leftKneeTheta = stance[KNEES].y;
    
    hangingLeftKnee = rotatePoint(rotatePoint(hangingLeftKnee, vec3(1.0, 0.0, 0.0), leftKneeOmega), vec3(0.0, 0.0, 1.0), leftKneeTheta);
    
    leftKnee = leftHip+hangingLeftKnee;
        
    vec3 hangingRightKnee = downY/GR;
    
    float rightKneeOmega = stance[KNEES].z;
    float rightKneeTheta = stance[KNEES].w;
    
    hangingRightKnee = rotatePoint(rotatePoint(hangingRightKnee, vec3(1.0, 0.0, 0.0), rightKneeOmega), vec3(0.0, 0.0, -1.0), rightKneeTheta);
    
    rightKnee = rightHip+hangingRightKnee;
    
    ///////////////////////////////////////////////////////////////
    //Ankles///////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    vec3 straightLeftAnkle = downY/GR;

    float leftAnkleOmega = leftKneeOmega+stance[ANKLES].x;
    float leftAnkleTheta = leftKneeTheta+stance[ANKLES].y;
    
    straightLeftAnkle = rotatePoint(rotatePoint(straightLeftAnkle, vec3(1.0, 0.0, 0.0), leftAnkleOmega), vec3(0.0, 0.0, 1.0), leftAnkleTheta);
    
    leftAnkle = leftKnee+straightLeftAnkle;
        
    vec3 straightRightAnkle = downY/GR;
    
    float rightAnkleOmega = rightKneeOmega+stance[ANKLES].z;
    float rightAnkleTheta = rightKneeTheta+stance[ANKLES].w;
    
    straightRightAnkle = rotatePoint(rotatePoint(straightRightAnkle, vec3(1.0, 0.0, 0.0), rightAnkleOmega), vec3(0.0, 0.0, -1.0), rightAnkleTheta);
    
    rightAnkle = rightKnee+straightRightAnkle;
    
    ///////////////////////////////////////////////////////////////
    //Lean/////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    bSpine = rotatePoint(bSpine, vec3(1.0, 0.0, 0.0), lean);
    head = rotatePoint(head, vec3(1.0, 0.0, 0.0), lean);
    
    leftShoulder = rotatePoint(leftShoulder, vec3(1.0, 0.0, 0.0), lean);
    rightShoulder = rotatePoint(rightShoulder, vec3(1.0, 0.0, 0.0), lean);
    leftElbow = rotatePoint(leftElbow, vec3(1.0, 0.0, 0.0), lean);
    rightElbow = rotatePoint(rightElbow, vec3(1.0, 0.0, 0.0), lean);
    leftWrist = rotatePoint(leftWrist, vec3(1.0, 0.0, 0.0), lean);
    rightWrist = rotatePoint(rightWrist, vec3(1.0, 0.0, 0.0), lean);
    leftFinger = rotatePoint(leftFinger, vec3(1.0, 0.0, 0.0), lean);
    rightFinger = rotatePoint(rightFinger, vec3(1.0, 0.0, 0.0), lean);
    
    ///////////////////////////////////////////////////////////////
    //Shoulder Rotation////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////

    leftShoulder = rotatePoint(leftShoulder, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    rightShoulder = rotatePoint(rightShoulder, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    leftElbow = rotatePoint(leftElbow, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    rightElbow = rotatePoint(rightElbow, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    leftWrist = rotatePoint(leftWrist, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    rightWrist = rotatePoint(rightWrist, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    leftFinger = rotatePoint(leftFinger, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    rightFinger = rotatePoint(rightFinger, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);
    
    ///////////////////////////////////////////////////////////////
    //Hip Rotation/////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////
    
    
    //MIN calc
 	float lowestY = min(min(min(min(min(min(min(min(min(min(min(min(min(min(min(bSpine.y, uSpine.y),
                                                                            leftShoulder.y),
                                                                        rightShoulder.y),
                                                                    leftElbow.y),
                                                                rightElbow.y),
                                                            leftWrist.y),
                                                        rightWrist.y),
                                                    leftFinger.y), 
                                                rightFinger.y), 
                                            leftHip.y), 
                                        rightHip.y), 
                                    leftKnee.y), 
                                leftAnkle.y),
                            rightKnee.y),
                        rightAnkle.y);
    minY = min(lowestY, minY);
}

float dfScene(vec3 rp, vec3 rd) {
    
    float msd = 99.0;
    
    float scale = GR;
    
    //hip
    msd = min(msd, sdSphere(rp, rd, leftHip, 0.06*scale));
    msd = min(msd, sdSphere(rp, rd, rightHip, 0.06*scale));
    msd = min(msd, sdCapsule(rp, rd, leftHip, rightHip, 0.02*scale));
    //left thigh
    msd = min(msd, sdSphere(rp, rd, leftKnee, 0.05*scale));
    msd = min(msd, sdCapsule(rp, rd, leftHip, leftKnee, 0.02*scale));
    //left shin
    msd = min(msd, sdSphere(rp, rd, leftAnkle, 0.04*scale));
    msd = min(msd, sdCapsule(rp, rd, leftKnee, leftAnkle, 0.015*scale));
    //right thigh
    msd = min(msd, sdSphere(rp, rd, rightKnee, 0.05*scale));
    msd = min(msd, sdCapsule(rp, rd, rightHip, rightKnee, 0.02*scale));
    //right shin
    msd = min(msd, sdSphere(rp, rd, rightAnkle, 0.04*scale));
    msd = min(msd, sdCapsule(rp, rd, rightKnee, rightAnkle, 0.015*scale));
    //spine
    msd = min(msd, sdSphere(rp, rd, bSpine, 0.04*scale));
    msd = min(msd, sdSphere(rp, rd, uSpine, 0.04*scale));
    msd = min(msd, sdCapsule(rp, rd, bSpine, uSpine, 0.02*scale));
    //shoulder
    msd = min(msd, sdSphere(rp, rd, leftShoulder, 0.05*scale));
    msd = min(msd, sdSphere(rp, rd, rightShoulder, 0.05*scale));
    msd = min(msd, sdCapsule(rp, rd, leftShoulder, rightShoulder, 0.02*scale));
    //left upper arm
    msd = min(msd, sdSphere(rp, rd, leftElbow, 0.04*scale));
    msd = min(msd, sdCapsule(rp, rd, leftShoulder, leftElbow, 0.02*scale));
    //left lower arm
    msd = min(msd, sdSphere(rp, rd, leftWrist, 0.03*scale));
    msd = min(msd, sdCapsule(rp, rd, leftElbow, leftWrist, 0.015*scale));
    //left finger
    msd = min(msd, sdSphere(rp, rd, leftFinger, 0.015*scale));
    msd = min(msd, sdCapsule(rp, rd, leftWrist, leftFinger, 0.01*scale));
    //right upper arm 
    msd = min(msd, sdSphere(rp, rd, rightElbow, 0.04*scale));
    msd = min(msd, sdCapsule(rp, rd, rightShoulder, rightElbow, 0.02*scale));
    //right lower arm
    msd = min(msd, sdSphere(rp, rd, rightWrist, 0.03*scale));
    msd = min(msd, sdCapsule(rp, rd, rightElbow, rightWrist, 0.015*scale));
    //right finger
    msd = min(msd, sdSphere(rp, rd, rightFinger, 0.015*scale));
    msd = min(msd, sdCapsule(rp, rd, rightWrist, rightFinger, 0.01*scale));
    //head
    msd = min(msd, sdSphere(rp, rd, head, 0.15));
    
    return msd;
}

vec3 surfaceNormal(vec3 p, vec3 rd) { 
    vec2 e = vec2(5.0 / iResolution.y, 0);
	float d1 = dfScene(p + e.xyy, rd), d2 = dfScene(p - e.xyy, rd);
	float d3 = dfScene(p + e.yxy, rd), d4 = dfScene(p - e.yxy, rd);
	float d5 = dfScene(p + e.yyx, rd), d6 = dfScene(p - e.yyx, rd);
	float d = dfScene(p, rd) * 2.0;	
    return normalize(vec3(d1 - d2, d3 - d4, d5 - d6));
}

//IQ
float calcAO(vec3 pos, vec3 nor, vec3 rd) {   
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float hr = 0.01 + 0.05*float(i);
        vec3 aopos = pos + nor*hr;
        occ += smoothstep(0.0, 0.7, hr - dfScene(aopos, rd)) * sca;
        sca *= 0.97;
    }
    return clamp(1.0 - 3.0 * occ , 0.0, 1.0);
}

//main march
vec3 marchScene(vec3 ro, vec3 rd) {
    
    vec3 pc = vec3(0.0); //returned pixel colour
    float d = 0.0; //distance marched
    vec3 rp = vec3(0.0); //ray position
    vec3 lp = normalize(vec3(5.0, 8.0, -3.0)); //light position
   
    for (int i = 0; i < 8; i++) {
        rp = ro + rd * d;
        eye = rp;
        float ns = dfScene(rp, rd);
        d += ns;
        if (ns < 1.0/MAX_DIM || d > FAR) break;
    }
    
    if (d < FAR) {

        vec3 sc = vec3(1.0, 0., 0.); //surface colour
        vec3 n = surfaceNormal(rp, rd);
        float ao = calcAO(rp, n, rd);
        
        float diff = max(dot(n, lp), 0.0); //diffuse
	    pc = sc * 0.5 + diff * sc * ao;
        float spe = pow(max(dot(reflect(rd, n), lp), 0.), 16.); //specular.
        pc = pc + spe * vec3(1.0);
    }
    
    return pc;
}

const int numWeights = 512;

vec3 weights[numWeights];

float lowAverage()
{
    const int iters = numWeights;
    float product = 1.0;
    float sum = 0.0;
    
    
    for(int i = 0; i < iters; i++)
    {
        float sound = texture(iAudioData, vec2(float(i)/float(iters), 0.25)).r;
        
        product *= sound;
        sum += sound;
        
        weights[i].r = sound;
    }
    for(int i = 0; i < iters; i++)
        weights[i].gb = vec2(sum/float(iters), pow(product, 1.0/float(iters)));
    return max(sum/float(iters), pow(product, 1.0/float(iters)));
}

void clear_stance()
{
   	for(int i = 0; i < NUM_ANGLES;i++)
        stance[i] = vec4(0.0);
    shoulderRot = 0.0;
    hipRot = 0.0;
    lean = 0.0;
}

void dance1()
{
    clear_stance();
	float twist = time;
    
    stance[KNEES].xz = vec2(saw(time));
    stance[ANKLES].xz = -stance[KNEES].xz*2.0;
    
    vec2 twistCircle = circle(twist*GR)*GR;
    
    stance[ELBOWS].x = twistCircle.x;
    stance[ELBOWS].y = twistCircle.x/PI;
    stance[ELBOWS].z = twistCircle.y;
    stance[ELBOWS].w = twistCircle.y/PI;
    
    stance[WRISTS].x = (stance[ELBOWS].x*.5+.5);
    stance[WRISTS].z = (stance[ELBOWS].z*.5+.5);
    
    shoulderRot = sin(PI+twist*PI*3.0)/PI/GR;
    hipRot = sin(twist*PI*3.0)/PI/GR;
    lean = -(stance[KNEES].x+stance[KNEES].z)/PI;
}

void dance2()
{
    clear_stance();
	float run = time*PI;
    
    vec2 runCircleA = circle(run)*.5+.5;
    vec2 runCircleB = circle(run+PI)*.5+.5;
    
    stance[ELBOWS].x = (runCircleA.x*2.0-1.0)*GR;
    stance[ELBOWS].z = (runCircleB.x*2.0-1.0)*GR;
    
    stance[KNEES].x = runCircleA.x*2.0-1.0;
    stance[KNEES].z = runCircleB.x*2.0-1.0;
    stance[ANKLES].x = runCircleA.y;
    stance[ANKLES].z = runCircleB.y;
    
    lean = -(stance[KNEES].x+stance[KNEES].z)/PI;
}

void dance3()
{
    clear_stance();
    
    float wave = time*PI*PI;
    
    
    stance[ELBOWS].y = PI/2.0+sin(wave)/PI;
    stance[ELBOWS].w = PI/2.0+sin(wave+PI/2.0)/PI;
    
    stance[WRISTS].y = sin(wave-PI/2.0)/PI;
    stance[WRISTS].w = sin(wave+PI)/PI;
    
    stance[FINGERS].y = sin(wave-PI)/PI;
    stance[FINGERS].w = sin(wave+PI*3.0/2.0)/PI;
    
    hipRot = sin(time*PI*3.0)/PI/GR;
    
    stance[KNEES].xz = vec2(saw(time));
    stance[ANKLES].xz = -stance[KNEES].xz*2.0;
    
    lean = -(stance[KNEES].x+stance[KNEES].z)/PI;
}

void dance4()
{
    clear_stance();
    
    float wave = time*PI*PI;
    
    
    stance[ELBOWS].y = PI+sin(wave)/PI;
    stance[ELBOWS].w = PI+sin(wave+PI/2.0)/PI;
    
    stance[WRISTS].y = sin(wave-PI/2.0)/PI;
    stance[WRISTS].w = sin(wave+PI)/PI;
    
    stance[FINGERS].y = sin(wave-PI)/PI;
    stance[FINGERS].w = sin(wave+PI*3.0/2.0)/PI;
    
    hipRot = sin(time*PI*3.0)/PI/GR;
    
    stance[KNEES].xz = vec2(saw(time));
    stance[ANKLES].xz = -stance[KNEES].xz*2.0;
    
    lean = -(stance[KNEES].x+stance[KNEES].z)/PI;
}

void dance5()
{
    clear_stance();
    
    float wave = time*PI*PI;
    
    stance[ELBOWS].x = PI/2.0+sin(wave);
    stance[ELBOWS].z = PI/2.0+sin(wave+PI);
    
    hipRot = sin(time*PI*3.0)/PI/GR;
    
    stance[KNEES].xz = vec2(saw(time));
    stance[ANKLES].xz = -stance[KNEES].xz*2.0;
    
    lean = -(stance[KNEES].x+stance[KNEES].z)/PI;
}

void save_stance(float factor)
{
   	for(int i = 0; i < NUM_ANGLES;i++)
    {
        saved_stance[i] += (stance[i]-saved_stance[i])*factor;
    }
    
    saved_shoulderRot += (shoulderRot-saved_shoulderRot)*factor;
    saved_hipRot += (hipRot-saved_hipRot)*factor;
    saved_lean += (lean-saved_lean)*factor;
}

void main() {
    
    //float height = max(lowAverage(), last_height)-1.0/60.0;
    float height = max(lowAverage(), last_height)-300.0/60.0;
    beat = clip(height);
    last_height = height;
    
    float dance = time/PI/PI;
    float v1 =  smoothstep(-1.0, 1.0/5.0, saw(dance));
    float v2 =  smoothstep(1.0/5.0, 2.0/5.0, saw(dance));
    float v3 =  smoothstep(2.0/5.0, 3.0/5.0, saw(dance));
    float v4 =  smoothstep(3.0/5.0, 4.0/5.0, saw(dance));
    float v5 =  smoothstep(4.0/5.0, 1.0, saw(dance));
    dance1();
    save_stance(v1);
    dance2();
    save_stance(v2);
    dance3();
    save_stance(v3);
    dance4();
    save_stance(v4);
    dance5();
    save_stance(v5);
    load_stance();
    
    //coordinate system
    //vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = -1.0 + 2.0 *vUv+.5;
    uv = uv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    
    //camera
    vec3 rd = normalize(vec3(uv, 2.));
    vec3 ro = vec3(0.0, minY+1.25, -3.5);
    
    //rotate camera
    ro.yz *= rot(sin(iGlobalTime) * 0.25);
    rd.yz *= rot(sin(iGlobalTime) * 0.25); 
    ro.xz *= rot(iGlobalTime * 0.5);
    rd.xz *= rot(iGlobalTime * 0.5);
    //*/
    
    eye = ro;
    
    gl_FragColor = vec4(marchScene(ro, rd), 1.0); 
}
