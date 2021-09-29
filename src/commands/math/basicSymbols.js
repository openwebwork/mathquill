// Symbols for Basic Mathematics

class Digit extends VanillaSymbol {
	createLeftOf(cursor) {
		if (cursor.options.autoSubscriptNumerals
			&& cursor.parent !== cursor.parent.parent.sub
			&& ((cursor[L] instanceof Variable && cursor[L].isItalic !== false)
				|| (cursor[L] instanceof SupSub
					&& cursor[L][L] instanceof Variable
					&& cursor[L][L].isItalic !== false))) {
			new LatexCmds._().createLeftOf(cursor);
			super.createLeftOf(cursor);
			cursor.insRightOf(cursor.parent.parent);
		}
		else super.createLeftOf(cursor);
	}
}

class Variable extends Symbol {
	constructor(ch, html) {
		super(ch, `<var>${html || ch}</var>`);
	}

	text() {
		let text = this.ctrlSeq;
		if (this.isPartOfOperator) {
			if (text[0] == '\\') {
				if (text.startsWith('\\operatorname{')) 
					text = text.slice(14, text.length);
				else
					text = text.slice(1, text.length);
			}
			else if (text[text.length-1] == ' ' || text[text.length-1] == '}') {
				text = text.slice (0, -1);
			}
		}
		return text;
	};
}

Options.prototype.autoCommands = { _maxLength: 0 };
optionProcessors.autoCommands = (cmds) => {
	if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
		throw `"${cmds}" not a space-delimited list of only letters`;
	}
	const list = cmds.split(' '), dict = {};
	let maxLength = 0;
	for (const cmd of list) {
		if (cmd.length < 2) {
			throw `autocommand "${cmd}" not minimum length of 2`;
		}
		if (LatexCmds[cmd] === OperatorName) {
			throw `"${cmd}" is a built-in operator name`;
		}
		dict[cmd] = 1;
		maxLength = Math.max(maxLength, cmd.length);
	}
	dict._maxLength = maxLength;
	return dict;
};

class Letter extends Variable {
	constructor(ch) {
		super(ch);
		this.letter = ch;
		this.siblingDeleted = this.siblingCreated = this.finalizeTree;
	}

	createLeftOf(cursor) {
		super.createLeftOf(cursor);
		const autoCmds = cursor.options.autoCommands, maxLength = autoCmds._maxLength;
		if (maxLength > 0) {
			// want longest possible autocommand, so join together longest
			// sequence of letters
			let str = '', l = this, i = 0;
			// FIXME: l.ctrlSeq === l.letter checks if first or last in an operator name
			while (l instanceof Letter && l.ctrlSeq === l.letter && i < maxLength) {
				str = l.letter + str, l = l[L], ++i;
			}
			// check for an autocommand, going thru substrings longest to shortest
			while (str.length) {
				if (autoCmds.hasOwnProperty(str)) {
					for (i = 1, l = this; i < str.length; ++i, l = l[L]);
					new Fragment(l, this).remove();
					cursor[L] = l[L];
					return new LatexCmds[str](str).createLeftOf(cursor);
				}
				str = str.slice(1);
			}
		}
	}

	italicize(bool) {
		this.isItalic = bool;
		this.isPartOfOperator = !bool;
		this.jQ.toggleClass('mq-operator-name', !bool);
		return this;
	}

	finalizeTree(opts, dir) {
		// don't auto-un-italicize if the sibling to my right changed (dir === R or
		// undefined) and it's now a Letter, it will un-italicize everyone
		if (dir !== L && this[R] instanceof Letter) return;
		this.autoUnItalicize(opts);
	}

	autoUnItalicize(opts) {
		const autoOps = opts.autoOperatorNames;
		if (autoOps._maxLength === 0) return;
		// want longest possible operator names, so join together entire contiguous
		// sequence of letters
		let str = this.letter, l = this[L], r = this[R];
		for (; l instanceof Letter; l = l[L]) str = l.letter + str;
		for (; r instanceof Letter; r = r[R]) str += r.letter;

		// removeClass and delete flags from all letters before figuring out
		// which, if any, are part of an operator name
		new Fragment(l[R] || this.parent.ends[L], r[L] || this.parent.ends[R]).each((el) => {
			el.italicize(true).jQ.removeClass('mq-first mq-last mq-followed-by-supsub');
			el.ctrlSeq = el.letter;
		});

		// check for operator names: at each position from left to right, check
		// substrings from longest to shortest
		outer: for (let i = 0, first = l[R] || this.parent.ends[L]; i < str.length; ++i, first = first[R]) {
			for (let len = Math.min(autoOps._maxLength, str.length - i); len > 0; --len) {
				const word = str.slice(i, i + len);
				if (autoOps.hasOwnProperty(word)) {
					let last;
					for (let j = 0, letter = first; j < len; j += 1, letter = letter[R]) {
						letter.italicize(false);
						last = letter;
					}

					const isBuiltIn = BuiltInOpNames.hasOwnProperty(word);
					first.ctrlSeq = (isBuiltIn ? '\\' : '\\operatorname{') + first.ctrlSeq;
					last.ctrlSeq += (isBuiltIn ? ' ' : '}');
					if (TwoWordOpNames.hasOwnProperty(word)) last[L][L][L].jQ.addClass('mq-last');
					if (!this.shouldOmitPadding(first[L])) first.jQ.addClass('mq-first');
					if (!this.shouldOmitPadding(last[R])) {
						if (last[R] instanceof SupSub) {
							const supsub = last[R]; // XXX monkey-patching, but what's the right thing here?
							// Have operatorname-specific code in SupSub? A CSS-like language to style the
							// math tree, but which ignores cursor and selection (which CSS can't)?
							supsub.siblingCreated = supsub.siblingDeleted = () => {
								supsub.jQ.toggleClass('mq-after-operator-name', !(supsub[R] instanceof Bracket));
							};
							supsub.siblingCreated();
						}
						else {
							last.jQ.toggleClass('mq-last', !(last[R] instanceof Bracket));
						}
					}

					i += len - 1;
					first = last;
					continue outer;
				}
			}
		}
	}

	shouldOmitPadding(node) {
		// omit padding if no node, or if node already has padding (to avoid double-padding)
		return !node || (node instanceof BinaryOperator) || (node instanceof SummationNotation);
	}
}

// The set of operator names like \sin, \cos, etc that are built-into LaTeX,
// see Section 3.17 of the Short Math Guide: http://tinyurl.com/jm9okjc
// MathQuill auto-unitalicizes some operator names not in that set, like 'hcf'
// and 'arsinh', which must be exported as \operatorname{hcf} and
// \operatorname{arsinh}. Note: over/under line/arrow \lim variants like
// \varlimsup are not supported
const BuiltInOpNames = {};

// The set of operator names that MathQuill auto-unitalicizes by default; overridable
const AutoOpNames = Options.prototype.autoOperatorNames = { _maxLength: 9 };

const TwoWordOpNames = { limsup: 1, liminf: 1, projlim: 1, injlim: 1 };

// Standard operators
for (const op of [
	'arg', 'deg', 'det', 'dim', 'exp', 'gcd', 'hom', 'ker', 'lg', 'lim', 'ln',
	'log', 'max', 'min', 'sup', 'limsup', 'liminf', 'injlim', 'projlim', 'Pr'
]) { BuiltInOpNames[op] = AutoOpNames[op] = 1; }

// Trig operators
// why coth but not sech and csch, LaTeX?
for (const trig of [
	'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
	'sinh', 'cosh', 'tanh', 'sec', 'csc', 'cot', 'coth'
]) { BuiltInOpNames[trig] = 1; }

for (const autoTrig of [
	'sin', 'cos', 'tan', 'sec', 'cosec', 'csc', 'cotan', 'cot', 'ctg'
]) {
	AutoOpNames[autoTrig] =
		AutoOpNames[`arc${autoTrig}`] = AutoOpNames[`${autoTrig}h`] =
		AutoOpNames[`ar${autoTrig}h`] = AutoOpNames[`arc${autoTrig}h`] = 1;
}

// compat with some of the nonstandard LaTeX exported by MathQuill
// before #247. None of these are real LaTeX commands so, seems safe
for (const op of ['gcf', 'hcf', 'lcm', 'proj', 'span']) {
	AutoOpNames[op] = 1;
}

optionProcessors.autoOperatorNames = (cmds) => {
	if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
		throw `"${cmds}" not a space-delimited list of only letters`;
	}
	const list = cmds.split(' '), dict = {};
	let maxLength = 0;
	for (const cmd of list) {
		if (cmd.length < 2) {
			throw `"${cmd}" not minimum length of 2`;
		}
		dict[cmd] = 1;
		maxLength = Math.max(maxLength, cmd.length);
	}
	dict._maxLength = maxLength;
	return dict;
};

class OperatorName extends Symbol {
	constructor(fn) {
		super();
		this.ctrlSeq = fn;
	}

	createLeftOf(cursor) {
		for (const char of this.ctrlSeq) {
			new Letter(char).createLeftOf(cursor);
		}
	}

	parser() {
		const block = new MathBlock();
		for (const char of this.ctrlSeq) {
			new Letter(char).adopt(block, block.ends[R], 0);
		}
		return Parser.succeed(block.children());
	}
}

for (const fn in AutoOpNames) {
	if (AutoOpNames.hasOwnProperty(fn)) {
		LatexCmds[fn] = OperatorName;
	}
}

LatexCmds.operatorname = class extends MathCommand {
	constructor(...args) {
		super(...args);
		this.createLeftOf = noop;
	}
	numBlocks() { return 1; };
	parser() {
		return latexMathParser.block.map((b) => b.children());
	};
};

LatexCmds.f = class extends Letter {
	constructor() {
		super('f', '<var class="mq-f">f</var>');
		this.letter = 'f';
	}

	italicize(bool, ...args) {
		this.jQ.html('f').toggleClass('mq-f', bool);
		return super.italicize(bool, ...args);
	}
};

// VanillaSymbol's
LatexCmds[' '] = LatexCmds.space = bindMixin(VanillaSymbol, '\\ ', '&nbsp;');

LatexCmds["'"] = LatexCmds.prime = bindMixin(VanillaSymbol, "'", '&prime;');
// LatexCmds['\u2033'] = LatexCmds.dprime = bindMixin(VanillaSymbol, '\u2033', '&Prime;');

LatexCmds.backslash = bindMixin(VanillaSymbol,'\\backslash ','\\');
if (!CharCmds['\\']) CharCmds['\\'] = LatexCmds.backslash;

LatexCmds.$ = bindMixin(VanillaSymbol, '\\$', '$');

// does not use Symbola font
const NonSymbolaSymbol = class extends Symbol {
	constructor(ch, html) {
		super(ch, `<span class="mq-nonSymbola">${html || ch}</span>`);
	}
};

LatexCmds['@'] = NonSymbolaSymbol;
LatexCmds['&'] = bindMixin(NonSymbolaSymbol, '\\&', '&amp;');
LatexCmds['%'] = bindMixin(NonSymbolaSymbol, '\\%', '%');

//the following are all Greek to me, but this helped a lot: http://www.ams.org/STIX/ion/stixsig03.html

//lowercase Greek letter variables
LatexCmds.alpha =
	LatexCmds.beta =
	LatexCmds.gamma =
	LatexCmds.delta =
	LatexCmds.zeta =
	LatexCmds.eta =
	LatexCmds.theta =
	LatexCmds.iota =
	LatexCmds.kappa =
	LatexCmds.mu =
	LatexCmds.nu =
	LatexCmds.xi =
	LatexCmds.rho =
	LatexCmds.sigma =
	LatexCmds.tau =
	LatexCmds.chi =
	LatexCmds.psi =
	LatexCmds.omega = class extends Variable {
		constructor(latex) {
			super(`\\${latex} `, `&${latex};`);
		}
	};

//why can't anybody FUCKING agree on these
LatexCmds.phi = //W3C or Unicode?
	bindMixin(Variable,'\\phi ','&#981;');

LatexCmds.phiv = //Elsevier and 9573-13
	LatexCmds.varphi = //AMS and LaTeX
	bindMixin(Variable,'\\varphi ','&phi;');

LatexCmds.epsilon = //W3C or Unicode?
	bindMixin(Variable,'\\epsilon ','&#1013;');

LatexCmds.epsiv = //Elsevier and 9573-13
	LatexCmds.varepsilon = //AMS and LaTeX
	bindMixin(Variable,'\\varepsilon ','&epsilon;');

LatexCmds.piv = //W3C/Unicode and Elsevier and 9573-13
	LatexCmds.varpi = //AMS and LaTeX
	bindMixin(Variable,'\\varpi ','&piv;');

LatexCmds.sigmaf = //W3C/Unicode
	LatexCmds.sigmav = //Elsevier
	LatexCmds.varsigma = //LaTeX
	bindMixin(Variable,'\\varsigma ','&sigmaf;');

LatexCmds.thetav = //Elsevier and 9573-13
	LatexCmds.vartheta = //AMS and LaTeX
	LatexCmds.thetasym = //W3C/Unicode
	bindMixin(Variable,'\\vartheta ','&thetasym;');

LatexCmds.upsilon = //AMS and LaTeX and W3C/Unicode
	LatexCmds.upsi = //Elsevier and 9573-13
	bindMixin(Variable,'\\upsilon ','&upsilon;');

//these aren't even mentioned in the HTML character entity references
LatexCmds.gammad = //Elsevier
	LatexCmds.Gammad = //9573-13 -- WTF, right? I dunno if this was a typo in the reference (see above)
	LatexCmds.digamma = //LaTeX
	bindMixin(Variable,'\\digamma ','&#989;');

LatexCmds.kappav = //Elsevier
	LatexCmds.varkappa = //AMS and LaTeX
	bindMixin(Variable,'\\varkappa ','&#1008;');

LatexCmds.rhov = //Elsevier and 9573-13
	LatexCmds.varrho = //AMS and LaTeX
	bindMixin(Variable,'\\varrho ','&#1009;');

//Greek constants, look best in non-italicized Times New Roman
LatexCmds.pi = LatexCmds['\u03c0'] = bindMixin(NonSymbolaSymbol,'\\pi ','&pi;');
LatexCmds.lambda = bindMixin(NonSymbolaSymbol,'\\lambda ','&lambda;');

//uppercase greek letters

LatexCmds.Upsilon = //LaTeX
	LatexCmds.Upsi = //Elsevier and 9573-13
	LatexCmds.upsih = //W3C/Unicode "upsilon with hook"
	LatexCmds.Upsih = //'cos it makes sense to me
	bindMixin(Symbol,'\\Upsilon ','<var style="font-family: serif">&upsih;</var>'); //Symbola's 'upsilon with a hook' is a capital Y without hooks :(

//other symbols with the same LaTeX command and HTML character entity reference
LatexCmds.Gamma =
	LatexCmds.Delta =
	LatexCmds.Theta =
	LatexCmds.Lambda =
	LatexCmds.Xi =
	LatexCmds.Pi =
	LatexCmds.Sigma =
	LatexCmds.Phi =
	LatexCmds.Psi =
	LatexCmds.Omega =
	LatexCmds.forall = class extends VanillaSymbol {
		constructor(latex) {
			super(`\\${latex} `,`&${latex};`);
		}
	};

// symbols that aren't a single MathCommand, but are instead a whole
// Fragment. Creates the Fragment from a LaTeX string
class LatexFragment extends MathCommand {
	constructor(latex) {
		super();
		this.latex = latex;
	}

	createLeftOf(cursor) {
		const block = latexMathParser.parse(this.latex);
		block.children().adopt(cursor.parent, cursor[L], cursor[R]);
		cursor[L] = block.ends[R];
		block.jQize().insertBefore(cursor.jQ);
		block.finalizeInsert(cursor.options, cursor);
		if (block.ends[R][R].siblingCreated) block.ends[R][R].siblingCreated(cursor.options, L);
		if (block.ends[L][L].siblingCreated) block.ends[L][L].siblingCreated(cursor.options, R);
		cursor.parent.bubble('reflow');
	}

	parser() {
		const frag = latexMathParser.parse(this.latex).children();
		return Parser.succeed(frag);
	}
}

// for what seems to me like [stupid reasons][1], Unicode provides
// subscripted and superscripted versions of all ten Arabic numerals,
// as well as [so-called "vulgar fractions"][2].
// Nobody really cares about most of them, but some of them actually
// predate Unicode, dating back to [ISO-8859-1][3], apparently also
// known as "Latin-1", which among other things [Windows-1252][4]
// largely coincides with, so Microsoft Word sometimes inserts them
// and they get copy-pasted into MathQuill.
//
// (Irrelevant but funny story: though not a superset of Latin-1 aka
// ISO-8859-1, Windows-1252 **is** a strict superset of the "closely
// related but distinct"[3] "ISO 8859-1" -- see the lack of a dash
// after "ISO"? Completely different character set, like elephants vs
// elephant seals, or "Zombies" vs "Zombie Redneck Torture Family".
// What kind of idiot would get them confused.
// People in fact got them confused so much, it was so common to
// mislabel Windows-1252 text as ISO-8859-1, that most modern web
// browsers and email clients treat the MIME charset of ISO-8859-1
// as actually Windows-1252, behavior now standard in the HTML5 spec.)
//
// [1]: http://en.wikipedia.org/wiki/Unicode_subscripts_andsuper_scripts
// [2]: http://en.wikipedia.org/wiki/Number_Forms
// [3]: http://en.wikipedia.org/wiki/ISO/IEC_8859-1
// [4]: http://en.wikipedia.org/wiki/Windows-1252
LatexCmds['\u00b9'] = bindMixin(LatexFragment, '^1');
LatexCmds['\u00b2'] = bindMixin(LatexFragment, '^2');
LatexCmds['\u00b3'] = bindMixin(LatexFragment, '^3');
LatexCmds['\u00bc'] = bindMixin(LatexFragment, '\\frac14');
LatexCmds['\u00bd'] = bindMixin(LatexFragment, '\\frac12');
LatexCmds['\u00be'] = bindMixin(LatexFragment, '\\frac34');

class PlusMinus extends BinaryOperator {
	constructor(ctrlSeq, html, text) {
		// TODO: Check this compared to original
		super(ctrlSeq, `<span>${html || ctrlSeq}</span>`, text, true);

		this.siblingCreated = this.siblingDeleted = this.contactWeld;
	}

	contactWeld(opts, dir) {
		const determineOpClassType = (node) => {
			if (node[L]) {
				// If the left sibling is a binary operator or a separator (comma, semicolon, colon)
				// or an open bracket (open parenthesis, open square bracket)
				// consider the operator to be unary
				if (node[L] instanceof BinaryOperator || /^[,;:\(\[]$/.test(node[L].ctrlSeq)) {
					return '';
				}
			} else if (node.parent && node.parent.parent && node.parent.parent.isStyleBlock()) {
				//if we are in a style block at the leftmost edge, determine unary/binary based on
				//the style block
				//this allows style blocks to be transparent for unary/binary purposes
				return determineOpClassType(node.parent.parent);
			} else {
				return '';
			}

			return 'mq-binary-operator';
		};

		if (dir === R) return; // ignore if sibling only changed on the right
		this.jQ[0].className = determineOpClassType(this);
		return this;
	}
}

LatexCmds['+'] = bindMixin(PlusMinus, '+', '+');
//yes, these are different dashes, I think one is an en dash and the other is a hyphen
LatexCmds['\u2013'] = LatexCmds['-'] = bindMixin(PlusMinus, '-', '&minus;');
LatexCmds['\u00b1'] = LatexCmds.pm = LatexCmds.plusmn = LatexCmds.plusminus =
	bindMixin(PlusMinus,'\\pm ','&plusmn;');
LatexCmds.mp = LatexCmds.mnplus = LatexCmds.minusplus =
	bindMixin(PlusMinus,'\\mp ','&#8723;');

CharCmds['*'] = LatexCmds.sdot = LatexCmds.cdot =
	bindMixin(BinaryOperator, '\\cdot ', '&middot;', '*');
//semantically should be &sdot;, but &middot; looks better

class Inequality extends BinaryOperator {
	constructor(data, strict) {
		const strictness = strict ? 'Strict' : '';
		super(data[`ctrlSeq${strictness}`], data[`html${strictness}`], data[`text${strictness}`]);
		this.data = data;
		this.strict = strict;
	}

	swap(strict) {
		this.strict = strict;
		const strictness = strict ? 'Strict' : '';
		this.ctrlSeq = this.data[`ctrlSeq${strictness}`];
		this.jQ.html(this.data[`html${strictness}`]);
		this.textTemplate = [ this.data[`text${strictness}`] ];
	}

	deleteTowards(dir, cursor, ...args) {
		if (dir === L && !this.strict) {
			this.swap(true);
			this.bubble('reflow');
			return;
		}
		super.deleteTowards(dir, cursor, ...args);
	}
}

const less = { ctrlSeq: '\\le ', html: '&le;', text: '<=',
	ctrlSeqStrict: '<', htmlStrict: '&lt;', textStrict: '<' };
const greater = { ctrlSeq: '\\ge ', html: '&ge;', text: '>=',
	ctrlSeqStrict: '>', htmlStrict: '&gt;', textStrict: '>' };

LatexCmds['<'] = LatexCmds.lt = bindMixin(Inequality, less, true);
LatexCmds['>'] = LatexCmds.gt = bindMixin(Inequality, greater, true);
LatexCmds['\u2264'] = LatexCmds.le = LatexCmds.leq = bindMixin(Inequality, less, false);
LatexCmds['\u2265'] = LatexCmds.ge = LatexCmds.geq = bindMixin(Inequality, greater, false);

class Equality extends BinaryOperator {
	constructor() {
		super('=', '=');
	}

	createLeftOf(cursor, ...args) {
		if (cursor[L] instanceof Inequality && cursor[L].strict) {
			cursor[L].swap(false);
			cursor[L].bubble('reflow');
			return;
		}
		super.createLeftOf(cursor, ...args);
	};
}

LatexCmds['='] = Equality;

LatexCmds['\u00d7'] = LatexCmds.times = bindMixin(BinaryOperator, '\\times ', '&times;', '[x]');

LatexCmds['\u00f7'] = LatexCmds.div = LatexCmds.divide = LatexCmds.divides =
	bindMixin(BinaryOperator,'\\div ','&divide;', '[/]');

CharCmds['~'] = LatexCmds.sim = bindMixin(BinaryOperator, '\\sim ', '~', '~');
