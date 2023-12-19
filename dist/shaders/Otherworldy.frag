// https://www.shadertoy.com/view/MlySWd
// Otherworldy by lherm
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

uniform float iGlobalTime;
uniform sampler2D iAudioData; // nice hint for loading tAudio --> https://threejs.org/examples/webaudio_visualizer
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform sampler2D iVideo; 

varying vec2 vUv;

#define T iGlobalTime

#define PSD (abs(texture(iAudioData, vec2(.5)).r)*abs(texture(iAudioData, vec2(.5)).r))

// HG_SDF rotate function
#define r(p, a) {p = cos(a)*p + sin(a)*vec2(p.y,-p.x);}

// Cabbibo's HSV
vec3 hsv(float h, float s, float v) {return mix( vec3( 1.0 ), clamp( ( abs( fract(h + vec3( 3.0, 2.0, 1.0 ) / 3.0 ) * 6.0 - 3.0 ) - 1.0 ), 0.0, 1.0 ), s ) * v;}

void main()
{
	//vec2 u = (-iResolution.xy+2.*w.xy) / iResolution.y;
    vec2 u = -.458 + 2.0 *vUv*.456;

    vec3 ro = vec3(u, 1.), rd = normalize(vec3(u, -1.)), p; // Camera and ray dir
    float d = 0., m; // Distance for march
    for (float i = 1.; i > 0.; i-=0.02)
    {
        p = ro + rd * d;
        r(p.zy, T);
        r(p.zx, T);
        m = length(cos(abs(p)+sin(abs(p))+T))-(PSD + .5); // Distance function
        d += m;
        gl_FragColor = vec4(hsv(T, 1.,1.)*i*i, 1.);
        if (m < 0.02) break;
    }
    
}
