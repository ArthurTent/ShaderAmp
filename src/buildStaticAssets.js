const fs = require('fs');
const path = require('path');

function copyStaticAssets(outputDir = path.join(__dirname, '..', 'dist', 'js')) {
    const runtime = require.resolve('@g200kg/webaudio-controls');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.copyFileSync(runtime, path.join(outputDir, 'webaudio-controls.js'));
    fs.copyFileSync(path.join(path.dirname(runtime), 'LICENSE'), path.join(outputDir, 'webaudio-controls.LICENSE.txt'));
}

if (require.main === module) {
    copyStaticAssets();
    console.log('Copied WebAudio controls and Apache-2.0 license into dist/js');
}

module.exports = { copyStaticAssets };
