// https://www.shadertoy.com/view/fXc3zB
// Modified by ShaderAmp Converter
// Created by ArthurTent
// Original Shader Name: MirrorOnTheWalls?audio:mirror 2 - Buffer A
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// https://creativecommons.org/licenses/by-nc-sa/3.0/

uniform float iAmplifiedTime;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iDate;
uniform sampler2D iAudioData;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iKeyboard;

varying vec2 vUv;

#define MAX_STEPS 80
#define SURF_DIST 0.002
#define MAX_DIST 30.0
#define GREEN_SCREEN 1

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

vec3 getMiniUfoPos(int j, float t) {
    float st = t * 1.1 + float(j) * 1.57;
    return vec3(cos(st) * 5.0, sin(st * 1.3) * 2.2, sin(st) * 5.0);
}

float sdMiniUfos(vec3 p, float t, float pulse) {
    float dTotal = 9999.0;
    for(int j = 0; j < 4; j++) {
        vec3 spos = getMiniUfoPos(j, t);
        vec3 q = p - spos;
        
        float lt = t * 2.5 + float(j);
        mat3 r = mat3(cos(lt), 0., sin(lt), 0., 1., 0., -sin(lt), 0., cos(lt));
        q = q * r;
        
        vec3 k = q * vec3(1.0, 2.8, 1.0);
        float radius = 0.35 + pulse * 0.12; 
        float d = (length(k) - radius) * 0.35;
        
        dTotal = min(dTotal, d);
    }
    return dTotal;
}

vec3 getUfoBeamDir(int j, float t) {
    float lt = t * 2.5 + float(j); 
    float spread = 0.6; 
    return normalize(vec3(sin(lt) * spread, -1.0, cos(lt) * spread));
}

vec3 getUfoBeamCol(int j, float t) {
    float phase = t * 0.8 + float(j) * 2.0; 
    return 0.5 + 0.5 * cos(phase + vec3(0.0, 2.0, 4.0));
}

vec3 lpos1(float t) { return vec3(sin(t)*3.5, 2.0, cos(t*1.2)*2.0); }
vec3 ldir1(float t) { return normalize(vec3(0.0, -1.0, 0.5)); }
const vec3 lcol1 = vec3(1.0, 0.1, 0.6); 

vec3 lpos2(float t) { return vec3(cos(t*0.8)*3.5, -2.0, sin(t*1.1)*2.0); }
vec3 ldir2(float t) { return normalize(vec3(0.0, 1.0, 0.5)); }
const vec3 lcol2 = vec3(0.1, 1.0, 0.4); 

vec3 lpos3(float t) { return vec3(sin(t*1.3)*2.0, sin(t)*3.0, cos(t*0.9)*2.0); }
vec3 ldir3(float t) { return normalize(vec3(0.0, 0.0, 1.0)); }
const vec3 lcol3 = vec3(0.2, 0.5, 1.0); 

float scene(vec3 p, float t, float pulse) {
    float coobs = 9999.; 
    for(int i = -2; i < 2; i++) {
        float lt = t + float(i+2);
        
        mat3 r1 = mat3(1., 0., 0., 0., cos(lt), -sin(lt), 0., sin(lt), cos(lt));
        mat3 r2 = mat3(cos(lt), 0., sin(lt), 0., 1., 0., -sin(lt), 0., cos(lt));
        mat3 r3 = mat3(cos(lt/2.), -sin(lt/2.), 0., sin(lt/2.), cos(lt/2.), 0., 0., 0., 1.);
        
        mat3 r = r1 * r2 * r3;
        vec3 offset = vec3(float(i)*2.5, 0., 0.);
        
        float d = sdBox((p + offset) * r, vec3(1.0 + pulse));
        coobs = min(d, coobs);
    }
    
    float miniUfosD = sdMiniUfos(p, t, pulse);
    float objects = smin(coobs, miniUfosD, 0.45);
    
    float floorD = p.y + 3.5;
    float ceilD  = 8.0 - p.y;
    float wallX  = 12.0 - abs(p.x);
    float wallZ  = 12.0 - abs(p.z);
    float room = min(min(floorD, ceilD), min(wallX, wallZ));
    
    return min(objects, room);    
}

float cubeIntersection(vec3 p, float t, float pulse) {
    float d1 = 9999.;
    float d2 = 9999.;
    for(int i = -2; i < 2; i++) {
        float lt = t + float(i+2);
        mat3 r1 = mat3(1., 0., 0., 0., cos(lt), -sin(lt), 0., sin(lt), cos(lt));
        mat3 r2 = mat3(cos(lt), 0., sin(lt), 0., 1., 0., -sin(lt), 0., cos(lt));
        mat3 r3 = mat3(cos(lt/2.), -sin(lt/2.), 0., sin(lt/2.), cos(lt/2.), 0., 0., 0., 1.);
        mat3 r = r1 * r2 * r3;
        vec3 offset = vec3(float(i)*2.5, 0., 0.);
        
        float d = sdBox((p + offset) * r, vec3(1.0 + pulse));
        if(d < d1) { d2 = d1; d1 = d; }
        else if(d < d2) { d2 = d; }
    }
    return d2;
}

vec3 normal(vec3 p, float t, float pulse) {
    vec2 e = vec2(1.0, -1.0) * 0.5773 * 0.002;
    return normalize(
        e.xyy * scene(p + e.xyy, t, pulse) + 
        e.yyx * scene(p + e.yyx, t, pulse) + 
        e.yxy * scene(p + e.yxy, t, pulse) + 
        e.xxx * scene(p + e.xxx, t, pulse)
    );
}

vec3 getVolumetrics(vec3 pos, float stepSize, float t, float lightFlare, float bass) {
    vec3 glow = vec3(0.0);
    
    vec3 p1 = pos - lpos1(t); float l1 = max(length(p1), 0.001);
    float spot1 = pow(max(0.0, dot(p1/l1, ldir1(t))), 12.0);
    glow += lcol1 * spot1 * (0.2 * lightFlare) / (1.0 + l1*l1);

    vec3 p2 = pos - lpos2(t); float l2 = max(length(p2), 0.001);
    float spot2 = pow(max(0.0, dot(p2/l2, ldir2(t))), 12.0);
    glow += lcol2 * spot2 * (0.2 * lightFlare) / (1.0 + l2*l2);

    vec3 p3 = pos - lpos3(t); float l3 = max(length(p3), 0.001);
    float spot3 = pow(max(0.0, dot(p3/l3, ldir3(t))), 12.0);
    glow += lcol3 * spot3 * (0.2 * lightFlare) / (1.0 + l3*l3);

    float ufoBeamTrigger = pow(smoothstep(0.35, 0.9, bass), 3.0);
    if (ufoBeamTrigger > 0.01) {
        for(int j = 0; j < 4; j++) {
            vec3 upos = getMiniUfoPos(j, t);
            vec3 beamDir = getUfoBeamDir(j, t);
            vec3 beamCol = getUfoBeamCol(j, t);
            
            vec3 pu = pos - upos;
            float lu = max(length(pu), 0.001);
            float cone = pow(max(0.0, dot(pu / lu, beamDir)), 16.0); 
            glow += beamCol * cone * (1.5 * ufoBeamTrigger) / (1.0 + lu * lu * 0.15);
        }
    }
    return glow * min(stepSize, 0.5);
}

vec4 render(float t, vec2 fragCoord, float bass, float treble, int seqIndex) {
    float pulse = pow(smoothstep(0.15, 1.0, bass), 3.0) * 0.7; 
    float lightFlare = 1.0 + smoothstep(0.3, 1.0, bass) * 4.0;

    float onsetStrobe = smoothstep(0.55, 0.9, treble);
    if (onsetStrobe > 0.05) {
        float flash = step(0.5, fract(t * 8.0)); 
        lightFlare *= mix(1.0, 2.5, onsetStrobe * flash); 
    }

    float camT = t * 0.3;
    float roll = 0.0;
    vec3 ro, ta;
    
    if (seqIndex == 0) {
        ro = vec3(sin(camT * 2.0) * 7.0, 4.0 - sin(camT)*2.0, cos(camT * 2.0) * 7.0);
        ta = vec3(0.0, 0.0, 0.0);
        roll = camT * 1.5; 
    } else if (seqIndex == 1) {
        ro = vec3(sin(camT * 3.0) * 5.0, sin(camT * 6.0) * 2.0, cos(camT * 2.5) * 5.0);
        ta = vec3(cos(camT * 2.0) * 1.0, 0.0, sin(camT * 2.0) * 1.0);
        roll = sin(camT * 3.0) * 0.8;
    } else if (seqIndex == 2) {
        float beatStep = t * 2.0 + pow(bass, 4.0) * 3.0; 
        ro = vec3(sin(beatStep * 0.5) * 8.0, -2.0, cos(beatStep * 0.5) * 8.0);
        ta = vec3(0.0, 1.0, 0.0);
        roll = 0.3; 
    } else if (seqIndex == 3) {
        ro = vec3(sin(camT * 2.5) * 3.0, 6.0, cos(camT * 2.5) * 3.0);
        ta = vec3(sin(camT * 5.0) * 4.0, -4.0, cos(camT * 5.0) * 4.0);
        roll = camT * 2.0;
    } else if (seqIndex == 4) {
        ro = vec3(sin(camT * 3.0) * 9.0, -1.5 + sin(camT * 4.0) * 1.5, cos(camT * 3.0) * 9.0);
        ta = vec3(0.0, 1.0, 0.0);
        roll = -0.15;
    } else if (seqIndex == 5) {
        ro = vec3(sin(camT * 1.2) * 11.2, 5.5, cos(camT * 1.2) * 11.2);
        ta = vec3(sin(camT * 0.8) * 2.0, -1.0, cos(camT * 0.8) * 2.0);
        roll = sin(camT * 0.5) * 0.25;
    } else if (seqIndex == 6) {
        ro = vec3(sin(camT * 2.5) * 5.5, 4.0 + sin(camT * 1.5) * 1.5, cos(camT * 2.0) * 5.5);
        ta = vec3(0.0, -1.0, 0.0);
        roll = camT * 3.0;
    } else if (seqIndex == 7) {
        ro = vec3(-8.5 + sin(camT * 2.0) * 1.5, 2.0 + cos(camT * 3.0) * 3.0, sin(camT * 5.0) * 8.0);
        ta = vec3(0.0, sin(camT * 4.0) * 2.0, 0.0);
        roll = sin(camT * 4.0) * 1.2;
    } else if (seqIndex == 8) {
        float floorShake = pow(bass, 3.0) * 0.35;
        ro = vec3(cos(camT * 3.5) * 8.5, -3.1 + floorShake, sin(camT * 3.5) * 8.5);
        ta = vec3(sin(camT * 2.0) * 3.0, 2.5 + sin(camT * 3.0), cos(camT * 2.0) * 3.0);
        roll = -0.4 + sin(camT * 5.0) * 0.3;
    } else if (seqIndex == 9) {
        vec3 ufoTarget = getMiniUfoPos(0, t);
        ro = ufoTarget + vec3(sin(camT * 2.0) * 4.0, 3.0, cos(camT * 2.0) * 4.0);
        ta = ufoTarget + vec3(sin(t * 10.0) * pow(bass, 4.0), pow(bass, 3.0) * 2.5, cos(t * 10.0) * pow(bass, 4.0));
        roll = sin(camT * 3.0) * 0.4;
    } else if (seqIndex == 10) {
        ro = vec3(sin(camT * 4.0) * 6.0, 1.5, cos(camT * 4.0) * 6.0);
        ta = vec3(0.0, pow(bass, 3.0) * 2.0, 0.0);
        roll = camT * 3.5;
    } else if (seqIndex == 11) {
        ro = vec3(sin(camT * 4.0) * 6.0, 1.5, cos(camT * 4.0) * 6.0);
        ta = vec3(0.0, pow(bass, 3.0) * 2.0, 0.0);
        roll = camT * 3.5;
    } else {
        vec3 ufoTarget = getMiniUfoPos(2, t);
        ro = ufoTarget + vec3(0.0, -2.5 - pow(bass, 2.0) * 0.5, 0.0);
        ta = ufoTarget;
        roll = camT * 0.5;
    }
    vec3 up = vec3(sin(roll), cos(roll), 0.0);
    vec3 ww = normalize(ta - ro);
    if (abs(dot(ww, up)) > 0.98) {
        up = vec3(0.0, 0.0, 1.0);
    }
    vec3 uu = normalize(cross(ww, up));
    vec3 vv = normalize(cross(uu, ww));
    /*
    vec3 up = vec3(sin(roll), cos(roll), 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, up));
    vec3 vv = normalize(cross(uu, ww));
    */
    
    vec2 p = (fragCoord.xy - iResolution.xy * .5) / iResolution.y;
    
    float opticalPump = 1.0 - (pulse * 0.45);
    vec3 dir = normalize(p.x*uu + p.y*vv + opticalPump*ww); 
    
    vec3 volGlow = vec3(0.0);
    float distWalked = 0.0;
    vec3 pos = ro;
    
    for(int i = 0; i < MAX_STEPS; i++) {
        float dist = scene(pos, t, pulse);
        volGlow += getVolumetrics(pos, dist, t, lightFlare, bass);
        if(dist < SURF_DIST * (1.0 + distWalked * 0.05) || distWalked > MAX_DIST) break;
        pos += dist*dir;
        distWalked += dist;
    }

    vec3 col = vec3(0.0);
    
    if(distWalked < MAX_DIST) {
        bool isMirror = (pos.y < -3.4 || pos.y > 7.9 || abs(pos.x) > 11.9 || abs(pos.z) > 11.9);
        vec3 nrm = normal(pos, t, pulse);
        
        vec3 viewDir = -dir;
        
        float cDist = 9999.;
        for(int i = -2; i < 2; i++) {
            float lt = t + float(i+2);
            mat3 r1 = mat3(1., 0., 0., 0., cos(lt), -sin(lt), 0., sin(lt), cos(lt));
            mat3 r2 = mat3(cos(lt), 0., sin(lt), 0., 1., 0., -sin(lt), 0., cos(lt));
            mat3 r3 = mat3(cos(lt/2.), -sin(lt/2.), 0., sin(lt/2.), cos(lt/2.), 0., 0., 0., 1.);
            mat3 r = r1 * r2 * r3;
            vec3 offset = vec3(float(i)*2.5, 0., 0.);
            float d = sdBox((pos + offset) * r, vec3(1.0 + pulse));
            cDist = min(cDist, d);
        }
        float uDist = sdMiniUfos(pos, t, pulse);
        bool isCube = cDist < uDist;
        vec3 cubeCol = vec3(0.10, 0.11, 0.13);
        if (isCube) {
            float minDist = 9999.0;
            vec2 uvCoord = vec2(0.0);
            for(int i = -2; i < 2; i++) {
                float lt = t + float(i+2);
                mat3 r1 = mat3(1., 0., 0., 0., cos(lt), -sin(lt), 0., sin(lt), cos(lt));
                mat3 r2 = mat3(cos(lt), 0., sin(lt), 0., 1., 0., -sin(lt), 0., cos(lt));
                mat3 r3 = mat3(cos(lt/2.), -sin(lt/2.), 0., sin(lt/2.), cos(lt/2.), 0., 0., 0., 1.);
                mat3 r = r1 * r2 * r3;
                vec3 offset = vec3(float(i)*2.5, 0., 0.);
                vec3 q = (pos + offset) * r;
                float d = sdBox(q, vec3(1.0 + pulse));
                if(d < minDist) {
                    minDist = d;
                    vec3 b = vec3(1.0 + pulse);
                    vec3 qa = abs(q);
                    if(qa.x > qa.y && qa.x > qa.z) {
                        uvCoord = q.yz / (2.0 * b.yz) + 0.5;
                    } else if(qa.y > qa.x && qa.y > qa.z) {
                        uvCoord = q.xz / (2.0 * b.xz) + 0.5;
                    } else {
                        uvCoord = q.xy / (2.0 * b.xy) + 0.5;
                    }
                }
            }
            cubeCol = texture(iChannel2, uvCoord).rgb;
            #if GREEN_SCREEN
            float gDist = cubeCol.g - max(cubeCol.r, cubeCol.b);
            if(gDist > 0.3) cubeCol = vec3(0.10, 0.11, 0.13);
            #endif
        }
        vec3 albedo = isMirror ? vec3(0.0) : (isCube ? cubeCol : vec3(0.10, 0.11, 0.13)); 
        
        float diffMult = isMirror ? 0.02 : 1.0; 
        float specMult = isMirror ? 0.4  : 1.5;
        vec3 lighting = vec3(0.0);
        
        if(isMirror) {
            float edgeX = abs(12.0 - abs(pos.x));
            float edgeZ = abs(12.0 - abs(pos.z));
            float edgeY = min(abs(pos.y + 3.5), abs(8.0 - pos.y));
            float eX = exp(-edgeX * 120.0);
            float eZ = exp(-edgeZ * 120.0);
            float eY = exp(-edgeY * 120.0);
            float edgeWeight = clamp(eX*eZ + eX*eY + eZ*eY, 0.0, 1.0);
            lighting += vec3(0.2, 0.25, 0.3) * edgeWeight * lightFlare; 
        } else {
            float interDist = cubeIntersection(pos, t, pulse);
            lighting += vec3(0.35, 0.40, 0.45) * exp(-interDist * 25.0) * 1.5 * lightFlare;
        }

        vec3 to1 = lpos1(t) - pos; float dl1 = max(length(to1), 0.001); to1 /= dl1;
        float atten1 = pow(max(0.0, dot(-to1, ldir1(t))), 4.0) / (1.0 + dl1*dl1 * 0.2);
        vec3 h1 = normalize(to1 + viewDir);
        lighting += lcol1 * atten1 * 12.0 * lightFlare * (albedo * max(0.0, dot(nrm, to1)) * diffMult + vec3(pow(max(0.0, dot(nrm, h1)), 48.0)) * specMult);

        vec3 to2 = lpos2(t) - pos; float dl2 = max(length(to2), 0.001); to2 /= dl2;
        float atten2 = pow(max(0.0, dot(-to2, ldir2(t))), 4.0) / (1.0 + dl2*dl2 * 0.2);
        vec3 h2 = normalize(to2 + viewDir);
        lighting += lcol2 * atten2 * 12.0 * lightFlare * (albedo * max(0.0, dot(nrm, to2)) * diffMult + vec3(pow(max(0.0, dot(nrm, h2)), 48.0)) * specMult);
        
        vec3 to3 = lpos3(t) - pos; float dl3 = max(length(to3), 0.001); to3 /= dl3;
        float atten3 = pow(max(0.0, dot(-to3, ldir3(t))), 4.0) / (1.0 + dl3*dl3 * 0.2);
        vec3 h3 = normalize(to3 + viewDir);
        lighting += lcol3 * atten3 * 12.0 * lightFlare * (albedo * max(0.0, dot(nrm, to3)) * diffMult + vec3(pow(max(0.0, dot(nrm, h3)), 48.0)) * specMult);

        float ufoBeamTrigger = pow(smoothstep(0.35, 0.9, bass), 3.0);
        if (ufoBeamTrigger > 0.01) {
            for(int j = 0; j < 4; j++) {
                vec3 upos = getMiniUfoPos(j, t);
                vec3 beamDir = getUfoBeamDir(j, t);
                vec3 beamCol = getUfoBeamCol(j, t);
                
                vec3 toBeam = upos - pos;
                float dlb = max(length(toBeam), 0.001);
                vec3 nToBeam = toBeam / dlb;
                float coneSpot = pow(max(0.0, dot(-nToBeam, beamDir)), 14.0);
                float attenBeam = coneSpot * ufoBeamTrigger * 12.0 / (1.0 + dlb * dlb * 0.25);
                vec3 hBeam = normalize(nToBeam + viewDir);
                lighting += beamCol * attenBeam * (albedo * max(0.0, dot(nrm, nToBeam)) * diffMult + vec3(pow(max(0.0, dot(nrm, hBeam)), 32.0)) * specMult);
            }
        }

        float fresnel = pow(clamp(1.0 - dot(viewDir, nrm), 0.0, 1.0), 5.0);
        float reflectivity = isMirror ? (0.7 + 0.3 * fresnel) : (0.25 + 0.75 * fresnel);
        
        vec3 refDir = reflect(dir, nrm);
        if(isMirror) {
            vec3 refrDir = refract(dir, nrm, 1.0 / 1.5);
            refDir = normalize(mix(refDir, refrDir, 0.15)); 
        }
        
        vec3 rpos = pos + nrm * (0.02 + distWalked * 0.002);
        vec3 refVolGlow = vec3(0.0);
        float rdistWalked = 0.0;
        
        for(int i=0; i < 25; i++) {
            float rd = scene(rpos, t, pulse);
            refVolGlow += getVolumetrics(rpos, rd, t, lightFlare, bass) * 0.4;
            if(rd < SURF_DIST * (1.0 + rdistWalked * 0.05)) break;
            rpos += rd * refDir;
            rdistWalked += rd;
            if(rdistWalked > MAX_DIST) break;
        }
        
        vec3 refCol = refVolGlow; 
        if(rdistWalked < MAX_DIST) {
            bool rIsMirror = (rpos.y < -3.4 || rpos.y > 7.9 || abs(rpos.x) > 11.9 || abs(rpos.z) > 11.9);
            if(!rIsMirror) {
                vec3 rnrm = normal(rpos, t, pulse);
                
                float rCDist = 9999.;
                for(int i = -2; i < 2; i++) {
                    float lt = t + float(i+2);
                    mat3 r1 = mat3(1., 0., 0., 0., cos(lt), -sin(lt), 0., sin(lt), cos(lt));
                    mat3 r2 = mat3(cos(lt), 0., sin(lt), 0., 1., 0., -sin(lt), 0., cos(lt));
                    mat3 r3 = mat3(cos(lt/2.), -sin(lt/2.), 0., sin(lt/2.), cos(lt/2.), 0., 0., 0., 1.);
                    mat3 r = r1 * r2 * r3;
                    vec3 offset = vec3(float(i)*2.5, 0., 0.);
                    float d = sdBox((rpos + offset) * r, vec3(1.0 + pulse));
                    rCDist = min(rCDist, d);
                }
                float rUDist = sdMiniUfos(rpos, t, pulse);
                bool rIsCube = rCDist < rUDist;
                vec3 rCubeCol = vec3(0.10, 0.11, 0.13);
                if (rIsCube) {
                    float rMinDist = 9999.0;
                    vec2 rUvCoord = vec2(0.0);
                    for(int i = -2; i < 2; i++) {
                        float lt = t + float(i+2);
                        mat3 r1 = mat3(1., 0., 0., 0., cos(lt), -sin(lt), 0., sin(lt), cos(lt));
                        mat3 r2 = mat3(cos(lt), 0., sin(lt), 0., 1., 0., -sin(lt), 0., cos(lt));
                        mat3 r3 = mat3(cos(lt/2.), -sin(lt/2.), 0., sin(lt/2.), cos(lt/2.), 0., 0., 0., 1.);
                        mat3 r = r1 * r2 * r3;
                        vec3 offset = vec3(float(i)*2.5, 0., 0.);
                        vec3 q = (rpos + offset) * r;
                        float d = sdBox(q, vec3(1.0 + pulse));
                        if(d < rMinDist) {
                            rMinDist = d;
                            vec3 b = vec3(1.0 + pulse);
                            vec3 qa = abs(q);
                            if(qa.x > qa.y && qa.x > qa.z) {
                                rUvCoord = q.yz / (2.0 * b.yz) + 0.5;
                            } else if(qa.y > qa.x && qa.y > qa.z) {
                                rUvCoord = q.xz / (2.0 * b.xz) + 0.5;
                            } else {
                                rUvCoord = q.xy / (2.0 * b.xy) + 0.5;
                            }
                        }
                    }
                    rCubeCol = texture(iChannel2, rUvCoord).rgb;
                    #if GREEN_SCREEN
                    float rgDist = rCubeCol.g - max(rCubeCol.r, rCubeCol.b);
                    if(rgDist > 0.3) rCubeCol = vec3(0.10, 0.11, 0.13);
                    #endif
                }
                vec3 rAlbedo = rIsCube ? rCubeCol : vec3(0.10, 0.11, 0.13);

                vec3 rto1 = lpos1(t) - rpos; float rdl1 = max(length(rto1), 0.001);
                refCol += lcol1 * (rAlbedo * max(0.0, dot(rnrm, rto1/rdl1))) * 3.0 / (1.0 + rdl1*rdl1*0.4);
                vec3 rto2 = lpos2(t) - rpos; float rdl2 = max(length(rto2), 0.001);
                refCol += lcol2 * (rAlbedo * max(0.0, dot(rnrm, rto2/rdl2))) * 3.0 / (1.0 + rdl2*rdl2*0.4);
                vec3 rto3 = lpos3(t) - rpos; float rdl3 = max(length(rto3), 0.001);
                refCol += lcol3 * (rAlbedo * max(0.0, dot(rnrm, rto3/rdl3))) * 3.0 / (1.0 + rdl3*rdl3*0.4);

                float rInterDist = cubeIntersection(rpos, t, pulse);
                refCol += vec3(0.35, 0.40, 0.45) * exp(-rInterDist * 25.0) * 1.5;
            } else {
                float redgeX = abs(12.0 - abs(rpos.x));
                float redgeZ = abs(12.0 - abs(rpos.z));
                float redgeY = min(abs(rpos.y + 3.5), abs(8.0 - rpos.y));
                float reX = exp(-redgeX * 120.0);
                float reZ = exp(-redgeZ * 120.0);
                float reY = exp(-redgeY * 120.0);
                float redgeWeight = clamp(reX*reZ + reX*reY + reZ*reY, 0.0, 1.0);
                refCol += vec3(0.2, 0.25, 0.3) * redgeWeight * lightFlare;
            }
        }
        col = lighting + (refCol * reflectivity);
    }

    col += volGlow;
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
    if(isnan(col.x) || isnan(col.y) || isnan(col.z) || isinf(col.x) || isinf(col.y) || isinf(col.z)) col = vec3(0.0);
    
    return vec4(col, distWalked);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    /*
    float bass    = textureLod(iChannel1, vec2(0.02, 0.25), 0.0).x;
    float treble = textureLod(iChannel1, vec2(0.75, 0.25), 0.0).x;
    */
    float bass    = textureLod(iAudioData, vec2(0.02, 0.25), 0.0).x;
    float treble = textureLod(iAudioData, vec2(0.75, 0.25), 0.0).x;
    if (isnan(bass) || isinf(bass)) bass = 0.0;
    if (isnan(treble) || isinf(treble)) treble = 0.0;
    bass = clamp(bass, 0.0, 1.0);
    treble = clamp(treble, 0.0, 1.0);
    vec2 uv = fragCoord / iResolution.xy;
    vec2 sampleCoord = fragCoord;

    float glitchCycle = mod(iTime, 7.5);
    float glitchActive = step(glitchCycle, 0.3);

    if (glitchActive > 0.0) {
        float gType = mod(floor(iTime / 7.5), 3.0);
        
        if (gType == 0.0) {
            float block = floor(uv.y * 12.0);
            float offset = (fract(sin(block * 43.12 + iTime) * 314.1) - 0.5) * 60.0;
            sampleCoord.x += offset;
        } else if (gType == 1.0) {
            float block = floor(uv.x * 20.0);
            float offset = (fract(sin(block * 12.34 - iTime) * 123.4) - 0.5) * 40.0;
            sampleCoord.y += offset;
        } else {
            float pSize = 15.0 + fract(iTime * 5.0) * 25.0;
            sampleCoord = floor(sampleCoord / pSize) * pSize;
        }
    }

    float cutInterval = 8.0; 
    int seqIndex = int(floor(iTime / cutInterval)) % 12; 

    vec4 final = render(iTime, sampleCoord, bass, treble, seqIndex);
    
    float timeSinceCut = mod(iTime, cutInterval);
    float transitionPhase = pow(max(0.0, 1.0 - (timeSinceCut / 1.2)), 3.0);
    
    if (iTime < 1.2) {
        transitionPhase = 0.0;
    }
    
    vec2 centeredUV = (sampleCoord / iResolution.xy) - 0.5;
    vec2 dragUV = (sampleCoord / iResolution.xy) + centeredUV * (transitionPhase * 0.06); 
    
    vec4 prevFrame = texture(iChannel0, dragUV);
    
    if (iTime < 0.2 || (prevFrame.r == 0.0 && prevFrame.g == 0.0 && prevFrame.b == 0.0)) {
        transitionPhase = 0.0;
    }

    float feedbackStrength = transitionPhase * 0.92;
    vec3 outColor = mix(final.rgb, prevFrame.rgb, feedbackStrength);
    
    if (glitchActive > 0.0 && mod(floor(iTime * 15.0), 2.0) == 0.0) {
        outColor.gb += 0.2; 
    }

    if (any(isnan(outColor)) || any(isinf(outColor))) {
        outColor = vec3(0.0);
    }

    fragColor = vec4(outColor, final.w);
}

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
