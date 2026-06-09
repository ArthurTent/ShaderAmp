/**
 * Volume Noise Generator for Shadertoy-compatible 3D textures
 * 
 * Generates 32x32x32 noise textures matching Shadertoy's greyNoise3D and RGBA Noise3D.
 * These are used for pseudo-random number generation in shaders.
 */
import { Data3DTexture, RedFormat, LuminanceFormat, UnsignedByteType, ClampToEdgeWrapping, NearestFilter } from 'three';

const VOLUME_SIZE = 32;

// Simplex noise implementation for deterministic noise generation
class SimplexNoise {
    private perm: Uint8Array;
    private permMod12: Uint8Array;

    constructor(seed = 0) {
        // Initialize permutation table
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        
        // Seeded shuffle
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    private grad3D(hash: number, x: number, y: number, z: number): number {
        const h = hash & 15;
        let u = h < 8 ? x : y;
        let v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise3D(x: number, y: number, z: number): number {
        const F3 = 1.0 / 3.0;
        const G3 = 1.0 / 6.0;

        let s = (x + y + z) * F3;
        let i = Math.floor(x + s);
        let j = Math.floor(y + s);
        let k = Math.floor(z + s);
        let t = (i + j + k) * G3;
        let X0 = i - t;
        let Y0 = j - t;
        let Z0 = k - t;
        let x0 = x - X0;
        let y0 = y - Y0;
        let z0 = z - Z0;

        let i1, j1, k1, i2, j2, k2;
        if (x0 >= y0) {
            if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
            else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
            else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
        } else {
            if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
            else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
            else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        }

        let x1 = x0 - i1 + G3;
        let y1 = y0 - j1 + G3;
        let z1 = z0 - k1 + G3;
        let x2 = x0 - i2 + 2.0 * G3;
        let y2 = y0 - j2 + 2.0 * G3;
        let z2 = z0 - k2 + 2.0 * G3;
        let x3 = x0 - 1.0 + 3.0 * G3;
        let y3 = y0 - 1.0 + 3.0 * G3;
        let z3 = z0 - 1.0 + 3.0 * G3;

        let ii = i & 255;
        let jj = j & 255;
        let kk = k & 255;

        let n0 = x0 * x0 + y0 * y0 + z0 * z0 < 0.000001 ? 0.0 : 
            (0.6 - x0 * x0 - y0 * y0 - z0 * z0) * (0.6 - x0 * x0 - y0 * y0 - z0 * z0) * 
            this.grad3D(this.permMod12[ii + this.perm[jj + this.perm[kk]]], x0, y0, z0);

        let n1 = x1 * x1 + y1 * y1 + z1 * z1 < 0.000001 ? 0.0 :
            (0.6 - x1 * x1 - y1 * y1 - z1 * z1) * (0.6 - x1 * x1 - y1 * y1 - z1 * z1) *
            this.grad3D(this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]], x1, y1, z1);

        let n2 = x2 * x2 + y2 * y2 + z2 * z2 < 0.000001 ? 0.0 :
            (0.6 - x2 * x2 - y2 * y2 - z2 * z2) * (0.6 - x2 * x2 - y2 * y2 - z2 * z2) *
            this.grad3D(this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]], x2, y2, z2);

        let n3 = x3 * x3 + y3 * y3 + z3 * z3 < 0.000001 ? 0.0 :
            (0.6 - x3 * x3 - y3 * y3 - z3 * z3) * (0.6 - x3 * x3 - y3 * y3 - z3 * z3) *
            this.grad3D(this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]], x3, y3, z3);

        return 32.0 * (n0 + n1 + n2 + n3);
    }
}

// Cache for generated textures
const textureCache = new Map<string, Data3DTexture>();

/**
 * Generate 32x32x32 grey noise (1 channel)
 * Returns values in range [0, 255]
 */
function generateGreyNoiseData(): Uint8Array {
    const noise = new SimplexNoise(12345);
    const data = new Uint8Array(VOLUME_SIZE * VOLUME_SIZE * VOLUME_SIZE);
    let idx = 0;
    
    for (let z = 0; z < VOLUME_SIZE; z++) {
        for (let y = 0; y < VOLUME_SIZE; y++) {
            for (let x = 0; x < VOLUME_SIZE; x++) {
                const nx = x * 0.05;
                const ny = y * 0.05;
                const nz = z * 0.05;
                const value = noise.noise3D(nx, ny, nz);
                // Map from [-1, 1] to [0, 255]
                data[idx++] = Math.floor((value + 1) * 0.5 * 255);
            }
        }
    }
    
    return data;
}

/**
 * Generate 32x32x32 RGBA noise (4 channels)
 * Returns values in range [0, 255] for each channel
 */
function generateRGBANoiseData(): Uint8Array {
    const noiseR = new SimplexNoise(11111);
    const noiseG = new SimplexNoise(22222);
    const noiseB = new SimplexNoise(33333);
    const noiseA = new SimplexNoise(44444);
    
    const data = new Uint8Array(VOLUME_SIZE * VOLUME_SIZE * VOLUME_SIZE * 4);
    let idx = 0;
    
    for (let z = 0; z < VOLUME_SIZE; z++) {
        for (let y = 0; y < VOLUME_SIZE; y++) {
            for (let x = 0; x < VOLUME_SIZE; x++) {
                const nx = x * 0.05;
                const ny = y * 0.05;
                const nz = z * 0.05;
                
                data[idx++] = Math.floor((noiseR.noise3D(nx, ny, nz) + 1) * 0.5 * 255);
                data[idx++] = Math.floor((noiseG.noise3D(nx, ny, nz) + 1) * 0.5 * 255);
                data[idx++] = Math.floor((noiseB.noise3D(nx, ny, nz) + 1) * 0.5 * 255);
                data[idx++] = Math.floor((noiseA.noise3D(nx, ny, nz) + 1) * 0.5 * 255);
            }
        }
    }
    
    return data;
}

/**
 * Get or create greyNoise3D texture
 * Shadertoy compatible 32x32x32 single channel noise
 */
export function getGreyNoise3DTexture(): Data3DTexture {
    const cacheKey = 'greyNoise3D';
    if (textureCache.has(cacheKey)) {
        return textureCache.get(cacheKey)!;
    }
    
    const data = generateGreyNoiseData();
    const texture = new Data3DTexture(data as unknown as ArrayBuffer, VOLUME_SIZE, VOLUME_SIZE, VOLUME_SIZE);
    texture.format = RedFormat;
    texture.type = UnsignedByteType;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.wrapR = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    
    textureCache.set(cacheKey, texture);
    return texture;
}

/**
 * Get or create RGBA Noise3D texture
 * Shadertoy compatible 32x32x32 RGBA noise
 */
export function getRGBANoise3DTexture(): Data3DTexture {
    const cacheKey = 'rgbaNoise3D';
    if (textureCache.has(cacheKey)) {
        return textureCache.get(cacheKey)!;
    }
    
    const data = generateRGBANoiseData();
    const texture = new Data3DTexture(data as unknown as ArrayBuffer, VOLUME_SIZE, VOLUME_SIZE, VOLUME_SIZE);
    // RGBAFormat is the default, but we don't need to import it explicitly
    texture.type = UnsignedByteType;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.wrapR = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    
    textureCache.set(cacheKey, texture);
    return texture;
}

/**
 * Known Shadertoy 3D noise texture hashes
 */
export const SHADERTOY_VOLUME_NOISE_HASHES: { [hash: string]: { type: 'grey' | 'rgba'; description: string } } = {
    // greyNoise3D - 32x32x32, 1 channel, uint8
    "b957ad6f36c3d1549930a2b0b7b14428cb3948aa1c4ef5914f47857f493374": {
        type: 'grey',
        description: "greyNoise3D - 32x32x32 single channel noise"
    },
    // RGBA Noise3D - 32x32x32, 4 channels, uint8
    "fa9a1bb94a81f5abf54b477622351077450bf9399ea8343e7979fa8f34f947c": {
        type: 'rgba',
        description: "RGBA Noise3D - 32x32x32 RGBA noise"
    }
};

/**
 * Check if a hash is a known volume texture
 */
export function isVolumeTextureHash(hash: string): boolean {
    return hash in SHADERTOY_VOLUME_NOISE_HASHES;
}

/**
 * Get the appropriate 3D noise texture by Shadertoy hash
 */
export function getVolumeTextureByHash(hash: string): Data3DTexture | null {
    const mapping = SHADERTOY_VOLUME_NOISE_HASHES[hash];
    if (!mapping) return null;
    
    return mapping.type === 'grey' ? getGreyNoise3DTexture() : getRGBANoise3DTexture();
}
