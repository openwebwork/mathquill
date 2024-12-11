import type { TNode } from 'tree/node';
import type { MathCommand } from 'commands/mathElements';

export type Direction = 'left' | 'right';

export const otherDir = (dir?: Direction): Direction => (dir === 'left' ? 'right' : 'left');

export const mqCmdId = 'data-mathquill-command-id',
	mqBlockId = 'data-mathquill-block-id';

export const noop = () => {
	/* do nothing */
};

// A utility higher-order function that creates "implicit iterators"
// from "generators": given a function that takes in a sole argument,
// a "yield_" function, that calls "yield_" repeatedly with an object as
// a sole argument (presumably objects being iterated over), returns
// a function that calls it's first argument on each of those objects
// (if the first argument is a function, it is called repeatedly with
// each object as the first argument, otherwise it is stringified and
// the method of that name is called on each object (if such a method
// exists)), passing along all additional arguments:
//   const a = [
//     { method: function(list) { list.push(1); } },
//     { method: function(list) { list.push(2); } },
//     { method: function(list) { list.push(3); } }
//   ];
//   a.each = iterator(function(yield_) {
//     for (const i in this) yield_(this[i]);
//   });
//   const list = [];
//   a.each('method', list);
//   list; // => [1, 2, 3]
//  Note that the for-in loop will yield 'each', but 'each' maps to
//  the function object created by iterator() which does not have a
//  .method() method, so that just fails silently.
type CallableKeyOf<S, T> = keyof {
	[P in keyof S as S[P] extends (arg1?: unknown, arg2?: unknown) => T ? P : never]: unknown;
};

export const iterator = <R extends object, S, T>(generator: (yield_: (obj: R) => S | undefined) => T) => {
	return (fn: ((obj: R) => S) | string, ...args: unknown[]) => {
		const yield_ =
			typeof fn === 'function'
				? fn
				: (obj: R) => {
						if (fn in obj)
							return (obj[fn as CallableKeyOf<R, S>] as unknown as (...args: unknown[]) => S)(...args);
					};
		return generator(yield_);
	};
};

export type Constructor<T = object> = new (...args: any[]) => T;

// sugar to make defining lots of commands easier.
export const bindMixin = <TBase extends Constructor<MathCommand>>(
	Base: TBase,
	...args: (string | boolean | number | object)[]
) =>
	class extends Base {
		constructor(..._args: any[]) {
			super(...args);
		}
	};

export const prayWellFormed = (parent?: TNode, leftward?: TNode, rightward?: TNode) => {
	if (!parent) throw new Error('a parent must be present');

	// Either leftward is empty and `rightward` is the left end child (possibly empty)
	// or leftward is there and leftward's .right and .parent are properly set up.
	if (
		(!leftward && parent.ends.left !== rightward) ||
		(leftward && (leftward.right !== rightward || leftward.parent !== parent))
	)
		throw new Error('leftward is not properly set up');

	// Either rightward is empty and `leftward` is the right end child (possibly empty)
	// or rightward is there and rightward's .left and .parent are properly set up.
	if (
		(!rightward && parent.ends.right !== leftward) ||
		(rightward && (rightward.left !== leftward || rightward.parent !== parent))
	)
		throw new Error('rightward is not properly set up');
};

// Registry of LaTeX commands and commands created when typing a single character.
// (Commands are all subclasses of tree/TNode.)
export const LatexCmds: Record<string, Constructor<TNode>> = {},
	CharCmds: Record<string, Constructor<TNode>> = {};

export const OPP_BRACKS: Readonly<Record<string, string>> = {
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
	'&#8741;': '&#8741;',
	'\\lVert ': '\\rVert ',
	'\\rVert ': '\\lVert '
};

export const BRACKET_NAMES: Readonly<Record<string, string>> = {
	'&lang;': 'angle-bracket',
	'&rang;': 'angle-bracket',
	'|': 'pipe',
	'(': 'parenthesis',
	')': 'parenthesis',
	'[': 'bracket',
	']': 'bracket',
	'{': 'brace',
	'}': 'brace'
};

export interface EmbedOptions {
	text?: () => string;
	htmlString?: string;
	latex?: () => string;
}
export const EMBEDS: Record<string, (data: string) => EmbedOptions> = {};

// The set of operator names like \arg, \det, etc that are built-into LaTeX,
// see Section 3.15 of the Short Math Guide: http://tug.ctan.org/info/short-math-guide/short-math-guide.pdf
// MathQuill auto-unitalicizes some operator names not in that set, like 'hcf',
// which must be exported as \operatorname{hcf}.
// Note: over/under line/arrow \lim variants like \varlimsup are not supported.
// Note that this no longer includes ln, log, exp, or any of the trig functions.
// Those are now latex commands that are implemented by the MathFunction class.
export const BuiltInOpNames: Record<string, 1> = {};

// Standard operators
for (const op of [
	'arg',
	'det',
	'dim',
	'gcd',
	'hom',
	'ker',
	'lg',
	'lim',
	'max',
	'min',
	'sup',
	'limsup',
	'liminf',
	'injlim',
	'projlim',
	'Pr'
]) {
	BuiltInOpNames[op] = 1;
}

export const TwoWordOpNames = { limsup: 1, liminf: 1, projlim: 1, injlim: 1 };

export const SVG_SYMBOLS: Readonly<Record<string, { width: string; html: string }>> = {
	sqrt: {
		width: '',
		html:
			'<svg preserveAspectRatio="none" viewBox="0 0 32 54">' +
			'<path d="M0 33 L7 27 L12.5 47 L13 47 L30 0 L32 0 L13 54 L11 54 L4.5 31 L0 33"></path>' +
			'</svg>'
	},
	'|': {
		width: '0.4em',
		html:
			'<svg preserveAspectRatio="none" viewBox="0 0 10 54">' +
			'<path d="M4.4 0 L4.4 54 L5.6 54 L5.6 0"></path>' +
			'</svg>'
	},
	'[': {
		width: '0.55em',
		html:
			'<svg preserveAspectRatio="none" viewBox="0 0 11 24">' +
			'<path d="M8 0 L3 0 L3 24 L8 24 L8 23 L4 23 L4 1 L8 1"></path>' +
			'</svg>'
	},
	']': {
		width: '0.55em',
		html:
			'<svg preserveAspectRatio="none" viewBox="0 0 11 24">' +
			'<path d="M3 0 L8 0 L8 24 L3 24 L3 23 L7 23 L7 1 L3 1"></path>' +
			'</svg>'
	},
	'(': {
		width: '0.55em',
		html:
			'<svg preserveAspectRatio="none" viewBox="3 0 106 186">' +
			'<path d="M85 0 A61 101 0 0 0 85 186 L75 186 A75 101 0 0 1 75 0"></path>' +
			'</svg>'
	},
	')': {
		width: '.55em',
		html:
			'<svg preserveAspectRatio="none" viewBox="3 0 106 186">' +
			'<path d="M24 0 A61 101 0 0 1 24 186 L34 186 A75 101 0 0 0 34 0"></path>' +
			'</svg>'
	},
	'{': {
		width: '0.7em',
		html:
			'<svg preserveAspectRatio="none" viewBox="10 0 210 350">' +
			'<path d="' +
			'M170 0 L170 6 A47 52 0 0 0 123 60 L123 127 A35 48 0 0 1 88 175 A35 48 0 0 1 123 223 L123 290 A47 52 ' +
			'0 0 0 170 344 L170 350 L160 350 A58 49 0 0 1 102 301 L103 220 A45 40 0 0 0 58 180 L58 170 A45 40 ' +
			'0 0 0 103 130 L103 49 A58 49 0 0 1 161 0' +
			'"></path>' +
			'</svg>'
	},
	'}': {
		width: '0.7em',
		html:
			'<svg preserveAspectRatio="none" viewBox="10 0 210 350">' +
			'<path d="' +
			'M60 0 L60 6 A47 52 0 0 1 107 60 L107 127 A35 48 0 0 0 142 175 A35 48 0 0 0 107 223 L107 290 A47 52 ' +
			'0 0 1 60 344 L60 350 L70 350 A58 49 0 0 0 128 301 L127 220 A45 40 0 0 1 172 180 L172 170 A45 40 ' +
			'0 0 1 127 130 L127 49 A58 49 0 0 0 70 0' +
			'"></path>' +
			'</svg>'
	},
	'&#8741;': {
		width: '0.7em',
		html:
			'<svg preserveAspectRatio="none" viewBox="0 0 10 54">' +
			'<path d="M3.2 0 L3.2 54 L4 54 L4 0 M6.8 0 L6.8 54 L6 54 L6 0"></path>' +
			'</svg>'
	},
	'&lang;': {
		width: '0.55em',
		html:
			'<svg preserveAspectRatio="none" viewBox="0 0 10 54">' +
			'<path d="M6.8 0 L3.2 27 L6.8 54 L7.8 54 L4.2 27 L7.8 0"></path>' +
			'</svg>'
	},
	'&rang;': {
		width: '0.55em',
		html:
			'<svg preserveAspectRatio="none" viewBox="0 0 10 54">' +
			'<path d="M3.2 0 L6.8 27 L3.2 54 L2.2 54 L5.8 27 L2.2 0"></path>' +
			'</svg>'
	}
};
