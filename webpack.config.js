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

	const config = {
		mode: process.env.NODE_ENV,
		entry: { mathquill: './src/index.ts' },
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: '[name].js',
			clean: true
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
			extensions: ['', '.ts', '.js']
		},
		module: {
			rules: [
				{
					// typescript
					test: /\.ts$/,
					loader: 'ts-loader'
				},
				{
					test: /\.css$/,
					use: [MiniCssExtractPlugin.loader, 'css-loader']
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
			new ESLintPlugin({
				configType: 'flat',
				extensions: ['js', 'ts'],
				emitError: process.env.NODE_ENV === 'production'
			}),
			new StyleLintPlugin({
				emitError: process.env.NODE_ENV === 'production',
				extensions: ['html', 'css', 'scss', 'sass', 'less'],
				files: ['**/*.{html,css,scss,sass,less}']
			})
		],
		optimization: {
			minimize: process.env.NODE_ENV === 'production',
			minimizer: [new TerserPlugin({ extractComments: false }), new CssMinimizerPlugin()]
		},
		performance: {
			assetFilter: (asset) => {
				return !asset.match(/fonts\/(.*\.svg$|.*\.ttf$|.*\.eot$)/);
			}
		}
	};

	if (process.env.NODE_ENV === 'development') {
		// eslint-disable-next-line no-console
		console.log('Using development mode.');

		config.devtool = 'source-map';
		config.entry['mathquill.test'] = './test/index.js';
		config.resolve.alias.test = path.resolve(__dirname, 'test');
		config.devServer = {
			server: { type: 'http' },
			port: 9292,
			static: [
				path.join(__dirname, 'public'),
				{
					directory: path.join(__dirname, 'node_modules/mocha'),
					publicPath: '/mocha'
				}
			],
			watchFiles: ['public/**/*']
		};
	} else {
		// eslint-disable-next-line no-console
		console.log('Using production mode.');
	}

	return config;
};
