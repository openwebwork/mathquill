// Selection "singleton" class
// Sort of a singleton, since there should only be one per editable math textbox, but any one HTML document can contain many such
// textboxes, so any one JS environment could actually contain many instances.

import { Fragment } from 'tree/fragment';

export class Selection extends Fragment {
	constructor(...args) {
		super(...args);
		this.jQ = this.jQ.wrapAll('<span class="mq-selection"></span>').parent();
		//can't do wrapAll(this.jQ = $(...)) because wrapAll will clone it
	}

	adopt(...args) {
		this.jQ.replaceWith(this.jQ = this.jQ.children());
		return super.adopt(...args);
	}

	clear() {
		// using the browser's native .childNodes property so that we
		// don't discard text nodes.
		this.jQ.replaceWith(this.jQ[0].childNodes);
		return this;
	}

	join(methodName) {
		return this.fold('', (fold, child) => fold + child[methodName]());
	}
}
