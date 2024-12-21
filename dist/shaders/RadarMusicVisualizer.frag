// https://www.shadertoy.com/view/Ml2cDK
// Modified by ArthurTent
// Created by laserdog
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
const float TAU = 6.28318530718;
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
float snd = 0.;
const float PI = 3.1415926;

// MIT Licensed hash From Dave_Hoskins (https://www.shadertoy.com/view/4djSRW)
vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

vec3 stars(in vec3 p)
{
    vec3 c = vec3(0.);
    float res = iResolution.x*0.8;
    
	for (float i=0.;i<4.;i++)
    {
        vec3 q = fract(p*(.15*res))-0.5;
        //q*= snd/10.;
        vec3 id = floor(p*(.15*res));
        vec2 rn = hash33(id).xy;
        float c2 = 1.-smoothstep(0.,.6,length(q));
        c2 *= step(rn.x,.0005+i*i*0.001);
        c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.25+0.75);
        p *= 1.4;
    }
    return c*c*.65;
}
void camera(vec2 fragCoord, out vec3 ro, out vec3 rd, out mat3 t)
{
    float a = 1.0/max(iResolution.x, iResolution.y);
    //rd = normalize(vec3((fragCoord - iResolution.xy*0.5)*a, 0.5));
    rd = normalize(vec3(fragCoord, 1.0));

    ro = vec3(0.0, 0.0, -15.);

    //float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y));
    float ff = min(1.0, step(0.001, iMouse.x) + step(0.001, iMouse.y))+sin(iTime/20.);
    vec2 m = PI*ff + vec2(((iMouse.xy + 0.1) / iResolution.xy) * (PI*2.0));
    //m.y = -m.y;
    m.y = sin(m.y*0.5)*0.3 + 0.5;

    //vec2 sm = sin(m)*sin(iTime), cm = cos(m)*(1.+sin(iTime));
    vec2 sm = sin(m)*(1.+sin(iTime/10.)/2.), cm = cos(m);
    mat3 rotX = mat3(1.0, 0.0, 0.0, 0.0, cm.y, sm.y, 0.0, -sm.y, cm.y);
    mat3 rotY = mat3(cm.x, 0.0, -sm.x, 0.0, 1.0, 0.0, sm.x, 0.0, cm.x);

    t = rotY * rotX;

    ro = t * ro;
    rd = t * rd;

    rd = normalize(rd);
}

void main( )
{
    int max_freq = 100;
    for(int i=1; i < max_freq; i++){
        snd +=FFT(i)*float(i);
    }
    snd /=float(max_freq*20);
    vec2 cam_uv = -1.0 + 2.0 *vUv;
    
	//camera + rd for stars
    vec3 ro = vec3(0.0);//rd = vec3( 0.0 );
	vec3 rd = normalize(vec3(cam_uv,-1.5));
    mat3 t = mat3(1.0);
	camera(cam_uv, ro, rd, t);
    vec2 points[15];
    points[0] = vec2(.1, .1);
    points[1] = vec2(.15, -.2);
    points[2] = vec2(-.3, .05);
    points[3] = vec2(-.25, -.1);
    points[4] = vec2(-.12, .23);
    points[5] = vec2(.3, .28);
    points[6] = vec2(.11, .35);
    points[7] = vec2(.4, -.4);
    points[8] = vec2(-.223, .3);
    points[9] = vec2(.4, -.18);
    points[10] = vec2(.32, -.1);
    points[11] = vec2(.2, -.32);
    points[12] = vec2(-.13, .15);
    points[13] = vec2(-.102, -.17);
    points[14] = vec2(-.25, -.31);

	//vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uv = vUv;
    //vec2 uv = -1.0 + 3.0 *vUv ;
    uv -= .5;
    uv.x *= iResolution.x / iResolution.y;
    float dist = length(uv);

    float speed = .75;
    float angle = mod(-iTime * speed, 2. * PI);
    float clippedGreen = 0.;

    // draw outer ring
    float containerRadius = .475;
    float clipToRadius = clamp(floor(containerRadius / dist), 0., 1.);
    float containerThickness = max(.01, .275 * (pow(clamp(texture(iAudioData, abs(uv)).r, .1, 2.), 4.)
                                   + pow(clamp(texture(iAudioData, abs(vec2(uv.y, uv.x))).r, .1, 2.), 4.)));
    float container = smoothstep(containerRadius + containerThickness / 2., containerRadius, dist)
        * smoothstep(containerRadius - containerThickness / 2., containerRadius, dist);

    // draw blips
    float blipSpeed = .075;
    float ringThickness = .01;
    for (int x = 0; x < 15; x++) {
    	float blipDist = distance(uv, points[x]);

    	float blipAngle = mod(atan(points[x].y, points[x].x) + PI * 2., PI * 2.) - PI / 3.;
    	float angleDiff = mod(angle - blipAngle, 2. * PI);

    	float blipRadius = (1. - angleDiff) * blipSpeed;

    	float addend = smoothstep(blipRadius, blipRadius - ringThickness / 2., blipDist)
        	* pow(smoothstep(0., blipRadius - ringThickness / 2., blipDist), 3.);
        clippedGreen += max(0., mix(addend, 0., blipRadius / blipSpeed));
    }

    // draw line from center
    float lineThickness = .015;
    vec2 line = normalize(vec2(cos(angle), sin(angle)));
    float multiply = clamp(sign(dot(uv, line)), 0., 1.);
    float distFromLine = sqrt(pow(dist, 2.) - pow(dot(uv, line), 2.));
    clippedGreen += pow(smoothstep(lineThickness / 2., 0., distFromLine), 3.) * multiply;

    // draw grid
    float gridIncrement = .1;
    float gridLineThickness = 1. /iResolution.y;
    float gridAddend = (1. - step(gridLineThickness, mod(uv.x, gridIncrement)))
        + (1. - step(gridLineThickness, mod(uv.y, gridIncrement)));
    clippedGreen += gridAddend;

    // draw gradient
    float gradientAngleAmount = PI / 2.;
    float uvAngle = mod(atan(uv.y, uv.x) + PI * 2., PI * 2.);
    float angleDiff = mod(uvAngle - angle, 2. * PI);
    clippedGreen += smoothstep(gradientAngleAmount, 0., angleDiff);

    // why doesn't changing the alpha value do anything?
    // color.a = 0.;
    uv.x /= iResolution.x / iResolution.y;
    uv += .5;
    //vec4 color = texture(iChannel1, uv);
    //color.g += clippedGreen * clipToRadius + container;
    //gl_FragColor = color;
    gl_FragColor = vec4(0., clippedGreen * clipToRadius + container, 0., 1.);
    rd.x+=sin(iTime/1000.)*2.;
	vec3 bg = stars(rd)*(1.+30.*snd);
	gl_FragColor+=vec4(bg, 1.);
}
