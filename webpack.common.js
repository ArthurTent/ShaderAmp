const path = require("path");
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

module.exports = {
    entry: {
        backgroundPage: path.join(__dirname, "src/backgroundPage.ts"),
        popup: path.join(__dirname, "src/popup/index.tsx"),
        content: path.join(__dirname, "src/content/index.tsx"),
        options: path.join(__dirname, "src/options/index.tsx"),
    },
    output: {
        path: path.join(__dirname, "dist/js"),
        filename: "[name].js",
    },
    plugins: [
        new WebpackShellPluginNext({
            onBuildStart:{
                scripts: ['npm run build_shader_list'],
                blocking: true,
                parallel: false
              }, 
              dev: false,
              safe: false,
              logging: true
        })
    ],
    module: {
        rules: [
            {
                exclude: /node_modules/,
                test: /\.tsx?$/,
                use: "ts-loader",
            },
            // Treat src/css/app.css as a global stylesheet
            {
                test: /\app.css$/,
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
            three: path.resolve('./node_modules/three')
        },
    },
    watchOptions: {
        ignored: '**/list.json',
    },
};
