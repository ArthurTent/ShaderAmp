// https://www.shadertoy.com/view/4dKBDh
// Created by sujay
// Modified by Arthur Tent
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;
void main()
{

    // Normalized pixel coordinates (from 0 to 1)
    //vec2 uv = fragCoord/iResolution.xy;
    vec2 uv = -1. + 2.* vUv;
    //uv = (2.*vUv - iResolution.xy) / iResolution.y;
	uv.y = uv.y+0.5;

    //sound data
    // first texture row is frequency data


    // second texture row is the sound wave


	// convert frequency to colors
	//vec3 col = vec3( fft, 4.0*fft*(1.0-fft), 1.0-fft ) * fft;


    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
    uv.xy=uv.yx;
    uv = vec2 ( sqrt(uv.x*uv.x + uv.y*uv.y), atan(uv.y, uv.x)/2.0*3.14 );
    vec2 z = vec2(0.0, .0);;
    //vec2 c = uv*sin(iTime/3.0);
    float wave = texture( iAudioData, vec2(uv.x,uv.y/20.) ).x;
    float fft  = texture( iAudioData, vec2(uv.x,0.5) ).x;
    vec2 c = uv*0.4;

    float iter=30.0 * fft;//10.0+abs(10.0*sin(iTime*0.1));
    float flag =1.0;
    float j= 0.0;

    for(float i = 0.0; i<iter;i= i+1.0)
    {
        z = vec2(z.x*z.x -z.y*z.y, 2.0*z.x*z.y) + c;
        j = i;//iter -i;
		if((z.x*z.x +z.y*z.y) > 4.0)
        {
            flag = 0.0;
            break;
        }
    }

    float sn = float(j) - log2(log2(dot(z,z)));// + 40.0;
    if(flag == 1.0)
    {
        gl_FragColor = vec4(vec3(0), 1.0);
    }
    else
    {
        //fragColor=vec4(vec3(j/iter)*vec3(2,0,0)*abs(sin(0.2*iTime)),1.0);
        gl_FragColor=vec4(vec3(j/iter)*col*wave*vec3(1,1,1)*sn,1.0);
    }
}