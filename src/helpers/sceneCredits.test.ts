import { collectSceneCredits, formatCredits } from './sceneCredits';
import type { ShaderMetaData } from './types';

const metaFor = (overrides: Partial<ShaderMetaData>): ShaderMetaData => ({
    author: '',
    modifiedBy: '',
    shaderName: '',
    url: '',
    license: '',
    shaderSpeed: 1,
    ...overrides,
} as ShaderMetaData);

const resolver = (meta: Record<string, ShaderMetaData | null>, labels: Record<string, string> = {}) =>
    (ref: string) => ({ meta: meta[ref] ?? null, label: labels[ref] ?? ref });

describe('collectSceneCredits', () => {
    it('collects scene nodes in order and dedupes by shaderRef', () => {
        const meta = {
            'A.frag': metaFor({ shaderName: 'Shader A', author: 'alice' }),
            'B.frag': metaFor({ shaderName: 'Shader B', author: 'bob' }),
        };
        const nodes = [
            { type: 'start', data: {} },
            { type: 'scene', data: { shaderRef: 'A.frag' } },
            { type: 'scene', data: { shaderRef: 'B.frag' } },
            { type: 'scene', data: { shaderRef: 'A.frag' } }, // duplicate
            { type: 'scene', data: {} },                     // no shaderRef
            { type: 'condition', data: {} },
        ];
        const credits = collectSceneCredits(nodes, resolver(meta));
        expect(credits.map(c => c.shaderRef)).toEqual(['A.frag', 'B.frag']);
        expect(credits[0].name).toBe('Shader A');
    });

    it('credits shaders referenced by overlay nodes', () => {
        const meta = {
            'B.frag': metaFor({ shaderName: 'Overlay Shader', author: 'olaf' }),
        };
        const nodes = [
            { type: 'overlay', data: { shaderRef: 'B.frag' } },
            { type: 'overlay', data: { shaderRef: 'B.frag' } }, // duplicate
            { type: 'overlay', data: {} },                      // hide node without shaderRef
        ];
        const credits = collectSceneCredits(nodes, resolver(meta));
        expect(credits.map(c => c.shaderRef)).toEqual(['B.frag']);
        expect(credits[0].name).toBe('Overlay Shader');
    });

    it('falls back to the provided label when meta is missing', () => {
        const credits = collectSceneCredits(
            [{ type: 'scene', data: { shaderRef: 'imported-123' } }],
            resolver({}, { 'imported-123': 'My Import' }),
        );
        expect(credits[0].name).toBe('My Import');
    });
});

describe('formatCredits', () => {
    it('formats one block per shader with author, url and license', () => {
        const credits = collectSceneCredits(
            [
                { type: 'scene', data: { shaderRef: 'a' } },
                { type: 'scene', data: { shaderRef: 'b' } },
            ],
            resolver({
                a: metaFor({ shaderName: 'First', author: 'alice', url: 'https://www.shadertoy.com/view/a', license: 'CC0' }),
                b: metaFor({ shaderName: 'Second', author: 'bob', modifiedBy: 'carol' }),
            }),
        );
        expect(formatCredits(credits)).toBe(
            '"First" by alice\nhttps://www.shadertoy.com/view/a\nLicense: CC0' +
            '\n\n' +
            '"Second" by bob (modified by carol)'
        );
    });

    it('omits author/url/license lines when absent', () => {
        const credits = collectSceneCredits(
            [{ type: 'scene', data: { shaderRef: 'x' } }],
            resolver({ x: metaFor({ shaderName: 'Only Name' }) }),
        );
        expect(formatCredits(credits)).toBe('"Only Name"');
    });
});
