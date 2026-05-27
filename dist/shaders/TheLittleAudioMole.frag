// https://www.shadertoy.com/view/wc3yDM 
// Modified by ArthurTent
// Created by ArthurTent 
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform vec4 iMouse;

varying vec2 vUv;

// "Der kleine Maulwurf" (The Little Mole) (Fan Art) - Procedural 2D SDF
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

// Utility functions for shapes

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// Ellipse SDF
float sdEllipse(vec2 p, vec2 r) {
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0 * (k0 - 1.0) / k1;
}

// Box SDF (for tree trunk)
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Smooth Minimum (Rounded Union)
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Drawing function with Anti-Aliasing
vec3 draw(float dist, vec3 color, vec3 bgColor) {
    float aa = 0.002; // Anti-Aliasing strength
    return mix(color, bgColor, smoothstep(0.0, aa, dist));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalize UV coordinates (-1 to 1, corrected aspect ratio)
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Mouse interaction
    vec2 mouse = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y;
    if (iMouse.z < 0.01) mouse = vec2(0.0);
    
    // --- AUDIO VISUALIZER ADJUSTMENT FOR THE MEADOW ---
    
    // 1. Map UV-X coordinate to frequency index (0 to 255)
    // Mirrors frequencies from the center (0) outwards for a symmetrical reaction
    float normalized_x = abs(uv.x); 
    int freq_index = int(normalized_x * 255.0); 
    
    // 2. Get audio intensity and scale
    float audio_amp = FFT(freq_index);
    float audio_offset = audio_amp * 0.4 * (1.0 + sin(iTime * 1.5) * 0.1); 

    // Background: Sky blue and meadow
    vec3 col = mix(vec3(0.4, 0.7, 1.0), vec3(0.6, 0.8, 1.0), uv.y + 0.5);
    
    // Meadow definition: Audio-Offset shifts the y-position of the meadow
    float base_ground_y = -0.4; // Original position of the meadow
    float ground = smoothstep(0.01, 0.0, uv.y - (base_ground_y + audio_offset));
    
    col = mix(col, vec3(0.2, 0.6, 0.1), ground);

    // --- BACKGROUND OBJECTS ---
    
    // Sun
    float sun = sdCircle(uv - vec2(-0.7, 0.46), 0.15);
    col = draw(sun, vec3(1.0, 0.9, 0.3), col); // Yellow sun

    // Clouds
    vec2 cloudOffset = vec2(sin(iTime * 0.1) * 0.1, 0.0); // Slight movement
    
    // Cloud 1
    float cloud1_a = sdCircle(uv - vec2(0.3, 0.35) + cloudOffset, 0.1);
    float cloud1_b = sdCircle(uv - vec2(0.45, 0.355) + cloudOffset, 0.08);
    float cloud1_c = sdCircle(uv - vec2(0.2, 0.356) + cloudOffset, 0.09);
    float cloud1 = smin(smin(cloud1_a, cloud1_b, 0.05), cloud1_c, 0.05);
    col = draw(cloud1, vec3(1.0), col); // White cloud
    
    // Cloud 2
    vec2 cloudOffset2 = vec2(cos(iTime * 0.08) * 0.05 - 0.5, -0.1); // Other movement/position
    float cloud2_a = sdCircle(uv - vec2(0.0, 0.35) + cloudOffset2, 0.07);
    float cloud2_b = sdCircle(uv - vec2(0.0515, 0.345) + cloudOffset2, 0.06);
    float cloud2 = smin(cloud2_a, cloud2_b, 0.04);
    col = draw(cloud2, vec3(1.0), col); // White cloud
    
    // sunny Cloud (lets reuse the vars from above
    cloud1_a = sdCircle(uv - vec2(-0.5, 0.35) + cloudOffset, 0.1);
    cloud1_b = sdCircle(uv - vec2(-0.65, 0.355) + cloudOffset, 0.08);
    cloud1_c = sdCircle(uv - vec2(-0.4, 0.356) + cloudOffset, 0.09);
    cloud1 = smin(smin(cloud1_a, cloud1_b, 0.05), cloud1_c, 0.05);
    col = draw(cloud1, vec3(1.0), col); // White cloud

    

    // Tree
    vec2 treePos = uv - vec2(-0.8, -0.3); // Position of the tree
    
    // Tree trunk
    float trunk = sdBox(treePos - vec2(0.0, 0.15), vec2(0.04, 0.25));
    col = draw(trunk, vec3(0.5, 0.3, 0.1), col); // Brown trunk
    
    // Tree crown (merging multiple circles)
    float crown_a = sdCircle(treePos - vec2(0.0, 0.45), 0.15);
    float crown_b = sdCircle(treePos - vec2(0.1, 0.38), 0.12);
    float crown_c = sdCircle(treePos - vec2(-0.1, 0.39), 0.12);
    float crown = smin(smin(crown_a, crown_b, 0.08), crown_c, 0.08);
    col = draw(crown, vec3(0.3, 0.7, 0.2), col); // Green crown
    
    // right Tree
    trunk = sdBox(treePos - vec2(1.3, 0.15), vec2(.04, 0.25));
    col = draw(trunk, vec3(0.5, 0.3, 0.1), col); // Brown trunk
    
    crown_a = sdCircle(treePos - vec2(1.3, 0.45), 0.15);
    crown_b = sdCircle(treePos - vec2(1.41, 0.38), 0.12);
    crown_c = sdCircle(treePos - vec2(1.2, 0.39), 0.12);  
    crown = smin(smin(crown_a, crown_b, 0.08), crown_c, 0.08);
    col = draw(crown, vec3(0.3, 0.7, 0.2), col); // Green crown


    // --- BODY --- (Mole is drawn over the background)
    
    vec2 bodyPos = uv - vec2(0.0, -0.25);
    float headShape = sdCircle(bodyPos - vec2(0.0, 0.2), 0.28);
    float bodyShape = sdEllipse(bodyPos - vec2(0.0, -0.13), vec2(0.32, 0.38));
    
    // Smooth Union for the typical pear shape
    float moleBody = smin(headShape, bodyShape, 0.1);
    
    // --- HANDS ---
    // Simple circles as paws
    float handL = sdCircle(uv - vec2(-0.3, -0.25 + sin(iTime*3.0)*0.02+FFT(25)/2.5), 0.08);
    float handR = sdCircle(uv - vec2( 0.3, -0.25 + cos(iTime*3.0)*0.02+FFT(75)/1.5), 0.08);
    float hands = min(handL, handR);
    
    // Add hands to the body
    float fullSilhouette = smin(moleBody, hands, 0.02);
    
    // Draw black body
    col = draw(fullSilhouette, vec3(0.1, 0.1, 0.1), col);
    
    // Draw light paws
    col = draw(hands, vec3(0.9, 0.8, 0.7), col);
    
    // --- BELLY ---
    float belly = sdEllipse(uv - vec2(0.0+mouse.x*0.05, -0.08), vec2(0.08, 0.11 + mouse.y*0.07));
    //belly += sdEllipse(uv - vec2(0.0, -0.35), vec2(0.18, 0.22));
    //belly = smin(moleBody, belly, 0.02);
    belly = max(belly, moleBody); 
    col = draw(belly, vec3(0.6, 0.6, 0.6), col);
    belly = sdEllipse(uv - vec2(0.0, -0.4), vec2(0.18, 0.3));
    belly = max(belly, moleBody); 
    col = draw(belly, vec3(0.6, 0.6, 0.6), col);


    // --- FACE ---
    uv.y+=.045;
    // Animation for the nose (sniffing)
    float sniff = sin(iTime * 15.0) * 0.005 * step(0.8, sin(iTime * 2.0)); 
    uv.y+=0.005;
    vec2 nosePos = uv - vec2(0.0 + mouse.x*0.1, 0.05 + mouse.y*0.1 + sniff);
    uv.y-=0.005;
    
    // Eyes & Blinking (calculation remains here, drawing later)
    float blink = smoothstep(0.0, 0.1, abs(sin(iTime * 0.8)) - 0.05);
    vec2 eyeOffset = vec2(0.12, 0.14);
    
    // Eye ellipses
    float eyeL = sdEllipse(uv - vec2(-eyeOffset.x, eyeOffset.y), vec2(0.07, 0.09 * blink));
    float eyeR = sdEllipse(uv - vec2( eyeOffset.x, eyeOffset.y), vec2(0.07, 0.09 * blink));
    float eyes = min(eyeL, eyeR);
    
    // Draw the eyes only if the blink value is high enough
    if (blink > 0.05) { 
        col = draw(eyes, vec3(1.0), col);
    }
    
    // Pupils
    vec2 pupilLook = vec2(sin(iTime)*0.02, 0.0);
    if (iMouse.z > 0.01) {
        pupilLook = mouse * 0.1;
        // Limit pupil shift (maximum 0.04)
        pupilLook = clamp(pupilLook, -0.04, 0.04);
    }
    
    // Minimum radius for pupils to prevent numerical instability
    float pupilRadius = max(0.035 * blink, 0.0001); 
    float pupL = sdCircle(uv - vec2(-eyeOffset.x, eyeOffset.y) - pupilLook, pupilRadius);
    float pupR = sdCircle(uv - vec2( eyeOffset.x, eyeOffset.y) - pupilLook, pupilRadius);
    float pupils = min(pupL, pupR);
    
    // Draw pupils only if the blink value is high enough
    if (blink > 0.1) {
        col = draw(pupils, vec3(0.0), col);
    }

    // Nose is drawn after the eyes so it lies in front of them
    float noseTip = sdCircle(nosePos, 0.045);
    float noseShine = sdCircle(nosePos - vec2(0.015, 0.015), 0.015);
    //noseTip = smin(moleBody, belly, 0.02);
    col = draw(noseTip, vec3(0.9, 0.2, 0.1), col);
    col = draw(noseShine, vec3(1.0, 1.0, 1.0), col);

    // --- MOUTH ---
    vec2 mouthPos = uv - vec2(0.0 + mouse.x*0.05, -0.03 + mouse.y*0.05); // Position below the nose
    //float mouth = sdCircle(mouthPos, .01+0.06*(FFT(75)+FFT(50))); // Semicircle for the mouth with a min value to start with
    float mouth1 = sdCircle(mouthPos,0.01+0.07*(FFT(75)+FFT(50))); // Semicircle for the mouth
    mouth1 = max(mouth1, mouthPos.y); // Cuts off the top part to create a semicircle
    col = draw(mouth1, vec3(0.000,0.000,0.000), col); // black mouth
    float mouth2 = sdCircle(mouthPos,0.000002+0.05*(FFT(75)+FFT(50))); // Semicircle for the mouth
    mouth2 = max(mouth2, mouthPos.y); // Cuts off the top part to create a semicircle
   // mouth2 = smin(mouth2, mouth2, 0.001);
    col = draw(mouth2, vec3(0.949,0.612,0.612), col); // Pink mouth



    // --- HAIR ---
    //vec2 hairOrigin = vec2(0.0, 0.23);
    vec2 hairOrigin = vec2(0.0, 0.27);
    float hairs = 1.0;
    
    for(int i = -1; i <= 1; i++) {
        float fi = float(i);
        vec2 p = uv - hairOrigin;
        float angle = fi * 0.5 + sin(iTime * 2.0 + fi)*0.1;
        float s = sin(angle), c = cos(angle);
        p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
        
        vec2 hSize = vec2(0.005, 0.06);
        vec2 d = abs(p - vec2(0.0, 0.06)) - hSize;
        float hairDist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        hairs = min(hairs, hairDist);
    }
    
    col = draw(hairs, vec3(0.0), col);

    fragColor = vec4(col, 1.0);
}

/** before updated
// "Der kleine Maulwurf" (The Little Mole) (Fan Art) - Procedural 2D SDF
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

// Utility functions for shapes

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// Ellipse SDF
float sdEllipse(vec2 p, vec2 r) {
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0 * (k0 - 1.0) / k1;
}

// Box SDF (for tree trunk)
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Smooth Minimum (Rounded Union)
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Drawing function with Anti-Aliasing
vec3 draw(float dist, vec3 color, vec3 bgColor) {
    float aa = 0.002; // Anti-Aliasing strength
    return mix(color, bgColor, smoothstep(0.0, aa, dist));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalize UV coordinates (-1 to 1, corrected aspect ratio)
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Mouse interaction
    vec2 mouse = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y;
    if (iMouse.z < 0.01) mouse = vec2(0.0);
    
    // --- AUDIO VISUALIZER ADJUSTMENT FOR THE MEADOW ---
    
    // 1. Map UV-X coordinate to frequency index (0 to 255)
    // Mirrors frequencies from the center (0) outwards for a symmetrical reaction
    float normalized_x = abs(uv.x); 
    int freq_index = int(normalized_x * 255.0); 
    
    // 2. Get audio intensity and scale
    float audio_amp = FFT(freq_index);
    float audio_offset = audio_amp * 0.4 * (1.0 + sin(iTime * 1.5) * 0.1); 

    // Background: Sky blue and meadow
    vec3 col = mix(vec3(0.4, 0.7, 1.0), vec3(0.6, 0.8, 1.0), uv.y + 0.5);
    
    // Meadow definition: Audio-Offset shifts the y-position of the meadow
    float base_ground_y = -0.4; // Original position of the meadow
    float ground = smoothstep(0.01, 0.0, uv.y - (base_ground_y + audio_offset));
    
    col = mix(col, vec3(0.2, 0.6, 0.1), ground);

    // --- BACKGROUND OBJECTS ---
    
    // Sun
    float sun = sdCircle(uv - vec2(-0.7, 0.46), 0.15);
    col = draw(sun, vec3(1.0, 0.9, 0.3), col); // Yellow sun

    // Clouds
    vec2 cloudOffset = vec2(sin(iTime * 0.1) * 0.1, 0.0); // Slight movement
    
    // Cloud 1
    float cloud1_a = sdCircle(uv - vec2(0.3, 0.35) + cloudOffset, 0.1);
    float cloud1_b = sdCircle(uv - vec2(0.45, 0.355) + cloudOffset, 0.08);
    float cloud1_c = sdCircle(uv - vec2(0.2, 0.356) + cloudOffset, 0.09);
    float cloud1 = smin(smin(cloud1_a, cloud1_b, 0.05), cloud1_c, 0.05);
    col = draw(cloud1, vec3(1.0), col); // White cloud
    
    // Cloud 2
    vec2 cloudOffset2 = vec2(cos(iTime * 0.08) * 0.05 - 0.5, -0.1); // Other movement/position
    float cloud2_a = sdCircle(uv - vec2(0.0, 0.35) + cloudOffset2, 0.07);
    float cloud2_b = sdCircle(uv - vec2(0.0515, 0.345) + cloudOffset2, 0.06);
    float cloud2 = smin(cloud2_a, cloud2_b, 0.04);
    col = draw(cloud2, vec3(1.0), col); // White cloud

    // Tree
    vec2 treePos = uv - vec2(-0.8, -0.3); // Position of the tree
    
    // Tree trunk
    float trunk = sdBox(treePos - vec2(0.0, 0.15), vec2(0.04, 0.25));
    col = draw(trunk, vec3(0.5, 0.3, 0.1), col); // Brown trunk
    
    // Tree crown (merging multiple circles)
    float crown_a = sdCircle(treePos - vec2(0.0, 0.45), 0.15);
    float crown_b = sdCircle(treePos - vec2(0.1, 0.38), 0.12);
    float crown_c = sdCircle(treePos - vec2(-0.1, 0.39), 0.12);
    float crown = smin(smin(crown_a, crown_b, 0.08), crown_c, 0.08);
    col = draw(crown, vec3(0.3, 0.7, 0.2), col); // Green crown
    
    // right Tree
    trunk = sdBox(treePos - vec2(1.3, 0.15), vec2(.04, 0.25));
    col = draw(trunk, vec3(0.5, 0.3, 0.1), col); // Brown trunk
    
    crown_a = sdCircle(treePos - vec2(1.3, 0.45), 0.15);
    crown_b = sdCircle(treePos - vec2(1.41, 0.38), 0.12);
    crown_c = sdCircle(treePos - vec2(1.2, 0.39), 0.12);  
    crown = smin(smin(crown_a, crown_b, 0.08), crown_c, 0.08);
    col = draw(crown, vec3(0.3, 0.7, 0.2), col); // Green crown


    // --- BODY --- (Mole is drawn over the background)
    
    vec2 bodyPos = uv - vec2(0.0, -0.25);
    float headShape = sdCircle(bodyPos - vec2(0.0, 0.2), 0.28);
    float bodyShape = sdEllipse(bodyPos - vec2(0.0, -0.13), vec2(0.32, 0.38));
    
    // Smooth Union for the typical pear shape
    float moleBody = smin(headShape, bodyShape, 0.1);
    
    // --- HANDS ---
    // Simple circles as paws
    float handL = sdCircle(uv - vec2(-0.3, -0.25 + sin(iTime*3.0)*0.02+FFT(25)/2.5), 0.08);
    float handR = sdCircle(uv - vec2( 0.3, -0.25 + cos(iTime*3.0)*0.02+FFT(75)/1.5), 0.08);
    float hands = min(handL, handR);
    
    // Add hands to the body
    float fullSilhouette = smin(moleBody, hands, 0.02);
    
    // Draw black body
    col = draw(fullSilhouette, vec3(0.1, 0.1, 0.1), col);
    
    // Draw light paws
    col = draw(hands, vec3(0.9, 0.8, 0.7), col);
    
    // --- BELLY ---
    float belly = sdEllipse(uv - vec2(0.0, -0.35), vec2(0.18, 0.22));
    belly = max(belly, moleBody); 
    col = draw(belly, vec3(0.6, 0.6, 0.6), col);

    // --- FACE ---
    uv.y+=.04;
    // Animation for the nose (sniffing)
    float sniff = sin(iTime * 15.0) * 0.005 * step(0.8, sin(iTime * 2.0)); 
    uv.y+=0.005;
    vec2 nosePos = uv - vec2(0.0 + mouse.x*0.1, 0.05 + mouse.y*0.1 + sniff);
    uv.y-=0.005;
    
    // Eyes & Blinking (calculation remains here, drawing later)
    float blink = smoothstep(0.0, 0.1, abs(sin(iTime * 0.8)) - 0.05);
    vec2 eyeOffset = vec2(0.12, 0.15);
    
    // Eye ellipses
    float eyeL = sdEllipse(uv - vec2(-eyeOffset.x, eyeOffset.y), vec2(0.07, 0.09 * blink));
    float eyeR = sdEllipse(uv - vec2( eyeOffset.x, eyeOffset.y), vec2(0.07, 0.09 * blink));
    float eyes = min(eyeL, eyeR);
    
    // Draw the eyes only if the blink value is high enough
    if (blink > 0.05) { 
        col = draw(eyes, vec3(1.0), col);
    }
    
    // Pupils
    vec2 pupilLook = vec2(sin(iTime)*0.02, 0.0);
    if (iMouse.z > 0.01) {
        pupilLook = mouse * 0.1;
        // Limit pupil shift (maximum 0.04)
        pupilLook = clamp(pupilLook, -0.04, 0.04);
    }
    
    // Minimum radius for pupils to prevent numerical instability
    float pupilRadius = max(0.025 * blink, 0.0001); 
    
    float pupL = sdCircle(uv - vec2(-eyeOffset.x, eyeOffset.y) - pupilLook, pupilRadius);
    float pupR = sdCircle(uv - vec2( eyeOffset.x, eyeOffset.y) - pupilLook, pupilRadius);
    float pupils = min(pupL, pupR);
    
    // Draw pupils only if the blink value is high enough
    if (blink > 0.1) {
        col = draw(pupils, vec3(0.0), col);
    }

    // Nose is drawn after the eyes so it lies in front of them
    float noseTip = sdCircle(nosePos, 0.045);
    float noseShine = sdCircle(nosePos - vec2(0.015, 0.015), 0.015);
    
    col = draw(noseTip, vec3(0.9, 0.2, 0.1), col);
    col = draw(noseShine, vec3(1.0, 1.0, 1.0), col);

    // --- MOUTH ---
    vec2 mouthPos = uv - vec2(0.0 + mouse.x*0.05, -0.03 + mouse.y*0.05); // Position below the nose
    //float mouth = sdCircle(mouthPos, .01+0.06*(FFT(75)+FFT(50))); // Semicircle for the mouth with a min value to start with
    float mouth = sdCircle(mouthPos,0.06*(FFT(75)+FFT(50))); // Semicircle for the mouth
    mouth = max(mouth, mouthPos.y); // Cuts off the top part to create a semicircle
    col = draw(mouth, vec3(0.678,0.678,0.678), col); // Pink mouth

    // --- HAIR ---
    //vec2 hairOrigin = vec2(0.0, 0.23);
    vec2 hairOrigin = vec2(0.0, 0.27);
    float hairs = 1.0;
    
    for(int i = -1; i <= 1; i++) {
        float fi = float(i);
        vec2 p = uv - hairOrigin;
        float angle = fi * 0.5 + sin(iTime * 2.0 + fi)*0.1;
        float s = sin(angle), c = cos(angle);
        p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
        
        vec2 hSize = vec2(0.005, 0.06);
        vec2 d = abs(p - vec2(0.0, 0.06)) - hSize;
        float hairDist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        hairs = min(hairs, hairDist);
    }
    
    col = draw(hairs, vec3(0.0), col);

    fragColor = vec4(col, 1.0);
}
*/


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
