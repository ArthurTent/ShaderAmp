// https://www.shadertoy.com/view/mlcfW2
// Modified by ArthurTent
// Created by Forthro
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

const float segmentsNumVariants[] = float[](1.0, 3.0, 7.0, 11.0);

void main()
{
    vec2 centerCoord = iResolution/2.;  /*iMouse.xy*/
    vec2 uv = vUv;
    vec2 fragCoordFromUV = uv * iResolution;
    float normalDist = distance( fragCoordFromUV.xy, centerCoord )
                     / ( sqrt( 2.0 * iResolution.x * iResolution.x ) * 1.25);
    float reverseNormalDist = 1.0 - normalDist;
    vec2 normalCoord =  -1.0 + 2.0 *vUv;

    float sound = texture( iAudioData, vec2( cos( normalDist ), 0.25 )).r
                + texture( iAudioData, vec2( sin( normalDist ), 0.25 )).r;

    float segmentsNum = segmentsNumVariants[ int( floor( sound * 2.0 + normalDist )) ];

    float radialWave = 0.5 + cos( atan( normalCoord.x, normalCoord.y ) * segmentsNum + iTime * 3.0 + cos( sound * 10.0 ) * sound );

    float shiftedTime = iTime - ( normalDist * 7.0 )
                      + radialWave * sin( pow( reverseNormalDist, reverseNormalDist ) * 50.0 + iTime + sound * sound * 2.0 );

    float waveModulator = 0.35 + sin( normalDist * 20.0 - shiftedTime * 4.0 ) * sound;

    float red = ( 0.25 + cos( shiftedTime + sound * 4.0) / 2.5 ) * waveModulator;
    float green = 0.75 * waveModulator * ( 0.5 + sin(sound * 7.0 ) / 2.0 );
    float blue = ( 0.25 + sin( shiftedTime + sound * 4.0 ) / 2.5 ) * waveModulator;

    gl_FragColor = vec4( red, green, blue, 1.0 );
}
