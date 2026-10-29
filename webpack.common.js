const path = require("path");
const { execFileSync } = require('child_process');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const { DefinePlugin } = require('webpack');

// The virtual camera (src/vcam) bundles the standalone web library from
// packages/web/src, which needs a modern target — it gets its own tsconfig.
const VCAM_DIRS = [path.join(__dirname, 'src/vcam'), path.join(__dirname, 'packages/web/src')];
const WEB_LIB_VERSION = (() => {
    try { return require(path.join(__dirname, 'packages', 'web', 'package.json')).version; } catch { return '0.0.0'; }
})();

module.exports = {
    context: __dirname,
    entry: {
        backgroundPage: path.join(__dirname, "src/backgroundPage.ts"),
        popup: path.join(__dirname, "src/popup/index.tsx"),
        content: path.join(__dirname, "src/content/index.tsx"),
        options: path.join(__dirname, "src/options/index.tsx"),
        shadertoyContent: path.join(__dirname, "src/shadertoy/shadertoyContent.ts"),
        mediaSync: path.join(__dirname, "src/mediaSync/mediaSyncContent.ts"),
        mediaSyncPage: path.join(__dirname, "src/mediaSync/mediaSyncPage.ts"),
        vcamPage: path.join(__dirname, "src/vcam/vcamPage.ts"),
        // Content scripts can't load async chunks: inline the library's lazy imports.
        vcamContent: { import: path.join(__dirname, "src/vcam/vcamContent.ts"), asyncChunks: false },
        vcamSegmenter: path.join(__dirname, "src/vcam/segmenter.ts"),
        offscreen: path.join(__dirname, "src/offscreen/audioPipeline.ts"),
    },
    output: {
        path: path.join(__dirname, "dist/js"),
        filename: "[name].js",
    },
    plugins: [
        new WebpackShellPluginNext({
            onBuildStart:{
                scripts: ['buildShaderList.js', 'buildStaticAssets.js'].map(script => () =>
                    execFileSync(process.execPath, [path.join(__dirname, 'src', script)], { cwd: __dirname, stdio: 'inherit' })
                ),
                blocking: true,
                parallel: false
              }, 
              dev: false,
              safe: false,
              logging: true
        }),
        new DefinePlugin({ __SHADERAMP_VERSION__: JSON.stringify(WEB_LIB_VERSION) }),
    ],
    module: {
        rules: [
            {
                exclude: [/node_modules/, ...VCAM_DIRS],
                test: /\.tsx?$/,
                use: "ts-loader",
            },
            {
                include: VCAM_DIRS,
                test: /\.tsx?$/,
                use: {
                    loader: "ts-loader",
                    options: { configFile: path.join(__dirname, 'src/vcam/tsconfig.json'), instance: 'vcam' },
                },
            },
            // Global stylesheets (including third-party CSS from node_modules)
            {
                test: /\.css$/,
                exclude: /\.module\.css$/,
                use: [
                    "style-loader",
                    "css-loader",
                    "postcss-loader",
                ],
            },
            // Load .module.css files as CSS modules
            {
                test: /\.module.css$/,
                use: [
                    "style-loader",
                    {
                        loader: "css-loader",
                        options: {
                            modules: true,
                        },
                    },
                    "postcss-loader",
                ],
            },
        ],
    },
    // Setup @src path resolution for TypeScript files
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        alias: {
            "@src": path.resolve(__dirname, "src/"),
            three: path.resolve(__dirname, 'node_modules/three')
        },
    },
    watchOptions: {
        ignored: '**/list.json',
    },
};
