/* eslint no-param-reassign: 0, no-console: 0 */
const fs = require('fs');
const path = require('path');

function isShaderFile(file) {
    return path.extname(file) == '.frag';
}
// return an ordered list of files in the input dir, with full paths
function listFilesSync(dir) {
  let fileList = [];
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    // use lstat so this does not follow dir symlinks
    // (otherwise this will include files from other dirs, which I don't want)
    if (fs.lstatSync(fullPath).isDirectory()) {
      fileList = fileList.concat(listFilesSync(fullPath));
    } else if (isShaderFile(fullPath)) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

// Strip GLSL comments (same rules as src/helpers/vrShader.ts stripGlslComments)
function stripGlslComments(src) {
    return src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// Shadertoy VR shaders define a mainVR() entrypoint
function isVRShaderSource(src) {
    return /\bvoid\s+mainVR\s*\(/.test(stripGlslComments(src));
}

// return an object with the file path and file size
function formatFileInfo(file) {
    const fileName = path.basename(file);
    const info = fs.existsSync(file + '.meta')
        ? { "shaderName": fileName, "metaData": JSON.parse(fs.readFileSync(file + '.meta')) }
        : { "shaderName": fileName, "metaData": {} };
    if (isVRShaderSource(fs.readFileSync(file, 'utf8'))) {
        info.metaData.vr = true;
    }
    if (Object.keys(info.metaData).length === 0) {
        delete info.metaData;
    }
    return info;
}

const directory = path.join(__dirname, '../dist/shaders');
const fullDirPath = path.resolve(directory);
console.log(`Processing dir '${fullDirPath}'...`);

const fullFileList = listFilesSync(fullDirPath);
console.log(`Found ${fullFileList.length} files`);

const currentDate = new Date();
const dateJson = currentDate.toJSON();
const formattedFiles = fullFileList.map(formatFileInfo);
// Remove shaders explicitly marked as hidden in their .meta
const visibleFiles = formattedFiles.filter((f) => !(f.metaData && f.metaData.hidden === true));
const output = {
  lastModified: dateJson,
  shaders: visibleFiles
}
const outFile = `${directory}/list.json`;
fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
console.log(`Wrote file ${outFile}`);

