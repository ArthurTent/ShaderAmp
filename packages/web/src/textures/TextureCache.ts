import {
    ClampToEdgeWrapping,
    CubeTextureLoader,
    DataTexture,
    LinearFilter,
    LinearMipmapLinearFilter,
    NearestFilter,
    RepeatWrapping,
    TextureLoader,
    VideoTexture,
    Wrapping,
} from 'three';
import type { CubeTexture, Texture } from 'three';
import { resolveAssetUrl } from '../assets/assetUrl';
import { getGreyNoise3DTexture, getRGBANoise3DTexture } from './volumeNoise';
import type { ShaderMetaData, TextureSampler } from '../types';

export type TextureMeta = ShaderMetaData & { textureWrap?: 'repeat' | 'clamp' | string; textureFlipY?: boolean };
type Meta = TextureMeta;

export function applySamplerToTexture(
    tex: Texture,
    sampler?: TextureSampler,
    fallbackWrap?: Wrapping,
    fallbackFlipY?: boolean,
): void {
    const wrap =
        sampler?.wrap === 'repeat'
            ? RepeatWrapping
            : sampler?.wrap === 'clamp'
              ? ClampToEdgeWrapping
              : fallbackWrap ?? ClampToEdgeWrapping;
    tex.wrapS = wrap;
    tex.wrapT = wrap;
    if (sampler?.filter === 'nearest') {
        tex.minFilter = NearestFilter;
        tex.magFilter = NearestFilter;
        tex.generateMipmaps = false;
    } else if (sampler?.filter === 'mipmap') {
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = true;
    } else {
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = false;
    }
    tex.flipY = sampler?.vflip !== undefined ? sampler.vflip : fallbackFlipY ?? true;
}

let sharedBlack: DataTexture | null = null;
export function getBlackTexture(): DataTexture {
    if (!sharedBlack) {
        sharedBlack = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
        sharedBlack.needsUpdate = true;
    }
    return sharedBlack;
}

interface TrackedVideo {
    texture: VideoTexture;
    element: HTMLVideoElement;
}

export class TextureCache {
    private tracked: (Texture | { dispose(): void })[] = [];
    private videos: TrackedVideo[] = [];

    constructor(private assetBaseUrl: string) {}

    private track<T>(x: T): T {
        this.tracked.push(x as any);
        return x;
    }

    private fallbackWrap(meta?: Meta): Wrapping {
        return meta?.textureWrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
    }

    private fallbackFlipY(meta?: Meta): boolean {
        return meta?.textureFlipY !== false;
    }

    loadImage(path: string, sampler?: TextureSampler, meta?: Meta, onLoad?: (tex: Texture) => void): Texture {
        const url = resolveAssetUrl(path, this.assetBaseUrl);
        const tex = this.track(
            new TextureLoader()
                .setCrossOrigin('anonymous')
                .load(
                    url,
                    (t) => onLoad?.(t),
                    undefined,
                    () => console.warn('[shaderamp] texture failed', url),
                ),
        );
        applySamplerToTexture(tex, sampler, this.fallbackWrap(meta), this.fallbackFlipY(meta));
        return tex;
    }

    loadCubemap(path: string, onLoad?: (tex: CubeTexture) => void): CubeTexture {
        const resolved = resolveAssetUrl(path, this.assetBaseUrl);
        const isDirectional = /\/(px|nx|py|ny|pz|nz)\.[a-z]+$/i.test(resolved);
        let faceUrls: string[];
        if (isDirectional) {
            const m = resolved.match(/^(.*)\/(px|nx|py|ny|pz|nz)(\.[a-z]+)$/i);
            faceUrls = m
                ? ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((f) => `${m[1]}/${f}${m[3]}`)
                : Array(6).fill(resolved);
        } else {
            const extMatch = resolved.match(/(\.[a-z]+)$/i);
            const ext = extMatch ? extMatch[1] : '.jpg';
            const base = extMatch ? resolved.slice(0, -ext.length) : resolved;
            faceUrls = [base + ext, ...[1, 2, 3, 4, 5].map((i) => `${base}_${i}${ext}`)];
        }
        return this.track(
            new CubeTextureLoader().setCrossOrigin('anonymous').load(
                faceUrls,
                (t) => onLoad?.(t),
                undefined,
                () => console.warn('[shaderamp] texture failed', resolved),
            ),
        );
    }

    /** Load a cubemap from six explicit face URLs (e.g. packaged blob URLs). */
    loadCubemapFaces(faceUrls: string[], onLoad?: (tex: CubeTexture) => void): CubeTexture {
        return this.track(
            new CubeTextureLoader().setCrossOrigin('anonymous').load(
                faceUrls,
                (t) => onLoad?.(t),
                undefined,
                () => console.warn('[shaderamp] cubemap faces failed'),
            ),
        );
    }

    loadVideo(url: string, sampler?: TextureSampler, meta?: Meta): VideoTexture {
        const el = document.createElement('video');
        el.src = url;
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        el.crossOrigin = 'anonymous';
        el.play().catch(() => {});
        const tex = this.track(new VideoTexture(el)) as VideoTexture;
        tex.generateMipmaps = false;
        applySamplerToTexture(tex, sampler, this.fallbackWrap(meta), this.fallbackFlipY(meta));
        this.videos.push({ texture: tex, element: el });
        return tex;
    }

    volume(variant: 'grey' | 'rgba'): Texture {
        // Shared singletons — never disposed by this cache.
        return variant === 'rgba' ? getRGBANoise3DTexture() : getGreyNoise3DTexture();
    }

    black(): Texture {
        return getBlackTexture();
    }

    dispose(): void {
        for (const { element } of this.videos) {
            try {
                element.pause();
                element.removeAttribute('src');
                element.load();
            } catch {
                // ignore
            }
        }
        this.videos = [];
        for (const t of this.tracked) {
            try {
                (t as Texture).dispose();
            } catch {
                // ignore
            }
        }
        this.tracked = [];
    }
}

// re-export for tree-shake friendliness of the wrap constants used by ShaderProgram
export { ClampToEdgeWrapping, RepeatWrapping };
