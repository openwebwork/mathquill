// Base classes of edit tree-related objects

// Only doing tree node manipulation via these adopt/disown methods guarantees well-formedness of the tree.

// L = 'left'
// R = 'right'
//
// The contract is that they can be used as object properties
// and (-L) === R, and (-R) === L.
const L = -1;
const R = 1;

const prayDirection = (dir) => {
	pray('a direction was passed', dir === L || dir === R);
}

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

class Point {
	constructor(parent, leftward, rightward) {
		this.parent = parent ?? 0;
		this[L] = leftward ?? 0;
		this[R] = rightward ?? 0;
	}

	static copy(pt) {
		return new Point(pt.parent, pt[L], pt[R]);
	}
}

const prayOverridden = () => pray('overridden or never called on this node');

// MathQuill virtual-DOM tree-node abstract base class
class Node {
	static id = 0;
	static byId = {};
	static uniqueNodeId = () => ++Node.id;

	constructor() {
		this[L] = 0;
		this[R] = 0
		this.parent = 0;

		this.id = Node.uniqueNodeId();
		Node.byId[this.id] = this;

		this.ends = { [L]: 0, [R]: 0 };

		this.jQ = $();

		this.bubble = iterator((yield_) => {
			for (let ancestor = this; ancestor; ancestor = ancestor.parent) {
				if (yield_(ancestor) === false) break;
			}

			return this;
		});

		this.postOrder = iterator((yield_) => {
			(function recurse(descendant) {
				descendant.eachChild(recurse);
				yield_(descendant);
			})(this);

			return this;
		});
	}

	dispose() { delete Node.byId[this.id]; }

	toString() { return `{{ MathQuill Node #${this.id} }}`; }

	jQadd(jQ) { return this.jQ = this.jQ.add(jQ); }

	jQize(jQ) {
		// jQuery-ifies this.html() and links up the .jQ of all corresponding Nodes
		const jQlocal = $(jQ || this.html());

		const jQadd = (el) => {
			if (el.getAttribute) {
				const cmdId = el.getAttribute('mathquill-command-id');
				const blockId = el.getAttribute('mathquill-block-id');
				if (cmdId) Node.byId[cmdId].jQadd(el);
				if (blockId) Node.byId[blockId].jQadd(el);
			}
			for (el = el.firstChild; el; el = el.nextSibling) {
				jQadd(el);
			}
		};

		jQlocal.each(function() { jQadd(this); });
		return jQlocal;
	}

	createDir(dir, cursor) {
		prayDirection(dir);
		this.jQize();
		this.jQ.insDirOf(dir, cursor.jQ);
		cursor[dir] = this.adopt(cursor.parent, cursor[L], cursor[R]);
		return this;
	}

	createLeftOf(el) { return this.createDir(L, el); }

	selectChildren(leftEnd, rightEnd) {
		return new Selection(leftEnd, rightEnd);
	}

	isEmpty() {
		return this.ends[L] === 0 && this.ends[R] === 0;
	}

	isStyleBlock() {
		return false;
	}

	children() {
		return new Fragment(this.ends[L], this.ends[R]);
	}

	eachChild(...args) {
		const children = this.children();
		children.each.apply(children, args);
		return this;
	}

	foldChildren(fold, fn) {
		return this.children().fold(fold, fn);
	}

	withDirAdopt(dir, parent, withDir, oppDir) {
		new Fragment(this, this).withDirAdopt(dir, parent, withDir, oppDir);
		return this;
	}

	adopt(parent, leftward, rightward) {
		new Fragment(this, this).adopt(parent, leftward, rightward);
		return this;
	}

	disown() {
		new Fragment(this, this).disown();
		return this;
	};

	remove() {
		this.jQ.remove();
		this.postOrder('dispose');
		return this.disown();
	}

	// Methods that deal with the browser DOM events from interaction with the typist.

	keystroke(key, e, ctrlr) {
		const cursor = ctrlr.cursor;

		switch (key) {
			case 'Ctrl-Shift-Backspace':
			case 'Ctrl-Backspace':
				ctrlr.ctrlDeleteDir(L);
				break;

			case 'Shift-Backspace':
			case 'Backspace':
				ctrlr.backspace();
				break;

				// Tab or Esc -> go one block right if it exists, else escape right.
			case 'Esc':
			case 'Tab':
				ctrlr.escapeDir(R, key, e);
				return;

				// Shift-Tab -> go one block left if it exists, else escape left.
			case 'Shift-Tab':
			case 'Shift-Esc':
				ctrlr.escapeDir(L, key, e);
				return;

				// End -> move to the end of the current block.
			case 'End':
				ctrlr.notify('move').cursor.insAtRightEnd(cursor.parent);
				break;

				// Ctrl-End -> move all the way to the end of the root block.
			case 'Ctrl-End':
				ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
				break;

				// Shift-End -> select to the end of the current block.
			case 'Shift-End':
				while (cursor[R]) {
					ctrlr.selectRight();
				}
				break;

				// Ctrl-Shift-End -> select to the end of the root block.
			case 'Ctrl-Shift-End':
				while (cursor[R] || cursor.parent !== ctrlr.root) {
					ctrlr.selectRight();
				}
				break;

				// Home -> move to the start of the root block or the current block.
			case 'Home':
				ctrlr.notify('move').cursor.insAtLeftEnd(cursor.parent);
				break;

				// Ctrl-Home -> move to the start of the current block.
			case 'Ctrl-Home':
				ctrlr.notify('move').cursor.insAtLeftEnd(ctrlr.root);
				break;

				// Shift-Home -> select to the start of the current block.
			case 'Shift-Home':
				while (cursor[L]) {
					ctrlr.selectLeft();
				}
				break;

				// Ctrl-Shift-Home -> move to the start of the root block.
			case 'Ctrl-Shift-Home':
				while (cursor[L] || cursor.parent !== ctrlr.root) {
					ctrlr.selectLeft();
				}
				break;

			case 'Left': ctrlr.moveLeft(); break;
			case 'Shift-Left': ctrlr.selectLeft(); break;
			case 'Ctrl-Left': break;

			case 'Right': ctrlr.moveRight(); break;
			case 'Shift-Right': ctrlr.selectRight(); break;
			case 'Ctrl-Right': break;

			case 'Up': ctrlr.moveUp(); break;
			case 'Down': ctrlr.moveDown(); break;

			case 'Shift-Up':
				if (cursor[L]) {
					while (cursor[L]) ctrlr.selectLeft();
				} else {
					ctrlr.selectLeft();
				}

			case 'Shift-Down':
				if (cursor[R]) {
					while (cursor[R]) ctrlr.selectRight();
				}
				else {
					ctrlr.selectRight();
				}

			case 'Ctrl-Up': break;
			case 'Ctrl-Down': break;

			case 'Ctrl-Shift-Del':
			case 'Ctrl-Del':
				ctrlr.ctrlDeleteDir(R);
				break;

			case 'Shift-Del':
			case 'Del':
				ctrlr.deleteForward();
				break;

			case 'Meta-A':
			case 'Ctrl-A':
				ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
				while (cursor[L]) ctrlr.selectLeft();
				break;

			default:
				return;
		}
		e.preventDefault();
		ctrlr.scrollHoriz();
	}

	// called by Controller::escapeDir, moveDir
	moveOutOf() { prayOverridden(); }
	// called by Controller::moveDir
	moveTowards() { prayOverridden(); }
	// called by Controller::deleteDir
	deleteOutOf() { prayOverridden(); }
	// called by Controller::deleteDir
	deleteTowards() { prayOverridden(); }
	// called by Controller::selectDir
	unselectInto() { prayOverridden(); }
	// called by Controller::selectDir
	selectOutOf() { prayOverridden(); }
	// called by Controller::selectDir
	selectTowards() { prayOverridden(); }
}

const prayWellFormed = (parent, leftward, rightward) => {
	pray('a parent is always present', parent);
	pray('leftward is properly set up', (() => {
		// either it's empty and `rightward` is the left end child (possibly empty)
		if (!leftward) return parent.ends[L] === rightward;

		// or it's there and its [R] and .parent are properly set up
		return leftward[R] === rightward && leftward.parent === parent;
	})());

	pray('rightward is properly set up', (() => {
		// either it's empty and `leftward` is the right end child (possibly empty)
		if (!rightward) return parent.ends[R] === leftward;

		// or it's there and its [L] and .parent are properly set up
		return rightward[L] === leftward && rightward.parent === parent;
	})());
}

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
class Fragment {
	constructor(withDir, oppDir, dir) {
		this.jQ = $();

		this.each = iterator((yield_) => {
			let el = this.ends[L];
			if (!el) return this;

			for (; el !== this.ends[R][R]; el = el[R]) {
				if (yield_(el) === false) break;
			}

			return this;
		});

		if (dir === undefined) dir = L;
		prayDirection(dir);

		pray('no half-empty fragments', !withDir === !oppDir);

		this.ends = {};

		if (!withDir) return;

		pray('withDir is passed to Fragment', withDir instanceof Node);
		pray('oppDir is passed to Fragment', oppDir instanceof Node);
		pray('withDir and oppDir have the same parent',
			withDir.parent === oppDir.parent);

		this.ends[dir] = withDir;
		this.ends[-dir] = oppDir;

		// To build the jquery collection for a fragment, accumulate elements
		// into an array and then call jQ.add once on the result. jQ.add sorts the
		// collection according to document order each time it is called, so
		// building a collection by folding jQ.add directly takes more than
		// quadratic time in the number of elements.
		//
		// https://github.com/jquery/jquery/blob/2.1.4/src/traversing.js#L112
		const accum = this.fold([], (accum, el) => {
			accum.push.apply(accum, el.jQ.get());
			return accum;
		});

		this.jQ = this.jQ.add(accum);
	}

	// like Cursor::withDirInsertAt(dir, parent, withDir, oppDir)
	withDirAdopt(dir, parent, withDir, oppDir) {
		return (dir === L ? this.adopt(parent, withDir, oppDir)
			: this.adopt(parent, oppDir, withDir));
	}

	adopt(parent, leftward, rightward) {
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

		this.ends[R][R] = rightward;

		this.each((el) => {
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

		const rightEnd = this.ends[R]
		const parent = leftEnd.parent;

		prayWellFormed(parent, leftEnd[L], leftEnd);
		prayWellFormed(parent, rightEnd, rightEnd[R]);

		if (leftEnd[L]) {
			leftEnd[L][R] = rightEnd[R];
		} else {
			parent.ends[L] = rightEnd[R];
		}

		if (rightEnd[R]) {
			rightEnd[R][L] = leftEnd[L];
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

	fold(fold, fn) {
		this.each(function(el) {
			fold = fn.call(this, fold, el);
		});

		return fold;
	}
}

// Registry of LaTeX commands and commands created when typing
// a single character.
// (Commands are all subclasses of Node.)
const LatexCmds = {}, CharCmds = {};
