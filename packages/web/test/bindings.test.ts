import { describe, expect, it } from 'vitest';
import { resolveChannelRefs } from '../src/shader/ShaderProgram';
import { DEFAULT_CHANNEL_IMAGES } from '../src/constants';

describe('resolveChannelRefs', () => {
    it('resolves each channel with its own type/sampler and default images on main', () => {
        const meta = {
            iChannel0: 'audio',
            iChannel1: 'buffer1',
            iChannel2: 'images/foo.png',
            iChannel2Sampler: { filter: 'nearest' as const, wrap: 'repeat' as const, vflip: false },
            iChannel3Type: 'video',
        };
        const refs = resolveChannelRefs(meta, 'main');
        expect(refs[0].ref).toEqual({ kind: 'audio' });
        expect(refs[1].ref).toEqual({ kind: 'buffer', index: 1 });
        expect(refs[2].ref).toEqual({ kind: 'image', path: 'images/foo.png' });
        expect(refs[2].sampler?.filter).toBe('nearest');
        expect(refs[3].ref).toEqual({ kind: 'video' });
    });

    it('buffer passes default to none', () => {
        const refs = resolveChannelRefs({}, 'buffer');
        expect(refs.every((r) => r.ref.kind === 'none')).toBe(true);
    });

    it('main pass defaults to DEFAULT_CHANNEL_IMAGES', () => {
        const refs = resolveChannelRefs({}, 'main');
        refs.forEach((r, i) => {
            expect(r.ref).toEqual({ kind: 'image', path: DEFAULT_CHANNEL_IMAGES[i] });
        });
    });

    it('honours the cubemaps listing', () => {
        const refs = resolveChannelRefs({ cubemaps: ['iChannel2'] }, 'main');
        expect(refs[2].ref.kind).toBe('cubemap');
        expect(refs[0].ref.kind).toBe('image');
    });
});
