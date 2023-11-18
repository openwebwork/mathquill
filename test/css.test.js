/* global suite, test, assert, MQ */

suite('CSS', () => {
	test("math field doesn't affect ancestor's .scrollWidth", () => {
		const container = document.createElement('div');
		container.style.fontSize = '16px';
		container.style.height = '25px'; // must be greater than font-size * 115% + 2 * 2px (padding) + 2 * 1px (border)
		container.style.width = '25px';
		document.getElementById('mock')?.append(container);

		assert.equal(container.scrollHeight, 25);
		assert.equal(container.scrollWidth, 25);

		const span = document.createElement('span');
		span.style.boxSizing = 'border-box';
		span.style.height = '100%';
		span.style.width = '100%';
		container.append(span);

		assert.equal(container.scrollHeight, 25);
		assert.equal(container.scrollWidth, 25);
	});

	const getHeight = (el) => {
		const computedStyle = getComputedStyle(el);
		return (
			el.clientHeight - parseFloat(computedStyle.paddingTop ?? 0) - parseFloat(computedStyle.paddingBottom ?? 0) >
			0
		);
	};

	test('empty root block does not collapse', () => {
		const testEl = document.createElement('span');
		document.getElementById('mock')?.append(testEl);

		MQ.MathField(testEl);
		const rootEl = testEl.querySelector('.mq-root-block');

		assert.ok(rootEl.classList.contains('mq-empty'), 'Empty root block should have the mq-empty class name.');
		assert.ok(getHeight(rootEl) > 0, 'Empty root block height should be above 0.');
	});

	test('empty block does not collapse', () => {
		const testEl = document.createElement('span');
		testEl.textContent = '\\frac{}{}';
		document.getElementById('mock')?.append(testEl);
		MQ.MathField(testEl);
		const numeratorEl = testEl.querySelector('.mq-numerator');

		assert.ok(numeratorEl.classList.contains('mq-empty'), 'Empty numerator should have the mq-empty class name.');
		assert.ok(getHeight(numeratorEl) > 0, 'Empty numerator height should be above 0.');
	});

	test('test florin spacing', () => {
		const span = document.createElement('span');
		document.getElementById('mock')?.append(span);

		const mq = MQ.MathField(span);
		mq.typedText("f'");

		const mqF = mq.el().querySelector('.mq-f');
		const computedStyle = getComputedStyle(mqF);
		assert.ok(
			parseFloat(computedStyle.marginRight ?? 0) > parseFloat(computedStyle.marginLeft ?? 0),
			'florin right margin should be greater than left margin'
		);
	});

	test('unary PlusMinus before separator', () => {
		const span = document.createElement('span');
		document.getElementById('mock')?.append(span);
		const mq = MQ.MathField(span);

		mq.latex('(-1,-1-1)-1,(+1;+1+1)+1,(\\pm1,\\pm1\\pm1)\\pm1');
		const spans = mq.el().querySelectorAll('.mq-root-block span');
		assert.equal(spans.length, 35, 'PlusMinus expression parsed incorrectly');

		const isBinaryOperator = (i) => spans[i].classList.contains('mq-binary-operator');
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
		const span = document.createElement('span');
		document.getElementById('mock')?.append(span);
		const mq = MQ.MathField(span);

		mq.latex('\\class{dummy}{-}2\\class{dummy}{+}4');
		let spans = mq.el().querySelectorAll('.mq-root-block span');
		assert.equal(spans.length, 6, 'PlusMinus expression parsed incorrectly');

		const isBinaryOperator = (i) => spans[i].classList.contains('mq-binary-operator');
		const assertBinaryOperator = (i, s) => assert.ok(isBinaryOperator(i), '"' + s + '" should be binary');
		const assertUnaryOperator = (i, s) => assert.ok(!isBinaryOperator(i), '"' + s + '" should be unary');

		assertUnaryOperator(1, '\\class{dummy}{-}');
		assertBinaryOperator(4, '\\class{dummy}{-}2\\class{dummy}{+}');

		mq.latex('\\textcolor{red}{-}2\\textcolor{green}{+}4');
		spans = mq.el().querySelectorAll('.mq-root-block span');
		assert.equal(spans.length, 6, 'PlusMinus expression parsed incorrectly');

		assertUnaryOperator(1, '\\textcolor{red}{-}');
		assertBinaryOperator(4, '\\textcolor{red}{-}2\\textcolor{green}{+}');

		//test recursive depths
		mq.latex('\\textcolor{red}{\\class{dummy}{-}}2\\textcolor{green}{\\class{dummy}{+}}4');
		spans = mq.el().querySelectorAll('.mq-root-block span');
		assert.equal(spans.length, 8, 'PlusMinus expression parsed incorrectly');

		assertUnaryOperator(2, '\\textcolor{red}{\\class{dummy}{-}}');
		assertBinaryOperator(6, '\\textcolor{red}{\\class{dummy}{-}}2\\textcolor{green}{\\class{dummy}{+}}');
	});

	test('operator name spacing, e.g., ker x', () => {
		const span = document.createElement('span');
		document.getElementById('mock')?.append(span);
		const mq = MQ.MathField(span);

		mq.typedText('ker');
		const operatorNameParts = mq.el().querySelectorAll('var.mq-operator-name');
		const n = operatorNameParts[operatorNameParts.length - 1];
		assert.equal(n.textContent, 'r');
		assert.ok(!n.classList.contains('mq-last'));

		mq.typedText('x');
		assert.ok(n.classList.contains('mq-last'));

		mq.keystroke('Left').typedText('(');
		assert.ok(!n.classList.contains('mq-last'));

		mq.keystroke('Backspace').typedText('^');
		assert.ok(!n.classList.contains('mq-last'));

		const supsub = mq.el().querySelector('.mq-supsub');
		assert.ok(supsub.classList.contains('mq-after-operator-name'));

		mq.typedText('2').keystroke('Tab').typedText('(');
		assert.ok(!supsub.classList.contains('mq-after-operator-name'));

		mq.keystroke('Delete Left Left Left Backspace');
		assert.ok(!supsub.classList.contains('mq-after-operator-name'));

		const mqEl = mq.el();
		while (mqEl.firstChild) mqEl.firstChild.remove();
	});
});
