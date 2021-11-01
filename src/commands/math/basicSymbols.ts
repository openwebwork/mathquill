// Symbols for Basic Mathematics

import type { Direction } from 'src/constants';
import { noop, L, R, bindMixin, LatexCmds, CharCmds } from 'src/constants';
import { Options } from 'src/options';
import type { Cursor } from 'src/cursor';
import { Parser } from 'services/parser.util';
import { Node } from 'tree/node';
import {
	Symbol, VanillaSymbol, BinaryOperator, Equality, Inequality, MathCommand, Variable, Letter, latexMathParser
} from 'commands/mathElements';
import { MathBlock } from 'commands/mathBlock';

class OperatorName extends Symbol {
	constructor(fn: string) {
		super();
		this.ctrlSeq = fn;
	}

	createLeftOf(cursor: Cursor) {
		for (const char of this.ctrlSeq) {
			new Letter(char).createLeftOf(cursor);
		}
	}

	parser() {
		const block = new MathBlock();
		for (const char of this.ctrlSeq) {
			new Letter(char).adopt(block, block.ends[R]);
		}
		return Parser.succeed(block.children());
	}
}

for (const fn in Options.autoOperatorNames) {
	if (fn !== '_maxLength') {
		LatexCmds[fn] = OperatorName;
	}
}

LatexCmds.operatorname = class extends MathCommand {
	constructor(ctrlSeq?: string, htmlTemplate?: string, textTemplate?: Array<string>) {
		super(ctrlSeq, htmlTemplate, textTemplate);
		this.createLeftOf = noop;
	}
	numBlocks() { return 1; };
	parser() {
		return (latexMathParser.block as Parser).map((b: MathBlock) => b.children());
	};
};

LatexCmds.f = class extends Letter {
	constructor() {
		super('f', '<var class="mq-f">f</var>');
		this.letter = 'f';
	}

	italicize(bool: boolean) {
		this.jQ.html('f').toggleClass('mq-f', bool);
		return super.italicize(bool);
	}
};

// VanillaSymbol's
LatexCmds[' '] = LatexCmds.space = bindMixin(VanillaSymbol, '\\ ', '&nbsp;');

LatexCmds["'"] = LatexCmds.prime = bindMixin(VanillaSymbol, "'", '&prime;');
// LatexCmds['\u2033'] = LatexCmds.dprime = bindMixin(VanillaSymbol, '\u2033', '&Prime;');

LatexCmds.backslash = bindMixin(VanillaSymbol, '\\backslash ', '\\');
if (!CharCmds['\\']) CharCmds['\\'] = LatexCmds.backslash;

LatexCmds.$ = bindMixin(VanillaSymbol, '\\$', '$');

// does not use Symbola font
class NonSymbolaSymbol extends Symbol {
	constructor(ch: string, html?: string) {
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
		constructor(latex: string) {
			super(`\\${latex} `, `&${latex};`);
		}
	};

//why can't anybody FUCKING agree on these
LatexCmds.phi = //W3C or Unicode?
	bindMixin(Variable, '\\phi ', '&#981;');

LatexCmds.phiv = //Elsevier and 9573-13
	LatexCmds.varphi = //AMS and LaTeX
	bindMixin(Variable, '\\varphi ', '&phi;');

LatexCmds.epsilon = //W3C or Unicode?
	bindMixin(Variable, '\\epsilon ', '&#1013;');

LatexCmds.epsiv = //Elsevier and 9573-13
	LatexCmds.varepsilon = //AMS and LaTeX
	bindMixin(Variable, '\\varepsilon ', '&epsilon;');

LatexCmds.piv = //W3C/Unicode and Elsevier and 9573-13
	LatexCmds.varpi = //AMS and LaTeX
	bindMixin(Variable, '\\varpi ', '&piv;');

LatexCmds.sigmaf = //W3C/Unicode
	LatexCmds.sigmav = //Elsevier
	LatexCmds.varsigma = //LaTeX
	bindMixin(Variable, '\\varsigma ', '&sigmaf;');

LatexCmds.thetav = //Elsevier and 9573-13
	LatexCmds.vartheta = //AMS and LaTeX
	LatexCmds.thetasym = //W3C/Unicode
	bindMixin(Variable, '\\vartheta ', '&thetasym;');

LatexCmds.upsilon = //AMS and LaTeX and W3C/Unicode
	LatexCmds.upsi = //Elsevier and 9573-13
	bindMixin(Variable, '\\upsilon ', '&upsilon;');

//these aren't even mentioned in the HTML character entity references
LatexCmds.gammad = //Elsevier
	LatexCmds.Gammad = //9573-13 -- WTF, right? I dunno if this was a typo in the reference (see above)
	LatexCmds.digamma = //LaTeX
	bindMixin(Variable, '\\digamma ', '&#989;');

LatexCmds.kappav = //Elsevier
	LatexCmds.varkappa = //AMS and LaTeX
	bindMixin(Variable, '\\varkappa ', '&#1008;');

LatexCmds.rhov = //Elsevier and 9573-13
	LatexCmds.varrho = //AMS and LaTeX
	bindMixin(Variable, '\\varrho ', '&#1009;');

//Greek constants, look best in non-italicized Times New Roman
LatexCmds.pi = LatexCmds['\u03c0'] = bindMixin(NonSymbolaSymbol, '\\pi ', '&pi;');
LatexCmds.lambda = bindMixin(NonSymbolaSymbol, '\\lambda ', '&lambda;');

//uppercase greek letters

LatexCmds.Upsilon = //LaTeX
	LatexCmds.Upsi = //Elsevier and 9573-13
	LatexCmds.upsih = //W3C/Unicode "upsilon with hook"
	LatexCmds.Upsih = //'cos it makes sense to me
	//Symbola's 'upsilon with a hook' is a capital Y without hooks :(
	bindMixin(Symbol, '\\Upsilon ', '<var style="font-family: serif">&upsih;</var>');

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
		constructor(latex: string) {
			super(`\\${latex} `, `&${latex};`);
		}
	};

// symbols that aren't a single MathCommand, but are instead a whole
// Fragment. Creates the Fragment from a LaTeX string
class LatexFragment extends MathCommand {
	constructor(latex: string) {
		super();
		this.latex = () => latex;
	}

	createLeftOf(cursor: Cursor) {
		const block = latexMathParser.parse(this.latex());
		block.children().adopt(cursor.parent, cursor[L], cursor[R]);
		cursor[L] = block.ends[R];
		block.jQize().insertBefore(cursor.jQ);
		block.finalizeInsert(cursor.options, cursor);
		block.ends[R]?.[R]?.siblingCreated?.(cursor.options, L);
		block.ends[L]?.[L]?.siblingCreated?.(cursor.options, R);
		cursor.parent?.bubble('reflow');
	}

	parser() {
		const frag = latexMathParser.parse(this.latex()).children();
		return Parser.succeed(frag);
	}
}

// For what seems to me like [stupid reasons][1], Unicode provides
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
	constructor(ctrlSeq: string, html?: string, text?: string) {
		super(ctrlSeq, `<span>${html || ctrlSeq}</span>`, text, true);

		this.siblingCreated = this.siblingDeleted = (opts: Options, dir?: Direction) => this.contactWeld(opts, dir);
	}

	contactWeld(opts: Options, dir?: Direction) {
		const determineOpClassType = (node: Node): string => {
			if (node[L]) {
				// If the left sibling is a binary operator or a separator (comma, semicolon, colon)
				// or an open bracket (open parenthesis, open square bracket)
				// consider the operator to be unary
				if (node[L] instanceof BinaryOperator || /^[,;:([]$/.test((node[L] as BinaryOperator).ctrlSeq)) {
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
	bindMixin(PlusMinus, '\\pm ', '&plusmn;');
LatexCmds.mp = LatexCmds.mnplus = LatexCmds.minusplus =
	bindMixin(PlusMinus, '\\mp ', '&#8723;');

//semantically should be &sdot;, but &middot; looks better
CharCmds['*'] = LatexCmds.sdot = LatexCmds.cdot = bindMixin(BinaryOperator, '\\cdot ', '&middot;', '*');

const less = { ctrlSeq: '\\le ', html: '&le;', text: '<=',
	ctrlSeqStrict: '<', htmlStrict: '&lt;', textStrict: '<' };
const greater = { ctrlSeq: '\\ge ', html: '&ge;', text: '>=',
	ctrlSeqStrict: '>', htmlStrict: '&gt;', textStrict: '>' };

LatexCmds['<'] = LatexCmds.lt = bindMixin(Inequality, less, true);
LatexCmds['>'] = LatexCmds.gt = bindMixin(Inequality, greater, true);
LatexCmds['\u2264'] = LatexCmds.le = LatexCmds.leq = bindMixin(Inequality, less, false);
LatexCmds['\u2265'] = LatexCmds.ge = LatexCmds.geq = bindMixin(Inequality, greater, false);

LatexCmds['='] = Equality;

LatexCmds['\u00d7'] = LatexCmds.times = bindMixin(BinaryOperator, '\\times ', '&times;', '[x]');

LatexCmds['\u00f7'] = LatexCmds.div = LatexCmds.divide = LatexCmds.divides =
	bindMixin(BinaryOperator, '\\div ', '&divide;', '[/]');

CharCmds['~'] = LatexCmds.sim = bindMixin(BinaryOperator, '\\sim ', '~', '~');
