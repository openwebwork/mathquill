/* global assert, MQ */

suite('autoSubscript', function () {
	let mq, rootBlock, controller, cursor;
	setup(function () {
		const field = document.createElement('span');
		document.getElementById('mock')?.append(field);
		mq = MQ.MathField(field, { autoSubscriptNumerals: true });
		rootBlock = mq.__controller.root;
		controller = mq.__controller;
		cursor = controller.cursor;
	});

	test('auto subscripting variables', function () {
		mq.latex('x');
		mq.typedText('2');
		assert.equal(mq.latex(), 'x_2');
		mq.typedText('3');
		assert.equal(mq.latex(), 'x_{23}');
	});

	test('do not autosubscript operator name', function () {
		mq.latex('ker');
		mq.typedText('2');
		assert.equal(mq.latex(), '\\ker2');
		mq.typedText('3');
		assert.equal(mq.latex(), '\\ker23');
	});

	test('autosubscript exponentiated variables', function () {
		mq.latex('x^2');
		mq.typedText('2');
		assert.equal(mq.latex(), 'x_2^2');
		mq.typedText('3');
		assert.equal(mq.latex(), 'x_{23}^2');
	});

	test('do not autosubscript exponentiated operator name', function () {
		mq.latex('ker^{2}');
		mq.typedText('2');
		assert.equal(mq.latex(), '\\ker^22');
		mq.typedText('3');
		assert.equal(mq.latex(), '\\ker^223');
	});

	test('do not autosubscript subscripted operator name', function () {
		mq.latex('ker_{10}');
		mq.typedText('2');
		assert.equal(mq.latex(), '\\ker_{10}2');
	});

	test('backspace through compound subscript', function () {
		mq.latex('x_{2_2}');

		//first backspace moves to cursor in subscript and peels it off
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2');

		//second backspace clears out remaining subscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{ }');

		//unpeel subscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x');
	});

	test('backspace through simple subscript', function () {
		mq.latex('x_{2+3}');

		assert.equal(cursor.parent, rootBlock, 'start in the root block');

		//backspace peels off subscripts but stays at the root block level
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_{2+}');
		assert.equal(cursor.parent, rootBlock, 'backspace keeps us in the root block');
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x_2');
		assert.equal(cursor.parent, rootBlock, 'backspace keeps us in the root block');

		//second backspace clears out remaining subscript and unpeels
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x');
	});

	test('backspace through subscript & superscript with autosubscripting on', function () {
		mq.latex('x_2^{32}');

		//first backspace peels off the subscript
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x^{32}');

		//second backspace goes into the exponent
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x^{32}');

		//clear out exponent
		mq.keystroke('Backspace');
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x^{ }');

		//unpeel exponent
		mq.keystroke('Backspace');
		assert.equal(mq.latex(), 'x');
	});
});
