// Add the capability for MathQuill to generate ARIA alerts.

import type { Direction } from 'src/constants';
import type { ControllerBase } from 'src/controller';
import { TNode } from 'tree/node';
import type { Fragment } from 'tree/fragment';

type AriaQueueItem = TNode | Fragment | string;

export class Aria {
	controller: ControllerBase;
	span = document.createElement('span');
	msg = '';
	items: AriaQueueItem[] = [];

	constructor(controller: ControllerBase) {
		this.controller = controller;
		this.span.classList.add('mq-aria-alert');
		this.span.setAttribute('aria-live', 'assertive');
		this.span.setAttribute('aria-atomic', 'true');
	}

	attach() {
		const container = this.controller.container;
		if (this.span.parentNode !== container) container.prepend(this.span);
	}

	queue(item: AriaQueueItem, shouldDescribe = false) {
		let output: Fragment | string = '';
		if (item instanceof TNode) {
			// Some constructs include verbal shorthand (such as simple fractions and exponents).  Since ARIA alerts
			// relate to moving through interactive content, we don't want to use that shorthand if it exists since
			// doing so may be ambiguous or confusing.
			const itemMathspeak = item.mathspeak({ ignoreShorthand: true });
			if (shouldDescribe) {
				// Used to ensure item is described when cursor reaches block boundaries.
				if (item.parent?.ariaLabel && item.ariaLabel === 'block') {
					output = `${item.parent.ariaLabel} ${itemMathspeak}`;
				} else if (item.ariaLabel) {
					output = `${item.ariaLabel} ${itemMathspeak}`;
				}
			}
			if (output === '') output = itemMathspeak;
		} else {
			output = item || '';
		}
		this.items.push(output);
		return this;
	}
	queueDirOf(dir: Direction | undefined) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');
		return this.queue(dir === 'left' ? 'before' : 'after');
	}
	queueDirEndOf(dir: Direction | undefined) {
		if (dir !== 'left' && dir !== 'right') throw new Error('a direction was not passed');
		return this.queue(dir === 'left' ? 'beginning of' : 'end of');
	}

	alert(t?: AriaQueueItem) {
		this.attach();
		if (t) this.queue(t);
		if (this.items.length) {
			// To cut down on potential verbiage from multiple Mathquills firing near-simultaneous ARIA alerts, update
			// the text of this instance if its container also has keyboard focus.  If it does not, leave the DOM
			// unchanged but flush the queue regardless.
			// Note: The msg variable is updated regardless of focus for unit tests.
			this.msg = this.items
				.join(' ')
				.replace(/ +(?= )/g, '')
				.trim();
			if (this.controller.containerHasFocus()) this.span.textContent = this.msg;
		}
		return this.clear();
	}

	// Clear out the internal alert message queue.  If emptyContent is set, also clear the text content for the alert
	// element (typically when the focused field has been blurred) so that stale alert text is not hanging around.
	clear(emptyContent = false) {
		this.items.length = 0;
		if (emptyContent) this.span.textContent = '';
		return this;
	}
}
