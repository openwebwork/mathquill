import type { TNode } from 'tree/node';
import type { MathCommand } from 'commands/mathElements';

export type Direction = 'left' | 'right';

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
	'\\lVert ': '\\rVert ',
	'\\rVert ': '\\lVert '
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
