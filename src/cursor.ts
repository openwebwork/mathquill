// Cursor "singleton" class
// The main thing that manipulates the Math DOM. Makes sure to manipulate the HTML DOM to match.
// Sort of a singleton, since there should only be one per editable math textbox, but any one HTML document can contain
// many such textboxes, so any one JS environment could actually contain many instances.
// A fake cursor in the fake textbox that the math is rendered in.

import { type Direction, otherDir } from 'src/constants';
import type { Options } from 'src/options';
import { Point } from 'tree/point';
import type { TNode } from 'tree/node';
import type { Selection } from 'src/selection';
import { MathBlock } from 'commands/mathBlock';
import { ControllerBase } from './controller';

export class Cursor extends Point {
	controller: ControllerBase;
	options: Options;
	element: HTMLElement = document.createElement('span');
	upDownCache: Record<number, Point> = {};
	intervalId?: ReturnType<typeof setInterval>;
	selection?: Selection;
	anticursor?: Point;
	selectionChanged?: () => void;

	// Closured for setInterval
	blink: () => void = () => this.element.classList.toggle('mq-blink');

	constructor(initParent: TNode, options: Options, controller: ControllerBase) {
		super(initParent);
		this.controller = controller;
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
			if (this.right) {
				if (this.selection && this.selection.ends.left?.left === this.left)
					this.selection.elements.first.before(this.element);
				else this.right.elements.first.before(this.element);
			} else this.parent?.elements.firstElement.append(this.element);
			this.parent?.focus();
		}
		this.intervalId = setInterval(this.blink, 500);
		return this;
	}

	hide() {
		if (this.intervalId) clearInterval(this.intervalId);
		delete this.intervalId;
		this.element.style.display = 'none';
		this.element.remove();
		return this;
	}

	withDirInsertAt(dir: Direction, parent: TNode, withDir?: TNode, oppDir?: TNode) {
		const oldParent = this.parent;
		this.parent = parent;
		this[dir] = withDir;
		this[otherDir(dir)] = oppDir;
		// By contract blur is called after all has been said and done and the cursor has actually been moved.
		if (oldParent !== parent && oldParent?.blur) oldParent.blur(this);
	}

	insDirOf(dir: Direction | undefined, el: TNode) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');

		if (dir === 'left') el.elements.first.before(this.element);
		else el.elements.last.after(this.element);

		if (el.parent) this.withDirInsertAt(dir, el.parent, el[dir], el);
		this.parent?.elements.addClass('mq-has-cursor');
		return this;
	}

	insLeftOf(el: TNode) {
		return this.insDirOf('left', el);
	}

	insRightOf(el: TNode) {
		return this.insDirOf('right', el);
	}

	insAtDirEnd(dir: Direction | undefined, el: TNode) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');

		if (dir === 'left') el.elements.firstElement.prepend(this.element);
		else el.elements.lastElement.append(this.element);

		this.withDirInsertAt(dir, el, undefined, el.ends[dir]);
		el.focus();
		return this;
	}

	insAtLeftEnd(el: TNode) {
		return this.insAtDirEnd('left', el);
	}

	insAtRightEnd(el: TNode) {
		return this.insAtDirEnd('right', el);
	}

	// Jump up or down from one block TNode to another:
	// - cache the current Point in the TNode we are jumping from
	// - check if there is a Point in it cached for the node we are jumping to
	//   + if so put the cursor there,
	//   + if not seek a position in the node that is horizontally closest to the cursor's current position
	jumpUpDown(from: TNode, to: TNode) {
		this.upDownCache[from.id] = Point.copy(this);
		const cached = this.upDownCache[to.id] as Point | undefined;
		if (cached) {
			if (cached.right) this.insLeftOf(cached.right);
			else if (cached.parent) this.insAtRightEnd(cached.parent);
		} else {
			to.seek(this.offset().left, this);
		}
		this.controller.aria.queue(to, true);
	}

	offset() {
		return this.element.getBoundingClientRect();
	}

	unwrapGramp() {
		const gramp = this.parent?.parent;
		const greatgramp = gramp?.parent;
		const rightward = gramp?.right;

		let leftward = gramp?.left;
		gramp?.disown().eachChild((uncle: TNode) => {
			if (uncle.isEmpty()) return true;

			if (greatgramp)
				uncle
					.children()
					.adopt(greatgramp, leftward, rightward)
					.each((cousin: TNode) => {
						gramp.elements.first.before(...cousin.elements.contents);
						return true;
					});

			leftward = uncle.ends.right;
			return true;
		});

		if (!this.right) {
			// Find something rightward to insert left of.
			if (this.left) this.right = this.left.right;
			else {
				while (!this.right) {
					this.parent = this.parent?.right;
					if (this.parent) this.right = this.parent.ends.left;
					else {
						this.right = gramp?.right;
						this.parent = greatgramp;
						break;
					}
				}
			}
		}
		if (this.right) this.insLeftOf(this.right);
		else if (greatgramp) this.insAtRightEnd(greatgramp);

		gramp?.elements.remove();

		if (gramp?.left?.siblingDeleted) gramp.left.siblingDeleted(this.options, 'right');
		if (gramp?.right?.siblingDeleted) gramp.right.siblingDeleted(this.options, 'left');
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
		if (this.left === this.anticursor?.left && this.parent === this.anticursor?.parent) return false;

		if (!this.anticursor?.ancestors) throw new Error('selection not well formed');

		// Find the lowest common ancestor (`lca`), and the ancestor of the cursor
		// whose parent is the LCA (which will be an end of the selection fragment).
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let ancestor: Point | TNode = this,
			lca: TNode | null = null;
		for (; ancestor.parent; ancestor = ancestor.parent) {
			if (ancestor.parent.id in this.anticursor.ancestors) {
				lca = ancestor.parent;
				break;
			}
		}
		if (!lca) throw new Error('cursor and anticursor must be in the same tree');
		// The cursor and the anticursor should be in the same tree, because the
		// mousemove handler attached to the document, unlike the one attached to
		// the root HTML DOM element, doesn't try to get the math tree node of the
		// mousemove target, and Cursor::seek() based solely on coordinates stays
		// within the tree of `this` cursor's root.

		// The other end of the selection fragment, the ancestor of the anticursor
		// whose parent is the LCA.
		const antiAncestor = this.anticursor.ancestors[lca.id];

		// Now we have two either Nodes or Points, guaranteed to have a common
		// parent and guaranteed that if both are Points, they are not the same,
		// and we have to figure out which is the left end and which the right end
		// of the selection.
		let leftEnd,
			rightEnd,
			dir: Direction = 'right';

		// This is an extremely subtle algorithm.
		// As a special case, `ancestor` could be a Point and `antiAncestor` a TNode
		// immediately to `ancestor`'s left.
		// In all other cases,
		// - both Nodes
		// - `ancestor` a Point and `antiAncestor` a TNode
		// - `ancestor` a TNode and `antiAncestor` a Point
		// `antiAncestor.right === rightward.right` for some `rightward` that is
		// `ancestor` or to its right, if and only if `antiAncestor` is to
		// the right of `ancestor`.
		if (ancestor.left !== antiAncestor) {
			for (let rightward: Point | TNode | undefined = ancestor; rightward; rightward = rightward.right) {
				if (rightward.right === antiAncestor.right) {
					dir = 'left';
					leftEnd = ancestor;
					rightEnd = antiAncestor;
					break;
				}
			}
		}
		if (dir === 'right') {
			leftEnd = antiAncestor;
			rightEnd = ancestor;
		}

		// only want to select Nodes up to Points, can't select Points themselves
		if (leftEnd instanceof Point) leftEnd = leftEnd.right;
		if (rightEnd instanceof Point) rightEnd = rightEnd.left;

		this.hide().selection = lca.selectChildren(leftEnd, rightEnd);
		const selectionEndDir = this.selection?.ends[dir];
		if (selectionEndDir) this.insDirOf(dir, selectionEndDir);
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

		this.left = this.selection.ends.left?.left;
		this.right = this.selection.ends.right?.right;
		this.selection.remove();
		this.selectionChanged?.();
		delete this.selection;
	}

	replaceSelection() {
		const seln = this.selection;
		if (seln) {
			this.left = seln.ends.left?.left;
			this.right = seln.ends.right?.right;
			delete this.selection;
		}
		return seln;
	}

	depth() {
		let node = this.parent;
		let depth = 0;
		while (node) {
			depth += node instanceof MathBlock ? 1 : 0;
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
