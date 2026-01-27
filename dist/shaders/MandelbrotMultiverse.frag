// https://www.shadertoy.com/view/4Xt3RX
// Created by Microfractal
// Modified by Arthur Tent and Microfractal @38c3
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;

#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;


#define GETVAL(INDEX) texelFetch(iChannel0,ivec2(INDEX,0),0).x
#define GETKEY(INDEX) (texelFetch(iChannel1,ivec2(INDEX,0),0).x>0.5)

#define KEY_UP		38
#define KEY_DOWN	40
#define KEY_LEFT	37
#define KEY_RIGHT	39
#define KEY_IN      73
#define KEY_OUT	    79

#define KEY_A       65

#define CAMERA_X	0
#define CAMERA_Y	1
#define CAMERA_Z	2

// Set to true to zoom/explore the fractal using arrow keys + I O
#define EXPLORE false

// Number of fractal copies
#define Copies 10
//#define Copies int((5.*1.*snd)+3.)


// Number of total samples (circle)
#define Samples 4

// Escape time iterations
#define Iterations 200


// HSL to RGB
vec3 HSL_to_RGB(float H, float S, float L) {
    vec3 rgb = clamp( abs(mod(H*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return L + S * (rgb-0.5)*(1.0-abs(2.0*L-1.0));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord) {

    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);

    float er = 100.0/snd;

    float x = EXPLORE ? GETVAL(CAMERA_X) : sin(iTime / 3.0) * 2.8;
    float y = EXPLORE ? GETVAL(CAMERA_Y) : cos(iTime / 3.0) * 2.0;
    float mag = EXPLORE ? exp(3.0 * GETVAL(CAMERA_Z)) / 2.0 : exp(sin(0.1 * iTime)) / 2.0;

    vec3 col;
    for (int s = 0; s < Samples; s++) {


    int m = 0;
    int n = 0;

    float sx = cos(float(s) / float(Samples) * 6.2831853071795864769) * 0.5;
    float sy = sin(float(s) / float(Samples) * 6.2831853071795864769) * 0.5;

    float px = (fragCoord.x - iResolution.x * 0.5 + sx) / iResolution.y;
    float py = (fragCoord.y - iResolution.y * 0.5 + sy) / iResolution.y;

    float cx = px * 4. / mag + x;
    float cy = py * 4./ mag + y;

    float zx = 0.0;
    float zy = 0.0;

    while (m < Copies) {

        while (n < Iterations) {

            float t1 = zx * zx - zy * zy + cx;// +FFT(n);
            zy = 2.0 * zx * zy + cy;// +FFT(n);
            zx = t1;

            if (sqrt(zx * zx + zy * zy) > er) {
                break;
            }
            n++;
        }
        if (n == Iterations) {

            px = zx;
            py = zy;

            n = 0;
            break;
        }

        // https://mathr.co.uk/web/m-exterior-coordinates.html

        cx = atan(zy, zx) / 6.2831853071795864769;
        cy = log(sqrt(zx * zx + zy * zy)) / log(er);

        cx = (cx - 0.0) * 4.0 / mag + x;
        cy = (cy - 1.5) * 4.0 / mag + y;
        zx = 0.0;
        zy = 0.0;

        m++;
    }

    float H = (sin(float(n) / 50.0 + iTime / 10.0 + px * 0.5) / 2.0 + 0.5);
    float S = pow(sin(float(n) / 10.0 + iTime / 9.0) / 2.0 + 0.5, 0.1);
    float L = n < Iterations ? pow(sin(float(n) / 5.0 + iTime / 8.0 + 2.0 * py) / 2.0 + 0.5, 3.0) : 0.0;

    col += HSL_to_RGB(H, S, L);
    }
    col /= float(Samples);
    //col=vec3(1.,0.,0.);
    fragColor = vec4(col, 1.0);
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}

