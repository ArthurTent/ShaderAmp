#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform float iTimeDelta;
uniform sampler2D iChannel0; // expects BufferA output
uniform sampler2D iAudioData;
uniform vec2 iMouse;
//uniform vec2 iFrame;
varying vec2 vUv;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;

// The MIT License
// Copyright © 2018 Ian Reichert-Watts
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// SHARED PARAMS (Must be same as Image :/)
const int NUM_PARTICLES = 64;
const float INTERACT_DATA_INDEX = float(NUM_PARTICLES)+1.0;
const float KINETIC_MOUSE_INDEX = INTERACT_DATA_INDEX+1.0;

// SHARED FUNCTIONS (Must be same as Image :/)
vec4 loadData( in float index ) 
{ 
    return texture( iChannel0, vec2((index+0.5)/iResolution.x,0.0), -100.0 ); 
}

float floorHeight( in vec3 p )
{
    return (sin(p.z*0.00042)*0.2)+(sin(p.z*0.008)*0.64) + (sin(p.x*0.42+sin(p.z*0.000042)*420.0))*0.42-1.0;
}

// PARAMS
const float PARTICLE_LIFETIME_MIN = 0.02;
const float PARTICLE_LIFETIME_MAX = 4.2;
const float FALL_SPEED = 42.0;
const float JITTER_SPEED = 300.0;
const vec3 WIND_DIR = vec3(0.0,0.0,-1.0);
const float WIND_INTENSITY = 4.2;

// CONST
const float PI = 3.14159;
const float TAU = PI * 2.0;

float randFloat( in float n )
{
    return fract( sin( n*64.19 )*420.82 );
}
vec2 randVec2( in vec2 n )
{
    return vec2(randFloat( n.x*12.95+n.y*43.72 ),randFloat( n.x*16.21+n.y*90.23 )); 
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
    if ( fragCoord.y > iResolution.y-2.0 )
    {
        // Discard top pixels to avoid persistent data getting included in blur
        discard;
    }
    else if ( fragCoord.y < 2.0 )
    {
        if ( fragCoord.y >= 1.0 || fragCoord.x > float(NUM_PARTICLES+4) )
        {
            discard;
        }
        // Store persistent data in bottom pixel row
        if ( fragCoord.x < float(NUM_PARTICLES) )
        {
            vec4 particle;
            float pidx = floor(fragCoord.x);
            /*
            if ( int(iFrame[0]) == 0 )
            {
                float padding = 0.01;
                float particleStep = (1.0-(padding*2.0))/float(NUM_PARTICLES);
                particle = vec4(0.0);
                float r1 = randFloat(pidx);
                particle.xy = vec2(padding+(particleStep*pidx), 1.0+(1.0*r1));
                particle.xy *= iResolution.xy;
                particle.a = r1*(PARTICLE_LIFETIME_MAX-PARTICLE_LIFETIME_MIN);
            }
            else
            */
            {   
               	vec4 interactData = loadData(INTERACT_DATA_INDEX);
                
                // Tick particles
        		particle = loadData(pidx);
                vec2 puv = particle.xy / iResolution.x;
                vec4 pbuf = texture(iChannel0, puv);
                
                // Camera must be the same as Image :/
                float rotYaw = -(interactData.x/iResolution.x)*TAU;
                float rotPitch = (interactData.y/iResolution.y)*PI;
                vec3 rayOrigin = vec3(0.0, 0.1, iTime*80.0);
                float floorY = floorHeight(rayOrigin);
                rayOrigin.y = floorY*0.9 + 0.2;

                vec3 forward = normalize( vec3(sin(rotYaw), rotPitch, cos(rotYaw)) );
                vec3 wup = normalize(vec3((floorY-floorHeight(rayOrigin+vec3(2.0,0.0,0.0)))*-0.2,1.0,0.0));
                vec3 right = normalize( cross( forward, wup ) );
                vec3 up = normalize( cross( right, forward ) );
                mat3 camMat = mat3(right, up, forward);

                vec3 surfforward = normalize( vec3(sin(rayOrigin.z*0.01)*0.042, ((floorY-floorHeight(rayOrigin+vec3(0.0,0.0,-20.0)))*0.2)+0.12, 1.0) );
                vec3 wright = vec3(1.0,0.0,0.0);
                mat3 surfMat = mat3(wright, up, surfforward); 

                vec2 centeredCoord = puv-vec2(0.5);
                vec3 rayDir = normalize( surfMat*normalize( camMat*normalize( vec3(centeredCoord, 1.0) ) ) );
                vec3 rayRight = normalize( cross( rayDir, up ) );
                vec3 rayUp = normalize( cross( rayRight, rayDir ) );

                // Wind
                vec2 windShield = (puv-vec2(0.5, 0.0))*2.0;
                float speedScale = 0.0015*(0.1+1.9*(sin(PI*0.5*pow( particle.z/particle.a, 2.0 ))))*iResolution.y;
                particle.x += (windShield.x+WIND_INTENSITY*dot(rayRight, WIND_DIR))*FALL_SPEED*speedScale*iTimeDelta;
                particle.y += (windShield.y+WIND_INTENSITY*dot(rayUp, WIND_DIR))*FALL_SPEED*speedScale*iTimeDelta;

                // Jitter
                particle.xy += 0.001*(randVec2( particle.xy+iTime )-vec2(0.5))*iResolution.y*JITTER_SPEED*iTimeDelta;

                // Age
                // Don't age as much when traveling over existing particle trails
                particle.z += (1.0-pbuf.b)*iTimeDelta;

                // Die of old age. Reset
                if ( particle.z > particle.a )
                {
                    float seedX = particle.x*25.36+particle.y*42.92;
                    float seedY = particle.x*16.78+particle.y*93.42;
                    particle = vec4(0.0);
                    particle.x = randFloat( seedX )*iResolution.x;
                    particle.y = randFloat( seedY )*iResolution.y;
                    particle.a = PARTICLE_LIFETIME_MIN+randFloat(pidx)*(PARTICLE_LIFETIME_MAX-PARTICLE_LIFETIME_MIN);
                }
            }
            fragColor = particle;
        }
		else
        {
            float dataIndex = floor(fragCoord.x);
            vec4 interactData = loadData(INTERACT_DATA_INDEX);
            vec4 kineticMouse = loadData(KINETIC_MOUSE_INDEX);
            
            /*
            if ( iMouse.z > 0.0 )
            {
            	vec2 mouseDelta = iMouse.xy-kineticMouse.xy;
                if ( length(iMouse.xy-iMouse.zw) < 4.0 )
                {
                    mouseDelta = vec2(0.0);
                }
                interactData.xy += mouseDelta;
                interactData.y = clamp( interactData.y, -iResolution.y, iResolution.y );
                kineticMouse = vec4(iMouse.xy, mouseDelta);
            }
            else
            {
                kineticMouse.zw *= 0.9;
                interactData.xy += kineticMouse.zw;
                interactData.y = clamp( interactData.y, -iResolution.y, iResolution.y );
                kineticMouse.xy = iMouse.xy;
            }
            */
            kineticMouse.zw *= 0.9;
            interactData.xy += kineticMouse.zw;
            interactData.y = clamp( interactData.y, -iResolution.y, iResolution.y );
            kineticMouse.xy = iMouse.xy;
            fragColor = (dataIndex == KINETIC_MOUSE_INDEX) ? kineticMouse : interactData;
        }
    }
    else
    {
        // Draw Particles
        vec2 blurUV = fract( (fragCoord.xy + (fract( 0.5*FFT(25) )*2.0-0.5)) / iResolution.xy );
        vec2 uv = fragCoord.xy / iResolution.xy;
        fragColor = texture( iChannel0, uv );
        vec4 prevColor = fragColor;

        if ( fragColor.a < 1.0 )
        {
            fragColor = texture( iChannel0, blurUV );
        }
        fragColor.b *= 0.996+FFT(1);

        for ( int i=0; i<NUM_PARTICLES; i++ )
        {
    		vec4 particle = loadData(float(i));
            vec2 delta = fragCoord.xy-particle.xy;
            float dist = length(delta);
            float radius = 0.002*(0.5+2.0*particle.a+abs(sin(1.0*iTime+float(i))))*iResolution.y;
		
            radius += 4.0*randFloat( particle.x*35.26+particle.y*93.12 )*pow((particle.z/particle.a), 12.0);
            if ( dist < radius )
            {
                // normal
                vec2 dir = delta/dist;
                fragColor.r = dot(dir, vec2(1.0,0.0))*0.5+0.5;
                fragColor.g = dot(dir, vec2(0.0,1.0))*0.5+0.5;
                // height
                float height = sin( dist/radius*PI*0.5 );
                height = pow( height, 8.0 );
                height = 1.0-height;
                fragColor.b = max( height, prevColor.b );
                // age
                fragColor.a = 0.0;
            }
        }
        fragColor.a += 0.1*iTimeDelta;
    }
}


void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}