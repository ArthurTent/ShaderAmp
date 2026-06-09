/**
 * buildManifest.js
 *
 * Reads dist/manifest.json (the combined manifest) and writes a
 * browser-specific version back to dist/manifest.json.
 *
 * Usage:
 *   node src/buildManifest.js --browser chrome
 *   node src/buildManifest.js --browser firefox
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'dist', 'manifest.json');

function parseArgs() {
    const idx = process.argv.indexOf('--browser');
    if (idx === -1 || !process.argv[idx + 1]) {
        console.error('Usage: node src/buildManifest.js --browser <chrome|firefox>');
        process.exit(1);
    }
    const browser = process.argv[idx + 1].toLowerCase();
    if (browser !== 'chrome' && browser !== 'firefox') {
        console.error(`Unknown browser "${browser}". Must be "chrome" or "firefox".`);
        process.exit(1);
    }
    return browser;
}

function buildChrome(manifest) {
    const removed = [];

    // Chrome does not need the Firefox-specific gecko block
    if (manifest.browser_specific_settings) {
        delete manifest.browser_specific_settings;
        removed.push('browser_specific_settings');
    }

    // data_collection_permissions is a Firefox/AMO-specific field
    if (manifest.data_collection_permissions) {
        delete manifest.data_collection_permissions;
        removed.push('data_collection_permissions');
    }

    // background.scripts is used by Firefox MV3; Chrome MV3 only uses service_worker
    if (manifest.background && manifest.background.scripts) {
        delete manifest.background.scripts;
        removed.push('background.scripts');
    }

    return removed;
}

function buildFirefox(manifest) {
    const removed = [];

    // tabCapture is a Chrome-only permission; Firefox uses getDisplayMedia instead
    if (manifest.permissions) {
        const before = manifest.permissions.length;
        manifest.permissions = manifest.permissions.filter(p => p !== 'tabCapture');
        if (manifest.permissions.length < before) {
            removed.push('permissions.tabCapture');
        }
    }

    // data_collection_permissions is a Chrome Web Store field, not needed for AMO
    if (manifest.data_collection_permissions) {
        delete manifest.data_collection_permissions;
        removed.push('data_collection_permissions');
    }

    return removed;
}

function main() {
    const browser = parseArgs();

    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(raw);

    let removed;
    if (browser === 'chrome') {
        removed = buildChrome(manifest);
    } else {
        removed = buildFirefox(manifest);
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 4) + '\n', 'utf8');

    console.log(`\nBuilt manifest for: ${browser}`);
    if (removed.length > 0) {
        console.log('Removed keys:');
        removed.forEach(k => console.log(`  - ${k}`));
    } else {
        console.log('No keys removed.');
    }
    console.log(`Written to: ${MANIFEST_PATH}\n`);
}

main();
