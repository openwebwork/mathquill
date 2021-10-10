// Focus and Blur events

const FocusBlurEvents = (base) => class extends base {
	focusBlurEvents() {
		const ctrlr = this, root = ctrlr.root, cursor = ctrlr.cursor;
		ctrlr.textarea.focus(() => {
			ctrlr.blurred = false;
			ctrlr.container.addClass('mq-focused');
			if (!cursor.parent)
				cursor.insAtRightEnd(root);
			if (cursor.selection) {
				cursor.selection.jQ.removeClass('mq-blur');
				ctrlr.selectionChanged(); //re-select textarea contents after tabbing away and back
			}
			else
				cursor.show();
		}).blur(() => {
			ctrlr.blurred = true;
			ctrlr.container.removeClass('mq-focused');
			cursor.hide().parent.blur();
			if (cursor.selection) cursor.selection.jQ.addClass('mq-blur');
		});
		ctrlr.blurred = true;
		cursor.hide().parent.blur();
	}

	unbindFocusBlurEvents() {
		this.textarea.off('focus blur');
	}
};

const BlockFocusBlur = (base) => class extends base {
	focus() {
		this.jQ.addClass('mq-hasCursor');
		this.jQ.removeClass('mq-empty');
	}

	blur() {
		this.jQ.removeClass('mq-hasCursor');
		if (this.isEmpty()) this.jQ.addClass('mq-empty');
	}
};
