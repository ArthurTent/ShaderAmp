// https://www.shadertoy.com/view/Ml2cDK
// Modified by ArthurTent
// Created by laserdog
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

void main( )
{
    vec2 points[15];
    points[0] = vec2(.1, .1);
    points[1] = vec2(.15, -.2);
    points[2] = vec2(-.3, .05);
    points[3] = vec2(-.25, -.1);
    points[4] = vec2(-.12, .23);
    points[5] = vec2(.3, .28);
    points[6] = vec2(.11, .35);
    points[7] = vec2(.4, -.4);
    points[8] = vec2(-.223, .3);
    points[9] = vec2(.4, -.18);
    points[10] = vec2(.32, -.1);
    points[11] = vec2(.2, -.32);
    points[12] = vec2(-.13, .15);
    points[13] = vec2(-.102, -.17);
    points[14] = vec2(-.25, -.31);

	//vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv;
    //vec2 uv = -1.0 + 3.0 *vUv ;
    uv -= .5;
    uv.x *= iResolution.x / iResolution.y;
    float dist = length(uv);

    float speed = .75;
    float angle = mod(-iTime * speed, 2. * PI);
    float clippedGreen = 0.;

    // draw outer ring
    float containerRadius = .475;
    float clipToRadius = clamp(floor(containerRadius / dist), 0., 1.);
    float containerThickness = max(.01, .275 * (pow(clamp(texture(iAudioData, abs(uv)).r, .1, 2.), 4.)
                                   + pow(clamp(texture(iAudioData, abs(vec2(uv.y, uv.x))).r, .1, 2.), 4.)));
    float container = smoothstep(containerRadius + containerThickness / 2., containerRadius, dist)
        * smoothstep(containerRadius - containerThickness / 2., containerRadius, dist);

    // draw blips
    float blipSpeed = .075;
    float ringThickness = .01;
    for (int x = 0; x < 15; x++) {
    	float blipDist = distance(uv, points[x]);

    	float blipAngle = mod(atan(points[x].y, points[x].x) + PI * 2., PI * 2.) - PI / 3.;
    	float angleDiff = mod(angle - blipAngle, 2. * PI);

    	float blipRadius = (1. - angleDiff) * blipSpeed;

    	float addend = smoothstep(blipRadius, blipRadius - ringThickness / 2., blipDist)
        	* pow(smoothstep(0., blipRadius - ringThickness / 2., blipDist), 3.);
        clippedGreen += max(0., mix(addend, 0., blipRadius / blipSpeed));
    }

    // draw line from center
    float lineThickness = .015;
    vec2 line = normalize(vec2(cos(angle), sin(angle)));
    float multiply = clamp(sign(dot(uv, line)), 0., 1.);
    float distFromLine = sqrt(pow(dist, 2.) - pow(dot(uv, line), 2.));
    clippedGreen += pow(smoothstep(lineThickness / 2., 0., distFromLine), 3.) * multiply;

    // draw grid
    float gridIncrement = .1;
    float gridLineThickness = 1. /iResolution.y;
    float gridAddend = (1. - step(gridLineThickness, mod(uv.x, gridIncrement)))
        + (1. - step(gridLineThickness, mod(uv.y, gridIncrement)));
    clippedGreen += gridAddend;

    // draw gradient
    float gradientAngleAmount = PI / 2.;
    float uvAngle = mod(atan(uv.y, uv.x) + PI * 2., PI * 2.);
    float angleDiff = mod(uvAngle - angle, 2. * PI);
    clippedGreen += smoothstep(gradientAngleAmount, 0., angleDiff);

    // why doesn't changing the alpha value do anything?
    // color.a = 0.;
    uv.x /= iResolution.x / iResolution.y;
    uv += .5;
    //vec4 color = texture(iChannel1, uv);
    //color.g += clippedGreen * clipToRadius + container;
    //gl_FragColor = color;
    gl_FragColor = vec4(0., clippedGreen * clipToRadius + container, 0., 1.);
}