// Fragment base classes of edit tree-related objects

import { type Direction, iterator, prayWellFormed } from 'src/constants';
import { VNode } from 'tree/vNode';
import { type Ends, TNode } from 'tree/node';

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
	each = iterator((yield_: (node: TNode) => TNode | boolean | undefined) => {
		let el = this.ends.left;
		if (!el) return this;

		for (; el !== this.ends.right?.right; el = el.right) {
			if (!el) throw new Error('each unable to continue right in Fragment');
			if (yield_(el) === false) break;
		}

		return this;
	});

	constructor(withDir?: TNode, oppDir?: TNode, dir: Direction = 'left') {
		if (!withDir !== !oppDir) throw new Error('no half-empty fragments');
		if (!withDir) return;

		if (!(withDir instanceof TNode)) throw new Error('withDir must be passed to Fragment');
		if (!(oppDir instanceof TNode)) throw new Error('oppDir must be passed to Fragment');
		if (withDir.parent !== oppDir.parent) throw new Error('withDir and oppDir must have the same parent');

		if (dir === 'left') {
			this.ends.left = withDir;
			this.ends.right = oppDir;
		} else {
			this.ends.left = oppDir;
			this.ends.right = withDir;
		}

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
		return dir === 'left' ? this.adopt(parent, withDir, oppDir) : this.adopt(parent, oppDir, withDir);
	}

	adopt(parent: TNode, leftward?: TNode, rightward?: TNode) {
		prayWellFormed(parent, leftward, rightward);

		this.disowned = false;

		const leftEnd = this.ends.left;
		if (!leftEnd) return this;

		const rightEnd = this.ends.right;

		if (leftward) {
			// NB: this is handled in the ::each() block
			// leftward.right = leftEnd
		} else {
			parent.ends.left = leftEnd;
		}

		if (rightward) {
			rightward.left = rightEnd;
		} else {
			parent.ends.right = rightEnd;
		}

		if (this.ends.right) this.ends.right.right = rightward;

		this.each((el: TNode) => {
			el.left = leftward;
			el.parent = parent;
			if (leftward) leftward.right = el;

			leftward = el;
			return true;
		});

		return this;
	}

	disown() {
		const leftEnd = this.ends.left;

		// guard for empty and already-disowned fragments
		if (!leftEnd || this.disowned) return this;

		this.disowned = true;

		const rightEnd = this.ends.right;
		const parent = leftEnd.parent;

		if (!parent) throw new Error('a parent must always present');
		prayWellFormed(parent, leftEnd.left, leftEnd);
		prayWellFormed(parent, rightEnd, rightEnd?.right);

		if (leftEnd.left) {
			leftEnd.left.right = rightEnd?.right;
		} else {
			parent.ends.left = rightEnd?.right;
		}

		if (rightEnd?.right) {
			rightEnd.right.left = leftEnd.left;
		} else {
			parent.ends.right = leftEnd.left;
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
			return true;
		});
		return ret;
	}
}
