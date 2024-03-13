// https://www.shadertoy.com/view/Wd23Rw
// Modified by ArthurTent
// Neon Octagonal Audio Visualizer by Emiel
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// line antialiasing using smoothstep technique by FabriceNeyret2 (https://www.shadertoy.com/view/4dcfW8)

uniform float iGlobalTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


#define freq(f) texture(iAudioData, vec2(f, 0.25)).x * 0.8
#define wave(f) texture(iAudioData, vec2(f, 0.75)).x

float rand(float n){return fract(sin(n) * 43758.5453123);}

float sdLine( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

vec3 hsl(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

float avgFreq(float start, float end, float step) {
    float div = 0.0;
    float total = 0.0;
    for (float pos = start; pos < end; pos += step) {
        div += 1.0;
        total += freq(pos);
    }
    return total / div;
}

void main() 
{
    vec2 R = iResolution.xy;
    //vec2 uv = fragCoord / iResolution.xy - 0.5;
    vec2 uv = -1.0 + 2.0 *vUv;
    uv *= vec2(1.0, iResolution.y / iResolution.x);

    vec3 col = vec3(0.0);
    
    float bassFreq = pow(avgFreq(0.0, 0.1, 0.01), 0.85);
    float medFreq = pow(avgFreq(0.1, 0.6, 0.01), 0.85);
    float topFreq = pow(avgFreq(0.6, 1.0, 0.01), 0.85);
    float ccnt = 8.0;
    
    float hue = iGlobalTime;
    float speed = iGlobalTime * 0.5 + topFreq * 0.1;
    
    bool first = false;
    
    for (int j = 0; j < int(ccnt); j++) {
        float i = float(j);
        float spos = speed + i * 3.14 * 2. / ccnt;
        
        if (rand(i * 100.0 + floor(iGlobalTime * 15.0) * 50.0) < bassFreq * 0.1) continue;
        
        vec2 cpos = vec2(cos(spos), sin(spos)) * (bassFreq * 0.15 + 0.005);
        
        float csize = (0.02 + medFreq * 0.08 + bassFreq * 0.002);
        float cdist = length(uv - cpos) - csize;
        
        if (cdist < 0.0) {
            bool draw = true;
            if (j == 0) first = true;
                
            if (j == int(ccnt) - 1) {
                draw = !first;
            }
            
            if (draw) {
            	//col = hsl(hue, bassFreq * 0.1, topFreq * 2.0) * ((10.0* csize) - cdist * 5.0);
                col = hsl(hue, bassFreq * 0.1, topFreq*1.25) * ((bassFreq*8.0* csize) - cdist * 5.0);
            }
        }
    }
    
    
    if (length(col) < 0.001) {
        col = hsl(hue, bassFreq * 0.1, medFreq * 0.5) * length(uv);
    }
    
    for (int j = 0; j < int(ccnt); j++) {
    	for (int k= 0; k < int(ccnt); k++) {
            float i = float(j);
            float l = float(k);
            //float spos = .525 *bassFreq * speed + i * 3.14 * 2. / ccnt;
            //float spos2 = .525 * bassFreq * speed + l * 3.14 * 2. / ccnt;
            float spos = speed + i * 3.14 * 2. / ccnt;
            float spos2 = speed + l * 3.14 * 2. / ccnt;

            if (rand(i * 100.0 + l + floor(iGlobalTime * 50.0) * 50.0) > bassFreq * 0.8) continue;
            
            //vec2 cpos = vec2(sin(spos), cos(spos)) * (bassFreq * 0.15 + 0.005) * 2.0;
            vec2 cpos = vec2(sin(spos), cos(spos)) * (bassFreq * 0.25 + 0.005) * 2.0;
            //vec2 cpos2 = vec2(sin(spos2), cos(spos2)) * (bassFreq * 0.15 + 0.005) * 2.0;
            vec2 cpos2 = vec2(sin(spos2), cos(spos2)) * (bassFreq * 0.25 + 0.005) * 2.0;

            float lineDist = sdLine(uv, cpos, cpos2);
            float width = 1.1*  1.0 / iResolution.x*bassFreq*30.*topFreq*bassFreq;
            	//col += hsl(hue, bassFreq * 0.1 + 0.5, 0.1 + bassFreq * 1.4) 
                col += hsl(hue, bassFreq * 0.1 + 0.5, 0.1 + bassFreq * .4) 
                    * smoothstep(width, 0., lineDist);
    	}
        
    }
    
    gl_FragColor = vec4(col,1.0);
    gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * 5.5*topFreq;
}