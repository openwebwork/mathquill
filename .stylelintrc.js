module.exports = {
	extends: ['stylelint-config-html', 'stylelint-config-standard', 'stylelint-config-prettier'],
	plugins: [],
	ignoreFiles: ['node_modules/**', 'dist/**', 'build/**'],
	rules: {
		'at-rule-no-unknown': null,
		'indentation': 'tab',
		'max-empty-lines': 1,
		'rule-empty-line-before': ['always', {
			except: ['first-nested', 'after-single-line-comment']
		}],
		'no-descending-specificity': null,
		'no-invalid-position-at-import-rule': null
	},
	overrides: [
		{
			files: ['**/*.less'],
			customSyntax: 'postcss-less'
		}
	]
};
