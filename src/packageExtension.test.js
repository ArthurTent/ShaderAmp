const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');
const { packageExtension } = require('./packageExtension');
const { createBrowserManifest } = require('./buildManifest');

const combined = {
    manifest_version: 3,
    name: 'ShaderAmp',
    version: '2.0.2',
    background: { service_worker: 'js/backgroundPage.js', scripts: ['js/backgroundPage.js'] },
    permissions: ['tabs', 'storage', 'tabCapture', 'offscreen'],
    browser_specific_settings: { gecko: { id: 'test@example.com', data_collection_permissions: { required: ['none'] } } },
    data_collection_permissions: { none: true },
    options_page: 'options.html',
    action: { default_popup: 'popup.html', default_icon: { '32': 'images/icon32.png' } },
    icons: { '32': 'images/icon32.png' },
    content_scripts: [{ matches: ['https://www.shadertoy.com/*'], js: ['js/shadertoyContent.js'] }],
    web_accessible_resources: [{ resources: ['media/*', 'third_party_licenses.md'], matches: ['<all_urls>'] }],
};
let root;

function write(relative, content = 'fixture') {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}

function createFixture() {
    write('package.json', JSON.stringify({ version: combined.version }));
    write('LICENSE', 'MIT license');
    write('dist/manifest.json', JSON.stringify(combined));
    for (const page of ['popup', 'options', 'content', 'offscreen']) {
        write(`dist/${page}.html`, `<script src="js/${page}.js"></script>`);
    }
    write('dist/options.html', '<script src="js/webaudio-controls.js"></script><script src="js/options.js"></script>');
    for (const name of ['popup', 'options', 'content', 'offscreen', 'backgroundPage', 'shadertoyContent', 'webaudio-controls', '260']) {
        write(`dist/js/${name}.js`);
    }
    write('dist/js/options.js.LICENSE.txt', 'Third-party bundle licenses');
    write('dist/js/webaudio-controls.LICENSE.txt', 'Apache License 2.0');
    write('dist/third_party_licenses.md');
    write('dist/images/icon32.png');
    write('dist/images/preview/Main.frag.png');
    write('dist/images/cubemaps/px.png');
    write('dist/media/example.mp4');
    write('dist/shaders/list.json', JSON.stringify({ shaders: [] }));
    write('dist/shaders/Main.frag');
    write('dist/shaders/Main.frag.meta', JSON.stringify({ buffers: [{ shaderName: 'BufferA.frag' }] }));
    write('dist/shaders/BufferA.frag');
    write('dist/shaders/BufferA.frag.meta', '{"hidden":true}');
    write('dist/shaders/README.md');
    write('dist/shaders/LICENSE');
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderamp-package-'));
    createFixture();
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

test.each(['chrome', 'firefox'])('creates a root-level %s extension with all runtime assets and licenses', async browser => {
    const original = fs.readFileSync(path.join(root, 'dist/manifest.json'));
    const result = await packageExtension({ rootDir: root, browser });
    expect(result.outputPath).toBe(path.join(root, 'releases', `ShaderAmp-2.0.2-${browser}.zip`));
    const zip = await JSZip.loadAsync(fs.readFileSync(result.outputPath), { checkCRC32: true });
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    expect(manifest.version).toBe('2.0.2');
    expect(manifest.data_collection_permissions).toBeUndefined();
    if (browser === 'chrome') {
        expect(manifest.browser_specific_settings).toBeUndefined();
        expect(manifest.background.scripts).toBeUndefined();
        expect(manifest.background.service_worker).toBe('js/backgroundPage.js');
        expect(manifest.permissions).toContain('tabCapture');
    } else {
        expect(manifest.browser_specific_settings).toEqual(combined.browser_specific_settings);
        expect(manifest.background.scripts).toEqual(['js/backgroundPage.js']);
        expect(manifest.permissions).not.toContain('tabCapture');
    }
    for (const file of [
        'options.html', 'popup.html', 'content.html', 'offscreen.html',
        'js/260.js', 'js/webaudio-controls.js', 'js/webaudio-controls.LICENSE.txt',
        'js/options.js.LICENSE.txt', 'images/icon32.png', 'images/preview/Main.frag.png',
        'images/cubemaps/px.png', 'media/example.mp4', 'shaders/list.json',
        'shaders/Main.frag', 'shaders/Main.frag.meta', 'shaders/BufferA.frag',
        'shaders/BufferA.frag.meta', 'shaders/README.md', 'shaders/LICENSE', 'third_party_licenses.md', 'LICENSE',
    ]) expect(zip.file(file)).not.toBeNull();
    expect(Object.keys(zip.files).some(name => name.startsWith('dist/'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'dist/manifest.json'))).toEqual(original);
});

test('excludes development files, source maps, hidden files, and old archives', async () => {
    const excluded = [
        'shaders/create_readme.py', 'shaders/Pipfile', 'shaders/__pycache__/cache.pyc',
        '.DS_Store', '.env', 'js/.env', 'js/options.js.map', 'js/options.test.js',
        '__MACOSX/junk', 'images/.DS_Store', 'images/draft.psd', 'old.zip', 'src/private.js',
    ];
    for (const file of excluded) write(`dist/${file}`);
    const { outputPath } = await packageExtension({ rootDir: root, browser: 'chrome' });
    const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    for (const file of excluded) expect(zip.file(file)).toBeNull();
});

test('creates both archives sequentially without contaminating the next manifest', async () => {
    const original = JSON.stringify(combined);
    expect(createBrowserManifest(combined, 'chrome').browser_specific_settings).toBeUndefined();
    expect(JSON.stringify(combined)).toBe(original);
    for (const browser of ['chrome', 'firefox', 'chrome']) {
        const { outputPath } = await packageExtension({ rootDir: root, browser });
        const first = fs.readFileSync(outputPath);
        await packageExtension({ rootDir: root, browser });
        expect(fs.readFileSync(outputPath)).toEqual(first);
    }
    expect(fs.readFileSync(path.join(root, 'dist/manifest.json'), 'utf8')).toBe(original);
});

test.each(['js/webaudio-controls.js', 'js/content.js', 'shaders/list.json', 'images/icon32.png'])('rejects missing required asset %s before writing an archive', async file => {
    fs.unlinkSync(path.join(root, 'dist', file));
    await expect(packageExtension({ rootDir: root, browser: 'chrome' })).rejects.toThrow(file);
    expect(fs.existsSync(path.join(root, 'releases'))).toBe(false);
});

test('rejects missing HTML script references', async () => {
    write('dist/options.html', '<script src="js/missing-widget.js"></script>');
    await expect(packageExtension({ rootDir: root, browser: 'chrome' })).rejects.toThrow('js/missing-widget.js');
});

test('rejects a previously stripped manifest rather than shipping an incomplete browser build', async () => {
    write('dist/manifest.json', JSON.stringify(createBrowserManifest(combined, 'chrome')));
    await expect(packageExtension({ rootDir: root, browser: 'firefox' })).rejects.toThrow(/combined manifest/i);
});

test('rejects version mismatches', async () => {
    write('package.json', JSON.stringify({ version: '2.0.3' }));
    await expect(packageExtension({ rootDir: root, browser: 'chrome' })).rejects.toThrow(/version/i);
});

test('rejects symlinks instead of packaging files outside dist', async () => {
    write('outside.js', 'not a distribution asset');
    fs.symlinkSync(path.join(root, 'outside.js'), path.join(root, 'dist/js/link.js'));
    await expect(packageExtension({ rootDir: root, browser: 'chrome' })).rejects.toThrow(/symbolic link/i);
});

test('rejects unsupported browsers', async () => {
    await expect(packageExtension({ rootDir: root, browser: 'safari' })).rejects.toThrow(/browser/i);
    expect(() => createBrowserManifest(combined, 'safari')).toThrow(/browser/i);
});

test('CLI reports invalid arguments without running a build or creating output', () => {
    expect(() => execFileSync(process.execPath, [path.join(__dirname, 'packageExtension.js'), '--browser', 'safari'], {
        cwd: root, stdio: 'pipe',
    })).toThrow();
});
