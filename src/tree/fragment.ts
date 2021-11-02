// Fragment base classes of edit tree-related objects

import type JQuery from 'jquery';
import type { Direction } from 'src/constants';
import { jQuery, L, R, iterator, pray, prayWellFormed } from 'src/constants';
import type { Ends } from 'tree/node';
import { Node } from 'tree/node';

// An entity outside the virtual tree with one-way pointers (so it's only a
// "view" of part of the tree, not an actual node/entity in the tree) that
// delimits a doubly-linked list of sibling nodes.
// It's like a fanfic love-child between HTML DOM DocumentFragment and the Range
// classes: like DocumentFragment, its contents must be sibling nodes
// (unlike Range, whose contents are arbitrary contiguous pieces of subtrees),
// but like Range, it has only one-way pointers to its contents, its contents
// have no reference to it and in fact may still be in the visible tree (unlike
// DocumentFragment, whose contents must be detached from the visible tree
// and have their 'parent' pointers set to the DocumentFragment).
export class Fragment {
	jQ: JQuery = jQuery();
	ends: Ends = {};
	disowned?: boolean;
	each = iterator((yield_: (node?: Node) => Node | boolean) => {
		let el = this.ends[L];
		if (!el) return this;

		for (; el !== this.ends[R]?.[R]; el = el?.[R]) {
			if (yield_(el) === false) break;
		}

		return this;
	});

	constructor(withDir?: Node, oppDir?: Node, dir: Direction = L) {
		pray('no half-empty fragments', !withDir === !oppDir);

		if (!withDir) return;

		pray('withDir is passed to Fragment', withDir instanceof Node);
		pray('oppDir is passed to Fragment', oppDir instanceof Node);
		pray('withDir and oppDir have the same parent',
			withDir.parent === oppDir?.parent);

		this.ends[dir] = withDir;
		this.ends[dir === L ? R : L] = oppDir;

		// To build the jquery collection for a fragment, accumulate elements
		// into an array and then call jQ.add once on the result. jQ.add sorts the
		// collection according to document order each time it is called, so
		// building a collection by folding jQ.add directly takes more than
		// quadratic time in the number of elements.
		//
		// https://github.com/jquery/jquery/blob/2.1.4/src/traversing.js#L112
		const accum = this.fold<Array<HTMLElement>>([], (accum, el) => {
			accum.push(...el.jQ.get());
			return accum;
		});

		this.jQ = this.jQ.add(accum);
	}

	// like Cursor::withDirInsertAt(dir, parent, withDir, oppDir)
	withDirAdopt(dir: Direction, parent: Node, withDir?: Node, oppDir?: Node) {
		return (dir === L ? this.adopt(parent, withDir, oppDir)
			: this.adopt(parent, oppDir, withDir));
	}

	adopt(parent: Node, leftward?: Node, rightward?: Node) {
		prayWellFormed(parent, leftward, rightward);

		this.disowned = false;

		const leftEnd = this.ends[L];
		if (!leftEnd) return this;

		const rightEnd = this.ends[R];

		if (leftward) {
			// NB: this is handled in the ::each() block
			// leftward[R] = leftEnd
		} else {
			parent.ends[L] = leftEnd;
		}

		if (rightward) {
			rightward[L] = rightEnd;
		} else {
			parent.ends[R] = rightEnd;
		}

		(this.ends[R] as Node)[R] = rightward;

		this.each((el: Node) => {
			el[L] = leftward;
			el.parent = parent;
			if (leftward) leftward[R] = el;

			leftward = el;
		});

		return this;
	}

	disown() {
		const leftEnd = this.ends[L];

		// guard for empty and already-disowned fragments
		if (!leftEnd || this.disowned) return this;

		this.disowned = true;

		const rightEnd = this.ends[R];
		const parent = leftEnd.parent as Node;

		prayWellFormed(parent, leftEnd[L], leftEnd);
		prayWellFormed(parent, rightEnd, rightEnd?.[R]);

		if (leftEnd[L]) {
			(leftEnd[L] as Node)[R] = rightEnd?.[R];
		} else {
			parent.ends[L] = rightEnd?.[R];
		}

		if (rightEnd?.[R]) {
			(rightEnd[R] as Node)[L] = leftEnd[L];
		} else {
			parent.ends[R] = leftEnd[L];
		}

		return this;
	}

	remove() {
		this.jQ.remove();
		this.each('postOrder', 'dispose');
		return this.disown();
	}

	fold<T>(fold: T, fn: (fold: T, child: Node) => T): T {
		let ret = fold;
		this.each((el: Node) => ret = fn(ret, el));
		return ret;
	}
}
