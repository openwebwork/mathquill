// Selection "singleton" class
// Sort of a singleton, since there should only be one per editable math textbox, but any one HTML document can contain
// many such textboxes, so any one JS environment could actually contain many instances.

import type { Direction } from 'src/constants';
import type { Node } from 'tree/node';
import { L } from 'src/constants';
import { Fragment } from 'tree/fragment';

export class Selection extends Fragment {
	constructor(withDir?: Node, oppDir?: Node, dir: Direction = L) {
		super(withDir, oppDir, dir);
		this.jQ = this.jQ.wrapAll('<span class="mq-selection"></span>').parent();
		//can't do wrapAll(this.jQ = $(...)) because wrapAll will clone it
	}

	adopt(parent: Node, leftward?: Node, rightward?: Node) {
		this.jQ.replaceWith(this.jQ = this.jQ.children());
		return super.adopt(parent, leftward, rightward);
	}

	clear() {
		// using the browser's native .childNodes property so that we
		// don't discard text nodes.
		this.jQ.replaceWith(this.jQ[0].childNodes as unknown as Element[]);
		return this;
	}

	join(methodName: {[P in keyof Node]: Node[P] extends (() => string) ? P: never}[keyof Node]) {
		return this.fold<string>('', (fold, child) => fold + child[methodName ?? 'latex']());
	}
}
