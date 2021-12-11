/* global suite, test, assert, MQ */

import { jQuery } from 'src/constants';

suite('CSS', () => {
	test('math field doesn\'t fuck up ancestor\'s .scrollWidth', () => {
		const container = jQuery('<div>').css({
			fontSize: '16px',
			height: '25px', // must be greater than font-size * 115% + 2 * 2px (padding) + 2 * 1px (border)
			width: '25px'
		}).appendTo('#mock')[0];
		assert.equal(container.scrollHeight, 25);
		assert.equal(container.scrollWidth, 25);

		MQ.MathField(jQuery('<span style="box-sizing:border-box;height:100%;width:100%"></span>')
			.appendTo(container)[0]);
		assert.equal(container.scrollHeight, 25);
		assert.equal(container.scrollWidth, 25);
	});

	test('empty root block does not collapse', () => {
		const testEl = jQuery('<span></span>').appendTo('#mock');
		MQ.MathField(testEl[0]);
		const rootEl = testEl.find('.mq-root-block');

		assert.ok(rootEl.hasClass('mq-empty'), 'Empty root block should have the mq-empty class name.');
		assert.ok(rootEl.height() > 0, 'Empty root block height should be above 0.');
	});

	test('empty block does not collapse', () => {
		const testEl = jQuery('<span>\\frac{}{}</span>').appendTo('#mock');
		MQ.MathField(testEl[0]);
		const numeratorEl = testEl.find('.mq-numerator');

		assert.ok(numeratorEl.hasClass('mq-empty'), 'Empty numerator should have the mq-empty class name.');
		assert.ok(numeratorEl.height() > 0, 'Empty numerator height should be above 0.');
	});

	test('test florin spacing', () => {
		let mq;
		const mock = jQuery('#mock');

		mq = MQ.MathField(jQuery('<span></span>').appendTo(mock)[0]);
		mq.typedText("f'");

		const mqF = jQuery(mq.el()).find('.mq-f');
		const testVal = parseFloat(mqF.css('margin-right')) - parseFloat(mqF.css('margin-left'));
		assert.ok(testVal > 0, 'this should be truthy') ;
	});

	test('unary PlusMinus before separator', () => {
		const mq = MQ.MathField(jQuery('<span></span>').appendTo('#mock')[0]);
		mq.latex('(-1,-1-1)-1,(+1;+1+1)+1,(\\pm1,\\pm1\\pm1)\\pm1');
		const spans = jQuery(mq.el()).find('.mq-root-block').find('span');
		assert.equal(spans.length, 35, 'PlusMinus expression parsed incorrectly');

		const isBinaryOperator = (i) => jQuery(spans[i]).hasClass('mq-binary-operator');
		const assertBinaryOperator = (i, s) => assert.ok(isBinaryOperator(i), '"' + s + '" should be binary');
		const assertUnaryOperator = (i, s) => assert.ok(!isBinaryOperator(i), '"' + s + '" should be unary');

		assertUnaryOperator(1, '(-');
		assertUnaryOperator(4, '(-1,-');
		assertBinaryOperator(6, '(-1,-1-');
		assertBinaryOperator(9, '(-1,-1-1)-');
		assertUnaryOperator(13, '(-1,-1-1)-1,(+');
		assertUnaryOperator(16, '(-1,-1-1)-1,(+1;+');
		assertBinaryOperator(18, '(-1,-1-1)-1,(+1;+1+');
		assertBinaryOperator(21, '(-1,-1-1)-1,(+1;+1+1)+');
		assertUnaryOperator(25, '(-1,-1-1)-1,(+1;+1+1)+1,(\\pm');
		assertUnaryOperator(28, '(-1,-1-1)-1,(+1;+1+1)+1,(\\pm1,\\pm');
		assertBinaryOperator(30, '(-1,-1-1)-1,(+1;+1+1)+1,(\\pm1,\\pm1\\pm');
		assertBinaryOperator(33, '(-1,-1-1)-1,(+1;+1+1)+1,(\\pm1,\\pm1\\pm1)\\pm');
	});

	test('proper unary/binary within style block', () => {
		const mq = MQ.MathField(jQuery('<span></span>').appendTo('#mock')[0]);
		mq.latex('\\class{dummy}{-}2\\class{dummy}{+}4');
		let spans = jQuery(mq.el()).find('.mq-root-block').find('span');
		assert.equal(spans.length, 6, 'PlusMinus expression parsed incorrectly');

		const isBinaryOperator = (i) => jQuery(spans[i]).hasClass('mq-binary-operator');
		const assertBinaryOperator = (i, s) => assert.ok(isBinaryOperator(i), '"' + s + '" should be binary');
		const assertUnaryOperator = (i, s) => assert.ok(!isBinaryOperator(i), '"' + s + '" should be unary');

		assertUnaryOperator(1, '\\class{dummy}{-}');
		assertBinaryOperator(4, '\\class{dummy}{-}2\\class{dummy}{+}');

		mq.latex('\\textcolor{red}{-}2\\textcolor{green}{+}4');
		spans = jQuery(mq.el()).find('.mq-root-block').find('span');
		assert.equal(spans.length, 6, 'PlusMinus expression parsed incorrectly');

		assertUnaryOperator(1, '\\textcolor{red}{-}');
		assertBinaryOperator(4, '\\textcolor{red}{-}2\\textcolor{green}{+}');

		//test recursive depths
		mq.latex('\\textcolor{red}{\\class{dummy}{-}}2\\textcolor{green}{\\class{dummy}{+}}4');
		spans = jQuery(mq.el()).find('.mq-root-block').find('span');
		assert.equal(spans.length, 8, 'PlusMinus expression parsed incorrectly');

		assertUnaryOperator(2, '\\textcolor{red}{\\class{dummy}{-}}');
		assertBinaryOperator(6, '\\textcolor{red}{\\class{dummy}{-}}2\\textcolor{green}{\\class{dummy}{+}}');
	});

	test('operator name spacing e.g. sin x', () => {
		const mock = jQuery('#mock');
		const mq = MQ.MathField(jQuery('<span></span>').appendTo(mock)[0]);

		mq.typedText('sin');
		const n = jQuery('#mock var.mq-operator-name:last');
		assert.equal(n.text(), 'n');
		assert.ok(!n.is('.mq-last'));

		mq.typedText('x');
		assert.ok(n.is('.mq-last'));

		mq.keystroke('Left').typedText('(');
		assert.ok(!n.is('.mq-last'));

		mq.keystroke('Backspace').typedText('^');
		assert.ok(!n.is('.mq-last'));
		const supsub = jQuery('#mock .mq-supsub');
		assert.ok(supsub.is('.mq-after-operator-name'));

		mq.typedText('2').keystroke('Tab').typedText('(');
		assert.ok(!supsub.is('.mq-after-operator-name'));

		jQuery(mq.el()).empty();
	});
});
