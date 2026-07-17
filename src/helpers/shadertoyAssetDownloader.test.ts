import { expect } from '@jest/globals';
import browser from 'webextension-polyfill';
import {
    downloadShaderAssets,
    downloadAndStoreAsset,
    downloadAndStoreTexture,
    downloadAndStoreVideo,
    downloadAndStoreCubemap,
} from './shadertoyAssetDownloader';
import { convertShadertoyShader, ShadertoyShader } from './shadertoyConverter';

jest.mock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
        storage: { local: { get: jest.fn(), set: jest.fn() } },
        runtime: { sendMessage: jest.fn() },
    },
}));
jest.mock('./logger', () => ({
    logger: { content: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
}));

const hash = 'abcdef0123456789';
const mediaPath = (extension: string) => `/media/a/${hash}.${extension}`;
let fetchMock: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response('asset content', { headers: { 'Content-Type': 'image/png' } })
    );
    jest.mocked(browser.storage.local.get).mockResolvedValue({});
    jest.mocked(browser.storage.local.set).mockResolvedValue(undefined);
    jest.mocked(browser.runtime.sendMessage).mockResolvedValue({ success: true, result: { id: 'asset1' } });
});

afterEach(() => jest.restoreAllMocks());

describe('Shadertoy audio exclusion', () => {
    it.each(['music', 'musicstream', 'microphone', 'audio', 'sound'])('skips %s inputs before progress, storage, or network access', async type => {
        const progress = jest.fn();
        const mapping = await downloadShaderAssets([{ type, filepath: mediaPath('mp3') }], progress);
        expect(mapping.size).toBe(0);
        expect(progress).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(browser.storage.local.get).not.toHaveBeenCalled();
        expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it.each(['mp3', 'ogg', 'oga', 'opus', 'wav', 'flac', 'aac', 'm4a', 'MP3', 'OGG?download=1', 'mp3#track'])('rejects .%s even when mislabeled as visual media', async extension => {
        const progress = jest.fn();
        const mapping = await downloadShaderAssets(['texture', 'video', 'cubemap'].map(type => ({
            type, filepath: mediaPath(extension),
        })), progress, false, true);
        expect(mapping.size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(browser.storage.local.get).not.toHaveBeenCalled();
        expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
        expect(progress).not.toHaveBeenCalled();
    });

    it.each([
        ['texture', downloadAndStoreTexture],
        ['video', downloadAndStoreVideo],
        ['cubemap', downloadAndStoreCubemap],
    ] as const)('guards the direct %s downloader before cache lookup', async (_type, download) => {
        await expect(download(mediaPath('mp3'), hash)).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(browser.storage.local.get).not.toHaveBeenCalled();
    });

    it('guards the generic asset entry point', async () => {
        await expect(downloadAndStoreAsset(mediaPath('ogg'), 'texture')).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('downloads only supported visuals in a mixed batch and counts only eligible assets', async () => {
        const progress = jest.fn();
        const mapping = await downloadShaderAssets([
            { type: 'music', filepath: mediaPath('mp3') },
            { type: 'texture', filepath: mediaPath('png') },
            { type: 'video', filepath: mediaPath('ogg') },
            { type: 'microphone' },
        ], progress, false);
        expect(Array.from(mapping.entries())).toEqual([[mediaPath('png'), 'custom_images/asset1']]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(progress).toHaveBeenCalledTimes(1);
        expect(progress).toHaveBeenCalledWith(1, 1, expect.any(String));
    });

    it.each([
        ['texture', 'png', 'audio/mpeg'],
        ['video', 'webm', 'audio/ogg'],
        ['cubemap', 'png', 'application/ogg'],
    ] as const)('rejects audio response bodies on %s paths', async (type, extension, mimeType) => {
        const response = new Response('audio bytes', { headers: { 'Content-Type': mimeType } });
        const readBody = jest.spyOn(response, 'blob');
        fetchMock.mockResolvedValue(response);
        await expect(downloadAndStoreAsset(mediaPath(extension), type, false, false)).rejects.toThrow();
        expect(readBody).not.toHaveBeenCalled();
        expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });
});

describe('Shadertoy download boundaries', () => {
    it.each([
        `https://other.example/media/a/${hash}.png`,
        `/media/a/../../account/media/a/${hash}.png`,
        `/media/a/%2e%2e/media/a/${hash}.png`,
        `/media/a/${hash}.svg`,
        `/media/a/${hash}.html`,
        `/media/a/${hash}.png?redirect=audio`,
    ])('rejects unsupported or noncanonical paths: %s', async filepath => {
        await expect(downloadAndStoreAsset(filepath, 'texture')).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects mismatched cache hashes at direct entry points', async () => {
        await expect(downloadAndStoreTexture(mediaPath('png'), '__proto__')).rejects.toThrow();
        expect(browser.storage.local.get).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([false, true])('preserves default same-origin credentials and refuses redirects for both cache modes (%s)', async useOnlyIfCached => {
        if (useOnlyIfCached) fetchMock.mockRejectedValueOnce(new TypeError('Cache miss'));
        await downloadAndStoreTexture(mediaPath('png'), hash, true, useOnlyIfCached);
        for (const [url, options] of fetchMock.mock.calls) {
            expect(url).toBe(`https://www.shadertoy.com${mediaPath('png')}`);
            expect(options).toMatchObject({ redirect: 'error' });
            expect(options).not.toHaveProperty('credentials');
        }
        expect(fetchMock).toHaveBeenCalledTimes(useOnlyIfCached ? 2 : 1);
    });

    it.each(['png', 'jpg', 'jpeg', 'webp', 'gif', 'PNG'])('still imports .%s textures', async extension => {
        await expect(downloadAndStoreAsset(mediaPath(extension), 'texture', false, false)).resolves.toBe('custom_images/asset1');
        expect(browser.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'saveCustomImage' }));
    });

    it.each(['mp4', 'webm'])('still imports .%s videos', async extension => {
        fetchMock.mockImplementation(async () => new Response('video content', { headers: { 'Content-Type': `video/${extension}` } }));
        await expect(downloadAndStoreAsset(mediaPath(extension), 'video', false, false)).resolves.toBe('custom_videos/asset1');
        expect(browser.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'saveCustomVideo' }));
    });

    it('still imports all six cubemap faces', async () => {
        await expect(downloadAndStoreAsset(mediaPath('png'), 'cubemap', false, false)).resolves.toBe('custom_cubemaps/asset1');
        expect(fetchMock).toHaveBeenCalledTimes(6);
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(Array.from({ length: 6 }, (_, face) =>
            `https://www.shadertoy.com/media/a/${hash}${face ? `_${face}` : ''}.png`
        ));
    });
});

describe('conversion with asset downloading enabled', () => {
    it('maps music to live audio in Image and Buffer passes without downloading it', async () => {
        const code = 'void mainImage(out vec4 c, in vec2 p) { c = texture(iChannel1, p); }';
        const shader = {
            info: { id: 'test01', name: 'Audio import', username: 'tester', description: '', tags: [] },
            renderpass: [
                { name: 'Image', type: 'image', code, inputs: [{ type: 'music', channel: 1, filepath: mediaPath('mp3') }], outputs: [] },
                { name: 'Buffer A', type: 'buffer', code, inputs: [{ type: 'musicstream', channel: 1, filepath: mediaPath('ogg') }], outputs: [{ id: 'bufferA', channel: 0 }] },
            ],
        } as unknown as ShadertoyShader;
        const result = await convertShadertoyShader(shader, false, true);
        expect(result.success).toBe(true);
        expect(result.mainShader.code).toContain('texture(iAudioData,');
        expect(result.bufferShaders).toHaveLength(1);
        expect(result.bufferShaders[0].code).toContain('texture(iAudioData,');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
    });
});
