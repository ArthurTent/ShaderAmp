/**
 * Shadertoy to ShaderAmp Asset Mapping
 * 
 * Maps Shadertoy texture hashes/paths to ShaderAmp local assets.
 * Shadertoy uses hash-based filenames like:
 *   /media/a/08b42b43ae9d3c0605da11d0eac86618ea888e62cdd9518ee8b9097488b31560.png
 * 
 * This mapping provides fallback textures for common Shadertoy presets.
 */

// Known Shadertoy texture presets and their descriptions
// Based on analysis of shaders_all.json and Shadertoy's preset textures
export const SHADERTOY_TEXTURE_MAP: { [hash: string]: { shaderampPath: string; description: string } } = {
    // Font/Text textures
    "08b42b43ae9d3c0605da11d0eac86618ea888e62cdd9518ee8b9097488b31560": {
        shaderampPath: "images/otaviogood_shader_fontgen.png",
        description: "Font texture (ASCII characters)"
    },
    "f735bee5b64ef98879dc618b016ecf7939a5756040c2cde21ccb15e69a6e1cfb": {
        shaderampPath: "images/pierre-bamin-_EzTds6Fo44-unsplash.jpg",
        description: "Noise texture"
    },
    
    // Noise textures - map to a generic noise or pattern
    "0c7bf5fe9462d5bffbd11126e82908e39be3ce56220d900f633d58fb432e56f5": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Gray noise texture (fallback)"
    },
    "cb49c003b454385aa9975733aff4571c62182ccdda480aaba9a8d250014f00ec": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "RGBA noise texture (fallback)"
    },
    "cbcbb5a6cfb55c36f8f021fbb0e3f69ac96339a39fa85cd96f2017a2192821b5": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Noise texture (fallback)"
    },
    "ad56fba948dfba9ae698198c109e71f118a54d209c0ea50d77ea546abad89c57": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Blue noise texture (fallback)"
    },
    "0a40562379b63dfb89227e6d172f39fdce9022cba76623f1054a2c83d6c0ba5d": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Noise texture (fallback)"
    },
    
    // Nature/Sky textures
    "95b90082f799f48677b4f206d856ad572f1d178c676269eac6347631d4447258": {
        shaderampPath: "images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg",
        description: "Stars/night sky texture"
    },
    "92d7758c402f0927011ca8d0a7e40251439fba3a1dac26f5b8b62026323501aa": {
        shaderampPath: "images/sky-night-milky-way-star-a7d722848f56c2013568902945ea7c1b.jpg",
        description: "Night sky texture"
    },
    "e6e5631ce1237ae4c05b3563eda686400a401df4548d0f9fad40ecac1659c46c": {
        shaderampPath: "images/pexels-eberhard-grossgasteiger-966927.jpg",
        description: "Mountain/landscape texture"
    },
    "52d2a8f514c4fd2d9866587f4d7b2a5bfa1a11a0e772077d7682deb8b3b517e5": {
        shaderampPath: "images/pexels-eberhard-grossgasteiger-966927.jpg",
        description: "Nature/organic texture"
    },
    
    // Rock/Stone textures
    "79520a3d3a0f4d3caa440802ef4362e99d54e12b1392973e4ea321840970a88a": {
        shaderampPath: "images/beton_3_pexels-photo-5622880.jpeg",
        description: "Rock/stone texture"
    },
    "1f7dca9c22f324751f2a5a59c9b181dfe3b5564a04b724c657732d0bf09c99db": {
        shaderampPath: "images/beton_3_pexels-photo-5622880.jpeg",
        description: "Stone/concrete texture"
    },
    "3871e838723dd6b166e490664eead8ec60aedd6b8d95bc8e2fe3f882f0fd90f0": {
        shaderampPath: "images/beton_3_pexels-photo-5622880.jpeg",
        description: "Rock texture"
    },
    
    // Abstract/Pattern textures
    "fb918796edc3d2221218db0811e240e72e3403500083380c07a52bd353666a6": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Abstract pattern (fallback)"
    },
    "bd6464771e47eed832c5eb2cd85cdc0bfc697786b903bfd30f890f9d4fc36657": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Abstract texture (fallback)"
    },
    "8de3a3924cb95bd0e95a443fff0326c869f9d4979cd1d5b6e94e2a01f5be53e9": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Pattern texture (fallback)"
    },
    "488bd40303a2e2b9a71987e48c66ef41f5e937174bf316d3ed0e86410784b919": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Abstract texture (fallback)"
    },
    
    // Organic textures
    "3083c722c0c738cad0f468383167a0d246f91af2bfa373e9c5c094fb8c8413e0": {
        shaderampPath: "images/pierre-bamin-_EzTds6Fo44-unsplash.jpg",
        description: "Pierre Bamin landscape texture"
    },
    "10eb4fe0ac8a7dc348a2cc282ca5df1759ab8bf680117e4047728100969e7b43": {
        shaderampPath: "images/pierre-bamin-_EzTds6Fo44-unsplash.jpg",
        description: "Wood/organic texture"
    },
    
    // Rusty/Metal textures
    "8979352a182bde7c3c651ba2b2f4e0615de819585cc37b7175bcefbca15a6683": {
        shaderampPath: "images/beton_3_pexels-photo-5622880.jpeg",
        description: "Rusty metal texture"
    },
    
    // London/Urban textures
    "94284d43be78f00eb6b298e6d78656a1b34e2b91b34940d02f1ca8b22310e8a0": {
        shaderampPath: "images/pexels-eberhard-grossgasteiger-966927.jpg",
        description: "Urban/city texture"
    },
    
    // Keyboard texture
    "85a6d68622b36995ccb98a89bbb119edf167c914660e4450d313de049320005c": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Keyboard texture (fallback)"
    },
    
    // Bayer matrix / dithering
    "0681c014f6c88c356cf9c0394ffe015acc94ec1474924855f45d22c3e70b5785": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Bayer matrix texture (fallback)"
    },
    "793a105653fbdadabdc1325ca08675e1ce48ae5f12e37973829c87bea4be3232": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Dithering pattern (fallback)"
    },
    "550a8cce1bf403869fde66dddf6028dd171f1852f4a704a465e1b80d23955663": {
        shaderampPath: "images/NyanCatSprite.png",
        description: "Pattern texture (fallback)"
    },
    
    // Pebbles/Gravel
    "cd4c518bc6ef165c39d4405b347b51ba40f8d7a065ab0e8d2e4f422cbc1e8a43": {
        shaderampPath: "images/beton_3_pexels-photo-5622880.jpeg",
        description: "Pebbles/gravel texture"
    },
    "585f9546c092f53ded45332b343144396c0b2d70d9965f585ebc172080d8aa58": {
        shaderampPath: "images/beton_3_pexels-photo-5622880.jpeg",
        description: "Gravel texture"
    },
};

// Default fallback texture when no mapping is found
export const DEFAULT_TEXTURE = "images/NyanCatSprite.png";

/**
 * Extract the hash from a Shadertoy filepath
 * e.g., "/media/a/08b42b43ae9d3c0605da11d0eac86618ea888e62cdd9518ee8b9097488b31560.png"
 * returns "08b42b43ae9d3c0605da11d0eac86618ea888e62cdd9518ee8b9097488b31560"
 */
export function extractHashFromPath(filepath: string): string | null {
    const match = filepath.match(/\/media\/a\/([a-f0-9]+)\.[a-z]+$/i);
    return match ? match[1] : null;
}

/**
 * Map a Shadertoy texture filepath to a ShaderAmp local path
 */
export function mapShadertoyTexture(filepath: string): string {
    // Handle buffer references (not textures)
    if (filepath.includes("/media/previz/buffer")) {
        return filepath; // Keep as-is, handled separately
    }
    
    // Extract hash from filepath
    const hash = extractHashFromPath(filepath);
    if (!hash) {
        console.warn(`[ShaderAmp] Could not extract hash from filepath: ${filepath}`);
        return DEFAULT_TEXTURE;
    }
    
    // Look up in mapping
    const mapping = SHADERTOY_TEXTURE_MAP[hash];
    if (mapping) {
        console.log(`[ShaderAmp] Mapped texture ${hash.substring(0, 16)}... to ${mapping.shaderampPath}`);
        return mapping.shaderampPath;
    }
    
    // No mapping found - use default
    console.warn(`[ShaderAmp] No mapping for texture hash: ${hash.substring(0, 16)}..., using default`);
    console.warn(`[ShaderAmp] Full hash: ${hash}`);
    console.warn(`[ShaderAmp] Original filepath: ${filepath}`);
    return DEFAULT_TEXTURE;
}

/**
 * Check if a filepath is a Shadertoy media path
 */
export function isShadertoyMediaPath(filepath: string): boolean {
    return filepath.startsWith("/media/a/") || filepath.startsWith("/media/previz/");
}
