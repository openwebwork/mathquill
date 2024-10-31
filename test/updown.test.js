/* global suite, test, assert, setup, MQ */

suite('up/down', () => {
	let mq, rootBlock, controller, cursor;
	setup(() => {
		const el = document.createElement('span');
		document.getElementById('mock')?.append(el);
		mq = MQ.MathField(el);
		rootBlock = mq.__controller.root;
		controller = mq.__controller;
		cursor = controller.cursor;
	});

	test('up/down in out of exponent', () => {
		controller.renderLatexMath('x^{nm}');
		const exp = rootBlock.ends.right,
			expBlock = exp.ends.left;
		assert.equal(exp.latex(), '^{nm}', 'right end el is exponent');
		assert.equal(cursor.parent, rootBlock, 'cursor is in root block');
		assert.equal(cursor.left, exp, 'cursor is at the end of root block');

		mq.keystroke('Up');
		assert.equal(cursor.parent, expBlock, 'cursor up goes into exponent');

		mq.keystroke('Down');
		assert.equal(cursor.parent, rootBlock, 'cursor down leaves exponent');
		assert.equal(cursor.left, exp, 'down when cursor at end of exponent puts cursor after exponent');

		mq.keystroke('Up Left Left');
		assert.equal(cursor.parent, expBlock, 'cursor up left stays in exponent');
		assert.equal(cursor.left, undefined, 'cursor is at the beginning of exponent');

		mq.keystroke('Down');
		assert.equal(cursor.parent, rootBlock, 'cursor down leaves exponent');
		assert.equal(cursor.right, exp, 'cursor down in beginning of exponent puts cursor before exponent');

		mq.keystroke('Up Right');
		assert.equal(cursor.parent, expBlock, 'cursor up left stays in exponent');
		assert.equal(cursor.left.latex(), 'n', 'cursor is in the middle of exponent');
		assert.equal(cursor.right.latex(), 'm', 'cursor is in the middle of exponent');

		mq.keystroke('Down');
		assert.equal(cursor.parent, rootBlock, 'cursor down leaves exponent');
		assert.equal(cursor.right, exp, 'cursor down in middle of exponent puts cursor before exponent');
	});

	// literally just swapped up and down, exponent with subscript, nm with 12
	test('up/down in out of subscript', () => {
		controller.renderLatexMath('a_{12}');
		const sub = rootBlock.ends.right,
			subBlock = sub.ends.left;
		assert.equal(sub.latex(), '_{12}', 'right end el is subscript');
		assert.equal(cursor.parent, rootBlock, 'cursor is in root block');
		assert.equal(cursor.left, sub, 'cursor is at the end of root block');

		mq.keystroke('Down');
		assert.equal(cursor.parent, subBlock, 'cursor down goes into subscript');

		mq.keystroke('Up');
		assert.equal(cursor.parent, rootBlock, 'cursor up leaves subscript');
		assert.equal(cursor.left, sub, 'up when cursor at end of subscript puts cursor after subscript');

		mq.keystroke('Down Left Left');
		assert.equal(cursor.parent, subBlock, 'cursor down left stays in subscript');
		assert.equal(cursor.left, undefined, 'cursor is at the beginning of subscript');

		mq.keystroke('Up');
		assert.equal(cursor.parent, rootBlock, 'cursor up leaves subscript');
		assert.equal(cursor.right, sub, 'cursor up in beginning of subscript puts cursor before subscript');

		mq.keystroke('Down Right');
		assert.equal(cursor.parent, subBlock, 'cursor down left stays in subscript');
		assert.equal(cursor.left.latex(), '1', 'cursor is in the middle of subscript');
		assert.equal(cursor.right.latex(), '2', 'cursor is in the middle of subscript');

		mq.keystroke('Up');
		assert.equal(cursor.parent, rootBlock, 'cursor up leaves subscript');
		assert.equal(cursor.right, sub, 'cursor up in middle of subscript puts cursor before subscript');
	});

	test('up/down into and within fraction', () => {
		controller.renderLatexMath('\\frac{12}{34}');
		const frac = rootBlock.ends.left,
			numer = frac.ends.left,
			denom = frac.ends.right;
		assert.equal(frac.latex(), '\\frac{12}{34}', 'fraction is in root block');
		assert.equal(frac, rootBlock.ends.right, 'fraction is sole child of root block');
		assert.equal(numer.latex(), '12', 'numerator is left end child of fraction');
		assert.equal(denom.latex(), '34', 'denominator is right end child of fraction');

		mq.keystroke('Up');
		assert.equal(cursor.parent, numer, 'cursor up goes into numerator');
		assert.equal(cursor.right, undefined, 'cursor up from right of fraction inserts at right end of numerator');

		mq.keystroke('Down');
		assert.equal(cursor.parent, denom, 'cursor down goes into denominator');
		assert.equal(cursor.right, undefined, 'cursor down from numerator inserts at right end of denominator');

		mq.keystroke('Up');
		assert.equal(cursor.parent, numer, 'cursor up goes into numerator');
		assert.equal(cursor.right, undefined, 'cursor up from denominator inserts at right end of numerator');

		mq.keystroke('Left Left Left');
		assert.equal(cursor.parent, rootBlock, 'cursor outside fraction');
		assert.equal(cursor.right, frac, 'cursor before fraction');

		mq.keystroke('Up');
		assert.equal(cursor.parent, numer, 'cursor up goes into numerator');
		assert.equal(cursor.left, undefined, 'cursor up from left of fraction inserts at left end of numerator');

		mq.keystroke('Left');
		assert.equal(cursor.parent, rootBlock, 'cursor outside fraction');
		assert.equal(cursor.right, frac, 'cursor before fraction');

		mq.keystroke('Down');
		assert.equal(cursor.parent, denom, 'cursor down goes into denominator');
		assert.equal(cursor.left, undefined, 'cursor down from left of fraction inserts at left end of denominator');
	});

	test('nested subscripts and fractions', () => {
		controller.renderLatexMath('\\frac{d}{dx_{\\frac{24}{36}0}}\\sqrt{x}=x^{\\frac{1}{2}}');
		const exp = rootBlock.ends.right,
			expBlock = exp.ends.left,
			half = expBlock.ends.left,
			halfDenom = half.ends.right;

		mq.keystroke('Left');
		assert.equal(cursor.parent, expBlock, 'cursor left goes into exponent');

		mq.keystroke('Down');
		assert.equal(cursor.parent, halfDenom, 'cursor down goes into denominator of half');

		mq.keystroke('Down');
		assert.equal(cursor.parent, rootBlock, 'down again puts cursor back in root block');
		assert.equal(cursor.left, exp, 'down from end of half puts cursor after exponent');

		const derivative = rootBlock.ends.left,
			dxBlock = derivative.ends.right,
			sub = dxBlock.ends.right,
			subBlock = sub.ends.left,
			subFrac = subBlock.ends.left,
			subFracNumer = subFrac.ends.left,
			subFracDenom = subFrac.ends.right;

		cursor.insAtLeftEnd(rootBlock);
		mq.keystroke('Down Right Right Down');
		assert.equal(cursor.parent, subBlock, 'cursor in subscript');

		mq.keystroke('Up');
		assert.equal(
			cursor.parent,
			subFracNumer,
			'cursor up from beginning of subscript goes into subscript fraction numerator'
		);

		mq.keystroke('Up');
		assert.equal(cursor.parent, dxBlock, 'cursor up from subscript fraction numerator goes out of subscript');
		assert.equal(cursor.right, sub, 'cursor up from subscript fraction numerator goes before subscript');

		mq.keystroke('Down Down');
		assert.equal(cursor.parent, subFracDenom, 'cursor in subscript fraction denominator');

		mq.keystroke('Up Up');
		assert.equal(
			cursor.parent,
			dxBlock,
			"cursor up up from subscript fraction denominator that's not at right end goes out of subscript"
		);
		assert.equal(
			cursor.right,
			sub,
			"cursor up up from subscript fraction denominator that's not at right end goes before subscript"
		);

		cursor.insAtRightEnd(subBlock);
		controller.backspace();
		assert.equal(subFrac.right, undefined, 'subscript fraction is at right end');
		assert.equal(cursor.left, subFrac, 'cursor after subscript fraction');

		mq.keystroke('Down');
		assert.equal(cursor.parent, subFracDenom, 'cursor in subscript fraction denominator');

		mq.keystroke('Up Up');
		assert.equal(
			cursor.parent,
			dxBlock,
			'cursor up up from subscript fraction denominator that is at right end goes out of subscript'
		);
		assert.equal(
			cursor.left,
			sub,
			'cursor up up from subscript fraction denominator that is at right end goes after subscript'
		);
	});

	test('\\MathQuillMathField{} in a fraction', () => {
		const el = document.createElement('span');
		el.textContent = '\\frac{\\MathQuillMathField{n}}{2}';
		document.getElementById('mock')?.append(el);

		const outer = MQ.StaticMath(el);
		const inner = MQ(outer.el().querySelector('.mq-editable-field'));

		assert.equal(inner.__controller.cursor.parent, inner.__controller.root);
		inner.keystroke('Down');
		assert.equal(inner.__controller.cursor.parent, inner.__controller.root);
	});
});
