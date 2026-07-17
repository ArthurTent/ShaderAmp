const fs = require('fs');
const os = require('os');
const path = require('path');
const { copyStaticAssets } = require('./buildStaticAssets');

let directory;

test('pins WebAudio controls to the same public HTTPS archive in both lockfiles', () => {
    const root = path.join(__dirname, '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const archive = pkg.devDependencies['@g200kg/webaudio-controls'];
    expect(archive).toMatch(/^https:\/\/codeload\.github\.com\/g200kg\/webaudio-controls\/tar\.gz\/[a-f0-9]{40}$/);
    const npmLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const dependency = npmLock.packages['node_modules/@g200kg/webaudio-controls'];
    expect(dependency.resolved).toBe(archive);
    expect(dependency.integrity).toMatch(/^sha512-/);
    const yarnLock = fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8');
    const entry = yarnLock.split(`"@g200kg/webaudio-controls@${archive}":`)[1]?.split('\n\n')[0];
    expect(entry).toContain(`resolved "${archive}"`);
    expect(entry).toContain(`integrity ${dependency.integrity}`);
});

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderamp-static-'));
});

afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
});

test('copies the pinned WebAudio runtime and its complete license into the build output', () => {
    const output = path.join(directory, 'js');
    copyStaticAssets(output);
    const source = require.resolve('@g200kg/webaudio-controls');
    expect(fs.readFileSync(path.join(output, 'webaudio-controls.js'))).toEqual(fs.readFileSync(source));
    expect(fs.readFileSync(path.join(output, 'webaudio-controls.LICENSE.txt'))).toEqual(
        fs.readFileSync(path.join(path.dirname(source), 'LICENSE'))
    );
    expect(fs.readFileSync(path.join(output, 'webaudio-controls.js'), 'utf8')).toContain('customElements.define("webaudio-slider"');
});

test('can be rerun without removing other bundles', () => {
    fs.writeFileSync(path.join(directory, 'options.js'), 'existing bundle');
    copyStaticAssets(directory);
    const first = fs.readFileSync(path.join(directory, 'webaudio-controls.js'));
    copyStaticAssets(directory);
    expect(fs.readFileSync(path.join(directory, 'webaudio-controls.js'))).toEqual(first);
    expect(fs.readFileSync(path.join(directory, 'options.js'), 'utf8')).toBe('existing bundle');
});
