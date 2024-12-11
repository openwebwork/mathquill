/* global assert, MQ */

import { prayWellFormed } from 'src/constants';
import { Controller } from 'src/controller';
import { latexMathParser } from 'commands/mathElements';

suite('text', function () {
	let mq, mostRecentlyReportedLatex;
	setup(function () {
		mostRecentlyReportedLatex = NaN; // != to everything
		const el = document.createElement('span');
		document.getElementById('mock')?.append(el);
		mq = MQ.MathField(el, {
			handlers: {
				edit: () => (mostRecentlyReportedLatex = mq.latex())
			}
		});
	});

	const prayWellFormedPoint = (pt) => prayWellFormed(pt.parent, pt.left, pt.right);
	const assertLatex = (latex) => {
		prayWellFormedPoint(mq.__controller.cursor);
		assert.equal(mostRecentlyReportedLatex, latex, 'assertLatex failed');
		assert.equal(mq.latex(), latex, 'assertLatex failed');
	};

	const fromLatex = (latex) => {
		const block = latexMathParser.parse(latex);
		block.domify();

		return block;
	};

	const assertSplit = (dom, prev, next) => {
		if (prev) {
			assert.ok(dom.previousSibling instanceof Text);
			assert.equal(prev, dom.previousSibling.data, 'assertSplit failed');
		} else {
			assert.ok(!dom.previousSibling);
		}

		if (next) {
			assert.ok(dom.nextSibling instanceof Text);
			assert.equal(next, dom.nextSibling.data, 'assertSplit failed');
		} else {
			assert.ok(!dom.nextSibling);
		}
	};

	test('changes the text nodes as the cursor moves around', function () {
		const block = fromLatex('\\text{abc}');
		const ctrlr = new Controller(block, 0, 0);
		const cursor = ctrlr.cursor.insAtRightEnd(block);

		ctrlr.moveLeft();
		assertSplit(cursor.element, 'abc', null);

		ctrlr.moveLeft();
		assertSplit(cursor.element, 'ab', 'c');

		ctrlr.moveLeft();
		assertSplit(cursor.element, 'a', 'bc');

		ctrlr.moveLeft();
		assertSplit(cursor.element, null, 'abc');

		ctrlr.moveRight();
		assertSplit(cursor.element, 'a', 'bc');

		ctrlr.moveRight();
		assertSplit(cursor.element, 'ab', 'c');

		ctrlr.moveRight();
		assertSplit(cursor.element, 'abc', null);
	});

	test('does not change latex as the cursor moves around', function () {
		const block = fromLatex('\\text{x}');
		const ctrlr = new Controller(block, 0, 0);
		ctrlr.cursor.insAtRightEnd(block);

		ctrlr.moveLeft();
		ctrlr.moveLeft();
		ctrlr.moveLeft();

		assert.equal(block.latex(), '\\text{x}');
	});

	suite('typing', function () {
		test('stepping out of an empty block deletes it', function () {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{x}');
			assertLatex('\\text{x}');

			mq.keystroke('Left');
			assertSplit(cursor.element, 'x');
			assertLatex('\\text{x}');

			mq.keystroke('Backspace');
			assertSplit(cursor.element);
			assertLatex('');

			mq.keystroke('Right');
			assertSplit(cursor.element);
			assert.equal(cursor.left, undefined);
			assertLatex('');
		});

		test('typing $ in a textblock splits it', function () {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			assertLatex('\\text{asdf}');

			mq.keystroke('Left Left Left');
			assertSplit(cursor.element, 'as', 'df');
			assertLatex('\\text{asdf}');

			mq.typedText('$');
			assertLatex('\\text{as}\\text{df}');
		});
	});

	suite('pasting', function () {
		test('sanity', function () {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.element, 'as', 'df');

			controller.paste('foo');

			assertSplit(cursor.element, 'asfoo', 'df');
			assertLatex('\\text{asfoodf}');
			prayWellFormedPoint(cursor);
		});

		test('pasting a dollar sign', function () {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.element, 'as', 'df');

			controller.paste('$foo');

			assertSplit(cursor.element, 'as$foo', 'df');
			assertLatex('\\text{as$foodf}');
			prayWellFormedPoint(cursor);
		});

		test('pasting a backslash', function () {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.element, 'as', 'df');

			controller.paste('\\pi');

			assertSplit(cursor.element, 'as\\pi', 'df');
			assertLatex('\\text{as\\pidf}');
			prayWellFormedPoint(cursor);
		});

		test('pasting a curly brace', function () {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.element, 'as', 'df');

			controller.paste('{');

			assertSplit(cursor.element, 'as{', 'df');
			assertLatex('\\text{as\\{df}');
			prayWellFormedPoint(cursor);
		});
	});
});
