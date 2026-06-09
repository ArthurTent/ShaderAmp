// https://www.shadertoy.com/view/N3fXD8
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: Cozy Cabin TV
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

// "Cozy Cabin" with Chroma Key Starfield & Optional Background Audio Waveform
#define GET_BASS   texture(iAudioData, vec2(0.05, 0.25)).r
#define GET_MIDS   texture(iAudioData, vec2(0.40, 0.25)).r
#define GET_TREB   texture(iAudioData, vec2(0.80, 0.25)).r
#define GET_WAVE(x) texture(iAudioData, vec2(x,  0.75)).r

// --- CONFIGURATION ---
// Comment out the line below to disable the audio waveform on the background sky/reflections
#define SHOW_BACKGROUND_WAVE 

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float hash(float n) { return fract(sin(n) * 43758.5453123); }

// Global material tracking
float matID = 0.0; 
float globalGlassDist = 1000.0; // Track glass depth separately for transparency blending

// Distance functions
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCone(vec3 p, vec2 c, float h) {
    float q = length(p.xz);
    return max(dot(c, vec2(q, p.y)), -p.y - h);
}

// PROCEDURAL STARFIELD GENERATOR ---
vec3 getStarfield(vec2 uv) {
    // Generate simple pseudo-random stars based on UV coordinates
    float n = hash(floor(uv.x * 400.0) + floor(uv.y * 400.0) * 123.456);
    vec3 starColor = vec3(0.0);
    
    // Only turn on a small percentage of pixels as sharp stars
    if (n > 0.996) {
        float sparkle = sin(iTime * 2.0 + n * 6.28) * 0.4 + 0.6; // Subtle twinkle effect
        starColor = vec3(n * sparkle);
    }
    
    // Add a very faint, deep blue cosmic background glow
    starColor += vec3(0.02, 0.02, 0.05) * (1.0 - length(uv)); 
    return starColor;
}

// CHROMA KEY FILTER FUNCTION ---
vec3 getChromaVideo(sampler2D channel, vec2 uv) {
    vec3 texColor = texture(channel, uv).rgb;
    
    // Calculate how 'green' the pixel is compared to red and blue
    float greenValue = texColor.g - max(texColor.r, texColor.b);
    
    // Smooth mask for anti-aliasing the edges of the green screen
    float mask = smoothstep(0.05, 0.15, greenValue);
    
    // Fetch the background stars using the UV coordinates
    vec3 backgroundStars = getStarfield(uv - 0.5);
    
    // Linearly blend between the video and the stars based on green intensity
    vec3 compositeColor = mix(texColor, backgroundStars, mask);
    
    #ifdef SHOW_BACKGROUND_WAVE
    // Conditionally compile the background audio visualization
    float wave = GET_WAVE(uv.x);
    float waveLine = smoothstep(0.01, 0.0, abs(uv.y - wave));
    compositeColor += vec3(0.0, 1.0, 0.5) * waveLine * 2.0; // Glowing green wave line
    #endif
    
    return compositeColor;
}

// --- THE SCENE MAP ---
float map(vec3 p) {
    float d = 1000.0;
    
    // 1. TERRAIN
    float groundHarmonic = sin(p.x * 0.5) * 0.2 + cos(p.z * 0.4) * 0.15;
    float ground = p.y + 0.8 - groundHarmonic;
    if (ground < d) {
        d = ground;
        matID = 1.0; // Grass
    }
    
    // Transform coordinates for the Cabin System
    vec3 cabinPos = p - vec3(0.0, -0.35, 1.5);
    
    // 2. EXPLICIT CABIN HOUSING
    float leftWall   = sdBox(cabinPos - vec3(-0.4, 0.0, 0.0), vec3(0.1, 0.35, 0.5));
    float rightWall  = sdBox(cabinPos - vec3(0.4, 0.0, 0.0),  vec3(0.1, 0.35, 0.5));
    float backWall   = sdBox(cabinPos - vec3(0.0, 0.0, 0.4),  vec3(0.5, 0.35, 0.1));
    float floorBeam  = sdBox(cabinPos - vec3(0.0, -0.3, -0.45), vec3(0.5, 0.05, 0.05));
    float ceilingBeam= sdBox(cabinPos - vec3(0.0, 0.3, -0.45),  vec3(0.5, 0.05, 0.05));
    
    float structuralWalls = min(leftWall, min(rightWall, min(backWall, min(floorBeam, ceilingBeam))));
    
    // Detailed Window Frame Borders
    vec3 windowPos = cabinPos - vec3(0.0, 0.0, -0.45);
    float frameLeft   = sdBox(windowPos - vec3(-0.31, 0.0, 0.0), vec3(0.015, 0.26, 0.02));
    float frameRight  = sdBox(windowPos - vec3(0.31, 0.0, 0.0),  vec3(0.015, 0.26, 0.02));
    float frameBottom = sdBox(windowPos - vec3(0.0, -0.26, 0.0), vec3(0.31, 0.02, 0.02));
    float frameTop    = sdBox(windowPos - vec3(0.0, 0.26, 0.0),  vec3(0.31, 0.02, 0.02));
    float frameMiddleV = sdBox(windowPos - vec3(0.0, 0.0, 0.0),   vec3(0.01, 0.26, 0.015));
    float frameMiddleH = sdBox(windowPos - vec3(0.0, 0.0, 0.0),   vec3(0.31, 0.01, 0.015));
    
    float windowFrame = min(min(min(frameLeft, frameRight), min(frameBottom, frameTop)), min(frameMiddleV, frameMiddleH));
    
    // Glass Pane (Evaluated separately so raymarching can pass through it)
    globalGlassDist = sdBox(windowPos, vec3(0.3, 0.25, 0.005));

    // Fixed Roof
    vec3 roofPos = cabinPos - vec3(0.0, 0.35, 0.0);
    vec3 rotatedRoofPos = roofPos;
    rotatedRoofPos.xy *= rot(0.785398);
    
    float roofPlanes = sdBox(rotatedRoofPos, vec3(0.42, 0.42, 0.55));
    float roofBounds = sdBox(roofPos - vec3(0.0, 0.3, 0.0), vec3(0.6, 0.3, 0.55));
    float roof = max(roofPlanes, roofBounds);
    
    float houseStructure = min(structuralWalls, roof);
    
    // Chimney
    vec3 chimneyPos = cabinPos - vec3(0.25, 0.4, 0.2);
    float chimney = sdBox(chimneyPos, vec3(0.08, 0.3, 0.08));
    houseStructure = min(houseStructure, chimney);
    
    if (houseStructure < d) {
        d = houseStructure;
        if (cabinPos.y > 0.34) {
            matID = 2.1; // Roof
        } else {
            matID = 2.0; // Cabin Wood
        }
    }
    
    if (windowFrame < d) {
        d = windowFrame;
        matID = 2.2; // Frame Wood
    }
    
    // 3. THE 3D TELEVISION SET
    vec3 tvPos = cabinPos - vec3(0.0, -0.05, 0.0);
    tvPos.xz *= rot(-0.35); 
    
    float tvOuterFrame = sdBox(tvPos, vec3(0.22, 0.14, 0.02));
    float tvStandNeck  = sdBox(tvPos - vec3(0.0, -0.16, 0.0), vec3(0.02, 0.03, 0.015));
    float tvStandBase  = sdBox(tvPos - vec3(0.0, -0.18, 0.0), vec3(0.12, 0.01, 0.07));
    float tvHardware   = min(tvOuterFrame, min(tvStandNeck, tvStandBase));
    
    float tvScreen = sdBox(tvPos - vec3(0.0, 0.0, -0.01), vec3(0.20, 0.12, 0.015));
    
    if (tvHardware < d && tvHardware < tvScreen) {
        d = tvHardware;
        matID = 5.0; // Dark TV Chassis Bezel
    }
    if (tvScreen < d) {
        d = tvScreen;
        matID = 5.1; // Vivid Emissive Screen Display
    }

    // 4. BACKGROUND PINE TREES
    vec3 treePos = p;
    float cellWidth = 1.2;
    float cellZ = floor((treePos.z - 3.0) / cellWidth);
    float cellX = floor((treePos.x + 2.0) / cellWidth);
    
    if (p.z > 2.0 && p.z < 8.0 && abs(p.x) > 0.5) {
        float randOffset = hash(cellX * 13.0 + cellZ * 37.0);
        treePos.x = mod(treePos.x + 2.0, cellWidth) - cellWidth * 0.5 + (randOffset - 0.5) * 0.4;
        treePos.z = mod(treePos.z - 3.0, cellWidth) - cellWidth * 0.5 + (randOffset - 0.5) * 0.4;
        treePos.y -= -0.6 + sin(cellX) * 0.2;
        
        float treeTrunk = sdBox(treePos - vec3(0.0, 0.1, 0.0), vec3(0.04, 0.2, 0.04));
        float leaf1 = sdCone(treePos - vec3(0.0, 0.7, 0.0), vec2(0.8, 0.6), 0.4);
        float leaf2 = sdCone(treePos - vec3(0.0, 0.4, 0.0), vec2(0.8, 0.6), 0.5);
        float leaf3 = sdCone(treePos - vec3(0.0, 0.1, 0.0), vec2(0.8, 0.6), 0.6);
        
        float pineLeaves = min(leaf1, min(leaf2, leaf3));
        float fullTree = min(treeTrunk, pineLeaves);
        
        if (fullTree < d) {
            d = fullTree;
            matID = (fullTree == treeTrunk) ? 2.0 : 3.0;
        }
    }

    return d;
}

vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    float d = map(p);
    vec3 n = d - vec3(
        map(p - e.xyy),
        map(p - e.yxy),
        map(p - e.yyx)
    );
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 screenUV = fragCoord / iResolution.xy;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    vec3 sunDir = normalize(vec3(0.5, 0.3, 1.0));
    
    vec3 ro = vec3(0.0, 0.1, -1.3); 
    vec3 rd = normalize(vec3(uv, 1.3));
    
    if (iMouse.z > 0.0) {
        float angleX = (iMouse.x / iResolution.x - 0.5) * 2.5;
        ro.xz *= rot(angleX);
        rd.xz *= rot(angleX);
    }

    // --- RAYMARCHING ENGINE ---
    float t = 0.0;
    float maxDist = 10.0;
    bool hit = false;
    float hitGlassT = -1.0; 
    
    for (int i = 0; i < 140; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        
        if (globalGlassDist < 0.001 && hitGlassT < 0.0) {
            hitGlassT = t;
        }
        
        if (d < 0.0005) {
            hit = true;
            break;
        }
        t += d;
        if (t > maxDist) break;
    }

    // --- SKIES AND TELEVISION RUNS THROUGH CHROMA FUNCTION ---
    vec3 videoBg = getChromaVideo(iVideo, screenUV);
    vec3 col = videoBg;

    // --- WATER REFLECTION / LAKE ---
    float lakeHorizon = -0.32;
    if (!hit && uv.y < lakeHorizon) {
        float distortion = sin(uv.x * 40.0 + iTime * 3.0) * 0.005;
        
        vec2 reflectUV = vec2(screenUV.x + distortion, (lakeHorizon * iResolution.y / iResolution.y) - (screenUV.y - lakeHorizon * iResolution.y / iResolution.y));
        reflectUV = clamp(reflectUV, 0.0, 1.0);
        
        // Pass reflection sample through Chroma Key as well
        col = getChromaVideo(iVideo, reflectUV) * 0.65;
        
        float cabinReflectGlow = smoothstep(0.4, 0.0, abs(uv.x));
        col += vec3(0.3, 0.6, 1.0) * cabinReflectGlow * (0.2 + 0.1 * sin(iTime * 8.0));
    }

    // --- RENDERING SURFACE SHADING ---
    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = getNormal(p);
        float mID = matID;
        
        vec3 albedo = vec3(0.2);
        vec3 emission = vec3(0.0);
        float spec = 0.0;
        
        if (mID < 1.5) {
            albedo = vec3(0.1, 0.2, 0.08);
        } else if (mID < 2.05) {
            albedo = vec3(0.25, 0.14, 0.08);
            albedo *= 0.85 + 0.15 * sin(p.y * 50.0);
        } else if (mID < 2.15) {
            albedo = vec3(0.35, 0.12, 0.1);
        } else if (mID < 2.3) {
            albedo = vec3(0.08, 0.05, 0.03); 
        } else if (mID < 3.5) {
            albedo = vec3(0.05, 0.12, 0.08);
        } else if (mID < 5.05) {
            albedo = vec3(0.02, 0.02, 0.03);
            spec = 0.7;
        } else if (mID < 5.6) {
            // 1. Use bass to control screen intensity flicker
            float bassBeat = GET_BASS;
            float flicker = bassBeat * 0.5; 

            vec3 localScreenPos = p - vec3(0.0, -0.35, 1.5); 
            localScreenPos -= vec3(0.0, -0.05, 0.0);         
            localScreenPos.xz *= rot(0.35);                 

            vec2 tvUV;
            tvUV.x = (localScreenPos.x / 0.20) * 0.5 + 0.5;
            tvUV.y = (localScreenPos.y / 0.12) * 0.5 + 0.5;
            tvUV = clamp(tvUV, 0.0, 1.0);

            vec3 displayColor = getChromaVideo(iVideo, tvUV);

            // If background wave is disabled, manually patch the television screen waveform back in
            #ifndef SHOW_BACKGROUND_WAVE
            float wave = GET_WAVE(tvUV.x);
            float waveLine = smoothstep(0.01, 0.0, abs(tvUV.y - wave));
            displayColor += vec3(0.0, 1.0, 0.5) * waveLine * 2.0; 
            #endif

            albedo = displayColor * 0.1;
            emission = displayColor * (2.5 + 4.0 * flicker);
        }
        
        float diff = max(dot(n, sunDir), 0.0);
        float amb = clamp(0.4 + 0.6 * n.y, 0.0, 1.0);
        vec3 lighting = (diff * vec3(1.0, 0.8, 0.6)) + (amb * vec3(0.2, 0.3, 0.4));
        
        if (spec > 0.0) {
            vec3 refVec = reflect(rd, n);
            lighting += pow(max(dot(refVec, sunDir), 0.0), 32.0) * spec;
        }
        
        col = (albedo * lighting) + emission;
        
        if (mID >= 2.0 && mID < 2.05 && p.z > 1.8) {
            float tvFlickerGlow = sin(iTime * 8.0) * 0.2 + 0.8;
            col += vec3(0.05, 0.2, 0.5) * tvFlickerGlow * smoothstep(0.4, 0.0, length(p.xy - vec2(0.0, -0.05)));
        }
    }

    // --- GLASS TRANSPARENCY LAYER BLENDING ---
    if (hitGlassT > 0.0 && ( !hit || hitGlassT < t )) {
        vec3 glassP = ro + rd * hitGlassT;
        vec3 glassN = vec3(0.0, 0.0, -1.0); 
        
        vec3 glassRefVec = reflect(rd, glassN);
        float glassSpec = pow(max(dot(glassRefVec, sunDir), 0.0), 64.0) * 3.0;
        
        // Removed environmental getChromaVideo reflections completely.
        // The window layer now just processes its baseline material tone + sun highlight specular.
        vec3 glassTint = vec3(0.05, 0.12, 0.18);
        vec3 glassLayerColor = glassTint + vec3(glassSpec);
        
        col = mix(col, glassLayerColor, 0.25);
    }

    col = pow(col, vec3(1.0 / 2.2));
    vec2 absUV = abs(uv);
    col *= clamp((1.2) * (1.0 - absUV.x) * (1.0 - absUV.y), 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
