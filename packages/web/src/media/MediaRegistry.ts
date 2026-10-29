import type { Texture } from 'three';

/**
 * Registry for media shipped inside imported scene packages. Maps a
 * `custom_images/`, `custom_videos/`, `custom_cubemaps/` or `custom_volumes/`
 * channel ref to loadable content: a blob object URL for images/videos, six
 * face URLs for cubemaps, or a ready-made texture for volumes.
 */
export type MediaEntry =
    | { kind: 'image'; url: string }
    | { kind: 'video'; url: string }
    | { kind: 'cubemap'; faceUrls: string[] }
    | { kind: 'volume'; texture: Texture };

export class MediaRegistry {
    private map = new Map<string, MediaEntry>();
    private objectUrls = new Set<string>();
    private textures = new Set<Texture>();

    set(ref: string, entry: MediaEntry): void {
        this.delete(ref);
        this.map.set(ref, entry);
        if (entry.kind === 'image' || entry.kind === 'video') this.objectUrls.add(entry.url);
        if (entry.kind === 'cubemap') entry.faceUrls.forEach((u) => this.objectUrls.add(u));
        if (entry.kind === 'volume') this.textures.add(entry.texture);
    }

    get(ref: string): MediaEntry | undefined {
        return this.map.get(ref);
    }

    has(ref: string): boolean {
        return this.map.has(ref);
    }

    delete(ref: string): void {
        const entry = this.map.get(ref);
        if (!entry) return;
        this.map.delete(ref);
        if (entry.kind === 'image' || entry.kind === 'video') this.revoke(entry.url);
        if (entry.kind === 'cubemap') entry.faceUrls.forEach((u) => this.revoke(u));
        if (entry.kind === 'volume') {
            this.textures.delete(entry.texture);
            entry.texture.dispose();
        }
    }

    /** Merge another registry into this one (object URL/texture ownership moves). */
    merge(other: MediaRegistry): void {
        for (const [ref, entry] of other.map) this.set(ref, entry);
        other.map.clear();
        other.objectUrls.clear();
        other.textures.clear();
    }

    private revoke(url: string): void {
        if (!this.objectUrls.delete(url)) return;
        try {
            URL.revokeObjectURL(url);
        } catch {
            // ignore
        }
    }

    dispose(): void {
        for (const url of this.objectUrls) {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // ignore
            }
        }
        for (const tex of this.textures) {
            try {
                tex.dispose();
            } catch {
                // ignore
            }
        }
        this.objectUrls.clear();
        this.textures.clear();
        this.map.clear();
    }
}
