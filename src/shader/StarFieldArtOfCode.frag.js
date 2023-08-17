// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var StarFieldArtOfCode_frag =
"// https://www.shadertoy.com/view/flBSWh\n"+
"// Star Field - the Art of code by Chriscamplin\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"\n"+
"// https://threejs.org/examples/webgl_materials_video_webcam.html\n"+
"\n"+
"#define PI 3.14159265358979323846\n"+
"#define PI2 6.28318530718\n"+
"#define NUM_LAYERS 6.\n"+
"\n"+
"varying vec2 vUv;\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iVideo;\n"+
"\n"+
"mat2 rot2D(float a) {\n"+
"float s = sin(a);\n"+
"float c = cos(a);\n"+
"return mat2(c, -s, s, c);\n"+
"}\n"+
"\n"+
"float Hash21(vec2 p) {\n"+
"p = fract(p*vec2(123.34, 465.21));\n"+
"p += dot(p, p+45.32);\n"+
"return fract(p.x * p.y);\n"+
"}\n"+
"\n"+
"float Star(vec2 uv, float flare) {\n"+
"// star\n"+
"float d = length(uv);\n"+
"float m = 0.05/d;\n"+
"\n"+
"float rays = max(0., 1.-abs(uv.x*uv.y*1000.));\n"+
"m+=rays*flare;\n"+
"uv *= rot2D(PI*.25);\n"+
"rays = max(0., 1.-abs(uv.x*uv.y*1000.));\n"+
"m += rays*.3*flare;\n"+
"\n"+
"// prevent glow bleeding into neighbouring cells\n"+
"m *= smoothstep(.75, .2, d);\n"+
"return m;\n"+
"}\n"+
"\n"+
"vec3 StarLayer(vec2 uv, float snd) {\n"+
"vec3 col = vec3(0.);\n"+
"// fract & floor 2 sides of the same coin\n"+
"// grid coord\n"+
"vec2 gv = fract(uv)-.5;\n"+
"// Tile ID\n"+
"vec2 id = floor(uv);\n"+
"// iterate through getting neighbours by offset\n"+
"for(float y=-1.;y<=1.;y++) {\n"+
"for(float x=-1.;x<=1.;x+=1.) {\n"+
"vec2 offset = vec2(x, y);\n"+
"float n = Hash21(id+offset);// rand between 0 & 1\n"+
"float size =  snd;\n"+
"vec3 color = sin(vec3(.2, .3, .9)*fract(n*2345.2)*PI2*20.)*.5+.5;\n"+
"color *= color *vec3(1., .5, 1.+size);\n"+
"float star = Star(gv-offset-vec2(n-.5, fract(n*34.))+.5, smoothstep(.9, 1., size));\n"+
"col += star * size * color;\n"+
"}\n"+
"}\n"+
"return col;\n"+
"\n"+
"}\n"+
"\n"+
"void main()\n"+
"{\n"+
"// Normalized pixel coordinates (from -1 to 1) with aspect ratio fix\n"+
"//vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;\n"+
"//vec2 uv = -1.0 + 2.0 *vUv;\n"+
"vec2 uv = -1.0 + 2.0 *vUv;\n"+
"// actual uv normalised 0-1;\n"+
"//vec2 UV = vUv.xy/iResolution.xy;\n"+
"//vec2 UV = vUv.xy;\n"+
"vec2 UV = vUv.xy;\n"+
"uv*=4.;\n"+
"float t = iGlobalTime*.05;\n"+
"uv*=rot2D(t);\n"+
"vec3 snd = texture(iAudioData, UV).rgb;\n"+
"//vec3 vid = texture(iChannel0, UV-(snd.x*.05)).rgb;\n"+
"//vec3 vid = texture(iVideo, UV-(snd.x*.05)).rgb;\n"+
"//vec3 vid = texture(iVideo, UV-(snd.x*.05)).rgb;\n"+
"vec3 vid = texture(iVideo, UV-(snd.x*0.01)).rgb;\n"+
"uv = uv *vid.rb;\n"+
"//for(int i = 0; i< 1;i++) {\n"+
"//uv = abs(uv)/abs(dot(uv, uv))-vec2(vid.x);\n"+
"//}\n"+
"//  bg color\n"+
"vec3 col = vec3(0.);\n"+
"for(float i = 0.; i<1.;i+=1./NUM_LAYERS) {\n"+
"float depth = fract(i+t);\n"+
"float scl = mix(20., snd.x, depth);\n"+
"float fade = depth*smoothstep(1.,0.9, depth);\n"+
"col+= StarLayer(uv*scl+i*453.2, snd.x*5.)*fade;\n"+
"}\n"+
"// add red border to grid for debugging\n"+
"//if(gv.x>.48||gv.y>.48) col.r=1.;\n"+
"\n"+
"//col.rb += id * .4;\n"+
"//col += Hash21(id);\n"+
"// Output to screen\n"+
"gl_FragColor = vec4(col,1.0);\n"+
"}\n"