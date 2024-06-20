// https://www.shadertoy.com/view/Xt3XWf
// Modified by ArthurTent
// Created by gigatron
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform sampler2D iVideo;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec2 iResolution;
uniform vec2 iMouse;
varying vec2 vUv;


#define GAMMA 2.2
#define GLOW_INT 1.
#define PP_ACES 1.0
#define PP_CONT 0.5
#define PP_VIGN 1.3
#define AO_OCC .5
#define AO_SCA .3
#define PI 3.14159265
#define TAU 6.28318531
#define S(x,y,t) smoothstep(x,y,t)
#define sin3(x) sin(x)*sin(x)*sin(x)
#define Rot2D(p, a) p=cos(a)*p+sin(a)*vec2(p.y,-p.x)
float bass = 0.0;
float hi = 0.0;

// from QuantumSuper
vec4 fft, ffts; //compressed frequency amplitudes
void compressFft(){ //v1.2, compress sound in iAudioData to simplified amplitude estimations by frequency-range
    fft = vec4(0), ffts = vec4(0);

	// Sound (assume sound texture with 44.1kHz in 512 texels, cf. https://www.shadertoy.com/view/Xds3Rr)
    for (int n=0;n<3;n++) fft.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //bass, 0-517Hz, reduced to 0-258Hz
    for (int n=6;n<8;n++) ffts.x  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech I, 517-689Hz
    for (int n=8;n<14;n+=2) ffts.y  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech II, 689-1206Hz
    for (int n=14;n<24;n+=4) ffts.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //speech III, 1206-2067Hz
    for (int n=24;n<95;n+=10) fft.z  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //presence, 2067-8183Hz, tenth sample
    for (int n=95;n<512;n+=100) fft.w  += texelFetch( iAudioData, ivec2(n,0), 0 ).x; //brilliance, 8183-44100Hz, tenth2 sample
    fft.y = dot(ffts.xyz,vec3(1)); //speech I-III, 517-2067Hz
    ffts.w = dot(fft.xyzw,vec4(1)); //overall loudness
    fft /= vec4(3,8,8,5); ffts /= vec4(2,3,3,23); //normalize

	//for (int n=0;n++<4;) fft[n] *= 1. + .3*pow(fft[n],5.); fft = clamp(fft,.0,1.); //limiter? workaround attempt for VirtualDJ
}
vec4 PP(vec3 col, vec2 uv)
{
    col = mix(col, (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14), PP_ACES);
    col = mix(col, S(vec3(0), vec3(1), col), PP_CONT);
    col *= S(PP_VIGN,-PP_VIGN/5., dot(uv,uv));
    col = pow(col, vec3(1) / GAMMA);

    return vec4(col, 1.);
}
vec3 getCol(float id){ //v0.92, color definitions, for triplets
    vec3 setCol = vec3(0);
    id = mod(id,18.);
         if (id< 1.) setCol = vec3(244,  0,204); //vw2 pink
    else if (id< 2.) setCol = vec3(  0,250,253); //vw2 light blue
    else if (id< 3.) setCol = vec3( 30, 29,215); //vw2 blue
    else if (id< 4.) setCol = vec3(252,157,  0); //miami orange
    else if (id< 5.) setCol = vec3( 26,246,138); //miami green
    else if (id< 6.) setCol = vec3(131, 58,187); //nordic violet
    else if (id< 7.) setCol = vec3(231, 15, 20); //arena red
    else if (id< 8.) setCol = vec3( 35, 87, 97); //arena dark blue
    else if (id< 9.) setCol = vec3(103,211,225); //arena blue
    else if (id<10.) setCol = vec3(241,204,  9); //bambus2 yellow
    else if (id<11.) setCol = vec3( 22,242,124); //bambus2 green
    else if (id<12.) setCol = vec3( 30,248,236); //magic turquoise
    else if (id<13.) setCol = vec3(123, 23,250); //cneon pink
    else if (id<14.) setCol = vec3( 23,123,250); //cneon blue
    else if (id<15.) setCol = vec3( 73, 73,250); //cneon white
	else if (id<16.) setCol = vec3(173,  0, 27); //matrix red
    else if (id<17.) setCol = vec3( 28,142, 77); //matrix green
    else if (id<18.) setCol = vec3( 66,120, 91); //matrix green 2
    return setCol/256.;
}



// --- access to the image of ascii code c from Fabrice
vec4 char(vec2 pos, float c) {
    pos = clamp(pos,0.,1.);  // would be more efficient to exit if out.

    vec4 tx= texture( iChannel0, pos/16. + fract( floor(vec2(c, 15.999-c/16.)) / 16. ) )*2. ;
    //vec4 ty= texture( iChannel0, pos/16.012 + fract( floor(vec2(c, 15.999-c/16.012)) / 16.012 ) )/3.0 ;
    vec4 ty= texture( iChannel0, pos/16. + fract( floor(vec2(c, 15.999-c/16.012)) / 16.012 ) )/3.0 ;

    vec4 tz= texture( iChannel2,pos);

    return  vec4((tx+ty)/(tz*3.0));
    // possible variants: (but better separated in an upper function)
    //     - inout pos and include pos.x -= .5 + linefeed mechanism
    //     - flag for bold and italic
}


// Created by inigo quilez - iq/2013
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// a perspective correct triangle rasterizer, in a shader!! :D
// 2D
vec2 rotation(in float angle,in vec2 position,in vec2 center)
{
    //Function seen from https://www.shadertoy.com/view/XlsGWf
    float rot = radians(angle);
    mat2 rotation = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
    return vec2((position-center)*rotation);
}

mat4 setRotation( float x, float y, float z )
{
    float a = sin(x); float b = cos(x);
    float c = sin(y); float d = cos(y);
    float e = sin(z); float f = cos(z);

    float ac = a*c;
    float bc = b*c;

    return mat4( d*f,      d*e,       -c, 0.0,
                 ac*f-b*e, ac*e+b*f, a*d, 0.0,
                 bc*f+a*e, bc*e-a*f, b*d, 0.0,
                 0.0,      0.0,      0.0, 1.0 );
}

mat4 setTranslation( float x, float y, float z )
{
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 x,     y,   z, 1.0 );
}

struct Triangle
{
    vec3 a; vec2 aUV;
    vec3 b; vec2 bUV;
    vec3 c; vec2 cUV;
    vec3 n;
};


Triangle triangles[14];

void createCube( void )
{
    vec3 verts[8];

    verts[0] = vec3( -1.0, -1.0, -1.0 );
    verts[1] = vec3( -1.0, -1.0,  1.0 );
    verts[2] = vec3( -1.0,  1.0, -1.0 );
    verts[3] = vec3( -1.0,  1.0,  1.0 );
    verts[4] = vec3(  1.0, -1.0, -1.0 );
    verts[5] = vec3(  1.0, -1.0,  1.0 );
    verts[6] = vec3(  1.0,  1.0, -1.0 );
    verts[7] = vec3(  1.0,  1.0,  1.0 );

    triangles[0].a = verts[1]; triangles[0].aUV = vec2(0.0,0.0);
    triangles[0].b = verts[5]; triangles[0].bUV = vec2(1.0,0.0);
    triangles[0].c = verts[7]; triangles[0].cUV = vec2(1.0,1.0);
    triangles[0].n = vec3( 0.0, 0.0, 1.0 );
    triangles[1].a = verts[1]; triangles[1].aUV = vec2(0.0,0.0),
    triangles[1].b = verts[7]; triangles[1].bUV = vec2(1.0,1.0),
    triangles[1].c = verts[3]; triangles[1].cUV = vec2(0.0,1.0),
    triangles[1].n = vec3( 0.0, 0.0, 1.0 );

    triangles[2].a = verts[5]; triangles[2].aUV = vec2(0.0,0.0);
    triangles[2].b = verts[4]; triangles[2].bUV = vec2(1.0,0.0);
    triangles[2].c = verts[6]; triangles[2].cUV = vec2(1.0,1.0);
    triangles[2].n = vec3( 1.0, 0.0, 0.0 );
    triangles[3].a = verts[5]; triangles[3].aUV = vec2(0.0,0.0);
    triangles[3].b = verts[6]; triangles[3].bUV = vec2(1.0,1.0);
    triangles[3].c = verts[7]; triangles[3].cUV = vec2(0.0,1.0);
    triangles[3].n = vec3( 1.0, 0.0, 0.0 );

    triangles[4].a = verts[3]; triangles[4].aUV = vec2(0.0,0.0);
    triangles[4].b = verts[7]; triangles[4].bUV = vec2(1.0,0.0);
    triangles[4].c = verts[6];;triangles[4].cUV = vec2(1.0,1.0);
    triangles[4].n = vec3( 0.0, 1.0, 0.0 );
    triangles[5].a = verts[3]; triangles[5].aUV = vec2(0.0,0.0);
    triangles[5].b = verts[6]; triangles[5].bUV = vec2(1.0,1.0);
    triangles[5].c = verts[2]; triangles[5].cUV = vec2(0.0,1.0);
    triangles[5].n = vec3( 0.0, 1.0, 0.0 );

    triangles[6].a = verts[0]; triangles[6].aUV = vec2(1.0,0.0);
    triangles[6].b = verts[6]; triangles[6].bUV = vec2(0.0,1.0);
    triangles[6].c = verts[4]; triangles[6].cUV = vec2(0.0,0.0);
    triangles[6].n = vec3( 0.0, 0.0, -1.0 );
    triangles[7].a = verts[0]; triangles[7].aUV = vec2(1.0,0.0);
    triangles[7].b = verts[2]; triangles[7].bUV = vec2(1.0,1.0);
    triangles[7].c = verts[6]; triangles[7].cUV = vec2(0.0,1.0);
    triangles[7].n = vec3( 0.0, 0.0, -1.0 );

    triangles[8].a = verts[1]; triangles[8].aUV = vec2(1.0,0.0);
    triangles[8].b = verts[2]; triangles[8].bUV = vec2(0.0,1.0);
    triangles[8].c = verts[0]; triangles[8].cUV = vec2(0.0,0.0);
    triangles[8].n = vec3( -1.0, 0.0, 0.0 );
    triangles[9].a = verts[1]; triangles[9].aUV = vec2(1.0,0.0);
    triangles[9].b = verts[3]; triangles[9].bUV = vec2(1.0,1.0);
    triangles[9].c = verts[2]; triangles[9].cUV = vec2(0.0,1.0);
    triangles[9].n = vec3( -1.0, 0.0, 0.0 );

    triangles[10].a = verts[1]; triangles[10].aUV = vec2(0.0,0.0);
    triangles[10].b = verts[0]; triangles[10].bUV = vec2(0.0,1.0);
    triangles[10].c = verts[4]; triangles[10].cUV = vec2(1.0,1.0);
    triangles[10].n = vec3( 0.0, -1.0, 0.0 );
    triangles[11].a = verts[1]; triangles[11].aUV = vec2(0.0,0.0);
    triangles[11].b = verts[4]; triangles[11].bUV = vec2(1.0,1.0);
    triangles[11].c = verts[5]; triangles[11].cUV = vec2(1.0,0.0);
    triangles[11].n = vec3( 0.0, -1.0, 0.0 );
}

float crosse( vec2 a, vec2 b )
{
    return a.x*b.y - a.y*b.x;
}

vec3 lig = normalize( vec3( 0.3,0.7,0.5) );

vec3 pixelShader( in vec3 nor, in vec2 uv, in float z, in vec3 wnor )
{
    float dif = clamp( dot( nor, lig ), 0.0, 1.0 );
    float brdf = 0.5 + 0.8*dif;
    brdf *= 6.0*exp( -0.5*abs(z) );

    float tsin = sin(iAmplifiedTime/32.);
    vec3 mate = vec3(0.);
    if(tsin>0.5){
        mate = texture( iChannel1, uv ).xyz * abs(wnor.x)*fft.x +
               texture( iChannel1, uv ).xyz * abs(wnor.y) +
               texture( iChannel1, uv ).xyz * abs(wnor.z);
    }else{
	    mate = texture( iChannel3, uv ).xyz * abs(wnor.x)*fft.x +
		        texture( iChannel3, uv ).xyz * abs(wnor.y) +
		        texture( iChannel3, uv ).xyz * abs(wnor.z);
    }
    vec3 col = brdf * mate*fft.x;

    return sqrt( col );
}

vec3 getTexture(vec2 p){
    vec4 s = texture(iVideo, p);
    return s.xyz * s.w;
}

void main()
{
    compressFft();
    vec2 fragCoord = vUv * iResolution;
    //vec2 uv= fragCoord.xy/iResolution.xy;
    vec2 uv = -1.+2.*vUv;
    uv.x *= iResolution.x/iResolution.y;;

    float tcube=iTime;

        vec2 q=uv;

    mat4 mdv = setTranslation(-10.0+clamp( tcube*3.,-5.,10.0), 0.5, -5.0 ) *
		       setRotation( 0.6, 0.0,  0.0 ) *
		       setRotation( 3.1*sin(0.8*tcube), 2.1*sin(0.8*tcube), 0.7*sin(0.8*tcube) );

    // clamp rulez

    if(tcube>7.0) mdv = setTranslation( 0.0,-0.5+ 2.5*abs(sin(tcube))-0.9, -5.0 ) *
		       			setRotation( 0.6, 0.0,  0.0 ) *
		       			setRotation( 6.1*sin(0.8*tcube), 0.6*cos(0.8*tcube), 0.7*sin(0.8*tcube) );

    if(tcube>15.0) mdv = setTranslation( -0.5+ 4.5*sin(tcube)-0.5,-0.5+ 2.5*abs(sin(tcube))-0.9, -2.0-3.*abs(sin(tcube))-0.5 )
		       			 *
		       			setRotation( 6.1*sin(0.8*tcube), 2.1*sin(0.8*tcube), 0.7*sin(0.8*tcube) );


    if(tcube>25.0) mdv += setTranslation( -0.5+ 4.5*sin(tcube)-0.5,-0.5+ 2.5*abs(sin(tcube))-0.9, -2.0-3.*abs(sin(tcube))-0.5 )
		       			*
		       			setRotation( 6.1*sin(0.8*tcube), -5., 0.7*sin(0.8*tcube) );

    // you can manipulate timeline exactly in MC68000 Amiga Demo to make infinite fx !

    vec2 px = (-iResolution.xy + 2.0*fragCoord) / iResolution.y;



    createCube();




     vec3 color = vec3( 0.0, 0.0, 0.0 );

    // clear zbuffer
    float mindist = -1000000.0;

    // render 12 triangles
    for( int i=0; i<14; i++ )
    {
        // transform to eye space
        vec3 ep0 = (mdv * vec4(triangles[i].a,1.0)).xyz;
        vec3 ep1 = (mdv * vec4(triangles[i].b,1.0)).xyz;
        vec3 ep2 = (mdv * vec4(triangles[i].c,1.0)).xyz;
        vec3 nor = (mdv * vec4(triangles[i].n,0.0)).xyz;

        // transform to clip space
        float w0 = 1.0/ep0.z;
        float w1 = 1.0/ep1.z;
        float w2 = 1.0/ep2.z;

        vec2 cp0 = 2.0*ep0.xy * -w0;
        vec2 cp1 = 2.0*ep1.xy * -w1;
        vec2 cp2 = 2.0*ep2.xy * -w2;

        // fetch vertex attributes, and divide by z
        vec2 u0 = triangles[i].aUV * w0;
        vec2 u1 = triangles[i].bUV * w1;
        vec2 u2 = triangles[i].cUV * w2;

        //-----------------------------------
        // rasterize
        //-----------------------------------

        // calculate areas for subtriangles
        vec3 di = vec3( crosse( cp1 - cp0, px - cp0 ),
					    crosse( cp2 - cp1, px - cp1 ),
					    crosse( cp0 - cp2, px - cp2 ) );

        // if all positive, point is inside triangle
        if( all(greaterThan(di,vec3(0.0))) )
        {
            // calc barycentric coordinates
            vec3 ba = di.yzx / (di.x+di.y+di.z);

            // barycentric interpolation of attributes and 1/z
            float iz = ba.x*w0 + ba.y*w1 + ba.z*w2;
            vec2  uv = ba.x*u0 + ba.y*u1 + ba.z*u2;

            // recover interpolated attributes
            float z = 1.0/iz;
            uv *= z;

			// depth (-1/z) buffer test
			if( z>mindist )
			{
				mindist = z;

				// perform lighting/shading
				color = pixelShader( nor, uv, z, triangles[i].n );
			}
        }
    }

    gl_FragColor += vec4(color,1.0);


	float time=iTime*1.0;
	vec2 uvp = (fragCoord.xy / iResolution.xx-0.5)*8.0;

	float i0=1.0;
	float i1=1.0;
	float i2=1.0;
	float i4=0.0;
	for(int s=0;s<7;s++)
	{
		vec2 r;
		r=vec2(cos(uvp.y*i0-i4+time/i1),sin(uvp.x*i0-i4+time/i1))/i2;
        r+=vec2(-r.y,r.x)*0.3;
		uvp.xy+=r;

		i0*=1.93;
		i1*=1.15;
		i2*=1.7;
		i4+=0.05+0.1*time*i1;
	}
    float r=sin(uvp.x-time)*0.5+0.5;
    float b=sin(uvp.y+time)*0.5+0.5;
    float g=sin((uvp.x+uvp.y+sin(time*0.5))*0.5)*0.5+0.5;
	gl_FragColor += vec4(r,g,b,1.0)/3.0;





   float t =mod(1.+iTime*20.,180.0);

  q *= 3.0;
  q.x -=.2;
  q.y -=.8;
  vec2 base_pos = q;
  base_pos.x += 2.5;
  base_pos.y += 2.3;
  vec3 cbase = getTexture(base_pos);
  gl_FragColor += vec4(cbase, 1.0);
  q.y += 2.9;
  q.x += 1.8;
  if(t>100.) {
   q.y -=0.8-(t/30.)+2.80;
  }

    gl_FragColor += char(q-vec2(max(4.2-t,-.2*fft.x),0.5),99.) .x;      q.x-=.5;
    gl_FragColor += char(q-vec2(max(4.2-(t-5.),-.2*fft.x),0.5),45.) .x;      q.x-=.5;
    gl_FragColor += char(q-vec2(max(4.2-(t-10.),-.2*fft.x),0.5),98.) .x;      q.x-=.5;
    gl_FragColor += char(q-vec2(max(4.2-(t-15.),-.2*fft.x),0.5),97.) .x;      q.x-=.5;
    gl_FragColor += char(q-vec2(max(4.2-(t-20.),-.2*fft.x),0.5),115.) .x;      q.x-=.5;

    float tsin = sin(iAmplifiedTime/32.);
    if(tsin>0.8){
        gl_FragColor += char(q-vec2(max(4.2-(t-25.), -.2*fft.x), 0.5), 101.) .x;      q.x-=.5;
    } else if(tsin>0.45) {
        float rot = radians(iTime * 45.0);
        q-=.5;
        mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
        q  = m * q;
        gl_FragColor += char(q-vec2(max(4.2-(t-25.+fft.x), -.2*ffts.x), 0.5), 101.) .x;      q.x-=.5;
        q+=.5;
    } else if(tsin>0.25) {
        float rot = radians(iTime * 45.0);
        q-=.5;
        mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
        q  = m * q;
        gl_FragColor += char(q-vec2(max(4.2-(t-25.*ffts.w/2.), -.2*ffts.w), 0.5), 101.) .x;      q.x-=.5;
        q+=.5;
    }else{
        gl_FragColor += char(q-vec2(max(4.2-(t-50.*fft.x), -.2*fft.x), 0.5), 101.) .x;      q.x-=.5;
    }

    /*
  gl_FragColor += char(q-vec2(max(4.2-t,-.2),0.5),83.) .x;      q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-5.),-.2),0.5),104.) .x; q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-10.),-.2),0.5),97.) .x; q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-15.),-.2),0.5),100.) .x; q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-20.),-.2),0.5),101.) .x; q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-25.),-.2),0.5),114.) .x; q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-30.),-.2),0.5),65.) .x; q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-35.),-.2),0.5),109.) .x; q.x-=.5;

  gl_FragColor += char(q-vec2(max(4.2-(t-40.),-.2),0.5),112.) .x; q.x-=.5;

    */

  float colId = 2. * floor(mod(iAmplifiedTime,4.));
  //vec3 finalColor = mat3(getCol(colId),getCol(colId+1.),getCol(colId+2.));
  //gl_FragColor += PP(finalColor, uv);

  gl_FragColor.xyz = mat3(getCol(colId+ffts.w*2.),getCol(colId+1.),getCol(colId+2.*fft.x)) * gl_FragColor.xyz;
  float tc=iTime;
  if(t>48.) gl_FragColor *= vec4(0.5+0.5*sin(tc*1.2),0.5+0.5*sin(tc*1.4),0.5+0.5*sin(tc*1.8),1.0);


}