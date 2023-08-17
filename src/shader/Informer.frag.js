// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var Informer_frag =
"// https://www.shadertoy.com/view/XtKXDh\n"+
"// Created by voz\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform float iTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"//-----------------CONSTANTS MACROS-----------------\n"+
"\n"+
"#define PI 3.14159265359\n"+
"#define E 2.7182818284\n"+
"#define GR 1.61803398875\n"+
"#define MAX_DIM (max(iResolution.x,iResolution.y))\n"+
"#define FAR (PI*2.0)\n"+
"\n"+
"//-----------------UTILITY MACROS-----------------\n"+
"\n"+
"#define time ((sin(float(__LINE__))/PI/GR+1.0)*iGlobalTime+1000.0+last_height)\n"+
"#define sphereN(uv) (clamp(1.0-length(uv*2.0-1.0), 0.0, 1.0))\n"+
"#define clip(x) (smoothstep(0.0, 1.0, x))\n"+
"#define TIMES_DETAILED (1.0)\n"+
"#define angle(uv) (atan(uv.y, uv.x))\n"+
"#define angle_percent(uv) ((angle(uv)/PI+1.0)/2.0)\n"+
"#define hash(p) (fract(sin(vec2( dot(p,vec2(127.5,313.7)),dot(p,vec2(239.5,185.3))))*43458.3453))\n"+
"\n"+
"#define flux(x) (vec3(cos(x),cos(4.0*PI/3.0+x),cos(2.0*PI/3.0+x))*.5+.5)\n"+
"#define rormal(x) (normalize(sin(vec3(time, time/GR, time*GR)+seedling)*.25+.5))\n"+
"#define rotatePoint(p,n,theta) (p*cos(theta)+cross(n,p)*sin(theta)+n*dot(p,n) *(1.0-cos(theta)))\n"+
"#define circle(x) (vec2(cos((x)*PI), sin((x)*PI)))\n"+
"#define saw(x) fract( sign( 1.- mod( abs(x), 2.) ) * abs(x) )\n"+
"\n"+
"float last_height = 0.0;\n"+
"float beat = 0.0;\n"+
"vec3 eye = vec3 (0.0);\n"+
"\n"+
"mat2 rot(float x) {\n"+
"return mat2(cos(x), sin(x), -sin(x), cos(x));\n"+
"}\n"+
"\n"+
"float sdSphere(vec3 rp, vec3 rd, vec3 bp, float r) {\n"+
"//return length(bp - rp) - r;\n"+
"\n"+
"vec3 oc = eye - bp;\n"+
"float b = 2.0 * dot(rd, oc);\n"+
"float c = dot(oc, oc) - r*r;\n"+
"float disc = b * b - 4.0 * c;\n"+
"\n"+
"if (disc < 0.0)\n"+
"return FAR;\n"+
"\n"+
"// compute q as described above\n"+
"float q;\n"+
"if (b < 0.0)\n"+
"q = (-b - sqrt(disc))/2.0;\n"+
"else\n"+
"q = (-b + sqrt(disc))/2.0;\n"+
"\n"+
"float t0 = q;\n"+
"float t1 = c / q;\n"+
"\n"+
"// make sure t0 is smaller than t1\n"+
"if (t0 > t1) {\n"+
"// if t0 is bigger than t1 swap them around\n"+
"float temp = t0;\n"+
"t0 = t1;\n"+
"t1 = temp;\n"+
"}\n"+
"\n"+
"return length(bp - rp) - r;\n"+
"}\n"+
"\n"+
"float sdCapsule(vec3 rp, vec3 rd, vec3 a, vec3 b, float r) {\n"+
"vec3 pa = rp - a, ba = b - a;\n"+
"float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);\n"+
"\n"+
"vec3 ray = rd;\n"+
"vec3 ray2 = normalize(b-a);\n"+
"\n"+
"float a1 = dot(ray,ray);\n"+
"float b1 = dot(ray,ray2);\n"+
"float c = dot(ray2,ray2);\n"+
"float d = dot(ray,eye-a);\n"+
"float e = dot(eye-a,ray2);\n"+
"\n"+
"float t1 = (b1*e-c*d)/(a1*c-b1*b1);\n"+
"float t2 = (a1*e-b1*d)/(a1*c-b1*b1);\n"+
"\n"+
"float dist = length((eye+ray*t1)-(a+ray2*t2));\n"+
"return dist > r || t2 < r || t2 > length(a-b)+r? FAR : length(pa - ba * h) - r;\n"+
"}\n"+
"\n"+
"\n"+
"const int NUM_ANGLES = 5;\n"+
"const int ELBOWS = 0;\n"+
"const int WRISTS = 1;\n"+
"const int FINGERS = 2;\n"+
"const int KNEES = 3;\n"+
"const int ANKLES = 4;\n"+
"// stance structure:\n"+
"//{\n"+
"//	vec4(leftLegOmega, leftLegTheta, rightLegOmega, rightLegTheta)),\n"+
"//	vec4(relativeLeftElbowOmega, relativeLeftElbowTheta, relativeRightElbowOmega, relativeRightElbowTheta)),\n"+
"//	vec4(relativeLeftWristOmega, relativeLeftWristTheta, relativeRightWristOmega, relativeRightWristTheta)),\n"+
"//	vec4(relativeLeftFingersOmega, relativeLeftFingersTheta, relativeRightFingersOmega, relativeRightFingersTheta)),\n"+
"//	vec4(leftLegOmega, LeftLegTheta, rightLegOmega, rightLegTheta)),\n"+
"//	vec4(relativeLeftKneeOmega, relativeLeftKneeTheta, relativeRightKneeOmega, relativeRightKneeTheta)),\n"+
"//	vec4(relativeLeftAnkleOmega, relativeLeftAnkleTheta, relativeRightAnkleOmega, relativeRightAnkleTheta)),\n"+
"//}\n"+
"//\n"+
"vec4  saved_stance[NUM_ANGLES];\n"+
"vec4  stance[NUM_ANGLES];\n"+
"\n"+
"float saved_shoulderRot = 0.0;\n"+
"float shoulderRot = 0.0;\n"+
"\n"+
"float saved_hipRot = 0.0;\n"+
"float hipRot = 0.0;\n"+
"\n"+
"float saved_lean = 0.0;\n"+
"float lean = 0.0;\n"+
"\n"+
"//body joints\n"+
"vec3 head = vec3(0.0);\n"+
"\n"+
"vec3 bSpine = vec3(0.0);\n"+
"vec3 uSpine = vec3(0.0);\n"+
"\n"+
"vec3 leftShoulder = vec3(0.0);\n"+
"vec3 rightShoulder = vec3(0.0);\n"+
"\n"+
"vec3 leftElbow = vec3(0.0);\n"+
"vec3 rightElbow = vec3(0.0);\n"+
"\n"+
"vec3 leftWrist = vec3(0.0);\n"+
"vec3 rightWrist = vec3(0.0);\n"+
"\n"+
"vec3 leftFinger = vec3(0.0);\n"+
"vec3 rightFinger = vec3(0.0);\n"+
"\n"+
"vec3 leftHip = vec3(0.0);\n"+
"vec3 rightHip = vec3(0.0);\n"+
"\n"+
"vec3 leftKnee = vec3(0.0);\n"+
"vec3 leftAnkle = vec3(0.0);\n"+
"\n"+
"vec3 rightKnee = vec3(0.0);\n"+
"vec3 rightAnkle = vec3(0.0);\n"+
"\n"+
"const vec3 downY = vec3(0.0, -1.0, 0.0);\n"+
"float minY = 0.0;\n"+
"\n"+
"void load_stance() {\n"+
"\n"+
"for(int i = 0; i < NUM_ANGLES;i++)\n"+
"stance[i] = saved_stance[i];\n"+
"\n"+
"shoulderRot = (saved_shoulderRot);\n"+
"hipRot = (saved_hipRot);\n"+
"lean = (saved_lean);\n"+
"\n"+
"head = vec3(0.0, GR/E, 0.0);\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Spine////////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"bSpine = head/GR;\n"+
"uSpine = -bSpine;\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Shoulders////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"leftShoulder = bSpine+vec3(1.0, 0.0, 0.0)/E;\n"+
"rightShoulder = bSpine-vec3(1.0, 0.0, 0.0)/E;\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Elbows///////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"vec3 hangingLeftElbow = downY/GR;\n"+
"\n"+
"float leftArmOmega = stance[ELBOWS].x;\n"+
"float leftArmTheta = stance[ELBOWS].y;\n"+
"\n"+
"hangingLeftElbow = rotatePoint(rotatePoint(hangingLeftElbow, vec3(1.0, 0.0, 0.0), leftArmOmega), vec3(0.0, 0.0, 1.0), leftArmTheta);\n"+
"\n"+
"leftElbow = leftShoulder+hangingLeftElbow;\n"+
"\n"+
"vec3 hangingRightElbow = downY/GR;\n"+
"\n"+
"float rightArmOmega = stance[ELBOWS].z;\n"+
"float rightArmTheta = stance[ELBOWS].w;\n"+
"\n"+
"hangingRightElbow = rotatePoint(rotatePoint(hangingRightElbow, vec3(1.0, 0.0, 0.0), rightArmOmega), vec3(0.0, 0.0, -1.0), rightArmTheta);\n"+
"\n"+
"rightElbow = rightShoulder+hangingRightElbow;\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Wrists///////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"\n"+
"vec3 straightLeftWrist = downY/E;\n"+
"\n"+
"float leftForeArmOmega = leftArmOmega+stance[WRISTS].x;\n"+
"float leftForeArmTheta = leftArmTheta+stance[WRISTS].y;\n"+
"\n"+
"straightLeftWrist = rotatePoint(rotatePoint(straightLeftWrist, vec3(1.0, 0.0, 0.0), leftForeArmOmega), vec3(0.0, 0.0, 1.0), leftForeArmTheta);\n"+
"\n"+
"leftWrist = leftElbow+straightLeftWrist;\n"+
"\n"+
"vec3 straightRightWrist = downY/E;\n"+
"\n"+
"float rightForeArmOmega = rightArmOmega+stance[WRISTS].z;\n"+
"float rightForeArmTheta = rightArmTheta+stance[WRISTS].w;\n"+
"\n"+
"straightRightWrist = rotatePoint(rotatePoint(straightRightWrist, vec3(1.0, 0.0, 0.0), rightForeArmOmega), vec3(0.0, 0.0, -1.0), rightForeArmTheta);\n"+
"\n"+
"rightWrist = rightElbow+straightRightWrist;\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Fingers//////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"\n"+
"vec3 straightLeftFingers = downY/PI/E;\n"+
"\n"+
"float leftFingersOmega = leftForeArmOmega+stance[FINGERS].x;\n"+
"float leftFingersTheta = leftForeArmTheta+stance[FINGERS].y;\n"+
"\n"+
"straightLeftFingers = rotatePoint(rotatePoint(straightLeftFingers, vec3(1.0, 0.0, 0.0), leftFingersOmega), vec3(0.0, 0.0, 1.0), leftFingersTheta);\n"+
"\n"+
"leftFinger = leftWrist+straightLeftFingers;\n"+
"\n"+
"vec3 straightRightFingers = downY/PI/E;\n"+
"\n"+
"float rightFingersOmega = rightForeArmOmega+stance[FINGERS].z;\n"+
"float rightFingersTheta = rightForeArmTheta+stance[FINGERS].w;\n"+
"\n"+
"straightRightFingers = rotatePoint(rotatePoint(straightRightFingers, vec3(1.0, 0.0, 0.0), rightFingersOmega), vec3(0.0, 0.0, -1.0), rightFingersTheta);\n"+
"\n"+
"rightFinger = rightWrist+straightRightFingers;\n"+
"\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Hips/////////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"leftHip = uSpine+vec3(circle(hipRot), 0.0).xzy/E/GR;\n"+
"rightHip = uSpine-vec3(circle(hipRot), 0.0).xzy/E/GR;\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Knees////////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"vec3 hangingLeftKnee = downY/GR;\n"+
"\n"+
"float leftKneeOmega = stance[KNEES].x;\n"+
"float leftKneeTheta = stance[KNEES].y;\n"+
"\n"+
"hangingLeftKnee = rotatePoint(rotatePoint(hangingLeftKnee, vec3(1.0, 0.0, 0.0), leftKneeOmega), vec3(0.0, 0.0, 1.0), leftKneeTheta);\n"+
"\n"+
"leftKnee = leftHip+hangingLeftKnee;\n"+
"\n"+
"vec3 hangingRightKnee = downY/GR;\n"+
"\n"+
"float rightKneeOmega = stance[KNEES].z;\n"+
"float rightKneeTheta = stance[KNEES].w;\n"+
"\n"+
"hangingRightKnee = rotatePoint(rotatePoint(hangingRightKnee, vec3(1.0, 0.0, 0.0), rightKneeOmega), vec3(0.0, 0.0, -1.0), rightKneeTheta);\n"+
"\n"+
"rightKnee = rightHip+hangingRightKnee;\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Ankles///////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"vec3 straightLeftAnkle = downY/GR;\n"+
"\n"+
"float leftAnkleOmega = leftKneeOmega+stance[ANKLES].x;\n"+
"float leftAnkleTheta = leftKneeTheta+stance[ANKLES].y;\n"+
"\n"+
"straightLeftAnkle = rotatePoint(rotatePoint(straightLeftAnkle, vec3(1.0, 0.0, 0.0), leftAnkleOmega), vec3(0.0, 0.0, 1.0), leftAnkleTheta);\n"+
"\n"+
"leftAnkle = leftKnee+straightLeftAnkle;\n"+
"\n"+
"vec3 straightRightAnkle = downY/GR;\n"+
"\n"+
"float rightAnkleOmega = rightKneeOmega+stance[ANKLES].z;\n"+
"float rightAnkleTheta = rightKneeTheta+stance[ANKLES].w;\n"+
"\n"+
"straightRightAnkle = rotatePoint(rotatePoint(straightRightAnkle, vec3(1.0, 0.0, 0.0), rightAnkleOmega), vec3(0.0, 0.0, -1.0), rightAnkleTheta);\n"+
"\n"+
"rightAnkle = rightKnee+straightRightAnkle;\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Lean/////////////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"bSpine = rotatePoint(bSpine, vec3(1.0, 0.0, 0.0), lean);\n"+
"head = rotatePoint(head, vec3(1.0, 0.0, 0.0), lean);\n"+
"\n"+
"leftShoulder = rotatePoint(leftShoulder, vec3(1.0, 0.0, 0.0), lean);\n"+
"rightShoulder = rotatePoint(rightShoulder, vec3(1.0, 0.0, 0.0), lean);\n"+
"leftElbow = rotatePoint(leftElbow, vec3(1.0, 0.0, 0.0), lean);\n"+
"rightElbow = rotatePoint(rightElbow, vec3(1.0, 0.0, 0.0), lean);\n"+
"leftWrist = rotatePoint(leftWrist, vec3(1.0, 0.0, 0.0), lean);\n"+
"rightWrist = rotatePoint(rightWrist, vec3(1.0, 0.0, 0.0), lean);\n"+
"leftFinger = rotatePoint(leftFinger, vec3(1.0, 0.0, 0.0), lean);\n"+
"rightFinger = rotatePoint(rightFinger, vec3(1.0, 0.0, 0.0), lean);\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Shoulder Rotation////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"leftShoulder = rotatePoint(leftShoulder, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"rightShoulder = rotatePoint(rightShoulder, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"leftElbow = rotatePoint(leftElbow, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"rightElbow = rotatePoint(rightElbow, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"leftWrist = rotatePoint(leftWrist, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"rightWrist = rotatePoint(rightWrist, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"leftFinger = rotatePoint(leftFinger, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"rightFinger = rotatePoint(rightFinger, rotatePoint(downY, vec3(1.0, 0.0, 0.0), lean), shoulderRot);\n"+
"\n"+
"///////////////////////////////////////////////////////////////\n"+
"//Hip Rotation/////////////////////////////////////////////////\n"+
"///////////////////////////////////////////////////////////////\n"+
"\n"+
"\n"+
"//MIN calc\n"+
"float lowestY = min(min(min(min(min(min(min(min(min(min(min(min(min(min(min(bSpine.y, uSpine.y),\n"+
"leftShoulder.y),\n"+
"rightShoulder.y),\n"+
"leftElbow.y),\n"+
"rightElbow.y),\n"+
"leftWrist.y),\n"+
"rightWrist.y),\n"+
"leftFinger.y),\n"+
"rightFinger.y),\n"+
"leftHip.y),\n"+
"rightHip.y),\n"+
"leftKnee.y),\n"+
"leftAnkle.y),\n"+
"rightKnee.y),\n"+
"rightAnkle.y);\n"+
"minY = min(lowestY, minY);\n"+
"}\n"+
"\n"+
"float dfScene(vec3 rp, vec3 rd) {\n"+
"\n"+
"float msd = 99.0;\n"+
"\n"+
"float scale = GR;\n"+
"\n"+
"//hip\n"+
"msd = min(msd, sdSphere(rp, rd, leftHip, 0.06*scale));\n"+
"msd = min(msd, sdSphere(rp, rd, rightHip, 0.06*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, leftHip, rightHip, 0.02*scale));\n"+
"//left thigh\n"+
"msd = min(msd, sdSphere(rp, rd, leftKnee, 0.05*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, leftHip, leftKnee, 0.02*scale));\n"+
"//left shin\n"+
"msd = min(msd, sdSphere(rp, rd, leftAnkle, 0.04*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, leftKnee, leftAnkle, 0.015*scale));\n"+
"//right thigh\n"+
"msd = min(msd, sdSphere(rp, rd, rightKnee, 0.05*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, rightHip, rightKnee, 0.02*scale));\n"+
"//right shin\n"+
"msd = min(msd, sdSphere(rp, rd, rightAnkle, 0.04*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, rightKnee, rightAnkle, 0.015*scale));\n"+
"//spine\n"+
"msd = min(msd, sdSphere(rp, rd, bSpine, 0.04*scale));\n"+
"msd = min(msd, sdSphere(rp, rd, uSpine, 0.04*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, bSpine, uSpine, 0.02*scale));\n"+
"//shoulder\n"+
"msd = min(msd, sdSphere(rp, rd, leftShoulder, 0.05*scale));\n"+
"msd = min(msd, sdSphere(rp, rd, rightShoulder, 0.05*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, leftShoulder, rightShoulder, 0.02*scale));\n"+
"//left upper arm\n"+
"msd = min(msd, sdSphere(rp, rd, leftElbow, 0.04*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, leftShoulder, leftElbow, 0.02*scale));\n"+
"//left lower arm\n"+
"msd = min(msd, sdSphere(rp, rd, leftWrist, 0.03*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, leftElbow, leftWrist, 0.015*scale));\n"+
"//left finger\n"+
"msd = min(msd, sdSphere(rp, rd, leftFinger, 0.015*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, leftWrist, leftFinger, 0.01*scale));\n"+
"//right upper arm\n"+
"msd = min(msd, sdSphere(rp, rd, rightElbow, 0.04*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, rightShoulder, rightElbow, 0.02*scale));\n"+
"//right lower arm\n"+
"msd = min(msd, sdSphere(rp, rd, rightWrist, 0.03*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, rightElbow, rightWrist, 0.015*scale));\n"+
"//right finger\n"+
"msd = min(msd, sdSphere(rp, rd, rightFinger, 0.015*scale));\n"+
"msd = min(msd, sdCapsule(rp, rd, rightWrist, rightFinger, 0.01*scale));\n"+
"//head\n"+
"msd = min(msd, sdSphere(rp, rd, head, 0.15));\n"+
"\n"+
"return msd;\n"+
"}\n"+
"\n"+
"vec3 surfaceNormal(vec3 p, vec3 rd) {\n"+
"vec2 e = vec2(5.0 / iResolution.y, 0);\n"+
"float d1 = dfScene(p + e.xyy, rd), d2 = dfScene(p - e.xyy, rd);\n"+
"float d3 = dfScene(p + e.yxy, rd), d4 = dfScene(p - e.yxy, rd);\n"+
"float d5 = dfScene(p + e.yyx, rd), d6 = dfScene(p - e.yyx, rd);\n"+
"float d = dfScene(p, rd) * 2.0;\n"+
"return normalize(vec3(d1 - d2, d3 - d4, d5 - d6));\n"+
"}\n"+
"\n"+
"//IQ\n"+
"float calcAO(vec3 pos, vec3 nor, vec3 rd) {\n"+
"float occ = 0.0;\n"+
"float sca = 1.0;\n"+
"for(int i = 0; i < 5; i++) {\n"+
"float hr = 0.01 + 0.05*float(i);\n"+
"vec3 aopos = pos + nor*hr;\n"+
"occ += smoothstep(0.0, 0.7, hr - dfScene(aopos, rd)) * sca;\n"+
"sca *= 0.97;\n"+
"}\n"+
"return clamp(1.0 - 3.0 * occ , 0.0, 1.0);\n"+
"}\n"+
"\n"+
"//main march\n"+
"vec3 marchScene(vec3 ro, vec3 rd) {\n"+
"\n"+
"vec3 pc = vec3(0.0); //returned pixel colour\n"+
"float d = 0.0; //distance marched\n"+
"vec3 rp = vec3(0.0); //ray position\n"+
"vec3 lp = normalize(vec3(5.0, 8.0, -3.0)); //light position\n"+
"\n"+
"for (int i = 0; i < 8; i++) {\n"+
"rp = ro + rd * d;\n"+
"eye = rp;\n"+
"float ns = dfScene(rp, rd);\n"+
"d += ns;\n"+
"if (ns < 1.0/MAX_DIM || d > FAR) break;\n"+
"}\n"+
"\n"+
"if (d < FAR) {\n"+
"\n"+
"vec3 sc = vec3(1.0, 0., 0.); //surface colour\n"+
"vec3 n = surfaceNormal(rp, rd);\n"+
"float ao = calcAO(rp, n, rd);\n"+
"\n"+
"float diff = max(dot(n, lp), 0.0); //diffuse\n"+
"pc = sc * 0.5 + diff * sc * ao;\n"+
"float spe = pow(max(dot(reflect(rd, n), lp), 0.), 16.); //specular.\n"+
"pc = pc + spe * vec3(1.0);\n"+
"}\n"+
"\n"+
"return pc;\n"+
"}\n"+
"\n"+
"const int numWeights = 512;\n"+
"\n"+
"vec3 weights[numWeights];\n"+
"\n"+
"float lowAverage()\n"+
"{\n"+
"const int iters = numWeights;\n"+
"float product = 1.0;\n"+
"float sum = 0.0;\n"+
"\n"+
"\n"+
"for(int i = 0; i < iters; i++)\n"+
"{\n"+
"float sound = texture(iAudioData, vec2(float(i)/float(iters), 0.25)).r;\n"+
"\n"+
"product *= sound;\n"+
"sum += sound;\n"+
"\n"+
"weights[i].r = sound;\n"+
"}\n"+
"for(int i = 0; i < iters; i++)\n"+
"weights[i].gb = vec2(sum/float(iters), pow(product, 1.0/float(iters)));\n"+
"return max(sum/float(iters), pow(product, 1.0/float(iters)));\n"+
"}\n"+
"\n"+
"void clear_stance()\n"+
"{\n"+
"for(int i = 0; i < NUM_ANGLES;i++)\n"+
"stance[i] = vec4(0.0);\n"+
"shoulderRot = 0.0;\n"+
"hipRot = 0.0;\n"+
"lean = 0.0;\n"+
"}\n"+
"\n"+
"void dance1()\n"+
"{\n"+
"clear_stance();\n"+
"float twist = time;\n"+
"\n"+
"stance[KNEES].xz = vec2(saw(time));\n"+
"stance[ANKLES].xz = -stance[KNEES].xz*2.0;\n"+
"\n"+
"vec2 twistCircle = circle(twist*GR)*GR;\n"+
"\n"+
"stance[ELBOWS].x = twistCircle.x;\n"+
"stance[ELBOWS].y = twistCircle.x/PI;\n"+
"stance[ELBOWS].z = twistCircle.y;\n"+
"stance[ELBOWS].w = twistCircle.y/PI;\n"+
"\n"+
"stance[WRISTS].x = (stance[ELBOWS].x*.5+.5);\n"+
"stance[WRISTS].z = (stance[ELBOWS].z*.5+.5);\n"+
"\n"+
"shoulderRot = sin(PI+twist*PI*3.0)/PI/GR;\n"+
"hipRot = sin(twist*PI*3.0)/PI/GR;\n"+
"lean = -(stance[KNEES].x+stance[KNEES].z)/PI;\n"+
"}\n"+
"\n"+
"void dance2()\n"+
"{\n"+
"clear_stance();\n"+
"float run = time*PI;\n"+
"\n"+
"vec2 runCircleA = circle(run)*.5+.5;\n"+
"vec2 runCircleB = circle(run+PI)*.5+.5;\n"+
"\n"+
"stance[ELBOWS].x = (runCircleA.x*2.0-1.0)*GR;\n"+
"stance[ELBOWS].z = (runCircleB.x*2.0-1.0)*GR;\n"+
"\n"+
"stance[KNEES].x = runCircleA.x*2.0-1.0;\n"+
"stance[KNEES].z = runCircleB.x*2.0-1.0;\n"+
"stance[ANKLES].x = runCircleA.y;\n"+
"stance[ANKLES].z = runCircleB.y;\n"+
"\n"+
"lean = -(stance[KNEES].x+stance[KNEES].z)/PI;\n"+
"}\n"+
"\n"+
"void dance3()\n"+
"{\n"+
"clear_stance();\n"+
"\n"+
"float wave = time*PI*PI;\n"+
"\n"+
"\n"+
"stance[ELBOWS].y = PI/2.0+sin(wave)/PI;\n"+
"stance[ELBOWS].w = PI/2.0+sin(wave+PI/2.0)/PI;\n"+
"\n"+
"stance[WRISTS].y = sin(wave-PI/2.0)/PI;\n"+
"stance[WRISTS].w = sin(wave+PI)/PI;\n"+
"\n"+
"stance[FINGERS].y = sin(wave-PI)/PI;\n"+
"stance[FINGERS].w = sin(wave+PI*3.0/2.0)/PI;\n"+
"\n"+
"hipRot = sin(time*PI*3.0)/PI/GR;\n"+
"\n"+
"stance[KNEES].xz = vec2(saw(time));\n"+
"stance[ANKLES].xz = -stance[KNEES].xz*2.0;\n"+
"\n"+
"lean = -(stance[KNEES].x+stance[KNEES].z)/PI;\n"+
"}\n"+
"\n"+
"void dance4()\n"+
"{\n"+
"clear_stance();\n"+
"\n"+
"float wave = time*PI*PI;\n"+
"\n"+
"\n"+
"stance[ELBOWS].y = PI+sin(wave)/PI;\n"+
"stance[ELBOWS].w = PI+sin(wave+PI/2.0)/PI;\n"+
"\n"+
"stance[WRISTS].y = sin(wave-PI/2.0)/PI;\n"+
"stance[WRISTS].w = sin(wave+PI)/PI;\n"+
"\n"+
"stance[FINGERS].y = sin(wave-PI)/PI;\n"+
"stance[FINGERS].w = sin(wave+PI*3.0/2.0)/PI;\n"+
"\n"+
"hipRot = sin(time*PI*3.0)/PI/GR;\n"+
"\n"+
"stance[KNEES].xz = vec2(saw(time));\n"+
"stance[ANKLES].xz = -stance[KNEES].xz*2.0;\n"+
"\n"+
"lean = -(stance[KNEES].x+stance[KNEES].z)/PI;\n"+
"}\n"+
"\n"+
"void dance5()\n"+
"{\n"+
"clear_stance();\n"+
"\n"+
"float wave = time*PI*PI;\n"+
"\n"+
"stance[ELBOWS].x = PI/2.0+sin(wave);\n"+
"stance[ELBOWS].z = PI/2.0+sin(wave+PI);\n"+
"\n"+
"hipRot = sin(time*PI*3.0)/PI/GR;\n"+
"\n"+
"stance[KNEES].xz = vec2(saw(time));\n"+
"stance[ANKLES].xz = -stance[KNEES].xz*2.0;\n"+
"\n"+
"lean = -(stance[KNEES].x+stance[KNEES].z)/PI;\n"+
"}\n"+
"\n"+
"void save_stance(float factor)\n"+
"{\n"+
"for(int i = 0; i < NUM_ANGLES;i++)\n"+
"{\n"+
"saved_stance[i] += (stance[i]-saved_stance[i])*factor;\n"+
"}\n"+
"\n"+
"saved_shoulderRot += (shoulderRot-saved_shoulderRot)*factor;\n"+
"saved_hipRot += (hipRot-saved_hipRot)*factor;\n"+
"saved_lean += (lean-saved_lean)*factor;\n"+
"}\n"+
"\n"+
"void main() {\n"+
"\n"+
"//float height = max(lowAverage(), last_height)-1.0/60.0;\n"+
"float height = max(lowAverage(), last_height)-300.0/60.0;\n"+
"beat = clip(height);\n"+
"last_height = height;\n"+
"\n"+
"float dance = time/PI/PI;\n"+
"float v1 =  smoothstep(-1.0, 1.0/5.0, saw(dance));\n"+
"float v2 =  smoothstep(1.0/5.0, 2.0/5.0, saw(dance));\n"+
"float v3 =  smoothstep(2.0/5.0, 3.0/5.0, saw(dance));\n"+
"float v4 =  smoothstep(3.0/5.0, 4.0/5.0, saw(dance));\n"+
"float v5 =  smoothstep(4.0/5.0, 1.0, saw(dance));\n"+
"dance1();\n"+
"save_stance(v1);\n"+
"dance2();\n"+
"save_stance(v2);\n"+
"dance3();\n"+
"save_stance(v3);\n"+
"dance4();\n"+
"save_stance(v4);\n"+
"dance5();\n"+
"save_stance(v5);\n"+
"load_stance();\n"+
"\n"+
"//coordinate system\n"+
"//vec2 uv = fragCoord.xy / iResolution.xy;\n"+
"vec2 uv = -1.0 + 2.0 *vUv+.5;\n"+
"uv = uv * 2.0 - 1.0;\n"+
"uv.x *= iResolution.x / iResolution.y;\n"+
"\n"+
"//camera\n"+
"vec3 rd = normalize(vec3(uv, 2.));\n"+
"vec3 ro = vec3(0.0, minY+1.25, -3.5);\n"+
"\n"+
"//rotate camera\n"+
"ro.yz *= rot(sin(iGlobalTime) * 0.25);\n"+
"rd.yz *= rot(sin(iGlobalTime) * 0.25);\n"+
"ro.xz *= rot(iGlobalTime * 0.5);\n"+
"rd.xz *= rot(iGlobalTime * 0.5);\n"+
"//*/\n"+
"\n"+
"eye = ro;\n"+
"\n"+
"gl_FragColor = vec4(marchScene(ro, rd), 1.0);\n"+
"}\n"