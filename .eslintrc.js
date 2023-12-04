/* eslint-env node */

const { resolve } = require('path');

const baseRules = {
	'prefer-promise-reject-errors': 'off',

	// General syntax
	'@stylistic/arrow-parens': 'off',
	'@stylistic/arrow-spacing': ['error'],
	'@stylistic/comma-spacing': ['error', { before: false, after: true }],
	'@stylistic/generator-star-spacing': 'off',
	'@stylistic/keyword-spacing': ['error'],
	'@stylistic/max-len': ['error', { ignoreUrls: true, ignoreStrings: true, code: 120 }],
	'@stylistic/multiline-ternary': 'off',
	'@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 1 }],
	'@stylistic/no-tabs': ['error', { allowIndentationTabs: true }],
	'@stylistic/no-trailing-spaces': ['error'],
	'@stylistic/object-curly-spacing': ['error', 'always'],
	'@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],
	'@stylistic/semi': ['error', 'always'],
	'@stylistic/space-before-blocks': ['error', 'always'],
	'@stylistic/space-in-parens': ['error', 'never'],
	'@stylistic/space-infix-ops': ['error'],
	'no-void': 'off',
	'one-var': 'off',

	// allow console and debugger during development only
	'no-console': process.env.NODE_ENV === 'development' ? 'off' : 'error',
	'no-debugger': process.env.NODE_ENV === 'development' ? 'off' : 'error'
};

module.exports = {
	root: true,

	parserOptions: {
		ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
		sourceType: 'module' // Allows for the use of imports
	},

	env: {
		browser: true,
		es6: true
	},

	extends: ['eslint:recommended', 'prettier'],

	plugins: ['@stylistic'],

	globals: {
		__statics: 'readonly',
		process: 'readonly',
		VERSION: 'readonly'
	},

	rules: baseRules,

	overrides: [
		{
			files: ['*.ts', '*.tsx'],

			parserOptions: {
				parser: '@typescript-eslint/parser',
				project: resolve(__dirname, './tsconfig.json'),
				tsconfigRootDir: __dirname,
				ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
				sourceType: 'module' // Allows for the use of imports
			},

			// Rules order is important, please avoid shuffling them
			extends: [
				'eslint:recommended',
				'plugin:@typescript-eslint/recommended',
				// consider disabling this class of rules if linting takes too long
				'plugin:@typescript-eslint/recommended-requiring-type-checking',
				'prettier'
			],

			plugins: ['@typescript-eslint', '@stylistic'],

			rules: {
				...baseRules,

				// TypeScript
				'@typescript-eslint/explicit-function-return-type': 'off',
				'@typescript-eslint/explicit-module-boundary-types': 'off',
				'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_ignore_' }],
				'@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }]
			}
		}
	]
};
