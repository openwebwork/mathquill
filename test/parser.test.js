/* global suite, test, assert */

import { Parser } from 'services/parser.util';

suite('parser', () => {
	const string = Parser.string;
	const regex = Parser.regex;
	const letter = Parser.letter;
	const digit = Parser.digit;
	const any = Parser.any;
	const optWhitespace = Parser.optWhitespace;
	const eof = Parser.eof;
	const all = Parser.all;

	test('Parser.string', () => {
		const parser = string('x');
		assert.equal(parser.parse('x'), 'x');
		assert.throws(() => parser.parse('y'));
	});

	test('Parser.regex', () => {
		const parser = regex(/^[0-9]/);

		assert.equal(parser.parse('1'), '1');
		assert.equal(parser.parse('4'), '4');
		assert.throws(() => parser.parse('x'));
		assert.throws(() => regex(/./), 'must be anchored');
	});

	suite('then', () => {
		test('with a parser, uses the last return value', () => {
			const parser = string('x').then(string('y'));
			assert.equal(parser.parse('xy'), 'y');
			assert.throws(() => parser.parse('y'));
			assert.throws(() => parser.parse('xz'));
		});

		test('asserts that a parser is returned', () => {
			const parser1 = letter.then(() => 'not a parser');
			assert.throws(() => parser1.parse('x'));

			const parser2 = letter.then('x');
			assert.throws(() => parser2.parse('xx'));
		});

		test('with a function that returns a parser, continues with that parser', () => {
			let piped;
			const parser = string('x').then((x) => {
				piped = x;
				return string('y');
			});

			assert.equal(parser.parse('xy'), 'y');
			assert.equal(piped, 'x');
			assert.throws(() => parser.parse('x'));
		});
	});

	suite('map', () => {
		test('with a function, pipes the value in and uses that return value', () => {
			let piped;

			const parser = string('x').map((x) => {
				piped = x;
				return 'y';
			});

			assert.equal(parser.parse('x'), 'y');
			assert.equal(piped, 'x');
		});
	});

	suite('result', () => {
		test('returns a constant result', () => {
			const oneParser = string('x').result(1);

			assert.equal(oneParser.parse('x'), 1);

			const myFn = () => {};
			const fnParser = string('x').result(myFn);

			assert.equal(fnParser.parse('x'), myFn);
		});
	});

	suite('skip', () => {
		test('uses the previous return value', () => {
			const parser = string('x').skip(string('y'));

			assert.equal(parser.parse('xy'), 'x');
			assert.throws(() => parser.parse('x'));
		});
	});

	suite('or', () => {
		test('two parsers', () => {
			const parser = string('x').or(string('y'));

			assert.equal(parser.parse('x'), 'x');
			assert.equal(parser.parse('y'), 'y');
			assert.throws(() => parser.parse('z'));
		});

		test('with then', () => {
			const parser = string('\\').then(() => string('y')).or(string('z'));

			assert.equal(parser.parse('\\y'), 'y');
			assert.equal(parser.parse('z'), 'z');
			assert.throws(() => parser.parse('\\z'));
		});
	});

	const assertEqualArray = (arr1, arr2) => assert.equal(arr1.join(), arr2.join());

	suite('many', () => {
		test('simple case', () => {
			const letters = letter.many();

			assertEqualArray(letters.parse('x'), ['x']);
			assertEqualArray(letters.parse('xyz'), ['x', 'y', 'z']);
			assertEqualArray(letters.parse(''), []);
			assert.throws(() => letters.parse('1'));
			assert.throws(() => letters.parse('xyz1'));
		});

		test('followed by then', () => {
			const parser = string('x').many().then(string('y'));

			assert.equal(parser.parse('y'), 'y');
			assert.equal(parser.parse('xy'), 'y');
			assert.equal(parser.parse('xxxxxy'), 'y');
		});
	});

	suite('times', () => {
		test('zero case', () => {
			const zeroLetters = letter.times(0);

			assertEqualArray(zeroLetters.parse(''), []);
			assert.throws(() => zeroLetters.parse('x'));
		});

		test('nonzero case', () => {
			const threeLetters = letter.times(3);

			assertEqualArray(threeLetters.parse('xyz'), ['x', 'y', 'z']);
			assert.throws(() => threeLetters.parse('xy'));
			assert.throws(() => threeLetters.parse('xyzw'));

			const thenDigit = threeLetters.then(digit);
			assert.equal(thenDigit.parse('xyz1'), '1');
			assert.throws(() => thenDigit.parse('xy1'));
			assert.throws(() => thenDigit.parse('xyz'));
			assert.throws(() => thenDigit.parse('xyzw'));
		});

		test('with a min and max', () => {
			const someLetters = letter.times(2, 4);

			assertEqualArray(someLetters.parse('xy'), ['x', 'y']);
			assertEqualArray(someLetters.parse('xyz'), ['x', 'y', 'z']);
			assertEqualArray(someLetters.parse('xyzw'), ['x', 'y', 'z', 'w']);
			assert.throws(() => someLetters.parse('xyzwv'));
			assert.throws(() => someLetters.parse('x'));

			const thenDigit = someLetters.then(digit);
			assert.equal(thenDigit.parse('xy1'), '1');
			assert.equal(thenDigit.parse('xyz1'), '1');
			assert.equal(thenDigit.parse('xyzw1'), '1');
			assert.throws(() => thenDigit.parse('xy'));
			assert.throws(() => thenDigit.parse('xyzw'));
			assert.throws(() => thenDigit.parse('xyzwv1'));
			assert.throws(() => thenDigit.parse('x1'));
		});

		test('atLeast', () => {
			const atLeastTwo = letter.atLeast(2);

			assertEqualArray(atLeastTwo.parse('xy'), ['x', 'y']);
			assertEqualArray(atLeastTwo.parse('xyzw'), ['x', 'y', 'z', 'w']);
			assert.throws(() => atLeastTwo.parse('x'));
		});
	});

	suite('fail', () => {
		const fail = Parser.fail;
		const succeed = Parser.succeed;

		test('use Parser.fail to fail dynamically', () => {
			const parser = any.then((ch) => fail(`character ${ch} not allowed`)).or(string('x'));

			assert.throws(() => parser.parse('y'));
			assert.equal(parser.parse('x'), 'x');
		});

		test('use Parser.succeed or Parser.fail to branch conditionally', () => {
			let allowedOperator;

			const parser =
				string('x')
					.then(string('+').or(string('*')))
					.then((operator) => {
						if (operator === allowedOperator) return succeed(operator);
						else return fail(`expected ${allowedOperator}`);
					})
					.skip(string('y'))
			;

			allowedOperator = '+';
			assert.equal(parser.parse('x+y'), '+');
			assert.throws(() => parser.parse('x*y'));

			allowedOperator = '*';
			assert.equal(parser.parse('x*y'), '*');
			assert.throws(() => parser.parse('x+y'));
		});
	});

	test('eof', () => {
		const parser = optWhitespace.skip(eof).or(all.result('default'));

		assert.equal(parser.parse('  '), '  ');
		assert.equal(parser.parse('x'), 'default');
	});
});
