import { type Direction, type Constructor, otherDir } from 'src/constants';
import type { Cursor } from 'src/cursor';
import type { VNode } from 'tree/vNode';
import type { TNode } from 'tree/node';
import type { MathCommand, MathElement } from 'commands/mathElements';

export const RootBlockMixin = (_: MathElement) => {
	_.moveOutOf = (dir: Direction) => _.controller?.handle('moveOutOf', dir);
	_.deleteOutOf = (dir: Direction) => _.controller?.handle('deleteOutOf', dir);
	_.selectOutOf = (dir: Direction) => _.controller?.handle('selectOutOf', dir);
	_.upOutOf = () => _.controller?.handle('upOutOf');
	_.downOutOf = () => _.controller?.handle('downOutOf');
	_.reflow = () => _.controller?.handle('edit');
};

// Editability methods called by the cursor for editing, cursor movements, and selection of the MathQuill tree.
// These all take in a direction and the cursor.
// The MathCommand and TextBlock classes use this mixin.
export const deleteSelectTowardsMixin = <TBase extends Constructor<TNode>>(Base: TBase) =>
	class extends Base {
		moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
			const nodeAtEnd = (updown && this[`${updown}Into`]) || this.ends[otherDir(dir)];
			if (nodeAtEnd) cursor.insAtDirEnd(otherDir(dir), nodeAtEnd);
			if (cursor.parent) cursor.controller.aria.queueDirEndOf(otherDir(dir)).queue(cursor.parent, true);
		}

		deleteTowards(dir: Direction, cursor: Cursor) {
			if (this.isEmpty()) cursor[dir] = this.remove()[dir];
			else this.moveTowards(dir, cursor);
		}

		selectTowards(dir: Direction, cursor: Cursor) {
			cursor[otherDir(dir)] = this;
			cursor[dir] = this[dir];
		}
	};

export const DelimsMixin = <TBase extends Constructor<MathCommand>>(Base: TBase) =>
	class extends Base {
		delims?: [HTMLElement, HTMLElement];
		content?: HTMLElement;

		addToElements(el: VNode | HTMLElement) {
			super.addToElements(el);
			const children = this.elements.children();
			this.delims = [children.firstElement, children.lastElement];
			this.content = children.contents[1] as HTMLElement;
		}
	};
