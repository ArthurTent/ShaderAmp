// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var MovingWithoutTravelling_frag =
"// https://www.shadertoy.com/view/NtXSzl\n"+
"// Moving without travelling by mrange\n"+
"// License CC0: Moving without travelling\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"#define PI              3.141592654\n"+
"#define TAU             (2.0*PI)\n"+
"#define TIME            iGlobalTime\n"+
"#define TTIME           (TAU*TIME)\n"+
"#define RESOLUTION      iResolution\n"+
"#define ROT(a)          mat2(cos(a), sin(a), -sin(a), cos(a))\n"+
"#define BPERIOD         5.6\n"+
"#define PCOS(x)         (0.5+ 0.5*cos(x))\n"+
"#define BPM             150.0\n"+
"\n"+
"const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n"+
"vec3 hsv2rgb(vec3 c) {\n"+
"vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);\n"+
"return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);\n"+
"}\n"+
"// Macro version of above to enable compile-time constants\n"+
"#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))\n"+
"\n"+
"const vec3 std_gamma        = vec3(2.2);\n"+
"\n"+
"float g_th = 0.0;\n"+
"float g_hf = 0.0;\n"+
"\n"+
"vec2 g_vx = vec2(0.0);\n"+
"vec2 g_vy = vec2(0.0);\n"+
"\n"+
"vec2 g_wx = vec2(0.0);\n"+
"vec2 g_wy = vec2(0.0);\n"+
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
"float hash(float co) {\n"+
"return fract(sin(co*12.9898) * 13758.5453);\n"+
"}\n"+
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
"float tanh_approx(float x) {\n"+
"//  return tanh(x);\n"+
"float x2 = x*x;\n"+
"return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);\n"+
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
"vec2 toPolar(vec2 p) {\n"+
"return vec2(length(p), atan(p.y, p.x));\n"+
"}\n"+
"\n"+
"vec2 toRect(vec2 p) {\n"+
"return vec2(p.x*cos(p.y), p.x*sin(p.y));\n"+
"}\n"+
"\n"+
"float modMirror1(inout float p, float size) {\n"+
"float halfsize = size*0.5;\n"+
"float c = floor((p + halfsize)/size);\n"+
"p = mod(p + halfsize,size) - halfsize;\n"+
"p *= mod(c, 2.0)*2.0 - 1.0;\n"+
"return c;\n"+
"}\n"+
"\n"+
"float smoothKaleidoscope(inout vec2 p, float sm, float rep) {\n"+
"vec2 hp = p;\n"+
"\n"+
"vec2 hpp = toPolar(hp);\n"+
"float rn = modMirror1(hpp.y, TAU/rep);\n"+
"\n"+
"float sa = PI/rep - pabs(PI/rep - abs(hpp.y), sm);\n"+
"hpp.y = sign(hpp.y)*(sa);\n"+
"\n"+
"hp = toRect(hpp);\n"+
"\n"+
"p = hp;\n"+
"\n"+
"return rn;\n"+
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
"float outerEye(vec2 p, float th) {\n"+
"float a  = mix(0.0, 1.0, smoothstep(0.995, 1.0, cos(th+TTIME/BPERIOD)));\n"+
"const float w = 1.14;\n"+
"float h = mix(0.48, 0.05, a);\n"+
"float d0 =  vesica(p, vec2(w, h));\n"+
"return d0;\n"+
"}\n"+
"\n"+
"const vec2 iris_center = vec2(0.0, 0.28);\n"+
"vec4 completeEye(vec2 p, float th) {\n"+
"const float iris_outer = 0.622;\n"+
"const float iris_inner = 0.285;\n"+
"\n"+
"float t0 = abs(0.9*p.x);\n"+
"t0 *= t0;\n"+
"t0 *= t0;\n"+
"t0 *= t0;\n"+
"t0 = clamp(t0, 0.0, 1.0);\n"+
"float dt0 = mix(0.0125, -0.0025, t0);\n"+
"\n"+
"vec2 p0 = p;\n"+
"float d0 = outerEye(p, th);\n"+
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
"float d = d0;\n"+
"d = pmin(d, d1, 0.0125);\n"+
"return vec4(d, d6, d5, max(d4, d6));\n"+
"}\n"+
"\n"+
"\n"+
"// The path function\n"+
"vec3 offset(float z) {\n"+
"float a = z;\n"+
"vec2 p = -0.1*(vec2(cos(a), sin(a*sqrt(2.0))) + vec2(cos(a*sqrt(0.75)), sin(a*sqrt(0.5))));\n"+
"return vec3(p, z);\n"+
"}\n"+
"\n"+
"// The derivate of the path function\n"+
"//  Used to generate where we are looking\n"+
"vec3 doffset(float z) {\n"+
"float eps = 0.1;\n"+
"return 0.5*(offset(z + eps) - offset(z - eps))/eps;\n"+
"}\n"+
"\n"+
"// The second derivate of the path function\n"+
"//  Used to generate tilt\n"+
"vec3 ddoffset(float z) {\n"+
"float eps = 0.1;\n"+
"return 0.125*(doffset(z + eps) - doffset(z - eps))/eps;\n"+
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
"f = smoothstep(-0.1, 0.15, completeEye(p, g_th).x);\n"+
"const float rep = 50.0;\n"+
"const float sm = 0.125*0.5*60.0/rep;\n"+
"float  n = smoothKaleidoscope(p, sm, rep);\n"+
"p.y += TIME*0.125+1.5*g_th;\n"+
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
"\n"+
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
"vec3 weird(vec2 p) {\n"+
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
"//  col -= 0.5*hsv2rgb(vec3(fract(0.3*TIME+0.25*a+0.5*v.x), 0.85, abs(tanh_approx(v.y))));\n"+
"//  col -= 0.5*hsv2rgb(vec3(fract(-0.5*TIME+0.25*a+0.125*w.x), 0.85, abs(tanh_approx(w.y))));\n"+
"col += hsv2rgb(vec3(fract(-0.1*TIME+0.125*a+0.5*v.x+0.125*w.x), abs(0.5+tanh_approx(v.y*w.y)), tanh_approx(0.1+abs(v.y-w.y))));\n"+
"col -= 0.5*(length(v)*col1 + length(w)*col2*1.0);\n"+
"/*\n"+
"col += 0.25*diff1;\n"+
"col += 0.25*diff2;\n"+
"*/\n"+
"col += 0.5*lcol1*pow(ref1, 20.0);\n"+
"col += 0.5*lcol2*pow(ref2, 10.0);\n"+
"col *= hf;\n"+
"\n"+
"return col;\n"+
"}\n"+
"\n"+
"vec4 plane3(vec3 ro, vec3 rd, vec3 pp, vec3 off, float aa, float n) {\n"+
"float h = hash(n+1234.4);\n"+
"float th = TAU*h;\n"+
"g_th = th;\n"+
"float s = 1.*mix(0.2, 0.3, h);\n"+
"\n"+
"vec3 hn;\n"+
"vec2 p = (pp-off*vec3(1.0, 1.0, 0.0)).xy;\n"+
"p *= ROT(0.2*mix(-1.0, 1.0, h));\n"+
"p /= s;\n"+
"float lp = length(p);\n"+
"p -= -iris_center;\n"+
"const float lw = 0.005;\n"+
"vec4 de = completeEye(p, th)*s;\n"+
"float ax = smoothstep(-aa, aa, de.x);\n"+
"float ay = smoothstep(-aa, aa, de.y);\n"+
"float az = smoothstep(-aa, aa, -de.z);\n"+
"float aw = smoothstep(-aa, aa, 0.0125*(de.w+0.025));\n"+
"\n"+
"float df = 1.0-tanh_approx(0.5*lp);\n"+
"vec3 acol = vec3(df);\n"+
"vec3 icol = weird(p);\n"+
"vec3 ecol = mix(vec3(0.0), vec3(1.0), ax);\n"+
"vec3 bcol = mix(icol, ecol, az*0.5*df);\n"+
"vec4 col = vec4(bcol, aw);\n"+
"\n"+
"return col;\n"+
"}\n"+
"\n"+
"vec4 plane(vec3 ro, vec3 rd, vec3 pp, vec3 off, float aa, float n) {\n"+
"return plane3(ro, rd, pp, off, aa, n);\n"+
"}\n"+
"\n"+
"\n"+
"vec3 skyColor(vec3 ro, vec3 rd) {\n"+
"float ld = max(dot(rd, vec3(0.0, 0.0, 1.0)), 0.0);\n"+
"vec3 baseCol = 1.0*vec3(2.0, 1.0, 3.0)*(pow(ld, 100.0));\n"+
"return vec3(baseCol);\n"+
"}\n"+
"\n"+
"vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {\n"+
"float lp = length(p);\n"+
"vec2 np = p + 1.0/RESOLUTION.xy;\n"+
"const float per = 10.0;\n"+
"float rdd = (1.0+0.5*lp*tanh_approx(lp+0.9*PCOS(per*p.x)*PCOS(per*p.y)));\n"+
"vec3 rd = normalize(p.x*uu + p.y*vv + rdd*ww);\n"+
"vec3 nrd = normalize(np.x*uu + np.y*vv + rdd*ww);\n"+
"\n"+
"const float planeDist = 1.0-0.0;\n"+
"const int furthest = 4;\n"+
"const int fadeFrom = max(furthest-3, 0);\n"+
"const float fadeDist = planeDist*float(furthest - fadeFrom);\n"+
"float nz = floor(ro.z / planeDist);\n"+
"\n"+
"vec3 skyCol = skyColor(ro, rd);\n"+
"\n"+
"// Steps from nearest to furthest plane and accumulates the color\n"+
"\n"+
"vec4 acol = vec4(0.0);\n"+
"const float cutOff = 0.95;\n"+
"bool cutOut = false;\n"+
"\n"+
"for (int i = 1; i <= furthest; ++i) {\n"+
"float pz = planeDist*nz + planeDist*float(i);\n"+
"\n"+
"float pd = (pz - ro.z)/rd.z;\n"+
"\n"+
"if (pd > 0.0 && acol.w < cutOff) {\n"+
"vec3 pp = ro + rd*pd;\n"+
"vec3 npp = ro + nrd*pd;\n"+
"\n"+
"float aa = 3.0*length(pp - npp);\n"+
"\n"+
"vec3 off = offset(pp.z);\n"+
"\n"+
"vec4 pcol = plane(ro, rd, pp, off, aa, nz+float(i));\n"+
"\n"+
"float nz = pp.z-ro.z;\n"+
"float fadeIn = exp(-2.5*max((nz - planeDist*float(fadeFrom))/fadeDist, 0.0));\n"+
"float fadeOut = smoothstep(0.0, planeDist*0.1, nz);\n"+
"pcol.xyz = mix(skyCol, pcol.xyz, (fadeIn));\n"+
"pcol.w *= fadeOut;\n"+
"\n"+
"pcol = clamp(pcol, 0.0, 1.0);\n"+
"\n"+
"acol = alphaBlend(pcol, acol);\n"+
"} else {\n"+
"cutOut = true;\n"+
"break;\n"+
"}\n"+
"\n"+
"}\n"+
"\n"+
"vec3 col = alphaBlend(skyCol, acol);\n"+
"// To debug cutouts due to transparency\n"+
"//  col += cutOut ? vec3(1.0, -1.0, 0.0) : vec3(0.0);\n"+
"return col;\n"+
"}\n"+
"\n"+
"// Classic post processing\n"+
"vec3 postProcess(vec3 col, vec2 q) {\n"+
"col = clamp(col, 0.0, 1.0);\n"+
"col = pow(col, 1.0/std_gamma);\n"+
"col = col*0.6+0.4*col*col*(3.0-2.0*col);\n"+
"col = mix(col, vec3(dot(col, vec3(0.33))), -0.4);\n"+
"col *=0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);\n"+
"return col;\n"+
"}\n"+
"\n"+
"vec3 effect(vec2 p, vec2 q) {\n"+
"compute_globals();\n"+
"\n"+
"float tm  = TIME*0.5*BPM/60.0;\n"+
"vec3 ro   = offset(tm);\n"+
"vec3 dro  = doffset(tm);\n"+
"vec3 ddro = ddoffset(tm);\n"+
"\n"+
"vec3 ww = normalize(dro);\n"+
"vec3 uu = normalize(cross(normalize(vec3(0.0,1.0,0.0)+ddro), ww));\n"+
"vec3 vv = normalize(cross(ww, uu));\n"+
"\n"+
"vec3 col = color(ww, uu, vv, ro, p);\n"+
"return col;\n"+
"}\n"+
"\n"+
"void main() {\n"+
"//vec2 q = fragCoord/RESOLUTION.xy;\n"+
"vec2 q = -1.0 + 2.0 *vUv +.5;\n"+
"vec2 p = -1. + 2. * q;\n"+
"p.x *= RESOLUTION.x/RESOLUTION.y;\n"+
"\n"+
"vec3 col = effect(p, q);\n"+
"col += smoothstep(3.0, 0.0, TIME);\n"+
"//col = postProcess(col, q);\n"+
"\n"+
"gl_FragColor = vec4(col, 1.0);\n"+
"\n"+
"//gl_FragColor *= pow(max(gl_FragColor - .2, 0.0), vec4(2.4)) * 8.5;\n"+
"}\n"+
"\n"