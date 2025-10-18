// https://www.shadertoy.com/view/stXcz8
// Modified by ArthurTent
// Created by MrHAX00
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

// Common
#define pi 3.14159


//Smooth HSV to RGB conversion from shadertoy.com/view/MsS3Wc
vec3 hsv(vec3 c)
{
    vec3 rgb = clamp(abs(mod(c.x * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.);

	rgb = rgb*rgb*(3. - 2. * rgb); // cubic smoothing

	return c.z * mix( vec3(1.), rgb, c.y);
}

/*/Calculate the circle
vec4 DrawCircle(vec2 uv, float Rotate) {
    mat2 m = mat2(cos(Rotate), -sin(Rotate), sin(Rotate), cos(Rotate));
   	uv = m * uv;
    float Length = length(uv);
    float Angle = .5 - (acos(dot(vec2(1., 0.), uv / Length)) / pi) * .5;
    if (uv.y <= 0.) {
        Angle = .5 - Angle + .5;
    }

    float Freq = texelFetch(iAudioData, ivec2(floor(Angle * 20.) * 25.6, 0.), 0).x;

    Length = floor(Length * Length * 10.) * .1;

    if (Length > 1.) {
        Length = Length - 1.;
    } else {
        Length = 1. - Length;
    }
    if (Length < Freq) {
        Length = clamp(1. - Length, 0., 1.) * Freq;
    } else {
        Length = 0.;
    }

    return vec4(hsv(vec3(iTime + Angle * (mod(floor(Angle * 20.), Freq) + 1.), 1., 1.)), Length);
}*/

vec3 GetStarGrid(vec2 Coord) {
    Coord.x *= Coord.y * .05;
    return vec3(
        mod(Coord.r, mod(Coord.r / Coord.g, mod(Coord.r, .9))), //Radius
        cos(Coord.r * Coord.g * pi) * .3, //x offset
        -cos(Coord.r * Coord.g * Coord.r * Coord.g) * .3 //y offset
    );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates
    float Ratio = iResolution.x / iResolution.y;
    vec2 uv = (fragCoord/iResolution.xy - vec2(.5));
    uv.x *= Ratio;
    uv *= 3.;

    //Rotation
    float Rotate = 0.;

    for (int Type = 0; Type <= 1; Type++) {
        for (int i = 0; i <= 20; i++) {
            float Loudness = texelFetch(iAudioData, ivec2(i, Type), 0).x;
            if (Loudness > Rotate) {
                Rotate = Loudness;
            }
        }
    }

    uv *= Rotate; //Zoom depending on rotation amount

    //Rotation is from https://www.shadertoy.com/view/XlsGWf (i cant just change the angle because i need to have a degree between 0 and 360 not 0 and 180)
    float RadialRotate = mod(Rotate * .5 - .5, 2.) * pi;
    mat2 m = mat2(cos(RadialRotate), -sin(RadialRotate), sin(RadialRotate), cos(RadialRotate));
   	uv = m * uv;

    float Wave = texelFetch(iAudioData, ivec2(mod(floor(uv.x * 12.8 + 25.6) * 10., 512.), 0.), 0).x;

    //Stars
    vec2 ExactPos = mod(vec2(uv.x / Ratio, uv.y) * iResolution.xy * .00625 + vec2(iAmplifiedTime * 3., 0.), iResolution.xy);
    vec2 StarPos = round(ExactPos);

    vec3 StarData = GetStarGrid(StarPos);
    vec4 Stars = vec4(smoothstep(StarData.r + .01, StarData.r - .01, length(StarPos + StarData.yz - ExactPos) * (cos(iAmplifiedTime) * 2. + 8.)));

    //Bars
    float Length = floor(uv.y * uv.y * 10.) * .1;
    if (Length > Wave) {
        Length = clamp(1. - Length, 0., 1.) * Wave;
    } else {
        Length = 0.;
    }

    vec3 Apply = hsv(vec3(iAmplifiedTime + uv.x * Wave, Length - 2., Rotate - Length));

    vec4 Bars = vec4(Apply, Length);


    vec4 Got = texelFetch(iChannel2, ivec2(vec2(mod(uv.x - iAmplifiedTime, .6666666), .25 - uv.y) * 64.), 0);
    Bars = mix(mix(Bars, Got , Got.w * Rotate * .875), Stars, Stars.w);

    //Blur
    vec4 Blur = texelFetch(iChannel1, ivec2(fragCoord), 0);
    for (int X = -1; X <= 1; X += 2) {
        for (int Y = -1; Y <= 1; Y += 2) {
            Blur += texelFetch(iChannel1, ivec2(fragCoord) + ivec2(X, Y), 0);
        }
    }
    Blur /= 5.15;
    // Output to screen
    fragColor = mix(Blur, Bars, Bars.w);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
