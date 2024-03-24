// https://www.shadertoy.com/view/sdSyz3
// Modified by ArthurTent
// Created by nyri0
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
#define AA 4
#define SPEED 0.5
#define PI 3.14159265
#define N_RED 1.25
#define N_PURPLE 1.45

float sq(float x) {
    return x * x;
}

// Copyright © 2013 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
vec2 grad( ivec2 z )
{
    // 2D to 1D
    int n = z.x+z.y*11111;
    // Hugo Elias hash
    n = (n<<13)^n;
    n = (n*(n*n*15731+789221)+1376312589)>>16;
    // simple random vectors
    return vec2(cos(float(n)),sin(float(n)));
}
float noise( in vec2 p )
{
    ivec2 i = ivec2(floor( p ));
    vec2 f = fract( p );
	vec2 u = f*f*(3.0-2.0*f);
    return 0.5 + 0.5*
        mix( mix( dot( grad( i+ivec2(0,0) ), f-vec2(0.0,0.0) ),
                  dot( grad( i+ivec2(1,0) ), f-vec2(1.0,0.0) ), u.x),
        mix( dot( grad( i+ivec2(0,1) ), f-vec2(0.0,1.0) ),
             dot( grad( i+ivec2(1,1) ), f-vec2(1.0,1.0) ), u.x), u.y);
}

float length_sq(vec2 x) {
    return dot(x, x);
}

float segment_df(vec2 uv, vec2 p0, vec2 p1) {
  float l2 = length_sq(p1 - p0);
  float t = clamp(dot(uv - p0, p1 - p0) / l2, 0.0, 1.0);
  vec2 projection = p0 + t * (p1 - p0);
  return distance(uv, projection);
}

// https://stackoverflow.com/a/2049593/8259873
float segment_side(vec2 p0, vec2 p1, vec2 p2)
{
    return (p0.x - p2.x) * (p1.y - p2.y) - (p1.x - p2.x) * (p0.y - p2.y);
}


bool triangle_in(vec2 uv, vec2 p0, vec2 p1, vec2 p2)
{
    float d0 = segment_side(uv, p0, p1);
    float d1 = segment_side(uv, p1, p2);
    float d2 = segment_side(uv, p2, p0);

    bool has_neg = (d0 < 0.0) || (d1 < 0.0) || (d2 < 0.0);
    bool has_pos = (d0 > 0.0) || (d1 > 0.0) || (d2 > 0.0);

    return !(has_neg && has_pos);
}

// From https://iquilezles.org/articles/smin
float smin( float a, float b )
{
    float k = 0.05;
    float h = max( k-abs(a-b), 0.0 )/k;
    return min( a, b ) - h*h*k*(1.0/4.0);
}

float triangle_sdf(vec2 uv, vec2 p0, vec2 p1, vec2 p2) {
    float p0p1 = segment_df(uv, p0, p1);
    float p1p2 = segment_df(uv, p1, p2);
    float p2p0 = segment_df(uv, p2, p0);
    return triangle_in(uv, p0, p1, p2) ? min(-smin(p0p1, smin(p1p2, p2p0)),-0.001) : min(p0p1, min(p1p2, p2p0));
}

void line_seg_inter(vec2 p0, vec2 p1, vec2 q0, vec2 q1, out vec2 inter, out float t) {
    mat2 A;
    A[0] = p1 - p0;
    A[1] = q0 - q1;
    vec2 b = q0 - p0;
    vec2 st = inverse(A) * b;
    t = st.x;
    inter = (1.0-st.y)*q0 + st.y*q1;
}

// Absolute angle between the two vectors
float angle_between(vec2 a, vec2 b) {
    return acos(dot(a, b));
}

mat2 rotation_mat(float alpha) {
    float c = cos(alpha);
    float s = sin(alpha);
    return mat2(c, s, -s, c);
}

float refraction(float n0, float theta0, float n1) {
    return asin(n0/n1*sin(theta0));
}

vec2 par_coord(vec2 uv, vec2 a, vec2 b, vec2 c, vec2 d) {
    // Change of basis to (c-a, b-a)
    mat2 change0;
    change0[0] = c-a;
    change0[1] = b-a;

    // Coordinates of uv wrt (c-a, b-a)
    vec2 uv_coord = inverse(change0) * (uv-a);

    // Coordinates of d wrt (c-a, b-a)
    vec2 d_coord = inverse(change0) * (d-a);

    // Change  coordinates so that c and d are at x=1
    uv_coord.x /= 1.0 + uv_coord.y * (d_coord.x - 1.0) / d_coord.y;

    return uv_coord;
}

float antisigmoid(float x) {
    return 0.25*(1.0-pow(2.0*(x-0.5), 3.0)) + 0.5*(1.0-x);
}

void main( ) {
    // Triangle
    const float c = 1.2;
    //float alpha = 0.2 * sin(SPEED*iTime);
    float alpha = 0.0;
    mat2 alpha_mat = rotation_mat(alpha);
    vec2 tc = vec2(0.0, 1.0);
    vec2 t0 = vec2(-c/2.0, -c/(2.0*sqrt(3.0)));
    vec2 t1 = vec2(0.0, c/sqrt(3.0));
    vec2 t2 = vec2(c/2.0, -c/(2.0*sqrt(3.0)));
    vec2 t0b = tc + alpha_mat * (t0-tc);
    vec2 t1b = tc + alpha_mat * (t1-tc);
    vec2 t2b = tc + alpha_mat * (t2-tc);
    // get some frequencies from the fft
    float speed1 = texture(iAudioData, vec2(.1, .25)).x * .1;
    float speed2 = texture(iAudioData, vec2(.3, .25)).x;
    float speed3 = texture(iAudioData, vec2(.7, .25)).x;
    float basespeed = .64 - texture(iAudioData, vec2(.9, .25)).x / 5.;

    // Incoming ray
    //float beta = radians(15.0);
    //float beta = radians(15.0 + 5.0*sin(SPEED*iTime*speed));
    float beta = radians(8.0 + 5.0*(speed1+speed2+speed3+basespeed));
    const vec2 p1 = vec2(-2.0, -0.27);
    vec2 p0 = p1 - 5.0 * vec2(1.0, tan(beta));

    // First intersection
    vec2 inter0;
    float t;
    line_seg_inter(p0, p1, t0b, t1b, inter0, t);
    float angle0 = angle_between(normalize(p1-p0), normalize(t1b-t0b));

    // First refraction
    float gamma_red = beta - PI/2.0 + angle0 + refraction(1.0, PI/2.0-angle0, N_RED);
    vec2 p2_red = inter0 + vec2(cos(gamma_red), sin(gamma_red));
    float gamma_purple = beta - PI/2.0 + angle0 + refraction(1.0, PI/2.0-angle0, N_PURPLE);
    vec2 p2_purple = inter0 + vec2(cos(gamma_purple), sin(gamma_purple));

    // Second intersections
    vec2 inter1_red;
    line_seg_inter(inter0, p2_red, t1b, t2b, inter1_red, t);
    float angle1_red = angle_between(normalize(p2_red-inter0), normalize(t2b-t1b));
    vec2 inter1_purple;
    line_seg_inter(inter0, p2_purple, t1b, t2b, inter1_purple, t);
    float angle1_purple = angle_between(normalize(p2_purple-inter0), normalize(t2b-t1b));

    // Second refractions
    float eta_red = gamma_red - (refraction(N_RED, PI/2.0 - angle1_red, 1.0) - PI/2.0 + angle1_red);
    vec2 p3_red = inter1_red + 3.0*vec2(cos(eta_red), sin(eta_red));
    float eta_purple = gamma_purple - (refraction(N_PURPLE, PI/2.0 - angle1_purple, 1.0) - PI/2.0 + angle1_purple);
    vec2 p3_purple = inter1_purple + 3.0*vec2(cos(eta_purple), sin(eta_purple));

    vec4 colSum = vec4(0);
    for(int i = 0; i < AA; i++) {
        for(int j = 0; j < AA; j++) {
            //vec2 sampleCoord = fragCoord + vec2(float(i) / float(AA), float(j) / float(AA));
            vec2 sampleCoord = vUv + vec2(float(i) / float(AA), float(j) / float(AA));

            // uv is centered and such that the vertical values are between -1
            // and 1 while preserving the aspect ratio.
            //vec2 uv = 2.0* (sampleCoord - iResolution.xy / 2.0) / iResolution.y;
            vec2 uv = 2.0* vUv - 1.0;

            const vec3 BG = vec3(0, 0, 0);
            vec3 col = BG;

            if(segment_df(uv, p0, inter0) < 0.008) col = vec3(1, 1, 1);

            float prism_intensity = 0.0; // TODO: use
            float prism_ray_sdf = triangle_sdf(uv, inter0, inter1_red, inter1_purple);
            if(prism_ray_sdf < 0.008) {
                prism_intensity = 1.0-clamp((uv.x-inter0.x)/(inter1_red.x-inter0.x), 0.0, 1.0);
            }

            float t_sdf = triangle_sdf(uv, t0b, t1b, t2b);
            if(t_sdf < 0.0 && t_sdf > -0.1) prism_intensity = max(prism_intensity, sq(smoothstep(-0.1, 0.0, t_sdf)));

            float grain = noise(200.0*uv);
            float asig = antisigmoid(prism_intensity);
            float grain_intensity = smoothstep(asig, asig+0.2, grain) * prism_intensity;
            col = mix(col, mix(vec3(0.2, 0.7, 0.8), vec3(1, 1, 1), sq(prism_intensity)), grain_intensity);

            /*
            vec2 rainbow_st = par_coord(uv, inter1_red, p3_red, inter1_purple, p3_purple);
            if(rainbow_st.y > 0.0 && rainbow_st.x > 0.0 && rainbow_st.x < 1.0) {
                if(rainbow_st.x < 1.0/6.0) col = mix(vec3(0.9, 0.1, 0.05), vec3(0.9, 0.2, 0.0), grain);
                else if(rainbow_st.x < 2.0/6.0) col = mix(vec3(0.9, 0.3, 0.0), vec3(0.95, 0.5, 0.0), grain);
                else if(rainbow_st.x < 3.0/6.0) col = mix(vec3(1.0, 0.85, 0.0), vec3(0.9, 0.75, 0.0), grain);
                else if(rainbow_st.x < 4.0/6.0) col = mix(vec3(0.35, 0.6, 0.0), vec3(0.5, 0.7, 0.0), grain);
                else if(rainbow_st.x < 5.0/6.0) col = mix(vec3(0.0, 0.6, 0.85), vec3(0.1, 0.7, 0.9), grain);
                else col = mix(vec3(0.5, 0.2, 0.5), vec3(0.55, 0.25, 0.55), grain);
            }
            */
            vec2 rainbow_st = par_coord(uv, inter1_red, p3_red, inter1_purple, p3_purple);
            if(rainbow_st.y > 0.0 && rainbow_st.x > 0.0 && rainbow_st.x < 1.0) {
                if(rainbow_st.x < 1.0/6.0) col = mix(vec3(0.9, 0.1, basespeed), vec3(0.9, 0.2, 0.0), grain);
                else if(rainbow_st.x < 2.0/6.0) col = mix(vec3(0.9, 0.3, basespeed), vec3(0.95, 0.5, 0.0), grain);
                else if(rainbow_st.x < 3.0/6.0) col = mix(vec3(1.0, 0.85, basespeed), vec3(0.9, 0.75, 0.0), grain);
                else if(rainbow_st.x < 4.0/6.0) col = mix(vec3(0.35, 0.6, basespeed), vec3(0.5, 0.7, 0.0), grain);
                else if(rainbow_st.x < 5.0/6.0) col = mix(vec3(0.0, 0.6, basespeed), vec3(0.1, 0.7, 0.9), grain);
                else col = mix(vec3(0.5, 0.2, 0.5), vec3(0.55, 0.25, basespeed), grain);
            }
            colSum += vec4(col, 1.0);
        }
    }
    gl_FragColor = colSum / colSum.w;
}