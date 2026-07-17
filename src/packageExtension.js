const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { createBrowserManifest } = require('./buildManifest');

const ROOT_FILES = ['content.html', 'options.html', 'popup.html', 'offscreen.html', 'third_party_licenses.md'];
const BUNDLES = ['backgroundPage', 'content', 'options', 'popup', 'shadertoyContent', 'offscreen', 'webaudio-controls'];

function includeFile(name) {
    if (name.split('/').some(part => part.startsWith('.') || ['__pycache__', '__MACOSX', 'node_modules'].includes(part))) return false;
    if (ROOT_FILES.includes(name)) return true;
    if (name.startsWith('js/')) return /(?:\.js|\.LICENSE\.txt)$/.test(name) && !/\.(?:test|spec)\.js$/.test(name);
    if (name.startsWith('images/')) return /\.(?:png|jpe?g|gif|webp|svg|ico)$/i.test(name);
    if (name.startsWith('media/')) return /\.(?:mp4|webm|ogg|mp3|wav)$/i.test(name);
    if (name.startsWith('shaders/')) return /\.frag(?:\.meta)?$/.test(name) || ['shaders/list.json', 'shaders/README.md', 'shaders/LICENSE'].includes(name);
    return false;
}

function collectFiles(distDir) {
    const files = new Map();
    function visit(directory, relative = '') {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (entry.name.startsWith('.') || ['__pycache__', '__MACOSX', 'node_modules'].includes(entry.name)) continue;
            const name = relative ? `${relative}/${entry.name}` : entry.name;
            const source = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) throw new Error(`Refusing to package symbolic link: ${name}`);
            if (entry.isDirectory()) {
                if (relative || ['js', 'images', 'media', 'shaders'].includes(entry.name)) visit(source, name);
            } else if (entry.isFile() && includeFile(name)) {
                files.set(name, fs.readFileSync(source));
            }
        }
    }
    visit(distDir);
    return files;
}

function validateFiles(manifest, files) {
    const icons = value => typeof value === 'string' ? [value] : Object.values(value || {});
    const required = [
        ...ROOT_FILES, ...BUNDLES.map(name => `js/${name}.js`),
        'js/webaudio-controls.LICENSE.txt', 'shaders/list.json', 'shaders/README.md', 'shaders/LICENSE',
        manifest.options_page, manifest.options_ui?.page, manifest.action?.default_popup,
        manifest.background?.service_worker, ...(manifest.background?.scripts || []),
        ...icons(manifest.icons), ...icons(manifest.action?.default_icon),
        ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])]),
        ...(manifest.web_accessible_resources || []).flatMap(group => group.resources || []).filter(name => !name.includes('*')),
    ].filter(Boolean);
    for (const [name, data] of files) {
        if (!name.endsWith('.html')) continue;
        for (const match of data.toString('utf8').matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)) {
            const reference = match[1];
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
            const localPath = decodeURIComponent(reference.split(/[?#]/)[0]);
            required.push(path.posix.normalize(localPath.startsWith('/') ? localPath.slice(1) : path.posix.join(path.posix.dirname(name), localPath)));
        }
    }
    for (const name of new Set(required)) {
        if (!files.has(name)) throw new Error(`Missing distribution asset: ${name}. Run npm run build and check dist/.`);
    }
}

async function packageExtension({ browser, rootDir = path.join(__dirname, '..'), outputDir = path.join(rootDir, 'releases') }) {
    if (!['chrome', 'firefox'].includes(browser)) throw new Error('Browser must be "chrome" or "firefox".');
    const distDir = path.join(rootDir, 'dist');
    const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    if (!/^\d+(?:\.\d+){0,3}$/.test(manifest.version) || manifest.version !== pkg.version) {
        throw new Error('The package.json and dist/manifest.json versions must match and use a numeric extension version.');
    }
    if (!manifest.background?.service_worker || !manifest.background?.scripts?.length ||
        !manifest.browser_specific_settings?.gecko?.id || !manifest.permissions?.includes('tabCapture')) {
        throw new Error('Packaging requires the combined manifest in dist/manifest.json, not an in-place browser-specific build. Restore the combined manifest before packaging.');
    }
    const browserManifest = createBrowserManifest(manifest, browser);
    const files = collectFiles(distDir);
    validateFiles(browserManifest, files);
    files.set('manifest.json', Buffer.from(JSON.stringify(browserManifest, null, 4) + '\n'));
    files.set('LICENSE', fs.readFileSync(path.join(rootDir, 'LICENSE')));
    const zip = new JSZip();
    for (const [name, data] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
        zip.file(name, data, { date: new Date('1980-01-01T00:00:00Z'), createFolders: false });
    }
    const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `ShaderAmp-${manifest.version}-${browser}.zip`);
    fs.writeFileSync(outputPath, archive);
    return { outputPath, fileCount: files.size, size: archive.length };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--browser' || !['chrome', 'firefox'].includes(args[1])) {
        console.error('Usage: node src/packageExtension.js --browser <chrome|firefox>');
        process.exitCode = 1;
    } else {
        packageExtension({ browser: args[1] }).then(({ outputPath, fileCount, size }) => {
            console.log(`Packaged ${fileCount} files (${(size / 1024 / 1024).toFixed(2)} MiB): ${outputPath}`);
        }).catch(error => {
            console.error(`Packaging failed: ${error.message}`);
            process.exitCode = 1;
        });
    }
}

module.exports = { packageExtension };
