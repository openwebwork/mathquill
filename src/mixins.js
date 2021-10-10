const RootBlockMixin = (_) => {
	for (const name of ['moveOutOf', 'deleteOutOf', 'selectOutOf', 'upOutOf', 'downOutOf']) {
		_[name] = function(dir) { this.controller.handle(name, dir); };
	}

	_.reflow = function() {
		this.controller.handle('reflow');
		this.controller.handle('edited');
		this.controller.handle('edit');
	};
};

// Editability methods called by the cursor for editing, cursor movements, and selection of the MathQuill tree.
// These all take in a direction and the cursor.
// The MathCommand and TextBlock classes use this mixin.
const deleteSelectTowardsMixin = (base) => class extends base {
	moveTowards(dir, cursor, updown) {
		const updownInto = updown && this[`${updown}Into`];
		cursor.insAtDirEnd(-dir, updownInto || this.ends[-dir]);
	}

	deleteTowards(dir, cursor) {
		if (this.isEmpty()) cursor[dir] = this.remove()[dir];
		else this.moveTowards(dir, cursor, null);
	}

	selectTowards(dir, cursor) {
		cursor[-dir] = this;
		cursor[dir] = this[dir];
	}

}

// The MathBlock and the RootMathCommand (used by the RootTextBlock) use this.
const writeMethodMixin = (base) => class extends base {
	write(cursor, ch) {
		if (this.isSupSubLeft) {
			if (cursor.options.autoSubscriptNumerals && this === this.parent.sub) {
				if (ch === '_') return;
				const cmd = this.chToCmd(ch, cursor.options);
				if (cmd instanceof Symbol) cursor.deleteSelection();
				else cursor.clearSelection().insRightOf(this.parent);
				return cmd.createLeftOf(cursor.show());
			}
			if (cursor[L] && !cursor[R] && !cursor.selection
				&& cursor.options.charsThatBreakOutOfSupSub.indexOf(ch) > -1) {
				cursor.insRightOf(this.parent);
			}
		}

		const cmd = this.chToCmd(ch, cursor.options);
		if (cursor.selection) cmd.replaces(cursor.replaceSelection());
		if (!cursor.isTooDeep()) {
			cmd.createLeftOf(cursor.show());
		}
	}
}
