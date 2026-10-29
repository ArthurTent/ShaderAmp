const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');
const { loadNycConfig } = require('@istanbuljs/load-nyc-config');

test('coverage configuration uses the scoped YAML 4 dependency', () => {
    const loaderRequire = createRequire(require.resolve('@istanbuljs/load-nyc-config'));
    expect(loaderRequire('js-yaml/package.json').version).toMatch(/^4\./);
});

test('loads inherited YAML coverage options with scalar, array, and boolean values', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderamp nyc '));
    try {
        fs.writeFileSync(path.join(directory, 'package.json'), '{}');
        fs.writeFileSync(path.join(directory, 'base.yaml'), 'all: true\nextension: .ts\nexclude:\n  - "**/*.test.ts"\n');
        fs.writeFileSync(path.join(directory, '.nycrc.yml'), 'extends: ./base.yaml\ninclude:\n  - src/**/*.ts\nreporter: text\n');
        const config = await loadNycConfig({ cwd: directory });
        expect(config).toEqual(expect.objectContaining({
            all: true,
            extension: ['.ts'],
            exclude: ['**/*.test.ts'],
            include: ['src/**/*.ts'],
            reporter: 'text',
        }));
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
