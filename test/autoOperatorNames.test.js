/* global suite, test, assert, setup, MQ */

import { Letter } from 'commands/mathElements';

suite('autoOperatorNames', () => {
	let mq;
	setup(() => {
		const field = document.createElement('span');
		document.getElementById('mock')?.append(field);
		mq = MQ.MathField(field);
	});

	const assertLatex = (input, expected) => {
		const result = mq.latex();
		assert.equal(result, expected,
			`${input}, got '${result}', expected '${expected}'`
		);
	};

	const assertText = (input, expected) => {
		const result = mq.text();
		assert.equal(result, expected,
			`${input}, got '${result}', expected '${expected}'`
		);
	};

	test('simple LaTeX parsing, typing', () => {
		const assertAutoOperatorNamesWork = (str, latex) => {
			let count = 0;
			const _autoUnItalicize = Letter.prototype.autoUnItalicize;
			Letter.prototype.autoUnItalicize = function() {
				count += 1;
				return _autoUnItalicize.apply(this, arguments);
			};

			mq.latex(str);
			assertLatex(`parsing '${str}'`, latex);
			assert.equal(count, 1);

			mq.latex(latex);
			assertLatex(`parsing '${latex}'`, latex);
			assert.equal(count, 2);

			mq.latex('');
			for (const char of str) mq.typedText(char);
			assertLatex(`typing '${str}'`, latex);
			assert.equal(count, 2 + str.length);
		};

		assertAutoOperatorNamesWork('sin', '\\sin');
		assertAutoOperatorNamesWork('arcosh', '\\operatorname{arcosh}');
		assertAutoOperatorNamesWork('acosh', 'a\\cosh');
		assertAutoOperatorNamesWork('cosine', '\\cos ine');
		assertAutoOperatorNamesWork('arcosecant', 'ar\\operatorname{cosec}ant');
		assertAutoOperatorNamesWork('cscscscscscsc', '\\csc s\\csc s\\csc sc');
		assertAutoOperatorNamesWork('scscscscscsc', 's\\csc s\\csc s\\csc');
	});

	test('text() output', () => {
		const assertTranslatedCorrectly = (latexStr, text) => {
			mq.latex(latexStr);
			assertText(`outputting ${latexStr}`, text);
		};

		assertTranslatedCorrectly('\\sin', 'sin ');
		assertTranslatedCorrectly('\\sin\\left(xy\\right)', 'sin(xy)');
	});

	test('deleting', () => {
		let count = 0;
		const _autoUnItalicize = Letter.prototype.autoUnItalicize;
		Letter.prototype.autoUnItalicize = function() {
			count += 1;
			return _autoUnItalicize.apply(this, arguments);
		};

		const str = 'cscscscscscsc';
		for (const char of str) mq.typedText(char);
		assertLatex(`typing '${str}'`, '\\csc s\\csc s\\csc sc');
		assert.equal(count, str.length);

		mq.moveToLeftEnd().keystroke('Delete');
		assertLatex('deleted first char', 's\\csc s\\csc s\\csc');
		assert.equal(count, str.length + 1);

		mq.typedText('c');
		assertLatex('typed back first char', '\\csc s\\csc s\\csc sc');
		assert.equal(count, str.length + 2);

		mq.typedText('+');
		assertLatex('typed plus to interrupt sequence of letters', 'c+s\\csc s\\csc s\\csc');
		assert.equal(count, str.length + 4);

		mq.keystroke('Backspace');
		assertLatex('deleted plus', '\\csc s\\csc s\\csc sc');
		assert.equal(count, str.length + 5);
	});

	suite('override autoOperatorNames', () => {
		test('basic', () => {
			mq.config({ autoOperatorNames: 'sin lol' });
			mq.typedText('arcsintrololol');
			assert.equal(mq.latex(), 'arc\\sin tro\\operatorname{lol}ol');
		});

		test('command contains non-letters', () => {
			assert.throws(() => MQ.config({ autoOperatorNames: 'e1' }));
		});

		test('command length less than 2', () => {
			assert.throws(() => MQ.config({ autoOperatorNames: 'e' }));
		});

		suite('command list not perfectly space-delimited is okay', () => {
			test('double space', () => {
				assert.ok(() => MQ.config({ autoOperatorNames: 'pi  theta' }));
			});

			test('leading space', () => {
				assert.ok(() => MQ.config({ autoOperatorNames: ' pi' }));
			});

			test('trailing space', () => {
				assert.ok(() => MQ.config({ autoOperatorNames: 'pi ' }));
			});
		});
	});
});
