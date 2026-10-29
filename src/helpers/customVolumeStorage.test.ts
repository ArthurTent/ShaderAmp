import fs from 'fs';
import path from 'path';
import {
    parseVolumeHeader,
    uploadCustomVolume,
    volumeIdToChannelRef,
    channelRefToVolumeId,
    isCustomVolumeRef,
    CUSTOM_VOLUME_PREFIX,
    SUPPORTED_VOLUME_EXTENSIONS,
} from './customVolumeStorage';

jest.mock('@src/storage/shaderDB', () => ({
    addVolumeDB: jest.fn().mockResolvedValue(undefined),
    getAllVolumesDB: jest.fn(),
    getVolumeBlobDB: jest.fn(),
    getVolumeDB: jest.fn(),
    deleteVolumeDB: jest.fn(),
}));

const realSamplePath = path.resolve(
    __dirname, 'fixtures',
    '27012b4eadd0c3ce12498b867058e4f717ce79e10a99568cca461682d84a4b04.bin'
);

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
    return Uint8Array.from(buf).buffer;
}

function makeMockFile(buffer: ArrayBuffer, name: string): File {
    return {
        name,
        size: buffer.byteLength,
        arrayBuffer: () => Promise.resolve(buffer),
    } as unknown as File;
}

describe('parseVolumeHeader', () => {
    it('parses the real Shadertoy volume sample', () => {
        const buffer = bufferToArrayBuffer(fs.readFileSync(realSamplePath));
        const header = parseVolumeHeader(buffer);
        expect(header).not.toBeNull();
        expect(header!.width).toBe(32);
        expect(header!.height).toBe(32);
        expect(header!.depth).toBe(32);
        expect(header!.channels).toBe(1);
        expect(header!.headerSize).toBe(20);
    });

    it('returns null for headerless raw data', () => {
        const buffer = new ArrayBuffer(32 * 32 * 32);
        expect(parseVolumeHeader(buffer)).toBeNull();
    });

    it('throws when declared dimensions do not match file size', () => {
        // BIN header claiming 32x32x32x1 but only 10 bytes of data
        const buffer = new ArrayBuffer(30);
        const view = new DataView(buffer);
        view.setUint8(0, 66); // B
        view.setUint8(1, 73); // I
        view.setUint8(2, 78); // N
        view.setUint8(3, 0);
        view.setUint32(4, 32, true);
        view.setUint32(8, 32, true);
        view.setUint32(12, 32, true);
        view.setUint32(16, 1, true);
        expect(() => parseVolumeHeader(buffer)).toThrow(/do not match file size/);
    });
});

describe('uploadCustomVolume', () => {
    it('extracts header metadata and stores only voxel bytes for .bin files', async () => {
        const buffer = bufferToArrayBuffer(fs.readFileSync(realSamplePath));
        const file = makeMockFile(buffer, 'real_volume.bin');
        const result = await uploadCustomVolume(file);
        expect(result.name).toBe('real_volume.bin');
        expect(result.width).toBe(32);
        expect(result.height).toBe(32);
        expect(result.depth).toBe(32);
        expect(result.channels).toBe(1);
        expect(result.size).toBe(32_788);
    });

    it('uploads headerless .vol files when dimensions are supplied', async () => {
        const buffer = new ArrayBuffer(4 * 4 * 4 * 4);
        new Uint8Array(buffer).fill(128);
        const file = makeMockFile(buffer, 'noise.vol');
        const result = await uploadCustomVolume(file, { width: 4, height: 4, depth: 4, channels: 4 });
        expect(result.width).toBe(4);
        expect(result.height).toBe(4);
        expect(result.depth).toBe(4);
        expect(result.channels).toBe(4);
        expect(result.size).toBe(4 * 4 * 4 * 4);
    });

    it('throws when a headerless file size does not match provided dimensions', async () => {
        const buffer = new ArrayBuffer(10);
        const file = makeMockFile(buffer, 'bad.vol');
        await expect(uploadCustomVolume(file, { width: 4, height: 4, depth: 4, channels: 4 }))
            .rejects.toThrow(/does not match/);
    });

    it('throws when a headerless file is uploaded without dimensions', async () => {
        const buffer = new ArrayBuffer(8);
        const file = makeMockFile(buffer, 'bad.vol');
        await expect(uploadCustomVolume(file)).rejects.toThrow(/require width/);
    });
});

describe('channel reference helpers', () => {
    it('round-trips volume IDs through custom_volumes/ references', () => {
        const id = 'vol_abc123';
        const ref = volumeIdToChannelRef(id);
        expect(ref).toBe(`${CUSTOM_VOLUME_PREFIX}${id}`);
        expect(channelRefToVolumeId(ref)).toBe(id);
        expect(channelRefToVolumeId('not_a_volume')).toBeNull();
    });

    it('recognises custom volume references', () => {
        expect(isCustomVolumeRef(`${CUSTOM_VOLUME_PREFIX}foo`)).toBe(true);
        expect(isCustomVolumeRef('greyNoise3D')).toBe(false);
        expect(isCustomVolumeRef(undefined)).toBe(false);
    });
});

describe('supported volume extensions', () => {
    it('includes .bin and .vol', () => {
        expect(SUPPORTED_VOLUME_EXTENSIONS).toContain('.bin');
        expect(SUPPORTED_VOLUME_EXTENSIONS).toContain('.vol');
    });
});
