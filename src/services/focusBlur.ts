// Focus and Blur events

import type { Controllerable } from 'src/controller';
import type { Nodeable } from 'tree/node';

export const FocusBlurEvents = <TBase extends Controllerable>(Base: TBase) => class extends Base {
	focusBlurEvents() {
		this.textarea?.focus(() => {
			this.blurred = false;
			this.container.addClass('mq-focused');
			if (!this.cursor.parent)
				this.cursor.insAtRightEnd(this.root);
			if (this.cursor.selection) {
				this.cursor.selection.jQ.removeClass('mq-blur');
				this.selectionChanged?.(); //re-select textarea contents after tabbing away and back
			}
			else
				this.cursor.show();
		}).blur(() => {
			this.blurred = true;
			this.container.removeClass('mq-focused');
			this.cursor.hide().parent?.blur();
			if (this.cursor.selection) this.cursor.selection.jQ.addClass('mq-blur');
		});
		this.blurred = true;
		this.cursor.hide().parent?.blur();
	}

	unbindFocusBlurEvents() {
		this.textarea?.off('focus blur');
	}
};

export const BlockFocusBlur = <TBase extends Nodeable>(Base: TBase) => class extends Base {
	focus() {
		this.jQ.addClass('mq-hasCursor');
		this.jQ.removeClass('mq-empty');
	}

	blur() {
		this.jQ.removeClass('mq-hasCursor');
		if (this.isEmpty()) this.jQ.addClass('mq-empty');
	}
};
