// Controller for a MathQuill instance, on which services are registered.

import type { Direction } from 'src/constants';
import type { Constructor } from 'src/constants';
import { L, R, prayDirection } from 'src/constants';
import type { Handler, DirectionHandler, Handlers, Options } from 'src/options';
import { Cursor } from 'src/cursor';
import { Node } from 'tree/node';
import { Fragment } from 'tree/fragment';
import { HorizontalScroll } from 'services/scrollHoriz';
import { LatexControllerExtension } from 'services/latex';
import { MouseEventController } from 'services/mouse';
import { FocusBlurEvents } from 'services/focusBlur';
import { ExportText } from 'services/exportText';
import { TextAreaController } from 'services/textarea';

export class ControllerBase {
	id: number;
	// FIXME: I don't think this is used at all.
	data: { [key: string]: any } = {};
	root: Node;
	container: JQuery;
	options: Options;
	cursor: Cursor;
	apiClass?: any;
	editable = false;
	blurred?: boolean;
	textareaSpan?: JQuery<HTMLSpanElement>;
	textarea?: JQuery<HTMLTextAreaElement>;

	constructor(root: Node, container: JQuery, options: Options) {
		this.id = root.id;

		this.root = root;
		this.container = container;
		this.options = options;

		this.cursor = new Cursor(root, options);
	}

	handle(name: keyof Handlers, dir?: Direction) {
		const handlers = this.options.handlers;
		if (handlers && handlers[name]) {
			if (dir === L || dir === R) (handlers[name] as DirectionHandler)?.(dir, this.apiClass);
			else (handlers[name] as Handler)?.(this.apiClass);
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
	selectionChanged() {};
}

export type Controllerable = Constructor<ControllerBase>;

export class Controller extends
ExportText(
	TextAreaController(
		LatexControllerExtension(
			FocusBlurEvents(
				MouseEventController(
					HorizontalScroll(
						ControllerBase
					)
				)
			)
		)
	)
) {
	constructor(root: Node, container: JQuery, options: Options) {
		super(root, container, options);
		root.controller = this;
	}

	// Methods that deal with the browser DOM events from interaction with the typist.

	keystroke(key: string, evt: Event) {
		this.cursor.parent?.keystroke(key, evt, this);
	}

	escapeDir(dir: Direction, key: string, e: Event) {
		prayDirection(dir);
		const cursor = this.cursor;

		// only prevent default of Tab if not in the root editable
		if (cursor.parent !== this.root) e.preventDefault();

		// want to be a noop if in the root editable (in fact, Tab has an unrelated
		// default browser action if so)
		if (cursor.parent === this.root) return;

		cursor.parent?.moveOutOf(dir, cursor);
		return this.notify('move');
	}

	moveDir(dir: Direction) {
		prayDirection(dir);
		const cursor = this.cursor, updown = cursor.options.leftRightIntoCmdGoes;

		if (cursor.selection) {
			cursor.insDirOf(dir, cursor.selection.ends[dir] as Node);
		}
		else if (cursor[dir]) cursor[dir]?.moveTowards(dir, cursor, updown);
		else cursor.parent?.moveOutOf(dir, cursor, updown);

		return this.notify('move');
	}
	moveLeft() { return this.moveDir(L); }
	moveRight() { return this.moveDir(R); }

	// moveUp and moveDown have almost identical algorithms:
	// - first check left and right, if so insAtLeft/RightEnd of them
	// - else check the parent's 'upOutOf'/'downOutOf' property:
	//   + if it's a function, call it with the cursor as the sole argument and
	//     use the return value as if it were the value of the property
	//   + if it's a Node, jump up or down into it:
	//     - if there is a cached Point in the block, insert there
	//     - else, seekHoriz within the block to the current x-coordinate (to be
	//       as close to directly above/below the current position as possible)
	//   + unless it's exactly `true`, stop bubbling
	moveUpDown(dir: 'up' | 'down') {
		const cursor = this.notify('upDown').cursor;
		const dirInto: keyof Node = `${dir}Into`, dirOutOf: keyof Node = `${dir}OutOf`;
		if (cursor[R]?.[dirInto]) cursor.insAtLeftEnd(cursor[R]?.[dirInto] as Node);
		else if (cursor[L]?.[dirInto]) cursor.insAtRightEnd(cursor[L]?.[dirInto] as Node);
		else {
			cursor.parent?.bubble((ancestor: Node) => {
				if (ancestor[dirOutOf]) {
					if (typeof ancestor[dirOutOf] === 'function')
						(ancestor[dirOutOf] as (cursor: Cursor) => void)(cursor);
					if (ancestor[dirOutOf] instanceof Node)
						cursor.jumpUpDown(ancestor, ancestor[dirOutOf] as Node);
					if (ancestor[dirOutOf] !== true)
						return false;
				}
			});
		}
		return this;
	}
	moveUp() { return this.moveUpDown('up'); }
	moveDown() { return this.moveUpDown('down'); }

	deleteDir(dir: Direction) {
		prayDirection(dir);
		const cursor = this.cursor;

		const hadSelection = cursor.selection;
		this.notify('edit'); // deletes selection if present
		if (!hadSelection) {
			if (cursor[dir]) cursor[dir]?.deleteTowards(dir, cursor);
			else cursor.parent?.deleteOutOf(dir, cursor);
		}

		cursor[L]?.siblingDeleted?.(cursor.options, R);
		cursor[R]?.siblingDeleted?.(cursor.options, L);
		cursor.parent?.bubble('reflow');

		return this;
	}

	ctrlDeleteDir(dir: Direction) {
		prayDirection(dir);
		const cursor = this.cursor;
		if (!cursor[dir] || cursor.selection) return this.deleteDir(dir);

		this.notify('edit');
		if (dir === L) {
			new Fragment(cursor.parent?.ends[L], cursor[L]).remove();
		} else {
			new Fragment(cursor[R], cursor.parent?.ends[R]).remove();
		};
		cursor.insAtDirEnd(dir, cursor.parent as Node);

		cursor[L]?.siblingDeleted?.(cursor.options, R);
		cursor[R]?.siblingDeleted?.(cursor.options, L);
		cursor.parent?.bubble('reflow');

		return this;
	}

	backspace() { return this.deleteDir(L); }

	deleteForward() { return this.deleteDir(R); }

	selectDir(dir: Direction) {
		const cursor = this.notify('select').cursor, seln = cursor.selection;
		prayDirection(dir);

		if (!cursor.anticursor) cursor.startSelection();

		const node = cursor[dir];
		if (node) {
			// "if node we're selecting towards is inside selection (hence retracting)
			// and is on the *far side* of the selection (hence is only node selected)
			// and the anticursor is *inside* that node, not just on the other side"
			if (seln && seln?.ends[dir] === node && cursor.anticursor?.[dir === L ? R : L] !== node) {
				node.unselectInto(dir, cursor);
			}
			else node.selectTowards(dir, cursor);
		} else cursor.parent?.selectOutOf(dir, cursor);

		cursor.clearSelection();
		cursor.select() || cursor.show();
	}

	selectLeft() { return this.selectDir(L); }

	selectRight() { return this.selectDir(R); }
}
