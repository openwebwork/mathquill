// Node base class of edit tree-related objects

import { jQuery, L, R, iterator, pray, prayDirection } from 'src/constants';
import { Selection } from 'src/selection';
import { Fragment } from 'tree/fragment';

const prayOverridden = () => pray('overridden or never called on this node');

// MathQuill virtual-DOM tree-node abstract base class
// Only doing tree node manipulation via these adopt/disown methods guarantees well-formedness of the tree.
export class Node {
	static id = 0;
	static byId = {};
	static uniqueNodeId = () => ++Node.id;

	constructor() {
		this[L] = 0;
		this[R] = 0;
		this.parent = 0;

		this.id = Node.uniqueNodeId();
		Node.byId[this.id] = this;

		this.ends = { [L]: 0, [R]: 0 };

		this.jQ = jQuery();

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
		const jQlocal = jQuery(jQ || this.html());

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
			break;

		case 'Shift-Down':
			if (cursor[R]) {
				while (cursor[R]) ctrlr.selectRight();
			}
			else {
				ctrlr.selectRight();
			}
			break;

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
