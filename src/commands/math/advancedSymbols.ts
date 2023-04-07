// Symbols for Advanced Mathematics

import { R, noop, bindMixin, LatexCmds } from 'src/constants';
import { Parser } from 'services/parser.util';
import { VanillaSymbol, BinaryOperator, MathCommand } from 'commands/mathElements';

LatexCmds.notin = LatexCmds.cong = LatexCmds.equiv = LatexCmds.oplus = LatexCmds.otimes =
	class extends BinaryOperator {
		constructor(latex: string) {
			super(`\\${latex} `, `&${latex};`);
		}
	};

LatexCmds['\u2260'] = LatexCmds.ne = LatexCmds.neq = bindMixin(BinaryOperator, '\\ne ', '&ne;');

LatexCmds['\u2217'] = LatexCmds.ast = LatexCmds.star = LatexCmds.loast = LatexCmds.lowast =
	bindMixin(BinaryOperator, '\\ast ', '&lowast;');

LatexCmds.therefor = LatexCmds.therefore =
	bindMixin(BinaryOperator, '\\therefore ', '&there4;');

LatexCmds.cuz = // l33t
	LatexCmds.because = bindMixin(BinaryOperator, '\\because ', '&#8757;');

LatexCmds.prop = LatexCmds.propto = bindMixin(BinaryOperator, '\\propto ', '&prop;');

LatexCmds['\u2248'] = LatexCmds.asymp = LatexCmds.approx =
	bindMixin(BinaryOperator, '\\approx ', '&asymp;');

LatexCmds.isin = LatexCmds['in'] = bindMixin(BinaryOperator, '\\in ', '&isin;');

LatexCmds.ni = LatexCmds.contains = bindMixin(BinaryOperator, '\\ni ', '&ni;');

LatexCmds.notni = LatexCmds.niton = LatexCmds.notcontains = LatexCmds.doesnotcontain =
	bindMixin(BinaryOperator, '\\not\\ni ', '&#8716;');

LatexCmds.sub = LatexCmds.subset = bindMixin(BinaryOperator, '\\subset ', '&sub;');

LatexCmds.sup = LatexCmds.supset = LatexCmds.superset =
	bindMixin(BinaryOperator, '\\supset ', '&sup;');

LatexCmds.nsub = LatexCmds.notsub =
	LatexCmds.nsubset = LatexCmds.notsubset =
	bindMixin(BinaryOperator, '\\not\\subset ', '&#8836;');

LatexCmds.nsup = LatexCmds.notsup =
	LatexCmds.nsupset = LatexCmds.notsupset =
	LatexCmds.nsuperset = LatexCmds.notsuperset =
	bindMixin(BinaryOperator, '\\not\\supset ', '&#8837;');

LatexCmds.sube = LatexCmds.subeq = LatexCmds.subsete = LatexCmds.subseteq =
	bindMixin(BinaryOperator, '\\subseteq ', '&sube;');

LatexCmds.supe = LatexCmds.supeq =
	LatexCmds.supsete = LatexCmds.supseteq =
	LatexCmds.supersete = LatexCmds.superseteq =
	bindMixin(BinaryOperator, '\\supseteq ', '&supe;');

LatexCmds.nsube = LatexCmds.nsubeq =
	LatexCmds.notsube = LatexCmds.notsubeq =
	LatexCmds.nsubsete = LatexCmds.nsubseteq =
	LatexCmds.notsubsete = LatexCmds.notsubseteq =
	bindMixin(BinaryOperator, '\\not\\subseteq ', '&#8840;');

LatexCmds.nsupe = LatexCmds.nsupeq =
	LatexCmds.notsupe = LatexCmds.notsupeq =
	LatexCmds.nsupsete = LatexCmds.nsupseteq =
	LatexCmds.notsupsete = LatexCmds.notsupseteq =
	LatexCmds.nsupersete = LatexCmds.nsuperseteq =
	LatexCmds.notsupersete = LatexCmds.notsuperseteq =
	bindMixin(BinaryOperator, '\\not\\supseteq ', '&#8841;');

// The canonical sets of numbers
LatexCmds.mathbb = class extends MathCommand {
	constructor(ctrlSeq?: string, htmlTemplate?: string, textTemplate?: Array<string>) {
		super(ctrlSeq, htmlTemplate, textTemplate);
		this.createLeftOf = noop;
	}

	numBlocks() { return 1; }

	parser() {
		return Parser.optWhitespace.then(Parser.string('{'))
			.then(Parser.optWhitespace)
			.then(Parser.regex(/^[NPZQRCH]/))
			.skip(Parser.optWhitespace)
			.skip(Parser.string('}'))
			// Instantiate the class for the matching char
			.map((c: string) => new LatexCmds[c]);
	}
};

LatexCmds.N = LatexCmds.naturals = LatexCmds.Naturals =
	bindMixin(VanillaSymbol, '\\mathbb{N}', '&#8469;');

LatexCmds.P =
	LatexCmds.primes = LatexCmds.Primes =
	LatexCmds.projective = LatexCmds.Projective =
	LatexCmds.probability = LatexCmds.Probability =
	bindMixin(VanillaSymbol, '\\mathbb{P}', '&#8473;');

LatexCmds.Z = LatexCmds.integers = LatexCmds.Integers =
	bindMixin(VanillaSymbol, '\\mathbb{Z}', '&#8484;');

LatexCmds.Q = LatexCmds.rationals = LatexCmds.Rationals =
	bindMixin(VanillaSymbol, '\\mathbb{Q}', '&#8474;');

LatexCmds.R = LatexCmds.reals = LatexCmds.Reals =
	bindMixin(VanillaSymbol, '\\mathbb{R}', '&#8477;');

LatexCmds.C =
	LatexCmds.complex = LatexCmds.Complex =
	LatexCmds.complexes = LatexCmds.Complexes =
	LatexCmds.complexplane = LatexCmds.Complexplane = LatexCmds.ComplexPlane =
	bindMixin(VanillaSymbol, '\\mathbb{C}', '&#8450;');

LatexCmds.H = LatexCmds.Hamiltonian = LatexCmds.quaternions = LatexCmds.Quaternions =
	bindMixin(VanillaSymbol, '\\mathbb{H}', '&#8461;');

// spacing
LatexCmds.quad = LatexCmds.emsp = bindMixin(VanillaSymbol, '\\quad ', '    ');
LatexCmds.qquad = bindMixin(VanillaSymbol, '\\qquad ', '        ');
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
LatexCmds.bigtriangleup = bindMixin(VanillaSymbol, '\\bigtriangleup ', '&#9651;');
LatexCmds.ominus = bindMixin(VanillaSymbol, '\\ominus ', '&#8854;');
LatexCmds.uplus = bindMixin(VanillaSymbol, '\\uplus ', '&#8846;');
LatexCmds.bigtriangledown = bindMixin(VanillaSymbol, '\\bigtriangledown ', '&#9661;');
LatexCmds.sqcap = bindMixin(VanillaSymbol, '\\sqcap ', '&#8851;');
LatexCmds.triangleleft = bindMixin(VanillaSymbol, '\\triangleleft ', '&#8882;');
LatexCmds.sqcup = bindMixin(VanillaSymbol, '\\sqcup ', '&#8852;');
LatexCmds.triangleright = bindMixin(VanillaSymbol, '\\triangleright ', '&#8883;');
// circledot is not a not real LaTex command see https://github.com/mathquill/mathquill/pull/552 for more details
LatexCmds.odot = LatexCmds.circledot = bindMixin(VanillaSymbol, '\\odot ', '&#8857;');
LatexCmds.bigcirc = bindMixin(VanillaSymbol, '\\bigcirc ', '&#9711;');
LatexCmds.dagger = bindMixin(VanillaSymbol, '\\dagger ', '&#0134;');
LatexCmds.ddagger = bindMixin(VanillaSymbol, '\\ddagger ', '&#135;');
LatexCmds.wr = bindMixin(VanillaSymbol, '\\wr ', '&#8768;');
LatexCmds.amalg = bindMixin(VanillaSymbol, '\\amalg ', '&#8720;');

// relationship symbols
LatexCmds.models = bindMixin(VanillaSymbol, '\\models ', '&#8872;');
LatexCmds.prec = bindMixin(VanillaSymbol, '\\prec ', '&#8826;');
LatexCmds.succ = bindMixin(VanillaSymbol, '\\succ ', '&#8827;');
LatexCmds.preceq = bindMixin(VanillaSymbol, '\\preceq ', '&#8828;');
LatexCmds.succeq = bindMixin(VanillaSymbol, '\\succeq ', '&#8829;');
LatexCmds.simeq = bindMixin(VanillaSymbol, '\\simeq ', '&#8771;');
LatexCmds.mid = bindMixin(VanillaSymbol, '\\mid ', '&#8739;');
LatexCmds.ll = bindMixin(VanillaSymbol, '\\ll ', '&#8810;');
LatexCmds.gg = bindMixin(VanillaSymbol, '\\gg ', '&#8811;');
LatexCmds.parallel = bindMixin(VanillaSymbol, '\\parallel ', '&#8741;');
LatexCmds.nparallel = bindMixin(VanillaSymbol, '\\nparallel ', '&#8742;');
LatexCmds.bowtie = bindMixin(VanillaSymbol, '\\bowtie ', '&#8904;');
LatexCmds.sqsubset = bindMixin(VanillaSymbol, '\\sqsubset ', '&#8847;');
LatexCmds.sqsupset = bindMixin(VanillaSymbol, '\\sqsupset ', '&#8848;');
LatexCmds.smile = bindMixin(VanillaSymbol, '\\smile ', '&#8995;');
LatexCmds.sqsubseteq = bindMixin(VanillaSymbol, '\\sqsubseteq ', '&#8849;');
LatexCmds.sqsupseteq = bindMixin(VanillaSymbol, '\\sqsupseteq ', '&#8850;');
LatexCmds.doteq = bindMixin(VanillaSymbol, '\\doteq ', '&#8784;');
LatexCmds.frown = bindMixin(VanillaSymbol, '\\frown ', '&#8994;');
LatexCmds.vdash = bindMixin(VanillaSymbol, '\\vdash ', '&#8870;');
LatexCmds.dashv = bindMixin(VanillaSymbol, '\\dashv ', '&#8867;');
LatexCmds.nless = bindMixin(VanillaSymbol, '\\nless ', '&#8814;');
LatexCmds.ngtr = bindMixin(VanillaSymbol, '\\ngtr ', '&#8815;');

// arrows
LatexCmds.longleftarrow = bindMixin(VanillaSymbol, '\\longleftarrow ', '&#8592;');
LatexCmds.longrightarrow = bindMixin(VanillaSymbol, '\\longrightarrow ', '&#8594;');
LatexCmds.Longleftarrow = bindMixin(VanillaSymbol, '\\Longleftarrow ', '&#8656;');
LatexCmds.Longrightarrow = bindMixin(VanillaSymbol, '\\Longrightarrow ', '&#8658;');
LatexCmds.longleftrightarrow = bindMixin(VanillaSymbol, '\\longleftrightarrow ', '&#8596;');
LatexCmds.updownarrow = bindMixin(VanillaSymbol, '\\updownarrow ', '&#8597;');
LatexCmds.Longleftrightarrow = bindMixin(VanillaSymbol, '\\Longleftrightarrow ', '&#8660;');
LatexCmds.Updownarrow = bindMixin(VanillaSymbol, '\\Updownarrow ', '&#8661;');
LatexCmds.mapsto = bindMixin(VanillaSymbol, '\\mapsto ', '&#8614;');
LatexCmds.nearrow = bindMixin(VanillaSymbol, '\\nearrow ', '&#8599;');
LatexCmds.hookleftarrow = bindMixin(VanillaSymbol, '\\hookleftarrow ', '&#8617;');
LatexCmds.hookrightarrow = bindMixin(VanillaSymbol, '\\hookrightarrow ', '&#8618;');
LatexCmds.searrow = bindMixin(VanillaSymbol, '\\searrow ', '&#8600;');
LatexCmds.leftharpoonup = bindMixin(VanillaSymbol, '\\leftharpoonup ', '&#8636;');
LatexCmds.rightharpoonup = bindMixin(VanillaSymbol, '\\rightharpoonup ', '&#8640;');
LatexCmds.swarrow = bindMixin(VanillaSymbol, '\\swarrow ', '&#8601;');
LatexCmds.leftharpoondown = bindMixin(VanillaSymbol, '\\leftharpoondown ', '&#8637;');
LatexCmds.rightharpoondown = bindMixin(VanillaSymbol, '\\rightharpoondown ', '&#8641;');
LatexCmds.nwarrow = bindMixin(VanillaSymbol, '\\nwarrow ', '&#8598;');

// Misc
LatexCmds.ldots = bindMixin(VanillaSymbol, '\\ldots ', '&#8230;');
LatexCmds.cdots = bindMixin(VanillaSymbol, '\\cdots ', '&#8943;');
LatexCmds.vdots = bindMixin(VanillaSymbol, '\\vdots ', '&#8942;');
LatexCmds.ddots = bindMixin(VanillaSymbol, '\\ddots ', '&#8945;');
LatexCmds.surd = bindMixin(VanillaSymbol, '\\surd ', '&#8730;');
LatexCmds.triangle = bindMixin(VanillaSymbol, '\\triangle ', '&#9651;');
LatexCmds.ell = bindMixin(VanillaSymbol, '\\ell ', '&#8467;');
LatexCmds.top = bindMixin(VanillaSymbol, '\\top ', '&#8868;');
LatexCmds.flat = bindMixin(VanillaSymbol, '\\flat ', '&#9837;');
LatexCmds.natural = bindMixin(VanillaSymbol, '\\natural ', '&#9838;');
LatexCmds.sharp = bindMixin(VanillaSymbol, '\\sharp ', '&#9839;');
LatexCmds.wp = bindMixin(VanillaSymbol, '\\wp ', '&#8472;');
LatexCmds.bot = bindMixin(VanillaSymbol, '\\bot ', '&#8869;');
LatexCmds.clubsuit = bindMixin(VanillaSymbol, '\\clubsuit ', '&#9827;');
LatexCmds.diamondsuit = bindMixin(VanillaSymbol, '\\diamondsuit ', '&#9826;');
LatexCmds.heartsuit = bindMixin(VanillaSymbol, '\\heartsuit ', '&#9825;');
LatexCmds.spadesuit = bindMixin(VanillaSymbol, '\\spadesuit ', '&#9824;');
// not real LaTex command see https://github.com/mathquill/mathquill/pull/552 for more details
LatexCmds.parallelogram = bindMixin(VanillaSymbol, '\\parallelogram ', '&#9649;');
LatexCmds.square = bindMixin(VanillaSymbol, '\\square ', '&#11036;');

// variable-sized
LatexCmds.oint = bindMixin(VanillaSymbol, '\\oint ', '&#8750;');
LatexCmds.bigcap = bindMixin(VanillaSymbol, '\\bigcap ', '&#8745;');
LatexCmds.bigcup = bindMixin(VanillaSymbol, '\\bigcup ', '&#8746;');
LatexCmds.bigsqcup = bindMixin(VanillaSymbol, '\\bigsqcup ', '&#8852;');
LatexCmds.bigvee = bindMixin(VanillaSymbol, '\\bigvee ', '&#8744;');
LatexCmds.bigwedge = bindMixin(VanillaSymbol, '\\bigwedge ', '&#8743;');
LatexCmds.bigodot = bindMixin(VanillaSymbol, '\\bigodot ', '&#8857;');
LatexCmds.bigotimes = bindMixin(VanillaSymbol, '\\bigotimes ', '&#8855;');
LatexCmds.bigoplus = bindMixin(VanillaSymbol, '\\bigoplus ', '&#8853;');
LatexCmds.biguplus = bindMixin(VanillaSymbol, '\\biguplus ', '&#8846;');

// delimiters
LatexCmds.lfloor = bindMixin(VanillaSymbol, '\\lfloor ', '&#8970;');
LatexCmds.rfloor = bindMixin(VanillaSymbol, '\\rfloor ', '&#8971;');
LatexCmds.lceil = bindMixin(VanillaSymbol, '\\lceil ', '&#8968;');
LatexCmds.rceil = bindMixin(VanillaSymbol, '\\rceil ', '&#8969;');
LatexCmds.opencurlybrace = LatexCmds.lbrace = bindMixin(VanillaSymbol, '\\lbrace ', '{');
LatexCmds.closecurlybrace = LatexCmds.rbrace = bindMixin(VanillaSymbol, '\\rbrace ', '}');
LatexCmds.lbrack = bindMixin(VanillaSymbol, '[');
LatexCmds.rbrack = bindMixin(VanillaSymbol, ']');

// various symbols
LatexCmds.slash = bindMixin(VanillaSymbol, '/');
LatexCmds.vert = bindMixin(VanillaSymbol, '|');
LatexCmds.perp = LatexCmds.perpendicular = bindMixin(VanillaSymbol, '\\perp ', '&perp;');
LatexCmds.nabla = LatexCmds.del = bindMixin(VanillaSymbol, '\\nabla ', '&nabla;');
LatexCmds.hbar = bindMixin(VanillaSymbol, '\\hbar ', '&#8463;');

// FIXME: \AA is not valid LaTeX in math mode.  Neither is \text\AA (which is what this was before).  Furthermore,
// \text\AA does not parse correctly.  Valid LaTeX in math mode without any packages would be \textup{~\AA}, but that
// also does not parse correctly.
LatexCmds.AA = LatexCmds.Angstrom = LatexCmds.angstrom =
	bindMixin(VanillaSymbol, '\\AA ', '&#8491;', '\u00C5');

LatexCmds.ring = LatexCmds.circ = LatexCmds.circle =
	bindMixin(VanillaSymbol, '\\circ ', '&#8728;');

LatexCmds.bull = LatexCmds.bullet = bindMixin(VanillaSymbol, '\\bullet ', '&bull;');

LatexCmds.setminus = LatexCmds.smallsetminus =
	bindMixin(VanillaSymbol, '\\setminus ', '&#8726;');

LatexCmds.not = LatexCmds['\u00ac'] = LatexCmds.neg = bindMixin(VanillaSymbol, '\\neg ', '&not;');

LatexCmds['\u2026'] = LatexCmds.dots = LatexCmds.ellip = LatexCmds.hellip =
	LatexCmds.ellipsis = LatexCmds.hellipsis =
	bindMixin(VanillaSymbol, '\\dots ', '&hellip;');

LatexCmds.converges =
	LatexCmds.darr = LatexCmds.dnarr = LatexCmds.dnarrow = LatexCmds.downarrow =
	bindMixin(VanillaSymbol, '\\downarrow ', '&darr;');

LatexCmds.dArr = LatexCmds.dnArr = LatexCmds.dnArrow = LatexCmds.Downarrow =
	bindMixin(VanillaSymbol, '\\Downarrow ', '&dArr;');

LatexCmds.diverges = LatexCmds.uarr = LatexCmds.uparrow =
	bindMixin(VanillaSymbol, '\\uparrow ', '&uarr;');

LatexCmds.uArr = LatexCmds.Uparrow = bindMixin(VanillaSymbol, '\\Uparrow ', '&uArr;');

LatexCmds.to = bindMixin(BinaryOperator, '\\to ', '&rarr;');

LatexCmds.rarr = LatexCmds.rightarrow = bindMixin(VanillaSymbol, '\\rightarrow ', '&rarr;');

LatexCmds.implies = bindMixin(BinaryOperator, '\\Rightarrow ', '&rArr;');

LatexCmds.rArr = LatexCmds.Rightarrow = bindMixin(VanillaSymbol, '\\Rightarrow ', '&rArr;');

LatexCmds.gets = bindMixin(BinaryOperator, '\\gets ', '&larr;');

LatexCmds.larr = LatexCmds.leftarrow = bindMixin(VanillaSymbol, '\\leftarrow ', '&larr;');

LatexCmds.impliedby = bindMixin(BinaryOperator, '\\Leftarrow ', '&lArr;');

LatexCmds.lArr = LatexCmds.Leftarrow = bindMixin(VanillaSymbol, '\\Leftarrow ', '&lArr;');

LatexCmds.harr = LatexCmds.lrarr = LatexCmds.leftrightarrow =
	bindMixin(VanillaSymbol, '\\leftrightarrow ', '&harr;');

LatexCmds.iff = bindMixin(BinaryOperator, '\\Leftrightarrow ', '&hArr;');

LatexCmds.hArr = LatexCmds.lrArr = LatexCmds.Leftrightarrow =
	bindMixin(VanillaSymbol, '\\Leftrightarrow ', '&hArr;');

LatexCmds.Re = LatexCmds.Real = LatexCmds.real = bindMixin(VanillaSymbol, '\\Re ', '&real;');

LatexCmds.Im = LatexCmds.imag =
	LatexCmds.image = LatexCmds.imagin = LatexCmds.imaginary = LatexCmds.Imaginary =
	bindMixin(VanillaSymbol, '\\Im ', '&image;');

LatexCmds.part = LatexCmds.partial = bindMixin(VanillaSymbol, '\\partial ', '&part;');

LatexCmds.inf = LatexCmds.infty = LatexCmds.infin = LatexCmds.infinity =
	bindMixin(VanillaSymbol, '\\infty ', '&infin;', 'inf');

LatexCmds.pounds = bindMixin(VanillaSymbol, '\\pounds ', '&pound;');

LatexCmds.alef = LatexCmds.alefsym = LatexCmds.aleph = LatexCmds.alephsym =
	bindMixin(VanillaSymbol, '\\aleph ', '&alefsym;');

LatexCmds.xist =
	LatexCmds.xists = LatexCmds.exist = LatexCmds.exists =
	bindMixin(VanillaSymbol, '\\exists ', '&exist;');

LatexCmds.nexists = LatexCmds.nexist =
	bindMixin(VanillaSymbol, '\\nexists ', '&#8708;');

LatexCmds.and = LatexCmds.land = LatexCmds.wedge =
	bindMixin(BinaryOperator, '\\wedge ', '&and;');

LatexCmds.or = LatexCmds.lor = LatexCmds.vee = bindMixin(BinaryOperator, '\\vee ', '&or;');

LatexCmds.o = LatexCmds.O =
	LatexCmds.empty = LatexCmds.emptyset =
	LatexCmds.oslash = LatexCmds.Oslash =
	LatexCmds.nothing = LatexCmds.varnothing =
	bindMixin(BinaryOperator, '\\varnothing ', '&empty;');

LatexCmds.U = LatexCmds.cup = LatexCmds.union =
	bindMixin(BinaryOperator, '\\cup ', '&cup;', 'U');

LatexCmds.cap = LatexCmds.intersect = LatexCmds.intersection =
	bindMixin(BinaryOperator, '\\cap ', '&cap;');

// FIXME: the correct LaTeX would be ^\circ but we can't parse that
LatexCmds.deg = LatexCmds.degree = class degree extends VanillaSymbol {
	constructor() {
		super('\\degree ', '&deg;');
	}

	text() {
		const rightText = this[R]?.text();
		return `\u00B0${rightText && /^[^FCK]$/.test(rightText) ? ' ' : ''}`;
	}
};

LatexCmds.ang = LatexCmds.angle = bindMixin(VanillaSymbol, '\\angle ', '&ang;');
LatexCmds.measuredangle = bindMixin(VanillaSymbol, '\\measuredangle ', '&#8737;');
