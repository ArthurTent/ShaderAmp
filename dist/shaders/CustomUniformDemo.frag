// Custom Uniform Demo Shader
// Demonstrates interactive parameters that can be controlled from the options menu

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

// Custom interactive uniforms (configured in .meta file)
uniform float iShapeType;      // 0: Circle, 1: Square, 2: Triangle, 3: Hexagon  
uniform float iSize;         // Size of the shape
uniform float iRotationSpeed;   // Rotation speed multiplier
uniform float iColorShift;      // Color hue shift
uniform float iGlow;            // Glow intensity

#define PI 3.14159265359

// Distance functions for different shapes
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0);
}

float sdTriangle(vec2 p, float r) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if(p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}

float sdHexagon(vec2 p, float r) {
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

mat2 rot2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;
    
    // Get audio level for reactive effects
    float audioLevel = texture(iAudioData, vec2(0.1, 0.0)).x;
    
    // Apply rotation based on time and speed
    float rotation = iTime * iRotationSpeed;
    uv = rot2D(rotation) * uv;
    
    // Calculate distance based on selected shape
    float d = 1.0;
    float shapeSize = iSize * (1.0 + audioLevel * 0.3); // Audio reactive size
    
    int shapeType = int(floor(iShapeType + 0.5)); // Convert float to int
    
    if (shapeType == 0) {
        d = sdCircle(uv, shapeSize);
    } else if (shapeType == 1) {
        d = sdBox(uv, vec2(shapeSize * 0.8));
    } else if (shapeType == 2) {
        d = sdTriangle(uv, shapeSize);
    } else if (shapeType == 3) {
        d = sdHexagon(uv, shapeSize);
    }
    
    // Create glow effect
    float glow = iGlow / (1.0 + abs(d) * 10.0);
    
    // Create color based on distance and audio
    float hue = iColorShift + iTime * 0.1 + audioLevel * 0.2;
    vec3 color = hsv2rgb(vec3(hue, 0.8, 1.0));
    
    // Apply the glow
    color *= glow;
    
    // Add sharp edge
    if (d < 0.0) {
        color += vec3(0.5);
    }
    
    gl_FragColor = vec4(color, 1.0);
}
