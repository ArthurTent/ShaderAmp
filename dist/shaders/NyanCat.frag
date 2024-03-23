// https://www.shadertoy.com/view/MsfcD8
// Modified by ArthurTent
// Created by Ivanshir
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
vec4 WoodShader(vec4 col,vec2 uv, float bass){
   if(bass < 1.5) {
       return vec4((texture(iChannel3,uv).rgb+col.rgb)/2.,col.a);
   }
   //return vec4((texture(iChannel3,uv).rgb+col.rgb)/2.,col.a);
   //float avg = (col.r + col.g + col.b) / 3.0;
   //return vec4(avg);
   return col;
}

vec4 renderAnimation(vec2 uv, float bass){
    vec2 ruv=uv;
    float s;
    int tick = int(iTime*8.);
    tick%=6;

    ruv.x/=6.;
    ruv.x+=float(tick)*(40. / 256.);

    return WoodShader(texture(iChannel1,ruv),ruv, bass);
}

vec4 renderNaynBass(vec2 uv,float bass){
    vec2 fir = vec2(0.5) - (bass/4.) ;
    vec2 sec = vec2(0.5) + (bass/4.) ;
    if(fir.x<=uv.x)if(fir.y<=uv.y)if(uv.x<=sec.x)if(uv.y<=sec.y){
        //vec4 animation = renderAnimation((uv-fir)*(2./bass));
        //float avg = (animation.r + animation.g + animation.b) / 3.0;
        //return vec4(avg);

        return renderAnimation((uv-fir)*(2./bass), bass);
    }
    return vec4(0);
}

vec3 SpaceShader(vec3 color,float bass){
    float bright=color.x*color.y*color.z;
    //if(bright<bass)return vec3(0);
    if(bright<bass)return vec3(bass-bright*2.);
    return vec3(bright);
}

void main()
{
	//vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv;
    vec2 uv2 = -1.0 + 2.0 * uv;
	vec2 sound = texture(iAudioData,vec2(0)).xy;
    float bass = (sound.x+sound.y)/2.;
    gl_FragColor=vec4(0);
    gl_FragColor=renderNaynBass(uv,bass*3.+0.5);
    if(gl_FragColor.a<0.5){
        gl_FragColor.rgb=SpaceShader(texture(iChannel2,fract(uv+vec2(iTime/2.,0.))).rgb,bass);
    }
    //if(uv.y<texture(iAudioData,vec2(uv.x)).x/5.)gl_FragColor.rgb=vec3(bass,0.,0.);
    if(uv.y<texture(iAudioData,vec2(uv.x)).x/5.){
        gl_FragColor.r=sin(iTime*bass);//mix(uv.x*sound.x*bass,sound.x,sound.y);
        gl_FragColor.g=sin(iTime)*uv.x+uv.y+bass;
        gl_FragColor.b=cos(iTime+bass)+uv.x+sound.x;
    }
    //gl_FragColor *= pow(max(gl_FragColor - .2, 0.0), vec4(bass)) * 1.5;
    //gl_FragColor = pow(max(gl_FragColor - .2, 0.0), vec4(bass)) * 1.5;
    //vec3 resultColorWithBorder = mix(vec3(0.),vec3(gl_FragColor.x, gl_FragColor.y, gl_FragColor.z),pow(max(0.,1.5-length(uv2*uv2*uv2*vec2(2.0,2.0))),.3));
    //vec3 resultColorWithBorder = mix(vec3(0.),vec3(gl_FragColor.x, gl_FragColor.y, gl_FragColor.z),pow(max(0.,1.5-length(uv2*uv2*uv2*vec2(7.0-bass*10.,7.0-bass*10.))),.3)); // fits
    vec3 resultColorWithBorder = mix(vec3(0.),vec3(gl_FragColor.x, gl_FragColor.y, gl_FragColor.z),pow(max(0.,1.5-length(uv2*uv2*uv2*vec2(10.0-bass*18.>2.?10.0-bass*18.:2.,10.0-bass*18.>2.?10.0-bass*18.:2.))),.3));
    gl_FragColor = vec4(resultColorWithBorder, 1.0);
    //gl_FragColor = vec4(gl_FragColor.x>0.5?gl_FragColor.x:1.,gl_FragColor.y,gl_FragColor.z,0.4);
}