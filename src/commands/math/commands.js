// Commands and Operators.

let scale, // = function(jQ, x, y) { ... }
	// Use a CSS 2D transform to scale the jQuery-wrapped HTML elements,
	// or gracefully degrade to increasing the fontSize to match the vertical Y scaling factor.
	// Ideas from http://github.com/louisremi/jquery.transform.js

	transformPropName;

const div_style = document.createElement('div').style,
	transformPropNames = {
		transform: 1,
		WebkitTransform: 1,
		MozTransform: 1,
		OTransform: 1,
		msTransform: 1
	};

for (const prop in transformPropNames) {
	if (prop in div_style) {
		transformPropName = prop;
		break;
	}
}

if (transformPropName) {
	scale = (jQ, x, y) => jQ.css(transformPropName, `scale(${x},${y})`, `scale(${x},${y})`);
} else {
	scale = (jQ, x, y) => jQ.css('fontSize', `${y}em`);
}

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

Options.prototype.charsThatBreakOutOfSupSub = '';

class SupSub extends MathCommand {
	constructor(...args) {
		super(...args);
		this.ctrlSeq = '_{...}^{...}';
	}

	createLeftOf(cursor) {
		if (!this.replacedFragment && !cursor[L] && cursor.options.supSubsRequireOperand) return;
		return super.createLeftOf(cursor);
	}

	contactWeld(cursor) {
		// Look on either side for a SupSub, if one is found compare my
		// .sub, .sup with its .sub, .sup. If I have one that it doesn't,
		// then call .addBlock() on it with my block; if I have one that
		// it also has, then insert my block's children into its block,
		// unless my block has none, in which case insert the cursor into
		// its block (and not mine, I'm about to remove myself) in the case
		// I was just typed.
		// TODO: simplify

		for (const dir of [L, R]) {
			if (this[dir] instanceof SupSub) {
				let pt;
				for (const supsub of ['sub', 'sup']) {
					const src = this[supsub], dest = this[dir][supsub];
					if (!src) continue;
					if (!dest) this[dir].addBlock(src.disown());
					else if (!src.isEmpty()) { // ins src children at -dir end of dest
						src.jQ.children().insAtDirEnd(-dir, dest.jQ);
						const children = src.children().disown();
						pt = new Point(dest, children.ends[R], dest.ends[L]);
						if (dir === L) children.adopt(dest, dest.ends[R], 0);
						else children.adopt(dest, 0, dest.ends[L]);
					} else pt = new Point(dest, 0, dest.ends[L]);
					this.placeCursor = (cursor) => cursor.insAtDirEnd(-dir, dest || src);
				}
				this.remove();
				if (cursor && cursor[L] === this) {
					if (dir === R && pt) {
						pt[L] ? cursor.insRightOf(pt[L]) : cursor.insAtLeftEnd(pt.parent);
					}
					else cursor.insRightOf(this[dir]);
				}
				break;
			}
		}
	}

	finalizeTree() {
		this.ends[L].write = function(cursor, ch) {
			if (cursor.options.autoSubscriptNumerals && this === this.parent.sub) {
				if (ch === '_') return;
				const cmd = this.chToCmd(ch, cursor.options);
				if (cmd instanceof Symbol) cursor.deleteSelection();
				else cursor.clearSelection().insRightOf(this.parent);
				return cmd.createLeftOf(cursor.show());
			}
			if (cursor[L] && !cursor[R] && !cursor.selection
				&& cursor.options.charsThatBreakOutOfSupSub.indexOf(ch) > -1) {
				cursor.insRightOf(this.parent);
			}
			MathBlock.prototype.write.call(this, cursor, ch);
		};
	}

	moveTowards(dir, cursor, updown, ...args) {
		if (cursor.options.autoSubscriptNumerals && !this.sup) {
			cursor.insDirOf(dir, this);
		}
		else super.moveTowards(dir, cursor, updown, ...args);
	}

	deleteTowards(dir, cursor, ...args) {
		if (cursor.options.autoSubscriptNumerals && this.sub) {
			const cmd = this.sub.ends[-dir];
			if (cmd instanceof Symbol) cmd.remove();
			else if (cmd) cmd.deleteTowards(dir, cursor.insAtDirEnd(-dir, this.sub));

			// TODO: factor out a .removeBlock() or something
			if (this.sub.isEmpty()) {
				this.sub.deleteOutOf(L, cursor.insAtLeftEnd(this.sub));
				if (this.sup) cursor.insDirOf(-dir, this);
				// Note `-dir` because in e.g. x_1^2| want backspacing (leftward)
				// to delete the 1 but to end up rightward of x^2; with non-negated
				// `dir` (try it), the cursor appears to have gone "through" the ^2.
			}
		}
		else super.deleteTowards(dir, cursor, ...args);
	}

	latex() {
		const latex = (prefix, block) => {
			const l = block && block.latex();
			return block ? prefix + (l.length === 1 ? l : `{${l || ' '}}`) : '';
		};
		return latex('_', this.sub) + latex('^', this.sup);
	}

	text() {
		const text = (prefix, block) => {
			const l = (block && block.text() !== " ") && block.text();
			return l ? prefix + `(${l || ' '})` : '';
		};
		return text('_', this.sub) + text('^', this.sup);
	}

	addBlock(block) {
		if (this.supsub === 'sub') {
			this.sup = this.upInto = this.sub.upOutOf = block;
			block.adopt(this, this.sub, 0).downOutOf = this.sub;
			block.jQ = $('<span class="mq-sup"/>').append(block.jQ.children())
				.attr(mqBlockId, block.id).prependTo(this.jQ);
		}
		else {
			this.sub = this.downInto = this.sup.downOutOf = block;
			block.adopt(this, 0, this.sup).upOutOf = this.sup;
			block.jQ = $('<span class="mq-sub"></span>').append(block.jQ.children())
				.attr(mqBlockId, block.id).appendTo(this.jQ.removeClass('mq-sup-only'));
			this.jQ.append('<span style="display:inline-block;width:0">&#8203;</span>');
		}
		// like 'sub sup'.split(' ').forEach((supsub) => { ... });
		for (const supsub of ['sub', 'sup']) {
			const cmd = this;
			const oppositeSupsub = supsub === 'sub' ? 'sup' : 'sub';
			const updown = supsub === 'sub' ? 'down' : 'up';
			cmd[supsub].deleteOutOf = function(dir, cursor) {
				cursor.insDirOf((this[dir] ? -dir : dir), this.parent);
				if (!this.isEmpty()) {
					const end = this.ends[dir];
					this.children().disown()
						.withDirAdopt(dir, cursor.parent, cursor[dir], cursor[-dir])
						.jQ.insDirOf(-dir, cursor.jQ);
					cursor[-dir] = end;
				}
				cmd.supsub = oppositeSupsub;
				delete cmd[supsub];
				delete cmd[updown+'Into'];
				cmd[oppositeSupsub][updown+'OutOf'] = insLeftOfMeUnlessAtEnd;
				delete cmd[oppositeSupsub].deleteOutOf;
				if (supsub === 'sub') $(cmd.jQ.addClass('mq-sup-only')[0].lastChild).remove();
				this.remove();
			};
		}
	}

	reflow() {
		const $block = this.jQ ;//mq-supsub
		const $prev = $block.prev() ;

		if ( !$prev.length ) {
			//we cant normalize it without having prev. element (which is base)
			return ;
		}

		const $sup = $block.children( '.mq-sup' );//mq-supsub -> mq-sup
		if ( $sup.length ) {
			const sup_fontsize = parseInt( $sup.css('font-size') ) ;
			const sup_bottom = $sup.offset().top + $sup.height() ;
			//we want that superscript overlaps top of base on 0.7 of its font-size
			//this way small superscripts like x^2 look ok, but big ones like x^(1/2/3) too
			const needed = sup_bottom - $prev.offset().top  - 0.7 * sup_fontsize ;
			const cur_margin = parseInt( $sup.css('margin-bottom' ) ) ;
			//we lift it up with margin-bottom
			$sup.css( 'margin-bottom', cur_margin + needed ) ;
		}
	}
}

function insLeftOfMeUnlessAtEnd(cursor) {
	// cursor.insLeftOf(cmd), unless cursor at the end of block, and every
	// ancestor cmd is at the end of every ancestor block
	const cmd = this.parent;
	let ancestorCmd = cursor;
	do {
		if (ancestorCmd[R]) return cursor.insLeftOf(cmd);
		ancestorCmd = ancestorCmd.parent.parent;
	} while (ancestorCmd !== cmd);
	cursor.insRightOf(cmd);
}

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

class SummationNotation extends MathCommand {
	constructor(ch, html, ...args) {
		const htmlTemplate =
			'<span class="mq-large-operator mq-non-leaf">'
			+   '<span class="mq-to"><span>&1</span></span>'
			+   '<big>' + html + '</big>'
			+   '<span class="mq-from"><span>&0</span></span>'
			+ '</span>';
		const text = ch && ch.length > 1 ? ch.slice(1) : ch;
		super(ch, htmlTemplate, [ text ]);
	}

	createLeftOf(cursor, ...args) {
		super.createLeftOf(cursor, ...args);
		if (cursor.options.sumStartsWithNEquals) {
			new Letter('n').createLeftOf(cursor);
			new Equality().createLeftOf(cursor);
		}
	}

	latex() {
		const simplify = (latex) => latex.length === 1 ? latex : `{${latex || ' '}}`;
		return `${this.ctrlSeq}_${simplify(this.ends[L].latex())}^${simplify(this.ends[R].latex())}`;
	}

	parser() {
		const string = Parser.string;
		const optWhitespace = Parser.optWhitespace;
		const succeed = Parser.succeed;
		const block = latexMathParser.block;

		const self = this;
		const blocks = self.blocks = [ new MathBlock(), new MathBlock() ];
		for (const block of blocks) {
			block.adopt(self, self.ends[R], 0);
		}

		return optWhitespace.then(string('_').or(string('^'))).then((supOrSub) => {
			const child = blocks[supOrSub === '_' ? 0 : 1];
			return block.then((block) => {
				block.children().adopt(child, child.ends[R], 0);
				return succeed(self);
			});
		}).many().result(self);
	}

	finalizeTree() {
		this.downInto = this.ends[L];
		this.upInto = this.ends[R];
		this.ends[L].upOutOf = this.ends[R];
		this.ends[R].downOutOf = this.ends[L];
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

LatexCmds['\u222b'] = LatexCmds['int'] = LatexCmds.integral = class extends SummationNotation {
	constructor() {
		super('\\int ', '');
		this.htmlTemplate =
			'<span class="mq-int mq-non-leaf">'
			+   '<big>&int;</big>'
			+   '<span class="mq-supsub mq-non-leaf">'
			+     '<span class="mq-sup"><span class="mq-sup-inner">&1</span></span>'
			+     '<span class="mq-sub">&0</span>'
			+     '<span style="display:inline-block;width:0">&#8203</span>'
			+   '</span>'
			+ '</span>';

		// FIXME: refactor rather than overriding
		this.createLeftOf = MathCommand.prototype.createLeftOf;
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

const LiveFraction = LatexCmds.over = CharCmds['/'] = class extends Fraction {
	createLeftOf(cursor) {
		if (!this.replacedFragment) {
			let leftward = cursor[L];
			while (leftward &&
				!(
					leftward instanceof BinaryOperator ||
					leftward instanceof (LatexCmds.text || noop) ||
					leftward instanceof SummationNotation ||
					leftward.ctrlSeq === '\\ ' ||
					/^[,;:]$/.test(leftward.ctrlSeq)
				) //lookbehind for operator
			) leftward = leftward[L];

			if (leftward instanceof SummationNotation && leftward[R] instanceof SupSub) {
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

const DelimsMixin = (Base) => class extends Base {
	jQadd(...args) {
		super.jQadd(...args);
		this.delimjQs = this.jQ.children(':first').add(this.jQ.children(':last'));
		this.contentjQ = this.jQ.children(':eq(1)');
	}

	reflow() {
		const height = this.contentjQ.outerHeight()
			/ parseFloat(this.contentjQ.css('fontSize'));
		scale(this.delimjQs, Math.min(1 + 0.2 * (height - 1), 1.2), 1.2 * height);
	}
};

// Round/Square/Curly/Angle Brackets (aka Parens/Brackets/Braces)
//   first typed as one-sided bracket with matching "ghost" bracket at
//   far end of current block, until you type an opposing one
class Bracket extends DelimsMixin(MathCommand) {
	constructor(side, open, close, ctrlSeq, end) {
		super('\\left'+ctrlSeq, undefined, [open, close]);
		this.side = side;
		this.sides = {};
		this.sides[L] = { ch: open, ctrlSeq: ctrlSeq };
		this.sides[R] = { ch: close, ctrlSeq: end };
		this.placeCursor = noop;
	}

	numBlocks() { return 1; }

	html() {
		// wait until now so that .side may be set by createLeftOf or parser
		this.htmlTemplate =
			'<span class="mq-non-leaf">'
			+   '<span class="mq-scaled mq-paren'+(this.side === R ? ' mq-ghost' : '')+'">'
			+     this.sides[L].ch
			+   '</span>'
			+   '<span class="mq-non-leaf">&0</span>'
			+   '<span class="mq-scaled mq-paren'+(this.side === L ? ' mq-ghost' : '')+'">'
			+     this.sides[R].ch
			+   '</span>'
			+ '</span>';
		return super.html();
	}

	latex() {
		return `\\left${this.sides[L].ctrlSeq}${this.ends[L].latex()}\\right${this.sides[R].ctrlSeq}`;
	}

	text() {
		return `${this.sides[L].ch}${this.ends[L].text()}${this.sides[R].ch}`;
	}

	matchBrack(opts, expectedSide, node) {
		// return node iff it's a matching 1-sided bracket of expected side (if any)
		return node instanceof Bracket && node.side && node.side !== -expectedSide
			&& (!opts.restrictMismatchedBrackets
				|| OPP_BRACKS[this.sides[this.side].ch] === node.sides[node.side].ch
				|| { '(': ']', '[': ')' }[this.sides[L].ch] === node.sides[R].ch) && node;
	}

	closeOpposing(brack) {
		brack.side = 0;
		brack.sides[this.side] = this.sides[this.side]; // copy over my info (may be
		brack.delimjQs.eq(this.side === L ? 0 : 1) // mismatched, like [a, b))
			.removeClass('mq-ghost').html(this.sides[this.side].ch);
	}

	createLeftOf(cursor) {
		let brack, side;
		if (!this.replacedFragment) { // unless wrapping seln in brackets,
			// check if next to or inside an opposing one-sided bracket
			const opts = cursor.options;
			if (this.sides[L].ch === '|') { // check both sides if I'm a pipe
				brack = this.matchBrack(opts, R, cursor[R])
					|| this.matchBrack(opts, L, cursor[L])
					|| this.matchBrack(opts, 0, cursor.parent.parent);
			}
			else {
				brack = this.matchBrack(opts, -this.side, cursor[-this.side])
					|| this.matchBrack(opts, -this.side, cursor.parent.parent);
			}
		}
		if (brack) {
			side = this.side = -brack.side; // may be pipe with .side not yet set
			this.closeOpposing(brack);
			if (brack === cursor.parent.parent && cursor[side]) { // move the stuff between
				new Fragment(cursor[side], cursor.parent.ends[side], -side) // me and ghost outside
					.disown().withDirAdopt(-side, brack.parent, brack, brack[side])
					.jQ.insDirOf(side, brack.jQ);
			}
			brack.bubble('reflow');
		} else {
			// TODO:  Check this super usage.
			brack = this, side = brack.side;
			if (brack.replacedFragment) brack.side = 0; // wrapping seln, don't be one-sided
			else if (cursor[-side]) { // elsewise, auto-expand so ghost is at far end
				brack.replaces(new Fragment(cursor[-side], cursor.parent.ends[-side], side));
				cursor[-side] = 0;
			}
			super.createLeftOf.call(brack, cursor);
		}
		if (side === L) cursor.insAtLeftEnd(brack.ends[L]);
		else cursor.insRightOf(brack);
	}

	unwrap() {
		this.ends[L].children().disown().adopt(this.parent, this, this[R])
			.jQ.insertAfter(this.jQ);
		this.remove();
	}

	deleteSide(side, outward, cursor) {
		const parent = this.parent, sib = this[side], farEnd = parent.ends[side];

		if (side === this.side) { // deleting non-ghost of one-sided bracket, unwrap
			this.unwrap();
			sib ? cursor.insDirOf(-side, sib) : cursor.insAtDirEnd(side, parent);
			return;
		}

		const opts = cursor.options, wasSolid = !this.side;
		this.side = -side;
		// if deleting like, outer close-brace of [(1+2)+3} where inner open-paren
		if (this.matchBrack(opts, side, this.ends[L].ends[this.side])) { // is ghost,
			this.closeOpposing(this.ends[L].ends[this.side]); // then become [1+2)+3
			const origEnd = this.ends[L].ends[side];
			this.unwrap();
			if (origEnd.siblingCreated) origEnd.siblingCreated(cursor.options, side);
			sib ? cursor.insDirOf(-side, sib) : cursor.insAtDirEnd(side, parent);
		}
		else { // if deleting like, inner close-brace of ([1+2}+3) where outer
			if (this.matchBrack(opts, side, this.parent.parent)) { // open-paren is
				this.parent.parent.closeOpposing(this); // ghost, then become [1+2+3)
				this.parent.parent.unwrap();
			} // else if deleting outward from a solid pair, unwrap
			else if (outward && wasSolid) {
				this.unwrap();
				sib ? cursor.insDirOf(-side, sib) : cursor.insAtDirEnd(side, parent);
				return;
			}
			else { // else deleting just one of a pair of brackets, become one-sided
				this.sides[side] = { ch: OPP_BRACKS[this.sides[this.side].ch],
					ctrlSeq: OPP_BRACKS[this.sides[this.side].ctrlSeq] };
				this.delimjQs.removeClass('mq-ghost')
					.eq(side === L ? 0 : 1).addClass('mq-ghost').html(this.sides[side].ch);
			}
			if (sib) { // auto-expand so ghost is at far end
				const origEnd = this.ends[L].ends[side];
				new Fragment(sib, farEnd, -side).disown()
					.withDirAdopt(-side, this.ends[L], origEnd, 0)
					.jQ.insAtDirEnd(side, this.ends[L].jQ.removeClass('mq-empty'));
				if (origEnd.siblingCreated) origEnd.siblingCreated(cursor.options, side);
				cursor.insDirOf(-side, sib);
			} // didn't auto-expand, cursor goes just outside or just inside parens
			else (outward ? cursor.insDirOf(side, this)
				: cursor.insAtDirEnd(side, this.ends[L]));
		}
	}

	deleteTowards(dir, cursor) {
		this.deleteSide(-dir, false, cursor);
	}

	finalizeTree() {
		this.ends[L].deleteOutOf = function(dir, cursor) {
			this.parent.deleteSide(dir, true, cursor);
		};
		// FIXME HACK: after initial creation/insertion, finalizeTree would only be
		// called if the paren is selected and replaced, e.g. by LiveFraction
		this.finalizeTree = function() {
			this.delimjQs.eq(this.side === L ? 1 : 0).removeClass('mq-ghost');
			this.side = 0;
		};
	}

	siblingCreated(opts, dir) { // if something typed between ghost and far
		if (dir === -this.side) this.finalizeTree(); // end of its block, solidify
	}
}

const OPP_BRACKS = {
	'(': ')',
	')': '(',
	'[': ']',
	']': '[',
	'{': '}',
	'}': '{',
	'\\{': '\\}',
	'\\}': '\\{',
	'&lang;': '&rang;',
	'&rang;': '&lang;',
	'\\langle ': '\\rangle ',
	'\\rangle ': '\\langle ',
	'|': '|',
	'\\lVert ' : '\\rVert ',
	'\\rVert ' : '\\lVert ',
};

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

LatexCmds.choose = class extends Binomial {
	constructor(...args) {
		super(...args);
		// FIXME:  This should be a mixin.
		this.createLeftOf = LiveFraction.prototype.createLeftOf;
	}
};

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
const Embed = LatexCmds.embed = class extends Symbol {
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
