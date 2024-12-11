import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import stylistic from '@stylistic/eslint-plugin';
import mochaPlugin from 'eslint-plugin-mocha';

export default [
	{
		ignores: ['**/dist/**', '.babelrc', 'package.json', 'package-lock.json']
	},
	{ files: ['**/*.{js,mjs,cjs,ts,tsx}'] },
	pluginJs.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'module',
			globals: { ...globals.node, ...globals.browser },
			parserOptions: {
				parser: tseslint.parser,
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			}
		}
	},
	{ files: ['**/*.mjs'], ...tseslint.configs.disableTypeChecked },
	{
		files: ['**/*.{js,cjs}'],
		languageOptions: { parserOptions: { project: false, program: null, projectService: false } },
		rules: { ...tseslint.configs.disableTypeChecked.rules, '@typescript-eslint/no-require-imports': 'off' }
	},
	{ files: ['**/test/*.test.js'], ...mochaPlugin.configs.flat.recommended },
	eslintConfigPrettier,
	{
		plugins: { '@stylistic': stylistic },
		rules: {
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

			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
			'@typescript-eslint/prefer-nullish-coalescing': 'off',

			'mocha/no-setup-in-describe': 'off',

			// Allow console and debugger during development only.
			'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
			'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
		}
	}
];
