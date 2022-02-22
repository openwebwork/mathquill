/* global suite, test, assert, setup, MQ */

import { L, R, prayWellFormed } from 'src/constants';
import { Controller } from 'src/controller';
import { latexMathParser } from 'commands/mathElements';

suite('text', () => {

	let mq, mostRecentlyReportedLatex;
	setup(() => {
		mostRecentlyReportedLatex = NaN; // != to everything
		const el = document.createElement('span');
		document.getElementById('mock')?.append(el);
		mq = MQ.MathField(el, {
			handlers: {
				edit: () => mostRecentlyReportedLatex = mq.latex()
			}
		});
	});

	const prayWellFormedPoint = (pt) => prayWellFormed(pt.parent, pt[L], pt[R]);
	const assertLatex = (latex) => {
		prayWellFormedPoint(mq.__controller.cursor);
		assert.equal(mostRecentlyReportedLatex, latex, 'assertLatex failed');
		assert.equal(mq.latex(), latex, 'assertLatex failed');
	};

	const fromLatex = (latex) => {
		const block = latexMathParser.parse(latex);
		block.jQize();

		return block;
	};

	const assertSplit = (jQ, prev, next) => {
		const dom = jQ[0];

		if (prev) {
			assert.ok(dom.previousSibling instanceof Text);
			assert.equal(prev, dom.previousSibling.data, 'assertSplit failed');
		}
		else {
			assert.ok(!dom.previousSibling);
		}

		if (next) {
			assert.ok(dom.nextSibling instanceof Text);
			assert.equal(next, dom.nextSibling.data, 'assertSplit failed');
		}
		else {
			assert.ok(!dom.nextSibling);
		}
	};

	test('changes the text nodes as the cursor moves around', () => {
		const block = fromLatex('\\text{abc}');
		const ctrlr = new Controller(block, 0, 0);
		const cursor = ctrlr.cursor.insAtRightEnd(block);

		ctrlr.moveLeft();
		assertSplit(cursor.jQ, 'abc', null);

		ctrlr.moveLeft();
		assertSplit(cursor.jQ, 'ab', 'c');

		ctrlr.moveLeft();
		assertSplit(cursor.jQ, 'a', 'bc');

		ctrlr.moveLeft();
		assertSplit(cursor.jQ, null, 'abc');

		ctrlr.moveRight();
		assertSplit(cursor.jQ, 'a', 'bc');

		ctrlr.moveRight();
		assertSplit(cursor.jQ, 'ab', 'c');

		ctrlr.moveRight();
		assertSplit(cursor.jQ, 'abc', null);
	});

	test('does not change latex as the cursor moves around', () => {
		const block = fromLatex('\\text{x}');
		const ctrlr = new Controller(block, 0, 0);
		ctrlr.cursor.insAtRightEnd(block);

		ctrlr.moveLeft();
		ctrlr.moveLeft();
		ctrlr.moveLeft();

		assert.equal(block.latex(), '\\text{x}');
	});

	suite('typing', () => {
		test('stepping out of an empty block deletes it', () => {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{x}');
			assertLatex('\\text{x}');

			mq.keystroke('Left');
			assertSplit(cursor.jQ, 'x');
			assertLatex('\\text{x}');

			mq.keystroke('Backspace');
			assertSplit(cursor.jQ);
			assertLatex('');

			mq.keystroke('Right');
			assertSplit(cursor.jQ);
			assert.equal(cursor[L], undefined);
			assertLatex('');
		});

		test('typing $ in a textblock splits it', () => {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			assertLatex('\\text{asdf}');

			mq.keystroke('Left Left Left');
			assertSplit(cursor.jQ, 'as', 'df');
			assertLatex('\\text{asdf}');

			mq.typedText('$');
			assertLatex('\\text{as}\\text{df}');
		});
	});

	suite('pasting', () => {
		test('sanity', () => {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.jQ, 'as', 'df');

			controller.paste('foo');

			assertSplit(cursor.jQ, 'asfoo', 'df');
			assertLatex('\\text{asfoodf}');
			prayWellFormedPoint(cursor);

		});

		test('pasting a dollar sign', () => {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.jQ, 'as', 'df');

			controller.paste('$foo');

			assertSplit(cursor.jQ, 'as$foo', 'df');
			assertLatex('\\text{as$foodf}');
			prayWellFormedPoint(cursor);
		});

		test('pasting a backslash', () => {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.jQ, 'as', 'df');

			controller.paste('\\pi');

			assertSplit(cursor.jQ, 'as\\pi', 'df');
			assertLatex('\\text{as\\pidf}');
			prayWellFormedPoint(cursor);
		});

		test('pasting a curly brace', () => {
			const controller = mq.__controller;
			const cursor = controller.cursor;

			mq.latex('\\text{asdf}');
			mq.keystroke('Left Left Left');
			assertSplit(cursor.jQ, 'as', 'df');

			controller.paste('{');

			assertSplit(cursor.jQ, 'as{', 'df');
			assertLatex('\\text{as\\{df}');
			prayWellFormedPoint(cursor);
		});

	});
});
