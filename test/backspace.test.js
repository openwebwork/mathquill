/* global MQ */

import { prayWellFormed } from 'src/constants';
import { assert } from './support/assert';

suite('backspace and delete', function () {
	suite('backspace', function () {
		let mq, rootBlock, controller, cursor;
		setup(function () {
			const field = document.createElement('span');
			document.getElementById('mock')?.append(field);
			mq = MQ.MathField(field);
			rootBlock = mq.__controller.root;
			controller = mq.__controller;
			cursor = controller.cursor;
		});

		const prayWellFormedPoint = (pt) => prayWellFormed(pt.parent, pt.left, pt.right);
		const assertLatex = (latex) => {
			prayWellFormedPoint(mq.__controller.cursor);
			assert.equal(mq.latex(), latex);
		};

		test('backspace through exponent', function () {
			controller.renderLatexMath('x^{nm}');
			const exp = rootBlock.ends.right,
				expBlock = exp.ends.left;
			assert.equal(exp.latex(), '^{nm}', 'right end el is exponent');
			assert.equal(cursor.parent, rootBlock, 'cursor is in root block');
			assert.equal(cursor.left, exp, 'cursor is at the end of root block');

			mq.keystroke('Backspace');
			assert.equal(cursor.parent, expBlock, 'cursor up goes into exponent on backspace');
			assertLatex('x^{nm}');

			mq.keystroke('Backspace');
			assert.equal(cursor.parent, expBlock, 'cursor still in exponent');
			assertLatex('x^n');

			mq.keystroke('Backspace');
			assert.equal(cursor.parent, expBlock, 'still in exponent, but it is empty');
			assertLatex('x^{ }');

			mq.keystroke('Backspace');
			assert.equal(cursor.parent, rootBlock, 'backspace tears down exponent');
			assertLatex('x');
		});

		test('backspace through complex fraction', function () {
			controller.renderLatexMath('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}');

			//first backspace moves to denominator
			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}');

			//first backspace moves to denominator in denominator
			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}');

			//finally delete a character
			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{\\frac{1}{2}+\\frac{2}{ }}');

			//destroy fraction
			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{\\frac{1}{2}+2}');

			mq.keystroke('Backspace');
			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{\\frac{1}{2}}');

			mq.keystroke('Backspace');
			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{\\frac{1}{ }}');

			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{1}');

			mq.keystroke('Backspace');
			assertLatex('1+\\frac{1}{ }');

			mq.keystroke('Backspace');
			assertLatex('1+1');
		});

		test('backspace through compound subscript', function () {
			mq.latex('x_{2_2}');

			//first backspace goes into the subscript
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{2_2}');

			//second one goes into the subscripts' subscript
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{2_2}');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{2_{ }}');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_2');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{ }');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x');
		});

		test('backspace through simple subscript', function () {
			mq.latex('x_{2+3}');

			assert.equal(cursor.parent, rootBlock, 'start in the root block');

			//backspace goes down
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{2+3}');
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{2+}');
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_2');
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{ }');
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x');
		});

		test('backspace through subscript & superscript', function () {
			mq.latex('x_2^{32}');

			//first backspace takes us into the exponent
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_2^{32}');

			//second backspace is within the exponent
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_2^3');

			//clear out exponent
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_2^{ }');

			//unpeel exponent
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_2');

			//into subscript
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_2');

			//clear out subscript
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x_{ }');

			//unpeel exponent
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'x');

			//clear out math field
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '');
		});

		test('backspace through nthroot', function () {
			mq.latex('\\sqrt[3]{x}');

			//first backspace takes us inside the nthroot
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sqrt[3]{x}');

			//second backspace removes the x
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sqrt[3]{}');

			//third one destroys the cube root, but leaves behind the 3
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '3');

			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '');
		});

		test('backspace through large operator', function () {
			mq.latex('\\sum_{n=1}^3x');

			//first backspace takes out the argument
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sum_{n=1}^3');

			//up into the superscript
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sum_{n=1}^3');

			//up into the superscript
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), '\\sum_{n=1}^{ }');

			//destroy the sum, preserve the subscript (a little surprising)
			mq.keystroke('Backspace');
			assert.equal(mq.latex(), 'n=1');
		});

		test('backspace through text block', function () {
			mq.latex('\\text{x}');

			mq.keystroke('Backspace');

			const textBlock = rootBlock.ends.right;
			assert.equal(cursor.parent, textBlock, 'cursor is in text block');
			assert.equal(cursor.right, undefined, 'cursor is at the end of text block');
			assert.equal(cursor.left.text(), 'x', 'cursor is rightward of the x');
			assert.equal(mq.latex(), '\\text{x}', 'the x has been deleted');

			mq.keystroke('Backspace');
			assert.equal(cursor.parent, textBlock, 'cursor is still in text block');
			assert.equal(cursor.right, undefined, 'cursor is at the right end of the text block');
			assert.equal(cursor.left, undefined, 'cursor is at the left end of the text block');
			assert.equal(mq.latex(), '', 'the x has been deleted');

			mq.keystroke('Backspace');
			assert.equal(cursor.right, undefined, 'cursor is at the right end of the root block');
			assert.equal(cursor.left, undefined, 'cursor is at the left end of the root block');
			assert.equal(mq.latex(), '');
		});

		suite('empties', function () {
			test('backspace empty exponent', function () {
				mq.latex('x^{}');
				mq.keystroke('Backspace');
				assert.equal(mq.latex(), 'x');
			});

			test('backspace empty sqrt', function () {
				mq.latex('1+\\sqrt{}');
				mq.keystroke('Backspace');
				assert.equal(mq.latex(), '1+');
			});

			test('backspace empty fraction', function () {
				mq.latex('1+\\frac{}{}');
				mq.keystroke('Backspace');
				assert.equal(mq.latex(), '1+');
			});
		});
	});

	suite('delete', function () {
		let mq, rootBlock, controller, cursor;
		setup(function () {
			const field = document.createElement('span');
			document.getElementById('mock')?.append(field);
			mq = MQ.MathField(field);
			rootBlock = mq.__controller.root;
			controller = mq.__controller;
			cursor = controller.cursor;
		});

		const prayWellFormedPoint = (pt) => {
			prayWellFormed(pt.parent, pt.left, pt.right);
		};
		const assertLatex = (latex) => {
			prayWellFormedPoint(mq.__controller.cursor);
			assert.equal(mq.latex(), latex);
		};

		test('delete through exponent', function () {
			controller.renderLatexMath('x^{nm}');
			const exp = rootBlock.ends.right,
				base = rootBlock.ends.left;
			mq.moveToLeftEnd();
			assert.equal(exp.latex(), '^{nm}', 'right end el is exponent');
			assert.equal(base.latex(), 'x', 'left end el is base');
			assert.equal(cursor.parent, rootBlock, 'cursor is in root block');
			assert.equal(cursor.right, base, 'cursor is at the start of root block');

			mq.keystroke('Delete');
			assert.equal(cursor.parent, rootBlock, 'delete tears down exponent');
			assertLatex('nm');

			mq.keystroke('Delete');
			mq.keystroke('Delete');
			assertLatex('');
		});

		test('delete through complex fraction', function () {
			controller.renderLatexMath('\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}+1');
			mq.moveToLeftEnd();

			// move to numerator
			mq.keystroke('Delete');
			assertLatex('\\frac{1}{\\frac{1}{2}+\\frac{2}{3}}+1');

			// delete the numerator
			mq.keystroke('Delete');
			assertLatex('\\frac{ }{\\frac{1}{2}+\\frac{2}{3}}+1');

			// delete the outer fraction
			mq.keystroke('Delete');
			assertLatex('\\frac{1}{2}+\\frac{2}{3}+1');

			mq.keystroke('Delete');
			mq.keystroke('Delete');
			mq.keystroke('Delete');
			assertLatex('2+\\frac{2}{3}+1');

			mq.keystroke('Delete');
			mq.keystroke('Delete');
			assertLatex('\\frac{2}{3}+1');
		});

		test('delete through compound subscript', function () {
			mq.latex('x_{2_2}');
			mq.moveToLeftEnd();

			mq.keystroke('Delete');
			assertLatex('2_2');

			mq.keystroke('Delete');
			assertLatex('2');

			mq.keystroke('Delete');
			assertLatex('');
		});

		test('delete through simple subscript', function () {
			mq.latex('x_{2+3}');
			mq.moveToLeftEnd();

			//delete
			mq.keystroke('Delete');
			assertLatex('2+3');
			mq.keystroke('Delete');
			assertLatex('+3');
			mq.keystroke('Delete');
			assertLatex('3');
			mq.keystroke('Delete');
			assertLatex('');
		});

		test('delete through subscript & superscript', function () {
			mq.latex('x_2^{32}');
			mq.moveToLeftEnd();

			mq.keystroke('Delete');
			assertLatex('232');

			mq.keystroke('Delete');
			mq.keystroke('Delete');
			mq.keystroke('Delete');
			assertLatex('');
		});

		test('delete through nthroot', function () {
			mq.latex('\\sqrt[3]{x}');
			mq.moveToLeftEnd();

			// into the radix/degree/index
			mq.keystroke('Delete');
			assertLatex('\\sqrt[3]{x}');

			// delete the 3
			mq.keystroke('Delete');
			assertLatex('\\sqrt[]{x}');

			// destroy the cube root, but leave x
			mq.keystroke('Delete');
			assertLatex('x');

			mq.keystroke('Delete');
			assertLatex('');
		});

		test('delete through nthroot from middle of radix', function () {
			mq.latex('\\sqrt[3]{x}');
			mq.moveToLeftEnd();

			// into the radix/degree/index
			mq.keystroke('Right');
			mq.keystroke('Right');
			assert.equal(cursor.left.latex(), '3', 'cursor at end of radix');

			// destroy the cube root, but leave 3x
			mq.keystroke('Delete');
			assertLatex('3x');

			// delete x
			mq.keystroke('Delete');
			assertLatex('3');
		});

		test('delete through large operator', function () {
			mq.latex('\\sum_{n=1}^3x');
			mq.moveToLeftEnd();

			//move to subscript
			mq.keystroke('Delete');
			assertLatex('\\sum_{n=1}^3x');
			mq.keystroke('Delete');
			assertLatex('\\sum_{=1}^3x');
			mq.keystroke('Delete');
			assertLatex('\\sum_1^3x');
			mq.keystroke('Delete');
			assertLatex('\\sum_{ }^3x');

			// destroy sum
			mq.keystroke('Delete');
			assertLatex('3x');
		});

		test('delete through text block', function () {
			mq.latex('\\text{x}');
			mq.moveToLeftEnd();

			mq.keystroke('Delete');
			const textBlock = rootBlock.ends.left;
			assert.equal(cursor.parent, textBlock, 'cursor is in text block');
			assert.equal(cursor.left, undefined, 'cursor is at the start of text block');
			assert.equal(cursor.right.textStr, 'x', 'cursor is leftward of the x');
			assertLatex('\\text{x}', 'the x has not been deleted');

			mq.keystroke('Delete');
			assert.equal(cursor.parent, textBlock, 'cursor is still in text block');
			assert.equal(cursor.left, undefined, 'cursor is at the left end of the text block');
			assert.equal(cursor.right, undefined, 'cursor is at the right end of the text block');
			assertLatex('', 'the x has been deleted');

			mq.keystroke('Delete');
			assert.equal(cursor.parent, rootBlock, 'cursor is in root block');
			assert.equal(cursor.right, undefined, 'cursor is at the right end of the root block');
			assert.equal(cursor.left, undefined, 'cursor is at the left end of the root block');
			assertLatex('');
		});

		suite('empties', function () {
			test('delete empty exponent', function () {
				mq.latex('x^{}');
				mq.moveToLeftEnd();
				mq.keystroke('Delete');
				assertLatex('');
			});

			test('delete empty sqrt', function () {
				mq.latex('\\sqrt{}+1');
				mq.moveToLeftEnd();
				mq.keystroke('Delete');
				assertLatex('+1');
			});

			test('delete empty fraction', function () {
				mq.latex('\\frac{}{}+1');
				mq.moveToLeftEnd();
				mq.keystroke('Delete');
				assertLatex('+1');
			});
		});
	});
});
