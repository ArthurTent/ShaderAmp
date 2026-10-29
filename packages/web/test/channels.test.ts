import { describe, expect, it } from 'vitest';
import { parseChannelRef } from '../src/shader/channels';
import { DEFAULT_CHANNEL_IMAGES, DEFAULT_CUBEMAP } from '../src/constants';

const base = { pass: 'main' as const, channelIndex: 0 as const };

describe('parseChannelRef', () => {
    it('maps bufferN refs to buffer kind', () => {
        expect(parseChannelRef({ ...base, ref: 'buffer0' })).toEqual({ kind: 'buffer', index: 0 });
        expect(parseChannelRef({ ...base, ref: 'buffer2' })).toEqual({ kind: 'buffer', index: 2 });
    });

    it('maps cubemapX / volumeX refs to render passes', () => {
        expect(parseChannelRef({ ...base, ref: 'cubemapA' })).toEqual({ kind: 'cubePass', letter: 'A' });
        expect(parseChannelRef({ ...base, ref: 'volumeA', type: 'volume' })).toEqual({ kind: 'volumePass', letter: 'A' });
        expect(parseChannelRef({ ...base, ref: 'greyNoise3D', type: 'volume' })).toEqual({ kind: 'volume', variant: 'grey' });
    });

    it('maps audio/keyboard/midi', () => {
        expect(parseChannelRef({ ...base, ref: 'audio' })).toEqual({ kind: 'audio' });
        expect(parseChannelRef({ ...base, ref: 'keyboard' })).toEqual({ kind: 'keyboard' });
        expect(parseChannelRef({ ...base, type: 'keyboard' })).toEqual({ kind: 'keyboard' });
        expect(parseChannelRef({ ...base, ref: 'midi' })).toEqual({ kind: 'midi' });
        expect(parseChannelRef({ ...base, type: 'midi' })).toEqual({ kind: 'midi' });
    });

    it('maps volume type with grey/rgba variants and custom_volumes to customMedia', () => {
        expect(parseChannelRef({ ...base, type: 'volume' })).toEqual({ kind: 'volume', variant: 'grey' });
        expect(parseChannelRef({ ...base, type: 'volume', ref: 'rgbaNoise3D' })).toEqual({ kind: 'volume', variant: 'rgba' });
        expect(parseChannelRef({ ...base, type: 'volume', ref: 'custom_volumes/x.bin' })).toEqual({ kind: 'customMedia', ref: 'custom_volumes/x.bin' });
    });

    it('maps custom_ refs to customMedia', () => {
        expect(parseChannelRef({ ...base, ref: 'custom_tex/foo.png' })).toEqual({ kind: 'customMedia', ref: 'custom_tex/foo.png' });
    });

    it('maps media/ refs to mediaVideo', () => {
        expect(parseChannelRef({ ...base, ref: 'media/clip.mp4' })).toEqual({ kind: 'mediaVideo', path: 'media/clip.mp4' });
    });

    it('maps video refs and types', () => {
        expect(parseChannelRef({ ...base, ref: 'video' })).toEqual({ kind: 'video' });
        expect(parseChannelRef({ ...base, type: 'video' })).toEqual({ kind: 'video' });
    });

    it('maps cubemap type or cubemaps listing', () => {
        expect(parseChannelRef({ ...base, type: 'cubemap' })).toEqual({ kind: 'cubemap', path: DEFAULT_CUBEMAP });
        expect(parseChannelRef({ ...base, type: 'cubemap', ref: 'images/cubemaps/x.jpg' })).toEqual({ kind: 'cubemap', path: 'images/cubemaps/x.jpg' });
        expect(parseChannelRef({ ...base, isCubemapListed: true })).toEqual({ kind: 'cubemap', path: DEFAULT_CUBEMAP });
    });

    it('maps any other ref to image', () => {
        expect(parseChannelRef({ ...base, ref: 'images/foo.png' })).toEqual({ kind: 'image', path: 'images/foo.png' });
    });

    it('defaults: main pass uses DEFAULT_CHANNEL_IMAGES, buffer pass uses none', () => {
        for (let i = 0; i < 4; i++) {
            expect(parseChannelRef({ pass: 'main', channelIndex: i as 0 | 1 | 2 | 3 })).toEqual({ kind: 'image', path: DEFAULT_CHANNEL_IMAGES[i] });
        }
        expect(parseChannelRef({ pass: 'buffer', channelIndex: 0 })).toEqual({ kind: 'none' });
    });
});
