/* global suite, test, assert, setup */

import { jQuery, noop } from 'src/constants';
import { saneKeyboardEvents } from 'services/saneKeyboardEvents.util';

suite('saneKeyboardEvents', () => {
	let el;
	const Event = (type, props) => jQuery.extend(jQuery.Event(type), props);

	const supportsSelectionAPI = () => 'selectionStart' in el[0];

	setup(() => el = jQuery('<textarea>').appendTo('#mock'));

	test('normal keys', (done) => {
		let counter = 0;
		saneKeyboardEvents(el, {
			keystroke: noop,
			typedText: (text) => {
				counter += 1;
				assert.ok(counter <= 1, 'callback is only called once');
				assert.equal(text, 'a', 'text comes back as a');
				assert.equal(el.val(), '', 'the textarea remains empty');

				done();
			}
		});

		el.trigger(Event('keydown', { which: 97 }));
		el.trigger(Event('keypress', { which: 97 }));
		el.val('a');
	});

	test('normal keys without keypress', (done) => {
		let counter = 0;
		saneKeyboardEvents(el, {
			keystroke: noop,
			typedText: (text) => {
				counter += 1;
				assert.ok(counter <= 1, 'callback is only called once');
				assert.equal(text, 'a', 'text comes back as a');
				assert.equal(el.val(), '', 'the textarea remains empty');

				done();
			}
		});

		el.trigger(Event('keydown', { which: 97 }));
		el.trigger(Event('keyup', { which: 97 }));
		el.val('a');
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

		el.trigger(Event('keydown', { which: 8 }));
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

		el.trigger(Event('keydown', { which: 37 }));
		el.trigger(Event('keydown', { which: 37 }));
		el.trigger(Event('keydown', { which: 37 }));
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

		el.trigger(Event('keydown', { which: 8 }));
		el.trigger(Event('keypress', { which: 8 }));
		el.trigger(Event('keypress', { which: 8 }));
		el.trigger(Event('keypress', { which: 8 }));
	});

	suite('select', () => {
		test('select populates the textarea but doesn\'t call .typedText()', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });

			shim.select('foobar');

			assert.equal(el.val(), 'foobar');
			el.trigger('keydown');
			assert.equal(el.val(), 'foobar', 'value remains after keydown');

			if (supportsSelectionAPI()) {
				el.trigger('keypress');
				assert.equal(el.val(), 'foobar', 'value remains after keypress');
				el.trigger('input');
				assert.equal(el.val(), 'foobar', 'value remains after flush after keypress');
			}
		});

		test('select populates the textarea but doesn\'t call text' +
			' on keydown, even when the selection is not properly' +
			' detectable', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });

			shim.select('foobar');
			// monkey-patch the dom-level selection so that hasSelection()
			// returns false, as in IE < 9.
			el[0].selectionStart = el[0].selectionEnd = 0;

			el.trigger('keydown');
			assert.equal(el.val(), 'foobar', 'value remains after keydown');
		});

		test('blurring', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });

			shim.select('foobar');
			el.trigger('blur');
			el.focus();

			// IE < 9 doesn't support selection{Start,End}
			if (supportsSelectionAPI()) {
				assert.equal(el[0].selectionStart, 0, 'it\'s selected from the start');
				assert.equal(el[0].selectionEnd, 6, 'it\'s selected to the end');
			}

			assert.equal(el.val(), 'foobar', 'it still has content');
		});

		test('blur then empty selection', () => {
			const shim = saneKeyboardEvents(el, { keystroke: noop });
			shim.select('foobar');
			el.blur();
			shim.select('');
			assert.ok(document.activeElement !== el[0], 'textarea remains blurred');
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
				jQuery('#mock').empty(); // LOL next line skips teardown https://git.io/vaUWq
				this.skip();
			}

			const shim = saneKeyboardEvents(el, {
				keystroke: (key) => {
					assert.equal(key, 'Left');
					el[0].blur();
				}
			});

			shim.select('foobar');
			assert.ok(document.activeElement === el[0], 'textarea focused');

			el.trigger(Event('keydown', { which: 37 }));
			assert.ok(document.activeElement !== el[0], 'textarea blurred');

			setTimeout(() => {
				assert.ok(document.activeElement !== el[0], 'textarea remains blurred');
				done();
			});
		});

		suite('selected text after keypress or paste doesn\'t get mistaken' +
			' for inputted text', () => {
			test('select() immediately after paste', () => {
				let pastedText;
				let onPaste = (text) => pastedText = text;
				const shim = saneKeyboardEvents(el, { paste: (text) => onPaste(text) });

				el.trigger('paste').val('$x^2+1$');

				shim.select('$\\frac{x^2+1}{2}$');
				assert.equal(pastedText, '$x^2+1$');
				assert.equal(el.val(), '$\\frac{x^2+1}{2}$');

				onPaste = null;

				shim.select('$2$');
				assert.equal(el.val(), '$2$');
			});

			test('select() after paste/input', () => {
				let pastedText;
				let onPaste = (text) => pastedText = text;
				const shim = saneKeyboardEvents(el, { paste: (text) => onPaste(text) });

				el.trigger('paste').val('$x^2+1$');

				el.trigger('input');
				assert.equal(pastedText, '$x^2+1$');
				assert.equal(el.val(), '');

				onPaste = null;

				shim.select('$\\frac{x^2+1}{2}$');
				assert.equal(el.val(), '$\\frac{x^2+1}{2}$');

				shim.select('$2$');
				assert.equal(el.val(), '$2$');
			});

			test('select() immediately after keydown/keypress', () => {
				let typedText;
				let onText = (text) => typedText = text;
				const shim = saneKeyboardEvents(el, {
					keystroke: noop,
					typedText: (text) => onText(text)
				});

				el.trigger(Event('keydown', { which: 97 }));
				el.trigger(Event('keypress', { which: 97 }));
				el.val('a');

				shim.select('$\\frac{a}{2}$');
				assert.equal(typedText, 'a');
				assert.equal(el.val(), '$\\frac{a}{2}$');

				onText = null;

				shim.select('$2$');
				assert.equal(el.val(), '$2$');
			});

			test('select() after keydown/keypress/input', () => {
				let typedText;
				let onText = (text) => typedText = text;
				const shim = saneKeyboardEvents(el, {
					keystroke: noop,
					typedText: (text) => onText(text)
				});

				el.trigger(Event('keydown', { which: 97 }));
				el.trigger(Event('keypress', { which: 97 }));
				el.val('a');

				el.trigger('input');
				assert.equal(typedText, 'a');

				onText = null;

				shim.select('$\\frac{a}{2}$');
				assert.equal(el.val(), '$\\frac{a}{2}$');

				shim.select('$2$');
				assert.equal(el.val(), '$2$');
			});

			suite('unrecognized keys that move cursor and clear selection', () => {
				test('without keypress', () => {
					const shim = saneKeyboardEvents(el, { keystroke: noop });

					shim.select('a');
					assert.equal(el.val(), 'a');

					if (!supportsSelectionAPI()) return;

					el.trigger(Event('keydown', { which: 37, altKey: true }));
					el[0].selectionEnd = 0;
					el.trigger(Event('keyup', { which: 37, altKey: true }));
					assert.ok(el[0].selectionStart !== el[0].selectionEnd);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el[0], 'textarea remains blurred');
				});

				test('with keypress, many characters selected', () => {
					const shim = saneKeyboardEvents(el, { keystroke: noop });

					shim.select('many characters');
					assert.equal(el.val(), 'many characters');

					if (!supportsSelectionAPI()) return;

					el.trigger(Event('keydown', { which: 37, altKey: true }));
					el.trigger(Event('keypress', { which: 37, altKey: true }));
					el[0].selectionEnd = 0;

					el.trigger('keyup');
					assert.ok(el[0].selectionStart !== el[0].selectionEnd);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el[0], 'textarea remains blurred');
				});

				test('with keypress, only 1 character selected', () => {
					let count = 0;
					const shim = saneKeyboardEvents(el, {
						keystroke: noop,
						typedText: (ch) => {
							assert.equal(ch, 'a');
							assert.equal(el.val(), '');
							count += 1;
						}
					});

					shim.select('a');
					assert.equal(el.val(), 'a');

					if (!supportsSelectionAPI()) return;

					el.trigger(Event('keydown', { which: 37, altKey: true }));
					el.trigger(Event('keypress', { which: 37, altKey: true }));
					el[0].selectionEnd = 0;

					el.trigger('keyup');
					assert.equal(count, 1);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el[0], 'textarea remains blurred');
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

			el.trigger('paste');
			el.val('$x^2+1$');
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
			el.trigger('keydown', { which: 86, ctrlKey: true });
			el.trigger('keypress', { which: 118, ctrlKey: true });
			el.trigger('paste');
			el.val('foobar');
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
			el.trigger('keydown', { which: 86, ctrlKey: true });
			el.trigger('keypress', { which: 118, ctrlKey: true });
			el.trigger('paste');
			el.val('foobar');
			el.trigger('input');
		});

		test('keypress timeout happening before paste timeout', (done) => {
			saneKeyboardEvents(el, {
				keystroke: noop,
				paste: (text) => {
					assert.equal(text, 'foobar');
					done();
				}
			});

			el.trigger('keydown', { which: 86, ctrlKey: true });
			el.trigger('keypress', { which: 118, ctrlKey: true });
			el.trigger('paste');
			el.val('foobar');

			// this synthesizes the keypress timeout calling handleText()
			// before the paste timeout happens.
			el.trigger('input');
		});
	});

	suite('copy', () => {
		test('only runs handler once even if handler synchronously selects', () => {
			// ...which MathQuill does and resulted in a stack overflow: https://git.io/vosm0
			const shim = saneKeyboardEvents(el, { copy: () => shim.select() });

			el.trigger('copy');
		});
	});
});
