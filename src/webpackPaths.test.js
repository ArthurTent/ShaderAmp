const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

let directory;
let root;

function loadConfig() {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'webpack.common.js'), 'utf8'), {
        __dirname: root,
        module,
        process,
        require: name => name === 'webpack-shell-plugin-next'
            ? class { constructor(options) { this.options = options; } }
            : require(name),
    });
    return module.exports;
}

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderamp paths '));
    root = path.join(directory, 'project with spaces');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
});

afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
});

test('anchors Webpack context and aliases to its project, not the invocation directory', () => {
    const config = loadConfig();
    expect(config.context).toBe(root);
    expect(config.resolve.alias.three).toBe(path.join(root, 'node_modules', 'three'));
    expect(config.resolve.alias['@src']).toBe(path.join(root, 'src'));
    expect(config.entry.backgroundPage).toBe(path.join(root, 'src', 'backgroundPage.ts'));
    expect(config.output.path).toBe(path.join(root, 'dist', 'js'));
});

test('runs build hooks in order using the project directory even when its path contains spaces', () => {
    for (const name of ['buildShaderList.js', 'buildStaticAssets.js']) {
        fs.writeFileSync(path.join(root, 'src', name),
            `require('fs').appendFileSync('calls.jsonl', JSON.stringify({ script: ${JSON.stringify(name)}, cwd: process.cwd() }) + '\\n');`);
    }
    const { onBuildStart } = loadConfig().plugins[0].options;
    expect(onBuildStart.blocking).toBe(true);
    expect(onBuildStart.parallel).toBe(false);
    for (const script of onBuildStart.scripts) {
        expect(typeof script).toBe('function');
        script();
    }
    const calls = fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(calls).toEqual([
        { script: 'buildShaderList.js', cwd: fs.realpathSync(root) },
        { script: 'buildStaticAssets.js', cwd: fs.realpathSync(root) },
    ]);
});

function renderCss(relativePath) {
    const project = path.join(__dirname, '..');
    const filename = path.join(project, relativePath);
    const script = `
        const fs = require('fs');
        const config = require(${JSON.stringify(path.join(project, 'postcss.config.js'))});
        const postcss = require(${JSON.stringify(require.resolve('postcss'))});
        const plugins = Object.entries(config.plugins).map(([name, options]) =>
            require(require.resolve(name, { paths: [${JSON.stringify(project)}] }))(options));
        const filename = ${JSON.stringify(filename)};
        postcss(plugins).process(fs.readFileSync(filename, 'utf8'), { from: filename })
            .then(result => process.stdout.write(result.css))
            .catch(error => { console.error(error); process.exitCode = 1; });
    `;
    return execFileSync(process.execPath, ['-e', script], { cwd: directory, encoding: 'utf8' });
}

test('generates project Tailwind utilities and themes outside the project directory', () => {
    const css = renderCss('src/css/app.css');
    expect(css).toContain('.bg-indigo-600');
    expect(css).toContain('.dark\\:bg-gray-900');
    expect(css).toContain('.scrollbar-thin');
    expect(css).toContain('.green-theme');
    expect(css).toContain('.hover\\:bg-indigo-500');
    expect(css).not.toContain('@media (hover: hover)');
    const shadows = [];
    require('postcss').parse(css).walkRules('.shadow-sm', rule => {
        rule.walkDecls('--tw-shadow', declaration => shadows.push(declaration.value));
    });
    expect(shadows[shadows.length - 1]).toContain('0.05');
    expect(css).toContain('outline: 2px solid transparent');
});

test.each(['options', 'content', 'popup'])('processes the %s CSS module without duplicating global utilities', section => {
    const css = renderCss(`src/${section}/styles.module.css`);
    expect(css).not.toContain('.bg-indigo-600');
    expect(css).not.toContain('.green-theme');
    if (section === 'options') {
        expect(css).toContain('color:');
        expect(css).toContain('.dark');
    }
});
