// TNode base class of edit tree-related objects

import type { Direction } from 'src/constants';
import { iterator, mqCmdId, mqBlockId } from 'src/constants';
import type { Options } from 'src/options';
import type { Controller } from 'src/controller';
import type { Cursor } from 'src/cursor';
import { Selection } from 'src/selection';
import { VNode } from 'tree/vNode';
import { Fragment } from 'tree/fragment';

export interface Ends {
	left?: TNode;
	right?: TNode;
}

const prayOverridden = (name: string) => {
	throw new Error(`"${name}" should be overridden or never called on this node`);
};

// MathQuill virtual-DOM tree-node abstract base class
// Only doing tree node manipulation via these adopt/disown methods guarantees well-formedness of the tree.
export class TNode {
	static id = 0;
	static byId = new Map<number, TNode>();
	static uniqueNodeId = () => ++TNode.id;

	elements: VNode = new VNode();
	id: number;
	parent?: TNode;
	ends: Ends = {};
	left?: TNode;
	right?: TNode;
	controller?: Controller;

	ctrlSeq = '';
	siblingDeleted?: (opts: Options, dir?: Direction) => void;
	siblingCreated?: (opts: Options, dir?: Direction) => void;
	sub?: TNode;
	sup?: TNode;
	isSymbol?: boolean;
	isSupSubLeft?: boolean;

	upInto?: TNode;
	downInto?: TNode;
	upOutOf?: ((dir: Direction) => void) | ((cursor: Cursor) => void) | TNode | boolean;
	downOutOf?: ((dir: Direction) => void) | ((cursor: Cursor) => void) | TNode | boolean;

	reflow?: () => void;

	bubble = iterator((yield_: (node: TNode) => TNode | boolean | undefined) => {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		for (let ancestor: TNode | undefined = this; ancestor; ancestor = ancestor.parent) {
			if (yield_(ancestor) === false) break;
		}

		return this;
	});

	postOrder = iterator((yield_: (node: TNode) => TNode | boolean | undefined) => {
		(function recurse(descendant: TNode) {
			descendant.eachChild(recurse);
			yield_(descendant);
			return true;
		})(this);

		return this;
	});

	constructor() {
		this.id = TNode.uniqueNodeId();
		TNode.byId.set(this.id, this);
	}

	dispose() {
		TNode.byId.delete(this.id);
	}

	toString() {
		return `{{ MathQuill TNode #${this.id.toString()} }}`;
	}

	addToElements(el: VNode | HTMLElement) {
		this.elements.add(el);
	}

	domify(vNode?: VNode) {
		// Convert html string to DOM contents and add elements to all corresponding TNodes.
		const localVNode = vNode instanceof VNode ? vNode : new VNode(this.html());

		const addToElements = (el: Node) => {
			if (el instanceof HTMLElement) {
				const cmdId = parseInt(el.getAttribute(mqCmdId) ?? '0');
				const blockId = parseInt(el.getAttribute(mqBlockId) ?? '0');
				if (cmdId) TNode.byId.get(cmdId)?.addToElements(el);
				if (blockId) TNode.byId.get(blockId)?.addToElements(el);
			}
			for (let child = el.firstChild; child; child = child.nextSibling) {
				addToElements(child);
			}
		};

		localVNode.contents.forEach((element) => {
			addToElements(element);
		});
		return localVNode;
	}

	createDir(dir: Direction | undefined, cursor: Cursor) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');
		this.domify();
		this.elements.insDirOf(dir, cursor.element);
		if (cursor.parent) cursor[dir] = this.adopt(cursor.parent, cursor.left, cursor.right);
		return this;
	}

	createLeftOf(el: Cursor) {
		this.createDir('left', el);
	}

	selectChildren(leftEnd?: TNode, rightEnd?: TNode) {
		return new Selection(leftEnd, rightEnd);
	}

	isEmpty() {
		return !this.ends.left && !this.ends.right;
	}

	isStyleBlock() {
		return false;
	}

	children() {
		return new Fragment(this.ends.left, this.ends.right);
	}

	eachChild(method: 'postOrder' | ((node: TNode) => boolean), order?: string) {
		const children = this.children();
		children.each(method, order);
		return this;
	}

	foldChildren<T>(fold: T, fn: (fold: T, child: TNode) => T): T {
		return this.children().fold<T>(fold, fn);
	}

	withDirAdopt(dir: Direction, parent: TNode, withDir?: TNode, oppDir?: TNode) {
		new Fragment(this, this).withDirAdopt(dir, parent, withDir, oppDir);
		return this;
	}

	adopt(parent: TNode, leftward?: TNode, rightward?: TNode) {
		new Fragment(this, this).adopt(parent, leftward, rightward);
		return this;
	}

	disown() {
		new Fragment(this, this).disown();
		return this;
	}

	remove() {
		this.elements.remove();
		this.postOrder('dispose');
		return this.disown();
	}

	// Methods that deal with the browser DOM events from interaction with the typist.

	keystroke(key: string, e: KeyboardEvent, ctrlr: Controller) {
		const cursor = ctrlr.cursor;

		switch (key) {
			case 'Ctrl-Shift-Backspace':
			case 'Ctrl-Backspace':
				ctrlr.ctrlDeleteDir('left');
				break;

			case 'Shift-Backspace':
			case 'Backspace':
				ctrlr.backspace();
				break;

			// Tab or Esc -> go one block right if it exists, else escape right.
			case 'Escape':
			case 'Tab':
				ctrlr.escapeDir('right', key, e);
				return;

			// Shift-Tab -> go one block left if it exists, else escape left.
			case 'Shift-Tab':
			case 'Shift-Escape':
				ctrlr.escapeDir('left', key, e);
				return;

			// End -> move to the end of the current block.
			case 'End':
				if (cursor.parent) ctrlr.notify('move').cursor.insAtRightEnd(cursor.parent);
				break;

			// Ctrl-End -> move all the way to the end of the root block.
			case 'Ctrl-End':
				ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
				break;

			// Shift-End -> select to the end of the current block.
			case 'Shift-End':
				while (cursor.right) {
					ctrlr.selectRight();
				}
				break;

			// Ctrl-Shift-End -> select to the end of the root block.
			case 'Ctrl-Shift-End':
				while (cursor.right || cursor.parent !== ctrlr.root) {
					ctrlr.selectRight();
				}
				break;

			// Home -> move to the start of the root block or the current block.
			case 'Home':
				if (cursor.parent) ctrlr.notify('move').cursor.insAtLeftEnd(cursor.parent);
				break;

			// Ctrl-Home -> move to the start of the current block.
			case 'Ctrl-Home':
				ctrlr.notify('move').cursor.insAtLeftEnd(ctrlr.root);
				break;

			// Shift-Home -> select to the start of the current block.
			case 'Shift-Home':
				while (cursor.left) {
					ctrlr.selectLeft();
				}
				break;

			// Ctrl-Shift-Home -> move to the start of the root block.
			case 'Ctrl-Shift-Home':
				while (cursor.left || cursor.parent !== ctrlr.root) {
					ctrlr.selectLeft();
				}
				break;

			case 'Left':
				ctrlr.moveLeft();
				break;
			case 'Shift-Left':
				ctrlr.selectLeft();
				break;
			case 'Ctrl-Left':
				break;

			case 'Right':
				ctrlr.moveRight();
				break;
			case 'Shift-Right':
				ctrlr.selectRight();
				break;
			case 'Ctrl-Right':
				break;

			case 'Up':
				ctrlr.moveUp();
				break;
			case 'Down':
				ctrlr.moveDown();
				break;

			case 'Shift-Up':
				if (cursor.left) {
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					while (cursor.left) ctrlr.selectLeft();
				} else {
					ctrlr.selectLeft();
				}
				break;

			case 'Shift-Down':
				if (cursor.right) {
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					while (cursor.right) ctrlr.selectRight();
				} else {
					ctrlr.selectRight();
				}
				break;

			case 'Ctrl-Up':
				break;
			case 'Ctrl-Down':
				break;

			case 'Ctrl-Shift-Delete':
			case 'Ctrl-Delete':
				ctrlr.ctrlDeleteDir('right');
				break;

			case 'Shift-Delete':
			case 'Delete':
				ctrlr.deleteForward();
				break;

			case 'Meta-A':
			case 'Ctrl-A':
				ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
				while (cursor.left) ctrlr.selectLeft();
				break;

			default:
				return;
		}
		e.preventDefault();
		ctrlr.scrollHoriz();
	}

	html() {
		return '';
	}
	text() {
		return '';
	}
	latex() {
		return '';
	}
	focus() {
		/* do nothing */
	}
	blur(_cursor?: Cursor) {
		/* do nothing */
	}
	seek(_left: number, _cursor: Cursor) {
		/* do nothing */
	}
	writeLatex(_cursor: Cursor, _latex: string) {
		/* do nothing */
	}
	finalizeInsert(_options: Options, _cursor: Cursor) {
		/* do nothing */
	}
	write(_cursor: Cursor, _ch: string) {
		/* do nothing */
	}
	replaces(_fragment?: string | Fragment) {
		/* do nothing */
	}
	setOptions(_options: { text?: () => string; htmlTemplate?: string; latex?: () => string }) {
		return this;
	}
	chToCmd(_ch: string, _options: Options): TNode {
		return this as TNode;
	}

	getController() {
		// Navigate up the tree to find the controller.
		return (function getCursor(node: TNode): Controller | undefined {
			if (node.controller) return node.controller;
			if (node.parent) return getCursor(node.parent);
		})(this);
	}

	// called by Controller::escapeDir, moveDir
	moveOutOf(_dir: Direction, _cursor?: Cursor, _updown?: 'up' | 'down') {
		prayOverridden('moveOutOf');
	}
	// called by Controller::moveDir
	moveTowards(_dir: Direction, _cursor: Cursor, _updown?: 'up' | 'down') {
		prayOverridden('moveTowards');
	}
	// called by Controller::deleteDir
	deleteOutOf(_dir: Direction, _cursor?: Cursor) {
		prayOverridden('deleteOutOf');
	}
	// called by Controller::deleteDir
	deleteTowards(_dir: Direction, _cursor: Cursor) {
		prayOverridden('deleteTowards');
	}
	// called by Controller::selectDir
	unselectInto(_dir: Direction, _cursor: Cursor) {
		prayOverridden('unselectInto');
	}
	// called by Controller::selectDir
	selectOutOf(_dir: Direction, _cursor?: Cursor) {
		prayOverridden('selectOutOf');
	}
	// called by Controller::selectDir
	selectTowards(_dir: Direction, _cursor: Cursor) {
		prayOverridden('selectTowards');
	}
}
