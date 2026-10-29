import { afterEach, describe, expect, it, vi } from 'vitest';
import { Catalog, customShaderToObject, normalizeShaderInput } from '../src/assets/catalog';
import type { ShaderObject } from '../src/types';

const shaders: ShaderObject[] = [
    { shaderName: 'Foo.frag', metaData: { shaderName: 'Foo Bar', author: 'a', modifiedBy: 'm', url: '', license: '', shaderSpeed: 1 } as any },
    { shaderName: 'Baz.frag', metaData: { shaderName: 'Baz', author: 'a', modifiedBy: 'm', url: '', license: '', shaderSpeed: 1 } as any },
];

const listResponse = () =>
    new Response(JSON.stringify({ lastModified: '', shaders }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

function mockFetch() {
    const fn = vi.fn((url: string | URL | Request) => {
        const u = String(url);
        if (u.endsWith('list.json')) return Promise.resolve(listResponse());
        if (u.endsWith('.frag')) return Promise.resolve(new Response('void main() {}', { status: 200 }));
        return Promise.resolve(new Response('nope', { status: 404 }));
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

describe('Catalog', () => {
    it('loads and caches list.json', async () => {
        const fn = mockFetch();
        const c = new Catalog('https://cdn.test/assets/');
        const a = await c.load();
        const b = await c.load();
        expect(a).toBe(b);
        expect(a.length).toBe(2);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('find matches file name, name without .frag, and display name (case-insensitive)', async () => {
        mockFetch();
        const c = new Catalog('https://cdn.test/assets/');
        expect((await c.find('Foo.frag'))?.shaderName).toBe('Foo.frag');
        expect((await c.find('Foo'))?.shaderName).toBe('Foo.frag');
        expect((await c.find('foo bar'))?.shaderName).toBe('Foo.frag');
        expect(await c.find('missing')).toBeUndefined();
    });

    it('indexOf returns the catalog position', async () => {
        mockFetch();
        const c = new Catalog('https://cdn.test/assets/');
        expect(await c.indexOf('Baz.frag')).toBe(1);
        expect(await c.indexOf('nope')).toBe(-1);
    });

    it('fetchCode caches responses', async () => {
        const fn = mockFetch();
        const c = new Catalog('https://cdn.test/assets/');
        const code = await c.fetchCode('Foo.frag');
        expect(code).toContain('void main');
        await c.fetchCode('Foo.frag');
        expect(fn.mock.calls.filter((c0) => String(c0[0]).endsWith('Foo.frag')).length).toBe(1);
    });
});

describe('normalizeShaderInput', () => {
    it('resolves strings via the catalog and throws when missing', async () => {
        mockFetch();
        const c = new Catalog('https://cdn.test/assets/');
        expect((await normalizeShaderInput('Foo.frag', c)).shaderName).toBe('Foo.frag');
        await expect(normalizeShaderInput('Missing.frag', c)).rejects.toThrow('Shader not found');
    });

    it('passes ShaderObject through', async () => {
        const obj = shaders[0];
        expect(await normalizeShaderInput(obj, new Catalog('x'))).toBe(obj);
    });

    it('converts a CustomShader with buffers and channels', async () => {
        const obj = await normalizeShaderInput(
            {
                code: 'void main() {}',
                name: 'mine.frag',
                channels: { iChannel0: 'audio' },
                shaderSpeed: 2,
                buffers: [{ code: 'void main() {}', output: 1, channels: { iChannel0: 'buffer1' } }],
            },
            new Catalog('x'),
        );
        expect(obj.shaderName).toBe('mine.frag');
        expect(obj.inlineCode).toBe('void main() {}');
        expect(obj.metaData.shaderSpeed).toBe(2);
        expect(obj.metaData.iChannel0).toBe('audio');
        expect(obj.metaData.buffers).toEqual([{ shaderName: 'custom_buffer1.frag', output: 1, iChannel0: 'buffer1' }]);
        expect(obj.inlineBuffers?.['custom_buffer1.frag']).toBe('void main() {}');
    });

    it('customShaderToObject uses defaults', () => {
        const obj = customShaderToObject({ code: 'x' });
        expect(obj.shaderName).toBe('custom.frag');
        expect(obj.metaData.shaderSpeed).toBe(1);
        expect(obj.metaData.author).toBe('');
    });
});
