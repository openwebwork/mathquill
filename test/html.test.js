/* global suite, test, assert */

import { MathCommand } from 'commands/mathElements';

suite('HTML', () => {
	const renderHtml = (numBlocks, htmlTemplate) => {
		const cmd = {
			id: 1,
			blocks: Array(numBlocks),
			htmlTemplate: htmlTemplate
		};
		for (let i = 0; i < numBlocks; ++i) {
			cmd.blocks[i] = {
				i: i,
				id: 2 + i,
				join: function() { return `Block:${this.i}`; }
			};
		}
		return MathCommand.prototype.html.call(cmd);
	};

	test('simple HTML templates', () => {
		let htmlTemplate = '<span>A Symbol</span>';
		let html = '<span mathquill-command-id=1>A Symbol</span>';

		assert.equal(html, renderHtml(0, htmlTemplate), 'a symbol');

		htmlTemplate = '<span>&0</span>';
		html = '<span mathquill-command-id=1 mathquill-block-id=2>Block:0</span>';

		assert.equal(html, renderHtml(1, htmlTemplate), 'same span is cmd and block');

		htmlTemplate =
			'<span>'
			+   '<span>&0</span>'
			+   '<span>&1</span>'
			+ '</span>';
		html =
			'<span mathquill-command-id=1>'
			+   '<span mathquill-block-id=2>Block:0</span>'
			+   '<span mathquill-block-id=3>Block:1</span>'
			+ '</span>';

		assert.equal(html, renderHtml(2, htmlTemplate), 'container span with two block spans');
	});

	test('context-free HTML templates', () => {
		let htmlTemplate = '<br/>';
		let html = '<br mathquill-command-id=1/>';

		assert.equal(html, renderHtml(0, htmlTemplate), 'self-closing tag');

		htmlTemplate =
			'<span>'
			+   '<span>&0</span>'
			+ '</span>'
			+ '<span>'
			+   '<span>&1</span>'
			+ '</span>';
		html =
			'<span mathquill-command-id=1>'
			+   '<span mathquill-block-id=2>Block:0</span>'
			+ '</span>'
			+ '<span mathquill-command-id=1>'
			+   '<span mathquill-block-id=3>Block:1</span>'
			+ '</span>';

		assert.equal(html, renderHtml(2, htmlTemplate), 'two cmd spans');

		htmlTemplate =
			'<span></span>'
			+ '<span/>'
			+ '<span>'
			+   '<span>'
			+     '<span/>'
			+   '</span>'
			+   '<span>&1</span>'
			+   '<span/>'
			+   '<span></span>'
			+ '</span>'
			+ '<span>&0</span>';
		html =
			'<span mathquill-command-id=1></span>'
			+ '<span mathquill-command-id=1/>'
			+ '<span mathquill-command-id=1>'
			+   '<span>'
			+     '<span/>'
			+   '</span>'
			+   '<span mathquill-block-id=3>Block:1</span>'
			+   '<span/>'
			+   '<span></span>'
			+ '</span>'
			+ '<span mathquill-command-id=1 mathquill-block-id=2>Block:0</span>';

		assert.equal(html, renderHtml(2, htmlTemplate), 'multiple nested cmd and block spans');
	});
});
