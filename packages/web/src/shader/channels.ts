import { DEFAULT_CHANNEL_IMAGES, DEFAULT_CUBEMAP } from '../constants';

export type ChannelRef =
    | { kind: 'none' }
    | { kind: 'image'; path: string }
    | { kind: 'cubemap'; path: string }
    | { kind: 'buffer'; index: number }
    | { kind: 'cubePass'; letter: string }
    | { kind: 'volumePass'; letter: string }
    | { kind: 'audio' }
    | { kind: 'video' }
    | { kind: 'keyboard' }
    | { kind: 'mediaVideo'; path: string }
    | { kind: 'volume'; variant: 'grey' | 'rgba' }
    | { kind: 'midi' }
    | { kind: 'customMedia'; ref: string }
    | { kind: 'black'; reason: string };

export function parseChannelRef(args: {
    ref?: string;
    type?: string;
    isCubemapListed?: boolean;
    pass: 'main' | 'buffer';
    channelIndex: 0 | 1 | 2 | 3;
}): ChannelRef {
    const { ref, type, isCubemapListed, pass, channelIndex } = args;

    const bufferMatch = ref?.match(/^buffer(\d+)$/);
    if (bufferMatch) return { kind: 'buffer', index: Number(bufferMatch[1]) };
    const cubeMatch = ref?.match(/^cubemap([A-Z])$/);
    if (cubeMatch) return { kind: 'cubePass', letter: cubeMatch[1] };
    const volMatch = ref?.match(/^volume([A-Z])$/);
    if (volMatch) return { kind: 'volumePass', letter: volMatch[1] };

    if (ref === 'audio') return { kind: 'audio' };
    if (ref === 'keyboard' || type === 'keyboard') return { kind: 'keyboard' };
    if (ref === 'midi' || type === 'midi') return { kind: 'midi' };

    if (type === 'volume' && !ref?.startsWith('custom_')) {
        return { kind: 'volume', variant: ref === 'rgbaNoise3D' ? 'rgba' : 'grey' };
    }

    if (ref?.startsWith('custom_')) return { kind: 'customMedia', ref };
    if (ref?.startsWith('media/')) return { kind: 'mediaVideo', path: ref };
    if (ref === 'video' || type === 'video') return { kind: 'video' };
    if (type === 'cubemap' || isCubemapListed) return { kind: 'cubemap', path: ref ?? DEFAULT_CUBEMAP };
    if (ref) return { kind: 'image', path: ref };

    if (pass === 'main') return { kind: 'image', path: DEFAULT_CHANNEL_IMAGES[channelIndex] };
    return { kind: 'none' };
}
