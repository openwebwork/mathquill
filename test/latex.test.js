/* global suite, test, assert, setup, MQ */

import { L } from 'src/constants';
import { Options } from 'src/options';
import { Bracket, latexMathParser } from 'commands/mathElements';

suite('latex', () => {
	const options = new Options();

	const assertParsesLatex = (str, latex) => {
		if (typeof latex === 'undefined') latex = str;

		const result = latexMathParser.parse(str).postOrder('finalizeTree', options).join('latex');
		assert.equal(result, latex, `parsing '${str}', got '${result}', expected '${latex}'`);
	};

	test('empty LaTeX', () => {
		assertParsesLatex('');
		assertParsesLatex(' ', '');
		assertParsesLatex('{}', '');
		assertParsesLatex('   {}{} {{{}}  }', '');
	});

	test('variables', () => assertParsesLatex('xyz'));

	test('variables that can be mathbb', () => assertParsesLatex('PNZQRCH'));

	test('can parse mathbb symbols', () => {
		assertParsesLatex(
			'\\P\\N\\Z\\Q\\R\\C\\H',
			'\\mathbb{P}\\mathbb{N}\\mathbb{Z}\\mathbb{Q}\\mathbb{R}\\mathbb{C}\\mathbb{H}'
		);
		assertParsesLatex('\\mathbb{P}\\mathbb{N}\\mathbb{Z}\\mathbb{Q}\\mathbb{R}\\mathbb{C}\\mathbb{H}');
	});

	test('can parse mathbb error case', () => {
		assert.throws(() => assertParsesLatex('\\mathbb + 2'));
		assert.throws(() => assertParsesLatex('\\mathbb{A}'));
	});

	test('simple exponent', () => assertParsesLatex('x^n'));

	test('block exponent', () => {
		assertParsesLatex('x^{n}', 'x^n');
		assertParsesLatex('x^{nm}');
		assertParsesLatex('x^{}', 'x^{ }');
	});

	test('nested exponents', () => assertParsesLatex('x^{n^m}'));

	test('exponents with spaces', () => {
		assertParsesLatex('x^ 2', 'x^2');
		assertParsesLatex('x ^2', 'x^2');
	});

	test('inner groups', () => {
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

	test('commands without braces', () => {
		assertParsesLatex('\\frac12', '\\frac{1}{2}');
		assertParsesLatex('\\frac1a', '\\frac{1}{a}');
		assertParsesLatex('\\frac ab', '\\frac{a}{b}');

		assertParsesLatex('\\frac a b', '\\frac{a}{b}');
		assertParsesLatex(' \\frac a b ', '\\frac{a}{b}');
		assertParsesLatex('\\frac{1} 2', '\\frac{1}{2}');
		assertParsesLatex('\\frac{ 1 } 2', '\\frac{1}{2}');

		assert.throws(() => latexMathParser.parse('\\frac'));
	});

	test('whitespace', () => {
		assertParsesLatex('  a + b ', 'a+b');
		assertParsesLatex('       ', '');
		assertParsesLatex('', '');
	});

	test('parens', () => {
		const tree = latexMathParser.parse('\\left(123\\right)');

		assert.ok(tree.ends[L] instanceof Bracket);
		const contents = tree.ends[L].ends[L].join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left(123\\right)');
	});

	test('\\langle/\\rangle (issue #508)', () => {
		const tree = latexMathParser.parse('\\left\\langle 123\\right\\rangle)');

		assert.ok(tree.ends[L] instanceof Bracket);
		const contents = tree.ends[L].ends[L].join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\langle 123\\right\\rangle )');
	});

	test('\\langle/\\rangle (without whitespace)', () => {
		const tree = latexMathParser.parse('\\left\\langle123\\right\\rangle)');

		assert.ok(tree.ends[L] instanceof Bracket);
		const contents = tree.ends[L].ends[L].join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\langle 123\\right\\rangle )');
	});

	test('\\lVert/\\rVert', () => {
		const tree = latexMathParser.parse('\\left\\lVert 123\\right\\rVert)');

		assert.ok(tree.ends[L] instanceof Bracket);
		const contents = tree.ends[L].ends[L].join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\lVert 123\\right\\rVert )');
	});

	test('\\lVert/\\rVert (without whitespace)', () => {
		const tree = latexMathParser.parse('\\left\\lVert123\\right\\rVert)');

		assert.ok(tree.ends[L] instanceof Bracket);
		const contents = tree.ends[L].ends[L].join('latex');
		assert.equal(contents, '123');
		assert.equal(tree.join('latex'), '\\left\\lVert 123\\right\\rVert )');
	});

	test('\\langler should not parse', () => {
		assert.throws(() => latexMathParser.parse('\\left\\langler123\\right\\rangler'));
	});

	test('\\lVerte should not parse', () => {
		assert.throws(() => latexMathParser.parse('\\left\\lVerte123\\right\\rVerte'));
	});

	test('parens with whitespace', () => assertParsesLatex('\\left ( 123 \\right ) ', '\\left(123\\right)'));

	test('escaped whitespace', () => {
		assertParsesLatex('\\ ', '\\ ');
		assertParsesLatex('\\      ', '\\ ');
		assertParsesLatex('  \\   \\\t\t\t\\   \\\n\n\n', '\\ \\ \\ \\ ');
		assertParsesLatex('\\space\\   \\   space  ', '\\ \\ \\ space');
	});

	test('\\text', () => {
		assertParsesLatex('\\text { lol! } ', '\\text{ lol! }');
		assertParsesLatex('\\text{apples} \\ne \\text{oranges}', '\\text{apples}\\ne \\text{oranges}');
		assertParsesLatex('\\text{}', '');
	});

	test('\\textcolor', () => assertParsesLatex('\\textcolor{blue}{8}', '\\textcolor{blue}{8}'));

	test('\\class', () => {
		assertParsesLatex('\\class{name}{8}', '\\class{name}{8}');
		assertParsesLatex('\\class{name}{8-4}', '\\class{name}{8-4}');
	});

	test('not real LaTex commands, but valid symbols', () => {
		assertParsesLatex('\\parallelogram ');
		assertParsesLatex('\\circledot ', '\\odot ');
		assertParsesLatex('\\degree ');
		assertParsesLatex('\\square ');
	});

	suite('public API', () => {
		let mq;
		setup(() => {
			const field = document.createElement('span');
			document.getElementById('mock')?.append(field);
			mq = MQ.MathField(field);
		});

		suite('.latex(...)', () => {
			const assertParsesLatex = (str, latex) => {
				if (typeof latex === 'undefined') latex = str;
				mq.latex(str);
				assert.equal(mq.latex(), latex);
			};

			test('basic rendering', () => {
				assertParsesLatex(
					'x = \\frac{ -b \\pm \\sqrt{ b^2 - 4ac } }{ 2a }',
					'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'
				);
			});

			test('re-rendering', () => {
				assertParsesLatex('a x^2 + b x + c = 0', 'ax^2+bx+c=0');
				assertParsesLatex(
					'x = \\frac{ -b \\pm \\sqrt{ b^2 - 4ac } }{ 2a }',
					'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'
				);
			});

			test('empty LaTeX', () => {
				assertParsesLatex('');
				assertParsesLatex(' ', '');
				assertParsesLatex('{}', '');
				assertParsesLatex('   {}{} {{{}}  }', '');
			});

			test('coerces to a string', () => {
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

		suite('.write(...)', () => {
			test('empty LaTeX', () => {
				const assertParsesLatex = (str, latex) => {
					if (typeof latex === 'undefined') latex = str;
					mq.write(str);
					assert.equal(mq.latex(), latex);
				};
				assertParsesLatex('');
				assertParsesLatex(' ', '');
				assertParsesLatex('{}', '');
				assertParsesLatex('   {}{} {{{}}  }', '');
			});

			test('overflow triggers automatic horizontal scroll', (done) => {
				const mqEl = mq.el();
				const rootEl = mq.__controller.root.elements.first;
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

			suite('\\sum', () => {
				test('basic', () => {
					mq.write('\\sum_{n=0}^5');
					assert.equal(mq.latex(), '\\sum_{n=0}^5');
					mq.write('x^n');
					assert.equal(mq.latex(), '\\sum_{n=0}^5x^n');
				});

				test('only lower bound', () => {
					mq.write('\\sum_{n=0}');
					assert.equal(mq.latex(), '\\sum_{n=0}^{ }');
					mq.write('x^n');
					assert.equal(mq.latex(), '\\sum_{n=0}^{ }x^n');
				});

				test('only upper bound', () => {
					mq.write('\\sum^5');
					assert.equal(mq.latex(), '\\sum_{ }^5');
					mq.write('x^n');
					assert.equal(mq.latex(), '\\sum_{ }^5x^n');
				});
			});
		});
	});

	suite('\\MathQuillMathField', () => {
		let outer, inner1, inner2;
		setup(() => {
			const field = document.createElement('span');
			field.textContent = '\\frac{\\MathQuillMathField{x_0 + x_1 + x_2}}{\\MathQuillMathField{3}}';
			document.getElementById('mock')?.append(field);
			outer = MQ.StaticMath(field);
			inner1 = outer.innerFields[0];
			inner2 = outer.innerFields[1];
		});

		test('initial latex', () => {
			assert.equal(inner1.latex(), 'x_0+x_1+x_2');
			assert.equal(inner2.latex(), '3');
			assert.equal(outer.latex(), '\\frac{x_0+x_1+x_2}{3}');
		});

		test('setting latex', () => {
			inner1.latex('\\sum_{i=0}^N x_i');
			inner2.latex('N');
			assert.equal(inner1.latex(), '\\sum_{i=0}^Nx_i');
			assert.equal(inner2.latex(), 'N');
			assert.equal(outer.latex(), '\\frac{\\sum_{i=0}^Nx_i}{N}');
		});

		test('writing latex', () => {
			inner1.write('+ x_3');
			inner2.write('+ 1');
			assert.equal(inner1.latex(), 'x_0+x_1+x_2+x_3');
			assert.equal(inner2.latex(), '3+1');
			assert.equal(outer.latex(), '\\frac{x_0+x_1+x_2+x_3}{3+1}');
		});

		test('optional inner field name', () => {
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

			mantissa.latex('1.2345');
			base.latex('10');
			exp.latex('8');
			assert.equal(outer.latex(), '1.2345\\cdot10^8');
		});

		test('make inner field static and then editable', () => {
			outer.latex('y=\\MathQuillMathField[m]{\\textcolor{blue}{m}}x+\\MathQuillMathField[b]{b}');
			assert.equal(outer.innerFields.length, 2);
			// assert.equal(outer.innerFields.m.__controller.container, false);

			outer.innerFields.get('m').makeStatic();
			assert.equal(outer.innerFields.get('m').__controller.editable, false);
			assert.equal(
				outer.innerFields.get('m').__controller.container.classList.contains('mq-editable-field'),
				false
			);
			assert.equal(outer.innerFields.get('b').__controller.editable, true);

			//ensure no errors in making static field static
			outer.innerFields.get('m').makeStatic();
			assert.equal(outer.innerFields.get('m').__controller.editable, false);
			assert.equal(
				outer.innerFields.get('m').__controller.container.classList.contains('mq-editable-field'),
				false
			);
			assert.equal(outer.innerFields.get('b').__controller.editable, true);

			outer.innerFields.get('m').makeEditable();
			assert.equal(outer.innerFields.get('m').__controller.editable, true);
			assert.equal(
				outer.innerFields.get('m').__controller.container.classList.contains('mq-editable-field'),
				true
			);
			assert.equal(outer.innerFields.get('b').__controller.editable, true);

			//ensure no errors with making editable field editable
			outer.innerFields.get('m').makeEditable();
			assert.equal(outer.innerFields.get('m').__controller.editable, true);
			assert.equal(
				outer.innerFields.get('m').__controller.container.classList.contains('mq-editable-field'),
				true
			);
			assert.equal(outer.innerFields.get('b').__controller.editable, true);
		});

		test('separate API object', () => {
			const outer2 = MQ(outer.el());
			assert.equal(outer2.innerFields.length, 2);
			assert.equal(outer2.innerFields[0].id, inner1.id);
			assert.equal(outer2.innerFields[1].id, inner2.id);
		});
	});

	suite('error handling', () => {
		let mq;
		setup(() => {
			const field = document.createElement('span');
			document.getElementById('mock')?.append(field);
			mq = MQ.MathField(field);
		});

		const testCantParse = (title, ...args) => {
			test(title, () => {
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

	suite('selectable span', () => {
		setup(() => {
			const field = document.createElement('span');
			field.innerHTML = '2&lt;x';
			document.getElementById('mock')?.append(field);
			MQ.StaticMath(field);
		});

		const selectableContent = () => document.querySelector('#mock .mq-selectable').textContent;

		test('escapes < in textContent', () => assert.equal(selectableContent(), '$2<x$'));
	});
});
