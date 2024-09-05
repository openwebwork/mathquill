/* global suite, test, assert, setup, teardown, MQ, MQBasic */

import { L, R } from 'src/constants';

suite('Public API', () => {
	suite('global functions', () => {
		test('undefined', () => {
			assert.equal(MQ(), undefined);
			assert.equal(MQ(0), undefined);
			assert.equal(MQ('<span/>'), undefined);
			assert.equal(MQ(document.createElement('span')), undefined);
			assert.equal(MQ.MathField(), undefined);
			assert.equal(MQ.MathField(0), undefined);
			assert.equal(MQ.MathField('<span/>'), undefined);
		});

		test('MQ.MathField()', () => {
			const el = document.createElement('span');
			el.textContent = 'x^2';
			const mathField = MQ.MathField(el);
			assert.ok(mathField instanceof MQ.MathField);
		});

		test('identity of API object returned by MQ()', () => {
			const mathFieldSpan = document.createElement('span');
			const mathField = MQ.MathField(mathFieldSpan);

			assert.ok(MQ(mathFieldSpan) === mathField);

			assert.equal(MQ(mathFieldSpan).id, mathField.id);
			assert.equal(MQ(mathFieldSpan).id, MQ(mathFieldSpan).id);

			assert.equal(MQ(mathFieldSpan).data, mathField.data);
			assert.equal(MQ(mathFieldSpan).data, MQ(mathFieldSpan).data);
		});

		test('blurred when created', () => {
			const el = document.createElement('span');
			MQ.MathField(el);
			const rootBlock = el.querySelector('.mq-root-block');
			assert.ok(rootBlock.classList.contains('mq-empty'));
			assert.ok(!rootBlock.classList.contains('mq-has-cursor'));
		});
	});

	suite('mathquill-basic', () => {
		let mq;
		setup(() => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			mq = MQBasic.MathField(el);
		});

		test('typing \\', () => {
			mq.typedText('\\');
			assert.equal(mq.latex(), '\\backslash');
		});

		test('typing $', () => {
			mq.typedText('$');
			assert.equal(mq.latex(), '\\$');
		});

		test('parsing of advanced symbols', () => {
			mq.latex('\\oplus');
			assert.equal(mq.latex(), ''); // TODO: better LaTeX parse error behavior
		});
	});

	suite('basic API methods', () => {
		let mq;
		setup(() => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			mq = MQ.MathField(el);
		});

		test('.revert()', () => {
			const el = document.createElement('span');
			el.innerHTML = 'some <code>HTML</code>';
			const mq = MQ.MathField(el);
			assert.equal(mq.revert().innerHTML, 'some <code>HTML</code>');
		});

		test('select, clearSelection', () => {
			mq.latex('n+\\frac{n}{2}');
			assert.ok(!mq.__controller.cursor.selection);
			mq.select();
			assert.equal(mq.__controller.cursor.selection.join('latex'), 'n+\\frac{n}{2}');
			mq.clearSelection();
			assert.ok(!mq.__controller.cursor.selection);
		});

		test("latex while there's a selection", () => {
			mq.latex('a');
			assert.equal(mq.latex(), 'a');
			mq.select();
			assert.equal(mq.__controller.cursor.selection.join('latex'), 'a');
			mq.latex('b');
			assert.equal(mq.latex(), 'b');
			mq.typedText('c');
			assert.equal(mq.latex(), 'bc');
		});

		test('.html() trivial case', () => {
			mq.latex('x+y');
			assert.equal(mq.html(), '<var>x</var><span class="mq-binary-operator">+</span><var>y</var>');
		});

		test('.text() with incomplete commands', () => {
			assert.equal(mq.text(), '');
			mq.typedText('\\');
			assert.equal(mq.text(), '\\');
			mq.typedText('s');
			assert.equal(mq.text(), '\\s');
			mq.typedText('qrt');
			assert.equal(mq.text(), '\\sqrt');
		});

		test('.text() with complete commands', () => {
			mq.latex('\\sqrt{}');
			assert.equal(mq.text(), 'sqrt()');
			mq.latex('\\nthroot[]{}');
			assert.equal(mq.text(), 'sqrt()');
			mq.latex('\\frac{}{}');
			assert.equal(mq.text(), ' 0/1 ');
			mq.latex('\\frac{3}{5}');
			assert.equal(mq.text(), ' 3/5 ');
			mq.latex('\\frac{3+2}{5-1}');
			assert.equal(mq.text(), ' (3+2)/(5-1) ');
			mq.latex('\\div');
			assert.equal(mq.text(), '/');
			mq.latex('^{}');
			assert.equal(mq.text(), '');
			mq.latex('3^{4}');
			assert.equal(mq.text(), '3^4');
			mq.latex('3x+\\ 4');
			assert.equal(mq.text(), '3x+ 4');
			mq.latex('x^2');
			assert.equal(mq.text(), 'x^2');

			mq.latex('');
			mq.typedText('*2*3***4');
			assert.equal(mq.text(), '*2*3***4');
		});

		test('.moveToDirEnd(dir)', () => {
			mq.latex('a x^2 + b x + c = 0');
			assert.equal(mq.__controller.cursor[L].ctrlSeq, '0');
			assert.equal(mq.__controller.cursor[R], undefined);
			mq.moveToLeftEnd();
			assert.equal(mq.__controller.cursor[L], undefined);
			assert.equal(mq.__controller.cursor[R].ctrlSeq, 'a');
			mq.moveToRightEnd();
			assert.equal(mq.__controller.cursor[L].ctrlSeq, '0');
			assert.equal(mq.__controller.cursor[R], undefined);
		});

		test('.empty()', () => {
			mq.latex('xyz');
			mq.empty();
			assert.equal(mq.latex(), '');
		});
	});

	test('edit handler interface versioning', () => {
		let count = 0;

		const el = document.createElement('span');
		document.getElementById('mock')?.append(el);
		const mq2 = MQ.MathField(el, {
			handlers: {
				edit: (_mq) => {
					assert.equal(mq2.id, _mq.id);
					count += 1;
				}
			}
		});
		assert.equal(count, 0);
		mq2.latex('x^2');
		assert.equal(count, 2); // sigh, once for postOrder and once for bubble
	});

	suite('*OutOf handlers', () => {
		const testHandlers = (title, mathFieldMaker) => {
			test(title, () => {
				let enterCounter = 0,
					upCounter = 0,
					moveCounter = 0,
					deleteCounter = 0,
					dir = null;

				const mq = mathFieldMaker({
					handlers: {
						enter: function (_mq) {
							assert.equal(arguments.length, 1);
							assert.equal(_mq.id, mq.id);
							enterCounter += 1;
						},
						upOutOf: function (_mq) {
							assert.equal(arguments.length, 1);
							assert.equal(_mq.id, mq.id);
							upCounter += 1;
						},
						moveOutOf: function (_dir, _mq) {
							assert.equal(arguments.length, 2);
							assert.equal(_mq.id, mq.id);
							dir = _dir;
							moveCounter += 1;
						},
						deleteOutOf: function (_dir, _mq) {
							assert.equal(arguments.length, 2);
							assert.equal(_mq.id, mq.id);
							dir = _dir;
							deleteCounter += 1;
						}
					}
				});

				mq.latex('n+\\frac{n}{2}'); // starts at right edge
				assert.equal(moveCounter, 0);

				mq.typedText('\n'); // nothing happens
				assert.equal(enterCounter, 1);

				mq.keystroke('Right'); // stay at right edge
				assert.equal(moveCounter, 1);
				assert.equal(dir, R);

				mq.keystroke('Right'); // stay at right edge
				assert.equal(moveCounter, 2);
				assert.equal(dir, R);

				mq.keystroke('Left'); // right edge of denominator
				assert.equal(moveCounter, 2);
				assert.equal(upCounter, 0);

				mq.keystroke('Up'); // right edge of numerator
				assert.equal(moveCounter, 2);
				assert.equal(upCounter, 0);

				mq.keystroke('Up'); // stays at right edge of numerator
				assert.equal(upCounter, 1);

				mq.keystroke('Up'); // stays at right edge of numerator
				assert.equal(upCounter, 2);

				// go to left edge
				mq.keystroke('Left').keystroke('Left').keystroke('Left').keystroke('Left');
				assert.equal(moveCounter, 2);

				mq.keystroke('Left'); // stays at left edge
				assert.equal(moveCounter, 3);
				assert.equal(dir, L);
				assert.equal(deleteCounter, 0);

				mq.keystroke('Backspace'); // stays at left edge
				assert.equal(deleteCounter, 1);
				assert.equal(dir, L);

				mq.keystroke('Backspace'); // stays at left edge
				assert.equal(deleteCounter, 2);
				assert.equal(dir, L);

				mq.keystroke('Left'); // stays at left edge
				assert.equal(moveCounter, 4);
				assert.equal(dir, L);

				const mock = document.getElementById('mock');
				while (mock.firstChild) mock.firstChild.remove();
			});
		};

		testHandlers('MQ.MathField() constructor', (options) => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			return MQ.MathField(el, options);
		});

		testHandlers('MQ.StaticMath() constructor', (options) => {
			const el = document.createElement('span');
			el.textContent = '\\MathQuillMathField{}';
			document.getElementById('mock')?.append(el);
			return MQ.StaticMath(el, options).innerFields[0];
		});

		testHandlers('MQ.MathField::config()', (options) => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			return MQ.MathField(el).config(options);
		});

		testHandlers('MQ.StaticMath::config() propagates down to \\MathQuillMathField{}', (options) => {
			const el = document.createElement('span');
			el.textContent = '\\MathQuillMathField{}';
			document.getElementById('mock')?.append(el);
			return MQ.StaticMath(el).config(options).innerFields[0];
		});

		testHandlers(
			'.config() directly on a \\MathQuillMathField{} in a MQ.StaticMath using .innerFields',
			(options) => {
				const el = document.createElement('span');
				el.textContent = '\\MathQuillMathField{}';
				document.getElementById('mock')?.append(el);
				return MQ.StaticMath(el).innerFields[0].config(options);
			}
		);

		suite('global MQ.config()', () => {
			testHandlers('a MQ.MathField', (options) => {
				const el = document.createElement('span');
				document.getElementById('mock')?.append(el);
				MQ.config(options);
				return MQ.MathField(el);
			});

			testHandlers('\\MathQuillMathField{} in a MQ.StaticMath', (options) => {
				const el = document.createElement('span');
				el.textContent = '\\MathQuillMathField{}';
				document.getElementById('mock')?.append(el);
				MQ.config(options);
				return MQ.StaticMath(el).innerFields[0];
			});

			teardown(() => MQ.config({ handlers: undefined }));
		});
	});

	suite('edit handler', () => {
		test('fires when closing a bracket expression', () => {
			let count = 0;

			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);

			const mq = MQ.MathField(el, { handlers: { edit: () => ++count } });
			mq.typedText('(3, 4');
			const countBeforeClosingBracket = count;
			mq.typedText(']');
			assert.equal(count, countBeforeClosingBracket + 1);
		});
	});

	suite('.cmd(...)', () => {
		let mq;

		setup(() => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			mq = MQ.MathField(el);
		});

		test('basic', () => {
			mq.cmd('x');
			assert.equal(mq.latex(), 'x');
			mq.cmd('y');
			assert.equal(mq.latex(), 'xy');
			mq.cmd('^');
			assert.equal(mq.latex(), 'xy^{ }');
			mq.cmd('2');
			assert.equal(mq.latex(), 'xy^2');
			mq.keystroke('Right Shift-Left Shift-Left Shift-Left').cmd('\\sqrt');
			assert.equal(mq.latex(), '\\sqrt{xy^2}');
			mq.typedText('*2**');
			assert.equal(mq.latex(), '\\sqrt{xy^2\\cdot2\\cdot\\cdot}');
		});

		test('backslash commands are passed their name', () => {
			mq.cmd('\\alpha');
			assert.equal(mq.latex(), '\\alpha');
		});

		test('replaces selection', () => {
			mq.typedText('49').select().cmd('\\sqrt');
			assert.equal(mq.latex(), '\\sqrt{49}');
		});

		test('operator name', () => {
			mq.cmd('\\ker');
			assert.equal(mq.latex(), '\\ker');
		});

		test('nonexistent LaTeX command is noop', () => {
			mq.typedText('49').select().cmd('\\asdf').cmd('\\sqrt');
			assert.equal(mq.latex(), '\\sqrt{49}');
		});

		test('overflow triggers automatic horizontal scroll', (done) => {
			const mqEl = mq.el();
			const rootEl = mq.__controller.root.elements.first;
			const cursor = mq.__controller.cursor;

			mqEl.style.width = '10px';
			const previousScrollLeft = rootEl.scrollLeft;

			mq.cmd('\\alpha');

			setTimeout(() => {
				cursor.show();

				try {
					assert.ok(rootEl.scrollLeft > previousScrollLeft, 'scrolls on cmd');
					assert.ok(
						mqEl.getBoundingClientRect().right > cursor.element.getBoundingClientRect().right,
						'cursor right end is inside the field'
					);
				} catch (error) {
					done(error);
					return;
				}

				done();
			}, 150);
		});
	});

	suite('spaceBehavesLikeTab', () => {
		let mq, rootBlock, cursor;
		test('space behaves like tab with default opts', () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			mq = MQ.MathField(el);
			rootBlock = mq.__controller.root;
			cursor = mq.__controller.cursor;

			mq.latex('\\sqrt{x}');
			mq.keystroke('Left');

			mq.keystroke('Spacebar');
			mq.typedText(' ');
			assert.equal(cursor[L].ctrlSeq, '\\ ', 'left of the cursor is ' + cursor[L].ctrlSeq);
			assert.equal(cursor[R], undefined, 'right of the cursor is ' + cursor[R]);
			mq.keystroke('Backspace');

			mq.keystroke('Shift-Spacebar');
			mq.typedText(' ');
			assert.equal(cursor[L].ctrlSeq, '\\ ', 'left of the cursor is ' + cursor[L].ctrlSeq);
			assert.equal(cursor[R], undefined, 'right of the cursor is ' + cursor[R]);
		});
		test('space behaves like tab when spaceBehavesLikeTab is true', () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			mq = MQ.MathField(el, { spaceBehavesLikeTab: true });
			rootBlock = mq.__controller.root;
			cursor = mq.__controller.cursor;

			mq.latex('\\sqrt{x}');

			mq.keystroke('Left');
			mq.keystroke('Spacebar');
			assert.equal(cursor[L].parent, rootBlock, 'parent of the cursor is  ' + cursor[L].ctrlSeq);
			assert.equal(cursor[R], undefined, 'right cursor is ' + cursor[R]);

			mq.keystroke('Left');
			mq.keystroke('Shift-Spacebar');
			assert.equal(cursor[L], undefined, 'left cursor is ' + cursor[L]);
			assert.equal(cursor[R], rootBlock.ends[L], 'parent of rootBlock is ' + cursor[R]);
		});
		test('space behaves like tab when globally set to true', () => {
			MQ.config({ spaceBehavesLikeTab: true });

			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			mq = MQ.MathField(el);
			rootBlock = mq.__controller.root;
			cursor = mq.__controller.cursor;

			mq.latex('\\sqrt{x}');

			mq.keystroke('Left');
			mq.keystroke('Spacebar');
			assert.equal(cursor.parent, rootBlock, 'cursor in root block');
			assert.equal(cursor[R], undefined, 'cursor at end of block');

			MQ.config({ spaceBehavesLikeTab: false });
		});
	});

	suite('maxDepth option', () => {
		let mq;
		setup(() => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			mq = MQ.MathField(el, { maxDepth: 1 });
		});
		teardown(() => {
			mq.el().remove();
		});

		test('prevents nested math input via .write() method', () => {
			mq.write('1\\frac{\\frac{3}{3}}{2}');
			assert.equal(mq.latex(), '1\\frac{ }{ }');
		});

		test('prevents nested math input via keyboard input', () => {
			mq.cmd('/').write('x');
			assert.equal(mq.latex(), '\\frac{ }{ }');
		});

		test('stops new fraction moving content into numerator', () => {
			mq.write('x').cmd('/');
			assert.equal(mq.latex(), 'x\\frac{ }{ }');
		});

		test('prevents nested math input via replacedFragment', () => {
			mq.cmd('(').keystroke('Left').cmd('(');
			assert.equal(mq.latex(), '\\left(\\right)');
		});
	});

	suite('statelessClipboard option', () => {
		suite('default', () => {
			let mq, textarea;
			setup(() => {
				const el = document.createElement('span');
				document.getElementById('mock')?.append(el);
				mq = MQ.MathField(el);
				textarea = mq.el().querySelector('textarea');
			});
			const assertPaste = (paste, latex) => {
				if (typeof latex === 'undefined') latex = paste;
				mq.latex('');
				const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true });
				event.clipboardData.setData('text/plain', paste);
				textarea.dispatchEvent(event);
				textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
				assert.equal(mq.latex(), latex);
			};

			test('numbers and letters', () => assertPaste('123xyz'));
			test('a sentence', () =>
				assertPaste(
					'Lorem ipsum is a placeholder text commonly used to ' +
						'demonstrate the graphical elements of a document or ' +
						'visual presentation.',
					'Loremipsumisaplaceholdertextcommonlyusedtodemonstrate' +
						'thegraphicalelementsofadocumentorvisualpresentation.'
				));
			test('actual LaTeX', () => {
				assertPaste('a_nx^n+a_{n+1}x^{n+1}');
				assertPaste('\\frac{1}{2\\sqrt{x}}');
			});
			test('\\text{...}', () => {
				assertPaste('\\text{lol}');
				assertPaste('1+\\text{lol}+2');
				assertPaste('\\frac{\\text{apples}}{\\text{oranges}}');
			});
			test('selection', (done) => {
				mq.latex('x^2').select();
				setTimeout(() => {
					assert.equal(textarea.value, 'x^2');
					done();
				});
			});
		});
		suite('statelessClipboard set to true', () => {
			let mq, textarea;
			setup(() => {
				const el = document.createElement('span');
				document.getElementById('mock')?.append(el);
				mq = MQ.MathField(el, { statelessClipboard: true });
				textarea = mq.el().querySelector('textarea');
			});
			const assertPaste = (paste, latex) => {
				if (typeof latex === 'undefined') latex = paste;
				mq.latex('');
				const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true });
				event.clipboardData.setData('text/plain', paste);
				textarea.dispatchEvent(event);
				textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
				assert.equal(mq.latex(), latex);
			};

			test('numbers and letters', () => assertPaste('123xyz', '\\text{123xyz}'));
			test('a sentence', () =>
				assertPaste(
					'Lorem ipsum is a placeholder text commonly used to ' +
						'demonstrate the graphical elements of a document or ' +
						'visual presentation.',
					'\\text{Lorem ipsum is a placeholder text commonly used to ' +
						'demonstrate the graphical elements of a document or ' +
						'visual presentation.}'
				));
			test('backslashes', () =>
				assertPaste('something pi something asdf', '\\text{something pi something asdf}'));
			// TODO: braces (currently broken)
			test('actual math LaTeX wrapped in dollar signs', () => {
				assertPaste('$a_nx^n+a_{n+1}x^{n+1}$', 'a_nx^n+a_{n+1}x^{n+1}');
				assertPaste('$\\frac{1}{2\\sqrt{x}}$', '\\frac{1}{2\\sqrt{x}}');
			});
			test('selection', (done) => {
				mq.latex('x^2').select();
				setTimeout(() => {
					assert.equal(textarea.value, '$x^2$');
					done();
				});
			});
		});
	});

	suite('leftRightIntoCmdGoes: "up"/"down"', () => {
		test('"up" or "down" required', () =>
			assert.throws(() => {
				const el = document.createElement('span');
				document.getElementById('mock')?.append(el);
				MQ.MathField(el, { leftRightIntoCmdGoes: 1 });
			}));
		suite('default', () => {
			let mq;
			setup(() => {
				const el = document.createElement('span');
				document.getElementById('mock')?.append(el);
				mq = MQ.MathField(el);
			});

			test('fractions', () => {
				mq.latex('\\frac{1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');
				assert.equal(mq.latex(), '\\frac{1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.moveToLeftEnd().typedText('a');
				assert.equal(mq.latex(), 'a\\frac{1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right').typedText('b');
				assert.equal(mq.latex(), 'a\\frac{b1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('c');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('d');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('e');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right').typedText('f');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('g');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{g2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('h');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{g2}h}{\\frac{3}{4}}');

				mq.keystroke('Right').typedText('i');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{g2}h}{i\\frac{3}{4}}');

				mq.keystroke('Right').typedText('j');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{g2}h}{i\\frac{j3}{4}}');

				mq.keystroke('Right Right').typedText('k');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{g2}h}{i\\frac{j3}{k4}}');

				mq.keystroke('Right Right').typedText('l');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{g2}h}{i\\frac{j3}{k4}l}');

				mq.keystroke('Right').typedText('m');
				assert.equal(mq.latex(), 'a\\frac{b1}{cx}d+\\frac{e\\frac{f1}{g2}h}{i\\frac{j3}{k4}l}m');
			});

			test('supsub', () => {
				mq.latex('x_a+y^b+z_a^b+w');
				assert.equal(mq.latex(), 'x_a+y^b+z_a^b+w');

				mq.moveToLeftEnd().typedText('1');
				assert.equal(mq.latex(), '1x_a+y^b+z_a^b+w');

				mq.keystroke('Right Right').typedText('2');
				assert.equal(mq.latex(), '1x_{2a}+y^b+z_a^b+w');

				mq.keystroke('Right Right').typedText('3');
				assert.equal(mq.latex(), '1x_{2a}3+y^b+z_a^b+w');

				mq.keystroke('Right Right Right').typedText('4');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}+z_a^b+w');

				mq.keystroke('Right Right').typedText('5');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}5+z_a^b+w');

				mq.keystroke('Right Right Right').typedText('6');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}5+z_{6a}^b+w');

				mq.keystroke('Right Right').typedText('7');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}5+z_{6a}^{7b}+w');

				mq.keystroke('Right Right').typedText('8');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}5+z_{6a}^{7b}8+w');
			});

			test('nthroot', () => {
				mq.latex('\\sqrt[n]{x}');
				assert.equal(mq.latex(), '\\sqrt[n]{x}');

				mq.moveToLeftEnd().typedText('1');
				assert.equal(mq.latex(), '1\\sqrt[n]{x}');

				mq.keystroke('Right').typedText('2');
				assert.equal(mq.latex(), '1\\sqrt[2n]{x}');

				mq.keystroke('Right Right').typedText('3');
				assert.equal(mq.latex(), '1\\sqrt[2n]{3x}');

				mq.keystroke('Right Right').typedText('4');
				assert.equal(mq.latex(), '1\\sqrt[2n]{3x}4');
			});
		});

		suite('"up"', () => {
			let mq;
			setup(() => {
				const el = document.createElement('span');
				document.getElementById('mock')?.append(el);
				mq = MQ.MathField(el, { leftRightIntoCmdGoes: 'up' });
			});

			test('fractions', () => {
				mq.latex('\\frac{1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');
				assert.equal(mq.latex(), '\\frac{1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.moveToLeftEnd().typedText('a');
				assert.equal(mq.latex(), 'a\\frac{1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right').typedText('b');
				assert.equal(mq.latex(), 'a\\frac{b1}{x}+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('c');
				assert.equal(mq.latex(), 'a\\frac{b1}{x}c+\\frac{\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('d');
				assert.equal(mq.latex(), 'a\\frac{b1}{x}c+\\frac{d\\frac{1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right').typedText('e');
				assert.equal(mq.latex(), 'a\\frac{b1}{x}c+\\frac{d\\frac{e1}{2}}{\\frac{3}{4}}');

				mq.keystroke('Right Right').typedText('f');
				assert.equal(mq.latex(), 'a\\frac{b1}{x}c+\\frac{d\\frac{e1}{2}f}{\\frac{3}{4}}');

				mq.keystroke('Right').typedText('g');
				assert.equal(mq.latex(), 'a\\frac{b1}{x}c+\\frac{d\\frac{e1}{2}f}{\\frac{3}{4}}g');
			});

			test('supsub', () => {
				mq.latex('x_a+y^b+z_a^b+w');
				assert.equal(mq.latex(), 'x_a+y^b+z_a^b+w');

				mq.moveToLeftEnd().typedText('1');
				assert.equal(mq.latex(), '1x_a+y^b+z_a^b+w');

				mq.keystroke('Right Right').typedText('2');
				assert.equal(mq.latex(), '1x_{2a}+y^b+z_a^b+w');

				mq.keystroke('Right Right').typedText('3');
				assert.equal(mq.latex(), '1x_{2a}3+y^b+z_a^b+w');

				mq.keystroke('Right Right Right').typedText('4');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}+z_a^b+w');

				mq.keystroke('Right Right').typedText('5');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}5+z_a^b+w');

				mq.keystroke('Right Right Right').typedText('6');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}5+z_a^{6b}+w');

				mq.keystroke('Right Right').typedText('7');
				assert.equal(mq.latex(), '1x_{2a}3+y^{4b}5+z_a^{6b}7+w');
			});

			test('nthroot', () => {
				mq.latex('\\sqrt[n]{x}');
				assert.equal(mq.latex(), '\\sqrt[n]{x}');

				mq.moveToLeftEnd().typedText('1');
				assert.equal(mq.latex(), '1\\sqrt[n]{x}');

				mq.keystroke('Right').typedText('2');
				assert.equal(mq.latex(), '1\\sqrt[2n]{x}');

				mq.keystroke('Right Right').typedText('3');
				assert.equal(mq.latex(), '1\\sqrt[2n]{3x}');

				mq.keystroke('Right Right').typedText('4');
				assert.equal(mq.latex(), '1\\sqrt[2n]{3x}4');
			});
		});
	});

	suite('sumStartsWithNEquals', () => {
		test('sum defaults to empty limits', () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			const mq = MQ.MathField(el);
			assert.equal(mq.latex(), '');

			mq.cmd('\\sum');
			assert.equal(mq.latex(), '\\sum_{ }^{ }');

			mq.cmd('n');
			assert.equal(mq.latex(), '\\sum_n^{ }', 'cursor in lower limit');
		});
		test('sum starts with `n=`', () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			const mq = MQ.MathField(el, { sumStartsWithNEquals: true });
			assert.equal(mq.latex(), '');

			mq.cmd('\\sum');
			assert.equal(mq.latex(), '\\sum_{n=}^{ }');

			mq.cmd('0');
			assert.equal(mq.latex(), '\\sum_{n=0}^{ }', 'cursor after the `n=`');
		});
		test('integral still has empty limits', () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			const mq = MQ.MathField(el, { sumStartsWithNEquals: true });
			assert.equal(mq.latex(), '');

			mq.cmd('\\int');
			assert.equal(mq.latex(), '\\int_{ }^{ }');

			mq.cmd('0');
			assert.equal(mq.latex(), '\\int_0^{ }', 'cursor in the from block');
		});
	});

	suite('substituteTextarea', () => {
		test("doesn't blow up on selection", () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);

			const substitutionTextarea = document.createElement('span');
			substitutionTextarea.tabIndex = 0;
			substitutionTextarea.style.display = 'inline-block';
			substitutionTextarea.style.width = '1px';
			substitutionTextarea.style.height = '1px';

			const mq = MQ.MathField(el, { substituteTextarea: () => substitutionTextarea });

			assert.equal(mq.latex(), '');
			mq.write('asdf');
			mq.select();
		});
	});

	suite('keyboard event overrides', () => {
		test('can intercept key events', () => {
			let key;

			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);

			const mq = MQ.MathField(el, { overrideKeystroke: (_key) => (key = _key) });

			mq.el()
				.querySelector('textarea')
				?.dispatchEvent(
					new KeyboardEvent('keydown', { key: 'ArrowLeft', which: 37, keyCode: 37, bubbles: true })
				);
			assert.equal(key, 'Left');
		});
		test('cut is NOT async (why should it be?)', () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);

			let count = 0;
			const mq = MQ.MathField(el, { overrideCut: () => (count += 1) });

			mq.el()
				.querySelector('textarea')
				?.dispatchEvent(new ClipboardEvent('cut', { bubbles: true }));
			assert.equal(count, 1);

			mq.el()
				.querySelector('textarea')
				?.dispatchEvent(new InputEvent('input', { bubbles: true }));
			assert.equal(count, 1);

			mq.el()
				.querySelector('textarea')
				?.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
			assert.equal(count, 1);
		});
	});

	suite('clickAt', () => {
		test('inserts at coordinates', () => {
			// Insert filler to make the page taller than the window so that this test is deterministic.
			const filler = document.createElement('div');
			filler.style.height = `${window.offsetHeight}px`;

			const mock = document.getElementById('mock');
			mock?.prepend(filler);

			const el = document.createElement('span');
			mock?.append(el);
			const mq = MQ.MathField(el);
			mq.typedText('mmmm/mmmm');
			mq.el().scrollIntoView();

			const box = mq.el().getBoundingClientRect();
			const clientX = box.left + 32;
			const clientY = box.top + 30;
			const target = document.elementFromPoint(clientX, clientY);

			assert.equal(document.activeElement, document.body);
			mq.clickAt(clientX, clientY, target).write('x');
			assert.equal(document.activeElement, mq.el().querySelector('textarea'));

			assert.equal(mq.latex(), '\\frac{mmmm}{mmxmm}');
		});

		test('target is optional', () => {
			// Insert filler to make the page taller than the window so that this test is deterministic.
			const filler = document.createElement('div');
			filler.style.height = `${window.offsetHeight}px`;

			const mock = document.getElementById('mock');
			mock?.prepend(filler);

			const el = document.createElement('span');
			mock?.append(el);
			const mq = MQ.MathField(el);
			mq.typedText('mmmm/mmmm');
			mq.el().scrollIntoView();

			const box = mq.el().getBoundingClientRect();
			const clientX = box.left + 32;
			const clientY = box.top + 30;

			assert.equal(document.activeElement, document.body);
			mq.clickAt(clientX, clientY).write('x');
			assert.equal(document.activeElement, mq.el().querySelector('textarea'));

			assert.equal(mq.latex(), '\\frac{mmmm}{mmxmm}');
		});
	});

	suite('dropEmbedded', () => {
		test('inserts into empty', () => {
			const el = document.createElement('span');
			document.getElementById('mock')?.append(el);
			const mq = MQ.MathField(el);
			mq.dropEmbedded(0, 0, {
				htmlString: '<span class="embedded-html"></span>',
				text: () => 'embedded text',
				latex: () => 'embedded latex'
			});

			assert.ok(document.querySelector('.embedded-html'));
			assert.equal(mq.text(), 'embedded text');
			assert.equal(mq.latex(), 'embedded latex');
		});

		test('inserts at coordinates', () => {
			// Insert filler to make the page taller than the window so that this test is deterministic.
			const filler = document.createElement('div');
			filler.style.height = `${window.offsetHeight}px`;

			const mock = document.getElementById('mock');
			mock?.prepend(filler);

			const el = document.createElement('span');
			mock?.append(el);
			const mq = MQ.MathField(el);

			mq.typedText('mmmm/mmmm');
			const pos = mq.el().getBoundingClientRect();
			const mqx = pos.left + window.scrollX;
			const mqy = pos.top + window.scrollY;

			mq.el().scrollIntoView();

			mq.dropEmbedded(mqx + 32, mqy + 30, {
				htmlString: '<span class="embedded-html"></span>',
				text: () => 'embedded text',
				latex: () => 'embedded latex'
			});

			assert.ok(document.querySelector('.embedded-html'));
			assert.equal(mq.text(), ' (mmmm)/(mmembedded textmm) ');
			assert.equal(mq.latex(), '\\frac{mmmm}{mmembedded latexmm}');
		});
	});

	test('.registerEmbed()', () => {
		let calls = 0,
			data;

		MQ.registerEmbed('thing', (data_) => {
			calls += 1;
			data = data_;
			return {
				htmlString: '<span class="embedded-html"></span>',
				text: () => 'embedded text',
				latex: () => 'embedded latex'
			};
		});

		const el = document.createElement('span');
		el.textContent = '\\sqrt{\\embed{thing}}';
		document.getElementById('mock')?.append(el);
		const mq = MQ.MathField(el);

		assert.equal(calls, 1);
		assert.equal(data, undefined);

		assert.ok(document.querySelector('.embedded-html'));
		assert.equal(mq.text(), 'sqrt(embedded text)');
		assert.equal(mq.latex(), '\\sqrt{embedded latex}');

		mq.latex('\\sqrt{\\embed{thing}[data]}');
		assert.equal(calls, 2);
		assert.equal(data, 'data');

		assert.ok(document.querySelector('.embedded-html'));
		assert.equal(mq.text(), 'sqrt(embedded text)');
		assert.equal(mq.latex(), '\\sqrt{embedded latex}');
	});
});
