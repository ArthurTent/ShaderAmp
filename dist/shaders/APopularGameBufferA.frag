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
uniform sampler2D iKeyboard;
uniform sampler2D iAudioData;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)

varying vec2 vUv;
int read(int p,int q){
    /*
    This is a historical code for preventing WebGL crash.
    Thanks to many viewers, and technology improvements.
    */
    // return 0;
    
    return int(texture(iChannel0,(vec2(p,q)+0.5)/iResolution.xy).x*255.);
}
void writeF(int p,int q,int s,inout vec4 fragColor,in ivec2 fragC){
    if(ivec2(p,q)==fragC)fragColor = vec4(float(s)/255.,0.,0,1);
}
#define write(p,q,s) writeF(p,q,s,fragColor,fragC)

bool keyboard(int t){ // 0-6 <^>vZXS
    float p = 0.;
    if(t<4)p = float(t)+37.5;
    if(t==4)p = 90.5;
    if(t==5)p = 88.5;
    if(t==6)p = 16.5;
    return texture(iKeyboard,vec2(p/256.,0)).x > 0.5;
}
void keyManage( inout vec4 fragColor, in ivec2 fragC ){
    if(fragC.x < 7)write(fragC.x,0,keyboard(fragC.x)?read(fragC.x,0)+1:0);
    /*
	for(int i=0;i<7;i++){
        int p = i, q = 0, s = keyboard(i)?read(i,0)+1:0;
    	write(i,0,s);
    }*/
}
bool key(int t,bool rep){
    int r = read(t,0);
    return r==1 || (rep && r>10);
}

int timer( inout vec4 fragColor, in ivec2 fragC ){
    int t = read(8,0);
    write(8,0,t==60?0:t+1);
    return t;
}
//0:noCurrentPiece 1:falling 2:erasing 3:gameOver 4:wait for restart
#define state() read(9,0)
#define writeField(x,y,i) write(y,(x)+3,i);
int field(int x,int y){//_#IOTSZLJ
    if(x<0 || x>9)return 1;
    if(y<0)return 0;
    if(y>19)return 1;
    return read(y,x+3);
}
// IOTSZLJ
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
bool safe(int t,int x,int y,int r){
    bool ret = true;
    for(int i=0;i<4;i++){
        if(field(x+pposX(t,i,r),y+pposY(t,i,r))!=0){
            ret = false;
            break;
        }
    }
    return ret;
}
bool safeDef(int x,int y,int r){
    int ru = r+pieceR()+4;
    ru -= (ru/4)*4;
    return safe(pieceType(),pieceX()+x,pieceY()+y,ru);
}
int sh(bool I,int curR,bool LR,int idx,int xy){
    if(idx==0)return 0;
    if(I){
        int cr = curR>=2?curR-2:curR;
        if(cr==1)LR=!LR;
        int d=0;
        if(xy==1){
            if(idx>=3){
                if(idx==3 && LR || idx==4 && !LR)d=1;
                if(idx==3 && !LR || idx==4 && LR)d=-2;
            }
        }else{
            idx = idx-1;
            if(idx>=2)idx-=2;
            if(idx==0 && LR)d=-2;
            if(idx==0 && !LR)d=-1;
            if(idx==1 && LR)d=1;
            if(idx==1 && !LR)d=2;
        }
        if(cr==1 && LR)d*=-1;
        if(curR>=2)d*=-1;
    	return d;
    }else{
        int cr = curR>=2?curR-2:curR;
        if(cr==1)LR=false;
        int d=0;
        if(xy==0 && idx!=3)d=-1;
        if(xy==1){
            if(idx==2)d=-1;
            if(idx>=3)d=2;
        }
        if(LR && xy==0)d*=-1; 
        if(cr==1)d*=-1;
        if(curR>=2 && xy==0)d*=-1;
        return d;
    }
    return 0;
}
void shift(int i,int r,out int dx,out int dy){
    dx = sh(pieceType()==0,pieceR(),r<0,i,0);
    dy = sh(pieceType()==0,pieceR(),r<0,i,1);
}
bool movePiece(int x,int y,int r, inout vec4 fragColor, in ivec2 fragC ){
    int p=x,q=y;
    int shx=0,shy=0;
    bool b=safeDef(p,q,0);
    if(!b)p=0;
    bool ret = false;
    for(int i=0;i<5;i++){
        shift(i,r,shx,shy);
        if(safeDef(p+shx,q+shy,r)){
            write(1,1,pieceX()+p+shx);
            write(2,1,pieceY()+q+shy);
            int ru = pieceR()+r+4;
            ru -= ru/4*4;
            write(3,1,ru);
            ret = true;
            break;
        }
        if(r==0)break;
    }
    return ret;
}
void setPiece( inout vec4 fragColor, in ivec2 fragC ){
    int t = pieceType();
    int xo = pieceX();
    int yo = pieceY();
    int ro = pieceR();
    for(int i=0;i<4;i++){
        int xu = xo + pposX(t,i,ro);
        int yu = yo + pposY(t,i,ro);
        writeField(xu,yu,t+2);
    }
    write(9,0,2);
    write(5,1,0);//release hold
}
#define swap(p,q) b=p,p=q,q=b
void perm(int r,out int a0,out int a1,out int a2,out int a3,out int a4,out int a5,out int a6){
    a0=0,a1=1,a2=2,a3=3,a4=4,a5=5,a6=6;
    int d,b;
    d = r - r/7*7, r /= 7;
    if(d==0)swap(a6,a0);
    if(d==1)swap(a6,a1);
    if(d==2)swap(a6,a2);
    if(d==3)swap(a6,a3);
    if(d==4)swap(a6,a4);
    if(d==5)swap(a6,a5);
    if(d==6)swap(a6,a6);
    d = r - r/6*6, r /= 6;
    if(d==0)swap(a5,a0);
    if(d==1)swap(a5,a1);
    if(d==2)swap(a5,a2);
    if(d==3)swap(a5,a3);
    if(d==4)swap(a5,a4);
    if(d==5)swap(a5,a5);
    d = r - r/5*5, r /= 5;
    if(d==0)swap(a4,a0);
    if(d==1)swap(a4,a1);
    if(d==2)swap(a4,a2);
    if(d==3)swap(a4,a3);
    if(d==4)swap(a4,a4);
    d = r - r/4*4, r /= 4;
    if(d==0)swap(a3,a0);
    if(d==1)swap(a3,a1);
    if(d==2)swap(a3,a2);
    if(d==3)swap(a3,a3);
    d = r - r/3*3, r /= 3;
    if(d==0)swap(a2,a0);
    if(d==1)swap(a2,a1);
    if(d==2)swap(a2,a2);
    d = r - r/2*2, r /= 2;
    if(d==0)swap(a1,a0);
    if(d==1)swap(a1,a1);
}
int nextInit( inout vec4 fragColor, in ivec2 fragC ){
    int r = int(mod(iTime*1000.,5040.));
    int a1,a2,a3,a4,a5,a6,a7;
    perm(r,a1,a2,a3,a4,a5,a6,a7);
        write(0,2,a1);
        write(1,2,a2);
        write(2,2,a3);
        write(3,2,a4);
        write(4,2,a5);
        write(5,2,a6);
        write(6,2,a7);
    r = int(mod(iTime*1000.+2000.,5040.));
    perm(r,a1,a2,a3,a4,a5,a6,a7);
        write(7,2,a1);
        write(8,2,a2);
        write(9,2,a3);
        write(10,2,a4);
        write(11,2,a5);
        write(12,2,a6);
        write(13,2,a7);
    write(10,1,13);
    return a7;
}
void genNext( inout vec4 fragColor, in ivec2 fragC ){
    int r = int(mod(iTime*1000.,5040.));
    int a1,a2,a3,a4,a5,a6,a7;
    perm(r,a1,a2,a3,a4,a5,a6,a7);
        write(0,2,a1);
        write(1,2,a2);
        write(2,2,a3);
        write(3,2,a4);
        write(4,2,a5);
        write(5,2,a6);
        write(6,2,a7);
    if(7 <= fragC.x && fragC.x < 14 &&  fragC.y == 2)write(fragC.x,2,read(fragC.x-7,2));
    /*
	for(int i=0;i<7;i++){
        write(7+i,2,read(i,2));
    }*/
    write(10,1,read(10,1)+7-1);
}
void consumeNext( inout vec4 fragColor, in ivec2 fragC ){
    write(10,1,read(10,1)-1);
}
void endTimer( inout vec4 fragColor, in ivec2 fragC ){
    write(8,0,0);
}
void generate( inout vec4 fragColor, in ivec2 fragC ){
    int ti=0;
    if(read(10,1)==0){
        ti=nextInit(fragColor,fragC);
    }else{
        if(read(10,1)==7)genNext(fragColor,fragC);
        else consumeNext(fragColor,fragC);
        ti=read(read(10,1)-1,2);
    }
    write(0,1,ti);
    write(1,1,4);
    write(2,1,1);
    write(3,1,0);
    if(!safe(ti,4,1,0)){
        write(9,0,3);
        endTimer(fragColor,fragC);
    }
}
void initPiece( inout vec4 fragColor, in ivec2 fragC ){
    write(9,0,1);
    write(8,0,1);
    generate(fragColor,fragC);
}
void hold( inout vec4 fragColor, in ivec2 fragC ){
    if(read(5,1)==1)return;
    int ti = read(4,1)-1;
    if(read(4,1)==0){
        write(4,1,pieceType()+1);
        write(5,1,1);
        generate(fragColor,fragC);
    }else if(safe(ti,4,1,0)){
        write(0,1,ti);
        write(1,1,4);
        write(2,1,1);
        write(3,1,0);
        write(4,1,pieceType()+1);
        write(5,1,1);
    }
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    if(fragCoord.y>13. || fragCoord.x>21.)discard;
    fragColor = texture(iChannel0,fragCoord/iResolution.xy);
    ivec2 fragC = ivec2(fragCoord);
    if(fragC.y==0)keyManage(fragColor,fragC);
    int t = timer(fragColor,fragC);
    if(state()==0)initPiece(fragColor,fragC);
    else if(state()==1){
        if(t==0){
            if(!movePiece(0,1,0,fragColor,fragC)){
                setPiece(fragColor,fragC);
            }else write(8,0,1);
        }else if(key(1,false)){
            int i=1;
            for(int j=0;j<20;j++){
                if(!safeDef(0,i,0))break;
                i++;
            }
            i--;
            if(i>0)movePiece(0,i,0,fragColor,fragC);
            endTimer(fragColor,fragC);
        }else if(key(3,true)){
            if(movePiece(0,1,0,fragColor,fragC)){
            	write(8,0,1);
            }
        }else if(key(6,false)){
            hold(fragColor,fragC);
        }else{
            bool ui=false;
            int x=0,r=0;
            if(key(0,true))ui=true,x-=1;
            if(key(2,true))ui=true,x+=1;
            if(key(4,false))ui=true,r-=1;
            if(key(5,false))ui=true,r+=1;
            if(ui)movePiece(x,0,r,fragColor,fragC);
        }
    }else if(state()==2){
        int cur=19;
        for(int i=19;i>-1;i--){
            bool f = true;
            for(int j=0;j<10;j++){
                if(field(j,i)==0){
                   f = false;
     	           break;
                }
            }
            if(!f){
                if(0 <= fragC.y-3 && fragC.y-3 < 10)writeField(fragC.y-3,cur,field(fragC.y-3,i));
                /*
                for(int j=0;j<10;j++){
                    writeField(j,cur,field(j,i));
                }*/
                cur--;
            }
        }
        if(0 <= fragC.y-3 && fragC.y-3 < 10 && 0 <= fragC.x && fragC.x <= cur)writeField(fragC.y-3,fragC.x,0);
        /*for(int j=20;j>-1;j--){
            if(j<=cur){
                for(int i=0;i<10;i++){
                	writeField(i,j,0);
            	}
            }
        }*/
        write(9,0,0);
    }else if(state()==3){
        if(t>40){
            write(9,0,4);
            return;
        }
        int d = 19-t/2;
        if(0 <= fragC.y-3 && fragC.y-3 < 10 && field(fragC.y-3,d)!=0)writeField(fragC.y-3,d,1);
        /*for(int i=0;i<10;i++){
            if(field(i,d)!=0){
                writeField(i,19-t/2,1);
            }
        }*/
        int ti = pieceType();
        for(int i=0;i<4;i++){
            int xu = 4 + pposX(ti,i,0);
            int yu = 1 + pposY(ti,i,0);
            if(yu==d)writeField(xu,yu,1);
        }
    }else if(state()==4){
        bool e = false;
        for(int i=0;i<7;i++){
            if(key(i,false)){
                e=true;
                break;
            }
        }
        if(e){
            fragColor=vec4(0);
            if(fragC.x < 7)write(fragC.x,0,1);
        }
        /*for(int i=0;i<7;i++){
            if(key(i,false)){
                fragColor=vec4(0);
                write(i,0,1);
                return;
            }
        }*/
    }
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
