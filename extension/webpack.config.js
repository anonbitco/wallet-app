require('dotenv').config();

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const WriteFilePlugin = require('write-file-webpack-plugin');
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');

const pkg = require('../package.json');
const appDirectory = path.resolve(__dirname, '../');
const manifest = require('./manifest');

const BUILD = process.env.BUILD || 0;
const BROWSER = process.env.BROWSER || 'chrome';
const TARGET = process.env.TARGET || 'release';
const VERSION = `${pkg.version}.${BUILD}`;

const dotenvWhitelistFile = fs
    .readFileSync(path.resolve(__dirname, '../src/config/.env.whitelist'))
    .toString();
const envVarsWhitelist = dotenvWhitelistFile
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => v.substring(0, v.indexOf('=')));
const ENV_VARS = {};
for (let v of envVarsWhitelist) {
    if (v.indexOf('MOONLET_') === 0) {
        ENV_VARS[`process.env.${v}`] = JSON.stringify(process.env[v]);
    }
}

// This is needed for webpack to compile JavaScript.
// Many OSS React Native packages are not compiled to ES5 before being
// published. If you depend on uncompiled packages they may cause webpack build
// errors. To fix this webpack can be configured to compile to the necessary
// `node_module`.
const babelLoaderConfiguration = {
    test: /\.js$/,
    // Add every directory that needs to be compiled by Babel during the build.
    include: [
        // path.resolve(appDirectory, 'index.web.js'),
        // path.resolve(appDirectory, 'src'),
        path.resolve(appDirectory, 'node_modules/@react-navigation'),
        path.resolve(appDirectory, 'node_modules/react-native-dialog'),
        path.resolve(appDirectory, 'node_modules/react-native-animatable'),
        path.resolve(appDirectory, 'node_modules/react-navigation'),
        path.resolve(appDirectory, 'node_modules/react-navigation-stack'),
        path.resolve(appDirectory, 'node_modules/react-navigation-tabs'),
        path.resolve(appDirectory, 'node_modules/react-native-reanimated'),
        path.resolve(appDirectory, 'node_modules/react-native-linear-gradient'),
        path.resolve(appDirectory, 'node_modules/react-native-screens'),
        path.resolve(appDirectory, 'node_modules/react-native-tab-view'),
        path.resolve(appDirectory, 'node_modules/react-native-safe-area-view'),
        path.resolve(appDirectory, 'node_modules/react-native-vector-icons'),
        path.resolve(appDirectory, 'node_modules/react-native-gesture-handler'),
        path.resolve(appDirectory, 'node_modules/@react-native-community/async-storage'),
        path.resolve(appDirectory, 'node_modules/@solana/web3.js'),
        path.resolve(appDirectory, 'node_modules/react-native-secure-key-store'),
        path.resolve(appDirectory, 'node_modules/react-native-qrcode-svg'),
        path.resolve(appDirectory, 'node_modules/react-native-draggable-flatlist'),
        path.resolve(appDirectory, 'node_modules/react-native-fast-image'),
        path.resolve(appDirectory, 'node_modules/react-native-markdown-display'),
        path.resolve(appDirectory, 'node_modules/react-native-keyboard-aware-scroll-view')
        // path.resolve(appDirectory, 'node_modules/react-native-uncompiled')
    ],
    use: {
        loader: 'babel-loader',
        options: {
            cacheDirectory: true,
            // The 'react-native' preset is recommended to match React Native's packager
            presets: ['module:metro-react-native-babel-preset', '@babel/preset-env'],
            // Re-write paths to import only the modules needed by the app
            plugins: ['react-native-web', '@babel/plugin-proposal-class-properties']
        }
    }
};

// This is needed for webpack to import static images in JavaScript files.
const imageLoaderConfiguration = {
    test: /\.(gif|jpe?g|png|svg)$/,
    use: {
        loader: 'url-loader',
        options: {
            name: '[name].[ext]'
        }
    }
};

module.exports = (env, argv) => ({
    entry: {
        // load any web API polyfills
        // path.resolve(appDirectory, 'polyfills-web.js'),
        // your web-specific entry file
        'bundle.browser-action': path.resolve(appDirectory, 'index.extension.js'),
        'bundle.background': path.resolve(appDirectory, 'extension/background/background'),
        'bundle.providers.cs': path.resolve(appDirectory, 'extension/content-scripts/providers')
    },

    plugins: [
        new HtmlWebpackPlugin({
            chunks: ['bundle.browser-action'],
            template: './extension/browser-action/index.html',
            filename: 'index.html'
        }),
        new webpack.DefinePlugin({
            __DEV__: argv.mode === 'development',
            ...ENV_VARS,
            'process.env.TARGET': `"${TARGET}"`,
            'process.env.VERSION': `"${VERSION}"`
        }),
        new CopyPlugin([
            { from: './resources', to: './resources' },
            { from: './extension/icons', to: './icons' }
        ]),
        new WebpackExtensionManifestPlugin({
            config: {
                base: manifest[TARGET][BROWSER],
                extend: { version: VERSION }
            }
        }),
        new WriteFilePlugin(),
        new MomentLocalesPlugin({
            localesToKeep: ['en']
        })
    ],

    // configures where the build ends up
    output: {
        filename: '[name].js',
        path: path.resolve(appDirectory, `extension/build/${TARGET}/${BROWSER}`)
    },

    // ...the rest of your config

    module: {
        rules: [
            babelLoaderConfiguration,
            imageLoaderConfiguration,
            {
                test: /\.tsx?$/,
                loader: 'ts-loader'
            }
        ]
    },

    resolve: {
        // This will only alias the exact import "react-native"
        alias: {
            'react-native$': 'react-native-web',
            'react-native-linear-gradient$': 'react-native-web-linear-gradient',
            '@sentry/react-native$': '@sentry/browser',
            'lottie-react-native$': 'react-native-web-lottie',
            'react-native-device-info$': path.resolve(
                __dirname,
                '../src/react-native-web/react-native-device-info'
            )
        },
        // If you're working on a multi-platform React Native app, web-specific
        // module implementations should be written in files using the extension
        // `.web.js`.
        extensions: [
            '.extension.js',
            '.web.js',
            '.js',
            '.extension.ts',
            '.web.ts',
            '.ts',
            '.extension.tsx',
            '.web.tsx',
            '.tsx'
        ]
    },

    devtool: 'source-map',
    devServer: {
        hot: false
    }
});
