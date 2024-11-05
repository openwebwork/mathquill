/* global assert, MQ */

suite('focusBlur', function () {
	const assertHasFocus = (mq, name, invert) =>
		assert.ok(
			!!invert ^ (mq.el().querySelector('textarea') === document.activeElement),
			name + (invert ? ' does not have focus' : ' has focus')
		);

	suite('handlers can shift focus away', function () {
		let mq, mq2, wasUpOutOfCalled;
		setup(function () {
			const mock = document.getElementById('mock');
			const span = document.createElement('span');
			mock?.append(span);
			mq = MQ.MathField(span, {
				handlers: {
					upOutOf: () => {
						wasUpOutOfCalled = true;
						mq2.focus();
					}
				}
			});
			const span2 = document.createElement('span');
			mock?.append(span2);
			mq2 = MQ.MathField(span2);
			wasUpOutOfCalled = false;
		});

		const triggerUpOutOf = (mq) => {
			mq.el()
				.querySelector('textarea')
				?.dispatchEvent(
					new KeyboardEvent('keydown', { key: 'ArrowUp', which: 38, keyCode: 38, bubbles: true })
				);
			assert.ok(wasUpOutOfCalled);
		};

		test('normally', function () {
			mq.focus();
			assertHasFocus(mq, 'mq');

			triggerUpOutOf(mq);
			assertHasFocus(mq2, 'mq2');
		});

		test("even if there's a selection", function (done) {
			mq.focus();
			assertHasFocus(mq, 'mq');

			mq.typedText('asdf');
			assert.equal(mq.latex(), 'asdf');

			mq.keystroke('Shift-Left');
			setTimeout(() => {
				assert.equal(mq.el().querySelector('textarea')?.value, 'f');

				triggerUpOutOf(mq);
				assertHasFocus(mq2, 'mq2');
				done();
			});
		});
	});

	test('select behaves correctly after blurring and re-focusing', function (done) {
		const span = document.createElement('span');
		document.getElementById('mock')?.append(span);
		const mq = MQ.MathField(span);

		mq.focus();
		assertHasFocus(mq, 'mq');

		mq.typedText('asdf');
		assert.equal(mq.latex(), 'asdf');

		mq.keystroke('Shift-Left');
		setTimeout(() => {
			const textarea = mq.el().querySelector('textarea');

			assert.equal(textarea?.value, 'f');

			mq.blur();

			assertHasFocus(mq, 'mq', 'not');

			// There is different behavior if the window is focused or not.
			// Javascript can not remove focus from the window, so the test just has to deal with the current state.
			if (document.hasFocus()) {
				setTimeout(() => {
					assert.equal(textarea?.value, '');

					mq.focus();
					assertHasFocus(mq, 'mq');

					mq.keystroke('Shift-Left');
					setTimeout(() => {
						assert.equal(textarea?.value, 'asdf');
						done();
					});
				}, 100);
			} else {
				setTimeout(() => {
					assert.equal(textarea?.value, 'f');

					mq.focus();
					assertHasFocus(mq, 'mq');

					mq.keystroke('Shift-Left');
					setTimeout(() => {
						assert.equal(textarea?.value, 'df');
						done();
					});
				}, 100);
			}
		});
	});

	test('blur event fired when math field loses focus', function (done) {
		const mock = document.getElementById('mock');
		const span = document.createElement('span');
		mock?.append(span);
		const mq = MQ.MathField(span);

		mq.focus();
		assertHasFocus(mq, 'math field');

		const textarea = document.createElement('textarea');
		mock.append(textarea);
		textarea.focus();
		assert.ok(textarea === document.activeElement, 'textarea has focus');

		setTimeout(() => {
			assert.ok(!mq.el().classList.contains('mq-focused'), 'math field is visibly blurred');

			while (mock.firstChild) mock.firstChild.remove();
			done();
		});
	});
});
