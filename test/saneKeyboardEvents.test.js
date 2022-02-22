/* global suite, test, assert, setup */

import { noop } from 'src/constants';
import { saneKeyboardEvents } from 'services/saneKeyboardEvents.util';

suite('saneKeyboardEvents', () => {
	let el;

	const supportsSelectionAPI = () => 'selectionStart' in el;

	setup(() => {
		el = document.createElement('textarea');
		document.getElementById('mock')?.append(el);
	});

	test('normal keys', (done) => {
		let counter = 0;
		saneKeyboardEvents(el, {
			keystroke: noop,
			typedText: (text) => {
				counter += 1;
				assert.ok(counter <= 1, 'callback is only called once');
				assert.equal(text, 'a', 'text comes back as a');
				assert.equal(el.value, '', 'the textarea remains empty');

				done();
			}
		});

		el.dispatchEvent(new KeyboardEvent('keydown', { which: 97, keyCode: 97, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress', { which: 97, keyCode: 97, bubbles: true }));
		el.value = 'a';
	});

	test('normal keys without keypress', (done) => {
		let counter = 0;
		saneKeyboardEvents(el, {
			keystroke: noop,
			typedText: (text) => {
				counter += 1;
				assert.ok(counter <= 1, 'callback is only called once');
				assert.equal(text, 'a', 'text comes back as a');
				assert.equal(el.value, '', 'the textarea remains empty');

				done();
			}
		});

		el.dispatchEvent(new KeyboardEvent('keydown', { which: 97, keyCode: 97, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keyup', { which: 97, keyCode: 97, bubbles: true }));
		el.value = 'a';
	});

	test('one keydown only', (done) => {
		let counter = 0;

		saneKeyboardEvents(el, {
			keystroke: (key) => {
				counter += 1;
				assert.ok(counter <= 1, 'callback is called only once');
				assert.equal(key, 'Backspace', 'key is correctly set');

				done();
			}
		});

		el.dispatchEvent(new KeyboardEvent('keydown', { which: 8, keyCode: 8, bubbles: true }));
	});

	test('a series of keydowns only', (done) => {
		let counter = 0;

		saneKeyboardEvents(el, {
			keystroke: (key, keydown) => {
				counter += 1;
				assert.ok(counter <= 3, 'callback is called at most 3 times');

				assert.ok(keydown);
				assert.equal(key, 'Left');

				if (counter === 3) done();
			}
		});

		el.dispatchEvent(new KeyboardEvent('keydown', { which: 37, keyCode: 37, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { which: 37, keyCode: 37, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { which: 37, keyCode: 37, bubbles: true }));
	});

	test('one keydown and a series of keypresses', (done) => {
		let counter = 0;

		saneKeyboardEvents(el, {
			keystroke: (key, keydown) => {
				counter += 1;
				assert.ok(counter <= 3, 'callback is called at most 3 times');

				assert.ok(keydown);
				assert.equal(key, 'Backspace');

				if (counter === 3) done();
			}
		});

		el.dispatchEvent(new KeyboardEvent('keydown', { which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress', { which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress', { which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress', { which: 8, keyCode: 8, bubbles: true }));
	});

	suite('select', () => {
		test('select populates the textarea but doesn\'t call .typedText()', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });

			shim.select('foobar');

			assert.equal(el.value, 'foobar');
			el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
			assert.equal(el.value, 'foobar', 'value remains after keydown');

			if (supportsSelectionAPI()) {
				el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
				assert.equal(el.value, 'foobar', 'value remains after keypress');
				el.dispatchEvent(new InputEvent('input', { bubbles: true }));
				assert.equal(el.value, 'foobar', 'value remains after flush after keypress');
			}
		});

		test('select populates the textarea but doesn\'t call text' +
			' on keydown, even when the selection is not properly' +
			' detectable', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });

			shim.select('foobar');
			// monkey-patch the dom-level selection so that hasSelection()
			// returns false, as in IE < 9.
			el.selectionStart = el.selectionEnd = 0;

			el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
			assert.equal(el.value, 'foobar', 'value remains after keydown');
		});

		test('blurring', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });

			shim.select('foobar');
			el.blur();
			el.focus();

			// IE < 9 doesn't support selection{Start,End}
			if (supportsSelectionAPI()) {
				assert.equal(el.selectionStart, 0, 'it\'s selected from the start');
				assert.equal(el.selectionEnd, 6, 'it\'s selected to the end');
			}

			assert.equal(el.value, 'foobar', 'it still has content');
		});

		test('blur then empty selection', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });
			shim.select('foobar');
			el.blur();
			shim.select('');
			assert.ok(document.activeElement !== el, 'textarea remains blurred');
		});

		test('blur in keystroke handler', function(done) {
			if (!document.hasFocus()) {
				// eslint-disable-next-line no-console
				console.warn(
					'The test "blur in keystroke handler" needs the document to have ' +
					'focus. Only when the document has focus does .select() on an ' +
					'element also focus it, which is part of the problematic behavior ' +
					'we are testing robustness against. (Specifically, erroneously ' +
					'calling .select() in a timeout after the textarea has blurred, ' +
					'"stealing back" focus.)\n' +
					'Normally, the page being open and focused is enough to have focus, ' +
					'but with the Developer Tools open, it depends on whether you last ' +
					'clicked on something in the Developer Tools or on the page itself. ' +
					'Click the page, or close the Developer Tools, and Refresh.'
				);
				const mock = document.getElementById('mock');
				// The next line skips teardown, so the mock element needs to be manually emptied.
				while (mock.firstChild) mock.firstChild.remove();
				this.skip();
			}

			const shim = saneKeyboardEvents(el, {
				keystroke: (key) => {
					assert.equal(key, 'Left');
					el.blur();
				}
			});

			shim.select('foobar');
			assert.ok(document.activeElement === el, 'textarea focused');

			el.dispatchEvent(new KeyboardEvent('keydown', { which: 37, keyCode: 37, bubbles: true }));
			assert.ok(document.activeElement !== el, 'textarea blurred');

			setTimeout(() => {
				assert.ok(document.activeElement !== el, 'textarea remains blurred');
				done();
			});
		});

		suite('selected text after keypress or paste doesn\'t get mistaken' +
			' for inputted text', () => {
			test('select() immediately after paste', () => {
				let pastedText;
				let onPaste = (text) => pastedText = text;
				const shim = saneKeyboardEvents(el, { paste: (text) => onPaste(text) });

				el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));
				el.value = '$x^2+1$';

				shim.select('$\\frac{x^2+1}{2}$');
				assert.equal(pastedText, '$x^2+1$');
				assert.equal(el.value, '$\\frac{x^2+1}{2}$');

				onPaste = null;

				shim.select('$2$');
				assert.equal(el.value, '$2$');
			});

			test('select() after paste/input', () => {
				let pastedText;
				let onPaste = (text) => pastedText = text;
				const shim = saneKeyboardEvents(el, { paste: (text) => onPaste(text) });

				el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));
				el.value = '$x^2+1$';

				el.dispatchEvent(new InputEvent('input', { bubbles: true }));
				assert.equal(pastedText, '$x^2+1$');
				assert.equal(el.value, '');

				onPaste = null;

				shim.select('$\\frac{x^2+1}{2}$');
				assert.equal(el.value, '$\\frac{x^2+1}{2}$');

				shim.select('$2$');
				assert.equal(el.value, '$2$');
			});

			test('select() immediately after keydown/keypress', () => {
				let typedText;
				let onText = (text) => typedText = text;
				const shim = saneKeyboardEvents(el, {
					keystroke: noop,
					typedText: (text) => onText(text)
				});

				el.dispatchEvent(new KeyboardEvent('keydown', { which: 97, keyCode: 97, bubbles: true }));
				el.dispatchEvent(new KeyboardEvent('keypress', { which: 97, keyCode: 97, bubbles: true }));
				el.value = 'a';

				shim.select('$\\frac{a}{2}$');
				assert.equal(typedText, 'a');
				assert.equal(el.value, '$\\frac{a}{2}$');

				onText = null;

				shim.select('$2$');
				assert.equal(el.value, '$2$');
			});

			test('select() after keydown/keypress/input', () => {
				let typedText;
				let onText = (text) => typedText = text;
				const shim = saneKeyboardEvents(el, {
					keystroke: noop,
					typedText: (text) => onText(text)
				});

				el.dispatchEvent(new KeyboardEvent('keydown', { which: 97, keyCode: 97, bubbles: true }));
				el.dispatchEvent(new KeyboardEvent('keypress', { which: 97, keyCode: 97, bubbles: true }));
				el.value = 'a';

				el.dispatchEvent(new InputEvent('input', { bubbles: true }));
				assert.equal(typedText, 'a');

				onText = null;

				shim.select('$\\frac{a}{2}$');
				assert.equal(el.value, '$\\frac{a}{2}$');

				shim.select('$2$');
				assert.equal(el.value, '$2$');
			});

			suite('unrecognized keys that move cursor and clear selection', () => {
				test('without keypress', () => {
					const shim = saneKeyboardEvents(el, { keystroke: noop });

					shim.select('a');
					assert.equal(el.value, 'a');

					if (!supportsSelectionAPI()) return;

					el.dispatchEvent(new KeyboardEvent('keydown',
						{ which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.selectionEnd = 0;
					el.dispatchEvent(new KeyboardEvent('keyup',
						{ which: 37, keyCode: 37, altKey: true, bubbles: true }));
					assert.ok(el.selectionStart !== el.selectionEnd);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el, 'textarea remains blurred');
				});

				test('with keypress, many characters selected', () => {
					const shim = saneKeyboardEvents(el, { keystroke: noop });

					shim.select('many characters');
					assert.equal(el.value, 'many characters');

					if (!supportsSelectionAPI()) return;

					el.dispatchEvent(new KeyboardEvent('keydown',
						{ which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.dispatchEvent(new KeyboardEvent('keypress',
						{ which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.selectionEnd = 0;

					el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
					assert.ok(el.selectionStart !== el.selectionEnd);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el, 'textarea remains blurred');
				});

				test('with keypress, only 1 character selected', () => {
					let count = 0;
					const shim = saneKeyboardEvents(el, {
						keystroke: noop,
						typedText: (ch) => {
							assert.equal(ch, 'a');
							assert.equal(el.value, '');
							count += 1;
						}
					});

					shim.select('a');
					assert.equal(el.value, 'a');

					if (!supportsSelectionAPI()) return;

					el.dispatchEvent(new KeyboardEvent('keydown',
						{ which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.dispatchEvent(new KeyboardEvent('keypress',
						{ which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.selectionEnd = 0;

					el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
					assert.equal(count, 1);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el, 'textarea remains blurred');
				});
			});
		});
	});

	suite('paste', () => {
		test('paste event only', (done) => {
			saneKeyboardEvents(el, {
				paste: (text) => {
					assert.equal(text, '$x^2+1$');
					done();
				}
			});

			el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));
			el.value = '$x^2+1$';
		});

		test('paste after keydown/keypress', (done) => {
			saneKeyboardEvents(el, {
				keystroke: noop,
				paste: (text) => {
					assert.equal(text, 'foobar');
					done();
				}
			});

			// Ctrl-V in Firefox or Opera, according to unixpapa.com/js/key.html
			// without an `input` event
			el.dispatchEvent(new KeyboardEvent('keydown', { which: 86, keyCode: 86, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new KeyboardEvent('keypress', { which: 118, keyCode: 118, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));
			el.value = 'foobar';
		});

		test('paste after keydown/keypress/input', (done) => {
			saneKeyboardEvents(el, {
				keystroke: noop,
				paste: (text) => {
					assert.equal(text, 'foobar');
					done();
				}
			});

			// Ctrl-V in Firefox or Opera, according to unixpapa.com/js/key.html
			// with an `input` event
			el.dispatchEvent(new KeyboardEvent('keydown', { which: 86, keyCode: 86, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new KeyboardEvent('keypress', { which: 118, keyCode: 118, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));
			el.value = 'foobar';
			el.dispatchEvent(new InputEvent('input', { bubbles: true }));
		});

		test('keypress timeout happening before paste timeout', (done) => {
			saneKeyboardEvents(el, {
				keystroke: noop,
				paste: (text) => {
					assert.equal(text, 'foobar');
					done();
				}
			});

			el.dispatchEvent(new KeyboardEvent('keydown', { which: 86, keyCode: 86, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new KeyboardEvent('keypress', { which: 118, keyCode: 118, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));
			el.value = 'foobar';

			// this synthesizes the keypress timeout calling handleText()
			// before the paste timeout happens.
			el.dispatchEvent(new InputEvent('input', { bubbles: true }));
		});
	});

	suite('copy', () => {
		test('only runs handler once even if handler synchronously selects', () => {
			// ...which MathQuill does and resulted in a stack overflow: https://git.io/vosm0
			const shim = saneKeyboardEvents(el, { copy: () => shim.select() });

			el.dispatchEvent(new ClipboardEvent('copy', { bubbles: true }));
		});
	});
});
