const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const VERSION = require('./package.json').version;

module.exports = (env, argv) => {
	const config = (entry, basic) => {
		return {
			mode: 'production',
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
					VERSION: JSON.stringify(VERSION)
				}),
				new MiniCssExtractPlugin()
			]
		}
	};

	const fullConfig = config({ mathquill: './src/index.js' }, false);
	const basicConfig = config({ 'mathquill-basic': './src/indexBasic.js' }, true);

	if (argv.mode == 'development') {
		console.log('Using development mode.');
		fullConfig.mode = 'development';
		fullConfig.devtool = 'source-map';
		basicConfig.mode = 'development';
		basicConfig.devtool = 'source-map';
		fullConfig.entry['mathquill.test'] = './test/index.js';
		fullConfig.resolve.alias.test = path.resolve(__dirname, 'test');
	} else {
		console.log('Using production mode.');
		// This minimizes the code even in development mode, which is why it is here.
		const minimizer = new TerserPlugin({
			terserOptions: { format: { comments: /@license/i } },
			extractComments: false
		});
		fullConfig.plugins.push(minimizer);
		basicConfig.plugins.push(minimizer);
	}

	return [ fullConfig, basicConfig ];
};
