// Cursor and Selection "singleton" classes

// The main thing that manipulates the Math DOM. Makes sure to manipulate the
// HTML DOM to match.

// Sort of singletons, since there should only be one per editable math
// textbox, but any one HTML document can contain many such textboxes, so any one
// JS environment could actually contain many instances. */

// A fake cursor in the fake textbox that the math is rendered in.
class Cursor extends Point {
	constructor(initParent, options) {
		super(initParent)
		this.options = options;

		this.jQ = $('<span class="mq-cursor">&#8203;</span>');
		//closured for setInterval
		this.blink = () => this.jQ.toggleClass('mq-blink');

		this.upDownCache = {};
	}

	show() {
		this.jQ.removeClass('mq-blink');
		this.jQ.show();
		if (this.intervalId) //already was shown, just restart interval
			clearInterval(this.intervalId);
		else { //was hidden and detached, insert this.jQ back into HTML DOM
			if (this[R]) {
				if (this.selection && this.selection.ends[L][L] === this[L])
					this.jQ.insertBefore(this.selection.jQ);
				else
					this.jQ.insertBefore(this[R].jQ.first());
			}
			else
				this.jQ.appendTo(this.parent.jQ);
			this.parent.focus();
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

	withDirInsertAt(dir, parent, withDir, oppDir) {
		const oldParent = this.parent;
		this.parent = parent;
		this[dir] = withDir;
		this[-dir] = oppDir;
		// by contract, .blur() is called after all has been said and done
		// and the cursor has actually been moved
		// FIXME pass cursor to .blur() so text can fix cursor pointers when removing itself
		if (oldParent !== parent && oldParent.blur) oldParent.blur(this);
	}

	insDirOf(dir, el) {
		prayDirection(dir);
		this.jQ.insDirOf(dir, el.jQ);
		this.withDirInsertAt(dir, el.parent, el[dir], el);
		this.parent.jQ.addClass('mq-hasCursor');
		return this;
	}

	insLeftOf(el) { return this.insDirOf(L, el); }

	insRightOf(el) { return this.insDirOf(R, el); }

	insAtDirEnd(dir, el) {
		prayDirection(dir);
		this.jQ.insAtDirEnd(dir, el.jQ);
		this.withDirInsertAt(dir, el, 0, el.ends[dir]);
		el.focus();
		return this;
	}

	insAtLeftEnd(el) { return this.insAtDirEnd(L, el); }

	insAtRightEnd(el) { return this.insAtDirEnd(R, el); }

	// jump up or down from one block Node to another:
	// - cache the current Point in the node we're jumping from
	// - check if there's a Point in it cached for the node we're jumping to
	//   + if so put the cursor there,
	//   + if not seek a position in the node that is horizontally closest to
	//     the cursor's current position
	jumpUpDown(from, to) {
		this.upDownCache[from.id] = Point.copy(this);
		const cached = this.upDownCache[to.id];
		if (cached) {
			cached[R] ? this.insLeftOf(cached[R]) : this.insAtRightEnd(cached.parent);
		}
		else {
			to.seek(this.offset().left, this);
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
		const gramp = this.parent.parent;
		const greatgramp = gramp.parent;
		const rightward = gramp[R];

		let leftward = gramp[L];
		gramp.disown().eachChild((uncle) => {
			if (uncle.isEmpty()) return;

			uncle.children()
				.adopt(greatgramp, leftward, rightward)
				.each((cousin) => cousin.jQ.insertBefore(gramp.jQ.first()))
			;

			leftward = uncle.ends[R];
		});

		if (!this[R]) { //then find something to be rightward to insLeftOf
			if (this[L])
				this[R] = this[L][R];
			else {
				while (!this[R]) {
					this.parent = this.parent[R];
					if (this.parent)
						this[R] = this.parent.ends[L];
					else {
						this[R] = gramp[R];
						this.parent = greatgramp;
						break;
					}
				}
			}
		}
		if (this[R])
			this.insLeftOf(this[R]);
		else
			this.insAtRightEnd(greatgramp);

		gramp.jQ.remove();

		if (gramp[L].siblingDeleted) gramp[L].siblingDeleted(this.options, R);
		if (gramp[R].siblingDeleted) gramp[R].siblingDeleted(this.options, L);
	}

	startSelection() {
		this.anticursor = Point.copy(this);
		// Create a map from each ancestor of the anticursor to its child that is also an ancestor.
		// In other words, the anticursor's ancestor chain in reverse order.
		this.anticursor.ancestors = {};
		for (let ancestor = this.anticursor; ancestor.parent; ancestor = ancestor.parent) {
			this.anticursor.ancestors[ancestor.parent.id] = ancestor;
		}
	}

	endSelection() {
		delete this.anticursor;
	}

	select() {
		if (this[L] === this.anticursor[L] && this.parent === this.anticursor.parent) return false;

		// Find the lowest common ancestor (`lca`), and the ancestor of the cursor
		// whose parent is the LCA (which'll be an end of the selection fragment).
		let ancestor = this, lca;
		for (; ancestor.parent; ancestor = ancestor.parent) {
			if (ancestor.parent.id in this.anticursor.ancestors) {
				lca = ancestor.parent;
				break;
			}
		}
		pray('cursor and anticursor in the same tree', lca);
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
			for (let rightward = ancestor; rightward; rightward = rightward[R]) {
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

		this.hide().selection = lca.selectChildren(leftEnd, rightEnd);
		this.insDirOf(dir, this.selection.ends[dir]);
		this.selectionChanged();
		return true;
	}

	clearSelection() {
		if (this.selection) {
			this.selection.clear();
			delete this.selection;
			this.selectionChanged();
		}
		return this;
	}

	deleteSelection() {
		if (!this.selection) return;

		this[L] = this.selection.ends[L][L];
		this[R] = this.selection.ends[R][R];
		this.selection.remove();
		this.selectionChanged();
		delete this.selection;
	}

	replaceSelection() {
		const seln = this.selection;
		if (seln) {
			this[L] = seln.ends[L][L];
			this[R] = seln.ends[R][R];
			delete this.selection;
		}
		return seln;
	}

	depth() {
		let node = this;
		let depth = 0;
		while (node = node.parent) {
			depth += (node instanceof MathBlock) ? 1 : 0;
		}
		return depth;
	}

	isTooDeep(offset) {
		if (this.options.maxDepth !== undefined) {
			return this.depth() + (offset || 0) > this.options.maxDepth;
		}
	}
}

class Selection extends Fragment {
	constructor(...args) {
		super(...args);
		this.jQ = this.jQ.wrapAll('<span class="mq-selection"></span>').parent();
		//can't do wrapAll(this.jQ = $(...)) because wrapAll will clone it
	}

	adopt(...args) {
		this.jQ.replaceWith(this.jQ = this.jQ.children());
		return super.adopt(...args);
	}

	clear() {
		// using the browser's native .childNodes property so that we
		// don't discard text nodes.
		this.jQ.replaceWith(this.jQ[0].childNodes);
		return this;
	}

	join(methodName) {
		return this.fold('', (fold, child) => fold + child[methodName]());
	}
}
