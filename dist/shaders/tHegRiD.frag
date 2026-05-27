#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iAudioData;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

// Common
// This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0
// Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-sa/3.0/
// or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// =========================================================================================================

#define AA // Comment to deactivate antialiasing
#define sat(a) clamp(a, 0., 1.)
#define PI 3.141592653

mat2 r2d(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec2 _min(vec2 a, vec2 b)
{
    if (a.x < b.x)
        return a;
    return b;
}

// Stolen from 0b5vr here https://www.shadertoy.com/view/ss3SD8
float hash11(float p)
{
    return (fract(sin((p)*114.514)*1919.810));
}


// This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0
// Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc-sa/3.0/
// or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
// =========================================================================================================

vec3 rdrImg(vec2 uv)
{
    vec3 col = pow(texture(iChannel0, uv).xyz,vec3(1.3));
    col += pow(texture(iChannel0, uv).xyz,vec3(.9))*.35;
    return col;
}

vec3 rdrChroma(vec2 uv)
{
    vec3 col = vec3(0.);
    vec2 off = vec2(.002);
    col.r = rdrImg(uv+off).r;
    col.g = rdrImg(uv).g;
    col.b = rdrImg(uv-off).b;
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy/iResolution.xy;

    vec3 col = rdrChroma(uv);

    fragColor = vec4(col,1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
