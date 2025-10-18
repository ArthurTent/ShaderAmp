#ifdef GL_ES
precision mediump float;
#endif

uniform vec3      iResolution;
uniform float     iTime;
uniform float iAmplifiedTime;
uniform sampler2D iChannel0; // expects BufferB output
uniform sampler2D iChannel1; // overlay texture

varying vec2 vUv;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy/iResolution.xy;
        
    float b = step(fract(uv.y * 50.0 + iAmplifiedTime), 0.5);
	vec4 tex = texture(iChannel0, uv);
    vec4 tex2 = texture(iChannel0, uv + vec2((b - 0.5)*0.005, 0.0));
    
    vec2 vign = smoothstep(vec2(0.5, 1.5), vec2(1.0, 0.98 + b*0.02), vec2(length(uv - 0.5) * 2.0)); 
       
    vec4 grain = texture(iChannel1, fragCoord.xy/256.0 + vec2(0.0, iAmplifiedTime*10.0));
    vec4 res = mix(tex, vec4(tex.x, tex.y, tex2.z, tex.w), vign.x);
    vec4 col = res * vign.y * (0.85 + grain*0.15);
	fragColor = pow(col*1.75, vec4(1.25));
}

void main() {
	vec2 fragCoord = vUv * iResolution.xy;
	mainImage(gl_FragColor, fragCoord);
}