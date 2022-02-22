// Cursor "singleton" class
// The main thing that manipulates the Math DOM. Makes sure to manipulate the HTML DOM to match.
// Sort of a singleton, since there should only be one per editable math textbox, but any one HTML document can contain
// many such textboxes, so any one JS environment could actually contain many instances.
// A fake cursor in the fake textbox that the math is rendered in.

import type { Direction } from 'src/constants';
import { L, R, pray, prayDirection } from 'src/constants';
import type { Options } from 'src/options';
import { Point } from 'tree/point';
import type { TNode } from 'tree/node';
import type { Selection } from 'src/selection';
import { MathBlock } from 'commands/mathBlock';

export class Cursor extends Point {
	options: Options;
	element: HTMLElement = document.createElement('span');
	upDownCache: { [key: number]: Point } = {};
	intervalId?: ReturnType<typeof setInterval>;
	selection?: Selection;
	anticursor?: Point;
	selectionChanged?: () => void;

	// Closured for setInterval
	blink: () => void = () => this.element.classList.toggle('mq-blink');

	constructor(initParent: TNode, options: Options) {
		super(initParent);
		this.options = options;
		this.element.classList.add('mq-cursor');
		this.element.textContent = '\u200B';
	}

	show() {
		this.element.classList.remove('mq-blink');
		this.element.style.display = '';
		if (this.intervalId) {
			// The cursor is already shown, just restart the interval.
			clearInterval(this.intervalId);
		} else {
			// The cursor was hidden and removed, so insert this.element back into the DOM.
			if (this[R]) {
				if (this.selection && this.selection.ends[L]?.[L] === this[L])
					this.selection.elements.first.before(this.element);
				else
					(this[R] as TNode).elements.first.before(this.element);
			} else
				(this.parent as TNode).elements.firstElement.append(this.element);
			this.parent?.focus();
		}
		this.intervalId = setInterval(this.blink, 500);
		return this;
	}

	hide() {
		if (this.intervalId)
			clearInterval(this.intervalId);
		delete this.intervalId;
		this.element.style.display = 'none';
		this.element.remove();
		return this;
	}

	withDirInsertAt(dir: Direction, parent: TNode, withDir?: TNode, oppDir?: TNode) {
		const oldParent = this.parent as TNode;
		this.parent = parent;
		this[dir] = withDir;
		this[dir === L ? R : L] = oppDir;
		// By contract blur is called after all has been said and done and the cursor has actually been moved.
		if (oldParent !== parent && oldParent.blur) oldParent.blur(this);
	}

	insDirOf(dir: Direction, el: TNode) {
		prayDirection(dir);

		if (dir === L) el.elements.first.before(this.element);
		else el.elements.last.after(this.element);

		this.withDirInsertAt(dir, el.parent as TNode, el[dir], el);
		this.parent?.elements.addClass('mq-hasCursor');
		return this;
	}

	insLeftOf(el: TNode) { return this.insDirOf(L, el); }

	insRightOf(el: TNode) { return this.insDirOf(R, el); }

	insAtDirEnd(dir: Direction, el: TNode) {
		prayDirection(dir);

		if (dir === L) el.elements.firstElement.prepend(this.element);
		else el.elements.lastElement.append(this.element);

		this.withDirInsertAt(dir, el, undefined, el.ends[dir]);
		el.focus();
		return this;
	}

	insAtLeftEnd(el: TNode) { return this.insAtDirEnd(L, el); }

	insAtRightEnd(el: TNode) { return this.insAtDirEnd(R, el); }

	// Jump up or down from one block TNode to another:
	// - cache the current Point in the TNode we are jumping from
	// - check if there is a Point in it cached for the node we are jumping to
	//   + if so put the cursor there,
	//   + if not seek a position in the node that is horizontally closest to the cursor's current position
	jumpUpDown(from: TNode, to: TNode) {
		this.upDownCache[from.id] = Point.copy(this);
		const cached = this.upDownCache[to.id];
		if (cached) {
			cached[R] ? this.insLeftOf(cached[R] as TNode) : this.insAtRightEnd(cached.parent as TNode);
		} else {
			to.seek(this.offset().left, this);
		}
	}

	offset() {
		return this.element.getBoundingClientRect();
	}

	unwrapGramp() {
		const gramp = this.parent?.parent as TNode;
		const greatgramp = gramp.parent as TNode;
		const rightward = gramp[R];

		let leftward = gramp[L];
		gramp.disown().eachChild((uncle: TNode) => {
			if (uncle.isEmpty()) return;

			uncle.children()
				.adopt(greatgramp, leftward, rightward)
				.each((cousin: TNode) => { gramp.elements.first.before(...cousin.elements.contents); });

			leftward = uncle.ends[R];
		});

		if (!this[R]) {
			// Find something rightward to insert left of.
			if (this[L])
				this[R] = this[L]?.[R];
			else {
				while (!this[R]) {
					this.parent = this.parent?.[R];
					if (this.parent)
						this[R] = this.parent?.ends[L];
					else {
						this[R] = gramp[R];
						this.parent = greatgramp;
						break;
					}
				}
			}
		}
		if (this[R])
			this.insLeftOf(this[R] as TNode);
		else
			this.insAtRightEnd(greatgramp);

		gramp.elements.remove();

		if (gramp[L]?.siblingDeleted) gramp[L]?.siblingDeleted?.(this.options, R);
		if (gramp[R]?.siblingDeleted) gramp[R]?.siblingDeleted?.(this.options, L);
	}

	startSelection() {
		this.anticursor = Point.copy(this);
		// Create a map from each ancestor of the anticursor to its child that is also an ancestor.
		// In other words, the anticursor's ancestor chain in reverse order.
		this.anticursor.ancestors = {};
		for (let ancestor: Point | TNode = this.anticursor; ancestor.parent; ancestor = ancestor.parent) {
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
		// whose parent is the LCA (which will be an end of the selection fragment).
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let ancestor: Point | TNode = this, lca: TNode | null = null;
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
		// As a special case, `ancestor` could be a Point and `antiAncestor` a TNode
		// immediately to `ancestor`'s left.
		// In all other cases,
		// - both Nodes
		// - `ancestor` a Point and `antiAncestor` a TNode
		// - `ancestor` a TNode and `antiAncestor` a Point
		// `antiAncestor[R] === rightward[R]` for some `rightward` that is
		// `ancestor` or to its right, if and only if `antiAncestor` is to
		// the right of `ancestor`.
		if (ancestor[L] !== antiAncestor) {
			for (let rightward: Point | TNode | undefined = ancestor; rightward; rightward = rightward[R]) {
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

		this.hide().selection = lca?.selectChildren(leftEnd, rightEnd);
		this.insDirOf(dir, this.selection?.ends[dir] as TNode);
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

		this[L] = this.selection.ends[L]?.[L];
		this[R] = this.selection.ends[R]?.[R];
		this.selection.remove();
		this.selectionChanged?.();
		delete this.selection;
	}

	replaceSelection() {
		const seln = this.selection;
		if (seln) {
			this[L] = seln.ends[L]?.[L];
			this[R] = seln.ends[R]?.[R];
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

	isTooDeep(offset?: number) {
		if (this.options.maxDepth !== undefined) {
			return this.depth() + (offset || 0) > this.options.maxDepth;
		}
	}
}
