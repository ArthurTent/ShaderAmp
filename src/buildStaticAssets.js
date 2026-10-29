const fs = require('fs');
const path = require('path');

function copyStaticAssets(outputDir = path.join(__dirname, '..', 'dist', 'js')) {
    const runtime = require.resolve('@g200kg/webaudio-controls');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.copyFileSync(runtime, path.join(outputDir, 'webaudio-controls.js'));
    fs.copyFileSync(path.join(path.dirname(runtime), 'LICENSE'), path.join(outputDir, 'webaudio-controls.LICENSE.txt'));
}

// MediaPipe person segmentation for the virtual camera (src/vcam). Only the
// SIMD build is shipped — every browser that runs MV3 extensions supports it.
function copyMediapipeAssets(outputDir = path.join(__dirname, '..', 'dist', 'mediapipe')) {
    const pkgDir = path.dirname(require.resolve('@mediapipe/tasks-vision'));
    fs.mkdirSync(outputDir, { recursive: true });
    for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
        fs.copyFileSync(path.join(pkgDir, 'wasm', file), path.join(outputDir, file));
    }
    fs.copyFileSync(path.join(__dirname, 'vcam', 'assets', 'selfie_segmenter.tflite'), path.join(outputDir, 'selfie_segmenter.tflite'));
}

if (require.main === module) {
    copyStaticAssets();
    console.log('Copied WebAudio controls and Apache-2.0 license into dist/js');
    copyMediapipeAssets();
    console.log('Copied MediaPipe vision WASM and selfie segmentation model into dist/mediapipe');
}

module.exports = { copyStaticAssets, copyMediapipeAssets };
