// MathQuill {VERSION}, by Han, Jeanine, and Mary
// http://mathquill.com | maintainers@mathquill.com
//
// This Source Code Form is subject to the terms of the
// Mozilla Public License, v. 2.0. If a copy of the MPL
// was not distributed with this file, You can obtain
// one at http://mozilla.org/MPL/2.0/.

(() => {

	const jQuery = window.jQuery,
		mqCmdId = 'mathquill-command-id',
		mqBlockId = 'mathquill-block-id',

		// L = 'left', R = 'right'
		// The contract is that they can be used as object properties and -L === R, and -R === L.
		L = -1, R = 1;

	if (!jQuery) throw 'MathQuill requires jQuery 1.9+ to be loaded first';

	// Tiny extension of jQuery adding directionalized DOM manipulation methods.
	jQuery.fn.extend({
		insDirOf: function(dir, el) {
			return dir === L ?
				this.insertBefore(el.first()) : this.insertAfter(el.last());
		},
		insAtDirEnd: function(dir, el) {
			return dir === L ? this.prependTo(el) : this.appendTo(el);
		}
	});

	function noop() {}

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
	const iterator = (generator) => {
		return (fn, ...args) => {
			if (typeof fn !== 'function') {
				fn = ((method) =>
					(obj, ...args) => {
						if (method in obj) return obj[method](...args);
					}
				)(fn);
			}
			const yield_ = (obj) => fn(obj, ...args);
			return generator(yield_);
		};
	}

	// sugar to make defining lots of commands easier.
	const bindMixin = (cons, ...args) => class extends cons { constructor() { super(...args); } }

	// a development-only debug method.  This definition and all
	// calls to `pray` will be stripped from the minified
	// build of mathquill.
	//
	// This function must be called by name to be removed
	// at compile time.  Do not define another function
	// with the same name, and only call this function by
	// name.
	const pray = (message, cond) => { if (!cond) throw new Error(`prayer failed: ${message}`); }

	const prayDirection = (dir) => { pray('a direction was passed', dir === L || dir === R); }
