/* eslint-env node */

module.exports = {
	extends: ['stylelint-config-html', 'stylelint-config-standard'],
	plugins: [],
	ignoreFiles: ['node_modules/**', 'dist/**', 'build/**'],
	rules: {
		'at-rule-no-unknown': null,
		'rule-empty-line-before': [
			'always',
			{
				except: ['first-nested', 'after-single-line-comment']
			}
		],
		'no-descending-specificity': null,
		'no-invalid-position-at-import-rule': null,
		'import-notation': 'string',
		'declaration-property-value-no-unknown': null
	},
	overrides: [
		{
			files: ['**/*.less'],
			customSyntax: 'postcss-less'
		}
	]
};
