import { describe, expect, it } from 'vitest';
import { normalizeBase, resolveAssetUrl } from '../src/assets/assetUrl';

describe('normalizeBase', () => {
    it('ensures a trailing slash', () => {
        expect(normalizeBase('https://x.com/a')).toBe('https://x.com/a/');
        expect(normalizeBase('https://x.com/a/')).toBe('https://x.com/a/');
    });
});

describe('resolveAssetUrl', () => {
    it('returns absolute/special paths unchanged', () => {
        expect(resolveAssetUrl('https://cdn.com/x.png', 'https://b/')).toBe('https://cdn.com/x.png');
        expect(resolveAssetUrl('//cdn.com/x.png', 'https://b/')).toBe('//cdn.com/x.png');
        expect(resolveAssetUrl('/x.png', 'https://b/')).toBe('/x.png');
        expect(resolveAssetUrl('data:image/png;base64,AA', 'https://b/')).toBe('data:image/png;base64,AA');
        expect(resolveAssetUrl('blob:https://x.com/uuid', 'https://b/')).toBe('blob:https://x.com/uuid');
    });

    it('resolves relative paths against the base', () => {
        expect(resolveAssetUrl('images/a.png', 'https://cdn.com/assets')).toBe('https://cdn.com/assets/images/a.png');
        expect(resolveAssetUrl('images/a.png', 'https://cdn.com/assets/')).toBe('https://cdn.com/assets/images/a.png');
    });

    it('resolves a relative base against location.href', () => {
        const url = resolveAssetUrl('images/a.png', './assets/');
        expect(url).toMatch(/^https?:\/\//);
        expect(url.endsWith('/assets/images/a.png')).toBe(true);
    });

    it('keeps file names with spaces and parentheses working', () => {
        const url = resolveAssetUrl('media/pexels videos_3931(1080p).mp4', 'https://cdn.com/assets/');
        expect(decodeURIComponent(new URL(url).pathname)).toBe('/assets/media/pexels videos_3931(1080p).mp4');
    });
});
