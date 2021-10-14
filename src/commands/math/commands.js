// Commands and Operators.

import { noop, L, R, bindMixin, LatexCmds, CharCmds, OPP_BRACKS, EMBEDS } from 'src/constants';
import { Parser } from 'services/parser.util';
import { Controller } from 'src/controller';
import { RootBlockMixin, scale, DelimsMixin } from 'src/mixins';
import { Fragment } from 'tree/fragment';
import {
	BinaryOperator, Equality, MathCommand, Symbol, Letter, insLeftOfMeUnlessAtEnd, SupSub, UpperLowerLimitCommand, Bracket,
	latexMathParser
} from 'commands/mathElements';

class Style extends MathCommand {
	constructor(ctrlSeq, tagName, attrs) {
		super(ctrlSeq, `<${tagName} ${attrs}>&0</${tagName}>`);
	}
}

//fonts
LatexCmds.mathrm = bindMixin(Style, '\\mathrm', 'span', 'class="mq-roman mq-font"');
LatexCmds.mathit = bindMixin(Style, '\\mathit', 'i', 'class="mq-font"');
LatexCmds.mathbf = bindMixin(Style, '\\mathbf', 'b', 'class="mq-font"');
LatexCmds.mathsf = bindMixin(Style, '\\mathsf', 'span', 'class="mq-sans-serif mq-font"');
LatexCmds.mathtt = bindMixin(Style, '\\mathtt', 'span', 'class="mq-monospace mq-font"');
//text-decoration
LatexCmds.underline = bindMixin(Style, '\\underline', 'span', 'class="mq-non-leaf mq-underline"');
LatexCmds.overline = LatexCmds.bar = bindMixin(Style, '\\overline', 'span', 'class="mq-non-leaf mq-overline"');
LatexCmds.overrightarrow = bindMixin(Style, '\\overrightarrow', 'span', 'class="mq-non-leaf mq-overarrow mq-arrow-right"');
LatexCmds.overleftarrow = bindMixin(Style, '\\overleftarrow', 'span', 'class="mq-non-leaf mq-overarrow mq-arrow-left"');
LatexCmds.overleftrightarrow = bindMixin(Style, '\\overleftrightarrow', 'span', 'class="mq-non-leaf mq-overarrow mq-arrow-both"');
LatexCmds.overarc = bindMixin(Style, '\\overarc', 'span', 'class="mq-non-leaf mq-overarc"');
LatexCmds.dot = class extends MathCommand {
	constructor() {
		super('\\dot', '<span class="mq-non-leaf"><span class="mq-dot-recurring-inner">'
			+ '<span class="mq-dot-recurring">&#x2d9;</span>'
			+ '<span class="mq-empty-box">&0</span>'
			+ '</span></span>'
		);
	}
};

// `\textcolor{color}{math}` will apply a color to the given math content, where
// `color` is any valid CSS Color Value (see [SitePoint docs][] (recommended),
// [Mozilla docs][], or [W3C spec][]).
//
// [SitePoint docs]: http://reference.sitepoint.com/css/colorvalues
// [Mozilla docs]: https://developer.mozilla.org/en-US/docs/CSS/color_value#Values
// [W3C spec]: http://dev.w3.org/csswg/css3-color/#colorunits
LatexCmds.textcolor = class extends MathCommand {
	setColor(color) {
		this.color = color;
		this.htmlTemplate =
			`<span class="mq-textcolor" style="color:${color}">&0</span>`;
	}

	latex() {
		return `\\textcolor{${this.color}}{${this.blocks[0].latex()}}`;
	}

	parser() {
		const optWhitespace = Parser.optWhitespace;
		const string = Parser.string;
		const regex = Parser.regex;

		return optWhitespace
			.then(string('{'))
			.then(regex(/^[#\w\s.,()%-]*/))
			.skip(string('}'))
			.then((color) => {
				this.setColor(color);
				return super.parser();
			})
		;
	}

	isStyleBlock() {
		return true;
	}
};

// Very similar to the \textcolor command, but will add the given CSS class.
// Usage: \class{classname}{math}
// Note regex that whitelists valid CSS classname characters:
// https://github.com/mathquill/mathquill/pull/191#discussion_r4327442
LatexCmds['class'] = class extends MathCommand {
	parser() {
		const string = Parser.string, regex = Parser.regex;
		return Parser.optWhitespace
			.then(string('{'))
			.then(regex(/^[-\w\s\\\xA0-\xFF]*/))
			.skip(string('}'))
			.then((cls) => {
				this.cls = cls || '';
				this.htmlTemplate = '<span class="mq-class '+cls+'">&0</span>';
				return super.parser();
			})
		;
	}

	latex() {
		return `\\class{${this.cls}}{${this.blocks[0].latex()}}`;
	}

	isStyleBlock() {
		return true;
	}
};

LatexCmds.subscript = LatexCmds._ = class extends SupSub {
	constructor(...args) {
		super(...args);
		this.supsub = 'sub';
		this.htmlTemplate =
			'<span class="mq-supsub mq-non-leaf">'
			+   '<span class="mq-sub">&0</span>'
			+   '<span style="display:inline-block;width:0">&#8203;</span>'
			+ '</span>';
		this.textTemplate = [ '_' ];
	}

	finalizeTree() {
		this.downInto = this.sub = this.ends[L];
		this.sub.upOutOf = insLeftOfMeUnlessAtEnd;
		super.finalizeTree();
	}
};

LatexCmds.superscript = LatexCmds.supscript = LatexCmds['^'] = class extends SupSub {
	constructor(...args) {
		super(...args);
		this.supsub = 'sup';
		this.htmlTemplate =
			'<span class="mq-supsub mq-non-leaf mq-sup-only">'
			+   '<span class="mq-sup">&0</span>'
			+ '</span>';
		this.textTemplate = ['^(', ')'];
	}

	finalizeTree() {
		this.upInto = this.sup = this.ends[R];
		this.sup.downOutOf = insLeftOfMeUnlessAtEnd;
		super.finalizeTree();
	}
};

class SummationNotation extends UpperLowerLimitCommand {
	constructor(ch, html, ...args) {
		super(ch,
			'<span class="mq-large-operator mq-non-leaf">'
			+   '<span class="mq-to"><span>&1</span></span>'
			+   '<big>' + html + '</big>'
			+   '<span class="mq-from"><span>&0</span></span>'
			+ '</span>',
			[ch && ch.length > 1 ? ch.slice(1) : ch]);
	}

	createLeftOf(cursor, ...args) {
		super.createLeftOf(cursor, ...args);
		if (cursor.options.sumStartsWithNEquals) {
			new Letter('n').createLeftOf(cursor);
			new Equality().createLeftOf(cursor);
		}
	}
}

LatexCmds['\u2211'] =
	LatexCmds.sum =
	LatexCmds.summation = bindMixin(SummationNotation,'\\sum ','&sum;');

LatexCmds['\u220f'] =
	LatexCmds.prod =
	LatexCmds.product = bindMixin(SummationNotation,'\\prod ','&prod;');

LatexCmds.coprod =
	LatexCmds.coproduct = bindMixin(SummationNotation,'\\coprod ','&#8720;');

LatexCmds['\u222b'] = LatexCmds['int'] = LatexCmds.integral = class extends UpperLowerLimitCommand {
	constructor() {
		super('\\int ',
			'<span class="mq-int mq-non-leaf">'
			+   '<big>&int;</big>'
			+   '<span class="mq-supsub mq-non-leaf">'
			+     '<span class="mq-sup"><span class="mq-sup-inner">&1</span></span>'
			+     '<span class="mq-sub">&0</span>'
			+     '<span style="display:inline-block;width:0">&#8203</span>'
			+   '</span>'
			+ '</span>');
	}
};

const Fraction =
LatexCmds.frac =
LatexCmds.dfrac =
LatexCmds.cfrac =
LatexCmds.fraction = class extends MathCommand {
	constructor(...args) {
		super(...args);

		this.ctrlSeq = '\\frac';
		this.htmlTemplate =
			'<span class="mq-fraction mq-non-leaf">'
			+   '<span class="mq-numerator">&0</span>'
			+   '<span class="mq-denominator">&1</span>'
			+   '<span style="display:inline-block;width:0">&#8203;</span>'
			+ '</span>';
		this.textTemplate = ['((', ')/(', '))'];
	}

	text() {
		const text = (dir, block) => {
			const blankDefault = dir === L ? 0 : 1;
			const l = (block.ends[dir] && block.ends[dir].text() !== " ") && block.ends[dir].text();
			return l ? (l.length === 1 ? l : `(${l})`) : blankDefault;
		}
		return `(${text(L, this)}/${text(R, this)})`;
	}

	finalizeTree() {
		this.upInto = this.ends[R].upOutOf = this.ends[L];
		this.downInto = this.ends[L].downOutOf = this.ends[R];
	}
};

const FractionChooseCreateLeftOfMixin = (base) => class extends (base) {
	createLeftOf(cursor) {
		if (!this.replacedFragment) {
			let leftward = cursor[L];
			while (leftward &&
				!(
					leftward instanceof BinaryOperator ||
					leftward instanceof (LatexCmds.text || noop) ||
					leftward instanceof UpperLowerLimitCommand ||
					leftward.ctrlSeq === '\\ ' ||
					/^[,;:]$/.test(leftward.ctrlSeq)
				) //lookbehind for operator
			) leftward = leftward[L];

			if (leftward instanceof UpperLowerLimitCommand && leftward[R] instanceof SupSub) {
				leftward = leftward[R];
				if (leftward[R] instanceof SupSub && leftward[R].ctrlSeq != leftward.ctrlSeq)
					leftward = leftward[R];
			}

			if (leftward !== cursor[L] && !cursor.isTooDeep(1)) {
				this.replaces(new Fragment(leftward[R] || cursor.parent.ends[L], cursor[L]));
				cursor[L] = leftward;
			}
		}
		super.createLeftOf(cursor);
	}
};

const LiveFraction = LatexCmds.over = CharCmds['/'] = class extends FractionChooseCreateLeftOfMixin(Fraction) {};

const SquareRoot = LatexCmds.sqrt = LatexCmds['\u221a'] = class extends MathCommand {
	constructor(...args) {
		super(...args);
		this.ctrlSeq = '\\sqrt';
		this.htmlTemplate =
			'<span class="mq-non-leaf">'
			+   '<span class="mq-scaled mq-sqrt-prefix">&radic;</span>'
			+   '<span class="mq-non-leaf mq-sqrt-stem">&0</span>'
			+ '</span>';
		this.textTemplate = ['sqrt(', ')'];
	}

	parser() {
		return latexMathParser.optBlock.then((optBlock) => {
			return latexMathParser.block.map((block) => {
				const nthroot = new NthRoot();
				nthroot.blocks = [ optBlock, block ];
				optBlock.adopt(nthroot, 0, 0);
				block.adopt(nthroot, optBlock, 0);
				return nthroot;
			});
		}).or(super.parser());
	}

	reflow() {
		const block = this.ends[R].jQ;
		scale(block.prev(), 1, block.innerHeight()/+block.css('fontSize').slice(0,-2) - .1);
	}
};

LatexCmds.hat = class extends MathCommand {
	constructor(...args) {
		super(...args);
		this.ctrlSeq = '\\hat';
		this.htmlTemplate =
			'<span class="mq-non-leaf">'
			+   '<span class="mq-hat-prefix">^</span>'
			+   '<span class="mq-hat-stem">&0</span>'
			+ '</span>';
		this.textTemplate = ['hat(', ')'];
	}
};

const NthRoot = LatexCmds.root = LatexCmds.nthroot = class extends SquareRoot {
	constructor(...args) {
		super(...args);
		this.htmlTemplate =
			'<span class="mq-nthroot mq-non-leaf">&0</span>'
			+ '<span class="mq-scaled">'
			+   '<span class="mq-sqrt-prefix mq-scaled">&radic;</span>'
			+   '<span class="mq-sqrt-stem mq-non-leaf">&1</span>'
			+ '</span>';
		this.textTemplate = ['root(', ',', ')'];
	}

	latex() {
		return `\\sqrt[${this.ends[L].latex()}]{${this.ends[R].latex()}}`;
	}

	text() {
		if (this.ends[L].text() === "") return `sqrt(${this.ends[R].text()})`;
		const index = this.ends[L].text();
		// Navigate up the tree to find the controller which has the options.
		const ctrlr = (function getCursor(node) { return !node.controller ? getCursor(node.parent) : node.controller; })(this);
		if (ctrlr.options.rootsAreExponents)
			return `(${this.ends[R].text()})^(1/${index})`;
		return `root(${index},${this.ends[R].text()})`;
	}
};

class DiacriticAbove extends MathCommand {
	constructor(ctrlSeq, symbol, textTemplate) {
		const htmlTemplate =
			'<span class="mq-non-leaf">'
			+   '<span class="mq-diacritic-above">'+symbol+'</span>'
			+   '<span class="mq-diacritic-stem">&0</span>'
			+ '</span>';
		super(ctrlSeq, htmlTemplate, textTemplate);
	}
}
LatexCmds.vec = bindMixin(DiacriticAbove, '\\vec', '&rarr;', ['vec(', ')']);
LatexCmds.tilde = bindMixin(DiacriticAbove, '\\tilde', '~', ['tilde(', ')']);

const bindCharBracketPair = (open, ctrlSeq) => {
	const curCtrlSeq = ctrlSeq || open, close = OPP_BRACKS[open], end = OPP_BRACKS[curCtrlSeq];
	CharCmds[open] = bindMixin(Bracket, L, open, close, curCtrlSeq, end);
	CharCmds[close] = bindMixin(Bracket, R, open, close, curCtrlSeq, end);
}
bindCharBracketPair('(');
bindCharBracketPair('[');
bindCharBracketPair('{', '\\{');
LatexCmds.langle = bindMixin(Bracket, L, '&lang;', '&rang;', '\\langle ', '\\rangle ');
LatexCmds.rangle = bindMixin(Bracket, R, '&lang;', '&rang;', '\\langle ', '\\rangle ');
LatexCmds.abs =
	CharCmds['|'] = bindMixin(Bracket, L, '|', '|', '|', '|');
LatexCmds.lVert = bindMixin(Bracket, L, '&#8741;', '&#8741;', '\\lVert ', '\\rVert ');
LatexCmds.rVert = bindMixin(Bracket, R, '&#8741;', '&#8741;', '\\lVert ', '\\rVert ');

LatexCmds.left = class extends MathCommand {
	parser() {
		const regex = Parser.regex;
		const string = Parser.string;
		const optWhitespace = Parser.optWhitespace;

		return optWhitespace.then(regex(/^(?:[([|]|\\\{|\\langle(?![a-zA-Z])|\\lVert(?![a-zA-Z]))/))
			.then((ctrlSeq) => {
				let open = (ctrlSeq.charAt(0) === '\\' ? ctrlSeq.slice(1) : ctrlSeq);
				if (ctrlSeq=="\\langle") { open = '&lang;'; ctrlSeq = ctrlSeq + ' '; }
				if (ctrlSeq=="\\lVert") { open = '&#8741;'; ctrlSeq = ctrlSeq + ' '; }
				return latexMathParser.then((block) => {
					return string('\\right').skip(optWhitespace)
						.then(regex(/^(?:[\])|]|\\\}|\\rangle(?![a-zA-Z])|\\rVert(?![a-zA-Z]))/)).map((end) => {
							let close = (end.charAt(0) === '\\' ? end.slice(1) : end);
							if (end=="\\rangle") { close = '&rang;'; end = end + ' '; }
							if (end=="\\rVert") { close = '&#8741;'; end = end + ' '; }
							const cmd = new Bracket(0, open, close, ctrlSeq, end);
							cmd.blocks = [ block ];
							block.adopt(cmd, 0, 0);
							return cmd;
						})
					;
				});
			})
		;
	}
};

LatexCmds.right = class extends MathCommand {
	parser() {
		return Parser.fail('unmatched \\right');
	}
};

const Binomial = LatexCmds.binom = LatexCmds.binomial = class extends DelimsMixin(MathCommand) {
	constructor(...args) {
		super(...args);
		this.ctrlSeq = '\\binom';
		this.htmlTemplate =
			'<span class="mq-non-leaf">'
			+   '<span class="mq-paren mq-scaled">(</span>'
			+   '<span class="mq-non-leaf">'
			+     '<span class="mq-array mq-non-leaf">'
			+       '<span>&0</span>'
			+       '<span>&1</span>'
			+     '</span>'
			+   '</span>'
			+   '<span class="mq-paren mq-scaled">)</span>'
			+ '</span>';
		this.textTemplate = ['choose(', ',', ')'];
	}
};

LatexCmds.choose = class extends FractionChooseCreateLeftOfMixin(Binomial) {};

// backcompat with before cfd3620 on #233
LatexCmds.editable = LatexCmds.MathQuillMathField = class extends MathCommand {
	constructor(...args) {
		super(...args);
		this.ctrlSeq = '\\MathQuillMathField';
		this.htmlTemplate =
			'<span class="mq-editable-field">'
			+   '<span class="mq-root-block">&0</span>'
			+ '</span>';
	}

	parser() {
		const self = this,
			string = Parser.string, regex = Parser.regex, succeed = Parser.succeed;
		return string('[').then(regex(/^[a-z][a-z0-9]*/i)).skip(string(']'))
			.map((name) => self.name = name).or(succeed())
			.then(super.parser());
	}

	finalizeTree(options) {
		const ctrlr = new Controller(this.ends[L], this.jQ, options);
		ctrlr.KIND_OF_MQ = 'MathField';
		ctrlr.editable = true;
		ctrlr.createTextarea();
		ctrlr.editablesTextareaEvents();
		ctrlr.cursor.insAtRightEnd(ctrlr.root);
		RootBlockMixin(ctrlr.root);
	}

	registerInnerField(innerFields, MathField) {
		innerFields.push(innerFields[this.name] = new MathField(this.ends[L].controller));
	}

	latex() { return this.ends[L].latex(); }

	text() { return this.ends[L].text(); }
};

// Embed arbitrary things
// Probably the closest DOM analogue would be an iframe?
// From MathQuill's perspective, it's a Symbol, it can be
// anywhere and the cursor can go around it but never in it.
// Create by calling public API method .dropEmbedded(),
// or by calling the global public API method .registerEmbed()
// and rendering LaTeX like \embed{registeredName} (see test).
LatexCmds.embed = class extends Symbol {
	setOptions(options) {
		const noop = () => "";
		this.text = options.text || noop;
		this.htmlTemplate = options.htmlString || "";
		this.latex = options.latex || noop;
		return this;
	}

	parser() {
		const string = Parser.string, regex = Parser.regex, succeed = Parser.succeed;
		return string('{').then(regex(/^[a-z][a-z0-9]*/i)).skip(string('}'))
			.then((name) =>
				// the chars allowed in the optional data block are arbitrary other than
				// excluding curly braces and square brackets (which'd be too confusing)
				string('[').then(regex(/^[-\w\s]*/)).skip(string(']'))
				.or(succeed()).map((data) => this.setOptions(EMBEDS[name](data)))
			);
	}
};
