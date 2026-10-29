import type { CustomShader, ShaderInput, ShaderObject } from '../types';
import { normalizeBase, resolveAssetUrl } from './assetUrl';

export class Catalog {
    private loadPromise: Promise<ShaderObject[]> | null = null;
    private codeCache = new Map<string, Promise<string>>();

    constructor(private baseUrl: string) {}

    load(): Promise<ShaderObject[]> {
        if (!this.loadPromise) {
            this.loadPromise = fetch(resolveAssetUrl('shaders/list.json', this.baseUrl), { cache: 'force-cache' })
                .then((res) => {
                    if (!res.ok) throw new Error(`Failed to load shader catalog: ${res.status}`);
                    return res.json();
                })
                .then((data) => (data.shaders ?? []) as ShaderObject[]);
        }
        return this.loadPromise;
    }

    async find(nameOrTitle: string): Promise<ShaderObject | undefined> {
        const shaders = await this.load();
        return (
            shaders.find((s) => s.shaderName === nameOrTitle) ??
            shaders.find((s) => s.shaderName === `${nameOrTitle}.frag`) ??
            shaders.find((s) => s.metaData?.shaderName?.toLowerCase() === nameOrTitle.toLowerCase())
        );
    }

    async indexOf(name: string): Promise<number> {
        const shaders = await this.load();
        return shaders.findIndex((s) => s.shaderName === name);
    }

    fetchCode(fileName: string): Promise<string> {
        let p = this.codeCache.get(fileName);
        if (!p) {
            p = fetch(resolveAssetUrl(`shaders/${fileName}`, this.baseUrl), { cache: 'force-cache' })
                .then((res) => {
                    if (!res.ok) throw new Error(`Failed to load shader ${fileName}: ${res.status}`);
                    return res.text();
                });
            this.codeCache.set(fileName, p);
        }
        return p;
    }
}

function isShaderObject(input: any): input is ShaderObject {
    return !!input && typeof input.shaderName === 'string' && !!input.metaData;
}

function isCustomShader(input: any): input is CustomShader {
    return !!input && typeof input.code === 'string';
}

export function customShaderToObject(custom: CustomShader): ShaderObject {
    const shaderName = custom.name ?? 'custom.frag';
    const metaData: ShaderObject['metaData'] = {
        author: '',
        modifiedBy: '',
        shaderName: custom.name ?? 'Custom shader',
        url: '',
        license: '',
        shaderSpeed: custom.shaderSpeed ?? 1,
        customUniforms: custom.customUniforms,
        ...(custom.channels ?? {}),
    };
    const inlineBuffers: { [filename: string]: string } = {};
    if (custom.buffers?.length) {
        metaData.buffers = custom.buffers.map((b) => {
            const name = `custom_buffer${b.output}.frag`;
            inlineBuffers[name] = b.code;
            return { shaderName: name, output: b.output, ...(b.channels ?? {}) };
        });
    }
    const obj: ShaderObject = { shaderName, metaData, inlineCode: custom.code };
    if (Object.keys(inlineBuffers).length) obj.inlineBuffers = inlineBuffers;
    return obj;
}

export async function normalizeShaderInput(input: ShaderInput, catalog: Catalog): Promise<ShaderObject> {
    if (typeof input === 'string') {
        const found = await catalog.find(input);
        if (!found) throw new Error(`Shader not found: ${input}`);
        return found;
    }
    if (isShaderObject(input)) return input;
    if (isCustomShader(input)) return customShaderToObject(input);
    throw new Error('Invalid shader input');
}
