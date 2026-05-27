// https://www.shadertoy.com/view/lXVfW3
// Modified by ArthurTent
// Created by Patan77 
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

// Enhanced audio analysis with smoothing
float bass() { return texture(iAudioData, vec2(0.0, 0.25)).x; }
float mids() { return texture(iAudioData, vec2(0.3, 0.25)).x; }
float highs() { return texture(iAudioData, vec2(0.7, 0.25)).x; }

float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i+vec2(0,0)),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p); p *= 2.0; a *= 0.5;
    }
    return v;
}

mat2 rot(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0*fragCoord - iResolution.xy)/iResolution.y;
    float time = iTime * 0.3;
    
    // Multi-band audio analysis
    float b = bass() * 2.0;
    float m = mids() * 0.2;
    float h = highs() * 1.0;
    float beat = smoothstep(0.6, 0.9, b);
    
    vec3 col = vec3(0);
    float energy = 0.0;
    
    // Bass-driven background pulse
    vec2 grid = fract(uv * (5.0 + b*3.0)) - 0.5;
    float cells = length(grid) * exp(-length(uv)*(1.0 + b));
    col += 0.25 * cos(vec3(0,2,4) + cells * (12.0 + b*8.0) + time + m*2.0);
    
    // Fractal system with layered audio reactivity
    vec2 uv2 = uv * rot(time*0.1 * (0.8 + m*0.4));
    for(int i=0; i<18; i++) {
        // Frequency-specific transformations
        uv2 = abs(uv2 * rot(time*0.05 + float(i)*0.2 + m*0.4) * 
                (1.7 + h*0.3 - b*0.2)) - (0.8 + b*0.3);
        
        // Highs-driven detail injection
        float n = fbm(uv2 * (3.0 + h*4.0) + time * (0.4 + m*0.2));
        uv2 += n * (0.15 + h*0.1) * sin(time*2.0 + float(i)*TAU/3.0);
        
        // Bass-modulated distance field
        float d = length(uv2) * exp(-length(uv2*(0.7 + b*0.1)));
        d = sin(d * (16.0 + b*8.0 + h*4.0) + time * (3.0 + m*2.0)) * 0.5 + 0.5;
        
        // Mids-driven color phasing
        vec3 c = 0.7 + 0.7 * cos(TAU*d + vec3(0,0.8,1.6) + 
                time*(0.5 + m*0.5) + vec3(b*2.0));
        c = mix(c, 1.2 - c, smoothstep(0.3,0.7,d + h*0.2));
        
        // Beat-reactive energy flashes
        float layer = d * (1.0 - energy) * (1.0 + beat*0.5);
        col += c * layer * (0.8 + 0.4 * sin(time + float(i)) * (1.0 + h*1.5));
        energy += layer * (0.25 + m*0.15);
        
        // Audio-driven evolution
        uv2 *= 1.08 + 0.15 * sin(time*0.4) + h*0.05;
        uv2 += vec2(0.25, -0.15) * sin(time*(0.2 + m*0.1) + float(i));
    }
    
    // Anti-aliased high-frequency sparkles
    float sparkleFreq = 600.0 + h*400.0;
    float sparkleInput = uv.x*uv.y*sparkleFreq + time*10.0;
    float sparkle = sin(sparkleInput);
    float sparkleAA = fwidth(sparkleInput) * 2.0;
    sparkle = smoothstep(0.99 - sparkleAA, 0.99 + sparkleAA, abs(sparkle));
    sparkle *= h * exp(-length(uv)*4.0);
    col += vec3(sparkle) * (0.9 + 0.1*hash(uv + time)); // Dithering
    
    // Bass shockwaves with AA
    float wave = length(uv)*30.0 - time*10.0 + b*20.0;
    float waveAA = fwidth(wave)*2.0;
    col += vec3(1.0,0.7,0.5) * sin(wave)*exp(-length(uv)*3.0)*b*smoothstep(-waveAA, waveAA, sin(wave));
    
    // Mid-range color trails
    vec3 grad = vec3(
        fbm(uv + time*0.2 + m),
        fbm(uv + time*0.3 + m),
        fbm(uv + time*0.4 + m)
    ) * 1.5 - 0.75;
    col += grad * 0.15 * (1.0 - smoothstep(0.0, 2.0, length(uv))) * m;
    
    // Dynamic tonemapping
    col = pow(col * 0.4, vec3(1.3 + 0.3 * sin(time*0.5) + m*0.2));
    col *= 1.0 - 0.3 * smoothstep(0.5, 2.0, length(uv));
    

    fragColor = vec4(col, 1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
