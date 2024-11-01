import type { Direction, Constructor } from 'src/constants';
import type { Cursor } from 'src/cursor';
import type { VNode } from 'tree/vNode';
import type { TNode } from 'tree/node';
import type { MathCommand, MathElement } from 'commands/mathElements';

export const RootBlockMixin = (_: MathElement) => {
	_.moveOutOf = (dir: Direction) => _.controller?.handle('moveOutOf', dir);
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
export const deleteSelectTowardsMixin = <TBase extends Constructor<TNode>>(Base: TBase) =>
	class extends Base {
		moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
			const nodeAtEnd = (updown && this[`${updown}Into`]) || this.ends[dir === 'left' ? 'right' : 'left'];
			if (nodeAtEnd) cursor.insAtDirEnd(dir === 'left' ? 'right' : 'left', nodeAtEnd);
			if (cursor.parent)
				cursor.controller.aria.queueDirEndOf(dir === 'left' ? 'right' : 'left').queue(cursor.parent, true);
		}

		deleteTowards(dir: Direction, cursor: Cursor) {
			if (this.isEmpty()) cursor[dir] = this.remove()[dir];
			else this.moveTowards(dir, cursor);
		}

		selectTowards(dir: Direction, cursor: Cursor) {
			cursor[dir === 'left' ? 'right' : 'left'] = this;
			cursor[dir] = this[dir];
		}
	};

// Use a CSS transform to scale the HTML elements,
// or gracefully degrade to increasing the fontSize to match the vertical Y scaling factor.
export const scale = (elts: HTMLElement[], x: number, y: number) => {
	elts.forEach((elt) => {
		elt.style.transform = `scale(${x.toString()},${y.toString()})`;
	});
};

export const DelimsMixin = <TBase extends Constructor<MathCommand>>(Base: TBase) =>
	class extends Base {
		delims?: [HTMLElement, HTMLElement];
		content?: HTMLElement;

		reflow = () => {
			const contentStyle = this.content ? getComputedStyle(this.content) : undefined;
			const boundingRect = this.content?.getBoundingClientRect();
			const height = (boundingRect?.height ?? 0) / parseFloat(contentStyle?.fontSize ?? '1');
			scale(this.delims as HTMLElement[], Math.min(1 + 0.2 * (height - 1), 1.2), 1.2 * height);
		};

		addToElements(el: VNode | HTMLElement) {
			super.addToElements(el);
			const children = this.elements.children();
			this.delims = [children.firstElement, children.lastElement];
			this.content = children.contents[1] as HTMLElement;
		}
	};
