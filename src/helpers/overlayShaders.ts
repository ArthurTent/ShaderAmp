import type { ShaderMetaData, ShaderOptions } from './types';

// User toggle (settings.shaderOptions[key].isOverlay) wins; otherwise the shader's meta flag.
// key = shaderName for built-ins, importedId for imported, customId for custom shaders.
export const isOverlayShader = (key: string, meta: ShaderMetaData | null | undefined, options: ShaderOptions | null | undefined): boolean =>
    options?.[key]?.isOverlay ?? meta?.overlay === true;
