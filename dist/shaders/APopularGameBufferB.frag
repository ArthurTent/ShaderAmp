// https://www.shadertoy.com/view/4llfDs
// Modified by ArthurTent
// Created by patu
// Original Shader Name: ♫ [MAGFest] Station event
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferA output
uniform sampler2D iChannel1; // expects BufferB output
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;

float POW(float b,float e){
    if(b<0.)return -pow(-b,e);
    else return pow(b,e);
}
float noise( in vec3 x )//https://www.shadertoy.com/view/4sfGzS
{
    vec3 p = floor(x);
    vec3 f = fract(x);
f = f*f*(3.0-2.0*f);
vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
vec2 rg = texture( iChannel0, (uv+0.5)/256.0, -100.0 ).yx;
return mix( rg.x, rg.y, f.z );
}

vec3 nrand3( vec2 co )//https://www.shadertoy.com/view/MslGWN
{
vec3 a = fract( cos( co.x*8.3e-3 + co.y )*vec3(1.3e5, 4.7e5, 2.9e5) );
vec3 b = fract( sin( co.x*0.3e-3 + co.y )*vec3(8.1e5, 1.0e5, 0.1e5) );
vec3 c = mix(a, b, 0.5);
return c;
}

int read(int p,int q){
    return int(texture(iChannel0,(vec2(p,q)+0.5)/iResolution.xy).x*255.);
}
//0:noCurrentPiece 1:falling 2:erasing 3:gameOver 4:wait for restart
#define state() read(9,0)
int field(int x,int y){//_#IOTSZLJ
    if(x<0 || x>9)return 1;
    if(y<0)return 0;
    if(y>19)return 1;
    return read(y,x+3);
}
#define pieceType() read(0,1)
#define pieceX() read(1,1)
#define pieceY() read(2,1)
#define pieceR() read(3,1)
int maxi(int a,int b){
    return a<b?b:a;
}
int pposXs(int t,int i){
    if(t==0)return i-1;
    else if(t==1)return (i==1||i==3)?0:1;
else{
    if(i==0)return 0;
        if(t<5)return i-2;
        else if(t==5)return -((maxi(2,i)-2)*2-1);
        else if(t==6)return (maxi(2,4-i)-2)*2-1;
    }
    return 0;
}
int pposYs(int t,int i){
    if(t==0)return 0;
    else if(t==1)return i<2?0:-1;
    else{
        if(i==0)return 0;
        if(i==2)return t<5?-1:0;
        return (t==5-(i+1)/2 || t==(i+1)/2+4)?-1:0;
    }
    return 0;
}
int pposX(int t,int i,int r){
    if(t==0){
        if(r==1)return 1;
        else if(r==3)return 0;
        else return pposXs(t,i);
    }else if(t==1)return pposXs(t,i);
    else{
        if(r==0)return pposXs(t,i);
        if(r==1)return -pposYs(t,i);
        if(r==2)return -pposXs(t,i);
        if(r==3)return pposYs(t,i);
    }
    return 0;
}
int pposY(int t,int i,int r){
    if(t==0){
        if(r==0)return 0;
        else if(r==2)return 1;
        else return pposXs(t,i)+1;
    }else if(t==1)return pposYs(t,i);
    else{
        if(r==0)return pposYs(t,i);
        if(r==1)return pposXs(t,i);
        if(r==2)return -pposYs(t,i);
        if(r==3)return -pposXs(t,i);
    }
    return 0;
}
vec3 colorType(int t){//IOTSZLJ
	float snd = (FFT(1)+FFT(25)+FFT(50)+FFT(75))/2.;
    if(t==1)return vec3(0.5);
    if(t==2)return vec3(0,0.8,0.8)*snd;
    if(t==3)return vec3(0.8,0.8,snd);
    if(t==4)return vec3(0.5,0,1)*snd;
    if(t==5)return vec3(snd,0.8,snd);
    if(t==6)return vec3(0.8,snd,snd/2.);
    if(t==7)return vec3(1,0.5,snd)*snd;
    if(t==8)return vec3(0.2,0.2,1)*snd;
    return vec3(0,0,0);
}
vec4 coloring(int t,vec2 e){
    vec3 color = colorType(t);//*(.3+FFT(25)*2.4);
    float d = max(abs(e.x),abs(e.y));
    color += abs(-POW(d,4.)+0.5)-0.3;
    if(t==1)e=-e;
    if(d<0.9)color += max(POW(e.x/0.9,3.),POW(e.y/0.9,3.));
    return vec4(color,1);
}
void drawField( inout vec4 fragColor, in vec2 uv){
    vec2 p = uv*25.;
    if(p.x<-6. || p.x>6. || p.y < 4.)return;
    ivec2 pi = ivec2(floor(p))+ivec2(5,-4);
    int t = 0;
    int s = state();
    if(s==1 || s==3){
        int mt = pieceType();
        int mx = pieceX();
        int my = pieceY();
        int mr = pieceR();
        for(int i=0;i<4;i++){
            if(mx+pposX(mt,i,mr)==pi.x && my+pposY(mt,i,mr)==pi.y){
                t=mt+2;
            }
        }
    }
    int v = field(pi.x,pi.y);
    if(t==0 || v==1)t = v;
    bool fi = v != 0;
    vec2 e = fract(p)*2.-1.;
    if(t==0){
        fragColor *= 0.7;
        fragColor += POW(max(abs(e.x),abs(e.y)),3.)*0.1;
    }else{
        fragColor = coloring(t,e);
        if(fi)fragColor *= 0.8;
    }
}
void drawHold( inout vec4 fragColor, in vec2 uv){
    vec2 p = uv*25.;
    if(p.x<-11.5 || p.x>-6.5 || p.y < 4.5 || p.y > 9.5)return;
    p -= vec2(-11,5);
    vec2 fr = p;
    int mt = read(4,1);
    if(mt==1)p-=vec2(0,0.5);
    if(mt>2)p-=vec2(0.5,0);
    ivec2 pi = ivec2(floor(p));
    int t = 0;
    if(mt>0){
        for(int i=0;i<4;i++){
            if(1+pposX(mt-1,i,0)==pi.x && (mt<2?1:2)+pposY(mt-1,i,0)==pi.y){
                t=mt+1;
            }
        }
    }
    vec2 e = fract(p)*2.-1.;
    if(t!=0){
        fragColor = coloring(t,e);
    if(read(5,1)==1)fragColor *= 0.5;
    }
    p=fr;
    p-=vec2(2,2);
    float er = (max(abs(p.x),abs(p.y))-2.)*4.-1.;
    if(er>-1.){
    fragColor = vec4(0);
        fragColor += POW(1.-er,2.)*0.3;
    }
}

void drawNextMain( inout vec4 fragColor, in vec2 uv){
    vec2 p = uv*25.;
    if(p.x<-4. || p.x>4. || p.y < 0. || p.y > 4.)return;
    p -= vec2(-2,0);
    int mt = read(read(10,1)-1,2);
    if(mt==0)p-=vec2(0,0.5);
    if(mt>1)p-=vec2(0.5,0);
    p = (p-vec2(2,2))/1.2+vec2(2,2);
    ivec2 pi = ivec2(floor(p));
    int t = 0;
    for(int i=0;i<4;i++){
        if(1+pposX(mt,i,0)==pi.x && (mt<1?1:2)+pposY(mt,i,0)==pi.y){
            t=mt+2;
        }
    }
    vec2 e = fract(p)*2.-1.;
    
    if(t!=0){
        fragColor = coloring(t,e);
    }
}
void drawNext( inout vec4 fragColor, in vec2 uv){
    vec2 p = uv*25.;
    int c = int((p.y-5.)/5.);
    p.y -= float(c)*5.;
    if(p.x<7. || p.x>11. || p.y < 5. || p.y > 9.)return;
    p -= vec2(7,5);
    int mt = read(read(10,1)-2-c,2);
    if(mt==0)p-=vec2(0,0.5);
    if(mt>1)p-=vec2(0.5,0);
    ivec2 pi = ivec2(floor(p));
    int t = 0;
    for(int i=0;i<4;i++){
        if(1+pposX(mt,i,0)==pi.x && (mt<1?1:2)+pposY(mt,i,0)==pi.y){
            t=mt+2;
        }
    }
    vec2 e = fract(p)*2.-1.;
    if(t!=0){
        fragColor = coloring(t,e);
    }
}
vec3 bg(vec2 uv){
    vec3 v = normalize(vec3(1.5,1.-uv.y*2.,uv.x*2.));
    float r=-iTime/16.;
    v.xz *= mat2(cos(r),sin(r),-sin(r),cos(r));
    v.y*=-1.0;
	v*=(.3+FFT(1));
    vec3 d=vec3(0,0.4,1.0);
    d*=pow(max(v.y+0.7,0.0),3.0)+0.5;
    d.y-=0.4*max(-(v.y-0.5),0.0);
   	 
    vec2 seed = v.zy * 0.6;//https://www.shadertoy.com/view/MslGWN
seed = floor(seed * iResolution.x);
vec3 rnd = nrand3( seed );
vec4 starcolor = vec4(pow(rnd.y,40.0));
    d += pow(starcolor.x*5.0*(0.8-v.y),2.0);
	d+=FFT(uv.x);
    return d/3.0;
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord.xy * 2. - iResolution.xy) / iResolution.y;
    uv.x /= 2.;
    uv.y = 1. - fragCoord.y / iResolution.y;
    fragColor = vec4(0);
    for(int i=-1;i<=1;i++){
        for(int j=-1;j<=1;j++){
    fragColor += texture(iChannel1,(fragCoord+vec2(i,j))/iResolution.xy);
        }
    }
    fragColor/=10.;
    fragColor += vec4(bg(uv),0)/10.;
	drawField(fragColor,uv);
    drawHold(fragColor,uv);
    drawNextMain(fragColor,uv);
    drawNext(fragColor,uv);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
