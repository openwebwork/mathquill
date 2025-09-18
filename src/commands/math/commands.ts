// Commands and Operators.

import {
	type Constructor,
	bindMixin,
	LatexCmds,
	CharCmds,
	OPP_BRACKS,
	SVG_SYMBOLS,
	EMBEDS,
	EmbedOptions
} from 'src/constants';
import type { Options } from 'src/options';
import { Controller } from 'src/controller';
import { Cursor } from 'src/cursor';
import { Parser } from 'services/parser.util';
import { RootBlockMixin, DelimsMixin } from 'src/mixins';
import type { TNode, MathspeakOptions } from 'tree/node';
import { Fragment } from 'tree/fragment';
import type { InnerMathFieldStore } from 'commands/math';
import { InnerMathField } from 'commands/math';
import type { MathBlock } from 'commands/mathBlock';
import type { MathElement } from 'commands/mathElements';
import {
	BinaryOperator,
	Equality,
	MathCommand,
	Symbol,
	Letter,
	insLeftOfMeUnlessAtEnd,
	Fraction,
	SupSub,
	UpperLowerLimitCommand,
	Bracket,
	latexMathParser,
	supSubText,
	MathFunction,
	intRgx,
	getCtrlSeqsFromBlock
} from 'commands/mathElements';

class Style extends MathCommand {
	shouldNotSpeakDelimiters: boolean | undefined;

	constructor(
		ctrlSeq: string,
		tagName: string,
		attrs: string,
		ariaLabel?: string,
		shouldNotSpeakDelimiters?: boolean
	) {
		super(ctrlSeq, `<${tagName} ${attrs}>&0</${tagName}>`);
		this.ariaLabel = ariaLabel || ctrlSeq.replace(/^\\/, '');
		this.mathspeakTemplate = [`Start${this.ariaLabel},`, `End${this.ariaLabel}`];

		// In most cases, mathspeak should announce the start and end of style blocks.
		// There is one exception currently (mathrm).
		this.shouldNotSpeakDelimiters = shouldNotSpeakDelimiters;
	}

	mathspeak(opts?: MathspeakOptions) {
		if (!this.shouldNotSpeakDelimiters || opts?.ignoreShorthand) return super.mathspeak();
		return this.foldChildren('', (speech, block) => `${speech} ${block.mathspeak(opts)}`).trim();
	}
}

// fonts
LatexCmds.mathrm = bindMixin(Style, '\\mathrm', 'span', 'class="mq-roman mq-font"', 'Roman Font', true);
LatexCmds.mathit = bindMixin(Style, '\\mathit', 'i', 'class="mq-font"', 'Italic Font');
LatexCmds.mathbf = bindMixin(Style, '\\mathbf', 'b', 'class="mq-font"', 'Bold Font');
LatexCmds.mathsf = bindMixin(Style, '\\mathsf', 'span', 'class="mq-sans-serif mq-font"', 'Serif Font');
LatexCmds.mathtt = bindMixin(Style, '\\mathtt', 'span', 'class="mq-monospace mq-font"', 'Math Text');
// text-decoration
LatexCmds.underline = bindMixin(Style, '\\underline', 'span', 'class="mq-non-leaf mq-underline"', 'Underline');
LatexCmds.overline = LatexCmds.bar = bindMixin(
	Style,
	'\\overline',
	'span',
	'class="mq-non-leaf mq-overline"',
	'Overline'
);
LatexCmds.overrightarrow = bindMixin(
	Style,
	'\\overrightarrow',
	'span',
	'class="mq-non-leaf mq-overarrow mq-arrow-right"',
	'Over Right Arrow'
);
LatexCmds.overleftarrow = bindMixin(
	Style,
	'\\overleftarrow',
	'span',
	'class="mq-non-leaf mq-overarrow mq-arrow-left"',
	'Over Left Arrow'
);
LatexCmds.overleftrightarrow = bindMixin(
	Style,
	'\\overleftrightarrow',
	'span',
	'class="mq-non-leaf mq-overarrow mq-arrow-both"',
	'Over Left and Right Arrow'
);
LatexCmds.overarc = bindMixin(Style, '\\overarc', 'span', 'class="mq-non-leaf mq-overarc"', 'Over Arc');
LatexCmds.dot = class extends MathCommand {
	constructor() {
		super(
			'\\dot',
			'<span class="mq-non-leaf"><span class="mq-dot-recurring-inner">' +
				'<span class="mq-dot-recurring">&#x2d9;</span>' +
				'<span class="mq-empty-box">&0</span>' +
				'</span></span>'
		);
	}
};

// `\textcolor{color}{math}` will apply a color to the given math content, where `color` is any valid CSS Color Value.
LatexCmds.textcolor = class extends MathCommand {
	color?: string;

	setColor(color: string) {
		this.color = color;
		this.htmlTemplate = `<span class="mq-textcolor" style="color:${color}">&0</span>`;
		this.ariaLabel = color.replace(/^\\/, '');
		this.mathspeakTemplate = [`Start ${this.ariaLabel},`, `End ${this.ariaLabel}`];
	}

	latex() {
		return `\\textcolor{${this.color ?? ''}}{${this.blocks[0].latex()}}`;
	}

	parser() {
		return Parser.optWhitespace
			.then(Parser.string('{'))
			.then(Parser.regex(/^[#\w\s.,()%-]*/))
			.skip(Parser.string('}'))
			.then((color: string) => {
				this.setColor(color);
				return super.parser();
			});
	}

	isStyleBlock() {
		return true;
	}
};

// Very similar to the \textcolor command, but will add the given CSS class.
// Usage: \class{classname}{math}
// Note regex that whitelists valid CSS classname characters:
// https://github.com/mathquill/mathquill/pull/191#discussion_r4327442
LatexCmds.class = class extends MathCommand {
	cls?: string;

	parser() {
		return Parser.optWhitespace
			.then(Parser.string('{'))
			.then(Parser.regex(/^[-\w\s\\\xA0-\xFF]*/))
			.skip(Parser.string('}'))
			.then((cls: string) => {
				this.cls = cls || '';
				this.htmlTemplate = `<span class="mq-class ${cls}">&0</span>`;
				this.ariaLabel = cls + ' class';
				this.mathspeakTemplate = [`Start ${this.ariaLabel},`, `End ${this.ariaLabel}`];
				return super.parser();
			});
	}

	latex() {
		return `\\class{${this.cls ?? ''}}{${this.blocks[0].latex()}}`;
	}

	isStyleBlock() {
		return true;
	}
};

LatexCmds.subscript = LatexCmds._ = class extends SupSub {
	constructor() {
		super();
		this.supsub = 'sub';
		this.htmlTemplate =
			'<span class="mq-supsub mq-non-leaf">' +
			'<span class="mq-sub">&0</span>' +
			'<span style="display:inline-block;width:0">&#8203;</span>' +
			'</span>';
		this.textTemplate = ['_'];
		this.mathspeakTemplate = ['Subscript,', ', Baseline'];
		this.ariaLabel = 'subscript';
	}

	finalizeTree() {
		this.downInto = this.sub = this.ends.left;
		if (this.sub) this.sub.upOutOf = insLeftOfMeUnlessAtEnd;
		super.finalizeTree();
	}
};

LatexCmds.superscript =
	LatexCmds.supscript =
	LatexCmds['^'] =
		class extends SupSub {
			constructor() {
				super();
				this.supsub = 'sup';
				this.htmlTemplate =
					'<span class="mq-supsub mq-non-leaf mq-sup-only">' + '<span class="mq-sup">&0</span>' + '</span>';
				this.textTemplate = ['^(', ')'];
				this.ariaLabel = 'superscript';
				this.mathspeakTemplate = ['Superscript,', ', Baseline'];
			}

			mathspeak(opts?: MathspeakOptions) {
				// Simplify basic exponent speech for common whole numbers.
				const child = this.upInto;
				if (child) {
					// Calculate this item's inner text to determine whether to shorten the returned speech.  Do not
					// calculate its inner mathspeak until it is known that the speech is to be truncated.  Since the
					// mathspeak computation is recursive, it should be called only once in this function to avoid
					// performance bottlenecks.
					const innerText = getCtrlSeqsFromBlock(child);
					// If the superscript is a whole number, shorten the speech that is returned.
					if (!opts?.ignoreShorthand && intRgx.test(innerText)) {
						// Simple cases
						if (innerText === '0') return 'to the power of 0';
						if (innerText === '1') return 'to the first power';
						else if (innerText === '2') return 'squared';
						else if (innerText === '3') return 'cubed';

						// More complex cases.
						let suffix = '';
						// Limit suffix addition to exponents < 1000.
						if (/^[+-]?\d{1,3}$/.test(innerText)) {
							if (/(11|12|13|4|5|6|7|8|9|0)$/.test(innerText)) suffix = 'th';
							else if (innerText.endsWith('1')) suffix = 'st';
							else if (innerText.endsWith('2')) suffix = 'nd';
							else if (innerText.endsWith('3')) suffix = 'rd';
						}
						return `to the ${typeof child === 'object' ? child.mathspeak() : innerText}${suffix} power`;
					}
				}
				return super.mathspeak();
			}

			finalizeTree() {
				this.upInto = this.sup = this.ends.right;
				if (this.sup) this.sup.downOutOf = insLeftOfMeUnlessAtEnd;
				super.finalizeTree();
			}
		};

class SummationNotation extends UpperLowerLimitCommand {
	constructor(ch: string, html: string, ariaLabel?: string) {
		super(
			ch,
			'<span class="mq-large-operator mq-non-leaf">' +
				'<span class="mq-to"><span>&1</span></span>' +
				`<big>${html}</big>` +
				'<span class="mq-from"><span>&0</span></span>' +
				'</span>',
			[ch.length > 1 ? ch.slice(1) : ch]
		);
		this.ariaLabel = ariaLabel || ch.replace(/^\\/, '');
	}

	createLeftOf(cursor: Cursor) {
		super.createLeftOf(cursor);
		if (cursor.options.sumStartsWithNEquals && !this.replacedFragment) {
			new Letter('n').createLeftOf(cursor);
			new Equality().createLeftOf(cursor);
		}
	}
}

LatexCmds['\u2211'] = LatexCmds.sum = LatexCmds.summation = bindMixin(SummationNotation, '\\sum ', '&sum;');
LatexCmds['\u220f'] = LatexCmds.prod = LatexCmds.product = bindMixin(SummationNotation, '\\prod ', '&prod;', 'product');
LatexCmds.coprod = LatexCmds.coproduct = bindMixin(SummationNotation, '\\coprod ', '&#8720;', 'coproduct');

LatexCmds['\u222b'] =
	LatexCmds.int =
	LatexCmds.integral =
		class extends UpperLowerLimitCommand {
			constructor() {
				super(
					'\\int ',
					'<span class="mq-int mq-non-leaf">' +
						'<big>&int;</big>' +
						'<span class="mq-supsub mq-non-leaf">' +
						'<span class="mq-sup"><span class="mq-sup-inner">&1</span></span>' +
						'<span class="mq-sub">&0</span>' +
						'<span style="display:inline-block;width:0">&#8203</span>' +
						'</span>' +
						'</span>'
				);
				this.ariaLabel = 'integral';
			}
		};

LatexCmds.frac = LatexCmds.dfrac = LatexCmds.cfrac = LatexCmds.fraction = Fraction;

const FractionChooseCreateLeftOfMixin = <TBase extends Constructor<MathCommand>>(Base: TBase) =>
	class extends Base {
		createLeftOf(cursor: Cursor) {
			if (!this.replacedFragment) {
				let leftward: TNode | undefined = cursor.left;
				while (
					leftward &&
					!(
						(leftward instanceof BinaryOperator && !(leftward instanceof LatexCmds.factorial)) ||
						('text' in LatexCmds && leftward instanceof LatexCmds.text) ||
						leftward instanceof UpperLowerLimitCommand ||
						leftward.ctrlSeq === '\\ ' ||
						/^[,;:]$/.test(leftward.ctrlSeq)
					) // lookbehind for operator
				)
					leftward = leftward.left;

				if (leftward instanceof UpperLowerLimitCommand && leftward.right instanceof SupSub) {
					leftward = leftward.right;
					if (leftward.right instanceof SupSub && leftward.right.ctrlSeq != leftward.ctrlSeq)
						leftward = leftward.right;
				}

				if (
					leftward !== cursor.left &&
					!cursor.isTooDeep(1) &&
					!cursor.left?.elements.hasClass('mq-operator-name')
				) {
					this.replaces(new Fragment(leftward?.right || cursor.parent?.ends.left, cursor.left));
					cursor.left = leftward;
				}
			}
			super.createLeftOf(cursor);
		}
	};

// LiveFraction
LatexCmds.over = CharCmds['/'] = class extends FractionChooseCreateLeftOfMixin(Fraction) {};

// Note that the non-standard variants of these are no longer supported.  Those are cosec, cotan, and ctg, and all of
// the derived variants of those, as well as any of the ar${trigFunction}h derived variants.
for (const trigFunction of ['sin', 'cos', 'tan', 'sec', 'csc', 'cot']) {
	for (const trigVariant of [
		trigFunction,
		`arc${trigFunction}`,
		`a${trigFunction}`,
		`${trigFunction}h`,
		`arc${trigFunction}h`,
		`a${trigFunction}h`
	]) {
		LatexCmds[trigVariant] = bindMixin(MathFunction, `\\${trigVariant}`);
	}
}

LatexCmds.exp = bindMixin(MathFunction, '\\exp');

LatexCmds.ln = bindMixin(MathFunction, '\\ln');
LatexCmds.log = class extends MathFunction {
	constructor() {
		super('\\log');
	}

	text() {
		const base = this.blocks[0].ends.left?.sub?.text() || '';
		const param = this.blocks[1].text() || '';
		const exponent = supSubText('^', this.blocks[0].ends.left?.sup);

		if (!base) return super.text();
		else if (base === '10') {
			return exponent ? `(log10(${param}))${exponent}` : `log10(${param})`;
		} else if (this.getController()?.options.logsChangeBase) {
			let leftward = this.left;
			for (; leftward && leftward.ctrlSeq === '\\ '; leftward = leftward.left);
			return exponent ||
				(leftward && !(leftward instanceof BinaryOperator)) ||
				(leftward instanceof BinaryOperator && leftward.isUnary)
				? `(log(${param})/log(${base}))${exponent}`
				: `log(${param})/log(${base})`;
		} else {
			return exponent ? `(logb(${base},${param}))${exponent}` : `logb(${base},${param})`;
		}
	}
};

class SquareRoot extends MathCommand {
	constructor() {
		super();
		this.ctrlSeq = '\\sqrt';
		this.htmlTemplate =
			'<span class="mq-non-leaf mq-sqrt-container">' +
			'<span class="mq-scaled mq-sqrt-prefix">' +
			SVG_SYMBOLS.sqrt.html +
			'</span>' +
			'<span class="mq-non-leaf mq-sqrt-stem">&0</span>' +
			'</span>';
		this.textTemplate = ['sqrt(', ')'];
		this.mathspeakTemplate = ['StartSquareRoot,', ', EndSquareRoot'];
		this.ariaLabel = 'square root';
	}

	parser() {
		return latexMathParser.optBlock
			.then((optBlock: MathBlock) => {
				return latexMathParser.block.map((block: MathBlock) => {
					const nthroot = new NthRoot();
					nthroot.blocks = [optBlock, block];
					optBlock.adopt(nthroot);
					block.adopt(nthroot, optBlock);
					return nthroot;
				});
			})
			.or(super.parser());
	}
}
LatexCmds.sqrt = LatexCmds['\u221a'] = SquareRoot;

LatexCmds.hat = class extends MathCommand {
	constructor() {
		super(
			'\\hat',
			'<span class="mq-non-leaf">' +
				'<span class="mq-hat-prefix">^</span>' +
				'<span class="mq-hat-stem">&0</span>' +
				'</span>',
			['hat(', ')']
		);
	}
};

class NthRoot extends SquareRoot {
	constructor() {
		super();
		this.htmlTemplate =
			'<span class="mq-nthroot-container mq-non-leaf">' +
			'<span class="mq-nthroot mq-non-leaf">&0</span>' +
			'<span class="mq-scaled mq-sqrt-container">' +
			'<span class="mq-scaled mq-sqrt-prefix">' +
			SVG_SYMBOLS.sqrt.html +
			'</span>' +
			'<span class="mq-sqrt-stem mq-non-leaf">&1</span>' +
			'</span>' +
			'</span>';
		this.textTemplate = ['root(', ',', ')'];
		this.ariaLabel = 'root';
	}

	latex() {
		return `\\sqrt[${this.ends.left?.latex() ?? ''}]{${this.ends.right?.latex() ?? ''}}`;
	}

	text() {
		const index = this.ends.left?.text() ?? '';
		if (index === '' || index === '2') return `sqrt(${this.ends.right?.text() ?? ''})`;

		if (this.getController()?.options.rootsAreExponents) {
			const isSupR = this.right instanceof SupSub && this.right.supsub === 'sup';
			return `${isSupR ? '(' : ''}(${this.ends.right?.text() ?? ''})^(1/${index})${isSupR ? ')' : ''}`;
		}

		return `root(${index},${this.ends.right?.text() ?? ''})`;
	}

	mathspeak() {
		const indexMathspeak = this.ends.left?.mathspeak() ?? '';
		const radicandMathspeak = this.ends.right?.mathspeak() ?? '';
		if (this.ends.left) this.ends.left.ariaLabel = 'Index';
		if (this.ends.right) this.ends.right.ariaLabel = 'Radicand';
		if (indexMathspeak === '3') return `Start Cube Root, ${radicandMathspeak}, End Cube Root`;
		else return `Root Index ${indexMathspeak}, Start Root, ${radicandMathspeak}, End Root`;
	}
}
LatexCmds.root = LatexCmds.nthroot = NthRoot;

class DiacriticAbove extends MathCommand {
	constructor(ctrlSeq: string, symbol: string, textTemplate: string[]) {
		super(
			ctrlSeq,
			'<span class="mq-non-leaf">' +
				`<span class="mq-diacritic-above">${symbol}</span>` +
				'<span class="mq-diacritic-stem">&0</span>' +
				'</span>',
			textTemplate
		);
	}
}
LatexCmds.vec = bindMixin(DiacriticAbove, '\\vec', '&rarr;', ['vec(', ')']);
LatexCmds.tilde = bindMixin(DiacriticAbove, '\\tilde', '~', ['tilde(', ')']);

const bindCharBracketPair = (open: string, ctrlSeq?: string) => {
	const curCtrlSeq = ctrlSeq || open,
		close = OPP_BRACKS[open],
		end = OPP_BRACKS[curCtrlSeq];
	CharCmds[open] = bindMixin(Bracket, 'left', open, close, curCtrlSeq, end);
	CharCmds[close] = bindMixin(Bracket, 'right', open, close, curCtrlSeq, end);
};
bindCharBracketPair('(');
bindCharBracketPair('[');
bindCharBracketPair('{', '\\{');
LatexCmds.langle = bindMixin(Bracket, 'left', '&lang;', '&rang;', '\\langle ', '\\rangle ');
LatexCmds.rangle = bindMixin(Bracket, 'right', '&lang;', '&rang;', '\\langle ', '\\rangle ');
LatexCmds.abs = CharCmds['|'] = bindMixin(Bracket, 'left', '|', '|', '|', '|');
LatexCmds.lVert = bindMixin(Bracket, 'left', '&#8741;', '&#8741;', '\\lVert ', '\\rVert ');
LatexCmds.rVert = bindMixin(Bracket, 'right', '&#8741;', '&#8741;', '\\lVert ', '\\rVert ');

LatexCmds.left = class extends MathCommand {
	parser() {
		return Parser.optWhitespace
			.then(Parser.regex(/^(?:[([|]|\\\{|\\langle(?![a-zA-Z])|\\lVert(?![a-zA-Z]))/))
			.then((ctrlSeq: string) => {
				let open = ctrlSeq.startsWith('\\') ? ctrlSeq.slice(1) : ctrlSeq;
				if (ctrlSeq == '\\langle') {
					open = '&lang;';
					ctrlSeq = ctrlSeq + ' ';
				}
				if (ctrlSeq == '\\lVert') {
					open = '&#8741;';
					ctrlSeq = ctrlSeq + ' ';
				}
				return latexMathParser.then((block: MathBlock) => {
					return Parser.string('\\right')
						.skip(Parser.optWhitespace)
						.then(Parser.regex(/^(?:[\])|]|\\\}|\\rangle(?![a-zA-Z])|\\rVert(?![a-zA-Z]))/))
						.map((end: string) => {
							let close = end.startsWith('\\') ? end.slice(1) : end;
							if (end == '\\rangle') {
								close = '&rang;';
								end = `${end} `;
							}
							if (end == '\\rVert') {
								close = '&#8741;';
								end = `${end} `;
							}
							const cmd = new Bracket(undefined, open, close, ctrlSeq, end);
							cmd.blocks = [block];
							block.adopt(cmd);
							return cmd;
						});
				});
			});
	}
};

LatexCmds.right = class extends MathCommand {
	parser() {
		return Parser.fail('unmatched \\right');
	}
};

class Binomial extends DelimsMixin(MathCommand) {
	constructor() {
		super(
			'\\binom',
			'<span class="mq-bracket-container mq-non-leaf">' +
				`<span class="mq-paren mq-bracket-l mq-scaled" style="width:${SVG_SYMBOLS['('].width}">` +
				SVG_SYMBOLS['('].html +
				'</span>' +
				`<span class="mq-bracket-middle mq-non-leaf" style="margin-left:${
					SVG_SYMBOLS['('].width
				};margin-right:${SVG_SYMBOLS[')'].width}">` +
				'<span class="mq-array mq-non-leaf">' +
				'<span>&0</span>' +
				'<span>&1</span>' +
				'</span>' +
				'</span>' +
				`<span class="mq-paren mq-bracket-r mq-scaled" style="width:${SVG_SYMBOLS[')'].width}">` +
				SVG_SYMBOLS[')'].html +
				'</span>' +
				'</span>',
			['choose(', ',', ')']
		);
		this.mathspeakTemplate = ['StartBinomial,', 'Choose', ', EndBinomial'];
		this.ariaLabel = 'binomial';
	}

	finalizeTree() {
		this.upInto = this.ends.left;
		this.downInto = this.ends.right;
		if (this.ends.right) {
			this.ends.right.upOutOf = this.ends.left;
			this.ends.right.ariaLabel = 'lower index';
		}
		if (this.ends.left) {
			this.ends.left.downOutOf = this.ends.right;
			this.ends.left.ariaLabel = 'upper index';
		}
	}
}
LatexCmds.binom = LatexCmds.binomial = Binomial;

LatexCmds.choose = class extends FractionChooseCreateLeftOfMixin(Binomial) {};

// backcompat with before cfd3620 on #233
LatexCmds.editable = LatexCmds.MathQuillMathField = class extends MathCommand {
	name = '';
	field?: InnerMathField;

	constructor() {
		super(
			'\\MathQuillMathField',
			'<span class="mq-editable-field">' + '<span class="mq-root-block" aria-hidden="true">&0</span>' + '</span>'
		);
	}

	parser() {
		return Parser.string('[')
			.then(Parser.regex(/^[a-z][a-z0-9]*/i))
			.skip(Parser.string(']'))
			.map((name: string) => (this.name = name))
			.or(Parser.succeed())
			.then(super.parser());
	}

	finalizeTree(options: Options) {
		if (!this.ends.left) throw new Error('Missing left end finalizing editable tree');
		const ctrlr = new Controller(this.ends.left, this.elements.firstElement, options);
		ctrlr.KIND_OF_MQ = 'MathField';
		this.field = new InnerMathField(ctrlr);
		this.field.name = this.name;
		ctrlr.editable = true;
		ctrlr.createTextarea();
		ctrlr.editablesTextareaEvents();
		ctrlr.cursor.insAtRightEnd(ctrlr.root);
		RootBlockMixin(ctrlr.root as MathElement);

		// MathQuill applies aria-hidden to .mq-root-block containers because these contain math notation that screen
		// readers can't interpret directly. MathQuill uses an aria-live region as a sibling of these block containers
		// to provide an alternative representation for screen readers.
		//
		// MathQuillMathFields have their own focusable text aria and aria live region, so it is incorrect for any
		// parent of the editable field to have an aria-hidden property.
		//
		// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden
		//
		// Handle this by recursively walking the parents of this element until we hit a root block, and if we hit any
		// parent with aria-hidden="true", removing the property from the parent and pushing it down to each of the
		// parents children. This should result in no parent of this node having aria-hidden="true", but should keep as
		// much of what was previously hidden hidden as possible while obeying this constraint.
		const pushDownAriaHidden = (node: Node | null) => {
			if (!(node instanceof Element)) return;
			if (node.getAttribute('aria-hidden') === 'true') {
				node.removeAttribute('aria-hidden');
				node.childNodes.forEach((child) => {
					if (child instanceof Element) child.setAttribute('aria-hidden', 'true');
				});
			}
			if (node.parentNode && !node.classList.contains('mq-root-block')) pushDownAriaHidden(node.parentNode);
		};

		pushDownAriaHidden(this.elements.first.parentNode);
		this.elements.removeClass('aria-hidden');

		this.field.blur();
	}

	registerInnerField(innerFields: InnerMathFieldStore) {
		if (!this.field) throw new Error('Unable to register editable without field');
		innerFields.push(this.field);
	}

	latex() {
		return this.ends.left?.latex() ?? '';
	}

	text() {
		return this.ends.left?.text() ?? '';
	}
};

// Embed arbitrary things
// Probably the closest DOM analogue would be an iframe?
// From MathQuill's perspective, it's a Symbol, it can be
// anywhere and the cursor can go around it but never in it.
// Create by calling public API method .dropEmbedded(),
// or by calling the global public API method .registerEmbed()
// and rendering LaTeX like \embed{registeredName} (see test).
LatexCmds.embed = class extends Symbol {
	setOptions(options: EmbedOptions) {
		const noop = () => '';
		this.text = options.text || noop;
		this.htmlTemplate = options.htmlString || '';
		this.latex = options.latex || noop;
		return this;
	}

	parser() {
		return Parser.string('{')
			.then(Parser.regex(/^[a-z][a-z0-9]*/i))
			.skip(Parser.string('}'))
			.then((name: string) =>
				// the chars allowed in the optional data block are arbitrary other than
				// excluding curly braces and square brackets (which'd be too confusing)
				Parser.string('[')
					.then(Parser.regex(/^[-\w\s]*/))
					.skip(Parser.string(']'))
					.or(Parser.succeed())
					.map((data: string) => this.setOptions(EMBEDS[name](data)))
			);
	}
};
