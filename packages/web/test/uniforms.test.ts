import { describe, expect, it } from 'vitest';
import { Vector2, Vector3, Vector4 } from 'three';
import {
    createPassUniforms,
    createSharedUniforms,
    createCustomUniformMap,
    toUniformValue,
    getDateVector,
} from '../src/shader/uniforms';
import type { ShaderUniform } from '../src/types';

const defs: ShaderUniform[] = [
    { name: 'iCount', label: 'Count', type: 'int', default: 3.7 },
    { name: 'iFlag', label: 'Flag', type: 'bool', default: true },
    { name: 'iPos', label: 'Pos', type: 'vec3', default: [1, 2, 3] },
    { name: 'iScale', label: 'Scale', type: 'float', default: 0.5 },
];

describe('toUniformValue', () => {
    it('converts int/bool/float', () => {
        expect(toUniformValue(defs[0], 4.9)).toBe(4);
        expect(toUniformValue(defs[1], false)).toBe(0.0);
        expect(toUniformValue(defs[1], true)).toBe(1.0);
        expect(toUniformValue(defs[3], 2)).toBe(2);
    });
    it('builds vectors and broadcasts scalars', () => {
        expect(toUniformValue(defs[2], [1, 2, 3])).toEqual(new Vector3(1, 2, 3));
        expect(toUniformValue(defs[2], 5)).toEqual(new Vector3(5, 5, 5));
        expect(toUniformValue({ ...defs[2], type: 'vec2' }, 1)).toEqual(new Vector2(1, 1));
        expect(toUniformValue({ ...defs[2], type: 'vec4' }, [1, 2, 3, 4])).toEqual(new Vector4(1, 2, 3, 4));
    });
});

describe('createPassUniforms', () => {
    it('shares IUniform object references with shared uniforms', () => {
        const shared = createSharedUniforms(44100);
        const pass = createPassUniforms(shared);
        expect(pass.iTime).toBe(shared.iTime);
        expect(pass.iAudioData).toBe(shared.iAudioData);
        expect(pass.iResolution).toBe(shared.iResolution);
        expect(pass.iChannel0).not.toBe(shared.iChannel0);
        expect(pass.iChannelResolution.value.length).toBe(4);
        expect(pass.iChannelResolution.value[0]).toEqual(new Vector3(0, 0, 1));
    });

    it('adds iTransitionOpacity only for the main pass', () => {
        const shared = createSharedUniforms(44100);
        expect(createPassUniforms(shared, undefined, { main: true }).iTransitionOpacity.value).toBe(1);
        expect(createPassUniforms(shared).iTransitionOpacity).toBeUndefined();
    });

    it('shares custom uniform IUniform objects between main and buffer passes', () => {
        const shared = createSharedUniforms(44100);
        const customMap = createCustomUniformMap(defs);
        const main = createPassUniforms(shared, customMap, { main: true });
        const buf = createPassUniforms(shared, customMap);
        expect(main.iCount).toBe(buf.iCount);
        expect(main.iCount.value).toBe(3);
        expect(main.iFlag.value).toBe(1.0);
        expect(main.iPos.value).toEqual(new Vector3(1, 2, 3));
    });
});

describe('getDateVector', () => {
    it('returns year/month/day/seconds', () => {
        const v = getDateVector();
        const d = new Date();
        expect(v.x).toBe(d.getFullYear());
        expect(v.y).toBe(d.getMonth());
        expect(v.z).toBe(d.getDate());
        expect(v.w).toBeGreaterThanOrEqual(0);
    });
});
