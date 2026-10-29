import { useEffect, useMemo, useState } from 'react';
import { useChromeStorageLocal } from '@eamonwoortman/use-chrome-storage';
import browser from 'webextension-polyfill';
import { SETTINGS_SHADEROPTIONS, STATE_IMPORTED_SHADERS } from '@src/storage/storageConstants';
import { isOverlayShader } from '@src/helpers/overlayShaders';
import { overlayTargetRef, OVERLAY_HIDE_TARGET } from '@src/helpers/overlayMappingActions';
import type { CustomShader } from '@src/helpers/shaderStorage';
import type { ShaderCatalog, ShaderOptions, ImportedShader } from '@src/helpers/types';

export type OverlayShaderOption = { id: string; label: string };

/** Overlay-flagged shaders across built-ins, imported (Shadertoy) and custom shaders. */
export function useOverlayShaderOptions(shaderCatalog: ShaderCatalog): OverlayShaderOption[] {
    const [shaderOptions] = useChromeStorageLocal<ShaderOptions>(SETTINGS_SHADEROPTIONS, {});
    const [customShaders] = useChromeStorageLocal<CustomShader[]>('state.customshaders', []);
    const [importedStamp] = useChromeStorageLocal(STATE_IMPORTED_SHADERS, null);
    const [importedShaders, setImportedShaders] = useState<ImportedShader[]>([]);

    useEffect(() => {
        browser.runtime.sendMessage({ command: 'GET_IMPORTED_SHADERS' })
            .then(res => setImportedShaders(res?.data?.shaders || []))
            .catch(() => {});
    }, [importedStamp]);

    return useMemo(() => {
        const options: OverlayShaderOption[] = [];
        for (const s of shaderCatalog.shaders) {
            if (isOverlayShader(s.shaderName, s.metaData, shaderOptions)) {
                options.push({ id: s.shaderName, label: s.metaData?.shaderName || s.shaderName });
            }
        }
        for (const imp of importedShaders) {
            if (isOverlayShader(imp.id, imp.mainShader?.meta, shaderOptions)) {
                options.push({ id: imp.id, label: imp.name || imp.id });
            }
        }
        for (const c of customShaders || []) {
            if (isOverlayShader(c.id, c.metaData, shaderOptions)) {
                options.push({ id: c.id, label: c.metaData?.shaderName || c.shaderName });
            }
        }
        return options;
    }, [shaderCatalog, shaderOptions, customShaders, importedShaders]);
}

/** Label for an overlay mapping target; null for non-overlay targets. */
export const overlayTargetLabel = (t: string, options: OverlayShaderOption[]): string | null => {
    if (t === OVERLAY_HIDE_TARGET) return 'Overlay: Hide (any)';
    const ref = overlayTargetRef(t);
    if (!ref) return null;
    const match = options.find(o => o.id === ref);
    return match ? `Overlay: ${match.label}` : `Overlay: ${ref} (not flagged)`;
};
