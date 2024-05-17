// https://www.shadertoy.com/view/fldcWf
// Modified by ArthurTent
// Created by Tilmann
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define getLevel(x) (texelFetch(iAudioData, ivec2(int(x*512.), 0), 0).r)
float getVol(float samples) {
    float avg = 0.;
    for (float i = 0.; i < samples; i++) avg += getLevel(i/samples);
    return avg / samples;
}
#define TAU 6.28319
#define INTRO_END 0.0
#define TICK_DURATION 0.13

float saturate2(float x){
    return clamp(x, 0., 1.);
}

float rect(vec2 uv, vec2 size){
    vec2 d = abs(uv) - size*.5;
    return max(d.x,d.y);
}

float rhomb(vec2 uv, vec2 size){
    vec2 d = abs(uv) / (size * .5);
    return (d.x + d.y - 1.) * .5 *(size.x * normalize(size).y);
}

float rounded_rect(vec2 uv, vec2 size, float radius){
    return length(max(abs(uv) - size*.5 + radius, 0.)) - radius;
}

float line(vec2 uv, vec2 a, vec2 b){
    vec2 d = b-a;
    vec2 p = uv-a;
    float t = saturate2(dot(p, d) / dot(d, d));
    return length(p - t*d);
}

float circle(vec2 uv, float radius){
    return length(uv) - radius;
}

float quarter_note(vec2 uv){
    return min(
        circle(uv + vec2(.0,.2), .1),
        rect  (uv - vec2(.08,.0), vec2(.04,.4)));
}

float stripes(float x, float w, float d){
    return abs(fract(x/d)-.5)*d-w*.5;
}

float xstripes(float x, float w, float d){
    return stripes(x,d-w,d);
}

void main(){
    //vec2 uv = (fragCoord - iResolution.xy*.5) / iResolution.y;
    vec2 uv = -1.0 + 1.4 *vUv + vec2(0.3, .4) ;
    float sndX = texture(iAudioData,vec2(uv.x+0.6)).x;
    float sndY = texture(iAudioData,vec2(uv.y+.3)).x;
    float vol = getVol(8.);

    float t = iAmplifiedTime - INTRO_END;
    if(t < 0.
    || iResolution.y < 400. && t < 64.*TICK_DURATION){// Trying not to ruin the surprise in the preview.
        //vec2 uv = (fragCoord - iResolution.xy*.5) / iResolution.y;
        vec2 uv = -1.0 + 2.0 *vUv ;
        uv.x += .01*sin(TAU*t/8./TICK_DURATION);
        uv.y += .01*cos(TAU*t/4./TICK_DURATION);
        uv.y -= uv.x*.3;
        uv.y *= 0.9;
        uv.x *= 0.7;
        float d = min(min(
            quarter_note(uv - vec2(-.2,.0)),
            quarter_note(uv - vec2( .1,.0))),
            rect(uv - vec2(.03,.22),vec2(.34,.15)));
        gl_FragColor = vec4(saturate2(d / fwidth(d))) * .7;
        return;
    }

#define C(r,g,b) (.04*vec3(r,g,b))
//#define BACKGROUND C(15,15,18)
#define BACKGROUND C(0,0,4)
#define WINDOW     C(18,18,21)
#define SUIT       C( 4, 4, 5)
#define SHIRT1     C( 6, 6, 5)
#define SHIRT2     C(13,13,14)
#define PANTS      C(11,10,10)
#define BELT       C( 4, 3, 3)
#define HAIR       C(17, 9, 7)
#define SKIN       C(18,12,12)
#define COLLAR     C(17,16,17)
#define MIC1       C( 9, 8, 8)
#define MIC2       C(16,15,15)
#define MIC3       C(10, 9, 9)
#define MIX(color,amount) c = mix(color, c, saturate((amount) * iResolution.y + .5))

    t = mod(t, 64.*TICK_DURATION);

    vec3 c = vec3(BACKGROUND);

    // Window
    vec2 uv2 = uv;

    uv2.x *= 6./(uv.y-6.); // perspective
    float grid = max(max(max(
        xstripes(uv2.x+.08, .03 , 1./6.25),
        xstripes(uv2.y+.06, .03 , 1./4.00)),
        xstripes(uv2.x+.04, .003, 1./37.5)),
        xstripes(uv2.y+.00, .003, 1./40.0));
    vec2 p = uv2;
    p.y = max(p.y+.1,0.);
    p /= .7;
    //MIX(WINDOW*vec3(.5-sin(10.*snd*iAmplifiedTime), snd*0.3, snd*cos(iAmplifiedTime)), max(max(
    //MIX(WINDOW*vec3(sndX/1.5, sndY/2., sndX*sndY), max(max(
    //float vol = getVol(8.);
    //MIX(WINDOW*vec3(sndX*vol, vol, sndX*sndY+vol), max(max(
    //MIX(WINDOW*vec3(sndX, sndY, (sndX+sndY)/2. ), max(max(
    MIX(WINDOW*vec3(sndX, sndY/2., sndX*sndY), max(max(
        circle(p,1.),
        -uv2.y-.3),
        grid));

    vec2 bob = uv;
    bob.x += .07*sin(TAU*t/16./TICK_DURATION);
    bob.y += .07*cos(TAU*t/ 8./TICK_DURATION) - .15;

    // Clothes (except collar and sleeves)
    MIX(SUIT, min(
    /* shoulders */ rhomb(bob + vec2(0,.15), vec2(.45,.23)),
    /* suit      */ rect (bob + vec2(0,.51), vec2(.39,.7))));
    float shirt1 = rect(bob + vec2(0,.33), vec2(.11,.36));
    float shirt2 = max(shirt1, stripes(bob.y, 0.01, 0.02));
    float suit_shadow = .7+.3*smoothstep(.5,-.5,8.*rect(bob + vec2(0,.5), vec2(.11,.7)));
    /* shirt ( dark  stripes) */ MIX(SHIRT1 * suit_shadow, shirt1);
    /* shirt (bright stripes) */ MIX(SHIRT2 * suit_shadow, shirt2);
    /* pants */ MIX(PANTS * suit_shadow, rect(bob + vec2(0,.70), vec2(.11,.30)));
    /* belt  */ MIX(BELT  * suit_shadow, rect(bob + vec2(0,.53), vec2(.11,.04)));

    // Head
    vec2 uv3 = bob + vec2(.007*cos(TAU*t/16./TICK_DURATION),0);
    float face = min(min(
    /* forehead */ rounded_rect(uv3 - vec2(0,.07), vec2(.13,.14), .02),
    /* ears     */ rounded_rect(bob - vec2(0,.03), vec2(.16,.06), .01)),
    /* chin     */ circle(uv3, .06));
    float face_shadow = 1.-.4*smoothstep(.7,-.7,8.*face);
    /* hair */ MIX(HAIR * face_shadow, rounded_rect(bob - vec2(0,.11), vec2(.18,.19), .09));
    /* neck */ MIX(SKIN * face_shadow, rounded_rect(bob + vec2(0,.06), vec2(.11,.20), .05));
    MIX(SKIN, face);
    /* collar */ MIX(COLLAR * face_shadow, max(
         rect (bob + vec2(0,.11), vec2(.115,.10)),
        -rhomb(bob + vec2(0,.05), vec2(.115,.22))));

    float elbow_x = -.01*cos(TAU*t/4./TICK_DURATION);
    float hand_x  =  .04*cos(TAU*t/4./TICK_DURATION);
    float hand_y  =  .04*cos(TAU*t/4./TICK_DURATION);
    /* upper right arm */ MIX(SUIT, line(bob, vec2(-.187,-.22), vec2(elbow_x-.20,-.41)) - .08);
    /* upper left  arm */ MIX(SUIT, line(bob, vec2( .187,-.22), vec2(elbow_x+.20,-.41)) - .08);
    /* right hand      */ MIX(SKIN, rounded_rect(bob - vec2(hand_x-.15, hand_y-.41), vec2(.09,.11), .04));
    /* left  hand      */ MIX(SKIN, rounded_rect(bob - vec2(hand_x+.15,-hand_y-.41), vec2(.09,.11), .04));

    // Mic
    MIX(MIC1,         rect(uv + vec2(0,.4 ), vec2(.0125,.8  )     ));
    MIX(MIC2, rounded_rect(uv + vec2(0,.03), vec2(.025 ,.095), .01));
    MIX(MIC3, rounded_rect(uv - vec2(0,.06), vec2(.055 ,.095), .01));

    gl_FragColor = vec4(c,1);
}