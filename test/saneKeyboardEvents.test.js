/* global suite, test, assert, setup */

import { noop } from 'src/constants';
import { saneKeyboardEvents } from 'services/saneKeyboardEvents.util';
import { Options } from 'src/options';
import { MathField } from 'commands/math';
import { Controller } from 'src/controller';

// FIXME:  Most of this needs to be reworked.  The fact is that the fake events that are being sent do not correctly
// emulate actual behavior in a browser, and so the tests are a complete sham.

suite('saneKeyboardEvents', () => {
	let el;

	const supportsSelectionAPI = () => 'selectionStart' in el;

	setup(() => {
		el = document.createElement('textarea');
		document.getElementById('mock')?.append(el);
	});

	test('normal keys', (done) => {
		let counter = 0;

		const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
		ctrlr.options.overrideKeystroke = noop;
		ctrlr.options.overrideTypedText = (text) => {
			counter += 1;
			assert.ok(counter <= 1, 'callback is only called once');
			assert.equal(text, 'a', 'text comes back as a');
			assert.equal(el.value, '', 'the textarea remains empty');

			done();
		};
		saneKeyboardEvents(el, ctrlr);

		el.dispatchEvent(new KeyboardEvent('keydown',
			{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
		el.dispatchEvent(new InputEvent('input', { data: 'a', bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress',
			{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
		el.value = 'a';
	});

	test('normal keys without keypress', (done) => {
		let counter = 0;

		const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
		ctrlr.options.overrideKeystroke = noop;
		ctrlr.options.overrideTypedText = (text) => {
			counter += 1;
			assert.ok(counter <= 1, 'callback is only called once');
			assert.equal(text, 'a', 'text comes back as a');
			assert.equal(el.value, '', 'the textarea remains empty');

			done();
		};
		saneKeyboardEvents(el, ctrlr);

		el.dispatchEvent(new KeyboardEvent('keydown',
			{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
		el.dispatchEvent(new InputEvent('input', { data: 'a', bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keyup',
			{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
		el.value = 'a';
	});

	test('one keydown only', (done) => {
		let counter = 0;

		const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
		ctrlr.options.overrideKeystroke = (key) => {
			counter += 1;
			assert.ok(counter <= 1, 'callback is called only once');
			assert.equal(key, 'Backspace', 'key is correctly set');

			done();
		};
		saneKeyboardEvents(el, ctrlr);

		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', which: 8, keyCode: 8, bubbles: true }));
	});

	test('a series of keydowns only', (done) => {
		let counter = 0;

		const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
		ctrlr.options.overrideKeystroke = (key, keydown) => {
			counter += 1;
			assert.ok(counter <= 3, 'callback is called at most 3 times');

			assert.ok(keydown);
			assert.equal(key, 'Left');

			if (counter === 3) done();
		};
		saneKeyboardEvents(el, ctrlr);

		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', which: 37, keyCode: 37, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', which: 37, keyCode: 37, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', which: 37, keyCode: 37, bubbles: true }));
	});

	test('three keydowns and corresponding keypresses', (done) => {
		let counter = 0;

		const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
		ctrlr.options.overrideKeystroke = (key, keydown) => {
			counter += 1;
			assert.ok(counter <= 3, 'callback is called at most 3 times');

			assert.ok(keydown);
			assert.equal(key, 'Backspace');

			if (counter === 3) done();
		};
		saneKeyboardEvents(el, ctrlr);

		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Backspace', which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Backspace', which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', which: 8, keyCode: 8, bubbles: true }));
		el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Backspace', which: 8, keyCode: 8, bubbles: true }));
	});

	suite('select', () => {
		test('select populates the textarea but doesn\'t call .typedText()', () => {
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = noop;
			const shim = saneKeyboardEvents(el, ctrlr);

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
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = noop;
			const shim = saneKeyboardEvents(el, ctrlr);

			shim.select('foobar');
			// monkey-patch the dom-level selection so that hasSelection()
			// returns false, as in IE < 9.
			el.selectionStart = el.selectionEnd = 0;

			el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
			assert.equal(el.value, 'foobar', 'value remains after keydown');
		});

		test('blurring', () => {
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = noop;
			const shim = saneKeyboardEvents(el, ctrlr);

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
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = noop;
			const shim = saneKeyboardEvents(el, ctrlr);

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

			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = (key) => { assert.equal(key, 'Left'); el.blur(); };
			const shim = saneKeyboardEvents(el, ctrlr);

			shim.select('foobar');
			assert.ok(document.activeElement === el, 'textarea focused');

			el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', which: 37, keyCode: 37, bubbles: true }));
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

				const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
				ctrlr.options.overridePaste = (text) => onPaste(text);
				const shim = saneKeyboardEvents(el, ctrlr);

				const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer, bubbles: true });
				event.clipboardData.setData('text/plain', '$x^2+1$');
				el.dispatchEvent(event);

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

				const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
				ctrlr.options.overridePaste = (text) => onPaste(text);
				const shim = saneKeyboardEvents(el, ctrlr);

				const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer, bubbles: true });
				event.clipboardData.setData('text/plain', '$x^2+1$');
				el.dispatchEvent(event);

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

				const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
				ctrlr.options.overrideKeystroke = noop;
				ctrlr.options.overrideTypedText = (text) => onText(text);
				const shim = saneKeyboardEvents(el, ctrlr);

				el.dispatchEvent(new KeyboardEvent('keydown',
					{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
				el.dispatchEvent(new KeyboardEvent('keypress',
					{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
				el.dispatchEvent(new InputEvent('input', { data: 'a', bubbles: true }));
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

				const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
				ctrlr.options.overrideKeystroke = noop;
				ctrlr.options.overrideTypedText = (text) => onText(text);
				const shim = saneKeyboardEvents(el, ctrlr);

				el.dispatchEvent(new KeyboardEvent('keydown',
					{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
				el.dispatchEvent(new KeyboardEvent('keypress',
					{ key: 'a', shiftKey: true, which: 65, keyCode: 65, bubbles: true }));
				el.dispatchEvent(new InputEvent('input', { data: 'a', bubbles: true }));
				el.value = 'a';

				assert.equal(typedText, 'a');

				onText = null;

				shim.select('$\\frac{a}{2}$');
				assert.equal(el.value, '$\\frac{a}{2}$');

				shim.select('$2$');
				assert.equal(el.value, '$2$');
			});

			suite('keys that should not move cursor or clear selection', () => {
				test('without keypress', () => {
					const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
					ctrlr.options.overrideKeystroke = noop;
					const shim = saneKeyboardEvents(el, ctrlr);

					shim.select('a');
					assert.equal(el.value, 'a');

					if (!supportsSelectionAPI()) return;

					el.dispatchEvent(new KeyboardEvent('keydown',
						{ key: 'ArrowLeft', which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.dispatchEvent(new KeyboardEvent('keyup',
						{ key: 'ArrowLeft', which: 37, keyCode: 37, altKey: true, bubbles: true }));
					assert.ok(el.selectionStart !== el.selectionEnd);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el, 'textarea remains blurred');
				});

				test('with keypress, many characters selected', () => {
					const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
					ctrlr.options.overrideKeystroke = noop;
					const shim = saneKeyboardEvents(el, ctrlr);

					shim.select('many characters');
					assert.equal(el.value, 'many characters');

					if (!supportsSelectionAPI()) return;

					el.dispatchEvent(new KeyboardEvent('keydown',
						{ key: 'ArrowLeft', which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.dispatchEvent(new KeyboardEvent('keypress',
						{ key: 'ArrowLeft', which: 37, keyCode: 37, altKey: true, bubbles: true }));

					el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
					assert.ok(el.selectionStart !== el.selectionEnd);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el, 'textarea remains blurred');
				});

				test('with keypress, only 1 character selected', () => {
					let count = 0;

					const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
					ctrlr.options.overrideKeystroke = noop;
					ctrlr.options.overrideTypedText = (ch) => {
						assert.equal(ch, 'a');
						assert.equal(el.value, '');
						count += 1;
					};
					const shim = saneKeyboardEvents(el, ctrlr);

					shim.select('a');
					assert.equal(el.value, 'a');

					if (!supportsSelectionAPI()) return;

					el.dispatchEvent(new KeyboardEvent('keydown',
						{ key: 'ArrowLeft', which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.dispatchEvent(new KeyboardEvent('keypress',
						{ key: 'ArrowLeft', which: 37, keyCode: 37, altKey: true, bubbles: true }));
					el.selectionEnd = 0;

					el.dispatchEvent(new KeyboardEvent('keyup',
						{ key: 'ArrowLeft', which: 37, keyCode: 37, altKey: true, bubbles: true }));
					assert.equal(count, 0);

					el.blur();
					shim.select('');
					assert.ok(document.activeElement !== el, 'textarea remains blurred');
				});
			});
		});
	});

	suite('paste', () => {
		test('paste event only', (done) => {
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overridePaste = (text) => { assert.equal(text, '$x^2+1$'); done(); };
			saneKeyboardEvents(el, ctrlr);

			const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer, bubbles: true });
			event.clipboardData.setData('text/plain', '$x^2+1$');
			el.dispatchEvent(event);
		});

		test('paste after keydown/keypress', (done) => {
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = noop;
			ctrlr.options.overridePaste = (text) => { assert.equal(text, 'foobar'); done(); };
			saneKeyboardEvents(el, ctrlr);

			el.dispatchEvent(new KeyboardEvent('keydown',
				{ key: 'v', which: 86, keyCode: 86, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new KeyboardEvent('keypress',
				{ key: 'v', which: 118, keyCode: 118, ctrlKey: true, bubbles: true }));

			const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer, bubbles: true });
			event.clipboardData.setData('text/plain', 'foobar');
			el.dispatchEvent(event);
		});

		test('paste after keydown/keypress and before input', (done) => {
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = noop;
			ctrlr.options.overridePaste = (text) => { assert.equal(text, 'foobar'); done(); };
			saneKeyboardEvents(el, ctrlr);

			el.dispatchEvent(new KeyboardEvent('keydown',
				{ key: 'v', which: 86, keyCode: 86, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new KeyboardEvent('keypress',
				{ key: 'v', which: 118, keyCode: 118, ctrlKey: true, bubbles: true }));
			const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer, bubbles: true });
			event.clipboardData.setData('text/plain', 'foobar');
			el.dispatchEvent(event);
			el.dispatchEvent(new InputEvent('input',
				{ key: 'v', which: 118, keyCode: 118, ctrlKey: true, bubbles: true }));
		});

		test('keypress timeout happening before paste timeout', (done) => {
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideKeystroke = noop;
			ctrlr.options.overridePaste = (text) => { assert.equal(text, 'foobar'); done(); };
			saneKeyboardEvents(el, ctrlr);

			el.dispatchEvent(new KeyboardEvent('keydown',
				{ key: 'v', which: 86, keyCode: 86, ctrlKey: true, bubbles: true }));
			el.dispatchEvent(new KeyboardEvent('keypress',
				{ key: 'v', which: 118, keyCode: 118, ctrlKey: true, bubbles: true }));
			const event = new ClipboardEvent('paste', { clipboardData: new DataTransfer, bubbles: true });
			event.clipboardData.setData('text/plain', 'foobar');
			el.dispatchEvent(event);

			// this synthesizes the keypress timeout calling handleText()
			// before the paste timeout happens.
			el.dispatchEvent(new InputEvent('input', { bubbles: true }));
		});
	});

	suite('copy', () => {
		test('only runs handler once even if handler synchronously selects', () => {
			// ...which MathQuill does and resulted in a stack overflow: https://git.io/vosm0
			const ctrlr = new Controller(new MathField.RootBlock, el, new Options);
			ctrlr.options.overrideCopy = () => shim.select();
			const shim = saneKeyboardEvents(el, ctrlr);

			el.dispatchEvent(new ClipboardEvent('copy', { bubbles: true }));
		});
	});
});
