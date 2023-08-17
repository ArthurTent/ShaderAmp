// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var PsychedelicEye_frag =
"// https://www.shadertoy.com/view/fllSD8\n"+
"// Psychedelic Eye by mrange\n"+
"// License CC0\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform sampler2D iVideo;\n"+
"\n"+
"varying vec2 vUv;\n"+
"\n"+
"// License CC0: Psychedelic eye\n"+
"//  Continuation of weekend experiment\n"+
"\n"+
"#define PI            3.141592654\n"+
"#define TAU           (2.0*PI)\n"+
"#define TIME          iGlobalTime\n"+
"#define TTIME         (TAU*TIME)\n"+
"#define RESOLUTION    iResolution\n"+
"#define ROT(a)        mat2(cos(a), sin(a), -sin(a), cos(a))\n"+
"#define PCOS(x)       (0.5 + 0.5*cos(x))\n"+
"#define DOT2(x)       dot(x, x)\n"+
"#define BPERIOD       5.6\n"+
"#define MPERIOD       7.2\n"+
"#define FLIP          10.0\n"+
"\n"+
"const vec2 iris_center = vec2(0.0, 0.28);\n"+
"\n"+
"// https://stackoverflow.com/questions/15095909/from-rgb-to-hsv-in-opengl-glsl\n"+
"const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n"+
"vec3 hsv2rgb(vec3 c) {\n"+
"vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);\n"+
"return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);\n"+
"}\n"+
"// Macro version of above to enable compile-time constants\n"+
"#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))\n"+
"\n"+
"const vec3  grid_color    = HSV2RGB(vec3(0.6, 0.3, 1.0));\n"+
"const vec3  light0_color  = 16.0*HSV2RGB(vec3(0.6, 0.5, 1.0));\n"+
"const vec3  light1_color  = 8.0*HSV2RGB(vec3(0.9, 0.25, 1.0));\n"+
"const vec3  sky0_color    = HSV2RGB(vec3(0.05, 0.65, -0.25));\n"+
"const vec3  sky1_color    = HSV2RGB(vec3(0.6, 0.5, 0.25));\n"+
"const vec3  light0_pos    = vec3(1.0, 5.0, 4.0);\n"+
"const vec3  light1_pos    = vec3(3.0, -1.0, -8.0);\n"+
"const vec3  light0_dir    = normalize(light0_pos);\n"+
"const vec3  light1_dir    = normalize(light1_pos);\n"+
"const vec4  planet_sph    = vec4(50.0*normalize(light1_dir+vec3(0.025, -0.025, 0.0)), 10.0);\n"+
"\n"+
"int   g_eff = 0;\n"+
"\n"+
"float g_hf;\n"+
"\n"+
"vec2 g_vx = vec2(0.0);\n"+
"vec2 g_vy = vec2(0.0);\n"+
"\n"+
"vec2 g_wx = vec2(0.0);\n"+
"vec2 g_wy = vec2(0.0);\n"+
"\n"+
"\n"+
"vec4 alphaBlend(vec4 back, vec4 front) {\n"+
"float w = front.w + back.w*(1.0-front.w);\n"+
"vec3 xyz = (front.xyz*front.w + back.xyz*back.w*(1.0-front.w))/w;\n"+
"return w > 0.0 ? vec4(xyz, w) : vec4(0.0);\n"+
"}\n"+
"\n"+
"vec3 alphaBlend(vec3 back, vec4 front) {\n"+
"return mix(back, front.xyz, front.w);\n"+
"}\n"+
"\n"+
"vec3 postProcess(vec3 col, vec2 q) {\n"+
"col = clamp(col, 0.0, 1.0);\n"+
"col = pow(col, vec3(1.0/2.2));\n"+
"col = col*0.6+0.4*col*col*(3.0-2.0*col);\n"+
"col = mix(col, vec3(dot(col, vec3(0.33))), -0.4);\n"+
"//col *=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);\n"+
"return col;\n"+
"}\n"+
"\n"+
"float circle(vec2 p, float r) {\n"+
"return length(p) - r;\n"+
"}\n"+
"\n"+
"// Based on: https://iquilezles.org/articles/distfunctions2d\n"+
"float vesica(vec2 p, vec2 sz) {\n"+
"if (sz.x < sz.y) {\n"+
"sz = sz.yx;\n"+
"} else {\n"+
"p  = p.yx;\n"+
"}\n"+
"vec2 sz2 = sz*sz;\n"+
"float d  = (sz2.x-sz2.y)/(2.0*sz.y);\n"+
"float r  = sqrt(sz2.x+d*d);\n"+
"float b  = sz.x;\n"+
"p = abs(p);\n"+
"return ((p.y-b)*d>p.x*b) ? length(p-vec2(0.0,b))\n"+
": length(p-vec2(-d,0.0))-r;\n"+
"}\n"+
"\n"+
"// IQ's box\n"+
"float box(vec2 p, vec2 b) {\n"+
"vec2 d = abs(p)-b;\n"+
"return length(max(d,0.0)) + min(max(d.x,d.y),0.0);\n"+
"}\n"+
"\n"+
"float eye_shape(vec2 p) {\n"+
"float a  = mix(0.0, 1.0, smoothstep(0.995, 1.0, cos(TTIME/BPERIOD)));\n"+
"const float w = 1.14;\n"+
"float h = mix(0.48, 0.05, a);\n"+
"float d0 =  vesica(p, vec2(w, h));\n"+
"return d0;\n"+
"}\n"+
"\n"+
"// IQ's ray sphere intersect: https://iquilezles.org/articles/intersectors\n"+
"vec2 raySphere(vec3 ro, vec3 rd, vec4 sph) {\n"+
"vec3 oc = ro - sph.xyz;\n"+
"float b = dot( oc, rd );\n"+
"float c = dot( oc, oc ) - sph.w*sph.w;\n"+
"float h = b*b - c;\n"+
"if (h < 0.0) return vec2(-1.0);\n"+
"h = sqrt(h);\n"+
"return vec2(-b - h, -b + h);\n"+
"}\n"+
"\n"+
"// IQ's ray plane intersect: https://iquilezles.org/articles/intersectors\n"+
"float rayPlane(vec3 ro, vec3 rd, vec4 p) {\n"+
"return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);\n"+
"}\n"+
"\n"+
"float tanh_approx(float x) {\n"+
"//  return tanh(x);\n"+
"float x2 = x*x;\n"+
"return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);\n"+
"}\n"+
"\n"+
"vec2 toPolar(vec2 p) {\n"+
"return vec2(length(p), atan(p.y, p.x));\n"+
"}\n"+
"\n"+
"vec2 toRect(vec2 p) {\n"+
"return p.x*vec2(cos(p.y), sin(p.y));\n"+
"}\n"+
"\n"+
"vec3 toSpherical(vec3 p) {\n"+
"float r   = length(p);\n"+
"float t   = acos(p.z/r);\n"+
"float ph  = atan(p.y, p.x);\n"+
"return vec3(r, t, ph);\n"+
"}\n"+
"\n"+
"vec3 toRect(vec3 p) {\n"+
"return p.x*vec3(cos(p.z)*sin(p.y), sin(p.z)*sin(p.y), cos(p.y));\n"+
"}\n"+
"\n"+
"// https://mercury.sexy/hg_sdf/\n"+
"float mod1(inout float p, float size) {\n"+
"float halfsize = size*0.5;\n"+
"float c = floor((p + halfsize)/size);\n"+
"p = mod(p + halfsize, size) - halfsize;\n"+
"return c;\n"+
"}\n"+
"\n"+
"// https://mercury.sexy/hg_sdf/\n"+
"vec2 mod2(inout vec2 p, vec2 size) {\n"+
"vec2 c = floor((p + size*0.5)/size);\n"+
"p = mod(p + size*0.5,size) - size*0.5;\n"+
"return c;\n"+
"}\n"+
"\n"+
"// https://iquilezles.org/articles/smin\n"+
"float pmin(float a, float b, float k) {\n"+
"float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );\n"+
"return mix( b, a, h ) - k*h*(1.0-h);\n"+
"}\n"+
"\n"+
"float pmax(float a, float b, float k) {\n"+
"return -pmin(-a, -b, k);\n"+
"}\n"+
"\n"+
"float pabs(float a, float k) {\n"+
"return -pmin(-a, a, k);\n"+
"}\n"+
"\n"+
"float noise(vec2 p) {\n"+
"float a = sin(p.x);\n"+
"float b = sin(p.y);\n"+
"float c = 0.5 + 0.5*cos(p.x + p.y);\n"+
"float d = mix(a, b, c);\n"+
"return d;\n"+
"}\n"+
"\n"+
"// https://iquilezles.org/articles/fbm\n"+
"float fbm(vec2 p, float aa) {\n"+
"const mat2 frot = mat2(0.80, 0.60, -0.60, 0.80);\n"+
"\n"+
"float f = 0.0;\n"+
"float a = 1.0;\n"+
"float s = 0.0;\n"+
"float m = 2.0;\n"+
"for (int x = 0; x < 4; ++x) {\n"+
"f += a*noise(p);\n"+
"p = frot*p*m;\n"+
"m += 0.01;\n"+
"s += a;\n"+
"a *= aa;\n"+
"}\n"+
"return f/s;\n"+
"}\n"+
"\n"+
"// https://iquilezles.org/articles/warp\n"+
"float warp(vec2 p, out vec2 v, out vec2 w) {\n"+
"const float r  = 0.5;\n"+
"const float rr = 0.25;\n"+
"float l2 = length(p);\n"+
"float f  = 1.0;\n"+
"\n"+
"switch (g_eff) {\n"+
"case 0:\n"+
"//    f = smoothstep(r, r+rr, l2);\n"+
"f = smoothstep(-0.1, 0.15, eye_shape(p));\n"+
"p.y += TIME*0.125;\n"+
"p.x = pabs(p.x, 0.1);\n"+
"break;\n"+
"case 1:\n"+
"const float z = 0.75;\n"+
"f = smoothstep(-0.05, 0.1, eye_shape(p.yx/z)*z);\n"+
"f = smoothstep(r, r+rr, l2);\n"+
"p = -p.yx;\n"+
"p = toPolar(p);\n"+
"//    f = smoothstep(r, r+rr, l2);\n"+
"p.y -= -0.125*TIME+p.x*1.25;\n"+
"break;\n"+
"default:\n"+
"break;\n"+
"}\n"+
"\n"+
"g_hf = f;\n"+
"vec2 pp = p;\n"+
"\n"+
"vec2 vx = g_vx;\n"+
"vec2 vy = g_vy;\n"+
"\n"+
"vec2 wx = g_wx;\n"+
"vec2 wy = g_wy;\n"+
"\n"+
"\n"+
"//float aa = mix(0.95, 0.25, tanh_approx(pp.x));\n"+
"float aa = 0.5;\n"+
"\n"+
"v = vec2(fbm(p + vx, aa), fbm(p + vy, aa))*f;\n"+
"w = vec2(fbm(p + 3.0*v + wx, aa), fbm(p + 3.0*v + wy, aa))*f;\n"+
"\n"+
"return -tanh_approx(fbm(p + 2.25*w, aa)*f);\n"+
"}\n"+
"\n"+
"vec3 normal(vec2 p) {\n"+
"vec2 v;\n"+
"vec2 w;\n"+
"vec2 e = vec2(4.0/RESOLUTION.y, 0);\n"+
"\n"+
"vec3 n;\n"+
"n.x = warp(p + e.xy, v, w) - warp(p - e.xy, v, w);\n"+
"n.y = 2.0*e.x;\n"+
"n.z = warp(p + e.yx, v, w) - warp(p - e.yx, v, w);\n"+
"\n"+
"return normalize(n);\n"+
"}\n"+
"\n"+
"void compute_globals() {\n"+
"vec2 vx = vec2(0.0, 0.0);\n"+
"vec2 vy = vec2(3.2, 1.3);\n"+
"\n"+
"vec2 wx = vec2(1.7, 9.2);\n"+
"vec2 wy = vec2(8.3, 2.8);\n"+
"\n"+
"vx *= ROT(TTIME/1000.0);\n"+
"vy *= ROT(TTIME/900.0);\n"+
"\n"+
"wx *= ROT(TTIME/800.0);\n"+
"wy *= ROT(TTIME/700.0);\n"+
"\n"+
"g_vx = vx;\n"+
"g_vy = vy;\n"+
"\n"+
"g_wx = wx;\n"+
"g_wy = wy;\n"+
"}\n"+
"\n"+
"vec3 iris(vec2 p) {\n"+
"const vec3 up  = vec3(0.0, 1.0, 0.0);\n"+
"const vec3 lp1 = 1.0*vec3(1.0, 1.25, 1.0);\n"+
"const vec3 lp2 = 1.0*vec3(-1.0, 2.5, 1.0);\n"+
"\n"+
"vec3 ro = vec3(0.0, 10.0, 0.0);\n"+
"vec3 pp = vec3(p.x, 0.0, p.y);\n"+
"\n"+
"vec2 v;\n"+
"vec2 w;\n"+
"\n"+
"float h  = warp(p, v, w);\n"+
"float hf = g_hf;\n"+
"vec3  n  = normal(p);\n"+
"\n"+
"vec3 lcol1 = hsv2rgb(vec3(0.7, 0.5, 1.0));\n"+
"vec3 lcol2 = hsv2rgb(vec3(0.4, 0.5, 1.0));\n"+
"vec3 po  = vec3(p.x, 0.0, p.y);\n"+
"vec3 rd  = normalize(po - ro);\n"+
"\n"+
"vec3 ld1 = normalize(lp1 - po);\n"+
"vec3 ld2 = normalize(lp2 - po);\n"+
"\n"+
"float diff1 = max(dot(n, ld1), 0.0);\n"+
"float diff2 = max(dot(n, ld2), 0.0);\n"+
"\n"+
"vec3  ref   = reflect(rd, n);\n"+
"float ref1  = max(dot(ref, ld1), 0.0);\n"+
"float ref2  = max(dot(ref, ld2), 0.0);\n"+
"\n"+
"const vec3 col1 = vec3(0.1, 0.7, 0.8).xzy;\n"+
"const vec3 col2 = vec3(0.7, 0.3, 0.5).zyx;\n"+
"\n"+
"float a = length(p);\n"+
"vec3 col = vec3(0.0);\n"+
"//  col += hsv2rgb(vec3(fract(0.3*TIME+0.25*a+0.5*v.x), 0.85, abs(tanh_approx(v.y))));\n"+
"//  col += hsv2rgb(vec3(fract(-0.5*TIME+0.25*a+0.125*w.x), 0.85, abs(tanh_approx(w.y))));\n"+
"col += hsv2rgb(vec3(fract(-0.1*TIME+0.125*a+0.5*v.x+0.125*w.x), abs(0.5+tanh_approx(v.y*w.y)), tanh_approx(0.1+abs(v.y-w.y))));\n"+
"//  col += (length(v)*col1 + length(w)*col2*1.0);\n"+
"//  col += diff1;\n"+
"//  col += diff2;\n"+
"//  col *= 0.0;\n"+
"col += 0.5*lcol1*pow(ref1, 20.0);\n"+
"col += 0.5*lcol2*pow(ref2, 10.0);\n"+
"col *= hf;\n"+
"\n"+
"//  col = n;\n"+
"return col;\n"+
"}\n"+
"\n"+
"vec3 eye_complete(vec2 p) {\n"+
"const float iris_outer = 0.622;\n"+
"const float iris_inner = 0.285;\n"+
"\n"+
"\n"+
"float t0 = abs(0.9*p.x);\n"+
"t0 *= t0;\n"+
"t0 *= t0;\n"+
"t0 *= t0;\n"+
"t0 = clamp(t0, 0.0, 1.0);\n"+
"float dt0 = mix(0.0125, -0.0025, t0);\n"+
"\n"+
"vec2 p0 = p;\n"+
"float d0 = eye_shape(p);\n"+
"float d5 = d0;\n"+
"\n"+
"vec2 p1 = p;\n"+
"p1 -= iris_center;\n"+
"float d1 = circle(p1, iris_outer);\n"+
"d1 = max(d1,d0+dt0);\n"+
"float d6 = d1;\n"+
"\n"+
"vec2 p2 = p;\n"+
"p2 -= vec2(0.155, 0.35);\n"+
"float d2 = circle(p2, 0.065);\n"+
"\n"+
"vec2 p3 = p;\n"+
"p3 -= iris_center;\n"+
"p3 = toPolar(p3);\n"+
"float n3 = mod1(p3.x, 0.05);\n"+
"float d3 = abs(p3.x)-0.0125*(1.0-1.0*length(p1));\n"+
"\n"+
"vec2 p4 = p;\n"+
"p4 -= iris_center;\n"+
"float d4 = circle(p4, iris_inner);\n"+
"\n"+
"d3 = max(d3,-d4);\n"+
"\n"+
"d1 = pmax(d1,-d2, 0.0125);\n"+
"d1 = max(d1,-d3);\n"+
"\n"+
"d0 = abs(d0)-dt0;\n"+
"\n"+
"\n"+
"float d = d0;\n"+
"d = pmin(d, d1, 0.0125);\n"+
"return vec3(d, d6, d5);\n"+
"}\n"+
"\n"+
"vec3 df(vec2 p) {\n"+
"return eye_complete(p);\n"+
"}\n"+
"\n"+
"vec3 render_background(vec3 ro, vec3 rd, vec3 nrd) {\n"+
"rd.xy *= ROT(-PI/2.0+0.6);\n"+
"vec3 srd = toSpherical(rd.xzy);\n"+
"srd.z += 0.025*TIME;\n"+
"vec2 pg  = srd.yz;\n"+
"float f  = sin(pg.x);\n"+
"float lf2= ceil(log(f)/log(2.0)-0.505);\n"+
"float mf = pow(2.0, lf2);\n"+
"\n"+
"float aa = 0.005;\n"+
"const float count = 20.0;\n"+
"const vec2 sz = vec2(2.0*PI/count);\n"+
"vec2 ng = mod2(pg, vec2(mf, 1.0)*sz);\n"+
"\n"+
"float dg = min(abs(pg.y)*f, abs(pg.x))-aa*0.0;\n"+
"\n"+
"vec3 lines = grid_color*smoothstep(-aa, aa, -dg)*f*f;\n"+
"\n"+
"vec3 sky  = smoothstep(1.0, 0.0, rd.y)*sky1_color+smoothstep(0.5, 0.0, rd.y)*sky0_color;\n"+
"\n"+
"vec2 pi = raySphere(ro, rd, planet_sph);\n"+
"\n"+
"float lf1 = 1.0;\n"+
"if (pi.x > 0.0) {\n"+
"vec3 ppos = ro+rd*pi.x;\n"+
"float t = 1.0-tanh_approx(1.5*(pi.y - pi.x)/planet_sph.w);\n"+
"sky *= mix(0.5, 1.0, t);\n"+
"lf1 = t;\n"+
"} else {\n"+
"sky += lines;\n"+
"}\n"+
"\n"+
"sky += pow(max(dot(rd, light0_dir), 0.0), 800.0)*light0_color;\n"+
"sky += pow(max(dot(rd, light0_dir), 0.0), 80.0)*light1_color*0.1;\n"+
"sky += lf1*pow(max(dot(rd, light1_dir), 0.0), 150.0)*light1_color;\n"+
"sky += lf1*pow(max(dot(rd, light1_dir), 0.0), 50.0)*light0_color*0.1;\n"+
"\n"+
"return sky;\n"+
"}\n"+
"\n"+
"vec4 render_iris(vec3 ro, vec3 rd, vec3 nrd) {\n"+
"vec4 plane = vec4(normalize(vec3(1.0, 0.165-0.00, 0.0)), -0.944);\n"+
"float aa = TTIME/MPERIOD;\n"+
"float bb = smoothstep(-0.125, 0.125, sin(aa));\n"+
"plane.xy *= ROT(0.075*bb);\n"+
"plane.xz *= ROT(0.25*bb*sign(-sin(PI/4.0+0.5*aa)));\n"+
"vec3 tnor  = plane.xyz;\n"+
"const vec3 tup   = normalize(vec3(0.0, -1.0, 0.0));\n"+
"float t = rayPlane(ro, rd, plane);\n"+
"if (t <= 0.0) {\n"+
"return vec4(0.0);\n"+
"}\n"+
"\n"+
"vec3 tpos = ro + t*rd;\n"+
"tpos *= 4.0;\n"+
"vec3 txx = normalize(cross(tnor, tup));\n"+
"vec3 tyy = normalize(cross(tnor, txx));\n"+
"\n"+
"vec2 tpos2 = vec2(dot(txx, tpos), dot(tyy, tpos));\n"+
"\n"+
"vec3 col = iris(tpos2)*smoothstep(0.0, 1.0/75.0, t);\n"+
"\n"+
"return vec4(col, smoothstep(0.0, 1.0/500.0, t));\n"+
"}\n"+
"\n"+
"\n"+
"vec4 render_body(vec2 p, vec3 dd, float z) {\n"+
"//  p -= iris_center;\n"+
"float aa = 2.0/RESOLUTION.y;\n"+
"\n"+
"vec3 ro = vec3(2.0, 0.0, 0.0);\n"+
"vec3 la = vec3(0.0, 0.0, 0.0);\n"+
"\n"+
"vec2 np   = p + vec2(4.0/RESOLUTION.y);\n"+
"\n"+
"vec3 ww   = normalize(la - ro);\n"+
"vec3 uu   = normalize(cross(vec3(0.0,1.0,0.0), ww));\n"+
"vec3 vv   = normalize(cross(ww,uu));\n"+
"float rdd = 2.0;\n"+
"vec3 rd   = normalize(p.x*uu + p.y*vv + rdd*ww);\n"+
"vec3 nrd  = normalize(np.x*uu + np.y*vv + rdd*ww);\n"+
"\n"+
"vec4 sph  = vec4(vec3(0.0), 1.0);\n"+
"\n"+
"vec2 si   = raySphere(ro, rd, sph);\n"+
"if (si.x <= 0.0) {\n"+
"return vec4(0.0);\n"+
"}\n"+
"\n"+
"float a = smoothstep(-aa, aa, -dd.z);\n"+
"float b = smoothstep(0.0, mix(0.25, 1.0, float(p.y > 0.0))*mix(0.075, 0.0025, smoothstep(0.5, 1.0, abs(p.x))), -dd.z/z);\n"+
"float c = smoothstep(-aa, aa, -dd.x);\n"+
"\n"+
"vec3 pos  = ro + rd*si.x;\n"+
"\n"+
"vec3 nor  = normalize(pos - sph.xyz);\n"+
"\n"+
"float dif0= max(dot(nor, light0_dir), 0.0);\n"+
"float dif1= max(dot(nor, light1_dir), 0.0);\n"+
"\n"+
"vec3 ref  = reflect(rd, nor);\n"+
"vec3 nref = reflect(nrd, nor);\n"+
"\n"+
"vec3 refr = refract(rd, nor, 0.9);\n"+
"vec3 nrefr= refract(nrd, nor, 0.9);\n"+
"\n"+
"vec3 rbkg = render_background(pos, ref, nref);\n"+
"vec4 riris= render_iris(pos, refr, nrefr);\n"+
"\n"+
"vec3 col = vec3(0.0);\n"+
"col += vec3(0.5);\n"+
"col += dif1*0.5;\n"+
"col += dif0*0.5;\n"+
"if (fract((TIME/BPERIOD)/(2.0*FLIP)) > 0.5) {\n"+
"rbkg = max(rbkg, 0.0);\n"+
"rbkg = tanh(vec3(0.5, 1.0, 1.6)*rbkg).zxy;\n"+
"col = mix(rbkg, rbkg*0.6, c);\n"+
"} else {\n"+
"col = alphaBlend(col, riris);\n"+
"col += rbkg*mix(0.33, 1.0, riris.w);\n"+
"}\n"+
"col *= b;\n"+
"\n"+
"return vec4(col, a);\n"+
"}\n"+
"\n"+
"float synth(vec2 p) {\n"+
"const float z = 4.0;\n"+
"const float st = 0.02;\n"+
"float dob = box(p, vec2(1.4, 0.5));\n"+
"p.x = abs(p.x);\n"+
"p.x += st*20.0;\n"+
"p /= z;\n"+
"float n = mod1(p.x, st);\n"+
"float dib = 1E6;\n"+
"const int around = 1;\n"+
"for (int i = -around; i <=around ;++i) {\n"+
"float fft = texture(iAudioData, vec2((n+float(i))*st, 0.25)).x;\n"+
"fft *= fft;\n"+
"float dibb = box(p-vec2(st*float(i), 0.0), vec2(st*0.25, 0.05*fft+0.001));\n"+
"dib = min(dib, dibb);\n"+
"}\n"+
"\n"+
"float dl = p.y;\n"+
"dl = abs(dl) - 0.005;\n"+
"dl = abs(dl) - 0.0025;\n"+
"dl = abs(dl) - 0.00125;\n"+
"float d = dib;\n"+
"d = max(d, -dl);\n"+
"//d = pmax(d, dob, 0.025);\n"+
"return d*z;\n"+
"}\n"+
"\n"+
"vec3 effect(vec2 p) {\n"+
"compute_globals();\n"+
"\n"+
"float aa = 2.0/RESOLUTION.y;\n"+
"const float m = 3.0;\n"+
"const float z = 1.0;\n"+
"p /= z;\n"+
"vec2 pp  = p;\n"+
"\n"+
"vec3 d   = df(pp)*z;\n"+
"\n"+
"vec4 dcol = vec4(mix(vec3(0.9), vec3(0.0), smoothstep(-aa, aa, -d.x)) , smoothstep(-aa, aa, -d.z));\n"+
"g_eff = 1;\n"+
"vec4 scol = render_body(p, d, z);\n"+
"\n"+
"vec3 col  = vec3(1.0);\n"+
"g_eff = 0;\n"+
"col = iris(p);\n"+
"\n"+
"vec2 dp = p;\n"+
"dp.y = -pabs(dp.y, 1.0);\n"+
"dp -= vec2(0.0, -0.85);\n"+
"dp = toPolar(dp);\n"+
"dp.y += -0.2*(p.x);\n"+
"dp = toRect(dp);\n"+
"float dd = synth(dp);\n"+
"\n"+
"//vec4 ddcol = vec4(vec3(0.9), smoothstep(-aa, aa, -dd));\n"+
"vec4 ddcol = vec4(vec3(0.9), smoothstep(-aa, aa, -dd));\n"+
"\n"+
"col = alphaBlend(col, dcol);\n"+
"if (fract((TIME/BPERIOD)/FLIP) > 0.5) {\n"+
"col = alphaBlend(col, scol);\n"+
"}\n"+
"\n"+
"col -= 0.5*exp(-75.0*max(dd, 0.0));\n"+
"col = alphaBlend(col, ddcol);\n"+
"\n"+
"/*\n"+
"col -= .5+exp(-75.0*max(dd, 0.0));\n"+
"col = alphaBlend(col, ddcol);\n"+
"*/\n"+
"return col;\n"+
"}\n"+
"\n"+
"void main() {\n"+
"vec3 vid = texture(iVideo, vUv).rgb;\n"+
"//vec2 q = fragCoord/iResolution.xy;\n"+
"//vec2 q = -1.0 + 2.0 *vUv;\n"+
"vec2 q = -.458 + 2.0 *vUv*.456;\n"+
"//vec2 p = -1.0 + 2.0*q;\n"+
"//vec2 p = -1.0 + 2.0*vUv;\n"+
"vec2 p = -2.8458 + 2.0 * vUv * 2.8458;\n"+
"//p.x *= RESOLUTION.x/RESOLUTION.y;\n"+
"//float aa = 2.0/RESOLUTION.y;\n"+
"\n"+
"vec3 col = effect(p);\n"+
"//col = mix(vec3(0.0), col, smoothstep(0.5, 5.0, TIME));\n"+
"col = postProcess(col, q);\n"+
"\n"+
"gl_FragColor = vec4(col, 1.0);\n"+
"//gl_FragColor = vec4(col*(2.*vid.rgb),1.0);\n"+
"}\n"