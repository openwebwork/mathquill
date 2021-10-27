const { resolve } = require('path');

const baseRules = {
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
	'space-infix-ops': ['error'],

	// allow console and debugger during development only
	'no-console': process.env.NODE_ENV === 'development' ? 'off' : 'error',
	'no-debugger': process.env.NODE_ENV === 'development' ? 'off' : 'error'
};

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

	rules: baseRules,

	overrides: [{
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

		plugins: [ '@typescript-eslint' ],

		rules: {
			...baseRules,

			// TypeScript
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_ignore_' }],

			// TODO: These are disabled for now during the js to ts conversion process.
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off'
		}

	}]
}
