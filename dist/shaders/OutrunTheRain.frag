#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

// The MIT License
// Copyright © 2018 Ian Reichert-Watts
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// SHARED PARAMS (Must be same as Buf A :/)
const int NUM_PARTICLES = 64;
const float INTERACT_DATA_INDEX = float(NUM_PARTICLES)+1.0;
const float KINETIC_MOUSE_INDEX = INTERACT_DATA_INDEX+1.0;

// SHARED FUNCTIONS (Must be same as Buf A :/)
vec4 loadData( float index ) 
{ 
    return texture( iChannel0, vec2((index+0.5)/iResolution.x,0.0), -100.0 ); 
}

float floorHeight( in vec3 p )
{
    return (sin(p.z*0.00042)*0.2)+(sin(p.z*0.008)*0.64) + (sin(p.x*0.42+sin(p.z*0.000042)*420.0))*0.42-1.0;
}

// PARAMS
const vec3 COLOR_PRIMARY = vec3(0.79, 0.17, 0.32); // Red Magenta
const vec3 COLOR_SECONDARY = vec3(0.0022, 0.00, 0.0032); // Dark Purple
const vec3 COLOR_TERTIARY = vec3(0.0, 1.0, 0.75); // Teal

const vec3 SUN_DIR = normalize(vec3(0.0,-0.13,-1.0));

// CONST
const float PI = 3.14159;
const float TAU = PI * 2.0;
const int STEPS = 128;
const float STEP_SIZE = 0.42;

const float T_MAX = float(STEPS)*STEP_SIZE;

float floorHeightRender( in vec3 p )
{
    float height = floorHeight(p);
    vec2 point = iResolution.xy * 0.5;
    vec2 coord = floor(p.xz/0.1)*0.1;
    height += sin(length(coord-point)*(10000.0+iTime*0.02))*0.1;
    return height;
}

vec4 render( in vec3 rayOrigin, in vec3 rayDir)
{
    vec4 col = vec4(0.0);
    // Sun
    float sunDot = dot(rayDir, -SUN_DIR);
    // Sun Bloom
    col.rgb = max(col.rgb, 0.1*abs(sin(iTime+sunDot*42.0))*COLOR_PRIMARY);
    col.rgb += vec3(pow(sunDot, 42.0)*0.42)*COLOR_TERTIARY;
    // Sun Body
    float sunAlpha = clamp(sunDot-0.99, 0.0, 1.0);
    vec3 rayDown = cross(vec3(1.0,0.0,0.0), rayDir);
    sunAlpha *= clamp(cos(PI*2.9*clamp(dot(rayDown, SUN_DIR)*20.0+0.2, 0.0, 42.0)), 0.0, 1.0);
    col.rgb = max(col.rgb, 200.0*sunAlpha*COLOR_PRIMARY);
    // Sun Burst
    col.rgb += 0.3*sin((1.0-sunDot)*PI)*pow(sunDot,8.0)*abs(sin(atan(rayDir.y-0.1, rayDir.x)*8.0))*COLOR_TERTIARY;
    
    float t = STEP_SIZE;
    for( int i=0; i<STEPS; i++ )
    {
        vec3 p = rayOrigin+(rayDir*t);
        
        float depth = (t/T_MAX);
        float distFade = pow(1.0-depth, 2.0);
        
        float delta = p.y - floorHeightRender(p);
        
        // Floor
        float alpha = pow(clamp(1.0 - abs(delta), 0.0, 1.0), 42.0);
        float gridX = pow(abs(sin(p.x+sin(p.z*0.033)*6.4)), 1.42);
        float gridZ = pow(abs(sin(p.z*0.042)+sin(p.x*0.013)*0.2), 20.0);
        col.rgb = max(col.rgb, alpha*gridX*COLOR_PRIMARY);
        col.rgb = max(col.rgb, alpha*gridZ*COLOR_PRIMARY);
        float lightX = pow(abs(sin(p.x*0.064)*10.2), 0.42);
        col.rgb += 0.015*(pow(alpha,0.2)*(lightX-gridZ)*COLOR_TERTIARY)*distFade;
        
        // Atmosphere
        float bandFreq = 0.42;
        float band;
        if (delta > 0.0)
        {
            band = sin(p.z-p.y*bandFreq)+cos(p.z*bandFreq+FFT(p.x*2.));
        }
        else
        {
            band = sin(p.z+p.y*bandFreq)+cos(p.z*bandFreq);
        }
        band += 1.0-clamp(p.y*0.8, 0.0, 1.0);
        vec3 cloud = vec3(gridZ+band, (abs(gridZ+band)), (gridZ*band));
        col.rgb += 0.0042*(1.0-alpha)*cloud*COLOR_PRIMARY;
        col.rgb += 0.01*clamp(p.y*0.03, 0.0, 1.0)*COLOR_TERTIARY;
        
        // Fog
        col.rgb += COLOR_SECONDARY;
        
        t += STEP_SIZE;
    }
    
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    vec4 interactData = loadData(INTERACT_DATA_INDEX);
    
    // Camera must be the same as Buf A :/
    vec3 rayOrigin = vec3(0.0, 0.0, iTime*80.0);
    float floorY = floorHeight(rayOrigin);
    rayOrigin.y = floorY*0.9 + 0.2;
    float rotYaw = -(interactData.x/iResolution.x)*TAU;
    float rotPitch = (interactData.y/iResolution.y)*PI;
    
    vec3 forward = normalize( vec3(sin(rotYaw), rotPitch, cos(rotYaw)) );
    vec3 wup = normalize(vec3((floorY-floorHeight(rayOrigin+vec3(2.0,0.0,0.0)))*0.2,1.0,0.0));
    vec3 right = normalize( cross( forward, wup ) );
    vec3 up = normalize( cross( right, forward ) );
    mat3 camMat = mat3(right, up, forward); 
    
    vec3 surfforward = normalize( vec3(sin(rayOrigin.z*0.01)*0.042, ((floorY-floorHeight(rayOrigin+vec3(0.0,0.0,-20.0)))*0.2)+0.12, 1.0) );
    vec3 wright = vec3(1.0,0.0,0.0);
    mat3 surfMat = mat3(wright, up, surfforward); 
    
    vec2 centeredCoord = (fragCoord-(iResolution.xy*0.5))/iResolution.x;
    
    vec3 rayDir = normalize( surfMat*normalize( camMat*normalize( vec3(centeredCoord, 1.0) ) ) );
    
    float mask = 1.0-texture(iChannel0, uv).a;
    if (mask > 0.0)
    {
        float height = texture(iChannel0, uv).b;
        vec3 normal = -normalize(vec3(texture(iChannel0, uv).xy*2.0-vec2(1.0), -1.0));
        float refraction = height*mask*0.3;
        rayDir = normal*refraction + rayDir*(1.0-refraction);
        rayDir = normalize(rayDir);
    }
    
    //*/ Remove/Add initial '/' to toggle between Image and Buf A
    // Image
    fragColor = render(rayOrigin, rayDir);
    /*/
	// Buf A
    fragColor = texture(iChannel0, uv);
	//*/
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}