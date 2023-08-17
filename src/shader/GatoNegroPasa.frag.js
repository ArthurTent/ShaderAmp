// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var GatoNegroPasa_frag =
"// https://www.shadertoy.com/view/WdB3zz\n"+
"// \"Gato Negro Pasa\" by Kali\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
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
"\n"+
"vec2 p_ojos=vec2(0.);\n"+
"float col_ojos = 0.;\n"+
"float col_pupilas = 0.;\n"+
"float col_nariz = 0.;\n"+
"\n"+
"//#define time iChannelTime[0]\n"+
"#define time iGlobalTime\n"+
"#define fade_in smoothstep(0.,15.,time)\n"+
"#define ritmo1 sin(time*PI*1.61*2.+offset_ritmo)\n"+
"#define ritmo2 sin(time)\n"+
"#define PI 3.14159\n"+
"#define tick floor(1.3+time*1.61)\n"+
"\n"+
"\n"+
"float offset_ritmo=0.;\n"+
"float sec_agua=0.;\n"+
"float sec_mosaicos=0.;\n"+
"float sec_montania=0.;\n"+
"float sec_luz=0.;\n"+
"float sec_baile=0.;\n"+
"float sec_lluvia=0.;\n"+
"float sec_horizonte=0.;\n"+
"float sec_irvolver=0.;\n"+
"float sec_rotacion=0.;\n"+
"float sec_piso=0.;\n"+
"float sec_loca=0.;\n"+
"float sec_final=0.;\n"+
"float sec_chaugato=0.;\n"+
"float sec_constel=0.;\n"+
"\n"+
"float rnd1(float n) {\n"+
"return fract(sin(n*.4324)*2343.324);\n"+
"}\n"+
"\n"+
"float rnd2(vec2 n) {\n"+
"return fract(sin(dot(vec2(1.23,.232),n)*232.21321)*2321.23);\n"+
"}\n"+
"\n"+
"\n"+
"mat2 rot(float a) {\n"+
"a = radians(a);\n"+
"float si = sin(a);\n"+
"float co = cos(a);\n"+
"return mat2(co,si,-si,co);\n"+
"}\n"+
"\n"+
"float fmod(float n) {\n"+
"return abs(1.-mod(n,2.));\n"+
"}\n"+
"\n"+
"vec2 fmod(vec2 p) {\n"+
"return abs(1.-mod(p,2.));\n"+
"}\n"+
"\n"+
"\n"+
"float shaper(float c) {\n"+
"return max(0., .001-c)/.001;\n"+
"}\n"+
"\n"+
"float ovalo(vec2 p, float l, float b) {\n"+
"p.y*=b;\n"+
"float d = length(p) - l;\n"+
"return d;\n"+
"}\n"+
"\n"+
"float bigote(vec2 p) {\n"+
"p.x-=.2;\n"+
"p.y*=1.+(p.x+.1)*10.;\n"+
"float d=abs(p.y)-.01;\n"+
"d=max(d,abs(p.x)-.13);\n"+
"return shaper(d);\n"+
"}\n"+
"\n"+
"float bigotes(vec2 p) {\n"+
"p.x=abs(p.x);\n"+
"p*=3.;\n"+
"p.x-=.3;\n"+
"p.y+=.15;\n"+
"float d=0.;\n"+
"p*=rot(-50.+p.y*40.);\n"+
"for (int i=0; i<4; i++) {\n"+
"p*=rot(15.);\n"+
"p*=1.+float(4-i)*.02;\n"+
"d+=bigote(p);\n"+
"}\n"+
"return shaper(d);\n"+
"}\n"+
"\n"+
"\n"+
"float cuerpo(vec2 p) {\n"+
"p.x+=smoothstep(0.,1.,p.y)*ritmo2*.6*sec_baile;\n"+
"p.x+=p.y*.07;\n"+
"p.x*=1.+(pow(abs(p.y+.2),2.5))*10.;\n"+
"p.x*=2.6+(p.y-.4)*2.;\n"+
"p.y*=1.1;\n"+
"float d = length(p)-.25;\n"+
"return shaper(d);\n"+
"}\n"+
"\n"+
"float pies(vec2 p) {\n"+
"p.y-=.025;\n"+
"p.y-=p.x*ritmo1*.1*step(0.,p.x)*sec_baile;\n"+
"p.x=abs(p.x-.01);\n"+
"vec2 pp=p*rot(50.);\n"+
"pp+=vec2(.12,-.22);\n"+
"p.x-=.11;\n"+
"p.x*=1.+p.y*1.5;\n"+
"p.y+=.23;\n"+
"float d = shaper(length(p)-.03);\n"+
"float m = 0.;\n"+
"for (int i=0; i<4; i++) {\n"+
"m = max(m, shaper(abs(pp.x)-.005))*(1.-step(.1,p.y))*step(-.01,-p.y);\n"+
"pp*=rot(2.);\n"+
"}\n"+
"return d-m;\n"+
"}\n"+
"\n"+
"float segmentocola(vec2 p, float l, float g) {\n"+
"p.x+=l;\n"+
"float d = abs(p.y)-g;\n"+
"d=max(d,abs(p.x)-l);\n"+
"p.x+=l;\n"+
"d=min(d,length(p)-g);\n"+
"return d;\n"+
"}\n"+
"\n"+
"float cola(vec2 p) {\n"+
"p.x*=-1.;\n"+
"p.y+=.13;\n"+
"p.x+=.1;\n"+
"p*=2.;\n"+
"float d=0.;\n"+
"float t=10.+time*1.5;\n"+
"float s=1.+sec_baile*2.;\n"+
"float l=.015;\n"+
"float g=.04;\n"+
"float f=3.;\n"+
"p*=rot(-10.);\n"+
"float c = segmentocola(p,l,g);\n"+
"for (int i=0; i<20; i++) {\n"+
"float a = -(.2+sin(t)*.5)*s;\n"+
"p.x+=l*2.;\n"+
"c=min(c,segmentocola(p*rot(a),l,g));\n"+
"p*=rot(a);\n"+
"s*=1.15;\n"+
"g*=.95;\n"+
"}\n"+
"return shaper(c);\n"+
"}\n"+
"\n"+
"\n"+
"float orejas(vec2 p) {\n"+
"p.x=abs(p.x);\n"+
"p.x-=.1;\n"+
"p.y-=.1;\n"+
"p.x*=1.+p.y*5.;\n"+
"p.x-=p.y*.5;\n"+
"float d = ovalo(p,.04,.5);\n"+
"return d;\n"+
"}\n"+
"\n"+
"float ojos(vec2 p) {\n"+
"float s = sign(p.x);\n"+
"p.x=abs(p.x);\n"+
"p*=rot(15.);\n"+
"p.x-=.08;\n"+
"p.y+=.01;\n"+
"p.x*=1.+abs(p.y)*10.;\n"+
"p.y-=p.x*.1;\n"+
"p.y*=1.-p.x*5.;\n"+
"float d = ovalo(p,.05, 1.7+fade_in*rnd1(floor(time)));\n"+
"p.x-=.005;\n"+
"p*=rot(-20.);\n"+
"float mov=(rnd1(floor(time*.5))-.5)*.02*s*fade_in;\n"+
"float pupilas=-ovalo(p+vec2(mov,0.),.01,.3);\n"+
"col_pupilas=step(-5.,-shaper(pupilas))*step(0.,-d);\n"+
"d=max(d,pupilas);\n"+
"return shaper(d);\n"+
"}\n"+
"\n"+
"float nariz(vec2 p) {\n"+
"p.x=abs(p.x);\n"+
"float orif=ovalo(p*2.+vec2(-.02,0.07),.01,.8);\n"+
"p.y+=.03+abs(p.x)*.2;\n"+
"p.x+=p.y*.3;\n"+
"float d=abs(p.x-p.y);\n"+
"d=max(d,abs(p.y));\n"+
"return min(1.,shaper(d-.01)-shaper(orif))*(1.-sec_chaugato);\n"+
"}\n"+
"\n"+
"float cabeza(vec2 p) {\n"+
"float t=sin(time)+smoothstep(0.,3.,ritmo1);\n"+
"p.y-=.23+ritmo1*.015*(.2+sec_baile);\n"+
"p.x-=sec_baile*(-t*.05-ritmo2*.02-ritmo1 *.02)*.8;\n"+
"p*=rot(10.+t*20.*sec_baile);\n"+
"float d=ovalo(p*vec2(1.-p.y*1.5,1.), .17, 1.45);\n"+
"d=min(d,orejas(p));\n"+
"d=min(d,bigotes(p));\n"+
"float ojos=ojos(p);\n"+
"if (shaper(ojos)<1.) {\n"+
"p_ojos=p;\n"+
"col_ojos=1.;\n"+
"}\n"+
"col_nariz = nariz(p);\n"+
"return shaper(d);\n"+
"\n"+
"}\n"+
"\n"+
"float gato(vec2 p) {\n"+
"float c = cuerpo(p);\n"+
"c = max(c, pies(p));\n"+
"c = max(c, cabeza(p));\n"+
"c = max(c, cola(p));\n"+
"return max(0.,1.-c*(1.-sec_chaugato));\n"+
"}\n"+
"\n"+
"float estrellas(vec2 p) {\n"+
"p+=sec_chaugato;\n"+
"p*=rot(time*5.);\n"+
"float m=1000.;\n"+
"for (int i=0; i<6; i++) {\n"+
"p=abs(p)/dot(p,p)-1.;\n"+
"float l=mix(length(p)-fmod(atan(p.y,p.x)*PI*.5)*.01,min(m,abs(p.y*p.x)),sec_constel);\n"+
"m=min(m,l);\n"+
"}\n"+
"return exp(-50.*m)*(1.-sec_constel*.6)*1.5*(1.+sec_final)*(1.-sec_loca);\n"+
"}\n"+
"\n"+
"\n"+
"float montania(vec2 p) {\n"+
"float t=sec_montania;\n"+
"float f=10.;\n"+
"float s=3.*t;\n"+
"p.y-= t*.4-(1.-sec_horizonte)+.05;\n"+
"p.y+=abs(p.x)*t*.6;\n"+
"for (int i=0; i<8; i++) {\n"+
"p.y+=sin(p.x*f)*.01*s;\n"+
"f*=1.5;\n"+
"s*=.75;\n"+
"}\n"+
"return smoothstep(0.,0.03,-p.y)-.2;\n"+
"}\n"+
"\n"+
"float piso(vec2 p) {\n"+
"float d=max(0.,p.y-.7);\n"+
"float fade=max(sec_loca*.7,smoothstep(0.025,.3,-p.y));\n"+
"return shaper(d)*fade;\n"+
"}\n"+
"\n"+
"float agua(vec2 p) {\n"+
"p.y+=.7-sec_agua*.65;\n"+
"float s=1.;\n"+
"float t=time*15.;\n"+
"for (int i=0; i<5; i++) {\n"+
"p.x-=3.234;\n"+
"p.x*=1.5;\n"+
"p.y+=sin(p.x*10.+t)*.005*s;\n"+
"s*=.7;\n"+
"t*=.7;\n"+
"}\n"+
"float d = max(0.,p.y+-.3);\n"+
"return shaper(d)*step(0.1,sec_agua);\n"+
"}\n"+
"\n"+
"vec3 mosaicos(vec2 p) {\n"+
"p*=rot(-p.x*30.*sec_loca);\n"+
"float end=step(sec_piso-.8,p.y);\n"+
"float tiles=70.;\n"+
"float horiz=1.-smoothstep(.04,.06,abs(p.y));\n"+
"p.x*=.03-(.06+.01*sec_irvolver)/p.y;\n"+
"if (sec_loca<.5) p.y*=2.-abs(p.y+.25)*2.5;\n"+
"p.y-=sec_irvolver*.1;\n"+
"float lim=1.-step(0.17,abs(p.x))*(1.-sec_loca);\n"+
"p.x-=time*.1*sec_loca;\n"+
"vec2 til=floor(p*tiles*.5);\n"+
"vec2 z=til/tiles;\n"+
"float a=floor(pow(1.-texture(iAudioData,vec2(.5+z.x*.5,.01)).r,3.)*tiles*.5)-sec_irvolver*4.;\n"+
"float l=(1.-step(tiles*.3-a,-til.y))*(1.-sec_loca);\n"+
"float r=rnd1(til.x)+tick;\n"+
"float x=rnd2(til)+floor(time*5.);\n"+
"float m=rnd1(rnd2(til)+floor(iGlobalTime*10.));\n"+
"p=fmod(p*tiles);\n"+
"p*=1.-.2*sec_loca;\n"+
"float mos=(1.-pow(abs(max(p.x,p.y*1.2)),10.));\n"+
"vec3 c=mix(vec3(.3,.25,.5),normalize(vec3(rnd1(r),rnd1(r+1.),rnd1(r+2.))),l*2.*sec_mosaicos);\n"+
"c+=step(.5,m)*.15;\n"+
"c+=normalize(vec3(rnd1(x),rnd1(x+1.),rnd1(x+2.)))*sec_loca;\n"+
"//vec3 c=normalize(vec3(rnd1(r),rnd1(r+1.),rnd1(r+2.)))*(.5+.5*sec_luz)*(.5+l);\n"+
"return max(vec3(horiz*1.5*(1.-sec_chaugato)),c*mos*lim*end*(1.-sec_chaugato));\n"+
"}\n"+
"\n"+
"\n"+
"vec3 fondo(vec2 p) {\n"+
"p+=sec_final*.4;\n"+
"p*=1.-sec_final*.3;\n"+
"float l=length(p*vec2(1.,.6));\n"+
"float h=.1-p.y+sec_luz*.1+sec_final*.3;\n"+
"return h+pow(max(0.,1.-l),3.)*vec3(1.,.6,1.)*fade_in*1.3*(1.+sec_loca*sec_luz*1.5);\n"+
"}\n"+
"\n"+
"\n"+
"\n"+
"vec2 camara(vec2 p) {\n"+
"p*=min(1.,time*.1);\n"+
"p.y+=.25*(1.-fade_in);\n"+
"if (time>30. && time<40.) {\n"+
"p*=.2;\n"+
"p.y+=.2;\n"+
"p.x+=.18;\n"+
"}\n"+
"if (time>54. && time<61.) {\n"+
"p*=.5;\n"+
"p.y-=.2-smoothstep(55.,59.,time)*.4;\n"+
"}\n"+
"if (time>161. && time<181.5) {\n"+
"float c=pow(abs(.5-smoothstep(161.,180.,time))*2.,3.);\n"+
"//sec_constel=1.-c;\n"+
"p*=.7-(1.-c)*.6;\n"+
"p+=vec2(-.5+c*.5,.2);\n"+
"}\n"+
"if ((time>112. && time<120.) || (time>200. && time<210.)) {\n"+
"p*=.5;\n"+
"p.y+=.15;\n"+
"}\n"+
"if (time>150. && time<161.) {\n"+
"float a=smoothstep(150.,160.,time);\n"+
"p*=.2+a*.2;\n"+
"p.x+=.25;\n"+
"p.y-=.05+a*.1;\n"+
"}\n"+
"\n"+
"p.y+=sec_chaugato*.15;\n"+
"return p;\n"+
"}\n"+
"\n"+
"\n"+
"vec3 shade(vec2 p) {\n"+
"p*=rot(sec_rotacion*720.);\n"+
"p.y-=(pow(abs(.5-sec_rotacion)*2.,3.))*.3-.3;\n"+
"float agua=agua(p);\n"+
"if (agua>.1) {\n"+
"p*=.94;\n"+
"p+=sin(p*30.+time*5.)*.005;\n"+
"}\n"+
"vec2 pp = floor(p*200.)/200.;\n"+
"p=camara(p);\n"+
"vec2 pg=p*(1.+sec_irvolver*.4);\n"+
"float montania=montania(p)*fade_in;\n"+
"float gato=gato(pg);\n"+
"float cabeza=cabeza(pg);\n"+
"float piso=piso(p);\n"+
"float estrellas=estrellas(p);\n"+
"vec2 pb=p+vec2(0.,-.25);\n"+
"vec3 fondo=fondo(p);\n"+
"vec3 mosaicos=mosaicos(p)*gato*piso;\n"+
"vec2 pr=p*rot(length(p)*200.+time*20.);\n"+
"float scanlines = abs(.5-mod(pr.y*50.,1.))*2.;\n"+
"vec3 c=fondo-montania*vec3(.1,.15,1.)*(2.+step(0.,montania)*rnd1(floor(time*5.+p.y*(80.+(p.y+.5)*100.)+sin(p.x*50.))));\n"+
"c*=gato;\n"+
"c+=(1.-gato)*sec_irvolver*.06;\n"+
"offset_ritmo=-length(p)*10.;\n"+
"c+=estrellas*step(0.,-max(montania,1.-gato))*.4*(1.5+ritmo1*(1.-sec_chaugato))*fade_in;\n"+
"c+=vec3(.6,1.,.4)*col_ojos*(1.2-p_ojos.y*20.)*(1.-sec_final)*(1.+sec_loca*2.);\n"+
"c+=col_nariz*.5*fade_in;\n"+
"c-=col_pupilas*.3*(1.-sec_final);\n"+
"c=mosaicos*(.5+estrellas*.5)+c*(1.-piso);\n"+
"c+=.1*fade_in;\n"+
"if (agua>.1) {\n"+
"c=mix(agua*vec3(.5,.6,1.),c*(1.-agua*.5),.6*(1.-gato*.5));\n"+
"}\n"+
"c=mix(vec3(rnd1(time+pp.x*2324.23432+pp.y*223.2332)),c,sec_lluvia);\n"+
"c=.05*gato+c;\n"+
"return c;\n"+
"}\n"+
"\n"+
"void secuencia() {\n"+
"sec_piso=1.-smoothstep(10.,20.,time);\n"+
"sec_agua=smoothstep(100.,110.,time)-smoothstep(120.,122.,time);\n"+
"sec_agua+=smoothstep(190.,200.,time)-smoothstep(220.,223.,time);\n"+
"sec_mosaicos=smoothstep(41.,42.,time);\n"+
"sec_montania=smoothstep(80.,88.,time)-smoothstep(120.,123.,time);\n"+
"sec_baile=.1+smoothstep(60.,62.,time)*.8;\n"+
"sec_baile+=.3*smoothstep(41.,42.,time);\n"+
"sec_baile*=1.-smoothstep(120.,123.,time)+smoothstep(140.,142.,time);\n"+
"sec_baile*=1.-smoothstep(220.,221.,time)+smoothstep(250.,251.,time);\n"+
"sec_baile*=1.-smoothstep(329.,331.,time);\n"+
"sec_baile*=1.-smoothstep(340.,342.,time);\n"+
"sec_horizonte=smoothstep(62.,80.,time)-smoothstep(120.,123.,time);\n"+
"sec_irvolver=(smoothstep(122.,126.,time)-smoothstep(138.,140.,time))*4.;\n"+
"sec_irvolver+=(smoothstep(220.,225.,time)-smoothstep(300.,305.,time))*4.;\n"+
"sec_constel=(smoothstep(220.,225.,time)-smoothstep(325.,332.,time));\n"+
"sec_rotacion=smoothstep(130.,141.,time);\n"+
"sec_final=smoothstep(347.,348.,time);\n"+
"sec_lluvia=min(.9,time*.2)-sec_final*.3*smoothstep(.5,1.,rnd1(floor(iGlobalTime*1.5)));\n"+
"sec_chaugato=smoothstep(340.,346.,time);\n"+
"sec_loca=smoothstep(250.,252.,time)-smoothstep(329.,331.,time);\n"+
"sec_luz=2.*pow(abs(ritmo1),.4)*step(0.,ritmo1)*step(61.5,time)*(1.-sec_irvolver/4.+sec_loca)*(1.-sec_chaugato);\n"+
"}\n"+
"\n"+
"\n"+
"\n"+
"void main()\n"+
"{\n"+
"secuencia();\n"+
"\n"+
"vec2 uv = -.458 + 2.0 *vUv*.456;\n"+
"\n"+
"float borde=.95*pow(smoothstep(.45,.5,max(abs(uv.x*1.05),abs(uv.y*1.1))),3.);\n"+
"uv.x*=iResolution.x/iResolution.y;\n"+
"uv.y+=.1;\n"+
"vec3 c = shade(uv)*step(-0.05,-borde);\n"+
"\n"+
"c+=borde;\n"+
"\n"+
"gl_FragColor = vec4(c,1.);\n"+
"}\n"