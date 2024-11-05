/* global assert, MQ */

import { VNode } from 'src/tree/vNode';
import { MathFunction, latexMathParser } from 'commands/mathElements';

suite('MathFunction', function () {
	let mq;
	setup(function () {
		const field = document.createElement('span');
		document.getElementById('mock')?.append(field);
		mq = MQ.MathField(field);
		mq.options.addAutoCommands(['sin', 'log']);
	});
	teardown(function () {
		mq.el().remove();
	});

	const assertParsesLatex = (str, latex) => {
		if (typeof latex === 'undefined') latex = str;

		const result = latexMathParser
			.parse(str)
			.postOrder('finalizeTree', mq.options)
			.postOrder('contactWeld', mq.__controller.cursor)
			.join('latex');
		assert.equal(result, latex, `parsing '${str}', got '${result}', expected '${latex}'`);
	};

	suite('parsing', function () {
		test('general', function () {
			assertParsesLatex('\\sin', '\\sin\\left(\\right)');
			assertParsesLatex('\\sin x', '\\sin\\left(x\\right)');
			assertParsesLatex('(\\sin)', '(\\sin\\left(\\right))');
			assertParsesLatex('\\left(\\sin\\right)', '\\left(\\sin\\left(\\right)\\right)');
			assertParsesLatex('\\sin x+3', '\\sin\\left(x\\right)+3');
			assertParsesLatex('\\sin x^2+3', '\\sin\\left(x\\right)^2+3');
			assertParsesLatex('\\sin^2 x', '\\sin^2\\left(x\\right)');
			assertParsesLatex('\\sin_4 x', '\\sin_4\\left(x\\right)');
			assertParsesLatex('\\sin\\left(x^2+3\\right)', '\\sin\\left(x^2+3\\right)');
			assertParsesLatex('\\sin(x^2+3)', '\\sin\\left(x^2+3\\right)');
			assertParsesLatex('\\sin_2^3\\left(x^2+3\\right)', '\\sin_2^3\\left(x^2+3\\right)');
			assertParsesLatex('\\sin_2^3', '\\sin_2^3\\left(\\right)');
			assertParsesLatex('\\sin_{2}^{3} x', '\\sin_2^3\\left(x\\right)');
			assertParsesLatex('\\sin_{2}^{3}{x+3}', '\\sin_2^3\\left(x+3\\right)');
			assertParsesLatex('\\sin^{2}_{3}{x+3}', '\\sin_3^2\\left(x+3\\right)');
			assertParsesLatex('\\sin^2_3^5\\left(x+3\\right)', '\\sin_3^{25}\\left(x+3\\right)');
			assertParsesLatex('\\sin 123423', '\\sin\\left(123423\\right)');
			assertParsesLatex('\\sin 123.423', '\\sin\\left(123.423\\right)');
			assertParsesLatex('\\sin 4.', '\\sin\\left(4.\\right)');
			assertParsesLatex('\\sin .423', '\\sin\\left(.423\\right)');
			assertParsesLatex(
				'\\sinh_{3^2_4}^{y^2+z}\\left(\\pi x\\right)',
				'\\sinh_{3_4^2}^{y^2+z}\\left(\\pi x\\right)'
			);
			assertParsesLatex('\\sinh\\left(x\\right)', '\\sinh\\left(x\\right)');
			assertParsesLatex('\\arcsin\\left(x\\right)', '\\arcsin\\left(x\\right)');
		});

		test('with whitespace', function () {
			assertParsesLatex(' \\sin x ', '\\sin\\left(x\\right)');
			assertParsesLatex('\\sin x + 3 ', '\\sin\\left(x\\right)+3');
			assertParsesLatex('  \\sin  x ^2 + 3', '\\sin\\left(x\\right)^2+3');
			assertParsesLatex('\\sin  \\left( x^2+3 \\right) ', '\\sin\\left(x^2+3\\right)');
			assertParsesLatex('\\sin _2 ^3 \\left( x^2+3 \\right)', '\\sin_2^3\\left(x^2+3\\right)');
			assertParsesLatex('  \\sin _2 ^3   ', '\\sin_2^3\\left(\\right)');
		});
	});

	suite('latex rendering', function () {
		test('render with latex multiple sup subs', function () {
			mq.latex('\\sin_2^3_4^5\\left(x\\right)');
			assert.equal(mq.latex(), '\\sin_{24}^{35}\\left(x\\right)');

			mq.latex('\\sin^2^3_4_5\\left(x\\right)');
			assert.equal(mq.latex(), '\\sin_{45}^{23}\\left(x\\right)');

			mq.latex('\\sin^2^{}_4_{}\\left(x\\right)');
			assert.equal(mq.latex(), '\\sin_4^2\\left(x\\right)');

			mq.latex('\\sin^{}^2_{}_4\\left(x\\right)');
			assert.equal(mq.latex(), '\\sin_4^2\\left(x\\right)');
		});

		test('basic latex output', function () {
			const tree = latexMathParser.parse('\\sin_2^3\\left(x^2+3\\right)').postOrder('finalizeTree', mq.options);

			assert.ok(tree.ends.left instanceof MathFunction);

			assert.equal(tree.ends.left.ends.left.join('latex'), '_2^3');
			assert.equal(tree.ends.left.ends.right.join('latex'), 'x^2+3');

			assert.equal(tree.join('latex'), '\\sin_2^3\\left(x^2+3\\right)');
		});
	});

	suite('deleting subscript and superscript', function () {
		test('backspacing out of and then re-typing subscript', function () {
			mq.latex('\\sin_a^b');
			assert.equal(mq.latex(), '\\sin_a^b\\left(\\right)');

			mq.keystroke('Left Left Down Backspace');
			assert.equal(mq.latex(), '\\sin_{ }^b\\left(\\right)');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sin^b\\left(\\right)');

			mq.typedText('_a');
			assert.equal(mq.latex(), '\\sin_a^b\\left(\\right)');

			mq.keystroke('Left Backspace');
			assert.equal(mq.latex(), '\\sin_a^b\\left(\\right)');

			mq.typedText('c');
			assert.equal(mq.latex(), '\\sin_a^b\\left(c\\right)');
		});

		test('backspacing out of and then re-typing superscript', function () {
			mq.latex('\\sin_a^b');
			assert.equal(mq.latex(), '\\sin_a^b\\left(\\right)');

			mq.keystroke('Left Left Up Backspace');
			assert.equal(mq.latex(), '\\sin_a^{ }\\left(\\right)');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sin_a\\left(\\right)');

			mq.typedText('^b');
			assert.equal(mq.latex(), '\\sin_a^b\\left(\\right)');

			mq.keystroke('Left Backspace');
			assert.equal(mq.latex(), '\\sin_a^b\\left(\\right)');

			mq.typedText('c');
			assert.equal(mq.latex(), '\\sin_a^b\\left(c\\right)');
		});
	});

	suite('extending, shortening, and deleting function name', function () {
		test('sin to sinh to sin', function () {
			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');

			mq.typedText('h');
			assert.equal(mq.latex(), '\\sinh\\left(\\right)');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');

			mq.typedText('x');
			assert.equal(mq.latex(), '\\sin\\left(x\\right)');

			mq.keystroke('Backspace Backspace');
			mq.typedText('hx');
			assert.equal(mq.latex(), '\\sinh\\left(x\\right)');
		});

		test('deleting function name with empty contents', function () {
			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '');

			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');

			mq.keystroke('Left Delete');
			assert.equal(mq.latex(), '');
		});

		test('deleting function name with contents', function () {
			mq.typedText('sinx');
			assert.equal(mq.latex(), '\\sin\\left(x\\right)');

			mq.keystroke('Left Left Backspace');
			assert.equal(mq.latex(), '\\left(x\\right)');

			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(x\\right)');

			mq.keystroke('Left Delete');
			assert.equal(mq.latex(), '\\left(x\\right)');
		});
	});

	suite('typing in supsub block', function () {
		test('typing underscore starts subscript', function () {
			const cursor = mq.__controller.cursor;

			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');
			assert.ok(cursor.parent?.parent instanceof MathFunction);

			mq.typedText('_');
			assert.equal(mq.latex(), '\\sin_{ }\\left(\\right)');

			mq.typedText('4');
			assert.equal(mq.latex(), '\\sin_4\\left(\\right)');

			mq.keystroke('Backspace Backspace');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');
			assert.equal(cursor.parent?.parent.blocks[0], cursor.parent);
		});

		test('typing caret start superscript', function () {
			const cursor = mq.__controller.cursor;

			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');
			assert.ok(cursor.parent?.parent instanceof MathFunction);

			mq.typedText('^');
			assert.equal(mq.latex(), '\\sin^{ }\\left(\\right)');

			mq.typedText('4');
			assert.equal(mq.latex(), '\\sin^4\\left(\\right)');

			mq.keystroke('Backspace Backspace');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');
			assert.equal(cursor.parent?.parent.blocks[0], cursor.parent);
		});

		test('typing space or anything other than ^ or _ inserts into content block', function () {
			const cursor = mq.__controller.cursor;

			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');
			assert.ok(cursor.parent?.parent instanceof MathFunction);

			mq.typedText(' ');
			assert.equal(mq.latex(), '\\sin\\left(\\ \\right)');
			assert.ok(cursor.parent?.parent instanceof MathFunction);
			assert.equal(cursor.parent?.parent.blocks[1], cursor.parent);

			mq.keystroke('Backspace Backspace');
			mq.typedText('a');
			assert.equal(mq.latex(), '\\sin\\left(a\\right)');
			assert.ok(cursor.parent?.parent instanceof MathFunction);
			assert.equal(cursor.parent?.parent.blocks[1], cursor.parent);

			mq.keystroke('Backspace Backspace');
			mq.typedText('8');
			assert.equal(mq.latex(), '\\sin\\left(8\\right)');
			assert.ok(cursor.parent?.parent instanceof MathFunction);
			assert.equal(cursor.parent?.parent.blocks[1], cursor.parent);

			mq.keystroke('Backspace Backspace');
			mq.typedText('\\');
			assert.equal(mq.latex(), '\\sin\\left(\\ \\right)');
			mq.keystroke('Left');
			assert.ok(cursor.parent?.parent instanceof MathFunction);
			assert.equal(cursor.parent?.parent.blocks[1], cursor.parent);
		});

		test('typing start parenthesis moves to content block without adding additional parentheses', function () {
			const cursor = mq.__controller.cursor;

			mq.typedText('sin');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');
			assert.ok(cursor.parent?.parent instanceof MathFunction);

			mq.typedText('(');
			assert.equal(mq.latex(), '\\sin\\left(\\right)');
			assert.equal(cursor.parent?.parent.blocks[1], cursor.parent);
		});
	});

	suite('behavior as a left bracket', function () {
		suite('as initial left bracket', function () {
			let endBracket;
			setup(function () {
				mq.typedText('sin1+2');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)');
				const fcn = mq.__controller.cursor.parent?.parent;
				assert.ok(fcn instanceof MathFunction);
				endBracket = new VNode(fcn.elements.children().last).children().last;
				assert.ok(!!endBracket);
				assert.ok(endBracket.classList.contains('mq-ghost'), 'right parenthesis is ghost initially');
			});

			test('typing outside ghost paren solidifies ghost', function () {
				mq.keystroke('Right').typedText('+4');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)+4');
				assert.ok(
					!endBracket.classList.contains('mq-ghost'),
					'right parenthesis is solid after typing to right'
				);

				mq.keystroke('Backspace Backspace Backspace');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)');
				assert.ok(endBracket.classList.contains('mq-ghost'), 'right parenthesis is ghost again');
			});

			test('close math function parentheses by typing end parenthesis', function () {
				mq.typedText(')');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)');
				assert.ok(!endBracket.classList.contains('mq-ghost'));

				mq.keystroke('Backspace');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)');
				assert.ok(endBracket.classList.contains('mq-ghost'));

				mq.keystroke('Right').typedText(')');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)');
				assert.ok(!endBracket.classList.contains('mq-ghost'));
			});

			test('typing non-parenthesis bracket at end does not match and creates new "Bracket"', function () {
				mq.typedText(']');
				assert.equal(mq.latex(), '\\sin\\left(\\left[1+2\\right]\\right)');
				assert.ok(endBracket.classList.contains('mq-ghost'));

				mq.keystroke('Backspace');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)');
				assert.ok(endBracket.classList.contains('mq-ghost'));

				mq.keystroke('Right').typedText('}');
				assert.equal(mq.latex(), '\\left\\{\\sin\\left(1+2\\right)\\right\\}');
				assert.ok(!endBracket.classList.contains('mq-ghost'));
			});

			test('typing "^" at end solidifies function parenthesis', function () {
				mq.keystroke('Right').typedText('^');
				assert.equal(mq.latex(), '\\sin\\left(1+2\\right)^{ }');
				assert.ok(!endBracket.classList.contains('mq-ghost'));
			});

			test('existing content to right is adopted', function () {
				mq.keystroke('Backspace Backspace Backspace Backspace Backspace');
				mq.typedText('x^2').keystroke('Escape').typedText('+3x-4');
				assert.equal(mq.latex(), 'x^2+3x-4');

				mq.__controller.cursor.insAtLeftEnd(mq.__controller.root);
				mq.typedText('sin');
				assert.equal(mq.latex(), '\\sin\\left(x^2+3x-4\\right)');
			});
		});

		suite('adding to left of parentheses', function () {
			test('typing left of right solid parentheses with left ghost', function () {
				mq.typedText('x+3)');
				assert.equal(mq.latex(), '\\left(x+3\\right)');
				mq.keystroke('Left').typedText('sin');
				assert.equal(mq.latex(), 'x+3\\sin\\left(\\right)');
			});

			test('typing amid content of right solid parentheses with left ghost', function () {
				mq.typedText('x+3)');
				assert.equal(mq.latex(), '\\left(x+3\\right)');
				mq.keystroke('Left Left').typedText('sin');
				assert.equal(mq.latex(), 'x+\\sin\\left(3\\right)');
			});

			test('typing right of left ghost parenthesis with right solid parentheses', function () {
				mq.typedText('x+3)');
				assert.equal(mq.latex(), '\\left(x+3\\right)');
				mq.keystroke('Left Left Left Left').typedText('sin');
				assert.equal(mq.latex(), '\\sin\\left(x+3\\right)');
			});

			test('typing left of parentheses', function () {
				mq.typedText('x+3)');
				assert.equal(mq.latex(), '\\left(x+3\\right)');
				mq.keystroke('Left Left Left Left Left').typedText('sin');
				assert.equal(mq.latex(), '\\sin\\left(x+3\\right)');
			});
		});
	});

	suite('text output', function () {
		test('function without supsubs', function () {
			mq.typedText('sin');
			assert.equal(mq.text(), 'sin()');

			mq.typedText('x');
			assert.equal(mq.text(), 'sin(x)');

			mq.typedText('+3');
			assert.equal(mq.text(), 'sin(x+3)');
		});

		test('function with supsubs', function () {
			mq.typedText('sin');
			assert.equal(mq.text(), 'sin()');

			mq.typedText('^3');
			assert.equal(mq.text(), 'sin^3()');

			mq.keystroke('Escape').typedText('_5');
			assert.equal(mq.text(), 'sin_5^3()');

			mq.keystroke('Escape Escape').typedText('x');
			assert.equal(mq.text(), 'sin_5^3(x)');
		});

		test('extended function name', function () {
			mq.typedText('sin');
			assert.equal(mq.text(), 'sin()');

			mq.typedText('h');
			assert.equal(mq.text(), 'sinh()');

			mq.typedText('^5');
			assert.equal(mq.text(), 'sinh^5()');

			mq.keystroke('Escape').typedText('x');
			assert.equal(mq.text(), 'sinh^5(x)');

			mq.keystroke('Left Left Left Left Left Backspace');
			assert.equal(mq.text(), 'sin^5(x)');
		});

		test('log with base', function () {
			mq.typedText('log');
			assert.equal(mq.text(), 'log()');

			mq.typedText('_2');
			assert.equal(mq.text(), 'logb(2,)');

			mq.keystroke('Escape').typedText('x');
			assert.equal(mq.text(), 'logb(2,x)');

			mq.keystroke('Left Left').typedText('^4');
			assert.equal(mq.text(), '(logb(2,x))^4');
		});
	});
});
