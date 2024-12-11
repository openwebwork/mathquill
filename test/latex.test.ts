import MathQuill from 'src/publicapi';
import { Options } from 'src/options';
import { Bracket, latexMathParser } from 'commands/mathElements';
import { assert } from 'test/support/assert';
import type { MathBlock } from 'commands/mathBlock';
import type { InnerMathField, MathField, StaticMath } from 'commands/math';

suite('latex', function () {
	const MQ = MathQuill.getInterface();
	const options = new Options();

	const assertParsesLatex = (str: string, latex?: string) => {
		if (typeof latex === 'undefined') latex = str;

		const result = latexMathParser.parse<MathBlock>(str).postOrder('finalizeTree', options).join('latex');
		assert.equal(result, latex, `parsing '${str}', got '${result}', expected '${latex}'`);
	};

	test('empty LaTeX', function () {
		assertParsesLatex('');
		assertParsesLatex(' ', '');
		assertParsesLatex('{}', '');
		assertParsesLatex('   {}{} {{{}}  }', '');
	});

	test('variables', function () {
		assertParsesLatex('xyz');
	});

	test('variables that can be mathbb', function () {
		assertParsesLatex('PNZQRCH');
	});

	test('can parse mathbb symbols', function () {
		assertParsesLatex(
			'\\P\\N\\Z\\Q\\R\\C\\H',
			'\\mathbb{P}\\mathbb{N}\\mathbb{Z}\\mathbb{Q}\\mathbb{R}\\mathbb{C}\\mathbb{H}'
		);
		assertParsesLatex('\\mathbb{P}\\mathbb{N}\\mathbb{Z}\\mathbb{Q}\\mathbb{R}\\mathbb{C}\\mathbb{H}');
	});

	test('can parse mathbb error case', function () {
		assert.throws(() => {
			assertParsesLatex('\\mathbb + 2');
		});
		assert.throws(() => {
			assertParsesLatex('\\mathbb{A}');
		});
	});

	test('simple exponent', function () {
		assertParsesLatex('x^n');
	});

	test('block exponent', function () {
		assertParsesLatex('x^{n}', 'x^n');
		assertParsesLatex('x^{nm}');
		assertParsesLatex('x^{}', 'x^{ }');
	});

	test('nested exponents', function () {
		assertParsesLatex('x^{n^m}');
	});

	test('exponents with spaces', function () {
		assertParsesLatex('x^ 2', 'x^2');
		assertParsesLatex('x ^2', 'x^2');
	});

	test('inner groups', function () {
		assertParsesLatex('a{bc}d', 'abcd');
		assertParsesLatex('{bc}d', 'bcd');
		assertParsesLatex('a{bc}', 'abc');
		assertParsesLatex('{bc}', 'bc');

		assertParsesLatex('x^{a{bc}d}', 'x^{abcd}');
		assertParsesLatex('x^{a{bc}}', 'x^{abc}');
		assertParsesLatex('x^{{bc}}', 'x^{bc}');
		assertParsesLatex('x^{{bc}d}', 'x^{bcd}');

		assertParsesLatex('{asdf{asdf{asdf}asdf}asdf}', 'asdfasdfasdfasdfasdf');
	});

	test('commands without braces', function () {
		assertParsesLatex('\\frac12', '\\frac{1}{2}');
		assertParsesLatex('\\frac1a', '\\frac{1}{a}');
		assertParsesLatex('\\frac ab', '\\frac{a}{b}');

		assertParsesLatex('\\frac a b', '\\frac{a}{b}');
		assertParsesLatex(' \\frac a b ', '\\frac{a}{b}');
		assertParsesLatex('\\frac{1} 2', '\\frac{1}{2}');
		assertParsesLatex('\\frac{ 1 } 2', '\\frac{1}{2}');

		assert.throws(() => latexMathParser.parse('\\frac'));
	});

	test('whitespace', function () {
		assertParsesLatex('  a + b ', 'a+b');
		assertParsesLatex('       ', '');
		assertParsesLatex('', '');
	});

	test('parens', function () {
		const tree = latexMathParser.parse<MathBlock>('\\left(123\\right)');

		assert.ok(tree.ends.left instanceof Bracket);
		const contents = (tree.ends.left?.ends.left as MathBlock | undefined)?.join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left(123\\right)');
	});

	test('\\langle/\\rangle (issue #508)', function () {
		const tree = latexMathParser.parse<MathBlock>('\\left\\langle 123\\right\\rangle)');

		assert.ok(tree.ends.left instanceof Bracket);
		const contents = (tree.ends.left?.ends.left as MathBlock | undefined)?.join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\langle 123\\right\\rangle )');
	});

	test('\\langle/\\rangle (without whitespace)', function () {
		const tree = latexMathParser.parse<MathBlock>('\\left\\langle123\\right\\rangle)');

		assert.ok(tree.ends.left instanceof Bracket);
		const contents = (tree.ends.left?.ends.left as MathBlock | undefined)?.join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\langle 123\\right\\rangle )');
	});

	test('\\lVert/\\rVert', function () {
		const tree = latexMathParser.parse<MathBlock>('\\left\\lVert 123\\right\\rVert)');

		assert.ok(tree.ends.left instanceof Bracket);
		const contents = (tree.ends.left?.ends.left as MathBlock | undefined)?.join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\lVert 123\\right\\rVert )');
	});

	test('\\lVert/\\rVert (without whitespace)', function () {
		const tree = latexMathParser.parse<MathBlock>('\\left\\lVert123\\right\\rVert)');

		assert.ok(tree.ends.left instanceof Bracket);
		const contents = (tree.ends.left?.ends.left as MathBlock | undefined)?.join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\lVert 123\\right\\rVert )');
	});

	test('\\langler should not parse', function () {
		assert.throws(() => latexMathParser.parse('\\left\\langler123\\right\\rangler'));
	});

	test('\\lVerte should not parse', function () {
		assert.throws(() => latexMathParser.parse('\\left\\lVerte123\\right\\rVerte'));
	});

	test('parens with whitespace', function () {
		assertParsesLatex('\\left ( 123 \\right ) ', '\\left(123\\right)');
	});

	test('escaped whitespace', function () {
		assertParsesLatex('\\ ', '\\ ');
		assertParsesLatex('\\      ', '\\ ');
		assertParsesLatex('  \\   \\\t\t\t\\   \\\n\n\n', '\\ \\ \\ \\ ');
		assertParsesLatex('\\space\\   \\   space  ', '\\ \\ \\ space');
	});

	test('\\text', function () {
		assertParsesLatex('\\text { lol! } ', '\\text{ lol! }');
		assertParsesLatex('\\text{apples} \\ne \\text{oranges}', '\\text{apples}\\ne \\text{oranges}');
		assertParsesLatex('\\text{}', '');
	});

	test('\\textcolor', function () {
		assertParsesLatex('\\textcolor{blue}{8}', '\\textcolor{blue}{8}');
	});

	test('\\class', function () {
		assertParsesLatex('\\class{name}{8}', '\\class{name}{8}');
		assertParsesLatex('\\class{name}{8-4}', '\\class{name}{8-4}');
	});

	test('not real LaTex commands, but valid symbols', function () {
		assertParsesLatex('\\parallelogram ');
		assertParsesLatex('\\circledot ', '\\odot ');
		assertParsesLatex('\\degree ');
		assertParsesLatex('\\square ');
	});

	suite('public API', function () {
		let mq: MathField;
		setup(function () {
			const field = document.createElement('span');
			document.getElementById('mock')?.append(field);
			mq = MQ.MathField(field);
		});

		suite('.latex(...)', function () {
			const assertParsesLatex = (str?: unknown, latex?: unknown) => {
				if (typeof latex === 'undefined') latex = str;
				mq.latex(str as string);
				assert.equal(mq.latex(), latex as string);
			};

			test('basic rendering', function () {
				assertParsesLatex(
					'x = \\frac{ -b \\pm \\sqrt{ b^2 - 4ac } }{ 2a }',
					'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'
				);
			});

			test('re-rendering', function () {
				assertParsesLatex('a x^2 + b x + c = 0', 'ax^2+bx+c=0');
				assertParsesLatex(
					'x = \\frac{ -b \\pm \\sqrt{ b^2 - 4ac } }{ 2a }',
					'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'
				);
			});

			test('empty LaTeX', function () {
				assertParsesLatex('');
				assertParsesLatex(' ', '');
				assertParsesLatex('{}', '');
				assertParsesLatex('   {}{} {{{}}  }', '');
			});

			test('coerces to a string', function () {
				assertParsesLatex(undefined, '');
				assertParsesLatex(null, 'null');
				assertParsesLatex(0, '0');
				assertParsesLatex(Infinity, 'Infinity');
				assertParsesLatex(NaN, 'NaN');
				assertParsesLatex(true, 'true');
				assertParsesLatex(false, 'false');
				assertParsesLatex({}, '[objectObject]'); // lol, the space gets ignored
				assertParsesLatex({ toString: () => 'thing' }, 'thing');
			});
		});

		suite('.write(...)', function () {
			test('empty LaTeX', function () {
				const assertParsesLatex = (str: unknown, latex?: unknown) => {
					if (typeof latex === 'undefined') latex = str;
					mq.write(str as string);
					assert.equal(mq.latex(), latex);
				};
				assertParsesLatex('');
				assertParsesLatex(' ', '');
				assertParsesLatex('{}', '');
				assertParsesLatex('   {}{} {{{}}  }', '');
			});

			test('overflow triggers automatic horizontal scroll', function (done) {
				const mqEl = mq.el();
				const rootEl = mq.__controller.root.elements.first as Element;
				const cursor = mq.__controller.cursor;

				mqEl.style.width = '10px';
				const previousScrollLeft = rootEl.scrollLeft;

				mq.write('abc');

				setTimeout(() => {
					cursor.show();

					try {
						assert.ok(rootEl.scrollLeft > previousScrollLeft, 'scrolls on write');
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

			suite('\\sum', function () {
				test('basic', function () {
					mq.write('\\sum_{n=0}^5');
					assert.equal(mq.latex(), '\\sum_{n=0}^5');
					mq.write('x^n');
					assert.equal(mq.latex(), '\\sum_{n=0}^5x^n');
				});

				test('only lower bound', function () {
					mq.write('\\sum_{n=0}');
					assert.equal(mq.latex(), '\\sum_{n=0}^{ }');
					mq.write('x^n');
					assert.equal(mq.latex(), '\\sum_{n=0}^{ }x^n');
				});

				test('only upper bound', function () {
					mq.write('\\sum^5');
					assert.equal(mq.latex(), '\\sum_{ }^5');
					mq.write('x^n');
					assert.equal(mq.latex(), '\\sum_{ }^5x^n');
				});
			});
		});
	});

	suite('\\MathQuillMathField', function () {
		let outer: StaticMath, inner1: InnerMathField, inner2: InnerMathField;
		setup(function () {
			const field = document.createElement('span');
			field.textContent = '\\frac{\\MathQuillMathField{x_0 + x_1 + x_2}}{\\MathQuillMathField{3}}';
			document.getElementById('mock')?.append(field);
			outer = MQ.StaticMath(field);
			inner1 = outer.innerFields[0];
			inner2 = outer.innerFields[1];
		});

		test('initial latex', function () {
			assert.equal(inner1.latex(), 'x_0+x_1+x_2');
			assert.equal(inner2.latex(), '3');
			assert.equal(outer.latex(), '\\frac{x_0+x_1+x_2}{3}');
		});

		test('setting latex', function () {
			inner1.latex('\\sum_{i=0}^N x_i');
			inner2.latex('N');
			assert.equal(inner1.latex(), '\\sum_{i=0}^Nx_i');
			assert.equal(inner2.latex(), 'N');
			assert.equal(outer.latex(), '\\frac{\\sum_{i=0}^Nx_i}{N}');
		});

		test('writing latex', function () {
			inner1.write('+ x_3');
			inner2.write('+ 1');
			assert.equal(inner1.latex(), 'x_0+x_1+x_2+x_3');
			assert.equal(inner2.latex(), '3+1');
			assert.equal(outer.latex(), '\\frac{x_0+x_1+x_2+x_3}{3+1}');
		});

		test('optional inner field name', function () {
			outer.latex(
				'\\MathQuillMathField[mantissa]{}\\cdot\\MathQuillMathField[base]{}^{\\MathQuillMathField[exp]{}}'
			);
			assert.equal(outer.innerFields.length, 3);

			const mantissa = outer.innerFields.get('mantissa');
			const base = outer.innerFields.get('base');
			const exp = outer.innerFields.get('exp');

			assert.equal(mantissa, outer.innerFields[0]);
			assert.equal(base, outer.innerFields[1]);
			assert.equal(exp, outer.innerFields[2]);

			mantissa?.latex('1.2345');
			base?.latex('10');
			exp?.latex('8');
			assert.equal(outer.latex(), '1.2345\\cdot10^8');
		});

		test('make inner field static and then editable', function () {
			outer.latex('y=\\MathQuillMathField[m]{\\textcolor{blue}{m}}x+\\MathQuillMathField[b]{b}');
			assert.equal(outer.innerFields.length, 2);
			// assert.equal(outer.innerFields.m.__controller.container, false);

			outer.innerFields.get('m')?.makeStatic();
			assert.equal(outer.innerFields.get('m')?.__controller.editable, false);
			assert.equal(
				outer.innerFields.get('m')?.__controller.container.classList.contains('mq-editable-field'),
				false
			);
			assert.equal(outer.innerFields.get('b')?.__controller.editable, true);

			//ensure no errors in making static field static
			outer.innerFields.get('m')?.makeStatic();
			assert.equal(outer.innerFields.get('m')?.__controller.editable, false);
			assert.equal(
				outer.innerFields.get('m')?.__controller.container.classList.contains('mq-editable-field'),
				false
			);
			assert.equal(outer.innerFields.get('b')?.__controller.editable, true);

			outer.innerFields.get('m')?.makeEditable();
			assert.equal(outer.innerFields.get('m')?.__controller.editable, true);
			assert.equal(
				outer.innerFields.get('m')?.__controller.container.classList.contains('mq-editable-field'),
				true
			);
			assert.equal(outer.innerFields.get('b')?.__controller.editable, true);

			//ensure no errors with making editable field editable
			outer.innerFields.get('m')?.makeEditable();
			assert.equal(outer.innerFields.get('m')?.__controller.editable, true);
			assert.equal(
				outer.innerFields.get('m')?.__controller.container.classList.contains('mq-editable-field'),
				true
			);
			assert.equal(outer.innerFields.get('b')?.__controller.editable, true);
		});

		test('separate API object', function () {
			const outer2 = MQ(outer.el()) as StaticMath | undefined;
			assert.equal(outer2?.innerFields.length, 2);
			assert.equal(outer2?.innerFields[0].id, inner1.id);
			assert.equal(outer2?.innerFields[1].id, inner2.id);
		});
	});

	suite('error handling', function () {
		let mq: MathField;
		setup(function () {
			const field = document.createElement('span');
			document.getElementById('mock')?.append(field);
			mq = MQ.MathField(field);
		});

		const testCantParse = (title: string, ...args: string[]) => {
			test(title, function () {
				for (const arg of args) {
					mq.latex(arg);
					assert.equal(mq.latex(), '', `shouldn't parse '${arg}'`);
				}
			});
		};

		testCantParse('missing blocks', '\\frac', '\\sqrt', '^', '_');
		testCantParse('unmatched close brace', '}', ' 1 + 2 } ', '1 - {2 + 3} }', '\\sqrt{ x }} + \\sqrt{y}');
		testCantParse('unmatched open brace', '{', '1 * { 2 + 3', '\\frac{ \\sqrt x }{{ \\sqrt y}');
		testCantParse('unmatched \\left/\\right', '\\left ( 1 + 2 )', ' [ 1, 2 \\right ]');
		testCantParse(
			'langlerfish/ranglerfish (checking for confusion with langle/rangle)',
			'\\left\\langlerfish 123\\right\\ranglerfish)'
		);
	});
});
