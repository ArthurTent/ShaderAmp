export const VERSION = __SHADERAMP_VERSION__;
export const DEFAULT_ASSET_BASE_URL = `https://cdn.jsdelivr.net/npm/shaderamp@${VERSION}/assets/`;

export const DEFAULT_SHADER = '3DAudioVisualizerNumber2.frag';

export const FFT_TEXTURE_WIDTH = 512;
export const ANALYSER_FFT_SIZE = 2048;
export const KEYBOARD_TEXTURE_WIDTH = 256;
export const KEYBOARD_TEXTURE_HEIGHT = 5; // Shadertoy layout incl. press/release time rows

export const DEFAULT_CHANNEL_IMAGES = [
    'images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg',
    'images/beton_3_pexels-photo-5622880.jpeg',
    'images/NyanCatSprite.png',
    'images/NyanCatSprite.png',
];
export const DEFAULT_CUBEMAP = 'images/cubemaps/abc.jpg';

export const MIN_SPEED = 0.3;
export const MIN_RATE = 0.25;
export const MAX_RATE = 3.0;
export const BEAT_BASS_THRESHOLD = 200;
export const FADE_DURATION = 0.8;
export const MAX_FRAME_DELTA = 0.1;

export const MIDI_TEXTURE_WIDTH = 128;
export const MIDI_TEXTURE_HEIGHT = 4;
export const MIDI_FFT_DECAY = 0.85;
export const MIDI_FFT_INJECTION_BINS = 512;

export const VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vRayOri;
varying vec3 vRayDir;
void main()
{
    vUv = uv;
    vRayOri = cameraPosition;
    vRayDir = vec3(0.0, 0.0, -1.0);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
}
`;
