// This file use the same license as the original shader.
// DO NOT MODIFY THIS FILE!
// Modify the .frag file instead and use:
// "python3 shader_to_js.py" to compile your changes !

var ReadyPlayerOne_frag =
"// https://www.shadertoy.com/view/Xd2fD1\n"+
"// [SH17A]READY PLAYER ONE By Nestor Vina\n"+
"// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n"+
"// totally messed up by Arthur Tent\n"+
"// to do: fix\n"+
"\n"+
"uniform float iGlobalTime;\n"+
"uniform sampler2D iAudioData;\n"+
"uniform sampler2D iChannel0;\n"+
"uniform sampler2D iChannel1;\n"+
"uniform vec2 iResolution;\n"+
"uniform vec2 iMouse;\n"+
"varying vec2 vUv;\n"+
"\n"+
"void main()\n"+
"{\n"+
"vec4 p = vec4( 10., -.9 + sin(iGlobalTime), -iGlobalTime, 0 );\n"+
"vec4 t=gl_FragColor-=gl_FragColor;\n"+
"vec2 f = -1.0 + 2.0 *vUv +.35;// +0.35;\n"+
"for( int i = 0; i++ < 99; t=texture( iChannel1, p.xz * 0.0525 ) )\n"+
"p += vec4( f / vUv.x - 1.01, .5, 0 ) * ( p.y + 2. )*0.5, //* 2.2,\n"+
"t.b > 1.525 - texture(iAudioData, vec2( .04 * t.r * t.r * 30., 2.25*float(i) )).r  ? gl_FragColor += t*.015 : gl_FragColor;//+=sin(iGlobalTime)/10.;\n"+
"\n"+
"gl_FragColor *= gl_FragColor * vec4( .9, .8, 1.5*sin(iGlobalTime), .5 );\n"+
"gl_FragColor *= pow(max(gl_FragColor - .2, 0.), vec4(1.4)) * .5;\n"+
"}\n"+
"\n"