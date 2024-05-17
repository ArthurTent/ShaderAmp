// https://www.shadertoy.com/view/Mt2GWt
// Modified by ArthurTent
// Created by pixelbeast
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/
// Iain Melvin - added FFT_IZE
// Created by David Bargo - davidbargo/2015
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
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
#define PI 3.14159265359
#define E  2.71828182845

// a lovely function that goes up and down periodically between 0 and 1, pausing at the extremes
float pausingWave(float x, float a, float b) { //    ___          ___          ___
    x = abs(fract(x) - .25) * 1. - .5 + a;      //   /   \        /   \        /   \
    //return 0.01;
    return smoothstep(0., a - b, x);
}

// Uncomment to see original functions
#define FFT_IZE

vec2 sinz(vec2 c)
{
    float a = pow(E, c.y);
    float b = pow(E,-c.y);
    return vec2(sin(c.x)*(a + b)*0.5, cos(c.x)*(a - b)*0.5);
}

vec2 cosz(vec2 c)
{
    float a = pow(E, c.y);
    float b = pow(E,-c.y);
    return vec2(cos(c.x)*(a + b)*0.5, -sin(c.x)*(a - b)*0.5);
}

vec2 tanz(vec2 c)
{
    float a = pow(E, c.y);
    float b = pow(E,-c.y);
    float cosx = cos(c.x);
    float sinhy = (a - b)*0.5;
    return vec2(sin(c.x)*cosx, sinhy*(a + b)*0.5)/(cosx*cosx + sinhy*sinhy);
}

vec2 logz(vec2 c)
{
    return vec2(log(sqrt(dot(c, c))), atan(c.y, c.x));
}

vec2 sqrtz(vec2 c)
{
    float n = c.x + sqrt(dot(c, c));
    return vec2(n, c.y)/sqrt(2.0*n);
}

vec2 exp2z(vec2 c)
{
	return vec2(c.x*c.x - c.y*c.y, 2.*c.x*c.y);
}

vec2 epowz(vec2 c)
{
	return vec2(cos(c.y), sin(c.y))*pow(E, c.x);
}

vec2 mulz(vec2 c1, vec2 c2)
{
    return c1*mat2(c2.x, -c2.y, c2.y, c2.x);
}

vec2 divz(vec2 n, vec2 d)
{
    return n*mat2(d.x, d.y, -d.y, d.x)/dot(d, d);
}

vec2 invz(vec2 c)
{
	return vec2(c.x, -c.y)/dot(c, c);
}

vec2 func(float cellID, vec2 c)
{
    vec2 fz = c;
    if (cellID == 0.)       fz = c;
    else if (cellID == 1.)  fz = sinz(c);
   	else if (cellID == 2.)  fz = sqrtz(divz(logz(vec2(-c.y - 6.0, c.x)), logz(vec2(-c.y + 2.0, c.x))));
   	else if (cellID == 3.)  fz = epowz(c);
   	else if (cellID == 4.)  fz = tanz(tanz(c));
   	else if (cellID == 5.)  fz = tanz(sinz(c));
   	else if (cellID == 6.)  fz = sqrtz(vec2(1.0 + c.x, c.y)) + sqrtz(vec2(1.0 - c.x, -c.y));
   	else if (cellID == 7.)  fz = divz(tanz(exp2z(c)), c);
   	else if (cellID == 8.)  fz = sinz(cosz(sinz(c)));
   	else if (cellID == 9.)  fz = invz(vec2(1.0, 0.0) + epowz(vec2(c.y, c.x)));
   	else if (cellID == 10.) fz = epowz(invz(sqrtz(-c)));
   	else if (cellID == 11.) fz = exp2z(invz(c));
   	else if (cellID == 12.) fz = epowz(sinz(epowz(cosz(c))));
    else if (cellID == 13.) fz = divz(sinz(c), c);
   	else if (cellID == 14.) fz = exp2z(c);
   	else if (cellID == 15.) fz = divz(sinz(c), cosz(exp2z(c)));
    else if (cellID == 16.) fz = invz(c + vec2(1.0, 0.0)) + invz(c - vec2(1.0, 0.0));
    else if (cellID == 17.) fz = logz(c - invz(c));
   	else if (cellID == 18.) fz = divz(sqrtz(vec2(c.x + 1.0, c.y)), sqrtz(vec2(c.x - 1.0, c.y)));
   	else if (cellID == 19.) fz = invz(vec2(1.0, 0.0) + mulz(c, exp2z(exp2z(c))));

    return fz;
}

vec2 animate(vec2 v)
{
	float s = sin(iTime);
    float c = cos(iTime);
    return v*mat2(c, -s, s, c);
}

// iq's smooth hsv to rgb
vec3 hsv2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
	rgb = rgb*rgb*(3.0-2.0*rgb);
	return c.z * mix( vec3(1.0), rgb, c.y);
}


vec2 gridSize = vec2(5.,4.);

vec3 getCell(vec2 s, vec2 h)
{
    float cx = floor(h.x*gridSize.x/s.x);
    float cy = floor(h.y*gridSize.y/s.y);
    return vec3(cx, cy, (gridSize.y - 1.0 - cy)*gridSize.x + cx);
}

vec3 getSmallCells(vec2 s, vec2 h)
{
    vec3 c = getCell(s, h);
    vec2 size = s/gridSize;
    float ratio = size.x/size.y;
    vec2 uv = PI*((2.*h-size)/size.y - 2.*vec2(c.x*ratio,c.y));
    return vec3(c.z, uv);
}

void main()
{
    vec2 res = iResolution.xy;
    vec2 coord = vUv*res;

    //vec3 cell = getSmallCells(res, coord);
    vec3 cell = vec3(0., PI*(2.*coord-res)/(res.x));
    //vec3 cell = vec3(0.0, PI*(2.*coord-res)/(res.x));

   //quick attempt to cycle through the animations
    float cell0= 0.0;
    float cell1= 0.0;
    float cell2= 0.0;
    float cell3= 0.0;
    float cell4= 0.0;
    float cell5= 0.0;
    float cell6= 0.0;
    float cell7= 0.0;
    float cell8= 0.0;
    float cell9= 0.0;
    float cell10= 0.0;
    float speed = .25 / 10.5;
    // still quick attempt to cycle through the animations
    //float time = mod(iTime, 290.);
    float time = mod(iTime, 290.);
    time -= 10.5;
    if (time > 167.) time -= 167.;
    else if (time > 63.) time -= 63.;
    time -= 5.25;
	time *= speed;
    cell0 = pausingWave(time, .15, .125);
    cell1 = pausingWave(time - .125 / .1, .15, .125);;
    cell2 = pausingWave(time - .25 / .1, .15, .125);
    cell3 = pausingWave(time-0.375/0.1, .15, .125);
    cell4 = pausingWave(time-0.5/0.1, .15, .125);
    cell5 = pausingWave(time-0.625/0.1, .15, .125);
    cell6 = pausingWave(time-.75/0.1, .15, .125);
    cell7 = pausingWave(time-.875/0.1, .15, .125);
    cell8 = pausingWave(time-.1/0.1, .15, .125);
    cell9 = pausingWave(time-1.125/0.1, .15, .125);
    cell10 = pausingWave(time-1.25/0.1, .15, .125);

    // still quick attempt to cycle through the animations
    // but it only cycles through 4 animations :-/
    // should try again with a fresh brain
    if(cell0 >0.0){
        //cell = getSmallCells(res, coord);
        //cell = vec3(getCell(res, vec2(0.0, 0.8)).z, PI*(2.*coord-res)/(res.y)); //full screen of one cell
        cell = vec3(0.0, PI*(2.*coord-res)/(res.y));
    }
    if(cell1 >0.0){
        cell = vec3(1.0, PI*(2.*coord-res)/(res.y));
        //cell = vec3(14.0, PI*(2.*coord-res)/(res.y));
    }
    if(cell2 > 0.0) {
        cell = vec3(2.0, PI*(2.*coord-res)/(res.y));
        //cell = vec3(11.0, PI*(2.*coord-res)/(res.y));
    }
    if(cell3 > 0.0) {
        cell = vec3(3.0, PI*(2.*coord-res)/(res.y));
        //cell = vec3(7.0, PI*(2.*coord-res)/(res.y));
        //cell = getSmallCells(res, coord);
    }
    if(cell4 > 0.0) {
        cell = vec3(4.0, PI*(2.*coord-res)/(res.y));
        //cell = getSmallCells(res, coord);
    }
    if(cell5 > 0.0) {
        cell = vec3(5.0, PI*(2.*coord-res)/(res.y));
    }
    if(cell6 > 0.0) {
        cell = vec3(6.0, PI*(2.*coord-res)/(res.y));
    }
    if(cell7 > 0.0) {
        cell = vec3(7.0, PI*(2.*coord-res)/(res.y));
    }
    if(cell8 > 0.0) {
        cell = vec3(8.0, PI*(2.*coord-res)/(res.y));
        cell = getSmallCells(res, coord);
    }
    if(cell9 > 0.0) {
        //cell = vec3(9.0, PI*(2.*coord-res)/(res.y));
        cell = vec3(0.0, PI*(2.*coord-res)/(res.y));
    }
    if(cell10 > 0.0) {
        cell = vec3(10.0, PI*(2.*coord-res)/(res.y));
    }
    vec2 z = animate(func(cell.x, cell.yz))*2.0;

#ifdef FFT_IZE

    gl_FragColor = texture(iAudioData, z*0.25);

    float wav_or_fft=0.25;
    float a = texture( iAudioData, vec2(abs(z.x)*0.1,wav_or_fft) )[0];
    float b = texture( iAudioData, vec2(abs(z.y)*0.1,wav_or_fft) )[0];
    float hue = a*b;

    float sat = 1.0;

    vec2 r = abs(fract(vec2(a,b)) - 0.5) - 0.25;
    r = step(0.0, r)*r*4.0;
    r = 1. - r*r*r*r;
    float val = mix(1.0, r.x*r.y, sat*0.5);

	gl_FragColor = vec4(hsv2rgb(vec3(hue,sat,val)),1.0);
#else

    float hue = atan(z.y,z.x)/(2.0*PI);

    float l = length(z);
    float sat = abs(fract(l)-0.5)-0.25;
    sat = step(0.0, sat)*sat*4.0;
    sat = 1. - sat*sat;

    vec2 r = abs(fract(z) - 0.5) - 0.25;
    r = step(0.0, r)*r*4.0;
    r = 1. - r*r*r*r;
    float val = mix(1.0, r.x*r.y, sat*0.5);

	gl_FragColor = vec4(hsv2rgb(vec3(hue,sat,val)),1.0);
#endif
}