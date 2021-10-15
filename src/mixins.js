import { L, R } from 'src/constants';

export const RootBlockMixin = (_) => {
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
export const deleteSelectTowardsMixin = (base) => class extends base {
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

};

// The MathBlock and the RootMathCommand (used by the RootTextBlock) use this.
export const writeMethodMixin = (base) => class extends base {
	write(cursor, ch) {
		if (this.isSupSubLeft) {
			if (cursor.options.autoSubscriptNumerals && this === this.parent.sub) {
				if (ch === '_') return;
				const cmd = this.chToCmd(ch, cursor.options);
				if (cmd.isSymbol) cursor.deleteSelection();
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
};

const div_style = document.createElement('div').style,
	transformPropNames = {
		transform: 1,
		WebkitTransform: 1,
		MozTransform: 1,
		OTransform: 1,
		msTransform: 1
	};

let transformPropName;
for (const prop in transformPropNames) {
	if (prop in div_style) {
		transformPropName = prop;
		break;
	}
}

// Use a CSS 2D transform to scale the jQuery-wrapped HTML elements,
// or gracefully degrade to increasing the fontSize to match the vertical Y scaling factor.
// Ideas from http://github.com/louisremi/jquery.transform.js
export const scale = transformPropName
	? (jQ, x, y) => jQ.css(transformPropName, `scale(${x},${y})`, `scale(${x},${y})`)
	: (jQ, x, y) => jQ.css('fontSize', `${y}em`);

export const DelimsMixin = (Base) => class extends Base {
	jQadd(...args) {
		super.jQadd(...args);
		this.delimjQs = this.jQ.children(':first').add(this.jQ.children(':last'));
		this.contentjQ = this.jQ.children(':eq(1)');
	}

	reflow() {
		const height = this.contentjQ.outerHeight()
			/ parseFloat(this.contentjQ.css('fontSize'));
		scale(this.delimjQs, Math.min(1 + 0.2 * (height - 1), 1.2), 1.2 * height);
	}
};
