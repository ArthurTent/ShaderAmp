// Based on https://www.shadertoy.com/view/MslBDN
// Modified by ArthurTent
// Created by kalin
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 International.
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

#define s(x) smoothstep(0.15, 0.3, x * 1.1 - 0.1)

vec3 chromaKey(vec3 x, vec3 y){
	vec2 c = s(vec2(x.g - x.r * x.y, x.g));

    return mix(x, y, c.x * c.y);
}
vec3 getTexture(vec2 p){
	vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}

void main() {

    float bass = pow(texture(iAudioData, vec2(0.0, 0.14)).x, 4.);
    vec2 uv = -1.0 + 2.0 * vUv; // for use within shaderamp
    //vec2 uv = fragCoord.xy/iResolution.xy;
    //vec2 nuv = uv* 2.0 - 1.0;
    vec2 nuv = uv;//  * 2.0 - 1.0; // for use within shaderamp

    nuv.x /= iResolution.y / iResolution.x;
    nuv.x /= 0.9;
    nuv.y /= 0.9;

    float bpm = 1.0 / 60.0 * 84.3;
    float t = iAmplifiedTime;
    float pi = 3.1415926535;
    float drum = pow(abs(sin(t * bpm * pi)), 32.0);

    gl_FragColor.x = drum*10.;
    gl_FragColor.y = pow(abs(sin(t * bpm * pi * 4.0)), 32.0) * uv.y;

    // uv = 0..1
    // resx = 800~
    float pixel = uv.x * iResolution.x;
    float muvx = length(nuv);
    float mx = muvx / 512.0 * iResolution.x * (0.15 + 0.5 * pow(muvx, 4.0));
    float mu = texture(iAudioData, vec2(mx, 0.25)).x;
    //float outer = step(0.0, muvx);
    float outer = step(0.0, muvx);
    float inner = step(0.15, 1.0 - muvx);

    vec3 col0 = vec3(0.0, 0.0, 2.8) * mu * 0.2;
    col0 += pow(mu, 11.0) * 0.2;
    col0 += pow(drum * mu * muvx, 1.2) * 0.2;

    //vec3 col1 = vec3(sin(iAmplifiedTime)/1.5 + 0.4 + 0.4 * mu, 0.3 + 0.2 * mu, 0.2 + 0.3 * mu) * pow(mu, 2.0) * 3.0;
    vec3 col1 = vec3(sin(iAmplifiedTime)/1.5 + 10.8 * mu, 0.3 + 0.2 * mu, 0.2 + 0.3 * mu) * pow(mu, 2.0) * 3.0;
    vec3 col2 = vec3(10.0*bass, bass*2.5, bass*5.);


    vec3 col_greenscreen = getTexture(vUv);
    col0 = chromaKey(col_greenscreen, col0);
    col1 = chromaKey(col_greenscreen, col1);
    col2 = chromaKey(col_greenscreen, col2);


    gl_FragColor.xyz = col2 * max(0.0, (1.0 - inner));
    gl_FragColor *= pow(max(gl_FragColor - .2, 0.0), vec4(1.4)) * .5;

    //gl_FragColor.xyz += abs(sin(nuv.y * 10.0 * bpm * (1.0 - inner) + t * 5.0)) * (1.0 - inner) * 0.1;
    gl_FragColor.xyz += abs(sin(nuv.y * 10.0 * bpm * (1.0 - inner) + t * 5.0*mu)) * (1.0 - inner) * 0.1;
    gl_FragColor.xyz += fract(sin(nuv.y * 30.0 * bpm * (1.0 - inner) + t * 2.0)) * (1.0 - inner) * 0.2 * mx * 0.5;


    gl_FragColor.xyz += col1 * inner * outer * 0.1;
    gl_FragColor.xyz += col0 * inner * outer;
    gl_FragColor.xyz += col1 * inner * outer * sin(t * bpm + nuv.y * 15.0 * mu);

    gl_FragColor *= pow(max(gl_FragColor - .2, 0.0), vec4(bass*outer)) * 1.5;
    vec3 resultColorWithBorder = mix(vec3(0.),vec3(gl_FragColor.x, gl_FragColor.y, gl_FragColor.z),pow(max(0.,1.5-length(uv*uv*uv*vec2(2.0,2.0))),.3));
    gl_FragColor = vec4(resultColorWithBorder, 1.0);

}
