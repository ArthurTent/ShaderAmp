// https://www.shadertoy.com/view/4stSRs
// Modified by ArthurTent
// Abstract Music by MatHack
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
//Fast Code, No Optim and clean ;) !

uniform float iAmplifiedTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

float freqs[16];


mat2 rotate2d(float angle){
    return mat2(cos(angle),-sin(angle),
                sin(angle),cos(angle));
}

float Hash2d(vec2 uv)
{
    float f = uv.x + uv.y * 47.0;
    return fract(cos(f*3.333)*100003.9);
}
float Hash3d(vec3 uv)
{
    float f = uv.x + uv.y * 37.0 + uv.z * 521.0;
    return fract(cos(f*3.333)*100003.9);
}
float mixP(float f0, float f1, float a)
{
    return mix(f0, f1, a*a*(3.0-2.0*a));
}
const vec2 zeroOne = vec2(0.0, 1.0);
float noise2d(vec2 uv)
{
    vec2 fr = fract(uv.xy);
    vec2 fl = floor(uv.xy);
    float h00 = Hash2d(fl);
    float h10 = Hash2d(fl + zeroOne.yx);
    float h01 = Hash2d(fl + zeroOne);
    float h11 = Hash2d(fl + zeroOne.yy);
    return mixP(mixP(h00, h10, fr.x), mixP(h01, h11, fr.x), fr.y);
}
float noise(vec3 uv)
{
    vec3 fr = fract(uv.xyz);
    vec3 fl = floor(uv.xyz);
    float h000 = Hash3d(fl);
    float h100 = Hash3d(fl + zeroOne.yxx);
    float h010 = Hash3d(fl + zeroOne.xyx);
    float h110 = Hash3d(fl + zeroOne.yyx);
    float h001 = Hash3d(fl + zeroOne.xxy);
    float h101 = Hash3d(fl + zeroOne.yxy);
    float h011 = Hash3d(fl + zeroOne.xyy);
    float h111 = Hash3d(fl + zeroOne.yyy);
    return mixP(
        mixP(mixP(h000, h100, fr.x), mixP(h010, h110, fr.x), fr.y),
        mixP(mixP(h001, h101, fr.x), mixP(h011, h111, fr.x), fr.y)
        , fr.z);
}


float PI=3.14159265;

void main()
{
    //vec2 uv = fragCoord.xy / iResolution.xx; 
    vec2 uv = vUv;   
    //vec2 mouse = iMouse.xy / iResolution.xy;    
    vec2 uv2 =  -1.0 + 2.0 * uv;
    //uv2.y += 0.45;    
    //uv2.xy -= (mouse*4.0) - 2.0;
    uv2.xy *= 4.5;  
    
    float time = iAmplifiedTime + (2.0*freqs[0]);

    vec3 color = vec3(0.0);
    vec3 color2 = vec3(0.0);
    
    float nbPointX = 128.0;
    float nbPointY = 128.0;
    float resX =  (iResolution.x/nbPointX)/iResolution.x;
    float resY =  (iResolution.y/nbPointY)/iResolution.y;
    
        
    for( int i=0; i<16; i++ ){
        freqs[i] = clamp( 1.9*pow( texture( iAudioData, vec2( 0.05 + 0.5*float(i)/16.0, 0.25 ) ).x, 3.0 ), 0.0, 1.0 );
        
        float wave = sqrt(sin( (-(freqs[i]*noise2d(uv*10.0+ vec2(rotate2d(iAmplifiedTime)).xy ) )*3.1416) + ((uv2.x*uv2.x) + (uv2.y*uv2.y)) ) );
     
		vec2 v = rotate2d(iAmplifiedTime) * (uv * 2.0);
        
 		wave = smoothstep(0.8, 1.0, wave);
        color2 += wave * (vec3(v.x, v.y, 1.7-v.y*v.x)*0.08) * freqs[i];
        
        float endPixelX = (1.0/iResolution.x)*(wave*1.0);
    	float endPixelY = (1.0/iResolution.x)*(wave*1.0);
        //Grid 1
        if(mod(uv.x, resX) >= 0.0 && mod(uv.x, resX) <= endPixelX && mod(uv.y, resY) >= 0.0 && mod(uv.y, resY) <= endPixelY){
            color2 += (vec3(v.x, v.y, 1.7-v.y*v.x)*0.08) ;
        }  
        
        
        wave = smoothstep(0.99999, 1.0, wave);
        color2 += wave * vec3(0.2) ;
      
        
    }
    gl_FragColor =  vec4(color2, 1.0);
    gl_FragColor *= pow(max(gl_FragColor - .2, 0.0), vec4(1.4)) * .5;
	
    
      
}

