// Controller for a MathQuill instance, on which services are registered.

import type { Direction } from 'src/constants';
import type { Handler, DirectionHandler, Handlers, Options } from 'src/options';
import { Cursor } from 'src/cursor';
import type { AbstractMathQuill } from 'src/abstractFields';
import { TNode } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { HorizontalScroll } from 'services/scrollHoriz';
import { LatexControllerExtension } from 'services/latex';
import { MouseEventController } from 'services/mouse';
import { FocusBlurEvents } from 'services/focusBlur';
import { ExportText } from 'services/exportText';
import { TextAreaController } from 'services/textarea';

export class ControllerBase {
	id: number;
	root: TNode;
	container: HTMLElement;
	options: Options;
	cursor: Cursor;
	apiClass?: AbstractMathQuill;
	KIND_OF_MQ = '';
	editable = false;
	blurred?: boolean;
	textareaSpan?: HTMLSpanElement;
	textarea?: HTMLTextAreaElement;

	constructor(root: TNode, container: HTMLElement, options: Options) {
		this.id = root.id;

		this.root = root;
		this.container = container;
		this.options = options;

		this.cursor = new Cursor(root, options);
	}

	handle(name: keyof Handlers, dir?: Direction) {
		const handlers = this.options.handlers;
		if (handlers?.[name]) {
			if (dir === 'left' || dir === 'right') (handlers[name] as DirectionHandler)(dir, this.apiClass);
			else (handlers[name] as Handler)(this.apiClass);
		}
	}

	notify(e?: string) {
		if (e === 'move' || e === 'upDown') this.cursor.show().clearSelection();
		if (e !== 'upDown') this.cursor.upDownCache = {};
		if (e === 'edit') this.cursor.show().deleteSelection();
		if (e !== 'select') this.cursor.endSelection();

		return this;
	}

	// The textarea mixin overrides this.
	selectionChanged() {
		/* do nothing */
	}
}

export class Controller extends ExportText(
	TextAreaController(
		LatexControllerExtension(FocusBlurEvents(MouseEventController(HorizontalScroll(ControllerBase))))
	)
) {
	constructor(root: TNode, container: HTMLElement, options: Options) {
		super(root, container, options);
		root.controller = this;
	}

	escapeDir(dir: Direction | undefined, _key: string, e: KeyboardEvent) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');
		const cursor = this.cursor;

		// only prevent default of Tab if not in the root editable
		if (cursor.parent !== this.root) e.preventDefault();

		// want to be a noop if in the root editable (in fact, Tab has an unrelated
		// default browser action if so)
		if (cursor.parent === this.root) return;

		cursor.parent?.moveOutOf(dir, cursor);
		return this.notify('move');
	}

	moveDir(dir: Direction | undefined) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');
		const cursor = this.cursor,
			updown = cursor.options.leftRightIntoCmdGoes;

		if (cursor.selection) {
			const end = cursor.selection.ends[dir];
			if (end) cursor.insDirOf(dir, end);
		} else if (cursor[dir]) cursor[dir].moveTowards(dir, cursor, updown);
		else cursor.parent?.moveOutOf(dir, cursor, updown);

		return this.notify('move');
	}
	moveLeft() {
		return this.moveDir('left');
	}
	moveRight() {
		return this.moveDir('right');
	}

	// moveUp and moveDown have almost identical algorithms:
	// - first check left and right, if so insAtLeft/RightEnd of them
	// - else check the parent's 'upOutOf'/'downOutOf' property:
	//   + if it's a function, call it with the cursor as the sole argument and
	//     use the return value as if it were the value of the property
	//   + if it's a TNode, jump up or down into it:
	//     - if there is a cached Point in the block, insert there
	//     - else, seekHoriz within the block to the current x-coordinate (to be
	//       as close to directly above/below the current position as possible)
	//   + unless it's exactly `true`, stop bubbling
	moveUpDown(dir: 'up' | 'down') {
		const cursor = this.notify('upDown').cursor;
		const dirInto: keyof TNode = `${dir}Into`,
			dirOutOf: keyof TNode = `${dir}OutOf`;
		if (cursor.right?.[dirInto]) cursor.insAtLeftEnd(cursor.right[dirInto]);
		else if (cursor.left?.[dirInto]) cursor.insAtRightEnd(cursor.left[dirInto]);
		else {
			cursor.parent?.bubble((ancestor: TNode) => {
				if (ancestor[dirOutOf]) {
					if (typeof ancestor[dirOutOf] === 'function')
						(ancestor[dirOutOf] as (cursor: Cursor) => void)(cursor);
					if (ancestor[dirOutOf] instanceof TNode) cursor.jumpUpDown(ancestor, ancestor[dirOutOf]);
					if (ancestor[dirOutOf] !== true) return false;
				}
				return true;
			});
		}
		return this;
	}
	moveUp() {
		return this.moveUpDown('up');
	}
	moveDown() {
		return this.moveUpDown('down');
	}

	deleteDir(dir: Direction | undefined) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');
		const cursor = this.cursor;

		const hadSelection = cursor.selection;
		this.notify('edit'); // Shows the cursor and deletes a selection if present.
		if (!hadSelection) {
			if (cursor[dir]) cursor[dir].deleteTowards(dir, cursor);
			else cursor.parent?.deleteOutOf(dir, cursor);
		}

		// Call the contactWeld for a SupSub so that it can deal with having its base deleted.
		cursor.right?.postOrder('contactWeld', cursor);

		cursor.left?.siblingDeleted?.(cursor.options, 'right');
		cursor.right?.siblingDeleted?.(cursor.options, 'left');

		cursor.parent?.bubble('reflow');

		return this;
	}

	ctrlDeleteDir(dir: Direction | undefined) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');
		const cursor = this.cursor;
		if (!cursor[dir] || cursor.selection) return this.deleteDir(dir);

		this.notify('edit');
		if (dir === 'left') {
			new Fragment(cursor.parent?.ends.left, cursor.left).remove();
		} else {
			new Fragment(cursor.right, cursor.parent?.ends.right).remove();
		}
		if (cursor.parent) cursor.insAtDirEnd(dir, cursor.parent);

		// Call the contactWeld for a SupSub so that it can deal with having its base deleted.
		cursor.right?.postOrder('contactWeld', cursor);

		cursor.left?.siblingDeleted?.(cursor.options, 'right');
		cursor.right?.siblingDeleted?.(cursor.options, 'left');
		cursor.parent?.bubble('reflow');

		return this;
	}

	backspace() {
		return this.deleteDir('left');
	}

	deleteForward() {
		return this.deleteDir('right');
	}

	selectDir(dir: Direction | undefined) {
		const cursor = this.notify('select').cursor,
			seln = cursor.selection;
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');

		if (!cursor.anticursor) cursor.startSelection();

		const node = cursor[dir];
		if (node) {
			// "if node we're selecting towards is inside selection (hence retracting)
			// and is on the *far side* of the selection (hence is only node selected)
			// and the anticursor is *inside* that node, not just on the other side"
			if (seln && seln.ends[dir] === node && cursor.anticursor?.[dir === 'left' ? 'right' : 'left'] !== node) {
				node.unselectInto(dir, cursor);
			} else node.selectTowards(dir, cursor);
		} else cursor.parent?.selectOutOf(dir, cursor);

		cursor.clearSelection();
		if (!cursor.select()) cursor.show();
	}

	selectLeft() {
		this.selectDir('left');
	}

	selectRight() {
		this.selectDir('right');
	}
}
