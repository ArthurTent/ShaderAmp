export function normalizeBase(base: string): string {
    return base.endsWith('/') ? base : base + '/';
}

export function resolveAssetUrl(path: string, base: string): string {
    if (/^(https?:|data:|blob:|\/\/)/.test(path) || path.startsWith('/')) {
        return path;
    }
    const normalized = normalizeBase(base);
    const absoluteBase = /^(https?:|data:|blob:|\/\/)/.test(normalized)
        ? normalized
        : new URL(normalized, location.href).href;
    return new URL(path, absoluteBase).href;
}
