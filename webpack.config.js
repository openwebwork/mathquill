/* eslint-env node */

const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const StyleLintPlugin = require('stylelint-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const VERSION = require('./package.json').version;

module.exports = (_env, argv) => {
	process.env.NODE_ENV = argv.mode ?? 'development';

	const config = (entry, basic) => {
		return {
			mode: process.env.NODE_ENV,
			entry,
			output: {
				path: path.resolve(__dirname, 'build'),
				filename: '[name].js'
			},
			resolve: {
				alias: {
					src: path.resolve(__dirname, 'src'),
					tree: path.resolve(__dirname, 'src/tree'),
					services: path.resolve(__dirname, 'src/services'),
					commands: path.resolve(__dirname, 'src/commands'),
					css: path.resolve(__dirname, 'src/css'),
					fonts: path.resolve(__dirname, 'src/fonts')
				},
				extensions: ['', '.webpack.js', '.ts', '.js']
			},
			module: {
				rules: [
					{
						// js
						test: /\.js$/,
						exclude: (file) => {
							// Don't transpile node_modules
							return /node_modules/.test(file);
						},
						use: ['babel-loader']
					},
					{
						// typescript
						test: /\.ts$/,
						loader: 'ts-loader'
					},
					{
						test: /\.css$/,
						use: [ MiniCssExtractPlugin.loader, 'css-loader' ]
					},
					{
						test: /\.less$/i,
						use: [
							MiniCssExtractPlugin.loader,
							'css-loader',
							{
								loader: 'less-loader',
								options: {
									lessOptions: {
										modifyVars: {
											basic: basic,
											'omit-font-face':
												typeof process.env.OMIT_FONT_FACE === 'undefined' ? false : true
										}
									}
								}
							}
						]
					},
					{
						test: /\.(woff2?|ttf|eot|svg)(#\w+)?$/,
						type: 'asset/resource',
						generator: { filename: 'fonts/[name][ext][query]' }
					}
				]
			},
			plugins: [
				new webpack.DefinePlugin({
					VERSION: JSON.stringify(VERSION),
					'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
				}),
				new MiniCssExtractPlugin(),
				new ESLintPlugin({ extensions: ['js', 'ts'] }),
				new StyleLintPlugin({
					extensions: ['html', 'css', 'scss', 'sass', 'less'],
					files: ['**/*.{html,css,scss,sass,less}']
				})
			],
			optimization: {
				minimize: process.env.NODE_ENV == 'production',
				minimizer: [
					new TerserPlugin({
						terserOptions: { format: { comments: /@license/i } },
						extractComments: false
					}),
					new CssMinimizerPlugin()
				]
			},
			performance: {
				assetFilter: (asset) => {
					return !asset.match(/fonts\/(.*\.svg$|.*\.ttf$|.*\.eot$)/);
				}
			}
		};
	};

	const fullConfig = config({ mathquill: './src/index.ts' }, false);
	const basicConfig = config({ 'mathquill-basic': './src/indexBasic.ts' }, true);

	const builds = [fullConfig];

	if (process.env.NODE_ENV == 'development') {
		// eslint-disable-next-line no-console
		console.log('Using development mode.');

		fullConfig.devtool = 'source-map';
		basicConfig.devtool = 'source-map';
		fullConfig.entry['mathquill.test'] = './test/index.js';
		fullConfig.resolve.alias.test = path.resolve(__dirname, 'test');
		fullConfig.devServer = {
			https: false,
			port: 9292,
			static: [
				path.join(__dirname, 'public'),
				{
					directory: path.join(__dirname, 'node_modules/mocha'),
					publicPath: '/mocha'
				}
			]
		};

		builds.push(basicConfig);
	} else {
		// eslint-disable-next-line no-console
		console.log('Using production mode.');

		if (process.env.BUILD_BASIC) builds.push(basicConfig);
	}

	return builds;
};
