// Symbols for Advanced Mathematics

import { noop, bindMixin, LatexCmds } from 'src/constants';
import { Parser } from 'services/parser.util';
import { VanillaSymbol, BinaryOperator, MathCommand } from 'commands/mathElements';

LatexCmds.notin =
	LatexCmds.cong =
	LatexCmds.equiv =
	LatexCmds.oplus =
	LatexCmds.otimes =
		class extends BinaryOperator {
			constructor(latex: string) {
				super(`\\${latex} `, `&${latex};`, 'not in');
			}
		};

LatexCmds['\u2217'] =
	LatexCmds.ast =
	LatexCmds.star =
	LatexCmds.loast =
	LatexCmds.lowast =
		bindMixin(BinaryOperator, '\\ast ', '&lowast;', 'asterisk');

LatexCmds.therefor = LatexCmds.therefore = bindMixin(BinaryOperator, '\\therefore ', '&there4;');

LatexCmds.cuz = // l33t
	LatexCmds.because = bindMixin(BinaryOperator, '\\because ', '&#8757;');

LatexCmds.prop = LatexCmds.propto = bindMixin(BinaryOperator, '\\propto ', '&prop;', 'proportional to');

LatexCmds['\u2248'] =
	LatexCmds.asymp =
	LatexCmds.approx =
		bindMixin(BinaryOperator, '\\approx ', '&asymp;', 'approximately equal to');

LatexCmds.isin = LatexCmds.in = bindMixin(BinaryOperator, '\\in ', '&isin;', 'is in');

LatexCmds.ni = LatexCmds.contains = bindMixin(BinaryOperator, '\\ni ', '&ni;', 'contains');

LatexCmds.notni =
	LatexCmds.niton =
	LatexCmds.notcontains =
	LatexCmds.doesnotcontain =
		bindMixin(BinaryOperator, '\\not\\ni ', '&#8716;', 'does not contain');

LatexCmds.sub = LatexCmds.subset = bindMixin(BinaryOperator, '\\subset ', '&sub;', 'subset');

LatexCmds.sup = LatexCmds.supset = LatexCmds.superset = bindMixin(BinaryOperator, '\\supset ', '&sup;', 'superset');

LatexCmds.nsub =
	LatexCmds.notsub =
	LatexCmds.nsubset =
	LatexCmds.notsubset =
		bindMixin(BinaryOperator, '\\not\\subset ', '&#8836;', 'not a subset');

LatexCmds.nsup =
	LatexCmds.notsup =
	LatexCmds.nsupset =
	LatexCmds.notsupset =
	LatexCmds.nsuperset =
	LatexCmds.notsuperset =
		bindMixin(BinaryOperator, '\\not\\supset ', '&#8837;', 'not a superset');

LatexCmds.sube =
	LatexCmds.subeq =
	LatexCmds.subsete =
	LatexCmds.subseteq =
		bindMixin(BinaryOperator, '\\subseteq ', '&sube;', 'subset or equal to');

LatexCmds.supe =
	LatexCmds.supeq =
	LatexCmds.supsete =
	LatexCmds.supseteq =
	LatexCmds.supersete =
	LatexCmds.superseteq =
		bindMixin(BinaryOperator, '\\supseteq ', '&supe;', 'superset or equal to');

LatexCmds.nsube =
	LatexCmds.nsubeq =
	LatexCmds.notsube =
	LatexCmds.notsubeq =
	LatexCmds.nsubsete =
	LatexCmds.nsubseteq =
	LatexCmds.notsubsete =
	LatexCmds.notsubseteq =
		bindMixin(BinaryOperator, '\\not\\subseteq ', '&#8840;', 'not subset or equal to');

LatexCmds.nsupe =
	LatexCmds.nsupeq =
	LatexCmds.notsupe =
	LatexCmds.notsupeq =
	LatexCmds.nsupsete =
	LatexCmds.nsupseteq =
	LatexCmds.notsupsete =
	LatexCmds.notsupseteq =
	LatexCmds.nsupersete =
	LatexCmds.nsuperseteq =
	LatexCmds.notsupersete =
	LatexCmds.notsuperseteq =
		bindMixin(BinaryOperator, '\\not\\supseteq ', '&#8841;', 'not superset or equal to');

// The canonical sets of numbers
LatexCmds.mathbb = class extends MathCommand {
	constructor(ctrlSeq?: string, htmlTemplate?: string, textTemplate?: string[]) {
		super(ctrlSeq, htmlTemplate, textTemplate);
		this.createLeftOf = noop;
	}

	numBlocks() {
		return 1;
	}

	parser() {
		return (
			Parser.optWhitespace
				.then(Parser.string('{'))
				.then(Parser.optWhitespace)
				.then(Parser.regex(/^[NPZQRCH]/))
				.skip(Parser.optWhitespace)
				.skip(Parser.string('}'))
				// Instantiate the class for the matching char
				.map((c: string) => new LatexCmds[c]())
		);
	}
};

LatexCmds.N = LatexCmds.naturals = LatexCmds.Naturals = bindMixin(VanillaSymbol, '\\mathbb{N}', '&#8469;', 'naturals');

LatexCmds.P =
	LatexCmds.primes =
	LatexCmds.Primes =
	LatexCmds.projective =
	LatexCmds.Projective =
	LatexCmds.probability =
	LatexCmds.Probability =
		bindMixin(VanillaSymbol, '\\mathbb{P}', '&#8473;', 'P');

LatexCmds.Z = LatexCmds.integers = LatexCmds.Integers = bindMixin(VanillaSymbol, '\\mathbb{Z}', '&#8484;', 'integers');

LatexCmds.Q =
	LatexCmds.rationals =
	LatexCmds.Rationals =
		bindMixin(VanillaSymbol, '\\mathbb{Q}', '&#8474;', 'rationals');

LatexCmds.R = LatexCmds.reals = LatexCmds.Reals = bindMixin(VanillaSymbol, '\\mathbb{R}', '&#8477;', 'reals');

LatexCmds.C =
	LatexCmds.complex =
	LatexCmds.Complex =
	LatexCmds.complexes =
	LatexCmds.Complexes =
	LatexCmds.complexplane =
	LatexCmds.Complexplane =
	LatexCmds.ComplexPlane =
		bindMixin(VanillaSymbol, '\\mathbb{C}', '&#8450;', 'comlexes');

LatexCmds.H =
	LatexCmds.Hamiltonian =
	LatexCmds.quaternions =
	LatexCmds.Quaternions =
		bindMixin(VanillaSymbol, '\\mathbb{H}', '&#8461;', 'quaternions');

// spacing
LatexCmds.quad = LatexCmds.emsp = bindMixin(VanillaSymbol, '\\quad ', '    ', '4 spaces');
LatexCmds.qquad = bindMixin(VanillaSymbol, '\\qquad ', '        ', '8 spaces');
// spacing special characters, gonna have to implement this in LatexCommandInput::onText somehow
// case ',':
//  return VanillaSymbol('\\, ',' ');
// case ':':
//  return VanillaSymbol('\\: ','  ');
// case ';':
//  return VanillaSymbol('\\; ','   ');
// case '!':
//  return Symbol('\\! ', '<span style="margin-right:-.2em"></span>');

// binary operators
LatexCmds.diamond = bindMixin(VanillaSymbol, '\\diamond ', '&#9671;');
LatexCmds.bigtriangleup = bindMixin(VanillaSymbol, '\\bigtriangleup ', '&#9651;', 'big triangle up');
LatexCmds.ominus = bindMixin(VanillaSymbol, '\\ominus ', '&#8854;', 'o minus');
LatexCmds.uplus = bindMixin(VanillaSymbol, '\\uplus ', '&#8846;', 'disjoint union');
LatexCmds.bigtriangledown = bindMixin(VanillaSymbol, '\\bigtriangledown ', '&#9661;', 'big triangle down');
LatexCmds.sqcap = bindMixin(VanillaSymbol, '\\sqcap ', '&#8851;', 'square cap');
LatexCmds.triangleleft = bindMixin(VanillaSymbol, '\\triangleleft ', '&#8882;', 'triangle left');
LatexCmds.sqcup = bindMixin(VanillaSymbol, '\\sqcup ', '&#8852;', 'square cup');
LatexCmds.triangleright = bindMixin(VanillaSymbol, '\\triangleright ', '&#8883;', 'triangle right');
// circledot is not a not real LaTex command see https://github.com/mathquill/mathquill/pull/552 for more details
LatexCmds.odot = LatexCmds.circledot = bindMixin(VanillaSymbol, '\\odot ', '&#8857;', 'circle dot');
LatexCmds.bigcirc = bindMixin(VanillaSymbol, '\\bigcirc ', '&#9711;', 'big circle');
LatexCmds.dagger = bindMixin(VanillaSymbol, '\\dagger ', '&#0134;', 'dagger');
LatexCmds.ddagger = bindMixin(VanillaSymbol, '\\ddagger ', '&#135;', 'big dagger');
LatexCmds.wr = bindMixin(VanillaSymbol, '\\wr ', '&#8768;', 'wreath');
LatexCmds.amalg = bindMixin(VanillaSymbol, '\\amalg ', '&#8720;', 'amalgam');

// relationship symbols
LatexCmds.models = bindMixin(VanillaSymbol, '\\models ', '&#8872;');
LatexCmds.prec = bindMixin(VanillaSymbol, '\\prec ', '&#8826;', 'precedes');
LatexCmds.succ = bindMixin(VanillaSymbol, '\\succ ', '&#8827;', 'succeeds');
LatexCmds.preceq = bindMixin(VanillaSymbol, '\\preceq ', '&#8828;', 'precedes or equals');
LatexCmds.succeq = bindMixin(VanillaSymbol, '\\succeq ', '&#8829;', 'succeeds or equals');
LatexCmds.simeq = bindMixin(VanillaSymbol, '\\simeq ', '&#8771;', 'similar or equal to');
LatexCmds.mid = bindMixin(VanillaSymbol, '\\mid ', '&#8739;', 'divides');
LatexCmds.ll = bindMixin(VanillaSymbol, '\\ll ', '&#8810;', 'sufficiently less than');
LatexCmds.gg = bindMixin(VanillaSymbol, '\\gg ', '&#8811;', 'sufficiently greater than');
LatexCmds.parallel = bindMixin(VanillaSymbol, '\\parallel ', '&#8741;', 'parallel to');
LatexCmds.nparallel = bindMixin(VanillaSymbol, '\\nparallel ', '&#8742;', 'not parallel to');
LatexCmds.bowtie = bindMixin(VanillaSymbol, '\\bowtie ', '&#8904;');
LatexCmds.sqsubset = bindMixin(VanillaSymbol, '\\sqsubset ', '&#8847;', 'square subset');
LatexCmds.sqsupset = bindMixin(VanillaSymbol, '\\sqsupset ', '&#8848;', 'square superset');
LatexCmds.smile = bindMixin(VanillaSymbol, '\\smile ', '&#8995;');
LatexCmds.sqsubseteq = bindMixin(VanillaSymbol, '\\sqsubseteq ', '&#8849;', 'square subset or equal to');
LatexCmds.sqsupseteq = bindMixin(VanillaSymbol, '\\sqsupseteq ', '&#8850;', 'square superset or equal to');
LatexCmds.doteq = bindMixin(VanillaSymbol, '\\doteq ', '&#8784;', 'dotted equals');
LatexCmds.frown = bindMixin(VanillaSymbol, '\\frown ', '&#8994;');
LatexCmds.vdash = bindMixin(VanillaSymbol, '\\vdash ', '&#8870;', 'v dash');
LatexCmds.dashv = bindMixin(VanillaSymbol, '\\dashv ', '&#8867;', 'dash v');
LatexCmds.nless = bindMixin(VanillaSymbol, '\\nless ', '&#8814;', 'not less than');
LatexCmds.ngtr = bindMixin(VanillaSymbol, '\\ngtr ', '&#8815;', 'not greater than');

// arrows
LatexCmds.longleftarrow = bindMixin(VanillaSymbol, '\\longleftarrow ', '&#8592;', 'left arrow');
LatexCmds.longrightarrow = bindMixin(VanillaSymbol, '\\longrightarrow ', '&#8594;', 'right arrow');
LatexCmds.Longleftarrow = bindMixin(VanillaSymbol, '\\Longleftarrow ', '&#8656;', 'left arrow');
LatexCmds.Longrightarrow = bindMixin(VanillaSymbol, '\\Longrightarrow ', '&#8658;', 'right arrow');
LatexCmds.longleftrightarrow = bindMixin(VanillaSymbol, '\\longleftrightarrow ', '&#8596;', 'left and right arrow');
LatexCmds.updownarrow = bindMixin(VanillaSymbol, '\\updownarrow ', '&#8597;', 'up and down arrow');
LatexCmds.Longleftrightarrow = bindMixin(VanillaSymbol, '\\Longleftrightarrow ', '&#8660;', 'left and right arrow');
LatexCmds.Updownarrow = bindMixin(VanillaSymbol, '\\Updownarrow ', '&#8661;', 'up and down arrow');
LatexCmds.mapsto = bindMixin(VanillaSymbol, '\\mapsto ', '&#8614;', 'maps to');
LatexCmds.nearrow = bindMixin(VanillaSymbol, '\\nearrow ', '&#8599;', 'northeast arrow');
LatexCmds.hookleftarrow = bindMixin(VanillaSymbol, '\\hookleftarrow ', '&#8617;', 'hook left arrow');
LatexCmds.hookrightarrow = bindMixin(VanillaSymbol, '\\hookrightarrow ', '&#8618;', 'hook right arrow');
LatexCmds.searrow = bindMixin(VanillaSymbol, '\\searrow ', '&#8600;', 'southeast arrow');
LatexCmds.leftharpoonup = bindMixin(VanillaSymbol, '\\leftharpoonup ', '&#8636;', 'left harpoon up');
LatexCmds.rightharpoonup = bindMixin(VanillaSymbol, '\\rightharpoonup ', '&#8640;', 'right harpoon up');
LatexCmds.swarrow = bindMixin(VanillaSymbol, '\\swarrow ', '&#8601;', 'southwest arrow');
LatexCmds.leftharpoondown = bindMixin(VanillaSymbol, '\\leftharpoondown ', '&#8637;', 'left harpoon down');
LatexCmds.rightharpoondown = bindMixin(VanillaSymbol, '\\rightharpoondown ', '&#8641;', 'right harpoon down');
LatexCmds.nwarrow = bindMixin(VanillaSymbol, '\\nwarrow ', '&#8598;', 'northwest arrow');

// Misc
LatexCmds.ldots = bindMixin(VanillaSymbol, '\\ldots ', '&#8230;', 'ellipsis');
LatexCmds.cdots = bindMixin(VanillaSymbol, '\\cdots ', '&#8943;', 'multiplication ellipsis');
LatexCmds.vdots = bindMixin(VanillaSymbol, '\\vdots ', '&#8942;', 'vertical ellipsis');
LatexCmds.ddots = bindMixin(VanillaSymbol, '\\ddots ', '&#8945;', 'diagonal ellipsis');
LatexCmds.surd = bindMixin(VanillaSymbol, '\\surd ', '&#8730;', 'unresolved root');
LatexCmds.triangle = bindMixin(VanillaSymbol, '\\triangle ', '&#9651;');
LatexCmds.ell = bindMixin(VanillaSymbol, '\\ell ', '&#8467;');
LatexCmds.top = bindMixin(VanillaSymbol, '\\top ', '&#8868;');
LatexCmds.flat = bindMixin(VanillaSymbol, '\\flat ', '&#9837;');
LatexCmds.natural = bindMixin(VanillaSymbol, '\\natural ', '&#9838;');
LatexCmds.sharp = bindMixin(VanillaSymbol, '\\sharp ', '&#9839;');
LatexCmds.wp = bindMixin(VanillaSymbol, '\\wp ', '&#8472;');
LatexCmds.bot = bindMixin(VanillaSymbol, '\\bot ', '&#8869;');
LatexCmds.clubsuit = bindMixin(VanillaSymbol, '\\clubsuit ', '&#9827;', 'club suit');
LatexCmds.diamondsuit = bindMixin(VanillaSymbol, '\\diamondsuit ', '&#9826;', 'diamond suit');
LatexCmds.heartsuit = bindMixin(VanillaSymbol, '\\heartsuit ', '&#9825;', 'heart suit');
LatexCmds.spadesuit = bindMixin(VanillaSymbol, '\\spadesuit ', '&#9824;', 'spade suit');
// not real LaTex command see https://github.com/mathquill/mathquill/pull/552 for more details
LatexCmds.parallelogram = bindMixin(VanillaSymbol, '\\parallelogram ', '&#9649;');
LatexCmds.square = bindMixin(VanillaSymbol, '\\square ', '&#11036;');

// variable-sized
LatexCmds.oint = bindMixin(VanillaSymbol, '\\oint ', '&#8750;', 'o int');
LatexCmds.bigcap = bindMixin(VanillaSymbol, '\\bigcap ', '&#8745;', 'big cap');
LatexCmds.bigcup = bindMixin(VanillaSymbol, '\\bigcup ', '&#8746;', 'big cup');
LatexCmds.bigsqcup = bindMixin(VanillaSymbol, '\\bigsqcup ', '&#8852;', 'big square cup');
LatexCmds.bigvee = bindMixin(VanillaSymbol, '\\bigvee ', '&#8744;', 'big vee');
LatexCmds.bigwedge = bindMixin(VanillaSymbol, '\\bigwedge ', '&#8743;', 'big wedge');
LatexCmds.bigodot = bindMixin(VanillaSymbol, '\\bigodot ', '&#8857;', 'big o dot');
LatexCmds.bigotimes = bindMixin(VanillaSymbol, '\\bigotimes ', '&#8855;', 'big o times');
LatexCmds.bigoplus = bindMixin(VanillaSymbol, '\\bigoplus ', '&#8853;', 'big o plus');
LatexCmds.biguplus = bindMixin(VanillaSymbol, '\\biguplus ', '&#8846;', 'big u plus');

// delimiters
LatexCmds.lfloor = bindMixin(VanillaSymbol, '\\lfloor ', '&#8970;', 'left floor');
LatexCmds.rfloor = bindMixin(VanillaSymbol, '\\rfloor ', '&#8971;', 'right floor');
LatexCmds.lceil = bindMixin(VanillaSymbol, '\\lceil ', '&#8968;', 'left ceiling');
LatexCmds.rceil = bindMixin(VanillaSymbol, '\\rceil ', '&#8969;', 'right ceiling');
LatexCmds.opencurlybrace = LatexCmds.lbrace = bindMixin(VanillaSymbol, '\\lbrace ', '{', 'left brace');
LatexCmds.closecurlybrace = LatexCmds.rbrace = bindMixin(VanillaSymbol, '\\rbrace ', '}', 'right brace');
LatexCmds.lbrack = bindMixin(VanillaSymbol, '[', 'left bracket');
LatexCmds.rbrack = bindMixin(VanillaSymbol, ']', 'right bracket');

// various symbols
LatexCmds.slash = bindMixin(VanillaSymbol, '/', '', '', 'slash');
LatexCmds.vert = bindMixin(VanillaSymbol, '|', '', '', 'vertical bar');
LatexCmds.perp = LatexCmds.perpendicular = bindMixin(VanillaSymbol, '\\perp ', '&perp;', 'perpendicular');
LatexCmds.nabla = LatexCmds.del = bindMixin(VanillaSymbol, '\\nabla ', '&nabla;');
LatexCmds.hbar = bindMixin(VanillaSymbol, '\\hbar ', '&#8463;', 'horizontal bar');

// FIXME: \AA is not valid LaTeX in math mode.  Neither is \text\AA (which is what this was before).  Furthermore,
// \text\AA does not parse correctly.  Valid LaTeX in math mode without any packages would be \textup{~\AA}, but that
// also does not parse correctly.
LatexCmds.AA =
	LatexCmds.Angstrom =
	LatexCmds.angstrom =
		bindMixin(VanillaSymbol, '\\AA ', '&#8491;', '\u00C5', 'angstrom');

LatexCmds.ring = LatexCmds.circ = LatexCmds.circle = bindMixin(VanillaSymbol, '\\circ ', '&#8728;', 'circle');

LatexCmds.bull = LatexCmds.bullet = bindMixin(VanillaSymbol, '\\bullet ', '&bull;');

LatexCmds.setminus = LatexCmds.smallsetminus = bindMixin(VanillaSymbol, '\\setminus ', '&#8726;', 'set minus');

LatexCmds.not = LatexCmds['\u00ac'] = LatexCmds.neg = bindMixin(VanillaSymbol, '\\neg ', '&not;', '', 'not');

LatexCmds['\u2026'] =
	LatexCmds.dots =
	LatexCmds.ellip =
	LatexCmds.hellip =
	LatexCmds.ellipsis =
	LatexCmds.hellipsis =
		bindMixin(VanillaSymbol, '\\dots ', '&hellip;', 'ellipsis');

LatexCmds.converges =
	LatexCmds.darr =
	LatexCmds.dnarr =
	LatexCmds.dnarrow =
	LatexCmds.downarrow =
		bindMixin(VanillaSymbol, '\\downarrow ', '&darr;', 'converges with');

LatexCmds.dArr =
	LatexCmds.dnArr =
	LatexCmds.dnArrow =
	LatexCmds.Downarrow =
		bindMixin(VanillaSymbol, '\\Downarrow ', '&dArr;', 'down arrow');

LatexCmds.diverges =
	LatexCmds.uarr =
	LatexCmds.uparrow =
		bindMixin(VanillaSymbol, '\\uparrow ', '&uarr;', 'diverges from');

LatexCmds.uArr = LatexCmds.Uparrow = bindMixin(VanillaSymbol, '\\Uparrow ', '&uArr;', 'up arrow');

LatexCmds.to = bindMixin(BinaryOperator, '\\to ', '&rarr;');

LatexCmds.rarr = LatexCmds.rightarrow = bindMixin(VanillaSymbol, '\\rightarrow ', '&rarr;', 'right arrow');

LatexCmds.implies = bindMixin(BinaryOperator, '\\Rightarrow ', '&rArr;', 'implies');

LatexCmds.rArr = LatexCmds.Rightarrow = bindMixin(VanillaSymbol, '\\Rightarrow ', '&rArr;', 'right arrow');

LatexCmds.gets = bindMixin(BinaryOperator, '\\gets ', '&larr;');

LatexCmds.larr = LatexCmds.leftarrow = bindMixin(VanillaSymbol, '\\leftarrow ', '&larr;', 'left arrow');

LatexCmds.impliedby = bindMixin(BinaryOperator, '\\Leftarrow ', '&lArr;', 'implied by');

LatexCmds.lArr = LatexCmds.Leftarrow = bindMixin(VanillaSymbol, '\\Leftarrow ', '&lArr;', 'left arrow');

LatexCmds.harr =
	LatexCmds.lrarr =
	LatexCmds.leftrightarrow =
		bindMixin(VanillaSymbol, '\\leftrightarrow ', '&harr;', 'left and right arrow');

LatexCmds.iff = bindMixin(BinaryOperator, '\\Leftrightarrow ', '&hArr;', 'if and only if');

LatexCmds.hArr =
	LatexCmds.lrArr =
	LatexCmds.Leftrightarrow =
		bindMixin(VanillaSymbol, '\\Leftrightarrow ', '&hArr;', 'left and right arrow');

LatexCmds.Re = LatexCmds.Real = LatexCmds.real = bindMixin(VanillaSymbol, '\\Re ', '&real;', 'real');

LatexCmds.Im =
	LatexCmds.imag =
	LatexCmds.image =
	LatexCmds.imagin =
	LatexCmds.imaginary =
	LatexCmds.Imaginary =
		bindMixin(VanillaSymbol, '\\Im ', '&image;', 'imaginary');

LatexCmds.part = LatexCmds.partial = bindMixin(VanillaSymbol, '\\partial ', '&part;');

LatexCmds.inf =
	LatexCmds.infty =
	LatexCmds.infin =
	LatexCmds.infinity =
		bindMixin(VanillaSymbol, '\\infty ', '&infin;', 'inf', 'infinity');

LatexCmds.pounds = bindMixin(VanillaSymbol, '\\pounds ', '&pound;');

LatexCmds.alef =
	LatexCmds.alefsym =
	LatexCmds.aleph =
	LatexCmds.alephsym =
		bindMixin(VanillaSymbol, '\\aleph ', '&alefsym;');

LatexCmds.xist =
	LatexCmds.xists =
	LatexCmds.exist =
	LatexCmds.exists =
		bindMixin(VanillaSymbol, '\\exists ', '&exist;', 'there exists');

LatexCmds.nexists = LatexCmds.nexist = bindMixin(VanillaSymbol, '\\nexists ', '&#8708;', 'there is no');

LatexCmds.and = LatexCmds.land = LatexCmds.wedge = bindMixin(BinaryOperator, '\\wedge ', '&and;', 'and');

LatexCmds.or = LatexCmds.lor = LatexCmds.vee = bindMixin(BinaryOperator, '\\vee ', '&or;', 'or');

LatexCmds.o =
	LatexCmds.O =
	LatexCmds.empty =
	LatexCmds.emptyset =
	LatexCmds.oslash =
	LatexCmds.Oslash =
	LatexCmds.nothing =
	LatexCmds.varnothing =
		bindMixin(BinaryOperator, '\\varnothing ', '&empty;', 'empty set');

LatexCmds.U = LatexCmds.cup = LatexCmds.union = bindMixin(BinaryOperator, '\\cup ', '&cup;', 'U', 'union');

LatexCmds.cap =
	LatexCmds.intersect =
	LatexCmds.intersection =
		bindMixin(BinaryOperator, '\\cap ', '&cap;', 'intersection');

// FIXME: the correct LaTeX would be ^\circ but we can't parse that
LatexCmds.deg = LatexCmds.degree = class degree extends VanillaSymbol {
	constructor() {
		super('\\degree ', '&deg;', '', 'degrees');
	}

	text() {
		const rightText = this.right?.text();
		return `\u00B0${rightText && /^[^FCK]$/.test(rightText) ? ' ' : ''}`;
	}
};

LatexCmds.ang = LatexCmds.angle = bindMixin(VanillaSymbol, '\\angle ', '&ang;');
LatexCmds.measuredangle = bindMixin(VanillaSymbol, '\\measuredangle ', '&#8737;', 'measured angle');
