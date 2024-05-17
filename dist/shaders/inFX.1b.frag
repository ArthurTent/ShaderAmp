// https://www.shadertoy.com/view/ldd3Dr
// Modified by ArthurTent
// inFX.1b by patu
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// S h a d e r T o y - - - C h r o m e   E x t e n s i o n

// https://chrome.google.com/webstore/detail/shadertoy-unofficial-plug/ohicbclhdmkhoabobgppffepcopomhgl

uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;

varying vec2 vUv;

const vec3 e = vec3(0.0, 0.0, 0.1);
const float maxd = 70.0;
const vec3 c = vec3(1.0);
const float PI = 3.14159265;

vec2 d = vec2(0.1, 0.0);
vec3 p;

vec4 Color = vec4(0.0);
float vol = 0.;

vec3 spherical_texturing(in vec3 normal, in sampler2D tex, float delta) {
     float u = atan(normal.z, normal.x) / PI * 2.0 + delta;
	 float v = asin(normal.y) / PI * 2.0;
     return texture(tex, vec2(u, v)).xyz;
}

mat3 xrotate( float t ) {
    return mat3(
        1.0, 0.0, 0.0,
        0.0, cos(t), -sin(t),
        0.0, sin(t), cos(t)
    );
}

mat3 yrotate( float t ) {
	return mat3(
        cos(t), 0.0, -sin(t),
        0.0, 1.0, 0.0,
        sin(t), 0.0, cos(t)
    );
}

mat3 zrotate( float t ) {
    return mat3(
        cos(t), -sin(t), 0.0,
        sin(t), cos(t), 0.0,
        0.0, 0.0, 1.0
    );
}

mat3 fullRotate( vec3 r ) { 
   return xrotate(r.x) * yrotate(r.y) * zrotate(r.z);
}

vec3 opRep( vec3 p, vec3 c ) {
    return mod(p,c)-0.5*c;
}

float smin( float a, float b, float k ){
    float res = exp( -k*a ) + exp( -k*b );
    return -log( res )/k;    
}

float opBlend( float d1, float d2 ) {
    return smin( d1 , d2 , 0.3);    
}

float opS( float d1, float d2 ) {
    return max(-d2,d1);
}

float sdBox( vec3 p, vec3 b ) {
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}

float sdCross( in vec3 p, float w ) {
    float inf = 30.;
    float da = sdBox(p.xyz,vec3(inf, w, w));
    float db = sdBox(p.yzx,vec3(w, inf, w));
    float dc = sdBox(p.zxy,vec3(w, w ,inf));
    return min(da,min(db,dc));
} 

vec2 distance_to_obj( in vec3 p ) {
    float t = iAmplifiedTime;
    
    float w = 1.7 - length(p) / (20. + vol * 20.);
    float x = 0.;
    
    if (	(t > -1. && t < 21.3) || 
        	(t > 42.4 && t < 54.3)) {
    	w -= 4.;  
    } else {
    	x = t;
        w += (distance(p, vec3(0.)) / 20.) * vol;
    }
    
    w *= 2. + sin(x) * 2. - 2. * vol + abs(sin(x));
    float map =         
        opBlend(
            sdCross(p * fullRotate(vec3(t * 2., 0., t)), w),
            sdCross(p * fullRotate(
                vec3(
                    -PI / 4. + t * 2., 0., PI / 4. + t
                )),
               w
            )
        );            
        
    return vec2(map, 1.);
}

vec3 opTwist( vec3 p, float r ) {
    float  c = cos(r * p.y + r);
    float  s = sin(r * p.y + r);
    mat2   m = mat2(c,-s,s,c);
    return vec3(m*p.xz,p.y);
}


float shadow( in vec3 ro, in vec3 rd, in float maxt )
{
	float res = 5.0;
    float dt = 0.04;
    float t = .02;
    for( int i=0; i < 12; i++ )
    {       
        float h = distance_to_obj(ro + rd * t).x;
        if( h < 0.001 ) return 0.1;
        res = min( res, maxt * h / t );
        t += h;
    }
    return res;
}

vec4 bg ( in vec3 ePos, in vec3 eDir ) {
    vec4 bgColor = vec4(0.1);
    
    bgColor.r -= mod(iAmplifiedTime, 5.45 / 8.) * vol * 4.; 
    bgColor.rgb += spherical_texturing(ePos, iChannel0, .001).rgb;//(eDir.xy + eDir.zy + eDir.zx) / 4.).r * 0.8;
    return bgColor * vec4(1., sin(vol), 0.8, 1.0);
}

void main() {

    //vec2 vPos = fragCoord.xy / iResolution.xy - 0.5;
    //vec2 vPos = -1.0 + 2.0 *vUv -.5;
    //vec2 vPos = -1.0 + 2.0 *vUv ;
    vec2 vPos = -1. + 2. * vUv;
    //vPos.x += sin(iAmplifiedTime);
    //vPos.y += cos(iAmplifiedTime/2.);

    float k = iAmplifiedTime / 1.6;
    float sk = sin(k), ck = cos(k);
    
    vol = texture(iAudioData, vec2(.2, .25)).r;
    
    // Camera setup. 
    vec3 vuv = vec3(0, sk, ck); // up
    //vec3 vuv = vec3(0, vUv.x, vUv.y); // up
    //vec3 vuv = vec3(0, vUv.x-.5, vUv.y-.5);
    vec3 prp = vec3(sk * 60., 1. , ck * -34.); // pos
    vec3 vrp = vec3(10., sk * 10., 0.); // lookat    
    
    vec3 vpn = normalize(vrp - prp) ;
    vec3 u = normalize(cross(vuv, vpn));
    vec3 v = cross(vpn, u);
    vec3 vcv = (prp + vpn);
    vec3 scrCoord = (vcv + vPos.x * u * iResolution.x/iResolution.y + vPos.y * v);
    //vec3 scrCoord = (vcv + vPos.x * u * vUv.x/vUv.y + vPos.y * v);
    vec3 scp = normalize(scrCoord - prp);
    
    float glow = 0.;
    float minDist= 100.;
    
    float f = 2.0;
    
    for (float i = 0.; i < 32.; i++) {
        if ((abs(d.x) < .001) || (f > maxd)) break;
    
        f += d.x;

        p = prp + scp * f;
        p = opTwist(p, 0.08 * sk) * fullRotate(vec3(k * 1.2));
    
        //d = distance_to_obj(p);
        d = distance_to_obj(p); // fixes glitches
    
        minDist = min(minDist, d.x * 1.5);
        glow = pow( 1. / minDist, 1.35);  
    }
   
    if (f < maxd) {      
        //Color = texture(iChannel0, p) / 2. + texture(iChannel0, -reflect(p, scp)) / 2.;
        float len = length(vPos);
        float r1 = 0.3 / len + iAmplifiedTime * 0.5;
        vec4 tex1 = texture2D(iChannel1, p.xy);
        vec4 tex2 = texture2D(iChannel1, vec2(-reflect(p, scp))) / 2.;
        
        Color = tex1 + tex2;
        Color *= shadow(p, scp, 24.);
        //Color = vec4(Color.g);
        //Color = vec4(Color.b);
        
    } else {
        //background        
        Color = bg(-normalize(scp), scp) + pow(glow, vol*0.9)* vec4(3., 2., 1., 1.0) * 0.75;
              
    }   
     /*
    if (iAmplifiedTime > 19.0 && iAmplifiedTime < 31.45) {
        Color -= 1. - (21.45 - iAmplifiedTime) / 2.;
    }
    
    */
    
    if(vol>0.3) {
        Color -= 1. - (1. - sin(iAmplifiedTime)) / 2.;
    }
    
    // iq vinegre
    vec2 q = vPos + .5;
    // black squares? :-/
    //Color *= 0.4 + 0.6*pow( 32.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1 );
    
    // Cheap 'bloom emulation' from backscatter;
    Color += pow(max(Color - .2, 0.0), vec4(1.4)) * .5;
    //gl_FragColor = Color;// * sin(length(vPos) - 1.5) * -1.2;  
    gl_FragColor = Color* sin(length(vPos) - 1.5) * -1.2;  
}

