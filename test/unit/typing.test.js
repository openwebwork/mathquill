/* global suite, test, assert, setup, MQ, MQBasic */

import { jQuery, L, R, prayWellFormed } from 'src/constants';

suite('typing with auto-replaces', () => {
	let mq, mostRecentlyReportedLatex;
	setup(() => {
		mostRecentlyReportedLatex = NaN; // != to everything
		mq = MQ.MathField(jQuery('<span></span>').appendTo('#mock')[0], {
			handlers: {
				edit: () => mostRecentlyReportedLatex = mq.latex()
			}
		});
	});

	const prayWellFormedPoint = (pt) => prayWellFormed(pt.parent, pt[L], pt[R]);
	const assertLatex = (latex) => {
		prayWellFormedPoint(mq.__controller.cursor);
		assert.equal(mostRecentlyReportedLatex, latex);
		assert.equal(mq.latex(), latex);
	};

	suite('LiveFraction', () => {
		test('full MathQuill', () => {
			mq.typedText('1/2').keystroke('Tab').typedText('+sinx/');
			assertLatex('\\frac{1}{2}+\\frac{\\sin x}{ }');
			mq.latex('').typedText('1+/2');
			assertLatex('1+\\frac{2}{ }');
			mq.latex('').typedText('1 2/3');
			assertLatex('1\\ \\frac{2}{3}');
		});

		test('mathquill-basic', () => {
			const mq_basic = MQBasic.MathField(jQuery('<span></span>').appendTo('#mock')[0]);
			mq_basic.typedText('1/2');
			assert.equal(mq_basic.latex(), '\\frac{1}{2}');
		});
	});

	suite('LatexCommandInput', () => {
		test('basic', () => {
			mq.typedText('\\sqrt-x');
			assertLatex('\\sqrt{-x}');
		});

		test('they\'re passed their name', () => {
			mq.cmd('\\alpha');
			assert.equal(mq.latex(), '\\alpha');
		});

		test('replaces selection', () => {
			mq.typedText('49').select().typedText('\\sqrt').keystroke('Enter');
			assertLatex('\\sqrt{49}');
		});

		test('auto-operator names', () => {
			mq.typedText('\\sin^2');
			assertLatex('\\sin^2');
		});

		test('nonexistent LaTeX command', () => {
			mq.typedText('\\asdf').keystroke('Enter');
			assertLatex('\\text{asdf}');
		});

		test('nonexistent LaTeX command, then symbol', () => {
			mq.typedText('\\asdf+');
			assertLatex('\\text{asdf}+');
		});

		test('dollar sign', () => {
			mq.typedText('$');
			assertLatex('\\$');
		});

		test('\\text followed by command', () => {
			mq.typedText('\\text{');
			assertLatex('\\text{\\{}');
		});
	});

	suite('auto-expanding parens', () => {
		suite('simple', () => {
			test('empty parens ()', () => {
				mq.typedText('(');
				assertLatex('\\left(\\right)');
				mq.typedText(')');
				assertLatex('\\left(\\right)');
			});

			test('straight typing 1+(2+3)+4', () => {
				mq.typedText('1+(2+3)+4');
				assertLatex('1+\\left(2+3\\right)+4');
			});

			test('basic command \\sin(', function () {
				mq.typedText('\\sin(');
				assertLatex('\\sin\\left(\\right)');
			});

			test('wrapping things in parens 1+(2+3)+4', () => {
				mq.typedText('1+2+3+4');
				assertLatex('1+2+3+4');
				mq.keystroke('Left Left').typedText(')');
				assertLatex('\\left(1+2+3\\right)+4');
				mq.keystroke('Left Left Left Left').typedText('(');
				assertLatex('1+\\left(2+3\\right)+4');
			});

			test('nested parens 1+(2+(3+4)+5)+6', () => {
				mq.typedText('1+(2+(3+4)+5)+6');
				assertLatex('1+\\left(2+\\left(3+4\\right)+5\\right)+6');
			});
		});

		suite('mismatched brackets', () => {
			test('empty mismatched brackets (] and [}', () => {
				mq.typedText('(');
				assertLatex('\\left(\\right)');
				mq.typedText(']');
				assertLatex('\\left(\\right]');
				mq.typedText('[');
				assertLatex('\\left(\\right]\\left[\\right]');
				mq.typedText('}');
				assertLatex('\\left(\\right]\\left[\\right\\}');
			});

			test('typing mismatched brackets 1+(2+3]+4', () => {
				mq.typedText('1+');
				assertLatex('1+');
				mq.typedText('(');
				assertLatex('1+\\left(\\right)');
				mq.typedText('2+3');
				assertLatex('1+\\left(2+3\\right)');
				mq.typedText(']+4');
				assertLatex('1+\\left(2+3\\right]+4');
			});

			test('wrapping things in mismatched brackets 1+(2+3]+4', () => {
				mq.typedText('1+2+3+4');
				assertLatex('1+2+3+4');
				mq.keystroke('Left Left').typedText(']');
				assertLatex('\\left[1+2+3\\right]+4');
				mq.keystroke('Left Left Left Left').typedText('(');
				assertLatex('1+\\left(2+3\\right]+4');
			});

			test('nested mismatched brackets 1+(2+[3+4)+5]+6', () => {
				mq.typedText('1+(2+[3+4)+5]+6');
				assertLatex('1+\\left(2+\\left[3+4\\right)+5\\right]+6');
			});

			suite('restrictMismatchedBrackets', () => {
				setup(() => mq.config({ restrictMismatchedBrackets: true }));
				test('typing (|x|+1) works', () => {
					mq.typedText('(|x|+1)');
					assertLatex('\\left(\\left|x\\right|+1\\right)');
				});
				test('typing [x} becomes [{x}]', () => {
					mq.typedText('[x}');
					assertLatex('\\left[\\left\\{x\\right\\}\\right]');
				});
				test('normal matching pairs {f(n), [a,b]} work', () => {
					mq.typedText('{f(n), [a,b]}');
					assertLatex('\\left\\{f\\left(n\\right),\\ \\left[a,b\\right]\\right\\}');
				});
				test('[a,b) and (a,b] still work', () => {
					mq.typedText('[a,b) + (a,b]');
					assertLatex('\\left[a,b\\right)\\ +\\ \\left(a,b\\right]');
				});
			});
		});

		suite('pipes', () => {
			test('empty pipes ||', () => {
				mq.typedText('|');
				assertLatex('\\left|\\right|');
				mq.typedText('|');
				assertLatex('\\left|\\right|');
			});

			test('straight typing 1+|2+3|+4', () => {
				mq.typedText('1+|2+3|+4');
				assertLatex('1+\\left|2+3\\right|+4');
			});

			test('wrapping things in pipes 1+|2+3|+4', () => {
				mq.typedText('1+2+3+4');
				assertLatex('1+2+3+4');
				mq.keystroke('Home Right Right').typedText('|');
				assertLatex('1+\\left|2+3+4\\right|');
				mq.keystroke('Right Right Right').typedText('|');
				assertLatex('1+\\left|2+3\\right|+4');
			});

			suite('can type mismatched paren/pipe group from any side', () => {
				suite('straight typing', () => {
					test('|)', () => {
						mq.typedText('|)');
						assertLatex('\\left|\\right)');
					});

					test('(|', () => {
						mq.typedText('(|');
						assertLatex('\\left(\\right|');
					});
				});

				suite('the other direction', () => {
					test('|)', () => {
						mq.typedText(')');
						assertLatex('\\left(\\right)');
						mq.keystroke('Left').typedText('|');
						assertLatex('\\left|\\right)');
					});

					test('(|', () => {
						mq.typedText('||');
						assertLatex('\\left|\\right|');
						mq.keystroke('Left Left Del');
						assertLatex('\\left|\\right|');
						mq.typedText('(');
						assertLatex('\\left(\\right|');
					});
				});
			});
		});

		suite('backspacing', backspacingTests);

		suite('backspacing with restrictMismatchedBrackets', () => {
			setup(() => mq.config({ restrictMismatchedBrackets: true }));

			backspacingTests();
		});

		function backspacingTests() {
			test('typing then backspacing a close-paren in the middle of 1+2+3+4', () => {
				mq.typedText('1+2+3+4');
				assertLatex('1+2+3+4');
				mq.keystroke('Left Left').typedText(')');
				assertLatex('\\left(1+2+3\\right)+4');
				mq.keystroke('Backspace');
				assertLatex('1+2+3+4');
			});

			test('backspacing close-paren then open-paren of 1+(2+3)+4', () => {
				mq.typedText('1+(2+3)+4');
				assertLatex('1+\\left(2+3\\right)+4');
				mq.keystroke('Left Left Backspace');
				assertLatex('1+\\left(2+3+4\\right)');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('backspacing open-paren of 1+(2+3)+4', () => {
				mq.typedText('1+(2+3)+4');
				assertLatex('1+\\left(2+3\\right)+4');
				mq.keystroke('Left Left Left Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('backspacing close-bracket then open-paren of 1+(2+3]+4', () => {
				mq.typedText('1+(2+3]+4');
				assertLatex('1+\\left(2+3\\right]+4');
				mq.keystroke('Left Left Backspace');
				assertLatex('1+\\left(2+3+4\\right)');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('backspacing open-paren of 1+(2+3]+4', () => {
				mq.typedText('1+(2+3]+4');
				assertLatex('1+\\left(2+3\\right]+4');
				mq.keystroke('Left Left Left Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('backspacing close-bracket then open-paren of 1+(2+3] (nothing after paren group)', () => {
				mq.typedText('1+(2+3]');
				assertLatex('1+\\left(2+3\\right]');
				mq.keystroke('Backspace');
				assertLatex('1+\\left(2+3\\right)');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('1+2+3');
			});

			test('backspacing open-paren of 1+(2+3] (nothing after paren group)', () => {
				mq.typedText('1+(2+3]');
				assertLatex('1+\\left(2+3\\right]');
				mq.keystroke('Left Left Left Left Backspace');
				assertLatex('1+2+3');
			});

			test('backspacing close-bracket then open-paren of (2+3]+4 (nothing before paren group)', () => {
				mq.typedText('(2+3]+4');
				assertLatex('\\left(2+3\\right]+4');
				mq.keystroke('Left Left Backspace');
				assertLatex('\\left(2+3+4\\right)');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('2+3+4');
			});

			test('backspacing open-paren of (2+3]+4 (nothing before paren group)', () => {
				mq.typedText('(2+3]+4');
				assertLatex('\\left(2+3\\right]+4');
				mq.keystroke('Left Left Left Left Left Left Backspace');
				assertLatex('2+3+4');
			});

			function assertParenBlockNonEmpty() {
				const parenBlock = jQuery(mq.el()).find('.mq-paren+span');
				assert.equal(parenBlock.length, 1, 'exactly 1 paren block');
				assert.ok(!parenBlock.hasClass('mq-empty'),
					'paren block auto-expanded, should no longer be gray');
			}

			test('backspacing close-bracket then open-paren of 1+(]+4 (empty paren group)', () => {
				mq.typedText('1+(]+4');
				assertLatex('1+\\left(\\right]+4');
				mq.keystroke('Left Left Backspace');
				assertLatex('1+\\left(+4\\right)');
				assertParenBlockNonEmpty();
				mq.keystroke('Backspace');
				assertLatex('1++4');
			});

			test('backspacing open-paren of 1+(]+4 (empty paren group)', () => {
				mq.typedText('1+(]+4');
				assertLatex('1+\\left(\\right]+4');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('1++4');
			});

			test('backspacing close-bracket then open-paren of 1+(] (empty paren group, nothing after)', () => {
				mq.typedText('1+(]');
				assertLatex('1+\\left(\\right]');
				mq.keystroke('Backspace');
				assertLatex('1+\\left(\\right)');
				mq.keystroke('Backspace');
				assertLatex('1+');
			});

			test('backspacing open-paren of 1+(] (empty paren group, nothing after)', () => {
				mq.typedText('1+(]');
				assertLatex('1+\\left(\\right]');
				mq.keystroke('Left Backspace');
				assertLatex('1+');
			});

			test('backspacing close-bracket then open-paren of (]+4 (empty paren group, nothing before)', () => {
				mq.typedText('(]+4');
				assertLatex('\\left(\\right]+4');
				mq.keystroke('Left Left Backspace');
				assertLatex('\\left(+4\\right)');
				assertParenBlockNonEmpty();
				mq.keystroke('Backspace');
				assertLatex('+4');
			});

			test('backspacing open-paren of (]+4 (empty paren group, nothing before)', () => {
				mq.typedText('(]+4');
				assertLatex('\\left(\\right]+4');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('+4');
			});

			test('rendering mismatched brackets 1+(2+3]+4 from LaTeX then backspacing close-bracket then open-paren',
				() => {
					mq.latex('1+\\left(2+3\\right]+4');
					assertLatex('1+\\left(2+3\\right]+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('1+\\left(2+3+4\\right)');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1+2+3+4');
				}
			);

			test('rendering mismatched brackets 1+(2+3]+4 from LaTeX then backspacing open-paren', () => {
				mq.latex('1+\\left(2+3\\right]+4');
				assertLatex('1+\\left(2+3\\right]+4');
				mq.keystroke('Left Left Left Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('rendering paren group 1+(2+3)+4 from LaTeX then backspacing close-paren then open-paren', () => {
				mq.latex('1+\\left(2+3\\right)+4');
				assertLatex('1+\\left(2+3\\right)+4');
				mq.keystroke('Left Left Backspace');
				assertLatex('1+\\left(2+3+4\\right)');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('rendering paren group 1+(2+3)+4 from LaTeX then backspacing open-paren', () => {
				mq.latex('1+\\left(2+3\\right)+4');
				assertLatex('1+\\left(2+3\\right)+4');
				mq.keystroke('Left Left Left Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('wrapping selection in parens 1+(2+3)+4 then backspacing close-paren then open-paren', () => {
				mq.typedText('1+2+3+4');
				assertLatex('1+2+3+4');
				mq.keystroke('Left Left Shift-Left Shift-Left Shift-Left').typedText(')');
				assertLatex('1+\\left(2+3\\right)+4');
				mq.keystroke('Backspace');
				assertLatex('1+\\left(2+3+4\\right)');
				mq.keystroke('Left Left Left Backspace');
				assertLatex('1+2+3+4');
			});

			test('wrapping selection in parens 1+(2+3)+4 then backspacing open-paren', () => {
				mq.typedText('1+2+3+4');
				assertLatex('1+2+3+4');
				mq.keystroke('Left Left Shift-Left Shift-Left Shift-Left').typedText('(');
				assertLatex('1+\\left(2+3\\right)+4');
				mq.keystroke('Backspace');
				assertLatex('1+2+3+4');
			});

			test('backspacing close-bracket of 1+(2+3] (nothing after) then typing', () => {
				mq.typedText('1+(2+3]');
				assertLatex('1+\\left(2+3\\right]');
				mq.keystroke('Backspace');
				assertLatex('1+\\left(2+3\\right)');
				mq.typedText('+4');
				assertLatex('1+\\left(2+3+4\\right)');
			});

			test('backspacing open-paren of (2+3]+4 (nothing before) then typing', () => {
				mq.typedText('(2+3]+4');
				assertLatex('\\left(2+3\\right]+4');
				mq.keystroke('Home Right Backspace');
				assertLatex('2+3+4');
				mq.typedText('1+');
				assertLatex('1+2+3+4');
			});

			test('backspacing paren containing a one-sided paren 0+[(1+2)+3]+4', () => {
				mq.typedText('0+[1+2+3]+4');
				assertLatex('0+\\left[1+2+3\\right]+4');
				mq.keystroke('Left Left Left Left Left').typedText(')');
				assertLatex('0+\\left[\\left(1+2\\right)+3\\right]+4');
				mq.keystroke('Right Right Right Backspace');
				assertLatex('0+\\left[1+2\\right)+3+4');
			});

			test('backspacing paren inside a one-sided paren (0+[1+2]+3)+4', () => {
				mq.typedText('0+[1+2]+3)+4');
				assertLatex('\\left(0+\\left[1+2\\right]+3\\right)+4');
				mq.keystroke('Left Left Left Left Left Backspace');
				assertLatex('0+\\left[1+2+3\\right)+4');
			});

			test('backspacing paren containing and inside a one-sided paren (([1+2]))', () => {
				mq.typedText('(1+2))');
				assertLatex('\\left(\\left(1+2\\right)\\right)');
				mq.keystroke('Left Left').typedText(']');
				assertLatex('\\left(\\left(\\left[1+2\\right]\\right)\\right)');
				mq.keystroke('Right Backspace');
				assertLatex('\\left(\\left(1+2\\right]\\right)');
				mq.keystroke('Backspace');
				assertLatex('\\left(1+2\\right)');
			});

			test('auto-expanding calls .siblingCreated() on new siblings 1+((2+3))', () => {
				mq.typedText('1+((2+3))');
				assertLatex('1+\\left(\\left(2+3\\right)\\right)');
				mq.keystroke('Left Left Left Left Left Left Del');
				assertLatex('1+\\left(\\left(2+3\\right)\\right)');
				mq.keystroke('Left Left Del');
				assertLatex('\\left(1+\\left(2+3\\right)\\right)');
				// now check that the inner open-paren isn't still a ghost
				mq.keystroke('Right Right Right Right Del');
				assertLatex('1+\\left(2+3\\right)');
			});

			test('that unwrapping calls .siblingCreated() on new siblings ((1+2)+(3+4))+5', () => {
				mq.typedText('(1+2+3+4)+5');
				assertLatex('\\left(1+2+3+4\\right)+5');
				mq.keystroke('Home Right Right Right Right').typedText(')');
				assertLatex('\\left(\\left(1+2\\right)+3+4\\right)+5');
				mq.keystroke('Right').typedText('(');
				assertLatex('\\left(\\left(1+2\\right)+\\left(3+4\\right)\\right)+5');
				mq.keystroke('Right Right Right Right Right Backspace');
				assertLatex('\\left(1+2\\right)+\\left(3+4\\right)+5');
				mq.keystroke('Left Left Left Left Backspace');
				assertLatex('\\left(1+2\\right)+3+4+5');
			});

			test('typing Ctrl-Backspace deletes everything to the left of the cursor', function () {
				mq.typedText('12345');
				assertLatex('12345');
				mq.keystroke('Left Left');
				mq.keystroke('Ctrl-Backspace');
				assertLatex('45');
				mq.keystroke('Ctrl-Backspace');
				assertLatex('45');
			});

			test('typing Ctrl-Del deletes everything to the right of the cursor', function () {
				mq.typedText('12345');
				assertLatex('12345');
				mq.keystroke('Left Left');
				mq.keystroke('Ctrl-Del');
				assertLatex('123');
				mq.keystroke('Ctrl-Del');
				assertLatex('123');
			});

			suite('pipes', () => {
				test('typing then backspacing a pipe in the middle of 1+2+3+4', () => {
					mq.typedText('1+2+3+4');
					assertLatex('1+2+3+4');
					mq.keystroke('Left Left Left').typedText('|');
					assertLatex('1+2+\\left|3+4\\right|');
					mq.keystroke('Backspace');
					assertLatex('1+2+3+4');
				});

				test('backspacing close-pipe then open-pipe of 1+|2+3|+4', () => {
					mq.typedText('1+|2+3|+4');
					assertLatex('1+\\left|2+3\\right|+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('1+\\left|2+3+4\\right|');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('backspacing open-pipe of 1+|2+3|+4', () => {
					mq.typedText('1+|2+3|+4');
					assertLatex('1+\\left|2+3\\right|+4');
					mq.keystroke('Left Left Left Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('backspacing close-pipe then open-pipe of 1+|2+3| (nothing after pipe pair)', () => {
					mq.typedText('1+|2+3|');
					assertLatex('1+\\left|2+3\\right|');
					mq.keystroke('Backspace');
					assertLatex('1+\\left|2+3\\right|');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1+2+3');
				});

				test('backspacing open-pipe of 1+|2+3| (nothing after pipe pair)', () => {
					mq.typedText('1+|2+3|');
					assertLatex('1+\\left|2+3\\right|');
					mq.keystroke('Left Left Left Left Backspace');
					assertLatex('1+2+3');
				});

				test('backspacing close-pipe then open-pipe of |2+3|+4 (nothing before pipe pair)', () => {
					mq.typedText('|2+3|+4');
					assertLatex('\\left|2+3\\right|+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('\\left|2+3+4\\right|');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('2+3+4');
				});

				test('backspacing open-pipe of |2+3|+4 (nothing before pipe pair)', () => {
					mq.typedText('|2+3|+4');
					assertLatex('\\left|2+3\\right|+4');
					mq.keystroke('Left Left Left Left Left Left Backspace');
					assertLatex('2+3+4');
				});

				function assertParenBlockNonEmpty() {
					const parenBlock = jQuery(mq.el()).find('.mq-paren+span');
					assert.equal(parenBlock.length, 1, 'exactly 1 paren block');
					assert.ok(!parenBlock.hasClass('mq-empty'),
						'paren block auto-expanded, should no longer be gray');
				}

				test('backspacing close-pipe then open-pipe of 1+||+4 (empty pipe pair)', () => {
					mq.typedText('1+||+4');
					assertLatex('1+\\left|\\right|+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('1+\\left|+4\\right|');
					assertParenBlockNonEmpty();
					mq.keystroke('Backspace');
					assertLatex('1++4');
				});

				test('backspacing open-pipe of 1+||+4 (empty pipe pair)', () => {
					mq.typedText('1+||+4');
					assertLatex('1+\\left|\\right|+4');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1++4');
				});

				test('backspacing close-pipe then open-pipe of 1+|| (empty pipe pair, nothing after)', () => {
					mq.typedText('1+||');
					assertLatex('1+\\left|\\right|');
					mq.keystroke('Backspace');
					assertLatex('1+\\left|\\right|');
					mq.keystroke('Backspace');
					assertLatex('1+');
				});

				test('backspacing open-pipe of 1+|| (empty pipe pair, nothing after)', () => {
					mq.typedText('1+||');
					assertLatex('1+\\left|\\right|');
					mq.keystroke('Left Backspace');
					assertLatex('1+');
				});

				test('backspacing close-pipe then open-pipe of ||+4 (empty pipe pair, nothing before)', () => {
					mq.typedText('||+4');
					assertLatex('\\left|\\right|+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('\\left|+4\\right|');
					assertParenBlockNonEmpty();
					mq.keystroke('Backspace');
					assertLatex('+4');
				});

				test('backspacing open-pipe of ||+4 (empty pipe pair, nothing before)', () => {
					mq.typedText('||+4');
					assertLatex('\\left|\\right|+4');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('+4');
				});

				test('rendering pipe pair 1+|2+3|+4 from LaTeX then backspacing close-pipe then open-pipe', () => {
					mq.latex('1+\\left|2+3\\right|+4');
					assertLatex('1+\\left|2+3\\right|+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('1+\\left|2+3+4\\right|');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('rendering pipe pair 1+|2+3|+4 from LaTeX then backspacing open-pipe', () => {
					mq.latex('1+\\left|2+3\\right|+4');
					assertLatex('1+\\left|2+3\\right|+4');
					mq.keystroke('Left Left Left Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('rendering mismatched paren/pipe group 1+|2+3)+4 from LaTeX ' +
					'then backspacing close-paren then open-pipe', () => {
					mq.latex('1+\\left|2+3\\right)+4');
					assertLatex('1+\\left|2+3\\right)+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('1+\\left|2+3+4\\right|');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('rendering mismatched paren/pipe group 1+|2+3)+4 from LaTeX then backspacing open-pipe', () => {
					mq.latex('1+\\left|2+3\\right)+4');
					assertLatex('1+\\left|2+3\\right)+4');
					mq.keystroke('Left Left Left Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('rendering mismatched paren/pipe group 1+(2+3|+4 from LaTeX ' +
					'then backspacing close-pipe then open-paren', () => {
					mq.latex('1+\\left(2+3\\right|+4');
					assertLatex('1+\\left(2+3\\right|+4');
					mq.keystroke('Left Left Backspace');
					assertLatex('1+\\left(2+3+4\\right)');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('rendering mismatched paren/pipe group 1+(2+3|+4 from LaTeX then backspacing open-paren', () => {
					mq.latex('1+\\left(2+3\\right|+4');
					assertLatex('1+\\left(2+3\\right|+4');
					mq.keystroke('Left Left Left Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('wrapping selection in pipes 1+|2+3|+4 then backspacing open-pipe', () => {
					mq.typedText('1+2+3+4');
					assertLatex('1+2+3+4');
					mq.keystroke('Left Left Shift-Left Shift-Left Shift-Left').typedText('|');
					assertLatex('1+\\left|2+3\\right|+4');
					mq.keystroke('Backspace');
					assertLatex('1+2+3+4');
				});

				test('wrapping selection in pipes 1+|2+3|+4 then backspacing close-pipe then open-pipe', () => {
					mq.typedText('1+2+3+4');
					assertLatex('1+2+3+4');
					mq.keystroke('Left Left Shift-Left Shift-Left Shift-Left').typedText('|');
					assertLatex('1+\\left|2+3\\right|+4');
					mq.keystroke('Tab Backspace');
					assertLatex('1+\\left|2+3+4\\right|');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('1+2+3+4');
				});

				test('backspacing close-pipe of 1+|2+3| (nothing after) then typing', () => {
					mq.typedText('1+|2+3|');
					assertLatex('1+\\left|2+3\\right|');
					mq.keystroke('Backspace');
					assertLatex('1+\\left|2+3\\right|');
					mq.typedText('+4');
					assertLatex('1+\\left|2+3+4\\right|');
				});

				test('backspacing open-pipe of |2+3|+4 (nothing before) then typing', () => {
					mq.typedText('|2+3|+4');
					assertLatex('\\left|2+3\\right|+4');
					mq.keystroke('Home Right Backspace');
					assertLatex('2+3+4');
					mq.typedText('1+');
					assertLatex('1+2+3+4');
				});

				test('backspacing pipe containing a one-sided pipe 0+|1+|2+3||+4', () => {
					mq.typedText('0+|1+2+3|+4');
					assertLatex('0+\\left|1+2+3\\right|+4');
					mq.keystroke('Left Left Left Left Left Left').typedText('|');
					assertLatex('0+\\left|1+\\left|2+3\\right|\\right|+4');
					mq.keystroke('Shift-Tab Shift-Tab Del');
					assertLatex('0+1+\\left|2+3\\right|+4');
				});

				test('backspacing pipe inside a one-sided pipe 0+|1+|2+3|+4|', () => {
					mq.typedText('0+1+|2+3|+4');
					assertLatex('0+1+\\left|2+3\\right|+4');
					mq.keystroke('Home Right Right').typedText('|');
					assertLatex('0+\\left|1+\\left|2+3\\right|+4\\right|');
					mq.keystroke('Right Right Del');
					assertLatex('0+\\left|1+2+3\\right|+4');
				});

				test('backspacing pipe containing and inside a one-sided pipe |0+|1+|2+3||+4|', () => {
					mq.typedText('0+|1+2+3|+4');
					assertLatex('0+\\left|1+2+3\\right|+4');
					mq.keystroke('Home').typedText('|');
					assertLatex('\\left|0+\\left|1+2+3\\right|+4\\right|');
					mq.keystroke('Right Right Right Right Right').typedText('|');
					assertLatex('\\left|0+\\left|1+\\left|2+3\\right|\\right|+4\\right|');
					mq.keystroke('Left Left Left Backspace');
					assertLatex('\\left|0+1+\\left|2+3\\right|+4\\right|');
				});

				test('backspacing pipe containing a one-sided pipe facing same way 0+||1+2||+3', () => {
					mq.typedText('0+|1+2|+3');
					assertLatex('0+\\left|1+2\\right|+3');
					mq.keystroke('Home Right Right Right').typedText('|');
					assertLatex('0+\\left|\\left|1+2\\right|\\right|+3');
					mq.keystroke('Tab Tab Backspace');
					assertLatex('0+\\left|\\left|1+2\\right|+3\\right|');
				});

				test('backspacing pipe inside a one-sided pipe facing same way 0+|1+|2+3|+4|', () => {
					mq.typedText('0+1+|2+3|+4');
					assertLatex('0+1+\\left|2+3\\right|+4');
					mq.keystroke('Home Right Right').typedText('|');
					assertLatex('0+\\left|1+\\left|2+3\\right|+4\\right|');
					mq.keystroke('Right Right Right Right Right Right Right Backspace');
					assertLatex('0+\\left|1+\\left|2+3+4\\right|\\right|');
				});

				test('backspacing open-paren of mismatched paren/pipe group containing a one-sided pipe 0+(1+|2+3||+4',
					() => {
						mq.latex('0+\\left(1+2+3\\right|+4');
						assertLatex('0+\\left(1+2+3\\right|+4');
						mq.keystroke('Left Left Left Left Left Left').typedText('|');
						assertLatex('0+\\left(1+\\left|2+3\\right|\\right|+4');
						mq.keystroke('Shift-Tab Shift-Tab Del');
						assertLatex('0+1+\\left|2+3\\right|+4');
					}
				);

				test('backspacing open-paren of mismatched paren/pipe group inside a one-sided pipe 0+|1+(2+3|+4|',
					() => {
						mq.latex('0+1+\\left(2+3\\right|+4');
						assertLatex('0+1+\\left(2+3\\right|+4');
						mq.keystroke('Home Right Right').typedText('|');
						assertLatex('0+\\left|1+\\left(2+3\\right|+4\\right|');
						mq.keystroke('Right Right Del');
						assertLatex('0+\\left|1+2+3\\right|+4');
					}
				);
			});
		}

		suite('typing outside ghost paren', () => {
			test('typing outside ghost paren solidifies ghost 1+(2+3)', () => {
				mq.typedText('1+(2+3');
				assertLatex('1+\\left(2+3\\right)');
				mq.keystroke('Right').typedText('+4');
				assertLatex('1+\\left(2+3\\right)+4');
				mq.keystroke('Left Left Left Left Left Left Left Del');
				assertLatex('\\left(1+2+3\\right)+4');
			});

			test('selected and replaced by LiveFraction solidifies ghosts (1+2)/( )', () => {
				mq.typedText('1+2)/');
				assertLatex('\\frac{\\left(1+2\\right)}{ }');
				mq.keystroke('Left Backspace');
				assertLatex('\\frac{\\left(1+2\\right)}{ }');
			});

			test('close paren group by typing close-bracket outside ghost paren (1+2]', () => {
				mq.typedText('(1+2');
				assertLatex('\\left(1+2\\right)');
				mq.keystroke('Right').typedText(']');
				assertLatex('\\left(1+2\\right]');
			});

			test('close adjacent paren group before containing paren group (1+(2+3])', () => {
				mq.typedText('(1+(2+3');
				assertLatex('\\left(1+\\left(2+3\\right)\\right)');
				mq.keystroke('Right').typedText(']');
				assertLatex('\\left(1+\\left(2+3\\right]\\right)');
				mq.typedText(']');
				assertLatex('\\left(1+\\left(2+3\\right]\\right]');
			});

			test('can type close-bracket on solid side of one-sided paren [](1+2)', () => {
				mq.typedText('(1+2');
				assertLatex('\\left(1+2\\right)');
				mq.moveToLeftEnd().typedText(']');
				assertLatex('\\left[\\right]\\left(1+2\\right)');
			});

			suite('pipes', () => {
				test('close pipe pair from outside to the right |1+2|', () => {
					mq.typedText('|1+2');
					assertLatex('\\left|1+2\\right|');
					mq.keystroke('Right').typedText('|');
					assertLatex('\\left|1+2\\right|');
					mq.keystroke('Home Del');
					assertLatex('\\left|1+2\\right|');
				});

				test('close pipe pair from outside to the left |1+2|', () => {
					mq.typedText('|1+2|');
					assertLatex('\\left|1+2\\right|');
					mq.keystroke('Home Del');
					assertLatex('\\left|1+2\\right|');
					mq.keystroke('Left').typedText('|');
					assertLatex('\\left|1+2\\right|');
					mq.keystroke('Ctrl-End Backspace');
					assertLatex('\\left|1+2\\right|');
				});

				test('can type pipe on solid side of one-sided pipe ||||', () => {
					mq.typedText('|');
					assertLatex('\\left|\\right|');
					mq.moveToLeftEnd().typedText('|');
					assertLatex('\\left|\\left|\\right|\\right|');
				});
			});
		});
	});

	suite('autoCommands', () => {
		setup(() => {
			mq.config({
				autoOperatorNames: 'sin pp',
				autoCommands: 'pi tau phi theta Gamma sum prod sqrt nthroot'
			});
		});

		test('individual commands', () =>{
			mq.typedText('sum' + 'n=0');
			mq.keystroke('Up').typedText('100').keystroke('Right');
			assertLatex('\\sum_{n=0}^{100}');
			mq.keystroke('Ctrl-Backspace');

			mq.typedText('prod');
			mq.typedText('n=0').keystroke('Up').typedText('100').keystroke('Right');
			assertLatex('\\prod_{n=0}^{100}');
			mq.keystroke('Ctrl-Backspace');

			mq.typedText('sqrt');
			mq.typedText('100').keystroke('Right');
			assertLatex('\\sqrt{100}');
			mq.keystroke('Ctrl-Backspace');

			mq.typedText('nthroot');
			mq.typedText('n').keystroke('Right').typedText('100').keystroke('Right');
			assertLatex('\\sqrt[n]{100}');
			mq.keystroke('Ctrl-Backspace');

			mq.typedText('pi');
			assertLatex('\\pi');
			mq.keystroke('Backspace');

			mq.typedText('tau');
			assertLatex('\\tau');
			mq.keystroke('Backspace');

			mq.typedText('phi');
			assertLatex('\\phi');
			mq.keystroke('Backspace');

			mq.typedText('theta');
			assertLatex('\\theta');
			mq.keystroke('Backspace');

			mq.typedText('Gamma');
			assertLatex('\\Gamma');
			mq.keystroke('Backspace');
		});

		test('sequences of auto-commands and other assorted characters', () => {
			mq.typedText('sin' + 'pi');
			assertLatex('\\sin\\pi');
			mq.keystroke('Left Backspace');
			assertLatex('si\\pi');
			mq.keystroke('Left').typedText('p');
			assertLatex('spi\\pi');
			mq.typedText('i');
			assertLatex('s\\pi i\\pi');
			mq.typedText('p');
			assertLatex('s\\pi pi\\pi');
			mq.keystroke('Right').typedText('n');
			assertLatex('s\\pi pin\\pi');
			mq.keystroke('Left Left Left').typedText('s');
			assertLatex('s\\pi spin\\pi');
			mq.keystroke('Backspace');
			assertLatex('s\\pi pin\\pi');
			mq.keystroke('Del').keystroke('Backspace');
			assertLatex('\\sin\\pi');
		});

		test('has lower "precedence" than operator names', () => {
			mq.typedText('ppi');
			assertLatex('\\operatorname{pp}i');
			mq.keystroke('Left Left').typedText('i');
			assertLatex('\\pi pi');
		});

		test('command contains non-letters', () => assert.throws(() => MQ.config({ autoCommands: 'e1' })));

		test('command length less than 2', () => assert.throws(() => MQ.config({ autoCommands: 'e' })));

		test('command is a built-in operator name', () => {
			const cmds = ('Pr arg deg det dim exp gcd hom ker lg lim ln log max min sup'
				+ ' limsup liminf injlim projlim Pr').split(' ');
			for (const cmd of cmds) {
				assert.throws(() => MQ.config({ autoCommands: cmd }), `MQ.config({ autoCommands: "${cmd}" })`);
			}
		});

		test('built-in operator names even after auto-operator names overridden', () => {
			MQ.config({ autoOperatorNames: 'sin arcosh cosh cos cosec csc' });
			// ^ happen to be the ones required by autoOperatorNames.test.js
			const cmds = 'Pr arg deg det exp gcd lg lim ln log max min sup'.split(' ');
			for (const cmd of cmds) {
				assert.throws(() => MQ.config({ autoCommands: cmd }), `MQ.config({ autoCommands: "${cmd}" })`);
			}
		});

		suite('command list not perfectly space-delimited', () => {
			test('double space', () => assert.throws(() => MQ.config({ autoCommands: 'pi  theta' })));

			test('leading space', () => assert.throws(() => MQ.config({ autoCommands: ' pi' })));

			test('trailing space', () => assert.throws(() => MQ.config({ autoCommands: 'pi ' })));
		});
	});

	suite('inequalities', () => {
		// assertFullyFunctioningInequality() checks not only that the inequality
		// has the right LaTeX and when you backspace it has the right LaTeX,
		// but also that when you backspace you get the right state such that
		// you can either type = again to get the non-strict inequality again,
		// or backspace again and it'll delete correctly.
		function assertFullyFunctioningInequality(nonStrict, strict) {
			assertLatex(nonStrict);
			mq.keystroke('Backspace');
			assertLatex(strict);
			mq.typedText('=');
			assertLatex(nonStrict);
			mq.keystroke('Backspace');
			assertLatex(strict);
			mq.keystroke('Backspace');
			assertLatex('');
		}
		test('typing and backspacing <= and >=', () => {
			mq.typedText('<');
			assertLatex('<');
			mq.typedText('=');
			assertFullyFunctioningInequality('\\le', '<');

			mq.typedText('>');
			assertLatex('>');
			mq.typedText('=');
			assertFullyFunctioningInequality('\\ge', '>');

			mq.typedText('<<>>==>><<==');
			assertLatex('<<>\\ge=>><\\le=');
		});

		test('typing ≤ and ≥ chars directly', () => {
			mq.typedText('≤');
			assertFullyFunctioningInequality('\\le', '<');

			mq.typedText('≥');
			assertFullyFunctioningInequality('\\ge', '>');
		});

		suite('rendered from LaTeX', () => {
			test('control sequences', () => {
				mq.latex('\\le');
				assertFullyFunctioningInequality('\\le', '<');

				mq.latex('\\ge');
				assertFullyFunctioningInequality('\\ge', '>');
			});

			test('≤ and ≥ chars', () => {
				mq.latex('≤');
				assertFullyFunctioningInequality('\\le', '<');

				mq.latex('≥');
				assertFullyFunctioningInequality('\\ge', '>');
			});
		});
	});

	suite('SupSub behavior options', () => {
		test('charsThatBreakOutOfSupSub', () => {
			assert.equal(mq.typedText('x^2n+y').latex(), 'x^{2n+y}');
			mq.latex('');
			assert.equal(mq.typedText('x^+2n').latex(), 'x^{+2n}');
			mq.latex('');
			assert.equal(mq.typedText('x^-2n').latex(), 'x^{-2n}');
			mq.latex('');
			assert.equal(mq.typedText('x^=2n').latex(), 'x^{=2n}');
			mq.latex('');

			MQ.config({ charsThatBreakOutOfSupSub: '+-=<>' });

			assert.equal(mq.typedText('x^2n+y').latex(), 'x^{2n}+y');
			mq.latex('');

			// Unary operators never break out of exponents.
			assert.equal(mq.typedText('x^+2n').latex(), 'x^{+2n}');
			mq.latex('');
			assert.equal(mq.typedText('x^-2n').latex(), 'x^{-2n}');
			mq.latex('');
			assert.equal(mq.typedText('x^=2n').latex(), 'x^{=2n}');
			mq.latex('');

			// Only break out of exponents if cursor at the end, don't
			// jump from the middle of the exponent out to the right.
			assert.equal(mq.typedText('x^ab').latex(), 'x^{ab}');
			assert.equal(mq.keystroke('Left').typedText('+').latex(), 'x^{a+b}');
			mq.latex('');
		});
		test('supSubsRequireOperand', () => {
			assert.equal(mq.typedText('^').latex(), '^{ }');
			assert.equal(mq.typedText('2').latex(), '^2');
			assert.equal(mq.typedText('n').latex(), '^{2n}');
			mq.latex('');
			assert.equal(mq.typedText('x').latex(), 'x');
			assert.equal(mq.typedText('^').latex(), 'x^{ }');
			assert.equal(mq.typedText('2').latex(), 'x^2');
			assert.equal(mq.typedText('n').latex(), 'x^{2n}');
			mq.latex('');
			assert.equal(mq.typedText('x').latex(), 'x');
			assert.equal(mq.typedText('^').latex(), 'x^{ }');
			assert.equal(mq.typedText('^').latex(), 'x^{^{ }}');
			assert.equal(mq.typedText('2').latex(), 'x^{^2}');
			assert.equal(mq.typedText('n').latex(), 'x^{^{2n}}');
			mq.latex('');
			assert.equal(mq.typedText('2').latex(), '2');
			assert.equal(mq.keystroke('Shift-Left').typedText('^').latex(), '^2');

			mq.latex('');
			MQ.config({ supSubsRequireOperand: true });

			assert.equal(mq.typedText('^').latex(), '');
			assert.equal(mq.typedText('2').latex(), '2');
			assert.equal(mq.typedText('n').latex(), '2n');
			mq.latex('');
			assert.equal(mq.typedText('x').latex(), 'x');
			assert.equal(mq.typedText('^').latex(), 'x^{ }');
			assert.equal(mq.typedText('2').latex(), 'x^2');
			assert.equal(mq.typedText('n').latex(), 'x^{2n}');
			mq.latex('');
			assert.equal(mq.typedText('x').latex(), 'x');
			assert.equal(mq.typedText('^').latex(), 'x^{ }');
			assert.equal(mq.typedText('^').latex(), 'x^{ }');
			assert.equal(mq.typedText('2').latex(), 'x^2');
			assert.equal(mq.typedText('n').latex(), 'x^{2n}');
			mq.latex('');
			assert.equal(mq.typedText('2').latex(), '2');
			assert.equal(mq.keystroke('Shift-Left').typedText('^').latex(), '2');
		});
	});

	suite('alternative symbols when typing / and *', () => {
		test('typingSlashWritesDivisionSymbol', () => {
			mq.typedText('/');
			assertLatex('\\frac{ }{ }');

			mq.config({ typingSlashWritesDivisionSymbol: true });

			mq.keystroke('Backspace').typedText('/');
			assertLatex('\\div');
		});
		test('typingAsteriskWritesTimesSymbol', () => {
			mq.typedText('*');
			assertLatex('\\cdot');

			mq.config({ typingAsteriskWritesTimesSymbol: true });

			mq.keystroke('Backspace').typedText('*');
			assertLatex('\\times');
		});
	});
});
