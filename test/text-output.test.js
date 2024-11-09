/* global MQ */

import { assert } from './support/assert';

suite('text() output', function () {
	let mq;
	setup(function () {
		const el = document.createElement('span');
		document.getElementById('mock')?.append(el);

		// Note that these are the default configuration settings used by webwork,
		// and should be kept up to date with those settings.
		mq = MQ.MathField(el, {
			enableSpaceNavigation: true,
			leftRightIntoCmdGoes: 'up',
			restrictMismatchedBrackets: true,
			sumStartsWithNEquals: true,
			supSubsRequireOperand: true,
			autoCommands: ['pi', 'sqrt', 'root', 'vert', 'inf', 'union', 'abs', 'deg', 'ln', 'log']
				.concat(['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].reduce((a, t) => a.concat([t, `arc${t}`]), []))
				.join(' '),
			rootsAreExponents: true,
			logsChangeBase: true,
			maxDepth: 10
		});
	});
	teardown(function () {
		mq.el().remove();
	});

	// FIXME: For WeBWorK text output is extremely important. So much more of this is needed.

	test('degrees typed with no spaces', function () {
		mq.typedText('0degC');
		assert.equal(mq.text(), '0\u00B0C', '0 degrees Celsius');
		mq.empty();

		mq.typedText('32degF');
		assert.equal(mq.text(), '32\u00B0F', '32 degrees Fahrenheit');
		mq.empty();

		mq.typedText('273.15degK');
		assert.equal(mq.text(), '273.15\u00B0K', '273.15 degrees Kelvin');
		mq.empty();

		mq.typedText('5degH');
		assert.equal(mq.text(), '5\u00B0 H', '5 degrees H?');
		mq.empty();
	});

	test('degrees typed with spaces', function () {
		mq.typedText('0 degC');
		assert.equal(mq.text(), '0 \u00B0C', '0 degrees Celsius');
		mq.empty();

		mq.typedText('32 degF');
		assert.equal(mq.text(), '32 \u00B0F', '32 degrees Fahrenheit');
		mq.empty();

		mq.typedText('273.15 degK');
		assert.equal(mq.text(), '273.15 \u00B0K', '273.15 degrees Kelvin');
		mq.empty();

		mq.typedText('5 degH');
		assert.equal(mq.text(), '5 \u00B0 H', '5 degrees H?');
		mq.empty();
	});
});
