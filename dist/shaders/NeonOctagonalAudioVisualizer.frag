// https://www.shadertoy.com/view/Wd23Rw
// Modified by ArthurTent
// Neon Octagonal Audio Visualizer by Emiel
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// line antialiasing using smoothstep technique by FabriceNeyret2 (https://www.shadertoy.com/view/4dcfW8)

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define freq(f) texture(iAudioData, vec2(f, 0.25)).x * 0.8
#define wave(f) texture(iAudioData, vec2(f, 0.75)).x

float rand(float n){return fract(sin(n) * 43758.5453123);}
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;
const float PI = 3.1415926;

// MIT Licensed hash From Dave_Hoskins (https://www.shadertoy.com/view/4djSRW)
vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

vec3 stars(in vec3 p)
{
    vec3 c = vec3(0.);
    float res = iResolution.x*0.8;
    
	for (float i=0.;i<4.;i++)
    {
        vec3 q = fract(p*(.15*res))-0.5;
        //q*= snd/10.;
        vec3 id = floor(p*(.15*res));
        vec2 rn = hash33(id).xy;
        float c2 = 1.-smoothstep(0.,.6,length(q));
        c2 *= step(rn.x,.0005+i*i*0.001);
        c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.25+0.75);
        p *= 1.4;
    }
    return c*c*.65;
}
void camera(vec2 fragCoord, out vec3 ro, out vec3 rd, out mat3 t)
{
    float a = 1.0/max(iResolution.x, iResolution.y);
    //rd = normalize(vec3((fragCoord - iResolution.xy*0.5)*a, 0.5));
    rd = normalize(vec3(fragCoord, 1.0));

    ro = vec3(0.0, 0.0, -15.);

    //float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y));
    float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y))+sin(iTime/20.);
    vec2 m = PI*ff + vec2(((iMouse.xy + 0.1) / iResolution.xy) * (PI*2.0));
    //m.y = -m.y;
    m.y = sin(m.y*0.5)*0.3 + 0.5;

    //vec2 sm = sin(m)*sin(iTime), cm = cos(m)*(1.+sin(iTime));
    vec2 sm = sin(m)*(1.+sin(iTime/10.)/2.), cm = cos(m);
    mat3 rotX = mat3(1.0, 0.0, 0.0, 0.0, cm.y, sm.y, 0.0, -sm.y, cm.y);
    mat3 rotY = mat3(cm.x, 0.0, -sm.x, 0.0, 1.0, 0.0, sm.x, 0.0, cm.x);

    t = rotY * rotX;

    ro = t * ro;
    rd = t * rd;

    rd = normalize(rd);
}


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
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    vec2 R = iResolution.xy;
    //vec2 uv = fragCoord / iResolution.xy - 0.5;
    vec2 uv = -1.0 + 2.0 *vUv;
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(uv,-1.5));
    mat3 t = mat3(1.0);
	camera(uv, ro, rd, t);
    uv *= vec2(1.0, iResolution.y / iResolution.x);

    vec3 col = vec3(0.0);
    
    float bassFreq = pow(avgFreq(0.0, 0.1, 0.01), 0.85);
    float medFreq = pow(avgFreq(0.1, 0.6, 0.01), 0.85);
    float topFreq = pow(avgFreq(0.6, 1.0, 0.01), 0.85);
    float ccnt = 8.0;
    
    float hue = iAmplifiedTime;
    float speed = iAmplifiedTime * 0.5 + topFreq * 0.1;
    
    bool first = false;
    
    for (int j = 0; j < int(ccnt); j++) {
        float i = float(j);
        float spos = speed + i * 3.14 * 2. / ccnt;
        
        if (rand(i * 100.0 + floor(iAmplifiedTime * 15.0) * 50.0) < bassFreq * 0.1) continue;
        
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

            if (rand(i * 100.0 + l + floor(iAmplifiedTime * 50.0) * 50.0) > bassFreq * 0.8) continue;
            
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
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
