const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const StyleLintPlugin = require('stylelint-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const VERSION = require('./package.json').version;

module.exports = (env, argv) => {
	process.env.NODE_ENV = argv.mode;

	const config = (entry, basic) => {
		return {
			mode: argv.mode,
			entry,
			output: {
				path: path.resolve(__dirname, 'dist'),
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
				}
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
											'omit-font-face': process.env.OMIT_FONT_FACE ?? false
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
				new ESLintPlugin(),
				new StyleLintPlugin({
					extensions: ['html', 'css', 'scss', 'sass', 'less'],
					files: ['**/*.{html,css,scss,sass,less}']
				})
			],
			performance: {
				assetFilter: (asset) => {
					return !asset.match(/fonts\/(.*\.svg$|.*\.ttf$|.*\.eot$)/);
				}
			}
		}
	};

	const fullConfig = config({ mathquill: './src/index.js' }, false);
	const basicConfig = config({ 'mathquill-basic': './src/indexBasic.js' }, true);

	const builds = [fullConfig];

	if (argv.mode == 'development') {
		console.log('Using development mode.');
		fullConfig.devtool = 'source-map';
		basicConfig.devtool = 'source-map';
		fullConfig.entry['mathquill.test'] = './test/index.js';
		fullConfig.resolve.alias.test = path.resolve(__dirname, 'test');

		builds.push(basicConfig);
	} else {
		console.log('Using production mode.');
		// Minimize the production build.
		const jsMinimizer = new TerserPlugin({
			terserOptions: { format: { comments: /@license/i } },
			extractComments: false
		});
		const cssMinimizer = { minimizer: [new CssMinimizerPlugin()] };
		fullConfig.plugins.push(jsMinimizer);
		basicConfig.plugins.push(jsMinimizer);
		fullConfig.optimization = cssMinimizer;
		basicConfig.optimization = cssMinimizer;

		if (process.env.BUILD_BASIC) builds.push(basicConfig);
	}

	return builds;
};
