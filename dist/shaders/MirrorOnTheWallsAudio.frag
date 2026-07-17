// https://www.shadertoy.com/view/fXc3zB
// Modified by ShaderAmp Converter
// Created by dathor
// Original Shader Name: MirrorOnTheWalls?audio:mirror 2
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;

varying vec2 vUv;

/* Updated 2026-09-12 15:41
 * ============================================================================
 * SHADER: Mirror on the walls?
 * AUTHOR: dathor (https://www.shadertoy.com/user/dathor)
 * ----------------------------------------------------------------------------
 * DESCRIPTION:
 * A high-fidelity, audio-reactive journey inside an infinite 
 * mirror room. Specular slate cubes expand and pulse to the driving beat. 
 *
 * Technical Features:
 * - Pure physical reflections for an infinite room illusion
 * - Audio-reactive optical FOV pumping and geometric bass expansion
 * - 5-stage camera rig (Dutch angles, beat-snapping, vertigo drops)
 * - Volumetric neon lighting, soft shadows, and Ambient Occlusion
 * - Cinematic Post-Processing: Dynamic Auto-Focus DOF, 
 *   Cinemascope crop, and anamorphic Chromatic Aberration.
 * ----------------------------------------------------------------------------
 * AUDIO / PLAYBACK NOTE: 
 * Specially engineered for the included track "X'trackTure", though the dynamic 
 * onset detection adapts smoothly to function well with other tracks as well. 
 * Rewind or hit play upon loading—browsers disable audio without user input. 
 * (Ensure audio is bound to BUFFER A / iChannel1)
 * ============================================================================
 */
// to make use as custom uniforms 
// uniform float outro_text;
#define outro_text -1.0



float getChar(vec2 p, int c) {
    float wobble = smoothstep(1.5, 3.0, iTime);
    p.x += sin(p.y * 20.0 + iTime * 5.0) * 0.015 * wobble;
    p.y += cos(p.x * 15.0 - iTime * 3.0) * 0.005 * wobble;

    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;
    
    vec2 uv = p / 16.0 + vec2(float(c % 16), float(15 - c / 16)) / 16.0;
    float d = texture(iChannel3, uv).r;
    
    return smoothstep(0.25, 0.75, d);
}
void CH(int c, inout float mask, inout vec2 p) { mask = max(mask, getChar(p, c)); p.x -= 0.5; }
void SP(inout vec2 p) { p.x -= 0.5; }

vec3 getScene(vec2 uv) {
    return texture(iChannel0, uv).rgb;
}

vec3 applyDOF(vec2 uv, vec2 res, float focusDist, float focusRangeNear, float focusRangeFar, float maxRadiusPx) {
    float depth = texture(iChannel0, uv).w;

    float coc = (depth < focusDist)
        ? clamp((focusDist - depth) / focusRangeNear, 0.0, 1.0)
        : clamp((depth - focusDist) / focusRangeFar, 0.0, 1.0);

    float radiusPx = coc * maxRadiusPx;

    if (radiusPx < 0.5) return getScene(uv);

    vec2 pxToUV = 1.0 / res;
    vec3 sum = vec3(0.0);
    float total = 0.0;

    const float GOLDEN_ANGLE = 2.39996; 
    const int SAMPLES = 48;

    for (int i = 0; i < SAMPLES; i++) {
        float t = float(i) + 0.5;
        float ang = t * GOLDEN_ANGLE;
        float r = radiusPx * sqrt(t / float(SAMPLES));

        vec2 offs = vec2(cos(ang), sin(ang)) * r * pxToUV;

        float sDepth = texture(iChannel0, uv + offs).w;
        float sCoc = (sDepth < focusDist)
            ? clamp((focusDist - sDepth) / focusRangeNear, 0.0, 1.0)
            : clamp((sDepth - focusDist) / focusRangeFar, 0.0, 1.0);
            
        float depthPenalty = (sDepth < depth + 1.0) ? 1.0 : 0.1;
        float w = mix(0.3, 1.0, sCoc) * depthPenalty;

        float shift = 0.002 * sCoc; 
        vec3 col;
        col.r = texture(iChannel0, uv + offs + vec2(shift, 0.0)).r;
        col.g = texture(iChannel0, uv + offs).g;
        col.b = texture(iChannel0, uv + offs - vec2(shift, 0.0)).b;

        sum += col * w;
        total += w;
    }
    return sum / total;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 textUV = uv;
    float screenAspect = iResolution.x / iResolution.y;
    float centerDepth = texture(iChannel0, vec2(0.5)).w;
    float focusDist   = min(centerDepth, 25.0);

    float focusRangeNear = 2.5;
    float focusRangeFar  = 7.0;  
    float maxRadiusPx    = 12.0;

    vec3 finalColor = applyDOF(uv, iResolution.xy, focusDist, focusRangeNear, focusRangeFar, maxRadiusPx);

    vec2 centered = uv - 0.5;
    finalColor *= 1.0 - 0.6 * dot(centered, centered);

    float currentAspect = iResolution.x / iResolution.y;
    float targetAspect = 2.35;
    float barHeight = max(0.0, (1.0 - (currentAspect / targetAspect)) * 0.5);
    float cinemascopeMask = step(barHeight, uv.y) * step(uv.y, 1.0 - barHeight);
    
    finalColor *= cinemascopeMask;
    vec2 p; float m;
    float textIntensity = 0.0;
    
    // 1. Correct the aspect ratio for the UV coordinates first
    vec2 aspectUV = textUV;
    aspectUV.x *= screenAspect;
    
    // 2. Base position for text
    p = (aspectUV - vec2(screenAspect * 0.5 - 0.3, 0.25)) / 0.15;
    
    // ----------------------------------------------------
    // A. INTRO TEXT: N42 (Fades out early: iTime 1.2 to 1.8)
    // ----------------------------------------------------
    float introIntensity = 0.0;
    float f0 = 1.0 - smoothstep(1.2, 1.8, iTime);
    
    if (f0 > 0.0) {
        vec2 pIntro = p; 
        CH(78, m, pIntro); introIntensity += m; // 'N'
        CH(52, m, pIntro); introIntensity += m; // '4'
        CH(50, m, pIntro); introIntensity += m; // '2'
        
        introIntensity *= f0 * 2.0;
    }
    
    // ----------------------------------------------------
    // B. OUTRO / OPTIONAL TEXT (Fades in after intro: iTime 2.0 to 3.0)
    // ----------------------------------------------------
    float outroIntensity = 0.0;
    float fOutro = smoothstep(2.0, 3.0, iTime); // Appears after intro is gone
    
    if (fOutro > 0.0) {
        vec2 pOutro = p;
        
        if (outro_text == 0.0) {
            // deadline.berlin
            pOutro.x += 0.75; 
            
            CH(100, m, pOutro); outroIntensity += m; // 'd'
            CH(101, m, pOutro); outroIntensity += m; // 'e'
            CH(97,  m, pOutro); outroIntensity += m; // 'a'
            CH(100, m, pOutro); outroIntensity += m; // 'd'
            CH(108, m, pOutro); outroIntensity += m; // 'l'
            CH(105, m, pOutro); outroIntensity += m; // 'i'
            CH(110, m, pOutro); outroIntensity += m; // 'n'
            CH(101, m, pOutro); outroIntensity += m; // 'e'
            CH(46,  m, pOutro); outroIntensity += m; // '.'
            CH(98,  m, pOutro); outroIntensity += m; // 'b'
            CH(101, m, pOutro); outroIntensity += m; // 'e'
            CH(114, m, pOutro); outroIntensity += m; // 'r'
            CH(108, m, pOutro); outroIntensity += m; // 'l'
            CH(105, m, pOutro); outroIntensity += m; // 'i'
            CH(110, m, pOutro); outroIntensity += m; // 'n'
            
        } else if (outro_text == 0.5) {
            // ShaderAmp
            pOutro.x += 0.25;
            
            CH(83,  m, pOutro); outroIntensity += m; // 'S'
            CH(104, m, pOutro); outroIntensity += m; // 'h'
            CH(97,  m, pOutro); outroIntensity += m; // 'a'
            CH(100, m, pOutro); outroIntensity += m; // 'd'
            CH(101, m, pOutro); outroIntensity += m; // 'e'
            CH(114, m, pOutro); outroIntensity += m; // 'r'
            CH(65,  m, pOutro); outroIntensity += m; // 'A'
            CH(109, m, pOutro); outroIntensity += m; // 'm'
            CH(112, m, pOutro); outroIntensity += m; // 'p'
            
        } else if (outro_text == 1.0) {
            // Nullpunkt 42
            pOutro.x += 0.5;
            
            CH(78,  m, pOutro); outroIntensity += m; // 'N'
            CH(117, m, pOutro); outroIntensity += m; // 'u'
            CH(108, m, pOutro); outroIntensity += m; // 'l'
            CH(108, m, pOutro); outroIntensity += m; // 'l'
            CH(112, m, pOutro); outroIntensity += m; // 'p'
            CH(117, m, pOutro); outroIntensity += m; // 'u'
            CH(110, m, pOutro); outroIntensity += m; // 'n'
            CH(107, m, pOutro); outroIntensity += m; // 'k'
            CH(116, m, pOutro); outroIntensity += m; // 't'
            SP(        pOutro);                      // ' ' (Space)
            CH(52,  m, pOutro); outroIntensity += m; // '4'
            CH(50,  m, pOutro); outroIntensity += m; // '2'
        }
        
        outroIntensity *= fOutro;
    }
    
    // Combine intro and outro safely without clashing
    textIntensity = introIntensity + outroIntensity;
    
    finalColor = mix(finalColor, vec3(0.9, 0.95, 1.0), min(textIntensity, 1.0) * 0.95);
    fragColor = vec4(finalColor, 1.0);
    /*
    vec2 p; float m;
    float textIntensity = 0.0;
    
    // 1. Correct the aspect ratio for the UV coordinates first
    vec2 aspectUV = textUV;
    aspectUV.x *= screenAspect;
    
    // 2. Base position for text
    p = (aspectUV - vec2(screenAspect * 0.5 - 0.3, 0.25)) / 0.15;
    
    // ----------------------------------------------------
    // A. INTRO TEXT: N42 (Always shows at the beginning)
    // ----------------------------------------------------
    {
        float f0 = 1.0 - smoothstep(1.2, 1.8, iTime);
        vec2 pIntro = p; // Independent cursor for intro text
        float introIntensity = 0.0;
        
        CH(78, m, pIntro); introIntensity += m; // 'N'
        CH(52, m, pIntro); introIntensity += m; // '4'
        CH(50, m, pIntro); introIntensity += m; // '2'
        
        textIntensity += introIntensity * f0 * 2.0;
    }
    
    // ----------------------------------------------------
    // B. OUTRO / OPTIONAL TEXT (Based on outro_text value)
    // ----------------------------------------------------
    vec2 pOutro = p; // Independent cursor for outro/optional text
    
    if (outro_text == 0.0) {
        // Nothing extra here, or add your default outro text
        
    } else if (outro_text == 0.5) {
        // Example for outro_text = 0.5:
        // pOutro.y -= 1.5; // shift down if you want it on a new line
        // CH(..., m, pOutro); textIntensity += m;
        
    } else if (outro_text == 1.0) {
        // Example for outro_text = 1.0:
        // CH(..., m, pOutro); textIntensity += m;
    }
    
    finalColor = mix(finalColor, vec3(0.9, 0.95, 1.0), min(textIntensity, 1.0) * 0.95);
    fragColor = vec4(finalColor, 1.0);
    */
    
    /*
    vec2 p; float m;
    float textIntensity = 0.0;
    float f0 = 1.0 - smoothstep(1.2, 1.8, iTime);
    
    // 1. Correct the aspect ratio for the UV coordinates first
    vec2 aspectUV = textUV;
    aspectUV.x *= screenAspect;
    
    // 2. Position and scale 'p' cleanly (adjust the vec2 offset to move it around)
    // Here, we center it horizontally/vertically or place it near the bottom-left/center
    p = (aspectUV - vec2(screenAspect * 0.5 - 0.3, 0.25)) / 0.15;
    
    // 3. Draw and accumulate each character
    CH(78, m, p); textIntensity += m; // 'N'
    CH(52, m, p); textIntensity += m; // '4'
    CH(50, m, p); textIntensity += m; // '2'
    
    textIntensity *= f0 * 2.0; 
    
    if(outro_text==0.0){
        CH(78, m, p); textIntensity += m; // 'N'
        CH(52, m, p); textIntensity += m; // '4'
        CH(50, m, p); textIntensity += m; // '2'
    }else if(outro_text==0.5){
    }else if(outro_text==1.){
    }
    
    finalColor = mix(finalColor, vec3(0.9, 0.95, 1.0), min(textIntensity, 1.0) * 0.95);
    fragColor = vec4(finalColor, 1.0);
    */
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
