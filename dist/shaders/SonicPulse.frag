// https://www.shadertoy.com/view/4dcyD2
// Sonic Pulse by WillKirkby
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


float circle(vec2 p, float r){
	return r-length(p);
}

float scene(vec2 p){
    vec2 p1=p;
    if(abs(p.x)<.85&&abs(p.y)<.35)
        p1=mod(p+.05,.1)-.05;  
    
    //p-=mod(p+.05,.1)-.05;
    float r = texture(iAudioData, vec2(length(p)*.5,0)).r;
    return circle(p1,.06*r*r);
}

void main( )
{
	const float cinematicAspect = 2.35;
	float currAspect = iResolution.x/iResolution.y;
    
    //vec2 uv = fragCoord/iResolution.xy-.5;
    vec2 uv = -1.0 + 2.0 *vUv;
    vec4 wave = texture(iAudioData,uv/256.);
    uv.x *= currAspect;
    
    float d = scene(uv);
    
    gl_FragColor = 1.-clamp(vec4(d*iResolution.y*.5),0.,1.);
    gl_FragColor.rgb = mix(
    	//vec3(11,231,184)/255.,
        vec3(int(sin(wave.r)*200.),75+int(sin(wave.r)*10.),75+int(cos(wave.r)*50.))/255.,
        vec3(30,57,77)/255.,
        gl_FragColor.rgb
    );
    
    if (abs(uv.y) > .75*(currAspect/cinematicAspect))
    {
		gl_FragColor *= 0.;
	}
    else
    {
        //gl_FragColor = gl_FragColor * (length(uv)*-.5+1.) + texture(iChannel0,uv/256.)*.004;
        //                      ^ vignette           ^ noise to hide banding
        gl_FragColor = gl_FragColor * (length(uv)*-.5+1.);
        gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * (wave.r*100.);
	}
}