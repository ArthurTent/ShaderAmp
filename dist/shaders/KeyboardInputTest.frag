// Keyboard Input Test Shader for ShaderAmp
// Created to demonstrate iKeyboard uniform functionality
// License: MIT

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform vec2 iResolution;
uniform sampler2D iVideo;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec3 color = vec3(0.1, 0.1, 0.2); // Dark blue background
    
    // Get audio data for some visual effects
    float bass = texture(iAudioData, vec2(0.05, 0.25)).x;
    float mid = texture(iAudioData, vec2(0.3, 0.25)).x;
    float treble = texture(iAudioData, vec2(0.8, 0.25)).x;
    
    // Check keyboard states
    float spaceDown = texelFetch(iKeyboard, ivec2(32, 0), 0).x;     // Space bar
    float spacePressed = texelFetch(iKeyboard, ivec2(32, 1), 0).x;  // Space just pressed
    float spaceReleased = texelFetch(iKeyboard, ivec2(32, 2), 0).x; // Space just released
    float spaceHoldTime = texelFetch(iKeyboard, ivec2(32, 3), 0).x; // Space hold time
    
    float aDown = texelFetch(iKeyboard, ivec2(65, 0), 0).x;        // A key
    float sDown = texelFetch(iKeyboard, ivec2(83, 0), 0).x;        // S key
    float dDown = texelFetch(iKeyboard, ivec2(68, 0), 0).x;        // D key
    float wDown = texelFetch(iKeyboard, ivec2(87, 0), 0).x;        // W key
    
    float leftDown = texelFetch(iKeyboard, ivec2(37, 0), 0).x;    // Left arrow
    float rightDown = texelFetch(iKeyboard, ivec2(39, 0), 0).x;   // Right arrow
    float upDown = texelFetch(iKeyboard, ivec2(38, 0), 0).x;      // Up arrow
    float downDown = texelFetch(iKeyboard, ivec2(40, 0), 0).x;    // Down arrow
    
    // Create a visual keyboard indicator
    vec2 center = vec2(0.5, 0.5);
    float radius = 0.3 + bass * 0.2; // Pulse with bass
    
    // Main circle that responds to spacebar
    if (spaceDown > 0.5) {
        // Red pulsing circle when space is held
        float pulse = sin(iTime * 10.0) * 0.5 + 0.5;
        color = mix(color, vec3(1.0, 0.2, 0.2), pulse * spaceHoldTime);
        
        // Expand radius when space is held
        radius += spaceHoldTime * 0.2;
    }
    
    // Draw main circle
    float dist = distance(uv, center);
    if (dist < radius) {
        color += vec3(0.3, 0.5, 0.8) * (1.0 - dist/radius);
    }
    
    // WASD indicators
    vec2 wPos = vec2(0.5, 0.7);
    vec2 aPos = vec2(0.3, 0.5);
    vec2 sPos = vec2(0.5, 0.3);
    vec2 dPos = vec2(0.7, 0.5);
    
    // Draw WASD keys
    if (distance(uv, wPos) < 0.05) {
        if (wDown > 0.5) color = vec3(0.0, 1.0, 0.0);
        else color = vec3(0.2, 0.4, 0.2);
    }
    if (distance(uv, aPos) < 0.05) {
        if (aDown > 0.5) color = vec3(0.0, 1.0, 0.0);
        else color = vec3(0.2, 0.4, 0.2);
    }
    if (distance(uv, sPos) < 0.05) {
        if (sDown > 0.5) color = vec3(0.0, 1.0, 0.0);
        else color = vec3(0.2, 0.4, 0.2);
    }
    if (distance(uv, dPos) < 0.05) {
        if (dDown > 0.5) color = vec3(0.0, 1.0, 0.0);
        else color = vec3(0.2, 0.4, 0.2);
    }
    
    // Arrow key indicators
    vec2 upArrowPos = vec2(0.5, 0.85);
    vec2 leftArrowPos = vec2(0.15, 0.5);
    vec2 downArrowPos = vec2(0.5, 0.15);
    vec2 rightArrowPos = vec2(0.85, 0.5);
    
    if (distance(uv, upArrowPos) < 0.03) {
        if (upDown > 0.5) color = vec3(1.0, 1.0, 0.0);
        else color = vec3(0.4, 0.4, 0.2);
    }
    if (distance(uv, leftArrowPos) < 0.03) {
        if (leftDown > 0.5) color = vec3(1.0, 1.0, 0.0);
        else color = vec3(0.4, 0.4, 0.2);
    }
    if (distance(uv, downArrowPos) < 0.03) {
        if (downDown > 0.5) color = vec3(1.0, 1.0, 0.0);
        else color = vec3(0.4, 0.4, 0.2);
    }
    if (distance(uv, rightArrowPos) < 0.03) {
        if (rightDown > 0.5) color = vec3(1.0, 1.0, 0.0);
        else color = vec3(0.4, 0.4, 0.2);
    }
    
    // Visual feedback for press/release events
    if (spacePressed > 0.5) {
        // Flash white when space is first pressed
        color = mix(color, vec3(1.0), 0.8);
    }
    
    if (spaceReleased > 0.5) {
        // Flash blue when space is released
        color = mix(color, vec3(0.2, 0.5, 1.0), 0.6);
    }
    
    // Add some audio-reactive particles
    float particleCount = 20.0;
    for (float i = 0.0; i < particleCount; i++) {
        float angle = (i / particleCount) * 6.28318 + iTime;
        vec2 particlePos = center + vec2(cos(angle), sin(angle)) * (0.4 + treble * 0.3);
        float particleSize = 0.01 + mid * 0.02;
        
        if (distance(uv, particlePos) < particleSize) {
            color += vec3(1.0, 0.8, 0.3) * (1.0 - distance(uv, particlePos) / particleSize);
        }
    }
    
    // Add instructions text area (simplified - just a background box)
    vec2 textArea = vec2(0.8, 0.1);
    vec2 textPos = vec2(0.1, 0.9);
    if (uv.x > textPos.x && uv.x < textPos.x + textArea.x &&
        uv.y > textPos.y - textArea.y && uv.y < textPos.y) {
        color = mix(color, vec3(0.0, 0.0, 0.0), 0.7);
    }
    
    gl_FragColor = vec4(color, 1.0);
}
