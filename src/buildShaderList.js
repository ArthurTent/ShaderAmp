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

// return an object with the file path and file size
function formatFileInfo(file) {
    const fileName = path.basename(file);
    if (fs.existsSync(file + '.meta')) {
        const meta = JSON.parse(fs.readFileSync(file + '.meta'));
        return { "shaderName": fileName, "metaData": meta };
    } else {
        return { "shaderName": fileName };
    }
}

const directory = path.join(__dirname, '../dist/shaders');
const fullDirPath = path.resolve(directory);
console.log(`Processing dir '${fullDirPath}'...`);

const fullFileList = listFilesSync(fullDirPath);
console.log(`Found ${fullFileList.length} files`);

const currentDate = new Date();
const dateJson = currentDate.toJSON();
const formattedFiles = fullFileList.map(formatFileInfo);
const output = {
  lastModified: dateJson,
  shaders: formattedFiles
}
const outFile = `${directory}/list.json`;
fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
console.log(`Wrote file ${outFile}`);

