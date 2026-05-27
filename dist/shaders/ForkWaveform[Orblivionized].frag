// https://www.shadertoy.com/view/wffXDr
// Modified by ArthurTent
// Created by Xor
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iTime;
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// Fork of "Fork Waveform [Orblivionized]" by orblivius https://www.shadertoy.com/view/3c3XzS
// Fork of "Fork Waveform [ dotmpe 444" by dotmpe. https://shadertoy.com/view/3cdSD7
// 2025-06-06 08:27:10

/*
    "Waveform" by @XorDev
    
    I wish Soundcloud worked on ShaderToy again
    
    Orblivius: is this what you were trying to do?
*/

#define s(x) smoothstep(0.15, 0.3, x * 1.1 - 0.1)
vec3 chromaKey(vec3 x, vec3 y){
	vec2 c = s(vec2(x.g - x.r * x.y, x.g));

    return mix(x, y, c.x * c.y);
}
vec3 getTexture(vec2 p){
	vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}


float bg(vec2 p) {
	float scale = 3.0;
	p.x +=.5;
	p.y +=.5;
	p = (p - 0.5) * scale + 0.5;
	float sdf = 1.;
	if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) {
		return sdf; 
	}
	vec3 texColor = texture(iChannel0, p).rgb;
	if (texColor.g > 0.5 ) { // Detect Green
		sdf = 0.0;
	}
	return sdf;
}

void mainImage(out vec4 O, vec2 I)
{
    //Raymarch iterator, step distance, depth and reflection
    float i, d, z, r;
    vec2 uv = I.xy/iResolution.xy;
    //Clear fragcolor and raymarch 90 steps
    
    for(O*= i; i++<9e1;
    //Pick color and attenuate
    O += (cos(z*.5+iTime+vec4(0,2,4,3))+1.3)/d/z)
    {
        //Raymarch sample point
        vec3 p = z * normalize(vec3(2.*I,0) - iResolution.xyy);
        //Shift camera and get reflection coordinates
        r = max(-++p, 0.).y;
        //Mirror
        p.y += r+r;
        //Music test
        p.y += -4.*texture(iAudioData, vec2(p.x,-10)/2e1+.5,2.).r;
        
        //Sine waves
        //for(d=1.; d<3e1; d+=d)
           // p.y += cos(p*d+2.*iTime*cos(d)+z).x/d;
       	     
        //Step forward (reflections are softer)
        z += d = (.1*r+abs(p.y-1.)/ (1.+r+r+r*r) + max(d=p.z+3.,-d*.1))/8.;
    }
    
    
    //Tanh tonemapping
    O = tanh(O/9e2);
    //O += vec4(tex(uv), 1.);
    vec4 greenScreen = vec4(0.,1.,0.,1.);

    vec2 p = -1.+2.*uv;
    p=uv *0.8;
    p.x+=.1; 
    p.y+=.1;

    //p.y +=1.125;
    //p.x +=.5;
    //p= uv*.8;
    
    vec4 vid = texture(iVideo,p);
    vec3 diff = vid.xyz-greenScreen.xyz;
    float fac = smoothstep(.55-.05,.55+.05,dot(diff,diff));
    //O-=vid*fac;
    O+=vid*fac;


}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
