import type { Direction } from 'src/constants';
import { L, R } from 'src/constants';
import type { Cursor } from 'src/cursor';
import type { Nodeable, Node } from 'tree/node';
import type { MathCommandable, MathElement } from 'commands/mathElements';

export const RootBlockMixin = (_: MathElement) => {
	_.moveOutOf = (dir: Direction) =>  _.controller?.handle('moveOutOf', dir);
	_.deleteOutOf = (dir: Direction) => _.controller?.handle('deleteOutOf', dir);
	_.selectOutOf = (dir: Direction) => _.controller?.handle('selectOutOf', dir);
	_.upOutOf = (dir: Direction) => _.controller?.handle('upOutOf', dir);
	_.downOutOf = (dir: Direction) => _.controller?.handle('downOutOf', dir);

	_.reflow = () => {
		_.controller?.handle('reflow');
		_.controller?.handle('edited');
		_.controller?.handle('edit');
	};
};

// Editability methods called by the cursor for editing, cursor movements, and selection of the MathQuill tree.
// These all take in a direction and the cursor.
// The MathCommand and TextBlock classes use this mixin.
export const deleteSelectTowardsMixin = <TBase extends Nodeable>(Base: TBase) => class extends Base {
	moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
		const updownInto = updown && this[`${updown}Into`];
		cursor.insAtDirEnd(dir === L ? R : L, updownInto || this.ends[dir === L ? R : L] as Node);
	}

	deleteTowards(dir: Direction, cursor: Cursor) {
		if (this.isEmpty()) cursor[dir] = this.remove()[dir];
		else this.moveTowards(dir, cursor);
	}

	selectTowards(dir: Direction, cursor: Cursor) {
		cursor[dir === L ? R : L] = this;
		cursor[dir] = this[dir];
	}

};

// The MathBlock and the RootMathCommand (used by the RootTextBlock) use this.
export const writeMethodMixin = <TBase extends Nodeable>(Base: TBase) => class extends Base {
	write(cursor: Cursor, ch: string) {
		if (this.isSupSubLeft) {
			if (cursor.options.autoSubscriptNumerals && this === this.parent?.sub) {
				if (ch === '_') return;
				const cmd = this.chToCmd(ch, cursor.options);
				if (cmd.isSymbol) cursor.deleteSelection();
				else cursor.clearSelection().insRightOf(this.parent);
				cmd.createLeftOf(cursor.show());
			}
			if (cursor[L] && !cursor[R] && !cursor.selection
				&& cursor.options.charsThatBreakOutOfSupSub.indexOf(ch) > -1) {
				cursor.insRightOf(this.parent as Node);
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

let transformPropName = '';
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
	? (jQ: JQuery<HTMLElement>, x: number, y: number) => jQ.css(transformPropName, `scale(${x},${y})`)
	: (jQ: JQuery<HTMLElement>, x: number, y: number) => jQ.css('fontSize', `${y}em`);

export const DelimsMixin = <TBase extends MathCommandable>(Base: TBase) => class extends Base {
	delimjQs?: JQuery;
	contentjQ?: JQuery;

	reflow = () => {
		const height = (this.contentjQ?.outerHeight() ?? 0)
			/ parseFloat(this.contentjQ?.css('fontSize') ?? '1');
		scale(this.delimjQs as JQuery<HTMLElement>, Math.min(1 + 0.2 * (height - 1), 1.2), 1.2 * height);
	};

	jQadd(jQ: JQuery | HTMLElement) {
		super.jQadd(jQ);
		this.delimjQs = this.jQ.children(':first').add(this.jQ.children(':last'));
		this.contentjQ = this.jQ.children(':eq(1)');
	}
};
