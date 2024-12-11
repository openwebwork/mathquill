/* global assert, MQ */

import { Letter } from 'commands/mathElements';

suite('autoOperatorNames', function () {
	let mq;
	setup(function () {
		const field = document.createElement('span');
		document.getElementById('mock')?.append(field);
		mq = MQ.MathField(field);
	});

	const assertLatex = (input, expected) => {
		const result = mq.latex();
		assert.equal(result, expected, `${input}, got '${result}', expected '${expected}'`);
	};

	const assertText = (input, expected) => {
		const result = mq.text();
		assert.equal(result, expected, `${input}, got '${result}', expected '${expected}'`);
	};

	test('simple LaTeX parsing, typing', function () {
		const assertAutoOperatorNamesWork = (str, latex) => {
			let count = 0;
			const _autoUnItalicize = Letter.prototype.autoUnItalicize;
			Letter.prototype.autoUnItalicize = function () {
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

		assertAutoOperatorNamesWork('ker', '\\ker');
		assertAutoOperatorNamesWork('hcf', '\\operatorname{hcf}');
		assertAutoOperatorNamesWork('ahcfe', 'a\\operatorname{hcfe}');
		assertAutoOperatorNamesWork('dimline', '\\dim line');
		assertAutoOperatorNamesWork('arhcfant', 'ar\\operatorname{hcf}ant');
		assertAutoOperatorNamesWork('kerskerskersc', '\\ker s\\ker s\\ker sc');
		assertAutoOperatorNamesWork('skerskersker', 's\\ker s\\ker s\\ker');
	});

	test('text() output', function () {
		const assertTranslatedCorrectly = (latexStr, text) => {
			mq.latex(latexStr);
			assertText(`outputting ${latexStr}`, text);
		};

		assertTranslatedCorrectly('\\ker', 'ker ');
		assertTranslatedCorrectly('\\ker\\left(xy\\right)', 'ker(xy)');
	});

	test('deleting', function () {
		let count = 0;
		const _autoUnItalicize = Letter.prototype.autoUnItalicize;
		Letter.prototype.autoUnItalicize = function () {
			count += 1;
			return _autoUnItalicize.apply(this, arguments);
		};

		mq.options.addAutoOperatorNames('cac');

		const str = 'cacacacacacac';
		for (const char of str) mq.typedText(char);
		assertLatex(`typing '${str}'`, '\\operatorname{cac}a\\operatorname{cac}a\\operatorname{cac}ac');
		assert.equal(count, str.length);

		mq.moveToLeftEnd().keystroke('Delete');
		assertLatex('deleted first char', 'a\\operatorname{cac}a\\operatorname{cac}a\\operatorname{cac}');
		assert.equal(count, str.length + 1);

		mq.typedText('c');
		assertLatex('typed back first char', '\\operatorname{cac}a\\operatorname{cac}a\\operatorname{cac}ac');
		assert.equal(count, str.length + 2);

		mq.typedText('+');
		assertLatex(
			'typed plus to interrupt sequence of letters',
			'c+a\\operatorname{cac}a\\operatorname{cac}a\\operatorname{cac}'
		);
		assert.equal(count, str.length + 4);

		mq.keystroke('Backspace');
		assertLatex('deleted plus', '\\operatorname{cac}a\\operatorname{cac}a\\operatorname{cac}ac');
		assert.equal(count, str.length + 5);

		mq.options.removeAutoOperatorNames('cac');
	});

	suite('override autoOperatorNames', function () {
		test('basic', function () {
			mq.config({ autoOperatorNames: 'ker lol' });
			mq.typedText('arckertrololol');
			assert.equal(mq.latex(), 'arc\\ker tro\\operatorname{lol}ol');
		});

		test('command contains non-letters', function () {
			assert.throws(() => MQ.config({ autoOperatorNames: 'e1' }));
		});

		test('command length less than 2', function () {
			assert.throws(() => MQ.config({ autoOperatorNames: 'e' }));
		});

		suite('command list not perfectly space-delimited is okay', function () {
			test('double space', function () {
				assert.ok(() => MQ.config({ autoOperatorNames: 'pi  theta' }));
			});

			test('leading space', function () {
				assert.ok(() => MQ.config({ autoOperatorNames: ' pi' }));
			});

			test('trailing space', function () {
				assert.ok(() => MQ.config({ autoOperatorNames: 'pi ' }));
			});
		});
	});
});
