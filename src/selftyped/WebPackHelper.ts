/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */

'use strict';

let pathLib = require('path');
let webpack = require('webpack');

import {ThreadT} from "../types/ThreadT";

let validate = require("../selftyped/Validate").singleton;

import {WebPackHelperT} from "../types/WebPackHelperT";

let WebPackHelper = function (thread:ThreadT):WebPackHelperT {
    let self:WebPackHelperT = this;
    validate.thread(thread);

    self.compiler = null;

    self.start = function (config) {

        if (!config) {
            if (self.priorConfig) {
                // restart
                thread.console.warn("Using prior configuration");
                config = self.priorConfig;
            } else {
                thread.console.softError("Configuration not provided");
                config = {};
            }
        } else {
            // save
            self.priorConfig = config;
        }

        if (!self.compiler) {

            thread.console.info("Starting web packer");
            thread.console.info("Using entry [" + config.entryPath + "]");
            thread.console.info("Using output [" + config.outputFile + "]");
            let outPath = pathLib.resolve(__dirname, config.outputPath);
            thread.console.info("Output path resolves to [" + outPath + "]");



            // CONFIG IS HERE



            let compiler = self.compiler = webpack({
                entry: [
                    config.entryPath
                ],
                output: {
                    path: outPath,
                    //publicPath: config.outputPath,
                    filename: config.outputFile
                },
                module: {
                    rules: [
                        {
                            test: /\.js$/,
                            exclude: [
                                pathLib.resolve(__dirname , './alasql/dist/')
                            ]
                        },
                        {
                            test: /\.(png|jpg|gif)$/i,
                            use: [
                                {
                                    loader: 'url-loader',
                                    options: {
                                        limit: 8192
                                    }
                                }
                            ]
                        }
                    ]
                },
                plugins: [
                    new webpack.ProvidePlugin({
                        process: 'process/browser.js',
                        Buffer: ['buffer', 'Buffer'],
                    }),
                ],
                resolve: {
                    fallback: {
                        // MUST INSTALL browserify or else this stuff will blow up
                        util: require.resolve("util/"),
                        fs: require.resolve("browserify-fs"),
                        path: require.resolve("path-browserify"),
                        crypto: require.resolve("crypto-browserify"),
                        buffer: require.resolve("buffer"),
                        https: require.resolve("https-browserify"),
                        http: require.resolve("stream-http"),
                        os: require.resolve("os-browserify/browser"),
                        vm: require.resolve("vm-browserify"),
                        stream: require.resolve("stream-browserify"),
                        constants: require.resolve("constants-browserify"),
                        zlib: require.resolve('browserify-zlib'),
                        assert: require.resolve("assert/"),
                        "module": false,
                        "child_process": false,
                        net: false,
                        tls: false,
                        "react-native-fs": false,
                        "react-native-fetch-blob": false
                    }
                }

            });

            self.watcher = compiler.watch(
                {
                    aggregateTimeout: 300
                },
                function (err, stats) {
                    if (err) {
                        thread.console.softError(err);
                    } else {
                        self.lastStats = stats;  // for debugging

                        let statsData = stats.toJson({
                            modules: true
                        });

                        statsData.modules.map(function(mod) {
                            thread.console.debug("Packed: " + mod.name);
                        });

                        if (stats.compilation.errors.length > 0) {
                            stats.compilation.errors.map(function (e2) {
                                thread.console.softError(e2.message + "\n" + e2.details);
                            });
                        } else {
                            thread.console.info("Webpack recompiled");

                        }

                    }
                });

        } else {
            thread.console.softError("Web packer already running");
        }
    };

    self.stop = function() {
        if (!self.compiler) {
            thread.console.info("Web packer not running");
        } else {
            thread.console.info("Stopping web packer");
            self.watcher.watcher.close();


            delete self.compiler;
        }
    };

    return self;

};

module.exports = { class: WebPackHelper };

