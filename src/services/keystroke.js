// Deals with the browser DOM events from
// interaction with the typist.

Controller.prototype.keystroke = function(key, evt) {
	this.cursor.parent.keystroke(key, evt, this);
};

Node.prototype.keystroke = function(key, e, ctrlr) {
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

Node.prototype.moveOutOf = // called by Controller::escapeDir, moveDir
Node.prototype.moveTowards = // called by Controller::moveDir
Node.prototype.deleteOutOf = // called by Controller::deleteDir
Node.prototype.deleteTowards = // called by Controller::deleteDir
Node.prototype.unselectInto = // called by Controller::selectDir
Node.prototype.selectOutOf = // called by Controller::selectDir
Node.prototype.selectTowards = // called by Controller::selectDir
	function() { pray('overridden or never called on this node'); };

Controller.onNotify(function(e) {
	if (e === 'move' || e === 'upDown') this.show().clearSelection();
});

Controller.prototype.escapeDir = function(dir, key, e) {
	prayDirection(dir);
	const cursor = this.cursor;

	// only prevent default of Tab if not in the root editable
	if (cursor.parent !== this.root) e.preventDefault();

	// want to be a noop if in the root editable (in fact, Tab has an unrelated
	// default browser action if so)
	if (cursor.parent === this.root) return;

	cursor.parent.moveOutOf(dir, cursor);
	return this.notify('move');
};

optionProcessors.leftRightIntoCmdGoes = function(updown) {
	if (updown && updown !== 'up' && updown !== 'down') {
		throw `"up" or "down" required for leftRightIntoCmdGoes option, got "${updown}"`;
	}
	return updown;
};

Controller.prototype.moveDir = function(dir) {
	prayDirection(dir);
	const cursor = this.cursor, updown = cursor.options.leftRightIntoCmdGoes;

	if (cursor.selection) {
		cursor.insDirOf(dir, cursor.selection.ends[dir]);
	}
	else if (cursor[dir]) cursor[dir].moveTowards(dir, cursor, updown);
	else cursor.parent.moveOutOf(dir, cursor, updown);

	return this.notify('move');
};
Controller.prototype.moveLeft = function() { return this.moveDir(L); };
Controller.prototype.moveRight = function() { return this.moveDir(R); };

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
Controller.prototype.moveUpDown = function(dir) {
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
Controller.prototype.moveUp = function() { return this.moveUpDown('up'); };
Controller.prototype.moveDown = function() { return this.moveUpDown('down'); };

Controller.onNotify(function(e) { if (e !== 'upDown') this.upDownCache = {}; });
Controller.onNotify(function(e) { if (e === 'edit') this.show().deleteSelection(); });

Controller.prototype.deleteDir = function(dir) {
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
};

Controller.prototype.ctrlDeleteDir = function(dir) {
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
};

Controller.prototype.backspace = function() { return this.deleteDir(L); };

Controller.prototype.deleteForward = function() { return this.deleteDir(R); };

Controller.onNotify(function(e) { if (e !== 'select') this.endSelection(); });

Controller.prototype.selectDir = function(dir) {
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
};

Controller.prototype.selectLeft = function() { return this.selectDir(L); };

Controller.prototype.selectRight = function() { return this.selectDir(R); };
