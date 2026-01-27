uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform vec3 iResolution;
uniform vec4 iMouse;
varying vec2 vUv;

#ifdef GL_ES
// Wichtig für WebGL/GLSL ES
precision highp float;
#endif


#define PI 3.14159
#define s(a,b,c) smoothstep(a,b,c)

// Angepasst von texelFetch auf texture2D (Sampling an Position a, y=0.0)
#define FFT(a) pow(texture2D(iAudioData, vec2((a)/256.0, 0.0)).x, 5.0)

float snd = 0.;
float TiltX, AltiY;

//#define MID_THRESHOLD 0.525
#define MID_THRESHOLD 0.45
#define DECAY_TIME 0.5

// Angepasst von texelFetch auf texture2D
#define RAW_FFT(a) texture2D(iAudioData, vec2((a)/256.0, 0.0)).x

mat2 r2d(float a){float c=cos(a), s=sin(a); return mat2(c,s,-s,c);}

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * .1031); // KORRIGIERT
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float fbm(in vec2 v_p)
{
    float pvpx = 2.0*v_p.x; // KORRIGIERT
    vec2 V1 = vec2(0.5*floor(pvpx      ));
    vec2 V2 = vec2(0.5*floor(pvpx + 1.0));
    return mix(hash12(V1),hash12(V2),smoothstep(0.0,1.0,fract(pvpx)));
}

float metaDiamond(vec2 p, vec2 pixel, float r)
{
    vec2 d = abs(p-pixel);
    return r / (d.x + d.y);
}

float sdUnevenCapsule( vec2 p, float r1, float r2, float h )
{
    p.x = abs(p.x);
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(p,vec2(-b,a));
    if( k < 0.0 ) return length(p) - r1;
    if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
    return dot(p, vec2(a,b) ) - r1;
}

vec2 domain_warping(vec2 p)
{
    vec2 dist;
    float ampli1=0.5;
    mat2 rm= mat2(1.7);
    for( float i = 0.0; i<2.0; i++ )
    {
        // Geändert: texture zu texture2D
        dist = 7.0*texture2D(iChannel0,0.002*rm*p + 0.00*iAmplifiedTime).xy;
        p += ampli1*dist;
        rm *= rm*5.0;
    };
    return p;
}

float traceChar( in vec2 v,float charac, vec2 PosTxt)
{
    float colorChar = 0.0;
    v = vec2(v.x, 1.0-v.y);
    if( v.x > PosTxt.x && v.x < PosTxt.x + 1.0/16.0 )
    {
        if( v.y > PosTxt.y && v.y < PosTxt.y + 1.0/16.0 )
        {
            vec2 Disp = vec2(mod(float(charac),16.0),floor(float(charac) / 16.0))/16.0;
            // texture2D ist hier korrekt
            colorChar = texture2D(iChannel1,vec2(Disp.x + (v.x - PosTxt.x),-Disp.y - (v.y - PosTxt.y) )).x;
        };
    };
    return colorChar;
}

vec4 GetColorSpot(vec2 c)
{
    float SelectedColor = floor(mod(c.x,7.0));
    float Mask = s(0.0,0.75,abs(sin(c.x*PI/1.0)));

    if(SelectedColor == 0.0)return vec4(1.0,0.0,0.0,1.0)*Mask;
    if(SelectedColor == 1.0)return vec4(1.0,1.0,1.0,1.0)*Mask;
    if(SelectedColor == 2.0)return vec4(0.1,0.7,0.3,1.0)*Mask;
    if(SelectedColor == 3.0)return vec4(1.0,0.5,0.0,1.0)*Mask;
    if(SelectedColor == 4.0)return vec4(1.0,0.0,1.0,1.0)*Mask;
    if(SelectedColor == 5.0)return vec4(0.0,0.5,0.5,1.0)*Mask;
    if(SelectedColor == 6.0)return vec4(1.0,0.7,0.5,1.0)*Mask;
    return vec4(0.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = vec2( (fragCoord.x - iResolution.x/2.0)/iResolution.y,fragCoord.y/iResolution.y - 0.5);

    float mid_freq_sum = 0.0;
    // Wir verwenden eine feste Anzahl von Samples für die Schleife, um eine Annäherung zu erhalten
    int num_samples = 15; 
    float start_mid_norm = 50.0/256.0;  
    float end_mid_norm = 200.0/256.0;   
    float step_size = (end_mid_norm - start_mid_norm) / float(num_samples);

    for (int i = 0; i < num_samples; i++) {
        float current_pos = start_mid_norm + float(i) * step_size;
        // Sampling der Audio-Textur
        mid_freq_sum += texture2D(iAudioData, vec2(current_pos, 0.0)).x; 
    }
    
    float mid_freq_avg = mid_freq_sum / float(num_samples);
    
    bool active_shield = mid_freq_avg > MID_THRESHOLD;
    
    snd = FFT(128.0); 
    
    
    vec2 last_p = p;

    vec4 col = vec4(0.0);

    float Speed = 10.0*iAmplifiedTime;

    TiltX = -0.0150*(iMouse.x - iResolution.x/2.0);
    AltiY =  0.0015*(iMouse.y - iResolution.y/2.0);
	// slowly in and oout
	AltiY*= .5+sin(iTime*.25)*3.+(-.3+sin(iTime*1.3)/4.);
    if( abs(p.y) - 0.4 < 0.0)
    {
        p*=12.0;

        p*=1.0 + AltiY;
        p*=r2d(TiltX);

        p*=r2d(0.4 + 2.0*PI*fbm(vec2(0.1*iAmplifiedTime)) - PI);

        vec2 b = p, l = p;

        vec2 ScrollPos = p + vec2(Speed,0.0);

        col = mix(vec4(0.0,0.0,0.0,1.0),GetColorSpot(0.01*ScrollPos),s(5.0,0.0,abs(p.y - 5.5*fbm(0.05*ScrollPos) + 3.0) - 0.0 - 1.0*fbm(0.15*ScrollPos)));

        p = domain_warping(ScrollPos);

        float Nebula1 = p.y - 2.0*fbm(vec2(0.2*p.x+ 124.9));
        float Nebula2 = p.y - 3.0*fbm(vec2(0.5*p.x+ 170.4));
        float Nebula3 = p.y - 2.0*fbm(vec2(0.2*p.x+ 124.9)) - 0.5;
        float Nebula4 = p.y - 2.0*fbm(vec2(0.2*p.x+  15.4)) + 0.5;

        // Geändert: texture zu texture2D
        col+= vec4(0.5,0.5,0.5,1.0)*GetColorSpot(vec2(0.01*p))*texture2D(iChannel0,0.005*p)
                                  *s(5.5,0.0,abs(p.y-3.5)-10.0*fbm(vec2(0.1*p)));

        Nebula1 = p.y - 2.0*fbm(vec2(0.2*p.x+124.9));
        // Geändert: texture zu texture2D
        col+= 0.5*texture2D(iChannel0,0.005*(p))*s(0.1,0.0,abs(Nebula1)-2.0)*s(0.0,0.3,Nebula2);

        // Geändert: texture zu texture2D
        col+= 1.0*texture2D(iChannel0,0.005*(p))*s(0.10,0.0,Nebula3)*s(0.0,0.5,Nebula4);

        // Geändert: texture zu texture2D
        col= mix(col,clamp(3.0*GetColorSpot(0.01*p)*vec4(0.2,0.2,0.3,0.0)*texture2D(iChannel0,0.005*(p)),0.0,0.4),fbm(0.125*p)*s(1.0-fbm(0.7*p),0.0,abs(Nebula1) - 0.5));

        // Geändert: texture zu texture2D
        col*= 1.0+1.0*fbm(vec2(0.5*p.x))*texture2D(iChannel0,0.005*(p))*s(0.01,0.0,abs(Nebula3)-0.2);

        p=b;

        p += vec2(Speed,0.0);

        b = fract(5.0*p);
        p = floor(5.0*p);
        if( fbm(vec2(p.x*p.y)) > (0.95 ) && s(0.0,1.5,abs(Nebula1) - 0.5) > 0.0)
             col += clamp(vec4(0.99)*pow((50.0 - 40.0*fbm(vec2(p.x+p.y)))*length(b-vec2(0.8*fbm(vec2(p.x*p.y)),0.80*fbm(vec2(p.x*p.y+258.2)))),-2.5),0.0,1.0);

        p=last_p;
        p*=1.0 + AltiY;
        p*=r2d(TiltX);
        p*=r2d(0.4 + 2.0*PI*fbm(vec2(0.1*iAmplifiedTime)) - PI);
        p*=2.5;
        p += vec2(fbm(vec2(0.1*iAmplifiedTime))-0.5,0.0);
        p*= r2d(-PI/2.0);

        col = mix(col,vec4(0.40)+pow(30.0*length(p),-2.0)*s(0.0,0.020,p.y-10.*p.x*p.x - 0.0230),s(0.005,0.0,length(p) - 0.1));
        col = mix(col,vec4(0.1),s(0.02,0.0,abs(length(p)-0.01) - 0.001));
        col = mix(col,vec4(0.60),s(0.001,0.0,abs(length(p)-0.100) - 0.001));
        col = mix(col,vec4(0.45),s(0.001,0.0,abs(length(p)-0.075) - 0.001));
        col = mix(col,vec4(0.45),s(0.001,0.0,abs(length(p)-0.050) - 0.001));
        col = mix(col,vec4(0.45),s(0.001,0.0,abs(length(p)-0.025) - 0.001));
        col = mix(col,vec4(0.2),s(0.01,0.0,abs(sdUnevenCapsule(r2d(PI)*5.0*p,0.1,0.05,0.2)-0.025) - 0.001));
        col += vec4(0.0,1.0,0.0,1.0)*pow(400.0*(1.0+0.1*abs(sin(2.0*iAmplifiedTime)))*length(p-vec2(0.1,0.0)),-2.0);
        col += vec4(1.0,0.0,0.0,1.0)*pow(400.0*(1.0+0.1*abs(sin(2.0*iAmplifiedTime + PI/2.0)))*length(p-vec2(-0.1,0.0)),-2.0);
        col += vec4(1.0)*pow(400.0*length(p-vec2(0.0,0.0)),-2.0);
        col += vec4(1.0)*pow(200.0*length(p-vec2(0.0,0.01)),-2.0);
        col += vec4(1.0,0.0,0.0,1.0)*pow(400.0*length(p-vec2( 0.0075,-0.1)),-1.5);
        col += vec4(1.0,0.0,0.0,1.0)*pow(400.0*length(p-vec2(-0.0075,-0.1)),-1.5);
        p*=r2d(PI/4.0);
        col += vec4(1.0,0.9,0.5,1.0)*pow(400.0*length(p-vec2(0.0, 0.085)),-2.0);
        col += vec4(1.0,0.9,0.5,1.0)*pow(400.0*length(p-vec2(0.0,-0.085)),-2.0);
        col += vec4(1.0,0.9,0.5,1.0)*pow(400.0*length(p-vec2(0.085,0.0)),-2.0);
        col += vec4(1.0,0.9,0.5,1.0)*pow(400.0*length(p-vec2(-0.085,0.0)),-2.0);
        p*=r2d(-PI/4.0);

        p=last_p;
        p*=1.0 + AltiY;
        p*=r2d(TiltX);
        p*=r2d(0.4 + 2.0*PI*fbm(vec2(0.1*iAmplifiedTime)) - PI);
        p*=2.5;
        p += vec2(fbm(vec2(0.1*iAmplifiedTime))-0.5,0.0);
        p*= r2d(-PI/2.0);
        vec4 ColorNCC1701 = vec4(0.4);

        p*=r2d(PI - 0.60);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,78.0,vec2(-0.043,1.125)));
        p *= r2d(0.18);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,67.0,vec2(-0.043,1.125)));
        p *= r2d(0.18);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,67.0,vec2(-0.043,1.125)));
        p *= r2d(0.18);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,45.0,vec2(-0.043,1.125)));
        p *= r2d(0.18);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,49.0,vec2(-0.043,1.125)));
        p *= r2d(0.18);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,55.0,vec2(-0.043,1.125)));
        p *= r2d(0.18);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,48.0,vec2(-0.043,1.125)));
        p *= r2d(0.18);
        col = mix(col,ColorNCC1701,traceChar(2.5*p,49.0,vec2(-0.043,1.125)));
        p *= r2d(-7.0*0.18);
        p*=r2d(-PI + 0.60);

        p.x = abs(p.x);
        p.x -= 0.075;
        col += vec4(0.1,0.15,1.0,1.0)*metaDiamond(p,vec2(0.0,-0.327),0.03);
        col += vec4(1.0,0.75,0.5,1.0)*metaDiamond(p,vec2(0.0,-0.125),0.005+0.003*sin(10.0*iAmplifiedTime));
        col += vec4(0.5,0.1,0.1,1.0)*s(0.001,0.0,length(p - vec2(0.0,-0.125)) - 0.008);
        if(abs(p.y + 0.225) - 0.10 < 0.0)col = mix(col,
        vec4(vec3(0.75*cos(200.0*p.x)),1.0)
        - vec4(0.3)*s(0.001,0.0,abs(p.y + 0.135)-0.0010)
        - vec4(0.3)*s(0.001,0.0,abs(p.y + 0.315)-0.015),
        s(0.005,0.0,abs(p.x) - 0.005));
        col = mix(col,vec4(0.7),s(0.001,0.0,abs(p.y+0.265) - 0.025)*s(0.001,0.0,abs(p.x)-0.007)*s(0.0,0.0001,abs(p.x)-0.0040));
        p.x += 0.075;
        if(abs(p.y +0.15) -0.075 < 0.0)col = mix(col,vec4(vec3(0.75-0.55*sin(100.0*p.x)),1.0),s(0.005,0.0,abs(p.x + clamp(0.005*cos(50.0*p.y + 1.4*PI),0.0,1.0)) - 0.015)*s(0.0,0.01,length(p)-0.10));

        p.y += 0.14;

        if(abs(p.x)<0.067)col = mix(col,vec4(vec3(0.75*cos((10.0*(p.x+0.05)))),1.0)
        ,s(0.005,0.0,p.y + 0.2*(p.x+0.15))*s(0.0,0.005,p.y + 0.2*(p.x+0.25) + 0.005)
        *s(0.0,0.01,abs(p.x) - 0.0015));

        col += vec4(1.0,0.9,0.5,1.0)*pow(500.0*length(p-vec2( 0.0,-0.080)),-2.0);
        col += vec4(1.0,0.9,0.5,1.0)*pow(500.0*length(p-vec2( 0.0, 0.240)),-2.0);
        if(abs(p.x)<0.0025)col = mix(col,vec4(0.4),s(0.005,0.0,abs(p.y-0.05) - 0.04));

        
        if( active_shield )
        {
            p=last_p;
            p*=1.0 + AltiY;
            p*=r2d(TiltX);
            p*=r2d(0.4 + 2.0*PI*fbm(vec2(0.1*iAmplifiedTime)) - PI);
            p*=2.5;
            p += vec2(fbm(vec2(0.1*iAmplifiedTime))-0.5,0.0);
            p += vec2(0.1,0.0);

            p*= r2d(fbm(vec2(floor(iAmplifiedTime)))*2.0*PI);

            // Geändert: texture zu texture2D
            col += 3.5*texture2D(iChannel0,5.0*p/(50.0*cos(length(5.1*p))) + vec2(1.0*iAmplifiedTime,0.0))*s(0.01,0.0,length(p) - 0.3)
            *vec4(0.0,1.0,0.0,1.0)*s(0.0,0.8,length(p - vec2(-0.5,0.0)) - 0.3);

            col += vec4(0.0,0.25,0.0,1.0)*clamp((s(0.1,0.0,length(p) - 0.30)-s(0.01,0.0,length(p) - 0.3)),0.0,1.0);
            col += vec4(0.0,1.0,0.5,1.0)*metaDiamond(p,vec2(0.3,0.0),0.10);
            p += vec2(-0.3,0.0);
            p*= r2d(fbm(vec2(floor(iAmplifiedTime)))*PI/4.0);
            if(p.x>0.0)col += 5.0*vec4(1.0,1.0,0.5,1.0)*clamp(sin(40.0*p.x + 250.0*iAmplifiedTime),0.0,1.0)*s(0.01,0.0,abs(p.y));
        };

        if( active_shield )
        {
            p=last_p;
            p*=1.0 + AltiY;
            p*=r2d(TiltX);
            p*=r2d(0.4 + 2.0*PI*fbm(vec2(0.1*iAmplifiedTime)) - PI);
            p*=2.5;
            p += vec2(fbm(vec2(0.1*iAmplifiedTime))-0.5,0.0);
            p*= r2d(-PI/2.0);

            float FiringAngle = PI*fbm(floor(vec2(0.5*iAmplifiedTime + 123.12)));
            p*= r2d(FiringAngle);
            p*= r2d(-0.01);
            if(p.x>0.1)col = mix(col,vec4(0.5,0.5,1.0,1.0),s(0.01,0.0,abs(p.y + 0.005)));
            if(p.x>0.1)col += vec4(0.0,1.0,1.0,1.0)*s(0.005,0.0,abs(p.y + 0.005));
            p*= r2d(0.02);
            if(p.x>0.1)col = mix(col,vec4(0.5,0.5,1.0,1.0),s(0.01,0.0,abs(p.y - 0.005)));
            if(p.x>0.1)col += vec4(0.0,1.0,1.0,1.0)*s(0.005,0.0,abs(p.y - 0.005));
            p*= r2d(-0.01);
            col += vec4(0.0,1.0,1.0,1.0)*metaDiamond(p,vec2(0.1,0.0),0.02);
            p*= r2d(-FiringAngle);
        };
        
        p=l;
        p = domain_warping(p + vec2(2.0*Speed,0.0));
        p *= 0.5;
        p += vec2(0.0,0.5);
        Nebula1 = p.y - 4.0*fbm(vec2(0.2*p.x+124.9));
        // Geändert: texture zu texture2D
        col = mix(col,clamp(5.0*GetColorSpot(0.01*p + 4.0)*vec4(0.2,0.2,0.3,0.0)*texture2D(iChannel0,0.005*(p)),0.0,0.4),fbm(0.5*p)*s(1.0-fbm(0.7*p),0.0,abs(Nebula1) - 2.5));

        p=l;
        p = domain_warping(p + vec2(8.0*Speed,0.0));
        p *= 0.15;
        p += vec2(0.0,1.0);
        Nebula1 = p.y - 2.0*fbm(vec2(0.2*p.x+124.9));
        // Geändert: texture zu texture2D
        col = mix(col,clamp(5.0*GetColorSpot(0.01*p+ 4.0)*vec4(0.2,0.2,0.3,0.0)*texture2D(iChannel0,0.005*(p)),0.0,0.4),0.5*s(1.0-fbm(0.7*p),0.0,abs(Nebula1) - 0.5));

    }else{
        // ... Text-Anzeige nur, wenn das Raumschiff nicht aktiv ist (Zeiten < 9.0)
        p=last_p;
        p*=0.75;
        if( iTime< 4.5)
        {
            // Star Trek In A Shader...
            int[24] TabSTIAS = int[](83, 84, 65, 82, 32, 84, 82, 69, 75, 32, 73, 78, 32, 65, 32, 83, 72, 65, 68, 69, 82, 46, 46, 46);
            for( float h=0.0;h< 24.0; h++)
            {
                col += vec4(1.0,1.0,0.0,1.0)*traceChar(p,float(TabSTIAS[int(h)]),vec2(-25.0*0.027/2.0 + 0.027*h
                ,1.30));
            };
        };
        
        if( iTime > 4.5 && iTime < 9.0)
        {
            // Episode 42: Audio Reactive Shield Reactor
            int[42] TabSTIAS2 = int[](69, 112, 105, 115, 111, 100, 101, 32, 52, 50, 58, 32, // Episode 42: 
                                     65, 117, 100, 105, 111, 32, 82, 101, 97, 99, 116, 105, 118, 101, 32, // Audio Reactive 
                                     83, 104, 105, 101, 108, 100, 32, 82, 101, 97, 99, 116, 111, 114, 32); // Shield Reactor + Space
            
            for(float h=0.0;h< 42.0; h++)
            {
                col += vec4(1.0,1.0,0.0,1.0)*traceChar(p,float(TabSTIAS2[int(h)]),vec2(-43.0*0.027/2.0 + 0.027*h
                ,1.30));
            };
        };
    };
    fragColor = col;
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}
