/* @license
 * MathQuill, by Han, Jeanine, and Mary
 * http://mathquill.com | maintainers@mathquill.com
 *
 * Rewritten for the purposes of WeBWorK.
 * https://github.com/openwebwork
 *
 * This Source Code Form is subject to the terms of the
 * Mozilla Public License, v. 2.0. If a copy of the MPL
 * was not distributed with this file, You can obtain
 * one at http://mozilla.org/MPL/2.0/.
 */

import type JQueryStatic from 'jquery';
import type JQuery from 'jquery';
import type { Node } from 'tree/node';

declare global {
	interface JQuery {
		insDirOf(dir: Direction, el: JQuery): JQuery;
		insAtDirEnd(dir: Direction, el: JQuery): JQuery;
	}

	interface Window {
		jQuery: JQueryStatic;
	}
}

export const enum Direction {
	L = -1,
	R = 1
}

export const jQuery = window.jQuery,
	mqCmdId = 'mathquill-command-id',
	mqBlockId = 'mathquill-block-id',

	// L = 'left', R = 'right'
	// The contract is that they can be used as object properties and -L === R, and -R === L.
	L = Direction.L, R = Direction.R;

if (!jQuery) throw 'MathQuill requires jQuery 1.9+ to be loaded first';

// Tiny extension of jQuery adding directionalized DOM manipulation methods.
jQuery.fn.extend({
	insDirOf: function(this: JQuery, dir: Direction, el: JQuery) {
		return dir === L ?
			this.insertBefore(el.first()) : this.insertAfter(el.last());
	},
	insAtDirEnd: function(this: JQuery, dir: Direction, el: JQuery) {
		return dir === L ? this.prependTo(el) : this.appendTo(el);
	}
});

export function noop() {}

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
export const iterator = (generator: any) => {
	return (fn: any, arg1?: any, arg2?: any) => {
		const yield_ = typeof fn === 'function'
			? (obj: Node) => fn(obj)
			: (obj: any) => { if (fn in obj) return obj[fn](arg1, arg2); };
		return generator(yield_);
	};
};

export type Constructor<T = {}> = new (...args: any[]) => T;

// sugar to make defining lots of commands easier.
export const bindMixin = (cons: any, ...args: any[]) => class extends cons { constructor() { super(...args); } };

// a development-only debug method.  This definition and all
// calls to `pray` will be stripped from the minified
// build of mathquill.
//
// This function must be called by name to be removed
// at compile time.  Do not define another function
// with the same name, and only call this function by
// name.
export const pray = (message: string, cond: boolean = false) => {
	if (!cond) throw new Error(`prayer failed: ${message}`);
};

export const prayDirection = (dir: Direction) => { pray('a direction was passed', dir === L || dir === R); };

export const prayWellFormed = (parent?: Node, leftward?: Node, rightward?: Node) => {
	pray('a parent is always present', !!parent);
	pray('leftward is properly set up', (() => {
		// either it's empty and `rightward` is the left end child (possibly empty)
		if (!leftward) return parent?.ends[L] === rightward;

		// or it's there and its [R] and .parent are properly set up
		return leftward[R] === rightward && leftward.parent === parent;
	})());

	pray('rightward is properly set up', (() => {
		// either it's empty and `leftward` is the right end child (possibly empty)
		if (!rightward) return parent?.ends[R] === leftward;

		// or it's there and its [L] and .parent are properly set up
		return rightward[L] === leftward && rightward.parent === parent;
	})());
};

// Registry of LaTeX commands and commands created when typing a single character.
// (Commands are all subclasses of tree/Node.)
export const LatexCmds = {}, CharCmds = {};

export const OPP_BRACKS = {
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

export const EMBEDS = {};

// The set of operator names like \sin, \cos, etc that are built-into LaTeX,
// see Section 3.17 of the Short Math Guide: http://tinyurl.com/jm9okjc
// MathQuill auto-unitalicizes some operator names not in that set, like 'hcf'
// and 'arsinh', which must be exported as \operatorname{hcf} and
// \operatorname{arsinh}. Note: over/under line/arrow \lim variants like
// \varlimsup are not supported
export const BuiltInOpNames: { [key: string]: 1 } = {};

// Standard operators
for (const op of [
	'arg', 'deg', 'det', 'dim', 'exp', 'gcd', 'hom', 'ker', 'lg', 'lim', 'ln',
	'log', 'max', 'min', 'sup', 'limsup', 'liminf', 'injlim', 'projlim', 'Pr'
]) { BuiltInOpNames[op] = 1; }

// Trig operators
// why coth but not sech and csch, LaTeX?
for (const trig of [
	'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
	'sinh', 'cosh', 'tanh', 'sec', 'csc', 'cot', 'coth'
]) { BuiltInOpNames[trig] = 1; }

export const TwoWordOpNames = { limsup: 1, liminf: 1, projlim: 1, injlim: 1 };
