import MathQuill from 'src/publicapi';
import { mqCmdId, mqBlockId } from 'src/constants';
import { MathCommand } from 'commands/mathElements';
import { assert } from 'test/support/assert';

suite('HTML', function () {
	const MQ = MathQuill.getInterface();

	setup(function () {
		const field = document.createElement('span');
		document.getElementById('mock')?.append(field);
		MQ.MathField(field, {});
	});

	const renderHtml = (numBlocks: number, htmlTemplate: string) => {
		const cmd = {
			id: 1,
			blocks: Array(numBlocks),
			htmlTemplate: htmlTemplate
		};
		for (let i = 0; i < numBlocks; ++i) {
			cmd.blocks[i] = {
				i,
				id: 2 + i,
				join: () => `Block:${i.toString()}`
			};
		}
		return MathCommand.prototype.html.call(cmd);
	};

	test('simple HTML templates', function () {
		let htmlTemplate = '<span>A Symbol</span>';
		let html = `<span ${mqCmdId}=1>A Symbol</span>`;

		assert.equal(html, renderHtml(0, htmlTemplate), 'a symbol');

		htmlTemplate = '<span>&0</span>';
		html = `<span ${mqCmdId}=1 ${mqBlockId}=2>Block:0</span>`;

		assert.equal(html, renderHtml(1, htmlTemplate), 'same span is cmd and block');

		htmlTemplate = '<span>' + '<span>&0</span>' + '<span>&1</span>' + '</span>';
		html =
			`<span ${mqCmdId}=1>` +
			`<span ${mqBlockId}=2>Block:0</span>` +
			`<span ${mqBlockId}=3>Block:1</span>` +
			'</span>';

		assert.equal(html, renderHtml(2, htmlTemplate), 'container span with two block spans');
	});

	test('context-free HTML templates', function () {
		let htmlTemplate = '<br/>';
		let html = `<br ${mqCmdId}=1/>`;

		assert.equal(html, renderHtml(0, htmlTemplate), 'self-closing tag');

		htmlTemplate = '<span>' + '<span>&0</span>' + '</span>' + '<span>' + '<span>&1</span>' + '</span>';
		html =
			`<span ${mqCmdId}=1>` +
			`<span ${mqBlockId}=2>Block:0</span>` +
			'</span>' +
			`<span ${mqCmdId}=1>` +
			`<span ${mqBlockId}=3>Block:1</span>` +
			'</span>';

		assert.equal(html, renderHtml(2, htmlTemplate), 'two cmd spans');

		htmlTemplate =
			'<span></span>' +
			'<span/>' +
			'<span>' +
			'<span>' +
			'<span/>' +
			'</span>' +
			'<span>&1</span>' +
			'<span/>' +
			'<span></span>' +
			'</span>' +
			'<span>&0</span>';
		html =
			`<span ${mqCmdId}=1></span>` +
			`<span ${mqCmdId}=1/>` +
			`<span ${mqCmdId}=1>` +
			'<span>' +
			'<span/>' +
			'</span>' +
			`<span ${mqBlockId}=3>Block:1</span>` +
			'<span/>' +
			'<span></span>' +
			'</span>' +
			`<span ${mqCmdId}=1 ${mqBlockId}=2>Block:0</span>`;

		assert.equal(html, renderHtml(2, htmlTemplate), 'multiple nested cmd and block spans');
	});
});
