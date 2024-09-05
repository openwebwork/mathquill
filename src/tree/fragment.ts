// Fragment base classes of edit tree-related objects

import type { Direction } from 'src/constants';
import { L, R, iterator, pray, prayWellFormed } from 'src/constants';
import type { Ends } from 'tree/node';
import { VNode } from 'tree/vNode';
import { TNode } from 'tree/node';

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
	elements: VNode = new VNode();
	ends: Ends = {};
	disowned?: boolean;
	each = iterator((yield_: (node: TNode) => TNode | boolean | void) => {
		let el = this.ends[L];
		if (!el) return this;

		for (; el !== this.ends[R]?.[R]; el = el?.[R]) {
			if (yield_(el!) === false) break;
		}

		return this;
	});

	constructor(withDir?: TNode, oppDir?: TNode, dir: Direction = L) {
		pray('no half-empty fragments', !withDir === !oppDir);

		if (!withDir) return;

		pray('withDir is passed to Fragment', withDir instanceof TNode);
		pray('oppDir is passed to Fragment', oppDir instanceof TNode);
		pray('withDir and oppDir have the same parent', withDir.parent === oppDir?.parent);

		this.ends[dir] = withDir;
		this.ends[dir === L ? R : L] = oppDir;

		// To build the html collection for a fragment, accumulate elements into an array and then call elements.add
		// once on the result. elements.add sorts the collection according to document order each time it is called, so
		// building a collection by folding elements.add directly takes more than quadratic time in the number of
		// elements.
		const accum = this.fold<Node[]>([], (accum, el) => {
			accum.push(...el.elements.contents);
			return accum;
		});

		this.elements.add(accum);
	}

	// like Cursor::withDirInsertAt(dir, parent, withDir, oppDir)
	withDirAdopt(dir: Direction, parent: TNode, withDir?: TNode, oppDir?: TNode) {
		return dir === L ? this.adopt(parent, withDir, oppDir) : this.adopt(parent, oppDir, withDir);
	}

	adopt(parent: TNode, leftward?: TNode, rightward?: TNode) {
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

		this.ends[R]![R] = rightward;

		this.each((el: TNode) => {
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
		const parent = leftEnd.parent!;

		prayWellFormed(parent, leftEnd[L], leftEnd);
		prayWellFormed(parent, rightEnd, rightEnd?.[R]);

		if (leftEnd[L]) {
			leftEnd[L][R] = rightEnd?.[R];
		} else {
			parent.ends[L] = rightEnd?.[R];
		}

		if (rightEnd?.[R]) {
			rightEnd[R][L] = leftEnd[L];
		} else {
			parent.ends[R] = leftEnd[L];
		}

		return this;
	}

	remove() {
		this.elements.remove();
		this.each('postOrder', 'dispose');
		return this.disown();
	}

	fold<T>(fold: T, fn: (fold: T, child: TNode) => T): T {
		let ret = fold;
		this.each((el: TNode) => {
			ret = fn(ret, el);
		});
		return ret;
	}
}
