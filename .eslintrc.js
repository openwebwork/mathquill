const { resolve } = require('path');

module.exports = {
	root: true,

	parser: '@babel/eslint-parser',

	parserOptions: {
		ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
		sourceType: 'module', // Allows for the use of imports
		babelOptions: {
			configFile: resolve(__dirname, './.babelrc')
		}
	},

	env: {
		browser: true
	},

	extends: [
		'eslint:recommended',
		'prettier'
	],

	globals: {
		__statics: 'readonly',
		process: 'readonly',
		VERSION: 'readonly'
	},

	rules: {
		'prefer-promise-reject-errors': 'off',

		// General syntax
		'quotes': ['warn', 'single', { avoidEscape: true }],
		'no-tabs': ['error', { allowIndentationTabs: true }],
		'indent': ['error', 'tab'],
		'max-len': ['error', { ignoreUrls: true, code: 120 }],
		'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 1 }],
		'no-trailing-spaces': ['error'],
		'space-in-parens': ['error', 'never'],
		'object-curly-spacing': ['error', 'always'],
		'comma-spacing': ['error', { before: false, after: true }],
		'semi': ['error', 'always'],
		'generator-star-spacing': 'off',
		'arrow-parens': 'off',
		'one-var': 'off',
		'no-void': 'off',
		'multiline-ternary': 'off',

		// allow console and debugger during development only
		'no-console': process.env.NODE_ENV === 'development' ? 'off' : 'error',
		'no-debugger': process.env.NODE_ENV === 'development' ? 'off' : 'error'
	}
}
