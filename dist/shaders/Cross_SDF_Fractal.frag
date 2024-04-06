// https://www.shadertoy.com/view/tssfz7
// Created by bradjamesgrant
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

vec3 palette(float d, float intensity){
    d = d/50.;
    //return mix(vec3(.0,.2,.2),vec3(.8,.2,.5),1.-d)*3.5;
    if(intensity<0.1)
        return mix(vec3(.0,.0,.0),vec3(0.,.0,.0),1.-d)*3.5;
    return mix(vec3(sin(iAmplifiedTime)+intensity*10.3*cos(iAmplifiedTime),.51+intensity*0.5,intensity+2.2*sin(iAmplifiedTime)),vec3(.8,.2,.5),1.-d)*3.5;
}
float rnd(vec2 p){
	return fract(sin(p.x+100. + p.y*6574.)*45233.);
}

vec2 rotate(vec2 p, float a){
	float c = cos(a);
    float s = sin(a);
    return mat2(c,s,-s,c)*p;
}

float box(vec3 p, vec3 s, float intensity){
	p= abs(p)-s*intensity*4.;
    return max(p.x*intensity,max(p.y,p.z));
}
float map(vec3 p, float intensity){
    float t=iTime+385.;
    //CHANGE TEMPO HERE
     //t = t*1.59;
    t = t*1.;
    float tfract = fract(t);
    tfract*=tfract;
    t = floor(t) + tfract;
    t = t*0.2;
    for( int i = 0; i<13; ++i){

        p.xz =rotate(p.xz,t);
        p.xy =rotate(p.xy,t*1.89);
        p.xz = abs(p.xz);
        p.xz-=1.0;
    }
    vec3 q = p;
    q.xy = rotate(p.xy,t*1000.*.02);//*p.x*30.; add artifacts
    return min(box(p,vec3(2.,.5,.3), intensity),box(q,vec3(.5,2.,.3), intensity));
}




vec3 castRay (vec3 ro, vec3 rd){
    float intensity = texture(iAudioData, vec2(0.25, 0.0)).r;
	float t=0.;
    vec3 col = vec3(0.);
    int i = 0;
    for(i = 0; i<50; i++){
    	vec3 p = ro+t*rd*intensity;
        float d = map(p,intensity)*.5*intensity;
        if(d>200.)
            break;
        if(d<0.01){
            d = 0.1+intensity*100.1;
        }

        t+=d;
        col+=palette(float(i), intensity)*((0.005+intensity/200.)/(0.2+abs(d)));
        //col+=palette(length(p))*0.005/(0.2+abs(d));

    }
    return col;

}

void main()
{
    float intensity = texture(iAudioData, vec2(0.25, 0.0)).r;
    //vec2 uv = (fragCoord-(iResolution.xy/2.))/iResolution.y;
    vec2 uv = -1.+2.*vUv;
	vec3 ro = vec3(0.,0.,-40.);
	vec3 cf = normalize(-ro);
    vec3 cs = normalize(cross(cf,vec3(0.,1.,0.)));
    vec3 cu = normalize(cross(cf,cs));

    vec3 uuv = ro+ cs*uv.x + cu*uv.y;

   	vec3 rd = uuv-ro*intensity*10.;

    rd = normalize(vec3(-uv,1.));

    vec3 col = castRay(ro,rd);

    gl_FragColor = vec4(col,1.0);
}