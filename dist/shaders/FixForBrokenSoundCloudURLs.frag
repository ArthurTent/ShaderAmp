// https://www.shadertoy.com/view/tcKGDz 
// Modified by ArthurTent
// Created by cw
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
// Bars from https://www.shadertoy.com/view/slycD3
const int MAX_MARCHING_STEPS = 260;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float PRECISION = 0.0005;
const float EPSILON = 0.00001;
const float PI = 3.14159265359;
#define speed 5.0

// HSV to RGB conversion
vec3 hsv(float h, float s, float v) {
  vec4 t = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + t.xyz) * 6.0 - vec3(t.w));
  return v * mix(vec3(t.x), clamp(p - vec3(t.x), 0.0, 1.0), s);
}

// 3D Rotation matrix function
mat3 rotate3D(float angle, vec3 axis) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  
  // Standard 3D rotation matrix formula
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}
vec3 getTexture(vec2 p){
	p.x*=.5;
    p.x+=.25;
	p.y+=sin(iTime/10.)/100.;
    p.x+=sin(iTime/10.)/100.;
    vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}

const float barAmount = 0.2;//relative thickness of the bars
const float subdiv = 80.0;//number of bars.  
//Try setting subdiv to 800 at barAmount to 1.  Very high resolution information is revealed
//Bar amount 0.5 and subDiv iResolution.x/2. is cool too.

// frequency sweep https://soundcloud.com/audiomix/20hz-20khz-frequency-sweep
//set bar amount to 1.0 and subDiv to width of display

const float height = 0.5;//Maxium height of the bars relative to the screeen.

#define OVERSHOOT(x) tanh(x*x)*(2./exp(x*x*x)+1.)
#define TWEEN_VALUE OVERSHOOT(2.*iTime)

mat2 rot2d(float a){
    float c = cos(a), s = sin(a);
    return mat2(c,-s,s,c);
}
#define THICKNESS 0.1
#define SCALE_QED_2D 1.15
float tubeSDF(vec3 position, float innerRadius, float outerRadius, float halfHeight, float cornerRadius) {
   vec2 d = vec2(length(position.xz) - (outerRadius + innerRadius) * 0.5, position.y);
   d = abs(d) - vec2((outerRadius - innerRadius) * 0.5, halfHeight) + cornerRadius;
   return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - cornerRadius;
}
float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}
float rotatedSDBox(vec3 pIn, vec3 b, vec3 offset, float angle){
    vec3 p=pIn-offset;
    vec4 q = vec4(sin(-angle*0.5), 0.0, 0.0, cos(-angle*0.5)); 
    return sdBox(2.0 * cross(q.xyz, p * q.w + cross(q.xyz, p)) + p, b);   
}
float qedForAll(vec3 p) {
    float d = rotatedSDBox(p, vec3(THICKNESS,0.11*SCALE_QED_2D,0.52*SCALE_QED_2D), vec3(0,-0.1335*SCALE_QED_2D,0.01*SCALE_QED_2D)*2., -0.27925268016);
    d = min(d, rotatedSDBox(p,vec3(THICKNESS,0.09*SCALE_QED_2D,0.58*SCALE_QED_2D), vec3(0,0.1146*SCALE_QED_2D,0.005*SCALE_QED_2D)*2., 0.558505));
    d = min(d, sdBox(p-vec3(0,0.01*SCALE_QED_2D,-0.06*SCALE_QED_2D)*2.,vec3(THICKNESS,0.26*SCALE_QED_2D,0.1*SCALE_QED_2D)));
    d = min(d, sdBox(p-vec3(0,-0.05625*SCALE_QED_2D,0.257*SCALE_QED_2D)*2.,vec3(THICKNESS,0.1125*SCALE_QED_2D,0.04*SCALE_QED_2D)));
    float core = sdBox(p-vec3(0,0.03*SCALE_QED_2D,0.06*SCALE_QED_2D),vec3(THICKNESS,0.6*SCALE_QED_2D,0.5*SCALE_QED_2D));
    d = max(d, core);
    d = min(d, tubeSDF(p.zxy, 0.78*SCALE_QED_2D, 0.99*SCALE_QED_2D, THICKNESS, 0.01));
    return d;
}
mat2 rotate2d(float theta) {
  float s = sin(theta), c = cos(theta);
  return mat2(c, -s, s, c);
}
mat3 camera(vec3 cameraPos, vec3 lookAtPoint) {
    vec3 cd = normalize(lookAtPoint - cameraPos);
    vec3 cr = normalize(cross(vec3(0, 1, 0), cd));
    vec3 cu = normalize(cross(cd, cr));

    return mat3(-cr, cu, -cd);
}
float fresnel(vec3 n, vec3 rd) {
  return pow(clamp(1. - dot(n, -rd), 0., 1.), 5.);
}

float sdScene(vec3 p) {
  return qedForAll(vec3(p.z, p.x, -p.y)*TWEEN_VALUE*0.5);
}

float rayMarch(vec3 ro, vec3 rd) {
  float depth = MIN_DIST;

  for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
    vec3 p = ro + depth * rd;
    float d = sdScene(p);
    depth += d;
    if (d < PRECISION || depth > MAX_DIST) break;
  }

  return depth;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(1.0, -1.0) * EPSILON;
    float r = 1.;
    return normalize(
      e.xyy * sdScene(p + e.xyy) +
      e.yyx * sdScene(p + e.yyx) +
      e.yxy * sdScene(p + e.yxy) +
      e.xxx * sdScene(p + e.xxx));
}

vec3 phong(vec3 lightDir, float lightIntensity, vec3 rd, vec3 normal) {
return vec3(0.);
}
// https://www.shadertoy.com/view/t3jGD3
vec4 geometricplay(vec2 fragCoord) {
  vec2 r = iResolution.xy;
  vec2 FC = fragCoord.xy;
  float t = iTime;
    // Initialize output color
  vec4 o = vec4(0, 0, 0, 1);
  
  // Rendering loop
  // i: iteration counter
  // g: geometric field value
  // e: escape multiplier
  // s: scaling factor
  for(float i=0.,g=0.,e=0.,s=0.;++i<18.;) {
    // Create 3D point from 2D coordinates
    // - Center and normalize coordinates based on resolution
    // - Scale by 3.5 to control zoom level
    // - Add g+.5 for z-coordinate (changes each iteration)
    // - Apply 3D rotation based on time for animation
    vec3 p=vec3((FC.xy-.5*r)/r.y*3.5,g+.5)*rotate3D(t*.5,vec3(1,1,0));
    
    // Reset scaling factor for this iteration
    s=1.;
    
    // Fractal iteration loop
    // This is a form of "folding space" in ray fractals
    for(int i=0;i++<40;p=vec3(0,3.01,3)-abs(abs(p)*e-vec3(2.2,3,3)))
      // Multiply scaling factor by escape value
      // e is calculated based on distance from origin (dot product)
      // This creates the "escape time" effect typical in fractals
      s*=e=max(1.,10./dot(p,p));
    
    // Update geometric field value based on current point
    // This creates the flowing/morphing effect in the animation
    g-=mod(length(p.yy-p.xy*.3),p.y)/s*.4;
    
    // Accumulate color using HSV
    o.rgb+=hsv(.08,.8+.3*p.x,s/4e3);
  }
  return o;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{

    vec2 uv = fragCoord / iResolution.xy;

    vec4 col2 = texture(iAudioData, vec2(floor(uv.x*subdiv)/subdiv, 0));
    vec4 icol = texture(iAudioData, vec2(floor((1.0-uv.x)*subdiv)/subdiv, 0));



    float sound = col2.x * height;
    float isound = log(icol.x * height + 1.);

	fragColor = geometricplay(fragCoord); 

    fragColor += sound > uv.y || isound > 1.0-uv.y? vec4(1):vec4(0);
    
    float barThickness = (1.0/subdiv)*barAmount;
    
    fragColor = mod(uv.x, 1.0/subdiv) > barThickness?vec4(0):fragColor;//gaps
    
    //fragColor.xyz *= mix(vec3(0.0, 1.0, 1.0), vec3(0.6, 0.0, 0.5), abs(uv.y - 0.5)*2.0);
    fragColor.xyz *= mix(vec3(0.0,1.0, 1.0), vec3(0., 0.4, 0.5), abs(uv.y - 0.5)*2.0);
      
    vec2 uv2 = (fragCoord-.5*iResolution.xy)/iResolution.y;

    vec3 lp = vec3(0);
    vec3 ro = vec3(0, 0, 6);


    vec3 rd = camera(ro, lp) * normalize(vec3(uv2, -1));

    vec3 col = vec3(0.);

	//col = geometricplay(fragCoord);


    float d = rayMarch(ro, rd);

    vec3 p = ro + rd * d;
    vec3 normal = calcNormal(p);

    vec3 lightPosition1 = vec3(1, 1, 1);
    vec3 lightDirection1 = normalize(lightPosition1 - p);
    vec3 lightPosition2 = vec3(-8, -6, -5);
    vec3 lightDirection2 = normalize(lightPosition2 - p);

    float lightIntensity1 = 0.65;
    float lightIntensity2 = 0.3;

    vec3 sphereColor = vec3(0.);
	//phong(lightDirection1, lightIntensity1, rd, normal);
    //sphereColor += phong(lightDirection2, lightIntensity2, rd, normal);
    //sphereColor += fresnel(normal, rd) * 0.4;

    //col = mix(col, sphereColor, step(d - MAX_DIST, 0.));
    vec2 center = vec2(0.5, 0.5);  // center of screen/texture in UV space
    float scale = 0.5;             // scale factor (0.5 means half size)

    vec2 scaledUV = (uv2 - center) / scale + center;
    vec3 img = vec3(0.);
	if (scaledUV.x < -1.0 || scaledUV.x > 0.0 || scaledUV.y < -1.0 || scaledUV.y > 0.0) {
        // outside the scaled image area, show background col only
        //col = img;
    } else {
		float fTime = fract(iAmplifiedTime/128.);
      col += img*vec3(FFT(50),0.935*(1.+FFT(1)/2.),0.561*(1.+FFT(25)/2.));
    }
    if(col.x+col.y+col.z>0.5){
      fragColor = vec4(col, 1.0);
    }
}


void main() {
	vec2 fragCoord = vUv * iResolution;
	mainImage(gl_FragColor, fragCoord);
}
