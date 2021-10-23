// Cursor "singleton" class
// The main thing that manipulates the Math DOM. Makes sure to manipulate the HTML DOM to match.
// Sort of a singleton, since there should only be one per editable math textbox, but any one HTML document can contain
// many such textboxes, so any one JS environment could actually contain many instances.
// A fake cursor in the fake textbox that the math is rendered in.

import type { Direction } from 'src/constants';
import { jQuery, L, R, pray, prayDirection } from 'src/constants';
import { Point } from 'tree/point';
import type { Node } from 'tree/node';
import type { Selection } from 'src/selection';
import { MathBlock } from 'commands/mathBlock';

export class Cursor extends Point {
	options: any;
	jQ: JQuery;
	upDownCache: { [key: number]: Point } = {};
	intervalId: ReturnType<typeof setInterval> | undefined = undefined;
	selection?: Selection;
	anticursor?: Point;
	selectionChanged?: (() => void);

	//closured for setInterval
	blink = () => this.jQ.toggleClass('mq-blink');

	constructor(initParent: Node, options: any) {
		super(initParent);
		this.options = options;
		this.jQ = jQuery('<span class="mq-cursor">&#8203;</span>');
	}

	show() {
		this.jQ.removeClass('mq-blink');
		this.jQ.show();
		if (this.intervalId) //already was shown, just restart interval
			clearInterval(this.intervalId);
		else { //was hidden and detached, insert this.jQ back into HTML DOM
			if (this[R]) {
				if (this.selection && (this.selection.ends[L] as Node)[L] === this[L])
					this.jQ.insertBefore(this.selection.jQ);
				else
					this.jQ.insertBefore((this[R] as Node).jQ.first());
			} else
				this.jQ.appendTo((this.parent as Node).jQ);
			(this.parent as Node).focus();
		}
		this.intervalId = setInterval(this.blink, 500);
		return this;
	}

	hide() {
		if (this.intervalId)
			clearInterval(this.intervalId);
		delete this.intervalId;
		this.jQ.detach();
		this.jQ.hide();
		return this;
	}

	withDirInsertAt(dir: Direction, parent: Node, withDir: Node | 0, oppDir: Node) {
		const oldParent = this.parent;
		this.parent = parent;
		this[dir] = withDir;
		this[dir === L ? R : L] = oppDir;
		// by contract, .blur() is called after all has been said and done
		// and the cursor has actually been moved
		// FIXME pass cursor to .blur() so text can fix cursor pointers when removing itself
		if (oldParent !== parent && (oldParent as Node).blur) (oldParent as Node).blur(this);
	}

	insDirOf(dir: Direction, el: Node) {
		prayDirection(dir);
		this.jQ.insDirOf(dir, el.jQ);
		this.withDirInsertAt(dir, el.parent as Node, el[dir] as Node, el);
		(this.parent as Node).jQ.addClass('mq-hasCursor');
		return this;
	}

	insLeftOf(el: Node) { return this.insDirOf(L, el); }

	insRightOf(el: Node) { return this.insDirOf(R, el); }

	insAtDirEnd(dir: Direction, el: Node) {
		prayDirection(dir);
		this.jQ.insAtDirEnd(dir, el.jQ);
		this.withDirInsertAt(dir, el, 0, el.ends[dir] as Node);
		el.focus();
		return this;
	}

	insAtLeftEnd(el: Node) { return this.insAtDirEnd(L, el); }

	insAtRightEnd(el: Node) { return this.insAtDirEnd(R, el); }

	// jump up or down from one block Node to another:
	// - cache the current Point in the node we're jumping from
	// - check if there's a Point in it cached for the node we're jumping to
	//   + if so put the cursor there,
	//   + if not seek a position in the node that is horizontally closest to
	//     the cursor's current position
	jumpUpDown(from: Node, to: Node) {
		this.upDownCache[from.id] = Point.copy(this);
		const cached = this.upDownCache[to.id];
		if (cached) {
			cached[R] ? this.insLeftOf(cached[R] as Node) : this.insAtRightEnd(cached.parent as Node);
		} else {
			to.seek(this.offset()?.left, this);
		}
	}

	offset() {
		//in Opera 11.62, .getBoundingClientRect() and hence jQuery::offset()
		//returns all 0's on inline elements with negative margin-right (like
		//the cursor) at the end of their parent, so temporarily remove the
		//negative margin-right when calling jQuery::offset()
		//Opera bug DSK-360043
		//http://bugs.jquery.com/ticket/11523
		//https://github.com/jquery/jquery/pull/717
		const offset = this.jQ.removeClass('mq-cursor').offset();
		this.jQ.addClass('mq-cursor');
		return offset;
	}

	unwrapGramp() {
		const gramp = (this.parent as Node).parent as Node;
		const greatgramp = gramp.parent as Node;
		const rightward = gramp[R] as Node;

		let leftward = gramp[L] as Node;
		gramp.disown().eachChild((uncle) => {
			if (uncle.isEmpty()) return;

			uncle.children()
				.adopt(greatgramp, leftward, rightward)
				.each((cousin: Node) => cousin.jQ.insertBefore(gramp.jQ.first()))
			;

			leftward = uncle.ends[R] as Node;
		});

		if (!this[R]) { //then find something to be rightward to insLeftOf
			if (this[L])
				this[R] = (this[L] as Node)[R];
			else {
				while (!this[R]) {
					this.parent = (this.parent as Node)[R];
					if (this.parent)
						this[R] = (this.parent as Node).ends[L];
					else {
						this[R] = gramp[R];
						this.parent = greatgramp;
						break;
					}
				}
			}
		}
		if (this[R])
			this.insLeftOf(this[R] as Node);
		else
			this.insAtRightEnd(greatgramp);

		gramp.jQ.remove();

		if ((gramp[L] as Node)?.siblingDeleted) (gramp[L] as Node).siblingDeleted?.(this.options, R);
		if ((gramp[R] as Node)?.siblingDeleted) (gramp[R] as Node).siblingDeleted?.(this.options, L);
	}

	startSelection() {
		this.anticursor = Point.copy(this);
		// Create a map from each ancestor of the anticursor to its child that is also an ancestor.
		// In other words, the anticursor's ancestor chain in reverse order.
		this.anticursor.ancestors = {};
		for (let ancestor: Point | Node = this.anticursor; ancestor.parent; ancestor = ancestor.parent) {
			this.anticursor.ancestors[ancestor.parent.id] = ancestor;
		}
	}

	endSelection() {
		delete this.anticursor;
	}

	select() {
		if (this[L] === this.anticursor?.[L] && this.parent === this.anticursor?.parent) return false;

		pray('selection well formed', !!this.anticursor && !!this.anticursor.ancestors);
		if (!this.anticursor || !this.anticursor.ancestors) return false;

		// Find the lowest common ancestor (`lca`), and the ancestor of the cursor
		// whose parent is the LCA (which'll be an end of the selection fragment).
		let ancestor: Point | Node = this, lca: Node | null = null;
		for (; ancestor.parent; ancestor = ancestor.parent) {
			if (ancestor.parent.id in this.anticursor.ancestors) {
				lca = ancestor.parent;
				break;
			}
		}
		pray('cursor and anticursor in the same tree', !!lca);
		// The cursor and the anticursor should be in the same tree, because the
		// mousemove handler attached to the document, unlike the one attached to
		// the root HTML DOM element, doesn't try to get the math tree node of the
		// mousemove target, and Cursor::seek() based solely on coordinates stays
		// within the tree of `this` cursor's root.

		// The other end of the selection fragment, the ancestor of the anticursor
		// whose parent is the LCA.
		const antiAncestor = this.anticursor.ancestors[lca?.id ?? 0];

		// Now we have two either Nodes or Points, guaranteed to have a common
		// parent and guaranteed that if both are Points, they are not the same,
		// and we have to figure out which is the left end and which the right end
		// of the selection.
		let leftEnd, rightEnd, dir = R;

		// This is an extremely subtle algorithm.
		// As a special case, `ancestor` could be a Point and `antiAncestor` a Node
		// immediately to `ancestor`'s left.
		// In all other cases,
		// - both Nodes
		// - `ancestor` a Point and `antiAncestor` a Node
		// - `ancestor` a Node and `antiAncestor` a Point
		// `antiAncestor[R] === rightward[R]` for some `rightward` that is
		// `ancestor` or to its right, if and only if `antiAncestor` is to
		// the right of `ancestor`.
		if (ancestor[L] !== antiAncestor) {
			for (let rightward = ancestor; rightward; rightward = rightward[R] as Node) {
				if (rightward[R] === antiAncestor[R]) {
					dir = L;
					leftEnd = ancestor;
					rightEnd = antiAncestor;
					break;
				}
			}
		}
		if (dir === R) {
			leftEnd = antiAncestor;
			rightEnd = ancestor;
		}

		// only want to select Nodes up to Points, can't select Points themselves
		if (leftEnd instanceof Point) leftEnd = leftEnd[R];
		if (rightEnd instanceof Point) rightEnd = rightEnd[L];

		this.hide().selection = lca?.selectChildren(leftEnd as Node, rightEnd as Node);
		this.insDirOf(dir, (this.selection as Selection).ends[dir] as Node);
		this.selectionChanged?.();
		return true;
	}

	clearSelection() {
		if (this.selection) {
			this.selection.clear();
			delete this.selection;
			this.selectionChanged?.();
		}
		return this;
	}

	deleteSelection() {
		if (!this.selection) return;

		this[L] = (this.selection.ends[L] as Node)[L];
		this[R] = (this.selection.ends[R] as Node)[R];
		this.selection.remove();
		this.selectionChanged?.();
		delete this.selection;
	}

	replaceSelection() {
		const seln = this.selection;
		if (seln) {
			this[L] = (seln.ends[L] as Node)[L];
			this[R] = (seln.ends[R] as Node)[R];
			delete this.selection;
		}
		return seln;
	}

	depth() {
		let node = this.parent;
		let depth = 0;
		while (node) {
			depth += (node instanceof MathBlock) ? 1 : 0;
			node = node.parent;
		}
		return depth;
	}

	isTooDeep(offset: number) {
		if (this.options.maxDepth !== undefined) {
			return this.depth() + (offset || 0) > this.options.maxDepth;
		}
	}
}
