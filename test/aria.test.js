/* global assert, MQ */

suite('aria', function () {
	let mq;
	let container;
	setup(function () {
		container = document.createElement('span');
		document.getElementById('mock')?.append(container);
		mq = MQ.MathField(container);
	});

	const assertAriaEqual = (alertText) => {
		assert.equal(alertText, mq.__controller.aria.msg);
	};

	test('mathfield has aria-hidden on mq-root-block', function () {
		mq.latex('1+\\frac{1}{x}');
		// There will be two hidden children: the raw text of the field, and its mathspeak representation.  The internal
		// aria-labelledby attribute of the focusable text will still cause the mathspeak to be read aloud, while the
		// visual math remains viewable.
		const ariaHiddenChildren = container.querySelectorAll('[aria-hidden="true"]');
		assert.equal(ariaHiddenChildren.length, 2, '2 aria-hidden elements');
		assert.ok(ariaHiddenChildren[1].classList.contains('mq-root-block'), 'aria-hidden is set on mq-root-block');
	});

	test('static math aria-hidden', function () {
		const staticMath = MQ.StaticMath(container);
		staticMath.latex('1+\\frac{1}{x}');
		const ariaHiddenChildren = container.querySelectorAll('[aria-hidden="true"]');
		assert.equal(ariaHiddenChildren.length, 2, '2 aria-hidden elements');
		assert.ok(ariaHiddenChildren[1].classList.contains('mq-root-block'), 'aria-hidden is set on mq-root-block');
	});

	test('Tabbable static math aria-hidden', function () {
		const staticMath = MQ.StaticMath(container, { tabbable: true });
		staticMath.latex('1+\\frac{1}{x}');
		const ariaHiddenChildren = container.querySelectorAll('[aria-hidden="true"]');
		// There will be two hidden children: the raw text of the field, and its mathspeak representation.  The internal
		// aria-labelledby attribute of the focusable text will still cause the mathspeak to be read aloud, while the
		// visual math remains viewable.
		assert.equal(ariaHiddenChildren.length, 2, '2 aria-hidden elements');
		assert.ok(ariaHiddenChildren[1].classList.contains('mq-root-block'), 'aria-hidden is set on mq-root-block');
		const mathspeak = document.querySelectorAll('.mq-mathspeak');
		assert.equal(mathspeak.length, 1, 'One mathspeak region');
		assert.ok(mathspeak[0].id, 'mathspeak element assigned an id');
		const textarea = document.querySelectorAll('textarea');
		assert.equal(textarea.length, 1, 'One textarea');
		assert.equal(
			textarea[0].getAttribute('aria-labelledby'),
			mathspeak[0].id,
			'textarea is aria-labelledby mathspeak region'
		);
	});

	test('MathQuillMathField aria-hidden', function () {
		const staticMath = MQ.StaticMath(container);
		staticMath.latex('1+\\sqrt{\\MathQuillMathField{x^2+y^2}}+\\frac{1}{x}');
		assert.equal(container.querySelectorAll('textarea').length, 2, 'Two text area for inner editable field');
		assert.equal(
			document.querySelectorAll('textarea[tabindex="-1"]').length,
			1,
			'The static math textarea is not tabbable.'
		);
		const textArea = container.querySelector('textarea');
		assert.ok(textArea.closest('[aria-hidden="true"]'), 'Textarea has an aria-hidden parent');
		const mathSpeak = container.querySelectorAll('.mq-mathspeak');
		assert.equal(mathSpeak.length, 2, 'Two mathspeak regions');
		assert.ok(mathSpeak[1].closest('[aria-hidden="true"]'), 'Mathspeak has an aria-hidden parent');
		let nHiddenTexts = 0;
		for (const elt of container.querySelectorAll('*')) {
			if (
				elt.textContent === '' ||
				elt.classList.contains('mq-mathspeak') ||
				elt.closest('.mq-textarea') ||
				(elt.classList.contains('mq-root-block') && elt.parentElement === container)
			)
				continue;

			if (elt.getAttribute('aria-hidden') === 'true' || elt.closest('[aria-hidden="true"]')) {
				nHiddenTexts += 1;
				continue;
			}

			assert.ok(
				false,
				'All children with text content are aria-hidden, have an aria-hidden parent, or are part of mathspeak'
			);
		}
		assert.ok(nHiddenTexts > 0, 'At least one element with text content is aria-hidden');
	});

	test('typing and backspacing over simple expression', function () {
		mq.typedText('1');
		assertAriaEqual('1');
		mq.typedText('+');
		assertAriaEqual('plus');
		mq.typedText('1');
		assertAriaEqual('1');
		mq.typedText('=');
		assertAriaEqual('equals');
		mq.typedText('2');
		assertAriaEqual('2');
		mq.keystroke('Backspace');
		assertAriaEqual('2');
		mq.keystroke('Backspace');
		assertAriaEqual('equals');
		mq.keystroke('Backspace');
		assertAriaEqual('1');
		mq.keystroke('Backspace');
		assertAriaEqual('plus');
		mq.keystroke('Backspace');
		assertAriaEqual('1');
	});

	test('typing and backspacing a fraction', function () {
		mq.typedText('1');
		assertAriaEqual('1');
		mq.typedText('/');
		assertAriaEqual('over');
		mq.typedText('2');
		assertAriaEqual('2');

		// We have logic to shorten the speak we return for common numeric fractions and superscripts.
		// While editing, however, the slightly longer form (but unambiguous) form of the item should be spoken.
		// In this case, we would shorten the fraction 1/2 to "1 half" when reading,
		// but navigating around the equation should result in "StartFraction, 1 Over 2, EndFraction."
		mq.keystroke('Escape');
		assertAriaEqual('after StartFraction, 1 Over 2 , EndFraction');

		mq.keystroke('Backspace');
		assertAriaEqual('end of denominator 2');
		mq.keystroke('Backspace');
		assertAriaEqual('2');
		mq.keystroke('Backspace');
		assertAriaEqual('Over');
		mq.keystroke('Backspace');
		assertAriaEqual('1');
	});

	test('navigating a fraction', function () {
		mq.typedText('1');
		assertAriaEqual('1');
		mq.typedText('/');
		assertAriaEqual('over');
		mq.typedText('2');
		assertAriaEqual('2');
		mq.keystroke('Up');
		assertAriaEqual('numerator 1');
		mq.keystroke('Down');
		assertAriaEqual('denominator 2');
		mq.latex('');
	});

	test('typing and backspacing a binomial', function () {
		mq.typedText('1');
		assertAriaEqual('1');
		mq.cmd('\\choose');
		// Matching behavior of "over", we don't get "choose" as the ARIA here.
		mq.typedText('2');
		assertAriaEqual('2');

		mq.keystroke('Escape');
		assertAriaEqual('after StartBinomial, 1 Choose 2 , EndBinomial');

		mq.keystroke('Backspace');
		assertAriaEqual('end of lower index 2');
		mq.keystroke('Backspace');
		assertAriaEqual('2');
		mq.keystroke('Backspace');
		assertAriaEqual('Choose');
		mq.keystroke('Backspace');
		assertAriaEqual('1');
	});

	test('navigating a binomial', function () {
		mq.typedText('1');
		assertAriaEqual('1');
		mq.cmd('\\choose');
		// Matching behavior of "over", we don't get "choose" as the ARIA here.
		mq.typedText('2');
		assertAriaEqual('2');
		mq.keystroke('Up');
		assertAriaEqual('upper index 1');
		mq.keystroke('Down');
		assertAriaEqual('lower index 2');
		mq.latex('');
	});

	test('typing and backspacing through parenthesies', function () {
		mq.typedText('(');
		assertAriaEqual('left parenthesis');
		mq.typedText('1');
		assertAriaEqual('1');
		mq.typedText('*');
		assertAriaEqual('times');
		mq.typedText('2');
		assertAriaEqual('2');
		mq.typedText(')');
		assertAriaEqual('right parenthesis');
		mq.keystroke('Backspace');
		assertAriaEqual('right parenthesis');
		mq.keystroke('Backspace');
		assertAriaEqual('2');
		mq.keystroke('Backspace');
		assertAriaEqual('times');
		mq.keystroke('Backspace');
		assertAriaEqual('1');
		mq.keystroke('Backspace');
		assertAriaEqual('left parenthesis');
	});

	test('typing and backspacing a math function', function () {
		mq.options.addAutoCommands(['sin']);

		mq.typedText('s');
		assertAriaEqual('s');
		mq.typedText('i');
		assertAriaEqual('i');
		mq.typedText('n');
		assertAriaEqual('n');
		mq.typedText('^');
		assertAriaEqual('Superscript, , Baseline');
		mq.typedText('2');
		assertAriaEqual('2');

		mq.keystroke('Escape');
		assertAriaEqual('after Superscript, 2 , Baseline');

		mq.keystroke('Backspace');
		assertAriaEqual('end of superscript 2');
		mq.keystroke('Escape');
		mq.typedText('x');
		assertAriaEqual('x');
		mq.keystroke('Escape Left');
		assertAriaEqual('end of sine parameter x');
		mq.keystroke('Backspace');
		assertAriaEqual('x');
		mq.keystroke('Backspace Right');
		assertAriaEqual('beginning of sine parameter');
		mq.keystroke('Left');
		assertAriaEqual('end of sine squared');

		mq.options.removeAutoCommands(['sin']);
	});

	test('testing beginning and end alerts', function () {
		mq.typedText('\\sqrt x');
		mq.keystroke('Home');
		assertAriaEqual('beginning of square root x');
		mq.keystroke('End');
		assertAriaEqual('end of square root x');
		mq.keystroke('Ctrl-Home');
		assertAriaEqual('beginning of Math Input StartSquareRoot, x , EndSquareRoot');
		mq.keystroke('Ctrl-End');
		assertAriaEqual('end of Math Input StartSquareRoot, x , EndSquareRoot');
	});

	test('testing aria-label for interactive math', function (done) {
		if (document.hasFocus()) {
			mq.focus();
			mq.typedText('\\sqrt x');
			mq.blur();
			setTimeout(() => {
				assert.equal(
					mq.__controller.mathspeakSpan.textContent,
					'Math Input: StartSquareRoot, x , EndSquareRoot'
				);
				done();
			});
		} else {
			console.warn(
				'The test "testing aria-label for interactive math" needs the document to have focus.\n' +
					'Normally, the page being open and focused is enough to have focus, ' +
					'but with the Developer Tools open, it depends on whether you last ' +
					'clicked on something in the Developer Tools or on the page itself. ' +
					'Click the page, or close the Developer Tools, and Refresh.'
			);
			const mock = document.getElementById('mock');
			while (mock.firstChild) mock.firstChild.remove();
			this.skip();
		}
	});

	test('testing aria-label for static math', function () {
		const staticSpan = document.createElement('span');
		staticSpan.classList.add('mathquill-static-math');
		staticSpan.textContent = 'y=\\frac{2x}{3y}';
		document.getElementById('mock')?.append(staticSpan);
		const staticMath = MQ.StaticMath(staticSpan);
		assert.equal(
			staticMath.__controller.mathspeakSpan.textContent,
			'y equals StartFraction, 2 x Over 3 y , EndFraction'
		);
		assert.equal('', staticMath.getAriaLabel());
		staticMath.setAriaLabel('Static Label');
		assert.equal(
			staticMath.__controller.mathspeakSpan.textContent,
			'Static Label: y equals StartFraction, 2 x Over 3 y , EndFraction'
		);
		assert.equal('Static Label', staticMath.getAriaLabel());
		staticMath.latex('2+2');
		assert.equal(staticMath.__controller.mathspeakSpan.textContent, 'Static Label: 2 plus 2');
	});
});
