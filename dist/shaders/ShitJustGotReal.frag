// https://www.shadertoy.com/view/Xdjczt
// Created by db0x90
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iGlobalTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

// Shit just got real

float bassAmp;
float bassDrum;
float width;

vec2 foo(vec2 uv, float a, float b) {
    float f = sin(3. * iGlobalTime + uv.y * 9.0122);
    f *=     sin(uv.y * 11.961) * 1.122;
    f *=     sin(uv.y * 17.514) * 1.113;
    f *=     sin(uv.y * 23.734) * 1.76252;
    f *= b + sin(f + iGlobalTime * 122.) * .04123;
    f *= bassDrum*a;
    return vec2(uv.x + f, uv.y);
}

vec3 interference(vec2 fragCoord) {
    float y;
        
    float cX = iResolution.x/2.0;
    float cY = iResolution.y/2.0;
    
    float tr=iTime * 29.1;
    float tg=iTime * 28.5;
    float tb=iTime * 27.4;
    
    float fr=0.007  + (bassDrum*0.00004);
    float fg=0.0066 + (bassDrum*0.00002);
    float fb=0.008  + (bassDrum*0.00005);
    
    vec2 uvr=fragCoord.xy;
    uvr = foo(uvr, 200., 50.);
    uvr.x = uvr.x - cX + ( 1.2 * cos(tr*0.05)*cX )  + ( 1.1 * sin(tr*0.031)*cX );
    uvr.y = uvr.y - cY + ( 1.7 * sin(tr*0.023)*cY ) - ( 1.3 * cos(tr*0.037)*cY );
    y=length(floor(uvr));
    float rr = 0.85 * abs( sin( fr *(y-tr) ) );
   
    vec2 uvg=fragCoord.xy;
    uvg.x = uvg.x - cX + ( 2.2 * sin(tr*0.036)*cX ) - ( 1.4 * cos(tr*0.027)*cX );
    uvg.y = uvg.y + cY - ( 3.9 * sin(tr*0.023)*cY ) - ( 1.2 * cos(tr*0.037)*cY );
    y=length(floor(uvg));
    float gg = 0.85 * abs( sin( (y-tg) * fg) );
    
    vec2 uvb=fragCoord.xy;
    uvb = foo(uvb,225.,45.);
    uvb.x = uvb.x - cX - ( 1.10*cos(tb+0.6)*cX );
    uvb.y = uvb.y + cY - ( 0.92*sin(tb-0.6)*cY );
    y=length(floor(uvg));
    float bb = 0.85 * abs( sin( (y-tb) * fb) );
    
    float scanline = 1. + sin(fragCoord.y*.075) * bassDrum * 3.;
    
    return vec3(rr,gg,bb) * scanline;
}

float leafFX( float r, float t ) {
    float bass = bassDrum*2.8 + bassAmp;
    return 	(1.0+0.90 * cos(  8.* t) ) * 
        	(1.0+0.10 * cos( 24.* t) ) *
        	( (0.7 + (bass*0.4) )+(bassAmp*0.16) * cos(110.* t) ) *
            (0.9+sin(t))
        	 - r;
}

float polar(vec2 fragCoord) {
    float r = length( fragCoord );
    float t = atan( fragCoord.y, fragCoord.x );
    return abs( leafFX(r,t) );
}

float hempleaf( vec2 fragCoord) {
    width = 1.0;// / min( iResolution.x ,iResolution.x);
    
    vec2 uv;
	uv.x = fragCoord.x*width*7.;
    uv.y = fragCoord.y*width*9.;
    uv = foo(uv,3.,.3);
    uv.y -= 0.65;
    uv.x -= 3.5;
	return 1.0 / max( polar(uv) / 0.22, 1.);
}

void sfft() {
    float bp = clamp( width,0.1,0.8);
	bassAmp  = texture(iAudioData, vec2(bp, 0.02)).x;
    
    bp = clamp( width,0.25,0.42);
    float xy = texture(iAudioData, vec2(bp, 0.1)).x;
    bassDrum =  smoothstep( 0.55, 1., xy);
}

void main( ) {
    //vec2 uv = fragCoord.xy/iResolution.xy*2.-1.;
    vec2 uv = -1.0 + 2.0 *vUv;
    
    sfft();
    
    vec3 resultColor;
    //resultColor += interference( uv );
    resultColor += interference( vUv );
    //resultColor *= vec3( ( 1.0 - hempleaf(uv)));
    resultColor *= vec3( ( 1.0 - hempleaf(vUv)));
	//resultColor  = mix(vec3(0.),resultColor,pow(max(0.,1.5-length(uv*uv*uv*vec2(1.6,1.6))),.9));
    resultColor  = mix(vec3(0.),resultColor,pow(max(0.,1.5-length(uv*uv*uv*vec2(1.6,1.6))),.9));

        
    gl_FragColor = vec4( resultColor, 0.);
}