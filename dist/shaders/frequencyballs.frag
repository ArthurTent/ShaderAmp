// https://www.shadertoy.com/view/4scGW2
// frequency balls by nshelton
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


float sphere(vec3 c, float r, vec3 p) {
	return length(p-c) - r;   
}

float DE(vec3 p) {
    //vec4 n1 = texture(iChannel0, vec2(0.2));
    //vec4 n2 = texture(iChannel1, vec2(0.3));

    float min_d = 100.;
    
    for ( int i = 0 ; i < 20; i ++ ) {
        float t = float(i)/20. ;
        float freq = pow(texture(iAudioData, vec2(t, 0.)).r, 3.0) * 2.;
        
		float t_tex =  t + iGlobalTime/100.;
        //vec4 n0 = texture(iChannel0, vec2(cos(t_tex), sin(t_tex)));
		//n0= n0 * 3. - 1.5;
        //n0.y *=2.;
        vec3 c = vec3(t * 10. - 5. , 0., 0.);// + n0.xyz;
		min_d = min ( min_d, sphere(c, freq, p));

    }
        return min_d;
}

vec3 grad(vec3 p) {
 vec2 eps = vec2(0.01, 0.0);
 
    return normalize(vec3(
        DE(p + eps.xyy) -  DE(p - eps.xyy),
        DE(p + eps.yxy) -  DE(p - eps.yxy),
        DE(p + eps.yyx) -  DE(p - eps.yyx)));
}

void main() 
{
	//vec2 uv = fragCoord.xy / iResolution.xy ;
    //vec2 uv = -1.0 + 2.0 *vUv -.5;
    vec2 uv = -1.0 + 2.0 *vUv +.35;
	uv = uv *2. - 1.; 
    uv.x *= iResolution.x/iResolution.y;
    
    vec3 ray = normalize(vec3(uv, 1.));
    //vec3 camera = vec3(0.0, 0.0, sin(iGlobalTime)-4.);
    vec3 camera = vec3(sin(iGlobalTime)*.4,cos(iGlobalTime), sin(iGlobalTime)-4.);
    
    float iter = 0.;
    float t = 0.;
   	vec3 point;
 	bool hit = false;
    for ( int i = 0; i < 10; i ++) {
    	point = camera + ray * t;
        
        float d = DE(point);
        
        if (DE(point) < 0.1){
         	hit = true;
            break;
        }
        
        iter += 0.1;
        t += d;
    }
    vec3 color = vec3(0., 0., 0.);
    if ( hit) {
    	color = vec3(dot(ray, -grad(point))) * vec3(1.-(cos(iGlobalTime)+sin(iGlobalTime)), sin(iGlobalTime), cos(iGlobalTime)) ;
    	color *= 1. - iter;
    } 
    
    gl_FragColor = vec4(color, 1.0);
    
}