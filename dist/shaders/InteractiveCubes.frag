// Interactive Cubes Demo
// Simplified version of MoreCubesForTheCubeLovers with runtime parameter control

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;

// Global mouse-driven rotation shared across the scene
vec2 gMouseRotation = vec2(0.0);

// Custom interactive uniforms
uniform float iCubeType;  // 0-7 for different cube types
uniform float iBoxy;      // Boxy mode on/off
uniform float iFlair;     // Flair mode on/off

#define PI 3.141592654
#define TAU (2.0*PI)

mat2 rot2D(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735027;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float map(vec3 p) {
    int cubeType = int(floor(iCubeType + 0.5));
    float audioLevel = texture(iAudioData, vec2(0.1, 0.0)).x;
    float pulse = 1.0 + audioLevel * 0.2;
    
    // Rotate based on time and mouse drag
    float yaw = iTime * 0.3 + gMouseRotation.x;
    float pitch = iTime * 0.2 + gMouseRotation.y;
    p.xz = rot2D(yaw) * p.xz;
    p.xy = rot2D(pitch) * p.xy;
    
    float d = 1e10;
    
    if (cubeType == 0) {
        // Basic cube
        d = sdBox(p, vec3(0.5) * pulse);
        if (iBoxy > 0.5) {
            d = max(d, -sdSphere(p, 0.6 * pulse));
        }
    } else if (cubeType == 1) {
        // Rounded cube
        d = sdBox(p, vec3(0.4) * pulse) - 0.1;
        if (iFlair > 0.5) {
            d = opSmoothUnion(d, sdSphere(p, 0.35 * pulse), 0.2);
        }
    } else if (cubeType == 2) {
        // Star shape
        vec3 p2 = p;
        for(int i = 0; i < 3; i++) {
            p2 = abs(p2) - 0.3 * pulse;
            p2.xy = rot2D(0.5) * p2.xy;
        }
        d = sdBox(p2, vec3(0.2) * pulse);
        if (iBoxy > 0.5) {
            d = min(d, sdBox(p, vec3(0.4) * pulse));
        }
    } else if (cubeType == 3) {
        // Cross shape
        d = min(sdBox(p, vec3(0.6, 0.2, 0.2) * pulse),
                min(sdBox(p, vec3(0.2, 0.6, 0.2) * pulse),
                    sdBox(p, vec3(0.2, 0.2, 0.6) * pulse)));
        if (iFlair > 0.5) {
            d = opSmoothUnion(d, sdSphere(p, 0.3 * pulse), 0.1);
        }
    } else if (cubeType == 4) {
        // Diamond/Octahedron
        d = sdOctahedron(p, 0.6 * pulse);
        if (iBoxy > 0.5) {
            d = max(d, sdBox(p, vec3(0.45) * pulse));
        }
    } else if (cubeType == 5) {
        // Torus cube
        d = min(sdTorus(p.xzy, vec2(0.4, 0.1) * pulse),
                min(sdTorus(p.yxz, vec2(0.4, 0.1) * pulse),
                    sdTorus(p, vec2(0.4, 0.1) * pulse)));
        if (iFlair > 0.5) {
            d = opSmoothUnion(d, sdBox(p, vec3(0.25) * pulse), 0.15);
        }
    } else if (cubeType == 6) {
        // Complex intersection
        d = max(sdBox(p, vec3(0.5) * pulse), sdSphere(p, 0.65 * pulse));
        vec3 q = p;
        q.xy = rot2D(PI/4.0) * q.xy;
        d = max(d, sdBox(q, vec3(0.5) * pulse));
        if (iBoxy > 0.5) {
            d = min(d, sdBox(p, vec3(0.35) * pulse));
        }
    } else if (cubeType == 7) {
        // Fractal-ish
        d = sdBox(p, vec3(0.4) * pulse);
        for(int i = 0; i < 3; i++) {
            vec3 q = mod(p * float(2 + i), 0.4) - 0.2;
            float subD = sdBox(q, vec3(0.1) * pulse);
            d = opSmoothSubtraction(subD, d, 0.02);
        }
    }
    
    return d;
}

vec3 calcNormal(vec3 p) {
    const float eps = 0.001;
    vec2 h = vec2(eps, 0.0);
    return normalize(vec3(
        map(p + h.xyy) - map(p - h.xyy),
        map(p + h.yxy) - map(p - h.yxy),
        map(p + h.yyx) - map(p - h.yyx)
    ));
}

void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;
    // Compute mouse drag (click + move) for interactive rotation
    gMouseRotation = vec2(0.0);
    if (iMouse.z > 0.0) {
        vec2 drag = (iMouse.xy - iMouse.zw) / iResolution.xy;
        // Invert Y for natural feel and scale to radians
        gMouseRotation = vec2(drag.x, -drag.y) * PI;
    }

    // Camera setup
    vec3 ro = vec3(0.0, 0.0, 2.5);
    vec3 rd = normalize(vec3(uv, -1.5));

    // Rotate camera
    float camTime = iTime * 0.1 + gMouseRotation.x;
    ro.xz = rot2D(camTime) * ro.xz;
    rd.xz = rot2D(camTime) * rd.xz;
    float camPitch = gMouseRotation.y * 0.5;
    ro.yz = rot2D(camPitch) * ro.yz;
    rd.yz = rot2D(camPitch) * rd.yz;
    
    // Raymarching
    float t = 0.0;
    vec3 col = vec3(0.0);

    for(int i = 0; i < 64; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);

        if(d < 0.001) {
            // Hit - calculate lighting
            vec3 n = calcNormal(p);
            vec3 lightDir = normalize(vec3(0.5, 0.7, 0.6));
            float diff = max(dot(n, lightDir), 0.0);
            float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);

            // Color based on cube type and audio
            float audioLevel = texture(iAudioData, vec2(0.15, 0.0)).x;
            float hue = iCubeType / 8.0 + iTime * 0.05 + audioLevel * 0.1;
            vec3 baseColor = hsv2rgb(vec3(hue, 0.7, 0.9));

            col = baseColor * diff + vec3(1.0) * spec * 0.5;
            col *= 1.0 - t / 5.0; // Fog
            break;
        }

        if(t > 5.0) break;
        t += d;
    }
    
    // Glow effect based on audio
    float audioGlow = texture(iAudioData, vec2(0.05, 0.0)).x;
    col += vec3(0.1, 0.2, 0.3) * audioGlow * 0.5;
    
    // Vignette
    float vignette = 1.0 - length(uv) * 0.3;
    col *= vignette;
    
    gl_FragColor = vec4(col, 1.0);
}
