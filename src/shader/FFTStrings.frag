// https://www.shadertoy.com/view/4lyBR3
// Created by RaduBT 
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// lots of inspiration from IQ and hg_sdf

const float PI = 3.14159265359;
const int MAX_MARCHING_STEPS = 50;
const float EPSILON = 0.0001;

vec2 rotate2d(vec2 v, float a) {
	return vec2(v.x * cos(a) - v.y * sin(a), v.y * cos(a) + v.x * sin(a)); 
}

// Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.
// Read like this: R(p.xz, a) rotates 'x towards z'.
void pR(inout vec2 p, float a) {
	p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

float sdTorus( vec3 p, vec2 t ) {
	vec2 q = vec2(length(p.xz)-t.x,p.y);
	return length(q)-t.y;
}

float opTwist( vec3 p, float fftValue, float time ) {
    float c = cos((fftValue*1.5) *p.y);
    float s = sin((fftValue+0.5)*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m * p.xz, p.y);
    
    return sdTorus(q, vec2(abs(sin(iTime*0.1))+0.5*(fftValue*0.2), fftValue*0.0001));

}

float opRep( vec3 p, vec3 c ) {
            
    float idx = mod((floor((p.x)/c.x)), 32.0);
    float idy = mod((floor((p.y)/c.y)), 32.0);
    float idz = mod((floor((p.z)/c.z)), 32.0);
    
	float id = length(vec3(idx, idy, idz));
       
    float fftValue = (((texture( iAudioData, vec2(id+1.0, 0.0) ).x)) * 10.0);
    
    vec3 q = mod(p, c) - 0.5 * c;

    vec3 r = q;  
    
    float rotationAmount = (id * 5.0) + (iGlobalTime * 2.0);
   
    bool xmod2 = mod(idx, 2.0) == 0.0;
    
    // offset even rows
    if (xmod2) {
    	q.y += 1.5;
        r.y -= 1.5;
    }
    
	pR(q.xy, rotationAmount);
    pR(q.xz, rotationAmount * 0.1);
    
    float shape1 = opTwist(q, fftValue, iGlobalTime);
    
    if (xmod2) {
    
        pR(r.xy, rotationAmount);
        pR(r.xz, rotationAmount * 0.1);
        
        float shape2 = opTwist(r, fftValue, iGlobalTime);
        
    	return min(shape1, shape2);
        
    } else {
        
        return shape1;
        
    }
}


float sceneSDF(vec3 samplePoint) {
	return opRep(samplePoint, vec3(3.0, 3.0, 3.0));
}

vec3 castRay(vec3 pos, vec3 dir) {
	for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
		float dist = sceneSDF(pos);
        if (dist < EPSILON) {
			return pos;
        }
		pos += dist * dir;
	}    
	return pos;
}


float lightPointDiffuse(vec3 pos, vec3 lightPos) {
	float lightDist = length(lightPos - pos);
	float color = 3.0 / (lightDist * lightDist);
	return max(0.0, color);
}

void main() {
    vec2 uv =  -1.0 + 2.0 *vUv;//+.75;
    float fft = ( iAudioData, vec2(uv.x,uv.y) ).x; 
	fft = 0.9*fft;
    
	//vec4 mousePos = (iMouse / iResolution.xyxy) * 2.0 - 1.0;
    /*
    
	vec4 mousePos = vec2(PI / 2.0, PI / 2.0).xyxy;
    
    if (iMouse.zw == vec2(0.0)) {
        mousePos.xy = vec2(0.5, -0.2); 
    }
	*/
	//vec2 screenPos = (vUv.xy / iResolution.xy) * 2.0 - 1.0;
    vec2 screenPos =uv;// vUv.xy * 2.0 - 1.0;
	
	vec3 cameraPos = vec3(0.0, 0.0, -8.0);
	
	vec3 cameraDir = vec3(0.0, 0.0, 1.0);
	vec3 planeU = vec3(2.0, 0.0, 0.0);
	vec3 planeV = vec3(0.0, iResolution.y / iResolution.x * 2.0, 0.0);
	vec3 rayDir = normalize(cameraDir + screenPos.x * planeU + screenPos.y * planeV);
	
    cameraPos.yz = rotate2d(cameraPos.yz, iGlobalTime);
    cameraPos.xz = rotate2d(cameraPos.xz, iGlobalTime);
    //rayDir.yz = rotate2d(rayDir.yz,iGlobalTime*fft);

	//cameraPos.xz = rotate2d(cameraPos.xz, iGlobalTime*fft);
	//rayDir.xz = rotate2d(rayDir.xz, iGlobalTime*fft);

    //cameraPos.zy += iTime;

    /*
	cameraPos.yz = rotate2d(cameraPos.yz, mousePos.y);
	rayDir.yz = rotate2d(rayDir.yz, mousePos.y);
	
	cameraPos.xz = rotate2d(cameraPos.xz, mousePos.x);
	rayDir.xz = rotate2d(rayDir.xz, mousePos.x);
    
    cameraPos.zy += iTime;
	*/
	vec3 rayPos = castRay(cameraPos, rayDir);
	
    // base color
	vec3 color = vec3(0.01, 0.23, 0.43);
    
    color += (rayDir*0.02);
    
    vec3 lightPos = cameraPos;

    color *= 10.0 * lightPointDiffuse(rayPos, lightPos) * 10.0;
    
	color = pow(color, vec3(0.4));	
	
	gl_FragColor = vec4(color, 1.0);
    //gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * (20.+fft);
    //gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * vec4(vec3(255.*fft*(1.- sin(iTime)),50.*fft*sin(iTime),20.*fft*cos(iTime)),1.);
    //gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * vec4(vec3(150.*(1.5-(cos(50.*iTime*fft)*sin(100.*iTime/fft))), 75.*(1.- sin(iGlobalTime)), cos(iGlobalTime)*100.*fft),1.);
}