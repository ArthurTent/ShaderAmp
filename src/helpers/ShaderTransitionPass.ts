import {
    WebGLRenderer,
    WebGLRenderTarget,
    ShaderMaterial,
    Scene,
    Camera,
    PlaneGeometry,
    Mesh,
    LinearFilter,
    RGBAFormat,
    HalfFloatType,
    Vector3,
    Texture,
    VideoTexture,
    IUniform,
    DoubleSide,
} from "three";

export enum TransitionEffect {
    FadeSmooth = 0,
    SlowShutter = 1,
    Datamosh = 2,
    WhipPan = 3,
    GlitchCut = 4,
    FilmFlash = 5,
    AnamorphicBurn = 6,
    DollyZoom = 7,
    BokehRack = 8,
    PrismSplit = 9,
    CrtShut = 10,
    InkBleed = 11,
    LiquidChrome = 12,
    Shockwave = 13,
    HeatHaze = 14,
    BlockTear = 15,
    RgbSlide = 16,
    MosaicCrush = 17,
    VenetianBlinds = 18,
    VortexTwist = 19,
    HalftoneDots = 20,
    VoronoiShatter = 21,
    PlasmaArc = 22,
    WaxMelt = 23,
    TopoContours = 24,
    BinaryRain = 25,
    VhsTracking = 26,
    AsciiDither = 27,
    StrobeStutter = 28,
    LensFlareSweep = 29,
    IrisLetterbox = 30,
    DuotoneWipe = 31,
    MultiPanelGrid = 32,
    OutrunGrid = 33,
    RadialSunburst = 34,
    StardustVortex = 35,
    MengerTunnel = 36,
    CopperRaster = 37,
    MetaballBlob = 38,
    OscilloscopeWipe = 39,
    HexExtrude = 40,
    SdfGyroid = 41,
    OpticalFlow = 42,
    HologramShift = 43,
    ClassifiedRedaction = 44,
    RedStringBoard = 45,
    SatelliteZoom = 46,
    DebrisFlyby = 47,
    WireframePlatonic = 48,
    XFilesStatic = 49,
    CustomShader = 50,
}

export interface TransitionEffectConfig {
    effect: TransitionEffect;
    name: string;
    freezeOutgoing: boolean;
}

export const TRANSITION_EFFECT_CONFIGS: Record<TransitionEffect, TransitionEffectConfig> = {
    [TransitionEffect.FadeSmooth]:          { effect: TransitionEffect.FadeSmooth,          name: "FadeSmooth",          freezeOutgoing: false },
    [TransitionEffect.SlowShutter]:         { effect: TransitionEffect.SlowShutter,         name: "SlowShutter",         freezeOutgoing: false },
    [TransitionEffect.Datamosh]:            { effect: TransitionEffect.Datamosh,            name: "Datamosh",            freezeOutgoing: true  },
    [TransitionEffect.WhipPan]:             { effect: TransitionEffect.WhipPan,             name: "WhipPan",             freezeOutgoing: false },
    [TransitionEffect.GlitchCut]:           { effect: TransitionEffect.GlitchCut,           name: "GlitchCut",           freezeOutgoing: true  },
    [TransitionEffect.FilmFlash]:           { effect: TransitionEffect.FilmFlash,           name: "FilmFlash",           freezeOutgoing: true  },
    [TransitionEffect.AnamorphicBurn]:      { effect: TransitionEffect.AnamorphicBurn,      name: "AnamorphicBurn",      freezeOutgoing: false },
    [TransitionEffect.DollyZoom]:           { effect: TransitionEffect.DollyZoom,           name: "DollyZoom",           freezeOutgoing: false },
    [TransitionEffect.BokehRack]:           { effect: TransitionEffect.BokehRack,           name: "BokehRack",           freezeOutgoing: false },
    [TransitionEffect.PrismSplit]:          { effect: TransitionEffect.PrismSplit,          name: "PrismSplit",          freezeOutgoing: false },
    [TransitionEffect.CrtShut]:             { effect: TransitionEffect.CrtShut,             name: "CrtShut",             freezeOutgoing: true  },
    [TransitionEffect.InkBleed]:            { effect: TransitionEffect.InkBleed,            name: "InkBleed",            freezeOutgoing: true  },
    [TransitionEffect.LiquidChrome]:        { effect: TransitionEffect.LiquidChrome,        name: "LiquidChrome",        freezeOutgoing: true  },
    [TransitionEffect.Shockwave]:           { effect: TransitionEffect.Shockwave,           name: "Shockwave",           freezeOutgoing: false },
    [TransitionEffect.HeatHaze]:            { effect: TransitionEffect.HeatHaze,            name: "HeatHaze",            freezeOutgoing: false },
    [TransitionEffect.BlockTear]:           { effect: TransitionEffect.BlockTear,           name: "BlockTear",           freezeOutgoing: true  },
    [TransitionEffect.RgbSlide]:            { effect: TransitionEffect.RgbSlide,            name: "RgbSlide",            freezeOutgoing: false },
    [TransitionEffect.MosaicCrush]:         { effect: TransitionEffect.MosaicCrush,         name: "MosaicCrush",         freezeOutgoing: false },
    [TransitionEffect.VenetianBlinds]:      { effect: TransitionEffect.VenetianBlinds,      name: "VenetianBlinds",      freezeOutgoing: false },
    [TransitionEffect.VortexTwist]:         { effect: TransitionEffect.VortexTwist,         name: "VortexTwist",         freezeOutgoing: false },
    [TransitionEffect.HalftoneDots]:        { effect: TransitionEffect.HalftoneDots,        name: "HalftoneDots",        freezeOutgoing: false },
    [TransitionEffect.VoronoiShatter]:      { effect: TransitionEffect.VoronoiShatter,      name: "VoronoiShatter",      freezeOutgoing: true  },
    [TransitionEffect.PlasmaArc]:           { effect: TransitionEffect.PlasmaArc,           name: "PlasmaArc",           freezeOutgoing: true  },
    [TransitionEffect.WaxMelt]:             { effect: TransitionEffect.WaxMelt,             name: "WaxMelt",             freezeOutgoing: true  },
    [TransitionEffect.TopoContours]:        { effect: TransitionEffect.TopoContours,        name: "TopoContours",        freezeOutgoing: true  },
    [TransitionEffect.BinaryRain]:          { effect: TransitionEffect.BinaryRain,          name: "BinaryRain",          freezeOutgoing: false },
    [TransitionEffect.VhsTracking]:         { effect: TransitionEffect.VhsTracking,         name: "VhsTracking",         freezeOutgoing: false },
    [TransitionEffect.AsciiDither]:         { effect: TransitionEffect.AsciiDither,         name: "AsciiDither",         freezeOutgoing: false },
    [TransitionEffect.StrobeStutter]:       { effect: TransitionEffect.StrobeStutter,       name: "StrobeStutter",       freezeOutgoing: false },
    [TransitionEffect.LensFlareSweep]:      { effect: TransitionEffect.LensFlareSweep,      name: "LensFlareSweep",      freezeOutgoing: false },
    [TransitionEffect.IrisLetterbox]:       { effect: TransitionEffect.IrisLetterbox,       name: "IrisLetterbox",       freezeOutgoing: false },
    [TransitionEffect.DuotoneWipe]:         { effect: TransitionEffect.DuotoneWipe,         name: "DuotoneWipe",         freezeOutgoing: false },
    [TransitionEffect.MultiPanelGrid]:      { effect: TransitionEffect.MultiPanelGrid,      name: "MultiPanelGrid",      freezeOutgoing: false },
    [TransitionEffect.OutrunGrid]:          { effect: TransitionEffect.OutrunGrid,          name: "OutrunGrid",          freezeOutgoing: false },
    [TransitionEffect.RadialSunburst]:      { effect: TransitionEffect.RadialSunburst,      name: "RadialSunburst",      freezeOutgoing: false },
    [TransitionEffect.StardustVortex]:      { effect: TransitionEffect.StardustVortex,      name: "StardustVortex",      freezeOutgoing: false },
    [TransitionEffect.MengerTunnel]:        { effect: TransitionEffect.MengerTunnel,        name: "MengerTunnel",        freezeOutgoing: false },
    [TransitionEffect.CopperRaster]:        { effect: TransitionEffect.CopperRaster,        name: "CopperRaster",        freezeOutgoing: false },
    [TransitionEffect.MetaballBlob]:        { effect: TransitionEffect.MetaballBlob,        name: "MetaballBlob",        freezeOutgoing: false },
    [TransitionEffect.OscilloscopeWipe]:    { effect: TransitionEffect.OscilloscopeWipe,    name: "OscilloscopeWipe",    freezeOutgoing: false },
    [TransitionEffect.HexExtrude]:          { effect: TransitionEffect.HexExtrude,          name: "HexExtrude",          freezeOutgoing: false },
    [TransitionEffect.SdfGyroid]:           { effect: TransitionEffect.SdfGyroid,           name: "SdfGyroid",           freezeOutgoing: false },
    [TransitionEffect.OpticalFlow]:         { effect: TransitionEffect.OpticalFlow,         name: "OpticalFlow",         freezeOutgoing: false },
    [TransitionEffect.HologramShift]:       { effect: TransitionEffect.HologramShift,       name: "HologramShift",       freezeOutgoing: false },
    [TransitionEffect.ClassifiedRedaction]: { effect: TransitionEffect.ClassifiedRedaction, name: "ClassifiedRedaction", freezeOutgoing: false },
    [TransitionEffect.RedStringBoard]:      { effect: TransitionEffect.RedStringBoard,      name: "RedStringBoard",      freezeOutgoing: false },
    [TransitionEffect.SatelliteZoom]:       { effect: TransitionEffect.SatelliteZoom,       name: "SatelliteZoom",       freezeOutgoing: false },
    [TransitionEffect.DebrisFlyby]:         { effect: TransitionEffect.DebrisFlyby,         name: "DebrisFlyby",         freezeOutgoing: false },
    [TransitionEffect.WireframePlatonic]:   { effect: TransitionEffect.WireframePlatonic,   name: "WireframePlatonic",   freezeOutgoing: false },
    [TransitionEffect.XFilesStatic]:        { effect: TransitionEffect.XFilesStatic,        name: "XFilesStatic",        freezeOutgoing: false },
    [TransitionEffect.CustomShader]:        { effect: TransitionEffect.CustomShader,        name: "CustomShader",        freezeOutgoing: false },
};

export const BUILTIN_TRANSITION_EFFECTS: TransitionEffect[] = [
    TransitionEffect.FadeSmooth,
    TransitionEffect.SlowShutter,
    TransitionEffect.Datamosh,
    TransitionEffect.WhipPan,
    TransitionEffect.GlitchCut,
    TransitionEffect.FilmFlash,
    TransitionEffect.AnamorphicBurn,
    TransitionEffect.DollyZoom,
    TransitionEffect.BokehRack,
    TransitionEffect.PrismSplit,
    TransitionEffect.CrtShut,
    TransitionEffect.InkBleed,
    TransitionEffect.LiquidChrome,
    TransitionEffect.Shockwave,
    TransitionEffect.HeatHaze,
    TransitionEffect.BlockTear,
    TransitionEffect.RgbSlide,
    TransitionEffect.MosaicCrush,
    TransitionEffect.VenetianBlinds,
    TransitionEffect.VortexTwist,
    TransitionEffect.HalftoneDots,
    TransitionEffect.VoronoiShatter,
    TransitionEffect.PlasmaArc,
    TransitionEffect.WaxMelt,
    TransitionEffect.TopoContours,
    TransitionEffect.BinaryRain,
    TransitionEffect.VhsTracking,
    TransitionEffect.AsciiDither,
    TransitionEffect.StrobeStutter,
    TransitionEffect.LensFlareSweep,
    TransitionEffect.IrisLetterbox,
    TransitionEffect.DuotoneWipe,
    TransitionEffect.MultiPanelGrid,
    TransitionEffect.OutrunGrid,
    TransitionEffect.RadialSunburst,
    TransitionEffect.StardustVortex,
    TransitionEffect.MengerTunnel,
    TransitionEffect.CopperRaster,
    TransitionEffect.MetaballBlob,
    TransitionEffect.OscilloscopeWipe,
    TransitionEffect.HexExtrude,
    TransitionEffect.SdfGyroid,
    TransitionEffect.OpticalFlow,
    TransitionEffect.HologramShift,
    TransitionEffect.ClassifiedRedaction,
    TransitionEffect.RedStringBoard,
    TransitionEffect.SatelliteZoom,
    TransitionEffect.DebrisFlyby,
    TransitionEffect.WireframePlatonic,
    TransitionEffect.XFilesStatic,
];

const TRANSITION_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const BUILTIN_TRANSITION_FRAGMENT_SHADER = `
varying vec2 vUv;
uniform sampler2D iChannelFrom;
uniform sampler2D iChannelTo;
uniform float uProgress;      // 0.0 -> 1.0
uniform float iTime;
uniform vec3 iResolution;
uniform sampler2D iAudioData;
uniform int uTransitionType;

#define PI 3.14159265359
#define TAU 6.28318530718

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(rand(i + vec2(0.0, 0.0)), rand(i + vec2(1.0, 0.0)), u.x),
        mix(rand(i + vec2(0.0, 1.0)), rand(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = rot * p * 2.02;
        a *= 0.5;
    }
    return v;
}

float getLuma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

mat2 rot2d(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// 0. Classic Smooth Fade
vec4 transFadeSmooth(vec2 uv, float p) {
    vec4 fromCol = texture(iChannelFrom, uv);
    vec4 toCol   = texture(iChannelTo, uv);
    return mix(fromCol, toCol, smoothstep(0.0, 1.0, p));
}

// 1. Slow Shutter
vec4 transSlowShutter(vec2 uv, float p) {
    vec4 fromCol = texture(iChannelFrom, uv);
    vec4 toCol   = texture(iChannelTo, uv);
    float feedback = 1.0 - smoothstep(0.0, 1.0, p);
    return vec4(mix(toCol.rgb, fromCol.rgb, feedback), 1.0);
}

// 2. Datamosh
vec4 transDatamosh(vec2 uv, float p) {
    vec2 grid = vec2(32.0, 18.0);
    vec2 blockId = floor(uv * grid);
    vec2 blockUv = (blockId + 0.5) / grid;
    vec4 blockFrom = texture(iChannelFrom, blockUv);
    float blockNoise = rand(blockId + floor(p * 12.0) * 0.13);
    float moshEnv = sin(p * PI);
    vec2 motionVec = (blockFrom.rg - 0.5) * 0.35 + (vec2(rand(blockId), rand(blockId + 7.1)) - 0.5) * 0.25;
    vec2 displacedUv = clamp(uv + motionVec * moshEnv, 0.0, 1.0);
    float threshold = smoothstep(0.1, 0.9, p + (blockNoise - 0.5) * 0.35);
    vec4 fromSmeared = texture(iChannelFrom, displacedUv);
    vec4 toSmeared   = texture(iChannelTo, clamp(uv - motionVec * (1.0 - p) * 0.5, 0.0, 1.0));
    float chromaShift = 0.015 * moshEnv;
    toSmeared.r = texture(iChannelTo, clamp(uv - motionVec * (1.0 - p) * 0.5 + vec2(chromaShift, 0.0), 0.0, 1.0)).r;
    toSmeared.b = texture(iChannelTo, clamp(uv - motionVec * (1.0 - p) * 0.5 - vec2(chromaShift, 0.0), 0.0, 1.0)).b;
    return mix(fromSmeared, toSmeared, threshold);
}

// 3. Whip Pan
vec4 transWhipPan(vec2 uv, float p) {
    float whipInt = sin(p * PI);
    float blurAmt = whipInt * 0.08;
    vec4 accFrom = vec4(0.0);
    vec4 accTo   = vec4(0.0);
    const int TAPS = 8;
    for (int i = 0; i < TAPS; i++) {
        float t = (float(i) / float(TAPS) - 0.5) * blurAmt;
        vec2 sampleUv = clamp(uv + vec2(t, 0.0), 0.0, 1.0);
        accFrom += textureLod(iChannelFrom, sampleUv, 0.0);
        accTo   += textureLod(iChannelTo, sampleUv, 0.0);
    }
    vec4 blended = mix(accFrom / float(TAPS), accTo / float(TAPS), smoothstep(0.35, 0.65, p));
    blended.rgb *= (1.0 - whipInt * 0.45);
    return blended;
}

// 4. Glitch Cut
vec4 transGlitchCut(vec2 uv, float p) {
    float intensity = sin(p * PI);
    vec2 sampleUV = uv;
    float brightness = 1.0;
    if (intensity > 0.01) {
        float blockY = floor(sampleUV.y * 20.0);
        float noise = rand(vec2(blockY, floor(iTime * 24.0)));
        sampleUV.x = clamp(sampleUV.x + (noise - 0.5) * 0.2 * intensity, 0.0, 1.0);
        if (rand(vec2(floor(iTime * 30.0), sampleUV.y)) > 0.8) brightness = 0.25;
    }
    vec4 fromCol = texture(iChannelFrom, sampleUV);
    vec4 toCol   = texture(iChannelTo, sampleUV);
    float cut = step(0.5, p + (rand(vec2(uv.y, iTime)) - 0.5) * 0.2 * intensity);
    return vec4(mix(fromCol, toCol, cut).rgb * brightness, 1.0);
}

// 5. Film Flash
vec4 transFilmFlash(vec2 uv, float p) {
    float flash = sin(p * PI);
    vec4 fromCol = texture(iChannelFrom, uv);
    vec4 toCol   = texture(iChannelTo, uv);
    vec4 base = mix(fromCol, toCol, smoothstep(0.4, 0.6, p));
    vec3 burnCol = vec3(1.0, 0.5, 0.1) * pow(flash, 1.5) * 2.5;
    return vec4(base.rgb + burnCol, 1.0);
}

// 6. Anamorphic Burn
vec4 transAnamorphicBurn(vec2 uv, float p) {
    float env = sin(p * PI);
    float streak = fbm(vec2(uv.x * 1.5 + p * 2.0, uv.y * 14.0));
    float bloom = fbm(uv * 3.5 - vec2(p * 1.5, 0.0));
    float leak = pow(streak * 0.65 + bloom * 0.55, 2.0) * pow(env, 1.3) * 3.2;
    vec2 shift = vec2((streak - 0.5) * 0.04 * env, 0.0);
    vec3 fromCol = texture(iChannelFrom, clamp(uv + shift, 0.0, 1.0)).rgb;
    vec3 toCol   = texture(iChannelTo,   clamp(uv - shift, 0.0, 1.0)).rgb;
    vec3 base = mix(fromCol, toCol, smoothstep(0.35, 0.65, p));
    vec3 tint = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.15, 0.55), uv.x);
    return vec4(base + tint * leak, 1.0);
}

// 7. Dolly Zoom
vec4 transDollyZoom(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 centered = uv - 0.5;
    float r = length(centered);
    float warpPower = mix(1.0, 2.8, env);
    vec3 accFrom = vec3(0.0);
    vec3 accTo   = vec3(0.0);
    const int TAPS = 8;
    for (int i = 0; i < TAPS; i++) {
        float f = float(i) / float(TAPS);
        float scale = mix(1.0, pow(max(r * 1.414, 0.0001), warpPower - 1.0), f * env);
        vec2 uFrom = clamp(0.5 + centered * scale, 0.0, 1.0);
        vec2 uTo   = clamp(0.5 + centered / max(scale, 0.15), 0.0, 1.0);
        accFrom.r += textureLod(iChannelFrom, clamp(0.5 + centered * scale * 1.02, 0.0, 1.0), 0.0).r;
        accFrom.g += textureLod(iChannelFrom, uFrom, 0.0).g;
        accFrom.b += textureLod(iChannelFrom, clamp(0.5 + centered * scale * 0.98, 0.0, 1.0), 0.0).b;
        accTo.r   += textureLod(iChannelTo, clamp(0.5 + centered / max(scale * 1.02, 0.15), 0.0, 1.0), 0.0).r;
        accTo.g   += textureLod(iChannelTo, uTo, 0.0).g;
        accTo.b   += textureLod(iChannelTo, clamp(0.5 + centered / max(scale * 0.98, 0.15), 0.0, 1.0), 0.0).b;
    }
    return vec4(mix(accFrom / float(TAPS), accTo / float(TAPS), smoothstep(0.42, 0.58, p)), 1.0);
}

// 8. Bokeh Rack
vec4 transBokehRack(vec2 uv, float p) {
    float radius = sin(p * PI) * 0.055;
    float aspect = iResolution.x / max(iResolution.y, 1.0);
    vec2 aspectScale = vec2(1.0 / aspect, 1.0);
    vec3 accFrom = vec3(0.0), accTo = vec3(0.0);
    float wFrom = 0.0, wTo = 0.0;
    const int SAMPLES = 16;
    for (int i = 0; i < SAMPLES; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / float(SAMPLES)) * radius;
        float theta = fi * 2.39996323;
        vec2 offset = vec2(cos(theta), sin(theta)) * r * aspectScale;
        vec2 sUv = clamp(uv + offset, 0.0, 1.0);
        vec3 cF = textureLod(iChannelFrom, sUv, 0.0).rgb;
        vec3 cT = textureLod(iChannelTo, sUv, 0.0).rgb;
        float bF = 1.0 + pow(getLuma(cF), 3.0) * 6.0 * sin(p * PI);
        float bT = 1.0 + pow(getLuma(cT), 3.0) * 6.0 * sin(p * PI);
        accFrom += cF * bF; wFrom += bF;
        accTo += cT * bT; wTo += bT;
    }
    return vec4(mix(accFrom / wFrom, accTo / wTo, smoothstep(0.35, 0.65, p)), 1.0);
}

// 9. Prism Split
vec4 transPrismSplit(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 c = uv - 0.5;
    float angle = p * PI * 0.75;
    vec2 rc = rot2d(angle) * c;
    vec2 folded = abs(fract(rc * mix(1.0, 2.5, env) + 0.5) - 0.5);
    vec2 prismUv = clamp(0.5 + rot2d(-angle) * mix(rc, folded - 0.25, env * 0.85), 0.0, 1.0);
    vec2 ca = vec2(0.018 * env, -0.01 * env);
    vec3 fCol = vec3(texture(iChannelFrom, clamp(prismUv + ca, 0.0, 1.0)).r, texture(iChannelFrom, prismUv).g, texture(iChannelFrom, clamp(prismUv - ca, 0.0, 1.0)).b);
    vec3 tCol = vec3(texture(iChannelTo, clamp(prismUv + ca, 0.0, 1.0)).r, texture(iChannelTo, prismUv).g, texture(iChannelTo, clamp(prismUv - ca, 0.0, 1.0)).b);
    float facetEdge = smoothstep(0.45, 0.5, max(folded.x, folded.y)) * env;
    return vec4(mix(fCol, tCol, smoothstep(0.4, 0.6, p)) + facetEdge * 0.5, 1.0);
}

// 10. CRT Shut
vec4 transCrtShut(vec2 uv, float p) {
    bool secondHalf = p > 0.5;
    float t = secondHalf ? (p - 0.5) * 2.0 : (0.5 - p) * 2.0;
    float scaleY = max(smoothstep(0.08, 1.0, t), 0.003);
    float scaleX = max(smoothstep(0.0, 0.22, t), 0.003);
    vec2 scaledUv = (uv - 0.5) / vec2(scaleX, scaleY) + 0.5;
    bool inBounds = all(greaterThanEqual(scaledUv, vec2(0.0))) && all(lessThanEqual(scaledUv, vec2(1.0)));
    vec3 texCol = secondHalf ? texture(iChannelTo, clamp(scaledUv, 0.0, 1.0)).rgb : texture(iChannelFrom, clamp(scaledUv, 0.0, 1.0)).rgb;
    float coreGlow = (1.0 - smoothstep(0.0, 0.35, t)) * 2.2;
    float dotDist = length((uv - 0.5) * vec2(1.0, iResolution.y / max(iResolution.x, 1.0)));
    float spark = exp(-dotDist * 35.0) * (1.0 - smoothstep(0.0, 0.15, t)) * 3.0;
    return vec4((inBounds ? texCol : vec3(0.0)) + vec3(coreGlow + spark), 1.0);
}

// 11. Ink Bleed
vec4 transInkBleed(vec2 uv, float p) {
    vec3 fromCol = texture(iChannelFrom, uv).rgb;
    vec3 toCol   = texture(iChannelTo, uv).rgb;
    vec2 warp = vec2(fbm(uv * 3.5 + p), fbm(uv * 3.5 - p + 4.2));
    float organic = fbm(uv * 5.0 + warp * 1.4);
    float field = mix(organic, 1.0 - getLuma(fromCol), 0.45);
    float edge = 0.08;
    float threshold = mix(-edge, 1.0 + edge, p);
    float mask = smoothstep(threshold - edge, threshold + edge, field);
    float rim = smoothstep(0.0, 0.5, mask) * (1.0 - smoothstep(0.5, 1.0, mask));
    vec3 col = mix(toCol, fromCol, mask);
    col = mix(col, col * 0.25, rim * 0.75 * sin(p * PI));
    return vec4(col, 1.0);
}

// 12. Liquid Chrome
vec4 transLiquidChrome(vec2 uv, float p) {
    float melt = pow(p, 1.6);
    float n1 = fbm(vec2(uv.x * 6.0, uv.y * 3.0 - p * 2.5));
    float n2 = fbm(vec2(uv.x * 12.0 + 3.1, uv.y * 6.0 - p * 4.0));
    float drop = melt * (0.35 + n1 * 0.85);
    vec2 dispUv = uv + vec2((n2 - 0.5) * 0.12 * sin(p * PI), drop);
    float h = n1 * 0.7 + n2 * 0.3;
    float spec = pow(clamp(1.0 - abs(h - 0.52) * 8.0, 0.0, 1.0), 3.0) * sin(p * PI);
    vec3 fromCol = texture(iChannelFrom, clamp(dispUv, 0.0, 1.0)).rgb;
    vec3 toCol   = texture(iChannelTo, uv).rgb;
    vec3 chromeFrom = mix(fromCol, vec3(getLuma(fromCol)) * vec3(0.85, 0.92, 1.05) + spec * 1.4, sin(p * PI) * 0.8);
    float reveal = max(smoothstep(0.0, 0.15, dispUv.y - 1.0 + p * 0.35), smoothstep(0.65, 0.95, p));
    return vec4(mix(chromeFrom, toCol, reveal), 1.0);
}

// 13. Shockwave
vec4 transShockwave(vec2 uv, float p) {
    float aspect = iResolution.x / max(iResolution.y, 1.0);
    vec2 center = vec2(0.5);
    vec2 delta = (uv - center) * vec2(aspect, 1.0);
    float dist = length(delta);
    vec2 dir = dist > 0.0001 ? normalize(delta) : vec2(0.0);
    float radius = p * 1.35;
    float ringDiff = dist - radius;
    float wave = exp(-(ringDiff * ringDiff) / (0.12 * 0.12 * 0.25)) * sin(ringDiff * 45.0);
    float env = sin(p * PI);
    vec2 offset = dir * wave * 0.045 * env;
    vec2 ca = dir * abs(wave) * 0.015 * env;
    vec3 fromCol = vec3(texture(iChannelFrom, clamp(uv + offset + ca, 0.0, 1.0)).r, texture(iChannelFrom, clamp(uv + offset, 0.0, 1.0)).g, texture(iChannelFrom, clamp(uv + offset - ca, 0.0, 1.0)).b);
    vec3 toCol = vec3(texture(iChannelTo, clamp(uv + offset + ca, 0.0, 1.0)).r, texture(iChannelTo, clamp(uv + offset, 0.0, 1.0)).g, texture(iChannelTo, clamp(uv + offset - ca, 0.0, 1.0)).b);
    float inside = 1.0 - smoothstep(radius - 0.03, radius + 0.03, dist);
    return vec4(mix(fromCol, toCol, inside) + vec3(0.6, 0.85, 1.0) * abs(wave) * 0.45 * env, 1.0);
}

// 14. Heat Haze
vec4 transHeatHaze(vec2 uv, float p) {
    float env = sin(p * PI);
    float waveX = sin(uv.y * 45.0 + iTime * 12.0) * 0.5 + (vnoise(vec2(uv.y * 22.0, iTime * 6.0)) - 0.5);
    vec2 shimmer = vec2(waveX, cos(uv.x * 35.0 - iTime * 9.0) * 0.3) * 0.035 * env;
    vec3 fromCol = texture(iChannelFrom, clamp(uv + shimmer, 0.0, 1.0)).rgb;
    vec3 toCol   = texture(iChannelTo,   clamp(uv - shimmer, 0.0, 1.0)).rgb;
    float mask = smoothstep(0.0, 1.0, p * 1.3 - (1.0 - uv.y) * 0.3 + waveX * 0.08 * env);
    return vec4(mix(fromCol, toCol, mask) + vec3(1.0, 0.85, 0.55) * env * 0.12, 1.0);
}

// 15. Block Tear
vec4 transBlockTear(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 cell = floor(uv * vec2(12.0, 28.0));
    float h = rand(cell + floor(p * 16.0));
    float tear = step(0.45, h) * (rand(cell + 1.7) - 0.5) * 0.35 * env;
    vec2 tUv = fract(uv + vec2(tear, 0.0));
    vec3 col = step(p, rand(cell * 0.73)) > 0.5 ? texture(iChannelFrom, tUv).rgb : texture(iChannelTo, tUv).rgb;
    if (h > 0.88 && env > 0.2) col = 1.0 - col.bgr;
    return vec4(col, 1.0);
}

// 16. RGB Slide
vec4 transRgbSlide(vec2 uv, float p) {
    float pR = smoothstep(0.0, 0.84, p);
    float pG = smoothstep(0.08, 0.92, p);
    float pB = smoothstep(0.16, 1.0, p);
    vec2 dir = vec2(0.25, -0.06);
    float r = mix(texture(iChannelFrom, clamp(uv + dir * pR, 0.0, 1.0)).r, texture(iChannelTo, clamp(uv - dir * (1.0 - pR), 0.0, 1.0)).r, pR);
    float g = mix(texture(iChannelFrom, clamp(uv + dir * pG, 0.0, 1.0)).g, texture(iChannelTo, clamp(uv - dir * (1.0 - pG), 0.0, 1.0)).g, pG);
    float b = mix(texture(iChannelFrom, clamp(uv + dir * pB, 0.0, 1.0)).b, texture(iChannelTo, clamp(uv - dir * (1.0 - pB), 0.0, 1.0)).b, pB);
    return vec4(r, g, b, 1.0);
}

// 17. Mosaic Crush
vec4 transMosaicCrush(vec2 uv, float p) {
    float env = sin(p * PI);
    float aspect = iResolution.x / max(iResolution.y, 1.0);
    float cellsY = mix(360.0, 10.0, pow(env, 1.4));
    vec2 grid = vec2(cellsY * aspect, cellsY);
    vec2 cellUv = (floor(uv * grid) + 0.5) / grid;
    vec2 f = fract(uv * grid);
    float border = smoothstep(0.0, 0.08, f.x) * smoothstep(1.0, 0.92, f.x) * smoothstep(0.0, 0.08, f.y) * smoothstep(1.0, 0.92, f.y);
    vec3 col = mix(texture(iChannelFrom, cellUv).rgb, texture(iChannelTo, cellUv).rgb, smoothstep(0.42, 0.58, p));
    return vec4(col * mix(1.0, 0.75 + 0.25 * border, env), 1.0);
}

// 18. Venetian Blinds
vec4 transVenetianBlinds(vec2 uv, float p) {
    const float STRIPS = 12.0;
    vec2 rUv = rot2d(0.25) * (uv - 0.5) + 0.5;
    float localP = clamp((p * 1.45) - (floor(rUv.x * STRIPS) / STRIPS) * 0.45, 0.0, 1.0);
    localP = localP * localP * (3.0 - 2.0 * localP);
    vec2 toUv = uv - (rot2d(-0.25) * vec2(0.0, 1.0)) * (1.0 - localP);
    if (localP > 0.001 && all(greaterThanEqual(toUv, vec2(0.0))) && all(lessThanEqual(toUv, vec2(1.0)))) {
        return texture(iChannelTo, toUv);
    }
    float shadow = smoothstep(0.12, 0.0, abs(1.0 - localP - rUv.y)) * step(0.001, localP);
    return vec4(texture(iChannelFrom, uv).rgb * (1.0 - shadow * 0.45), 1.0);
}

// 19. Vortex Twist
vec4 transVortexTwist(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 centered = uv - 0.5;
    float maxAngle = 5.5 * env * smoothstep(0.85, 0.0, length(centered));
    vec3 accFrom = vec3(0.0), accTo = vec3(0.0);
    const int TAPS = 6;
    for (int i = 0; i < TAPS; i++) {
        float f = float(i) / float(TAPS);
        vec2 sUv = clamp(0.5 + rot2d(maxAngle * mix(0.75, 1.0, f)) * centered * mix(1.0, 0.85, env), 0.0, 1.0);
        accFrom += textureLod(iChannelFrom, sUv, 0.0).rgb;
        accTo   += textureLod(iChannelTo, sUv, 0.0).rgb;
    }
    return vec4(mix(accFrom / float(TAPS), accTo / float(TAPS), smoothstep(0.4, 0.6, p)), 1.0);
}

// 20. Halftone Dots
vec4 transHalftoneDots(vec2 uv, float p) {
    float aspect = iResolution.x / max(iResolution.y, 1.0);
    vec2 st = rot2d(0.523598) * ((uv - 0.5) * vec2(aspect, 1.0));
    float density = 42.0;
    vec2 sampleUv = clamp(rot2d(-0.523598) * ((floor(st * density) + 0.5) / density) / vec2(aspect, 1.0) + 0.5, 0.0, 1.0);
    float radius = p * 1.45 * mix(0.65, 1.25, getLuma(texture(iChannelTo, sampleUv).rgb));
    float dotMask = 1.0 - smoothstep(radius - 0.05, radius + 0.05, length(fract(st * density) - 0.5));
    return vec4(mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, dotMask), 1.0);
}

// 21. Voronoi Shatter
vec4 transVoronoiShatter(vec2 uv, float p) {
    vec2 st = uv * 7.0;
    vec2 iSt = floor(st), fSt = fract(st);
    float minDist = 8.0, secondDist = 8.0;
    vec2 bestCell = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 diff = neighbor + hash22(iSt + neighbor) - fSt;
            float d = length(diff);
            if (d < minDist) { secondDist = minDist; minDist = d; bestCell = iSt + neighbor; }
            else if (d < secondDist) secondDist = d;
        }
    }
    float shardP = clamp((p * 1.6) - rand(bestCell) * 0.6, 0.0, 1.0);
    vec2 shardUv = uv + (hash22(bestCell + 3.1) - 0.5) * (shardP * shardP) * 0.25 + vec2(0.0, shardP * shardP * 0.65);
    vec3 toCol = texture(iChannelTo, uv).rgb;
    if (shardP >= 0.98 || shardUv.y > 1.0 || shardUv.x < 0.0 || shardUv.x > 1.0) return vec4(toCol, 1.0);
    vec3 fromCol = texture(iChannelFrom, clamp(shardUv, 0.0, 1.0)).rgb + vec3(0.85, 0.95, 1.0) * ((1.0 - smoothstep(0.0, 0.06, secondDist - minDist)) * sin(p * PI) * 0.85);
    return vec4(mix(fromCol, toCol, smoothstep(0.75, 1.0, shardP)), 1.0);
}

// 22. Plasma Arc
vec4 transPlasmaArc(vec2 uv, float p) {
    float env = sin(p * PI);
    float n = fbm(uv * 6.0 + vec2(fbm(uv * 4.0 + iTime * 1.5), fbm(uv * 4.0 - iTime * 1.2 + 5.0)) * 2.2);
    float ridge = 1.0 - abs(n * 2.0 - 1.0);
    float dissolve = smoothstep(p - 0.15, p + 0.15, n);
    vec3 col = mix(texture(iChannelTo, uv).rgb, texture(iChannelFrom, uv).rgb, dissolve);
    col += mix(vec3(0.15, 0.55, 1.0), vec3(0.95, 0.25, 1.0), ridge) * (pow(ridge, 10.0) * 3.5 * env + smoothstep(0.0, 0.5, dissolve) * (1.0 - smoothstep(0.5, 1.0, dissolve)) * 2.2 * env);
    return vec4(col, 1.0);
}

// 23. Wax Melt
vec4 transWaxMelt(vec2 uv, float p) {
    float n = fbm(uv * 4.5 + vec2(0.0, -p * 1.5));
    float tear = smoothstep(p * 1.25 - 0.12, p * 1.25 + 0.08, (1.0 - uv.y) * 0.65 + n * 0.55);
    vec3 fromCol = texture(iChannelFrom, clamp(uv + vec2((n - 0.5) * 0.08, pow(1.0 - tear, 2.0) * 0.22), 0.0, 1.0)).rgb;
    vec3 warmGlow = vec3(1.0, 0.42, 0.12) * (smoothstep(0.0, 0.45, tear) * (1.0 - smoothstep(0.45, 0.95, tear)) * 1.8 * sin(p * PI));
    return vec4(mix(texture(iChannelTo, uv).rgb, fromCol, tear) + warmGlow, 1.0);
}

// 24. Topo Contours
vec4 transTopoContours(vec2 uv, float p) {
    float env = sin(p * PI);
    float height = mix(getLuma(texture(iChannelFrom, uv).rgb), getLuma(texture(iChannelTo, uv).rgb), p) * 0.6 + fbm(uv * 3.5) * 0.5;
    float bands = fract(height * 16.0 - p * 4.0);
    float line = smoothstep(0.0, 0.08, bands) * (1.0 - smoothstep(0.08, 0.18, bands));
    vec3 col = mix(texture(iChannelTo, uv).rgb, texture(iChannelFrom, uv).rgb, smoothstep(p * 1.2 - 0.1, p * 1.2 + 0.1, height));
    col += mix(vec3(0.0, 0.95, 0.85), vec3(1.0, 0.78, 0.2), height) * line * env * 1.6;
    return vec4(col, 1.0);
}

// 25. Binary Rain
vec4 transBinaryRain(vec2 uv, float p) {
    float headY = 1.2 - (p * 1.6 * (0.7 + 0.6 * rand(vec2(floor(uv.x * 64.0), 4.7))));
    float trail = smoothstep(0.45, 0.0, uv.y - headY) * step(0.0, uv.y - headY) * step(0.45, rand(floor(vec2(uv.x * 64.0, (uv.y + iTime * 3.0) * 36.0))));
    vec3 base = step(headY, uv.y) > 0.5 ? texture(iChannelTo, uv).rgb : texture(iChannelFrom, uv).rgb;
    return vec4(base + (vec3(0.1, 1.0, 0.45) * trail * 1.2 + vec3(0.85, 1.0, 0.9) * smoothstep(0.03, 0.0, abs(uv.y - headY)) * 1.8) * sin(p * PI), 1.0);
}

// 26. VHS Tracking
vec4 transVhsTracking(vec2 uv, float p) {
    float env = sin(p * PI);
    float trackingBand = smoothstep(0.14, 0.0, abs(uv.y - fract(p * 1.5 + 0.2))) * env;
    float jitter = (rand(vec2(floor(uv.y * 90.0), floor(iTime * 24.0))) - 0.5) * 0.04 * env + sin(uv.y * 60.0 + iTime * 40.0) * 0.06 * trackingBand;
    vec2 sampleUv = vec2(fract(uv.x + jitter), uv.y);
    float ca = (0.008 + 0.025 * trackingBand) * env;
    vec3 fromCol = vec3(texture(iChannelFrom, clamp(sampleUv + vec2(ca, 0.0), 0.0, 1.0)).r, texture(iChannelFrom, sampleUv).g, texture(iChannelFrom, clamp(sampleUv - vec2(ca, 0.0), 0.0, 1.0)).b);
    vec3 toCol = vec3(texture(iChannelTo, clamp(sampleUv + vec2(ca, 0.0), 0.0, 1.0)).r, texture(iChannelTo, sampleUv).g, texture(iChannelTo, clamp(sampleUv - vec2(ca, 0.0), 0.0, 1.0)).b);
    return vec4((mix(fromCol, toCol, smoothstep(0.42, 0.58, p)) * (0.9 + 0.1 * sin(uv.y * iResolution.y * PI))) + ((rand(uv * iResolution.xy + iTime * 100.0) - 0.5) * trackingBand * 1.4), 1.0);
}

// 27. ASCII Dither
vec4 transAsciiDither(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 grid = vec2(72.0 * (iResolution.x / max(iResolution.y, 1.0)), 72.0);
    vec3 rawMix = mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, smoothstep(0.4, 0.6, p));
    vec3 cellCol = mix(texture(iChannelFrom, (floor(uv * grid) + 0.5) / grid).rgb, texture(iChannelTo, (floor(uv * grid) + 0.5) / grid).rgb, smoothstep(0.4, 0.6, p));
    vec2 f = fract(uv * grid);
    float sym = step(1.0 - getLuma(cellCol), rand(floor(f * 5.0) + floor(getLuma(cellCol) * 8.0) * 13.7));
    float border = step(0.15, f.x) * step(f.x, 0.85) * step(0.15, f.y) * step(f.y, 0.85);
    return vec4(mix(rawMix, cellCol * (0.4 + 1.1 * sym * border), smoothstep(0.05, 0.35, env)), 1.0);
}

// 28. Strobe Stutter
vec4 transStrobeStutter(vec2 uv, float p) {
    float qP = floor(p * 14.0) / 14.0, env = sin(qP * PI), beat = fract(p * 14.0);
    vec2 sUv = uv;
    if (env > 0.25 && beat < 0.45) sUv.x = fract(uv.x + (rand(vec2(floor(uv.y * 8.0), qP)) - 0.5) * 0.25 * env);
    vec3 col = (mix(step(0.5, fract(p * 7.0 + p * 0.8)), step(0.5, p), abs(p - 0.5) * 2.0) > 0.5 ? texture(iChannelTo, sUv) : texture(iChannelFrom, sUv)).rgb;
    if (beat < 0.12 && env > 0.5) col = mix(col, 1.0 - col, 0.65);
    return vec4(col, 1.0);
}

// 29. Lens Flare Sweep
vec4 transLensFlareSweep(vec2 uv, float p) {
    float env = sin(p * PI), sweepX = mix(-0.3, 1.3, p);
    vec3 base = mix(texture(iChannelTo, uv).rgb, texture(iChannelFrom, uv).rgb, smoothstep(sweepX - 0.12, sweepX + 0.12, uv.x));
    float dx = abs(uv.x - sweepX);
    float dy = abs(uv.y - 0.5);
    vec3 flare = dx < 0.5 ? (vec3(0.25, 0.65, 1.0) * (exp(-dy * 28.0) * exp(-dx * 2.5) * 2.8) + vec3(1.0, 0.92, 0.8) * (exp(-length(vec2(dx * 0.8, dy * 1.6)) * 9.0) * 3.5)) : vec3(0.0);
    return vec4(base + flare * env, 1.0);
}

// 30. Iris Letterbox
vec4 transIrisLetterbox(vec2 uv, float p) {
    bool secondHalf = p > 0.5;
    float t = secondHalf ? (p - 0.5) * 2.0 : (0.5 - p) * 2.0;
    t = t * t * (3.0 - 2.0 * t);
    float irisMask = 1.0 - smoothstep((t * 0.95) - 0.03, (t * 0.95) + 0.01, length((uv - 0.5) * vec2(iResolution.x / max(iResolution.y, 1.0), 1.0)));
    float letterboxMask = step(abs(uv.y - 0.5), mix(0.0, 0.5, t));
    return vec4((secondHalf ? texture(iChannelTo, uv) : texture(iChannelFrom, uv)).rgb * irisMask * letterboxMask, 1.0);
}

// 31. Duotone Wipe
vec4 transDuotoneWipe(vec2 uv, float p) {
    float diag = (uv.x * 0.7 + uv.y * 0.3), front = p * 1.4 - 0.2;
    vec3 base = mix(texture(iChannelTo, uv).rgb, texture(iChannelFrom, uv).rgb, smoothstep(front - 0.05, front + 0.05, diag));
    return vec4(mix(base, mix(vec3(0.08, 0.02, 0.28), vec3(1.0, 0.12, 0.62), smoothstep(0.2, 0.8, getLuma(base))), smoothstep(0.22, 0.0, abs(diag - front)) * sin(p * PI)), 1.0);
}

// 32. Multi Panel Grid
vec4 transMultiPanelGrid(vec2 uv, float p) {
    const float N = 3.0;
    vec2 cell = floor(uv * N), f = fract(uv * N) - 0.5;
    float flip = cos(clamp((p * 1.5) - ((cell.y * N + cell.x) / (N * N - 1.0)) * 0.5, 0.0, 1.0) * PI);
    vec2 localSample = f / vec2(max(abs(flip), 0.02), 1.0) + 0.5;
    if (localSample.x < 0.0 || localSample.x > 1.0) return vec4(0.04, 0.04, 0.06, 1.0);
    return vec4((flip >= 0.0 ? texture(iChannelFrom, (cell + localSample) / N) : texture(iChannelTo, (cell + localSample) / N)).rgb * (0.45 + 0.55 * abs(flip)), 1.0);
}

// 33. Outrun Grid
vec4 transOutrunGrid(vec2 uv, float p) {
    float env = sin(p * PI), horizon = mix(-0.1, 1.1, p), depth = max(abs(uv.y - horizon), 0.015);
    vec3 base = mix(texture(iChannelTo, uv).rgb, texture(iChannelFrom, uv).rgb, smoothstep(horizon - 0.04, horizon + 0.04, uv.y));
    vec2 g = abs(fract(vec2((uv.x - 0.5) / depth * 0.45, 0.35 / depth + iTime * 3.0)) - 0.5);
    return vec4(base + mix(vec3(1.0, 0.15, 0.75), vec3(0.1, 0.9, 1.0), uv.x) * (smoothstep(0.45, 0.49, max(g.x, g.y)) * 1.5 + 0.35) * (exp(-abs(uv.y - horizon) * 9.0) * env), 1.0);
}

// 34. Radial Sunburst
vec4 transRadialSunburst(vec2 uv, float p) {
    float aspect = iResolution.x / max(iResolution.y, 1.0);
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
    float r = length(c), reach = p * 1.45 * mix(0.65, 1.25, sin(atan(c.y, c.x) * 24.0 + p * 6.0) * 0.5 + 0.5);
    vec3 col = mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, 1.0 - smoothstep(reach - 0.04, reach + 0.04, r));
    return vec4(mix(col, vec3(1.0, 0.95, 0.3), smoothstep(0.06, 0.0, abs(r - reach)) * sin(p * PI) * 0.85), 1.0);
}

// 35. Stardust Vortex
vec4 transStardustVortex(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 centered = uv - 0.5;
    float r = length(centered);
    vec3 base = mix(texture(iChannelFrom, clamp(0.5 + rot2d(env * 2.5 * (1.0 - r)) * centered, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(0.5 + rot2d(-env * 2.5 * (1.0 - r)) * centered, 0.0, 1.0)).rgb, smoothstep(0.3, 0.7, p));
    vec3 dust = vec3(0.0);
    for (int i = 0; i < 3; i++) {
        vec2 pUv = rot2d(p * 4.0 * (float(i) + 1.0) + r * 3.0) * centered * (18.0 * (float(i) + 1.0)) + vec2((float(i) + 1.0) * 7.3);
        dust += mix(vec3(1.0, 0.8, 0.4), vec3(0.4, 0.85, 1.0), rand(floor(pUv) + 2.1)) * (smoothstep(0.14, 0.0, length(fract(pUv) - 0.5 - (hash22(floor(pUv)) - 0.5) * 0.6)) * step(0.65, rand(floor(pUv))));
    }
    return vec4(base + dust * env * 1.8, 1.0);
}

// 36. Menger Tunnel
vec4 transMengerTunnel(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 pCoord = (uv - 0.5) * 2.0; pCoord.x *= iResolution.x / max(iResolution.y, 1.0);
    float r = length(pCoord);
    vec2 tunnelUv = vec2(atan(pCoord.y, pCoord.x) / TAU + 0.5, 0.2 / max(r, 0.01) + p * 6.0);
    vec3 base = mix(texture(iChannelFrom, clamp(uv + (pCoord / max(r, 0.1)) * env * 0.08, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(uv - (pCoord / max(r, 0.1)) * (1.0 - env) * 0.08, 0.0, 1.0)).rgb, smoothstep(0.35, 0.65, p));
    return vec4(base + mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.8), sin(tunnelUv.y)) * (1.0 - abs(sin(tunnelUv.x * 12.0) * cos(tunnelUv.y * 12.0))) * smoothstep(0.1, 0.4, r) * env * 0.8, 1.0);
}

// 37. Copper Raster
vec4 transCopperRaster(vec2 uv, float p) {
    float env = sin(p * PI), bar = pow(max(sin(uv.y * 18.0 + iTime * 6.0 + p * 12.0), 0.0), 8.0) * env;
    vec2 warpUv = uv + vec2(sin(uv.y * 30.0 + iTime * 10.0) * 0.03 * bar, 0.0);
    return vec4(mix(texture(iChannelFrom, clamp(warpUv, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(warpUv, 0.0, 1.0)).rgb, smoothstep(0.3, 0.7, p)) + mix(vec3(0.2, 0.9, 0.4), vec3(0.9, 0.3, 1.0), sin(uv.y * 4.0 + iTime)) * bar * 1.5, 1.0);
}

// 38. Metaball Blob
vec4 transMetaballBlob(vec2 uv, float p) {
    float aspect = iResolution.x / max(iResolution.y, 1.0);
    vec2 st = uv * vec2(aspect, 1.0);
    float metaball = 0.08 / (pow(length(st - vec2(aspect * 0.5 + sin(iTime * 2.0) * 0.3, 0.5 + cos(iTime * 1.5) * 0.2)), 2.0) + 0.01) + 0.08 / (pow(length(st - vec2(aspect * 0.5 + cos(iTime * 1.8) * 0.3, 0.5 + sin(iTime * 2.2) * 0.2)), 2.0) + 0.01);
    float threshold = mix(-0.5, 3.5, p);
    vec3 col = mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, smoothstep(threshold - 0.1, threshold + 0.1, metaball));
    return vec4(col + vec3(0.2, 0.9, 1.0) * (1.0 - smoothstep(0.0, 0.05, abs(metaball - threshold))) * sin(p * PI) * 0.7, 1.0);
}

// 39. Oscilloscope Wipe
vec4 transOscilloscopeWipe(vec2 uv, float p) {
    float wave = sin(uv.x * 35.0 + iTime * 15.0) * cos(uv.x * 12.0 - iTime * 8.0) * 0.18 * sin(p * PI);
    vec3 col = mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, smoothstep(p - 0.1, p + 0.1, uv.x + wave * 0.5));
    return vec4(col + vec3(0.1, 1.0, 0.45) * smoothstep(0.015, 0.0, abs(uv.y - (0.5 + wave))) * 2.5, 1.0);
}

// 40. Hex Extrude
vec4 transHexExtrude(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 st = uv * 16.0; st.x *= iResolution.x / max(iResolution.y, 1.0);
    vec2 s = floor(st);
    float localP = clamp((p * 1.4) - rand(s) * 0.4, 0.0, 1.0);
    vec2 hexUv = fract(st) - 0.5;
    vec2 displacedUv = uv + (hash22(s) - 0.5) * localP * 0.15;
    vec3 col = mix(texture(iChannelFrom, clamp(displacedUv, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(displacedUv, 0.0, 1.0)).rgb, smoothstep(0.3, 0.7, localP));
    return vec4(col * mix(1.0, 0.6 + 0.4 * smoothstep(0.42, 0.48, max(abs(hexUv.x), abs(hexUv.x * 0.5 + hexUv.y * 0.866))), env), 1.0);
}

// 41. SDF Gyroid
vec4 transSdfGyroid(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 pCoord = (uv - 0.5) * 2.0; pCoord.x *= iResolution.x / max(iResolution.y, 1.0);
    vec3 ro = vec3(0.0, 0.0, -3.0 + p * 4.0), rd = normalize(vec3(pCoord, 1.5));
    float tDist = 0.0, dens = 0.0;
    for (int i = 0; i < 28; i++) {
        vec3 pos = ro + rd * tDist; pos.xy *= rot2d(iTime * 0.2 + p * 2.0);
        float d = abs(dot(sin(pos), cos(pos.zxy))) - 0.35;
        tDist += max(d * 0.6, 0.02);
        if (d < 0.01 || tDist > 6.0) { dens = float(i) / 28.0; break; }
    }
    vec2 warp = vec2(sin(tDist * 3.0), cos(tDist * 3.0)) * 0.08 * env;
    vec3 base = mix(texture(iChannelFrom, clamp(uv + warp, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(uv - warp, 0.0, 1.0)).rgb, smoothstep(0.3, 0.7, p));
    return vec4(base + mix(vec3(0.9, 0.2, 0.6), vec3(0.1, 0.7, 1.0), dens) * (1.0 - dens) * env * 1.2, 1.0);
}

// 42. Optical Flow
vec4 transOpticalFlow(vec2 uv, float p) {
    float env = sin(p * PI);
    float lCenter = getLuma(texture(iChannelFrom, uv).rgb);
    vec2 flow = vec2(getLuma(texture(iChannelFrom, clamp(uv + vec2(0.01, 0.0), 0.0, 1.0)).rgb) - lCenter, getLuma(texture(iChannelFrom, clamp(uv + vec2(0.0, 0.01), 0.0, 1.0)).rgb) - lCenter) * 1.5;
    float noiseWarp = fbm(uv * 8.0 + p * 3.0), dissolve = smoothstep(0.2, 0.8, p + (noiseWarp - 0.5) * 0.4);
    vec3 col = mix(texture(iChannelFrom, clamp(uv - flow * p * 0.25 + vec2(noiseWarp * 0.02 * env, 0.0), 0.0, 1.0)).rgb, texture(iChannelTo, clamp(uv + flow * (1.0 - p) * 0.25 - vec2(noiseWarp * 0.02 * env, 0.0), 0.0, 1.0)).rgb, dissolve);
    return vec4(col + vec3(0.4, 0.9, 1.0) * (1.0 - smoothstep(0.0, 0.2, abs(dissolve - 0.5))) * env * 0.5, 1.0);
}

// 43. Hologram Shift
vec4 transHologramShift(vec2 uv, float p) {
    float env = sin(p * PI), glitch = step(0.96, rand(vec2(floor(iTime * 15.0), floor(uv.y * 30.0)))) * env;
    vec2 shiftUv = uv + vec2(glitch * 0.08, 0.0);
    vec3 base = mix(texture(iChannelFrom, clamp(shiftUv, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(shiftUv, 0.0, 1.0)).rgb, smoothstep(0.35, 0.65, p));
    vec3 spec = vec3(sin(uv.x * 12.0 + p * 10.0), sin(uv.x * 12.0 + p * 10.0 + 2.094), sin(uv.x * 12.0 + p * 10.0 + 4.188)) * 0.5 + 0.5;
    return vec4((base * vec3(0.1, 0.85, 1.0) * (1.5 + sin(uv.y * iResolution.y * 0.75 + iTime * 20.0) * 0.25)) + spec * env * 0.4, 1.0);
}

// 44. Classified Redaction
vec4 transClassifiedRedaction(vec2 uv, float p) {
    float env = sin(p * PI);
    const float BARS = 6.0;
    float barId = floor(uv.y * BARS);
    float slide = smoothstep(0.0, 1.0, (p * 1.5) - (barId * 0.15));
    float redactionMask = step(abs(uv.x - (slide * 1.5 - 0.25)), 0.65);
    vec3 fromCol = texture(iChannelFrom, uv).rgb;
    vec3 toCol   = texture(iChannelTo, uv).rgb;
    vec3 redactionColor = vec3(0.05, 0.05, 0.06);
    vec3 col = mix(fromCol, redactionColor, redactionMask);
    if (p > 0.5) col = mix(redactionColor, toCol, smoothstep(0.5, 0.9, p));
    return vec4(col, 1.0);
}

// 45. Red String Board
vec4 transRedStringBoard(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 pCoord = (uv - 0.5) * vec2(iResolution.x / max(iResolution.y, 1.0), 1.0);
    float cork = fbm(uv * 12.0) * 0.15 + 0.85;
    vec2 p1 = vec2(-0.4 * sin(p * PI), 0.3 * cos(p * PI));
    vec2 p2 = vec2(0.5 * cos(p * 2.0), -0.4 * sin(p * 1.5));
    float d = abs(pCoord.y - p1.y - (p2.y - p1.y) / (p2.x - p1.x + 0.001) * (pCoord.x - p1.x));
    float stringLine = smoothstep(0.012, 0.002, d) * env;
    vec3 base = mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, smoothstep(0.35, 0.65, p));
    return vec4(mix(base * (vec3(0.65, 0.48, 0.3) * cork), vec3(0.9, 0.1, 0.15), stringLine), 1.0);
}

// 46. Satellite Zoom
vec4 transSatelliteZoom(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 centered = uv - 0.5;
    float zoom = mix(1.0, 8.0, pow(p, 2.0));
    vec2 zoomedUv = 0.5 + centered / zoom;
    vec3 col = mix(texture(iChannelFrom, clamp(zoomedUv, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(zoomedUv, 0.0, 1.0)).rgb, smoothstep(0.3, 0.7, p));
    float dist = length(centered * vec2(iResolution.x / max(iResolution.y, 1.0), 1.0));
    float reticle = smoothstep(0.32, 0.33, dist) * (1.0 - smoothstep(0.35, 0.36, dist));
    float crosshair = (abs(centered.x) < 0.02 && abs(centered.y) < 0.15) || (abs(centered.y) < 0.02 && abs(centered.x) < 0.15) ? 1.0 : 0.0;
    return vec4(col + vec3(0.1, 1.0, 0.3) * (reticle + crosshair) * env * 0.8, 1.0);
}

// 47. Debris Flyby
vec4 transDebrisFlyby(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 pCoord = (uv - 0.5) * 2.0; pCoord.x *= iResolution.x / max(iResolution.y, 1.0);
    float zDepth = 1.0 / (length(pCoord) + 0.1) - p * 15.0;
    vec2 debrisUv = pCoord * zDepth * 0.5 + 0.5;
    vec3 base = mix(texture(iChannelFrom, clamp(uv + pCoord * env * 0.1, 0.0, 1.0)).rgb, texture(iChannelTo, clamp(uv - pCoord * (1.0 - env) * 0.1, 0.0, 1.0)).rgb, smoothstep(0.35, 0.65, p));
    return vec4(base + vec3(0.7, 0.9, 1.0) * step(0.92, rand(floor(debrisUv * 32.0))) * env * 1.5, 1.0);
}

// 48. Wireframe Platonic
vec4 transWireframePlatonic(vec2 uv, float p) {
    float env = sin(p * PI);
    vec2 pCoord = (uv - 0.5) * 2.0; pCoord.x *= iResolution.x / max(iResolution.y, 1.0);
    pCoord *= rot2d(p * TAU);
    float d = abs(pCoord.x) + abs(pCoord.y) + abs(pCoord.x + pCoord.y) * 0.5 - mix(0.2, 1.5, p);
    vec3 base = mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, smoothstep(0.4, 0.6, p));
    return vec4(base + vec3(0.0, 1.0, 0.75) * (smoothstep(0.04, 0.01, abs(d)) * env) * 2.0, 1.0);
}

// 49. XFiles Static
vec4 transXFilesStatic(vec2 uv, float p) {
    float env = sin(p * PI);
    float noise = (rand(uv * iResolution.xy + iTime * 50.0) - 0.5) * 0.35 * env;
    float scanline = 0.9 + 0.1 * sin(uv.y * iResolution.y * 0.75);
    vec3 base = mix(texture(iChannelFrom, uv).rgb, texture(iChannelTo, uv).rgb, smoothstep(0.35, 0.65, p));
    return vec4((base * vec3(0.12, 0.95, 0.35) * 1.3 * scanline) + vec3(noise), 1.0);
}

void main() {
    vec2 uv = vUv;
    vec4 result;

    if      (uTransitionType == 1)  result = transSlowShutter(uv, uProgress);
    else if (uTransitionType == 2)  result = transDatamosh(uv, uProgress);
    else if (uTransitionType == 3)  result = transWhipPan(uv, uProgress);
    else if (uTransitionType == 4)  result = transGlitchCut(uv, uProgress);
    else if (uTransitionType == 5)  result = transFilmFlash(uv, uProgress);
    else if (uTransitionType == 6)  result = transAnamorphicBurn(uv, uProgress);
    else if (uTransitionType == 7)  result = transDollyZoom(uv, uProgress);
    else if (uTransitionType == 8)  result = transBokehRack(uv, uProgress);
    else if (uTransitionType == 9)  result = transPrismSplit(uv, uProgress);
    else if (uTransitionType == 10) result = transCrtShut(uv, uProgress);
    else if (uTransitionType == 11) result = transInkBleed(uv, uProgress);
    else if (uTransitionType == 12) result = transLiquidChrome(uv, uProgress);
    else if (uTransitionType == 13) result = transShockwave(uv, uProgress);
    else if (uTransitionType == 14) result = transHeatHaze(uv, uProgress);
    else if (uTransitionType == 15) result = transBlockTear(uv, uProgress);
    else if (uTransitionType == 16) result = transRgbSlide(uv, uProgress);
    else if (uTransitionType == 17) result = transMosaicCrush(uv, uProgress);
    else if (uTransitionType == 18) result = transVenetianBlinds(uv, uProgress);
    else if (uTransitionType == 19) result = transVortexTwist(uv, uProgress);
    else if (uTransitionType == 20) result = transHalftoneDots(uv, uProgress);
    else if (uTransitionType == 21) result = transVoronoiShatter(uv, uProgress);
    else if (uTransitionType == 22) result = transPlasmaArc(uv, uProgress);
    else if (uTransitionType == 23) result = transWaxMelt(uv, uProgress);
    else if (uTransitionType == 24) result = transTopoContours(uv, uProgress);
    else if (uTransitionType == 25) result = transBinaryRain(uv, uProgress);
    else if (uTransitionType == 26) result = transVhsTracking(uv, uProgress);
    else if (uTransitionType == 27) result = transAsciiDither(uv, uProgress);
    else if (uTransitionType == 28) result = transStrobeStutter(uv, uProgress);
    else if (uTransitionType == 29) result = transLensFlareSweep(uv, uProgress);
    else if (uTransitionType == 30) result = transIrisLetterbox(uv, uProgress);
    else if (uTransitionType == 31) result = transDuotoneWipe(uv, uProgress);
    else if (uTransitionType == 32) result = transMultiPanelGrid(uv, uProgress);
    else if (uTransitionType == 33) result = transOutrunGrid(uv, uProgress);
    else if (uTransitionType == 34) result = transRadialSunburst(uv, uProgress);
    else if (uTransitionType == 35) result = transStardustVortex(uv, uProgress);
    else if (uTransitionType == 36) result = transMengerTunnel(uv, uProgress);
    else if (uTransitionType == 37) result = transCopperRaster(uv, uProgress);
    else if (uTransitionType == 38) result = transMetaballBlob(uv, uProgress);
    else if (uTransitionType == 39) result = transOscilloscopeWipe(uv, uProgress);
    else if (uTransitionType == 40) result = transHexExtrude(uv, uProgress);
    else if (uTransitionType == 41) result = transSdfGyroid(uv, uProgress);
    else if (uTransitionType == 42) result = transOpticalFlow(uv, uProgress);
    else if (uTransitionType == 43) result = transHologramShift(uv, uProgress);
    else if (uTransitionType == 44) result = transClassifiedRedaction(uv, uProgress);
    else if (uTransitionType == 45) result = transRedStringBoard(uv, uProgress);
    else if (uTransitionType == 46) result = transSatelliteZoom(uv, uProgress);
    else if (uTransitionType == 47) result = transDebrisFlyby(uv, uProgress);
    else if (uTransitionType == 48) result = transWireframePlatonic(uv, uProgress);
    else if (uTransitionType == 49) result = transXFilesStatic(uv, uProgress);
    else                            result = transFadeSmooth(uv, uProgress);

    gl_FragColor = result;
}
`;

function wrapCustomTransitionShader(glslSource: string): string {
    const header = `
#define HW_PERFORMANCE 1
varying vec2 vUv;
uniform sampler2D iChannelFrom;
uniform sampler2D iChannelTo;
uniform float uProgress;
uniform float iTime;
uniform vec3 iResolution;
uniform sampler2D iAudioData;
`;
    let code = glslSource;
    if (!/uniform\s+sampler2D\s+iChannelFrom\b/.test(code)) {
        code = header + "\n" + code;
    }
    if (/\bvoid\s+mainImage\s*\(/.test(code) && !/\bvoid\s+main\s*\(/.test(code)) {
        code += `
void main() {
    vec4 fragColor = vec4(0.0);
    mainImage(fragColor, vUv * iResolution.xy);
    gl_FragColor = fragColor;
}
`;
    }
    return code;
}

export class ShaderTransitionPass {
    public rtFrom: WebGLRenderTarget;
    public rtTo: WebGLRenderTarget;

    private builtinMaterial: ShaderMaterial;
    private customMaterial: ShaderMaterial | null = null;
    private sharedUniforms: { [uniform: string]: IUniform };

    private fromScene: Scene;
    private toScene: Scene;
    private fromMesh: Mesh;
    private toMesh: Mesh;
    private lastRandomEffect: TransitionEffect | null = null;
    private fromCapturedThisTransition = false;

    private static warmupTarget: WebGLRenderTarget | null = null;

    constructor(width: number, height: number, audioTexture?: Texture) {
        const w = Math.max(1, Math.round(width));
        const h = Math.max(1, Math.round(height));

        const opts = {
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            type: HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false,
        };

        this.rtFrom = new WebGLRenderTarget(w, h, opts);
        this.rtTo = new WebGLRenderTarget(w, h, opts);

        this.sharedUniforms = {
            iChannelFrom: { value: this.rtFrom.texture },
            iChannelTo: { value: this.rtTo.texture },
            uProgress: { value: 0.0 },
            iTime: { value: 0.0 },
            iResolution: { value: new Vector3(w, h, 1.0) },
            iAudioData: { value: audioTexture ?? null },
            uTransitionType: { value: TransitionEffect.FadeSmooth },
        };

        this.builtinMaterial = this.createCheckedMaterial(
            BUILTIN_TRANSITION_FRAGMENT_SHADER,
            "BuiltinTransitionShader"
        );

        const geo = new PlaneGeometry(1, 1);
        this.fromScene = new Scene();
        this.toScene = new Scene();
        this.fromMesh = new Mesh(geo);
        this.toMesh = new Mesh(geo);
        this.fromMesh.frustumCulled = false;
        this.toMesh.frustumCulled = false;
        this.fromScene.add(this.fromMesh);
        this.toScene.add(this.toMesh);
    }

    private createCheckedMaterial(fragmentShader: string, label: string): ShaderMaterial {
        const mat = new ShaderMaterial({
            vertexShader: TRANSITION_VERTEX_SHADER,
            fragmentShader,
            side: DoubleSide,
            depthTest: false,
            depthWrite: false,
            uniforms: this.sharedUniforms,
        });
        mat.name = label;
        return mat;
    }

    public get activeMaterial(): ShaderMaterial {
        if (this.sharedUniforms.uTransitionType.value === TransitionEffect.CustomShader && this.customMaterial) {
            return this.customMaterial;
        }
        return this.builtinMaterial;
    }

    public get shouldFreezeOutgoing(): boolean {
        const currentType = this.sharedUniforms.uTransitionType.value as TransitionEffect;
        return TRANSITION_EFFECT_CONFIGS[currentType]?.freezeOutgoing ?? false;
    }

    public get hasCapturedOutgoingFrame(): boolean {
        return this.fromCapturedThisTransition;
    }

    public resetTransitionCapture(): void {
        this.fromCapturedThisTransition = false;
    }

    public setTransitionType(type: TransitionEffect): void {
        this.sharedUniforms.uTransitionType.value = type;
        this.fromCapturedThisTransition = false;
    }

    public pickRandomTransition(): TransitionEffect {
        const pool = BUILTIN_TRANSITION_EFFECTS.filter((e) => e !== this.lastRandomEffect);
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        this.lastRandomEffect = chosen;
        this.setTransitionType(chosen);
        return chosen;
    }

    public static createSnapshotMaterial(source: ShaderMaterial, vertexShader: string): ShaderMaterial {
        const snapshotUniforms: { [uniform: string]: IUniform } = {};
        for (const key of Object.keys(source.uniforms)) {
            const u = source.uniforms[key];
            if (!u) continue;
            const val = u.value;
            if (typeof val === "number" || typeof val === "boolean") {
                snapshotUniforms[key] = { value: val };
            } else if (val && typeof val.clone === "function" && !val.isTexture && !val.isWebGLRenderTarget) {
                snapshotUniforms[key] = { value: val.clone() };
            } else {
                snapshotUniforms[key] = { value: val };
            }
        }
        if (snapshotUniforms.iTransitionOpacity) {
            snapshotUniforms.iTransitionOpacity.value = 1.0;
        }

        return new ShaderMaterial({
            vertexShader,
            fragmentShader: source.fragmentShader,
            uniforms: snapshotUniforms,
            side: DoubleSide,
            depthTest: false,
            depthWrite: false,
        });
    }

    public static syncVideoTexture(videoTex?: VideoTexture | null, videoEl?: HTMLVideoElement | null): void {
        if (videoTex && videoEl && videoEl.readyState >= 2) {
            videoTex.needsUpdate = true;
        }
    }

    private static scheduleBackgroundTask(fn: () => void): Promise<void> {
        return new Promise((resolve) => {
            const run = () => {
                try {
                    fn();
                } finally {
                    resolve();
                }
            };
            if (typeof window !== "undefined" && typeof (window as any).requestIdleCallback === "function") {
                (window as any).requestIdleCallback(run, { timeout: 60 });
            } else {
                setTimeout(run, 0);
            }
        });
    }

    public static async precompileShaders(
        gl: WebGLRenderer,
        camera: Camera,
        materials: (ShaderMaterial | null | undefined)[],
        extraPasses?: { scene: Scene; camera: Camera }[]
    ): Promise<number> {
        const startTime = performance.now();
        const tempGeo = new PlaneGeometry(1, 1);
        const tempScene = new Scene();

        for (const mat of materials) {
            if (!mat) continue;
            const tempMesh = new Mesh(tempGeo, mat);
            tempMesh.frustumCulled = false;
            tempScene.add(tempMesh);
        }

        try {
            if (typeof (gl as any).compileAsync === "function") {
                await (gl as any).compileAsync(tempScene, camera);
                if (extraPasses) {
                    for (const pass of extraPasses) {
                        await (gl as any).compileAsync(pass.scene, pass.camera);
                    }
                }
            } else {
                gl.compile(tempScene, camera);
                if (extraPasses) {
                    for (const pass of extraPasses) {
                        gl.compile(pass.scene, pass.camera);
                    }
                }
            }

            await this.scheduleBackgroundTask(() => {
                if (!this.warmupTarget) {
                    this.warmupTarget = new WebGLRenderTarget(1, 1, {
                        minFilter: LinearFilter,
                        magFilter: LinearFilter,
                        format: RGBAFormat,
                        depthBuffer: false,
                        stencilBuffer: false,
                    });
                }
                const prevTarget = gl.getRenderTarget();
                gl.setRenderTarget(this.warmupTarget);
                gl.render(tempScene, camera);
                if (extraPasses) {
                    for (const pass of extraPasses) {
                        gl.render(pass.scene, pass.camera);
                    }
                }
                gl.setRenderTarget(prevTarget);
            });
        } finally {
            tempGeo.dispose();
        }

        return performance.now() - startTime;
    }

    public setCustomTransitionShader(glslSource: string): void {
        if (this.customMaterial) {
            this.customMaterial.dispose();
        }
        this.customMaterial = this.createCheckedMaterial(
            wrapCustomTransitionShader(glslSource),
            "CustomTransitionShader"
        );
        this.sharedUniforms.uTransitionType.value = TransitionEffect.CustomShader;
        this.fromCapturedThisTransition = false;
    }

    public resize(width: number, height: number): void {
        const w = Math.max(1, Math.round(width));
        const h = Math.max(1, Math.round(height));
        this.rtFrom.setSize(w, h);
        this.rtTo.setSize(w, h);
        this.sharedUniforms.iResolution.value.set(w, h, 1.0);
    }

    public updateOffscreenTargets(
        gl: WebGLRenderer,
        camera: Camera,
        viewportWidth: number,
        viewportHeight: number,
        fromMaterial: ShaderMaterial | null,
        toMaterial: ShaderMaterial,
        progress: number,
        time: number,
        audioTexture?: Texture
    ): void {
        const prevTarget = gl.getRenderTarget();
        const fboW = this.rtFrom.width;
        const fboH = this.rtFrom.height;

        if (fromMaterial && (!this.shouldFreezeOutgoing || !this.fromCapturedThisTransition)) {
            if (fromMaterial.uniforms.iTransitionOpacity) {
                fromMaterial.uniforms.iTransitionOpacity.value = 1.0;
            }
            this.fromMesh.scale.set(viewportWidth, viewportHeight, 1);
            fromMaterial.side = DoubleSide;
            this.fromMesh.material = fromMaterial;

            const prevFromRes = fromMaterial.uniforms.iResolution?.value?.clone();
            if (fromMaterial.uniforms.iResolution?.value) {
                fromMaterial.uniforms.iResolution.value.set(fboW, fboH, 1.0);
            }
            gl.setRenderTarget(this.rtFrom);
            gl.clear(true, true, false);
            gl.render(this.fromScene, camera);
            if (prevFromRes && fromMaterial.uniforms.iResolution?.value) {
                fromMaterial.uniforms.iResolution.value.copy(prevFromRes);
            }
            this.fromCapturedThisTransition = true;
        }

        if (toMaterial.uniforms.iTransitionOpacity) {
            toMaterial.uniforms.iTransitionOpacity.value = 1.0;
        }
        this.toMesh.scale.set(viewportWidth, viewportHeight, 1);
        toMaterial.side = DoubleSide;
        this.toMesh.material = toMaterial;

        const prevToRes = toMaterial.uniforms.iResolution?.value?.clone();
        if (toMaterial.uniforms.iResolution?.value) {
            toMaterial.uniforms.iResolution.value.set(fboW, fboH, 1.0);
        }
        gl.setRenderTarget(this.rtTo);
        gl.clear(true, true, false);
        gl.render(this.toScene, camera);
        if (prevToRes && toMaterial.uniforms.iResolution?.value) {
            toMaterial.uniforms.iResolution.value.copy(prevToRes);
        }

        gl.setRenderTarget(prevTarget);

        this.sharedUniforms.iChannelFrom.value = this.rtFrom.texture;
        this.sharedUniforms.iChannelTo.value = this.rtTo.texture;
        this.sharedUniforms.uProgress.value = progress;
        this.sharedUniforms.iTime.value = time;
        if (audioTexture) {
            this.sharedUniforms.iAudioData.value = audioTexture;
        }
    }

    public dispose(): void {
        this.rtFrom.dispose();
        this.rtTo.dispose();
        this.builtinMaterial.dispose();
        this.customMaterial?.dispose();
    }
}