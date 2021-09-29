const path = require("path");
const webpack = require('webpack');
const fs = require('fs');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
	let config = {
		mode: "production",
		entry: { mathquill: './src/index.js' },
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: '[name].js'
		},
		module: {
			rules: [
				{
					// js
					test: /\.m?js$/,
					exclude: (file) => {
						// Don't transpile node_modules
						return /node_modules/.test(file)
					},
					use: ['babel-loader']
				},
				{
					test: /\.css$/,
					use: ["style-loader", "css-loader"]
				}
			]
		},
		//performance: {
		//	hints: false
		//},
		plugins: [
		//	new CopyPlugin({
		//		patterns: [
		//			{ from: "./css/fonts.css", to: path.resolve(__dirname, 'dist') },
		//		]
		//	}),
		//	new webpack.ProvidePlugin({
		//		process: 'process/browser'
		//	})
		]
	};

	if (argv.mode == "development") {
		console.log("Using development mode.");
		config.mode = "development";
		config.devtool = "source-map";
	} else {
		console.log("Using production mode.");
		// This prevents the LICENSE file from being generated.  It also minimizes the code even in development mode,
		// which is why it is here.
		config.plugins.push(new TerserPlugin({
			terserOptions: { format: { comments: false } },
			extractComments: false
		}));
	}

	return config;
};
