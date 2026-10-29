import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(pkgRoot, '../..');
const assetsDir = path.join(pkgRoot, 'assets');

// Asset sources live in the extension's dist/. Override with
// SHADERAMP_DIST_DIR=/path/to/dist to copy from elsewhere.
const srcRoot = process.env.SHADERAMP_DIST_DIR ?? path.join(repoRoot, 'dist');
const shadersSrc = path.join(srcRoot, 'shaders');
const imagesSrc = path.join(srcRoot, 'images');

for (const dir of [shadersSrc, imagesSrc]) {
    if (!existsSync(dir)) {
        console.error(
            `shaderamp assets: ${dir} not found. copy-assets must run inside a complete ` +
            `ShaderAmp checkout (or set SHADERAMP_DIST_DIR). If you copied the project ` +
            `manually or through a sync folder, let the copy finish first.`,
        );
        process.exit(1);
    }
}

// --- generate shaders/list.json (ported from src/buildShaderList.js) ---

const listFilesSync = (dir) =>
    readdirSync(dir).flatMap((file) => {
        const full = path.join(dir, file);
        if (statSync(full).isDirectory()) return listFilesSync(full);
        return path.extname(file) === '.frag' ? [full] : [];
    });

// Same rules as packages/web/src/shader/preprocess.ts stripGlslComments
const stripGlslComments = (src) =>
    src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fileInfo = (file) => {
    const metaPath = `${file}.meta`;
    const metaData = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
    if (/\bvoid\s+mainVR\s*\(/.test(stripGlslComments(readFileSync(file, 'utf8')))) {
        metaData.vr = true;
    }
    const info = { shaderName: path.basename(file) };
    if (Object.keys(metaData).length > 0) info.metaData = metaData;
    return info;
};

const catalog = {
    lastModified: new Date().toJSON(),
    shaders: listFilesSync(shadersSrc)
        .map(fileInfo)
        .filter((s) => !s.metaData?.hidden),
};

// --- write assets/ ---

rmSync(assetsDir, { recursive: true, force: true });
mkdirSync(assetsDir, { recursive: true });
cpSync(shadersSrc, path.join(assetsDir, 'shaders'), { recursive: true });
cpSync(imagesSrc, path.join(assetsDir, 'images'), { recursive: true });

// Keep dist/shaders/list.json in sync with the extension's own build step.
writeFileSync(path.join(shadersSrc, 'list.json'), JSON.stringify(catalog, null, 2));

// Drop unsupported entries (cubemap passes / sound shaders)
const before = catalog.shaders.length;
catalog.shaders = catalog.shaders.filter(
    (s) => !s.metaData?.cubemapPasses && !s.metaData?.soundShader,
);
writeFileSync(path.join(assetsDir, 'shaders/list.json'), JSON.stringify(catalog, null, 2));
console.log(`Catalog: ${catalog.shaders.length} entries (dropped ${before - catalog.shaders.length})`);

const lines = catalog.shaders.map((s) => {
    const m = s.metaData ?? {};
    return `- **${m.shaderName ?? s.shaderName}** by ${m.author ?? 'unknown'} (modified by ${m.modifiedBy ?? 'unknown'}) — ${m.license ?? 'unknown license'} — ${m.url ?? ''}`;
});
writeFileSync(
    path.join(assetsDir, 'SHADER_LICENSES.md'),
    `# Bundled shader licenses\n\n${lines.join('\n')}\n`,
);

const dirSize = (dir) =>
    readdirSync(dir).reduce(
        (total, name) => {
            const p = path.join(dir, name);
            return total + (statSync(p).isDirectory() ? dirSize(p) : statSync(p).size);
        },
        0,
    );
console.log(`Assets written to ${assetsDir} (${(dirSize(assetsDir) / 1024 / 1024).toFixed(1)} MB)`);
