// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var ShitJustGotReal_frag =
"// https://www.shadertoy.com/view/Xdjczt\n"+
"// Created by db0x90\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform float iTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"// Shit just got real\n"+
"\n"+
"float bassAmp;\n"+
"float bassDrum;\n"+
"float width;\n"+
"\n"+
"vec2 foo(vec2 uv, float a, float b) {\n"+
"float f = sin(3. * iGlobalTime + uv.y * 9.0122);\n"+
"f *=     sin(uv.y * 11.961) * 1.122;\n"+
"f *=     sin(uv.y * 17.514) * 1.113;\n"+
"f *=     sin(uv.y * 23.734) * 1.76252;\n"+
"f *= b + sin(f + iGlobalTime * 122.) * .04123;\n"+
"f *= bassDrum*a;\n"+
"return vec2(uv.x + f, uv.y);\n"+
"}\n"+
"\n"+
"vec3 interference(vec2 fragCoord) {\n"+
"float y;\n"+
"\n"+
"float cX = iResolution.x/2.0;\n"+
"float cY = iResolution.y/2.0;\n"+
"\n"+
"float tr=iTime * 29.1;\n"+
"float tg=iTime * 28.5;\n"+
"float tb=iTime * 27.4;\n"+
"\n"+
"float fr=0.007  + (bassDrum*0.00004);\n"+
"float fg=0.0066 + (bassDrum*0.00002);\n"+
"float fb=0.008  + (bassDrum*0.00005);\n"+
"\n"+
"vec2 uvr=fragCoord.xy;\n"+
"uvr = foo(uvr, 200., 50.);\n"+
"uvr.x = uvr.x - cX + ( 1.2 * cos(tr*0.05)*cX )  + ( 1.1 * sin(tr*0.031)*cX );\n"+
"uvr.y = uvr.y - cY + ( 1.7 * sin(tr*0.023)*cY ) - ( 1.3 * cos(tr*0.037)*cY );\n"+
"y=length(floor(uvr));\n"+
"float rr = 0.85 * abs( sin( fr *(y-tr) ) );\n"+
"\n"+
"vec2 uvg=fragCoord.xy;\n"+
"uvg.x = uvg.x - cX + ( 2.2 * sin(tr*0.036)*cX ) - ( 1.4 * cos(tr*0.027)*cX );\n"+
"uvg.y = uvg.y + cY - ( 3.9 * sin(tr*0.023)*cY ) - ( 1.2 * cos(tr*0.037)*cY );\n"+
"y=length(floor(uvg));\n"+
"float gg = 0.85 * abs( sin( (y-tg) * fg) );\n"+
"\n"+
"vec2 uvb=fragCoord.xy;\n"+
"uvb = foo(uvb,225.,45.);\n"+
"uvb.x = uvb.x - cX - ( 1.10*cos(tb+0.6)*cX );\n"+
"uvb.y = uvb.y + cY - ( 0.92*sin(tb-0.6)*cY );\n"+
"y=length(floor(uvg));\n"+
"float bb = 0.85 * abs( sin( (y-tb) * fb) );\n"+
"\n"+
"float scanline = 1. + sin(fragCoord.y*.075) * bassDrum * 3.;\n"+
"\n"+
"return vec3(rr,gg,bb) * scanline;\n"+
"}\n"+
"\n"+
"float leafFX( float r, float t ) {\n"+
"float bass = bassDrum*2.8 + bassAmp;\n"+
"return 	(1.0+0.90 * cos(  8.* t) ) *\n"+
"(1.0+0.10 * cos( 24.* t) ) *\n"+
"( (0.7 + (bass*0.4) )+(bassAmp*0.16) * cos(110.* t) ) *\n"+
"(0.9+sin(t))\n"+
"- r;\n"+
"}\n"+
"\n"+
"float polar(vec2 fragCoord) {\n"+
"float r = length( fragCoord );\n"+
"float t = atan( fragCoord.y, fragCoord.x );\n"+
"return abs( leafFX(r,t) );\n"+
"}\n"+
"\n"+
"float hempleaf( vec2 fragCoord) {\n"+
"width = 1.0;// / min( iResolution.x ,iResolution.x);\n"+
"\n"+
"vec2 uv;\n"+
"uv.x = fragCoord.x*width*7.;\n"+
"uv.y = fragCoord.y*width*9.;\n"+
"uv = foo(uv,3.,.3);\n"+
"uv.y -= 0.65;\n"+
"uv.x -= 3.5;\n"+
"return 1.0 / max( polar(uv) / 0.22, 1.);\n"+
"}\n"+
"\n"+
"void sfft() {\n"+
"float bp = clamp( width,0.1,0.8);\n"+
"bassAmp  = texture(iAudioData, vec2(bp, 0.02)).x;\n"+
"\n"+
"bp = clamp( width,0.25,0.42);\n"+
"float xy = texture(iAudioData, vec2(bp, 0.1)).x;\n"+
"bassDrum =  smoothstep( 0.55, 1., xy);\n"+
"}\n"+
"\n"+
"void main( ) {\n"+
"//vec2 uv = fragCoord.xy/iResolution.xy*2.-1.;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"\n"+
"sfft();\n"+
"\n"+
"vec3 resultColor;\n"+
"//resultColor += interference( uv );\n"+
"resultColor += interference( vUv );\n"+
"//resultColor *= vec3( ( 1.0 - hempleaf(uv)));\n"+
"resultColor *= vec3( ( 1.0 - hempleaf(vUv)));\n"+
"//resultColor  = mix(vec3(0.),resultColor,pow(max(0.,1.5-length(uv*uv*uv*vec2(1.6,1.6))),.9));\n"+
"resultColor  = mix(vec3(0.),resultColor,pow(max(0.,1.5-length(uv*uv*uv*vec2(1.6,1.6))),.9));\n"+
"\n"+
"\n"+
"gl_FragColor = vec4( resultColor, 0.);\n"+
"}\n"