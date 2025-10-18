// https://www.shadertoy.com/view/W3BfRw
// Modified by ArthurTent
// Created by EyeOfPython
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;

/*
Forked from "Nyan Cat Shader" by EyeOfPython 
https://www.shadertoy.com/view/Ms2XzK

Nyan nyan nyan nyan! Nyan nyan nyan.
*/
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
vec4 getRainbowAt(vec2 p, vec2 nyan_p)
{
    // original line
    //float f = (p.y+nyan_p.y-0.08)*5.3*1.2 + 0.03*sin((p.x+nyan_p.x)*100.0+iTime*40.0);
    float f = (p.y+nyan_p.y-0.08)*5.3*1.2 - 1.5*FFT(p.x*100.)+.1;
    return vec4( ( (1.0-step(0.6,f)) + 0.29*step(1.0,f) ), 
               ( step(0.2,f)/pow(3.14159,(3.0-3.0*step(0.4,f)+4.84409*step(0.6,f))/8.0) - 0.5*step(0.8,f) ),
               ( step(0.8,f)-0.49*step(1.0,f)),
                step(0.0, f)*(1.0-step(1.0,f))*(1.0-step(-nyan_p.x+0.08,p.x))
             );
}
vec4 getNyanAt(vec2 p, vec2 nyan_p, float nyan_s)
{
    float nyan_t = floor(mod(iTime*2.0,1.0)*6.0)/6.4;
    return texture(iChannel0, clamp(p+nyan_p, vec2(0,0), vec2(nyan_s-0.01,1))
                    * vec2((1.0/nyan_s)/6.0, -1.0/nyan_s) + vec2(0,1) + vec2(nyan_t,0));
}

float getStarAt(vec2 p, vec2 star_p)
{
    vec2 o = p/0.8 - mod(p/0.8,0.2);
    float dt = .7*o.x + 2.0*o.y;
    float visible = step(0.9,sin(o.x*6.0+8.5*o.y+iTime*0.3 + cos(o.x*1.542)));
    float specialstar = step(0.999,sin(o.x*6.0+8.5*o.y+iTime*0.3 + cos(o.x*1.542)));
    
    p = mod(p/0.8,0.2);
    vec2 q = p+star_p;
    q = floor(q*70.0)/70.0;
    float a = atan(q.x, q.y);
    float r = length(q);
    float t = mod(iTime + dt, 1.0)/1.0;
    
    return ( step(0.1, 0.1*cos((4.0+4.0*specialstar)*a))
                * (1.0-step(0.02+0.02*step(0.2,t)+0.01*step(0.4,t),r)) )
        		* (step(0.01-0.01*step(0.4,t),r)
        		* (1.0-step(0.4,t)*(r<=0.01 || r>=0.02?0.0:1.0) ) 
                * (1.0-step(0.6,t)*(1.0-step(0.03,r))) )
        		* (1.0-step(0.8,t))
        	* visible
        ;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 wuv = uv * vec2(iResolution.x / iResolution.y, 1);
    vec4 col = vec4(1);
    vec4 backgr = vec4(0.16, 0.16, 0.45, 1.0);
    
    vec2  nyan_p = vec2(0.1*sin(iTime*1.4)-0.3,0.1*sin(iTime*.6)-0.35);
    float nyan_s = 0.3;
    float dt = iTime*1.0;
    col = mix(backgr, vec4(1), getStarAt( wuv + vec2(dt,0), vec2(-.1, -.1)));
    
    vec4 rainbow = getRainbowAt(uv, nyan_p);
    col = mix(col, rainbow, rainbow.a);
    vec4 nyan = getNyanAt(uv, nyan_p, nyan_s);
    
    col = mix(col, nyan, nyan.a);
    
    fragColor = vec4(col);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
