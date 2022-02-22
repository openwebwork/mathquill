// Focus and Blur events

import type { Constructor } from 'src/constants';
import type { ControllerBase } from 'src/controller';
import type { Node } from 'tree/node';

export const FocusBlurEvents = <TBase extends Constructor<ControllerBase>>(Base: TBase) => class extends Base {
	focusBlurEvents() {
		this.textarea?.on('focus', () => {
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
		}).on('blur', () => {
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

export const BlockFocusBlur = <TBase extends Constructor<Node>>(Base: TBase) => class extends Base {
	focus() {
		this.jQ.addClass('mq-hasCursor');
		this.jQ.removeClass('mq-empty');
	}

	blur() {
		this.jQ.removeClass('mq-hasCursor');
		if (this.isEmpty()) this.jQ.addClass('mq-empty');
	}
};
