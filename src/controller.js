// Controller for a MathQuill instance, on which services are registered.

class ControllerBase {
	constructor(root, container, options) {
		this.id = root.id;
		this.data = {};

		this.root = root;
		this.container = container;
		this.options = options;

		root.controller = this;

		this.cursor = new Cursor(root, options);
	}

	handle(name, dir) {
		const handlers = this.options.handlers;
		if (handlers && handlers[name]) {
			if (dir === L || dir === R) handlers[name](dir, this.apiClass);
			else handlers[name](this.apiClass);
		}
	}

	notify(e) {
		if (e === 'move' || e === 'upDown') this.cursor.show().clearSelection();
		if (e !== 'upDown') this.cursor.upDownCache = {};
		if (e === 'edit') this.cursor.show().deleteSelection();
		if (e !== 'select') this.cursor.endSelection();

		return this;
	}

	// Methods that deal with the browser DOM events from interaction with the typist.

	keystroke(key, evt) {
		this.cursor.parent.keystroke(key, evt, this);
	}

	escapeDir(dir, key, e) {
		prayDirection(dir);
		const cursor = this.cursor;

		// only prevent default of Tab if not in the root editable
		if (cursor.parent !== this.root) e.preventDefault();

		// want to be a noop if in the root editable (in fact, Tab has an unrelated
		// default browser action if so)
		if (cursor.parent === this.root) return;

		cursor.parent.moveOutOf(dir, cursor);
		return this.notify('move');
	}

	moveDir(dir) {
		prayDirection(dir);
		const cursor = this.cursor, updown = cursor.options.leftRightIntoCmdGoes;

		if (cursor.selection) {
			cursor.insDirOf(dir, cursor.selection.ends[dir]);
		}
		else if (cursor[dir]) cursor[dir].moveTowards(dir, cursor, updown);
		else cursor.parent.moveOutOf(dir, cursor, updown);

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
	moveUpDown(dir) {
		const cursor = this.notify('upDown').cursor;
		const dirInto = `${dir}Into`, dirOutOf = `${dir}OutOf`;
		if (cursor[R][dirInto]) cursor.insAtLeftEnd(cursor[R][dirInto]);
		else if (cursor[L][dirInto]) cursor.insAtRightEnd(cursor[L][dirInto]);
		else {
			cursor.parent.bubble((ancestor) => {
				let prop = ancestor[dirOutOf];
				if (prop) {
					if (typeof prop === 'function') prop = ancestor[dirOutOf](cursor);
					if (prop instanceof Node) cursor.jumpUpDown(ancestor, prop);
					if (prop !== true) return false;
				}
			});
		}
		return this;
	}
	moveUp() { return this.moveUpDown('up'); }
	moveDown() { return this.moveUpDown('down'); }

	deleteDir(dir) {
		prayDirection(dir);
		const cursor = this.cursor;

		const hadSelection = cursor.selection;
		this.notify('edit'); // deletes selection if present
		if (!hadSelection) {
			if (cursor[dir]) cursor[dir].deleteTowards(dir, cursor);
			else cursor.parent.deleteOutOf(dir, cursor);
		}

		if (cursor[L].siblingDeleted) cursor[L].siblingDeleted(cursor.options, R);
		if (cursor[R].siblingDeleted) cursor[R].siblingDeleted(cursor.options, L);
		cursor.parent.bubble('reflow');

		return this;
	}

	ctrlDeleteDir(dir) {
		prayDirection(dir);
		const cursor = this.cursor;
		if (!cursor[dir] || cursor.selection) return this.deleteDir(dir);

		this.notify('edit');
		if (dir === L) {
			new Fragment(cursor.parent.ends[L], cursor[L]).remove();
		} else {
			new Fragment(cursor[R], cursor.parent.ends[R]).remove();
		};
		cursor.insAtDirEnd(dir, cursor.parent);

		if (cursor[L].siblingDeleted) cursor[L].siblingDeleted(cursor.options, R);
		if (cursor[R].siblingDeleted) cursor[R].siblingDeleted(cursor.options, L);
		cursor.parent.bubble('reflow');

		return this;
	}

	backspace() { return this.deleteDir(L); }

	deleteForward() { return this.deleteDir(R); }

	selectDir(dir) {
		const cursor = this.notify('select').cursor, seln = cursor.selection;
		prayDirection(dir);

		if (!cursor.anticursor) cursor.startSelection();

		const node = cursor[dir];
		if (node) {
			// "if node we're selecting towards is inside selection (hence retracting)
			// and is on the *far side* of the selection (hence is only node selected)
			// and the anticursor is *inside* that node, not just on the other side"
			if (seln && seln.ends[dir] === node && cursor.anticursor[-dir] !== node) {
				node.unselectInto(dir, cursor);
			}
			else node.selectTowards(dir, cursor);
		}
		else cursor.parent.selectOutOf(dir, cursor);

		cursor.clearSelection();
		cursor.select() || cursor.show();
	}

	selectLeft() { return this.selectDir(L); }

	selectRight() { return this.selectDir(R); }

}

class Controller extends HorizontalScroll(
	LatexControllerExtension(
		MouseEventController(
			FocusBlurEvents(
				ExportText(
					TextAreaController(ControllerBase)
				)
			)
		)
	)
) {}
