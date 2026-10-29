import type { ShaderMetaData } from './types';

export type SceneCredit = {
    shaderRef: string;
    name: string;
    author?: string;
    modifiedBy?: string;
    url?: string;
    license?: string;
};

// Collect one credit per shaderRef, in node order, from a scene's nodes.
export function collectSceneCredits(
    nodes: { type?: string; data?: any }[],
    resolve: (shaderRef: string) => { meta: ShaderMetaData | null; label: string },
): SceneCredit[] {
    const seen = new Set<string>();
    const credits: SceneCredit[] = [];
    for (const node of nodes) {
        if (node.type !== 'scene' && node.type !== 'overlay') continue;
        const shaderRef = node.data?.shaderRef;
        if (typeof shaderRef !== 'string' || !shaderRef || seen.has(shaderRef)) continue;
        seen.add(shaderRef);
        const { meta, label } = resolve(shaderRef);
        credits.push({
            shaderRef,
            name: meta?.shaderName || label || shaderRef,
            author: meta?.author,
            modifiedBy: meta?.modifiedBy,
            url: meta?.url,
            license: meta?.license,
        });
    }
    return credits;
}

// Plain-text credits, one block per shader separated by a blank line:
//   "<name>" by <author> (modified by <modifiedBy>)
//   <url>
//   License: <license>
export function formatCredits(credits: SceneCredit[]): string {
    return credits.map(c => {
        let header = `"${c.name}"`;
        if (c.author) header += ` by ${c.author}`;
        if (c.modifiedBy) header += ` (modified by ${c.modifiedBy})`;
        const lines = [header];
        if (c.url) lines.push(c.url);
        if (c.license) lines.push(`License: ${c.license}`);
        return lines.join('\n');
    }).join('\n\n');
}
