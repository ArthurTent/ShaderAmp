// https://www.shadertoy.com/view/MsGGzR
// Modified by ArthurTent
// Created by vochsel
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

//Created by Ben Skinner
//Original song: https://soundcloud.com/tycho/tycho-awake

//Setings
//#define DELUXE_COVER

/* ============ ALBUM COLORS ============ */

//#define COL_BG rgb(218,212,196)
#define COL_BG rgb(0,0,0)
#define COL_BG_DX rgb(49,54,60)

#define COL_STRIP_1 rgb(204, 110, 81)
#define COL_STRIP_2 rgb(204, 106, 95)
#define COL_STRIP_3 rgb(117, 96, 93)
#define COL_STRIP_4 rgb(202, 110, 135)
#define COL_STRIP_5 rgb(163, 98, 130)
#define COL_STRIP_6 rgb(161, 113, 152)
#define COL_STRIP_7 rgb(119, 116, 145)
#define COL_STRIP_8 rgb(51, 69, 89)

#define COL_STRIP_1_DX rgb(178, 127, 96)
#define COL_STRIP_2_DX rgb(185, 118, 102)
#define COL_STRIP_3_DX rgb(159, 110, 106)
#define COL_STRIP_4_DX rgb(177, 115, 128)
#define COL_STRIP_5_DX rgb(145, 102, 122)
#define COL_STRIP_6_DX rgb(145, 111, 138)
#define COL_STRIP_7_DX rgb(107, 103, 126)
#define COL_STRIP_8_DX rgb(71, 82, 102)

#define CIRCLE_RADIUS 0.4

/* ========== HELPER FUNCTIONS ========== */

vec3 rgb(float r, float g, float b) { return vec3(r/255.0, g/255.0, b/255.0); }
vec3 rgb(int r, int g, int b) { return vec3(float(r)/255.0, float(g)/255.0, float(b)/255.0); }
vec3 rgb(vec3 col) { return vec3(col.r/255.0, col.g/255.0, col.b/255.0); }

float musicBeat(float offset, float damper) {
    return texture(iAudioData,vec2(offset,0.0)).r / 2.0 + 0.25;
}

/* =========== MAIN FUNCTIONS =========== */

void main()
{
    vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
    //vec2 uv = (fragCoord.xy / iResolution.xy) * aspect;
    vec2 uv = vUv* aspect;

    vec2 midpoint = vec2(0.5, 0.5) * aspect;

    vec3 col = COL_BG;

    float flashDiffuse = 0.15;
    float colorDiffuse = 0.5;
    float colorOffset = 0.3;

    vec3 stripeCol = COL_BG;
    float circle_top = midpoint.y + CIRCLE_RADIUS;
    float col_multiplier = 2.6;

    float circle_beat = musicBeat(0.0, flashDiffuse);
    float stripe_height;

    float r = CIRCLE_RADIUS;

    vec3 str1_col = COL_STRIP_1;
    vec3 str2_col = COL_STRIP_2;
    vec3 str3_col = COL_STRIP_3;
    vec3 str4_col = COL_STRIP_4;
    vec3 str5_col = COL_STRIP_5;
    vec3 str6_col = COL_STRIP_6;
    vec3 str7_col = COL_STRIP_7;
    vec3 str8_col = COL_STRIP_8;

    #ifdef DELUXE_COVER
    str1_col = COL_STRIP_1_DX;
    str2_col = COL_STRIP_2_DX;
    str3_col = COL_STRIP_3_DX;
    str4_col = COL_STRIP_4_DX;
    str5_col = COL_STRIP_5_DX;
    str6_col = COL_STRIP_6_DX;
    str7_col = COL_STRIP_7_DX;
    str8_col = COL_STRIP_8_DX;
    col = COL_BG_DX;
    #endif

    //Stripe 1
    stripe_height = (r * 2.0) * 0.1523;
    if(uv.y > circle_top - stripe_height) {
		circle_beat = musicBeat(0.1, flashDiffuse);
       	stripeCol = str1_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }
    //Stripe 2
    circle_top -= stripe_height;
    stripe_height = (r * 2.0) * 0.1403257143;
    if(uv.y > circle_top - stripe_height && uv.y < circle_top) {
        circle_beat = musicBeat(0.2, flashDiffuse);
       	stripeCol = str2_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }
    //Stripe 3
    circle_top -= stripe_height;
    stripe_height = (r * 2.0) * 0.1293114286;
    if(uv.y > circle_top - stripe_height && uv.y < circle_top) {
        circle_beat = musicBeat(0.3, flashDiffuse);
       	stripeCol = str3_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }
    //Stripe 4
    circle_top -= stripe_height;
    stripe_height = (r * 2.0) * 0.09482857143;
    if(uv.y > circle_top - stripe_height && uv.y < circle_top) {
        circle_beat = musicBeat(0.4, flashDiffuse);
       	stripeCol = str4_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }
    //Stripe 5
    circle_top -= stripe_height;
    stripe_height = (r * 2.0) * 0.1068;
    if(uv.y > circle_top - stripe_height && uv.y < circle_top) {
        circle_beat = musicBeat(0.5, flashDiffuse);
       	stripeCol = str5_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }
    //Stripe 6
    circle_top -= stripe_height;
    stripe_height = (r * 2.0) * 0.09147428571;
    if(uv.y > circle_top - stripe_height && uv.y < circle_top) {
        circle_beat = musicBeat(0.55, flashDiffuse);
       	stripeCol = str6_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }
    //Stripe 7
    circle_top -= stripe_height;
    stripe_height = (r * 2.0) * 0.1005742857;
    if(uv.y > circle_top - stripe_height && uv.y < circle_top) {
       	circle_beat = musicBeat(0.1, flashDiffuse);
       	stripeCol = str7_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }
    //Stripe 8
    circle_top -= stripe_height;
    stripe_height = (r * 2.0) * 0.1843857143;
    if(uv.y < circle_top) {
        circle_beat = musicBeat(0.05, flashDiffuse);
       stripeCol = str8_col * ((circle_beat * colorDiffuse) + colorOffset) * col_multiplier;
    }

	float dist = length(uv.xy - midpoint);
	r += (circle_beat / 8.0) - 0.1;
    float amt = smoothstep(r - 0.001, r + 0.001, dist);


    col = mix(col, stripeCol, 1.0-amt);

    //col = mix(col, vec3(texture(iChannel0, uv * 1.4 * (iResolution.x / 400.0)).r), 0.075);
    //col = mix(col, vec3(texture(iChannel0, uv * 1.4 * (iResolution.x )).r), 0.075);

    gl_FragColor = vec4(col,1.0);
}

// Extra Knowledge

/*Heights
1 - 0.1523
2 - 0.1403257143
3 - 0.1293114286
4 - 0.09482857143
5 - 0.1068
6 - 0.09147428571
7 - 0.1005742857
8 - 0.1843857143
*/
