/* global suite, test, assert, setup, MQ */

import { jQuery } from 'src/constants';

suite('focusBlur', () => {
	const assertHasFocus = (mq, name, invert) =>
		assert.ok(!!invert ^ (jQuery(mq.el()).find('textarea')[0] === document.activeElement),
			name + (invert ? ' does not have focus' : ' has focus'));

	suite('handlers can shift focus away', () => {
		let mq, mq2, wasUpOutOfCalled;
		setup(() => {
			mq = MQ.MathField(jQuery('<span></span>').appendTo('#mock')[0], {
				handlers: {
					upOutOf: () => {
						wasUpOutOfCalled = true;
						mq2.focus();
					}
				}
			});
			mq2 = MQ.MathField(jQuery('<span></span>').appendTo('#mock')[0]);
			wasUpOutOfCalled = false;
		});

		const triggerUpOutOf = (mq) => {
			jQuery(mq.el()).find('textarea').trigger(jQuery.extend(jQuery.Event('keydown'), { which: 38 }));
			assert.ok(wasUpOutOfCalled);
		};

		test('normally', () => {
			mq.focus();
			assertHasFocus(mq, 'mq');

			triggerUpOutOf(mq);
			assertHasFocus(mq2, 'mq2');
		});

		test('even if there\'s a selection', (done) => {
			mq.focus();
			assertHasFocus(mq, 'mq');

			mq.typedText('asdf');
			assert.equal(mq.latex(), 'asdf');

			mq.keystroke('Shift-Left');
			setTimeout(() => {
				assert.equal(jQuery(mq.el()).find('textarea').val(), 'f');

				triggerUpOutOf(mq);
				assertHasFocus(mq2, 'mq2');
				done();
			});
		});
	});

	test('select behaves normally after blurring and re-focusing', (done) => {
		const mq = MQ.MathField(jQuery('<span></span>').appendTo('#mock')[0]);

		mq.focus();
		assertHasFocus(mq, 'mq');

		mq.typedText('asdf');
		assert.equal(mq.latex(), 'asdf');

		mq.keystroke('Shift-Left');
		setTimeout(() => {
			assert.equal(jQuery(mq.el()).find('textarea').val(), 'f');

			mq.blur();
			assertHasFocus(mq, 'mq', 'not');
			setTimeout(() => {
				assert.equal(jQuery(mq.el()).find('textarea').val(), 'f');

				mq.focus();
				assertHasFocus(mq, 'mq');

				mq.keystroke('Shift-Left');
				setTimeout(() => {
					assert.equal(jQuery(mq.el()).find('textarea').val(), 'df');
					done();
				});
			}, 100);
		});
	});

	test('blur event fired when math field loses focus', (done) => {
		const mq = MQ.MathField(jQuery('<span></span>').appendTo('#mock')[0]);

		mq.focus();
		assertHasFocus(mq, 'math field');

		const textarea = jQuery('<textarea>').appendTo('#mock').focus();
		assert.ok(textarea[0] === document.activeElement, 'textarea has focus');

		setTimeout(() => {
			assert.ok(!jQuery(mq.el()).hasClass('mq-focused'), 'math field is visibly blurred');

			jQuery('#mock').empty();
			done();
		});
	});
});
